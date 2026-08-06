# Design3 Frontend System Audit — Full Walk

**Date:** 2026-08-06T03:07:28.213Z
**Environment:** Docker cmcv2-prod · https://localhost/admin · viewport 1280×900
**Authority:** `docs/design-system-odoo.md` (admin Odoo language) · rollout `plans/260805-1920-design3-admin-rollout/`
**Method:** static census of `apps/admin/src/pages` + live Playwright walk of 34 routes on Docker `cmcv2-prod` (super_admin), with `elementsFromPoint` menu-cover probe and screenshots.

## Verdict (một câu)

**Shell design3 đã phủ 100% route đã đi (34/34), nhưng chưa “đồng bộ chắc” ở lớp stacking float:** app-switcher bị thành phần trang (đặc biệt `.o-page-header`) che trên **7/34** trang — đúng triệu chứng user báo tại `/teaching/session-assessment`. Template/o-* language đã cover phần lớn màn nghiệp vụ; residual `ck-*` pagination/panel còn hiện trong DOM (mirror CSS Phase 6, chưa rename). Gate merge `ui-e2e` + acceptance re-measure vẫn mở theo design-system doc.

## Executive metrics (live)

| Metric | Value |
|--------|-------|
| Shell design3 (`o_web_client` + `o-navbar` + `o-main`) | **34/34 (100%)** |
| Pages with `.o-page-header` | 32/34 |
| **Menu covered by page content** (`elementsFromPoint`) | **7/34** |
| Menu geometrically overlaps header/control-bar | 32/34 |
| Residual `ck-*`/`tpl-*`/`sh-*` under `main` | 14/34 |
| Empty / placeholder signals | 2/34 |
| Navigation errors | 0/34 |

## P0 — Menu bị trang che (stacking)

### Root cause (đã chứng minh runtime)

```
.o-navbar { position: relative; z-index: auto }   /* before fix */
.o-app-switcher-menu { position: absolute; z-index: 10 }
main.o-main { /* next flex sibling — paints after navbar */ }
.o-page-header { z-index: 10; position: static under shell }
```

Vì navbar **không** tạo stacking layer cao hơn `main`, vùng dropdown (top≈46px) chồng hình học lên card header (top≈62px). `elementsFromPoint` trả về `.o-page-header` thay vì menuitem → menu “bị cắt/che”.

### Evidence — `/teaching/session-assessment`

- Shell OK: `True`
- `.o-page-header` visible, computed `position=static` `z-index=10`
- Navbar z-index=`auto` · Menu z-index=`10`
- Menu covered by page: **True**
- Geometric overlap area with header: ~19488 px²
- Screenshot (menu open, header cắt body menu):
  `outputs/design3-frontend-audit/screenshots/teaching__session-assessment__menu-open.png`

### All routes where menu samples hit page content

- `/teaching/session-evidence`
- `/teaching/session-assessment`
- `/hr/my`
- `/hr/salary-tiers`
- `/admin/shift-config`
- `/admin/network-ip`
- `/finance/new`

Pattern: hầu hết là **FormPage / DetailPage** có page-header card ngay dưới navbar (padding `o-wrap` ~16px) — header rộng full-width nên cắt mép trên của app-switcher list.

### Fix applied in source (chờ rebuild Docker admin để re-verify live)

- `.o-navbar z-index:1000` in `packages/ui/src/odoo.css`
- `.o_web_client .o-page-header z-index:auto + position:static`
- Contract test: `packages/ui/src/odoo/odoo-shell-stacking.test.ts`
- **Không** sửa từng trang — đúng chỗ là shell layer.

## Design3 sync by layer

| Layer | Status | Notes |
|-------|--------|-------|
| Shell chrome (OdooNavbar, purple bar, app-switcher, brand CMC EDU) | **Synced (runtime 34/34)** | Lab `/design3` deleted after promote |
| Central templates emit `o-*` (List/Detail/Form/Dashboard + PageHeader) | **Mostly synced** | Static: central templates on ~all business pages |
| CRM list↔kanban + statusbar chevron | Present on CRM/finance detail | Residual `ck-page*` pagination classes |
| premium.css retired on admin | Claimed shipped | DOM still shows `ck-*` via selector mirror — expected residual debt |
| Float layers toast/⌘K | Unscoped in odoo.css | Separate contract tests |
| **Shell stacking / dropdown vs main** | **Broken before fix** | P0 this audit |
| LMS | Out of design3 scope | Still TL12 premium |
| ui-e2e + acceptance re-measure | Open merge gates | `docs/design-system-odoo.md` |

## Static source census (`apps/admin/src/pages`)

- Page files (excl. tests/panels/pdf-annotator): **51**
- Business pages (excl. login/coming-soon/change-password/go-resolver/dialogs): **40**
- Using at least one central template frame: **40/51** page files
- CRM dialogs (no page frame by design): **7**

### Business pages without List/Detail/Form/Dashboard/SettingsShell

_None — all business pages use a central template._

### Template usage inventory (business)

| Page | Templates |
|------|-----------|
| `admin/audit-log.tsx` | ListPage, EmptyState, PageHeader, DataTable |
| `admin/facilities.tsx` | ListPage, EmptyState, PageHeader, DataTable |
| `admin/network-ip.tsx` | DetailPage, SettingsShell, EmptyState, PageHeader, DataTable |
| `admin/shift-config.tsx` | DetailPage, SettingsShell, EmptyState, PageHeader |
| `admin/users.tsx` | ListPage, EmptyState, PageHeader, DataTable |
| `attendance/check-in-out.tsx` | FormPage, PageHeader, DataTable |
| `attendance/shifts.tsx` | FormPage, PageHeader, DataTable |
| `classes/class-detail.tsx` | DetailPage, EmptyState, PageHeader, EntityHeader, DataTable |
| `classes/index.tsx` | ListPage, EmptyState, PageHeader, DataTable |
| `cockpit.tsx` | DashboardPage |
| `courses/index.tsx` | ListPage, PageHeader, DataTable |
| `crm/aftersale.tsx` | ListPage, PageHeader, FilterBar, DataTable |
| `crm/opportunity-detail.tsx` | DetailPage, EmptyState, PageHeader, EntityHeader, WorkflowStatusbar |
| `crm/pipeline.tsx` | ListPage, PageHeader, KanbanBoard, DataTable |
| `crm/post-sale-meeting.tsx` | ListPage, PageHeader, FilterBar, DataTable |
| `engagement/gifts.tsx` | ListPage, PageHeader, DataTable |
| `engagement/leaderboard.tsx` | ListPage, EmptyState, PageHeader |
| `engagement/rewards.tsx` | ListPage, PageHeader, FilterBar, DataTable |
| `enrollment/class-placement.tsx` | ListPage, PageHeader |
| `finance/receipt-create.tsx` | FormPage, PageHeader |
| `finance/receipt-detail.tsx` | DetailPage, PageHeader, EntityHeader, WorkflowStatusbar |
| `finance/receipt-list.tsx` | ListPage, PageHeader, FilterBar, DataTable |
| `finance/reconciliation.tsx` | ListPage, PageHeader, FilterBar |
| `finance/refund.tsx` | ListPage, EmptyState, PageHeader |
| `finance/revenue-report.tsx` | DashboardPage |
| `hr/kpi.tsx` | ListPage, PageHeader, DataTable |
| `hr/my-hr.tsx` | DetailPage, EmptyState, PageHeader |
| `hr/payroll.tsx` | ListPage, DetailPage, PageHeader, DataTable |
| `hr/salary-tiers.tsx` | DetailPage, SettingsShell, PageHeader, DataTable |
| `parents/index.tsx` | ListPage, PageHeader, DataTable |
| `students/index.tsx` | ListPage, PageHeader, FilterBar, DataTable |
| `students/student-detail.tsx` | DetailPage, EmptyState, PageHeader, EntityHeader |
| `teaching/attendance.tsx` | ListPage, PageHeader |
| `teaching/exercises.tsx` | ListPage, PageHeader, DataTable |
| `teaching/grading.tsx` | ListPage, PageHeader, ControlBar |
| `teaching/report-cards.tsx` | FormPage, PageHeader, DataTable |
| `teaching/schedule.tsx` | ListPage, PageHeader, FilterBar, KanbanBoard, DataTable |
| `teaching/session-assessment.tsx` | FormPage, PageHeader |
| `teaching/session-detail.tsx` | DetailPage, PageHeader |
| `teaching/session-evidence.tsx` | FormPage, PageHeader |

## Live per-route matrix

| Path | Group | Shell | Header | Menu↑ | Covered | Residual# | Empty |
|------|-------|-------|--------|-------|---------|-----------|-------|
| `/cockpit` | cockpit | ✓ | — | ✓ | no | 19 |  |
| `/teaching/schedule` | teaching | ✓ | 1 | ✓ | no | 6 |  |
| `/teaching/attendance` | teaching | ✓ | 1 | ✓ | no | 0 |  |
| `/teaching/grading` | teaching | ✓ | 1 | ✓ | no | 0 |  |
| `/teaching/session-evidence` | teaching | ✓ | 1 | ✗ | **YES** | 0 |  |
| `/teaching/session-assessment` | teaching | ✓ | 1 | ✗ | **YES** | 0 |  |
| `/teaching/exercises` | teaching | ✓ | 1 | ✓ | no | 5 |  |
| `/admin/students` | classes-students | ✓ | 1 | ✓ | no | 0 |  |
| `/admin/classes` | classes-students | ✓ | 1 | ✓ | no | 7 |  |
| `/admin/courses` | classes-students | ✓ | 1 | ✓ | no | 5 |  |
| `/admin/parents` | classes-students | ✓ | 1 | ✓ | no | 0 |  |
| `/finance` | finance-ops | ✓ | 1 | ✓ | no | 7 |  |
| `/crm` | finance-ops | ✓ | 1 | ✓ | no | 13 |  |
| `/ops/revenue` | finance-ops | ✓ | — | ✓ | no | 4 |  |
| `/ops/recon` | finance-ops | ✓ | 1 | ✓ | no | 0 |  |
| `/crm/post-sale-meeting` | finance-ops | ✓ | 1 | ✓ | no | 5 |  |
| `/crm/aftersale` | finance-ops | ✓ | 1 | ✓ | no | 5 |  |
| `/finance/class-placement` | finance-ops | ✓ | 1 | ✓ | no | 0 |  |
| `/admin/engagement/gifts` | engagement | ✓ | 1 | ✓ | no | 5 |  |
| `/admin/engagement/rewards` | engagement | ✓ | 1 | ✓ | no | 5 |  |
| `/hr/checkin` | hr | ✓ | 1 | ✓ | no | 0 |  |
| `/hr/shifts` | hr | ✓ | 1 | ✓ | no | 0 |  |
| `/hr/my` | hr | ✓ | 1 | ✗ | **YES** | 0 |  |
| `/hr/kpi` | hr | ✓ | 1 | ✓ | no | 0 |  |
| `/hr/payroll` | hr | ✓ | 1 | ✓ | no | 0 |  |
| `/hr/salary-tiers` | hr | ✓ | 1 | ✗ | **YES** | 0 |  |
| `/admin/shift-config` | hr | ✓ | 1 | ✗ | **YES** | 0 |  |
| `/admin/users` | admin | ✓ | 1 | ✓ | no | 5 |  |
| `/admin/facilities` | admin | ✓ | 1 | ✓ | no | 5 |  |
| `/admin/network-ip` | admin | ✓ | 1 | ✗ | **YES** | 0 |  |
| `/admin/audit-log` | admin | ✓ | 1 | ✓ | no | 0 |  |
| `/finance/new` | finance-ops | ✓ | 1 | ✗ | **YES** | 0 |  |
| `/admin/engagement/leaderboard` | engagement | ✓ | 1 | ✓ | no | 0 | yes |
| `/finance/refund` | finance-ops | ✓ | 1 | ✓ | no | 0 | yes |

## Residual premium classes (rendered DOM under main)

Top classes by route frequency:

- `ck-page` × 10 routes
- `ck-page-btn` × 10 routes
- `ck-page-indicator` × 10 routes
- `ck-page-nav` × 10 routes
- `ck-page-range` × 10 routes
- `ck-pnl` × 3 routes
- `ck-pnl-head` × 3 routes
- `ck-pnl-title` × 3 routes
- `ck-badge-soft` × 2 routes
- `ck-badge-soft--success` × 2 routes
- `ck-pnl-icon` × 2 routes
- `ck-fn-footer` × 1 routes
- `ck-fn-footer-cta` × 1 routes
- `ck-fn-footer-text` × 1 routes
- `ck-fn-summary` × 1 routes
- `ck-fn-summary-label` × 1 routes
- `ck-fn-summary-pill` × 1 routes
- `ck-fn-summary-total` × 1 routes
- `ck-inbox-empty` × 1 routes
- `ck-pnl-action` × 1 routes

Interpretation: Phase 6 **selector mirror** under `.o_web_client` paints these; not a shell-language failure. Optional backlog = true class rename `ck-*` → `o-*`.

## Empty / placeholder routes (live)

- `/admin/engagement/leaderboard`
- `/finance/refund`

`/finance/refund` and `/admin/engagement/leaderboard` are known EmptyState; refund already de-navved in registry comments, leaderboard same.

## What “đồng bộ design3” means here

1. **Chrome language** — Odoo navbar + tokens + gray canvas: **YES** on all walked routes.
2. **Template language** — PageHeader/List/Form/Detail/Dashboard `o-*`: **YES** for nearly all business screens.
3. **Interaction correctness of chrome** — dropdown above content: **NO until shell z-index fix is deployed**.
4. **Class purity** (`ck-*` gone): **NO**, residual debt documented and accepted for Phase 6.
5. **CI product proof** (`ui-e2e` green + acceptance re-measure): **NOT claimed** by this audit.

## Recommended next steps

1. **Deploy fix:** rebuild `cmcv2-prod-admin` image with updated `@cmc/ui` odoo.css; re-run `outputs/design3-frontend-audit/run-audit.mjs` — expect `menuCoveredCount=0`.
2. **Add e2e regression:** open app-switcher on `/teaching/session-assessment`, assert menuitem hit-test / visibility not obscured by `.o-page-header`.
3. **Keep human visual smoke** list from design-system-odoo (toast, ⌘K, CRM kanban, cancelled receipt, teaching calendar).
4. **Do not** page-local z-index hacks on headers.

## Artifacts

| Artifact | Path |
|----------|------|
| This report | `plans/reports/design3-frontend-system-audit-260806.md` |
| JSON results | `outputs/design3-frontend-audit/results.json` |
| Audit runner | `outputs/design3-frontend-audit/run-audit.mjs` (+ `apps/e2e/design3-frontend-audit.mjs`) |
| Screenshots | `outputs/design3-frontend-audit/screenshots/` |
| Log | `outputs/design3-frontend-audit/audit-log.txt` |
| Shell stacking unit test | `packages/ui/src/odoo/odoo-shell-stacking.test.ts` |

---

*Audit performed carefully page-by-page with geometric + hit-test evidence; not a visual design pixel-diff against Odoo screenshots.*
