# Phase 1 — Schema: trường password trên AppUser + unique email

## Context

- `packages/db/prisma/schema.prisma:1079-1110` — model `AppUser`: `email String
  @default("")` KHÔNG unique; chưa có trường password nào.
- Pattern lockout đã có trên StudentAccount (`loginAttempts`,
  `loginLockedUntil`) — mirror sang AppUser.
- Repo có 35 migration folders; migration mới theo convention hiện hành
  (`prisma migrate dev --name ...`, tên mô tả hành vi, không mã plan).

## Requirements

1. `AppUser` thêm: `passwordHash String?`, `mustChangePassword Boolean
   @default(false)`, `loginAttempts Int @default(0)`, `loginLockedUntil
   DateTime?`.
2. Unique email cho đăng nhập: partial unique index
   `CREATE UNIQUE INDEX "AppUser_email_lower_key" ON "AppUser" (lower(email))
   WHERE email <> '';` — raw SQL trong migration (Prisma không hỗ trợ partial
   index declaratively; ghi chú trong schema bằng comment cạnh field).
3. Migration pre-check: trước khi tạo index, `SELECT lower(email) ... GROUP BY
   ... HAVING count(*)>1` → nếu có trùng, RAISE EXCEPTION với danh sách email
   trùng (fail rõ ràng, xử lý tay).

## Files

- Modify: `packages/db/prisma/schema.prisma`
- Create: migration folder mới (prisma migrate) + đoạn SQL tay cho pre-check +
  partial index trong file migration sinh ra

## Steps

1. Sửa schema, chạy `pnpm --filter @cmc/db exec prisma migrate dev --name
   add-app-user-password-auth` (DB dev local).
2. Chỉnh file migration: thêm khối DO $$ pre-check trùng email + CREATE UNIQUE
   INDEX partial.
3. `prisma generate`; typecheck packages phụ thuộc.

## Validation

- Migration chạy sạch trên DB dev có seed synthetic.
- Test case tay: insert 2 AppUser cùng email khác hoa/thường ⇒ index chặn;
  2 AppUser email `''` ⇒ cho phép (partial).
- `pnpm typecheck` toàn repo không lỗi mới.

## Risk / Rollback

- Risk: DB môi trường thật có email trùng ⇒ migration fail chủ đích; runbook:
  sửa data rồi chạy lại. Rollback: `migrate resolve --rolled-back` + drop index/
  cột (migration thuần additive, an toàn revert).
