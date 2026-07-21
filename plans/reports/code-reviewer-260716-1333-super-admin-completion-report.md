# Code Review — feat/super-admin-completion vs main

## Scope
- Diff: `git diff main...HEAD` (6 feature commits + 2 gitnexus symbol-refresh commits), 35 files, +2104/-69.
- Focus per request: `apps/api/src/trpc.ts`, `apps/api/src/audit/audit-helpers.ts`, `apps/api/src/worker/audit-log-retention-sweep.ts`, `apps/api/src/facility/{router,network-router}.ts`, plus general security/dead-code sweep.
- Did not re-run the full test suite (per instruction); verified behavior by reading source and cross-referencing call sites.

## Overall Assessment
The middleware wiring itself (`auditLogMiddleware`, `basedProcedure` chain, error-swallow-on-audit-failure) is sound and cannot break the mutation it wraps — verified below. The `AUDIT_EXCLUDED_PATHS` survey, however, missed two real call sites, and the sensitive-field denylist has a gap that these two missed call sites walk straight into: **OTP verification codes are now written in cleartext to `AuditLog`, viewable by any `super_admin` through the new `audit.list` screen.** This is the one blocking issue. Facility/FacilityNetwork CRUD, code-immutability, and the retention-sweep connection pattern are all correct.

## Critical Issues

### 1. `lmsAuth.verifyOtp` / `lmsAuth.verifyOtpEmail` leak the plaintext OTP code (and phone/email) into `AuditLog.data`
- `apps/api/src/trpc.ts:88-114` (`AUDIT_EXCLUDED_PATHS`) does not contain `'lmsAuth.verifyOtp'` or `'lmsAuth.verifyOtpEmail'`.
- Both procedures are `publicProcedure.mutation(...)` (`apps/api/src/lms-auth/router.ts:274-326`, `:452-...`) that succeed and already write their OWN audit trail via `auditChildDataAccess()` (`apps/api/src/guardian/approved-children.ts:80-95`, using `auditLog.createMany`, action `'guardian.childDataRead'`).
- Because these two paths are absent from the exclude set, `auditLogMiddleware` (`apps/api/src/trpc.ts:139-163`) ALSO fires for them, writing a second, generic row: `action: 'lmsAuth.verifyOtp'`, `data: sanitizeAuditData(rawInput)`.
- `rawInput` for these procedures is `{ phone, code }` / `{ email, code }` (`verifyOtpInput`/`verifyOtpEmailInput`, `lms-auth/router.ts:145-155`). `sanitizeAuditData` (`apps/api/src/audit/audit-helpers.ts:51-65`) only strips keys matching `/password|otp|token|secret/i`. The field is literally named `code`, which does **not** match that regex — so the 6-digit OTP the user just typed is persisted verbatim into `AuditLog.data`, alongside their phone/email.
- Blast radius: `apps/api/src/audit/router.ts` (`audit.list`, `requirePermission('audit','list')`, permission `[]` → super_admin only) returns full rows including `data` to the admin UI — so this is a real, reachable exposure of authentication material to super_admin sessions, retained for 12 months (`audit-log-retention-sweep.ts`) before deletion.
- Root cause is explainable: the code comment at `trpc.ts:86` says the exclude list was built by "grep for `auditLog.create`" — but the actual write for these two paths happens inside a shared helper (`auditChildDataAccess`) called by name, not via an inline `ctx.db.auditLog.create(...)` literal in `lms-auth/router.ts`, so a path-by-path trace missed it.
- Mitigating factor: the leaked `sessionToken` returned by these mutations is NOT stored (only `rawInput` is sanitized/persisted, not `resultData`), and the OTP is already one-shot-consumed by the time it's audited, so it cannot be replayed for login. It is still a credential-adjacent PII leak that violates the stated denylist intent and the "never 2 rows for 1 call" design goal.
- Fix: add `'lmsAuth.verifyOtp'` and `'lmsAuth.verifyOtpEmail'` to `AUDIT_EXCLUDED_PATHS`, AND widen `SENSITIVE_KEY_RE` to also catch bare `code` (or make the denylist explicit per-path rather than name-pattern-based, since "code" is too generic a key to safely leave in). Add a regression test asserting `lmsAuth.verifyOtp`/`verifyOtpEmail` produce exactly the `guardian.childDataRead` rows and never a `data.code` field anywhere in `AuditLog`.

## High Priority
None beyond the item above — the rest of the exclude-list survey checks out (verified every `auditLog.create`/`createMany` call site in `apps/api/src` against the exclude list; see Scout section).

## Medium Priority

### 2. Every successful mutation in the app now does 2 sequential DB round-trips
- `auditLogMiddleware` (`trpc.ts:139-163`) `await`s the audit write before returning, on the base procedure every router builds from. This adds one full round-trip of latency to literally every mutation response in the app (previously true only for the ~25 hand-instrumented sites). Not wrong, but worth a latency/throughput check under load — consider whether a best-effort audit write needs to block the response, or could be fire-and-forget (`void`) now that failures are already logged-not-thrown.

### 3. `network-ip.tsx` — no delete confirmation, and mutation errors are inconsistently surfaced
- `apps/admin/src/pages/admin/network-ip.tsx`: the "Xoá" button calls `deleteMut.mutate({ id: row.id })` directly with no confirm dialog, for what is a security-relevant row (IP allowlist entry gating attendance-punch validation). `deleteMut.error` is never rendered anywhere in the component.
- The inline "Bật/Tắt" (toggle) button reuses `updateMut`, whose error message is only rendered inside the (closed, not-open-during-toggle) edit `Dialog` — a failed toggle fails silently from the user's perspective.

## Low Priority

### 4. `deriveEntityId`'s first-`*Id`-field heuristic is order-dependent
- `apps/api/src/audit/audit-helpers.ts:32-40`: for a mutation input/result with multiple `*Id` fields (e.g. `{ parentAccountId, studentId }`), `extractIdLike` returns whichever key iterates first in `Object.entries`, which may not be the entity the path name implies. Documented as accepted best-effort in the code comment — flagging only because it's easy to get a misleading `entityId` in the viewer for such paths; not urgent.

## Verified Correct (called out because explicitly in scope)

- **`auditLogMiddleware` cannot throw past a wrapped mutation.** `getRawInput()` is chained with `.catch(() => undefined)`; the entire audit-write block is inside `try {} catch { console.error }`; `resolveAuditActor`/`deriveEntity`/`deriveEntityId`/`sanitizeAuditData` are pure functions with defensive type guards and no throw paths. Confirmed the mutation's own result is returned regardless of audit-write outcome.
- **Exclude-list completeness (all `auditLog.create`/`createMany` sites in `apps/api/src` traced):** every mutation that already writes its own inline audit row is present in `AUDIT_EXCLUDED_PATHS` — `facility.create/update`, `facilityNetwork.create/update/delete`, `enrollment.blockLms`, `crm.opportunityCreate`, `classSession.cancel`, `finance.receiptApprove/receiptCancel`, `lmsAuth.requestOtp/requestOtpEmail/loginStudent/resetChildPassword`, `reconciliation.dismiss/action`, `user.updateRoles`, `attendance.mark/markAll`, `submission.saveTeacherAnnotation`, `parentAccount.updateEmail`, `student.resetPassword/setLifecycle`, `manualPunch.approve/reject` — **except** the two `lmsAuth.verifyOtp*` paths in Critical Issue #1. `student.get/getManyByIds/lookup` and `guardian`'s data-access audits on query procedures are correctly untouched (middleware only fires on `type==='mutation'`).
- **Facility `code` immutability is actually enforced, not just schema-omitted.** `facilityUpdateInput` (`facility/router.ts:33-39`) has no `code` field, and the `update()` call (`facility/router.ts:98-101`) only passes `data: { name: input.name }` — `code` is never touched by the write, confirmed by reading the Prisma call itself, not just the zod schema.
- **`facilityNetwork` CRUD scoping.** `create`/`update`/`delete`/`list` all derive `facilityId` server-side via `scoped(ctx)` (never trusting client input) and run through `withFacility(...)` for RLS; `detectMyIp` reads `ctx.ip` only, never client-supplied. `requirePermission('facilityNetwork','manage')` maps to an empty role array in `@cmc/auth` (super_admin-only bypass), matching `facility.*` and `audit.list`'s posture.
- **Retention sweep's separate-connection pattern is sound and consistent with existing precedent.** `audit-log-retention-sweep.ts` opens a singleton `PrismaClient` against `DATABASE_URL` directly (the migration/schema-owner role, distinct from `APP_DATABASE_URL` that `createPrismaClient()` uses for the app's `cmc_app`-role connection) — this is the exact same pattern as the test harness's `privilegedDb()` (`apps/api/src/test/db.ts:54-72`). The corresponding migration (`20260716120000_facility_network_delete_grant`) and the `AuditLog` `createdAt`/`actor` indexes (`20260716130000_audit_log_indexes`) are both present and match the new query/sweep access patterns.
- **`shift-config.tsx` gate.** The new page-level `canDo('compensationPolicy','manage')` gate matches the *pre-existing* `nav-registry.ts` entry for this page (unchanged by this diff) — this is not a new restriction, just closing the direct-URL bypass of an already-established nav gate. Confirmed `shift.manage`/`salaryTier.manage` are granted more broadly (`giam_doc_dao_tao`/`giam_doc_kinh_doanh`) than `compensationPolicy.manage` ([] / super_admin-only) in `@cmc/auth`, but since the nav link itself already restricted the whole page this way before the branch, it's a pre-existing product decision, not a regression introduced here.

## Recommended Actions
1. **(Blocking)** Add `'lmsAuth.verifyOtp'` and `'lmsAuth.verifyOtpEmail'` to `AUDIT_EXCLUDED_PATHS` in `apps/api/src/trpc.ts`, and widen the denylist regex (or the exclude survey methodology) to catch bare `code`/similar generic secret-bearing field names so this class of gap doesn't recur for the next OTP-like endpoint.
2. Add a regression test asserting no `AuditLog` row for either OTP-verify path ever contains a `code` (or `phone`/`email` alongside `code`) in `data`.
3. Consider whether the audit write should block the mutation response (latency) or become fire-and-forget, now that failure is already non-throwing.
4. Add a confirm step before `facilityNetwork.delete` in the admin UI, and surface `deleteMut`/toggle errors to the user.

## Unresolved Questions
- Is 12-month retention + super_admin-only access considered sufficient compensating control for OTP-code exposure by the product owner, or does this need immediate purge of any already-written rows in staging/prod once fixed?
- Confirm whether `APP_DATABASE_URL` is guaranteed set in every deployed environment — if unset, `createPrismaClient()` falls back to `DATABASE_URL`, making the app's own connection equal to the retention sweep's "privileged" connection (pre-existing characteristic of `createPrismaClient()`, not introduced by this branch, but worth a boot-time assertion given the append-only guarantee now depends on it more heavily).
