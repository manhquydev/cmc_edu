# Code Review — Phase 6: KPI Integration (ADR 0043)

Scope: `apps/api/src/kpi/auto-score.ts`, `apps/api/src/kpi/router.ts`,
`apps/api/src/kpi/auto-score.test.ts`. Verified independently against
`apps/api/src/attendance/resolve-day-credit.ts`, `packages/domain-payroll/src/day-attendance.ts`,
`apps/api/src/attendance/resolve-target-role.ts`, `apps/api/src/payroll/router.ts`.

## Verdict

Backend logic (`apps/api`) is correct and matches the plan's requirements. **One
concrete, verified defect found**: `apps/e2e/tests/kpi-lifecycle.spec.ts` still
references the removed `shortSpanShifts` field and **fails `tsc` at the repo's
own root `pnpm typecheck` (turbo run typecheck)** — this falsifies the phase's own
success criterion ("`shortSpanShifts` bị bỏ hoàn toàn ... callers", phase-06 plan
line 64) and the broader "entire backend typecheck-clean" claim, since e2e is
part of the workspace `typecheck` graph even though it's excluded from the root
`test` script. Not a runtime/production defect (test-only), but it is a real,
reproducible build-gate failure that must be fixed before this can be called done.

## Verified Findings

### (a) `resolveKpiTargetRole` re-export — CORRECT
`export const resolveKpiTargetRole = resolveTargetRole;` in `auto-score.ts:48`.
`resolveTargetRole` (`attendance/resolve-target-role.ts`) is a pure function with
zero imports (no circular-import/TDZ risk) and no closures/`this` usage — a plain
reference alias is semantically identical to a function declaration for every
caller. Confirmed all 4 call sites in `kpi/router.ts` (lines 160, 297, 387, 446)
are unchanged call expressions; spot-checked the two consequential branch-scope
gates (`kpi.override` line 297, `kpi.bulkApprove` line 387) — both just call
`resolveKpiTargetRole(roles)` as a pure classifier, identical before/after.
`pnpm typecheck` in `apps/api` is clean (verified by running it directly — zero
output/errors).

### (b) Ticket-status handling in `collectActualShifts` — CORRECT
`collectActualShifts` fetches ALL tickets regardless of status into `ticketByDate`
and passes them through unmodified to `resolveDayCredit`. Verified
`resolveDayCredit` (resolve-day-credit.ts:51) gates on `ticket?.status === 'approved'
&& ticket.checkInAt && ticket.checkOutAt` before using frozen hours; any other
status (pending/rejected/resubmitted) falls through to `NOT_VALID` unless all
punches are within-network. This exactly mirrors `payroll/router.ts:393-403`'s
identical "fetch any status, let resolveDayCredit gate" pattern — parity with
payroll (red-team R2) confirmed at the source level, not just by claim.

### (c) `shiftActual` accumulation cannot exceed per-date entry count — CORRECT
`resolveDayCredit` → `computeDayAttendance` (`day-attendance.ts:65-67`) derives
`creditedShiftIds` via `input.shifts.filter(...)`, i.e. strictly a subset of the
`shifts` array passed in for that one call. `collectActualShifts`'s loop calls
`resolveDayCredit` once per `dateKey` with `windows` built only from that date's
`byTemplate` map (auto-score.ts:251-262) — so ids can never leak across dates or
exceed that date's own distinct-template count.

### (d) R3-8 DISTINCT dedup — UNCHANGED AND CORRECT
`entriesByDate: Map<dateKey, Map<shiftTemplateId, window>>` with
`if (!byTemplate.has(entry.shiftTemplateId))` guard (auto-score.ts:203-224) is
structurally identical dedup-by-Map logic; not touched by this phase's edits
beyond the credit-computation call at the bottom of the loop.

### (e) `shortSpanShifts` removal — INCOMPLETE (see Critical Issues)
Grepped the full repo. Zero remaining references in `apps/api/src` or
`apps/admin` (confirmed `apps/admin` has no matches at all, including in
`pages/hr/my-hr.tsx`/`my-hr.test.tsx`). Stale references found in:
- `apps/api/dist/**/*.d.ts` — gitignored build artifacts, non-issue.
- `apps/e2e/tests/kpi-lifecycle.spec.ts:155` — **live compile-breaking reference**
  (see Critical Issues).
- `apps/e2e/src/db.ts:348-349` — comment only referencing the old
  `assignPunchesToShifts`/`shortSpan` naming, does not compile-break, cosmetic.
- Various `plans/**/*.md`, `docs/**/*.md` — historical/planning docs, note-only
  per review scope.

### (f) "back-to-back" test rewrite — GENUINE, re-derived independently
ca1=08:00–12:00, ca2=13:00–17:00. Punches 07:55,12:00,13:00,17:05 →
`checkInAt`=07:55 (earliest), `checkOutAt`=17:05 (latest) per
`computeDayAttendance`'s sort-and-take-ends logic (day-attendance.ts:53-56).
Overlap `start < checkOut && end > checkIn`: ca1 → 08:00<17:05 && 12:00>07:55 →
credited; ca2 → 13:00<17:05 && 17:00>07:55 → credited. `shiftActual=2` is
correct and genuinely exercises day-level (whole-day first/last punch) pairing,
not a coincidental match with the old per-shift model — the middle two punches
(12:00, 13:00) play no role in the new logic, which the test's own comment
correctly states.

### (g) New E3 test — CORRECT
checkin=13:50, checkout=16:10, ca1=08:00–12:00, ca2=13:00–17:00. ca1:
08:00<16:10 (true) && 12:00>13:50 (**false**) → excluded. ca2: 13:00<16:10
(true) && 17:00>13:50 (true) → included. `shiftActual=1` matches the hand
derivation exactly.

### (h) Stale local-definition assumptions — NONE FOUND
No code (only stale comments in e2e, see (e)) assumes `resolveKpiTargetRole` is a
literal function declaration (no `.name` access, no hoisting-dependent usage
found via repo-wide grep). `assignPunchesToShifts` grep hits are all comments or
docs; `packages/domain-payroll/src/shift-attendance.ts` does not exist — confirms
it really was removed in phase 2 as claimed (note: the GitNexus index is stale
here — it still reports `assignPunchesToShifts` as a live symbol called by
`collectActualShifts`/`router.ts`; re-run `npx gitnexus analyze` before trusting
that index for this area going forward).

## Critical Issues

**None in `apps/api` (production code).**

## High Priority

1. **`apps/e2e/tests/kpi-lifecycle.spec.ts:155` fails `tsc`.**
   `expect(refreshed.shortSpanShifts).toBe(false);` — the mutation response type
   no longer has this field. Verified by running `pnpm typecheck` inside
   `apps/e2e` directly:
   ```
   tests/kpi-lifecycle.spec.ts(155,22): error TS2339: Property 'shortSpanShifts'
   does not exist on type '{ ... tierMissing: boolean; }'.
   ```
   The root `package.json`'s `typecheck` script is `turbo run typecheck` (runs
   every package including `@cmc/e2e`), while `test` is
   `turbo run test --filter=!@cmc/e2e` — so this breakage is invisible to
   `pnpm test` at the root but WILL fail `pnpm typecheck` at the root, and fails
   `apps/e2e`'s own `pnpm typecheck`. This is a genuine, reproducible build-gate
   failure, not a hypothetical. Phase-06's own success criteria explicitly
   requires `shortSpanShifts` "bị bỏ hoàn toàn ... callers" (plan line 64) — the
   e2e spec is a caller of `kpi.refresh.mutate` that was missed.
   Fix: delete line 155 (and the now-stale comment lines 106-108 mentioning
   `assignPunchesToShifts`, and `apps/e2e/src/db.ts:348-349`'s stale comment) —
   trivial, but must happen before this phase (or before merge to main) can be
   called typecheck-clean repo-wide. This is technically phase-7/e2e-file
   territory per your scoping, but flagging per explicit review focus (e) and
   because it contradicts the "entire backend believed typecheck-clean" closing
   claim.

## Medium / Low Priority

None found beyond the above — the core logic changes (collectActualShifts
rewrite, resolveKpiTargetRole re-export, type removals) are clean, minimal-diff,
and match the plan.

## Test Execution Note

Attempted to independently run `pnpm test -- src/kpi/` (apps/api) to reproduce
the claimed 207/207 pass count; the process hung with no output for several
minutes in this sandbox (likely a test-DB connectivity issue unrelated to this
phase's code — the environment's docker stack shows only `cmcv2-prod-*`
containers, no visible test-DB instance). Did not block this review since (1)
`pnpm typecheck` for `apps/api` ran cleanly and quickly, and (2) the two new/
rewritten test assertions were independently re-derived by hand against the
actual `computeDayAttendance`/`resolveDayCredit` source (see (f)/(g) above) —
high confidence the described test behavior is correct even without a live run.
Recommend the plan owner re-run `pnpm --filter @cmc/api test -- src/kpi/` in
their own working environment before marking phase 6 complete, per the
plan's own success-criteria checklist.

## Plan Success-Criteria Status (phase-06-kpi-integration.md)

- [x] shiftActual theo ngày hợp lệ + present; offsite pending/rejected = 0 — verified.
- [ ] `shortSpanShifts` bị bỏ hoàn toàn (type, snapshot, callers, UI) — **NOT met**:
      `apps/e2e/tests/kpi-lifecycle.spec.ts:155` still references it and fails
      to compile.
- [x] DISTINCT collapse giữ; KPI value nhân %ca giữ — verified.
- [x] 8+ test cases green in source (independently re-derived math for the new/
      rewritten ones); live run unconfirmed in this sandbox (see Test Execution
      Note).

## Unresolved Questions

1. Was `apps/e2e` typecheck run as part of this phase's "backend clean" claim,
   or only `apps/api`? (The summary says `pnpm --filter @cmc/api typecheck` —
   confirms it was scoped to `apps/api` only, which explains the miss.)
2. Should the e2e fix land in this phase (trivial, 1-line deletion + 2 stale
   comments) or be deferred to phase 7 as originally scoped? Given it's a
   pre-existing test asserting on a field this phase removed, and the fix is
   mechanical, recommend fixing now rather than carrying a known-broken e2e spec
   forward — but this is a scope call for the plan owner, not mine to make
   unilaterally.
