# 2026-07-26 — Mất quyền M365: email dồn về Brevo, staff chuyển sang email/password

## Bối cảnh

Dự án mất quyền tenant M365. Yêu cầu: tạm tắt Entra SSO + Graph email (giữ
code, bật lại bằng cấu hình), email 100% Brevo, staff đăng nhập email/password.

## Phát hiện định hình phạm vi

- Email đã 100% Brevo từ trước: mọi enqueue (`finance`, `lms-auth`) đều
  `transport:'brevo'`; GraphEmailTransport chưa từng gửi row nào. Phần email
  chỉ còn là env + docs.
- Tắt SSO thì production KHÔNG còn đường đăng nhập staff nào — đây mới là
  phần việc thật.
- `AppUser.email` không unique (default `""`) và chưa có passwordHash.

## Việc đã làm (nhánh `feat/staff-password-auth`)

- Migration `app_user_password_auth`: passwordHash + mustChangePassword +
  lockout, partial unique index `lower(email) WHERE email <> ''` kèm pre-check
  trùng fail-loud.
- `POST /auth/staff-login` (mount vô điều kiện): tái dùng PBKDF2 helper của
  LMS + bộ ký cookie staff của SSO; no-leak generic error + dummy-hash;
  lockout 5/15′; lookup qua `withFacility(..., {bypass:true})` vì AppUser RLS.
  `/auth/logout` chuyển ra ngoài flag SSO.
- `user.changeOwnPassword` / `user.resetPassword` (+ AUDIT_EXCLUDED_PATHS,
  audit inline không secrets); UI: form login, trang `/change-password`, nút
  "Đặt lại mật khẩu" trong trang Users; seed super-admin nhận
  `SUPER_ADMIN_PASSWORD`.
- Env/docs: `.env.prod.example` SSO off + khối M365 comment; nginx thêm
  location `= /auth/staff-login` vào zone auth 5r/m; runbook bước 1.9.

## Bài học đáng ghi

1. **Throw trong `withFacility` nuốt bookkeeping**: bản đầu của
   `changeOwnPassword` tăng loginAttempts rồi `throw badRequest` NGAY TRONG
   transaction → rollback xóa luôn increment, lockout không bao giờ kích hoạt.
   Test tích hợp bắt được; fix bằng pattern outcome-trong-tx, throw-sau-commit.
   Route staff-login không dính vì trả `{ok:false}` thay vì throw.
2. **Thêm cột nhạy cảm = rà mọi chỗ trả nguyên row**: thêm passwordHash vào
   AppUser làm `user.list/create/update/updateRoles` (cast `as AppUserDto`)
   serialize hash về browser. Cast type không bảo vệ runtime — phải `select`
   tường minh (`APP_USER_SELECT`) + test khóa "không có key passwordHash".
3. **RLS lộ bug tiềm ẩn ở SSO cũ**: `sso-routes.ts:220` lookup AppUser bằng
   client thuần — RLS trả 0 dòng ⇒ SSO prod sẽ từ chối tất cả user khi bật
   lại. Ghi vào system-architecture; PHẢI sửa trước khi tái kích hoạt SSO.
4. **Label `isRequired` của Astryx thêm dấu `*`** — regex test neo `$` trên
   label sẽ trượt.

## Validation cuối

typecheck 27/27 · API 106 file / 1009 test · admin 41 file / 404 test — xanh
toàn bộ trên synth DB (cmc-synth-pg). Review: Request-changes → mọi finding
Critical/Important đã xử lý trong cùng phiên.
