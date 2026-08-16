# Red-Team Plan Review — R1 (Infra / Network / TLS / Cloudflare / Cert)

**Plan:** `plans/260817-0009-deploy-cmc-edu-vps/plan.md` (DRAFT, 2026-08-17)
**Reviewer:** independent red-team (read-only — no repo/VPS/Cloudflare mutations)
**Scope (round 1):** port binding & reachability, AOP + Cloudflare Origin Rule mechanism, TLS/cert requirements (LE vs Cloudflare Origin CA), real_ip/rate limiting, DNS cutover, UFW/IPv6, and anything else in this scope the plan missed.
**Date:** 2026-08-17
**Evidence used:**
- Plan lines cited inline (L##).
- `plans/reports/survey-260815-vps-152-42-167-189.md`, `redteam-260815-vps-state.md`, `redteam-260815-deploy-risk.md`, `redteam-260815-verdict-aggregate.md` (verified VPS facts, 260815).
- Repo: `docker-compose.prod.yml`, `infra/nginx/nginx.conf`, `infra/nginx/api-locations.conf`, `apps/api/src/context.ts`, `.env.prod.example`.
- Current Cloudflare docs (fetched 2026-08-17): [Zone-level AOP](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up/zone-level/), [Global AOP](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/set-up/global/), [Origin Rules](https://developers.cloudflare.com/rules/origin-rules/), [Origin Rules FAQ](https://developers.cloudflare.com/rules/origin-rules/faq/).
- Live CF IP ranges (fetched 2026-08-17 from https://www.cloudflare.com/ips-v4 and /ips-v6).

---

## 0. Answers to the six scope questions (tl;dr)

1. **8080 free/reachable + AOP + Origin Rule.** 8080 is verified free (only 22/80/443 listen; external probe filtered — vps-state §1.2). Reachable via Cloudflare **only** through an Origin Rule **destination-port override** (available on all plans; Host-header/SNI/DNS overrides are Enterprise-only, which is fine because we want Host/SNI to stay the hostname). Origin Rules apply only to **proxied (orange-cloud)** DNS traffic. The rule needs **no specific SSL mode**, but because the origin listener is TLS-only, the zone mode must stay **Full or Full-strict** (Flexible → plaintext to a TLS listener → 525). AOP does **not** require Full-strict — Cloudflare's own docs require only **"Full or higher"** for global/zone-level AOP (see CRITICAL-2, MEDIUM-11).
2. **EXACT cert requirements under AOP.** Two independent legs: (a) **server cert** (what nginx presents): in **Full** mode CF does not validate it at all (any cert — the LMS already proves this with self-signed); in **Full-strict** it must chain to a CA in CF's trust store with the hostname in SAN — a **Let's Encrypt** cert satisfies this (LE/ISRG is a public CA CF trusts). (b) **client cert** (AOP): CF presents a client cert; nginx must verify it against the **Cloudflare global-AOP CA** — the `authenticated_origin_pull_ca.pem` — which is **NOT the "Cloudflare Origin CA certificate"** (that PKI issues origin *server* certs). **LE is fully compatible with AOP in both Full and Full-strict.** The plan's "AOP sẽ đòi origin cert thật" (L41) is the contradiction: AOP does not care about the origin server cert; the SSL mode does. A 526 is a *server-cert* failure (Full-strict only); a 400/495 is a *client-cert* failure (AOP) — the plan's risk row conflates them (CRITICAL-2).
3. **real_ip / rate limiting.** nginx must `set_real_ip_from` **all** current CF ranges (15 v4 + 7 v6 — listed in MEDIUM-10) + `real_ip_header CF-Connecting-IP` + `real_ip_recursive on`. CF ranges change over time (e.g., `131.0.72.0/22`, `2a06:98c0::/29`, `2c0f:f248::/32` were added in recent years) — a static note is not enough; regenerate from https://www.cloudflare.com/ips-v4 / /ips-v6 (or the API) on a timer, reusing the LMS's existing generator (vps-state §1.3 "cloudflare-realip.conf auto-generated"). **TRUSTED_PROXY_CIDRS in the api env must NOT be CF ranges** — the API's immediate peer is the nginx container (172.28.0.10); setting CF ranges re-creates the C2 failure inside the API (CRITICAL-3).
4. **DNS.** erp already exists proxied. **hoc-test is NEW and the plan never says who creates the record or that it must be orange (proxied).** Grey (DNS-only) → Origin Rule inert, no CF TLS, and port 443 fall-through serves the **live LMS** under hoc-test (HIGH-4). Owner of Zone:DNS on cmcvn.edu.vn is unstated.
5. **UFW + AOP on 8080.** "UFW allow 8080 from CF ranges" is **ineffective for a Docker-published port** (DNAT/DOCKER chain bypass UFW INPUT; RT-C itself documented this) and the port opens at Phase 2 `up`, not Phase 4. Real enforcement must be nginx `allow CF ranges; deny all` + TLS-only listener + AOP client-cert (HIGH-5). IPv6: include CF v6 ranges in set_real_ip_from and any firewall layer; droplet v6 status unknown (MEDIUM-10).
6. **Other misses.** LE issuance via **HTTP-01 is impossible here** (ports 80/443 belong to the LMS; proxied domains) → **DNS-01 + Cloudflare API token** are mandatory and unspecified (HIGH-6). Renewal automation + bind-mount symlink pinning (renewal won't reach the container) + an explicit LMS reload for the hoc cert (HIGH-7). Zone-wide SSL-mode flips 526 the live LMS (HIGH-8). Origin-Rule merge semantics and exact-match expressions (MEDIUM-9). 444 default on 8080 needs a cert and must not itself require a client cert (LOW-13). Multi-SAN vs two-cert ambiguity (LOW-14).

---

## Findings by severity

### CRITICAL

**CRITICAL-1 — Compose port mapping and the nginx listener contradict each other; as written the origin is either unreachable or exposed plaintext.**
- Plan lines: L46 `nginx ports "0.0.0.0:8080:80"` vs L48 `listen 8080 ssl`.
- The override publishes host:8080 → **container:80**, but the VPS nginx config listens on **8080 inside the container**. Two possible outcomes, both broken: (a) nginx.vps.conf replaces the repo config → nothing listens on container:80 → every CF request → connection refused (502/525 at cutover, caught only in Phase 4); (b) the repo's plain-HTTP `listen 80` block survives alongside `listen 8080 ssl` → the published port serves **plaintext HTTP without `ssl_verify_client`** → no AOP, no TLS, and every API endpoint (`/trpc`, `/auth/staff-login`, `/upload`) directly reachable at 152.42.167.189:8080 — the exact H5 surface RT-C flagged.
- Fix: one consistent pair — publish `0.0.0.0:8080:8080` **and** `listen 8080 ssl` (TLS + AOP), no plaintext listener reachable from the mapping; or publish `0.0.0.0:8080:80` **and** `listen 80 ssl`. Add a Phase-2 gate: `curl -k https://152.42.167.189:8080/health` from outside must return **400 "No required SSL certificate was sent"**, never 200.

**CRITICAL-2 — The AOP/cert model in the plan is wrong: AOP does not "đòi origin cert thật", and the named pem ("CF Origin CA") is the wrong identity.**
- Plan lines: L27 (`AOP (ssl_verify_client + CF Origin CA)`), L41 (`AOP sẽ đòi origin cert thật — verify openssl issuer/chain`), L49 (`ssl_client_certificate CF Origin CA`), L97 (risk row `AOP + cert self-signed | 526/495 | bật Full (tạm) hoặc cấp LE thật trước`).
- Cloudflare docs (fetched today): global AOP = CF presents a **client certificate**; the origin verifies it against the **`authenticated_origin_pull_ca.pem`** — explicitly "**not** the same as the Cloudflare Origin CA certificate" (the Origin CA PKI issues origin **server** certs). Requirement: SSL mode "**Full or higher**". So: (a) AOP validates the *client* cert — it has nothing to do with the origin *server* cert being "thật"; (b) the working file is the global-AOP pem, not the Cloudflare Origin CA server root — uploading the wrong pem makes nginx reject every CF request with 400; (c) 526 is a **server-cert** validation failure that only exists in **Full-strict**; 400/495 is a **client-cert** (AOP) failure at origin — different legs, different fixes, and the plan's fallback ("bật Full (tạm)") does not fix a 495 (AOP is already active in Full mode).
- Fix: keep the zone in **Full**; issue LE certs as planned (valid in both Full and Full-strict since LE is a public CA CF trusts — no Cloudflare Origin CA needed for the server cert); set `ssl_client_certificate` to the **exact pem the LMS already uses** (`/etc/nginx/cf-origin-pull-ca.pem`, verified working 260815) or re-download `authenticated_origin_pull_ca.pem`; reword L41/L97 so implementers do not chase a nonexistent "origin cert thật" requirement.

**CRITICAL-3 — `TRUSTED_PROXY_CIDRS = CF ranges` in the api env is wrong and silently re-creates C2 inside the API.**
- Plan line: L46 (`TRUSTED_PROXY_CIDRS = CF ranges (kèm ghi chú cập nhật khi CF đổi dải)`).
- Repo: api env is `TRUSTED_PROXY_CIDRS: "172.28.0.10/32,127.0.0.1/32"` (docker-compose.prod.yml:88, .env.prod.example:127). `resolveIp()` (apps/api/src/context.ts:162-182) uses XFF **only when the immediate peer (the nginx container IP) is trusted**. The API is never peered with a CF IP — CF ranges as the trusted list means the peer 172.28.0.10 is untrusted → `resolveIp()` returns 172.28.0.10 for **every** request → FacilityNetwork CIDR check-in verification, TimePunch.ip audit, and any API-layer per-IP rate limit all key on one container IP — the exact RT-C C2 failure class this plan claims to fix (nginx-layer 429s are fixed by nginx real_ip, but the API layer breaks).
- Fix: keep `172.28.0.10/32,127.0.0.1/32` unchanged (update in lockstep only if the pinned subnet/nginx IP changes — the coupling is documented in compose comments). CF ranges belong in **nginx** `set_real_ip_from` and allow/deny only, never in TRUSTED_PROXY_CIDRS.

### HIGH

**HIGH-4 — The hoc-test DNS record is never specified: owner, proxied vs grey, and the grey failure mode serves the LIVE LMS.**
- Plan lines: L21/L25 (architecture: hoc-test → VPS:8080), L73 (Origin Rule only). No step creates the record; no owner; no orange/grey decision.
- Origin Rules apply only to **proxied** traffic. If `hoc-test.cmcvn.edu.vn` is created grey (DNS only): the rule is inert; DNS hits the VPS → port 443 is the LMS nginx, which has no hoc-test vhost → **falls through to the hoc block and serves the live LMS content**; port 8080 direct → AOP rejects everyone with 400.
- Fix: explicit Phase-4 step (owner = the cmcvn.edu.vn zone admin, who already exists for the Phase-0 zone export): create `A hoc-test → 152.42.167.189`, **proxied (orange)**, before adding the rule; verify orange status in the dashboard; note erp's existing record is already proxied (verified 260815).

**HIGH-5 — "UFW allow 8080 from CF ranges" cannot filter Docker-published ports; the surface opens at Phase 2, not Phase 4.**
- Plan lines: L29, L75 (UFW-only 8080 policy).
- Docker publishes via PREROUTING DNAT + the iptables DOCKER chain; UFW's INPUT rules don't see forwarded traffic to containers (RT-C's own C1 mitigation says exactly this: "UFW can't filter Docker-published ports… nginx-level allow/deny is the reliable layer"). Consequences: the UFW rule is a no-op for the published port, **and** the port is publicly reachable as soon as `compose up` publishes it in Phase 2 — before the Phase-4 "UFW allow" step, so the plan's implied safe window doesn't exist.
- Fix: enforce at nginx — `allow <CF v4+v6 ranges>; deny all;` in the 8080 server block (and http-level), TLS-only listener + AOP as the real boundary; add DOCKER-USER chain rules if belt-and-suspenders is wanted; ship the allow/deny in the Phase-1 artifact so it lands with the stack.

**HIGH-6 — LE issuance via HTTP-01 is impossible on this VPS; DNS-01 + a Cloudflare API token are mandatory and unspecified.**
- Plan lines: L39–L40 (certbot + LE certs for erp/hoc-test, renewal for hoc).
- erp/hoc-test/hoc are proxied; ports 80/443 belong to the LMS nginx (no ACME location; invariant #1 forbids touching it); an HTTP-01 challenge through CF lands on origin:80 → LMS 404. certbot is not installed on the VPS (verified 260815). Therefore all three certs need **DNS-01** via `certbot-dns-cloudflare` and a Cloudflare API token with **Zone:DNS edit** on cmcvn.edu.vn — the plugin, the token, and its storage (0600, outside git) are absent from the plan.
- Fix: specify DNS-01 for erp + hoc-test (one multi-SAN cert or two — see LOW-14) and for the hoc renewal; add a Phase-0/1 gate `certbot renew --dry-run` (already planned for L43, now needs the DNS-01 setup to be real).

**HIGH-7 — Cert renewal automation and bind-mount symlink pinning are missing; the hoc renewal touches the LMS.**
- Plan lines: L39–L43 (issue + `certbot renew --dry-run` gate only).
- (a) No renewal timer/deploy-hook is specified for the new LE certs. (b) Bind-mounting `/etc/letsencrypt/live/<name>` follows the symlink at mount time and pins the resolved archive path — after renewal repoints the symlink, the container keeps serving the old cert until recreated (RT-C §2 documented this). (c) The hoc renewal only takes effect when the **LMS web container** reloads — an operational action on the "do not touch" system that the plan never makes explicit (and it brushes invariant #1; it must be a deliberate, approved step).
- Fix: mount `/etc/letsencrypt` (live **and** archive) into cmcv2-nginx; add a timer/cron `certbot renew --deploy-hook "docker compose -p cmcv2-prod exec -T nginx nginx -s reload"`; write an explicit approved step for the LMS web reload after the hoc renewal.

**HIGH-8 — SSL mode is zone-wide: any Full→Full-strict flip 526s the live LMS until its cert is real.**
- Plan lines: L41 (assumes Full), L97 (risk row proposes "bật Full (tạm)" / mode fiddling).
- The SSL/TLS encryption mode is a **zone-level** setting. hoc's origin cert is self-signed (verified 260815) → Full-strict → **526 on hoc.cmcvn.edu.vn = production LMS outage**. The plan's row treats a mode change as a cmc_edu rollback lever; it is actually an LMS-wide lever.
- Fix: keep Full; if Full-strict is ever wanted, sequence it strictly after the hoc LE cert is issued **and served by the LMS** (Phase-0 item), and treat the flip as an LMS-affecting change with its own rollback (flip back = instant recovery).

### MEDIUM

**MEDIUM-9 — Origin Rule matching must be exact-hostname; existing rules can merge and must be inspected.**
- Plan lines: L73–L74 ("Thêm Origin Rule … KHÔNG đụng rule hoc").
- Use `http.host eq "erp.cmcvn.edu.vn"` and `http.host eq "hoc-test.cmcvn.edu.vn"` — never a wildcard/suffix expression that could also match `hoc.cmcvn.edu.vn`. Per the Origin Rules FAQ, when multiple rules match their configurations **merge** (later rules override per field) — an existing zone rule (leftover catch-all, another host's rule, migrated Page Rules with host/DNS overrides) could already rewrite erp/hoc-test. Phase 0 exports DNS but not Rules.
- Fix: add "export + inspect existing Origin Rules and Page Rules with host overrides" to Phase 0; write exact-match expressions; after cutover verify with Cloudflare Trace that only the intended rule fires.

**MEDIUM-10 — IPv6 is unaddressed in every leg of the plan.**
- Plan lines: L29, L48, L75 (no v6 anywhere).
- Live CF IPv6 ranges (fetched today): `2400:cb00::/32, 2606:4700::/32, 2803:f800::/32, 2405:b500::/32, 2405:8100::/32, 2a06:98c0::/29, 2c0f:f248::/32`. These must be in nginx `set_real_ip_from` and the allow-list. Droplet v6 status is unknown (vps-state doesn't say); UFW is active v4+v6. If the droplet has v6 and AAAA records are created for erp/hoc-test, CF may connect to origin over v6 → without CF v6 in set_real_ip_from, real_ip silently fails (C2 returns for those connections); with default-deny v6 and no rules, origin:8080-v6 drops → flaky 522/connect failures.
- Fix: include CF v4+v6 in set_real_ip_from and the nginx allow-list; verify droplet v6; do **not** create AAAA records unless the droplet has working v6; document.

**MEDIUM-11 — AOP variant (global vs zone-level vs per-hostname) is unverified; per-hostname AOP would not cover the new hostnames.**
- Plan line: L42 (xác định … nguồn AOP).
- Global AOP (likely — the LMS's `cf-origin-pull-ca.pem` filename matches the global pem) and zone-level custom AOP are **zone-wide**: erp/hoc-test inherit the client cert automatically once proxied. **Per-hostname AOP is not**: new hostnames get no client cert until added → origin 400s every request at cutover, looking exactly like a cert bug.
- Fix: make the L42 verification determine which variant is enabled (dashboard: Origin Server → Authenticated Origin Pulls, Global vs Zone-level vs per-hostname) and, for per-hostname, add erp + hoc-test to the AOP list; reuse the LMS pem for global.

### LOW

**LOW-12 — TLS-only 8080 listener makes Flexible mode fatal; document the mode constraint.** (L41) AOP docs require "Full or higher" anyway. If the zone is ever set to Flexible, CF sends plaintext to the TLS listener → handshake failure → 525 for both new domains. Note in the runbook: mode must stay Full or Full-strict.

**LOW-13 — The 444 default on 8080 needs a certificate and must not require a client cert.** (L51) Every `listen 8080 ssl` block needs `ssl_certificate` (reuse the erp cert for the `default_server` 444 block); the 444 block must **not** carry `ssl_verify_client` (else unknown hosts get 400, not 444). Verify `Host: hoc.cmcvn.edu.vn` on :8080 returns 444, not fall-through.

**LOW-14 — Multi-SAN vs two-cert ambiguity.** (L48) One server block with both `server_name`s and a single `ssl_certificate /etc/letsencrypt/live/...` requires a **multi-SAN** LE cert (`certbot … -d erp.cmcvn.edu.vn -d hoc-test.cmcvn.edu.vn`); otherwise use two server blocks with per-host certs (SNI selects). Specify which so one hostname doesn't silently serve the wrong cert.

**LOW-15 — 8081 fallback coupling.** (L95) If EADDRINUSE forces 8081, the Origin Rule port, UFW/allow-list, and nginx listener must all change together; the rollback row only mentions deleting the rule. Also note the obs stack binds 127.0.0.1:8090 (distinct — no collision).

---

## What the plan already gets right (no change needed)
- 0.0.0.0:8080 instead of loopback (L27) — resolves RT-C C1's bind problem.
- nginx-level real_ip with CF-Connecting-IP (L28) — correct half of C2.
- ALTER ROLE cmc_app in the deploy sequence (L52) — C3 fixed.
- Containerized migrate/seed (L52–L53) — H2/H3 addressed.
- Blob mode made explicit (L47) — H4 addressed.
- Exact-hostname intent for the Origin Rule + immediate rollback (L73–L78).
- Phase-0 backup of zone export + letsencrypt + LMS (L34–L35).

---

## Verdict

The plan fixes the round-260815 CRITICALs (bind, C3, containerized ops) but carries **three new CRITICAL-level defects in this round's scope** (port-mapping/listener contradiction, AOP-cert model error, TRUSTED_PROXY_CIDRS regression) plus five HIGHs (DNS record unspecified, UFW ineffective for Docker ports, HTTP-01 impossible → DNS-01 needed, renewal/pinning automation, zone-wide SSL-mode risk). All are config/planning errors with cheap fixes — none require code changes. The plan's own acceptance gate ("không còn CRITICAL/HIGH mở") is therefore not met for infra/network/TLS/Cloudflare/cert.

Status: DONE_WITH_CONCERNS
Summary: The plan's isolation and routing design is sound, but its TLS/AOP model contradicts Cloudflare's actual requirements (AOP needs the global-AOP pem and Full-or-higher mode, not an "origin cert thật"), the compose port mapping contradicts the nginx listener, TRUSTED_PROXY_CIDRS must keep the nginx /32 rather than CF ranges, and the DNS-01/UFW/DNS-record/renewal mechanics are missing or ineffective — all fixable before GO.
Concerns/Blockers: Fix CRITICAL-1..3 and HIGH-4..8 before GO; no code changes are needed, only plan/config corrections (port mapping, AOP pem identity, TRUSTED_PROXY_CIDRS value, DNS record step + DNS-01 certbot, renewal timer + mount granularity, nginx allow/deny in Phase 1, exact-match Origin Rules, CF v4+v6 ranges, and an explicit LMS-reload step for the hoc cert).
