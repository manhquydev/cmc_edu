# Cook + validate — Cycle 4a (detail tiers + depth report)

**Date:** 2026-08-04  
**Pipeline:** brainstorm → research → advise → validate work → cook → remeasure  
**Advise:** `advise-ms-p1-detail-governance-2026-08-04.md`

## Work package (pre-cook validation)

| Claim | Evidence pre-cook | Pass? |
|-------|-------------------|-------|
| MS-1 EntityHeader gap real | Detail 9 · EH 4 · settings 3 · thin 2 | ✓ |
| MS-2 no depth matrix | script only bulk+dual-title | ✓ |
| MS-4 no named tiers | PAGE-FRAMES “Nên có” only | ✓ |
| Approach B locked | docs + report-only metrics | ✓ |

## Cook delivered

| Item | Surface |
|------|---------|
| Detail tiers full/standard/settings/thin | `design-system/cmc-edu/PAGE-FRAMES.md` §C |
| VIEW-GRAMMAR pointer | `VIEW-GRAMMAR.md` §4 |
| Agent brief | `packages/ui/llms.txt` |
| Depth report | `scripts/check-ui-frames.mjs` |
| Tests | `scripts/check-ui-frames.test.mjs` |
| Lab honesty | design-lab inventory Detail = partial + tier note |
| Red-team | H6 fixed · C2 fixed · score Detail 4 |

## Post-cook metrics (must re-run)

Run:

```bash
node --test scripts/check-ui-frames.test.mjs
node scripts/check-ui-frames.mjs --strict
```

Expected: tests pass; dual-title 0; bulkListsOk; detailTiers.full includes receipt+opp; settings ≥3; thin includes payroll/my-hr.

## Finding board

| ID | Status after cook |
|----|-------------------|
| MS-1 | partial→**documented** (settings exempt; thin residual named) |
| MS-2 | **report fixed** (not strict depth) |
| MS-4 | **fixed** |
| MS-3 a11y | deferred |
| MS-5 domain bulk | deferred |

## Non-goals respected

No re-skin · no forced EH on settings · no axe CI · no domain bulk fake.
