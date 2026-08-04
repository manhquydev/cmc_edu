# Advise — Cycle 4a Soft Ops depth honesty (MS-1/2/4)

**Date:** 2026-08-04  
**Verdict:** Ship **docs tiers + depth report metrics** now. Do **not** force EntityHeader on all DetailPages. Defer axe CI and domain bulk.

---

## Reframed problem

Agents and red-team cannot tell **compliant settings detail** from **under-built entity detail**. Fix is **taxonomy + measurement**, not universal chrome.

## Exact requirements

1. Document tiers: **full · standard · settings · thin**  
2. Classify all product DetailPages  
3. `check-ui-frames` reports FilterBar, ListPagination, EntityHeader, detail tier buckets  
4. Strict mode unchanged  
5. Lab/red-team honesty updated  

## Goals

- MS-1 → **partial→documented** (settings exempt; thin residual named)  
- MS-2 → **partial→fixed report** (depth visible; strict later optional)  
- MS-4 → **fixed** (tiers named)  
- dual-title 0 · bulk ≥5 preserved  

## Non-goals

Re-skin · axe CI · domain bulk · EntityHeader on settings · payroll redesign · LMS  

## What to do

1. PAGE-FRAMES §C + VIEW-GRAMMAR §4: tiers table  
2. Classify 9 pages  
3. Extend `scripts/check-ui-frames.mjs` + `.test.mjs`  
4. `packages/ui/llms.txt` one-liner  
5. design-lab inventory + design-lab-redteam H6  
6. Run script + tests  

## What not to do

- Strict fail on thin DetailPage  
- Fake “EntityHeader 100%” metric  
- New components  
- Scope MS-3 a11y in same cook  

## Work checklist (cook)

- [x] Docs tiers + classification — `design-system/cmc-edu/PAGE-FRAMES.md` §C + `VIEW-GRAMMAR.md` §4  
- [x] Script depth report — `scripts/check-ui-frames.mjs` reports FilterBar / ListPagination / detailTiers  
- [x] Script unit test — `node --test scripts/check-ui-frames.test.mjs` → **3/3 pass** (2026-08-04)  
- [x] llms.txt pointer — `packages/ui/llms.txt` detail-tier one-liner  
- [x] Lab inventory + red-team H6 — Detail partial + tier note; H6 **fixed**; C2 depth report present  
- [x] Validate: `node --test scripts/check-ui-frames.test.mjs` · `node scripts/check-ui-frames.mjs --strict` → exit 0; dualTitle=0; bulkListsOk; detailTiers **2/2/3/2**  

**Evidence re-run (governance finalize, 2026-08-04):**

```bash
node --test scripts/check-ui-frames.test.mjs
# → 3 pass

node scripts/check-ui-frames.mjs --strict
# → dualTitleReview=[] · bulkListsOk=true · FilterBar=6 · ListPagination=11
# → detailTiers: full2 standard2 settings3 thin2
```

## Success metrics

| Metric | Target |
|--------|--------|
| dualTitleReview | 0 |
| bulkListsOk | true |
| JSON has filterBarCount, listPaginationCount, detailTiers | present |
| full files | includes receipt + opportunity |
| settings files | 3 SettingsShell pages |
| thin files | payroll + my-hr listed (not hidden) |
| Docs tiers | PAGE-FRAMES has table |

## Cook order

Docs → script → test → lab/redteam → validate  
