# M365 tạm tắt: email 100% Brevo + staff đăng nhập email/password

- **Status**: DONE — 4/4 phase + vòng sửa theo code-review. Validation cuối:
  typecheck 27/27, API 1009/1009, admin 404/404 (2026-07-26).
- **Branch**: `feat/staff-password-auth` (user chuyển khỏi acceptance branch
  giữa phiên, commit `b36e7c1`; vòng sửa review nằm working tree chờ commit).
- **Review**: `plans/reports/code-reviewer-260726-1558-GH-38-m365-off-email-password-auth.md`
  — verdict Request-changes; đã xử lý: C1 (chặn serialize passwordHash qua
  `APP_USER_SELECT`), I1 (seed không ghi đè mật khẩu đã xoay), I2 (lockout cho
  changeOwnPassword + fix rollback-nuốt-increment), I3 (ADMIN_APP_ORIGIN thành
  env bắt buộc vô điều kiện), minor (P2002 expression-index message, nginx
  /auth/staff-login vào zone auth 5r/m). Known issue ghi nhận, ngoài scope:
  sso-routes.ts:220 lookup thiếu bypass RLS — phải sửa trước khi bật lại SSO
  (đã ghi vào docs/system-architecture.md).
- **Bối cảnh**: dự án mất quyền tenant M365. Entra SSO (đăng nhập staff) và Graph
  (email) phải chạy được ở chế độ TẮT, bật lại được bằng cấu hình khi có quyền.
- **Phát hiện scout quyết định phạm vi**: mọi email hiện đã đi Brevo 100%
  (`finance/router.ts`, `lms-auth/router.ts` đều enqueue `transport:'brevo'`;
  GraphEmailTransport chưa từng được row nào dùng). Boot check chỉ đòi
  `ENTRA_*`/`GRAPH_*` khi `SSO_ENABLED=true`. ⇒ phần email chỉ là việc env/docs;
  phần việc thật là đường đăng nhập staff email/password (production hiện không
  có đường đăng nhập nào khi SSO tắt).

## Quyết định đã chốt (với user)

1. Tạm tắt = gate bằng cấu hình, KHÔNG xóa code SSO/Graph/enum.
2. Staff đăng nhập bằng email + password.
3. Cấp mật khẩu: admin đặt mật khẩu tạm trong trang quản lý người dùng, staff bị
   bắt đổi ở lần đăng nhập đầu (tái dùng pattern mustChangePassword của LMS).

## Phases

| # | Phase | File | Phụ thuộc |
|---|-------|------|-----------|
| 1 | Schema: trường password + unique email | [phase-01](phase-01-schema-password-fields.md) | — |
| 2 | API: /auth/staff-login, đổi/đặt lại mật khẩu, seed | [phase-02](phase-02-api-password-login.md) | 1 |
| 3 | Admin UI: form login, màn đổi mật khẩu, nút reset | [phase-03](phase-03-admin-ui.md) | 2 |
| 4 | Env mặc định, docs, validation toàn cục | [phase-04](phase-04-env-docs-validation.md) | 3 |

## Acceptance criteria

1. API boot production mode với `SSO_ENABLED=false` và KHÔNG có biến
   `ENTRA_*`/`GRAPH_*` nào — boot-checks pass.
2. Staff có passwordHash đăng nhập qua `POST /auth/staff-login`, nhận cookie
   `cmc_staff_session` (payload/cờ y hệt đường SSO), vào được admin SPA.
3. `mustChangePassword=true` ⇒ admin SPA ép đổi mật khẩu trước khi vào app.
4. super_admin đặt lại mật khẩu cho bất kỳ staff nào từ trang Users; người đó
   bị bắt đổi ở lần đăng nhập kế.
5. Sai mật khẩu 5 lần ⇒ khóa 15 phút; mọi lỗi trả thông điệp generic (không lộ
   tồn tại tài khoản); có dummy-hash cân bằng timing như lms-auth.
6. Email không đổi hành vi: mọi luồng vẫn Brevo (đã đúng sẵn — chỉ xác nhận lại
   bằng test hiện có).
7. `pnpm typecheck` + toàn bộ test API/admin xanh; suite e2e hiện tại không đổi.
8. Bật lại Microsoft = chỉ đổi env (`SSO_ENABLED=true` + biến M365 +
   `VITE_SSO_ENABLED=true` khi build admin), không cần sửa code.

## Rủi ro chính

- Email AppUser không unique (default `""`): migration thêm partial unique
  index phải pre-check trùng; nếu DB thật có trùng email ⇒ migration fail có
  chủ đích với thông điệp rõ (xử lý tay trước).
- `mustChangePassword` chỉ enforce phía client (nhất quán pattern LMS hiện có)
  — ghi nhận là giới hạn chấp nhận, không mở rộng middleware trong scope này.
