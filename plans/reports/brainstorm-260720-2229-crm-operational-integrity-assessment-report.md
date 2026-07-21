# Đánh giá hệ thống CRM — luồng vận hành, toàn vẹn dữ liệu, mồ côi, tính chuyên nghiệp

- **Ngày:** 2026-07-20 · **Phiên:** brainstorm (assessment) · **Nhánh:** main
- **Nguồn bằng chứng:** CHỈ code/schema/migrations (theo yêu cầu PO — docs coi là tuyên bố, không phải bằng chứng). Mọi finding cite file:line.
- **Chuẩn chấm:** nội bộ (5 role thật, role-reality) làm chính; đối chiếu chuẩn CRM ngành chỉ để chỉ khoảng cách, không đề xuất phình role.
- **Phương pháp:** đọc trực tiếp crm/meeting/appointment/after-sale routers + schema + RLS migrations + auth registry; 2 Explore agent audit chuỗi finance→provisioning và UI admin.

## 1. Bức tranh hệ thống CRM hiện tại

```
Contact ──< Opportunity (O1_LEAD→O2→O3→O4 tay; O5_ENROLLED CHỈ qua finance.receiptApprove)
                │ lost = closedAt+lostReason, stage GIỮ NGUYÊN (không có stage LOST)
                └──< Receipt (opportunityId NULLABLE → walk-in bỏ qua CRM)
                        └─ approve → provisioning: ParentAccount→Student(+Guardian)→Enrollment→StudentAccount
Hậu mãi (gắn studentId, sau enrolled): ParentMeeting / TestAppointment / AfterSaleCase
Quyền: crm.* = giam_doc_kinh_doanh + sale; hậu mãi thêm giam_doc_dao_tao (packages/auth/src/index.ts:55-59,126-128)
```

## 2. Điểm mạnh đã xác minh (facts)

| # | Điểm mạnh | Bằng chứng |
|---|---|---|
| S1 | RLS + FORCE trên mọi bảng CRM/finance (Contact, Opportunity, Receipt, ParentMeeting, TestAppointment, AfterSaleCase…) | migrations 20260706054322:105-131, 20260707050000:36-43, 20260707190000 |
| S2 | O5_ENROLLED chỉ đạt qua receiptApprove — chặn advance tay; sale không được duyệt phiếu (separation of duties) | crm/router.ts:126-128; auth registry:60-62 |
| S3 | State machine tuyến tính 1-bước, chặn skip stage; lost/reopen có kiểm tra | crm/router.ts:134-140,157-165 |
| S4 | Cancel receipt: atomic claim + FOR UPDATE lock Opportunity, revert O5→O4 chỉ khi là receipt approved duy nhất; withdraw Enrollment chỉ khi không receipt khác cover | finance/router.ts:424-453,470-486 |
| S5 | Provisioning idempotent: dedup ParentAccount theo phone chuẩn hoá, Student theo createdByReceiptId unique + advisory lock, P2002-refetch mọi bước | provision-from-receipt.ts:99-101,187-212 |
| S6 | AfterSaleCase/RefundRecord append-only (cmc_app không có DELETE grant); resolve bắt buộc resolution, complete meeting bắt buộc result | after-sale/router.ts; meeting/router.ts:18-21 |

Kết cấu backend lõi tiền–provisioning **có kỷ luật kỹ thuật thật** (lock, idempotency, RLS). Vấn đề nằm ở các mép nối và ở UI.

## 3. Findings theo severity

### CRITICAL

**F1 — CRM không vận hành được từ UI: không có màn tạo lead.**
Backend `crm.opportunityCreate` tồn tại (crm/router.ts:81-113) nhưng **zero** điểm gọi trong `apps/admin/src` (chỉ test gọi). Tương tự `opportunityMarkLost` — UI chỉ hiển thị lost, không set được (pipeline.tsx chỉ có advance + enroll). Hệ quả: pipeline O1→O5 hiện là **máy trình diễn**, không phải công cụ sale dùng hằng ngày; mọi lead thật phải vào bằng đường nào đó ngoài hệ thống.

**F2 — Race cancel-vs-provisioning để lại Student mồ côi vĩnh viễn.**
Guard `ReceiptNoLongerApprovedError` chỉ bảo vệ bước Enrollment (activate-enrollment.ts:101-107), không bảo vệ bước tạo ParentAccount/Student/Guardian. Timeline lỗi: tiền commit → receiptCancel flip cancelled, rollback tìm Student theo createdByReceiptId nhưng chưa có (finance/router.ts:461-463) → provisioning commit tiếp Student+Guardian → bước enrollment thấy cancelled, abort, ghi marker `provisioning.aborted_receipt_not_approved` → marker chặn replay. Kết quả: **receipt cancelled nhưng Student active, phụ huynh nhìn thấy con trong LMS, không lớp, không cleanup**.

### HIGH

**F3 — Duyệt phiếu thu trên opportunity đã LOST không bị chặn, còn phá trạng thái lost.**
receiptCreate chỉ soft-warning khi stage ≠ O4 (finance/router.ts:714-718), không hề check `closedAt`/`lostReason`. Approve sau đó force-advance lên O5 và **ghi đè closedAt bằng ngày mới, giữ nguyên lostReason** (:330-336) → bản ghi "enrolled-nhưng-lost" với lý do thua cuộc cũ — báo cáo win/loss sai.

**F4 — Walk-in receipts vô hình với CRM.**
`opportunityId` optional (:90), không auto-tạo Contact/Opportunity → doanh thu walk-in không bao giờ vào funnel; tỉ lệ chuyển đổi và attribution sai ngay từ nguồn.

**F5 — TestAppointment mâu thuẫn thiết kế với chính pipeline.**
Bảng yêu cầu `studentId` (appointment/router.ts:38-41) nhưng Student chỉ tồn tại **sau** khi duyệt phiếu (O5). Vậy lead ở O3_TEST_SCHEDULED/O4_TESTED — giai đoạn **trước** enrolled — không thể có lịch test entrance bằng bảng này. Stage O3 hiện là nhãn bấm tay không có dữ liệu lịch nào phía sau; TestAppointment cũng **zero UI**. Hai nguồn sự thật (stage tay vs bảng lịch) không thể khớp.

**F6 — refundCreate không ghi AuditLog.**
Mutation chuyển tiền trên ledger append-only nhưng không audit (runRefundTransaction, finance/router.ts:548-626). Trong khi approve/cancel có audit đầy đủ.

**F7 — Lost làm sai lệch mọi con số funnel trong UI.**
Card lost giữ nguyên cột stage, được đếm vào funnel/byStage (pipeline.tsx:140-144), không filter được. Funnel trên màn hình GĐ kinh doanh nhìn = tổng cả thắng lẫn thua trộn lẫn.

### MEDIUM

**F8 — Contact không có `@@unique([facilityId, phone])`** (schema.prisma:258-269); dedup chỉ app-level find-or-create (crm/router.ts:91-95) → race 2 request tạo Contact trùng phone; index thường không chặn.

**F9 — AuditLog trống trên hầu hết mutation CRM:** opportunityAdvance/markLost, toàn bộ meeting/appointment/afterSale, receiptCreate (gồm quyết định confirmNewStudent ghi đè trùng), provisioning thành công — không dòng audit nào. Chỉ opportunityCreate + approve/cancel/refund-failure có.

**F10 — UI stub lạc hậu so với backend:** aftersale.tsx + post-sale-meeting.tsx là EmptyState "coming soon", comment nói *chưa có backend* — trong khi `after-sale/router.ts` và `meeting/router.ts` **hoàn chỉnh và đã đăng ký**. Tính năng làm xong server-side nhưng chết vì hai phía mất đồng bộ.

**F11 — Không search/pagination:** pipeline hard pageSize 100 (pipeline.tsx:98), enroll-picker 50, không text search theo tên/SĐT — cắt im lặng khi dữ liệu vượt; sale không tra được khách theo phone dù backend có `opportunityLookup`.

**F12 — Orphan bậc thang khi provisioning fail giữa chừng** (thiết kế cố ý không-1-transaction, ADR 0041): Student+Guardian không Enrollment nếu classBatch guard fail; ParentAccount không Guardian nếu Student-step fail. Có retry_pending + reconciler `missing_provisioning` đỡ một phần — chấp nhận được **trừ** nhánh F2 (marker chặn replay).

### LOW

**F13 — Cột chết `ParentMeeting.remindedAt`:** không code nào đọc/ghi (grep toàn repo: chỉ schema + migration) — worker nhắc lịch không tồn tại dù schema hứa.
**F14 — Advance sai không lùi được:** một chiều, muốn sửa phải markLost→reopen (về O2 cố định) — mất stage thật.
**F15 — Scalar không FK (defense-in-depth):** Receipt.studentId, createdById/approvedById; ParentMeeting/TestAppointment/AfterSaleCase.studentId đều scalar trần. Rủi ro orphan thực tế thấp (Student không bao giờ DELETE, chỉ withdrawn; app-check lúc create + assertStudentActive cho meeting) nhưng DB không tự vệ.

## 4. Tính chuyên nghiệp — đối chiếu 5 role thật vs chuẩn ngành

**Khớp role-reality (giữ, không phình):** phân quyền crm/finance/hậu-mãi đúng 5 role; không CRM automation/SLA/lead-scoring kiểu HubSpot — đúng YAGNI cho trung tâm 1 cơ sở.

**Khoảng cách ngành ĐÁNG làm trong khuôn khổ 5 role:**
1. **Owner/assignee trên Opportunity** — sale nào phụ trách lead; nền cho KPI/lương sale (mô hình lương đã LOCKED có %chỉ-số) — hiện không có cột nào.
2. **Lead source** — không có; không trả lời được "khách đến từ đâu".
3. **Activity note tối thiểu** trên Opportunity (gọi/hẹn/ghi chú) — timeline hiện là dots tĩnh.
4. **Search theo phone/tên + pagination thật.**

**Khoảng cách ngành KHÔNG nên làm (vượt tính chất dự án):** marketing automation, email sequence, lead scoring, multi-pipeline, forecast.

## 5. Khuyến nghị (xếp ưu tiên)

| Ưu tiên | Việc | Phủ finding |
|---|---|---|
| P0 | Vá race cancel-provisioning: mở rộng guard cancelled ra trước bước tạo Student, hoặc cleanup bù khi abort | F2 |
| P0 | Chặn receiptCreate/approve trên opportunity có `closedAt` (bắt reopen trước); không ghi đè closedAt khi advance O5 | F3 |
| P0 | UI tạo lead + mark lost/reopen + search phone (backend đã có sẵn cả 3) | F1, F11 |
| P1 | AuditLog cho refundCreate (tiền) rồi các mutation CRM còn lại | F6, F9 |
| P1 | Quyết định sản phẩm walk-in: auto-tạo Opportunity O5 khi receipt không gắn opp, HOẶC chấp nhận + loại khỏi funnel có chủ đích | F4 |
| P1 | Tách trạng thái lost khỏi funnel counts (filter UI trước, cân nhắc stage/flag riêng sau) | F7 |
| P2 | Chốt thiết kế TestAppointment: gắn theo Opportunity cho entrance-test (trước enrolled) hay bỏ type entrance; nối UI | F5 |
| P2 | `@@unique([facilityId, phone])` cho Contact (kèm dọn trùng nếu có) | F8 |
| P2 | Nối UI aftersale + parent-meeting vào backend sẵn có; xoá hoặc ẩn stub khỏi nav tới lúc đó | F10 |
| P3 | Owner + lead source + note tối thiểu trên Opportunity | mục 4 |
| P3 | Dọn `remindedAt` (xoá hoặc làm worker thật), cân nhắc FK cho các scalar studentId | F13, F15 |

## 6. Tiêu chí thành công đề xuất
- Không thể tạo receipt trên opp có closedAt (test chặn); không còn đường code nào để Student commit sau khi receipt cancelled.
- Sale hoàn thành trọn chu trình lead→lost/enrolled chỉ bằng UI, không seed/console.
- Funnel counts loại lost; walk-in có quyết định sản phẩm rõ ràng.
- Mọi mutation tiền + CRM stage-change có AuditLog.

## Quyết định PO đã chốt (2026-07-20, phiên brainstorm)
1. **Walk-in**: auto-tạo Contact+Opportunity đóng ở O5 khi duyệt receipt không gắn opp → funnel phản ánh toàn bộ doanh thu.
2. **Entrance test TRƯỚC đóng tiền: CÓ** → redesign TestAppointment: opportunityId cho type entrance, studentId cho periodic; UI đặt lịch từ pipeline; stage O3 sync từ lịch thật.
3. **Owner + lead source: vào plan này** — thêm assignedToId + source trên Opportunity + UI, làm nền KPI-lương sale.

Scope plan: full P0→P3 theo bảng khuyến nghị §5, đi qua pipeline plan → red-team → validate đến 0 Critical/High (mandate).
