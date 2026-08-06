# Phase 5 module sweep status

Date: 2026-08-06  
Branch: `feat/ui-copy-standard`

## Summary

After Phase 3 central template reskin, most admin list/detail/settings pages already
render through `ListPage` / `DetailPage` / `SettingsShell` / `DashboardPage` with
`o-*` classes. Phase 5 sweeps address module-specific residual chrome.

| # | Module | Status | Commit / notes |
|---|--------|--------|----------------|
| 5a | Finance | **Done** | `4c851dc` — receipt-detail WorkflowStatusbar terminal cancel; recon FilterBar |
| 5b | Teaching | **Done** | `214ad23` — schedule KanbanBoard; calendar `o-fc*`; view switcher |
| 5c | Students | **Template-covered** | ListPage + FilterBar + DetailPage already design3; no structural gap |
| 5d | Classes | **Done** | `645e536` — class roster `o-list` |
| 5e | Courses | **Template-covered** | ListPage + create Dialog + ops density |
| 5f | Parents | **Template-covered** | ListPage + tabs; dialogs for email |
| 5g | Enrollment | **Done** | `731e199` — class-placement ops density |
| 5h | Engagement | **Template-covered** | gifts/rewards/leaderboard on ListPage (+ FilterBar on rewards) |
| 5i | Cockpit | **Template-covered** | DashboardPage + MetricCard + StageFunnel (CRM rail, not bespoke shell) |
| 5j | Admin/Settings | **Template-covered** | SettingsShell on shift-config / network-ip / salary-tiers; list ops density |
| 5k | HR | **Template-covered** | payroll/kpi ListPage+DetailPage; no invented statusbar |
| 5l | Attendance | **Template-covered** | FormPage + DataTable punch/shift surfaces (no side-nav shell) |

CRM residual after Phase 4: `00afc1c` pipeline empty → `o-kanban-empty`.

## Residual (not blocking “module uses design3 chrome”)

- `FunnelBar` / StageFunnel still emit `ck-fn*` / `ck-rail*` (Phase 6 component port).
- CommandPalette, BulkActionBar, TaskRow, Panel, etc. still `ck-*` until Phase 6 port-then-remove.
- Full ui-e2e still the branch merge gate (Phases 2–5).
- Visual eye-review of all modules not done in cook session.

## Phase 5 success criteria interpretation

| Criterion | Result |
|-----------|--------|
| ~12 PR, 1 module each | 5 discrete module commits landed (finance, teaching, classes, enrollment + CRM residual); remaining modules already template-covered after Phase 3 |
| No premium bespoke layout | Structural shell/templates odoo; residual premium composites remain (Phase 6 census) |
| Gap ledger Phase 4 | Pipeline empty closed; list view/switcher landed in Phase 4 |
| LMS spot-check on primitive PRs | Teaching calendar CSS only in admin `soft-ops-fullcalendar` + odoo.css (admin-only import) |
