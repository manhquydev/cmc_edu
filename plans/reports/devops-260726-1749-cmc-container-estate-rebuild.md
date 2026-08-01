# Rebuild env + container estate CMC — 2026-07-26

Thực hiện theo brainstorm chốt 3 tồn đọng của `devops-260726-1739-local-setup-status.md`.
User quyết: đọc env → sửa/bỏ; xóa & tạo lại toàn bộ container CMC kể cả `cmcv2-prod`
(rebuild từ repo này); không đụng container dự án khác.

## Quyết định env

`env` cũ: BỎ (không sửa vá). Bằng chứng: dòng 19 dính `BREVO_API_KEY`+`GRAPH_TENANT_ID`
(mất newline), header trỏ container `cmc-pg` đã chết, `SSO_ENABLED=true` ngược trạng thái
M365, origins production. `env.prod` cũ: thay bằng `.env.prod` sạch.

Tạo mới (đều gitignored, đã verify hoạt động):
- `.env` — dev: DB → `cmc-dev-pg` :5433/`cmc_edu`; `PORT=3002` (3000 = prod-sim,
  3001 = langfuse của dự án khác); SSO off; Brevo/Graph/LLM trống (console transport +
  LLM offline stub); secrets LMS/STAFF mới sinh; `SUPER_ADMIN_*` chuẩn contract
  (thay `SEED_SUPERADMIN_*` cũ đã lệch tên biến). Pass `scripts/env-check.sh`.
- `.env.prod` — local-sim: giữ DB/session secrets cũ; SSO off; S3 blank →
  `BLOB_STORAGE_DIR=/data/blobs`; thêm `BREVO_SENDER_EMAIL`; bỏ dòng cấm
  `ALLOW_DEV_AUTH`/`TEST_OTP_SEAM`; origins localhost; LLM key blank.
- `infra/compose.local-sim.yml` (MỚI, nên commit) — override chỉ chạy postgres+api,
  publish 5432/3000, blob volume local; thay thế override VinSoc cũ.

Hygiene: Entra secret trong env cũ đã chết theo tenant; Brevo/LLM key là key thật —
nên rotate khi tiện (đã nằm trong transcript + file cũ trước đó).

## Container estate (sau rebuild)

| Container | Port | Nội dung | Nguồn |
|---|---|---|---|
| `cmcv2-prod-postgres-1` | 5432 | `cmc_prod`, **40/40 migrations**, superadmin seeded | compose `cmcv2-prod` từ repo này |
| `cmcv2-prod-api-1` | 3000 | image build 2026-07-26 @ `0b933bf` (trước đó: 07-18, checkout khác) | như trên |
| `cmc-dev-pg` | 5433 | `cmc_edu` dev, 40/40, dev-seed facility + superadmin | `docker run` (lệnh trong báo cáo này) |
| `cmc-synth-pg` | 55432 | `cmc_synth` fresh (`--fresh`), sentinel `__SYNTH__` verified | `scripts/synthetic-seed-env.sh` |

Đã xóa: stack `cmcv2-prod` cũ (checkout `~/project/cmc_edu`, override VinSoc) + 2 volumes
+ network — DB rỗng nên không mất dữ liệu; leftover `cmc-e2e-pg`, `cmc-test-pg`.
Không đụng: 23 container non-CMC (sentinel-*, dd-*, juice-shop…).

Tái tạo `cmc-dev-pg` khi cần:
```bash
docker run -d --name cmc-dev-pg -e POSTGRES_PASSWORD=cmcdev -e POSTGRES_DB=cmc_edu -p 5433:5432 postgres:16-alpine
set -a; . ./.env; set +a
pnpm --filter @cmc/db exec prisma migrate deploy
docker exec cmc-dev-pg psql -U postgres -d cmc_edu -c "ALTER ROLE cmc_app WITH PASSWORD 'cmcdev'"
pnpm --filter @cmc/db exec prisma db seed && pnpm exec tsx scripts/seed-super-admin.ts
```

Prod-sim lifecycle:
```bash
docker compose -p cmcv2-prod -f docker-compose.prod.yml -f infra/compose.local-sim.yml --env-file .env.prod up -d --build postgres api
```

## Validation (đều PASS)

- `env-check.sh` OK (development, `.env` mới).
- `pnpm build` exit 0.
- Dev API :3002 (`pnpm --filter @cmc/api dev` + `.env`): `/health` ok, `POST /auth/staff-login`
  → `{"ok":true,"mustChangePassword":true}` (admin@cmcvn.edu.vn / pw trong `.env`).
- Prod-sim :3000: `/health` ok, staff-login ok (pw trong `.env.prod`).
- Journey smoke trên synth mới: `kpi-refresh-my.journey.ui.spec.ts` — **1 passed (37.7s)**.

## Dev hằng ngày (cập nhật so với báo cáo 1739)

```bash
set -a; . ./.env; set +a
pnpm --filter @cmc/api dev            # :3002
pnpm --filter @cmc/admin dev          # :5173 (proxy → 3002 qua VITE_PROXY_API_TARGET trong .env... 
                                      # LƯU Ý: vite không tự đọc .env root — export trước như trên)
pnpm --filter @cmc/lms dev            # :5174
```
Login superadmin lần đầu sẽ bị buộc đổi password (mustChangePassword by design).

## Tồn đọng

1. `infra/compose.local-sim.yml` chưa commit (untracked) — nên commit; README Platform Notes
   có thể trỏ tới nó thay cho hướng dẫn socat sidecar khi ở Linux.
2. VinSoc: victim DAST giờ chạy code mới `0b933bf` — nếu resume quét, cập nhật runbook
   VinSoc (compose override cũ của VinSoc không còn cần; stack thuộc repo này quản lý).
3. Rotate Brevo/LLM API key khi tiện.
