# Security Audit — CMC EDU v2 P1 Backend (RBAC / RLS / Auth Boundaries / Threat Model)

- Date: 2026-07-06
- Branch: feat/p1-identity-enrollment
- Mode: READ-ONLY (no edits). Findings verified against actual code, docs/11, docs/14, docs/30, docs/08.
- Scope: packages/auth, apps/api/src/{trpc,context,server}.ts, all P1 routers (crm, finance, enrollment, guardian, lms-auth, provisioning), guardian/approved-children.ts.

---

## Verdict

The RBAC registry, RLS scoping discipline, SoD money gate, and child-data boundary are **implemented correctly and consistently** for P1. The registry matches the docs/14 §5 / docs/11 §5 permission matrix exactly for every pinned P1 permission. No hardcoded role arrays exist in production code (T16 clean).

The dominant risk is **entirely in the auth substrate, not the domain logic**: the dev-header session stub (`x-dev-user` / `x-dev-lms-user`) is a full impersonation primitive whose only guard against production exposure is a code comment and an out-of-band deploy-pipeline promise — there is **no runtime enforcement** that it is dev-only. Combined with the OTP flow having **no rate-limit / no brute-force cap**, the parent/child-data trust boundary is currently protected only by convention.

Both CRITICAL items are documented placeholders. They are ranked CRITICAL because the blast radius is total (full staff + full parent impersonation, cross-facility, including `super_admin` and any child's PII) and the mitigation is procedural rather than enforced in code.

Severity counts: **CRITICAL 2 · HIGH 1 · MEDIUM 3 · LOW 3**

---

## Ranked Findings (most severe first)

### CRIT-1 — `x-dev-user` header is unauthenticated full staff impersonation (any role, any facility) — CONFIRMED
`apps/api/src/context.ts:48-60, 84-96`

`parseDevUser` trusts a client-supplied JSON header `{ userId, roles, facilityId }` verbatim and installs it as `ctx.subject` + `ctx.facilityId`. Any caller can assert `{"roles":["super_admin"],"facilityId":"<any>"}` and pass every `requirePermission` gate and every `scoped()` RLS check for any facility. `can()` gives `super_admin` a global bypass (`packages/auth/src/index.ts:66`), so this is unconditional escalation over the entire ERP surface (approve money, cancel, refund, cross-facility reads/writes).

- Exploit: `curl` any tRPC endpoint with `x-dev-user: {"userId":"x","roles":["super_admin"],"facilityId":"F1"}` → approve arbitrary receipts, provision students, read any facility.
- Mitigation today: only the comment "MUST NOT ship to production … Gate this at the deploy pipeline." There is **no `NODE_ENV`/env-flag guard** in `createContext`; if the pipeline gate is missed, the server boots wide open. `server.ts` wires `createContext` directly with no environment check.
- Threat model: defeats T12 (cross-facility RLS), T16/T17 (RBAC/privilege), T19 (SoD), T7 (audit actor is attacker-chosen `userId`).
- Fix direction (not applied): refuse to honor `x-dev-*` unless an explicit `ALLOW_DEV_AUTH` env flag is set AND `NODE_ENV !== 'production'`; fail closed. Do not rely on the deploy pipeline as the sole control.

### CRIT-2 — `x-dev-lms-user` header + unsigned `sessionToken` = unauthenticated impersonation of any parent → full child-PII access — CONFIRMED
`apps/api/src/context.ts:62-69, 86-91` · `apps/api/src/lms-auth/router.ts:34-36, 132`

`ctx.lmsSubject` is populated directly from the client header `{ parentAccountId }` with no verification, and `lmsProcedure` only checks that `lmsSubject` is non-null (`trpc.ts:56-68`). The OTP-issued `sessionToken` is `base64url(JSON.stringify({parentAccountId}))` — **unsigned, non-expiring, trivially forgeable**, and is never actually verified server-side (nothing decodes/validates it; the FE just re-supplies `parentAccountId` in the dev header). The OTP flow is therefore cosmetic: authentication reduces to "assert your own `parentAccountId`."

- Exploit: set `x-dev-lms-user: {"parentAccountId":"<victim>"}` → call `enrollment.mine` and receive the victim's approved children + enrollments (`enrollment/router.ts:57-75`); the same identity is what `verifyOtp` would have returned. No OTP required.
- Blast radius: bypasses the entire child-data boundary (docs/08 §7). Directly realizes T2 (spoof parent session), T10 (parent sees another child's data), and feeds T9 (child PII).
- The `getApprovedChildren` gate is correct, but it trusts `parentAccountId`, which the attacker chooses.
- Fix direction (not applied): sign+expire the session token (or a real Session model) and derive `lmsSubject` from the verified token, not a raw header; gate the dev header the same way as CRIT-1.

### HIGH-1 — OTP verify has no rate-limit / no attempt cap → 6-digit brute force; requestOtp has no throttle → OTP spam — CONFIRMED
`apps/api/src/lms-auth/router.ts:66-136`

- `verifyOtp` (l.98-120): a wrong `code` does not match the `findFirst` (which filters on `code: input.code`), returns the generic error, and **leaves the pending OTP row intact** — there is no per-phone/per-OTP failed-attempt counter or lockout. With a 5-minute TTL and 1,000,000 combinations, unlimited concurrent attempts make brute force feasible. The one-shot `updateMany` claim (l.114-120) only prevents replay of the *correct* code; it does nothing to cap guesses.
- `requestOtp` (l.67-96): issues a new `LoginOtp` row on every call with no cooldown/rate-limit → SMS/OTP spam and unbounded pending rows per phone (T14 DoS).
- Threat model explicitly requires this: T2 "OTP … rate-limit" and T14 "rate-limit + cooldown". **Not implemented.**
- Note: anti-enumeration IS correct — wrong code, expired code, and no-`ParentAccount` all return the identical `GENERIC_VERIFY_FAILURE`, and `requestOtp` always issues a row and returns `{ok:true}` (l.76, 122-127). That part satisfies docs/24 WF-P1-07.

### MED-1 — Child-data reads are not audited (docs/08 §7 "Nhật ký truy cập dữ liệu trẻ") — CONFIRMED
`apps/api/src/enrollment/router.ts:57-75` · `apps/api/src/lms-auth/router.ts:129` · `guardian/approved-children.ts`

`enrollment.mine` and `verifyOtp` read a child's name and enrollment set but write no audit row. docs/08 §7 requires access to child records/photos be audited to detect abuse. Staff mutations audit well (crm/finance/guardian all write `auditLog`), but the parent-facing child reads do not. This is a "nên/should" control in §7; flagged MEDIUM given children 3–11 are the most sensitive asset.

### MED-2 — Cross-facility ParentAccount existence oracle in `receiptCreate` — CONFIRMED (low impact)
`apps/api/src/finance/router.ts:448`

`ctx.db.parentAccount.findUnique({ where: { phone } })` is global (ParentAccount is intentionally global identity), used only to compute a boolean `duplicatePhoneWarning`. A staff user at facility A can thereby learn whether a phone has *any* ParentAccount system-wide. Impact is a boolean, staff-only, and the global lookup is by-design for identity dedup — but it is a minor cross-boundary information leak (T12-adjacent). Same global-by-design pattern in `verifyOtp:122` and `provisioning:53` is correct (parent identity spans facilities).

### MED-3 — OTP codes stored in plaintext — CONFIRMED (low impact)
`apps/api/src/lms-auth/router.ts:76-78`

`LoginOtp.code` is written in plaintext. Short-lived (5 min) and low value, but a DB read (or backup leak) exposes live codes; combined with HIGH-1's lack of rate limiting this widens the OTP attack surface. Consider hashing or accept as documented debt.

### LOW-1 — `otherApprovedReceipt` lookup in cancel is not facility-scoped — CONFIRMED (defense-in-depth)
`apps/api/src/finance/router.ts:282-285`

The "sole approved receipt" check filters by `opportunityId` + `status` but omits `facilityId`, unlike every sibling query in the transaction. `opportunityId` is itself facility-derived so exploitation requires a cross-facility receipt pointing at this opportunity (not creatable through the P1 routers), but the inconsistency should be closed to keep the RLS invariant uniform.

### LOW-2 — `classBatchId` accepted without existence/facility validation — CONFIRMED (data integrity)
`apps/api/src/enrollment/router.ts:15-52` · `apps/api/src/finance/router.ts:45-51,428-430`

`enroll` and `receiptCreate` take `classBatchId` as an opaque `z.string().min(1)` and never verify the class exists or belongs to the facility. A caller with the permission can create `reserved` enrollments / receipts referencing arbitrary class ids (orphan rows). Not a trust-boundary breach (still permission- and facility-gated), but a validation gap.

### LOW-3 — `guardian.requestLink` is a student-UUID existence oracle — CONFIRMED (negligible)
`apps/api/src/guardian/router.ts:54-58`

`notFound` vs `created`/`already_*` reveals whether a given `Student.id` exists. UUIDs are unguessable and no child data is returned, so impact is negligible; noted for completeness.

---

## Controls CONFIRMED correct

- **RBAC registry matches spec exactly (T16).** Every pinned P1 permission in `packages/auth/src/index.ts:41-54` equals docs/14 §5 and docs/11 §5:
  - `crm.opportunityList` = GĐKD, sale, cskh, ctv_mkt ✓
  - `crm.opportunityLookup` = GĐKD, sale, ke_toan ✓
  - `finance.receiptCreate` = GĐKD, sale, ke_toan ✓
  - `finance.receiptApprove` = GĐKD, GĐĐT, ke_toan ✓ (`sale` correctly excluded — ADR-B / T19)
  - `finance.refundCreate` = GĐKD, ke_toan ✓
  - `enrollment.enroll` = GĐKD, GĐĐT, sale ✓
- **`receiptCancel` gated by `finance.receiptApprove`** (`finance/router.ts:552`) — exactly matches docs/11 §5 line 65; `sale` excluded from cancel as required.
- **No hardcoded role arrays in production code (T16).** Grep of `apps/api/src` finds role literals only in tests and the `z.enum(ROLES)` header validator; all gating flows through `requirePermission` → `can()`.
- **SoD money gate (T19/ADR-B).** `sale` cannot approve (registry); self-approval allowed only under `SELF_APPROVE_THRESHOLD` with a distinct-approver requirement above it (`finance/router.ts:134-140`); every approve/self-approve is audited (l.186-200), satisfying T7.
- **RLS scoping (T12).** Every domain query in crm/finance/enrollment/guardian is scoped by server-resolved `facilityId` via `scoped(ctx)` (throws UNAUTHORIZED if absent, `trpc.ts:89-94`); out-of-facility ids return `notFound`, not a distinguishable error. `enroll` ignores any client `facilityId` and derives it server-side (stronger than the docs/11 signature).
- **Money-tamper integrity (T4).** `netAmount` never mutated on approve/cancel; refund cap enforced with `SELECT … FOR UPDATE` + append-only `RefundRecord` (`finance/router.ts:366-417`); approve/cancel/reject use atomic `updateMany`-with-status-predicate claims to reject concurrent double-actions with CONFLICT.
- **Child-data boundary (T10, docs/08 §7).** `getApprovedChildren` is the single gate; `Guardian` rows exist only after `approveLink`, so pending/rejected requests grant nothing; `blocked_lms` students are excluded from all LMS reads (`approved-children.ts:29-35`); `enrollment.mine` and `verifyOtp` both route through it. No child data is returned by `requestLink`. **No pre-approval read path found.**
- **`lmsProcedure` cannot be satisfied by a staff session.** `lmsSubject` is a separate identity space populated only from `x-dev-lms-user`; a staff `subject` alone leaves `lmsSubject` null and is rejected (`trpc.ts:56-68`). No `super_admin`/SYSTEM bypass into LMS surfaces.
- **OTP anti-enumeration + replay.** Identical generic failure for wrong/expired/no-account (HIGH-1 note); one-shot `updateMany` claim prevents replay of a consumed code.
- **Provisioning idempotency (ADR 0041).** find-or-create with P2002 refetch on ParentAccount/Student/StudentAccount/Enrollment; runs outside the money transaction so a provisioning failure records a retry marker instead of rolling back approval (`finance/router.ts:513-544`).

---

## Threat-model coverage summary

| Threat | Status |
|---|---|
| T2 (OTP spoof/enumeration) | Enumeration DEFENDED; **spoof via unsigned token/dev header CRIT-2**; **rate-limit missing HIGH-1** |
| T4 (money tamper) | DEFENDED (netAmount frozen, refund cap FOR UPDATE, append-only) |
| T7/T8 (repudiation) | DEFENDED for staff mutations; child-read audit gap MED-1 |
| T9/T13 (child PII / plaintext) | P1 exposure path is CRIT-2; column encryption is deferred debt (out of P1 scope) |
| T10 (parent sees wrong child) | Boundary logic DEFENDED; undermined only by CRIT-2 impersonation |
| T11 (internalNote leak) | N/A in P1 (no internalNote surface) |
| T12 (cross-facility RLS) | DEFENDED in domain routers; MED-2 boolean oracle, LOW-1 scoping gap |
| T16 (RBAC drift/hardcode) | DEFENDED (registry-only, exact match) |
| T17/T19 (privilege / SoD self-approve) | DEFENDED (registry + threshold + audit) |

---

## Unresolved questions

1. Is there a deploy-pipeline control that physically removes/blocks `x-dev-user` / `x-dev-lms-user` before production, and is it tested? CRIT-1/CRIT-2 hinge on it; nothing in-repo enforces it. Recommend an in-code fail-closed env guard regardless.
2. `crm.opportunityCreate/Advance/MarkLost` and `guardian.approveLink` are **not pinned** in docs/14 §5 or docs/11 §5 (the matrix is "đại diện"). Code grants: create/advance/markLost = {GĐKD, sale}; approveLink = {GĐKD, GĐĐT, sale, giao_vien, cskh}. These look reasonable for WF-P1-01/06 but cannot be verified against a spec — confirm intended and add to the matrix.
3. Is OTP rate-limiting planned for P1 or deferred? Threat model marks T2/T14 as required mitigations; the code has neither.
4. Should parent-facing child-data reads (`enrollment.mine`, `verifyOtp`) emit an access audit per docs/08 §7?

Status: DONE
