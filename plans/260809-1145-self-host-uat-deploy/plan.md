# Plan: Self-host CMC EDU UAT (laptop → reverse SSH tunnel → DO VPS)

**Status:** All 5 phases DONE (2026-08-09) — live at https://erp.clawcmc.io.vn (admin)
and https://hoc.clawcmc.io.vn (LMS), split per Phase 6 below. Remaining: real
staff/parent login journey (human-only), optional secondary secret rotation
(BREVO/BACKUP), monitoring during the 2-4 week UAT window.

## Phase 6 — Split to two domains (2026-08-09, post-initial-deploy)
User reported `erp.clawcmc.io.vn` showed the LMS UI (technically correct per the
single-domain nginx.conf's `location /` → LMS design, but not what they wanted)
and asked to make `erp.*` admin-only and add `hoc.clawcmc.io.vn` (DNS already
configured by user) for LMS-only. This reverses the Phase 2 single-domain
amendment — explicit user instruction, not a re-litigation.

**Advisory checkpoint (kongming, `--advise`):** confirmed go, given SSO is off
(`SSO_ENABLED=false` → the single-valued-redirect-URI risk from the earlier
brainstorm doesn't apply) and cookies are host-only (no `Domain=` scoping, so
two domains just get two independent sessions). Flagged two build-time traps
and one latent bug, all verified against source before fixing:
1. **`infra/docker/Dockerfile.admin` bakes `VITE_BASE=/admin/` by default** —
   serving that bundle at a domain root would break all asset URLs. Fixed:
   `docker-compose.prod.yml` admin build args now pass `VITE_BASE: /`; the
   edge nginx erp block still rewrites `^/(.*)$` → `/admin/$1` before
   proxying (container's own `spa-fallback-admin.conf` is unchanged, still
   serves from `/admin` internally — only what the browser sees changed).
2. **`infra/docker/Dockerfile.lms` copied the generic `spa-fallback.conf`**
   (falls back to root `/index.html`, which doesn't exist — dist is under
   `/lms`) instead of the repo's own `spa-fallback-lms.conf`. This was a
   pre-existing latent bug (would have broken deep-link refresh on any LMS
   domain, single- or two-domain). Fixed by swapping the COPY target.
3. `VITE_API_URL` stays empty for both SPAs (relative `/trpc`, same-origin
   per domain) — no change needed, `trpc.ts` in both apps already handles empty correctly.

**Implementation:**
- Rewrote `infra/nginx/nginx.conf`: two `server` blocks (`erp.clawcmc.io.vn` →
  admin at root, `hoc.clawcmc.io.vn` → lms at root), both `include`ing a new
  shared `infra/nginx/api-locations.conf` (extracted from the local-sim
  pattern, single source of truth so rate limits/proxy behavior can't drift
  between domains) for `/trpc`, `/auth`, `/upload`, `/health`. Added a
  `default_server { return 444; }` block to reject unrecognized Host headers
  outright instead of falling through to one SPA. `limit_req_zone`s stay
  defined once in `http{}` (defining per-server would error).
- `docker-compose.prod.yml`: nginx now mounts `api-locations.conf` too; admin
  build args gained `VITE_BASE: /`.
- `.env.prod`: `CORS_ORIGINS` → both origins (comma-separated, api's
  boot-checks already test multi-origin support); `ADMIN_APP_ORIGIN` stays
  `erp.clawcmc.io.vn` (used only for the SSO logout redirect, which is inert
  with SSO off).
- Rebuilt `admin` + `lms` images, recreated `admin`, `lms`, `nginx` containers
  (`--no-deps`, api/worker/postgres untouched and stayed healthy throughout).
- VPS: backed up Caddyfile, added `hoc.clawcmc.io.vn { reverse_proxy 127.0.0.1:8080 }`
  (same tunnel port as erp — nginx routes both domains by Host header, no
  second tunnel needed). `caddy validate` before `systemctl reload` (not restart).

**Verified:**
- Local (Host-header curl through loopback nginx): `erp.*` → `<title>CMC EDU —
  Admin</title>`, un-prefixed `/assets/*` resolves 200; `hoc.*` → `<title>CMC
  EDU — Học sinh & Phụ huynh</title>`; both `/health` → ok; unknown Host → connection
  closed (444, curl reports empty-reply/exit 52 — correct behavior, not a bug).
- External HTTPS (through Cloudflare → Caddy → tunnel → laptop, full chain):
  `https://erp.clawcmc.io.vn/` → Admin title + working asset load;
  `https://hoc.clawcmc.io.vn/` → LMS title; both `/health` → ok.
- Regression: `https://router.clawcmc.io.vn` (9router) still 307 → `/dashboard`,
  unaffected by any of the above.
- Not yet done: real human login through both SPAs (staff on erp, parent on hoc).

## Phase 7 — Code review of Phase 6 changes + fixes (2026-08-09)
Ran `code-reviewer` against the diff (nginx.conf, api-locations.conf,
docker-compose.prod.yml, 4 Dockerfiles). Found 1 CRITICAL, 2 HIGH, 2 MEDIUM (plus
LOW items not acted on this round). Checked the critical one against live data
before fixing (`SELECT * FROM "FacilityNetwork"` → 0 rows, so it wasn't actively
exploited, but the bug was real and would trigger the moment that table gets a row).

- **CRITICAL — real client IP was lost end-to-end.** The tunnel means every
  request's `$remote_addr` at nginx was the docker bridge gateway (172.28.0.1,
  constant), not the real client. Broke: (1) the `auth`/`sso`/`api`
  `limit_req_zone`s — one shared bucket for the entire internet instead of
  per-IP, so a handful of simultaneous parent logins would 429 each other; (2)
  `apps/api/src/checkin/router.ts`'s CIDR-based FacilityNetwork check-in
  verification — a constant IP matching a configured office CIDR would let
  anyone on the internet get `verification: 'network'` (the strongest proof
  level) with a forged audit trail; (3) `TimePunch.ip` logging a useless
  constant. Fixed: added `set_real_ip_from 172.28.0.0/16; real_ip_header
  X-Forwarded-For; real_ip_recursive on;` to `nginx.conf`'s `http{}` block —
  safe specifically because this nginx has exactly one possible traffic source
  (the tunnel). Verified live: spoofed `X-Forwarded-For` header now shows up
  correctly in nginx's access log; a real external request now logs a
  Cloudflare edge IP (104.22.x.x) instead of the constant gateway address.
  **Residual limitation (documented, not fixed this round):** because
  Cloudflare proxies both domains, the IP nginx now sees is Cloudflare's edge,
  not the end user's real IP — full resolution requires Caddy on the VPS to
  trust Cloudflare and forward `CF-Connecting-IP`. Until then, rate limiting
  is per-Cloudflare-PoP (coarse but no longer globally shared) and
  FacilityNetwork CIDR verification should not be relied on for real geofencing.
  No `FacilityNetwork` rows are configured, so this isn't live-exploited today.
- **HIGH — `infra/nginx/api-locations.conf` was untracked** despite being
  load-bearing (`include`d by both server blocks; nginx refuses to start
  without it). Fixed: `git add`ed.
- **HIGH — no gzip anywhere in the chain**, so the ~4.2MB admin bundle crossed
  the laptop's home-upload tunnel leg uncompressed on every cold load. Fixed:
  `gzip on` + `gzip_types` for css/js/json/svg in nginx's `http{}`.
- **MEDIUM — HSTS was dropped from nginx (correct, TLS moved to Caddy) but
  never re-added at the actual terminator.** Fixed: added `header
  Strict-Transport-Security "max-age=31536000; includeSubDomains"` to both the
  erp and hoc Caddy site blocks on the VPS (backed up Caddyfile first,
  `caddy validate` before `reload`). `router.clawcmc.io.vn` (9router) block
  untouched.
- **MEDIUM — `CORS_ORIGINS` in the running api container was stale** (only
  `erp.*`, missing `hoc.*`) — the value in `.env.prod` on disk was already
  correct from earlier in this session, but `api`/`worker` hadn't been
  recreated since, so they were still running with the old env. Fixed:
  `docker compose up -d --no-deps --force-recreate api worker`; confirmed
  `$CORS_ORIGINS` inside the container now lists both origins.
- Also fixed a stale comment in `nginx.conf` (pointed at the wrong filename,
  `local-sim-api-locations.conf` instead of the real `api-locations.conf`).
- **Deferred (LOW, not acted on):** dead TLS-certs volume mount + doc
  reference (nginx no longer does TLS), `/admin/`-style old-link 301s, JSON
  error page for 429s, nginx healthcheck with a Host header, extracting a
  `common-proxy.conf` for the header/proxy_set_header lines duplicated
  (identically, verified) across both server blocks.
- Verified no regression: `router.clawcmc.io.vn` (9router) still 307 throughout
  every restart/reload in this phase; erp/hoc `/health` still 200 after each change.
**Created:** 2026-08-09
**Brainstorm source:** `plans/reports/brainstorm-260809-1145-self-host-uat-security-model.md`
**Branch:** none (infra deploy — no repo code branch needed except for nginx/.env edits)

## Outcome
`https://erp.clawcmc.io.vn` (admin) + `https://hoc.clawcmc.io.vn` (LMS) serve the
full CMC EDU stack running on the local laptop, for a 2–4 week real-user UAT. The
internet-facing path is limited to the nginx port via a unidirectional reverse SSH
tunnel; the laptop's broader attack surface (SSH, dev services, credentials, LAN)
does not increase even if the VPS is root-compromised.

## Amendment (2026-08-09, Phase 2 start) — domain topology reversed
Original brainstorm picked two subdomains (`erp.clawcmc.io.vn` admin,
`hoc.clawcmc.io.vn` LMS) on the assumption this was a small nginx change.
Reading the actual `infra/nginx/nginx.conf` + `infra/compose.local-sim.yml`
showed the repo is deliberately built and tested for **ONE domain, path-based**
routing (LMS at `/`, admin at `/admin/`), with SSO redirect URI, cookie scoping,
and RT-2/5/6 security logic all shaped around a single `server_name`. Two
subdomains would require new, untested auth/CORS/cookie surface for zero
functional gain. Advisor (kongming) confirmed: collapse to one domain.
**Domain = `erp.clawcmc.io.vn`** (admin ERP at `/admin/`, LMS parent portal at `/`).
`hoc.clawcmc.io.vn` is dropped — not used.

> **Superseded by Phase 6 below (2026-08-09, same day):** the user asked to
> split into two domains after all, so `hoc.clawcmc.io.vn` IS live — erp for
> admin-only, hoc for LMS-only. This paragraph is historical context for why
> single-domain was tried first; don't act on "not used" — check Phase 6.

## Dependencies / prerequisites
- Local laptop: Docker 29 ✓, 29GB free RAM ✓, behind NAT ✓.
- DO VPS 165.22.211.19: Caddy 2.11 ✓, fail2ban ✓, sshd ✓, domain clawcmc.io.vn ✓.
- DNS control over clawcmc.io.vn (user to add A records in phase 4).
- Repo already prod-containerized: `docker-compose.prod.yml` (single nginx entry).

## Phases

### Phase 1 — Laptop prep + reverse SSH tunnel — ✅ DONE (2026-08-09)
- ~~Disable lid suspend~~ — SKIPPED per user decision: laptop only needs to serve while
  actively in use; no always-on requirement. `Restart=always` + autossh recovers on wake.
- Gen dedicated ED25519 key `~/.ssh/cmc_uat_ed25519` (laptop → VPS, passphraseless for autossh). DONE.
- Added pubkey to VPS `/root/.ssh/authorized_keys` as `restrict,port-forwarding,no-pty,command=""` (forward-only, no shell). DONE — see incident report for the false-alarm detour (client ssh-agent key ordering, not a real VPS break — `plans/reports/incident-260809-1155-vps-authorizedkeys-corrupted.md`).
- Installed autossh; systemd unit `/etc/systemd/system/cmc-uat-tunnel.service`:
  `autossh -M 0 -N -R 127.0.0.1:8080:127.0.0.1:80 -i ~/.ssh/cmc_uat_ed25519 -p 22 root@165.22.211.19`
  + `Restart=always`, `RestartSec=5`, `ServerAliveInterval=15/CountMax=3`, `ExitOnForwardFailure=yes`,
  `IdentitiesOnly=yes` (lesson from the incident). Enabled + started, `Active: active (running)`.
- **Verified (L4):** from VPS, `ss -tlnp` shows sshd LISTEN on `127.0.0.1:8080`; `curl 127.0.0.1:8080`
  connects and gets an HTTP response (301, from whatever currently listens on laptop:80 — CMC EDU
  itself is not deployed yet, that's Phase 3). Tunnel mechanism confirmed end-to-end.
- Gate met: tunnel is up, forward-only key confirmed to block shell/exec, autossh will reconnect on drop.

### Phase 2 — Repo config for single-domain self-host — ✅ DONE (2026-08-09)
- Domain topology detour: briefly reconsidered 2-domain (repo has a tested
  `nginx.local-sim.conf` using erp.localhost/hoc.localhost) but confirmed no
  production-grade 2-domain nginx config exists — only the local-sim variant
  (self-signed cert, relaxed rate limits). Kept the single-domain decision:
  `erp.clawcmc.io.vn`, LMS at `/`, admin at `/admin/`, using the repo's real
  `infra/nginx/nginx.conf` almost unchanged.
- `.env.prod` updated: `CORS_ORIGINS` + `ADMIN_APP_ORIGIN` → `https://erp.clawcmc.io.vn`
  (were `http://localhost:5173` leftover from local-sim). `SSO_ENABLED=false` confirmed
  (Entra tenant unavailable — matches docs/system-architecture.md); no `ALLOW_DEV_AUTH`/`TEST_OTP_SEAM`.
- `docker-compose.prod.yml`: nginx `ports` narrowed to `["127.0.0.1:80:80"]` only
  (dropped `443:443` — Caddy on VPS terminates TLS; loopback bind, Docker bypasses UFW so this matters).
- `infra/nginx/nginx.conf`: removed the `443 ssl` server block and the `80→443` redirect
  entirely (no TLS locally — Caddy is the real terminator over the tunnel); single
  `listen 80; server_name erp.clawcmc.io.vn;` block retained with all existing
  location/rate-limit/RT-2 logic unchanged. `X-Forwarded-Proto` hardcoded to `https`
  (was `$scheme`, which would always resolve to `http` here and undercut RT-5 assumptions
  downstream — verified apps/api does not itself branch on this header for secure-cookie
  logic, but hardcoding keeps the header semantically correct for any downstream consumer).
- **Incident + resolved:** `docker compose config` was run without redirecting
  output, printing all resolved secrets into this session's transcript. Contained
  immediately; core secrets rotated in place (`POSTGRES_PASSWORD`, `DATABASE_URL`,
  `APP_DATABASE_URL`, `LMS_SESSION_SECRET`, `STAFF_SESSION_SECRET`,
  `SUPER_ADMIN_PASSWORD`) since Postgres had never been started (zero data risk).
  `BREVO_API_KEY`/`BACKUP_S3_*` left as-is (low priority, user can rotate independently).
  See `plans/reports/incident-260809-1345-secrets-printed-to-transcript.md`.
- Gate met: `docker compose -f docker-compose.prod.yml config` validated (exit 0, redirected to file, secret-safe grep only).

### Phase 3 — Build + run stack on laptop
**Repo bug found + fixed (2026-08-09):** all 4 Dockerfiles (`api`, `worker`, `admin`,
`lms`) run `prisma generate` right after `COPY packages/`, but `prisma.config.ts`
requires `packages/db/prisma/.env` to resolve `DATABASE_URL` (Prisma 7 config
validation) — CI (`ci.yml`, `ui-e2e.yml`) writes that file before running Prisma,
but no Dockerfile did. First build failed identically on all 4 images:
`PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`.
Fixed by adding one `RUN printf 'DATABASE_URL=postgresql://build:build@localhost:5432/build\n' > packages/db/prisma/.env`
line before `prisma generate` in each Dockerfile — build-time-only placeholder,
`generate` never opens a connection, mirrors CI's pattern.

**Note:** first build attempt also hit a transient `TLS handshake timeout` pulling
the `docker/dockerfile` BuildKit syntax image from Docker Hub (WiFi flakiness) —
retried immediately, connectivity confirmed fine (`curl auth.docker.io` → 405 as expected).

- `docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml up -d --build`.
- **Found the repo's own `docs/runbook-deploy.md`** — first-time-deploy sequence is:
  build → `prisma migrate deploy` (creates `cmc_app` role via the RLS migration)
  → `up -d` → seed → seed-super-admin. First `up -d` attempt correctly failed
  (api unhealthy, `password authentication failed for user "cmc_app"`) because
  no migration had run yet — DB was empty, `cmc_app` role didn't exist. This is
  expected per the runbook, not a bug. Also discovered and cleared a **stale
  `cmcv2-prod_cmcv2-prod-pg-data` volume from a 2026-07-26 local-sim run** (no
  real UAT data in it) before this attempt, which was a red herring for the
  same symptom — the real fix is running migrations, not just a fresh volume.
- Per runbook 1.4's own caveat: `postgres` hostname only resolves inside the
  compose network, so migration must run via `docker compose exec api sh` (or a
  throwaway container on the same network), not from the VPS/laptop host shell.
- `docker compose ps` all healthy; `docker compose logs` clean. — ✅ DONE (2026-08-09)
- Local verify Host-routing: `curl -H 'Host: erp.clawcmc.io.vn' 127.0.0.1` → admin; `Host: hoc...` → lms; `/trpc` → api.
- Gate: all services Up >2 min; postgres reachable from api only.

**Additional fix needed (not in runbook):** the `p1_remediation_wave1_schema_rls`
migration creates the `cmc_app` role WITHOUT a password by design ("password set
out-of-band per environment" per its own comment) — `prisma migrate deploy`
succeeding does not make api/worker able to log in. First `up -d` after migration
still failed identically (`password authentication failed for user "cmc_app"`).
Fixed with one `ALTER ROLE "cmc_app" WITH PASSWORD '<value from APP_DATABASE_URL>'`
run via `docker exec ... psql` (superuser), matching `.env.prod`'s rotated secret.
After that, `docker compose restart api worker` → healthy immediately.

Also: `scripts/seed-super-admin.ts` (runbook step 1.9) is NOT in the api image
(Dockerfile only copies `apps/api/dist`, not repo-root `scripts/`) and the
runbook's plain `npx tsx scripts/seed-super-admin.ts` from host can't resolve
the Docker-internal `postgres` hostname. Worked around by running it from the
laptop host with `DATABASE_URL`/`APP_DATABASE_URL` hostname swapped from
`postgres` to the postgres container's bridge-network IP (reachable directly
from the Linux host without publishing any port) — session-only env override,
`.env.prod` itself untouched.

**Result: full stack verified functional** —
`curl -H 'Host: erp.clawcmc.io.vn' http://127.0.0.1/health` → `{"status":"ok"}`;
`/admin/` → 200; `/` (LMS) → 200; `/trpc/` → 204 (route alive). RAM: full CMC EDU
stack uses ~230MB total (nginx 13MB, api 72MB, worker 79MB, postgres 39MB, admin/lms
12MB each) — negligible against the laptop's 39GB. Super-admin seeded:
`admin@cmcvn.edu.vn` (bootstrap password in rotated `.env.prod`, forces change on first login).

### Phase 4 — VPS Caddy + DNS — ✅ DONE (2026-08-09)
- Backed up `/etc/caddy/Caddyfile`, appended one block:
  `erp.clawcmc.io.vn { reverse_proxy 127.0.0.1:8080 }` (single domain, per the
  Phase 2 amendment — `hoc.clawcmc.io.vn` not used). `caddy validate` passed
  before reload.
- User confirmed DNS A record already added. Note: `clawcmc.io.vn` is behind
  Cloudflare proxy (orange cloud) — `erp.clawcmc.io.vn` resolves to Cloudflare
  IPs (104.21.x/172.67.x), same pattern as the pre-existing `router.clawcmc.io.vn`.
  This doesn't change the security model (Cloudflare → Caddy → tunnel → laptop
  is still the only path; laptop's home IP still never appears anywhere).
- `systemctl reload caddy` (not restart — preserves 9router's live connections).
  Confirmed via journalctl: ACME http-01 challenge served through Cloudflare's
  edge IPs, `certificate obtained successfully` for `erp.clawcmc.io.vn`.
- Gate met: `curl https://erp.clawcmc.io.vn/health` → `{"status":"ok"}` (HTTP/2,
  valid LE cert); `/admin/` → 200; `/` (LMS) → 200. Regression check:
  `https://router.clawcmc.io.vn` still 307 → `/dashboard`, unaffected throughout.

### Phase 5 — End-to-end validate + hardening — ✅ DONE (2026-08-09, minus real-user journey)
- External `curl https://erp.clawcmc.io.vn/health` → `{"status":"ok"}`; `/admin/` and
  `/` (LMS) → 200. (Single domain per Phase 2 amendment — no `hoc.*`.)
- UFW enabled on laptop: `default deny incoming` / `allow outgoing`; SSH allowed
  only from private ranges (192.168.0.0/16, 172.16.0.0/12, 10.0.0.0/8) — covers
  both home WiFi and mobile-hotspot subnets seen during this session. Verified
  nginx already bound `127.0.0.1:80` (not `0.0.0.0`) before enabling, so Docker
  never bypassed UFW in the first place; UFW is the second layer, not the only one.
- **Tunnel-kill isolation test:** `systemctl stop cmc-uat-tunnel` → external
  `curl` → `502` immediately; `https://router.clawcmc.io.vn` (9router) unaffected
  throughout (still 307) — proves the two services are fully independent.
  `systemctl start` → external back to `200`/healthy within ~3s.
- **Not done / deferred to user:** lid-close/resume test (lid-suspend handling was
  explicitly dropped per user's Phase 1 decision — "chỉ cần hoạt động khi laptop
  hoạt động" — so this is no longer an applicable gate) and the real staff+parent
  login user journey (needs a human clicking through the UI, not automatable here).

## Acceptance criteria
See brainstorm report §Acceptance (a)–(e). Summary: external reaches only erp/hoc
HTTPS; VPS-compromise blast radius = one port; no laptop key on VPS; nginx loopback
bind; tunnel-kill isolates app; both user types log in over HTTPS.

## Risks / rollback
- **CORS misconfig** → auth cookie not set on one domain. Mitigation: test both origins in phase 3 before opening to users.
- **VPS sshd `GatewayPorts`** — reverse tunnel default binds to VPS 127.0.0.1 (what we want). If Caddy on VPS needs a non-loopback bind, set `GatewayPorts clients` — but prefer keeping 127.0.0.1 (Caddy runs on same VPS, can reach 127.0.0.1:8080). No change needed.
- **Docker bypasses UFW** — mitigated by loopback bind (phase 2), not by UFW.
- **VPS Caddy edit risks 9router** — `caddy validate` before reload; keep 9router block intact; reload (not restart) avoids dropping existing conns.
- **Laptop lid-suspend disable** — affects daily use; reversible (unmask targets). User decision.
- **Rollback**: stop systemd tunnel unit; remove Caddy blocks; `docker compose down`. VPS 9router untouched throughout.
