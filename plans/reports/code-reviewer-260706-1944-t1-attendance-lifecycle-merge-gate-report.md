# T1 Merge-Gate Review — Attendance + Class-Session Lifecycle

Adversarial, read-only review gating `feat/t1-attendance-session-lifecycle` → main.
Scope: child-data write correctness, the 5 attendance gates, RLS, session lifecycle, e2e/CI.
Note: T1 changes are **uncommitted working-tree files** (not yet a commit); `git diff main..HEAD` is empty. Reviewed the working tree directly.

## Verdict: MERGE-READY (with 1 medium + low follow-ups)

No CONFIRMED critical or high defect. The 5 gates are enforced on every write path, RLS is present and fail-closed, markAll is atomic, and CI gates correctly. Findings below are hardening/data-integrity follow-ups, none of which are child-data-exposure or bypass holes.

Severity counts: Critical 0 · High 0 · Medium 1 · Low 4 · Notes 3

---

## Findings (ranked)

### M1 — `classSession.cancel` has no guard against sessions with existing attendance — SUSPECTED (product intent)
`apps/api/src/class/class-session-router.ts:71-104`. Cancel flips `status='cancelled'` unconditionally. Attendance rows already marked for that session persist (FK is `ON DELETE RESTRICT`, but cancel does not delete). Gate 1 only blocks *new* writes to a cancelled session; it does nothing about attendance recorded *before* cancellation. Later monthly attendance-rate reporting (docs/19 §5, the stated purpose of `ictMonthOf`) must then decide whether a cancelled session's surviving rows count in the denominator. No reporting exists yet, so this is not a live bug, but it is an unresolved data-integrity decision that should be settled before reporting lands.
- Impact: potential skewed attendance-rate once reporting is built; orphaned-but-live child-data rows on a cancelled session.
- Fix (one line): either block cancel when `attendance` rows exist, or have the reporting query exclude `status='cancelled'` sessions — pick one and document it. Not a merge blocker on its own.

### L1 — `markAll` input has no upper bound on `entries` — CONFIRMED
`apps/api/src/attendance/router.ts:32-37`. `markAllInput.entries` is `.min(1)` with no `.max(...)`. Each entry runs findFirst + upsert + auditLog insert inside a single transaction (3N statements), so a very large array holds a write transaction (and locks) open for a long time — a cheap way to stall the writer. A class roster is small, so a cap (e.g. `.max(200)`) costs nothing.
- Fix: add `.max(200)` (or the real per-class roster ceiling) to the `entries` array.

### L2 — Gate-4 test proves the app-level filter, not RLS — CONFIRMED
`apps/api/src/attendance/gate.test.ts:127-141` is labeled "(RLS)" but the mechanism it exercises is the `where: { id, facilityId }` filter in `loadGatedSession` (the cross-facility session simply isn't returned). If the RLS policy or GUC wiring silently broke, this test would still pass. The RLS policy itself is correct and fail-closed (`current_setting(..., true)` → NULL → USING false when unset; WITH CHECK on insert/update), and matches every prior facility-scoped table — but there is no Attendance-specific test that bypasses the app filter to prove RLS alone blocks a cross-facility write.
- Fix: add one direct test that opens `withFacility(db, facilityB)` and attempts to read/insert an `Attendance` row for facilityA, asserting 0 rows / RLS rejection.

### L3 — Gate 5 (`ictMonthOf`) is entirely un-wired at write time — CONFIRMED (documented)
`apps/api/src/class/ict-time.ts` + `gate.test.ts:145-150`. `ictMonthOf` is a pure function with a unit test; it is not called by `mark`/`markAll`, and `Attendance` stores neither the session end time nor an ICT-month column (`markedAt` is marking wall-clock, not the reporting bucket). The router header explicitly defers this to reporting, so it is consistent with docs — flagged only so the reviewer/merger knows "gate 5" is a helper + unit test, not an enforced write-time invariant.

### L4 — `confirm` writes no audit row while `cancel` does — CONFIRMED (documented, acceptable)
`class-session-router.ts:108-131`. Intentional per the inline comment (non-destructive forward transition). Noting for completeness; if session-lifecycle auditing is ever a compliance requirement, confirm should join cancel.

---

## CONFIRMED-sound (verified, not issues)

- **Gate 1** (session exists + not cancelled): enforced in `loadGatedSession` and used by *both* `mark` and `markAll` — no per-entry bypass. `listBySession` deliberately uses a separate read-loader that allows cancelled sessions (read-only). Correct.
- **Gate 2** (`enrollment.classBatchId === session.classBatchId`): enforced in `loadGatedEnrollment`, called per-entry in the markAll loop — no skip. Tested (single + markAll rollback).
- **Gate 3** (enrollment `active`; reserved/withdrawn blocked, ADR-A): enforced, both negatives tested.
- **Gate 4** (facilityId server-derived from session, never client): `scoped(ctx).facilityId` comes from the session context; both session and enrollment lookups filter by it; upsert `create.facilityId` is the same value and is re-checked by RLS `WITH CHECK`. No client facilityId input exists on any attendance mutation. Cross-facility update is impossible (conflict key is a facility-A session).
- **markAll atomicity**: one `db.$transaction` (via `withFacility`); a gate failure on any entry throws → whole batch rolls back. Test `markAll rolls back...` asserts 0 rows. Correct.
- **Upsert re-mark**: unique `(classSessionId, enrollmentId)` + Prisma upsert (compiles to `INSERT ... ON CONFLICT`) → last-write-wins, no duplicate rows even under concurrency (worst case P2002 rollback, no corruption). Tested.
- **RLS + grants migration** (`20260706180000`): `ENABLE ROW LEVEL SECURITY` + `facility_isolation` policy (USING + WITH CHECK, fail-closed). GRANT reasoning verified: wave-A `ALTER DEFAULT PRIVILEGES` (migration `20260706150000`) narrowed future-table defaults to SELECT/INSERT, so Attendance auto-gets those and the migration adds UPDATE only — **no DELETE grant** (append-only; teardown uses the privileged migration role in `test/db.ts` + `e2e/src/db.ts`). Correct and least-privilege. `GRANT UPDATE ON ClassSession` needed for cancel/confirm — correct.
- **Authz**: `attendance.mark` = `['giao_vien','giam_doc_dao_tao']`; `super_admin` bypasses via `can()` → effective roster giao_vien/GĐĐT/super_admin as intended. Lifecycle (cancel/confirm/addMakeup) gated on `schedule.generate` (GĐĐT/super_admin). FORBIDDEN negatives tested (sale on mark; teacher on lifecycle).
- **H4 teacher-scoping gap**: CONFIRMED as documented-deferred, not a new hole — any `giao_vien` can mark any class *within their facility*; facility isolation still holds (RLS + app filter). No cross-facility exposure.
- **addMakeup room conflict**: reuses `assertNoRoomConflict` against the batch's own `roomId` (not client-supplied room); CONFLICT negative tested.
- **State transitions**: cancel rejects already-cancelled; confirm rejects non-planned. Both tested.
- **OTP e2e brute-force (lens 6)**: NOT a real production weakness. `readOtpCode` is a **test-only** direct-DB seam brute-forcing sha256×1e6 (sub-second) — the API never exposes the code. Production verify (`lms-auth/router.ts`) has: per-code 5-attempt lockout (`MAX_OTP_VERIFY_ATTEMPTS`), request cooldown, single live code per phone (new request expires prior — can't reset the counter), and TTL. sha256 (not a slow KDF) is the correct choice here because brute-force resistance comes from the lockout, not hash cost. CONFIRMED sound.
- **CI gating**: blocking job `typecheck-and-test` fails on red (default). e2e is a separate `continue-on-error: true` job (intentionally non-blocking per docs/26 phase-02). Root `pnpm test` is `turbo run test --filter=!@cmc/e2e`, so e2e does NOT leak into the blocking job. `migrate deploy` (superuser) creates `cmc_app`, then `ALTER ROLE ... PASSWORD` sets the CI-only throwaway password before app-role connections. No real secret committed; postgres/cmc_app creds are ephemeral CI container values. Migration ordering (…180000 after P2 …170000) is correct.

---

## Not executed
Did not run `vitest`/`playwright` — the integration + e2e suites require a live Postgres with the `cmc_app` RLS role, not provisioned in this read-only review environment. Findings are from static analysis of the diff against the surrounding codebase, migrations, and prior-phase patterns.

## Unresolved questions
1. M1: should a session with recorded attendance be cancellable, and how should reporting treat surviving rows on a cancelled session? (product/reporting decision)
2. Is branch protection configured to require the `typecheck-and-test` check on PRs to main? CI wires the gate correctly, but enforcement is a repo-settings concern outside this diff.

Status: DONE
