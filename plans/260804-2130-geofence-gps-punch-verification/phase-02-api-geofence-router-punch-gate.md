---
title: "Phase 2: API geofence router + punch gate"
status: todo
priority: P1
effort: "7h"
dependencies: [1]
---

# Phase 2: API geofence router + punch gate

## Overview

Router CRUD `facilityGeofence` + `testMyPosition`, gate OR 4-nhãn trong
`checkInOut.punch` (kèm `appData.geoThresholdM` anti-oracle + snapshot bằng chứng), query
`dayPunches` (payload tối thiểu, gate đúng quyền) và `geoPunchSummary` (surface
không-phụ-thuộc-ticket cho ngày toàn-geo), re-backfill idempotent, hợp đồng payroll
khóa bằng test, rollback ghi sẵn.

## Requirements

- [ ] `facilityGeofence.list/create/update/delete` + audit log, mặc định inactive.
- [ ] `facilityGeofence.testMyPosition` cho nút "Kiểm tra".
- [ ] `checkInOut.punch`: geo optional, gate OR, `verification` 4 giá trị, snapshot
      snapshot 4 trường (`matchedGeofenceId`/`geofenceDistanceM`/`matchedRadiusM`/`matchedAccuracyMaxM`),
      `appData.geoThresholdM` khi offsite (không kèm vị trí/khoảng cách).
- [ ] `manualPunch.dayPunches`: payload tối thiểu, quyền đọc đúng.
- [ ] `checkInOut.geoPunchSummary`: đếm punch `geo` theo nhân viên (red-team B).
- [ ] Migration re-backfill idempotent (red-team D) + rollback notes (red-team G).
- [ ] Regression test hợp đồng payroll (red-team C).

## Architecture

**Gate — pseudocode chốt (plan.md #1–#3, #8):**

```ts
const networks  = await tx.facilityNetwork.findMany({ where: { facilityId, isActive: true } });
const geofences = await tx.facilityGeofence.findMany({ where: { facilityId, isActive: true } });

const openMode = networks.length === 0 && geofences.length === 0; // hành vi hôm nay
const ipMatch  = networks.length > 0 && networks.some((n) => ipMatchesCidr(callerIp, n.cidr));

// Ngưỡng accuracy per-geofence (Validation Session 1): g.accuracyMaxM, default 200
// Snapshot lúc ghi (red-team I): geofence KHỚP (d ≤ radiusM && accuracy ≤ accuracyMaxM),
// nếu không vùng nào khớp thì lưu khoảng cách tới vùng gần nhất
let snapshot = { matchedGeofenceId: null, geofenceDistanceM: null, matchedRadiusM: null, matchedAccuracyMaxM: null };
if (input.geo && geofences.length > 0) {
  const withDist = geofences.map((g) => ({ g, d: haversineDistanceM(input.geo!, g) }));
  const matched = withDist.find(({ g, d }) => d <= g.radiusM && input.geo!.accuracyM <= g.accuracyMaxM);
  const chosen = matched ?? minBy(withDist, (x) => x.d); // khớp, hoặc gần nhất làm bằng chứng
  snapshot = {
    matchedGeofenceId: matched ? matched.g.id : null,
    geofenceDistanceM: chosen.d,                    // khoảng cách tới TÂM vùng
    matchedRadiusM: chosen.g.radiusM,               // R2: ngưỡng đã dùng — thiếu thì số vô nghĩa
    matchedAccuracyMaxM: chosen.g.accuracyMaxM,
  };
}
const geoMatch = snapshot.matchedGeofenceId !== null;

const withinNetwork = openMode || ipMatch || geoMatch;
const verification =
  ipMatch ? 'network' : geoMatch ? 'geo' : openMode ? 'open' : 'none';
// 'open' hiển thị trung tính "không kiểm chứng" — KHÔNG claim network (red-team K)
```

Lưu ý biên: match là "geofence BẤT KỲ thỏa cả hai điều kiện" (không phải chỉ nearest) —
test 2-geofence: vùng gần nhất fail (ngoài radius hoặc accuracy vượt ngưỡng vùng đó)
nhưng vùng xa hơn pass → vẫn geoMatch.

**Giải thích lỗi geo — KHÔNG trả thông tin vị trí** (red-team J, sửa lại theo R2):

Bản nháp trước định trả `geoRejectReason: 'outside' | 'accuracy'` + khoảng cách. Đó là
**oracle định vị geofence**: đường throw xảy ra TRƯỚC `timePunch.create` (router.ts:224-240)
nên cooldown không kích hoạt (cooldown dựa vào punch row đã ghi, router.ts:185-196), và
middleware audit chỉ ghi mutation THÀNH CÔNG (trpc.ts:150-156) → dò tọa độ hàng loạt
không tốn phí, không để lại vết; vài lần thử là trilaterate ra tâm vùng.

Thiết kế thay thế — server chỉ trả thứ client **đã biết hoặc không dùng để định vị được**:

```ts
// Đính kèm error OFFSITE_REASON_REQUIRED khi facility có geofence active:
{ geoThresholdM: max(geofences.map(g => g.accuracyMaxM)) }   // KHÔNG khoảng cách, KHÔNG vị trí
```

Dùng `max` chứ KHÔNG phải `min` (R3): accuracy chỉ chắc chắn là nguyên nhân khi nó vượt
ngưỡng của MỌI vùng. Với `min`, người ở cách 5km với accuracy 350m (cơ sở có vùng
ngưỡng 200 và vùng ngưỡng 500) sẽ bị báo nhầm "sai số vượt ngưỡng" và loay hoay ra ngoài
trời chấm lại thay vì nhập lý do. Với `max`, trường hợp mơ hồ rơi về câu trung tính.

Client tự suy ra thông điệp (nó biết mình đã gửi geo hay chưa và accuracy của mình):
- không gửi geo → "không lấy được vị trí"
- `accuracyM > geoThresholdM` → "sai số ±Xm vượt ngưỡng Ym"
- còn lại → "bạn đang ngoài vùng cho phép"

Không có geofence active → không đính field (UI dùng message chung). Ghi nhận thẳng:
cooldown-không-kích-hoạt trên đường throw là hành vi CÓ SẴN trước plan này, không phải
lỗi mới; đóng oracle làm việc dò mất giá trị nên không mở rate-limit/audit trong scope này.

**Mở rộng error payload — thay đổi hợp đồng dùng chung** (R2): `AppCodeError` hiện chỉ
mang `appCode` và formatter chỉ copy đúng field đó, CÓ CHỦ ĐÍCH (comment tại
`apps/api/src/trpc.ts:56-69`: mọi lỗi khác serialize byte-identical để payload Prisma
không rò ra client). Vì vậy:
- Thêm field TYPED, allowlist: `readonly appData?: { geoThresholdM?: number }` trên
  `AppCodeError`; formatter copy đúng `appData` (không spread tự do).
- `apps/api/src/errors.ts` + `apps/api/src/trpc.ts` NẰM TRONG scope phase này.
- Test giữ hợp đồng: một non-AppCodeError vẫn serialize y hệt trước (mở rộng
  `apps/api/src/trpc-error-formatter.test.ts`).

`ensureDayTicket`/reason-gate giữ nguyên, vẫn ăn theo `withinNetwork`.

**punchInput mở rộng** (checkin/router.ts:57):

```ts
geo: z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100_000),
}).optional(),
```

`timePunch.create` lưu `lat/lng/accuracyM` khi client gửi (kể cả offsite — bằng chứng,
plan.md #10) + `verification` + **cả 4 trường của object `snapshot` ở trên**
(`matchedGeofenceId`, `geofenceDistanceM`, `matchedRadiusM`, `matchedAccuracyMaxM`).
Bỏ sót 2 trường ngưỡng ⇒ dialog duyệt phase 3 render "cách tâm 180m (bán kính —)" vô
nghĩa, và lỗi chỉ lộ ở phase 3 sau khi test phase 2 đã xanh.

**Migration re-backfill** (red-team D — phòng P1 và P2 ship lệch deploy): migration
mới trong phase này:

```sql
UPDATE "TimePunch" SET "verification" = 'open' WHERE "withinNetwork" AND "verification" = 'none';
```

Idempotent; nếu ship chung 1 PR thì vô hại (0 rows).

**Geofence router** — `apps/api/src/facility/geofence-router.ts`, sao khuôn
`network-router.ts`: permission `facilityNetwork.manage` (super_admin-only — plan.md #6),
`withFacility`, audit log create/update/delete với data snapshot. Zod: lat/lng range
như trên, `radiusM: z.number().int().min(100).max(2000)`,
`accuracyMaxM: z.number().int().min(50).max(1000).default(200)` (Validation Session 1),
`label: z.string().max(200).default('')`. Create luôn `isActive: false`. RLS (phase 1) là tầng chặn cross-facility cho
update/delete-by-id — thêm test khẳng định.

`testMyPosition` (query, cùng permission): input `{lat,lng,accuracyM}` → trả
`Array<{id, label, isActive, radiusM, accuracyMaxM, distanceM, accuracyOk, within}>`.
**`within` dùng ĐÚNG predicate của gate** (R4 — nếu chỉ so khoảng cách thì admin đứng
trong nhà accuracy 400m thấy "TRONG vùng, cách 30m", bật vùng, rồi cả cơ sở bị chặn ở
nhánh accuracy — phá đúng luồng "Kiểm tra trước khi bật"):

```ts
accuracyOk = input.accuracyM <= g.accuracyMaxM
within     = distanceM <= g.radiusM && accuracyOk
```

Trả kèm `accuracyMaxM` + `accuracyOk` để phase 3 hiện được "TRONG vùng nhưng sai số ±Xm
vượt ngưỡng Ym".

**dayPunches** (red-team H — payload tối thiểu + quyền đúng):

```ts
dayPunches: requirePermission('manualPunch', 'approve')  // reviewer surface
  .input(z.object({ ticketId: z.string().uuid() }))
```

- Quyền: `requirePermission('manualPunch','approve')` + track-check qua helper mới
  `canReviewTicket(...)` (tách phần boolean của `assertCanReviewTicket` — KHÔNG try/catch
  quanh hàm approve/reject để tránh error message sai ngữ cảnh). Owner xem ticket của
  mình dùng dữ liệu đã có trên ticket — KHÔNG cần endpoint này.
- **Query PHẢI khóa 2 chiều** (R2 — nếu chỉ lọc facility+ngày thì GĐ mở 1 ticket sẽ
  thấy punch của toàn cơ sở, phá đúng cách ly track mà `assertCanReviewTicket` bảo vệ):

```ts
const dateKey = ictDateOnlyOf(ticket.ticketDate);
where: { facilityId, appUserId: ticket.appUserId,
         punchAt: { gte: ictToUtc(dateKey,'00:00'), lt: ictToUtc(addDaysToDateOnly(dateKey,1),'00:00') } }
```

- Response: `{punchAt, verification, accuracyM, geofenceDistanceM, matchedRadiusM}[]` —
  snapshot từ punch row (kèm bán kính để "cách tâm 180m" đọc được nghĩa). KHÔNG trả
  raw lat/lng, KHÔNG trả ip (PII — plan.md #10).

**geoPunchSummary** (red-team B — surface cho ngày toàn-geo, không có ticket):

```ts
geoPunchSummary: requirePermission('manualPunch', 'approve')
  .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
```

**KHÔNG tái dùng filter track của ticket-inbox** (R2): filter đó map GĐ → `sale`/
`giao_vien`, mà chính hai role giám đốc CŨNG có `checkIn.punch` (`packages/auth/src/index.ts:117`)
→ punch geo của giám đốc rơi vào vùng mù của đúng bề mặt sinh ra để lộ pattern.

Scope đúng — **không lọc theo role gì cả** (R3: lọc `AppUser.roles hasSome [...]` là lọc
trạng thái HIỆN TẠI để hiển thị bằng chứng LỊCH SỬ → ai đổi/xóa role là biến mất khỏi
đúng bề mặt sinh ra để lộ pattern; mà chỉ người có `checkIn.punch` mới tạo được TimePunch
nên lọc cũng không lọc thêm được gì): group `TimePunch` theo `appUserId` với
`facilityId + verification='geo' + punchAt >= cutoff`, join `AppUser` lấy `fullName`,
bỏ hàng của chính caller khi caller có AppUser (super_admin không có → thấy tất cả).
Trả `{appUserId, fullName, geoPunchCount, lastGeoPunchAt}` cho punches `verification='geo'`
trong N ngày. Chỉ đếm — không tọa độ.

**Rollback notes** (red-team G, sửa theo R2): revert phase 2 = revert code + remediation
SQL bằng migration role. Cảnh báo R2: chỉ lật `withinNetwork=false` là **mất lương vĩnh
viễn không kháng nghị được** — `manualPunch.create` đã bị ADR 0043 xóa (router.ts:258-262)
nên không ai tạo được ticket cho ngày quá khứ, mà `resolveDayCredit` trả `NOT_VALID`
(0 credit) khi không all-within và không có ticket duyệt (resolve-day-credit.ts:46-55).

Remediation phải gồm CẢ HAI bước, trong 1 transaction:

```sql
-- 1) Lật cờ các punch geo-admitted:
UPDATE "TimePunch" SET "withinNetwork" = false
WHERE "verification" = 'geo' AND "punchAt" >= '<thời điểm deploy>';

-- 2) Tạo ticket pending cho từng (appUserId, ngày ICT) bị ảnh hưởng.
--    R3: cặp checkIn/checkOut phải tính trên TOÀN BỘ punch của ngày đó, KHÔNG chỉ punch
--    'geo' — ngày hỗn hợp (sáng WiFi 'network', chiều GPS 'geo' — đúng kịch bản Goal 1)
--    nếu chỉ lấy geo sẽ ra checkInAt=punch chiều, checkOutAt=NULL → resolveDayCredit
--    yêu cầu ĐỦ CẶP (resolve-day-credit.ts:53) → ticket duyệt xong vẫn 0 credit, mà
--    resubmit chỉ sửa status/note chứ không sửa giờ (router.ts:385-388) ⇒ không cứu được.
--    Đây chính là ngữ nghĩa ensureDayTicket dùng (router.ts:88-95).
--    Biểu thức ngày ICT phải khớp CHÍNH XÁC `ictToUtc(dateKey,'00:00')` mà app dùng:
--    `ticketDate` lưu THỜI ĐIỂM UTC của nửa đêm ICT (không phải kiểu date). Sai biểu thức
--    ⇒ ON CONFLICT không khớp ticket đang có VÀ resolveDayCredit tra không thấy row.
--    ICT là UTC+7 cố định (ICT_OFFSET_MINUTES=420, packages/domain-time/src/index.ts:7),
--    'Asia/Bangkok' cũng UTC+7 quanh năm, không DST ⇒ dùng được:
--      date_trunc('day', X AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'
INSERT INTO "ManualAttendanceTicket" (id, "facilityId", "appUserId", "ticketDate",
  status, note, "checkInAt", "checkOutAt", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."facilityId", p."appUserId",
       date_trunc('day', p."punchAt" AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok',
       'pending', 'Rollback geofence — cần duyệt thủ công',
       min(p."punchAt"), CASE WHEN count(*) >= 2 THEN max(p."punchAt") END, now(), now()
FROM "TimePunch" p
WHERE (p."appUserId",
       date_trunc('day', p."punchAt" AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok') IN (
        SELECT g."appUserId",
               date_trunc('day', g."punchAt" AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'
        FROM "TimePunch" g
        WHERE g."verification" = 'geo' AND g."punchAt" >= '<thời điểm deploy>')
GROUP BY p."facilityId", p."appUserId",
         date_trunc('day', p."punchAt" AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'
ON CONFLICT ("appUserId", "ticketDate") DO NOTHING;
```

Trước khi chạy trên prod: đối chiếu 1 ngày mẫu — `SELECT` biểu thức trên cho vài punch
và so với `ictToUtc(ictDateOnlyOf(punchAt),'00:00')` tính bằng app; hai giá trị phải bằng nhau.

Giới hạn đã biết, nêu thẳng khi revert: ngày chỉ có ĐÚNG 1 punch tổng cộng vẫn 0 credit
(checkOutAt NULL — quy tắc ADR 0043, không đổi ở đây); ticket đã `rejected` sẵn cho
ngày đó không bị mở lại (`ON CONFLICT DO NOTHING`) → nếu muốn mở lại phải chạy UPDATE
riêng, quyết định lúc revert.

Nếu chọn KHÔNG chạy bước 2, phải nói thẳng trong PR revert: "credit các ngày đó bị mất,
không có đường kháng nghị" — và cần user đồng ý trước.

## Related Code Files

- Create: `apps/api/src/facility/geofence-router.ts`
- Create: `apps/api/src/facility/geofence-router.test.ts`
- Modify: `apps/api/src/checkin/router.ts` (punchInput, gate, create data, dayPunches, geoPunchSummary, canReviewTicket helper)
- Create: `apps/api/src/checkin/punch-geo-gate.test.ts`
- Create: `packages/db/prisma/migrations/<ts>_verification_rebackfill/migration.sql`
- Modify: `apps/api/src/router.ts` (đăng ký facilityGeofence)
- Modify: `apps/api/src/errors.ts` (AppCodeError.appData typed — R2)
- Modify: `apps/api/src/trpc.ts` (formatter copy appData — R2)
- Modify: `apps/api/src/trpc-error-formatter.test.ts` (giữ hợp đồng byte-identical)
- Modify (test-only): `apps/api/src/attendance/resolve-day-credit.test.ts` hoặc test mới — hợp đồng payroll

## Implementation Steps

1. GitNexus `impact({target: "checkInOutRouter", direction: "upstream"})` + `impact({target: "ensureDayTicket"})` — báo blast radius.
2. Viết `geofence-router.ts` + đăng ký; migration re-backfill.
3. Sửa gate theo pseudocode; KHÔNG đụng cooldown/lock/ticket logic.
4. Tách `canReviewTicket` boolean helper; thêm `dayPunches`, `geoPunchSummary`.
5. Tests (pattern testDb như `ip-match.test.ts`, `punch-offsite.test.ts`):
   - Ma trận gate: {open-mode, chỉ-network, chỉ-geofence, cả hai} × {ip khớp/không,
     geo trong/ngoài/thiếu/accuracy == ngưỡng (pass)/ngưỡng+1 (fail)} — ≥12 case, gồm
     biên `distance == radiusM`, case 2-geofence (vùng gần fail, vùng xa pass → match),
     case ngưỡng custom (accuracyMaxM=500: accuracy 350 pass vùng đó, fail vùng default 200).
   - `verification` đúng 4 nhãn; `appData.geoThresholdM` = **max** accuracyMaxM khi có
     geofence active (test 2 vùng ngưỡng 200/500 → trả 500), absent khi không có; error
     KHÔNG chứa khoảng cách/tọa độ (anti-oracle).
   - Hợp đồng error: một lỗi non-AppCodeError serialize y hệt trước khi sửa formatter.
   - Snapshot: `matchedGeofenceId`/`geofenceDistanceM`/`matchedRadiusM`/`matchedAccuracyMaxM`
     ghi đúng; sửa geofence sau đó KHÔNG đổi giá trị đã lưu.
   - Xóa geofence đã từng khớp punch → DELETE thành công (không FK), `dayPunches` vẫn
     render snapshot (R2).
   - Cross-facility RLS: role `cmc_app` + facility context A không update/delete được geofence B (nền phase 1).
   - **Hợp đồng payroll** (red-team C): ngày 2 punch `verification='geo'` →
     `resolveDayCredit` full credit không cần ticket — khóa hành vi có chủ đích.
   - `dayPunches`: GĐ đúng track + có permission đọc được; sale/GĐ sai track bị chặn;
     payload không chứa lat/lng/ip; **punch của nhân viên KHÁC cùng ngày KHÔNG lọt vào
     response** (seed 2 nhân viên — R2).
   - `geoPunchSummary`: **punch geo của một giám đốc hiện ra cho giám đốc còn lại và cho
     super_admin** (R2 — chống vùng mù); không hiện hàng self.
   - Offsite cả hai nhánh → `OFFSITE_REASON_REQUIRED` + ticket (giữ hành vi, test cũ pass nguyên trạng).
6. `pnpm --filter @cmc/api test` + GitNexus `detect_changes()` trước commit.

## Success Criteria

- [ ] Toàn bộ matrix + hợp đồng payroll pass; test checkin cũ pass KHÔNG sửa.
- [ ] Cơ sở chỉ-có-geofence: IP lạ + không geo → `verification='none'`, cần lý do, error mang `geoThresholdM` (client suy ra "không lấy được vị trí").
- [ ] Cơ sở chỉ-có-network: geo hợp lệ nhưng không geofence config → không geoMatch.
- [ ] Cross-facility update/delete bị chặn (test role cmc_app).
- [ ] Audit log đủ create/update/delete geofence.
- [ ] Payload dayPunches không chứa raw coords/ip (test assert shape).

## Risk Assessment

- **Sai ngữ nghĩa open-mode / nearest-vs-any** = rủi ro #1 → matrix + case 2-geofence bắt buộc.
- **Thiếu GRANT/RLS từ phase 1** → punch 500: success criterion phase 1 đã gate; test
  cmc_app ở đây là lưới thứ hai.
- **Quyền dayPunches**: dùng `requirePermission('manualPunch','approve')` — KHÔNG
  protectedProcedure trần (red-team H).
- **Rollback**: remediation SQL ở trên; cột phase 1 revert-an-toàn.
