# Plan: Reactivate self-host UAT (feat/back-before-design)

**Status:** DONE (2026-08-15) — live again, verified externally
**Source:** `plans/260809-1145-self-host-uat-deploy/plan.md` (original 5-phase deploy, all DONE 2026-08-09)
**Branch:** `feat/back-before-design` @ 0740c36 (pre-design codebase) — user decision
**Runbooks:** `docs/runbook-deploy.md`, `docs/runbook-uat-golive.md`

## Why reactivate

Live stack `cmcv2-prod` was (re)created with a **merged compose**:
`docker-compose.prod.yml` + `infra/compose.local-sim.yml` (confirmed via
`com.docker.compose.project.config_files` label). The local-sim override replaced
`/etc/nginx/nginx.conf` with `nginx.local-sim.conf` (server_name
erp.localhost/hoc.localhost, `server_name _; return 301 https://...`), so every
external request via Cloudflare → Caddy → tunnel hits the catch-all 301 → redirect
loop. Site is effectively down externally.

Goal: rebuild + restart the stack from `feat/back-before-design` with the **prod
compose only**, so erp.clawcmc.io.vn (admin) and hoc.clawcmc.io.vn (LMS) serve the
pre-design UI.

## Facts verified

- Infra files identical between `feat/back-before-design` and `develop`
  (only `.github/workflows/ci.yml` differs, +5 lines) → branch is deploy-ready.
- No prisma schema diff between branches → **no migration needed**; data volume
  persists (`down` without `-v`).
- `.env.prod` on disk (untracked, rotated secrets) — api container already ran
  with correct CORS (erp+hoc), SSO off.
- Tunnel `cmc-uat-tunnel` systemd unit ACTIVE (VPS 127.0.0.1:8080 → laptop:80).
- VPS Caddy blocks for erp/hoc → 127.0.0.1:8080 configured (verify externally after).
- Docs present: `plans/260809-1145-self-host-uat-deploy/plan.md`,
  `docs/runbook-uat-golive.md`, `docs/runbook-deploy.md`,
  `docker-compose.prod.yml`, `infra/nginx/nginx.conf`.

## Phases

### R1 — Stop misconfigured stack
`docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml down`
(no `-v`: keep postgres/minio data). Removes all cmcv2-prod containers including
the local-sim-contaminated nginx.

### R2 — Rebuild + start from prod compose only
`docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml up -d --build`
Builds api/worker/lms/admin from worktree (= feat/back-before-design), recreates
nginx with prod `nginx.conf` (erp→admin, hoc→lms, default 444).

### R3 — Verify
- Local Host-header: erp /health → ok, erp / → Admin title, hoc / → LMS title,
  unknown Host → 444.
- External: `curl -sI https://erp.clawcmc.io.vn/` → 200 + Admin title;
  `https://hoc.clawcmc.io.vn/` → 200 LMS; `https://router.clawcmc.io.vn` → 307 (9router regression).
- `docker compose ps` all healthy.

## Acceptance criteria
- erp.clawcmc.io.vn serves Admin UI (pre-design) over HTTPS with assets OK.
- hoc.clawcmc.io.vn serves LMS UI over HTTPS.
- /health ok on both; unknown Host rejected (444).
- DB data intact (no volume loss).

## Risks / rollback
- Long build (api/worker ~1.4GB images) — run in background, retry on transient network.
- If external 502 → tunnel or VPS issue (check systemctl cmc-uat-tunnel, VPS Caddy).
- Rollback: `docker compose -p cmcv2-prod down` + recreate from develop per original plan.

## Execution log (2026-08-15)

- **R1 ✅** `docker compose -p cmcv2-prod ... down` (volumes kept). Old stack was created with a
  **merged compose** (`docker-compose.prod.yml` + `infra/compose.local-sim.yml` per container label),
  so nginx ran `nginx.local-sim.conf` (server_name erp.localhost + catch-all `return 301 https`) —
  external requests redirect-looped. Root cause of "site down".
- **R2 ✅** `up -d --build` with prod compose only — all 4 images rebuilt from worktree
  (= `feat/back-before-design` @ 0740c36). Local verify: erp→Admin title, hoc→LMS title,
  /health ok, unknown Host → 444.
- **R3 ⚠️ tunnel found down** — autossh service active but VPS not listening 8080. VPS sshd log:
  `bind [127.0.0.1]:8080: Address already in use` (repeated). Diagnosis: a stale sshd child from an
  earlier tunnel connection held the listener while the laptop's ssh connection went **half-dead through
  NAT** (laptop saw ESTAB with 43B stuck send-q; VPS had no matching session). Manual `ssh -R` test
  succeeded ⇒ mechanics fine, stale state was the blocker.
- **Fix:** `kill <autossh main pid>` → systemd `Restart=always` restarted the unit clean
  (count 1). VPS now listens `127.0.0.1:8080`.
- **External verify ✅** (Cloudflare → Caddy → tunnel → laptop): erp/hoc /health 200, both SPAs
  serve correct pre-design UI with assets 200, router.clawcmc.io.vn still 307 (9router untouched).
- Docker images rebuilt 15:53 (api/worker/lms/admin); stack all healthy.

## Residual risks
- Tunnel flapped earlier (count 108) due to the half-dead NAT connection. ServerAlive 15/3 should
  recover dead conns in ~45s; if the forward drops again, restart the unit:
  `systemctl restart cmc-uat-tunnel` (or kill autossh main pid → Restart=always).
- VPS sshd session for the tunnel must be monitored: stale listeners on 8080 block new binds
  ("Address already in use") until the old sshd child dies.
- Next step per original plan: real staff/parent login journey (human-only), monitoring over UAT window.

## R4 — Clean DB (fresh system) — user request via /ak-cook (2026-08-15)

**Request:** DB hiện không sạch (AppUser=5, Student=7, Receipt=7, ParentAccount=7) — user cần
**DB sạch như hệ thống mới hoàn toàn**, đúng nhánh feat/back-before-design, hệ thống sống thật, rồi báo lại.

**Decision (documented):** chỉ chạy `scripts/seed-super-admin.ts` (tạo Facility "CMC Development" +
super-admin) — đúng baseline tài liệu "1 Facility (seed), 0 Student" và trạng thái đã chứng minh của
deploy gốc 09/08. KHÔNG chạy `prisma db seed` (seed.mjs là dev-only: tạo synthetic sentinel facility
"never prod" + curriculum/shift data — không thuộc baseline sạch).

**Steps:**
1. Backup pre-wipe (S3 nếu cấu hình, else local pg_dump).
2. `docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml down -v` — wipe volume.
3. `up -d --build` (context = worktree feat/back-before-design @ 0740c36, cache-hit).
4. `prisma migrate deploy` (trong api container — tạo cmc_prod tự động qua POSTGRES_DB=cmc_prod).
5. `ALTER ROLE cmc_app WITH PASSWORD` (role do RLS migration tạo không password).
6. `npx tsx scripts/seed-super-admin.ts` (host, hostname postgres → bridge IP).
7. restart api worker; verify counts + external HTTPS + tunnel.

## R4 execution log (2026-08-15) — DONE

- Backup pre-wipe: `/tmp/cmc-pre-wipe/cmc_prod-pre-wipe-260815.dump.gz` (43K; S3 backup chưa cấu hình —
  thiếu BACKUP_S3_* keys trong .env.prod).
- `down -v` → wipe volume; `up -d --build` fresh (context = feat/back-before-design @ 0740c36).
- `prisma migrate deploy` chạy qua one-off api container (cần `-w /app/packages/db` + env DATABASE_URL
  sẵn có; không cần ghi prisma/.env). **Bẫy gặp phải:** image chạy uid=1000, không ghi được prisma/.env;
  giải pháp: dựa vào env() đọc process.env.
- **Bẫy role cmc_app:** ALTER ROLE lần đầu bị hỏng bởi quoting lồng nhau (set sai password) + test
  `-h 127.0.0.1` là dương tính giả (postgres image TRUST loopback). Fix sạch: psql -v + network auth
  verify. Sau đó api/worker healthy.
- Seed: KHÔNG chạy prisma db seed (seed.mjs dev-only, tạo synthetic sentinel facility). Chỉ
  `seed-super-admin.ts` (host, swap `@postgres:` → `@172.28.0.4:` cho cả DATABASE_URL và
  APP_DATABASE_URL — **bẫy:** swap pattern phải là `@postgres:`, không phải `postgres:` vì khớp nhầm username).
  → Facility "CMC Development" + admin@cmcvn.edu.vn (super_admin, mustChangePassword).
- nginx chưa được start ở lượt up đầu (compose abort vì api chưa healthy) → `up -d` lần 2 để start nginx.

**Verify (acceptance):**
- DB: AppUser=1, Facility=1, Student=0, Receipt=0, ParentAccount=0, Enrollment=0 — **sạch như hệ thống mới**.
- Local: erp→Admin title, hoc→LMS title, /health ok.
- External: erp/hoc /health 200, cả 2 SPA đúng title, asset 200, router.clawcmc.io.vn 307.
- Stack: nginx/api/worker/postgres healthy; 0 lỗi fatal sau 09:07Z.
- Version: images built từ worktree sạch @ 0740c36 (= feat/back-before-design).

**Ghi chú bảo mật:** POSTGRES_PASSWORD đã bị in vào transcript session (lệnh grep đầu). Khuyến nghị
rotate POSTGRES_PASSWORD + đồng bộ DATABASE_URL nếu log session được chia sẻ.
