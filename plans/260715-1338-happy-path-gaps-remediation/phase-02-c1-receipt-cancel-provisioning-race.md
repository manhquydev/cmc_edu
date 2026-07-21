---
phase: 2
title: C1 Receipt-Cancel Provisioning Race
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: C1 Receipt-Cancel Provisioning Race (CRITICAL)

## Overview
Đóng khe race: `receiptApprove` commit tiền xong gọi `provisionFromReceipt` **ngoài** transaction; nếu `receiptCancel` chen vào giữa, provisioning vẫn chạy bằng snapshot cũ → tạo Enrollment active/StudentAccount cho phiếu đã `cancelled`, và `reconcile-orphaned-receipts` (chỉ quét `status='approved'`) không bao giờ thấy trạng thái xấu này.

## Requirements
- Functional: không tồn tại kết cục "receipt cancelled do RACE nhưng vẫn có **Enrollment active mới sinh**". Nếu race xảy ra, hệ thống hoặc (a) dừng provisioning khi phát hiện status đã đổi, hoặc (b) reconcile withdraw enrollment về sau.
- Non-functional: KHÔNG gộp provisioning trở lại vào transaction tiền (giữ ADR 0041); giữ idempotency.

## Quyết định PO — huỷ phiếu KHÔNG khoá login LMS (chốt, không "sửa nhầm")
Huỷ phiếu thường chỉ **rút chỗ học** (withdraw enrollment), **giữ tài khoản đăng nhập** của học sinh để phụ huynh xem lại bài/báo cáo cũ (chỉ chế độ `void` mới set student `withdrawn`). Đây là hành vi hiện tại của `runCancelTransaction:395-430` và PO xác nhận GIỮ NGUYÊN. → Phạm vi C1 CHỈ là chặn race tạo **enrollment active mới** cho phiếu đã huỷ; **KHÔNG** vô hiệu StudentAccount. Reconcile (lớp 2) chỉ withdraw enrollment còn `active`, KHÔNG đụng login.

## Architecture
Hai lớp phòng thủ, làm cả hai (thiếu 1 vế thì trạng thái xấu vẫn lọt):
1. **Guard khoá-hàng + đọc-lại-status (đóng race, không chỉ thu hẹp):** trong bước tạo Enrollment active của `provisionFromReceipt`, lấy **`SELECT status FROM "Receipt" WHERE id=$1 FOR UPDATE`** trong cùng tx với bước enrollment, kiểm `status==='approved'` NGAY sau khi giữ lock. Vì `receiptCancel` cũng phải khoá cùng hàng receipt để đổi status, hai bên serialize → không còn khe READ-COMMITTED. Nếu `!== 'approved'` → ném `ReceiptNoLongerApprovedError`, caller ghi audit `provisioning.aborted_receipt_not_approved` (KHÔNG `retry_pending` — retry vô nghĩa vì phiếu đã huỷ).
   - **Lưu ý ADR 0041:** bước enrollment vốn là 1 tx idempotent riêng (không gộp vào tx tiền) — thêm FOR UPDATE trong CHÍNH tx enrollment này, không kéo ngược vào tx tiền.
   - **Cơ chế lock phía cancel (đã đọc code):** `runCancelTransaction:349-352` đã atomic-claim receipt bằng `updateMany WHERE status='approved'` — thao tác này giữ row-lock trên hàng receipt trong suốt tx cancel. Nên `SELECT ... FOR UPDATE` phía provisioning sẽ **contend đúng cùng hàng** → block tới khi cancel commit rồi re-read thấy `cancelled` → abort. Cặp lock có tác dụng, KHÔNG cần sửa thêm phía cancel.
2. **Nới filter reconcile (lưới đỡ thứ 2):** `reconcile-orphaned-receipts` thêm nhánh quét receipt `status='cancelled'` **mà vẫn còn** Enrollment active / StudentAccount → withdraw enrollment + raise `ReconciliationFlag`, KHÔNG hard-delete.
   - **Cảnh báo vận hành:** reconcile hiện **chạy thủ công** ("scheduled executor not yet built" — system-architecture.md). Nếu lớp 1 (FOR UPDATE) đóng được race thì lớp 2 chỉ dọn dữ liệu lịch sử/lọt-trước-fix; KHÔNG được coi reconcile là phòng tuyến chính khi nó chưa có scheduler. Ghi rõ: phòng tuyến chính = lock ở bước 1.

## Related Code Files
- Modify: `apps/api/src/provisioning/provision-from-receipt.ts` (thêm re-read status trước `activateEnrollmentForReceipt:285`)
- Modify: `apps/api/src/finance/router.ts:754-776` (`receiptApprove` — xử lý lỗi mới, ghi audit đúng loại)
- Modify: `apps/api/src/worker/reconcile-orphaned-receipts.ts:78-124` (thêm nhánh cancelled-but-provisioned)
- Create: test `apps/api/src/finance/receipt-cancel-provisioning-race.test.ts`
- Read (ngữ cảnh): `apps/api/src/finance/router.ts` `runCancelTransaction:331-443` (nó withdraw enrollment nếu Student đã tồn tại — cần biết để không double-withdraw)

## Implementation Steps (TDD)
1. **Test đỏ #1 — guard:** viết test mô phỏng: approve → set receipt.status='cancelled' (qua cancelTransaction hoặc trực tiếp trong test) TRƯỚC khi gọi phần enrollment của provisioning → assert provisioning KHÔNG tạo Enrollment active, và ném `ReceiptNoLongerApprovedError`. Chạy → đỏ.
2. **Impl guard:** thêm re-read `tx.receipt.findUnique({where:{id}, select:{status}})` ngay trước `activateEnrollmentForReceipt`; nếu `!== 'approved'` ném lỗi. Chạy test #1 → xanh.
3. **Test đỏ #2 — audit loại đúng:** approve với provisioning bị abort do cancelled → assert AuditLog có action `provisioning.aborted_receipt_not_approved` (KHÔNG phải `retry_pending`, vì retry sẽ vô nghĩa — phiếu đã huỷ). Chạy → đỏ.
4. **Impl:** trong `receiptApprove` catch, phân biệt `ReceiptNoLongerApprovedError` → ghi audit action riêng, `provisioning='aborted'`. Chạy → xanh.
5. **Test đỏ #3 — reconcile bắt trạng thái lọt:** dựng receipt `cancelled` NHƯNG có Enrollment active (mô phỏng đã lọt trước fix) → chạy reconcile → assert enrollment bị withdraw + `ReconciliationFlag` raise. Chạy → đỏ.
6. **Impl reconcile:** thêm nhánh quét cancelled-but-provisioned. Chạy → xanh.
7. **Regression:** `pnpm --filter @cmc/api test finance` + `test provisioning` + `test worker` — không đỏ. Đặc biệt giữ xanh các test idempotency/renewal đã có.

## Success Criteria
- [ ] Provisioning dừng đúng khi receipt không còn `approved` tại thời điểm cấp enrollment.
- [ ] Audit ghi `aborted` (không `retry_pending`) cho case cancelled.
- [ ] Reconcile phát hiện + xử lý cancelled-but-provisioned; enrollment bị withdraw, cờ raise.
- [ ] Toàn bộ test finance/provisioning/worker cũ vẫn xanh (idempotency, renewal, crash-recovery không hồi quy).

## Risk Assessment
- Rủi ro: guard đọc-lại-status thêm 1 query trong provisioning nóng — chấp nhận (provisioning không phải hot path cực đại; đúng đắn > vi tối ưu).
- Rủi ro: `runCancelTransaction` đã withdraw enrollment nếu Student tồn tại → reconcile có thể gặp enrollment đã withdrawn (không cần làm lại). Mitigation: reconcile chỉ xử lý enrollment còn `active`.
- Race đóng bằng cặp `FOR UPDATE` (bước enrollment ↔ cancel) — không dựa vào reconcile (chưa có scheduler). Nếu vì lý do nào đó không thể lock cả 2 phía, ghi rõ residual risk + bắt buộc lên lịch reconcile trước go-live.
- Rủi ro test đua khó dựng deterministic trong vitest: dùng 2 tx thủ công + kiểm thứ tự lock, hoặc mock thời điểm cancel giữa 2 bước; nếu không dựng được đua thật, tối thiểu test đơn luồng "receipt cancelled trước bước enrollment → abort" (bao phủ nhánh guard).
