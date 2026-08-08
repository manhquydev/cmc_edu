---
title: "Prisma 7 Migration — Driver Adapter + prisma.config.ts"
status: pending
priority: P2
effort: "1-2d (architectural, needs real-DB smoke)"
tags: [deps, prisma, database, migration, breaking]
created: 2026-08-08
blockedBy: []
blocks: []
---

# Prisma 7 Migration — Driver Adapter + prisma.config.ts

## Vì sao tách riêng (không phải bump thường)

Ngày 2026-08-08, khi xử lý dependabot #84 (prisma 6.19.3 → 7.9.1), scout cho thấy Prisma 7
là **migration kiến trúc tầng kết nối DB**, không phải version bump. Quyết định (user):
**tách khỏi TS6** (TS6 land trước, cơ học), Prisma 7 làm buổi riêng với **smoke DB thật**.
TS6 đã đi theo nhánh `chore/deps-typescript-6` → develop → main.

## Breaking change đã xác nhận (bằng code thật)

`prisma generate` với Prisma 7 fail **P1012**:
> The datasource property `url` is no longer supported in schema files. Move connection
> URLs to `prisma.config.ts` and pass either `adapter` (direct DB) or `accelerateUrl` to
> the `PrismaClient` constructor.

Tức Prisma 7 bỏ `url = env("DATABASE_URL")` trong schema, chuyển sang **driver adapters**
+ `prisma.config.ts`.

## Blast radius (đo tại thời điểm scout)

- Schema: `packages/db/prisma/schema.prisma:31-34` — block `datasource db { provider="postgresql" url=env("DATABASE_URL") }`.
- Factory trung tâm: `packages/db/src/index.ts:28` — `new PrismaClient(url ? { datasources: { db: { url } } } : undefined)` (Prisma 7 bỏ luôn `datasources` override động).
- Barrel export: `packages/db/src/index.ts:8-11` — `export { PrismaClient, Role } from '@prisma/client'` (Prisma 7 có thể đổi surface export; kiểm lại sau bump).
- 3 site khởi tạo khác:
  - `apps/api/src/worker/audit-log-retention-sweep.ts:19`
  - `apps/api/src/test/db.ts:69`
  - `apps/e2e/src/db.ts:61`
- Deps mới cần thêm: `@prisma/adapter-pg` + `pg` (+ `@types/pg`). Hiện repo chưa có.
- Version refs cần bump: `packages/db/package.json` (`@prisma/client`, `prisma`), `scripts/package.json` (`@prisma/client`) — hiện `^6.1.0`.

## Các bước migration (đối chiếu docs Prisma 7 qua context7 trước khi làm)

1. Bump `@prisma/client`/`prisma` → `^7.0.0`; thêm `@prisma/adapter-pg`, `pg`, `@types/pg`; `pnpm install`.
2. Bỏ `url = env("DATABASE_URL")` khỏi `datasource` trong schema.
3. Tạo `packages/db/prisma.config.ts` (datasource/migrate config theo Prisma 7).
4. Refactor factory `packages/db/src/index.ts`: dựng `PrismaPg` adapter từ connection string (DATABASE_URL / url truyền vào) → `new PrismaClient({ adapter })`. Giữ nguyên chữ ký hàm factory để 3 call site khác không phải đổi nhiều.
5. Cập nhật 3 site khởi tạo còn lại nếu chúng tự `new PrismaClient` (ưu tiên gom về factory chung để DRY).
6. `prisma generate` xanh; kiểm export surface (`PrismaClient`, `Role`, `Prisma`) còn đúng — nếu Prisma 7 đổi generated output path, cập nhật import/barrel.
7. Đối chiếu ngữ nghĩa pooling: driver adapter (pg Pool) khác connection mặc định cũ — kiểm cấu hình pool (max, idle) cho worker/API/e2e.

## Verification (bắt buộc — user decision: smoke DB thật)

- `pnpm typecheck` + `pnpm test` + `pnpm --filter @cmc/admin build` + `pnpm --filter @cmc/lms build` xanh.
- **Smoke DB thật** trên throwaway synthetic stack (`SYNTH_SEED_ALLOW=1 bash scripts/synthetic-seed-env.sh --fresh`): chạy migrate + vài query qua adapter mới, chứng minh kết nối/pool hoạt động — KHÔNG chỉ typecheck.
- CI `ui-e2e` trên PR (dùng DB thật) là gate cuối.
- Không dùng `.env.prod`; không rotate credential.

## Rủi ro

- Đổi tầng kết nối DB trên hệ ERP/LMS chạm dữ liệu học sinh → phải smoke thật, không merge chỉ dựa typecheck.
- Pool semantics khác → theo dõi connection leak / max pool ở worker sweep dài hạn.
- Prisma 7 có thể đổi generated client output → import site có thể phải đổi (verify tại bước 6).

## Cross-plan

- Nối tiếp phiên 2026-08-08 (dependabot #84 held). PR TS6 đã tách (`chore/deps-typescript-6`).
- Khi làm: nhánh riêng off develop (đã đồng bộ main), PR → develop → main, giữ đồng bộ.

## Open questions

- Prisma 7 output generator: giữ `prisma-client-js` (có adapter) hay chuyển generator `prisma-client` mới (ESM, output path)? Quyết theo docs context7 tại bước 1.
- Có consumer nào ngoài 4 site + barrel không? Re-grep `new PrismaClient` + `from '@prisma/client'` lại ngay trước khi làm (code có thể đã đổi).
