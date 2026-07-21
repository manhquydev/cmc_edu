---
phase: 7
title: "Frontend punch+ticket UI"
status: pending
priority: P2
dependencies: [3, 4]
---

# Phase 7: Frontend punch+ticket UI

## Overview
Cập nhật trang chấm công + màn duyệt phiếu cho mô hình mới: nút đổi trạng thái 5s
tự về; modal lý do khi bấm offsite (thay form ngày tùy ý); phiếu hiện 2 cột
checkin/checkout; màn duyệt GĐ theo track. Đồng bộ URL drift.

## Requirements
- Functional:
  - Nút "Chấm công": bấm 1 phát → hiện trạng thái "đã ghi nhận" (giờ punch) ~5 giây
    → tự về trạng thái bấm được. Nhấp lại trong 10s → hiển thị cooldown.
  - Offsite (`appCode: OFFSITE_REASON_REQUIRED` từ lần bấm đầu offsite) → mở modal
    yêu cầu lý do → gửi lại `punch({reason})`. Bỏ `ManualPunchForm` nhập ngày tùy ý.
  - "Phiếu của tôi": bảng hiện cột Ngày, **Giờ vào (checkInAt)**, **Giờ ra
    (checkOutAt)**, Trạng thái, Lý do. Phiếu `rejected` → nút "Gửi lại" (`resubmit`).
  - Màn duyệt GĐ: inbox theo track, hiện checkin/checkout + lý do, nút Duyệt/Từ chối.
- Non-functional: giữ pattern Astryx `@cmc/ui`; a11y; ICT format.

## Architecture
- `check-in-out.tsx`:
  - Thêm state machine nút: idle → recorded(5s auto-revert via setTimeout, clear on unmount)
    → idle. Respect prefers-reduced-motion (không animation cầu kỳ).
  - `punchMut.onError`: appCode `OFFSITE_REASON_REQUIRED` → mở modal lý do (không
    còn tự mở form ngày). Sau nhập → `punchMut.mutate({reason})`.
  - Gỡ `ManualPunchForm` (ngày tùy ý). Giữ `MyTicketsSection` nhưng thêm 2 cột giờ
    + nút Gửi lại cho `rejected`.
- Màn duyệt: dùng `/hr/shifts` pattern (ApproveTab) hoặc thêm tab/màn
  attendance-approve gọi `manualPunch.list({scope:'inbox'})` + approve/reject.
  Có thể đặt trong trang chấm công (tab "Duyệt chấm công") gated `canDo('manualPunch','approve')`.
- URL drift: nav-registry `/hr/checkin` là thực tế; cập nhật docs (phase 8), không
  đổi route (giữ `/hr/checkin`).

## Related Code Files
- Modify: `apps/admin/src/pages/attendance/check-in-out.tsx`
- Modify: `apps/admin/src/pages/attendance/check-in-out.test.tsx`
- Modify (nếu cần): `apps/admin/src/pages/hr/my-hr.tsx` (bỏ surface shortSpanShifts nếu có)
- Có thể tạo: component duyệt chấm công (tab trong check-in-out hoặc màn riêng)

## TDD Test Plan (test-first, component)
1. Bấm nút → gọi `checkInOut.punch` (không args) → hiện "đã ghi nhận"; sau timeout
   về idle (test dùng fake timers).
2. Offsite appCode → modal lý do hiện; nhập + xác nhận → `punch({reason})` gọi.
3. Cooldown appCode → banner cooldown.
4. "Phiếu của tôi" render cột checkin/checkout từ dữ liệu; `rejected` → nút Gửi lại
   → gọi `manualPunch.resubmit`.
5. Không còn form nhập ngày tùy ý (ManualPunchForm removed).
6. Tab Duyệt chỉ hiện khi `canDo('manualPunch','approve')`; approve/reject qua
   ConfirmDialog (không gọi mutation khi chỉ bấm trigger).

## Implementation Steps
1. RED: cập nhật `check-in-out.test.tsx` (state machine, offsite modal, cột giờ,
   resubmit; bỏ test form ngày tùy ý).
2. GREEN: sửa component; thêm tab duyệt track.
3. `pnpm --filter admin test -- check-in-out` xanh; build admin xanh.

## Success Criteria
- [ ] Nút 5s auto-revert; cooldown/offsite banner đúng appCode.
- [ ] Modal lý do thay form ngày tùy ý; ManualPunchForm gỡ.
- [ ] Phiếu 2 cột giờ + nút Gửi lại cho rejected.
- [ ] Tab duyệt track gated đúng.
- [ ] 6 case component xanh; build xanh.

## Risk Assessment
- **Rủi ro:** setTimeout 5s rò rỉ khi unmount/nhiều lần bấm. Mitigation: clear timer
  trong cleanup + khi bấm lại.
- **Rủi ro:** offsite modal gây double-submit punch. Mitigation: disable nút khi
  pending; chỉ 1 mutate sau xác nhận modal.
