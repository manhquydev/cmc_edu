# Plan Review — R2 Validate Rollback / Roll-forward / Edge Cases / Timing

**Plan reviewed:** plans/260817-0009-deploy-cmc-edu-vps/plan.md (v2, 2026-08-17)
**Reviewer:** independent plan validator (round 2 — rollback / roll-forward / boundary / timing; completeness was R1's scope and is NOT re-reviewed here)
**Date:** 2026-08-17
**Mode:** READ-ONLY review of the plan + repo code + prior evidence reports. No files modified (this report is the only write).

**Evidence used:**
- Plan lines cited inline (L##).
- plans/reports/plan-review-260817-r1-validate-completeness.md, plans/reports/plan-review-260817-r1-redteam-infra.md (R1 findings; the v2 fixes are stated as integrated).
- plans/reports/redteam-260815-vps-state.md (verified VPS facts: the only LMS vhost is hoc.cmcvn.edu.vn with NO default_server → any other Host serves the LMS; **hoc + erp certs are SELF-SIGNED**, hoc expires 2026-10-27, **certbot NOT installed**, /etc/letsencrypt has no accounts/renewal; AOP enforced at origin; UFW only 22/80/443; **no node/pnpm on the VPS host**; erp falls through to the LMS with identical body hash).
- plans/reports/survey-260815-vps-152-42-167-189.md (ports 8080/8443/3001/5433 free; no node/pnpm on host — build via Docker).
- Repo: apps/api/src/server.ts (boot checks then process.exit(1)), apps/api/src/boot-checks.ts, apps/api/src/lib/instrument.ts (fail-open), apps/api/src/worker/index.ts, packages/db/src/index.ts (APP_DATABASE_URL selection), scripts/seed-super-admin.ts + scripts/seed-directors.ts (idempotency), docker-compose.prod.yml (name cmcv2-prod, external cmc-obs-bridge, 172.28.0.0/16, postgres unpublished, nginx depends_on api healthy), docker-compose.observability.yml (separate cmcv2-obs project), infra/nginx/nginx.conf + api-locations.conf, infra/docker/Dockerfile.api (build stage copies only packages/ + apps/api/), scripts/isolation-check.sh (greps ^cmcnew + 80/443 only), apps/e2e/playwright.live.config.ts (hardcoded origins), docs/runbook-deploy.md (migrate must run from a container on cmcv2-prod-net).

## Verdict

The v2 architecture's failure-handling story is **largely sound**: fail-open observability is real (verified in code), the deploy order (migrate → ALTER ROLE → up) fixes the R1 M-2 regression, seeds are idempotent (verified), Phase 4 rollback (delete rule) genuinely restores erp → LMS fallback (verified), and the 8080 exposure window is bounded by AOP + allow/deny at nginx (acceptable). **But the plan does not actually contain the rollback/roll-forward steps it claims** ("mỗi phase có rollback riêng — chi tiết trong phase", L107): only Phase 4.3 has one. Three HIGH gaps would strand an operator mid-Phase-2, and ~9 MEDIUM gaps must be closed before the plan's own GO rule ("không còn CRITICAL/HIGH mở").

## Findings by severity

### HIGH

**H-1. Phase 2 has NO rollback step — a broken stack has no written removal procedure, and the natural improvisation (--rmi all) endangers the LMS.**
- Scenario: Phase 2.4 gate fails (api unhealthy from an ALTER ROLE/drift mismatch, wrong cert chain, nginx 4xx loop). The risk table (L107-115) has no Phase-2 row; Phase 2 (L70-77) has no rollback block; L107's "chi tiết trong phase" is false.
- Fix — add an explicit Phase-2 rollback block:
  1. **Broken-but-retryable** (keep data): docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml -f infra/vps/docker-compose.override.yml down → removes containers + the cmcv2-prod project network; **named volumes cmcv2-prod-pg-data / cmcv2-prod-blob-data are KEPT** (migrated DB survives → re-up is fast); **external cmc-obs-bridge is never removed** by down; images untouched.
  2. **Full reset** (first bring-up failed / restore-drill passed): down -v --rmi local. **NEVER down --rmi all** — postgres:16-alpine and node:22-alpine are shared with the LMS project; --rmi local only removes the locally-built cmcv2-prod-* images.
  3. Also remove the Phase-2 UFW 8080 rule (L77) and optionally delete /root/cmc-edu/.env.prod.
  4. **Prove pre-state (LMS untouched)**: docker ps shows exactly the 3 cmclms-* containers; docker compose -p docker ps identical to the Phase-0.1 baseline; ss -ltnp shows no 8080; curl -s https://hoc.cmcvn.edu.vn/ | sha256sum and erp equal the baseline captured in Phase 0.1; docker volume ls | grep cmcv2 empty (after -v). Structural guarantee already exists (separate compose project, separate network/volumes, 8080 vs 80/443, no shared config) — the checks make it observable.

**H-2. "migrate succeeded but ALTER ROLE failed" → api AND worker boot-FATAL with no recovery step in the plan.**
- Scenario: deploy-vps.sh (L63/73) runs migrate → ALTER ROLE → up. If ALTER ROLE fails (typo, wrong password value, or postgres not yet up when the script runs it), verified behavior: server.ts:236-247 runs boot checks over createPrismaClient() = **APP_DATABASE_URL (cmc_app)** (packages/db/src/index.ts:34-35); on failure log.fatal + process.exit(1); server.listen happens only AFTER the checks pass. The worker does the same (worker/index.ts:143-146). Result: both crash-loop, the healthcheck never passes, and **nginx's depends_on api: condition: service_healthy stalls compose up -d** — the stack never comes up and the operator has no written resume step.
- Fix: (a) script = set -euo pipefail; (b) bring up ONLY postgres first (up -d postgres + wait healthy) because migrate and ALTER ROLE need it (postgres is unpublished; migrate must run from a container on cmcv2-prod-net — runbook §1.4); (c) make the script **re-runnable** — every step is idempotent (prisma migrate deploy; ALTER ROLE cmc_app WITH PASSWORD; both seeds — verified below); (d) document the resume one-liner: docker compose -p cmcv2-prod exec -T postgres psql -U POSTGRES_USER -d cmc_prod -c "ALTER ROLE cmc_app WITH PASSWORD '<value from APP_DATABASE_URL>';" — api/worker then recover on the next restart (restart: unless-stopped) or up -d.

**H-3. Origin rule typo catching hoc: detection exists but runs AFTER the damage, and the fix path is incomplete.**
- Scenario: rule expression typo (a suffix/wildcard match or a wrong eq) matches hoc.cmcvn.edu.vn → hoc traffic goes to origin:8080 (cmc_edu content or 400/5xx). The Phase-4.2 regression check (L91, "hoc: 200 + body hash không đổi") executes after the rule is live → **hoc is broken for the rule-apply latency (seconds to minutes)** and the baseline hash may be stale (the 260815 snapshot 8577f1a3… in vps-state §1.3 is not a fresh per-deploy baseline).
- Fix: (a) test the rule expression in the CF rule editor before enabling; (b) exact-hostname http.host eq "…" only (already planned, L90); (c) capture FRESH body-hash/status baselines for hoc + erp + hoc-test immediately before applying the rule; (d) immediate fix = delete the rule by its recorded rule ID + purge the cache for the affected hostname(s); (e) after enabling, verify with CF Trace that only the intended rule fires (R1 MEDIUM-9). Rollback of a wrong rule is seconds — the gap is detection timing and baseline freshness.

### MEDIUM

**M-1. Phase 4 rollback (delete rule) — verified to restore erp → LMS fallback; cache side-effect is conditional.**
- Verified restore: deleting the rule returns erp.cmcvn.edu.vn → origin:443 → the LMS nginx, which has **only the hoc vhost with no default_server** (vps-state §1.3) → erp falls through to the **live LMS SPA, byte-identical to its pre-plan state** (already proven: identical body hash + same /health heartbeat). hoc is never matched (exact-hostname) → unchanged. So the claimed rollback works.
- Cloudflare caching: only relevant if the zone has cache-everything rules/Page Rules (Cloudflare does **not** cache HTML by default). If any exist, cached cmc_edu HTML under erp.* keys can survive the rollback (and cached LMS HTML can survive the cutover) up to TTL.
- Fix: include Cache Rules / Page Rules inspection in the Phase-0 zone export (R1 MEDIUM-9 already asks for Rules export); **purge erp + hoc-test + hoc after BOTH the cutover and any rollback** (cheap, idempotent); record the pre-existing origin-rule set so rollback = delete the new rule and the prior set reasserts (rule merge semantics).

**M-2. DNS-01 partial-failure residuals (token scope / record cleanup / rate limits) are undocumented.**
- Wrong CF token scope → certbot fails fast (403) before creating records; **no DNS residue**; fix scope (Zone:DNS Edit on cmcvn.edu.vn) and re-run — idempotent.
- Process killed between TXT-create and cleanup → stale _acme-challenge.erp / _acme-challenge.hoc-test TXT records persist (Cloudflare does not auto-expire them). LE ignores extra tokens, so they are cosmetic — but clean them: dig +short TXT _acme-challenge.<name>.cmcvn.edu.vn, then delete via the CF API/dashboard.
- Rate limits: **5 failed authorizations / account / hostname / hour + 50 certs / week / account** → run the first issuance attempt against --staging; on a real failure, wait out the window; certbot delete --cert-name <name> resets bad state; /etc/letsencrypt is restorable from the Phase-0.1 tar.
- Side note: issuance replaces the self-signed erp cert files (dead weight per vps-state §1.3 — not served) and **cannot touch live/hoc.cmcvn.edu.vn** (no renewal config exists for hoc → host certbot renew never acts on it). Verify hoc file mtimes after issuance.

**M-3. The Phase-1 "nginx -t (throwaway container)" gate (L68) is under-specified: without the runtime mounts it fails spuriously; with the wrong mounts it cannot validate the cert paths.**
- Fix — exact gate (paths must mirror the runtime mounts, including the LE live dir and the AOP pem): docker run --rm -v $(pwd)/infra/vps/nginx.vps.conf:/etc/nginx/nginx.conf:ro -v $(pwd)/infra/nginx/api-locations.conf:/etc/nginx/api-locations.conf:ro -v /etc/letsencrypt:/etc/letsencrypt:ro -v $(pwd)/infra/nginx/certs:/etc/nginx/certs:ro nginx:1.27-alpine nginx -t. nginx -t cannot catch upstream-resolution/runtime failures — the **true pre-cutover gates are Phase-2.4** (Host-header curl, /health, and the R1 CRITICAL-1 external probe curl -k https://152.42.167.189:8080/health → must return 400 "No required SSL certificate was sent", never 200). Keep all three mandatory.

**M-4. 8080 exposure Phase 2→4: yes, internet-reachable from the moment compose publishes it; serves nothing to non-CF; acceptable, with two caveats.**
- Reachability: Docker publishes via DNAT (bypasses UFW INPUT — red-team HIGH-5; the current "closed/filtered" probe result is only because nothing listens yet). The plan already acknowledges this (L77).
- What it serves: TLS-only listener + AOP (ssl_verify_client on) → **direct-to-IP probes from arbitrary IPs** get TLS 400 "No required SSL certificate was sent" on the erp/hoc-test blocks; on the default 444 block — which per R1 LOW-13 must have a cert and **no** ssl_verify_client — they get 403 (http-level allow/deny) or 444. No content is served to anyone without CF's AOP client cert. Acceptable for the window.
- Caveats: (a) expect active scanning (the box already draws ~12k SSH probes/day) — the default block must keep the LOW-13 shape or probes get 400-noise instead of 444; optional DOCKER-USER chain rules are a cheap belt-and-suspenders (red-team suggestion); (b) AOP's positive path (CF client cert accepted) is only exercisable at Phase-4 cutover because CF never sends traffic to 8080 before the rule exists — the Phase-4 gate + instant rollback are the safety net; don't skip them.

**M-5. hoc-test served during the gap: the plan creates the record ORANGE in Phase 0.5, so the hostname serves the LIVE LMS from Phase 0 to Phase 4.**
- DNS propagation for a new CF-authoritative record is seconds-to-minutes; the hostname is unreferenced until Phase 6, so the DNS gap itself is benign. But with an orange record, anyone who discovers https://hoc-test.cmcvn.edu.vn early gets the **live LMS SPA** (fall-through — the LMS nginx has only the hoc vhost; verified for erp, identical for hoc-test). Host-scoped cookies → no session leak, but a second public URL for prod LMS and LMS content cached under hoc-test keys.
- Fix: create the A record **GREY in Phase 0** (DNS-01 needs only TXT, not the A record), **flip to ORANGE in Phase 4 immediately before adding the rule** — or explicitly accept the LMS-fallback window and purge hoc-test on cutover.

**M-6. hoc renewal vs Full-strict flip — ordering is right, but the plan must harden the gates.**
- Facts: hoc's origin cert is **self-signed** (vps-state §1.3 — the survey's "Let's Encrypt" claim is false), expires **2026-10-27**, certbot is NOT installed, and /etc/letsencrypt has no accounts/renewal — so "hoc renewal" is a first-ever real LE issuance, an LMS-owned operation with real LMS-touching steps (install certbot, issue, mount, reload cmclms-web). No phase performs the Full-strict flip (H8, L20/L56) — the flip is deferred, which is the safest possible choice.
- The window where both certs must be valid: at the flip instant and **permanently after** — Full-strict validates ALL proxied origins zone-wide, so erp, hoc-test AND hoc must each serve a valid LE cert; an expired/unrenewed cert on any of them = 526 outage on that hostname. If hoc renewal is delayed → stay Full → **zero impact on cmc_edu** (Full ignores origin certs).
- Fix: (a) state that the flip is an out-of-phase, LMS-coordinated operation gated on: echo | openssl s_client -connect 152.42.167.189:443 -servername hoc.cmcvn.edu.vn 2>/dev/null | openssl x509 -issuer -noout showing a public-CA issuer; (b) all three LE certs + renewal automation (dry-run + one real rotation + deploy-hook reload) proven before any flip; (c) record the 2026-10-27 hoc expiry as an independent LMS-owned deadline in the coordination block; (d) note that the host certbot renew touches only erp/hoc-test (no hoc renewal config exists → safe by construction).

**M-7. Laptop independence — the plan's design is VPS-self-contained except two optional laptop paths that must be removed/mandated.**
- Verified VPS-hosted: backups (cron, pg_dump containerized, offsite), monitor + dead-man (systemd timer), cert renewal (host certbot), obs (VPS), seeds (tools image). The tunnel/systemd units on the laptop are correctly not part of the plan.
- Remaining laptop couplings: (a) seed "HOẶC chạy từ laptop qua SSH (như hiện tại)" (L22) — make the **tools image the ONLY path**: requires a Phase-1 Dockerfile change because the current Dockerfile.api build stage copies only packages/ + apps/api/ (no scripts/, no apps/api/src) — add COPY scripts/ and COPY apps/api/src to the build stage, then docker build --target build -t cmcv2-tools .; (b) Phase 2.1 "Clone/**rsync** repo" — rsync implies a laptop push; mandate git clone with a provisioned deploy credential (the old GITHUB_TOKEN is deleted in Phase 0.2 — a replacement PAT/deploy key must be planned, else Phase 2.1 has no auth); (c) Phase 3 GlitchTip bootstrap (web UI on 127.0.0.1:8000) needs a host-side curl/API path or a transient SSH tunnel — state which; (d) Phase 6 "runner = VPS host" — the VPS has **no node/pnpm/Playwright** (survey/vps-state) → containerize Playwright (or extend the tools image) so the campaign never depends on the laptop; the docker-exec OTP readback container name cmcv2-prod-postgres-1 is now consistent with the project name.

**M-8. Concurrent-op serialization: no hard exclusions exist between certbot renew vs backup (different planes) or CF rule edit vs compose up (different planes) — the real constraints are:**
- Never flip the CF SSL mode while hoc serves the self-signed cert (H8; a flip 526s the live LMS — red-team HIGH-8).
- certbot renew's deploy-hook (docker compose -p cmcv2-prod exec -T nginx nginx -s reload) fails harmlessly when the stack is down (Phase-2 mid-flight or rolled back): the cert renews anyway, nginx keeps the old (still-valid) cert until the next renewal or a manual reload — document "failed hook ≠ failed renewal".
- The dead-man/monitor timers alert during Phase-2/rollback windows (stack down) — expect noise or suppress during maintenance.
- The restore-drill-before-seed gate (Phase 2) requires a backup to exist BEFORE seeding (sequencing, not exclusion).
- The Phase-4 rule add must not precede the Phase-2.4 gates (already ordered).

**M-9. scripts/isolation-check.sh (the Phase-0.4 gate, L52) is vacuous on the VPS.**
- The script greps ^cmcnew container/network/volume names and 80/443 ports (laptop-era cmcnew legacy), but the LMS is cmclms-* on 80/443 and the new port is 8080 → the gate **passes without testing anything relevant** to the VPS. Fix: extend it to cmclms-* names/volumes/networks, port 8080, and subnet 172.28.0.0/16 before trusting it as the pre-flight "LMS untouched" proof.

### LOW

**L-1. Full-plan rollback leaves residuals** — hoc-test A record (created Phase 0.5), erp/hoc-test LE certs + renewal timer, cmc-obs-bridge network, UFW 8080 rule, /root/cmc-edu/.env.prod. Add a full-revert checklist (delete record; certbot delete; remove timers/cron; down -v --rmi local; delete cmc-obs-bridge; remove UFW rule) for exact pre-state.

**L-2. Phase-5 seed rollback is not covered.** Seeds are idempotent (safe to re-run — verified: seed-super-admin upserts by employeeCode, seed-directors by email; bootstrap passwords applied ONLY when passwordHash IS NULL) but **not reversible**; to un-seed, delete the AppUser rows via an owner connection, or down -v + re-run phases.

**L-3. Fresh baselines.** Store body-hash/status baselines for hoc + erp + hoc-test next to the rollback checklist, captured at Phase 4 immediately before the rule add (the 260815 snapshot is stale for this purpose).

**L-4. Path canonicalization** — plan uses /root/cmc-edu; docs/runbook-deploy.md cron uses /opt/cmcv2 (R1 M-4 cross-ref): rollback and cron commands must use one canonical path.

**L-5. Obs rollback keeps volumes** — docker compose -p cmcv2-obs down retains cmcv2-obs-pg-data / cmcv2-obs-valkey-data → re-up restores the project + DSN; api/worker are unaffected (fail-open verified below). If SENTRY_DSN must be removed from .env.prod, restart api/worker.

## Answers to the review scope

1. **Phase 2 rollback (broken stack, compose down / --rmi / volumes, pre-state proof)** → H-1. Answer: down keeps the named volumes (migrated DB survives), down -v --rmi local is the full reset, --rmi all is forbidden (shared images with the LMS), external cmc-obs-bridge is untouched; pre-state proof = cmclms-* only in docker ps + hoc/erp body-hash equal to the Phase-0.1 baseline + no 8080 listener + UFW rule removed. LMS untouched is structurally guaranteed (separate project/network/volumes) and made observable by those checks.
2. **Phase 4 rollback (delete rule → erp pre-state, cache side-effects)** → M-1. Verified: erp returns to the live-LMS fall-through byte-identical; hoc unaffected; purge needed only if cache-everything rules exist — inspect in Phase 0 and purge after cutover AND rollback regardless (cheap).
3. **Cert issuance partial failure (TXT leftovers, rate limits, cleanup)** → M-2. Wrong token scope = no residue; interrupted run = stale _acme-challenge.* TXT (cosmetic; clean via dig + CF API); rate limits = 5/hr/hostname + 50/week/account; use --staging first; /etc/letsencrypt restorable from the Phase-0.1 tar; hoc files cannot be touched (no renewal config).
4. **migrate OK / ALTER ROLE failed → api FATAL recovery** → H-2. One idempotent ALTER ROLE re-run on the postgres container; api/worker recover on next restart; script must be re-runnable with postgres-first ordering.
5. **seed-super-admin OK / seed-directors failed → re-run safe** → L-2. Verified idempotent (both scripts; password only when passwordHash is NULL; facility CMCDEVEL order dependency correct).
6. **obs up / SENTRY_DSN wrong → fail-open** → verified at code level: apps/api/src/lib/instrument.ts initializes Sentry only when the DSN is set; captureException is a no-op when unset and asynchronous/non-blocking when the DSN is wrong/unreachable. Compose-level: api/worker attach to the external cmc-obs-bridge even when the obs stack is down; an empty/wrong DSN never fails up. The Phase-3 gate (inject error → event) catches a wrong DSN. No outage path.
7. **nginx vps.conf syntax error → gate before cutover** → M-3. Phase-1 nginx -t in a throwaway container WITH the actual certs/AOP-pem/api-locations mounted catches syntax + cert-path errors; the mandatory Phase-2.4 gates (Host-header curl, /health, external 400-probe) catch everything else before Phase 4.
8. **Origin rule on wrong hostname → detection + fix** → H-3. Detection = fresh-hoc-body-hash regression run immediately after the rule add; fix = delete the rule by ID + purge; harden by testing the expression in the CF editor and confirming with CF Trace.
9. **8080 reachable Phase 2→4? what does it serve? acceptable?** → M-4. Yes reachable (DNAT bypasses UFW); serves TLS-400 (no client cert) on the AOP blocks and 403/444 on the default block to direct-to-IP probes; nothing to non-CF. Acceptable; keep the LOW-13 default-block shape; expect scanning; optional DOCKER-USER rules.
10. **hoc-test DNS propagation + gap content** → M-5. CF-authoritative: seconds-to-minutes; benign because unreferenced until Phase 6; but orange-from-Phase-0 serves the live LMS → create grey, flip orange at Phase 4.
11. **hoc renewal vs Full-strict: ordering + both-certs window + delayed renewal** → M-6. hoc is self-signed today (hard requirement, not precaution); flip is deferred out-of-phase (good); the both-certs-valid constraint holds at the flip instant and forever after (zone-wide); delayed hoc renewal = stay Full = no impact.
12. **Concurrent ops** → M-8. Only hard exclusion: SSL-mode flip vs self-signed hoc; hook-failure nuance documented; maintenance-window alert noise expected.
13. **Anything missed** → M-9 (vacuous isolation gate), L-1 (full-revert residuals), L-2 (seed un-reversal), L-3 (fresh baselines), L-4 (path canonicalization), L-5 (obs rollback keeps volumes). Laptop independence verified: the plan never depends on the laptop for runtime/monitor/backup/renewal; the two optional laptop paths (seed via laptop SSH, rsync clone) and the under-specified Phase-6 runner must be made laptop-free (M-7).

## What the plan already gets right (no change needed)
- Deploy order migrate → ALTER ROLE → up (L63/73) — closes R1 M-2.
- Fail-open observability (invariant #4) — verified in code, not just claimed.
- Seed idempotency — both scripts verified.
- Phase-4 exact-hostname rules + immediate rule-delete rollback (L90-92) — verified to restore erp → LMS.
- Port 8080 publish with nginx allow/AOP as the real boundary, active from Phase 2 (L77) — matches the red-team boundary analysis.
- Phase-0.1 backups (zone export, LMS pg_dump, /etc/letsencrypt tar) — the raw material for every rollback proof above.
- hoc cert renewal deliberately excluded from cmc_edu scope and sequenced before any Full-strict flip (L9/L20/L55).

## Cross-references (not re-adjudicated here)
- R1 CRITICAL-1 (port mapping/listener) and LOW-13 (444 block shape) are prerequisites for M-4's "serves nothing to non-CF" claim — fix them as stated in R1.
- R1 MEDIUM-9 (rule merge/existing-rules export) and MEDIUM-10 (IPv6) interact with M-1/M-5 — fold into the Phase-0 export.
- R1 H-4 (network pre-flight) and M-9 (this round) both touch the Phase-0.4 gate; M-9 is the VPS-specific correction.
- R1 H-3 (Phase-6 runner) is the completeness twin of M-7(d) (laptop independence).

Status: DONE_WITH_CONCERNS
Summary: The v2 plan's failure-handling architecture is sound (fail-open verified in code, idempotent seeds, verified Phase-4 rollback restoring erp → LMS, acceptable bounded 8080 window), but the plan claims per-phase rollback it does not actually contain — 3 HIGH gaps (no Phase-2 rollback procedure incl. --rmi/volume semantics, no ALTER-ROLE-failure recovery step despite verified api/worker boot-FATAL, origin-rule typo detection timing/baseline) and ~9 MEDIUM gaps (DNS-01 residuals, gate specifics, hoc-test gap content, Full-strict gates, laptop-independent seed/clone/UAT paths, vacuous isolation-check on the VPS, cache purge) must be closed before its own GO rule is met.
Concerns/Blockers: None blocking — all findings are additive Phase-0/Phase-1 text and script changes; nothing requires rework of the architecture or code. Highest-priority edits: add the Phase-2 rollback block + resume steps to deploy-vps.sh (H-1, H-2), and the fresh-baseline + purge + CF-Trace steps around Phase 4 (H-3, M-1).
