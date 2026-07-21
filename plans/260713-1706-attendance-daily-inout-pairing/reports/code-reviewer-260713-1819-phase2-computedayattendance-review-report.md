# Code Review: Phase 2 — domain core `computeDayAttendance`

## Scope
- Files: `packages/domain-payroll/src/day-attendance.ts` (new), `day-attendance.test.ts` (new, 13 tests), `index.ts` (modified exports), deleted `shift-attendance.ts` + `.test.ts`.
- Focus: phase 2 of ADR 0043 implementation only (phases 3-8 out of scope; the 2 known apps/api `TS2305` errors deferred to phase 5/6 per plan, not flagged here).

## Overall Assessment
Sound. Independently re-derived the overlap math and re-ran every numbered test case by hand against the implementation; all match. Ran the actual test suite and `apps/api` typecheck myself rather than trusting the summary — both match exactly what was claimed. No defects found in the core logic, the export cleanup, or cross-repo references to the deleted symbols.

## Verification performed (independent, not taken on faith)
- `pnpm --filter @cmc/domain-payroll test` → 36/36 pass (23 assemble-slip + 13 day-attendance), confirmed via direct run.
- `pnpm --filter @cmc/domain-payroll typecheck` → clean.
- `pnpm --filter @cmc/api typecheck` → exactly 2 `TS2305` errors, both `assignPunchesToShifts` not exported, at `src/kpi/auto-score.ts:36` and `src/payroll/router.ts:49`. No other errors. Matches claim.
- Repo-wide grep for `assignPunchesToShifts|ShiftAttendanceOutcome|AssignPunchesResult|shortSpan`: only hits outside the two known deferred call sites are docs/comments/plan-name strings (`docs/decisions/0043-...md`, `docs/codebase-summary.md:252`, `docs/22-adr...md`, `docs/20-quy-tac...md`, `packages/db/prisma/seed.mjs:58` comment, e2e test comments) and `apps/api/src/kpi/router.ts` / `apps/e2e/*` which reference a locally-defined `shortSpanShifts` field on `auto-score.ts`'s own return type — not the removed `ShiftAttendanceOutcome.shortSpan` — so they don't add typecheck breakage beyond the 2 known errors. Confirmed no stray import of the deleted module anywhere.
- `packages/domain-payroll/src/shift-attendance.ts` and `.test.ts`: confirmed deleted (glob empty), only referenced by a stale GitNexus index entry (expected — index not yet re-run post-delete) and unrelated plan-name-string comments.

## Focus-question findings

**(a) Overlap math — correct.** `shift.start < checkOut && shift.end > checkin` is the standard strict half-open-interval overlap test for `[checkin, checkout)` vs `[start, end)` (`a1 < b2 && b1 < a2`). Hand-traced:
- Case 5 (checkin 09:30 in ca sáng, checkout 15:30 in ca chiều): both shifts pass (`9:00<15:30 && 11:00>9:30` = true; `14:00<15:30 && 16:00>9:30` = true) → both credited, matches test.
- Case 6 (ca bỏ hoàn toàn, checkin 13:50/checkout 16:10): ca sáng `end(11:00) > checkin(13:50)` is false → correctly excluded; ca chiều passes → only `ca-chieu` credited, matches test.
- Case 11 (checkin === shift.end boundary, 11:00/12:00 vs MORNING ending 11:00): `end(11:00) > checkin(11:00)` is false (strict) → not credited, matches test and matches ADR's explicit strict-boundary requirement.

**(b) Late/early scoped to credited-only window — correct.** Traced case 6 by hand: `credited = [AFTERNOON]` only; `earliestStart = 14:00`, `latestEnd = 16:00` (computed via `Math.min`/`Math.max` over `credited`, not `input.shifts`) → `late = max(0, 13:50-14:00) = max(0,-10) = 0`; `early = max(0, 16:00-16:10) = max(0,-10) = 0`. The excluded morning shift (09:00-11:00) genuinely does not enter the `Math.min`/`Math.max` computation — confirmed by reading the code (`credited.map(s=>s.start)`, not `input.shifts.map(...)`).

**(c) Rounding — no bug found.** `Math.round(diff/60_000)` then `Math.max(0, ...)`. Checked the `-0` concern explicitly: `Math.max(0, -0)` returns `+0` per ECMA-262 spec (not `-0`), so no negative-zero leak into `lateMinutes`/`earlyMinutes`. Round-half-up behavior (`Math.round(-0.5) = -0`, `Math.round(1.5) = 2`) is consistent between late and early and gets clamped by `max(0, ...)` for all values that would go negative — no asymmetry.

**(d) No dangling references to deleted symbols outside the two known deferred call sites** — verified by repo-wide grep (see Verification section above).

**(e) No sort-order assumption bug.** The implementation uses `input.shifts.filter(...)` plus `Math.min`/`Math.max` over the filtered results — it never indexes into `shifts` by position, so it is correctly order-independent (unlike the old `assignPunchesToShifts`, which per the plan required caller-sorted input). This is a genuine improvement, not just incidentally correct. Minor gap: no test explicitly passes `shifts` in reversed order to document/pin this invariant (all test fixtures happen to list `MORNING` before `AFTERNOON`) — low-priority test-coverage suggestion, not a defect, since correctness doesn't depend on it.

**(f) Test arithmetic re-verified independently** for cases 1, 2, 3, 4, 5, 6, 8, 9, 10, 11 (see above and Verification section) — all match. No case found that passes for the wrong reason.

## Critical Issues
None.

## High Priority
None.

## Medium Priority
None blocking. `docs/codebase-summary.md:252` still describes attendance late/early as computed "via `assignPunchesToShifts`" — stale relative to this phase's design. Not flagged as a phase-2 defect since the plan is mid-flight (8 phases) and doc sync is reasonably deferred to a later/final phase, but worth closing out before the plan is marked done.

## Low Priority
- Consider adding one test with `shifts` passed in reverse/non-chronological order to explicitly pin the "caller need not pre-sort shifts" invariant (code already handles it correctly; this is documentation-via-test, not a bug fix).
- Duplicate-timestamp edge case (e.g., two punches at the identical instant, making `checkInAt === checkOutAt`) is not covered by a test. Traced the formula and it degrades gracefully (only shifts strictly straddling that single instant would credit) — not a defect, just an uncovered corner not called out in the phase's TDD plan either.

## Edge Cases Found by Scout
Covered under findings (c) and (e)/(f) above — no additional issues surfaced beyond what's already documented.

## Positive Observations
- Order-independence of `shifts` (via `filter`/`min`/`max` rather than index access) is a real correctness improvement over the old per-shift pairing function's implicit sorted-input requirement, and is worth noting as intentional in case future phases assume otherwise.
- JSDoc on `DayAttendanceResult` fields accurately describes the implemented semantics (checked each field's doc comment against actual return values in all 13 test cases) — no doc/behavior drift within this file.

## Recommended Actions
1. None blocking phase 2 sign-off.
2. (Optional, low priority) Add reverse-order `shifts` test case for documentation value.
3. (Deferred, not phase 2) Update `docs/codebase-summary.md:252` when the plan reaches a docs-sync phase.

## Metrics
- New tests: 13/13 pass (36/36 package-wide, independently re-run).
- `@cmc/domain-payroll` typecheck: clean.
- `@cmc/api` typecheck: exactly 2 expected errors (deferred to phase 5/6), independently re-run and confirmed no others.

## Unresolved Questions
None.
