# Phase 01 — Siết gate màn hình theo role

## Context links
- Parent: [plan.md](plan.md)
- Design: `plans/reports/brainstorm-260716-1047-super-admin-completion-report.md` (hạng mục C)
- Không phụ thuộc phase khác.

## Overview
- Date: 2026-07-16
- Mô tả: Thêm gate tầng-trang cho `shift-config.tsx` (đồng bộ với facilities/users). Xác minh nav đã ẩn đúng.
- Priority: P3 (nhẹ, rủi ro thấp)
- Implementation status: done
- Review status: done (1 Critical + 1 Medium finding fixed, re-verified)

## Key Insights
- Nav module `admin` ĐÃ có `roles: ['super_admin']` (`nav-registry.ts:81`) → menu Quản trị đã ẩn với role khác. Đây KHÔNG phải lỗ hổng bảo mật.
- Server-side đã chặn: `shift.createGroup/createTemplate` dùng `requirePermission('shift','manage')`; `compensationPolicy.upsert` gate `compensationPolicy.manage`.
- Gap thực: `shift-config.tsx` thiếu `canDo()` tầng-trang → truy cập URL trực tiếp vẫn render UI (fail khi submit). Defense-in-depth + UX nhất quán.

## Requirements
- `shift-config.tsx` return `<EmptyState>` khi `!canDo('compensationPolicy','manage')` — khuôn giống `facilities.tsx:53-56`, `users.tsx:307-310`.
- Test khẳng định role không-có-quyền thấy EmptyState, super_admin thấy nội dung.

## Architecture
Frontend-only. Dùng `useSession().canDo` sẵn có. Không đụng backend/schema.

## Related code files
- Sửa: `apps/admin/src/pages/admin/shift-config.tsx`
- Sửa: `apps/admin/src/pages/admin/shift-config.test.tsx`
- Tham chiếu khuôn: `apps/admin/src/pages/admin/facilities.tsx:53-56`, `users.tsx:307-310`
- Xác minh: `apps/admin/src/shell/nav-registry.ts` (đã đúng, chỉ đọc)

## Implementation Steps (TDD)
1. **Test trước**: thêm case vào `shift-config.test.tsx` — render với session role thường (vd `giao_vien`, `canDo` trả false cho `compensationPolicy.manage`) → assert thấy EmptyState "không có quyền", KHÔNG thấy tab Nhóm ca/Chính sách.
2. Chạy test → đỏ (chưa có gate).
3. Thêm gate đầu component `shift-config.tsx` theo khuôn facilities/users.
4. Chạy lại → xanh. Xác nhận các test cũ (render, tạo group/template, lưu policy) vẫn xanh với session super_admin.

## Todo list
- [ ] Test gate role thường (đỏ)
- [ ] Thêm `canDo` gate vào shift-config.tsx
- [ ] Test xanh + regression cũ xanh
- [ ] Đọc xác nhận nav-registry ẩn đúng (không sửa)

## Success Criteria
- Role không phụ trách → EmptyState, không render form.
- super_admin → đầy đủ như cũ.
- Toàn bộ test admin app xanh.

## Risk Assessment
- Rủi ro thấp. Nguy cơ duy nhất: chọn sai permission slug — dùng đúng `compensationPolicy.manage` (khớp nav-registry.ts:87).

## Security Considerations
- Không nới quyền. Server-side vẫn là hàng rào chính; đây là defense-in-depth phía UI.

## Next steps
→ Phase 02.
