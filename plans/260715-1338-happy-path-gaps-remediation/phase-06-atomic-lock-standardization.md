---
phase: 6
title: Atomic-Lock Standardization
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 6: Atomic-Lock Standardization (pattern gốc #3, H5)

## Overview
Cơ chế "atomic claim/lock" áp dụng chuẩn ở vài nơi (receiptApprove, manualPunch.approve, rewards.redeem có advisory lock) nhưng anh em gần giống lại thiếu → `submission.grade` ghi đè im lặng, OTP request đua nhau, `ReconciliationFlag` tạo trùng (comment tưởng có unique constraint nhưng schema không có), email-reaper gửi trùng khi transport chậm. Chuẩn hoá.

## Requirements
- Functional: (a) 2 giáo viên chấm cùng bài → phát hiện conflict, không ghi đè im lặng; (b) không tạo `ReconciliationFlag` trùng dưới 2 lượt quét; (c) OTP request đua nhau không tạo trạng thái khó hiểu + có rate-limit theo identifier; (d) email-reaper phân biệt chậm vs crash.
- Non-functional: tái dùng pattern `updateMany`-claim / advisory-lock đã có; đổi schema có migration + dọn dữ liệu trùng trước.

## Architecture
- **grade (Học vụ #5):** đổi `findFirst`+`update` → `updateMany({where:{id, status:<expected>}, data})` rồi kiểm `count===1`; `count===0` → `conflict('Submission was modified concurrently')`. Mirror đúng `assessment.confirm:242-254`.
- **ReconciliationFlag (H5):** BẮT BUỘC **partial unique index** `WHERE status='open'` — KHÔNG dùng full unique. Lý do (red-team): flag có vòng đời open→dismissed/actioned; full unique trên `(facilityId,receiptId,kind)` sẽ chặn tạo flag `open` MỚI hợp lệ sau khi flag cũ cùng phiếu+loại đã dismissed (re-flag hợp lệ). Prisma schema không mô tả partial unique → tạo bằng **raw SQL trong migration**: `CREATE UNIQUE INDEX ... ON "ReconciliationFlag"(facilityId, receiptId, kind) WHERE status='open';`. Sau đó P2002-catch trong `maybeCreateFlag` mới có tác dụng đúng ngữ nghĩa "1 open flag/loại/phiếu tại một thời điểm". **Bước dọn:** data migration gộp flag `open` trùng sẵn có về 1 TRƯỚC khi tạo index (index tạo sẽ fail nếu còn trùng).
- **OTP (NS #6,#7):** thêm advisory lock theo phone/email trong `requestOtp`/`requestOtpEmail` (giống `checkin.punch` `FOR UPDATE`) để invalidate-then-insert atomic; thêm rate-limit đếm lần xin mã theo identifier. **Mặc định cụ thể (placeholder, chỉnh được như `GLOBAL_OTP_ENQUEUE_CAP_PER_HOUR` sẵn có):** tối đa **5 lần xin mã / 15 phút / mỗi số-điện-thoại-hoặc-email**, vượt → soft-block 15 phút (báo "thử lại sau"). Giữ nguyên cooldown 30s giữa 2 lần và 5-lần-thử-sai/mã sẵn có. Đặt hằng số có comment "pilot placeholder" để dễ chỉnh.
- **email-reaper (Gắn kết #2) — CHỐT (validate): at-least-once + idempotent-receive.** Không đầu tư lock phân tán (over-engineer cho email). Cụ thể: (a) tăng ngưỡng reap để giảm reap-nhầm transport chậm; (b) đảm bảo phía gửi mang idempotency key/message-id để lần gửi lại trùng bị dedup (hoặc vô hại). Ghi rõ tradeoff "hiếm khi gửi trùng, chấp nhận" trong comment.

## Related Code Files
- Modify: `apps/api/src/submission/router.ts:283-330` (`grade`)
- Modify: `packages/db/prisma/schema.prisma` (`ReconciliationFlag` — unique/partial index) + migration mới
- Modify: `apps/api/src/worker/reconcile-finance-flags.ts:66-72` (dựa vào P2002 sau khi có constraint)
- Modify: `apps/api/src/lms-auth/router.ts:186-209,299-327` (OTP request lock + rate-limit)
- Modify: `apps/api/src/worker/relay-email-outbox.ts:164-174` (reaper ngưỡng)
- Modify (test): siblings tương ứng
- Create: migration `packages/db/prisma/migrations/<ts>_reconciliation_flag_unique/`

## Implementation Steps (TDD)
1. **grade concurrency:** test đỏ — 2 grade đồng thời cùng submission → 1 xanh, 1 `conflict` (mirror test đua của `assessment.confirm`). Impl `updateMany`-claim. Xanh. Regression grade cũ.
2. **ReconciliationFlag unique:**
   a. Test đỏ — 2 lượt `scanFacility` (mô phỏng concurrent, hoặc gọi `maybeCreateFlag` 2 lần) → chỉ 1 flag. Chạy → đỏ (hiện tạo 2).
   b. Viết data-migration dọn flag trùng hiện có (gộp về 1 open/loại/phiếu).
   c. Thêm unique index (raw partial `WHERE status='open'` nếu cần). `prisma migrate dev`.
   d. Đảm bảo `maybeCreateFlag` catch P2002 → no-op. Chạy → xanh.
3. **OTP lock + rate-limit:** test đỏ — (a) 2 requestOtp đồng thời cùng phone → không để lại 2 pending mâu thuẫn; (b) xin mã > N lần trong cửa sổ → chặn. Impl advisory lock + counter. Xanh. Giữ test OTP happy-path xanh.
4. **email-reaper:** test đỏ — sending "chậm" (updatedAt gần) không bị reap; "crash" (updatedAt cũ) mới reap. Impl ngưỡng/heartbeat. Xanh. Ghi tradeoff nếu chấp nhận at-least-once.
5. **Regression:** `pnpm --filter @cmc/api test submission worker lms-auth` + `pnpm --filter @cmc/db` (migration/schema) + `pnpm typecheck` xanh.

## Success Criteria
- [ ] `grade` phát hiện concurrent-modify, không ghi đè im lặng.
- [ ] Không tạo `ReconciliationFlag` trùng (constraint thật + P2002-catch hoạt động); dữ liệu trùng cũ đã dọn.
- [ ] OTP request đua nhau không sinh trạng thái khó hiểu; có rate-limit theo identifier.
- [ ] email-reaper không gửi trùng do transport chậm (hoặc idempotent hoá + ghi tradeoff).

## Risk Assessment
- Rủi ro CAO: migration unique trên dữ liệu prod có flag trùng sẵn → `migrate deploy` fail. Mitigation BẮT BUỘC: data-migration dọn trùng CHẠY TRƯỚC trong cùng migration (hoặc migration tách 2 bước). Test trên bản sao dữ liệu.
- Rủi ro: partial unique index (`WHERE status='open'`) cần raw SQL — Prisma schema không mô tả được, phải quản qua migration thủ công + comment rõ.
- Rủi ro: email-reaper không thể phân biệt tuyệt đối chậm/crash → chấp nhận at-least-once là hợp lý; đừng over-engineer distributed lock nếu idempotent-receive rẻ hơn.
