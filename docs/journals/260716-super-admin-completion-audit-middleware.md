# Super Admin Completion: 4-Phase TDD Build + Code Review Caught a Real OTP Leak

**Date**: 2026-07-16
**Severity**: High (system-wide tRPC middleware touching every mutation; one Critical finding — plaintext OTP leak — caught pre-merge)
**Component**: `apps/api/src/trpc.ts` (audit middleware), `apps/api/src/audit/*`, `apps/api/src/facility/*`, `apps/admin/src/pages/admin/{facilities,network-ip,shift-config,audit-log}.tsx`
**Status**: COMPLETED on branch `feat/super-admin-completion` — 4/4 phases green (886/886 API tests, 258/258 admin tests, typecheck+build clean both apps), 1 Critical + 1 Medium finding from code review fixed and re-verified.

---

## Bối cảnh

Plan `260716-1047-super-admin-completion` (design: `plans/reports/brainstorm-260716-1047-super-admin-completion-report.md`) closed 4 gaps in the `super_admin` role surface:

1. Page-level permission gate on `shift-config.tsx` (defense-in-depth, URL-bypass fix).
2. `facility.update` (rename, code immutable after creation) + friendly duplicate-code error.
3. `FacilityNetwork` CRUD + `detectMyIp` self-detect endpoint (IP allowlist for attendance geofencing, ADR 0043).
4. System-wide audit-log middleware — auto-logs every successful tRPC mutation instead of ~15 hand-instrumented sites (which had already silently missed `user.create`/`user.update`).

Followed the harness's mandated pipeline: TDD (red→green) per phase, full regression gate after each, code-review agent on the complete branch diff before calling it done.

## Kết quả

- **Phase 1-3**: straightforward, TDD clean, no surprises. Phase 3 needed a small architecture decision resolved via `AskUserQuestion`: `FacilityNetwork` had no `DELETE` grant to `cmc_app` (only SELECT/INSERT/UPDATE from P3-I) — added a migration granting it, matching the existing precedent for genuinely-deletable catalogs (Course/Room/ClassBatch).
- **Phase 4 (the big one)**: a single `t.middleware` attached to a shared `basedProcedure` that every procedure kind (`public`/`protected`/`lms`) builds from — one wiring point instead of instrumenting ~100 individual mutations. Key design decisions:
  - Actor resolution covers staff (`userId` raw) / LMS parent (`parent:<id>`) / LMS student (`student:<id>`) / anonymous (public, no session) — all four verified via a dedicated ad-hoc test router built from the real exported procedure builders.
  - An explicit `AUDIT_EXCLUDED_PATHS` set (~25 entries) skips paths that already write a richer manual audit entry, so no mutation ever produces 2 rows.
  - Hit a real architecture conflict: the retention sweep (delete `AuditLog` rows >12mo) needs `DELETE` on a table that deliberately has `UPDATE`/`DELETE` revoked from `cmc_app` (append-only guarantee, `security/append-only-privilege.test.ts`). Resolved via `AskUserQuestion` — user picked "separate privileged connection for the sweep only" (matching the test harness's own `privilegedDb()` pattern) over weakening the grant.
  - Full API suite (886/886) stayed green through the wiring change — the single highest-blast-radius diff in the branch.

## Cửa review: 1 Critical thật, bắt được trước merge

Dispatched a `code-reviewer` agent on the full 6-commit branch diff before declaring done (per plan's own "Next steps: chạy code-review"). It found a **real, confirmed** bug:

- `lmsAuth.verifyOtp` / `verifyOtpEmail` were absent from `AUDIT_EXCLUDED_PATHS`. Both already write their own audit trail via a shared helper (`auditChildDataAccess`, action `guardian.childDataRead`) — but that helper is called BY NAME, not via an inline `auditLog.create('lmsAuth.verifyOtp', ...)` literal, so a path-by-path grep survey missed it.
- Because unexcluded, the generic middleware ALSO fired, writing `{ phone|email, code }` — the just-typed 6-digit OTP — verbatim into `AuditLog.data`. The `code` field isn't caught by the `/password|otp|token|secret/i` denylist (it's literally named `code`).
- Blast radius: readable by any `super_admin` via the brand-new `audit.list` screen, retained 12 months.

Verified the finding by reading source directly (not trusting the report blind) before fixing — confirmed both the missing exclude-list entry and the exact field name. Two-layer fix:
1. Added both paths to `AUDIT_EXCLUDED_PATHS`.
2. Widened the denylist to also strip a field named **exactly** `code` (not a substring match — `facilityCode`/`employeeCode` stay visible) as defense-in-depth for the next OTP-like endpoint the exclude-list survey might miss.
3. Added a regression test in `lms-auth/login.test.ts` proving no new `lmsAuth.verifyOtp` row is written (before/after count, since `AuditLog` is append-only and prior test runs can never be cleaned up).

Also fixed a Medium finding in the same pass: `network-ip.tsx`'s delete button fired immediately with no confirmation on a security-relevant row (IP allowlist), and toggle/delete mutation errors were silently swallowed. Added a `ConfirmDialog` gate + inline error banners.

## Bài học

- **A literal-string survey (`grep action: 'X.Y'`) is not a sound way to build an audit exclude-list.** The 2 misses both routed through a shared helper called by function reference, not an inline string match. The fix — an exact-match secondary denylist key (`code`) — is a cheaper, more durable safety net than trying to make the survey exhaustive.
- **Append-only tables need before/after count assertions in tests, not exact-count assertions.** Hit this twice in one session (once in the middleware's own test, once in the leak-regression test) — `AuditLog` rows from earlier runs (including runs from before a fix existed) can never be cleaned up via the test harness's normal connection, so `expect(count).toBe(1)` is wrong; `expect(after).toBe(before)` or a per-run-unique key is required.
- **Two real architecture tensions surfaced by "add a delete/retention feature to an append-only-by-design table"** — both correctly escalated via `AskUserQuestion` rather than silently picked, since either direction (grant vs. separate connection) is a legitimate security posture trade-off, not a purely technical call.
