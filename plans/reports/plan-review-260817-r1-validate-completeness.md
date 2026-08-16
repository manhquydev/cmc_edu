# Plan Review — R1 Validate Completeness & Executability
**Plan reviewed:** plans/260817-0009-deploy-cmc-edu-vps/plan.md
**Reviewer:** independent plan validator (completeness + executability round — TLS/networking NOT re-reviewed, owned by another reviewer)
**Date:** 2026-08-17
**Mode:** READ-ONLY review of the plan; repo files inspected to verify every referenced artifact and command. No files modified.

---

## Verdict

The plan is **structurally sound and correctly carries the red-team CRITICAL fixes** (C1: nginx bind
`0.0.0.0:8080`; C3: `ALTER ROLE cmc_app` in the deploy sequence; AOP; real_ip from CF ranges;
`include api-locations.conf` single source — which today already contains the `/api/track-error`
location + `clienterr` zone; fail-open; per-phase gates; rollback table). It is **NOT yet an executable
runbook**: 4 HIGH and ~8 MEDIUM gaps mean a competent operator following it step-by-step gets stuck at
cert issuance (Phase 0), stack bring-up (Phase 2), seeding (Phase 2), obs bring-up (Phase 3) and the
live UAT campaign (Phase 6). Under the plan's own acceptance rule ("không còn CRITICAL/HIGH mở" before
GO), the HIGHs below must be closed first.

Verified against the repo (evidence in brackets):
- `infra/vps/` does **not exist** — all 4 Phase-1 artifacts (override, nginx.vps.conf, deploy-vps.sh, backup-vps.sh) are to-be-authored; the plan specifies intent, not content.
- `docker-compose.prod.yml` declares `name: cmcv2-prod` (runbook + live-otp default container `cmcv2-prod-postgres-1` agree); the plan calls the project `cmcv2` — inconsistent (affects container names and the OTP readback).
- Seed scripts exist (`scripts/seed-super-admin.ts`, `scripts/seed-directors.ts`) but are **not copied into any Docker image stage** (Dockerfile.api copies only `packages/` + `apps/api/`), and the runtime image has no `apps/api/src` — the seeds' import `../apps/api/src/lms-auth/password-hash.js` cannot resolve in-container.
- `scripts/backup-db.sh` (aws CLI + S3 endpoint + AES-256 + prune + RT-13 host check) and `scripts/restore-drill.sh` exist; the plan says "rclone/Drive như LMS" — a different toolchain, unsourced.
- Client error capture IS implemented (`apps/{admin,lms}/src/lib/error-report.ts`, `error-boundary.tsx`, `POST /api/track-error`, `location = /api/track-error` + `zone=clienterr` in api-locations.conf) — Phase 3 is deploy-only, but the deploy steps themselves are missing.
- Live e2e suite exists (`apps/e2e/playwright.live.config.ts`, 6 specs) but **baseURLs are hardcoded** to `erp.clawcmc.io.vn`/`hoc.clawcmc.io.vn` (not the plan's `erp.cmcvn.edu.vn`/`hoc-test`), and its OTP readback needs `docker exec` on the **VPS host** (`live-otp.ts`), with no runner-machine decision in the plan.
- GlitchTip obs compose publishes `127.0.0.1:8000:8080` and `GLITCHTIP_DOMAIN=http://127.0.0.1:8000`; the plan says "loopback 127.0.0.1:8090" — mismatch.

---

## Findings by severity

### HIGH

**H-1. Seed execution path is claimed-but-unspecified and, as imagined, cannot run.**
- Missing: `deploy-vps.sh` says "seed-super-admin + seed-directors (qua container, RT-C H2/H3: không cần node host)" and Phase 2 repeats "seed-super-admin (hostname-swap qua bridge IP)" — but no exact invocation, and the repo makes the obvious invocations fail: (a) `scripts/*.ts` are in **no image stage** (Dockerfile.api deps/build stages copy only `packages/` and `apps/api/`); (b) the runtime image ships only `apps/api/dist` — the seeds import `../apps/api/src/lms-auth/password-hash.js` (source path) and `@cmc/db`'s `createPrivilegedPrismaClient`, so even if `scripts/` were mounted, the runtime image cannot resolve the import; (c) "hostname-swap qua bridge IP" is not a documented pattern anywhere in docs/ (grep: zero hits) and a VPS postgres is unpublished, so a laptop-side run cannot reach it either.
- Concrete addition: pick and document one workable path with exact commands, e.g. **tools image**: `docker build --target build -t cmcv2-tools .` then `docker run --rm --network cmcv2-prod-net --env-file .env.prod cmcv2-tools sh -c 'tsx /app/scripts/seed-super-admin.ts'` — requires also adding `COPY scripts/ scripts/` + `apps/api/src` to the build stage (a small Dockerfile.api change, in-scope for Phase 1); **or** laptop + SSH tunnel: `ssh -L 5433:postgres:5432 root@152.42.167.189` then run tsx from the laptop with `DATABASE_URL=postgresql://...@127.0.0.1:5433/cmc_prod`. Either way the plan must also specify the **director bootstrap passwords**: `seed-directors.ts` reads `GDKD_PASSWORD`/`GDDT_PASSWORD` (defaults to *undefined* → accounts created with **no passwordHash** → cannot log in) and neither key exists in `.env.prod.example`. State where these two passwords are generated and stored (add to VPS .env.prod / deploy-script args), plus `SUPER_ADMIN_FACILITY="CMC Development"` → facility code `CMCDEVEL` (seed-directors hard-requires it — order dependency is correct in the plan: super-admin before directors).

**H-2. LE cert issuance (Phase 0) has no how-to, and the hoc-test DNS record is never created.**
- Missing: the plan says "cài certbot + cấp cert LE cho erp + hoc-test" but does not state the challenge method. Through a proxied Cloudflare zone, HTTP-01 cannot validate for a hostname served via CF proxy unless the record is temporarily DNS-only; DNS-01 needs a Cloudflare API token with DNS edit (never mentioned as a required credential). **hoc-test.cmcvn.edu.vn is a new subdomain — no DNS record creation step exists in any phase**, so neither cert issuance nor the Phase-4 Origin Rule for hoc-test can work. Additionally, "gia hạn cert hoc.cmcvn.edu.vn" is LMS-owned TLS work bundled into this plan (touches what cmclms-web serves) and must be decoupled from the cmc_edu cutover.
- Concrete addition: Phase 0/1 must include (a) create/verify DNS records (`hoc-test.cmcvn.edu.vn` A → VPS IP, and erp already exists per survey); (b) explicit challenge decision: DNS-01 via `certbot --dns-cloudflare` (requires CF API token — list it as a needed credential) **or** temporarily set the new records DNS-only (grey cloud) for HTTP-01; (c) exact certbot commands and the resulting `/etc/letsencrypt/live/<name>` paths that `nginx.vps.conf` mounts; (d) move the hoc renewal into a separate LMS-owned work item. (TLS-mode/AOP correctness itself is the other reviewer's call — this is only the missing how-to.)

**H-3. Phase 6 live UAT cannot run as described.**
- Missing: (a) `playwright.live.config.ts` hardcodes `LIVE_ADMIN_ORIGIN='https://erp.clawcmc.io.vn'`, `LIVE_LMS_ORIGIN='https://hoc.clawcmc.io.vn'` — the plan says "trỏ erp.cmcvn.edu.vn + hoc-test" with no repoint step (needs a 2-line edit or env-var-izing the constants); (b) OTP readback (`live-otp.ts`) runs `docker exec` on the host that owns the postgres container — the VPS (container default `cmcv2-prod-postgres-1`, overridable via `LIVE_POSTGRES_CONTAINER`); the plan never says where the campaign runs: the laptop cannot docker-exec the VPS container, and the VPS has no node/pnpm/Playwright (survey). (c) container-name mismatch: plan's project `cmcv2` would produce `cmcv2-postgres-1`, breaking the live-otp default even on the VPS.
- Concrete addition: Phase 6 must specify (a) repoint/parameterize the two constants (or document the exact sed/edit); (b) runner decision — e.g. run Playwright on the laptop with a documented SSH-based OTP readback (small change to live-otp.ts to shell out to `ssh root@VPS docker exec …`, or a temporary `ssh -L`-published postgres on 127.0.0.1), or run the suite in a Playwright container on the VPS; (c) fix the project-name inconsistency to `cmcv2-prod` everywhere (plan text, deploy script) so container names match; (d) note the suite needs the super-admin's **current** (post-rotation) password — first run bootstraps via `.env.prod` SUPER_ADMIN_PASSWORD and persists to `apps/e2e/.live-credentials.json` (documented in impl-260815-live-suite.md).

**H-4. Stack bring-up prerequisites are missing: the app compose cannot `up` without them.**
- Missing: `docker-compose.prod.yml` declares external network `cmc-obs-bridge` (create once: `docker network create cmc-obs-bridge`) and a pinned subnet `172.28.0.0/16` — if either is absent/occupied, `up` hard-fails (red-team M3). The plan has no pre-flight step and no `docker network create`.
- Concrete addition: Phase 2 pre-flight: `docker network ls` (verify 172.28.0.0/16 free vs `docker_default`), `ss -ltnp` (8080/8443 free), `docker network create cmc-obs-bridge`, and `scripts/isolation-check.sh` run + extended for the VPS reality (cmclms-* names, subnet, 8080) per red-team M2 — the plan references none of these.

### MEDIUM

**M-1. Obs/GlitchTip bring-up under-specified (Phase 3 gate would fail as written).**
- Missing: port mismatch (plan "127.0.0.1:8090" vs compose `127.0.0.1:8000:8080` + `GLITCHTIP_DOMAIN=http://127.0.0.1:8000`); no `.env.obs` creation step on the VPS (from `.env.obs.example`); no GlitchTip first-user/org/project bootstrap step (manual `/register` in web UI — there is **no admin credential env key**); no step to copy the fresh project DSN into the VPS `.env.prod` `SENTRY_DSN` and restart api/worker. With an empty DSN the api starts fine (fail-open) but **zero events flow** → the Phase-3 gate "gây lỗi chủ đích → event GlitchTip" fails.
- Concrete addition: Phase 3 sequence: cp .env.obs.example → fill secrets → `docker compose -p cmcv2-obs --env-file .env.obs -f docker-compose.observability.yml up -d` → open http://127.0.0.1:8000/register (SSH tunnel or CF tunnel for operator access, or document 8000-vs-8090 decision + GLITCHTIP_DOMAIN alignment) → create user/org/project → copy DSN into VPS .env.prod → `docker compose -p cmcv2-prod up -d --no-deps api worker` → verify event. Also create `cmc-obs-bridge` before obs up (both compose files attach to it).

**M-2. deploy-vps.sh ordering contradicts Phase 2 and the red-team verdict.**
- Phase 1 specifies script sequence "build → **up** → migrate → ALTER ROLE → restart api/worker → seed"; Phase 2 and red-team C3 require migrate **before** up (api/worker boot-check FATAL on an unmigrated DB + missing cmc_app password → nginx depends_on api:healthy never satisfied → stack restart-loops; the "restart api/worker" step papers over it but the operator sees a failed/healthy-gate hang first).
- Concrete addition: script order = build → migrate (container) → ALTER ROLE cmc_app WITH PASSWORD (value = APP_DATABASE_URL password) → up → seed-super-admin → seed-directors → restart api/worker only if seeds ran against a fresh container. Also spell out the ALTER ROLE command (`docker compose -p cmcv2-prod exec postgres psql -U ${POSTGRES_USER} -d cmc_prod -c "ALTER ROLE cmc_app WITH PASSWORD '...';"`) — the plan cites RT-C C3 as resolved but prints no command.

**M-3. Blob storage mode ("S3_ENDPOINT local volume, không minio profile") is not concrete.**
- boot-checks require **either** the full S3_* set **or** `BLOB_STORAGE_DIR`; the local-disk fallback needs the blob volume mounted into **api AND worker** (`cmcv2-prod-blob-data` is currently attached only to the profile-gated minio), and `.env.prod.example` has **no** `BLOB_STORAGE_DIR` key. Without the mount, blobs (session photos, uploads) live in the container's ephemeral layer and vanish on recreate (red-team H4).
- Concrete addition: override adds `volumes: - cmcv2-prod-blob-data:/data` to api + worker, .env.prod sets `BLOB_STORAGE_DIR=/data` (and leaves S3_* empty or documents the R2 alternative), with the choice stated in one line in the plan.

**M-4. VPS .env.prod creation is not a step, and repo delivery/auth is assumed.**
- Missing: where the VPS .env.prod comes from (fresh copy of `.env.prod.example` = 47 keys; which secrets rotate vs reuse — BREVO_API_KEY, BACKUP_S3_* R2 creds, passphrase escrow; `SENTRY_DSN` must be the **new** VPS GlitchTip project), which path it lives at (repo dir /opt/cmcv2 vs /root/cmc-edu), and the `scripts/env-check.sh` gate (CHANGE_ME grep, distinct session secrets, no ALLOW_DEV_AUTH). Repo delivery: "git clone cmc_edu" needs auth — the plan removes the old GITHUB_TOKEN in Phase 0 but never says what replaces it (deploy SSH key? PAT?). Path inconsistency: plan says `/root/cmc-edu`; backup-db.sh header and runbook-deploy.md cron use `/opt/cmcv2` (red-team L2).
- Concrete addition: a Phase 1/2 step "create VPS .env.prod from .env.prod.example, rotate X/Y/Z, store passphrase in PM, run env-check.sh" + repo auth decision + one canonical VPS path used by all scripts/cron.

**M-5. Backup runbook incomplete and toolchain ambiguous.**
- Missing: the plan's `backup-vps.sh` = "pg_dump nightly + offsite (rclone/Drive như LMS) + prune" — but `scripts/backup-db.sh` (the existing, tested script) uses **aws CLI + S3 endpoint** (R2-style), not rclone/Drive. Which does backup-vps.sh wrap? If rclone/Drive, the plan must include rclone install + Drive token setup (new credential). Also missing: the exact cron entry (backup-db.sh header gives `0 2 * * * cd /opt/cmcv2 && source .env.prod && ./scripts/backup-db.sh >> /var/log/cmcv2-backup.log 2>&1`), aws CLI v2 install check on the VPS host, containerized pg_dump path (postgres is unpublished — backup from the host cannot resolve `postgres`; red-team H2), and the **mandatory pre-seed restore drill** (`scripts/restore-drill.sh`, runbook §1.7, red-team verdict condition) which is absent from the plan's Phase 2 sequence.
- Concrete addition: Phase 1/3 specify: backup-vps.sh wraps backup-db.sh (or rclone variant with its creds), a containerized pg_dump invocation (e.g. `docker run --rm --network cmcv2-prod-net --env-file .env.prod postgres:16-alpine pg_dump ...` or exec into the postgres container), the exact cron entries (backup + monthly drill), and a Phase-2 gate "restore drill PASSED before seeding".

**M-6. Health-check + dead-man-switch (Telegram) "mirror LMS" has no mechanism.**
- Missing: which endpoint is polled (https://erp.cmcvn.edu.vn/health through CF? local 8080?), which dead-man service (healthchecks.io check UUID — the designed Tier 2 — vs replicating the LMS's root-crontab health-watch + Telegram pattern), the cron entry, and the Telegram bot token/chat id (new credentials). No live-fire gate exists (e.g., stop worker → alert within grace).
- Concrete addition: a Phase-3/6 step with the concrete cron/script (repo has no health-watch script; create one or vendor the LMS's) + credential list + a fire-drill test.

**M-7. Cloudflare steps lack method and assume access.**
- Missing: zone export method (dashboard CSV vs API), Origin Rule creation method (dashboard steps or API call; rule must be hostname-scoped to `erp.cmcvn.edu.vn` + `hoc-test.cmcvn.edu.vn` only — never hoc), and the required CF permissions (DNS edit + Rules). Also Phase 4's "UFW: allow 8080 từ CF ranges" is insufficient on its own: Docker-published ports bypass UFW (red-team C1/H5 mitigation explicitly says nginx-level allow/deny is the reliable layer) — and Phase 1's "TRUSTED_PROXY_CIDRS = CF ranges" **contradicts the red-team verdict it cites** (C2: keep API trust on nginx 172.28.0.10/32; put CF ranges only in nginx `set_real_ip_from`).
- Concrete addition: explicit CF dashboard/API steps for export + 2 hostname-scoped Origin Rules + required-permission note; reconcile the TRUSTED_PROXY_CIDRS value and add nginx `allow <CF ranges>; deny all;` to nginx.vps.conf. (Correctness adjudication stays with the TLS/networking reviewer — flagged here as a plan-internal contradiction an operator would trip on.)

**M-8. Acceptance/definition-of-done not measurable enough.**
- The plan's gates are mostly qualitative ("healthy", "đúng title", "6/6 pass"). Missing measurable items: restore drill PASS, offsite backup object exists + decrypts with the escrowed passphrase, GlitchTip event verified for a deliberate fault (Phase 3 does have this), dead-man-switch armed + live-fire, UAT 6/6 with 0 client/server errors (Phase 6 has this), LMS regression = body-hash unchanged (Phase 4 has this). Recommend a per-phase go/no-go checklist + a final definition-of-done block in Phase 6 (e.g., "erp+hoc-test via https, all 3 accounts login, 2 GĐ create staff without escalation, audit shows actions, GlitchTip receives an injected error, backup+drill pass, dead-man armed, hoc byte-identical").

### LOW
- **L-1.** Plan never says "do **not** run `prisma db seed` on the VPS" — docs/runbook-deploy.md §1.8 does, and the dev/synthetic seed plants a sentinel facility in the prod DB (red-team H3/M4). Add an explicit exclusion.
- **L-2.** "gia hạn cert hoc.cmcvn.edu.vn" (Phase 0) is LMS-owned; decouple and hand to the TLS reviewer.
- **L-3.** Phase 2 gate "local Host-header curl erp/hoc-test" is right, but add the red-team pre-cutover proof from the **public IP** (`curl --resolve erp.cmcvn.edu.vn:8080:<public-ip> -k ...`) before enabling the Origin Rule.
- **L-4.** Live suite first-run caveats (selector risk on change-password labels, console-error allowlist, attendance window ≤2h, super-admin rotated password) are documented in impl-260815-live-suite.md but not carried into the plan — one line in Phase 6 avoids mid-campaign surprises.

---

## Answers to the review scope

1. **Missing steps/gaps:** covered above — H-1..H-4 + M-1..M-7 are exactly the "how?" gaps (Origin Rule method, LE challenge method, obs bring-up, cron entries, seed invocation on a node-less VPS). Every phase has intent but several lack concrete commands.
2. **Ordering & dependencies:** mostly correct (Phase 2 before 4; cutover after verification; hoc-test DNS before cert before rule). Broken by: deploy-vps.sh "up before migrate" (M-2), missing `cmc-obs-bridge`/subnet pre-flight before `up` (H-4), DNS record for hoc-test absent entirely (H-2), seed-directors depends on seed-super-admin's CMCDEVEL facility (correctly ordered in plan, but no commands).
3. **Initial setup requirement:** covered at outcome level (super-admin + 2 directors + facility + mustChangePassword + escalation guard), but the seed **execution mechanism** and director-password sourcing are the H-1 gap. The facility detail (code CMCDEVEL derivation) is implicitly consistent but never stated.
4. **Full-system requirement on the VPS:** the *code* exists (client error-report + boundary, /api/track-error + nginx location, pino/reqId, GlitchTip obs compose, backup/restore scripts, healthchecks) — the plan covers deploying them, but the deploy specifics are the gaps (M-1 obs bring-up + DSN, M-5 backup/cron/drill, M-6 dead-man). Not "only described for the laptop" — but the VPS mechanics are unstated.
5. **Acceptance criteria / gates:** qualitative; needs the measurable list in M-8. Definition of done exists only in the top "Acceptance" block; no per-phase checklists.
6. **Assumptions not stated:** repo not yet cloned (and clone auth unresolved); VPS .env.prod does not exist and its 47 values are unsourced; CF dashboard/API access + DNS/Rules permissions assumed; rclone/Drive (or R2/aws) offsite credentials assumed; Telegram bot token/chat assumed; GlitchTip bootstrap is manual UI with no credential env; GDKD/GDDT passwords unsourced; 172.28.0.0/16 free is assumed.

---

## Cross-references for the TLS/networking reviewer (NOT adjudicated here)
- LE challenge method through CF proxy (HTTP-01 vs DNS-01 + needed CF token) — H-2.
- Cloudflare SSL mode / AOP origin-CA source verification (Phase 0) — plan carries the verification intent.
- UFW cannot restrict Docker-published ports; nginx allow/deny is the reliable layer (H5) — M-7.
- Plan's "TRUSTED_PROXY_CIDRS = CF ranges" contradicts the cited red-team C2 mitigation (keep 172.28.0.10/32 + CF ranges only in nginx real_ip) — M-7.
- "Gia hạn cert hoc" is LMS TLS work — L-2.

---

Status: DONE_WITH_CONCERNS
Summary: The plan correctly absorbs the red-team CRITICAL fixes and the codebase already implements audit/log/monitor/backup, but as a runbook it is not yet executable — 4 HIGH gaps (seed execution path that cannot work as described, LE-cert/DNS how-to, live-UAT runner + hardcoded domains, missing network pre-flight) and ~8 MEDIUM gaps (obs bring-up + DSN, deploy ordering, blob mount, .env.prod sourcing, backup toolchain/cron/drill, dead-man-switch mechanism, Cloudflare method + internal contradiction, measurable acceptance) must be closed before its own GO rule ("không còn CRITICAL/HIGH mở") is met.
Concerns/Blockers: All findings are additive — none contradict the invariants or require rework of the architecture; the plan needs a Phase-1 expansion that turns the 4 artifact bullets into concrete file contents/commands plus the 4 HIGH items above, and an explicit GO/NO-GO checklist per phase.
