# Báo cáo BA — tình trạng đã triển khai & phạm vi UI/tái cấu trúc tiếp theo

**Ngày:** 2026-08-11  
**Đối tượng:** chủ dự án / điều phối vận hành  
**Nguồn đối chiếu:** quy tắc resource-centric đã chốt · nghiệp vụ HR/tài chính đã khóa · 4 ảnh tham chiếu vận hành TEKY/Odoo · tư vấn độc lập (advise)  
**Không dùng làm:** đặc tả kỹ thuật chi tiết hay changelog commit  

---

## 1. Mục tiêu báo cáo

1. Diễn đạt **phần việc đã làm** bằng ngôn ngữ nghiệp vụ.  
2. **Đối soát** kết quả với quy tắc đã chốt (tránh “làm xong nhưng lệch luật”).  
3. Đọc **4 màn hình tham chiếu** (chấm công / phiếu bù / bảng công / KPI) để chốt **học gì – không học gì**.  
4. Đề xuất **phạm vi song song**: tái cấu trúc IA + đồng bộ giao diện Console (impeccable), không mở domain mới.

---

## 2. Hợp đồng định hướng (brainstorm)

| Trường | Nội dung |
|--------|----------|
| **Kết quả mong muốn** | Nhân sự & tài chính vận hành theo **một chứng từ – một danh sách – một form**; giao diện dày đặc, quen tay Odoo **nhưng** vẫn đúng luật CMC; design system Console thống nhất. |
| **Ràng buộc** | Không tạo app “Duyệt …” theo vai; không clone kanban TEKY nếu phá luật chấm công/lương; Console đã chốt (không đổi sang skin teal TEKY); CI bắt buộc trước khi gọi “xong”. |
| **Ngoài phạm vi đợt này** | Chatter đầy đủ kiểu Odoo; product KPI/attendance mới; payroll form-depth; Search OS; copy nguyên module Attendance TEKY. |
| **Tiêu chí chấp nhận đợt kế** | (A) PR form-depth đã gộp / CI xanh; (B) ma trận đối soát nghiệp vụ không “lệch luật”; (C) 3 màn HR pilot (chấm công · ca · KPI) cùng khung List/Form Console; (D) không thêm nav role-product. |

---

## 3. Phần việc đã triển khai — diễn giải nghiệp vụ

### 3.1 Nguyên tắc tổ chức màn hình (đã khóa)

- Một loại chứng từ = một mục menu + một danh sách + form mở bằng mã chứng từ (chia sẻ link được).  
- Vai trò chỉ quyết định **ai thấy hàng nào** và **nút nào được bấm** — không tạo màn “Duyệt KPI / Duyệt ca” riêng như sản phẩm thứ hai.  
- Hệ màu/layout admin = **CMC Console** (học ngữ pháp Odoo, không fork giao diện TEKY).

### 3.2 Nhân sự — ca làm việc

| Nghiệp vụ | Trạng thái vận hành | Ghi chú BA |
|-----------|---------------------|------------|
| Nhân viên soạn / nộp đăng ký ca | Có form + deep link | Form là nơi làm việc chính |
| Quản lý duyệt / từ chối | Làm trên form; danh sách inbox chỉ **mở phiếu** | Đã gỡ nút duyệt hàng loạt trên list (chống hai nơi quyết định) |
| Chia sẻ link phiếu ca | Có | Phù hợp HITL qua chat/email |

### 3.3 Nhân sự — KPI

| Nghiệp vụ | Trạng thái vận hành | Ghi chú BA |
|-----------|---------------------|------------|
| Một bảng KPI chung cho mọi vai | Có | Lọc kỳ / trạng thái; không menu “Duyệt KPI” |
| Xác nhận quản lý trực tiếp | Có (nút chỉ hiện khi **đúng** người được phép) | Tránh bấm → báo lỗi 403 giả |
| Ghi đè / duyệt cấp GĐ | Theo luật cũ trên form + duyệt hàng loạt trên board | **Không** duyệt từng phiếu lên “đã duyệt cuối” nếu domain cấm |
| Chia sẻ form KPI | Có | |

### 3.4 Chăm sóc sau bán & phụ huynh

| Nghiệp vụ | Trạng thái |
|-----------|------------|
| Phiếu aftersale mở form, link chia sẻ | Có |
| Tài khoản phụ huynh mở form (liên hệ / thao tác) | Có |
| Buổi học — form + copy link | Có |

### 3.5 Tài chính — phiếu thu, hoàn tiền, huỷ phiếu

| Nghiệp vụ | Trạng thái vận hành | Rủi ro còn lại |
|-----------|---------------------|----------------|
| Duyệt phiếu thu (cổng tiền) | Form phiếu thu (đã có từ trước) | — |
| **Hoàn tiền** | Không còn trang “chưa áp dụng”: **danh mục phiếu đã duyệt** → mở form → ghi hoàn (sổ append-only) | Cần UAT số tiền / cap |
| **Huỷ phiếu đã duyệt** | Form: lý do bắt buộc; tùy chọn “nhập nhầm → rút HV” | Cần UAT cặp cơ hội / ghi danh / unit |
| Nghiệm thu P1-08 (huỷ/hoàn) | Đã có đường thao tác UI; **chưa** có kịch bản e2e journey | Báo cáo nghiệm thu: “có UI, chưa chứng minh journey” |

### 3.6 Việc **chưa** làm (tránh hiểu nhầm “xong hết HR”)

- Giao diện chấm công **chưa** đạt mật độ / “thẻ chấm to” như ảnh 1.  
- **Không** có bảng công tháng dày cột (đi muộn / về sớm / giờ công) như ảnh 3 — hoặc có nhưng chưa đồng bộ grammar Console.  
- **Không** làm kanban “Submitted | Approved | Reject” như ảnh 2 cho phiếu bù.  
- KPI form **chưa** có cột ghi chú/chatter bên phải như ảnh 4 (có chủ đích: tránh phình sản phẩm).  
- Chưa push/gộp nhánh form-depth vào `develop`/`main` (vẫn cần CI).  
- UAT người thật: **chưa**.

---

## 4. Đối soát với nghiệp vụ đã chốt (tránh sai lệnh)

Thang: **Khớp** · **Khớp một phần** · **Lệch / cấm** · **Chưa chứng minh UAT**

| Luật / quyết định đã chốt | Kỳ vọng BA | Kết quả form-depth | Kết luận |
|---------------------------|------------|---------------------|----------|
| Resource-centric, không app “Duyệt …” | 1 chứng từ = 1 menu | KPI, ca, aftersale, parents, hoàn tiền theo hướng này | **Khớp** |
| Duyệt ca theo **track GĐ**, không chuỗi quản lý | Form ca giữ luật server | UI form gọi đúng thao tác cũ | **Khớp** (cần UAT track) |
| KPI: xác nhận = quản lý trực tiếp | Nút xác nhận chỉ khi đúng người | Đã siết cờ server | **Khớp** |
| KPI: trạng thái “đã duyệt cuối” chỉ bulk GĐ | Không nút single-approve lên cuối trên form | Board bulk giữ | **Khớp** |
| Chấm công: punch append-only; ticket bù bị đóng băng sau nộp | Không mở lại form “tạo bù ngày quên” tự do | Domain giữ; UI chấm công **chưa** polish | **Khớp luật**, UI chưa đẹp |
| Không khôi phục tạo phiếu bù ngày quá khứ tự do | Cấm product | Không mở lại | **Khớp** |
| Hoàn tiền chỉ GĐKD, phiếu đã duyệt, không vượt số còn lại | Form + server | UI + cờ “được hoàn” | **Khớp** · **Chưa UAT** |
| Huỷ phiếu: money-gate, lý do, void rút HV | Form | Đã có | **Khớp** · **Chưa UAT** |
| Facility / RLS | Mọi thao tác trong cơ sở | Giữ | **Khớp** |
| Design = CMC Console, không skin TEKY teal | Token Console | Form-depth dùng khung Console; mật độ màn HR chưa đồng đều | **Khớp một phần** (visual) |

**Cảnh báo BA:** Ảnh TEKY là **tham chiếu cảm giác thao tác**, không được hiểu là “luật sản phẩm mới”. Nếu copy kanban phiếu bù tự do → rủi ro **lệch công → lệch KPI → lệch lương**.

---

## 5. Đọc 4 ảnh tham chiếu — học / không học

### Ảnh 1 — Chấm vào/ra (thẻ lớn giữa màn)

| Học | Không học |
|-----|-----------|
| CTA chấm công **rất lớn**, một thao tác chính | Màu navbar teal TEKY (Console dùng purple/token riêng) |
| Lý do / loại “đi ngoài” khi cần | Menu module TEKY (Calendar, Overtime, …) |
| Welcome + ngữ cảnh cá nhân | Coi đây là cả module Attendance |

**Ánh xạ CMC:** màn **Chấm công** (`/hr/checkin`) — giữ 1 tab chấm + tab phiếu của tôi + inbox GĐ (filter), **không** tách app.

### Ảnh 2 — Kanban Submitted | Approved | Reject

| Học | Không học |
|-----|-----------|
| Trạng thái phiếu bù **nhìn được** | Kanban = sản phẩm thứ hai / tạo phiếu tự do |
| Card tóm tắt người + thời điểm | Kéo thả đổi trạng thái ngoài luật server |
| Filter theo đơn vị (My Department) | “Reject (3)” như cột quy trình song song |

**Ánh xạ CMC:** phiếu `ManualAttendanceTicket` — **danh sách + filter trạng thái** (hoặc kanban **cùng URL/cùng model** sau này). Duyệt/từ chối trên form hoặc action đã có; **không** `manualPunch.create` lại.

### Ảnh 3 — Bảng Attendances dày cột

| Học | Không học |
|-----|-----------|
| Cột: vào / ra / muộn / sớm / giờ / ca | Coi mọi dòng là “sửa tay” |
| Filter tháng + phân trang dày | Export/group TEKY nếu chưa có nhu cầu UAT |
| Dòng tổng (totals) | |

**Ánh xạ CMC:** báo cáo / list **công đã ghép punch + ca** (domain credit). Ưu tiên **đọc** cho GĐ/KT; chỉnh sửa qua punch/ticket, không grid edit tự do.

### Ảnh 4 — Form KPI + statusbar + chatter

| Học | Không học |
|-----|-----------|
| Statusbar DRAFT → SUBMIT → CONFIRM → APPROVED | Cột chatter / Follow / Send message (phình) |
| Sheet 2 cột field dày | Copy toàn bộ field hoa hồng TEKY nếu CMC chưa chốt |
| Breadcrumb “Phiếu đánh giá / KPI - …” | Tab phụ OKR/hoa hồng nếu chưa có domain |

**Ánh xạ CMC:** form KPI hiện có statusbar + nút đúng vai — **polish mật độ sheet**; ghi chú dùng **lý do ghi đè / audit**, không build chatter wave này.

---

## 6. Khoảng cách UI hiện tại (chân thật)

| Màn CMC | Nghiệp vụ | Visual vs ảnh | Ưu tiên visual |
|---------|-----------|---------------|----------------|
| Chấm công | Punch + ticket | Chưa “thẻ lớn”; tab còn nhiều chữ | **P1 polish** |
| Đăng ký ca | List + form | Form-depth OK; list còn nặng | P2 density |
| KPI board + form | Shared workspace | Form đúng luật; sheet chưa dày như ảnh 4 | P1 form density |
| Phiếu thu / hoàn / huỷ | Money | Form-depth mới; chưa “đẹp Odoo” | P2 |
| Aftersale / parents | CSKH | Form-depth functional | P3 |

**Design system:** đã có Console + `ListPage` / `DetailPage` / `KanbanBoard` / tokens — vấn đề là **áp dụng không đều**, không phải thiếu hệ thống.

---

## 7. Lời khuyên điều phối (advise — tóm tắt)

1. **Ưu tiên gộp / xanh CI** phần form-depth nghiệp vụ trước khi mở wave “giống Odoo pixel”.  
2. **Cấu trúc (IA + luật)** là nguồn sự thật; **giao diện** chỉ làm đẹp **cùng URL / cùng chứng từ**.  
3. **Không** lấy kanban TEKY làm chuẩn nghiệp vụ chấm công.  
4. Wave UI tiếp: **Chấm công (CTA + list ticket)** + **KPI form density** + checklist Console — dùng **impeccable** (shape → polish) trên surface đó.  
5. Song song được **hai track file-ownership rõ**: Track A structure/hygiene · Track B visual Console — **cùng resource**, không page đôi.

---

## 8. Phạm vi triển khai đề xuất (2 track song song)

### Track A — Cấu trúc & chống lệch luật (BA + domain light)

| Hạng mục | Việc | Done khi |
|----------|------|----------|
| A1 | Ship form-depth: PR gọn, CI typecheck-and-test + ui-e2e | Merge develop/main theo quy trình |
| A2 | Ma trận đối soát §4 review owner 1 lần (đặc biệt hoàn/huỷ/KPI) | Owner ký “khớp” |
| A3 | Chấm công IA: 1 leaf; inbox = filter scope; không nav “Duyệt chấm công” riêng nếu còn | Nav khớp authority |
| A4 | (Tuỳ chọn) e2e hủy/hoàn trên form phiếu thu | P1-08 có journey |

### Track B — Giao diện Console + impeccable (Operate mode)

| Hạng mục | Việc | Tham chiếu ảnh | Done khi |
|----------|------|---------------|----------|
| B1 | **Shape** màn Chấm công: thẻ CTA lớn, reason khi server yêu cầu, hierarchy tab | Ảnh 1 | Spec visual + copy VI chốt |
| B2 | **Polish** list phiếu của tôi / inbox: card hoặc table dense + status filter (không kanban product) | Ảnh 2 (ý trạng thái) | Cùng model ticket |
| B3 | **Layout/typeset** form KPI: sheet 2 cột, statusbar rõ, bỏ cảm giác “form mỏng” | Ảnh 4 (trái) | Không thêm chatter |
| B4 | (Sau) Bảng công tháng dense — chỉ nếu domain list credit đã có sẵn | Ảnh 3 | Không invent edit grid |
| B5 | Audit Console tokens trên 3 màn pilot | design-system-console | Không skin TEKY |

**Impeccable:** `shape` trước khi code · `polish` / `layout` / `typeset` khi surface đã đúng IA · `audit` a11y trước ship UI.

### Điều phối AgentKit (ak)

| Bước | Ai / lệnh gợi ý | Output |
|------|-----------------|--------|
| 1 | BA report này (xong) | Owner đọc §4 + §8 |
| 2 | `ak` plan / cook Track A1 ship | PR CI xanh |
| 3 | Parallel: subagent **ui-ux-designer + impeccable shape** Track B1–B3 | Spec + mock trong plan |
| 4 | cook --tdd --parallel theo ownership file | Không đụng chung file nav+page nếu conflict |
| 5 | code-reviewer + tester | Luật §4 không regress |
| 6 | Owner UAT 3 luồng: chấm · ca · KPI · (tiền: hoàn/huỷ) | Ký nghiệm thu tay |

---

## 9. Rủi ro & giả định

| Rủi ro | Mức | Giảm thiểu |
|--------|-----|------------|
| Nhánh form-depth trộn LMS + HR → PR khó gộp | Cao | Tách PR hoặc ship theo lớp; CI bắt buộc |
| Copy kanban TEKY → phá luật công/lương | Cao | Chỉ filter/list ticket; cấm create free |
| Polish UI trước khi merge | Trung bình | Track B sau A1 hoặc chỉ trên branch đã rebase |
| UAT chưa chạy → “đẹp nhưng sai số” | Cao | Ma trận §4 + UAT tiền/HR |
| Chatter KPI “xin thêm” giữa chừng | Trung bình | Ghi non-goal; dùng lý do ghi đè |

**Giả định:** Ảnh = UX reference; ADR chấm công / KPI domain **không** bị override trừ khi owner ra quyết định mới bằng văn bản.

---

## 10. Quyết định cần owner (ngắn)

1. **Ship form-depth trước** (khuyến nghị) hay **mở UI Odoo-parity ngay trên branch hiện tại**?  
2. Bảng công tháng (ảnh 3): **bắt buộc wave này** hay **sau** khi chấm công + KPI form ổn?  
3. Kanban ticket: **cấm hẳn** hay **cho phép view mode** cùng URL list?

---

## 11. Kết luận một câu

**Đã xong lớp “chứng từ mở được, đúng vai, đúng luật” cho ca · KPI · aftersale · parents · hoàn/huỷ tiền; chưa xong lớp “cảm giác Odoo dày đặc + đồng bộ Console” cho chấm công/KPI — và không được đánh đổi luật công–lương để giống ảnh TEKY.**

Bước điều phối hợp lý: **chốt §10 → A1 ship → B1–B3 impeccable song song cấu trúc hygiene A3.**
