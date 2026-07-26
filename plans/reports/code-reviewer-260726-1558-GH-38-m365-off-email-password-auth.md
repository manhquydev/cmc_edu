# Code Review — Staff email/password auth (M365-off fallback)

**Verdict: Request changes** (one credential-exposure blocker; everything else is solid and pattern-faithful)

## Scope note (tree moved mid-review)

The working tree was clean-committed mid-review: the exact change set now lives on branch
`feat/staff-password-auth` @ `b36e7c1` (per-file diffstat identical to the reviewed working-tree
diff; acceptance branch commit `6ff525f` documents the move). All `file:line` refs below are
against `b36e7c1`. 22 files, +1423/−36.

## Critical

### C1 — `passwordHash` (and lockout columns) serialized to the admin client
`apps/api/src/user/router.ts` returns raw AppUser rows; the `as AppUserDto` cast is compile-time
only. With the new schema columns, these now ship `passwordHash`, `mustChangePassword`,
`loginAttempts`, `loginLockedUntil` over tRPC:

- `user.list` — `findMany` with no `select` (:178) → `items as AppUserDto[]` (:182)
- `user.update` — `return updated as AppUserDto` (:227)
- `user.updateRoles` — full-row returns (:360, :379)
- `user.create` — (:145; hash is null at creation, shape leak only)

Failure scenario: any super_admin opening the Users page receives the PBKDF2 hash of every staff
member into browser memory, React Query cache, devtools, HAR captures, and any logging proxy.
Temp passwords set via the new reset flow are exactly the weak, human-typed values PBKDF2 hashes
are crackable against offline. This also contradicts the change's own claim (users.tsx reset
modal comment: "never stored readable anywhere") and is the one non-additive contract change
(AC8 exception). The audit middleware is NOT affected — it persists only `sanitizeAuditData(rawInput)`,
never result data (`apps/api/src/trpc.ts:160-168`, verified).

Fix: explicit `select` matching `AppUserDto` (or a shared pick helper) on all four return sites.
`pickList` already does this correctly.

## Important

### I1 — `seed-super-admin.ts` rerun silently reverts a rotated admin password
`scripts/seed-super-admin.ts:56,67,77` — `passwordFields` is spread into BOTH `create` and
`update` branches of the upsert. Runbook 1.9 tells operators to `source .env.prod` and run the
seed; `SUPER_ADMIN_PASSWORD` stays in `.env.prod` indefinitely. Any later rerun (upgrade, second
facility, drift repair) resets the admin's rotated password back to the bootstrap value sitting
in plaintext on disk, and re-forces `mustChangePassword`. Fix: apply `passwordFields` only in
`create` (or skip when `passwordHash` is already set), or have the runbook require unsetting
`SUPER_ADMIN_PASSWORD` after first seed.

### I2 — `user.changeOwnPassword` is an unthrottled current-password oracle
`apps/api/src/user/router.ts:238-249` verifies `currentPassword` with no attempt counting; the
login lockout only guards `/auth/staff-login`. nginx puts `/trpc/` in the `api` zone at 60r/s
(`infra/nginx/nginx.conf:35,78`). An attacker holding a hijacked session cookie (8h TTL) can
brute-force the account's real password to convert temporary session possession into durable
credentials — bypassing the 5/15min lockout entirely. No LMS precedent excuses this: LMS has no
current-password-verify procedure (resetChildPassword uses parental authority). Fix: consume the
same `loginAttempts`/`loginLockedUntil` counters on failed `currentPassword` checks.

### I3 — `/auth/logout` now unconditional, but `ADMIN_APP_ORIGIN` is only boot-enforced under SSO
`apps/api/src/server.ts:72` mounts logout always; `handleSsoLogout` redirects to
`getAdminOrigin()` which falls back to `http://localhost:5173` (`sso-routes.ts:61-63`).
`boot-checks.ts:198` requires `ADMIN_APP_ORIGIN` only when `SSO_ENABLED==='true'`. Prod boot with
SSO off and the var unset passes checks; logout then 302s staff to `localhost:5173/login`.
Cookie IS cleared on the 302 (Set-Cookie precedes redirect), so impact is broken UX, not a
session leak; `.env.prod.example:48` does set the var. Fix: move `ADMIN_APP_ORIGIN` to the
always-required list now that a route depending on it is always mounted.

## Minor

- **M1 (login CSRF / content-type):** `password-routes.ts` parses any body as JSON without
  checking `Content-Type`, so a cross-site `text/plain` form post can drive login CSRF (log the
  victim into an attacker's staff account). Posture is consistent with existing tRPC login
  endpoints (no CSRF tokens anywhere, SameSite=Lax) — not blocking; requiring
  `content-type: application/json` is a one-line hardening.
- **M2 (rate zone):** `/auth/staff-login` inherits `location /auth/` → `sso` zone, 30r/m+burst 20
  (`nginx.conf:94`), vs the 5r/m `auth` zone used for `lmsAuth.` logins. Per-account lockout
  mitigates single-account brute force, but 30r/m/IP permits cross-account password spraying.
  Consider `location = /auth/staff-login { limit_req zone=auth ... }`. The in-code comment
  claiming nginx rate-limits `/auth/` is accurate (verified).
- **M3 (lockout races):** read-modify-write `loginAttempts` increment (`password-routes.ts:104-117`)
  can lose counts under concurrency, and one failure after lock expiry re-locks immediately
  (attempts only reset on success). Both exactly match the `loginStudent` reference —
  consistent-by-design, noted only.
- **M4 (timing asymmetry):** wrong-password path adds an UPDATE round-trip vs unknown-email path
  (query + dummy verify) — a statistical email-enumeration channel. Same residual exists in
  `loginStudent`; consistent posture, noted only.
- **M5 (P2002 mapping unverified):** the expression index `AppUser_email_lower_key` is invisible
  to Prisma's field mapping; on duplicate email, `meta.target` is unlikely to be `['email']`, so
  `user.create`'s duplicate-email branch probably falls through to the misleading "A staff
  profile already exists for this userId." message. Spot-check against the synth DB; `user.update`'s
  catch-all message is fine.
- **M6 (no logout affordance):** zero references to `/auth/logout` in `apps/admin/src` — staff on
  shared machines cannot end an 8h session. Pre-existing gap (also true under SSO), but more
  relevant now that password login is the production path.

## Informational (documented non-issues)

- `mustChangePassword` is client-side-only (user can navigate straight to `/`; session fully
  valid server-side). Matches the accepted scope (AC3, same posture as LMS).
- `resetPassword` allows in-facility admin account takeover (reset then log in as target) —
  inherent to admin-reset semantics; both steps leave audit rows (`user.resetPassword` with admin
  actor, `auth.staffPasswordLogin` with target actor).
- RLS bypass in `attemptStaffPasswordLogin` is minimal and justified: facility unknown pre-lookup,
  access gated by the credential check, ADR 0042 escape hatch, mirrors the documented pattern.
  Tests run against the RLS-enforced `APP_DATABASE_URL` client, so the bypass is empirically proven.
- Migration is sound: DO-block duplicate pre-check fails loudly before the partial index; raw-SQL
  expression indexes have precedent (`20260721010000_contact_phone_normalize_dedup_unique`).
- Plaintext passwords never reach logs or AuditLog: both new procedures are in
  `AUDIT_EXCLUDED_PATHS` with inline secret-free rows (tests assert the temp password is absent);
  `console.error` sites log only `err`, never the body.

## Acceptance criteria verification

| # | Criterion | Result | How verified |
|---|-----------|--------|--------------|
| 1 | Prod boot with SSO off, no ENTRA/GRAPH | PASS (structural) | `boot-checks.ts` untouched by the diff; ENTRA/GRAPH pushed only when `SSO_ENABLED==='true'` (:195-202); `STAFF_SESSION_SECRET` enforced separately (:122-141). Did not boot a prod process. |
| 2 | Same cookie/claims as SSO | PASS | `password-routes.ts:132-139` signs `{userId, roles, facilityId}` = `sso-routes.ts:227-235`; same `signStaffToken`/`buildStaffCookieHeader`; claims round-trip asserted in `password-routes.test.ts:83-103`. |
| 3 | mustChangePassword forces screen | PASS (client-side, as scoped) | `login.tsx` redirect + `/change-password` route outside Shell; locked by `login.test.tsx:80-94`. |
| 4 | resetPassword gated / changeOwnPassword any staff | PASS | `:275` `requirePermission('user','manage')`, `:238` `protectedProcedure`; FORBIDDEN + cross-facility NOT_FOUND tested. |
| 5 | Lockout 5/15, generic, timing-equalized | PASS | Constants + dummy verify on every skip path; lockout, locked-with-correct-password, and expired-lock-reset all tested. |
| 6 | No email behavior change | PASS | Changeset touches no `apps/worker/` or enqueue sites; Graph changes are env/docs only. |
| 7 | No suite regression | NOT RERUN (per instructions) | Commit `b36e7c1` records typecheck 27/27, api password suites 18/18, admin suites 14/14. |
| 8 | Additive-only contracts | FAIL on one point | Columns nullable/defaulted, DTO text unchanged, cookie identical, SSO mounts intact, logout-unconditional intended — but runtime response shape of `user.list/create/update/updateRoles` now carries `passwordHash` (C1). |

Route-order check: exact-match `POST /auth/staff-login` and `GET /auth/logout` precede the SSO
block, upload paths, and the `/trpc/` prefix normalization — no shadowing possible.
`seedAppUser` derived emails are unique because `AppUser.userId` is `@unique` (only case-variant
userIds could collide on `lower(email)`; suite results are empirically clean).

## Recommended actions (priority order)

1. C1: add explicit `select`/DTO pick to the four AppUser return sites — blocker.
2. I1: restrict `passwordFields` to the upsert `create` branch (or guard on existing hash).
3. I2: wire `loginAttempts` lockout into `changeOwnPassword` failures.
4. I3: make `ADMIN_APP_ORIGIN` always-required in boot-checks.
5. M1/M2: content-type check + dedicated nginx rate zone for `/auth/staff-login` (cheap, optional).
6. M5: spot-check the P2002 duplicate-email message against the synth DB.

## Unresolved questions

- Is `user.list` intentionally expected to expose lockout metadata (`loginAttempts`,
  `loginLockedUntil`, `mustChangePassword`) to admins in a future Users-page iteration? If yes,
  add them to `AppUserDto` explicitly and still exclude `passwordHash`.
