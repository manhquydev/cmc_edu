# Phase 2 (C1) — Hoàn tất

**Ngày:** 2026-07-15 · **TDD:** đỏ→xanh đủ 3 bước theo plan · **Regression:** 764/764 test (88 file) · **Typecheck:** 26/26 package

## Thay đổi code
| File | Thay đổi |
|---|---|
| `apps/api/src/enrollment/activate-enrollment.ts` | `ReceiptNoLongerApprovedError`; `receiptId` bắt buộc; `SELECT status FOR UPDATE` khoá cùng hàng với `receiptCancel` |
| `apps/api/src/provisioning/provision-from-receipt.ts` | truyền `receiptId` |
| `apps/api/src/finance/router.ts` | `provisioning: 'ok'\|'pending'\|'aborted'`; audit `provisioning.aborted_receipt_not_approved` tách khỏi `retry_pending` |
| `apps/api/src/worker/reconcile-orphaned-receipts.ts` | `reconcileCancelledButProvisioned` — lưới đỡ lớp 2, withdraw + raise flag |
| `apps/api/src/worker/reconcile-finance-flags.ts` | export `maybeCreateFlag` để dùng chung |
| `packages/db/prisma/migrations/20260715160000_.../migration.sql` | mở rộng CHECK constraint `ReconciliationFlag.kind` |
| `apps/admin/src/pages/finance/receipt-detail.tsx` | UI hiển thị đúng case `aborted` (phát hiện qua typecheck, không phải giả định) |
| Test mới: `finance/receipt-cancel-provisioning-race.test.ts` (5 test, gồm 1 test race thật `Promise.allSettled`) |
| Test sửa: `enrollment/reserved-active.test.ts` (5 call site cần `receiptId` mới — seed thêm 1 Receipt approved) |

## Vấn đề hạ tầng gặp và xử lý
1. **DATABASE_URL không trỏ đâu cả** → tạo database test riêng `cmc_edu` trong Docker đang chạy (xem `reports/precondition-baseline-260715-1518-test-db-setup.md`), không đụng `cmc_prod`.
2. **EPERM khoá file Prisma DLL** — do 2 nguyên nhân: (a) `build`+`typecheck` của `@cmc/db` chạy song song lần đầu vì migration mới làm mất cache; (b) chính process test đang chạy giữ DLL trong bộ nhớ. Không phải lỗi code — chờ tiến trình xong rồi chạy lại là hết.
3. **`Receipt` không có field `amount`** (chỉ `netAmount`) — lỗi test ban đầu, sửa bằng sed.
4. **CHECK constraint chặn `kind` mới** — thêm migration hợp lệ thay vì đổi tên kind để né.

## Đối chiếu Success Criteria (phần thuộc Phase 2)
- [x] Không thể tồn tại `Receipt.status='cancelled'` mà vẫn có Enrollment active mới sinh (guard lớp 1, khoá FOR UPDATE).
- [x] Reconcile bắt được nếu lọt (lớp 2, `reconcileCancelledButProvisioned`).
- [x] Audit phân biệt đúng loại lỗi.

## Unresolved questions
Không có — Phase 2 khép kín theo đúng plan, không phát sinh quyết định PO mới.
