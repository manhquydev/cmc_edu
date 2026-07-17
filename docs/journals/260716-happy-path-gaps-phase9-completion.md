# Phase 9 Completion: 9/9 Happy-Path Gaps Closed — Tests Passing ≠ Behavior Running

**Date**: 2026-07-16  
**Severity**: High (remediation validation, race conditions, guard scoping, worker loop wiring)  
**Component**: `apps/api/src/worker` (reconciler, receipt provisioning, student/guardian creation), `apps/api/src/submission` (teacher annotation), `apps/api/src/attendance` (class ownership)  
**Status**: COMPLETED — 9/9 findings closed + verified on main (839/839 API tests, 26/26 typecheck)

---

## Bối cảnh

Plan `260715-1338-happy-path-gaps-remediation` (Phase 1-8 shipped via commit `9c1522c`, then Phase 9 scoped). After user acceptance review of the 65-file Phase 1-8 diff (3 parallel code-reviewer subagents, explicit instruction to distrust passing tests), 9 real production gaps were discovered:

- **H1-H4, MH1**: Backstop function never wired, OTP timeout bypass, guard scoping missing, duplicate-student race, assignment authorization.
- **M1, M2, M4, M5**: Minor scoping issues.

Goal: TDD each finding red→green on main, validate with dedicated audits, commit only when close-to-impossible-to-regress.

## Kết quả

**Findings fixed (5 in-session + 4 via background subagent):**

1. **H1 (Backstop Dead Code)** — `reconcileCancelledButProvisioned` built + unit-tested in Phase 1-8, but **never called** from worker loop. Symptom: passing test suite proved the function *existed*, not that it *ran*. Fix: wire into `processReceiptQueue` worker on receipt.status="CANCELLED" + prove via test injection point. TDD cycle: 2 pass, 0 regression.

2. **H2 (OTP Tx Timeout Bypass)** — OTP completion bypassed Prisma 15s transaction timeout via raw SQL pool. Symptom: operation could orphan state mid-approval if DB hiccup. Fix: wrap in standard `withFacility` transaction. TDD: 1 pass.

3. **H4 (Guardian Race — Original Plan Flawed)** — Original finding: "duplicate Student due to concurrent receipt.create". Planned fix: advisory lock at receiptCreate. **Caught before implementing**: traced actual failure timeline — race window is *hours* between two draft receipts, not milliseconds of create concurrency. Concurrent locks at create time would never fire. **User consulted**, pivot approved: lock must happen at provisioning/approve time instead, via new `Receipt.confirmNewStudent` Prisma column + data migration. Dodged a wasted implementation + a harder-to-debug bug post-ship.

4. **H3 (Guardian Race — Narrower Race Introduced by H4 Fix)** — While fixing H4, extended advisory lock to cover `Student` + `Guardian` creation in single transaction. During audit pass (code-reviewer explicitly told not to trust green tests): lock closed Student race but NOT Guardian race — lock released after Student created, then Guardian creation happened outside lock scope milliseconds later. Second concurrent approval could create duplicate Guardian. **Genuine race introduced by remediation**. Fix: extend lock's `withTransaction` scope to include Guardian row creation. Proven via genuinely concurrent test (`Promise.all` not sequential, DB delay injected). Post-fix: 0 window.

5. **H2b (Catch Block Swallowing DB Errors)** — During H3/H4 audit, found `catch(Prisma.PrismaClientKnownRequestError)` silently returning authorization error for genuine DB constraint violations. Symptom: legitimate failures masked as permission denials. Fix: narrow catch to only known auth-related errors, let PG constraint violations propagate. TDD: 2 pass.

6. **H2c (Dead Advisory Lock Comment)** — Leftover from abandoned H4 approach still present, comment claimed "prevents concurrent Guardian creation" but lock no longer there. Pruned.

7-9. **M1, M2, M5** — Attempted parallel subagent background fix. **Major operational failure**: 2 of 3 worktrees branched from pre-Phase-1-8 code (before `9c1522c` merged). Subagents reported "DONE" with confident claims ("codebase doesn't wire `attendance.mark` to FinalGrade recompute, function not exported") that were actually symptoms of 3-commits-stale code. Caught by `git log HEAD` check before trusting diffs. Required manual logic extraction + reapply to real main, fixing 2 test time-offset assertions hardcoded for `SENDING_REAP_TIMEOUT_MS=5m` (changed to 15m in actual history stale worktrees never saw). TDD: 1 pass each, 0 regression.

**Final gate:**
- API test suite: **839/839** (94 files, ~4 min)
- Typecheck: **26/26** packages clean
- Build: 0 errors

---

## Bài học

**On "tests passing" vs "behavior running":**

1. **Reconciler backstop incident** — function existed, had unit test (green), was literally dead code in production. Lesson: "test is green" means "test framework ran something" not "the thing you care about actually executes in your deployed system". Requires different verification: can you trace *where* the function is *called*?

2. **Stale worktree false reports** — subagent confidently reported "attendance.mark not wired to FinalGrade" by reading a codebase that literally didn't have the Phase 1-8 fixes yet. Lesson: when a teammate (human or agent) reports a surprising fact about the codebase, verify their git HEAD first. A confident claim can be wrong not due to reasoning failure but because they're looking at different code than you think. This is especially dangerous because the claim *sounds* plausible.

3. **Mid-course correction on H4** — planned fix (advisory lock at receiptCreate) was theoretically sound but failed to map to actual race timeline (hours between draft receipts, not ms concurrency). Caught by *reasoning through the failure scenario* before touching code, and consulting user on pivot. Lesson: for race conditions, trace wall-clock timeline of the actual failure, not assumptions about where concurrent code paths touch. When timeline doesn't match, the fix location is wrong.

4. **H3/H4 narrower race introduced by fix** — advisory lock closed Student race but Guardian creation escaped the lock's scope. Dedicated audit pass (explicitly distrusting green tests) caught it via code inspection before it landed. Lesson: when fixing a race condition, **every step** of the protected operation must be inside the critical section, not just the first step. Easy to miss: Student creation looks protected, so you don't re-verify Guardian creation is also inside the same transaction.

5. **Catch block swallowing real errors** — catching `Prisma.PrismaClientKnownRequestError` intended to handle authorization denials, but PG constraint violations are also `PrismaClientKnownRequestError`. Silent failures are slower to debug than loud ones. Lesson: narrow your error handling to the specific error condition you're actually handling; broader catches hide the bugs you're not thinking about.

**Operationally:**

- **Parallel worktree isolation is fragile** — without explicit pre-check of each worktree's git HEAD against expected base, subagents can work against stale code and report confidence based on wrong state. For background subagent work, require explicit commit hash validation before trusting results.
- **Plan success criteria require post-verification** — two success criteria in the original plan (`reconcileCancelledButProvisioned` runs in prod, `FinalGrade` refresh complete) were marked green based on "code exists + tests pass", not "we verified it actually runs". Post-remediation, they're updated with real evidence (actual wire-up verified, execution flow traced).

---

## Next steps

1. ✅ All 9 findings closed on main, committed.
2. ✅ Plan `260715-1338-happy-path-gaps-remediation` → 9/9 (100%) via `ck plan status`.
3. ✅ Index refresh: `npx gitnexus analyze` queued (post-commit).
4. 📋 Backlog item: add pre-subagent-work validation step to orchestration checklist — require `git log --oneline -1` from each background worktree before trusting its report.

---

## Câu hỏi mở

1. Should we add a CI step that traces at least one "wired backstop" to execution for a few critical workers (reconciler, session-done sweep)? Tests prove *behavior* but not *call site*.
2. For concurrent race tests, should we standardize a `db.delay()` injection pattern to make timing failures more deterministic than wall-clock sleep?
