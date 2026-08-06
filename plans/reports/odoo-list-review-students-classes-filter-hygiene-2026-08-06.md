# Odoo list review — Students/Classes + filter hygiene cook

**Date:** 2026-08-06  
**Tools:** GitNexus query/impact + unit tests  
**Scope:** Students/Classes list grammar scorecard; gifts (D2) + pipeline (D3) FilterBar semantics

## Students (`apps/admin/src/pages/students/index.tsx`)

| Check | Result |
|-------|--------|
| Frame | ListPage density=ops |
| FilterBar host | `filters=` → ControlBar (**PASS**) |
| Semantics | text search; reset page + selection on change |
| Tests | `index.test.tsx` locks lookup ≥2 chars |

**Verdict:** G1 compliant for list chrome. No cook required.

## Classes (`apps/admin/src/pages/classes/index.tsx`)

| Check | Result |
|-------|--------|
| Frame | ListPage (gate + content) |
| FilterBar | **None** — `classBatch.list` bare paginated fetch |
| Empty/permission | EmptyState when no `class.create` |

**Verdict:** Unfilterable list — empty FilterBar intentional (G1 OK). Optional later: name/status filters when API supports.

## Filter hygiene cook

| Debt | Fix |
|------|-----|
| D2 gifts | Removed `value:'all'`; default `''`; `includeInactive = active !== 'active'` |
| D3 pipeline | `hasClear: false` on lost select (default domain exclude) |
| Package | `FilterDef.hasClear?: boolean` (default true) |

## GitNexus

- `impact(FilterBar upstream)`: LOW (barrel under-count; tests + package only)
- Students/Classes: route symbols via admin.routes; no HIGH risk processes for this chrome-only cook

## Validation

```bash
pnpm --filter @cmc/ui exec vitest run src/components/filter-bar.test.tsx
pnpm --filter @cmc/admin exec vitest run src/pages/engagement/gifts.test.tsx src/pages/crm/pipeline.test.tsx src/pages/students/index.test.tsx src/pages/parents/index.test.tsx
```
