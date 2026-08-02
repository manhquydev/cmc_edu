# Security Posture / Threat-Model Review — 2026-08-02

Read-only review of the final merged state (`main` HEAD `88896d7`, working tree clean except
untracked report files). Scope: gitleaks allowlist, re-verification of the 6 dismissed CodeQL
auth/cert alerts, pnpm `overrides`, Trivy job scope, and the P0 non-root/loopback hardening.

## Headline verdict

**Were the 6 CodeQL auth/cert dismissals all correct? — YES, all 6 dismissals are justified.**
No real vulnerability was dismissed as a false-positive. Each dismissal is confirmed against the
actual code below. One dismissal (#28) rests on a technically-incomplete rationale but the
underlying decision is a deliberate, documented architectural tradeoff, not a defect — so it does
not rise to a CRITICAL "real vuln dismissed" finding. Detail in the table.

Everything in the explicit scope holds up. Findings below are ranked; none are blocking for the
already-merged work. The most actionable items are the gitleaks path allowlist breadth (Medium) and
the still-open non-scope advisories surfaced by `pnpm audit` (Medium, informational).

---

## 1. CodeQL dismissal re-verification (independent)

Each row independently re-derived from source, not copied from the prior triage.

| Alert | File:line | CodeQL rule | Independent verdict | Evidence I confirmed |
|-------|-----------|-------------|---------------------|----------------------|
| #22 | `staff-session.ts:43` (`hmacB64`) | insufficient-password-hash | **Dismissal CORRECT** | `createHmac('sha256', secret)` signs `header.payload` of the session token. No password is hashed. Real password hashing is PBKDF2 in `lms-auth/password-hash.ts` (verified: 100k iters, per-pw 16B salt, `timingSafeEqual`). HMAC-SHA256 is the correct token-signing primitive. Taint mislabel. |
| #21 | `sso-routes.ts:92` (`signOauthState`) | insufficient-password-hash | **Dismissal CORRECT** | HMAC-SHA256 over a `randomBytes(16)` OAuth `state` — a CSRF nonce, not a password. Taint mislabel. |
| #26 | `sso-routes.ts:138` (Set-Cookie `oauth_state`) | clear-text-storage | **Dismissal CORRECT** | Cookie value = `stateRaw.stateSig` (random hex + its HMAC). `HttpOnly`, `SameSite=Lax`, 5-min TTL, `Secure` in prod (line 128). CSRF token, carries no secret. Not at-rest storage of sensitive data. |
| #27 | `password-routes.ts:170` (`headers['Set-Cookie']`) | clear-text-storage | **Dismissal CORRECT** | Line 170 is the cookie-delivery sink in `sendJson`. Value is the HMAC-signed staff token via `buildStaffCookieHeader` (`HttpOnly`, `SameSite=Lax`, `Secure` in prod). Response body is only `{ok, mustChangePassword}`. Correct delivery mechanism, not clear-text-at-rest. |
| #28 | `trpc.ts:50` (`storeSession`) | clear-text-storage | **Dismissal ACCEPTABLE — weakest rationale** | See note below. The stated reason ("flagged value is the boolean `mustChangePassword`") sidesteps that the same `localStorage.setItem` sink also persists a real bearer `sessionToken`. But storing an LMS SPA bearer in localStorage is a deliberate, documented tradeoff (staff uses HttpOnly cookies; LMS uses bearer). Accepted-by-design, not a dismissed vuln. |
| #29 | `seed-local-sim-demo.ts:24` (`NODE_TLS_REJECT_UNAUTHORIZED='0'`) | disabling-certificate-validation | **Dismissal CORRECT** | Env is mutated only AFTER the line-21 regex gate `^https:\/\/(erp\.)?localhost(:\d+)?$` (anchored both ends — cannot match `localhost.evil.com` or `evil.com/localhost`). Dev seed script, additionally gated by `LOCAL_SIM_SEED_ALLOW=1`. Process only fetches loopback `BASE`. |

### Note on #28 (the one soft spot)

`storeSession` writes the whole `StoredLmsSession` — including `sessionToken` (a live bearer
credential) — to `localStorage`. That IS clear-text-at-rest and XSS-exfiltratable. The dismissal is
still defensible because:
- It is the standard SPA bearer pattern and an explicit architectural split (staff = HttpOnly cookie,
  LMS = bearer), documented in `trpc.ts` and the prior triage's informational note.
- It is not a regression introduced by the reviewed work.

Recommendation: dismiss with the accurate reason ("localStorage bearer is an accepted SPA tradeoff"),
not "the flagged value is just a boolean." If a future hardening pass wants to close it, move the LMS
session to an HttpOnly cookie like the staff path already uses. Non-blocking.

### Load-bearing comment claims — verified, not trusted

- `boot-checks.ts:126-141` genuinely refuses prod startup when `STAFF_SESSION_SECRET` is unset or
  equals the dev default; `assertStaffLmsSecretsDistinct` (G10) additionally forbids reusing the LMS
  secret. Confirmed the guards exist and run in `NODE_ENV=production`.
- `server.ts:62` mounts `/auth/staff-login` unconditionally; SSO routes only when `SSO_ENABLED=true`
  (`server.ts:77`). The "always mounted" comment is accurate.
- Staff login enforces per-account lockout (5 attempts → 15 min) with a dummy PBKDF2 verify on every
  no-match / inactive / locked path to equalize timing. No-leak invariant holds.

---

## 2. gitleaks allowlist — MEDIUM (breadth), non-blocking

`.gitleaks.toml`:
- `regexes = ['''xkeysib-abc123def456''']` — an **exact literal**, not a pattern. It cannot hide a
  real Brevo key (real keys carry different random suffixes). Tight and correct.
- `paths` includes `.*\.example$` — this exempts **any** file ending in `.example` from scanning, not
  just env templates. A real generic secret (DB password, session secret) placed in a `*.example`
  file would be missed by gitleaks. GitHub push protection is the server-side backstop, but push
  protection only recognizes **known provider patterns** (Brevo/AWS/etc.), NOT arbitrary
  high-entropy strings like this repo's `STAFF_SESSION_SECRET` / `POSTGRES_PASSWORD`. So for
  custom/generic secrets, both layers can miss a `*.example` file.

Is the "push protection is the backstop" reasoning sound? **Partially.** It holds for
provider-recognized secret types (the Brevo key the allowlist regex targets). It does NOT hold for
generic secrets. Mitigating factors that lower this to Medium/Low:
- `.gitignore` blocks `.env*` except `.env.example` and `.env.prod.example`, so the only committable
  env files are those two by convention.
- I verified the three committed `*.example` files (`.env.example`, `.env.prod.example`,
  `.claude/.env.example`) — all use empty strings or `CHANGE_ME` placeholders. No real secret today.

Recommendation (hardening, optional): narrow the first path rule to env templates only (the second
rule `.*/\.env\.example$` already covers the real case), e.g. drop `.*\.example$` or replace with
`(^|/)\.env(\..+)?\.example$`. Keeps early local feedback on non-env `*.example` files.

---

## 3. pnpm overrides — RESOLVED, no downgrade (confirmed)

`package.json` overrides and lockfile resolution:
- `fast-uri: ^3.1.4` → resolves `fast-uri@3.1.5` (lockfile). Patched, an **upgrade**.
- `brace-expansion: ^5.0.8` → `brace-expansion@5.0.9`; `minimatch@9>brace-expansion: ^2.1.3` →
  `brace-expansion@2.1.4`. Both above the CVE-2025-5889 (ReDoS) patch floors (2.0.2 / ≥4.0.1); no
  downgrade. The scoped `minimatch@9>` override is a deliberate, correct move to keep minimatch on a
  compatible 2.x patched line rather than force it to 5.x.

`pnpm audit` (run live) no longer lists `fast-uri` or `brace-expansion` in any advisory — the
overrides are effective. **This scope item is fully satisfied.**

MEDIUM (informational, out of the stated scope but surfaced by the same audit): other advisories
remain open. None are in the two overridden packages:
- CRITICAL `vitest <3.2.6` (UI-server arbitrary file read/exec) — **dev-only, path `scripts>vitest`**;
  only exploitable when the Vitest UI server is listening. Not a prod surface. Worth a follow-up bump.
- HIGH `vite <=6.4.2` (`server.fs.deny` bypass, Windows) and HIGH `postcss <=8.5.17` (path traversal)
  — dev/build chain via vitest, not shipped.
- HIGH `react-router >=7.12.0 <8.3.0` (RSC-mode CSRF bypass) — **runtime dep of `apps/admin`**, but
  the advisory is scoped to React Server Components mode; `apps/admin` is a Vite SPA (no RSC), so not
  exploitable as-shipped. Bump when convenient.

These are not regressions from the reviewed work and are outside the fast-uri/brace-expansion ask;
flagged only so the "security posture" picture is complete.

---

## 4. Trivy misconfig job — REAL but low-assurance by design

`ci.yml` `security-scan` job: `scan-type: config`, `scan-ref: .`, `skip-dirs:
.claude,node_modules,.git`, `continue-on-error: true`, `exit-code: '0'`, uploads a report artifact.
Least-privilege `permissions: {contents: read, actions: write}`.

- Scope narrowing (config/IaC only; defer dependency CVEs to Dependabot and secrets to push
  protection) is sound de-duplication, not a gap — those other classes are genuinely covered
  elsewhere.
- It is **report-only and never blocks a merge** (continue-on-error + exit-code 0, not a required
  check). This is honest and documented in the job comment, but means findings only matter if someone
  reads the artifact. Real coverage of the IaC/misconfig class, low enforcement. Acceptable for the
  stated "Tier 2, someone must own triage first" posture.

Minor nit (carried from the prior triage, still true): `actions: write` is not actually required by
`actions/upload-artifact@v4` (it uses the Actions runtime token). Harmlessly over-provisioned on both
`ui-e2e` and `security-scan`; tightening to `contents: read` only would be marginally cleaner.

---

## 5. P0 non-root / loopback — REAL attack-surface reduction, not cosmetic

- **Loopback binding:** `compose.local-sim.yml` binds `127.0.0.1:5432:5432` and `127.0.0.1:3000:3000`.
  Postgres and the API are unreachable from LAN/WAN; only nginx (TLS) is the public entry. Real.
- **Non-root process:** `Dockerfile.api` runtime layer drops to stock `node` (UID 1000) via
  `su-exec` in `docker-entrypoint-node.sh` after chowning the blob volume. The container starts as
  root only to chown the named volume, then the long-running server process is unprivileged. This is
  a legitimate common pattern; the "runs as non-root" claim holds for the actual workload process
  (there is no `USER`/`user:` directive, but su-exec drop achieves the same runtime posture).

Verdict: real hardening. Reduces the exposed surface from three host-reachable services to one, and
runs the API unprivileged. Not cosmetic.

---

## Ranked findings

| # | Severity | Finding | Action |
|---|----------|---------|--------|
| 1 | Medium | gitleaks `.*\.example$` path allowlist is broader than needed; push-protection backstop only covers provider-recognized secrets, not generic ones | Narrow to env templates; optional |
| 2 | Medium (info) | Open non-scope advisories: CRITICAL vitest (dev-only), HIGH vite/postcss (dev), HIGH react-router (runtime but RSC-only, not exploitable in SPA) | Bump when convenient; none prod-exploitable as shipped |
| 3 | Low | #28 dismissal rationale is technically incomplete (localStorage stores a real bearer token, not just a boolean) | Re-word the dismissal reason; consider HttpOnly LMS cookie later |
| 4 | Low | `actions: write` over-provisioned on `ui-e2e` / `security-scan` (upload-artifact doesn't need it) | Optional tighten to `contents: read` |
| 5 | Low | `assertStaffSecretConfiguredForProd` message says "≥32 chars" but only checks unset/dev-default, not length | Add a length assertion, or soften the message |

## Positive observations (risk-calibration only)

- Password hashing, timing equalization, per-account lockout, generic-error no-leak, and secret
  boot-checks (including LMS≠staff distinctness) are all real and correctly implemented — the auth
  surface is in good shape, which is why the 6 CodeQL alerts are genuinely noise.
- The pnpm override strategy (scoped minimatch pin + global bump) shows the author understood the
  dependency graph rather than blanket-forcing a version.

## Unresolved questions

- None blocking. The only open decision is whether to spend a follow-up on the still-open dev-chain
  advisories (vitest/vite/postcss) and the react-router runtime bump — all low real-risk today.

---

Status: DONE_WITH_CONCERNS
Summary: All 6 CodeQL auth/cert dismissals independently confirmed CORRECT (no real vuln dismissed); pnpm overrides resolve fast-uri/brace-expansion with no downgrade; loopback+non-root hardening is real; Trivy is report-only by design.
Concerns: gitleaks `*.example` path allowlist is broader than the push-protection backstop covers (Medium); unrelated CRITICAL/HIGH advisories remain open outside the reviewed scope (Medium, none prod-exploitable as shipped); #28 dismissal reason is technically incomplete though the decision stands.
