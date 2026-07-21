---
phase: 3
title: "Test-Backfill-Six-Modules"
status: completed
priority: P2
dependencies: []
---

# Phase 3: Test-Backfill-Six-Modules

## Overview
Bồi test thật (assertion thật — không stub, bài học lms-auth-two-tier) cho 6 điểm trống scout đã chỉ:
`appointment` (3 proc) · `reconciliation` (3) · `course` (2) · `room` (2) · `parentAccount` (1) ·
`class/schedule-router.ts` (1). PO chốt D2: đủ cả 6.

## Requirements
- Functional: mỗi procedure có ≥1 happy-path + ≥1 gate/âm-tính test; mutation có test hành vi thật
  (DB state trước/sau), không snapshot suông.
- Non-functional: theo pattern test DB hiện có (`apps/api/src/test/db.ts` — mỗi test seed Facility
  throwaway riêng, RLS boundary); chạy trong `pnpm test` root; không đụng cmc_prod.

## Architecture
Không code sản phẩm mới — chỉ test. Ưu tiên độ sâu theo rủi ro:
1. **reconciliation** (finance-adjacent, nền M3 AI): listFlags/dismiss/action — flag lifecycle, quyền
   (GĐKD/GĐĐT? — đọc registry khi viết), RLS âm tính cross-facility.
2. **parentAccount.updateEmail** (mutation PII): đúng roster (GĐKD/sale — registry index.ts:84),
   role khác FORBIDDEN, email normalize/validate, audit log ghi.
3. **schedule-router** (schedule.generate): sinh buổi đúng số lượng/ngày ICT, idempotence/double-call.
4. **appointment** (testAppointment lifecycle): schedule/complete đúng trạng thái, roster
   GĐKD/GĐĐT/sale.
5. **course** + **room** (CRUD mỏng): create/list happy-path + permission gate. Không phóng đại —
   CRUD test gọn.

## Related Code Files
- Create: `apps/api/src/reconciliation/recon-flags.test.ts` ·
  `apps/api/src/parentAccount/update-email.test.ts` ·
  `apps/api/src/class/schedule-generate.test.ts` ·
  `apps/api/src/appointment/appointment-lifecycle.test.ts` ·
  `apps/api/src/course/course-crud.test.ts` · `apps/api/src/room/room-crud.test.ts`
- Modify: không file sản phẩm nào (nếu test lộ bug thật → fix-forward PR riêng, ghi lại).

## Implementation Steps
1. Đọc router từng module TRƯỚC khi viết test (xác nhận roster quyền + zod input thật — không đoán).
2. Viết theo thứ tự rủi ro ở Architecture; mỗi file theo pattern seed-facility-riêng.
3. Chạy per-module trước (`vitest run src/<module>`), rồi full suite.
4. Nếu test lộ bug sản phẩm: DỪNG mở rộng, báo cáo bug + đề xuất fix riêng (không sửa test cho khớp
   bug).

## Success Criteria
- [ ] 6 file test mới, mỗi procedure ≥1 happy + ≥1 âm-tính; 0 `describe.skip`, 0 file 0-assertion.
- [ ] RLS âm tính cross-facility có mặt ở reconciliation + parentAccount (2 module nhạy nhất).
- [ ] Full suite xanh; số test tổng tăng, không test cũ nào bị nới.

## DB-safety (áp dụng mọi phase chạy test — red-team F6)
Test DB dùng `APP_DATABASE_URL`/`DATABASE_URL` từ env; hiện `apps/e2e/src/global-setup.ts` KHÔNG assert
target ≠ `cmc_prod` (DB pilot có super_admin seed). **Thêm guard fail-closed** trong global-setup (và
khuyến nghị test/db.ts): nếu tên DB khớp `cmc_prod` → throw ngay, không chạy. Live-verify OTP Phase 1 +
e2e parent-view Phase 2 chỉ chạy trên DB throwaway (`cmc_staging`), inbox test riêng. Đây là guard
1-lần dùng chung, đặt trong phase chạy sớm nhất (thực thi ở Phase 1 hoặc Phase 3 tùy thứ tự land).

## Risk Assessment
- **Test lộ bug thật trong module chưa từng test** — khả năng có thật (module chưa ai kiểm); protocol:
  bug = báo cáo + fix riêng, không nhét vào phase này.
- **Phồng thời gian ở CRUD mỏng** — cap: course/room mỗi file ≤6 test; đủ gate + happy là dừng (KISS).
- **Test đụng cmc_prod** — guard DB-safety ở trên (fail-closed theo tên DB).
