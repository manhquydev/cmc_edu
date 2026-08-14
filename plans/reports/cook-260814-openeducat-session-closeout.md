# Cook plan — OpenEduCat session closeout (Approach 1)

**Mode:** interactive cook · reuse brainstorm `brainstorm-260814-openeducat-session-closeout.md`  
**Date:** 2026-08-14

## Contract

| Field | Value |
|-------|--------|
| Outcome | Soft-square + summary-in-sheet on a PR branch; dirty `develop` clean; residuals StatActions/CP footer documented not implemented |
| Constraints | Branch+PR (no commit on `main`); skip `.cursor/`; pack authority; no OWL/product SIS table |
| Non-goals | StatActions→CP (C1), CP footer BulkActionBar (C2), students table, deck/KD/Đợt B, go-live land-stack |
| Acceptance | Unit pins green; PR URL; plan.md note residual; working tree clean of session files |

## Scout

- On `develop@52602de` **dirty** (7 code + reports). Local `wip/openeducat-soft-square@471d162` already has soft-square commit tracking origin.
- Live proof: `plans/reports/live-ui-audit-260814-1130/`.
- Epic plan: `plans/260813-2038-openeducat-visual-clone/` ~79% — phase-03 StatActions still open.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Hygiene: move dirty → `wip/openeducat-soft-square` (not develop) | pending |
| 2 | A1 unit pins | pending |
| 3 | Commit session + reports (no `.cursor/`) | pending |
| 4 | Push + PR to `develop` | pending |
| 5 | Sync plan.md residual note; park deck/KD/UAT/land-stack | pending |
| 6 | Tester + code-reviewer gates | pending |

**Explicitly deferred (not this PR):** C1 StatActions CP phải, C2 CP footer/search.
