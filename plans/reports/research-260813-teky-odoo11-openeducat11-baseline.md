# Research: hệ nền tảng người dùng TEKY (Odoo 11 + OpenEduCat 11) — baseline UX cho CMC EDU v2

Ngày: 2026-08-13 · Loại: research (đọc mã nguồn + xác minh nguồn công khai) · Người dùng đích: quyết định ưu tiên UX cho `cmc_edu`

## TL;DR (kết luận hành động)

1. **Giả thiết TEKY = ĐÚNG và xác minh được bằng nguồn công khai [DOC]**. `https://erp.teky.edu.vn/website/info` (fetch 2026-08-13) khai báo: *"1. TEKY Cầu Giấy - HN **Odoo Version 11.0**"*, installed apps gồm `OpenEduCat Core` + **`OpenEduCat Core Enterprise`**, `OpenEduCat Admission` + **`OpenEduCat Admission Enterprise`**, **`CRM`**, cùng ~20 module tự viết/mua (`Teky Customize`, `Admission Claim Management`, `KPI performance`, `Meta Ads Sync`, `EESTISOFT - columns toggles`, `Student Badges and Rewards`…). Bài tuyển dụng VietnamWorks InTECH nói rõ *"ERP - Quản trị doanh nghiệp. Nền tảng được xây dựng dựa trên **Odoo 11**. Sử dụng bởi gần 1.000 nhân sự TEKY"*.
2. **Người dùng TEKY quen CRM lead/kanban thật** (module `CRM` của Odoo 11 được cài) — không phải quen OpenEduCat admission. Kanban kéo-thả theo `stage_id`, activity có màu theo hạn, đồng hồ systray: **tất cả đều đã có ở Odoo 11** ⇒ đây là các pattern **bắt buộc phải có**, không phải "nice to have".
3. **Luồng "thu tiền rồi mới thành học sinh" KHÔNG tồn tại ở OpenEduCat 11 Community** — nó chết từ **10.0** (không phải giữa 13→18 như issue #1054 đoán). Ở 9.0 nó chạy được và hiển thị trên statusbar. Ở 11.0 `create_invoice()`/`payment_process()` là dead code y như 18.0. Ngược lại, `openeducat_fees` 11.0 có luồng **ngược**: enroll trước → sinh `op.student.fees.details` → bấm *Create Invoice* từng dòng học phí. ⇒ **Thói quen gốc của họ có thể là "ghi danh trước, xuất hoá đơn sau"**, trái chiều với cổng chặn của `cmc_edu`. Phải hỏi lại, đừng suy ra từ upstream.
4. **Cột ẩn/hiện: giả thiết ban đầu SAI ngược**. Odoo 11 core không có `optional="show|hide"` (vào core ở **13.0**), nhưng TEKY **đã cài module bên thứ ba `EESTISOFT - columns toggles`** ("toggle visibility of columns for every treeview") ⇒ họ **có** quen ẩn/hiện cột. Đừng hạ ưu tiên.
5. Những gì họ **chưa từng thấy** ở Odoo 11: search panel bên trái (13.0), sửa nhiều dòng trực tiếp trên list (13.0), `widget="badge"` (12.0), Activity view dạng lưới (12.0), thẻ `<list>` + Bootstrap 4/5 và toàn bộ ngôn ngữ hình ảnh Odoo 17/18. ⇒ giới thiệu như tính năng mới, không giả định.

---

## Phương pháp & nguồn đã đọc (kiểm lại được)

| Nguồn | Chi tiết |
|---|---|
| `openeducat/openeducat_erp` | clone `--depth 1 --branch 11.0`, HEAD `2cb4f5f` (2021-06-24). Fetch thêm `origin/9.0, 10.0, 12.0, 13.0, 14.0, 18.0` để diff. |
| `odoo/odoo` | sparse clone `--branch 11.0`, HEAD `d07ffce` (2024-01-26), paths `addons/{crm,mail,web,base_setup}`. |
| raw.githubusercontent | probe tồn tại file theo nhánh 10.0/11.0/12.0/13.0/14.0 (mail_activity, activity_view, search_panel, list_renderer, field_registry). |
| `erp.teky.edu.vn` | GET `/website/info` + `/` (chỉ đọc, không đăng nhập, không quét). |
| VietnamWorks InTECH | bài giới thiệu TEKY Holdings (tuyển dụng). |

Nhãn: **[CODE]** đọc được trong mã nguồn · **[DOC]** trang/tài liệu chính thức · **[SUY LUẬN]** · **[KHÔNG NGUỒN]**.

---

## 1. Xác minh giả thiết TEKY — ĐÃ XÁC MINH

**[DOC] `https://erp.teky.edu.vn/website/info`** — trang "Odoo Information" mặc định của Odoo, public, fetch 2026-08-13:

- Tiêu đề DB: `1. TEKY Cầu Giấy - HN` — **Odoo Version 11.0**. Việc đặt tên "1." gợi ý nhiều DB/nhiều cơ sở [SUY LUẬN].
- **Installed Applications (nguyên văn, nhóm lại):**
  - OpenEduCat Community: `Core, Activity, Admission, Assignment, Attendance, Classroom, ERP, Exam, Facility, Fees, Library, Parent, Timetable`
  - OpenEduCat **Enterprise (mua thêm)**: `OpenEduCat Core Enterprise`, `OpenEduCat Admission Enterprise`
  - Odoo core apps: `CRM (Leads, Opportunities, Activities)`, `Sales, Invoicing, Inventory, Project, Timesheets, Discuss, Calendar, Survey, Email Marketing, Slides, Online Events, Live Chat, Website Builder, Contacts, Employee Directory, Recruitment, Attendances, Leave Management, Expense Tracker, Dashboards, Asset Management, Notes/Productivity`
  - **Tự viết / mua ngoài**: `Teky Customize`, `VietNam Translate`, `Admission Claim Management`, `KPI performance`, `Student Badges and Rewards`, `Teky Holiday Calendar`, `hr_holidays_approve`, `Hr Attendance Extend`, `Automatic Overtime Calculation`, `Get CV From mail`, `Meta Ads Sync (Facebook/Instagram ads via Graph API)`, `EESTISOFT - columns toggles`, `MuK Documents`, `Knowledge Management System`, `Odoo Popup Message`, `Import Product Variant from CSV/Excel`, `Cache`, `NewRelic Instrumentation`, `Instantia Theme (Theme for V12)`
- **[CODE/DOC]** Trang chủ `https://erp.teky.edu.vn/` là template homepage mặc định của `openeducat_core` (footer trỏ github.com/openeducat, twitter/facebook OpenEduCat) + **một link gadget 3CX click-to-call** (`gadget.3cx.vn/webclient/#/call?phone=…`) ⇒ có tích hợp tổng đài, khớp vai trò "Tư vấn tuyển sinh" trong tin tuyển dụng.
- **[DOC]** VietnamWorks InTECH: *"ERP - Quản trị doanh nghiệp. Nền tảng được xây dựng dựa trên Odoo 11. Sử dụng bởi gần 1.000 nhân sự TEKY trên toàn quốc"*; các phòng ban gồm "Tư vấn tuyển sinh, Chăm sóc khách hàng, Vận hành lớp học".

**Kết luận:** chủ dự án nhớ chính xác. Nhưng khác một điểm quan trọng so với nghiên cứu trước: **hệ TEKY không phải Community thuần** — có Enterprise modules + CRM Odoo + ~19 module tự phát triển.

**Chưa xác minh:** nội dung `OpenEduCat *_Enterprise` 11.0 (mã đóng, không public) [KHÔNG NGUỒN]; hệ có còn được dùng vận hành hôm nay hay chỉ còn tồn tại [KHÔNG NGUỒN]; các cơ sở khác dùng cùng bản không [KHÔNG NGUỒN].

---

## 2. OpenEduCat `openeducat_admission`: 11.0 vs 18.0 (phần quan trọng nhất)

### 2.1 State — **giống hệt 18.0**, và regression xảy ra ở 10.0

**[CODE]** `openeducat_admission/models/admission.py`, `state = fields.Selection`:

| Nhánh | Danh sách state |
|---|---|
| **9.0** | `draft, confirm, **payment_process**, **fees_paid**, reject, pending, cancel, done` |
| **10.0 → 11.0 → 12.0 → 13.0 → 14.0 → 18.0** | `draft, submit, confirm, admission, reject, pending, cancel, done` (8 state, không đổi) |

Không nhánh nào có state `online`. Ở 11.0 chỉ còn **dấu vết hoá thạch**: `batch_id` vẫn khai `states={... 'fees_paid': [('required', True)]}` (admission.py:64-68) — trường required cho một state không còn tồn tại.

### 2.2 `create_invoice()` / `payment_process()` — **dead code ở 11.0**, chỉ sống ở 9.0

**[CODE]** grep toàn repo nhánh 11.0: `create_invoice` và `payment_process` chỉ xuất hiện trong `models/admission.py`, **không có XML nào tham chiếu** ⇒ không nút nào gọi được. `payment_process()` gán `'fees_paid'`, `create_invoice()` gán `'payment_process'` — cả hai không có trong Selection ⇒ nếu gọi được cũng lỗi.

**[CODE]** So sánh header button theo nhánh (`views/admission_view.xml`):

- **9.0 — LUỒNG THU PHÍ CHẠY THẬT:**
  ```xml
  <button name="confirm_in_progress" states="draft"           string="Confirm"/>
  <button name="create_invoice"      states="confirm"         string="Create Invoice"/>
  <button name="payment_process"     states="payment_process" string="Processed"/>
  <button name="enroll_student"      states="fees_paid,pending" string="Enroll"/>
  <field name="state" widget="statusbar"
         statusbar_visible="draft,confirm,payment_process,fees_paid,done"/>
  ```
  ⇒ `confirm → Create Invoice → payment_process → Processed → fees_paid → Enroll → done`. **Statusbar hiển thị cả payment_process và fees_paid** ⇒ người dùng 9.0 thấy rõ "chưa trả tiền thì chưa Enroll".
- **10.0 — bị cắt:** đổi sang `Submit → Confirm → Admission Confirm → Enroll`, bỏ nút Create Invoice/Processed, nhưng **để lại rác**: `<button name="confirm_rejected" states="payment_process,fees_paid,,pending">` và `<button name="confirm_pending" states="fees_paid">` (chuỗi state đã bị xoá, cả dấu `,,` lỗi) ⇒ 2 nút này **không bao giờ hiện**.
- **11.0 → 14.0:** vá lại state string thành `states="confirm,confirm_pending"` — `confirm_pending` **cũng không phải state hợp lệ** ⇒ nút Reject ở 11.0 chỉ hiện ở `confirm`. Nút Pending chỉ ở `submit`.
- **18.0:** cùng bộ nút, đổi sang cú pháp `invisible="state != '…'"`.

**⇒ Sửa lại kết luận cũ:** issue #1054 nói "lập hoá đơn lúc admission có ở 13.0 rồi mất ở 18.0" — **[CODE] sai với Community**. Nó mất ở **10.0** (khoảng 2016-2017). Người báo lỗi hoặc đang dùng Enterprise, hoặc fork tự vá, hoặc nhớ sai phiên bản.

### 2.3 Statusbar & kanban

**[CODE] 11.0:** `statusbar_visible="draft,confirm,done"` ⇒ **ẩn 5/8 state** (submit, admission, reject, pending, cancel) — còn tệ hơn 18.0 về tính minh bạch trạng thái. Không có `clickable="1"` ⇒ statusbar chỉ để xem. (Odoo 11 core **có** hỗ trợ thuộc tính `clickable`: `addons/web/static/src/js/fields/relational_fields.js:2059` — chỉ là OpenEduCat không dùng.)

**[CODE] 11.0:** `view_mode = tree,form,graph,pivot` — **không có kanban view cho `op.admission`**, **không có `stage_id`**, **không có model `op.admission.stage`** (grep `stage_id` toàn repo 11.0 = 0 kết quả). Kanban ở 11.0 chỉ có cho `op.student`, `op.faculty`, `op.timetable`.

### 2.4 Cổng đăng ký online / controllers

**[CODE] 11.0:** `openeducat_admission/` **không có `controllers/`**. Toàn repo chỉ có 2 controller: `openeducat_core/controllers/app_main.py` (49 dòng — chỉ override `web_login` để redirect parent → `/my/child`, student → `/my/home`) và `openeducat_attendance/controllers/app_main.py`. **Không có module `openeducat_admission_online`** ở bất kỳ nhánh Community nào. ⇒ Community 11 chỉ có **portal đăng nhập** cho phụ huynh/học sinh, **không có form đăng ký công khai**.

### 2.5 Module Community theo nhánh — CRM chưa từng có trong Community

**[CODE]** `git ls-tree origin/<branch>`:

| Nhánh | Module |
|---|---|
| 9.0 | 21 module: có thêm `achievement, alumni, health, hostel, placement, scholarship, transportation, l10n_in, l10n_in_admission, enterprise_support` |
| 10.0 / 11.0 | 14 module (`activity, admission, assignment, attendance, classroom, core, erp, exam, facility, fees, library, parent, support, timetable`) + `web_openeducat` |
| 12.0 / 13.0 / 14.0 | như 11.0 nhưng **mất `openeducat_support`** |
| 18.0 | như 14.0, `web_openeducat` → `theme_web_openeducat` |

**[CODE]** grep `crm|lead|enquiry` toàn repo 11.0: chỉ khớp ngẫu nhiên (`homepage_template.xml` link marketing odoo.com/page/crm; `library.py`) ⇒ **không có module CRM/lead/enquiry trong Community 11.0**. Nhận định "CRM là Enterprise-only" giữ nguyên [CODE + DOC openeducat.org/compare-editions]. Đợt cắt lớn xảy ra **9.0 → 10.0** (7 domain chuyển sang Enterprise), không phải gần đây.

### 2.6 Luồng học phí THẬT ở 11.0 nằm ở `openeducat_fees`, và nó ngược chiều

**[CODE]** `openeducat_fees/models/student.py`: `op.student.fees.details` có `invoice_id → account.invoice`, `state = draft|invoice|cancel`, `get_invoice()` **chạy được** và `views/student_view.xml` **có nút thật**: `Create Invoice` (states=`draft`) và `View Invoice` (states=`invoice`), cùng smart button `oe_stat_button` + `widget="statinfo"` hiển thị `total_invoiced`.

**[CODE]** `admission.py::enroll_student()` (11.0): chỉ kiểm `register_id.max_count`; tạo `res.users` (portal) → `op.student` → nạp `fees_detail_ids` từ `fees_term_id` → `state='done'` → tạo `op.subject.registration`. **Không có kiểm tra thanh toán nào.**

⇒ **Trình tự upstream 11.0 = Enroll trước → hoá đơn học phí sau (từng kỳ)**. Đây là điều trái ngược trực tiếp với `cmc_edu` (học sinh chỉ sinh sau khi phiếu thu được duyệt). Không được giả định người dùng "đã quen bị chặn".

---

## 3. Odoo 11 core — người dùng TEKY thực sự quen gì

Tất cả xác minh trên `odoo/odoo@11.0` HEAD `d07ffce`.

| Câu hỏi | Trả lời | Bằng chứng |
|---|---|---|
| `mail.activity` có từ phiên bản nào? | **11.0 — đúng như phỏng đoán.** `addons/mail/models/mail_activity.py` tồn tại ở 11.0 (HTTP 200), **404 ở 10.0** | [CODE] |
| Activity mã màu theo hạn? | **CÓ ở 11.0.** `mail.activity.state = overdue/today/planned` compute từ `date_deadline` (mail_activity.py:88-130); template `activity.xml:21` render `bg-success/warning/danger-full` + class `o_activity_color_#{state}` ⇒ **xanh / cam / đỏ** | [CODE] |
| Chỗ gom activity toàn hệ thống (đồng hồ navbar)? | **CÓ ở 11.0.** `addons/mail/static/src/js/systray.js:153` "Menu item appended in the systray part of the navbar, redirects to the next activities of all app"; `systray.xml` có bộ đếm **Late / Today / Future** kèm nút lọc | [CODE] |
| Chatter ở 11 đủ chưa? | **Đủ.** `chatter.xml:53-60`: **Send message**, **Log note** ("Followers will not be notified"), **Schedule activity** (icon `fa-clock-o`); có `mail_followers`, `mail_thread`, tracking qua `track_visibility='onchange'` (chính `op.admission.state` ở 11.0 dùng nó) | [CODE] |
| `crm.lead` có `stage_id` + kanban kéo-thả? | **CÓ.** `crm_lead.py:92` `stage_id` (`track_visibility='onchange'`, `group_expand='_read_group_stage_ids'` ⇒ cột rỗng vẫn hiện); `crm_lead_views.xml:300` `<kanban default_group_by="stage_id" …>`. Stage mặc định: **New(10%) → Qualified(30%) → Proposition(70%) → Won(100%)** | [CODE] |
| `kanban_state` xám/đỏ/xanh? | **CÓ nhưng KHÁC bản chất**: ở 11.0 CRM nó là **compute, read-only**, suy ra từ hạn activity kế tiếp — `('grey','No next activity planned'), ('red','Next activity late'), ('green','Next activity is planned')` (crm_lead.py:74, `_compute_kanban_state`). **Người dùng KHÔNG tự bấm đặt màu** trên lead. (Trên các model khác như project.task thì `kanban_state` là chọn tay.) | [CODE] |
| `source_id`/`medium_id`/`campaign_id`? | **CÓ**, qua `utm.mixin` (`crm_lead.py:53 _inherit=[… 'utm.mixin' …]`, và có trong `PARTNER_FIELDS`-style list dòng 20-27). TEKY còn cài `Meta Ads Sync` ⇒ họ **thực sự dùng** nguồn lead từ Facebook/Instagram | [CODE] + [DOC] |
| Bộ lọc yêu thích? | **CÓ ở 11.0**: `addons/web/static/src/xml/base.xml:1152-1161` — **"Save current search"**, **"Use by default"**, **"Share with all users"** | [CODE] |
| Smart buttons? | **CÓ**: `field_registry.js:50 .add('statinfo', basic_fields.StatInfo)`; `oe_stat_button` dùng thật trong OpenEduCat 11 (`openeducat_fees/views/student_view.xml:11-15`) | [CODE] |
| Cột ẩn/hiện `optional="show|hide"`? | **KHÔNG có ở 11.0 và 12.0; vào core từ 13.0** (grep "optional" trong `list_renderer.js`: 11.0=0, 12.0=0, **13.0=34**, 14.0=35). **NHƯNG** TEKY cài `EESTISOFT - columns toggles` ⇒ họ **vẫn quen ẩn/hiện cột** | [CODE] + [DOC] |
| `<tree>` vs `<list>`; `decoration-*`; `widget="badge"` | Ở 11.0 thẻ là `<tree>`. `decoration-*` **có** (`list_renderer.js:15-19`: `decoration-bf/it/danger/...`; CRM dùng `decoration-bf="message_needaction==True" decoration-muted="probability == 100"`). **`widget="badge"` KHÔNG có ở 11.0** (grep field_registry: 11.0=0, **12.0=1**) | [CODE] |

### Khác biệt giao diện 11 vs 17/18 mà người dùng sẽ thấy lạ

**[CODE] chỉ có ở 12.0+ / 13.0+ (họ chưa từng thấy):**
- **Search panel** cột trái (lọc theo danh mục): `web/static/src/js/views/search_panel.js` — 404 ở 12.0, **200 ở 13.0**.
- **Sửa nhiều dòng cùng lúc trên list** (multi-edit): grep `multi_edit` ở 11.0 = 0 (vào core ở 13.0).
- **Activity view** (lưới activity theo model): `mail/static/src/js/views/activity/activity_view.js` — 404 ở 11.0, **200 ở 12.0**.
- **Bootstrap**: 11.0 còn **Bootstrap 3 + LESS** (`webclient_templates.xml` nạp `lib/bootstrap/less/…`); Odoo 12 chuyển BS4/SCSS, 17/18 khác hẳn về spacing, control panel, breadcrumb, nút, form sheet.
- `view_type: 'form'/'tree'` trong `ir.actions.act_window` (khái niệm cũ ở 11.0, `action_manager.js:580`) — biến mất ở bản mới; ở 18.0 `view_mode` viết `list,form,…`.

**[SUY LUẬN] cảnh báo quan trọng:** DB TEKY có cài **`Instantia Theme — "Theme for V12"`** trên Odoo 11 ⇒ backend của họ **có thể không giống Odoo 11 gốc**. Không được suy diễn "màn hình họ quen" chỉ từ ảnh chụp Odoo 11 stock.

---

## 4. "TEKY tự phát triển thêm" — rủi ro nhận thức & câu hỏi phải hỏi

Cơ sở thực tế [DOC]: danh sách app cho thấy ít nhất 19 module ngoài upstream, gồm `Teky Customize` (túi rác vạn năng), `Admission Claim Management`, `KPI performance`, `Student Badges and Rewards`, `Get CV From mail`, `Meta Ads Sync`, `Odoo Popup Message`, `EESTISOFT columns toggles`, `Hr Attendance Extend`, `Automatic Overtime Calculation`, `Teky Holiday Calendar`, `hr_holidays_approve`, `MuK Documents`, `Knowledge Management System`.

**[SUY LUẬN] Những thói quen gần như chắc chắn là "đồ tự làm" — CMC KHÔNG suy được từ upstream:**

1. Luồng lead → tư vấn → học thử → ghi danh (upstream 11 không có state học thử/phỏng vấn/thi đầu vào; nhưng họ có CRM + `Admission Claim Management` + 3CX).
2. Việc chặn/không chặn thanh toán trước khi thành học sinh (upstream 11 **không chặn**).
3. Ai được chuyển state nào (quyền/nhóm), vì `header groups="base.group_user"` upstream để rất lỏng.
4. Popup xác nhận/nhắc lỗi (`Odoo Popup Message`) — họ có thể quen "hệ thống bật hộp thoại cảnh báo" ở các bước nghiệp vụ.
5. KPI/điểm thưởng học viên (`KPI performance`, `Student Badges and Rewards`) — hoàn toàn custom.
6. Báo cáo/xuất Excel, mẫu in phiếu thu — thường là custom, và là thứ nhân viên gắn bó nhất.
7. Bố cục list mặc định (cột nào hiện) — họ có module toggle cột, nên **mỗi người có bố cục riêng**.

**Câu hỏi cụ thể nên hỏi chủ dự án / nhân sự cũ TEKY (xếp theo giá trị quyết định thiết kế):**

1. Trước khi một người trở thành học sinh trong hệ TEKY, hệ thống **có chặn** cho đến khi có phiếu thu/hoá đơn được xác nhận không, hay ghi danh trước rồi mới xuất hoá đơn học phí từng kỳ?
2. Đăng ký/tuyển sinh bắt đầu ở đâu: tạo **CRM Lead** rồi mới sang Admission, hay tạo Admission trực tiếp? Ai tạo (telesales/tư vấn hay lễ tân)?
3. Danh sách **stage CRM thực tế** của họ là gì (thay cho New/Qualified/Proposition/Won mặc định)? Có stage "học thử" không, và học thử được ghi ở CRM hay ở module khác?
4. Cách họ bàn giao việc: dùng **Schedule Activity** + đồng hồ navbar, hay dùng Excel/Zalo ngoài hệ thống?
5. Màn hình nào **họ mở đầu ngày** (list nào, filter nào đã lưu làm mặc định)?
6. `Admission Claim Management` giải quyết nghiệp vụ gì — khiếu nại học phí, chuyển lớp, hoàn tiền?
7. Có form đăng ký online cho phụ huynh không (website TEKY → tạo lead/admission tự động)? `Meta Ads Sync` đổ lead vào đâu?
8. Phụ huynh/học sinh có thực sự đăng nhập portal (`/my/child`) không, hay chỉ nhân viên dùng hệ thống?
9. Báo cáo nào bắt buộc phải có (mẫu in, file Excel) — liệt kê tên file họ hay xuất.
10. Backend họ thấy là Odoo 11 gốc hay đã theme lại (`Instantia Theme`)? Xin ảnh chụp màn hình thật nếu có.

---

## 5. Kết luận hành động cho CMC EDU v2 (xếp hạng)

### A. Người dùng gốc-Odoo-11 THỰC SỰ phụ thuộc → làm trước, đừng đổi ngữ nghĩa

1. **Chatter đủ 3 hành động**: Send message / **Log note** / **Schedule activity**, + Followers, + log tự động khi trạng thái đổi. [CODE] có ở 11.0, và `op.admission` 11.0 bật `track_visibility='onchange'` cho `state`.
2. **Activity có hạn + mã màu 3 mức (quá hạn đỏ / hôm nay cam / tương lai xanh)** và **một chỗ gom toàn hệ thống** với 3 nhóm **Late / Today / Future**. [CODE] có ở 11.0 (systray). Đây là "hộp thư việc" của họ.
3. **Kanban theo stage, kéo-thả, cột rỗng vẫn hiện** (`group_expand`) cho luồng dạng phễu (tuyển sinh/lead). [CODE] họ dùng CRM Odoo 11 thật.
4. **Bộ lọc yêu thích**: lưu bộ lọc hiện tại + **đặt làm mặc định** + **chia sẻ toàn bộ user**. [CODE] có ở 11.0. Rẻ và họ dùng hàng ngày.
5. **Smart button đếm số** (`statinfo`) trên form để nhảy sang bản ghi liên quan. [CODE] có ở 11.0 và OpenEduCat 11 dùng ngay trên form học sinh.
6. **Ẩn/hiện cột trên list, ghi nhớ theo người dùng**. [DOC] họ cài module riêng chỉ để có tính năng này ⇒ nhu cầu đã được chứng minh bằng tiền.
7. **Group by + pivot/graph ngay trên cùng một action** (11.0 admission đã có `graph,pivot`). Họ quen phân tích tại chỗ, không cần BI riêng.
8. **Nguồn lead (source/medium/campaign)** — [CODE] `utm.mixin` ở 11.0 + [DOC] `Meta Ads Sync` ⇒ nếu CMC có phễu tuyển sinh mà thiếu trường nguồn, đó là bước lùi so với hệ cũ của họ.

### B. Họ CHƯA từng thấy ở Odoo 11 → hạ ưu tiên hoặc phải onboarding như tính năng mới

1. **Search panel cột trái** (13.0) — đừng coi là "chuẩn Odoo mà ai cũng biết".
2. **Sửa nhiều dòng trực tiếp trên list / bulk inline edit** (13.0) — mạnh nhưng lạ; cần xác nhận rõ ràng khi lưu.
3. **Activity view dạng lưới** (12.0) — bỏ qua được, giá trị thấp so với systray + chatter.
4. **`widget="badge"`** (12.0) và ngôn ngữ hình ảnh badge/pill của Odoo 17/18 — vô hại, nhưng đừng dựa vào badge để truyền tải trạng thái mà không có nhãn chữ.
5. **`kanban_state` bấm tay (xám/đỏ/xanh)** — trên CRM 11 nó là **read-only compute từ hạn activity**. Nếu CMC làm nút bấm tay, phải giải thích; nếu làm auto-suy-từ-hạn thì **đúng cái họ quen**. (Ưu tiên: auto.)
6. Toàn bộ chrome Odoo 17/18 (control panel, breadcrumb, spacing BS5) — họ đến từ Bootstrap 3 (có thể qua theme lạ). Cần một buổi walkthrough, không phải tự khám phá.

### C. Điểm yếu của Odoo 11 / OpenEduCat 11 — **đừng bắt chước**

1. **Statusbar ẩn quá nửa trạng thái** (`statusbar_visible="draft,confirm,done"` trong khi có 8 state) và **không click được** ⇒ người dùng không biết mình đang ở đâu, không biết bước tiếp theo. CMC nên hiện đủ trạng thái có nghĩa nghiệp vụ, hoặc hiện rõ hành động kế tiếp.
2. **Hành động nằm rải ở header với điều kiện state sai** (11.0 có nút Reject với `states="confirm,confirm_pending"` — `confirm_pending` không tồn tại; 10.0 còn `states="payment_process,fees_paid,,pending"` với `,,`) ⇒ nút biến mất một cách bí ẩn. CMC: điều kiện hiện nút phải test được, và nên có test chặn.
3. **Dead code nghiệp vụ tồn tại nhiều năm** (`create_invoice`/`payment_process` từ 10.0 đến 18.0, gán state không tồn tại) ⇒ đừng để đường nghiệp vụ chết trong `cmc_edu`; nếu bỏ luồng thì bỏ cả code.
4. **`enroll_student()` không kiểm gì ngoài `max_count`** — tạo `res.users` với `login = email` (không kiểm trùng/không kiểm rỗng), tạo học sinh, tạo đăng ký môn, đều trong một cú bấm không thể hoàn tác qua UI. CMC đúng khi chặn bằng phiếu thu — nhưng **phải coi đây là thay đổi hành vi cần đào tạo**, không phải "họ đã quen".
5. **Không có nguồn lead/không có phễu trong admission** (không `stage_id`, không kanban) ⇒ nếu người dùng TEKY quen phễu, họ quen từ **CRM Odoo**, không từ OpenEduCat. Muốn tái tạo trải nghiệm, hãy nhìn `crm.lead` 11.0 làm mẫu, **không** nhìn `op.admission`.
6. **Cảnh báo nguồn (giữ nguyên):** `newdocs.openeducat.org` mô tả sai so với code. Bổ sung: **issue GitHub cũng sai** — #1054 nói mất tính năng ở 18.0, thực tế mất ở **10.0**. Chỉ tin mã nguồn theo nhánh.

---

## Câu hỏi còn treo (chưa xác minh được)

1. `OpenEduCat Core/Admission Enterprise` **11.0** thêm chính xác những gì? Mã đóng, không public ⇒ [KHÔNG NGUỒN]. Đây là lỗ hổng lớn nhất: rất có thể luồng hoá đơn-trước-ghi-danh và/hoặc form đăng ký online của TEKY đến từ đây.
2. Instance `erp.teky.edu.vn` hiện còn vận hành thật hay chỉ còn sống? Có bao nhiêu DB/cơ sở? [KHÔNG NGUỒN]
3. TEKY dùng CRM Odoo cho tuyển sinh hay cho B2B (hợp tác trường)? [KHÔNG NGUỒN] — phải hỏi.
4. Backend họ dùng là Odoo 11 gốc hay đã theme (`Instantia Theme "for V12"`)? [KHÔNG NGUỒN] — cần ảnh chụp.
5. `Admission Claim Management` là module mua hay tự viết, xử lý nghiệp vụ gì? [KHÔNG NGUỒN]
6. Có bản OpenEduCat 11 **fork nội bộ** không (rất có thể, do `Teky Customize`)? Nếu có, mọi suy luận từ upstream 11.0 chỉ là xấp xỉ. [SUY LUẬN]

## Nguồn

- Mã nguồn: `github.com/openeducat/openeducat_erp` nhánh `9.0, 10.0, **11.0 (HEAD 2cb4f5f)**, 12.0, 13.0, 14.0, 18.0`
- Mã nguồn: `github.com/odoo/odoo` nhánh `11.0 (HEAD d07ffce)`, probe nhánh `10.0, 12.0, 13.0, 14.0`
- `https://erp.teky.edu.vn/website/info` và `https://erp.teky.edu.vn/` (fetch 2026-08-13, chỉ đọc)
- `https://intech.vietnamworks.com/article/teky-holdings-moi-truong-giao-duc-xanh-cho-nhan-tai-cong-nghe`
- `https://openeducat.org/compare-editions/` (CRM/LMS = Enterprise-only)
