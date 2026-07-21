# PII Sweep — Audit Denylist vs Input Schema (2026-07-19)

Phase 2 of `plans/260719-1145-log-system-remediation-a-plus`. Proactive sweep
(not reactive to an incident) of every tRPC mutation input schema in
`apps/api/src`, checked against the audit middleware's sensitive-field
denylist (`apps/api/src/audit/audit-helpers.ts`).

## Method (2-pass, per plan step 1)

- **Pass 1**: `grep '\.mutation('` across `apps/api/src` → 30 router files
  with at least one mutation (31 matches including
  `trpc-audit-middleware.test.ts`, excluded — not a router).
- **Pass 2**: read every file in full; for each `.input(X)`, `X` was in every
  case a `z.object(...)` constant defined inline in the same router file —
  confirmed via `grep '\.merge(\|\.extend(\|from .*schema'` across
  `apps/api/src`: **zero matches**. No router imports an input schema from a
  separate `schemas.ts`, and no schema uses `.merge`/`.extend` composition.
  So there is no second source to resolve — every field in every mutation
  input was read directly from its own file.

Files read (30 routers, all mutations, every field name enumerated):
`assessment`, `kpi`, `crm`, `finance`, `facility` (+ `network-router`),
`session-evidence`, `class/class-session-router`, `submission`, `lms-auth`,
`guardian`, `rewards/reward-router`, `rewards/gift-router`, `meeting`,
`class/class-batch-router`, `attendance`, `checkin`, `shift`, `payroll`,
`user`, `enrollment`, `student`, `parentAccount`, `reconciliation`,
`appointment`, `after-sale`, `class/schedule-router`, `exercise`, `room`,
`course`.

Denylist reference (`audit-helpers.ts`): regex `/password|otp|token|secret/i`
(substring) + exact-match `code`. Suspect-keyword checklist (Architecture,
plan phase-02): `pin`, `cccd`, `cmnd`, `passport`,
`bankAccount`/`soTaiKhoan`/`accountNumber`, `answer`, `credential`, `apiKey`,
`authorization`, `signature`, `hash`, `salt`.

## Findings

**No findings requiring a denylist addition.** Every field name across all 30
routers' mutation inputs is either already covered by the existing denylist
(`password`, `newPassword`, `otpCode`/`code` in OTP flows — all matched) or is
a plain business identifier/enum/number/date/free-text field outside the
denylist's intended scope (ids, names, phone, email, amounts, statuses,
dates, notes/descriptions/reasons). None of the suspect keywords (pin, cccd,
cmnd, passport, bankAccount, answer, credential, apiKey, authorization,
signature, hash, salt) appear as a field name anywhere in the 30 files read.

No exact-match additions were needed, so the R2-3 cross-phase constraint
(`hash`/`salt`/`signature` must be exact-match, never substring, so they
don't strip Phase 1's `resultHash`/`resultLength`) did not need to be
exercised — recorded here for the record: had a `hash` pattern been added,
it would have been exact-match only, per that constraint.

| Path | Field(s) reviewed | Verdict | Action |
|---|---|---|---|
| `lmsAuth.verifyOtp`/`verifyOtpEmail` | `code` | Already denylisted (exact-match) + path-excluded from auto-audit | None |
| `lmsAuth.loginStudent` | `password` | Already denylisted (regex) | None |
| `lmsAuth.resetChildPassword` | `newPassword` | Already denylisted (regex substring `password`) | None |
| `shift.submit` | `entries: [{date, shiftTemplateId}]` (nested array) | Fields not sensitive, but demonstrates the pre-recursion blind spot — this is the motivating example for the recursive fix below | Recursion added (see below), no denylist change |
| All other 27 routers | every mutation input field | No sensitive field found | None |

### Pre-existing observation (informational, not a Phase 2 finding to fix)

`room.create`'s input has a field literally named `code` (the room's short
code, e.g. `"P101"`). `room.create` is **not** in `AUDIT_EXCLUDED_PATHS` and
writes no manual audit row of its own, so its only AuditLog row is the
auto-middleware one — which strips `code` via the existing exact-match rule
(added in phase-04 specifically for the OTP-verify `code` field, per
`audit-helpers.ts`'s comment claiming a field named exactly `code` "is a bare
verification/OTP code in every mutation this app has" — not true for
`room.create`). `facility.create` has the same `code` field shape but is
**not** affected in practice: it's in `AUDIT_EXCLUDED_PATHS` and writes its
own unsanitized manual audit row (`facility/router.ts:82-90`) that captures
`code` in full — so the `Room` table itself is unaffected either way (Prisma
writes the real value); only the auto-middleware's `AuditLog.data.code` for
`room.create` is incomplete.

This is a **pre-existing** behavior from the phase-04 OTP remediation, not
something this phase's changes created. Per this phase's Rollback constraint
("denylist chỉ mở rộng, không thu hẹp") narrowing the exact-match set is out
of scope here. **Backlog candidate**: either exempt `room.create` (add to
`AUDIT_EXCLUDED_PATHS` with its own manual audit write, mirroring
`facility.create`) or scope the `code` exact-match to specific known
OTP-bearing paths instead of a bare field-name match — a design decision for
a future phase, not this sweep.

## Recursive sanitize (Architecture, mandatory per plan)

`sanitizeAuditData` was shallow — it only stripped top-level keys. Any
sensitive field nested inside an array-of-objects or nested-object input
would have passed through untouched. `shift.submit`'s real
`entries: z.array(z.object({date, shiftTemplateId}))` shape
(`apps/api/src/shift/router.ts:64-77`) is the concrete example that made this
a "no findings, but still ship the fix" deliverable rather than an optional
one (this sweep is the anti-recurrence artifact for the OTP-denylist
incident, not just a survey).

Implemented in `apps/api/src/audit/audit-helpers.ts`: `sanitizeValue`
recurses into plain objects and arrays, applying the same `isSensitiveKey`
check at every level. Top-level shallow behavior is unchanged (same loop, now
just recursive). Tests added in `audit-helpers.test.ts`:
nested-object-strips-sensitive-field, nested-array-of-objects-strips
(shift.submit shape), and a negative test proving a nested legitimate field
(`resultHash`) survives — directly backstopping the Phase 1 cross-phase gate.

## Gate

Full `pnpm --filter @cmc/api test` + `pnpm --filter @cmc/api typecheck` run
green after this change (see plan.md Validation Log / phase completion
notes for the run record).
