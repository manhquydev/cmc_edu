---
title: "Phase 4: Tests e2e + config audit + docs"
status: todo
priority: P1
effort: "9h"
dependencies: [3]
---

# Phase 4: Tests e2e + config audit + docs

## Overview

Chứng minh end-to-end bằng Playwright (mock geolocation, kỷ luật tự-dọn trên suite
tuần tự dùng chung DB), cập nhật acceptance flow-manifest (nếu không: exit 1), thu
hẹp `TRUSTED_PROXY_CIDRS` prod + unit test resolveIp, ADR + docs. Gate "done" của plan.

## Requirements

- [ ] 3 e2e geo cases chạy trong `ui-e2e`, tự-dọn state, không phá journey khác.
- [ ] Cập nhật e2e `checkin-offsite-approval.journey.ui.spec.ts` theo dialog duyệt mới (phase 3).
- [ ] `scripts/acceptance-report/flow-manifest.ts` claim 6+ procedure mới → `acceptance:report` exit 0 (red-team L).
- [ ] `TRUSTED_PROXY_CIDRS` prod thu hẹp về đúng proxy + unit test resolveIp (red-team N).
- [ ] ADR + system-architecture.md.

## Architecture

**E2E** — suite: `apps/e2e/tests/journeys/`, tuần tự 1 worker 1 DB chung
(`apps/e2e/playwright.config.ts:100-103`, retry CI=1), facility chia sẻ
`E2E_FACILITY_ID` (`checkin-punch.journey.ui.spec.ts:33`). Ràng buộc red-team F:

- **Tự-dọn tuyệt đối**: mọi geofence tạo trong spec phải deactivate + delete trong
  `try/finally` (hoặc `test.afterAll`) — kể cả khi assertion fail; seeding idempotent
  (tìm-theo-label rồi xóa trước khi tạo) để retry CI không nhân đôi row.
- **Không phá precondition journey khác**: geofence chỉ active bên trong đoạn spec của
  mình; specs khác của run (`tests/journeys/checkin-punch`, `tests/journeys/checkin-offsite-approval`,
  `tests/attendance-lifecycle.spec.ts`) chạy với 0 geofence active như hôm nay.
- **Cleanup qua DB helper trong `test.afterAll`, KHÔNG qua UI** (R2): cleanup điều khiển
  bằng page sẽ chết cùng browser nếu spec crash, để lại geofence active làm hỏng punch
  của các spec sau. Assertion đi qua UI; dọn dẹp đi qua `apps/e2e/src/db.ts` (đường
  `withFacility bypass` — phase 1 đã giữ vế `bypass_rls` trong policy).

**Precondition thực tế của facility chung — phải xử lý, không giả định** (R2, 2 finding High):
- `tests/attendance-lifecycle.spec.ts:112` gọi `seedFacilityNetwork` tạo network **active**
  trên chính `E2E_FACILITY_ID` và KHÔNG dọn; nó thuộc project `api` chạy TRƯỚC mọi UI
  journey (`playwright.config.ts:109-127`, workers=1). `checkin-offsite-approval` cũng
  bật thêm network giữa run. ⇒ Khi spec geo chạy, facility gần như CHẮC CHẮN đã có
  network active → **confirm dialog "bật vùng đầu tiên" KHÔNG hiện** → assert dialog sẽ
  timeout đỏ mọi lần chạy.
  ⇒ Quyết định: e2e **xử lý dialog theo kiểu điều kiện** (`if (await dialog.isVisible())`),
  KHÔNG assert bắt buộc; hành vi confirm được chứng minh ở unit test UI phase 3.
- Gate `OFFSITE_REASON_REQUIRED` cần `hasShift` (router.ts:227). Case 2 và 3 đều PHẢI seed
  ca cùng ngày; `shift.submit` từ chối `fromDate` không tương lai nên dùng seam DB như
  `checkin-offsite-approval.journey.ui.spec.ts:152-168`. Case 2 và case 3 dùng **hai nhân
  viên khác nhau** — nếu dùng chung, ticket do case 2 tạo sẽ triệt tiêu modal của case 3
  (`existingTicket` bỏ qua reason gate).
- `seedApprovedShiftRegistration` cần `ShiftGroup`/`ShiftTemplate` tồn tại. Spec geo PHẢI
  tự tạo chúng qua `/admin/shift-config` với tên riêng cho spec (R3) — dựa vào leftover
  của `checkin-offsite-approval` là phụ thuộc thứ tự chạy, đúng thứ suite này cấm.

Playwright mock:

```ts
await context.grantPermissions(['geolocation']);
await context.setGeolocation({ latitude, longitude, accuracy: 30 });
```

Cases (đi qua NÚT PUNCH THẬT trên UI — không tRPC tắt; memory ci-green-prod-broken):
1. Seed geofence (label riêng, idempotent) quanh tọa độ A qua admin UI → activate
   (dialog xử lý điều kiện) → setGeolocation A → punch bằng NV_1 → thành công không hỏi
   lý do → **ĐỔI SANG phiên super_admin/người duyệt** rồi mới mở tab duyệt và assert
   NV_1 có trong "Chấm công GPS gần đây". (R4: NV_1 KHÔNG thấy được bảng này — nó nằm sau
   `manualPunch.approve` và còn tự loại hàng của chính caller. Đừng "sửa" bằng cách bỏ
   quy tắc loại-self, đó là thiết kế có chủ đích.)
2. NV_2 (có ca cùng ngày qua seam DB) + **geofence riêng của case này tạo bằng
   `seedFacilityGeofence({isActive:true, label riêng})`** + setGeolocation ngoài vùng →
   modal lý do hiện thông điệp "ngoài vùng".
3. NV_3 (có ca cùng ngày) + geofence riêng seed như case 2 + KHÔNG grantPermissions →
   punch vẫn ghi, modal lý do nhánh "không lấy được vị trí".

Phân vai rõ (R5 — nếu không, hoặc helper thành code chết, hoặc case 1 mất luồng UI):
case 1 tạo + bật **qua admin UI** để chứng minh luồng super_admin thật; case 2 và 3 seed
**qua `seedFacilityGeofence`** với label riêng, không phụ thuộc case 1 chạy trước/đậu.
`test.afterAll`: xóa geofence + punch/ticket của NV_1..3 qua DB helper.

**Acceptance flow-manifest** (red-team L): `scripts/acceptance-report/verify.ts:374-380`
exit 1 khi có procedure orphan. Thêm vào `scripts/acceptance-report/flow-manifest.ts`:
- `facilityGeofence.list/create/update/delete/testMyPosition` → flow admin cấu hình
  chấm công (mirror cách flow claim `facilityNetwork.*`).
- `checkInOut.geoPunchSummary`, `manualPunch.dayPunches` → flow duyệt chấm công.
- Map 3 journey spec mới vào flow tương ứng. Chạy lại screen-role matrix generator
  (workflow `ci.yml:100-105`) vì network-ip.tsx thêm section.

**Config audit chống fake-IP** (red-team N — audit THU HẸP, không phải presence-check):
- Thực tế hiện tại: prod compose + env example đang trust `172.16.0.0/12,10.0.0.0/8,
  127.0.0.1/32` — mọi peer RFC1918 (container bridge, LAN) giả được XFF → nhánh
  `network` (nhãn mạnh nhất) forgeable.
- **Không thể thu hẹp nếu IP còn động** (R2): `cmcv2-prod-net` khai báo `driver: bridge`
  KHÔNG có `ipam.config.subnet`, nginx không có `ipv4_address` → Docker cấp IP động.
  Ghim /32 hôm nay thì lần `docker compose up -d` sau nginx đổi IP: hoặc (a) proxy mất
  tin cậy → `resolveIp` trả IP container → mọi punch tại cơ sở thành offsite, hoặc (b)
  IP cũ rơi vào container khác → container KHÔNG phải proxy được quyền giả XFF.
  ⇒ Việc phải làm THEO THỨ TỰ, cùng 1 commit:
  1. Thêm `ipam: config: - subnet: <cấp phát riêng>` cho `cmcv2-prod-net`;
  2. Gán `ipv4_address` tĩnh cho service nginx;
  3. `TRUSTED_PROXY_CIDRS` = đúng /32 đó (sửa `docker-compose.prod.yml` + `.env.prod.example`);
  4. Comment trong compose nêu rõ ràng buộc "đổi IP nginx phải đổi env này".
- Cân nhắc boot-check từ chối giá trị `0.0.0.0/0`, `10.0.0.0/8`, `172.16.0.0/12` ở
  production (`boot-checks.ts` hiện chỉ kiểm tra biến CÓ TỒN TẠI).
- Test: **mở rộng `apps/api/src/context.trusted-proxy.test.ts` đã có sẵn** (R2 — không
  tạo file mới trùng): thêm case remoteAddr trusted → lấy rightmost non-trusted hop, nếu
  case đó chưa có.
- Document giới hạn IPv4-only của `ipMatchesCidr`/`detectMyIp` — cơ sở IPv6 rơi về
  offsite (degrade an toàn).

**Docs:**
- ADR mới `docs/decisions/00xx-geofence-gps-or-gate.md` (số kế tiếp): gate OR
  từng-nhánh-có-config; taxonomy 4 nhãn (`open` ≠ `network` — red-team K); ngưỡng
  accuracy per-geofence `accuracyMaxM` (default 200, dải 50–1000 — Validation Session 1)
  + thông điệp lỗi không-rò-vị-trí (chỉ `geoThresholdM`, anti-oracle); snapshot bằng
  chứng lúc ghi gồm cả ngưỡng đã dùng; **geo-day → payroll credit
  không duyệt là chủ đích** (kèm trade-off đã reject: tách cột gate); PII/retention:
  lưu raw coords+ip append-only làm bằng chứng, hiển thị tối thiểu; super_admin-only
  setup (quyết định user 2026-08-04).
- `docs/system-architecture.md`: mục checkin cập nhật 2 nhánh + bảng mới + env
  `TRUSTED_PROXY_CIDRS`.

## Related Code Files

- Create: `apps/e2e/tests/journeys/checkin-geofence.journey.ui.spec.ts` (3 cases)
- Modify: `apps/e2e/src/db.ts` — **helper mới phải tự viết** (R3: chưa có helper nào cho
  geofence, cũng chưa có delete punch/ticket theo AppUser; `getPrivilegedDb()` là
  module-private `db.ts:57` nên helper BẮT BUỘC nằm trong file này). **Hai đường DB khác
  nhau, đừng gộp** (R4):
  - `seedFacilityGeofence({facilityId, lat, lng, radiusM?, accuracyMaxM?, label?, isActive?})`
    → sao đúng khuôn `seedFacilityNetwork` (`db.ts:670`): `withFacility(getDb(), null, fn,
    { bypass: true })` — bảng có FORCE RLS nên phải đi vế `app.bypass_rls`.
  - `deleteFacilityGeofencesByLabel`, `deletePunchesAndTicketsForAppUsers` → `getPrivilegedDb()`
    (connection `DATABASE_URL`, role có DELETE; `cmc_app` KHÔNG có DELETE trên TimePunch —
    `20260707000000.../migration.sql:108`), giống mọi teardown hiện có ở `db.ts:402-414`.
- Modify: `apps/e2e/tests/journeys/checkin-offsite-approval.journey.ui.spec.ts` (dialog mới)
- Modify: `scripts/acceptance-report/flow-manifest.ts`
- Modify: `docker-compose.prod.yml` (ipam subnet + nginx ipv4_address + TRUSTED_PROXY_CIDRS), `.env.prod.example`
- Modify: `apps/api/src/context.trusted-proxy.test.ts` (mở rộng, không tạo file mới)
- Create: `docs/decisions/00xx-geofence-gps-or-gate.md`
- Modify: `docs/system-architecture.md`

## Implementation Steps

1. Cập nhật offsite-approval journey theo dialog phase 3; chạy suite local xác nhận xanh.
2. Viết 3 helper mới trong `apps/e2e/src/db.ts` — **seed qua `withFacility(...{bypass:true})`,
   xóa qua `getPrivilegedDb()`; xem Related Code Files, đừng dùng chung 1 connection** — rồi
   `checkin-geofence.journey.ui.spec.ts` (afterAll dọn qua helper + idempotent seed);
   chạy local theo recipe acceptance ledger (env vars, PLAYWRIGHT_UI, không override reporter).
3. Chạy CẢ SUITE ui-e2e local 2 lần liên tiếp — lần 2 xanh chứng minh không rò state.
4. Update flow-manifest + regen screen-role matrix; `pnpm acceptance:report` exit 0.
5. Pin ipam subnet + nginx ipv4_address → thu hẹp TRUSTED_PROXY_CIDRS → mở rộng
   `context.trusted-proxy.test.ts` → smoke prod-sim (dựng lại stack, punch 1 lần xác
   nhận IP nhận diện đúng).
6. Viết ADR + sửa system-architecture.md (≤800 dòng/file).
7. GitNexus `detect_changes({scope:"compare", base_ref:"main"})` — blast radius khớp kỳ vọng.
8. Push branch, PR; chờ `typecheck-and-test` + `ui-e2e` xanh (required checks).

## Success Criteria

- [ ] 3 geo cases + offsite-approval journey xanh local VÀ CI.
- [ ] Chạy suite 2 lần liên tiếp local đều xanh (không rò geofence state).
- [ ] `pnpm acceptance:report` exit 0, không orphan.
- [ ] `context.trusted-proxy.test.ts` phủ cả 2 chiều (peer không-trusted bỏ qua XFF; peer trusted lấy rightmost non-trusted hop).
- [ ] `TRUSTED_PROXY_CIDRS` prod = /32 tĩnh của nginx (subnet + ipv4_address đã pin; không còn 10/8, 172.16/12 trần).
- [ ] Prod-sim dựng lại sau khi pin IP: punch 1 lần nhận diện IP đúng (không thành offsite oan).
- [ ] ADR + system-architecture merged.
- [ ] PR xanh cả 2 required checks — điều kiện "done" của plan.

## Risk Assessment

- **Rò state suite chung** = rủi ro đỉnh của phase → try/finally + chạy-2-lần là gate.
- **Thu hẹp TRUSTED_PROXY_CIDRS làm sai resolveIp prod-sim** nếu đoán sai địa chỉ
  proxy → xác minh bằng docker network inspect trước khi sửa; test smoke prod-sim
  sau đổi.
- **setGeolocation mock deterministic** — rủi ro flake thấp.
- **Docs churn**: 1 ADR + 1 mục — trong giới hạn.
