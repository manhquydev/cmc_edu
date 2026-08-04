---
title: "Phase 1: Schema + geo helper"
status: todo
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Schema + geo helper

## Overview

Nền dữ liệu: bảng `FacilityGeofence` (đủ RLS + GRANT), 8 cột mới trên `TimePunch`,
helper Haversine + unit tests, sửa teardown test/e2e cho bảng mới. Chưa đổi hành vi —
deploy phase này xong hệ thống chạy y cũ.

## Requirements

- [ ] Model `FacilityGeofence` + migration ĐỦ RLS/FORCE/policy/GRANT (red-team A).
- [ ] `TimePunch` thêm `lat`, `lng`, `accuracyM`, `verification`, `matchedGeofenceId`, `geofenceDistanceM`, `matchedRadiusM`, `matchedAccuracyMaxM` + index + backfill.
- [ ] Helper `haversineDistanceM` + unit tests.
- [ ] Teardown helpers biết bảng mới (red-team F: FK violation).

## Architecture

Prisma schema (đặt cạnh `FacilityNetwork`, ~`packages/db/prisma/schema.prisma:1131`):

```prisma
model FacilityGeofence {
  id         String   @id @default(uuid())
  facilityId String
  lat          Float
  lng          Float
  radiusM      Int
  accuracyMaxM Int      @default(200) // ngưỡng sai số GPS chấp nhận (m); validation 50-1000 ở API (Validation Session 1)
  label        String   @default("")
  isActive   Boolean  @default(false) // PO philosophy: range mới không bao giờ tự kích hoạt
  createdAt  DateTime @default(now()) @db.Timestamptz(3)

  facility Facility @relation(fields: [facilityId], references: [id])

  @@index([facilityId])
}
```

`TimePunch` (schema.prisma:1160) thêm (red-team I: snapshot bằng chứng lúc ghi):

```prisma
  lat                 Float?
  lng                 Float?
  accuracyM           Float?
  verification        String  @default("none") // 'network' | 'geo' | 'open' | 'none'
  matchedGeofenceId   String?                  // geofence khớp lúc punch (null nếu không geoMatch); KHÔNG FK — xem ghi chú dưới
  geofenceDistanceM   Float?                   // khoảng cách tới TÂM vùng (khớp, hoặc gần nhất khi không khớp) LÚC PUNCH
  matchedRadiusM      Int?                     // R2: ngưỡng ĐÃ DÙNG để chấp nhận — thiếu nó thì "cách 180m" vô nghĩa
  matchedAccuracyMaxM Int?                     // R2: ngưỡng accuracy đã dùng, cùng lý do
```

**Migration — checklist bắt buộc** (red-team A + P; `prisma migrate dev` KHÔNG sinh
RLS/GRANT, và repo có tiền sử `migrate dev` re-bundle drift — `docs/project-changelog.md:289`):

SQL dưới đây đã ĐỐI CHIẾU với policy thật (R2: bản nháp trước dùng sai tên GUC
`app.facility_id` và thiếu vế bypass → policy luôn false cho `cmc_app` → gate đọc 0
geofence → tưởng openMode → **fail-open toàn hệ thống**). Template chuẩn:
`20260712000000_hr_remediation.../migration.sql:27-35` (có FORCE):

```sql
ALTER TABLE "FacilityGeofence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FacilityGeofence" FORCE ROW LEVEL SECURITY;
CREATE POLICY "FacilityGeofence_facility_isolation" ON "FacilityGeofence"
  USING (
    "facilityId" = current_setting('app.current_facility_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON "FacilityGeofence" TO cmc_app;
-- Backfill (migration role — bypass append-only grant của cmc_app):
-- 'open' chứ KHÔNG phải 'network': lịch sử không có kiểm chứng nào chạy (red-team K)
UPDATE "TimePunch" SET "verification" = CASE WHEN "withinNetwork" THEN 'open' ELSE 'none' END;
```

Hai vế của USING đều BẮT BUỘC: `app.current_facility_id` là GUC `withFacility` thật sự
set (`packages/db/src/index.ts:66`); vế `app.bypass_rls` giữ đường `withFacility(...,
{bypass:true})` mà e2e seed/cleanup helper dùng — thiếu nó thì phase 4 dọn dẹp fail ở
tầng DB. GRANT đủ 4 quyền vì router phase 2 có update/delete (tiền lệ
`20260716120000_facility_network_delete_grant` là bản vá vì thiếu đúng grant này).

**`matchedGeofenceId` KHÔNG có FK — có chủ đích** (R2): geofence hard-deletable, mà
TimePunch append-only với `cmc_app` → nếu đặt relation thì mọi geofence từng khớp punch
sẽ không xóa được vĩnh viễn. Snapshot id được phép dangling; màn duyệt đọc
`geofenceDistanceM`/`matchedRadiusM` đã lưu, không join. Đừng "hoàn thiện" schema bằng
cách thêm `@relation`.

**Index cho `geoPunchSummary`** (R2 — TimePunch chỉ có `@@index([facilityId, appUserId])`,
query mới lọc facilityId + verification + khoảng punchAt sẽ scan toàn lịch sử):

```prisma
  @@index([facilityId, punchAt])
```

**Teardown helpers** (red-team F — FK violation khi delete Facility):
- `apps/e2e/src/db.ts`: thêm `privileged.facilityGeofence.deleteMany({ where: { facilityId } })`
  cạnh `facilityNetwork.deleteMany` (khối `:402-414`, mọi dòng đều chạy trên `privileged`)
  — bắt buộc TRƯỚC `db.facility.deleteMany`; thêm bảng mới vào `assertNoFacilityResidue`
  (`:426-455`) nếu không nó sẽ không bao giờ báo rò rỉ geofence.
- `apps/api/src/test/db.ts:130-132,187`: tương tự.

**Helper** — `apps/api/src/checkin/geo-distance.ts` (chỉ API dùng — plan.md #7):

```ts
/** Great-circle distance (m) — Haversine, đủ chính xác cho bán kính < vài km. */
export function haversineDistanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number
```

Thêm quan hệ `geofences FacilityGeofence[]` vào model `Facility`.

## Related Code Files

- Modify: `packages/db/prisma/schema.prisma` (FacilityGeofence, TimePunch, Facility relation)
- Create: `packages/db/prisma/migrations/<ts>_facility_geofence_and_punch_verification/migration.sql`
- Create: `apps/api/src/checkin/geo-distance.ts`
- Create: `apps/api/src/checkin/geo-distance.test.ts`
- Modify: `apps/e2e/src/db.ts` (teardown + residue)
- Modify: `apps/api/src/test/db.ts` (teardown)

## Implementation Steps

1. Blast-radius scan: grep `withinNetwork` toàn apps/ + packages/ (red-team C sửa recipe
   cũ `timePunch.` — miss consumers nhận punch qua tham số). Kỳ vọng ~13 file, gồm
   `attendance/resolve-day-credit.ts:46`, `payroll/router.ts:351`, `kpi/auto-score.ts:235`
   — ghi nhận, KHÔNG sửa các file này (hợp đồng khóa bằng test ở phase 2).
2. Sửa schema.prisma; **`prisma migrate dev --create-only --name facility_geofence_and_punch_verification`**
   (dev-pg :5433). BẮT BUỘC `--create-only` (R2): nếu apply trước rồi mới hand-append,
   dev DB không bao giờ chạy khối RLS/GRANT/backfill VÀ checksum lệch → lần `migrate dev`
   kế tiếp (phase 2 cần) dừng với "migration modified after apply" + gợi ý reset phá dữ liệu.
3. **Gate nội dung migration** (red-team P): xác minh migration.sql chứa ĐÚNG VÀ CHỈ
   các statement kỳ vọng (1 CREATE TABLE, index của FacilityGeofence, FK
   FacilityGeofence→Facility, ALTER TABLE TimePunch 8 cột, index
   `TimePunch(facilityId, punchAt)`; KHÔNG có FK cho `matchedGeofenceId`; không drift lạ).
   Có statement lạ → dừng, reconcile drift trước.
4. Hand-append khối RLS/GRANT/backfill như Architecture vào file CHƯA apply, rồi
   `prisma migrate dev` (không cờ) để apply toàn bộ.
5. Sửa 2 teardown helper.
6. Viết `geo-distance.ts` + test: HN↔HCM ~1140km sai số <1%, điểm trùng = 0, ~200m thực tế, đối xứng.
7. `pnpm --filter @cmc/db build && pnpm typecheck`; `prisma migrate diff` với DB dựng
   từ migrations sạch (recipe changelog) — không lệch.
8. **Kiểm chứng RLS bằng psql, không bỏ qua** (R5 — nếu không có bước này thì 4 tiêu chí
   DB dưới đây không có phương tiện nào chạy, và lỗi policy sai kiểu R2-1 lọt thẳng qua
   phase 1). Trên dev-pg :5433:
   - privileged role: INSERT 1 geofence cho facility A.
   - `SET ROLE cmc_app; SET app.current_facility_id = '<A>';` → SELECT phải ra **1 row**
     (ra 0 row = policy sai GUC ⇒ gate sẽ hiểu nhầm openMode ⇒ fail-open, DỪNG NGAY).
   - đổi `app.current_facility_id` sang facility B → SELECT phải ra **0 row**; UPDATE/DELETE
     theo id của A phải ảnh hưởng **0 row**.
   - `SET app.bypass_rls = 'on'` → đọc lại thấy row (vế bypass hoạt động, e2e cleanup cần).
   - UPDATE/DELETE trong đúng context A → thành công (GRANT đủ).
   - backfill: `SELECT verification, count(*) FROM "TimePunch" GROUP BY 1` khớp phân bố `withinNetwork`.

## Success Criteria

- [ ] Migration apply sạch; `prisma migrate diff` không lệch schema.
- [ ] Kết nối role `cmc_app`: SELECT/INSERT/UPDATE/DELETE FacilityGeofence hoạt động
  TRONG facility context; cross-facility bị RLS chặn (test ở phase 2 dùng nền này).
- [ ] **Anti-fail-open** (R2): ghi 1 geofence bằng role privileged → `cmc_app` trong
  đúng facility context PHẢI đọc thấy nó (policy đúng GUC). Nếu đọc 0 rows thì gate sẽ
  hiểu nhầm là openMode. **Chạy bằng step 8 (psql).**
- [ ] `app.bypass_rls='on'` đọc được geofence (vế bypass hoạt động — e2e cleanup phụ thuộc). **Step 8.**
- [ ] Row TimePunch cũ: `withinNetwork=true → verification='open'`, `false → 'none'` (spot-check SQL).
- [ ] Teardown e2e/test không FK-violation khi facility có geofence — kiểm bằng cách seed
  1 geofence rồi chạy teardown helper của `apps/api/src/test/db.ts` trong một test tạm/psql.
- [ ] `geo-distance.test.ts` pass; typecheck pass; test checkin hiện có pass nguyên trạng.

## Risk Assessment

- **Quên RLS/GRANT** = phase 2 chết toàn bộ punch → checklist migration là gate cứng,
  success criterion test dưới role `cmc_app`.
- **`migrate dev` re-bundle drift** (tiền sử P4) → step 3 gate nội dung.
- **Backfill bảng lớn**: TimePunch nội bộ còn nhỏ — 1 UPDATE chấp nhận được.
- **Rollback phase 1**: cột mới optional/default, bảng mới chưa ai đọc — revert code là đủ.
