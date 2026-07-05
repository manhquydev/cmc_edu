# US-001 P0 Scaffolding — monorepo + tRPC server + health endpoint + UI shell

## Status

planned

## Lane

tiny

## Product Contract

Bootstrap khung dự án CMC EDU v2 để mọi story nghiệp vụ sau có nền chạy được:
monorepo pnpm + Turborepo, `apps/api` chạy tRPC server với một `health`
publicProcedure, và `apps/admin` render shell rỗng dùng design tokens `@cmc/ui`.
Không chạm hard-gate (auth / tiền / dữ liệu trẻ); chỉ dựng khung và chốt
convention (đặt tên procedure `module.action`, error model, tsconfig strict).

## Relevant Product Docs

- `docs/18-tech-stack-va-chuan-ky-thuat.md` (stack, workspace layout)
- `docs/09-kien-truc-c4-v2.md` (kiến trúc C4)
- `docs/11-api-contract.md` (quy ước tRPC, publicProcedure chỉ cho health)

## Acceptance Criteria

- `pnpm install` + `pnpm build` (turbo) xanh; Node ≥22 ESM; TypeScript strict typecheck sạch.
- `apps/api` khởi động; expose `health` publicProcedure trả `{ status: 'ok', ts }`.
- Workspace `packages/{auth,ui,db}` tồn tại và được `apps/api` import resolve (stub `can()` trong `@cmc/auth`; Prisma schema tối thiểu + `prisma generate` chạy).
- `apps/admin` (Vite + React 19 + react-router v7) render shell rỗng dùng token `@cmc/ui`; dev server chạy.
- 1 smoke test (Vitest) gọi `health` procedure pass.

## Design Notes

- Commands: n/a (chưa có nghiệp vụ).
- Queries: `health`.
- API: `health` publicProcedure (tRPC 11 + zod).
- Tables: Prisma schema tối thiểu (chưa có domain schema).
- Domain rules: none (scaffolding).
- UI surfaces: `apps/admin` shell rỗng.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-001 --unit 1 --integration 0 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Vitest smoke: `health` procedure trả `{status:'ok'}`. |
| Integration | Build turbo toàn workspace xanh; `apps/api` boot. |
| E2E | n/a giai đoạn này. |
| Platform | `pnpm build` dựng được binary/bundle trên máy dev. |
| Release | `pnpm build && pnpm test` toàn workspace. |

## Harness Delta

First story bootstrapping the greenfield v2 build. Xác nhận greenfield tại
`vip/CMC`. Không thay đổi rule harness.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
