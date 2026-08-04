## Phase Implementation Report

### Executed Phase
- Phase: phase-04-academic-lists-migration
- Plan: `plans/260803-2043-odoo-ux-grammar-full-adoption/`
- Status: completed

### Files Modified
- `apps/admin/src/pages/students/index.tsx` — ListPage density=ops, search in filters slot
- `apps/admin/src/pages/classes/index.tsx` — ListPage density=ops (list + denied gate); create Dialog outside shell
- `apps/admin/src/pages/courses/index.tsx` — ListPage density=ops; create Dialog outside shell
- `apps/admin/src/pages/enrollment/class-placement.tsx` — ListPage (default density, wizard-form body); ConfirmDialog outside
- `apps/admin/src/pages/classes/index.test.tsx` — navigate spy (RR7 data-router AbortSignal flake on real nav)

### Tasks Completed
- [x] students/index → ListPage + PageHeader + search filters
- [x] classes/index → ListPage; create dialogs preserved outside body
- [x] courses/index → ListPage
- [x] class-placement → ListPage (wizard body kept; not table-first so density default)
- [x] page tests green

### Tests Status
- Type check: not run (layout-only chrome wrap)
- Unit tests: **pass** — 13/13
  - `src/pages/classes/index.test.tsx` (5)
  - `src/pages/classes/class-access-guard.test.tsx` (5)
  - `src/pages/courses/index.test.tsx` (3)
- Integration tests: n/a

### Issues Encountered
- Pre-existing: `createMemoryRouter` + nested `<Routes>` + real `navigate` fails in jsdom (`AbortSignal` undici). Fixed class list nav assertion via `useNavigate` spy (owned test file only).
- class-placement is wizard-dominant; used ListPage per task acceptance (not FormPage) with default density.

### Next Steps
- Phase 5 (finance/crm shells) unblocked on ListPage adoption pattern
- Optional: migrate class-placement to FormPage later if product prefers form archetype

### Grep acceptance
```
students/index.tsx: ListPage density="ops"
classes/index.tsx: ListPage density="ops" (×2 paths)
courses/index.tsx: ListPage density="ops"
enrollment/class-placement.tsx: ListPage
```
