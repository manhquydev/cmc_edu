# Admin design3 Odoo grammar coverage audit

**Date:** 2026-08-06  
**Scope:** `apps/admin/src/pages/**/*.tsx` (product code only — no product changes)  
**Plan:** `plans/260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit/` phase 04  
**Cross-check:** `plans/260805-1920-design3-admin-rollout/plan.md` (~40/55 claim)

---

## Headline metrics

| Metric | Numerator / Denominator | % |
|--------|-------------------------|---|
| **Any standard frame** (`ListPage` \| `DetailPage` \| `FormPage` \| `DashboardPage` \| `SettingsShell`) | **40 / 55** | **72.7%** |
| Standard frame among **routed page files** (excludes dialogs, panels, embedded widgets) | **40 / 44** | **90.9%** |
| Primary frame = `ListPage` | **22 / 55** | **40.0%** |
| Primary frame = `DetailPage` (only) | **6 / 55** | **10.9%** |
| Primary frame = `FormPage` | **6 / 55** | **10.9%** |
| Primary frame = `DashboardPage` | **2 / 55** | **3.6%** |
| Primary frame = `SettingsShell` alone | **0 / 55** | **0%** |
| **Mixed** (two+ frames in one file) | **4 / 55** | **7.3%** |
| **Bespoke** (none of the five frames) | **15 / 55** | **27.3%** |
| List-shaped pages with **`FilterBar`** | **7 / 23** (audit snapshot) | **30.4%** → **12/23 post-cook (~52%)** |
| List-shaped pages with **`filters=` slot** (FilterBar *or* custom) | **8 / 23** | **34.8%** |
| **Shell** uses `OdooNavbar` + `.o_web_client` | **1 / 1** (`shell.tsx`) | **100%** |

**Single headline for “admin pages on design3 grammar frames”:**  
**72.7% (40/55)** of non-test page TSX files; **90.9% (40/44)** if the denominator is limited to routed page surfaces (honest product view).

---

## Methodology (commands + classification rules)

### Denominator A — all page TSX

```bash
# Inventory (exclude tests)
find apps/admin/src/pages -name '*.tsx' ! -name '*.test.tsx' | sort | wc -l
# → 55
```

No `__tests__` directories under `pages/`. Non-TSX helpers (`.ts` only) excluded:  
`cockpit-counter.test.ts`, `revenue-report-aggregate.test.ts`, `schedule-fc-events.ts`, CRM `use-*-actions.ts`.

### Frame detection (source text match)

```bash
# Per-frame render/import sites (non-test production files only — filtered manually from rg)
rg -n '\bListPage\b'     apps/admin/src/pages --glob '*.tsx' --glob '!**/*.test.tsx'
rg -n '\bDetailPage\b'   apps/admin/src/pages --glob '*.tsx' --glob '!**/*.test.tsx'
rg -n '\bFormPage\b'     apps/admin/src/pages --glob '*.tsx' --glob '!**/*.test.tsx'
rg -n '\bDashboardPage\b' apps/admin/src/pages --glob '*.tsx' --glob '!**/*.test.tsx'
rg -n '\bSettingsShell\b' apps/admin/src/pages --glob '*.tsx' --glob '!**/*.test.tsx'
rg -n '\bFilterBar\b'    apps/admin/src/pages --glob '*.tsx' --glob '!**/*.test.tsx'
rg -n '\bWorkflowStatusbar\b' apps/admin/src/pages --glob '*.tsx' --glob '!**/*.test.tsx'
rg -n '\bEntityHeader\b' apps/admin/src/pages --glob '*.tsx' --glob '!**/*.test.tsx'
rg -n 'o-form-sheet'     apps/admin/src/pages --glob '*.tsx' --glob '!**/*.test.tsx'
rg -n '\bControlBar\b'   apps/admin/src/pages --glob '*.tsx' --glob '!**/*.test.tsx'
rg -n 'OdooNavbar|o_web_client' apps/admin/src/shell/shell.tsx
```

### Primary-frame rules

1. Count a file as using a frame if it **imports and renders** that component (not mere comments).  
2. **Primary** = single frame family when only one is used.  
3. **Mixed** = two or more of {ListPage, DetailPage, FormPage, DashboardPage, SettingsShell} in the same file.  
4. **Bespoke** = none of the five.  
5. Comment-only mentions (e.g. `pdf-annotator.tsx` “does NOT adopt FormPage”) do **not** count as FormPage.  
6. `ControlBar` is **not** a page primary frame — it is composed **inside** `ListPage` (`packages/ui/src/components/list-page.tsx`). Direct page imports of `ControlBar` = **0**.  
7. `.o-form-sheet` is emitted by `DetailPage` implementation; page sources do not hardcode the class string (**0** page matches; **10** files get it via DetailPage).

### Alternate denominators (same census)

| Slice | Definition | N |
|-------|------------|---|
| A — all page TSX | `**/*.tsx` minus `*.test.tsx` | **55** |
| B — routed pages | A minus 7 CRM dialogs, 3 teaching panels, 1 pdf-annotator | **44** |
| C — list-shaped | Files that render `<ListPage` (includes mixed payroll) | **23** |

---

## Shell check

| Check | File | Result |
|-------|------|--------|
| Root client class | `apps/admin/src/shell/shell.tsx` | Renders `<div className="o_web_client">` |
| Navbar | same | Renders `<OdooNavbar …>` when chrome not suppressed |
| Main outlet | same | `<main className="o-main">` + `<Outlet />` |

Forced password flow may suppress navbar chrome; shell container class remains design3.

---

## Primary frame census (55 files)

### ListPage — 22 files (40.0%)

| Path | Notes |
|------|--------|
| `admin/audit-log.tsx` | ListPage; **inline** filter row (not FilterBar) |
| `admin/facilities.tsx` | ListPage + DataTable + ListPagination |
| `admin/users.tsx` | ListPage + DataTable + ListPagination |
| `classes/index.tsx` | ListPage + DataTable |
| `courses/index.tsx` | ListPage + DataTable |
| `crm/aftersale.tsx` | ListPage + **FilterBar** |
| `crm/pipeline.tsx` | ListPage; `filters=` = custom Selector (not FilterBar) |
| `crm/post-sale-meeting.tsx` | ListPage + **FilterBar** |
| `engagement/gifts.tsx` | ListPage + DataTable |
| `engagement/leaderboard.tsx` | ListPage + EmptyState shell (no backend) |
| `engagement/rewards.tsx` | ListPage + **FilterBar** |
| `enrollment/class-placement.tsx` | ListPage wrapping placement **form** flow |
| `finance/receipt-list.tsx` | ListPage + **FilterBar** |
| `finance/reconciliation.tsx` | ListPage + **FilterBar** + flag cards |
| `finance/refund.tsx` | ListPage + EmptyState (feature not applied) |
| `hr/kpi.tsx` | ListPage + DataTable; period filter in header |
| `parents/index.tsx` | ListPage + DataTable |
| `students/index.tsx` | ListPage + **FilterBar** |
| `teaching/attendance.tsx` | ListPage + session pickers (ops surface) |
| `teaching/exercises.tsx` | ListPage + DataTable |
| `teaching/grading.tsx` | ListPage + MasterDetail |
| `teaching/schedule.tsx` | ListPage + **FilterBar** + calendar/kanban/table |

### DetailPage only — 6 files (10.9%)

| Path | Chrome flags |
|------|----------------|
| `classes/class-detail.tsx` | **EntityHeader** |
| `crm/opportunity-detail.tsx` | **EntityHeader** + **WorkflowStatusbar** |
| `finance/receipt-detail.tsx` | **EntityHeader** + **WorkflowStatusbar** |
| `hr/my-hr.tsx` | tabs only (no EntityHeader/Statusbar) |
| `students/student-detail.tsx` | **EntityHeader** |
| `teaching/session-detail.tsx` | DetailPage hub |

### FormPage — 6 files (10.9%)

| Path |
|------|
| `attendance/check-in-out.tsx` |
| `attendance/shifts.tsx` |
| `finance/receipt-create.tsx` |
| `teaching/report-cards.tsx` |
| `teaching/session-assessment.tsx` |
| `teaching/session-evidence.tsx` |

### DashboardPage — 2 files (3.6%)

| Path |
|------|
| `cockpit.tsx` |
| `finance/revenue-report.tsx` |

### SettingsShell alone — 0

All SettingsShell usage is nested under DetailPage (see Mixed).

### Mixed — 4 files (7.3%)

| Path | Frames |
|------|--------|
| `admin/network-ip.tsx` | DetailPage + **SettingsShell** |
| `admin/shift-config.tsx` | DetailPage + **SettingsShell** |
| `hr/salary-tiers.tsx` | DetailPage + **SettingsShell** |
| `hr/payroll.tsx` | **ListPage** (staff table) + **DetailPage** (payslip) |

### Bespoke — 15 files (27.3%)

See [Top outliers](#top-outliers-bespoke-15) below.

---

## Chrome / grammar accessory flags

| Flag | Files (non-test) | Count | How counted |
|------|------------------|-------|-------------|
| **FilterBar** | aftersale, post-sale-meeting, receipt-list, reconciliation, rewards, schedule, students/index | **7** | import + render |
| **filters= slot** without FilterBar | `crm/pipeline.tsx` | **1** | custom Selector row |
| **ControlBar** direct | — | **0** | only comment in `grading.tsx`; real usage via ListPage |
| **ListPage ⇒ ControlBar** (transitive) | all 23 ListPage files | **23** | ListPage composes ControlBar |
| **WorkflowStatusbar** | opportunity-detail, receipt-detail | **2** | |
| **EntityHeader** | class-detail, opportunity-detail, receipt-detail, student-detail | **4** | |
| **o-form-sheet** string in page | — | **0** | |
| **o-form-sheet via DetailPage** | 10 DetailPage consumers (6 only + 4 mixed) | **10** | component emits `.o-form-sheet` |

### List + FilterBar rate

- Denominator C = files rendering `<ListPage` = **23** (22 primary + payroll).  
- With `FilterBar` component: **7 / 23 = 30.4%**.  
- With any `filters=` prop: **8 / 23 = 34.8%** (adds pipeline).  
- Empty-state ListPages (`refund`, `leaderboard`) still count in C but do not need FilterBar for ops — excluding them: **7 / 21 = 33.3%**.

Interpretation: most list surfaces still put search/filter in **PageHeader actions** or **body-local** controls (audit-log, kpi, facilities, users, gifts, …). G1 Search playbook should target that gap, not frame adoption.

---

## Module breakdown

First path segment under `pages/` (root files → `_root`).

| Module | Files | Framed | Bespoke | % framed | Primary mix |
|--------|------:|-------:|--------:|---------:|-------------|
| `_root` | 5 | 1 | 4 | **20.0%** | 1 Dashboard; login / change-password / coming-soon / go-resolver bespoke |
| `admin` | 5 | 5 | 0 | **100%** | 3 List, 2 Mixed (Detail+Settings) |
| `attendance` | 2 | 2 | 0 | **100%** | 2 Form |
| `classes` | 2 | 2 | 0 | **100%** | 1 List, 1 Detail |
| `courses` | 1 | 1 | 0 | **100%** | List |
| `crm` | 11 | 4 | 7 | **36.4%** | 3 List, 1 Detail; **7 dialogs** |
| `engagement` | 3 | 3 | 0 | **100%** | 3 List (1 empty shell) |
| `enrollment` | 1 | 1 | 0 | **100%** | List |
| `finance` | 6 | 6 | 0 | **100%** | 3 List, 1 Detail, 1 Form, 1 Dashboard |
| `hr` | 4 | 4 | 0 | **100%** | 1 List, 1 Detail, 2 Mixed |
| `parents` | 1 | 1 | 0 | **100%** | List |
| `students` | 2 | 2 | 0 | **100%** | 1 List, 1 Detail |
| `teaching` | 12 | 8 | 4 | **66.7%** | 4 List, 1 Detail, 3 Form; + pdf + 3 panels |
| **Total** | **55** | **40** | **15** | **72.7%** | |

**Module insight:** every product module folder is at 100% frame adoption except:

- `_root` (auth / utility / placeholder)  
- `crm` (dialogs drag % down; **routed CRM pages 4/4 = 100%**)  
- `teaching` (panels + pdf-annotator; **routed teaching pages 8/8 = 100%**)

---

## Top outliers (bespoke) — path + why

Ordered for migration priority (product impact first). Dialogs/panels are expected bespoke under Odoo grammar (modals ≠ list/form views).

| # | Path | Why bespoke / migration note |
|---|------|------------------------------|
| 1 | `login.tsx` | Auth outside shell by design; Card form, not page archetype. **Keep** |
| 2 | `change-password.tsx` | Forced/voluntary rotation; Card form; shell may hide chrome. Could adopt FormPage later; not blocking |
| 3 | `coming-soon.tsx` | Shared placeholder Stack; used by routes. Optional ListPage empty pattern |
| 4 | `go-resolver.tsx` | Redirect + PageHeader/EmptyState only; not a domain view |
| 5 | `teaching/pdf-annotator.tsx` | **Embedded widget** inside grading MasterDetail; comments forbid FormPage double-shell |
| 6 | `teaching/panels/assessment-panel.tsx` | Session hub **panel**, not a route |
| 7 | `teaching/panels/attendance-panel.tsx` | Session hub panel |
| 8 | `teaching/panels/evidence-panel.tsx` | Session hub panel |
| 9 | `crm/create-lead-dialog.tsx` | Dialog-only action surface |
| 10 | `crm/mark-lost-dialog.tsx` | Dialog-only |
| 11 | `crm/schedule-test-dialog.tsx` | Dialog-only |
| 12 | `crm/schedule-parent-meeting-dialog.tsx` | Dialog-only |
| 13 | `crm/complete-parent-meeting-dialog.tsx` | Dialog-only |
| 14 | `crm/create-after-sale-case-dialog.tsx` | Dialog-only |
| 15 | `crm/resolve-after-sale-case-dialog.tsx` | Dialog-only |

**Actionable “real page” outliers for frame migration:** effectively **0–2** (`change-password`, maybe tighten `coming-soon`). The rest are intentional non-pages.

### Secondary outliers (framed but weak grammar)

Not bespoke, but incomplete Odoo list/form chrome — useful for G1/G2 cooks:

| Path | Frame | Gap |
|------|-------|-----|
| `admin/audit-log.tsx` | ListPage | Filters inline in body, not FilterBar/ControlBar filters slot |
| `hr/kpi.tsx` | ListPage | Period in header actions, no FilterBar |
| `crm/pipeline.tsx` | ListPage | Custom filter row; no FilterBar component |
| `enrollment/class-placement.tsx` | ListPage | Form workflow dressed as list |
| `teaching/attendance.tsx` | ListPage | Ops form/picker inside list chrome |
| `finance/refund.tsx` | ListPage | Empty shell only |
| `engagement/leaderboard.tsx` | ListPage | Empty shell only |
| `hr/my-hr.tsx` | DetailPage | No EntityHeader / WorkflowStatusbar |
| `teaching/session-detail.tsx` | DetailPage | Hub; panels carry body (panels bespoke) |

---

## Cross-check vs design3 rollout ~40/55

From `plans/260805-1920-design3-admin-rollout/plan.md` (Phase 3 leverage claim):

| Prior claim | This audit | Honesty |
|-------------|------------|---------|
| `<ListPage` **23** files | **23** files render ListPage | **Match** |
| `<DetailPage` **10** | **10** (6 only + 4 mixed) | **Match** |
| `<FormPage` **6** | **6** | **Match** |
| Union **~40/55** inherit central templates | **40/55** unique files with any frame | **Match** |
| `SettingsShell` **3** | **3** (all Mixed with DetailPage) | **Match** |
| `DashboardPage` **2** | **2** | **Match** |
| `EntityHeader` **4** (do not add coverage) | **4** | **Match** |
| `ControlBar` **0** direct | **0** direct | **Match** |
| Round-2 **~45/55** after adding SettingsShell + Dashboard | **Incorrect if additive** — SettingsShell pages already in DetailPage set; Dashboard already in 40. Unique set stays **40**, not 45 | **Prior ~45 overstated by double-counting** |
| Bespoke ≈ 7 CRM dialogs + 3 panels + login/coming-soon | 7 dialogs + 3 panels + pdf-annotator + login + change-password + coming-soon + go-resolver = **15** | Prior omitted **change-password**, **go-resolver**, **pdf-annotator** (and treated login/coming-soon loosely) |

**Verdict:** The **~40/55 (72.7%)** template-leverage number remains **empirically honest**. The upgrade to **~45/55** was **not** an honest unique-file coverage rate. Module sweeps claiming “template-covered” for product routes align with **40/44 = 90.9%** routed-page framing — also honest if the denominator is routed pages, not all TSX under `pages/`.

---

## Caveats

1. **Dialogs-only files (7):** Count in Denominator A; they are not list/form routes. Prefer Denominator B for “screen coverage.”  
2. **Panels / pdf-annotator (4):** Nested UI; frame adoption would double-shell.  
3. **Empty ListPage shells (2):** `refund`, `leaderboard` — frame yes, product UI no.  
4. **ListPage as form wrapper:** `class-placement`, parts of `attendance` — grammar frame present, archetype mismatch.  
5. **Mixed payroll:** One file, two modes; classified Mixed once.  
6. **Detection is static source match**, not runtime DOM. Matches `scripts/check-ui-frames.mjs` philosophy.  
7. **LMS out of scope.**  
8. **Visual/e2e parity** not re-run here; this is structure census only.  
9. **FilterBar %** is deliberately low; ControlBar chrome exists on all ListPages, but Odoo-style search OS (G1) is still partial.  
10. **No `o-form-sheet` in page sources** is fine — DetailPage owns the sheet; class-string greps undercount form grammar.

---

## Full file → primary frame table

| File | Primary | FilterBar | EntityHeader | WorkflowStatusbar |
|------|---------|:---------:|:------------:|:-----------------:|
| `cockpit.tsx` | DashboardPage | | | |
| `change-password.tsx` | Bespoke | | | |
| `coming-soon.tsx` | Bespoke | | | |
| `go-resolver.tsx` | Bespoke | | | |
| `login.tsx` | Bespoke | | | |
| `admin/audit-log.tsx` | ListPage | | | |
| `admin/facilities.tsx` | ListPage | | | |
| `admin/network-ip.tsx` | Mixed (Detail+Settings) | | | |
| `admin/shift-config.tsx` | Mixed (Detail+Settings) | | | |
| `admin/users.tsx` | ListPage | | | |
| `attendance/check-in-out.tsx` | FormPage | | | |
| `attendance/shifts.tsx` | FormPage | | | |
| `classes/class-detail.tsx` | DetailPage | | ✓ | |
| `classes/index.tsx` | ListPage | | | |
| `courses/index.tsx` | ListPage | | | |
| `crm/aftersale.tsx` | ListPage | ✓ | | |
| `crm/complete-parent-meeting-dialog.tsx` | Bespoke | | | |
| `crm/create-after-sale-case-dialog.tsx` | Bespoke | | | |
| `crm/create-lead-dialog.tsx` | Bespoke | | | |
| `crm/mark-lost-dialog.tsx` | Bespoke | | | |
| `crm/opportunity-detail.tsx` | DetailPage | | ✓ | ✓ |
| `crm/pipeline.tsx` | ListPage | (custom filters=) | | |
| `crm/post-sale-meeting.tsx` | ListPage | ✓ | | |
| `crm/resolve-after-sale-case-dialog.tsx` | Bespoke | | | |
| `crm/schedule-parent-meeting-dialog.tsx` | Bespoke | | | |
| `crm/schedule-test-dialog.tsx` | Bespoke | | | |
| `engagement/gifts.tsx` | ListPage | | | |
| `engagement/leaderboard.tsx` | ListPage | | | |
| `engagement/rewards.tsx` | ListPage | ✓ | | |
| `enrollment/class-placement.tsx` | ListPage | | | |
| `finance/receipt-create.tsx` | FormPage | | | |
| `finance/receipt-detail.tsx` | DetailPage | | ✓ | ✓ |
| `finance/receipt-list.tsx` | ListPage | ✓ | | |
| `finance/reconciliation.tsx` | ListPage | ✓ | | |
| `finance/refund.tsx` | ListPage | | | |
| `finance/revenue-report.tsx` | DashboardPage | | | |
| `hr/kpi.tsx` | ListPage | | | |
| `hr/my-hr.tsx` | DetailPage | | | |
| `hr/payroll.tsx` | Mixed (List+Detail) | | | |
| `hr/salary-tiers.tsx` | Mixed (Detail+Settings) | | | |
| `parents/index.tsx` | ListPage | | | |
| `students/index.tsx` | ListPage | ✓ | | |
| `students/student-detail.tsx` | DetailPage | | ✓ | |
| `teaching/attendance.tsx` | ListPage | | | |
| `teaching/exercises.tsx` | ListPage | | | |
| `teaching/grading.tsx` | ListPage | | | |
| `teaching/pdf-annotator.tsx` | Bespoke | | | |
| `teaching/report-cards.tsx` | FormPage | | | |
| `teaching/schedule.tsx` | ListPage | ✓ | | |
| `teaching/session-assessment.tsx` | FormPage | | | |
| `teaching/session-detail.tsx` | DetailPage | | | |
| `teaching/session-evidence.tsx` | FormPage | | | |
| `teaching/panels/assessment-panel.tsx` | Bespoke | | | |
| `teaching/panels/attendance-panel.tsx` | Bespoke | | | |
| `teaching/panels/evidence-panel.tsx` | Bespoke | | | |

**Counts:** List 22 + Detail 6 + Form 6 + Dashboard 2 + Mixed 4 + Bespoke 15 = **55**.

---

## Implications for G1 / G2 / next cook

1. **Frame rollout is largely done** for routed admin screens (90.9%). Remaining work is **not** “wrap more pages in ListPage.”  
2. **G1 Search:** only **7/23** list surfaces use FilterBar; raising this is the measurable next %.  
3. **G2 Fields:** FormPage (6) + DetailPage sheet (10) are the field-grammar homes; dialogs stay primitive stacks.  
4. **Do not** chase dialog/panel frame % — it inflates bespoke without UX value.  
5. Prefer reporting **40/44 routed** for product status and **40/55 all TSX** for repo hygiene.

---

## Summary

- **Denominator A:** 55 non-test `pages/**/*.tsx`.  
- **Any standard Odoo grammar frame:** **40/55 = 72.7%**.  
- **Routed pages only:** **40/44 = 90.9%**.  
- **ListPage + FilterBar:** **7/23 = 30.4%**.  
- **Shell:** `OdooNavbar` + `o_web_client` confirmed.  
- Prior design3 **~40/55** is **validated**; **~45/55** was **unique-file double-count**.  
- Top true gaps: FilterBar coverage on lists, inline filters, empty ListPage shells, EntityHeader/Statusbar on remaining details — not missing page frames.
