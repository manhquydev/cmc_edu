# Live UI audit INDEX — OpenEduCat fidelity (2026-08-14)

**Target:** `https://erp.localhost` (local-sim admin image, rebuilt same morning)  
**Viewport:** 1280×900  
**Authority:** `design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md` + pack `/home/manhquy/Downloads/openeducat-ui-pack`  
**Method:** Playwright measure script `scripts/live-openeducat-ui-audit.mjs` + detail follow-up + 3 browser subagents (chrome/list · form/statusbar · ops) + screenshot review  

**Artifacts:** `plans/reports/live-ui-audit-260814-0945/`  
- `report.json` / `report.md` — auto measure (15 list/ops pages)  
- `details-followup.json` — form pages (opportunity / class / receipt)  
- `shots/*.png` — full viewport captures  
- `crm-opportunity-statusbar-crop.png` — ribbon crop  

Automated list pass: **57 findings** (0 critical · **33 P0** · **20 P1** · 4 warn). Detail opener initially skipped empty lists; follow-up filled forms.

---

## Verdict (tình trạng thật)

Chrome **tím Community** đã có. Statusbar chevron **đã vào đúng chỗ pack** (trong sheet, lavender, 33px) trên opportunity / class / receipt.

Phần còn lại của admin **chưa phải OpenEduCat OS**:

1. **Control panel không phải 1 hàng 58px** — đo 89–219px trên hầu hết list (P0 systemic).  
2. **Primary CTA vẫn Apple-blue `#0071E3`** trên New / Tạo / Thêm / Ghi danh / Lưu việc… (P0 systemic).  
3. **Form còn “CMC ops card”** phía trên sheet + pad sheet 14/16 ≠ pack 24–32 (P1).  
4. Nhiều màn pack **không có analogue** (product gap), không phải CSS bug.

Sát pack = chưa. Statusbar là điểm sáng; list OS + nút tím là trần chặn tiếp theo.

---

## MATCH (giữ)

| Surface | Evidence live |
|---|---|
| Navbar | Tím `#71639e` family; cao ~46px trên shots |
| Statusbar geometry (CRM/class/receipt) | `insideSheet=true`, `firstChild=true`, `stepsH=33`, current `rgb(224,217,241)` = `#e0d9f1` |
| Chevron text-only (pixel) | Crop không còn ✓/số; DOM vẫn có sr-only |
| Search pill (một số màn) | Students search pill-shaped |
| CRM pipeline board | Kanban cột O1–O5 (product đúng; không phải SIS grid) |
| Schedule week grid | FullCalendar tuần + now-line đỏ (gần pack 17 một phần) |

---

## DEFECT — ưu tiên theo bằng chứng đo

### P0 — Control panel không phải pack OS

| Page | CP height (px) | Pack |
|---|---:|---|
| classes-list | 219 | ~58 |
| courses-list | 208 | |
| users-list | 208 | |
| finance-list | 208 | |
| audit-log | 204 | |
| hr-payroll | 160 | |
| students-list | 149 | |
| exercises | 149 | |
| crm-pipeline | 142 | |
| schedule | 142 | |
| parents-list | 130 | |
| hr-shifts | 89 | |

**Shot evidence:** `shots/courses-list.png`, `shots/crm-pipeline.png`, `shots/students-list.png` — breadcrumb + title + subtitle + filters **xếp chồng**; ViewSwitcher / New không theo `LEFT New+title | CENTER search | RIGHT pager+views`.

Students list: **không phải bảng pack 03** — empty search gate (“Nhập ≥2 ký tự”), không New, không pager/view switcher kiểu Odoo.

### P0 — Primary vẫn Apple-blue

Đo solid blue fill trên:

| Page | Buttons |
|---|---|
| courses | `+ Tạo khoá` |
| classes | `+ Tạo lớp` |
| users | `Thêm nhân viên`, `Lưu` |
| crm-pipeline | `Thêm cơ hội`, `Ghi danh` (card) |
| finance | `+ Tạo phiếu thu` |
| exercises | `+ Tạo bài tập` (+ text primary khác) |
| hr-shifts | `Soạn phiếu mới` |
| opportunity-detail | `Tạo phiếu thu`, `Lưu việc tiếp theo`, `Thêm ghi chú` |
| class-detail | `Xếp dãy bài` |
| receipt-detail | `Hoàn tiền`, `Ghi hoàn tiền` |

Contract: primary trong `.o_web_client` = `#71639e`. Live vẫn `#0071E3`.

### P0/P1 — Form chrome leftover (dù statusbar đúng)

Từ `details-followup.json` + `crm-opportunity-form-sheet.png`:

- Statusbar **OK** (in-sheet / lavender / 33).  
- Vẫn còn **summary HighlightStrip card** trên canvas trước sheet (pack 14: ribbon trong sheet cạnh action, không card meta 4 cột phía trên).  
- Sheet padding live `14px 16px 16px` — pack ~24–32.  
- CTA form xanh (trên).  
- Design showcase: statusbar **OUT** of sheet (`design` measure).

### P1 — Search / list density lệch token

Confirmed by [chrome+list](bfacf360-e8c3-4e30-833d-0791e6ddec52) → `agent-chrome-list.md` (+ shots `statusbar-*-list*.png`):

- Search shell **28px / r12 / left** (want center **35px / 999** pill).  
- Row height **30–37px** (want ~40); thead gray-100 **MATCH**.  
- Status pills soft pastel (want solid Done `#28a745`/white).  
- Users role chips `rgb(0,116,226)` (want gray many2many).  
- CRM: view switcher present (OK grammar); New/Ghi danh + funnel bars still Apple-blue.  
- SIS students: **no view switcher / no kanban** (pack 02).

### P2 / PRODUCT-GAP (không giả CSS)

Confirmed by [ops+misc](4584d29a-2011-436c-b352-510584a6941d) → `agent-ops-misc.md` (+ shots `shots/ops-misc/`):

| Pack | Live | Class |
|---|---|---|
| 02 SIS kanban photo grid | Students = search gate, không grid thẻ | PRODUCT / DEFECT mix |
| 07 Parents list | `/admin/parents` queue + tabs | PRODUCT-GAP (+ tab `#0071E3` DEFECT) |
| 17 Calendar mini-cal + today circle | Week FC OK; **no mini-cal**; today not red circle; events `rgb(55,136,216)`; FC toolbar thừa | PARTIAL + DEFECT |
| 21 Attendance sheets | `/teaching/attendance` class wizard | PRODUCT-GAP |
| 23 Assignments list | Exercises folder library | PRODUCT-GAP |
| 34 Settings rail + Invite | `/admin/users` staff list | PRODUCT-GAP (expected) |
| 05–06 Faculties, 13 Subjects, 27–28 Library, 29–30 eLearning, 35 Discuss, 36 Apps | Không có màn | MISSING |
| Website 31–33 | Ngoài admin | OUT OF SCOPE |
| Design `/design` | CountBadge + ProgressSteps current còn Apple-blue | DEFECT (gallery) |
| Systray vs 01 | Không fake Discuss 8/11 | MATCH (đúng không giả) |

---

## Statusbar — trạng thái sau fix sáng nay

| Check | Opportunity | Class | Receipt | Student |
|---|---|---|---|---|
| Inside `.console-form-sheet` | yes | yes | yes | yes |
| First child of sheet | yes | yes | yes | yes |
| Height 33 | yes | yes | yes | yes |
| Current `#e0d9f1` | yes | yes | yes | yes |
| Blue CTAs cùng trang | yes | yes | yes | yes (`Áp dụng`) |

⇒ Ribbon **không còn là blocker chính**. Form page vẫn fail pack vì **CTA/tab xanh `#0071E3` + summary card + pad 14/16**.

Confirmed in detail by [form+statusbar](091f4480-ef35-4325-a0de-5c3c4d7d1222): `agent-form-statusbar.md` (also: AstrYX tab underline blue; no StatActions; exercises empty → pack 24 N/A).

---

## Subagents

1. [chrome+list](bfacf360-e8c3-4e30-833d-0791e6ddec52) → **done** `agent-chrome-list.md` (**FAIL** — navbar only MATCH)  
2. [form+statusbar](091f4480-ef35-4325-a0de-5c3c4d7d1222) → **done** `agent-form-statusbar.md`  
3. [ops+misc](4584d29a-2011-436c-b352-510584a6941d) → **done** `agent-ops-misc.md`

**Audit wave complete** — master INDEX + 3 agent reports + Playwright `report.*` / `details-followup.json`.

---

## Việc nên làm tiếp (theo impact)

1. **P0 CP one-row 58px** — list-only slot (đã ghi ở walk 260813; vẫn đúng).  
2. **P0 remap primary** dưới `.o_web_client` → `--console-brand-purple` (New / Tạo / Thêm / primary form).  
3. **P1 form:** bỏ hoặc hạ summary card khỏi form grammar pack; pad sheet 24–32; StatActions lên CP phải nếu muốn sát 14.  
4. **Không** giả Discuss badge / Settings sidebar / SIS photo nếu chưa có product.

## Success metrics (khi nào gọi là sát hơn)

- [ ] ≥8 list pages: CP height ∈ 54–62px  
- [ ] 0 solid `#0071E3` buttons under `.o_web_client` trên smoke walk  
- [ ] Search list: height 35±3, radius ≥999 hoặc pill  
- [ ] Form CRM/class/receipt: statusbar in-sheet + lavender (đã đạt)  
- [ ] Side-by-side 1280 crop vs pack `03` / `14` “arm’s length” pass

---

*Generated 2026-08-14 from live local-sim. Numbers from `report.json` + `details-followup.json`.*
