# Phase 01 — Doc-truth Reconciliation

## Context
- Plan: [plan.md](plan.md)
- Reports: `reports/researcher-01-business-rule-audit-criteria-report.md`, `reports/researcher-02-test-evidence-audit-report.md`
- Cheap, high-confidence, no code risk. Do this first (parallel-safe with 02/03).

## Overview
Several project docs assert P2–P4 is unbuilt and that tests do not exist. Both are false. Correct every stale claim against a verified source (real test file, real schema, real test-run count). Docs-only phase.

## Key Insights (verified this session)
- `docs/system-architecture.md` P2–P4 bullet says "designed, not built" — FALSE. P2–P4 built + tested.
- `docs/codebase-summary.md` says "473 passing tests · 54 test files (2026-07-08)" (line ~284, echoed line 5). Actual: **64 test files in `apps/api/src` alone**. Router-documentation section documents only P1 routers; omits P2–P4 routers (session-evidence, assessment, submission, attendance, exercise, checkin, shift, payroll, kpi, rewards, meeting, appointment, after-sale, course, room).
- `docs/25-ma-tran-truy-vet-p1.md` (TL25) claims test specs "chưa tồn tại, là mục tiêu" — FALSE. 26/27 domains have substantive tests.
- `docs/project-roadmap.md` M2 (line 58) "đóng ô trống TL25 cụm P4" contradicts TL25's own "P4 khép kín hoàn toàn" and the built+tested evidence.

## Requirements
- Correct claims only where a verified source contradicts the doc. No speculative rewrites.
- Get the REAL test count from a live run, not a guessed number.
- **Q4 RESOLVED (2026-07-11 validation interview, timeline-verified via git log):** not a contradiction —
  a timeline gap. P4 code landed `44f26b9` (2026-07-07). `project-roadmap.md` was authored the next day
  `a018747` (2026-07-08) and correctly flagged that P4-adjacent test coverage (appointment, reconciliation,
  course, room, parentAccount) did not exist yet at that time. That exact gap was closed by `326dfcc`
  (2026-07-10, "test(api): backfill coverage for appointment, reconciliation, course, room, parentAccount").
  TL25's design-closure claim was correct throughout (it measures role/ADR/procedure mapping, not test
  existence). **Action: update `project-roadmap.md` M2 row — replace "đóng ô trống TL25 cụm P4" with a note
  that this specific gap closed 2026-07-10 (cite `326dfcc`); keep M2's other sub-items (WF-P4-04 lịch test
  acceptance, WF-P4-05 after-sale case, họp PH audit đầy-cuối) as still-open if not otherwise verified in
  this plan — do not silently mark all of M2 done, only the TL25-test-gap sub-item.**

## Architecture / Data flow
Verified source → doc edit. Source = `pnpm --filter @cmc/api exec vitest run` summary (test + file counts), `packages/db/prisma/schema.prisma` (schema truth), the real test files under `apps/api/src/**`.

## Related files (own exclusively in this phase)
- `docs/system-architecture.md`
- `docs/codebase-summary.md`
- `docs/25-ma-tran-truy-vet-p1.md`
- `docs/project-roadmap.md`
- Do NOT touch `docs/19-*`, `docs/20-*`, `docs/28-*` (owned by Phase 03).

## Implementation Steps
1. Run `pnpm --filter @cmc/api exec vitest run 2>&1 | tail -5` to capture the authoritative pass/skip + file counts. Record the exact numbers.
2. `system-architecture.md`: change the P2–P4 "designed, not built" bullet to reflect built + test-covered; keep phrasing consistent with the doc's existing style.
3. `codebase-summary.md`: update the test count (line 5 + line ~284) to the verified numbers; extend the router-documentation section and Test Coverage table to include P2–P4 routers with their real test files.
4. `25-ma-tran-truy-vet-p1.md`: replace "test specs chưa tồn tại" with VERIFIED-EXISTS, citing the real file per workflow (e.g. P2-08 → `apps/api/src/session-evidence/publish.test.ts` + `photo-access.test.ts`). For P4-02, point at `apps/api/src/rewards/redeem-refund.test.ts` (current reality; revisit if Phase 04 splits it).
5. `project-roadmap.md`: reconcile M2 wording with TL25. If PO source-of-truth unknown, add a one-line note that P4 is evidenced built+tested and flag Q4; do not delete the milestone.
6. Re-read each edited doc; verify dates, counts, and file references match reality.

## Todo list
- [x] Capture authoritative vitest count (532 passing, 0 skipped, 64 files — corrected post-review; initial capture of 531 was mid-parallel-run, fixed after code-review)
- [x] Fix system-architecture P2–P4 bullet
- [x] Fix codebase-summary counts + add P2–P4 routers/coverage
- [x] Fix TL25 "tests don't exist" claim with real file refs
- [x] Reconcile/flag roadmap M2 vs TL25 (Q4 resolved via git-log timeline verification)
- [x] Verify all edits against source

## Success Criteria
- No remaining "P2-P4 not built" or "tests chưa tồn tại" claim in the four docs.
- Test count in `codebase-summary.md` equals the live vitest run.
- Every workflow row referenced in TL25 points at a real, existing test file path.
- Roadmap contradiction either resolved with PO input or explicitly flagged.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Test count drifts again after future edits | Med | Low | Cite the count with the run date; note it is a snapshot |
| Silently overwriting a deliberate roadmap decision | Low | Med | Flag Q4 instead of picking a winner unilaterally |
| Editing TL25 rows for workflows not re-verified | Med | Med | Only cite files re-confirmed to exist via glob this phase |

## Security Considerations
Docs only; no runtime, secret, or access-control surface touched.

## Rollback
Pure doc edits under git; `git checkout -- docs/<file>` reverts any single file with zero cascade.

## Next steps
Feeds Phase 03 (which owns TL19/TL20/TL28 business-rule invariants) and Phase 04 (may re-touch the TL25 P4-02 line if the test file is split).
