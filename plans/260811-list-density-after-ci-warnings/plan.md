# Plan: CI warning fix + list density queue

**Status:** in progress  
**Mode:** ak:cook --auto --tdd --parallel  

## Brainstorm contract
- **Outcome:** Unblock PR #110 typecheck (e2e seed orderGlobal); wrap lagging Work Schedule list shell in Console ListPage density; keep resource-centric HITL.
- **Constraints:** No domain mutation changes; no TEKY kanban; no bulk approve re-intro on shifts list.
- **Non-goals:** Full shifts compose redesign; babysit until all CI green if infra flaky; monthly timesheet.
- **Accept:** e2e typecheck local green for fixed seed; shifts page uses ListPage density=ops + tab rename Hàng chờ; unit tests pass.

## Phases
1. Fix `seedPublishedExercise` orderGlobal (CI blocker)
2. List density: shifts page shell → ListPage ops + resource tab labels
3. Verify + push + note CI re-run

## Parallel
- Explore agents: CI scout + list advise (done)
- Main: implement both phases
