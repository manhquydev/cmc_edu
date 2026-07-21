---
phase: 1
title: "Schema & migration"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Schema & migration

## Overview
Thêm cột cho mô hình mới mà không rename model (KISS): `TimePunch.withinNetwork`
(cờ trong/ngoài mạng) và `ManualAttendanceTicket.checkInAt`/`checkOutAt` (cặp giờ
hiển thị + duyệt). Giữ append-only grants + RLS như hiện có.

## Requirements
- Functional: mọi punch mới lưu được cờ `withinNetwork`; phiếu chấm công lưu được
  cặp giờ vào/ra. Dữ liệu punch cũ (offsite vốn bị từ chối) mặc định `withinNetwork=true`.
- Non-functional: migration idempotent, không phá RLS (ADR 0042), không cấp thêm
  DELETE/UPDATE ngoài phạm vi cần.

## Architecture
- `TimePunch`: thêm `withinNetwork Boolean @default(true)`. Default true đúng lịch
  sử (trước đây offsite bị từ chối nên mọi punch đã lưu đều trong mạng).
- `ManualAttendanceTicket`: thêm `checkInAt DateTime? @db.Timestamptz(3)`,
  `checkOutAt DateTime? @db.Timestamptz(3)` (nullable — phiếu do luồng punch điền).
- **Red-team R3 — 1 phiếu/ngày:** thêm **unique index `(appUserId, ticketDate)`**
  để chặn đua tạo 2 phiếu cùng ngày (mô hình mới: mỗi ngày tối đa 1 phiếu). Lưu ý:
  phải kiểm dữ liệu cũ có trùng (appUserId,ticketDate) không trước khi thêm unique
  (manualPunch.create cũ cho phép nhiều phiếu/ngày qua resubmit tạo row mới). Nếu
  có trùng → migration dọn (giữ row mới nhất) trước khi tạo unique.
- KHÔNG rename model/bảng (tránh sửa RLS policy, mọi reference, migration nặng).
- `ManualAttendanceTicket` cần UPDATE grant sẵn có (đã có, vì approve/reject
  update status) → đủ để cập nhật checkInAt/checkOutAt.
- Migration mới: `packages/db/prisma/migrations/<ts>_attendance_daily_inout/migration.sql`
  — `ALTER TABLE "TimePunch" ADD COLUMN "withinNetwork" BOOLEAN NOT NULL DEFAULT true;`
  + 2 `ALTER TABLE "ManualAttendanceTicket" ADD COLUMN ... TIMESTAMPTZ(3);`

## Related Code Files
- Modify: `packages/db/prisma/schema.prisma` (models `TimePunch`, `ManualAttendanceTicket`)
- Create: `packages/db/prisma/migrations/<ts>_attendance_daily_inout/migration.sql`
- Modify (nếu cần regenerate): `packages/db/src/index.ts` (chỉ nếu export type đổi)

## TDD Test Plan (test-first)
1. **RED**: viết `packages/db` (hoặc `apps/api/src/checkin`) test khẳng định:
   - Có thể tạo `TimePunch` với `withinNetwork: false` và đọc lại đúng.
   - Có thể set `checkInAt`/`checkOutAt` trên `ManualAttendanceTicket`, đọc lại đúng.
   - Punch tạo không set cờ → mặc định `withinNetwork === true`.
   - RLS negative test hiện có (cross-facility) vẫn pass sau migration.
2. **GREEN**: thêm cột + chạy migration → test xanh.

## Implementation Steps
1. RED: thêm test schema-shape (dùng `apps/api/src/test/db.ts` helper hoặc db package test).
2. Sửa `schema.prisma` thêm 3 cột.
3. Tạo migration SQL thủ công (dự án dùng migration checked-in — xem
   `20260712000000_hr_remediation...`), đặt tên `<ts>_attendance_daily_inout`.
4. Chạy `pnpm --filter @cmc/db prisma migrate` (hoặc quy trình local-sim: docker
   Git Bash + socat sidecar — xem memory `cmc-localsim-ops-quirks`).
5. GREEN: chạy test → xanh. Regenerate Prisma client nếu cần.

## Success Criteria
- [ ] `TimePunch.withinNetwork` + `ManualAttendanceTicket.checkInAt/checkOutAt` tồn tại.
- [ ] Unique `(appUserId, ticketDate)` trên `ManualAttendanceTicket` (dọn trùng trước).
- [ ] Punch cũ/không set cờ → `withinNetwork=true`.
- [ ] Migration checked-in, apply sạch trên DB trống + DB có sẵn dữ liệu.
- [ ] RLS cross-facility test vẫn pass.
- [ ] `pnpm typecheck` xanh sau regenerate client.

## Risk Assessment
- **Rủi ro:** default `withinNetwork=true` cho punch cũ — đúng lịch sử nhưng nếu có
  môi trường từng tắt IP-gate thì punch offsite cũ bị coi là hợp lệ. Mitigation:
  dự án greenfield chưa go-live thật (validate s4 plan cũ) → chấp nhận; ghi rõ trong
  migration comment.
- **Rủi ro:** quên regenerate client → typecheck đỏ ở phase sau. Mitigation: bước 5.
