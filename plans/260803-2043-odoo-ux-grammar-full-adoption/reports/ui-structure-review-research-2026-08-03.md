# Review UI đã triển khai + Research hệ thống giao diện có cấu trúc

**Date:** 2026-08-03  
**Scope:** Admin ERP (`apps/admin` + `@cmc/ui`) after Odoo UX Grammar full adoption  
**Method:** Code/docs audit · adoption grep · design-system corpus · external DS research (Lightning, Polaris, Primer, Atlassian, Fiori, Odoo)

---

## 1. Executive summary

CMC EDU đã đạt **nền tảng “product OS”**: 4 page frames + ControlBar + VIEW-GRAMMAR + adoption gần đầy đủ product pages. Đây là đúng lớp Odoo/Salesforce **structure**, không phải skin.

**Điểm mạnh:** grammar đóng, raised family, brand locked, detail recipe trên entity chính.  
**Điểm yếu so với hệ DS trưởng thành:** depth của list chrome (FilterBar/pager/bulk còn mỏng), **dual heading** PageHeader+EntityHeader, thiếu **record highlight / related list** chuẩn Salesforce, ControlBar sticky chưa có surface chrome thật, settings/report chưa có archetype riêng trong code.

**Khuyến nghị chiến lược:** không thay stack; **làm sâu grammar** theo 4 lớp (shell · frame · record · field widgets) lấy chuẩn từ Lightning + Polaris + Odoo ControlPanel — 3 sprint cải thiện, không rewrite.

---

## 2. Review hiện trạng đã triển khai

### 2.1 Kiến trúc 3 tầng (đã có)

```text
Shell:     AppFrame + SideNav + topbar
Frame:     Dashboard | List(+ControlBar) | Detail | Form
Atoms:     PageHeader, EntityHeader, FilterBar, DataTable, SectionBlock, …
Tokens:    --cmc-* warm canvas · Inter · brand #0071E3
Law:       MASTER · PAGE-FRAMES · STRUCTURE · VIEW-GRAMMAR · llms.txt
```

### 2.2 Adoption (đo)

| Metric | State |
|--------|--------|
| Product pages on 4 frames | **Near-complete** — residual: login / change-password / coming-soon (EXEMPT) |
| ControlBar | Exists; ListPage embeds always |
| ListPagination production | **1 page** (receipt-list) |
| FilterBar production | **Few** (receipt-list, rewards, schedule…) |
| EntityHeader | student · class · receipt · opportunity |
| BulkActionBar | Design Lab only — DataTable no selection |
| Design Lab | Living inventory at `/design` |

### 2.3 Chất lượng cấu trúc theo archetype

| Archetype | Grade | Review notes |
|-----------|-------|--------------|
| **Shell** | A− | SideNav module feel OK; thiếu app-switcher density / command palette (Atlassian/Linear) |
| **Dashboard** | B+ | Cockpit role slots good; secondary rail consistent |
| **List** | B | Frame yes; ControlBar sticky **không có nền** → scroll content lọt dưới chrome; pager/filter adoption low |
| **Detail** | B | Recipe đúng; **hai heading** (PageHeader title + EntityHeader h1) a11y + visual noise |
| **Form** | B | Sticky actions OK; wizard ProgressSteps rải rác |
| **Visual system** | A− | Raised family + keyline + soft brand — premium restraint mạnh hơn Odoo Bootstrap |

### 2.4 Anti-patterns còn sót (trong code)

1. **Dual title** — PageHeader `Heading` + EntityHeader `h1` cùng entity name.  
2. **ControlBar sticky bare** — `position: sticky` nhưng không quiet surface/blur → đọc kém khi scroll.  
3. **Filter type poverty** — chỉ `text | select` (thiếu date, multi).  
4. **Pager không universal** — nhiều list vẫn không có / custom.  
5. **Pipeline “ListPage shell”** — grammar OK nhưng không có view-mode switcher list|kanban.  
6. **Settings via DetailPage tabs** — works but không có Settings shell (sidebar app list như Odoo/Polaris settings).  
7. **Related navigation** — CRM→receipt→student là route may mắn, không “related list” / stat button box chuẩn.

---

## 3. Đối sánh với hệ UI có cấu trúc

### 3.1 Ma trận hệ tham chiếu

| System | Cấu trúc cốt lõi | Tốt cho CMC | Không copy |
|--------|------------------|-------------|------------|
| **Odoo Web** | ControlPanel · closed views · form sheet · action stack | ControlBar, view map, form notebook | OWL, purple Bootstrap, XML views |
| **Salesforce Lightning** | Record page · highlights panel · related lists · path/statusbar · flexi layout | Detail density, highlight strip, related tabs | Full SLDS, heavy chrome |
| **Shopify Polaris** | Page · IndexTable · resource list · settings sections · 1 primary | List ops, settings rows, empty states | Merchant ecom metaphor |
| **GitHub Primer** | AppFrame · data tables · soft status · timeline | Soft badges, timeline, density | Cool gray, sharp radius |
| **Atlassian** | Navigation · page header · tables · flags · side nav apps | Multi-app shell consistency | Product suite complexity |
| **SAP Fiori** | Launchpad tiles · object page · list report | Object page header facets | Tile over-dashboarding for staff ERP |
| **Linear / modern ops** | Command menu · keyboard · sparse | Later: ⌘K | Too sparse for education ERP |

Sources: Lightning enterprise patterns; Polaris/Primer/Atlassian public systems; Odoo 19 framework docs; prior xia compare in-repo.

### 3.2 Map chi tiết: họ làm gì vs CMC

| Job người dùng | Odoo | Lightning | Polaris | **CMC hôm nay** | Gap |
|----------------|------|-----------|---------|-----------------|-----|
| Browse records | list + ControlPanel | list views + filters | Index / resource list | ListPage + ControlBar | Pager/filter depth |
| Open one record | form sheet | **Record page** (header + highlights + tabs + related) | Resource detail | DetailPage recipe | Highlights / related lists |
| Edit | form edit | Dynamic forms | Form layout | FormPage | Field groups density |
| Pipeline | kanban view | Kanban / path | — | FunnelBar custom | View switcher |
| Settings | settings form + app rail | Setup | Settings pages | SettingsSection ad hoc | Settings shell |
| Status workflow | statusbar | Path | Badge | StatusBadge + ProgressSteps partial | Unified statusbar strip |
| Related counts | smart buttons | related lists / highlight | — | sparse | **StatAction / button_box** |
| Empty | empty helper | empty state | EmptyState | EmptyState | OK |
| Density | high | high | medium | ops + premium | OK intentional |

### 3.3 Visual language (không nhầm structure với skin)

| | Odoo | Lightning | Polaris | **CMC (giữ)** |
|--|------|-----------|---------|---------------|
| Canvas | cool gray | cool | cool white | **Warm paper** |
| Brand | purple | blue | green | **#0071E3 one blue** |
| Radius | sharp/Bootstrap | mild | 8-ish | **12/16/20 nested** |
| Density | very high | high | medium | **ops compact + soft** |

→ Cải thiện **cấu trúc & depth**, không pivot brand sang cool enterprise gray.

---

## 4. Research: nguyên tắc “hệ thống có cấu trúc”

Các DS ERP/B2B thành công chia sẻ **cùng 5 luật** (tổng hợp):

### L1 — Closed page archetypes (đã có)
Không cho module invent full-page layout. CMC: 4 frames + law docs.

### L2 — Universal chrome band for lists (đã có skeleton)
Odoo ControlPanel / Polaris Index filters: search · filters · primary · pager **cùng chỗ**.  
CMC: ControlBar tồn tại nhưng **adoption filter/pager chưa đủ**.

### L3 — Record page is a product type (partial)
Lightning Object/Record page:
```text
[ breadcrumbs ]
[ title · status · primary actions ]     ← 1 h1
[ highlight fields 3–4 ]                 ← summary band
[ tabs: details | related | activity ]
[ body / related lists ]
```
CMC DetailPage map gần đúng nhưng thiếu **highlight band chuẩn** + **related lists** + dual title.

### L4 — Field & status vocabulary (yếu)
Registry-like: money, phone, status path, tags, date.  
CMC: Astryx primitives + StatusBadge — chưa widget kit product language.

### L5 — Navigation as stack / related context (yếu)
Odoo action stack; Lightning related lists; Fiori object hierarchy.  
CMC: RR breadcrumbs — đủ cho shallow, yếu cho deep CRM→finance→student.

---

## 5. Đánh giá tổng hợp (scorecard)

| Dimension | Score /5 | Evidence |
|-----------|----------|----------|
| Frame completeness | 4.5 | 4 frames + adoption |
| List ops depth | 2.5 | ControlBar yes; filter/pager/bulk thin |
| Detail/record maturity | 3.0 | Recipe yes; dual title; no highlights/related |
| Form/settings | 3.0 | FormPage OK; settings shell no |
| Visual cohesion | 4.5 | tokens + raised family |
| A11y heading/nav | 2.5 | dual h1/heading; sticky contrast |
| Docs / agent law | 4.5 | VIEW-GRAMMAR + PAGE-FRAMES |
| Extensibility without chaos | 4.0 | compose, no second Tailwind |

**Overall structure maturity: ~3.6/5** — “good foundation, ops depth incomplete.”

---

## 6. Hướng cải thiện có thứ tự (không rewrite)

### Tier 0 — Polish rẻ, ROI cao (3–5 ngày)

| # | Improvement | Lấy từ | Làm gì |
|---|-------------|--------|--------|
| P0.1 | **Single identity heading** | Lightning record header | PageHeader: breadcrumbs only (no entity title) khi có EntityHeader; 1× `h1` |
| P0.2 | **ControlBar surface** | Polaris page header sticky | `.tpl-control-bar` quiet raised + blur/hairline + canvas fade |
| P0.3 | **ListPagination default recipe** | Odoo pager | Wire pager on top 5 lists (users, classes, aftersale, pipeline list mode, gifts) |
| P0.4 | **FilterBar date type** | Polaris filters | `type: 'date' \| 'daterange'` + URL sync |
| P0.5 | Design Lab “Record page” composite | Lightning | Demo highlight strip + related tab empty |

### Tier 1 — Record page v2 (1 sprint)

| # | Improvement | Component |
|---|-------------|-----------|
| P1.1 | **HighlightStrip** | 3–4 KeyValue compact under EntityHeader (net amount, stage, owner, campus) |
| P1.2 | **StatActions / button_box** | CountBadge buttons → related list routes with context |
| P1.3 | **RelatedList** pattern | ListPage-in-tab or SectionBlock table + “Xem tất cả” |
| P1.4 | **WorkflowStatusbar** | ProgressSteps/Path for receipt · opportunity · enrollment |
| P1.5 | Kill dual title everywhere | codemod DetailPage pages |

### Tier 2 — List ops OS (1 sprint)

| # | Improvement |
|---|-------------|
| P2.1 | DataTable row selection + BulkActionBar (1 primary list first) |
| P2.2 | Optional columns / density toggle compact |
| P2.3 | Saved filter chips (lightweight — not full Odoo favorites) |
| P2.4 | View mode chips list \| board where 2 modes exist (pipeline, schedule) |

### Tier 3 — Shell & settings (optional later)

| # | Improvement |
|---|-------------|
| P3.1 | SettingsShell: left app list + SettingsSection body (Polaris/Odoo) |
| P3.2 | Command palette ⌘K for nav (Linear/Atlassian lite) |
| P3.3 | Related action stack service (only if CRM depth demands) |

### Explicit non-goals (vẫn giữ)

- Port Lightning/SLDS, Polaris full, Odoo OWL  
- Cool gray rebrand  
- Second CSS framework  

---

## 7. Target structure (sau cải thiện)

```text
SHELL
  AppFrame · SideNav · Topbar (1 primary · user · facility)

LIST
  ListPage
    ControlBar [ quiet sticky surface ]
      breadcrumbs · title · primary
      FilterBar (text · select · date)
      ListPagination | BulkActionBar
    DataTable | board

RECORD (Detail)
  breadcrumbs only (PageHeader slim)
  EntityHeader (single h1 · badges · actions)
  HighlightStrip (3–4 fields)
  WorkflowStatusbar?
  CmcTabs [ Details | Related* | Activity ]
  SectionBlock / RelatedList

FORM
  FormPage · ProgressSteps? · sticky actions

DASHBOARD
  unchanged cockpit grammar

SETTINGS
  SettingsShell (later) · SettingsSection (now)
```

---

## 8. Success metrics for next improvement plan

| Metric | Now | Target next plan |
|--------|-----|------------------|
| Lists with ListPagination | 1 | ≥6 |
| Lists with FilterBar | ~3 | ≥10 |
| Detail pages dual-title | most | 0 |
| Detail with HighlightStrip | 0 | all money/CRM/class entities |
| ControlBar contrast on scroll | weak | quiet surface verified |
| Bulk on ≥1 list | 0 | 1 (if selection shipped) |

---

## 9. Recommendation

1. **Accept** current work as solid **structure foundation** (frames + grammar).  
2. **Next plan name suggestion:** `ui-structure-depth` — Tier 0 + Tier 1 only (no bulk until selection design locked).  
3. Research takeaway: enterprise cohesion = **record page + list control panel + field vocabulary**, not more colors.  
4. Keep CMC warm premium as differentiator vs Odoo/Lightning cool density.

---

## 10. Sources (internal + external)

**Internal**

- `design-system/cmc-edu/{MASTER,PAGE-FRAMES,STRUCTURE,VIEW-GRAMMAR}.md`
- `packages/ui` frames + ControlBar
- `plans/260803-xia-odoo-ui-architecture/reports/odoo-ui-compare-cmc-edu.md`
- Adoption after plan `260803-2043-odoo-ux-grammar-full-adoption`

**External patterns**

- Salesforce Lightning — record pages, enterprise tables/forms
- Shopify Polaris — admin index/settings/empty
- GitHub Primer — soft status, tables
- Atlassian Design — multi-app consistency
- SAP Fiori — object page / list report
- Odoo 19 web framework — ControlPanel, views

---

**Status:** DONE (research + review only)  
**Next action if approved:** `/ak:plan` “UI structure depth Tier 0–1” then `/ak:cook`
