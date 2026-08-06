# Debt list — after P0 fix (push baseline)

**Date:** 2026-08-06  
**Baseline commits:** wave docs + DateField/FilterBar cook + P0 follow-up  
**Review synthesis:** [synthesis.md](./synthesis.md)

## P0 — FIXED (this commit)

| ID | Fix |
|----|-----|
| P0-1 | Gifts: `setSelectedIds([])` on filter change |
| P0-2 | Audit: 300ms debounce on actor/action/entity; dates still immediate |
| P0-3 | Evergreen + snapshot docs: FilterBar **12/23**, DateField SHIPPED, pipeline FilterBar |
| P0-4 | DateField: `useId()` fallback; FilterBar passes `id={o-filter-${key}}` |

## Open debt (push as-is)

### P1 — product / grammar

| ID | Sev | Item | Notes |
|----|-----|------|-------|
| **D1** | MAJOR | Parents FilterBar still **inside tabs**, not `ListPage.filters` | VIEW-GRAMMAR / G1 ControlBar slot |
| **D2** | MAJOR | Gifts select: explicit **“Tất cả”** + `hasClear` duplicate semantics | Playbook anti-pattern; simplify options |
| **D3** | MAJOR | Pipeline lost-select clear → snaps to `exclude` (not all); search lost icon/`hasClear` | UX polish |
| **D4** | MAJOR | Audit date range: no **from ≤ to** client validation | Empty results possible |
| **D5** | MAJOR | `guardian.listPendingLinks` hardcodes `pageSize: 50`, shows total | Pre-existing; truncated queue |
| **D6** | MAJOR | Test gaps: gifts/parents/kpi filter paths; FilterBar **URL mode** untested | Coverage debt |

### P2 — package / residual

| ID | Sev | Item |
|----|-----|------|
| **D7** | MINOR | FilterBar dual-mode (value without onChange) footgun — pre-existing |
| **D8** | MINOR | DateField focus token relies on `--cmc-accent` fallback |
| **D9** | MINOR | Intermediate list query when page resets via `useEffect` (extra round-trip) |
| **D10** | MINOR | CSS.escape polyfill incomplete (test-only; OK) |
| **D11** | MINOR | SearchChrome / facets / GroupBy / Favorites still parked | Intentional non-goal |

### P3 — backlog research

| ID | Item |
|----|------|
| **D12** | Form field cook slices: datetime, monetary, boolean, async m2o, x2many lines |
| **D13** | Raise FilterBar beyond 12/23 only when list APIs gain filter params |

## Do not reopen without trigger

- Full Odoo SearchModel / DomainSelector / ir.filters server
- OWL field widget ports
- Empty FilterBar on unfilterable lists

## Acceptance for closing this debt wave

- [ ] D1 parents filters in ControlBar (or documented tab exception)
- [ ] D2–D4 UX polish shipped or waived
- [ ] D5 pagination decision for link requests
- [ ] D6 minimum tests for gifts + parents filter + FilterBar URL mode
