---
title: "geofence-gps-punch-verification"
description: "Gate OR (IP-match hoặc GPS-trong-vùng) + nhãn phân tầng verification cho chấm công HR; admin setup geofence không cần kỹ thuật"
status: in-progress
priority: P1
effort: "26h"
tags: [checkin, attendance, geofence, hr]
created: 2026-08-04
blockedBy: []
blocks: []
---

# geofence-gps-punch-verification

## Overview

Nâng cấp cổng xác thực vị trí của chấm công HR (ADR 0043). Hiện tại `checkInOut.punch`
chỉ có 1 nhánh: IP caller khớp `FacilityNetwork` CIDR. Plan này thêm nhánh 2 — tọa độ
GPS trong bán kính quanh cơ sở (`FacilityGeofence`) — với gate **OR**: thỏa 1 trong 2
là hợp lệ (không cần lý do, không tạo ticket). GPS là đường dự phòng khi WiFi/mạng cơ
sở trục trặc. Mỗi punch mang nhãn `verification: network | geo | open | none`; punch
chỉ-qua-GPS (nhánh dễ giả) hiển thị trên 2 bề mặt duyệt: dialog chi tiết ticket VÀ
bảng "Chấm công GPS gần đây" không phụ thuộc ticket (red-team B: ngày toàn-geo không
sinh ticket nên phải có surface riêng).

Nghiệp vụ duyệt ticket giữ nguyên 100%: cả hai nhánh fail → bắt lý do + ticket như cũ.

Nguồn quyết định: advise interview 2026-08-04 (threat model: chống nhầm lẫn vận hành là
chính, gian lận chủ động xử bằng vết + nhãn; scope chỉ HR punch, không đụng điểm danh
học viên). Research: `plans/reports/research-260804-2112-checkin-location-verification-report.md`.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Nhân viên đứng tại cơ sở luôn chấm được kể cả khi WiFi cơ sở hỏng (4G + GPS) | P1 |
| 2 | Punch nhãn `geo` hiện trên dialog ticket VÀ bảng geo-punch định kỳ cho giám đốc — kể cả ngày không có ticket | P1 |
| 3 | super_admin setup geofence < 1 phút: tại cơ sở dùng "vị trí hiện tại", từ xa dán tọa độ Google Maps (quyết định user: giữ key `facilityNetwork.manage`, super_admin-only) | P1 |
| 4 | GPS không bao giờ chặn punch (denied/timeout → punch vẫn ghi, rơi về luồng cũ) | P1 |
| 5 | Làm vững nhánh IP: cảnh báo CIDR rộng, thu hẹp `TRUSTED_PROXY_CIDRS` prod về đúng proxy, document IPv4-only | P1 |

## Non-goals

- Chặn tuyệt đối giả GPS (bất khả thi trên web — DevTools/mock location/gọi API thẳng).
- Heuristic phát hiện bất thường (IP-geolocation cross-check, vận tốc phi lý) — để sau
  nếu bảng geo-punch lộ pattern lạm dụng thật.
- Native app / WiFi BSSID / BLE beacon / QR động / auto clock-in theo vùng.
- Điểm danh học viên (`teaching/attendance`) — ngoài phạm vi.
- Hỗ trợ IPv6 cho `ipMatchesCidr` — chỉ document giới hạn.
- Key permission mới cho giám đốc cơ sở — user đã chốt super_admin-only.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Schema + geo helper](./phase-01-start.md) | Done |
| 2 | [Phase 2: API geofence router + punch gate](./phase-02-api-geofence-router-punch-gate.md) | Done |
| 3 | [Phase 3: Admin UI setup + punch capture + labels](./phase-03-admin-ui-setup-punch-capture-labels.md) | Done |
| 4 | [Phase 4: Tests e2e + config audit + docs](./phase-04-tests-e2e-config-audit-docs.md) | Partial — code/docs done; ui-e2e/CI/acceptance not proven |

Dependencies: 1 → 2 → 3 → 4 (tuần tự). Toàn plan ship trong MỘT PR (đóng cửa sổ
deploy-lệch P1/P2 — red-team D; P2 vẫn mang re-backfill idempotent phòng ship lẻ).

## Kiến trúc quyết định (chốt sau advise + red-team, không mở lại)

1. **Gate OR từng-nhánh-có-config**:
   - `openMode = 0 network active && 0 geofence active` → within, như hành vi hôm nay.
   - Nhánh IP chỉ xét khi có ≥1 network active; nhánh GEO chỉ xét khi có ≥1 geofence active.
   - `withinNetwork = openMode || ipMatch || geoMatch` (giữ column, ngữ nghĩa credit giữ nguyên).
2. **Nhãn 4 giá trị**: `verification = 'network'` (ipMatch) | `'geo'` (chỉ geoMatch) |
   `'open'` (openMode — within nhưng KHÔNG có kiểm chứng nào chạy, hiển thị trung tính
   "không kiểm chứng") | `'none'` (offsite). Network thắng geo khi cả hai match.
   Backfill lịch sử: `withinNetwork=true → 'open'` (trung thực — không claim kiểm chứng
   chưa từng chạy; red-team K), `false → 'none'`.
3. **Ngưỡng accuracy per-geofence** (validation 2026-08-04, thay hard-code 200):
   cột `FacilityGeofence.accuracyMaxM` (default 200, dải 50–1000) — admin chỉnh được
   cho cơ sở trong nhà GPS kém. geoMatch với vùng g yêu cầu `d ≤ g.radiusM` VÀ
   `accuracyM ≤ g.accuracyMaxM`. Khi fail nhánh geo, server đính `appData.geoThresholdM`
   (= **`max`** accuracyMaxM của các vùng active — `max` chứ không phải `min`: accuracy chỉ
   chắc chắn là nguyên nhân khi vượt ngưỡng của MỌI vùng; dùng `min` sẽ báo nhầm "sai số
   vượt ngưỡng" cho người ở cách xa hàng km) vào `OFFSITE_REASON_REQUIRED` — **không kèm
   khoảng cách/vị trí** (R2: trả 'outside'/'accuracy' + distance biến endpoint punch thành
   oracle định vị geofence, dò không tốn phí vì đường throw không ghi punch nên cooldown
   không kích hoạt và audit không ghi). Client tự suy thông điệp từ state của nó —
   vẫn đạt mục tiêu red-team J (kịch bản WiFi-chết-trong-nhà không còn fail im lặng).
4. **GPS optional tuyệt đối**: input `geo` optional; client timeout 8s; mọi lỗi → punch không kèm geo.
5. **Geofence mặc định `isActive=false`**; UI bật vùng ĐẦU TIÊN khi cơ sở có 0 network
   active phải confirm cảnh báo "tắt chế độ mở" (red-team E).
6. **Permission**: tái dùng `facilityNetwork.manage` — roster rỗng = super_admin-only
   (user chốt 2026-08-04). Goal 3 hiểu theo điều kiện đó.
7. **Haversine helper tại `apps/api/src/checkin/geo-distance.ts`** — chỉ API dùng;
   nút "Kiểm tra" đi qua endpoint server để giữ 1 nguồn tính.
8. **Snapshot bằng chứng lúc ghi** (red-team I): punch lưu `matchedGeofenceId` +
   `geofenceDistanceM` tính TẠI THỜI ĐIỂM punch — màn duyệt hiển thị snapshot, không
   recompute trên config mutable.
9. **Payroll contract nêu tên + test** (red-team C): geo-verified day → full credit
   không cần duyệt là HỆ QUẢ CÓ CHỦ ĐÍCH của gate OR (quyết định user). Blast radius:
   `apps/api/src/attendance/resolve-day-credit.ts:46`, `apps/api/src/payroll/router.ts:351`,
   `apps/api/src/kpi/auto-score.ts:235`. ADR ghi rõ + regression test khóa hợp đồng.
   (Reject đề xuất tách cột gate riêng — đảo quyết định OR của user.)
10. **PII tối thiểu hóa hiển thị** (red-team H): DB lưu raw lat/lng/ip làm bằng chứng
    (append-only); payload cho reviewer CHỈ gồm nhãn + `geofenceDistanceM` + `accuracyM`
    — không raw coords, không ip. Retention ghi vào ADR.

## Success Criteria

- [x] IP không khớp + GPS trong vùng (accuracy ≤ ngưỡng vùng) → punch `withinNetwork=true`, `verification='geo'`, không hỏi lý do (unit test chứng minh).
- [x] Cả hai nhánh fail → `OFFSITE_REASON_REQUIRED` (+`appData.geoThresholdM`, không kèm khoảng cách) + ticket y hệt hiện tại; test checkin hiện có pass không sửa.
- [x] Từ chối quyền GPS / timeout → punch vẫn thành công.
- [x] 0 network + 0 geofence active → open mode giữ hành vi hôm nay, nhãn `open`.
- [x] Cross-facility `facilityGeofence.update/delete` theo id bị RLS chặn (test dưới role `cmc_app`).
- [x] Ngày toàn-geo hiện trong bảng "Chấm công GPS gần đây" của giám đốc dù không có ticket.
- [x] Dialog duyệt ticket hiện nhãn + khoảng-cách-snapshot cho từng punch trong ngày.
- [x] Geo-verified day → `resolveDayCredit` full credit (regression test khóa hợp đồng payroll).
- [x] super_admin tạo + test + kích hoạt geofence không cần nhập tọa độ tay khi đứng tại cơ sở.
- [x] Cảnh báo CIDR rộng hơn /29; cảnh báo bật-geofence-đầu-tiên khi 0 network.
- [ ] `pnpm acceptance:report` exit 0 (manifest đã claim procedure mới) — needs full artifact run.
- [ ] `typecheck-and-test` + `ui-e2e` xanh trên CI (required checks) — after PR.

## Risk summary

Rủi ro đỉnh sau red-team: (1) RLS/GRANT bảng mới — phase 1 có checklist migration
bắt buộc + test cross-facility; (2) e2e phá suite chung (facility chia sẻ, teardown FK)
— phase 1 sửa teardown, phase 4 quy tắc tự-dọn; (3) mở rộng `withinNetwork` chạm
payroll — hợp đồng test + ADR; (4) secure-context: geolocation cần HTTPS/localhost —
prod https OK, local-sim localhost OK.

## Red Team Review

### Session — 2026-08-04
**Findings:** 26 thô → 15 cụm sau dedupe (15 accepted, 1 rejected-partial)
**Severity:** 3 Critical, 8 High, 4 Medium — tất cả có bằng chứng file:line

| # | Finding | Sev | Disposition | Applied To |
|---|---------|-----|-------------|------------|
| A | Migration thiếu RLS+FORCE+GRANT → punch 500, IDOR cross-facility | Critical | Accept | P1 |
| B | Nhãn geo vô hình với ngày toàn-geo (không ticket → không surface) | Critical | Accept | P2, P3 |
| C | Payroll/KPI consumers không được nêu; geo → credit không duyệt | Critical | Accept (ADR + test; reject tách cột gate — đảo quyết định user) | P2, P4 |
| D | Cửa sổ deploy P1→P2 ghi verification sai | High | Accept (1 PR + re-backfill idempotent) | P2 |
| E | Bật geofence đầu tiên giết open-mode giữa ngày | High | Accept (confirm dialog + test) | P3 |
| F | E2E: geofence active rò suite chung + FK teardown | High | Accept | P1, P4 |
| G | Không rollback path cho data geo-credited | High | Accept (remediation SQL ghi sẵn) | P2 |
| H | dayPunches lộ tọa độ nhà + IP, gate sai | High | Accept (minimize payload + đúng permission) | P2 |
| I | distanceM recompute trên geofence mutable | High | Accept (snapshot lúc ghi) | P1, P2 |
| J | accuracy>200 fail im lặng kịch bản chủ đạo | Med | Accept — **remedy bị R2-2 thay thế: KHÔNG làm `geoRejectReason`, làm `appData.geoThresholdM`** | P2, P3 |
| K | Open-mode nhãn 'network' = chứng nhận láo | Med | Accept (giá trị 'open', backfill true→open) | P1, P2 |
| L | acceptance:report exit 1 vì orphan procedures | High | Accept (flow-manifest + matrix) | P4 |
| M | Reviewer modal dòng 329 không tồn tại | High | Accept (thiết kế Dialog chi tiết mới + budget test/e2e) | P3 |
| N | TRUSTED_PROXY_CIDRS prod trust cả RFC1918 | High | Accept (thu hẹp + unit test resolveIp) | P4 |
| O | facilityNetwork.manage = super_admin-only vs Goal 3 | Med | User quyết: GIỮ super_admin-only, Goal 3 sửa lời | plan.md |
| P | migrate dev từng re-bundle drift | Med | Accept (gate "chỉ chứa đúng statements" + migrate diff) | P1 |

### Whole-Plan Consistency Sweep
Đã rà 5 file sau khi áp finding: taxonomy 4 giá trị nhất quán (không còn "3 giá trị"/
`'network'|'geo'|'none'`); backfill `true→'open'` nhất quán P1/P2; bỏ mọi tham chiếu
"modal quanh dòng 329"; claim TRUSTED_PROXY_CIDRS sửa theo thực tế prod compose;
dayPunches payload minimize nhất quán P2/P3. Không còn mâu thuẫn mở.

### Session 2 — 2026-08-04 (sau khi áp R1 + validation)
**Findings:** 20 thô → 18 cụm sau dedupe (18 accepted)
**Severity:** 2 Critical, 8 High, 8 Medium — tất cả có bằng chứng file:line
**Lưu ý:** 3 finding là lỗ hổng MỚI do chính bản vá R1 mở ra (J→oracle, J/N→error contract, N→proxy pinning).

| # | Finding | Sev | Applied To |
|---|---------|-----|------------|
| R2-1 | **RLS SQL trong plan sai thật**: dùng `app.facility_id` (không tồn tại) + thiếu vế `bypass_rls` → policy luôn false → gate đọc 0 geofence → tưởng openMode → **fail-open toàn hệ thống** | Critical | P1 |
| R2-2 | **`geoRejectReason` = oracle định vị geofence**: throw trước khi ghi punch ⇒ cooldown không kích hoạt; audit chỉ ghi mutation thành công ⇒ dò tọa độ không để lại vết → thay bằng chỉ trả `geoThresholdM`, client tự suy thông điệp | Critical | P2, P3 |
| R2-3 | Mở rộng error payload là thay đổi hợp đồng dùng chung (`errors.ts`/`trpc.ts` cố tình chỉ copy `appCode`) — ngoài scope P2 | High | P2 |
| R2-4 | Snapshot thiếu `matchedRadiusM`/`matchedAccuracyMaxM` → "cách vùng 1800m" trên punch geo-verified vô nghĩa/gây hiểu lầm ở bán kính lớn | High | P1, P2, P3 |
| R2-5 | `geoPunchSummary` mù chính 2 role giám đốc (họ cũng có `checkIn.punch`) → vùng mù ở nhóm đặc quyền nhất | High | P2, P3 |
| R2-6 | Thu hẹp `TRUSTED_PROXY_CIDRS` bất khả thi: `cmcv2-prod-net` cấp IP động (không ipam/ipv4_address) → phải pin subnet + IP nginx trước; test `context.trusted-proxy.test.ts` ĐÃ tồn tại | High | P4 |
| R2-7 | Rollback SQL hứa "duyệt lại" nhưng `manualPunch.create` đã bị ADR 0043 xóa → mất lương vĩnh viễn; remediation phải INSERT ticket pending | High | P2 |
| R2-8 | `migrate dev` apply TRƯỚC hand-append → dev DB không có RLS + checksum lệch chặn migrate lần sau → dùng `--create-only` | High | P1 |
| R2-9 | E2E case 1: facility chung LUÔN có network active trước (attendance-lifecycle chạy project `api` trước UI, không dọn) → confirm dialog không hiện → assert timeout đỏ mọi lần | High | P4 |
| R2-10 | E2E case 2 thiếu precondition `hasShift` → modal lý do không bao giờ hiện; case 2/3 phải khác nhân viên (ticket triệt tiêu gate) | High | P4 |
| R2-11 | `dayPunches` chưa nêu filter `appUserId` + ngày ICT → nguy cơ lộ punch toàn cơ sở qua 1 ticket | Med | P2 |
| R2-12 | `geoPunchSummary` không có index (TimePunch chỉ có `[facilityId, appUserId]`) → scan toàn lịch sử mỗi lần mở tab | Med | P1 |
| R2-13 | Không có confirm khi TẮT vùng cuối → im lặng về chế độ mở, auto-credit vô hình | Med | P3 |
| R2-14 | `matchedGeofenceId` FK: phải nêu rõ KHÔNG FK, nếu không implementer thêm relation → xóa geofence hỏng vĩnh viễn | Med | P1, P2 |
| R2-15 | Symbol ảo `PunchTab` (thật: `CheckInTab`) — cùng loại lỗi với "modal dòng 329" của R1 | Med | P3 |
| R2-16 | E2E cleanup phải qua DB helper trong `afterAll`, không qua UI (crash browser = không dọn) | Med | P4 |
| R2-17 | Tham chiếu sai path `attendance-lifecycle` (ở `tests/`, không phải `tests/journeys/`) | Med | P4 |
| R2-18 | Phase 4 effort 5h không thực tế sau khi phình scope → 9h (tổng 26h) | Med | P4, plan.md |

### Whole-Plan Consistency Sweep (R2)
Đã verify lại bằng đọc source, không tin claim: policy thật (`20260707000000:93-99` +
template FORCE `20260712000000:27-35`), `CheckInTab` tại `check-in-out.tsx:451`,
`context.trusted-proxy.test.ts` tồn tại, `cmcv2-prod-net` không có ipam
(`docker-compose.prod.yml:28-29`), `attendance-lifecycle.spec.ts` ở `apps/e2e/tests/`.
Mọi tham chiếu `geoRejectReason` cũ đã thay bằng `geoThresholdM`; `PunchTab` → `CheckInTab`;
snapshot 4 trường nhất quán P1/P2/P3. Không còn mâu thuẫn mở.

### Session 3 — 2026-08-04 (kiểm tra hội tụ, 1 reviewer)
**Verdict: READY_TO_IMPLEMENT.** 8/8 bản vá R2 verify đúng với source (RLS SQL byte-correct;
anti-oracle không rò vị trí; `appData` giữ hợp đồng byte-identical; `gen_random_uuid()` +
ON CONFLICT hợp lệ; `--create-only` đúng trình tự Prisma; index phục vụ đúng query;
scope geoPunchSummary phủ được giám đốc; e2e conditional-dialog + tách nhân viên đúng).
4 finding cục bộ, đã fold, reviewer xác nhận không cần vòng nữa:

| # | Finding | Sev | Applied To |
|---|---------|-----|------------|
| R3-1 | Rollback SQL gom cặp punch CHỈ từ hàng `geo` → ngày hỗn hợp (sáng WiFi, chiều GPS — đúng kịch bản Goal 1) ra `checkOutAt=NULL` → ticket duyệt xong vẫn 0 credit, resubmit không sửa được giờ ⇒ phải gom trên TOÀN BỘ punch của ngày bị ảnh hưởng | High | P2 |
| R3-2 | `geoThresholdM` dùng `min` → báo nhầm "sai số vượt ngưỡng" cho người ở cách 5km khi cơ sở có nhiều ngưỡng ⇒ dùng `max` | Med | P2, P3 |
| R3-3 | `geoPunchSummary` lọc theo `AppUser.roles` (trạng thái hiện tại) để hiện bằng chứng lịch sử → đổi role là biến mất; lọc cũng vô ích ⇒ bỏ lọc role | Med | P2 |
| R3-4 | E2E cleanup dựa vào helper KHÔNG tồn tại (`getPrivilegedDb` private, chưa có helper geofence/xóa punch) + thiếu tiền đề ShiftGroup/Template ⇒ nêu rõ helper phải viết + spec tự tạo shift-config | Med | P4 |

### Session 4 — 2026-08-04 (tấn công bản vá R3 + đọc lạnh)
Hai góc: (a) tự verify 4 bản vá R3 với source; (b) reviewer đọc lạnh toàn plan như dev
nhận bàn giao không có ngữ cảnh hội thoại. 8 finding, đều là lỗi VĂN BẢN (không đổi thiết kế):

| # | Finding | Sev | Applied To |
|---|---------|-----|------------|
| R4-1 | Biểu thức ngày ICT trong SQL rollback để placeholder: `ticketDate` lưu thời điểm UTC của nửa đêm ICT ⇒ viết sai thì ON CONFLICT không khớp và resolveDayCredit tra không thấy | High | P2 |
| R4-2 | Helper e2e: gộp nhầm 2 đường DB — seed facility-scoped phải `withFacility(...{bypass:true})` (FORCE RLS), xóa punch phải `getPrivilegedDb()` (cmc_app không có DELETE) | Med | P4 |
| R4-3 | Dòng teardown chạy trên `privileged`, và phải thêm bảng mới vào `assertNoFacilityResidue` nếu không rò rỉ geofence không bao giờ bị báo | Med | P1 |
| R4-4 | **`min`→`max` propagate không hết**: plan.md §kiến trúc và spec test phase 2 vẫn ghi `min`, chống lại pseudocode ⇒ implementer sẽ "sửa" code về `min`, tái sinh lỗi R3-2 | High | plan.md, P2 |
| R4-5 | E2E case 1 assert bảng geo bằng phiên NV_1 — người này không thấy được surface của người duyệt (và bị loại-self) ⇒ phải đổi phiên | High | P4 |
| R4-6 | Bảng finding R1 dòng J vẫn ghi remedy `geoRejectReason` (đã bị R2-2 xóa) như việc cần làm ⇒ implementer có thể phục hồi lỗ oracle | Med | plan.md |
| R4-7 | Số cột TimePunch lệch 6/8; prose `timePunch.create` liệt kê thiếu 2 trường ngưỡng ⇒ dialog duyệt render "(bán kính —)" | Med | P1, P2 |
| R4-8 | `testMyPosition.within` không nói rõ có xét accuracy không ⇒ admin trong nhà thấy "TRONG vùng", bật, cả cơ sở bị chặn | Med | P2, P3 |

### Session 5 — 2026-08-04 (đọc lạnh lần cuối) — **HỘI TỤ**
Reviewer xác nhận 8 bản vá R4 mạch lạc trên cả 5 file, và verify lại các tiền đề trong
source (`domain-time` helpers, `getPrivilegedDb`, `assertNoFacilityResidue`,
`seedFacilityNetwork`, `seedApprovedShiftRegistration`, khối teardown). Không còn dòng
lịch sử nào đọc nhầm thành chỉ dẫn sống. 3 finding Medium cuối, đã áp:

| # | Finding | Sev | Applied To |
|---|---------|-----|------------|
| R5-1 | Step 2 phase 4 vẫn ghi "(bypass connection)" cho cả 3 helper → helper xóa punch sẽ chết vì `cmc_app` không có DELETE | Med | P4 |
| R5-2 | 4 tiêu chí RLS/anti-fail-open của phase 1 không có phương tiện chạy → thêm step 8 psql cụ thể | Med | P1 |
| R5-3 | Nguồn geofence trong e2e nói 2 kiểu (UI vs helper) → phân vai: case 1 qua UI, case 2–3 qua `seedFacilityGeofence` | Med | P4 |

**Trạng thái: sẵn sàng implement.** Đường cong hội tụ: R1 15 → R2 18 (2 Critical) →
R3 4 → R4 8 → R5 3, không còn Critical/High từ R4 trở đi.

## Validation Log

### Session 1 — 2026-08-04 (4 câu hỏi)

| # | Câu hỏi | Quyết định |
|---|---------|-----------|
| 1 | Surface cho ngày toàn-geo | **Bảng đếm 30 ngày** (geoPunchSummary) — giữ như plan; không ticket informational |
| 2 | Ngưỡng accuracy GPS | **Per-geofence configurable**: cột `accuracyMaxM` default 200, dải 50–1000 (thay hard-code 200) |
| 3 | Thu hẹp TRUSTED_PROXY_CIDRS | **Trong plan này** (phase 4) |
| 4 | PII/retention | **Xác nhận**: lưu raw lat/lng+ip append-only làm bằng chứng; reviewer chỉ thấy nhãn + khoảng cách + accuracy; ghi ADR |

### Verification Results
- Red Team Review (cùng ngày) đã verify claims với bằng chứng file:line — verification pass bỏ qua theo guard.
- Failed: 0. Không còn `[UNVERIFIED]`.

### Whole-Plan Consistency Sweep
Sau propagate quyết định #2: mọi tham chiếu "GEO_ACCURACY_MAX_M = 200"/"accuracy ≤ 200m"
đã đổi thành ngưỡng per-geofence (`accuracyMaxM`) trong plan.md + phase 1/2/3/4;
schema phase 1 thêm cột; gate + zod + test matrix phase 2 cập nhật; form phase 3 thêm
input; ADR phase 4 sửa lời. Không còn mâu thuẫn mở.

<!-- slug: geofence-gps-punch-verification -->
