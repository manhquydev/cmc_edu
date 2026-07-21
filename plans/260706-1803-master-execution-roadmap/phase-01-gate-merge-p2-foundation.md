# Phase G1 — Gate + merge P2-Foundation

## Goal
Đưa `feat/p2-foundation-class-ops` (2 commit: 94629db docs, 4a742b0 feat) vào main với độ tin tương đương P1.

## Context
P2-Foundation đã build + 157 api test xanh nhưng CHƯA qua vòng review độc lập (P1 có 2 vòng). Scope nhỏ (1 WF + seam) → gate gọn, không cần 3-agent.

## Steps
1. **1 code-reviewer adversarial (read-only)** trên diff `main..feat/p2-foundation-class-ops`, lăng kính:
   - Bất biến seam: receiptCreate/enroll validate ClassBatch same-facility (NOT_FOUND); không đường vòng nào bỏ qua validate.
   - Auto-session: đếm buổi đúng (ngày×slot, biên ICT); re-generate idempotent (unique index + skipDuplicates); race tạo lớp đồng thời → mã lớp không trùng (counter atomic per facility+program+year).
   - RLS: bảng mới (Course/Room/ClassBatch/ScheduleSlot/ClassSession) có policy + fail-closed; `ClassBatchCodeCounter` exclusion hợp lý; GRANT cmc_app đúng least-privilege (không UPDATE/DELETE thừa).
   - Regression P1: 13 test file đã sửa (seedClassBatch) không làm yếu assertion gốc; `Facility.code` mới không phá P1 caller.
   - Room conflict: logic chồng giờ đúng biên (chạm mép = không conflict?).
2. Finding CRITICAL/HIGH → fix (subagent hoặc trực tiếp) + re-verify; MED/LOW → fix rẻ hoặc ghi backlog. **Cap 2 vòng review→fix**; cần vòng 3 = stop-condition (hỏi user).
3. Gates: typecheck/test/build/coverage/migrate status.
4. PR `feat/p2-foundation-class-ops → main` (body: scope + số liệu + reviewer notes) → merge → xoá branch → pull main.
5. Cập nhật `docs/project-changelog.md` (entry P2-Foundation — changelog hiện dừng ở mốc P1) + TL15 register (US-011). Harness: trace + intervention nếu có correction.

## Acceptance
Review verdict MERGE-READY (hoặc findings đã xử) · toàn suite xanh trên main sau merge · changelog/TL15 cập nhật · branch xoá.

## Risks / rollback
Merge = revert commit được; không migration phá huỷ (greenfield). Nếu reviewer tìm CRITICAL thuộc quyết định sản phẩm → STOP hỏi user (stop-condition).
