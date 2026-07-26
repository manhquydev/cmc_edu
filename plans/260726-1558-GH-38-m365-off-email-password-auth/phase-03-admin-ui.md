# Phase 3 — Admin UI: form đăng nhập, ép đổi mật khẩu, nút reset

## Context

- `apps/admin/src/pages/login.tsx` — hiện: nút Dev (DEV), nút SSO theo
  `VITE_SSO_ENABLED`, placeholder disabled "sắp có" khi tắt.
- Pattern màn đổi mật khẩu + redirect mustChangePassword đã có ở LMS:
  `apps/lms/src/pages/student/change-password.tsx`, redirect trong
  `apps/lms/src/pages/login.tsx` / guard — tham chiếu convention, viết bản
  admin bằng `@cmc/ui` components như login.tsx hiện tại.
- `apps/admin/src/pages/admin/users.tsx` — bảng users với
  `user.create`/`user.updateRoles`: thêm hành động reset password cùng chỗ.
- Admin SPA gọi API bằng cookie (`credentials:'include'`) — login form fetch
  `POST {VITE_API_URL}/auth/staff-login`.

## Requirements

1. **login.tsx**: thay placeholder bằng form email/password (submit ⇒ POST
   staff-login; lỗi hiện thông điệp generic từ API; thành công ⇒
   `mustChangePassword ? navigate('/change-password') : navigate('/')`).
   Giữ nút Dev (DEV) và nút SSO khi `VITE_SSO_ENABLED==='true'`.
2. **Trang `change-password`** (route mới trong admin router): current/new/
   confirm ⇒ `user.changeOwnPassword`; thành công ⇒ về `/`.
3. **users.tsx**: thêm action "Đặt lại mật khẩu" mỗi row ⇒ prompt nhập mật khẩu
   tạm (hoặc modal cùng convention UI trang này) ⇒ `user.resetPassword`;
   chỉ hiện cho super_admin (theo cách trang này đang gate role).
4. Không đổi hành vi dev-login/e2e (localStorage `cmc_dev_user` giữ nguyên).

## Files

- Modify: `apps/admin/src/pages/login.tsx`, `apps/admin/src/pages/admin/users.tsx`
  (+ colocated tests), router/route registry của admin SPA
- Create: `apps/admin/src/pages/change-password.tsx` (+ test)

## Validation

- Colocated tests (convention *.test.tsx sẵn có): form submit gọi đúng
  endpoint; mustChangePassword redirect; users.tsx gọi user.resetPassword.
- `pnpm --filter @cmc/admin test` + typecheck xanh.
- Chạy tay dev: login sai/đúng, ép đổi, reset từ users page.

## Risk / Rollback

- Risk thấp — UI thuần cộng thêm. Rollback: revert 3 file + route.
