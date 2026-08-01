# Báo cáo tình trạng setup local — 2026-07-26 17:39

Đo trực tiếp trên máy (docker/ss/psql/git), không chép từ docs.

## 1. Trạng thái thực

### Toolchain — ĐẠT
- Node v24.18.0 (yêu cầu >=22 ✓), pnpm 10.24.0 (khớp `packageManager` ✓), corepack 0.35.0
- `node_modules` đã cài; Playwright chromium-1228 + headless-shell đã cài
- Checkout: `main @ 0b933bf`, sạch trừ 4 file docs modified + 1 journal untracked

### Containers CMC (đo `docker ps`)
| Container | Trạng thái | Port host | Vai trò |
|---|---|---|---|
| `cmc-synth-pg` | Up 6h | 55432 | DB throwaway `cmc_synth` cho e2e/UI journeys — **40/40 migrations, khớp repo** |
| `cmcv2-prod-api-1` | Up 8h (healthy) | 3000 | API prod-sim, `/health` OK — nhưng là **DAST victim của VinSoc**, khởi động từ **checkout khác** (`/home/manhquy/project/cmc_edu @ 3107c98`), image build **2026-07-18** → code cũ ~8 ngày |
| `cmcv2-prod-postgres-1` | Up 8h (healthy) | 5432 | DB `cmc_prod` — **35/40 migrations, tụt 5** so với repo hiện tại |
| `cmc-e2e-pg` | Exited 2 ngày | 5433 | không chạy |
| `cmc-test-pg` | Exited 3 ngày | — | không chạy |

Stack `cmcv2-prod` chạy **một phần có chủ đích** (override `VinSoc/infra/cmcedu-local/compose.override.yml`: chỉ postgres+api, publish port làm bề mặt tấn công DAST). nginx/admin/lms/worker **không chạy** → hiện **không có UI nào đang được serve**. Không dev server nào đang chạy (4173/4174/5173/3999 trống).

### Env — 2 điểm đứt
- Root `.env` KHÔNG tồn tại; thay vào đó có `env` + `env.prod` (không dấu chấm, gitignored). Không tool nào tự nạp `env` — turbo chỉ passthrough `DATABASE_URL`/`APP_DATABASE_URL`, api dev không dùng dotenv ⇒ phải export tay.
- `env` trỏ DB → `localhost:5432/cmc_edu` — **DB `cmc_edu` không tồn tại** trên server :5432 (chỉ có `cmc_prod`). Cấu hình dev này hiện đứt.
- `env` đặt `SSO_ENABLED=true` trong khi docs ghi Entra SSO tạm tắt (mất quyền M365) — lệch.
- `packages/db/prisma/.env` → `cmc_synth` :55432 — chuẩn, là env đang dùng được.

### Kết luận: "full local" hiện KHÔNG chạy nguyên trạng bằng `pnpm dev`
1. API dev mặc định PORT 3000 → đụng `cmcv2-prod-api-1` (EADDRINUSE).
2. DB dev `cmc_edu` không tồn tại.
3. DB/API port 3000+5432 thuộc stack DAST (code stale, DB tụt migration) — không dùng làm dev.

### Nghiệm thu (đo `acceptance-report/verification.json`)
- Ledger local sinh **hôm nay 16:31** tại commit `179befd` (HEAD sạch lúc chạy): **31/38 proven, 7 not-yet (no-ui-path), 0 run errors** — khớp trần công bố.
- HEAD hiện tại = `179befd` + 6 commits ⇒ regenerate ledger bây giờ sẽ rớt proven (đòi `gitSha == HEAD`). Muốn ledger proven tại `0b933bf`: chạy lại suite ui-chromium.
- CI GitHub Actions sống lại từ 2026-07-26 (repo public); official ledger = artifact CI job `ui-e2e`. Flaky đã biết: `kpi double-fire` (#36) — chỉ trên runner chậm.

## 2. Hướng dẫn chạy & truy cập

### Phương án A (khuyến nghị): dev full local trên synth DB, né stack DAST
```bash
cd /home/manhquy/Downloads/cmc_edu
SYNTH_SEED_ALLOW=1 scripts/synthetic-seed-env.sh        # container cmc-synth-pg :55432 (đang chạy sẵn; --fresh nếu muốn reset)
set -a; . packages/db/prisma/.env; set +a               # export APP_DATABASE_URL + DATABASE_URL

# terminal 1 — API (3001 để né :3000 của DAST stack)
PORT=3001 pnpm --filter @cmc/api dev

# terminal 2 — Admin ERP → http://localhost:5173
VITE_PROXY_API_TARGET=http://localhost:3001 pnpm --filter @cmc/admin dev

# terminal 3 — LMS → http://localhost:5174 (vite tự bump nếu 5173 đã chiếm)
VITE_PROXY_API_TARGET=http://localhost:3001 pnpm --filter @cmc/lms dev
```
- Nếu không cần stack DAST: `docker stop cmcv2-prod-api-1` rồi bỏ `PORT`/`VITE_PROXY_API_TARGET` (mặc định 3000). Đừng stop `cmcv2-prod-postgres-1` tuỳ tiện — nó giữ `cmc_prod`.
- Đăng nhập: staff = email/password (SSO đang tắt). Super admin seed: `SEED_SUPERADMIN_EMAIL` (=admin@cmcvn.edu.vn) / `SEED_SUPERADMIN_PASSWORD` — giá trị trong file `env`. Dữ liệu synth DB: seed bởi `synthetic-seed-env.sh`; helper `apps/e2e/src/db.ts`.
- Gotcha: vite dev resolve `@cmc/ui` từ src (không cần build), nhưng API dev đọc `dist` của packages qua exports map ⇒ sửa `packages/*` xong phải `pnpm --filter @cmc/<pkg> build` trước khi probe API server (unit test thì đọc src, dễ green giả).

### Phương án B: prod-sim đầy đủ qua nginx
Chỉ khi cần diễn tập deploy: từ checkout `project/cmc_edu`, `docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml up -d --build` + TLS certs tại `infra/nginx/certs/`. Không dùng làm dev hằng ngày; nếu dựng lại api nhớ migrate `cmc_prod` 35→40.

## 3. Hướng dẫn kiểm thử

Mọi test cần DB đều đòi **CẢ HAI** `APP_DATABASE_URL` + `DATABASE_URL` (guard `assertNotProdDatabase` chỉ chặn APP_; teardown đọc DATABASE_URL trực tiếp). Export từ `packages/db/prisma/.env` như trên. KHÔNG BAO GIỜ trỏ test vào `cmc_prod`.

```bash
# Unit/integration (nhanh → rộng)
pnpm --filter @cmc/api exec vitest run          # API (104 files/988 tests)
pnpm --filter @cmc/admin test                    # admin (39 files/396 tests)
pnpm test                                        # toàn bộ trừ e2e (turbo)
pnpm typecheck && pnpm lint && pnpm build        # contract gates

# e2e API-only (không browser)
pnpm --filter @cmc/e2e test

# e2e UI journeys — PHẢI chạy riêng project ui-chromium
PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium
#  - thiếu --project=ui-chromium ⇒ api specs + ui specs đá nhau chung DB → false red
#  - lần đầu build admin+lms (~2min); webServers tự lên: admin :4173, lms :4174, api :3999
#  - KHÔNG thêm --reporter=line khi cần ledger (nó override json reporter, journeys.json không update)

# Ledger nghiệm thu (commit TRƯỚC, chạy SAU để gitSha bind đúng HEAD)
pnpm acceptance:report                           # đọc apps/e2e/acceptance-results/journeys.json → acceptance-report/index.html
```
Đọc CI đỏ: nếu `typecheck-and-test` fail ở commit không liên quan → kiểm tra tên test trước; `kpi lifecycle > double-fire` = flaky #36 → `gh run rerun <id> --failed`.

## Câu hỏi tồn đọng
1. File `env` còn là nguồn dev thật không (SSO_ENABLED=true + DB `cmc_edu` không tồn tại đều lệch thực tế) — cập nhật hay bỏ?
2. Có cần tạo DB dev riêng `cmc_edu`, hay chuẩn hoá dev trên `cmc_synth` :55432 luôn?
3. Stack DAST `cmcv2-prod` có cần rebuild lên `0b933bf` + migrate 35→40 cho VinSoc không, hay giữ nguyên phiên bản victim?
