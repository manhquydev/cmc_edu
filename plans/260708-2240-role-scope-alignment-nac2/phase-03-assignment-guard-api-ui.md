---
phase: 3
title: "Assignment-Guard-API-UI"
status: done
effort: "0.5d"
priority: P1
dependencies: [2]
---

# Phase 3: Assignment-Guard-API-UI

## Overview

Chặn gán role gác ở endpoint `user.updateRoles` (zod schema từ `ACTIVE_ROLES`) và UI màn Phân
quyền (chỉ 5 role active). [RED-TEAM reframe] Zod ở đây là **defense-in-depth cho endpoint** —
boundary thật là registry + invariant test (Phase 1-2); writer ngoài tRPC (seed script, restore)
bypass zod by design. TDD: viết test API reject trước, rồi sửa schema.

[RED-TEAM bổ sung] Phase này cũng đóng lỗ **last-super-admin lockout**: guard hiện có chỉ chặn
TỰ-hạ (`router.ts:202-208`); comment `router.ts:200-201` nói check last-admin "sẽ land trước khi
SSO nối roles" nhưng SSO **đã nối** (`sso-routes.ts:228-235` → `staff-session.ts:96-99` →
`context.ts:226`) — admin A hạ được admin B (super_admin cuối cùng còn lại) → mất sạch quyền trị
hệ thống qua UI, chỉ cứu được bằng `scripts/seed-super-admin.ts`. Đang sửa đúng hàm này → thêm check.

## Requirements

- Functional: (a) gán role ∉ ACTIVE_ROLES qua `user.updateRoles` → BAD_REQUEST (zod, đúng chuẩn
  5 mã lỗi); áp dụng mọi caller của endpoint kể cả super_admin (business rule). (b) Không cho gỡ
  `super_admin` khỏi user nếu đó là super_admin active cuối cùng của hệ thống → FORBIDDEN.
  Guard tự-hạ hiện có giữ nguyên; sửa comment stale `router.ts:200-201`.
- Non-functional: UI và API cùng đọc `ACTIVE_ROLES` từ `@cmc/auth` (DRY, một nguồn).

## Architecture

- `roleArraySchema` trong `apps/api/src/user/router.ts:73-78` hiện build từ `ROLES` (9) →
  đổi sang `ACTIVE_ROLES` (5). Zod tự reject giá trị ngoài enum = BAD_REQUEST; không cần guard
  thủ công mới. [RED-TEAM] Sửa kèm `.max(9)` → `.max(ACTIVE_ROLES.length)` + comment ("exactly
  9 valid roles" đã stale). Comment nêu rõ: enum DB vẫn 9 nhưng chỉ 5 gán được (ADR-D amendment),
  áp cả super_admin — đừng "fix" thành bypass.
- [RED-TEAM — GIỮ 9-ROLE, KHÔNG ĐỤNG] `apps/api/src/context.ts:33` (session/dev-header schema
  `z.array(z.enum(ROLES))`) PHẢI giữ nguyên 9-role: token cũ/user legacy mang role gác vẫn phải
  parse được context (deny bởi registry, không phải lockout ở cửa); e2e impersonation
  (`finance-approval.spec.ts:141`, `e2e/trpc-client.ts`) đi qua schema này. Thu hẹp nó = staff
  lockout + vỡ e2e. Ghi comment tại chỗ để reviewer sau không "dọn" nhầm.
- Last-super-admin guard trong `updateRoles`: khi payload gỡ `super_admin` khỏi user hiện có nó,
  đếm super_admin active khác (`AppUser` where roles has super_admin AND isActive AND id != target)
  trong cùng transaction `withFacility` — nếu 0 → FORBIDDEN. Sửa comment stale dòng 200-201.
- `apps/admin/src/pages/admin/users.tsx` `ROLE_OPTIONS` (dòng 8-18) build từ `ACTIVE_ROLES`
  import từ `@cmc/auth` + map nhãn tiếng Việt (giữ 5 nhãn hiện có, bỏ 4 role gác).
- [RED-TEAM — sửa deadlock] `openRolesModal` (`users.tsx:107-110`) seed `selectedRoles = user.roles`
  NGUYÊN VẸN (kể cả role gác) và `handleSaveRoles` (:112-114) gửi verbatim → user đang mang role
  gác sẽ bị BAD_REQUEST mọi lần Save mà không gỡ được (role gác không có trong options MultiSelect).
  Fix: khi mở modal, `setSelectedRoles(user.roles.filter(r => ACTIVE_ROLES.includes(r)))` — lần
  Save kế tiếp sẽ "rửa" role gác một cách CHỦ ĐỘNG (ghi comment nêu hành vi drop này). Badge trong
  bảng user vẫn hiển thị role cũ cho tới khi được lưu lại — chỉ chặn gán mới, không ẩn dữ liệu.

## Related Code Files

- Modify: `apps/api/src/user/router.ts` (roleArraySchema → ACTIVE_ROLES + `.max` + comment;
  last-super-admin guard trong updateRoles; sửa comment stale :200-201)
- Modify: `apps/api/src/user/app-user.test.ts` (fixture `roles: ['sale','cskh']` dòng 163 →
  role active; THÊM test: updateRoles với `['ke_toan']` → BAD_REQUEST; `['hr','sale']` →
  BAD_REQUEST; 5 role active → OK; gỡ super_admin của super_admin CUỐI CÙNG → FORBIDDEN;
  gỡ được khi còn super_admin active khác)
- Modify: `apps/admin/src/pages/admin/users.tsx` (ROLE_OPTIONS từ ACTIVE_ROLES; filter
  selectedRoles khi mở modal — fix deadlock)
- Verify không đổi: `apps/admin/src/shell/nav-registry.test.ts` (đã đúng);
  `apps/api/src/context.ts` (session schema GIỮ ROLES 9 — xem Architecture)

## Implementation Steps

1. (RED) Thêm test vào `app-user.test.ts`: updateRoles reject `ke_toan`/`hr`; accept 5 role
   active; guard tự-hạ-super_admin vẫn hoạt động; **gỡ super_admin của super_admin cuối cùng →
   FORBIDDEN; gỡ OK khi còn admin active khác**. Sửa fixture dòng 163 sang role active
   (giữ ý nghĩa test multi-role: ví dụ `['sale','giao_vien']`).
2. (GREEN) Đổi `roleArraySchema` build từ `ACTIVE_ROLES` + `.max(ACTIVE_ROLES.length)`; thêm
   comment business-rule; implement last-super-admin guard trong updateRoles (đếm trong cùng
   transaction); sửa comment stale `router.ts:200-201`.
3. UI: `ROLE_OPTIONS` derive từ `ACTIVE_ROLES` + label map; **filter `selectedRoles` theo
   ACTIVE_ROLES khi mở modal** (fix deadlock, comment nêu hành vi drop chủ động); xác nhận modal
   chỉ còn 5 lựa chọn; badge hiển thị role cũ không đổi.
4. Thêm comment "GIỮ 9-role, không narrow" tại `apps/api/src/context.ts:33`.
5. Chạy `pnpm --filter @cmc/api test` (user suite) + admin typecheck/test/build.

## Success Criteria

- [ ] `user.updateRoles` với role gác → BAD_REQUEST (test chứng minh, kể cả khi caller super_admin)
- [ ] Gỡ super_admin cuối cùng → FORBIDDEN (test); gỡ OK khi còn admin active khác (test)
- [ ] 5 role active gán bình thường; guard tự-hạ-super_admin không hồi quy
- [ ] Modal Phân quyền chỉ 5 options; user mang role gác (nếu có) vẫn Save được — role gác bị
      drop chủ động, không deadlock
- [ ] `context.ts:33` giữ nguyên 9-role, có comment chống narrow nhầm
- [ ] UI + API cùng import `ACTIVE_ROLES` (không hardcode danh sách lần 2)
- [ ] Typecheck + test + build các package chạm đều xanh

## Risk Assessment

- **Cast `DbRole`**: schema hẹp hơn kiểu Prisma `Role[]` — vẫn hợp lệ (subset); typecheck xác nhận.
- [RED-TEAM đã sửa] Khẳng định cũ "payload toàn phần tự nhiên rửa role gác" là SAI — modal
  pre-load role cũ nên nếu không filter sẽ deadlock (BAD_REQUEST mọi lần Save). Đã fix bằng
  filter khi mở modal (Architecture).
- **Last-super-admin guard đếm toàn hệ thống vs per-facility**: super_admin là quyền hệ thống;
  đếm phạm vi nào do `withFacility` RLS quyết — nếu RLS che user facility khác, dùng đếm
  system-wide qua kênh phù hợp (executor xác định khi implement; test phải phủ đúng ngữ nghĩa
  "cuối cùng của HỆ THỐNG").
- Rollback: revert 3 file, không state.
