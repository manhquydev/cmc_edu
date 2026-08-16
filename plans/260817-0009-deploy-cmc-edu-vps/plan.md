# Plan v3 (FINAL): Deploy cmc_edu (ERP+LMS) lên VPS 152.42.167.189 — song song với cmc-lms

**Created:** 2026-08-17 | **v3.1** — sau 2 vòng; domains deverp/devlms (đã xác nhận DNS tồn tại) red-team + validate (4 báo cáo độc lập, scope khác nhau) | **KHÔNG ĐƯỢC IMPLEMENT**
**Báo cáo đã tích hợp:** plan-review-260817-{r1-redteam-infra, r1-validate-completeness, r2-redteam-data-ops, r2-validate-rollback}.md
**Quyết định vòng lặp:** tất cả CRITICAL/HIGH của cả 2 vòng đã được giải quyết TRONG plan này (mục "Tích hợp findings" ghi từng cái) → GO-ready (vẫn chưa implement).

## Nguyên tắc bất biến
1. KHÔNG ảnh hưởng cmc-lms (hoc.cmcvn.edu.vn): không sửa /root/cmc-lms, compose "docker", 80/443, network/volume LMS, route CF của hoc.
2. cmc_edu = project compose **cmcv2-prod** (đồng bộ name trong compose + TRUSTED_PROXY + network names), mọi resource riêng.
3. VPS deployment **tự chứa hoàn toàn (laptop-independent)**: clone, seed, test đều chạy TRÊN VPS (container), không phụ thuộc laptop.
4. Mọi thay đổi có backup + validate (nginx -t, sshd -t, openssl verify, certbot --staging) + rollback rẻ theo từng phase.
5. Fail-open audit (GlitchTip chết không chặn traffic — verified instrument.ts).

## Tích hợp findings (không còn CRITICAL/HIGH mở)
| # | Finding (nguồn) | Giải quyết trong plan |
|---|---|---|
| C1 (R1) | publish 8080:80 vs listen 8080 | Phase 1: publish **0.0.0.0:8080:8080**, nginx listen 8080 ssl |
| C2 (R1) | AOP = Origin CA (sai) | Phase 1/4: AOP = CF **client cert** (authenticated_origin_pull_ca.pem); LE+AOP+Full/Full-strict hợp lệ |
| C3 (R1) | TRUSTED_PROXY = CF (sai) | Phase 1: API GIỮ "172.28.0.10/32,127.0.0.1/32"; CHỈ nginx real_ip trust CF |
| H4/H6/H7/H8 (R1) | DNS hoc-test, DNS-01, renewal, Full-strict | Phase 0.5/0.6/4: DNS record hoc-test (grey→orange), certbot-dns-cloudflare, timer+symlink, trình tự Full-strict sau hoc-LE |
| H5 (R1) | UFW không chặn docker-publish | Phase 1/2: boundary = nginx allow CF v4+v6 + AOP (active ngay khi up); UFW lớp phụ |
| H-1..H-3 (V1) | seed path, cert, UAT repoint | Phase 1: tools image (scripts+src) cho seed; DNS-01; suite repoint env |
| H-4 (V1) | obs-bridge/subnet pre-flight | Phase 0.4: network create + subnet check + isolation-check-vps |
| C1 (R2) | blob không backup | Phase 1/3: backup-vps.sh = pg_dump + **tar blob volume**, cùng offsite, có drill |
| C2 (R2) | backup split-brain | Phase 1/3: **MỘT target R2**, prefix VPS riêng (cmcv2-vps/), drill containerized |
| H-1 (R2) | restore-drill không chạy được trên VPS | Phase 1/3: drill qua container (pg_restore trong container), chạy SAU backup đầu |
| H-2 (R2) | gate Host-header không pass khi AOP on | Phase 2.4: verify TRONG compose network + negative AOP probe (ngoài → 400) |
| H-3 (R2) | isolation-check vacuous | Phase 0.4: **isolation-check-vps.sh** (kiểm cmclms-*, 8080, subnet, volume) |
| H-4 (R2) | clone mang .env.prod laptop | Phase 2.1: **git clone** (không rsync working dir) + .env.prod mới từ example + **secret scan** sau deploy |
| H-1..H-3 (V2) | rollback P2, ALTER-ROLE recovery, rule typo | Phase 2 rollback block; Phase 2.3 recovery; Phase 4 baselines + exact-match + purge |
| MEDIUM (V2/R2) | laptop independence, mem limits, disk monitor, track-error zones, secrets lifecycle, timezone, runner | Phase 1 (tools+test container, mem_limit), Phase 3 (monitor disk/cert/deadman), Phase 6 (runner container) |

## Kiến trúc đích
```
Cloudflare (deverp.cmcvn.edu.vn; devlms.cmcvn.edu.vn [MỚI]; hoc.cmcvn.edu.vn GIỮ NGUYÊN → LMS)
 ├─ hoc.cmcvn.edu.vn → VPS:443 → cmclms-web (LMS prod — bất biến)
 └─ erp.* / hoc-test.* → VPS:8080 → cmcv2-prod-nginx (cmc_edu: admin + lms SPA + /trpc)
     [Origin Rule CF exact-hostname] → api/worker/postgres/admin/lms + glitchtip (cmcv2-obs)
```
- nginx: listen 8080 ssl; cert LE (DNS-01); **AOP** (ssl_verify_client on + authenticated_origin_pull_ca.pem);
  real_ip trust CF v4+v6 + CF-Connecting-IP; **allow CF v4+v6 + deny all**; include api-locations.conf
  (track-error location + clienterr zone — đã có); HSTS + security headers; default 444.
- API: TRUSTED_PROXY_CIDRS giữ "172.28.0.10/32,127.0.0.1/32".
- Mọi service có mem_limit (mirror LMS), log caps (json-file 10m×3), healthchecks.

## Phases

### Phase 0 — Pre-flight + hygiene + mạng + cert
0.1 Backup TRƯỚC: Cloudflare zone export · pg_dump cmclms_prod_pgdata · /etc/letsencrypt tar · ghi danh sách secrets
    (key names) hiện có để đối chiếu sau.
0.2 Dọn (sau backup + confirm): /root/*.login, GITHUB_TOKEN cũ, cmcnew* legacy (giữ backup), cron chết trỏ /opt/cmc.
0.3 Cài fail2ban (jail sshd).
0.4 Pre-flight mạng: `docker network create cmc-obs-bridge` (external) + assert subnet 172.28.0.0/16 trống +
    **chạy infra/vps/isolation-check-vps.sh** (gate: exit 0) — kiểm: KHÔNG có cmclms-* conflict, 8080 trống,
    volume cmcv2-prod-* chưa tồn tại.
0.5 Cert: cài certbot + certbot-dns-cloudflare (CF API token scope: erp + hoc-test); **DNS-01 --staging trước**,
    rồi real: LE cho deverp.cmcvn.edu.vn + devlms.cmcvn.edu.vn (**DNS record hoc-test: tạo GREY ở Phase 0, flip
    ORANGE ở Phase 4** — tránh serve LMS trong khoảng gap); renewal timer + pin /etc/letsencrypt/live symlink;
    **phối hợp LMS owner: gia hạn hoc.cmcvn.edu.vn qua LE (lần đầu — certbot chưa từng cài) TRƯỚC khi flip Full-strict**.
0.6 Xác nhận SSL mode CF (Full) — KHÔNG flip Full-strict cho tới khi hoc có LE + renewal chứng minh (H8/V2 gate).
Gate: backup xong; isolation-check-vps exit 0; certbot --staging pass; renew --dry-run pass; hoc-LE done.

### Phase 1 — Artifact (trong repo; chưa đụng VPS)
- `infra/vps/docker-compose.override.yml`: nginx ports **"0.0.0.0:8080:8080"**; mem_limit mọi service;
  blob volume mount api+worker (BLOB_STORAGE_DIR=/data/blobs); network external cmc-obs-bridge; glitchtip
  bind 127.0.0.1:8000:8080 (project cmcv2-obs).
- `infra/vps/nginx.vps.conf`: như kiến trúc (8080 ssl, AOP, CF real_ip v4+v6, allow CF/deny, track-error
  zones + RT-2 headers, HSTS, 444).
- `infra/vps/tools.Dockerfile`: build-stage image chứa scripts/seed-*.ts + apps/api/src (cho seed trên VPS
  không cần node host) — đổi Dockerfile.api build stage COPY (H-1 V1 + V2 laptop-independence).
- `infra/vps/test-runner.Dockerfile`: node + Playwright (cho live UAT chạy TRÊN VPS host — Phase 6).
- `infra/vps/deploy-vps.sh`: set -euo pipefail; **migrate (container) → ALTER ROLE cmc_app (psql -v, KHÔNG in
  password, redact log) → up -d → seed (tools image)**; recovery block nếu ALTER ROLE fail (re-run idempotent);
  idempotent (chạy lại an toàn — seeds chỉ set password khi hash NULL).
- `infra/vps/backup-vps.sh`: **pg_dump containerized + tar+encrypt blob volume** → offsite **R2 (một target,
  prefix cmcv2-vps/)** + keep N + cron (timezone pin UTC) + **restore drill containerized** (pg_restore trong
  container) — drill chạy SAU backup đầu tiên (H-1 R2), không "trước seed" trên fresh deploy.
- `infra/vps/monitor-vps.sh`: health + **disk-growth (140GB shared)** + cert-expiry (erp/hoc-test/hoc) +
  deadman (Telegram) + backup-freshness → systemd timer + **live-fire test**.
- `infra/vps/isolation-check-vps.sh`: kiểm cmclms-*, 8080, subnet, volume (H-3 R2).
- `scripts/seed-directors.ts` + .env.prod.example: thêm GDKD_PASSWORD/GDDT_PASSWORD.
- `apps/e2e/playwright.live.config.ts`: baseURL từ env (LIVE_ADMIN_ORIGIN/LIVE_LMS_ORIGIN).
Gate: docker compose config -q; nginx -t (container mount cert+LE+AOP pem thật); typecheck; scripts --help run.

### Phase 2 — Deploy stack (laptop-independent; rollback block rõ)
2.1 **git clone** repo → /root/cmc-edu (KHÔNG rsync working dir — tránh mang .env.prod laptop, H-4 R2);
    tạo .env.prod MỚI (47 keys, secret random — BREVO/R2/SUPER_ADMIN/GDKD/GDDT/DSN); perms 600.
2.2 build (override) → **migrate (container)** → **ALTER ROLE cmc_app** (network-auth verify, redact) →
    up -d → **secret scan** (grep giá trị secret cũ của laptop trong /root/cmc-edu — pass = không rò rỉ).
2.3 seed-super-admin + seed-directors (tools image). Recovery: nếu migrate OK / ALTER ROLE fail → api boot-FATAL
    (verified) → chạy lại ALTER ROLE (idempotent) → restart api/worker.
2.4 Gate: api/worker/nginx healthy; **verify TRONG compose network** (curl Host: erp → admin title; hoc-test →
    lms title; /health ok) — không qua internet (AOP sẽ 400 ngoài, H-2 R2); **negative AOP probe** (ngoài → 400);
    hoc.cmcvn.edu.vn body-hash baseline KHÔNG đổi.
**Rollback P2 (H-1 V2):** `docker compose -p cmcv2-prod down` (giữ volume) = pre-state; full reset chỉ
`down -v --rmi local`; **KHÔNG BAO GIỜ --rmi all** (postgres:16-alpine/node:22-alpine DÙNG CHUNG với LMS);
chứng minh pre-state: docker ps chỉ còn cmclms-*, 8080 free, body-hash hoc không đổi.

### Phase 3 — Observability + backup + monitor (full prod)
- cmcv2-obs (glitchtip): .env.obs (SECRET_KEY mới); bootstrap user → org → project → DSN
  (SENTRY_DSN=http://KEY@glitchtip-web:8080/1); GLITCHTIP_DOMAIN khớp thật; fail-open.
- pino JSON + nginx access (CF real IP) + reqId/clientCode correlation.
- backup-vps.sh (pg+blob, R2 prefix cmcv2-vps/, cron UTC) + **restore drill chạy lần đầu** + keep N.
- monitor-vps.sh (health/disk/cert/deadman/backup-freshness) + timer + **live-fire test** (kill service → cảnh báo).
Gate: inject lỗi → GlitchTip event; grep pino reqId; backup+drill pass; deadman live-fire pass.

### Phase 4 — Networking cutover (Cloudflare)
4.0 **Fresh baselines** (body-hash erp/hoc/hoc-test; CF Trace) TRƯỚC khi thêm rule (H-3 V2).
4.1 Origin Rule CF **exact-hostname** (không wildcard): erp → VPS:8080; hoc-test → VPS:8080; **test expression
    trong CF editor** trước; flip hoc-test GREY→ORANGE.
4.2 Verify: https erp → admin; hoc-test → lms; /health 200; **regression hoc: body-hash KHÔNG đổi + CF Trace
    vẫn tới :443**; cache purge (nếu zone có cache-everything).
4.3 Rollback: **delete rule theo rule-ID** + cache purge + CF Trace verify — hoc không đổi (LMS nginx không có
    default_server → erp quay về serve LMS byte-identical, V2 verified).

### Phase 5 — Setup ban đầu
- Super-admin admin@cmcvn.edu.vn (bootstrap .env.prod VPS, mustChangePassword) + Facility "CMC Development".
- seed-directors: gdkd@ + gddt@ (mật khẩu từ .env.prod VPS, mustChangePassword) — GĐ tự tạo nhân sự (user.manage + 4 guard).
Gate: login 3 tài khoản qua https erp; GĐ tạo staff OK; GĐ không leo thang super_admin.

### Phase 6 — Verification + go-live + bàn giao
- Live UAT suite chạy **TRONG test-runner container trên VPS host** (LIVE_ADMIN_ORIGIN=https://deverp.cmcvn.edu.vn,
  LIVE_LMS_ORIGIN=https://devlms.cmcvn.edu.vn; docker exec đọc EmailOutbox) — 6 spec, 6/6 pass, 0 lỗi.
- Smoke toàn chuỗi + audit-log + GlitchTip; kiểm tra backup 1 đêm thật; cert renew --dry-run.
- Bàn giao: credentials (3 tài khoản), runbook vận hành (tra cứu lỗi theo mã/reqId, backup/restore, rollback
  từng phase, gia hạn cert), ledger dữ liệu test.
- **Acceptance đo được** (mỗi mục có pass/fail): mọi gate phase xanh; hoc.cmcvn.edu.vn body-hash bất biến suốt
  quá trình; cmc_edu full (audit/log/monitor/backup) hoạt động; 2 hệ thống song song ổn định 72h.

## Rủi ro + rollback tổng
| Rủi ro | Tín hiệu | Ứng phó |
|---|---|---|
| 8080 conflict | compose up "bind" fail | override 8081 + đổi CF rule |
| AOP/cert sai | 400/495/526 | openssl verify trước; LE+AOP+Full hợp lệ |
| Rule bắt nhầm hoc | hoc đổi body | delete rule theo ID + purge + CF Trace |
| Flip Full-strict sớm | hoc 526 | chỉ flip sau hoc-LE; giữ Full |
| real_ip sai | 429/geofence | nginx trust CF v4+v6 + CF-Connecting-IP; API giữ TRUSTED_PROXY |
| Mất blob | disk/volume lỗi | backup-vps.sh tar+encrypt blob offsite + drill |
| Split-brain backup | restore sai stack | một target R2, prefix cmcv2-vps/ riêng |
| Lộ secret cũ | secret scan fail | git clone sạch + .env.prod mới + scan gate |

## Acceptance cuối (GO implement chỉ khi)
- 2 vòng red-team + validate (4 báo cáo, scope khác nhau) — mọi CRITICAL/HIGH đã đóng trong plan (bảng "Tích hợp findings").
- Đủ artifact (override/nginx/tools/test-runner/deploy/backup/monitor/isolation-check + seeds env) + runbook + rollback từng phase.
- cmc-lms bất biến; cmc_edu full (audit/log/monitor/backup); setup ban đầu + 2 GĐ rõ; VPS tự chứa (không laptop).

**TRẠNG THÁI: PLAN HOÀN CHỈNH — DỪNG PHIÊN, CHƯA IMPLEMENT (theo yêu cầu người dùng).**