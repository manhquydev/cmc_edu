# Phase 03 — Quản lý IP mạng + tự dò IP

## Context links
- Parent: [plan.md](plan.md)
- Design: brainstorm report (hạng mục D)
- Không phụ thuộc phase khác.

## Overview
- Date: 2026-07-16
- Mô tả: Backend CRUD `FacilityNetwork` + endpoint dò IP hiện tại. Frontend thay placeholder `network-ip.tsx` bằng màn hình quản lý dải mạng + nút "Lấy IP hiện tại của tôi" + hướng dẫn nhập tay. Thêm mục nav.
- Priority: P2
- Implementation status: done
- Review status: done (1 Critical + 1 Medium finding fixed, re-verified)

## Key Insights
- Model `FacilityNetwork` (schema.prisma:1100): `id/facilityId/cidr/label/isActive/createdAt`. Facility-scoped.
- **Backend hiện KHÔNG có endpoint quản lý** — permission `facilityNetwork.manage` đã đăng ký (`packages/auth/src/index.ts:91`) nhưng chưa dùng; `checkin/router.ts:200` chỉ READ. Test helper tạo tay (`test/db.ts:276`).
- `checkin` logic: nếu KHÔNG có active network row → coi như "trong mạng" (dev/open mode). Thêm row đầu tiên sẽ BẬT geofencing → cảnh báo PO khi lưu dải đầu.
- `ctx.ip` (context.ts, từ x-forwarded-for) = IP công cộng caller → nền cho nút tự-dò. Có sẵn `ipMatchesCidr` (`@cmc/domain-identity`) để validate/parse.
- `network-ip.tsx` hiện là placeholder thuần (EmptyState), chưa có nav item trong `nav-registry.ts` (admin module).

## Requirements (đã chốt qua red-team)
- Backend router mới `facilityNetwork` (super_admin-gated, facility-scoped qua `scoped(ctx)` + `withFacility`):
  - `list` — dải mạng của facility (kèm trạng thái bật/tắt).
  - `create({ cidr, label })` — validate CIDR hợp lệ; **mặc định `isActive=false`** (thêm ở trạng thái TẮT, chưa áp dụng); ghi AuditLog.
  - `update({ id, cidr?, label?, isActive? })` — cho phép bật/tắt qua `isActive`; ghi AuditLog.
  - `delete({ id })` — ghi AuditLog.
  - `detectMyIp` — trả `ctx.ip` + gợi ý CIDR `/32` (và gợi ý `/24` để mở rộng cả dải văn phòng); nếu `ctx.ip` null → cờ báo UI hiện hướng dẫn nhập tay.
- Frontend `network-ip.tsx`: bảng CRUD + **công tắc Bật/Tắt mỗi dải** (map `isActive`) + nút "Lấy IP hiện tại của tôi" (điền sẵn từ `detectMyIp`, admin xác nhận/sửa rồi lưu) + đoạn hướng dẫn nhập tay (giải thích CIDR, ví dụ, cách tự tra IP nếu nút không chính xác do proxy) + **dòng nhắc rõ**: "Bật dải mạng sẽ khiến chấm công ngoài mạng cần nhập lý do + tạo yêu cầu duyệt".
- Thêm nav child `network-ip` vào admin module với `permission: { module:'facilityNetwork', action:'manage' }`.
- Đăng ký `facilityNetworkRouter` vào `apps/api/src/router.ts`.

## Architecture
- Backend: file mới `apps/api/src/facility/network-router.ts` (hoặc gộp vào `facility/router.ts` — chọn file riêng cho cohesion). Validate CIDR bằng helper `@cmc/domain-identity` (mở rộng nếu chỉ có `ipMatchesCidr`, cần thêm `isValidCidr`).
- `detectMyIp`: query đơn giản đọc `ctx.ip`; nếu null (không có forwarded header) → trả cờ để UI hiện hướng dẫn nhập tay.
- Frontend: thay toàn bộ `network-ip.tsx`, theo khuôn `shift-config.tsx` (list + create form + validation).

## Related code files
- Tạo: `apps/api/src/facility/network-router.ts` (+ test)
- Sửa: `apps/api/src/router.ts` (đăng ký router)
- Sửa (nếu thiếu validator): `packages/domain-identity` (thêm `isValidCidr`) + test
- Sửa: `apps/admin/src/pages/admin/network-ip.tsx` (+ `network-ip.test.tsx`)
- Sửa: `apps/admin/src/shell/nav-registry.ts` (+ `nav-registry.test.ts`) — thêm nav child
- Tham chiếu READ hiện tại: `apps/api/src/checkin/router.ts:200`

## Implementation Steps (TDD)
1. **Test validator** (nếu thêm `isValidCidr`): hợp lệ/không hợp lệ → đỏ → implement → xanh.
2. **Test backend router**: super_admin list/create/update/delete happy; **create mặc định isActive=false**; update bật/tắt qua isActive; CIDR sai → BAD_REQUEST; non-super_admin → FORBIDDEN; mỗi mutation ghi AuditLog; `detectMyIp` trả ctx.ip + gợi ý; ip null → cờ hướng dẫn. Đỏ → implement → xanh.
3. Đăng ký router vào `router.ts`. Chạy full API suite → không hồi quy (đặc biệt checkin: xác nhận thêm/xoá row không phá `withinNetwork`).
4. **Test frontend**: render bảng, tạo/sửa/xoá dải, nút detect điền sẵn, hiển thị hướng dẫn nhập tay, invalidate list. Đỏ → implement → xanh.
5. **Test nav**: `nav-registry.test.ts` — child network-ip xuất hiện cho super_admin, ẩn với role thiếu quyền. Đỏ → implement → xanh.

## Todo list
- [ ] (tùy) `isValidCidr` + test
- [ ] Backend CRUD + detectMyIp + audit (đỏ→xanh)
- [ ] Đăng ký router + regression checkin
- [ ] Frontend màn hình + nút detect + hướng dẫn (đỏ→xanh)
- [ ] Nav child + test

## Success Criteria
- super_admin quản lý dải mạng qua UI, không cần DB tay.
- Nút "Lấy IP hiện tại" điền đúng IP đang dùng; có hướng dẫn khi nút không khả dụng.
- Không để tính năng trống — luôn có hướng dẫn.
- Mọi mutation ghi audit; không role khác thao tác được.
- Full API suite không hồi quy.

## Risk Assessment (hiệu chỉnh sau red-team)
- **Hậu quả bật dải mạng NHẸ hơn tưởng**: ADR 0043 KHÔNG khoá hẳn — ai chấm ngoài mạng chỉ cần nhập lý do + hệ thống tạo yêu cầu duyệt (checkin/router.ts:227). Không phải "lockout". Vẫn là thay đổi nhân viên thấy → mitigations: mặc định thêm dải ở trạng thái TẮT, admin chủ động bật; UI nhắc rõ hệ quả.
- **Cứu khi nhập sai dải**: màn quản trị KHÔNG bị chặn theo mạng (geofence chỉ ảnh hưởng `checkin.punch`), nên super_admin luôn vào sửa/tắt/xoá dải sai được — không có kịch bản tự khoá chính mình khỏi admin.
- IP sau proxy/CDN/di động có thể không phải IP văn phòng thật → hướng dẫn nhập tay là bắt buộc, không chỉ dựa nút tự dò.
- IP văn phòng động (ISP đổi IP) → dùng CIDR rộng (/24) hoặc dựa luồng yêu cầu-duyệt sẵn có; nêu rõ trong hướng dẫn.
- CIDR sai làm phiền chấm công → validate chặt + cho sửa/tắt/xoá dễ.

## Security Considerations
- super_admin-only + facility-scoped (`withFacility`). Ghi audit mọi thay đổi dải mạng (ảnh hưởng chấm công).
- `detectMyIp` chỉ trả IP của chính caller — không lộ thông tin người khác.

## Next steps
→ Phase 04.
