---
phase: 8
title: Low-Severity Hygiene
status: completed
priority: P3
dependencies:
  - 1
---

# Phase 8: Low-Severity Hygiene (Đợt 4)

## Overview
Nhóm Low + latent + test hồi quy — không cấp bách nhưng scope đã chốt "toàn bộ 43". Làm gọn từng cái, TDD nhẹ. Bao gồm cả kết quả V2 (frontend role-array) từ Phase 1 nếu số điểm ít (không tách sub-plan).

## Requirements
- Functional: chặn input vô lý (slots, makeup date), wiring field chưa dùng (room isActive), chặn double-book meeting, snapshot giá gift, test hồi quy reject-after-deliver, cảnh báo staff khi HS đã có giám hộ.
- Non-functional: mỗi fix nhỏ, độc lập, không đụng logic tiền/quyền trọng yếu.

## Related Code Files
- Modify: `apps/api/src/class/class-batch-router.ts:16-25` (slots `.max(N)`, mirror `markAllInput.max(200)`)
- Modify: `apps/api/src/class/class-session-router.ts:167-205` (`addMakeup` — validate ngày trong `[batch.startDate,endDate]`)
- ~~room `isActive` wiring~~ — **DEFER (validate chốt):** chưa có nhu cầu thật + wire kéo theo admin UI (vượt scope BE). Ghi nhận latent trong `docs`/backlog, KHÔNG làm phase này. Bỏ khỏi Implementation Steps.
- Modify: `apps/api/src/meeting/router.ts:28-47` (double-book check theo slot/student)
- Modify: `apps/api/src/rewards/gift-router.ts:36-49` (snapshot `starsRequired` vào `Reward` lúc redeem — hoặc xác nhận `StarTransaction.amount` đã đủ audit, chỉ thêm test)
- Modify: `apps/api/src/rewards/reward-router.ts:184-242` (test hồi quy reject-after-deliver — guard đã đúng, chỉ thêm test)
- Modify: `apps/api/src/guardian/router.ts:96-118` (cảnh báo staff khi student đã có approved guardian — soft warning, không chặn multi-guardian)
- Modify (test): siblings tương ứng
- (Optional, thấp ưu tiên — Phase 1-V2 kết quả) 4 file dùng role-literal cho UI display/business-classification, KHÔNG phải cổng quyền (mutation thật đã qua `canDo()`): `apps/admin/src/pages/cockpit.tsx:211-213`, `pages/classes/class-detail.tsx:26`, `pages/hr/my-hr.tsx:49`, `pages/hr/salary-tiers.tsx:313,318,331`. Cân nhắc thay bằng hằng số/helper dùng chung cho nhất quán — KHÔNG bắt buộc, có thể bỏ nếu hết thời gian.

## Implementation Steps (TDD)
1. **slots max-cap:** test đỏ input > N slots → reject. Impl `.max(N)`. Xanh.
2. **addMakeup date-range:** test đỏ makeup ngoài `[start,end]` batch → reject. Impl validate. Xanh.
3. **meeting double-book:** CHỐT **cảnh báo, KHÔNG chặn** (họp là việc nhẹ, chặn cứng dễ phiền staff). Test đỏ: 2 meeting cùng student/slot → response mang cảnh báo, vẫn tạo. Impl soft-warn. Xanh.
4. **gift price snapshot:** quyết định — nếu `StarTransaction.amount` đã ghi giá lúc đổi (audit đủ) → chỉ thêm test khẳng định; nếu chưa → snapshot `starsRequired` vào `Reward`. Test tương ứng. Xanh.
5. **reject-after-deliver regression:** thêm test "reject reward đã delivered → BAD_REQUEST" (guard đã đúng, chống regress). Xanh.
6. **multi-guardian staff warning:** test đỏ — requestLink cho student đã có approved guardian → response mang cảnh báo cho staff (không chặn). Impl soft warning. Xanh.
7. **room isActive:** DEFER (đã chốt) — ghi nhận latent vào backlog/docs, không code phase này.
8. **(optional, có thể bỏ) frontend role-literal cleanup:** đổi 4 điểm trên sang hằng số dùng chung (KHÔNG phải security fix — chỉ hygiene/nhất quán). Bỏ qua nếu hết ngân sách phase.
9. **Regression:** `pnpm --filter @cmc/api test class meeting rewards guardian room` + `pnpm typecheck` (+ `pnpm lint`, `apps/admin`/`apps/lms` nếu chạm FE) xanh.

## Success Criteria
- [ ] slots/makeup date validated; input vô lý bị chặn.
- [ ] meeting double-book có cảnh báo (không chặn — chốt).
- [ ] gift price audit đủ (snapshot hoặc test khẳng định StarTransaction).
- [ ] test reject-after-deliver có, chống regress.
- [ ] staff được cảnh báo khi HS đã có giám hộ (không chặn co-parent hợp lệ).
- [ ] room isActive: defer có chủ đích, ghi nhận latent vào backlog (không code).
- [ ] (optional) frontend role-literal display logic gọn hơn — không bắt buộc để phase này DONE.

## Risk Assessment
- Rủi ro thấp toàn phase. Lưu ý duy nhất: room `isActive` wiring có thể kéo theo admin UI — nếu vượt scope BE, defer + ghi rõ thay vì làm nửa vời.
- multi-guardian: cảnh báo, KHÔNG chặn (đa giám hộ là hợp lệ — cha/mẹ/người giám hộ).
