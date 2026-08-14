# Live UI audit — chrome + list/kanban (pack 01 / 02 / 03 / 15)

**When:** 2026-08-14 ~09:47–10:06 +07  
**Target:** `https://erp.localhost` @ viewport **1280×900**, admin `admin@cmcvn.edu.vn`  
**Contract:** `design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md`  
**Pack refs:** `01-chrome-app-switcher`, `02-sis-students-kanban`, `03-sis-students-list`, `15-admissions-applications-list`  
**Method:** cursor-ide-browser navigate/lock + `Runtime.evaluate` measurements + PNG captures  
**Scope agent:** chrome + list/kanban only (no form/statusbar)

---

## Verdict

**FAIL — not arm’s-length match.**

Navbar Community purple **46px / `#71639e`** is correct on every page visited. Everything under it still reads pre-clone console: **stacked CP (~142–219px)** instead of one **~58px** row, **Apple blue `#0071E3` / `rgb(0, 113, 227)` primary CTAs**, search shells **12px / ~28px / left** (not centered **999px / 35px** pill), list rows **~30–37px** (not **40px**), status mostly **soft pastels** (not solid capsules), and **SIS students have no view switcher / no kanban** (pack 02 missing).

---

## Measured table

| Page | Nav h / bg | CP h / layout | New / primary CTA | Search shell | View switcher | List thead bg / h | Row h | Status pills | Notes |
|------|------------|---------------|-------------------|--------------|---------------|-------------------|-------|--------------|-------|
| `/admin/students` | **46** / `rgb(113,99,158)` | **149–219** / `flex-direction:column` stacked | **ABSENT** | h**28**, r**12px**, left **23**, bg `rgb(235,232,226)` | **ABSENT** | `rgb(248,249,250)` / **37** | **30** | soft success `rgb(230,242,233)` / `rgb(27,94,42)` r9999 | Search-first; no SIS kanban |
| `/admin/courses` | 46 / same | **208** / stacked | `+ Tạo khoá` **`rgb(0,113,227)`** h28 r**12px** | same 28/12 left | ABSENT | gray-100 / 37 | **30** | (none in cells) | Blue New + icon |
| `/admin/classes` | 46 / same | **219** / stacked | `+ Tạo lớp` **`rgb(0,113,227)`** h28 r12 | same | ABSENT | gray-100 / 37 | **30** | soft `active` pastel | Blue New |
| `/crm` (kanban) | 46 / same | **142** / stacked | `Thêm cơ hội` **`rgb(0,113,227)`** h28 r12 | same | **PRESENT** list/kanban in header; active fill `rgb(248,249,250)` | n/a (board) | n/a | — | 5 pipeline cols; cards `console-kanban-card` — OK for CRM (not SIS) |
| `/finance` | 46 / same | **208** / stacked | `+ Tạo phiếu thu` **`rgb(0,113,227)`** | shell 28/12 left~191 | ABSENT | gray-100 / 37 | **32** | soft `Đã duyệt` pastel green | No purple primary |
| `/admin/users` | 46 / same | **208** / stacked | `Thêm nhân viên` **`rgb(0,113,227)`** | same 28/12 left | ABSENT | gray-100 / 37 | **37** | role pills **`rgb(0,116,226)`**/white; status solid `rgb(25,129,0)` | Blue CTAs + blue role chips |

**Tokens on `.o_web_client`:** `--console-brand-purple: #71639e`, `--console-navbar-height: 46px`, `--console-gray-100: #f8f9fa`. Empty / unset at runtime: `--console-cp-height`, `--console-search-radius`, `--console-list-row-height`, `--console-btn-height`.

**Pass islands:** navbar color+height; thead ≈ gray-100; no vertical cell rules (`border-right: 0`); CRM keeps column kanban (correct grammar vs SIS photo grid).

---

## P0

- **CP not one row ~58px** — all list pages: `.console-control-bar` `flex-direction: column`, measured **142–219px** (header ~58–70 + filters ~53 + gap). Contract: single row LEFT New+title | CENTER search | RIGHT pager+switcher @ **58px**. Evidence: `/admin/students` CP h=149 stacked; `/crm` h=142; `/finance` h=208. Shots: `statusbar-students-list.png`, `statusbar-crm-kanban.png`, `statusbar-finance-list.png`.

- **Primary CTA = Apple blue, not purple** — `rgb(0, 113, 227)` / `#0071E3` on New-family buttons; **zero** `rgb(113, 99, 158)` buttons found in CP/main. Evidence: `/admin/courses` `+ Tạo khoá`; `/admin/classes` `+ Tạo lớp`; `/crm` `Thêm cơ hội` (+ `Ghi danh`); `/finance` `+ Tạo phiếu thu`; `/admin/users` `Thêm nhân viên`. Radius **12px** (contract **4px**), often with `+` icon (contract: no icon on New).

- **SIS students kanban missing (pack 02)** — `/admin/students` **view switcher ABSENT**; cannot toggle kanban; no 3-col photo cards. Only CRM has `.console-view-switcher` + `.console-kanban-board`.

---

## P1

- **Search not contract pill/slot** — shell **28×~180**, `border-radius: 12px`, left-aligned (`left≈23`), not center **~32% width / 35px / `999px`**. Placeholder/label pattern is FilterBar (“Tìm kiếm” + labeled field), not Odoo magnifier pill. Evidence: students/courses/classes/crm/users search chain.

- **List density** — body row **30–32px** (students/courses/classes/finance); users **37px**. Contract **`--console-list-row-height: 40px`**. Thead **37px** (target 40) but bg **`rgb(248,249,250)`** OK.

- **Status pills not solid capsules** — students `active` / finance `Đã duyệt`: fill `rgb(230, 242, 233)`, text `rgb(27, 94, 42)` (soft). Contract Done-family: **`#28a745` / white**, ~20px solid. Capsule radius 9999 is OK; fill/contrast wrong.

- **Users role chips use Apple-adjacent blue** — `/admin/users` many2many-style pills `rgb(0, 116, 226)` / white. Contract: many2many = **gray** pills; primary interactive = purple only.

- **Students list: no New** — pack/list grammar expects solid purple New on list CP; page is lookup-only empty until ≥2 chars.

- **View switcher placement/radius (CRM)** — present in header (good zone) but button radius **12px** (token `--console-radius-sm: 3px`); pager still lives in stacked filters, not RIGHT zone with switcher.

---

## P2

- **Pager left under filters** (`1–n / total`) instead of RIGHT of one CP row — all list pages.

- **Focus / selection chrome** — focused search on students shows bright blue border in screenshot (`statusbar-students-list-rows.png`); contract focus ring = **2px purple** offset 1px.

- **CRM pipeline summary bars use Apple blue** — `/crm` O4/O5 progress fills read bright blue in `statusbar-crm-kanban.png` (contract: funnel/primary = purple `#71639e`).

- **New button height ~28** vs `--console-btn-height: 30px`; cream/beige search fill `rgb(235,232,226)` vs pack gray search chrome.

- **CSS var gap** — cp/search/list-row tokens unset ⇒ density not driven by contract tokens yet.

---

## Screenshots (this folder)

| File | Page |
|------|------|
| `statusbar-students-list.png` | `/admin/students` empty/search |
| `statusbar-students-list-rows.png` | `/admin/students` after `q=an` |
| `statusbar-courses-list.png` | `/admin/courses` |
| `statusbar-classes-list.png` | `/admin/classes` (re-captured) |
| `statusbar-crm-kanban.png` | `/crm` pipeline kanban |
| `statusbar-finance-list.png` | `/finance` |
| `statusbar-users-list.png` | `/admin/users` |

---

## Page notes

1. **Login** `/login` → `/cockpit` OK with sim admin.  
2. **Students** — no kanban control to toggle; list only after search.  
3. **CRM** — pipeline kanban is the right grammar for CRM (not SIS 3-col photos); still fails CP + blue primary.  
4. **Parallel-tab noise:** shared browser was contested; measurements above taken on dedicated tab `82ff3e` after URL+DOM settle.

**No product code changed. No commit.**
