---
title: "Phase 3: Admin UI setup + punch capture + labels"
status: todo
priority: P1
effort: "6h"
dependencies: [2]
---

# Phase 3: Admin UI setup + punch capture + labels

## Overview

Bốn mảng UI: (1) trang admin "Chấm công & vị trí" thêm mục Vùng vị trí GPS (kèm cảnh
báo bật-vùng-đầu-tiên) + cảnh báo CIDR rộng; (2) nút punch capture geolocation không
bao giờ block + modal offsite tự suy thông điệp từ `geoThresholdM`; (3) **thiết kế lại dialog
duyệt ticket** thành detail Dialog chứa bảng punch (red-team M: modal cũ không tồn tại
— ApproveTicketsTab hiện là DataTable + ConfirmDialog(string), `check-in-out.tsx:317-439`);
(4) bảng "Chấm công GPS gần đây" cho ngày toàn-geo (red-team B).

## Requirements

- [ ] Mục "Vùng vị trí (GPS)" trong `network-ip.tsx`: list/create/toggle/delete + "Dùng vị trí hiện tại" + "Kiểm tra".
- [ ] Confirm cảnh báo khi bật geofence ĐẦU TIÊN lúc cơ sở có 0 network active (red-team E)
      VÀ khi tắt/xóa geofence active CUỐI CÙNG (R2 — về chế độ mở).
- [ ] Cảnh báo CIDR rộng hơn /29 trong form network.
- [ ] Punch capture: 8s timeout, denied/timeout → punch không geo; modal offsite hiện lý do geo fail.
- [ ] Dialog duyệt ticket mới: bảng punch trong ngày (nhãn + khoảng-cách-snapshot) + nút Duyệt/Từ chối.
- [ ] Section "Chấm công GPS gần đây" (geoPunchSummary) trong tab duyệt.

## Architecture

**Geolocation capture helper** — `apps/admin/src/lib/capture-geolocation.ts`:

```ts
export interface CapturedGeo { lat: number; lng: number; accuracyM: number }
/** Resolve null khi: không có navigator.geolocation, denied, timeout 8s, lỗi bất kỳ.
 *  KHÔNG BAO GIỜ throw — geo optional tuyệt đối (plan.md #4). */
export function captureGeolocation(): Promise<CapturedGeo | null>
// getCurrentPosition, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
```

**Punch UI** (`check-in-out.tsx`, `CheckInTab` quanh dòng 442-560):
- `onClick`: state "Đang lấy vị trí…" → `captureGeolocation()` → `punchMut.mutate(geo ? { geo } : {})`.
- Retry offsite-reason gửi lại CÙNG geo đã capture (giữ state — không capture lại).
- Modal offsite: server CHỈ trả `appData.geoThresholdM` (anti-oracle — phase 2). Client
  tự suy thông điệp từ state của chính nó (`capturedGeo`):
  - không có `capturedGeo` → "Không lấy được vị trí (bị chặn/timeout) — punch ghi nhận offsite, cần lý do."
  - `capturedGeo.accuracyM > geoThresholdM` → "GPS sai số ±Xm, vượt ngưỡng Ym — thử ra gần cửa sổ/ngoài trời rồi chấm lại."
  - còn lại → "Bạn đang ngoài vùng cho phép."
  KHÔNG hiển thị khoảng cách tới vùng ở màn nhân viên (rò vị trí geofence).
  Mở rộng union `PunchAlert` (`check-in-out.tsx:444-449`) thêm state "đang lấy vị trí".
- Text nhỏ dưới nút: giải thích xin quyền + hint mở lại quyền.

**Trang admin** (`network-ip.tsx`):
- Heading "Chấm công & vị trí"; giữ section mạng IP.
- Section "Vùng vị trí (GPS)": bảng list (label, lat/lng 5 số lẻ, radius, isActive
  toggle, Kiểm tra, Xóa confirm). Form tạo: nút "Dùng vị trí hiện tại" (fill + hiện
  accuracy, khuyến cáo khi >100m) / input lat/lng thủ công (dán từ Google Maps — đường
  setup từ xa vì trang này super_admin-only, plan.md #6) / radius mặc định 200 (100–2000) /
  **ngưỡng sai số GPS `accuracyMaxM` mặc định 200 (50–1000)** với help text "tăng lên nếu
  nhân viên trong nhà hay bị báo sai số vượt ngưỡng" (Validation Session 1) / label.
- Sau tạo: banner "vùng đang TẮT — bấm Kiểm tra rồi bật".
- **Toggle bật vùng**: nếu là geofence active ĐẦU TIÊN và cơ sở có 0 network active →
  ConfirmDialog: "Kích hoạt vùng đầu tiên sẽ TẮT chế độ mở: punch từ máy bàn không GPS
  / ngoài vùng sẽ thành offsite và cần lý do. Nhân viên đã punch sáng nay theo chế độ
  mở có thể mất credit nếu punch chiều offsite — nên bật ngoài giờ làm." (red-team E)
- **Toggle TẮT vùng cuối cùng** (R2 — chiều ngược lại cũng nguy hiểm): tắt/xóa geofence
  active CUỐI CÙNG khi cơ sở có 0 network active → ConfirmDialog: "Cơ sở sẽ về CHẾ ĐỘ MỞ:
  mọi punch từ bất kỳ đâu đều hợp lệ và được tính công đầy đủ, không ai review." Không có
  cảnh báo này thì một lần tắt tạm rồi quên = nhiều ngày auto-credit vô hình
  (`geoPunchSummary` chỉ đếm nhãn `geo`, không đếm `open`).
- Nút "Kiểm tra": capture geo → `facilityGeofence.testMyPosition` → mỗi vùng hiện
  "TRONG vùng — cách tâm Xm" / "NGOÀI vùng — cách tâm Xm" / **"Trong bán kính nhưng sai
  số ±Xm vượt ngưỡng Ym"** khi `!accuracyOk` (R4 — nếu gộp ca này vào "TRONG vùng" thì
  admin bật nhầm rồi cả cơ sở bị chặn).
- Cảnh báo CIDR: input hợp lệ và prefix bits < 29 → "Dải rất rộng — CGNAT có thể cho
  cả thuê bao khác của ISP vào 'trong mạng'. Khuyến nghị /32." (không chặn submit).

**Dialog duyệt ticket — thiết kế lại** (red-team M; đây là THAY ĐỔI UX luồng duyệt):
- Thay approve `ConfirmDialog` (string message, `:394-403`) bằng `Dialog` chi tiết:
  tiêu đề (tên NV + ngày), nội dung = note ticket + bảng `manualPunch.dayPunches`:
  giờ punch | badge nhãn | ±accuracy | **"cách tâm vùng Xm (bán kính Ym)"** — dùng cả
  `geofenceDistanceM` và `matchedRadiusM` đã snapshot; hiển thị mỗi khoảng cách trần là
  vô nghĩa/gây hiểu lầm ở bán kính lớn (R2). KHÔNG tọa độ/IP (plan.md #10).
  Footer: Duyệt / Từ chối (mở reason dialog cũ) / Đóng.
- Badge 4 nhãn: `network` xanh "Mạng cơ sở" / `geo` vàng "GPS" / `open` xám nhạt
  "Không kiểm chứng" / `none` xám đậm "Offsite".
- Budget kèm theo: cập nhật `check-in-out.test.tsx` (flow approve đổi dialog) và e2e
  `checkin-offsite-approval.journey.ui.spec.ts` selectors (phase 4 chạy lại).

**Section "Chấm công GPS gần đây"** (trong tab duyệt, dưới DataTable ticket):
`checkInOut.geoPunchSummary({days: 30})` → bảng {tên NV, số punch GPS, lần cuối}.
Empty state: "Không có punch GPS 30 ngày qua." Mục đích răn đe/pattern (Goal 2) —
ngày toàn-geo không có ticket vẫn hiện ở đây.

## Related Code Files

- Create: `apps/admin/src/lib/capture-geolocation.ts`
- Modify: `apps/admin/src/pages/admin/network-ip.tsx`
- Modify: `apps/admin/src/pages/attendance/check-in-out.tsx` (CheckInTab + ApproveTicketsTab redesign)
- Modify: `apps/admin/src/pages/attendance/check-in-out.test.tsx`

## Implementation Steps

1. Đọc kỹ 2 page + test hiện có (pattern Dialog/ConfirmDialog/DataTable/Banner, trpc hooks).
2. Viết `capture-geolocation.ts` (thuần, dễ mock).
3. Punch UI: capture + state giữ geo cho retry + modal suy thông điệp từ `geoThresholdM` + capturedGeo.
4. Section geofence + confirm bật-vùng-đầu-tiên + cảnh báo CIDR trong network-ip.tsx.
5. Redesign dialog duyệt: Dialog chi tiết + dayPunches + badges; giữ reject-reason dialog.
6. Section geoPunchSummary.
7. Tests: punch mutate cả 3 nhánh client (geo/denied/timeout); retry giữ geo; cảnh báo
   CIDR /24 hiện – /32 ẩn; confirm bật-vùng-đầu-tiên VÀ confirm tắt-vùng-cuối hiện đúng
   điều kiện; modal offsite suy đúng 3 thông điệp từ `geoThresholdM` + capturedGeo;
   dialog duyệt render 4 badge + "cách tâm Xm (bán kính Ym)" + không render tọa độ;
   geoPunchSummary render + empty state.

## Success Criteria

- [ ] Punch hoạt động cả 3 nhánh client (test mock captureGeolocation).
- [ ] super_admin flow: tạo bằng "vị trí hiện tại" → Kiểm tra → confirm cảnh báo → bật.
- [ ] Dialog duyệt hiện đủ 4 badge + khoảng-cách-snapshot, không lộ tọa độ/IP.
- [ ] Ngày toàn-geo hiện trong "Chấm công GPS gần đây".
- [ ] Test UI cũ: pass sau khi CẬP NHẬT có chủ đích cho dialog duyệt mới (đổi UX được
  budget); các test không liên quan pass nguyên trạng.

## Risk Assessment

- **Đổi UX luồng duyệt** (ConfirmDialog → Dialog chi tiết) chạm test + e2e selector —
  đã budget trong phase này + phase 4; không phải "regression 0".
- **Chờ 8s làm punch chậm cảm nhận**: label trạng thái; maximumAge 30s giúp lần 2 nhanh.
- **Secure context**: geolocation cần HTTPS/localhost — prod https OK, local-sim
  localhost OK; cảnh lạ → null → punch vẫn chạy (degrade đúng thiết kế).
- **Double-capture khi retry** → giữ state, có test.
