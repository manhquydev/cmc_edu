# Code Review — VPS Deployment of cmc_edu to 152.42.167.189 (co-located with cmc-lms)

**Date:** 2026-08-17 | **Branch:** feat/back-before-design | **Reviewer:** independent, read-only
**Plan reviewed against:** `plans/260817-0009-deploy-cmc-edu-vps/plan.md` (v3.1 FINAL + EXECUTION LOG)
**Method:** diff inspection (a898905→HEAD for `infra/vps`, `docker-compose.prod.yml`, seeds, guards, capture); empirical validation with local Docker (compose merge semantics; `nginx -t` + live probe of the actual `nginx.vps.conf` in a throwaway container); cross-check against the R1/R2 red-team + validate reports and the 260815 VPS survey.

---

## 0. Verdict

# REQUEST_CHANGES

The **security posture and the live deployment are sound** — AOP + CF-boundary + 444, no extra published ports, no committed secrets, zero-touch on cmc-lms, idempotent seeds, all 4 escalation guards in place, client capture wired correctly. However, the primary deployment artifact **`infra/vps/deploy-vps.sh` cannot complete its own run as committed** (2 HIGH defects below), and several plan-mandated Phase-1/2 gates and env keys are missing from the artifacts. The requested changes are small script/doc edits; they do not touch the already-running system.

---

## 1. Findings

### CRITICAL
None.

### HIGH

**H1 — deploy-vps.sh never sets `NGINX_PUBLISH`; the published port silently falls back to the base default `127.0.0.1:80:80`.**
- `infra/vps/deploy-vps.sh` (entire script — no export anywhere; header usage lines 3–4)
- `infra/vps/docker-compose.override.yml:13` — `ports:` is an empty list, so it contributes nothing to the merge
- `docker-compose.prod.yml:59` — `"${NGINX_PUBLISH:-127.0.0.1:80:80}"`
- Empirically verified with `docker compose config`: unset → merged result is `host_ip: 127.0.0.1 / target: 80 / published: 80`; only `NGINX_PUBLISH=0.0.0.0:8080:8080` yields the intended `0.0.0.0:8080→8080`. The override header usage comment (line 2) also omits the variable (and contains a stray `#`).
- Impact: with the LMS owning 80/443, a fresh deploy run strictly from the artifact hits a port-bind conflict at step 4/6 (loud, safe). If the LMS were ever down, the stack would publish 127.0.0.1:80 and the CF origin rules → :8080 would get connection-refused at cutover (silent misconfig). The execution log proves the real deploy had `0.0.0.0:8080:8080` — i.e. the operator exported the var manually; the artifact does not reproduce it.
- Fix: add `export NGINX_PUBLISH=0.0.0.0:8080:8080` near the top of deploy-vps.sh (before any `C()` call), and document it in the override header usage line.

**H2 — deploy-vps.sh step 5/6 in-network verification can never pass against nginx.vps.conf; the plan's "verify in-network (AOP only 400s outside)" premise is wrong.**
- `infra/vps/deploy-vps.sh:43` — `H()` curls `http://cmcv2-prod-nginx-1/$2` (plain HTTP, **port 80**)
- `infra/vps/nginx.vps.conf:94,126,155` — the container listens **only on `8080 ssl`**; there is no `listen 80` anywhere (also true in the original commit a898905). Nothing listens on container port 80 → curl connection-refused → `%{http_code}` = `000` → `fail "erp /health = 000"` (line 45). Empirically confirmed by running the actual nginx.vps.conf in a container: `curl http://<nginx>/health` → `000`; `curl http://<nginx>:8080/health` → `400` (plain HTTP to TLS port); `curl -sk https://<nginx>:8080/health` (no client cert) → TLS alert/empty reply (`000`), never 200.
- The second half is the plan's error: plan H-2 (R2) assumed in-network verification works "because AOP 400s outside". AOP (`ssl_verify_client on`, nginx.vps.conf:99–100/129–130) rejects **every** TLS client without the Cloudflare AOP client cert — in-network included. There is therefore no way to verify *through* the VPS nginx from the compose network.
- Fix: rewrite the verify step to probe the upstreams directly on the compose network — `http://cmcv2-prod-api-1:3000/health` (expect 200), `http://cmcv2-prod-admin-1/` and `http://cmcv2-prod-lms-1/` (titles) — and gate the nginx edge with (a) `nginx -t` inside the container with the real mounts (plan Phase-1 gate, R2 M-3) and (b) the external negative AOP probe from the host: `curl -sk -o /dev/null -w '%{http_code}' https://152.42.167.189:8080/health` must NOT be 200 (plan Phase 2.4, H-2 R2).

### MEDIUM

**M1 — Plan Phase-2 gates absent from the artifacts.** Missing from deploy-vps.sh / isolation-check-vps.sh:
- secret scan after clone (plan 2.2, H-4 R2): grep the laptop's old secret values in /root/cmc-edu
- negative AOP probe (plan 2.4, H-2 R2) — see H2
- `nginx -t` with real cert/AOP-pem mounts (plan Phase-1 gate, R2 M-3)
- `.env.prod` perms 600 check (plan 2.1) — the script only checks existence (deploy-vps.sh:11)
- Fix: add each as a gated step (or a separate `verify-vps.sh` invoked at the end).

**M2 — `.env.prod.example` is missing `GDKD_PASSWORD`/`GDDT_PASSWORD` (and the `GDKD_*`/`GDDT_*` family), which plan Phase 1 (line 81) explicitly requires.**
- `scripts/seed-directors.ts:22,31` — passwords come only from env; when absent the seed **succeeds** ("OK — 2 director accounts ready", line 79) while creating director accounts with `passwordHash` null → **cannot log in**. Silent success on a missing required secret.
- Fix: add the keys to `.env.prod.example` and fail the seed loudly when `GDKD_PASSWORD`/`GDDT_PASSWORD` are unset (mirror seed-super-admin's `requireEnv`).

**M3 — `scripts/seed-directors.ts:43` hardcodes facility code `'CMCDEVEL'`, while `scripts/seed-super-admin.ts:44–47` derives the code from `SUPER_ADMIN_FACILITY` (uppercase → strip non-alnum → slice(0,8)).** Works only when `SUPER_ADMIN_FACILITY="CMC Development"` exactly ("CMC Development" → CMCDEVEL). Any other facility name fails seed-directors loudly ("Facility CMCDEVEL not found") or, if the derived code differs, silently. Fix: derive the same code in seed-directors from a shared helper/env, and document the required value in .env.prod.example.

**M4 — ALTER ROLE password extraction in `deploy-vps.sh:26` is fragile and leaks into argv.** `grep APP_DATABASE_URL | sed 's#…cmc_app:([^@]+)@…#\1#'` — (a) libpq percent-decodes `%XX` in the URL while `psql -v pw="…"` does not, so a URL-encoded password (any `@`/`:`/`%`) sets the role password to the *encoded* literal → the API boots with the decoded value → auth failure that looks like the old "ALTER ROLE failed" class; (b) `-v pw=$APP_PW` puts the secret in the psql argv (visible via `ps` during the exec). Fix: keep the password in a dedicated env key (e.g. `APP_DB_PASSWORD`) or decode the URL properly; avoid argv exposure (heredoc-fed `\set` with quoting, or `PGPASSWORD`).

**M5 — Plan Phase-1 artifacts missing: `infra/vps/backup-vps.sh`, `infra/vps/monitor-vps.sh`, `infra/vps/test-runner.Dockerfile` (plan lines 71, 75–79).** The "cmc_edu full (audit/log/monitor/backup) hoạt động" acceptance (line 128) is not yet met; the execution log acknowledges P3/P6 pending. Also `docker-compose.observability.yml:9–15` and `.env.obs.example:2–4` still say the obs stack "runs on the laptop", while plan Phase 3 targets the VPS — stale docs that will mislead the P3 operator. Fix: ship the three artifacts and update the obs headers.

**M6 — `deploy-vps.sh` is fresh-deploy-only (isolation gate forbids an existing `cmcv2-prod`, lines 13–17), contradicting the plan's "idempotent (chạy lại an toàn)" claim (line 73).** Re-running after a successful deploy fails at the gate; the plan's ALTER-ROLE-failure recovery (plan 2.3) is therefore manual. Fix: document the fresh-only contract in the script header, or add a `--resume`/skip-isolation mode for the recovery path.

### LOW

**L1 — AOP CA identity is not self-verifying.** `infra/vps/nginx.vps.conf:100,130` + `docker-compose.override.yml:18` mount `/etc/nginx/cf-origin-pull-ca.pem`; the filename is ambiguous (the Cloudflare *Origin CA* root that issues origin server certs vs the *AOP client* CA `authenticated_origin_pull_ca.pem`). Evidence (R1, "verified working 260815") says the host file is the LMS's proven AOP pem — likely correct — but nothing in the artifacts pins it. Fix: record the expected issuer/fingerprint in the runbook and add a pre-flight `openssl x509 -in … -issuer -noout` check. (AOP failure is fail-closed → 400, so this is a verification gap, not an exposure.)

**L2 — CF v4/v6 ranges duplicated in `geo` (nginx.vps.conf:29–53) and `set_real_ip_from` (64–85).** A future range addition must land in both lists or the boundary/real_ip silently diverge. Fix: single include or an auto-generated ranges file (the LMS already has an auto-generated cloudflare-realip.conf per R1) + a sync note.

**L3 — Security headers minimal.** Only HSTS + X-Content-Type-Options (nginx.vps.conf:109–111, 138–140); no X-Frame-Options/CSP/Referrer-Policy; `server_tokens` not off. Low risk for UAT; add when hardening.

**L4 — `POST /api/track-error` is unauthenticated arbitrary-content ingest** (`apps/api/src/lib/track-error-route.ts`). Bounded by nginx `clienterr` zone 10r/m burst 10 + 64 KB cap (api-locations.conf:59–64) and fail-open; residual risk is only noise/GlitchTip-fill. Optional: cap `extra` size server-side.

**L5 — `apps/e2e/playwright.live.config.ts:55–56` defaults still point at the old tunnel domains (`erp.clawcmc.io.vn`/`hoc.clawcmc.io.vn`)** while plan Phase 6 uses `deverp/devlms.cmcvn.edu.vn`. Env overrides exist, but a run without env targets stale origins.

**L6 — Minor script nits:** `docker-compose.override.yml:2` usage comment has a stray `#` and omits NGINX_PUBLISH (see H1); `isolation-check-vps.sh:13` relies on `docker compose ls` ignoring `-p` (lists all projects — works for the check, but accidental); deploy-vps.sh logs but never asserts non-empty SPA titles (lines 45–47); the APP_DATABASE_URL grep at deploy-vps.sh:26 yields an empty password silently if the key is absent.

---

## 2. Focus-area answers

**(a) SECURITY — sound, verified.**
- AOP: `ssl_verify_client on` + the LMS's proven `cf-origin-pull-ca.pem` — the right identity per R1/Cloudflare docs (L1 is a verification-pinning gap, not an error). Fail-closed (400) if the file were wrong.
- Geo CF boundary: keying allow/deny on `$realip_remote_addr` (nginx.vps.conf:29) is **correct** — real_ip rewrites `$remote_addr` to the end-user IP, so a `$remote_addr`-based allow/deny would be bypassed; `realip_remote_addr` is the original CF peer. Ranges are current (all 15 v4 + 7 v6).
- Bypasses: `default_server` 444 has a cert and **no** `ssl_verify_client` (R1 LOW-13 shape); api/worker/postgres/admin/lms are **not** published (only nginx 8080 + glitchtip 127.0.0.1:8000); no plaintext listener exists anywhere.
- Secrets: `.env.prod`/`.env.obs` gitignored, only `CHANGE_ME` examples committed, secret scan of infra/vps + compose + seeds is clean. (M1 secret-scan gate still missing from the script; M4 argv exposure.)
- HSTS `includeSubDomains` covers only subdomains of deverp/devlms — hoc is not affected.

**(b) CORRECTNESS — merge design OK; two script defects (H1, H2).**
- Compose merge empirically validated: the override's empty `ports:` does not override the base — the env-driven `${NGINX_PUBLISH}` entry is the sole port mapping (residual `127.0.0.1:80` only when the var is unset → H1). Volumes merge **by target**, so `nginx.vps.conf` cleanly *replaces* the base `nginx.conf` mount (no double-mount); api-locations/certs mounts survive; mem_limit applied; `docker compose config -q` passes.
- Deploy sequence (migrate → ALTER ROLE → up) matches the plan and R2 H-2 recovery; migrate runs from the api image on the project network (image contains prisma CLI + migrations); ALTER ROLE is idempotent and password-redacted from the SQL body (M4 caveats).
- Isolation check implements the R2 M-9 fix (cmclms-*, 8080, subnet, volumes, hoc-via-CF regression) and genuinely guards cmc-lms; note it is also what makes the script fresh-deploy-only (M6).

**(c) COMPLIANCE with plan invariants.**
- Zero impact on cmc-lms: upheld by construction — separate project/network/volumes, only read-only host mounts (/etc/letsencrypt, the AOP pem), no artifact touches /root/cmc-lms, isolation gate requires cmclms-* running + hoc 200 via CF, exact-hostname origin rules per plan (external; regression evidenced in the execution log).
- Full audit/log/monitor: **partial** — pino + reqId + nginx access log + client/API error capture (track-error route; admin/lms boundaries) + GlitchTip compose + fail-open instrument.ts are in place; backup-vps.sh / monitor-vps.sh / test-runner.Dockerfile / obs-on-VPS are not (M5, acknowledged as P3/P6 pending).
- 2-director setup + 4 escalation guards: **complete and correct** — `ACTIVE_ROLES` includes both directors; `PERMISSIONS` grants `user.manage`/`staff.pickList` to both; guards verified in apps/api/src/user/router.ts: create (161–164), update (308–310), resetPassword (436–438), updateRoles (479–515, incl. self-demotion + last-admin). Seeds idempotent (password only when hash NULL). M2/M3 caveats apply.

**(d) Operator surprises / rollback friction.**
- Running the documented deploy as committed will fail at step 5 (H2) and may fail at step 4 (H1) — both loud, but a future operator will not know the artifact diverged from what actually ran.
- `down` keeps volumes; `down -v --rmi local` is the full reset; `--rmi all` is forbidden (postgres:16-alpine/node:22-alpine shared with the LMS) — correctly carried into deploy-vps.sh:50.
- The obs-stack docs say "laptop" while the plan says VPS (M5) — a fresh P3 operator could deploy obs to the wrong host.
- The tools image omits `packages/db/prisma.config.ts` deliberately (prisma generate then needs no DATABASE_URL) — verified consistent with the API image's placeholder comment; harmless but worth a comment.

---

## 3. Verdict rationale

REQUEST_CHANGES (scoped and small):
1. **H1**: export `NGINX_PUBLISH=0.0.0.0:8080:8080` in deploy-vps.sh (+ fix the override usage comment).
2. **H2**: rewrite the in-network verify to probe api/admin/lms containers directly; gate nginx via `nginx -t` + external not-200 AOP probe.
3. **M1–M4**: add the missing Phase-2 gates, the GDKD/GDDT env example keys (+ loud failure), facility-code coupling, and ALTER ROLE password handling.
4. **M5–M6, L1–L6**: docs/notes as listed.

The already-live deployment is healthy and the security boundary is correct; none of the requested changes affect the running system.

Status: DONE_WITH_CONCERNS
Summary: The VPS deployment's security boundary (AOP + CF geo + 444 + unpublished app services), zero-impact isolation from cmc-lms, idempotent seeds, and all 4 director escalation guards are correct and verified, but the committed deploy-vps.sh cannot complete its own run (NGINX_PUBLISH never set; the in-network verify targets a port the VPS nginx does not listen on and is blocked by AOP) and several plan-mandated gates/env keys are missing from the artifacts.
Concerns/Blockers: Two HIGH (H1, H2) and the M1–M4 plan-gate gaps must be fixed before the artifacts are reused for a fresh deploy or P3/P6 automation; the live deployment is unaffected.
