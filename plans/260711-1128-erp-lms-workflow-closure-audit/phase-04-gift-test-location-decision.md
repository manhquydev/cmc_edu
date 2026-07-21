# Phase 04 — P4-02 Gift Test-location Decision (OPTIONAL)

## Context
- Plan: [plan.md](plan.md)
- Report: `reports/researcher-02-test-evidence-audit-report.md` (Gap 1, lines 125–129)
- Optional. Depends on Phase 03 (minLevel decision may affect gift test content). Skippable if the plan owner accepts doc-correction only.

## Overview
P4-02 (gift config, director-only) test coverage exists but lives inside `rewards/redeem-refund.test.ts` (~lines 80–120: `gift.upsert` director-only gate, `gift.archive`, stock=-1 semantics), not a dedicated file. TL25/TL28 docs expected `gift/catalog.spec`. Decide: split for 1:1 file-per-workflow, or keep combined and rely on Phase 01's doc-reference correction.

## Key Insights (verified this session)
- `apps/api/src/rewards/gift-router.ts` (101 lines) is the implementation; `reward-router.ts` (282 lines) handles redeem/refund.
- `rewards/redeem-refund.test.ts` (281 lines) substantively covers BOTH P4-01 (redeem) and P4-02 (gift config). It is not a stub.
- No dedicated `gift.test.ts` exists anywhere in the tree.
- **Recommendation: doc-correction (no split).** Splitting a working 281-line test carries regression risk for zero behavior gain; Phase 01 already repoints the doc reference at the real file. Split ONLY if the plan owner mandates strict 1:1 file-per-workflow convention.

## Requirements
- **RESOLVED 2026-07-11 (validation interview, plan.md Q2): doc-correction only, no split.** This phase is now
  a NO-OP — the action is already covered by Phase 01 (repoint TL25/TL28 test-column reference to
  `rewards/redeem-refund.test.ts`). Do not create a separate `gift.test.ts`. Keep this file for the decision
  record; nothing to execute here beyond confirming Phase 01 did the repoint.

## Architecture / Data flow
No runtime change either way. Option A = doc pointer only. Option B = physically relocate the gift.* assertions from `redeem-refund.test.ts` into `rewards/gift.test.ts`, leaving redeem/refund cases behind.

## Related files
- Decision input (read-only): `apps/api/src/rewards/redeem-refund.test.ts`, `gift-router.ts`.
- If split (own exclusively): `apps/api/src/rewards/redeem-refund.test.ts` (remove gift cases), NEW `apps/api/src/rewards/gift.test.ts`, and the single TL25 reference line (coordinate with Phase 01 — do this AFTER 01 lands).

## Implementation Steps
1. Present Option A (doc-correction, recommended) vs Option B (split) to the plan owner with the trade-off.
2. If A: confirm Phase 01 already points the P4-02 reference at `rewards/redeem-refund.test.ts`. Done.
3. If B: cut the `gift.upsert`/`gift.archive`/stock-semantics blocks into a new `gift.test.ts` verbatim (same imports, same `test/db.ts` helpers); leave redeem/refund cases in place; run both files + full api suite; update the TL25 reference line to `gift.test.ts`.

## Todo list
- [x] Present A vs B to plan owner (Q2) — resolved 2026-07-11 validation interview: Option A (doc-correction)
- [x] If A: verify doc pointer, close — confirmed: Phase 01 repointed TL25 to `rewards/redeem-refund.test.ts`; TL28 repointed by Phase 03
- [x] If B: N/A — Option B not chosen
- [x] If B: N/A — Option B not chosen

## Success Criteria
- A single, documented decision recorded (not silently picked).
- If A: TL25/TL28 reference `rewards/redeem-refund.test.ts` and no orphan `catalog.spec` reference remains.
- If B: `rewards/gift.test.ts` exists, gift cases removed from `redeem-refund.test.ts`, full suite green, doc repointed.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Split introduces regression / dropped case | Med | Med | Verbatim move only; diff assertion counts before/after; run full suite |
| Doc line edited by both Phase 01 and 04 | Med | Low | 04 runs after 01; 04 owns the repoint if split happens |
| Split churn for no value | Med | Low | Default to Option A unless owner mandates 1:1 convention |

## Security Considerations
Director-only gate on `gift.upsert` is the security-relevant assertion — if split, verify it survives the move intact ("non-director sale gets FORBIDDEN").

## Rollback
Option A: doc revert. Option B: `git checkout` the two test files + doc line; no production code touched.

## Next steps
None mandatory. Closing this phase fully retires the P4-02 naming/location discrepancy.
