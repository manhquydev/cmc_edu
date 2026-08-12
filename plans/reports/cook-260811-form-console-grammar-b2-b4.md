# Cook — B2 form ca + B4 aftersale Console grammar

**Date:** 2026-08-11  
**Scope:** Visual densify only — domain mutations / permissions **unchanged**  
**PR #110:** not touched this session  

## Done

### B2 — Shift registration form
- Replaced one-off CSS statusbar with `WorkflowStatusbar`
- `EntityHeader` owns Duyệt / Từ chối / Hủy phiếu
- `HighlightStrip` + `KeyValueList` + `SectionBlock`
- Kept day×shift matrix (business-specific sheet)

### B4 — After-sale form
- Same grammar: statusbar · strip · sheet · primary actions on EntityHeader
- Lifecycle open → in_progress → resolved → closed **unchanged**

## Tests
- `shifts-detail` 3 · `kpi-detail` 3 · `check-in-out` 20 · `aftersale` list 12 → **38 pass**

## Not done
- Parents densify (B5)
- Timesheet month (image 3)
- PR #110 CI / merge
