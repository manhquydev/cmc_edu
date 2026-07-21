# Deep Review (vòng 2) — Đứt gãy nghiệp vụ · Mồ côi · Toàn vẹn hệ thống/dữ liệu (P1)

> 3 agent focused (flow-continuity · data-integrity/recovery · orphan/closure) đọc code thật +
> main agent hợp nhất & **xác minh trực tiếp bằng grep/code**. Intake #5. Branch feat/p1-identity-enrollment (chưa merge).
> Khác audit trước (intake #4, per-module correctness): vòng này soi **hành trình end-to-end + tính khép kín + tồn vẹn** →
> tìm ra nhóm lỗi hệ thống mà audit per-module bỏ sót.

## Kết luận thẳng
**P1 như đang có KHÔNG phải hệ khép kín/vận hành được standalone.** Lõi money-gate + provisioning + concurrency + RLS **đúng và có test** (đã xác nhận), nhưng **payoff cho người dùng cuối bị đứt** và **có đường mồ côi tiền**. **Không nên merge về main** cho tới khi nhóm CRITICAL/HIGH được xử.

## CRITICAL (confirmed bằng code)

**K1 — Phụ huynh đã đóng tiền đăng nhập vào thấy RỖNG vĩnh viễn (happy-path đứt).**
`provisionFromReceipt` tạo `StudentAccount` nhưng **không bao giờ tạo `Guardian`** (grep provisioning: 0 kết quả). Cổng đọc dữ liệu con `getApprovedChildren` **chỉ** đọc `Guardian` (created duy nhất bởi `guardian.approveLink`). ⇒ HS được sinh từ chính phiếu của PH nhưng `verifyOtp`/`enrollment.mine` trả `children: []` mãi mãi. Write-side ⊥ read-side. Đúng lỗi gốc TL02 §1. **Toàn bộ cỗ máy ghi danh không cho ra kết quả người dùng thấy.**

**K2 — Tiền mồ côi khi provisioning fail/crash (failure-path đứt, không phục hồi).**
`receiptApprove` commit tiền (Receipt→approved, Opp→O5) rồi chạy `provisionFromReceipt` trong try/catch riêng. Khi fail → `provisioning:'pending'` + audit `retry_pending`. **KHÔNG có worker/scheduler/relay/retry nào trong repo** (grep: chỉ 1 comment). Lần `receiptApprove` thứ 2 bị chặn (status≠draft). ⇒ tiền đã thu, không HS/PH/enrollment, **không đường phục hồi qua app**. Crash giữa commit-tiền và catch còn **không có cả marker** → không phân biệt được với phiếu đã provision. ADR 0041 "no orphan / money integrity" phụ thuộc một actor retry **chưa được viết** (TL09 vẽ "Outbox Worker" không có trong repo).

## HIGH (confirmed)

**K3 — Bước HITL không thao tác được: thiếu hàng đợi công việc.** Không có `receiptList`/`receiptGet` (grep rỗng) ⇒ người duyệt (≠ sale) **không có cách tìm phiếu chờ duyệt**. Không có danh sách `GuardianLinkRequest` pending ⇒ nhân viên **không duyệt được link**. `receiptId`/`requestId` chỉ trả cho người tạo. Cổng tiền & guardian-link **kẹt** ở khâu người.

**K4 — Không có student lookup + `requestLink.studentRef` là uuid.** Renewal (`receiptCreate.studentId`), `enrollment.enroll.studentId`, `guardian.requestLink.studentRef` đều cần một id HS mà **không nguồn hợp lệ nào cấp** (grep: không có procedure tra HS). PH không thể có UUID nội bộ của con ⇒ đường tạo `Guardian` (đã hỏng ở K1) còn **chết ngay bước 1**.

**K5 — Ledger append-only KHÔNG enforce + role over-privileged.** Migration GRANT `SELECT,INSERT,UPDATE,DELETE ON ALL TABLES` cho `cmc_app`, **không REVOKE** (confirmed). `RefundRecord`/`AuditLog` sửa/xoá được qua RLS in-facility hoặc không-RLS. Bất biến I5/append-only chỉ là convention. Vi phạm least-privilege.

## MEDIUM (confirmed)
- **K6 EmailOutbox dead-letter:** enqueue `pending`, không relay → PH không bao giờ nhận email (3/3 agent xác nhận).
- **K7 Facility không có writer/seed trong app** (grep rỗng); mọi `facilityId` scalar **không validate** → facilityId lỗi/giả từ dev-header (hoặc SSO claim sau) **âm thầm tạo tenant vô hình**. Và: sản phẩm **chưa có cách tạo cơ sở**.
- **K8 `blocked_lms` không có writer** — nửa "chặn HS" của tính năng vắng; hiện bị K1 che.
- **K9 Cancel không thu hồi quyền LMS** — enrollment `withdrawn` nhưng HS vẫn hiện (bị K1 che); withdrawn lưu mãi trong `enrollment.mine`.
- **K10 `enrollment.enroll` (giữ chỗ `reserved`) inert cho HS mới** — cần studentId có sẵn, nhưng HS mới chỉ tồn tại sau duyệt phiếu (lúc đó đã `active`).
- **K11 `crm.opportunityList` chưa test** — endpoint list duy nhất P1 (kanban); pagination/filter/gate 0 test.
- **K12 Scalar treo chưa validate:** `classBatchId`(→ClassBatch, P2), `createdById`/`approvedById`(→AppUser) — FK sau sẽ vỡ/cần backfill.

## LOW
timestamptz thiếu `USING ... AT TIME ZONE` (an toàn ở greenfield); false `pending` khi email enqueue throw; refund-then-cancel(void:false) = 2 lần "hoàn" khái niệm; hằng số chưa chốt (20M, OTP 30s/5 lần); enum thừa (`completed/transferred/sent/graph`...); comment `Receipt.studentId` stale; `ke_toan` registry vs docs/11 (đã quyết giữ — cần đồng bộ docs).

## Đã XÁC NHẬN đúng (không sửa nhầm)
Atomic draft→approved claim; refund cap `FOR UPDATE` + idempotency; cancel O5→O4 revert race-guarded; provisioning **idempotent design** (chỉ thiếu retry actor); RLS 6 bảng facility fail-closed + bypass transaction-LOCAL server-side; partial-unique enrollment; permission registry 0 orphan (10 key đều dùng); 15/16 procedure có test; no cross-facility `Receipt.studentId` qua API.

## Phân loại để sửa
**Lỗi P1 thật, phải sửa (không cần quyết định):** K1 (provision tạo Guardian) · K3 (receiptList + pending-link list) · K5 (REVOKE update/delete ledger + trim cmc_app) · K8/K9 (blocked_lms writer + cancel thu hồi LMS) · K11 (test opportunityList) · LOW false-pending.
**Cần quyết định sản phẩm:** K2 (outbox/retry worker — build ở P1 hay defer + tối thiểu reconciliation/gate) · K4 (student lookup — P1 hay P2) · K6 (email relay — P1 hay pha comms) · K7 (Facility tạo ở đâu: seed/admin/SSO onboarding) · K12/classBatchId (ghi rõ seam P2).

## Quyết định merge
**KHÔNG merge PR #1 về main** cho tới khi K1/K2/K3/K5 xử xong (tối thiểu). K1 làm toàn bộ ghi danh vô hình với người dùng; K2 rủi ro mất tiền không phục hồi.

## Câu hỏi chưa giải (cần bạn)
1. Outbox/retry worker: build trong đợt này, hay tạm thời + reconciliation-query + gate (chặn/cờ) cho phiếu chưa provision?
2. Facility tạo ở đâu (seed dev + admin CRUD + validate facilityId)?
3. Student lookup + hàng đợi (receiptList, guardian-pending): làm ở P1 (API-level, chờ UI) đúng không?
4. Email relay + blocked_lms + cancel-revoke-LMS: đợt này hay pha sau?
