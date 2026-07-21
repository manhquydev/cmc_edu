---
phase: 1
title: "DB schema & migrations"
status: pending
priority: P1
dependencies: []
effort: "6h"
---

# Phase 1: DB schema & migrations

## Overview
Nền schema cho toàn đợt. Đã hấp thụ red-team findings #2/#3/#6/#7/#16: bổ sung backfill attribution + approvedAt, session-done columns, sửa premise ticket-lock, SQL CHECK chính xác.

## Requirements
- Functional: schema đủ cho phase 2/7/3/4; backfill không mất data; RLS facility-scope cho bảng mới.
- Non-functional: migration idempotent, chạy trên cmc_prod/cmc_staging local-sim (docker qua Git Bash).

## Related Code Files
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<ts>_hr_remediation_policy_quota_reject_done/migration.sql`
- Modify: `apps/api/src/finance/router.ts` (receiptCreate ghi `createdByAppUserId`; receiptApprove ghi `approvedAt`)
- Modify: `apps/api/src/class/class-batch-router.ts` — **router hiện KHÔNG có mutation update** (chỉ create/list/listStudents/get — R2 #C5): thêm mutation mới **`classBatch.assignTeacher({classBatchId, teacherAppUserId})`** (permission `class.manage` hiện có hoặc GĐĐT — theo pattern router) ghi `teacherAppUserId`; `create` cũng resolve khi input có teacher. UI picker ở phase 5.
- Pattern tham chiếu: migrations `20260707030000_*` (CHECK), `20260707020000_*` (partial unique idx — WHERE `status='submitted'` ONLY)

## Schema changes
1. **Model `CompensationPolicy`**: `id`, `facilityId @unique`, `penaltyRatePerLateMinute Decimal(14,2) default 500`, `penaltyRatePerEarlyMinute Decimal(14,2) default 1000`, timestamps. RLS + grants `cmc_app` SELECT/INSERT/UPDATE (không DELETE — pattern Payslip).
2. **Model `SalaryTier`** (validate s3): `id`, `facilityId`, `name`, `type ShiftGroupType`, `baseSalary Decimal(14,2)`, `unitRate Decimal(14,2)`, `requiredShifts Int`, `requiredMetric Decimal(14,2)` (GV: giờ; sale: VND), **`updatedById String?`** (audit R3-9), timestamps. `@@unique([facilityId, name])`, RLS + grants pattern CompensationPolicy. **`SalaryRate` thêm `tierId String?` FK + NULLABLE-hóa 3 cột cũ `baseSalary`/`variablePayRate`/`kpiMax`** (R3-4 — greenfield, không writer mới; `compensation.upsertRate` BỎ ở phase 2).
3. **`KpiScore`**: thêm `metricValue Decimal(14,2)?`, `quotaSnapshot Decimal(14,2)?`, `shiftActual Int?`, `shiftRequired Int?`, **`unitRateSnapshot Decimal(14,2)?`, `tierIdSnapshot String?`** (R3-9 — phiếu tự tái lập được value); **`kpiMax` → nullable** (R3-5 — không dùng nữa).
3b. **`ShiftGroup` thêm `@@unique([facilityId, name])`; `ShiftTemplate` thêm `@@unique([shiftGroupId, name])`** (R3-11 — natural key cho seed idempotent + chặn catalog trùng).
4. **`ShiftRegistration`**: thêm `rejectReason String?`; CHECK status: **DROP + ADD** (Postgres không alter CHECK):
   ```sql
   ALTER TABLE "ShiftRegistration" DROP CONSTRAINT "ShiftRegistration_status_check";
   ALTER TABLE "ShiftRegistration" ADD CONSTRAINT "ShiftRegistration_status_check"
     CHECK (status IN ('draft','submitted','approved','cancelled','rejected')) NOT VALID;
   ALTER TABLE "ShiftRegistration" VALIDATE CONSTRAINT "ShiftRegistration_status_check";
   ```
   **Ticket-lock idx GIỮ NGUYÊN** — WHERE clause thực tế là `status = 'submitted'` ONLY (migration 20260707020000:5, KHÔNG phải draft|submitted như bản plan cũ viết sai). `rejected` ∉ WHERE → lock tự giải phóng. **Non-goal: KHÔNG mở rộng idx sang draft** (đổi hành vi user-visible: hiện nhiều draft đồng thời là hợp lệ).
5. **`ManualAttendanceTicket`**: ADD CHECK `status IN ('pending','approved','rejected','resubmitted')` (NOT VALID + VALIDATE; chạy `SELECT DISTINCT status` trước trên prod-sim để chắc không có giá trị lạ).
6. **`Receipt.approvedAt DateTime? @db.Timestamptz(3)`** + **backfill trong cùng migration**:
   ```sql
   UPDATE "Receipt" SET "approvedAt" = "updatedAt" WHERE status = 'approved' AND "approvedAt" IS NULL;
   ```
   (Approximation có chủ đích — `updatedAt` có thể bị receiptCancel/touch làm lệch; chấp nhận 1 lần, ghi docs. Finding #6.)
7. **Backfill `Receipt.createdByAppUserId`** (hiện 0 writers — finding #2):
   ```sql
   UPDATE "Receipt" r SET "createdByAppUserId" = au.id
   FROM "AppUser" au WHERE au."userId" = r."createdById" AND r."createdByAppUserId" IS NULL;
   ```
   + `finance.receiptCreate` bắt đầu ghi `createdByAppUserId` (resolve AppUser từ `ctx.subject.userId`).
8. **`ClassBatch.teacherAppUserId` write path** (hiện 0 writers, `teacherId` scalar NULL toàn bộ — R2 #C5 xác nhận backfill từ teacherId ≈ 0 dòng, chấp nhận): mutation `assignTeacher` mới + create resolve. Backfill SQL vẫn chạy (match được dòng nào hay dòng đó) nhưng KHÔNG kỳ vọng data; GĐĐT gán GV qua UI phase 5 sau deploy.
9. **Session-done columns** (phase 7 dùng): `SessionStatus` enum thêm `done` — `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (tiền lệ 20260707180000:17); `ClassSession.doneAt DateTime? @db.Timestamptz(3)`; **`ClassSession.makeupForSessionId String? @unique`** (self-FK — idempotency buổi bù, R2 #2). **INVARIANT (R2 #M4, tiền lệ 20260706160000:15-17): KHÔNG được DÙNG giá trị `'done'` (UPDATE/CHECK/index có 'done') trong CÙNG file migration với ADD VALUE — backfill session-done của phase 7 phải là migration/script RIÊNG.**

10. **Seed catalog ca cố định** — upsert theo unique keys §3b (idempotent thật): group KINH_DOANH (SINGLE) — ca1 08:30-18:00, ca2 10:00-20:00, ca3 13:00-21:00; group GIAO_VIEN (MULTIPLE) — ca1 08:00-12:00, ca2 13:00-17:00, ca3 17:00-21:00. Nghỉ trưa/giữa ca chỉ ghi docs (phạt per-ca dùng punch vào/ra của ca — phase 2). Group/template do user tạo trước đó (nếu có trên môi trường dev): giữ nguyên, seed chỉ thêm thiếu — greenfield nên không có ràng buộc prod.

## Implementation Steps (TDD)
1. Tests trước (pattern `apps/api/src/test/`): (a) ShiftRegistration status `rejected` OK / giá trị rác fail; (b) ManualAttendanceTicket status rác fail; (c) CompensationPolicy unique per facility + RLS cross-facility chặn; (d) backfill: seed Receipt kiểu cũ (createdById=userId, approved, approvedAt null) → chạy backfill SQL → cột đúng.
2. Sửa schema + viết migration SQL tay cho CHECK/backfill/enum.
3. `prisma migrate dev` + regenerate; typecheck toàn repo + **`pnpm --filter @cmc/admin typecheck`** (gate từ đây — finding #11 hệ quả).
4. Sửa finance/class-batch writers + test nhỏ cho mỗi writer.

## Success Criteria
- [ ] Migration sạch trên DB local-sim; 4 nhóm constraint/backfill tests xanh.
- [ ] `SELECT COUNT(*) FROM "Receipt" WHERE status='approved' AND "approvedAt" IS NULL` = 0 sau migrate.
- [ ] `receiptCreate` mới ghi cả 2 cột attribution; class-batch ghi `teacherAppUserId`.
- [ ] Không sửa ticket-lock index (diff migration không đụng idx).

## Risk Assessment
- **Rollback ≠ an toàn dữ liệu**: drop `SalaryTier`/`tierId`/`metricValue`/`quotaSnapshot`/`shiftActual`/`shiftRequired`/`rejectReason` sẽ MẤT data operator đã nhập (finding #16) — trước rollback bắt buộc dump. Không claim "không xoá data".
- `ALTER TYPE ADD VALUE` chạy được trong per-migration tx của Prisma trên PG12+ NHƯNG giá trị mới không dùng được trong cùng tx — risk thật là ai đó nhét backfill/'done'-reference vào cùng file (đã chặn bằng invariant §9), không phải version PG.
- Backfill approvedAt là approximation — ghi rõ trong docs/20 phase 6.
