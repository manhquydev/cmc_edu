# Live UI audit — ops / misc (agent)

**Date:** 2026-08-14 ~09:45–10:06 ICT  
**Target:** `https://erp.localhost` (Docker admin)  
**Role:** `admin@cmcvn.edu.vn` (`.env.local-sim-accounts`)  
**Pack:** `/home/manhquy/Downloads/openeducat-ui-pack` refs **01, 07, 17, 21, 23, 34**  
**Shots:** `plans/reports/live-ui-audit-260814-0945/shots/ops-misc/`  
**Rule:** PRODUCT-GAP = different product screen (do not CSS-fix). DEFECT = same chrome grammar, wrong token / pack visual. No product code changed.

## Verdict

Ops/misc is mostly **product-different**, not a failed OpenEduCat clone. Pack analogues for parents / attendance / assignments / settings are **not** what CMC ships. Where CMC *does* share a surface (week calendar, purple navbar), real defects remain: **no mini-cal**, **today is not a red circle**, **FC events are blue**, **tab indicators + CountBadge + ProgressSteps current use `#0071E3`**, revenue bar is Apple-blue. Systray correctly has **no fake Discuss 8/11**.

## Classification table

| Surface | Pack | Class | Evidence | Note |
|---|---|---|---|---|
| `/teaching/schedule` | 17 | **PARTIAL** (+ DEFECTS) | `01-schedule-week.png` | Week FC grid exists; missing mini-cal; today header no red circle; event `rgb(55,136,216)`; extra FC Month/Week/Day/List toolbar |
| `/teaching/attendance` | 21 | **PRODUCT-GAP** | `02-attendance-wizard.png` | Class-picker wizard (“1. CHỌN LỚP”), not Attendance Sheets list (Register/Name/Session/Date + New) |
| `/teaching/exercises` | 23 | **PRODUCT-GAP** | `03-exercises-library.png` | Folder library (“Thư viện bài tập” / “Chưa phân loại”), not Assignments multi-column list |
| `/admin/parents` | 07 | **PRODUCT-GAP** (+ DEFECT) | `04b-parents-pending.png`, `04-parents-all.png` | Link-request queue + tabs, not Parents Name/Mobile/Student(s) tags; tab indicator `rgb(0,113,227)` |
| `/admin/users` | 34 | **PRODUCT-GAP** | `05-users-staff-list.png` | Staff table only; **no** settings sidebar, **no** Invite (expected) |
| `/hr/shifts` | — | **PRODUCT-GAP** (+ DEFECT) | `06-hr-shifts.png` | CMC Work Schedule queue; no pack ref; active tab underline Apple-blue |
| `/hr/payroll` | — | **PRODUCT-GAP** | `07-hr-payroll.png` | Minimal employee picker list; no pack payroll analogue |
| `/ops/revenue` | — | **PRODUCT-GAP** (+ DEFECT) | `08-ops-revenue.png` | CMC KPI cards; class bar strongly Apple-blue (`#0071E3` family) |
| `/ops/recon` | — | **PRODUCT-GAP** | `09-ops-recon.png` | Read-only alert console; no pack analogue |
| `/admin/engagement/rewards` | — | **PRODUCT-GAP** | `12-engagement-rewards.png` | Gift redemption queue; CMC-only |
| `/design` showcase | — | **PARTIAL** / catalog DEFECTS | `10-design-showcase.png`, `10c-design-workflow.png` | Living gallery; Apple-blue on CountBadge + ProgressSteps current |
| App switcher / systray | 01 | **PARTIAL** | `11-app-switcher.png` | Navbar `#71639E` 46px MATCH; module list is CMC; systray ⌘K/Ghi danh/role/logout — **no fake Discuss badges** (correct) |

---

## 1. Schedule vs pack 17 — PARTIAL

**Pack 17:** Sessions week calendar + right mini-month; today day-number in **red circle**; Week/Today chrome; empty grid in pack shot.

**Live (`01-schedule-week.png`):**
- FullCalendar week view with hours + one session block (Thu 13/8 18:00 `CMCDEVEL-UCREA…` / planned).
- **No mini-calendar sidebar** → DEFECT vs pack 17 layout.
- Today column exists (`Th 6 14/8`); day number style measured: transparent bg, black text, `border-radius: 0` — **not** pack red circle → DEFECT.
- Event fill measured `rgb(55, 136, 216)` → DEFECT (not brand purple).
- FC toolbar text includes `Hôm nay`, date range, **Tháng / Tuần / Ngày / Danh sách** → extra FC chrome beyond pack’s Week dropdown → PARTIAL/DEFECT.
- Course ID filter above calendar = CMC product, not pack.

## 2. Attendance vs pack 21 — PRODUCT-GAP

**Pack 21:** list “Attendance Sheets”, purple New, columns Register / Name / Session / Date, Today chip, pager + view switcher.

**Live (`02-attendance-wizard.png`):** “Điểm danh” → step **1. CHỌN LỚP** search + “Chọn lớp học” select. No sheet table, no New, no Register/Name columns. Different workflow — do not treat as CSS miss.

## 3. Exercises vs pack 23 — PRODUCT-GAP

**Pack 23:** Assignments list (Course/Batch/Subject/Faculty/State…).

**Live (`03-exercises-library.png`):** “Thư viện bài tập” split pane; folder “Chưa phân loại”; empty right pane. Product library, not assignment register. Mild chrome noise: selected folder uses blue rail (not purple).

## 4. Parents vs pack 07 — PRODUCT-GAP (+ tab DEFECT)

**Pack 07:** Parents list, New, Name / Mobile / Student(s) tags.

**Live:**
- `04b-parents-pending.png` — tab “Yêu cầu liên kết”, status “Chờ duyệt”, empty queue.
- `04-parents-all.png` — “Tất cả phụ huynh”, search + Email LMS filter, empty table (“Không có dòng”).

Not a pack parents master list. **DEFECT:** active tab indicator `.astryx-tab-indicator.selected` measured `backgroundColor: rgb(0, 113, 227)` (`#0071E3`) — should be brand purple if matching console OS.

## 5. Users vs pack 34 — PRODUCT-GAP

**Pack 34:** Settings with module icon sidebar, Invite New Users, Languages, Companies.

**Live (`05-users-staff-list.png`):** “Nhân viên” list (SA-001…CMC0004), search, pager `1–5 / 5`. **No Invite, no settings sidebar** — report as intentional product gap, not a missing CSS panel.

Also: `/admin/design` hits ComingSoon (“Đang phát triển”); real showcase is **`/design`** (root `designRoutes`).

## 6. HR / ops (no pack refs) — PRODUCT-GAP

| Route | Shot | What it is | Chrome note |
|---|---|---|---|
| `/hr/shifts` | `06-hr-shifts.png` | Work Schedule tabs “Đăng ký của tôi” / “Hàng chờ” | Active tab Apple-blue underline → DEFECT |
| `/hr/payroll` | `07-hr-payroll.png` | “Bảng lương” employee name list | Sparse CMC screen; not pack |
| `/ops/revenue` | `08-ops-revenue.png` | KPI cards + “Doanh thu theo lớp học” bar | Bar ≈ `#0071E3` (pixel sample heavy) → DEFECT |
| `/ops/recon` | `09-ops-recon.png` | “Đối soát tài chính”, auto-analysis banners, “Không có cảnh báo nào đang mở” | PRODUCT-GAP only |

## 7. Engagement — PRODUCT-GAP

**Live (`12-engagement-rewards.png`):** `/admin/engagement/rewards` → “Yêu cầu đổi quà” empty list. No OpenEduCat pack counterpart in 07/17/21/23/34. Out of visual-clone scope except shared navbar.

## 8. Design showcase — Apple-blue inventory

**Path:** `https://erp.localhost/design` (not `/admin/design`).

| Component | Still Apple-blue `#0071E3`? | Evidence |
|---|---|---|
| CountBadge `is-emphasize` | **YES** — text+border `rgb(0,113,227)`, bg `rgb(232,241,252)` | `10-design-showcase.png` + CDP |
| ProgressSteps / WorkflowStatusbar current `.console-steps-num` | **YES** — current step `2` fill `rgb(0,113,227)` | CDP on live page; showcase copy claims “purple state hierarchy” |
| StatusBadge Đang mở / Chờ / Duyệt | **NO** — success green / warning amber | measured soft-badge tokens |
| StatCard / MetricCard chrome | **NO** hard `#0071E3` fill on card | `10-design-showcase.png` |
| FilterBar / DataTable | **NO** primary blue fill | `10c-design-workflow.png` |

## 9. App switcher / systray vs pack 01 — PARTIAL

**Pack 01:** 9-dot switcher → Odoo app catalog; systray Discuss **8** + Activities **11** + avatar.

**Live (`11-app-switcher.png` + CDP):**
- Navbar `backgroundColor: rgb(113, 99, 158)` (`#71639E`), height **46px** → MATCH pack chrome brand.
- Switcher modules: Tổng quan, Giảng dạy, Lớp & Học sinh, Tài chính & Điều hành, Gắn kết, Nhân sự, Quản trị → CMC product catalog (PRODUCT-GAP vs Odoo apps).
- Systray right: **Tìm (⌘K)**, **Ghi danh**, role pill **Quản trị hệ thống**, **Đăng xuất**.
- `.console-systray-badge` nodes present but **empty / no numeric Discuss badges** → correct (do not fake 8/11). Classify as PARTIAL: brand chrome OK, tray contents are CMC ops tools.

---

## Ruthless cut: what is *not* a defect

- Parents pending-link UX, attendance class wizard, exercises folder library, users-as-staff-list, HR/ops/engagement screens — **product**, not failed pack ports.
- Missing Invite / settings sidebar on `/admin/users` — **product gap** vs pack 34.
- Systray without Discuss counts — **intentional**; faking badges would be wrong.

## Real defects to fix (CSS / token)

1. Schedule: mini-cal absence + today red circle + event color + FC toolbar clutter (vs pack 17).  
2. Global tab indicator `#0071E3` (parents, HR shifts, …).  
3. CountBadge emphasize + ProgressSteps current still `#0071E3` (design showcase proves it).  
4. Ops revenue horizontal bar Apple-blue.

## Method notes

- Auth: existing admin session on `erp.localhost` (credentials from `.env.local-sim-accounts`).  
- Measurements via `cursor-ide-browser` CDP `getComputedStyle`.  
- Viewport mixed 684×922 (tool shots) and 1280×900 (CDP); classifications do not depend on width.
