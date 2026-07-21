---
phase: 1
title: "Role-Substrate"
status: completed
priority: P1
dependencies: []
---

# Phase 1: Role-Substrate

## Overview
Đưa role staff vào DB đúng docs/14 ("bám thẳng enum Role trong schema" — hiện đang drift, enum
chỉ ở TS): migration `enum Role` 9 giá trị + `AppUser.roles Role[]`; super_admin gán role qua
admin UI sẵn có; chuẩn bị `AppUser.email` làm khoá map Entra.

## Requirements
- Functional: enum Role trong Prisma khớp CHÍNH XÁC 9 key của `packages/auth` ROLES; `AppUser.roles Role[] @default([])`; admin UI (user page phase-06) gán/sửa roles, gate quyền `user.manage` (super_admin); backfill email cho AppUser hiện có.
- Non-functional: KHÔNG đổi hành vi auth hiện tại (dev-header vẫn nguồn subject non-prod); e2e cũ xanh; RLS/GRANT AppUser giữ nguyên (cmc_app đã có SELECT/INSERT/UPDATE).

## Architecture
- Nguồn 9 key: `packages/auth/src/index.ts` ROLES (docs/14 §1). Enum Prisma phải sinh từ đúng danh sách này — thêm assertion test so sánh `Object.values(Role)` (Prisma client) ↔ ROLES (auth) để hai nguồn không drift tiếp.
- `roles` là mảng: khớp `AuthSubject.roles: readonly Role[]` hiện có toàn codebase; GĐ kiêm nhiệm không cần đổi kiểu.
- Gán role: mutation `user.updateRoles` (hoặc mở rộng user.update sẵn có) — chỉ `super_admin`; audit log ghi thay đổi (roles trước/sau).
- Email: khoá map SSO ở S2 là `AppUser.email` (unique-ify? — hiện `email String @default("")`; cần unique khi non-empty → partial unique index `WHERE email <> ''`).

## Related Code Files
- Modify: `packages/db/prisma/schema.prisma` (enum Role + AppUser.roles + partial unique email index qua migration SQL tay).
- Create: `packages/db/prisma/migrations/<ts>_staff_role_enum_and_assignment/migration.sql`.
- Modify: `apps/api/src/appuser/*` (hoặc router user hiện có — xác định chính xác khi cook) — mutation updateRoles + audit.
- Modify: `apps/admin/src/pages/**` user admin page — cột roles + modal gán (multi-select 9 role, active-5 hiển thị trước).
- Create: test drift-assertion enum↔ROLES; test updateRoles gate (super_admin only, audit ghi).
- Sync: `docs/14` §1 note "enum đã vào schema <date>".

## Implementation Steps
1. Viết migration: `CREATE TYPE "Role" AS ENUM (9 key)`; `ALTER TABLE "AppUser" ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT '{}'`; partial unique index trên email (`WHERE email <> ''`). KHÔNG đụng RLS/GRANT hiện có.
2. Schema.prisma khai báo enum + field khớp migration; `prisma generate`; drift-assertion test enum↔ROLES.
3. Mutation gán role (super_admin gate qua `can()`; zod validate mảng ⊆ 9 key; audit log trước/sau).
4. Admin UI: hiển thị + gán roles trên user page; disable nếu thiếu quyền.
5. Seed/backfill: script gán role cho user thật ban đầu (ít nhất 1 super_admin có email thật) — chạy tay, không hardcode email vào repo.
6. Gates: typecheck + unit + e2e (dev-header flow không đổi) + migrate deploy trên DB dev.

## Success Criteria
- [ ] Migration áp sạch trên DB dev + CI; e2e cũ xanh không sửa.
- [ ] Drift-assertion test enum↔ROLES xanh (khoá không cho 2 nguồn lệch tiếp).
- [ ] super_admin gán roles qua UI, audit ghi; non-super_admin bị chặn (test âm tính).
- [ ] AppUser.email unique khi non-empty; docs/14 sync 1 dòng.

## Risk Assessment
- Đụng auth substrate → adversarial review bắt buộc; hành vi cũ phải bất biến (subject vẫn từ dev-header cho tới S2).
- Migration enum khó đổi về sau (Postgres enum ALTER hạn chế) — chốt đúng 9 key ngay từ đầu (docs/14 khoá).
- Partial unique email có thể vấp dữ liệu trùng sẵn có → migration kiểm tra + báo lỗi rõ trước khi tạo index (stop-condition nếu dữ liệu thật trùng).
