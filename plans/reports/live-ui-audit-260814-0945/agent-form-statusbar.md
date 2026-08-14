# Live UI audit — form sheet + WorkflowStatusbar + entity header

**Date:** 2026-08-14 ~09:45–10:00 ICT  
**Target:** `https://erp.localhost` (self-signed TLS)  
**Authority:** `design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md` + pack  
`/home/manhquy/Downloads/openeducat-ui-pack/{14,16,18,24}-*.png`  
**Scope:** form sheet + WorkflowStatusbar + entity header only (this agent).  
**Method:** cursor-ide-browser MCP + CDP `Runtime.evaluate` / computed styles / `::before` stroke sampling.  
**No product code changes. No commit.**

---

## Verdict

**Statusbar placement vs pack 14 is fixed and matches the contract:**  
`.console-detail-statusbar` is the **first child of `.console-form-sheet`**, `justify-content: flex-end`, chevrons **33px**, current fill **exact `#e0d9f1` / `rgb(224, 217, 241)`**, inactive **`#f8f9fa` / `rgb(248, 249, 250)`**, silhouette stroke via `::before` **`#dee2e6` / `rgb(222, 226, 230)`** (current stroke **`#71639e` / `rgb(113, 99, 158)`**).

Remaining fidelity gaps are mostly **outside the chevron geometry**: Apple-blue primary CTAs + tab underline (`#0071e3`), sheet pad **14/16px** vs contract **24–32px**, missing pack-style **StatActions** in control-panel chrome, and nested AstrYX cards inside the sheet.

---

## Contract checklist (statusbar)

| Check | Contract | Live (CDP) | Result |
|-------|----------|------------|--------|
| Parent | inside `.console-form-sheet` | `parent.classList` contains `console-form-sheet`; index 0 among sheet children | **PASS** |
| Alignment | right-aligned | `justify-content: flex-end` on `.console-detail-statusbar` and `.console-steps` | **PASS** |
| Height | 33px | `.console-steps-btn` / `.console-workflow-statusbar` / `.console-steps-item` = **33.0px**; outer wrapper sticky ~**45px** (padding/slot) | **PASS** (chevron) |
| Current fill | `#e0d9f1` | `rgb(224, 217, 241)` | **PASS** |
| Inactive fill | gray-100 `#f8f9fa` | `rgb(248, 249, 250)` | **PASS** |
| Stroke | gray-300 on silhouette | `::before` bg `rgb(222, 226, 230)`; current `::before` `rgb(113, 99, 158)` | **PASS** |
| Geometry | chevron clip-path, 4px ends, blunt last | first/middle/last polygons present; caret overlap `margin-left: -12.732px` | **PASS** |
| Text-only | no step numbers | Visible labels only; `.console-steps-num` still in DOM (`✓`/`N`) but **~1px wide**, `aria-hidden` | **PASS visual** / note DOM leftover |
| Not above gray canvas | pack 14 TOP-RIGHT **inside** white sheet | Sheet on canvas `rgb(248, 249, 250)`; statusbar `offsetTop` from sheet ≈ **15px** (= pad-top) | **PASS** |

CSS tokens on `.o_web_client`: `--console-statusbar-current: #e0d9f1`, `--console-gray-100: #f8f9fa`, `--console-gray-300: #dee2e6`, `--console-brand-purple: #71639e`.

Pack 14 PNG check: contiguous Done-chevron band ≈ **33px** tall; lavender cluster near `#e0d9f1` (JPEG anti-alias ≈ `rgb(221,216,234)`…).

---

## Surfaces audited

### 1. `/crm` → first opportunity detail

- **URL:** `/crm/opportunities/5ebec925-958f-4324-8926-79c5015fee57`  
- **Steps:** Tiếp cận → Đã liên hệ → Đặt lịch kiểm tra → **Đã kiểm tra** (current) → Đã ghi danh  
- **Current:** `rgb(224, 217, 241)` · inactive `rgb(248, 249, 250)` · stroke gray-300 / current purple  
- **Sheet pad:** `14px 16px 16px 16px`, radius `4px`, border `1px solid rgb(222, 226, 230)`  
- **Shots:** `crm-opportunity-statusbar-crop.png`, `crm-opportunity-form-sheet.png`  
- **Extra gap:** primary buttons still **Apple blue** `rgb(0, 113, 227)` — e.g. “Tạo phiếu thu”, “Lưu việc tiếp theo”, …

### 2. `/finance` → receipt `SO00007`

- **URL:** `/finance/c9dd0025-5a6d-46be-bc91-7216bdac21b4`  
- **Steps:** Nháp (Draft) → **Đã duyệt** (current lavender) → Đã gửi  
- Same placement / 33px / colors as CRM  
- **Shots:** `finance-receipt-statusbar-crop.png`, `finance-receipt-form.png`  
- **Extra gap:** blue CTAs (“Hoàn tiền”, …); tab “Tổng quan” underline blue (same AstrYX indicator pattern as SIS)

### 3. `/admin/students/:id` — first search hit

- **URL:** `/admin/students/0d3543d4-19ed-4d24-8763-60ea6757d13c`  
- **Steps:** **Đang học** (current) → Khóa LMS → Rút học  
- Statusbar placement/colors/height: **PASS**  
- **Sheet pad:** 14/16 (not 24–32)  
- **StatActions:** no pack-style smart buttons in CP; entity header has secondary “Đổi trạng thái” only (right of title)  
- **Tabs:** `.astryx-tab-indicator.selected` = **`rgb(0, 113, 227)`**, height **2px** — contract wants **purple** `#71639e` underline  
- **Blue CTA:** “Áp dụng” `rgb(0, 113, 227)`; root `--cmc-brand: #0071e3` still live  
- **Shots:** `student-form-statusbar-crop.png`, `student-form-sheet.png`, `student-form-tabs-crop.png`

### 4. `/admin/classes/:id`

- **URL:** `/admin/classes/eece85c8-06e3-4006-9dc4-7fd76209c198`  
- **Steps:** Dự kiến → **Đang mở** (lavender) → Kết thúc  
- Statusbar: **PASS** (same grammar)  
- Tab underline: **`rgb(0, 113, 227)`**  
- Blue CTA above sheet: “Xếp dãy bài”  
- Entity action “Tổng quan lớp” sits in `.console-detail-entity` (not CP StatActions)  
- **Shots:** `class-form-statusbar-crop.png`, `class-form-sheet.png`

### 5. `/teaching/exercises`

- Library empty: “Chưa có bài tập trong thư mục này” — **no detail form / statusbar to measure**.  
- Cannot compare to pack **24-assignments-form.png** on a live record.

---

## Measured RGB / px (representative — CRM opportunity)

| Element | Property | Value |
|---------|----------|-------|
| Canvas (`.console-wrap` / `main`) | background | `rgb(248, 249, 250)` = `#f8f9fa` |
| `.console-form-sheet` | background | `rgb(255, 255, 255)` |
| `.console-form-sheet` | padding | **14 / 16 / 16 / 16** px |
| `.console-form-sheet` | border / radius | `1px solid rgb(222,226,230)` / **4px** |
| `.console-detail-statusbar` | justify / position | `flex-end` / `sticky` |
| `.console-detail-statusbar` | height × width | **45 × ~841** px (full sheet content width slot) |
| `.console-workflow-statusbar` / steps | height | **33** px |
| `.console-steps` | width (content) | ~**472** px (right cluster) |
| Inactive `.console-steps-btn` | background | `rgb(248, 249, 250)` |
| Inactive stroke `::before` | background | `rgb(222, 226, 230)` |
| Current `.console-steps-btn` | background | `rgb(224, 217, 241)` |
| Current stroke `::before` | background | `rgb(113, 99, 158)` |
| Current / inactive text | color | `rgb(33,37,41)` / `rgb(108,117,125)` |
| Chevron overlap | `margin-left` on items 2+ | **-12.732px** |
| Forbidden blue (CTAs / tab ink) | background | `rgb(0, 113, 227)` = `#0071E3` |

Finance / student / class statusbars repeated the same 33px / lavender / gray-100 / gray-300 stroke numbers within measurement noise.

---

## Visual compare to pack 14

| Pack 14 | CMC live |
|---------|----------|
| Statusbar **top-right inside** white sheet | **Match** |
| Right-aligned chevrons, ~33px, text labels | **Match** |
| Current lavender, inactive light gray + gray stroke | **Match** (CMC current stroke purple — acceptable per advise/contract current treatment) |
| Sheet on gray canvas, 4px radius | **Match** radius/border; canvas gray-100 OK |
| Sheet pad generous (~24–32) | **Miss** — live **14/16** |
| Flat label/value fields | CMC still uses **nested cards** inside sheet |
| Smart button (Applications) in form chrome | CMC: **no StatActions**; actions in entity row / above-sheet strip |
| Purple primary / tab ink | CMC still **blue** `#0071E3` for AstrYX primary + tab indicator |

**Conclusion vs earlier advise (`advise-260814-openeducat-statusbar-fidelity.md`):** the “statusbar on gray canvas / full-width white frame” failure mode is **gone**. Remaining work is chrome color (blue→purple), density (pad), and StatActions/entity grammar—not chevron placement.

---

## Remaining fidelity gaps (honest)

1. **`#0071E3` still primary interactive color** under `.o_web_client` for AstrYX buttons and `.astryx-tab-indicator` — contract forbids it; wants `#71639e`.  
2. **Sheet padding 14/16px** vs contract **24–32px**.  
3. **No pack StatActions** (count + icon smart buttons top-right of form chrome / before pager). CMC uses ordinary header buttons inside `.console-detail-entity`.  
4. **Entity/summary strip above the sheet** (SĐT / GIAI ĐOẠN / …) — pack puts meta inside sheet under statusbar; CMC duplicates chrome above the white sheet.  
5. **Inner nested cards** + blue avatar discs — denser / more “component kit” than pack flat sheet.  
6. **`.console-steps-num` DOM leftover** (checks/numbers, visually collapsed) — low risk but not pure text-only markup.  
7. **`/teaching/exercises` empty** — assignment form (pack 24) not verifiable live.  
8. Pack **18** Draft inverted ribbon (dark fill / white text) is explicitly **out of scope** for the lavender contract choice — not scored as a fail.

---

## Evidence files (this folder)

- `crm-opportunity-statusbar-crop.png` / `crm-opportunity-form-sheet.png`  
- `finance-receipt-statusbar-crop.png` / `finance-receipt-form.png`  
- `student-form-statusbar-crop.png` / `student-form-sheet.png` / `student-form-tabs-crop.png`  
- `class-form-statusbar-crop.png` / `class-form-sheet.png`  

---

## Agent note

Dedicated browser tab `d18770` used after shared-tab navigation races. Login was already active as `admin@cmcvn.edu.vn`.
