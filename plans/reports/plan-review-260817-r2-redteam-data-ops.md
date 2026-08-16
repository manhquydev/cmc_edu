# Red-Team Plan Review — R2 (Data / Security / Operations)

**Plan:** `plans/260817-0009-deploy-cmc-edu-vps/plan.md` (v2, 2026-08-17)
**Reviewer:** independent red-team (round 2 — read-only; no repo/VPS/Cloudflare mutations)
**Scope (round 2):** DATA (DB lifecycle, blob storage, backups), SECURITY (secrets on VPS, public-surface bypass, audit integrity, SSH/ops surface), OPERATIONS (sequencing & idempotency, GlitchTip bootstrap/DSN, live-fire tests, missing data/security/ops items).
**Explicitly NOT re-reviewed:** infra/TLS/Cloudflare/cert (R1 infra reviewer) and completeness/executability (R1 validator) — cross-referenced where they overlap, not re-scored.
**Date:** 2026-08-17
**Evidence used (repo, read-only):**
- Plan lines cited inline as (L##).
- `docker-compose.prod.yml` / `docker-compose.observability.yml` / `infra/nginx/nginx.conf` / `infra/nginx/api-locations.conf`
- `scripts/backup-db.sh`, `scripts/restore-drill.sh`, `scripts/seed-super-admin.ts`, `scripts/seed-directors.ts`, `scripts/isolation-check.sh`
- `apps/api/src/lib/track-error-route.ts`, `apps/api/src/lib/instrument.ts`, `apps/api/src/context.ts`, `apps/api/src/boot-checks.ts`, `packages/storage/src/index.ts`, `apps/api/src/exercise/upload-route.ts`, `infra/docker/Dockerfile.{api,worker,admin,lms}`, `infra/docker/docker-entrypoint-node.sh`
- `apps/e2e/playwright.live.config.ts`, `apps/e2e/src/live/live-otp.ts`
- `.env.prod` / `.env.obs` / `.env.prod.example` / `.env.obs.example` (values masked; git-tracking verified: only `*.example` committed, history clean)
- `packages/db/prisma/migrations/20260706054322_p1_remediation_wave1_schema_rls/migration.sql`
- `docs/runbook-deploy.md` (existing backup/restore/escrow baseline), `plans/reports/survey-260815-vps-152-42-167-189.md`, `plans/reports/redteam-260815-vps-state.md` (VPS facts)

---

## 0. Answers to the scope questions (tl;dr)

**DATA**
1. *DB lifecycle on a fresh VPS postgres:* the plan's **migrate → ALTER ROLE cmc_app → up → seed** order (L63, L73) is exactly right and matches the migration's own contract — `p1_remediation_wave1_schema_rls` creates `cmc_app` **IF NOT EXISTS without a password** ("set one out-of-band per environment: ALTER ROLE cmc_app WITH PASSWORD") — so ALTER ROLE after migrate, before api boot, is the correct timing, and network-auth verify is sound. Residual risks: the ALTER ROLE is an **unconditional password reset on every re-run** and the password is interpolated into a `psql -c` string (visible in `ps`/compose logs) — MEDIUM-5.
2. *Volume persistence / wrong-DB danger:* named volumes `cmcv2-prod-pg-data`/`cmcv2-prod-blob-data` persist across `up -d` recreates (good), but nothing in the plan forbids `docker compose down -v`/volume rm, and a bare `compose up` **without the override silently drops the blob mount** (api writes blobs into the container layer → lost on recreate). Wrong-DB: migrate/seed inside the compose network can only reach `postgres` (safe); the hazards are the **tools-image run from the VPS host with host env** and the **restore drill's cross-stack R2 namespace** (CRITICAL-2, HIGH-1).
3. *Blob storage:* the plan mounts the volume to api+worker (L27) — api is the only real consumer today (`upload-route.ts`; worker has no blob call sites) — but **the mount path is never pinned** and must equal `BLOB_STORAGE_DIR=/data/blobs` (the entrypoint `chown`s exactly that path, fail-closed). **Blobs have NO backup and are excluded from every restore path** (CRITICAL-1).
4. *Backups:* backup-vps.sh covers **postgres only** (L64, L84). The restore drill is **R2-based** (`scripts/restore-drill.sh`) while backup-vps.sh is **rclone/Drive** — the drill can never test the actual VPS backups, and on a fresh VPS "restore-drill-before-seed" has nothing to restore (CRITICAL-2, HIGH-1). Offsite creds (rclone Drive token) are unspecified (MEDIUM-10).

**SECURITY**
5. *`.env.prod` on the VPS:* the plan demands "secret MỚI random — KHÔNG dùng secret laptop" (L71) but the transfer step "Clone/rsync repo" can carry the laptop's **real** `.env.prod` (live BREVO/R2/SUPER_ADMIN_PASSWORD/DSN, perms 664 locally) onto the VPS (HIGH-4). Perms (0600), rotation, and escrow of the NEW secrets (CF API token, rclone token, Telegram token, GlitchTip admin password, `.env.obs` SECRET_KEY, GDKD/GDDT passwords) are unspecified; Phase 0.2 cleanup covers only OLD secrets (MEDIUM-10).
6. *Public surface 8080 bypass:* full published-port surface = **nginx `0.0.0.0:8080` + glitchtip `127.0.0.1:8000`**; api/worker/postgres/admin/lms publish nothing (compose verified). The plan never enumerates this surface, and `isolation-check.sh` — the Phase 0.4 gate — **does not check 8080, the pinned subnet, or the live LMS (cmclms/docker project)**; it checks `cmcnew` names + 80/443 only → false confidence (HIGH-3). Also: the Phase 2.4 Host-header curl gate **cannot pass while AOP is on** (HIGH-2).
7. *Audit integrity:* /api/track-error keeps its 64 KB body cap server-side + nginx `clienterr` zone (10 r/m, burst 10) + client-side flood control — preserved **only if** `nginx.vps.conf` declares the four `limit_req_zone`s and includes api-locations.conf; the plan says "include" but not "define zones/headers" (MEDIUM-9). Residual: per-IP-only throttle → distributed spoof/flood of GlitchTip possible; DSN stays server-side only (good).
8. *SSH/ops surface:* root-only key SSH + fail2ban (Phase 0.3) is adequate for a second stack, but all ops scripts run as root on a box hosting the **live LMS** — no non-root deploy user, no documented boundary for backup creds (root-only), and the Phase 6 runner toolchain (node/pnpm/Playwright on the VPS host) is unspecified (MEDIUM-14).

**OPERATIONS**
9. *Idempotency:* deploy-vps.sh as sequenced (build → migrate → ALTER ROLE → up → seed) is re-run-safe (prisma migrate transactional/idempotent; seeds only write password when hash is NULL). Partial Phase-2 failure (migrate OK, seed failed) is recoverable by re-run. The two sharp edges: unconditional ALTER ROLE password reset (MEDIUM-5) and the vacuous drill-before-seed gate (HIGH-1).
10. *GlitchTip bootstrap/DSN:* the DSN is a secret but is server-side only (`@sentry/node` in .env.prod — never in client bundles) and GlitchTip is not publicly reachable (loopback + bridge) — low leak risk if .env.prod stays 0600. `SENTRY_DSN=http://KEY@glitchtip-web:8080/1` is the right bridge host (glitchtip-web joins `cmc-obs-bridge`); "GLITCHTIP_DOMAIN khớp" is misleading (that var is for the operator UI, stays loopback) — MEDIUM-13. GlitchTip **admin password and `.env.obs` SECRET_KEY hygiene** are unplanned (MEDIUM-10).
11. *Live-fire tests:* dead-man live-fire ("kill test → cảnh báo") is measurable in principle but underspecified (which container, interval, token storage, success = alert ≤ N min); backup "dry-run" ≠ restore drill; drill is the real test and it is broken on the VPS (HIGH-1, MEDIUM-11).
12. *Missing entirely:* disk-growth monitoring (140 GB shared with LMS backups), resource limits on cmcv2 services (LMS has mem_limit; cmcv2 has none), backup-freshness + cert-expiry checks in the monitor, timezone/cron pinning, postgres tuning (acceptable to defer), minio tag pinning (MEDIUM-6/7/11/12, LOW-15/16).

---

## Findings by severity

### CRITICAL

**CRITICAL-1 — Uploaded blob data has NO backup and is excluded from every restore path.**
- Plan lines: L27 (blob volume mounted to api+worker), L64 (`backup-vps.sh`: pg_dump containerized + rclone/Drive + keep N + restore-drill), L84 ("Backups: nightly pg_dump offsite … + restore-drill-before-seed gate").
- Evidence: `backup-vps.sh` as specified is **pg_dump-only**; nothing anywhere in the plan covers `cmcv2-prod-blob-data`. Blobs are real product data: `packages/storage/src/index.ts` routes to `LocalDiskBlobStorage` at `BLOB_STORAGE_DIR=/data/blobs` (.env.prod, confirmed) when S3 is empty; `apps/api/src/exercise/upload-route.ts` stores/reads exercise PDFs and session photos through it. The only backup that could ever contain them is the volume itself on the VPS disk — a disk/volume failure or an operator `down -v` = **irreversible loss of every upload**, with no restore path (restore-drill.sh restores a DB dump only).
- Fix: extend backup-vps.sh to back up blobs alongside the dump: `docker run --rm -v cmcv2-prod-blob-data:/data -v /backup:/out alpine tar czf /out/blobs-<ts>.tar.gz -C /data .` → encrypt with the same `BACKUP_ENCRYPTION_PASSPHRASE` → upload to the **same** offsite target with the same retention; extend restore-drill.sh (or its VPS containerized variant, HIGH-1) to restore and smoke-check a known blobRef; add a Phase-3 gate "blob file present in latest backup". Also document in the runbook that `down -v`/volume rm is forbidden and that `up` without the override loses the blob mount.

**CRITICAL-2 — Backup↔restore toolchain is split-brained: the VPS backups cannot be verified by the only restore drill that exists.**
- Plan lines: L28 (M-backup: offsite rclone/Drive), L64 (backup-vps.sh → rclone/Drive), L84 (restore-drill-before-seed gate), L63 (deploy tooling "container tools").
- Evidence: the repo's proven baseline is R2-based — `scripts/backup-db.sh` (AES-256-CBC + RT-13 host≠target check + prune + `BACKUP_S3_*` from .env.prod) and `scripts/restore-drill.sh` (downloads **from R2 only**, decrypts, restores to a throwaway DB, smoke-tests, enforced by `BACKUP_BUCKET_PRIVATE_CONFIRMED`), documented in `docs/runbook-deploy.md` with escrow. The plan forks to a **second** offsite (rclone/Google Drive) with no rclone install/config/credential step and no Drive-based restore script — so the "restore-drill-before-seed gate" can only ever test R2 backups (from the laptop stack), never the VPS Drive backups it claims to protect. Conversely, if the implementer "simplifies" by pointing backup-vps.sh at the same R2 bucket, both stacks share the `db-backups/` prefix: the two prune loops delete **each other's** backups and restore-drill's "latest" selection can restore **the wrong stack's dump** into a drill (or worse, during a real recovery).
- Fix: **one offsite target and one toolchain.** Reuse the R2 + backup-db.sh/restore-drill.sh pattern on the VPS (only change: run pg_dump/psql **inside the postgres container** so no host tooling is needed, HIGH-1), with a **VPS-scoped key prefix** (e.g. `db-backups/cmcv2-vps/`) so the laptop and VPS never prune or restore each other's files. Delete the rclone/Drive fork from the plan (or, if Drive is truly required, then backup-vps.sh and a new Drive restore-drill must both be specified, incl. credential management — but R2 is already built, tested, and documented).

### HIGH

**HIGH-1 — The restore drill cannot run on the VPS as written, and "restore-drill-before-seed" is vacuous on a fresh deploy.**
- Plan lines: L64 (backup-vps.sh "+ restore-drill"), L84 ("restore-drill-before-seed gate").
- Evidence: `scripts/restore-drill.sh` requires host `psql`/`pg_restore`/`aws` CLI, connects to the `postgres` **hostname** (`psql "${DATABASE_URL%/*}/postgres"`) and defaults `DRILL_PG_URL` to `localhost:5432` — none of which exist on the VPS host: no node/pg/aws tools on the host (survey-260815 §1), `postgres` resolves only inside the compose network, and the postgres container publishes nothing. It also **requires an existing backup** ("Run ./scripts/backup-db.sh at least once first") — on a fresh VPS there is nothing to restore, so the "before-seed" gate either hard-fails the first deploy or gets silently skipped (the classic untested-restore trap).
- Fix: (a) containerize the drill: run psql/pg_restore via `docker compose -p cmcv2-prod exec postgres ...` (or a throwaway tools container on `cmcv2-prod-net`) against a throwaway `cmc_drill` DB **inside the postgres container**; keep the existing `DRILL_DB != cmc_prod` guard. (b) Split the gate: first deploy → **synthetic drill** (dump → restore → smoke, no offsite dependency) before seed; redeploys/upgrades → **offsite drill** (restore latest VPS-scoped backup) before any destructive step.

**HIGH-2 — Phase 2.4 verification gate cannot execute while AOP is on, and the workaround quietly weakens the boundary.**
- Plan lines: L75-76 (Gate: "Host-header curl (Host: erp.cmcvn.edu.vn → admin title; hoc-test → lms title); /health ok"), L38-40 (AOP = ssl_verify_client on + CF client cert).
- Evidence: with `ssl_verify_client on`, any direct TLS request to `152.42.167.189:8080` (Host-header curl, no CF client cert) is answered **400 "No required SSL certificate was sent"** — it can never return the admin title. The only public path that presents the CF client cert is Cloudflare, and Cloudflare still routes `erp.cmcvn.edu.vn` → **443 (LMS)** until the Phase-4 Origin Rule lands. So the Phase-2 gate as written fails; the natural "fix" is disabling AOP to test, and nothing in the plan re-asserts AOP afterwards → the real boundary ships disabled (nginx allow/deny alone still blocks non-CF IPs, but AOP — the layer that authenticates Cloudflare — is gone).
- Fix: verify **inside the compose network** — e.g. a curl container on `cmcv2-prod-net` with `--resolve erp.cmcvn.edu.vn:8080:172.28.0.10` and the Host header (or `docker compose -p cmcv2-prod exec nginx wget ...`), plus a **negative gate**: `curl -k https://152.42.167.189:8080/health` must return 400 (client-cert required), proving AOP is live. Public end-to-end verification belongs in Phase 4 (L91) through Cloudflare.

**HIGH-3 — The Phase 0.4 isolation gate is security theater on this VPS: it checks the wrong project and the wrong ports.**
- Plan lines: L51-52 (Phase 0.4 gate: `scripts/isolation-check.sh` exit 0), L24 (pre-flight), L8-11 (invariant: never touch cmc-lms).
- Evidence: `scripts/isolation-check.sh` scans containers/networks/volumes matching **`^cmcnew`** and ports **80/443 only**. The live LMS on the VPS is project **`docker`** with containers `cmclms-web|api|postgres`, volumes `docker_cmclms_prod_pgdata|files`, network `docker_default` (vps-state §1.2). The script will report PASS even if cmcv2 collides with the **LMS** (e.g. the pinned subnet 172.28.0.0/16 overlapping `docker_default`, an accidental volume reuse corrupting `cmclms_prod_pgdata`, or a future 8080 publisher) — the exact collisions invariant #1 must prevent. It also cannot detect the 8080 conflict the plan's own risk table worries about (L110).
- Fix: extend the script (or add a VPS variant `infra/vps/isolation-check-vps.sh`) to check: `cmclms*`/project-`docker` container/network/volume names, host ports 8080 + 8000 (`ss -ltnp`), subnet 172.28.0.0/16 in `docker network inspect` of all existing networks, and the presence of `cmc-obs-bridge`. Keep it a hard gate before Phase 2 `up`.

**HIGH-4 — "Clone/rsync repo → /root/cmc-edu" can carry the laptop's real secrets to the VPS, contradicting the "secret MỚI" requirement in the same step.**
- Plan lines: L71 (2.1 "Clone/rsync repo → /root/cmc-edu; tạo .env.prod (47 keys, secret MỚI random — KHÔNG dùng secret laptop)").
- Evidence: the laptop working tree contains **`.env.prod` with live values** (BREVO_API_KEY, BACKUP_S3_ACCESS/SECRET_KEY, SUPER_ADMIN_PASSWORD, SENTRY_DSN — all real, perms 664) plus `.env`, `.env.dev-accounts`, `.env.local-sim-accounts`, `.env.obs`. `git clone` never transports them (gitignored), but **`rsync` of the tree does**. If the operator rsyncs the whole repo dir (the plan's own wording invites it), the laptop `.env.prod` lands at `/root/cmc-edu/.env.prod` and the deploy may run with laptop secrets — exactly what L71 forbids.
- Fix: pin the transfer to `git clone --depth 1` (or an explicit rsync **with `--exclude` for every `.env*`** and a post-transfer check), create the VPS `.env.prod` fresh from `.env.prod.example` (chmod 600), and add a Phase-2 verification step: scan `/root/cmc-edu` (gitleaks or grep for the laptop's known secret fingerprints) and assert zero matches.

### MEDIUM

**MEDIUM-5 — ALTER ROLE is an unconditional password reset on every re-run, and the password is visible in process/compose output.**
- Plan lines: L63, L73 ("ALTER ROLE cmc_app WITH PASSWORD (network-auth verify)").
- Evidence: the migration creates `cmc_app` with no password by design (out-of-band per environment). Re-running deploy-vps.sh re-applies `ALTER ROLE ... WITH PASSWORD '<pw>'` from .env.prod — silently resetting a password that was rotated out-of-band, and breaking anything holding the old password. Interpolating the password into `psql -c "ALTER ROLE ... '<pw>'"` also exposes it in `ps` output and compose/psql logs.
- Fix: pass the password without command-line exposure (e.g. a 0600 temp file sourced by psql, or psql variable via stdin) and document that this step is the **only** intended cmc_app rotation path; make it conditional (skip if the stored role password already matches `APP_DATABASE_URL`'s).

**MEDIUM-6 — No resource limits on cmcv2 services; a runaway container can starve the live LMS on the shared box.**
- Plan lines: L72 (up with override) — the override's contents are unspecified; docker-compose.prod.yml has **no** mem_limit/cpus anywhere.
- Evidence: the LMS stack sets `mem_limit 1g/1g/256m` (vps-state §1.2); cmcv2 services don't. 2 vCPU/7.8 GB shared with prod LMS + GlitchTip (docs: 256–512 MB) leaves little headroom for an error-looping api/worker.
- Fix: add `mem_limit` (api ~768m, worker ~512m, postgres ~1g, nginx ~128m) and `cpus` to the VPS override; note swap exists (4 GB) but should be a safety net, not a budget.

**MEDIUM-7 — No disk-growth monitoring for the shared 140 GB.**
- Plan lines: L65 (monitor-vps.sh = "health + dead-man-switch"), L84 (backup), none for disk.
- Evidence: 154 GB total, 140 GB free, **shared with LMS backups and build cache (~3.6 GB reclaimable, vps-state §1.2)**; cmc_edu adds pg data + blobs + glitchtip pg/valkey (events can grow to `GLITCHTIP_MAX_EVENT_LIFE_DAYS`) + Docker build layers (~1.4 GB api image).
- Fix: monitor-vps.sh checks `df -h /` (>80% → alert), and the runbook schedules `docker builder prune` + `docker system df` review; wire glitchtip event retention into the disk budget.

**MEDIUM-8 — Blob-mode footguns: S3_ENDPOINT must stay empty on the VPS, and the mount path must equal BLOB_STORAGE_DIR.**
- Plan lines: L27 (M-blob volume mount), L60 (override "volumes blob mount api+worker" — path never stated).
- Evidence: `packages/storage/src/index.ts` switches to S3 whenever `S3_ENDPOINT` is set (and then throws if keys are missing); `.env.prod.example` ships `S3_ENDPOINT=http://minio:9000` — if the implementer copies the example, blobs silently stop working locally. `docker-entrypoint-node.sh` chowns exactly `BLOB_STORAGE_DIR` (`/data/blobs`) and fails closed — a mount at a different path passes boot but writes to the container layer → **uploads lost on recreate**. The minio profile mounts the same volume at `/data` (MinIO format) — enabling it later would collide with app blobs at `/data/blobs` in one volume; `minio:latest` is unpinned.
- Fix: state in the plan that VPS `.env.prod` keeps all `S3_*` **empty** + `BLOB_STORAGE_DIR=/data/blobs`; the override mounts `cmcv2-prod-blob-data` at **exactly `/data/blobs`** in api (worker optional — it has no blob call sites today); forbid enabling the minio profile on the VPS; pin minio image digest if it is ever used.

**MEDIUM-9 — /api/track-error protections on the VPS variant depend on unstated nginx.vps.conf content; residual distributed-spoof/flood risk remains.**
- Plan lines: L40 (include api-locations.conf), L62 (nginx.vps.conf spec — zones/resolver/headers not listed).
- Evidence: api-locations.conf references zones `api`/`auth`/`sso`/`clienterr` and the RT-2 header strip + `X-Forwarded-Proto https` live in **nginx.conf's server blocks**, not in api-locations.conf. A freshly written nginx.vps.conf that includes api-locations.conf but forgets the four `limit_req_zone`s fails loudly at `nginx -t` (good), but one that forgets the RT-2 `proxy_set_header X-Dev-User ""` strip or `X-Forwarded-Proto https` fails **silently** (the API itself gates dev headers on `NODE_ENV!=='production'` — context.ts:51 — so impact is defense-in-depth, but OTP/login redirects would misbehave with a wrong proto). Residual abuse: track-error is unauthenticated by design and throttled **per end-user IP only** (10 r/m) — with real_ip = CF-Connecting-IP the VPS variant keys correctly per user (an improvement over the old topology), but a distributed attacker can still fill GlitchTip with spoofed `url`/`kind` reports and mislead operators.
- Fix: add to the nginx.vps.conf spec: define the four limit_req zones (copy values from nginx.conf), `resolver 127.0.0.11 valid=10s`, RT-2 header stripping, `X-Forwarded-Proto https`, `client_max_body_size 64k` (already in api-locations.conf for track-error) and 50m for /upload/. Consider a server-side global cap or daily per-key dedupe on track-error as defense-in-depth.

**MEDIUM-10 — New-secret lifecycle on the VPS is unplanned (perms, escrow, rotation, verification).**
- Plan lines: L48 (0.1 "ghi danh sách secrets"), L49 (0.2 cleanup = OLD secrets only), L53 (CF API token for certbot-dns-cloudflare), L64 (rclone Drive creds), L65 (Telegram webhook), L71 (new .env.prod), L80-81 (GlitchTip bootstrap + .env.obs).
- Evidence: at deploy end the VPS will hold **new** secrets the plan never manages: certbot-dns-cloudflare token file (needs 0600, outside git), rclone Drive token, Telegram bot token, GlitchTip admin password + `.env.obs` SECRET_KEY (new random? unspecified), GDKD/GDDT bootstrap passwords (must be escrowed for the Phase-6 handover), and `.env.prod` (must be 0600 — the laptop copy is 664 today). Phase 0.2's cleanup (L49) covers only pre-existing leaks.
- Fix: add a Phase-0/2 "new-secrets ledger" step: every new secret gets a path + chmod 600 + an escrow entry (password manager, mirroring the existing BACKUP_ENCRYPTION_PASSPHRASE escrow in runbook-deploy.md) + a rotation note (GDKD/GDDT and SUPER_ADMIN_PASSWORD are bootstrap-only: mustChangePassword=true is set, so post-first-login values must be re-escrowed at handover); add a Phase-6 post-deploy secret scan on the VPS.

**MEDIUM-11 — Dead-man-switch, backup freshness, and cert expiry are not tied together; live-fire spec is too thin to be a gate.**
- Plan lines: L29 (M-deadman), L65 (monitor-vps.sh), L85-86 (Phase 3: "live-fire test (kill test → cảnh báo)" + gate "dead-man live-fire pass").
- Evidence: "kill test → cảnh báo" does not say which container is killed, what the monitor checks (health endpoints? container states? heartbeat?), the check interval, where the Telegram bot token comes from/stored, or how PASS is measured (alert received within N minutes?). A cron/backup that silently stops producing dumps is the classic dead-man failure the monitor should catch but the plan doesn't mention backup freshness; LE cert renewal failure is also silent (Phase 0.5 timer).
- Fix: pin the contract: monitor-vps.sh runs every 5 min via systemd timer; checks (a) each cmcv2 container "running" + /health via the loopback-verifiable path, (b) **newest backup file age < 26 h**, (c) LE cert expiry < 14 days, (d) disk < 80%; Telegram alert on any failure; live-fire = kill the api container, assert alert text arrives at the test Telegram chat within 5 min, then restart; record the run in the Phase-3 gate log.

**MEDIUM-12 — Timezone/cron alignment is unspecified ("mỗi đêm" vs the pinned 02:00 UTC).**
- Plan lines: L64, L84 (cron mỗi đêm), L29 (systemd timer).
- Evidence: backup-db.sh documents "02:00 UTC"; the VPS timezone is unverified (DO SGP = UTC+8). Two schedulers (cron for backup, systemd timer for deadman) with no shared time reference → a "nightly" backup could land anywhere in UTC and drift against the restore-drill expectations.
- Fix: pin both cron and timer to UTC in the runbook (e.g. `CRON_TZ=UTC` or explicit `0 2 * * *` UTC + note in the plan), and state the VPS timezone assumption in Phase 0.

**MEDIUM-13 — GlitchTip DSN/domain alignment and its own data are unaddressed.**
- Plan lines: L80-81 ("SENTRY_DSN = http://KEY@glitchtip-web:8080/1 + GLITCHTIP_DOMAIN khớp").
- Evidence: `glitchtip-web` joins `cmc-obs-bridge` and listens on 8080 inside — the DSN host `glitchtip-web:8080` is correct for api/worker (both on the bridge). But `GLITCHTIP_DOMAIN` (`http://127.0.0.1:8000` in .env.obs.example) drives the operator UI links, not the ingest DSN — "khớp" is misleading; the DSN is hand-written into .env.prod, so a mismatch is invisible until events stop. GlitchTip's own postgres (`cmcv2-obs-pg-data`) holds error events and is **not** backed up (acceptable for telemetry — but should be stated); port 8000 must be verified free (survey says yes — assert in pre-flight).
- Fix: clarify in Phase 3: keep GLITCHTIP_DOMAIN at the operator-loopback value; add a gate that POSTs a test event via the api DSN and asserts it appears in GlitchTip (the plan's "inject lỗi chủ đích" gate does this — make it DSN-based); note glitchtip-pg is intentionally excluded from backups.

**MEDIUM-14 — Phase 6 runner toolchain is unspecified and lands on a production box.**
- Plan lines: L101-102 (repoint suite; "runner = VPS host (docker exec đọc EmailOutbox)"), L67 (live config "baseURL từ env override").
- Evidence: the VPS host has no node/pnpm/Playwright (survey §1) — running the 6-spec campaign "on the VPS host" means installing a Node toolchain + Chromium + system deps **as root on the box hosting the live LMS** (new supply-chain/attack surface), or running from the laptop with cross-machine `docker exec` (live-otp.ts already supports `LIVE_POSTGRES_CONTAINER` override). Also, the current `playwright.live.config.ts` **hardcodes** `LIVE_ADMIN_ORIGIN/LIVE_LMS_ORIGIN` as consts — the plan's "env override" (L67) does not exist yet (already documented by the R1 validator as H-3; flagged here for the ops/security consequence: a mis-targeted campaign would mutate the wrong stack's business data).
- Fix: decide and write down the runner: (a) laptop with SSH-tunneled OTP readback (small live-otp.ts change to shell out over SSH or a temporary `ssh -L 5432` publish), keeping the prod box clean; or (b) a dedicated Playwright container/image on the VPS (mcr.microsoft.com/playwright) with no host toolchain — and implement the env-var repoint in Phase 1 as the plan claims.

### LOW

**LOW-15 — Postgres tuning is absent.** Acceptable at pilot scale (single facility, tens of users; 6.6 GB free RAM); note in the runbook that shared_buffers/work_mem defaults are fine for now and revisit when >2 facilities or heavy uploads land.

**LOW-16 — `minio:latest` unpinned** (docker-compose.prod.yml). Pin to a digest if the minio profile is ever used (MEDIUM-8 forbids it on the VPS anyway).

**LOW-17 — Port 8000/8080 pre-flight assertion.** Add `ss -ltnp` checks for 8080 + 8000 to Phase 0.4 (survey says free today); the plan's 8080-conflict rollback row (L110) exists but no pre-flight check does.

**LOW-18 — e2e OTP container name parity.** `live-otp.ts` defaults to `cmcv2-prod-postgres-1`, matching the plan's project name `cmcv2-prod` (L10) — good; keep the name stable (do not rename the project) or the live suite's OTP readback silently breaks.

---

## What the plan already gets right (data/security/ops — no change needed)
- **migrate → ALTER ROLE cmc_app → up → seed** ordering (L63, L73) matches the migration's documented out-of-band password contract; network-auth verify is the right check.
- Named volumes for pg + blob data persist across container recreates; project/network/volume isolation from LMS is explicit (L8-11).
- Seed idempotency: bootstrap passwords are applied **only when the stored hash is NULL** (seed-super-admin.ts, seed-directors.ts) — a rotated admin/GĐ password is never silently reverted by a re-run.
- Fail-open error tracking: empty/down GlitchTip never blocks traffic (instrument.ts; L13); track-error has a 64 KB server-side cap + nginx clienterr zone + client-side flood control (≤1/2 s, ≤10/page).
- Log caps (json-file 10m×3) are already in both compose files — the VPS override must not remove them; postgres publishes no host port; api/worker/lms/admin publish nothing; minio is profile-gated.
- Existing R2 backup + escrow + monthly-drill baseline (runbook-deploy.md) is sound — the fix direction for CRITICAL-2/HIGH-1 is to **reuse** it, not fork it.
- Live-fire intent is measurable (kill → alert → restore) — just needs the contract pinned (MEDIUM-11).

---

## Status
Status: DONE_WITH_CONCERNS

Summary: The data lifecycle (migrate→ALTER ROLE→up→seed, idempotent seeds, named volumes) and the track-error/audit design are sound, but the backup architecture is not — uploaded blobs have no backup at all, the VPS backup (rclone/Drive) can never be verified by the only restore drill (R2), the drill is not runnable on the VPS, the Phase 2/4 verification gates are unexecutable or false-confidence under AOP/isolation-check, and new-secret lifecycle (perms/escrow/transfer hygiene) is unplanned.

Concerns/Blockers: Close CRITICAL-1 and CRITICAL-2 and HIGH-1..4 before GO under the plan's own acceptance rule (L118). Specifically: add blob backup to backup-vps.sh + restore drill; unify the offsite toolchain (reuse R2, VPS-scoped prefix, containerized drill); make the Phase 2.4 gate network-internal with an AOP-negative assertion; extend isolation-check for cmclms/docker + 8080 + subnet; pin transfer to git clone with a laptop-secret scan; and add the new-secrets ledger (0600/escrow/rotation) plus disk/resource/cert-expiry/backup-freshness monitoring. No app code changes are required — all fixes are plan/config/script work in the Phase-1 artifacts.
