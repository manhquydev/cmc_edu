# Live UI walk — OpenEduCat pack vs Vite admin (2026-08-13)

Viewport **1280×800**. Source of truth: `/home/manhquy/Downloads/openeducat-ui-pack` (Odoo 18 Community `#71639E`).  
Target: **Vite** `http://127.0.0.1:5173` with `VITE_PROXY_API_TARGET=http://127.0.0.1:3000` (working-tree clone).  
**Not used:** `https://erp.localhost` (Docker admin image is ~9h stale).  
Role: `admin@cmcvn.edu.vn` (super_admin). Website pack 31–33, Discuss 35, Apps 36 skipped.

## Verdict

Chrome brand is in place. The list OS still fails the pack’s one-row 58px control panel. Primary CTAs are still Apple-blue. Several pack modules have no CMC analogue (product, not CSS).

**Next must-fix (kongming):** recompose list Control Panel to one 58px row — breadcrumbs/subtitle out of the row, ViewSwitcher with pager on the RIGHT, drop PageHeader `row-reverse`. Do it as a **list-only slot**; PageHeader is shared with forms.

## Matches (keep)

| Surface | Evidence |
|---|---|
| Navbar | 46px, `rgb(113, 99, 158)` = `#71639E` |
| Search box | 35px, magnifier, purple focus border |
| List table | 40px rows, thead `#f8f9fa`, no vertical rules, no striping |
| ViewSwitcher active | gray `#edeef1`, not purple |
| Status pills | green `#28a745` on classes `active`, CRM `Đã ghi danh`, student form `Đang học` |
| SIS kanban grid | 3 columns (~396px), clock icon bottom-right |
| Form sheet | pad `24px 32px`, bg pad `16px` |
| Statusbar | current `rgb(224, 217, 241)` = `#e0d9f1`, 33px chevron |
| Notebook tab | purple underline on student Hồ sơ |
| Chatter @1280 | opportunity form stacks timeline **below** sheet (y≈1201, full width) |
| Systray avatar | 24px initial (not fake Discuss counts) |

## Defects (severity)

### P0 — control panel is not the pack OS

Measured students list CP **89px** (pack ~58). Left zone 72px because breadcrumb + title + subtitle stack. ViewSwitcher sits **left of title** (`x=14`), not right with pager. Same pattern on courses, classes, CRM, schedule, users, finance.

Pack: `LEFT New+title | CENTER search | RIGHT pager+views`.

### P0 — primary New is Apple-blue, not purple

Observed: `+ Tạo khoá`, `+ Tạo lớp`, `Thêm cơ hội`, `Thêm nhân viên`, `+ Tạo phiếu thu`, chatter `Thêm ghi chú`. Students list has **no New**. Form pages have Copy link / Về danh sách, **no outline New**.

### P1 — FilterBar caret grows the CP in-flow

Audit log: extra text fields (actor/action/entity) stay **pinned inside** the search box (heuristic). Caret **Bộ lọc nâng cao** expands date pickers **under** the search, not as an overlay — CP becomes two+ rows.

### P1 — SIS kanban card content

Grid chrome is close. Card uses initial **N**, not a photo. Meta is a green `active` pill, not city + email (pack 02).

### P1 — students list status

Column **Trạng thái** showed the raw token `active` (classes list used a green pill for the same token). Inconsistent StatusBadge wiring.

### P2 — form chrome leftovers

Student form: extra summary card above statusbar; **no chatter**; StatActions (`Đổi trạng thái`) live in the sheet, not CP. Opportunity form: chatter present but **Thêm ghi chú** is blue; no Send message / Log note / Follow (correctly not faked).

### P2 — systray / menus are CMC product

⌘K, Ghi danh, Dev role, logout occupy the pack’s chat/clock/company slot. Module menus are long (finance has 10 items) vs pack’s 4–5. Do not fake Discuss 8/11.

### P2 — parents / attendance / exercises / settings are different products

| Pack | CMC live | Note |
|---|---|---|
| 07 Parents list | `/admin/parents` pending-link queue + tabs | Active tab underline **blue**, not purple |
| 21 Attendance sheets | `/teaching/attendance` class-picker wizard | No sheet list / ribbon |
| 23 Assignments list | `/teaching/exercises` folder library | Empty “Chưa phân loại” |
| 34 Settings | `/admin/users` staff list | No settings sidebar / Invite |
| 17 Week calendar | `/teaching/schedule` FullCalendar | No mini-cal; today not red; events blue; extra FC toolbar |
| 04 pack file | Settings overlay in pack | Student form is `/admin/students/:id` (used for sheet check) |

### Missing (no CMC screen)

Faculties 05–06, subjects 13, library 27–28, eLearning 29–30, Discuss 35, Apps 36. Website 31–33 out of admin scope.

## Walk map (done)

1. Login (Apple-blue — out of console OS) → cockpit  
2. App switcher (pack 01) — CMC modules, not Odoo app catalog  
3. `/admin/students` empty → query `An` → list (pack 03) → kanban (pack 02) → form  
4. `/admin/parents` (pack 07)  
5. `/admin/courses` (pack 09)  
6. `/admin/classes`  
7. `/crm` kanban + list (pack 15 analogue) → opportunity form + chatter (pack 16)  
8. `/teaching/schedule` (pack 17)  
9. `/teaching/attendance` (pack 21)  
10. `/teaching/exercises` (pack 23)  
11. `/admin/users` (pack 34 analogue)  
12. `/admin/audit-log` FilterBar + caret  
13. `/finance` receipts (CMC-only)

## Follow-ups (after CP row)

1. Remap list/form primary buttons in `.o_web_client` to purple 30px New (and outline New on forms).  
2. Advanced FilterBar as overlay/dropdown, not in-flow growth.  
3. SIS kanban: city/email meta; students list StatusBadge for `active`.

**Risk:** PageHeader is shared with form pages. A global breadcrumb hide or row-reverse delete will regress form chrome. Use a list-specific ControlBar slot.

## How to reproduce

```bash
VITE_PROXY_API_TARGET=http://127.0.0.1:3000 VITE_API_URL="" pnpm --filter @cmc/admin dev --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173` at 1280×800. Do **not** compare against `erp.localhost`.
