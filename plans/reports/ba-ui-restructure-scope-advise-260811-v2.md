# BA + Brainstorm + Advise — UI / tái cấu trúc tiếp theo (v2)

**Ngày:** 2026-08-11  
**Đối tượng:** chủ dự án / điều phối  
**PR #110:** **để đó — không babysit CI trong đợt này**  
**Nguồn:** luật resource-centric · 4 ảnh TEKY/Odoo · form-depth đã nấu · design system Console  

---

## 1. Hợp đồng (brainstorm)

| Trường | Nội dung |
|--------|----------|
| **Kết quả mong muốn** | Ba màn HR pilot (chấm · ca · KPI) **cùng một cảm giác form chứng từ**; list/form/statusbar đồng bộ Console; luật nghiệp vụ **không** đổi. |
| **Ràng buộc** | Không app “Duyệt …”; không kanban phiếu bù TEKY; không skin teal; không chatter Odoo; PR 110 không đụng trong session này. |
| **Ngoài phạm vi** | Bảng công tháng đầy đủ (ảnh 3); LMS; payroll form-depth; e2e P1-08; merge PR. |
| **Chấp nhận wave UI** | (1) Ca form dùng **cùng component** statusbar/header/sheet như KPI/phiếu thu; (2) ma trận đối soát luật giữ **Khớp**; (3) unit test form ca/KPI/chấm xanh. |

---

## 2. Tình trạng thật (tự đo — advise)

| Hạng mục | Thực tế | Ý nghĩa BA |
|----------|---------|------------|
| Form-depth ca · KPI · aftersale · parents · hoàn · huỷ | Đã có trên branch; **đã push** PR #110 | Vận hành chứng từ **có đường UI** |
| Chấm công thẻ lớn + tab “Hàng chờ phiếu” | Đã polish (B1) | Gần cảm giác ảnh 1 (CTA), **giữ** ADR punch |
| KPI form statusbar + sheet | Đã densify (B3) | Gần ảnh 4 **trái** (không chatter) |
| Form đăng ký ca | Có form + matrix; **statusbar tự viết CSS** (lệch design system) | **Gap #1** visual/IA |
| Aftersale / parents form | Form mỏng (header + action) | **Gap #2** đồng bộ — sau ca |
| Bảng công tháng (ảnh 3) | Chưa | **Defer** — cần nguồn số ổn |
| Kanban Submitted/Approved (ảnh 2) | Cố ý **không** làm product | Cấm nếu phá luật ticket bù |
| PR #110 | Mở sẵn → develop | **Để sau** (owner) |
| UAT người thật | Chưa | Không tuyên bố production-ready |

**Advise (quyết định điều phối):**

1. **D1** — Wave này = **đồng bộ form chứng từ** (component Console), không mở domain mới.  
2. **D2** — Ưu tiên **form ca (B2)** vì là pilot HR thứ 3 và đang **lệch** KPI/receipt (CSS riêng).  
3. **D3** — Aftersale densify **tiếp ngay sau** ca (cùng grammar).  
4. **D4** — Ảnh 3 bảng công + kanban TEKY = **không** mở.  
5. **D5** — PR #110 **đóng băng** điều phối ship; code local tiếp tục polish trên cùng branch.  
6. **D6** — Song song được: **A structure** (nav label / list index-only) ∥ **B visual** (impeccable densify) **chỉ khi** ownership file khác nhau.

---

## 3. Đã triển khai — ngôn ngữ vận hành (cập nhật)

### 3.1 Tổ chức màn hình
Một chứng từ = một menu + danh sách + form (link chia sẻ). Vai = hàng + nút, không = app thứ hai.

### 3.2 Nhân sự
| Luồng | BA status |
|-------|-----------|
| Đăng ký ca — soạn/nộp/duyệt trên form, list chỉ mở phiếu | **Vận hành được** · UI form **chưa** cùng “vỏ” Console với KPI |
| KPI — bảng chung, xác nhận đúng QL, ghi đè/duyệt đúng cấp | **Vận hành được** · form đã densify |
| Chấm vào/ra — thẻ lớn; phiếu của tôi; hàng chờ GĐ (filter) | **Vận hành được** · gần ảnh 1 |

### 3.3 CSKH / đào tạo / tài chính
| Luồng | BA status |
|-------|-----------|
| Aftersale · parents · buổi học (link) | Form có · mỏng về visual |
| Hoàn tiền + huỷ phiếu trên form phiếu thu | **Có đường thao tác** · chưa UAT số / e2e journey |

---

## 4. Đối soát luật đã chốt (tránh sai lệnh)

| Luật đã chốt | Kỳ vọng | Hiện trạng | Kết luận |
|--------------|---------|------------|----------|
| Resource-centric, không “Duyệt …” | 1 menu / chứng từ | Ca · KPI · aftersale · parents · refund index | **Khớp** |
| Duyệt ca theo track GĐ | Form gọi đúng mutation | Không đổi domain | **Khớp** (cần UAT track) |
| KPI confirm = managerId | Cờ server + nút | Giữ | **Khớp** |
| KPI approved chỉ bulk GĐ | Không single-approve lên cuối | Giữ | **Khớp** |
| Punch append-only; cấm bù ngày tự do | ADR 0043 | UI không mở form bù tự do | **Khớp** |
| Ticket bù: không product kanban TEKY | Cấm | Không làm | **Khớp** |
| Hoàn: GĐKD, approved, ≤ remaining | Form + server | Có | **Khớp** · **Chưa UAT** |
| Huỷ phiếu: money-gate + lý do | Form | Có | **Khớp** · **Chưa UAT** |
| Design = Console, không TEKY teal | Token Console | KPI/receipt/check-in tốt hơn; ca còn CSS riêng | **Khớp một phần** → B2 |

**Cảnh báo:** Ảnh TEKY = cảm giác thao tác. Copy kanban/bù ngày → **lệch công → KPI → lương**.

---

## 5. Bốn ảnh — học / không học (giữ nguyên)

| Ảnh | Học | Không học | CMC map |
|-----|-----|-----------|---------|
| 1 Chấm thẻ lớn | CTA một nút | Navbar teal TEKY | `/hr/checkin` — **đã gần** |
| 2 Kanban ticket | Nhìn trạng thái | Product kanban / kéo thả | Tab + badge list — **đủ** |
| 3 Bảng công dày | Cột vào–ra–muộn | Sửa grid tay | **Defer** |
| 4 KPI form + chatter | Statusbar + sheet 2 cột | Chatter / Follow | KPI form — **đã densify** |

---

## 6. Phạm vi song song — 2 track

### Track A — Cấu trúc (chống lệch)
| # | Việc | Size | Trạng thái |
|---|------|------|------------|
| A1 | Ship PR #110 | ops | **Đứng** (owner check sau) |
| A2 | Ma trận §4 owner rà UAT | S | Chờ người |
| A3 | List ca/aftersale: index-only (không dual HITL) | S | Đã phần ca; giữ |

### Track B — Giao diện Console + impeccable
| # | Việc | Size | Trạng thái |
|---|------|------|------------|
| B1 | Chấm công thẻ lớn | S | **Done** |
| B2 | Form ca → WorkflowStatusbar + HighlightStrip + sheet | M | **Wave này** |
| B3 | Form KPI densify | S | **Done** |
| B4 | Aftersale form densify (cùng grammar) | S | **Sau B2** |
| B5 | Parents form densify (nhẹ) | S | Sau B4 |
| B6 | Bảng công tháng | L | Defer |
| B7 | Token audit 3 màn pilot | S | Sau B2–B4 |

**Song song an toàn:** B4 ∥ B5 (file CRM vs parents); **không** B2 ∥ A1.

---

## 7. Điều phối ak / agent

| Bước | Việc | Agent / skill |
|------|------|----------------|
| 1 | Brainstorm + advise (file này) | main + ak-brainstorm mindset |
| 2 | Cook B2 form ca TDD | cook / fullstack; **impeccable polish** mật độ |
| 3 | Test form ca | ak-test / vitest admin |
| 4 | Review luật nút ca (approve/reject/cancel) | code-reviewer nhẹ |
| 5 | B4 aftersale densify | cook riêng file CRM |
| 6 | PR 110 | **owner** — không auto trong session |

Không spawn agent LMS trên nhánh form-depth UI.

---

## 8. Tiêu chí “xong wave UI” (không nhầm ship)

- [ ] Form ca dùng `WorkflowStatusbar` / `EntityHeader` / `HighlightStrip` / `KeyValueList` (không statusbar CSS one-off)  
- [ ] Nút Duyệt / Từ chối / Hủy **cùng chỗ** EntityHeader (như KPI)  
- [ ] Matrix lịch ca **giữ** (đặc thù nghiệp vụ — không thay bằng chatter)  
- [ ] Test `shifts-detail` xanh; domain mutation **không** đổi  
- [ ] Ma trận §4 không chuyển sang Lệch  

**Không** tính: CI PR 110 · e2e · UAT.

---

## 9. Một câu chốt

**Luật chứng từ đã có đường; vỏ màn HR chưa đồng đều. Wave tiếp = làm form ca (rồi aftersale) cùng “vỏ” Console với KPI/phiếu thu — học cảm giác Odoo, cấm clone TEKY phá công–lương. PR #110 để owner xử sau.**
