# Adoption audit — Odoo UX Grammar Full Adoption

**Date:** 2026-08-03  
**Method:** `grep -rL "ListPage|DetailPage|FormPage|DashboardPage" apps/admin/src/pages --include='*.tsx'`

## Product pages without frame import

| Path | Status |
|------|--------|
| `login.tsx` | EXEMPT (auth) |
| `change-password.tsx` | EXEMPT (auth) |
| `coming-soon.tsx` | EXEMPT (placeholder) |
| `crm/*dialog*.tsx` | EXEMPT (dialogs) |

`design-lab.tsx` and `pdf-annotator.tsx` mention frames in code/comments (lab / embed).

## Non-exempt product pages

All default-export product screens audited under `apps/admin/src/pages/**` import at least one of ListPage | DetailPage | FormPage | DashboardPage after phases 4–7.

## Phase 8 extras

- `receipt-list` uses `ListPagination` via `controlFooter` on ListPage (ControlBar footer).
- Design Lab listops demo shows ListPagination in controlFooter.

## Verdict

**Adoption target met** for plan EXEMPT definition.
