# Phase 2 — API: staff-login, đổi/đặt lại mật khẩu, seed super-admin

## Context (file:line đã scout)

- `apps/api/src/auth/sso-routes.ts:228-235` — cách ký staff token sau SSO
  (userId, roles, facilityId) + set cookie: TÁI DÙNG y hệt cho password login.
- `apps/api/src/auth/staff-session.ts:51-127` — `signStaffToken`,
  `buildStaffCookie` (8h, HttpOnly, Secure prod, SameSite=Lax): không sửa.
- `apps/api/src/server.ts:60-76` — mount `/auth/login|callback|logout` bằng
  if-block; SSO routes chỉ mount khi `SSO_ENABLED=true`.
- `apps/api/src/lms-auth/password-hash.ts` — PBKDF2 hash/verify: tái dùng
  (import chéo module: cân nhắc chuyển file này sang `apps/api/src/auth/` nếu
  ít đụng chạm; nếu không, import trực tiếp — quyết tại impl theo DRY/KISS).
- `apps/api/src/lms-auth/router.ts:84-98` — hằng số lockout + DUMMY hash timing
  equalization + generic error: copy convention.
- `apps/api/src/user/router.ts` — router `user` (list/create/updateRoles) do
  `apps/admin/src/pages/admin/users.tsx` gọi: nơi thêm procedures mật khẩu.
- `scripts/seed-super-admin.ts` — seed bootstrap: thêm mật khẩu ban đầu.
- GitNexus: chạy `impact` trên `signStaffToken`, `buildStaffCookie`, `userRouter`
  trước khi sửa; báo blast radius trước khi code.

## Requirements

1. **POST `/auth/staff-login`** (route thuần cạnh sso-routes, file mới
   `apps/api/src/auth/password-routes.ts`, mount KHÔNG điều kiện trong
   server.ts): body JSON `{email, password}`.
   - Lookup `AppUser` theo `lower(email)`, bỏ qua email rỗng; đòi `isActive`,
     `passwordHash` khác null, chưa bị khóa (`loginLockedUntil`).
   - Sai ⇒ tăng `loginAttempts`; đủ 5 ⇒ khóa 15' (hằng số riêng cho staff,
     cùng giá trị LMS). Mọi nhánh fail trả 401 + thông điệp generic duy nhất.
   - Dummy-hash verify khi không có account (chặn timing enumeration — pattern
     `DUMMY_PASSWORD_HASH` của lms-auth).
   - Đúng ⇒ reset attempts, ký token + set cookie y hệt đường SSO, trả
     `{ok:true, mustChangePassword}`.
   - nginx đã rate-limit `/auth/`; không thêm hạ tầng mới.
2. **tRPC `user.changeOwnPassword`** (staff procedure): `{currentPassword,
   newPassword}` — verify current, policy tối thiểu như LMS (xem policy ở màn
   student change-password, dùng cùng giá trị), set hash mới, clear
   `mustChangePassword`.
3. **tRPC `user.resetPassword`** (chỉ `super_admin`): `{appUserId,
   tempPassword}` — set hash + `mustChangePassword=true` + reset lockout.
   Audit: nếu router user đã có audit-log convention thì ghi cùng kiểu.
4. **Seed**: `scripts/seed-super-admin.ts` nhận `SUPER_ADMIN_PASSWORD`
   (optional) ⇒ set passwordHash + `mustChangePassword=true`; cập nhật comment
   header (không còn "Entra UPN").
5. Không sửa boot-checks (SSO_ENABLED=false đã miễn ENTRA_*/GRAPH_*). Không
   đụng sso-routes/Graph transport.

## Files

- Create: `apps/api/src/auth/password-routes.ts` (+ `password-routes.test.ts`)
- Modify: `apps/api/src/server.ts` (mount POST), `apps/api/src/user/router.ts`
  (+ test), `scripts/seed-super-admin.ts`
- Tùy quyết DRY: di chuyển/re-export `password-hash.ts`

## Validation (tests bắt buộc)

- password-routes: login đúng; sai pass ⇒ generic + attempts tăng; khóa sau 5;
  hết hạn khóa đăng nhập lại được; inactive/không hash/email rỗng ⇒ generic;
  cookie có HttpOnly+SameSite=Lax (+Secure khi NODE_ENV=production).
- user.changeOwnPassword: đúng/sai current, policy, clear mustChangePassword.
- user.resetPassword: role gate (super_admin ok, khác bị forbidden), set flag.
- Chạy: `pnpm --filter @cmc/api test` + boot-checks tests hiện có vẫn xanh.

## Risk / Rollback

- Risk: lệch shape token so đường SSO ⇒ dùng chung hàm ký, thêm test so khớp
  payload. Rollback: bỏ mount route + revert procedures; schema phase 1 giữ
  nguyên vô hại.
