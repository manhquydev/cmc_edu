---
phase: 2
title: "Env-Prod-Cmcv2"
status: in-progress
priority: P1
dependencies: [1]
---

# Phase 2: Env-Prod-Cmcv2

## Overview
Dựng stack `cmcv2-prod` trên máy local giả lập VPS (user đã chốt — không phải VPS thật đợt này)
theo `docs/runbook-deploy.md`, đủ backup off-box + restore drill + isolation + seed. Đóng task #8.
Red-team lộ 3 giả định gãy: shell Windows chạy được runbook, off-box thoả RT-13, seed super_admin tồn tại.

## Requirements
- Functional: `docker compose -p cmcv2-prod up -d` toàn bộ service healthy; `scripts/isolation-check.sh` exit 0 **+ host-port probe** (bước 2); `scripts/restore-drill.sh` in `=== RESTORE DRILL PASSED ===`.
- **Backup off-box = remote R2/S3 THẬT**: `restore-drill.sh:29-33` FAIL nếu backup host = deploy host HOẶC là `localhost`/`127.0.0.1`/`minio`. MinIO trong compose là app-storage, KHÔNG thoả RT-13 (`docker-compose.prod.yml:140` ghi rõ). "off-box = ổ khác" (định nghĩa cũ) KHÔNG đủ — cần creds R2/S3 remote trước bước 6 (xem plan Dependencies).
- Non-functional: `env-check.sh` + `assertRequiredEnvForProd` pass NODE_ENV=production; secrets sinh MỚI; boot-check enforce `STAFF≠LMS` (G10, từ Phase 1) + `STAFF_EMAIL_DOMAIN` set (fail-closed); `ALLOW_DEV_AUTH`+`TEST_OTP_SEAM` vắng (G8/G9).

## Architecture
Artifact có trên main sau Phase 1. Phase VẬN HÀNH theo runbook; sửa code chỉ khi lộ lỗi (fix-forward, PR riêng).
Local-giả-lập-VPS: TLS self-signed chấp nhận; backup vẫn PHẢI remote (RT-13 host-identity, không phải path).

## Related Code Files
- Đọc/thực thi: `docs/runbook-deploy.md` 1.1→1.8, `scripts/{isolation-check,env-check,backup-db,restore-drill}.sh`.
- Modify (chỉ khi lộ lỗi): compose/Dockerfile/env-check/scripts — mỗi fix 1 PR nhỏ.
- `.env.prod` (local, KHÔNG commit): từ `.env.prod.example`, `grep CHANGE_ME` → 0 dòng.

## Implementation Steps
0. **Exec env = WSL2 (đã chốt)**: chạy runbook/scripts trong WSL2 (bash đầy đủ, `hostname -f` hoạt động). Verify `aws`, `psql`, `pg_restore`, `grep -oP` có trong WSL2 trước khi chạy.
1. Pre-check runbook 1.1: Docker ≥24, certs (self-signed ok), `.env.prod` đầy đủ, 2 session secret khác nhau, `STAFF_EMAIL_DOMAIN` set, Azure redirect URI khớp `ERP_SSO_REDIRECT_URI` cho origin local-sim (giá trị thật xác nhận ở plan Dependencies).
2. `isolation-check.sh` exit 0 **+ host-port probe** bổ sung: script chỉ soi container `cmcnew*` (`isolation-check.sh:14,26,48-53`), bỏ lọt IIS/HTTP.SYS/stack khác giữ 80/443. Chạy `netstat -ano | findstr ":80 :443"` (hoặc `Test-NetConnection`) trước `up -d`; giải phóng port nếu bận.
3. `env-check.sh` pass NODE_ENV=production.
4. Build images + `prisma migrate deploy` (đã pre-flight duplicate-email ở Phase 1 bước 2) + `up -d` theo runbook 1.3–1.5; fix-forward lỗi build/boot (mỗi fix 1 PR).
5. Verify healthy (runbook 1.6) + boot-checks API pass (cmc_app role, FORCE-RLS, env, STAFF≠LMS, STAFF_EMAIL_DOMAIN).
6. **SSO smoke (rẻ, trước UAT người thật)**: `curl -i` route `/auth/login` trên stack → assert 302 tới `login.microsoftonline.com` với `redirect_uri` khớp origin local-sim; 1 vòng browser tới màn consent Entra để bắt sớm AADSTS50011/tenant/consent. Bắt lỗi redirect-URI TRƯỚC khi đặt lịch UAT.
7. Backup + restore drill (runbook 1.7): target = **Cloudflare R2** (user chốt 2026-07-08; KHÔNG dùng
   localhost/minio); drill exit 0. Ghi vị trí + retention backup dump. Chi tiết bake từ red-team 2026-07-08:
   - **Contract creds đúng script cần** (F-A5, `scripts/backup-db.sh:11-16`, `restore-drill.sh:12-18`):
     `BACKUP_S3_ENDPOINT` + `BACKUP_S3_BUCKET` + `BACKUP_S3_ACCESS_KEY` + `BACKUP_S3_SECRET_KEY`
     (R2 = **S3 keypair**, không phải bearer API token) — user tạo R2 API Token dạng S3-compatible.
   - **Pre-pin trước lần chạy đầu** (F-FM5, lỗi deterministic aws-cli-v2 ↔ R2 checksum, sẽ đốt cả 2
     lượt thử nếu không pin): `export AWS_REQUEST_CHECKSUM_CALCULATION=when_required` (+
     `AWS_RESPONSE_CHECKSUM_VALIDATION=when_required`).
   - **Bảo mật dump = PII trẻ em + tiền** (F-S1): mã hoá client-side trước upload (gpg symmetric hoặc
     openssl, key trong .env.prod không commit); `trap 'rm -f $TMP_DUMP' EXIT` trong restore-drill
     (hiện `rm` ở :94 chết trước nếu `set -e` abort — dump thật kẹt lại /tmp); assert bucket R2 chặn
     public access trước upload đầu. Sửa script = fix-forward PR riêng, land trước khi drill tính PASS.
   - **Escrow khoá (validate 2026-07-08)**: bản sao passphrase mã hoá lưu **password manager** của user
     (ngoài máy dev) — máy chết vẫn restore được; verify bằng cách giải mã thử 1 dump bằng passphrase
     lấy từ password manager (không phải từ .env.prod).
   - **Retention (validate 2026-07-08)**: **30 ngày**, đặt lifecycle rule tự xoá trên bucket R2; ghi
     rule + vị trí vào runbook.
8. Seed: dùng bootstrap script super_admin từ Phase 1 (seed.mjs gốc KHÔNG có AppUser) — upsert facility + super_admin AppUser email Entra thật. **Unresolved: user cần cung cấp địa chỉ email Entra thật trước bước này.**
   **Hardening (F-S6 — super_admin bypass toàn registry `index.ts:186`, không revocation RT-ε):** tài
   khoản Entra được seed phải bật MFA/conditional-access phía Azure; ghi vào runbook thủ tục deactivate
   (xoá AppUser row + đợi session hết hạn) khi cần thu hồi; không dùng tài khoản này cho thao tác thường ngày.
9. Điền Prerequisites + gate G1–G10 (+ STAFF_EMAIL_DOMAIN gate) trong `docs/uat-checklist-go-live.md`; TaskUpdate #8 → completed.

## Success Criteria
- [x] Execution env: **đổi quyết định** — WSL2 Ubuntu không có Docker Desktop integration (chỉ distro
  `docker-desktop` mới có socket), `docker ps` trong WSL2 trả "command not found" dù `which docker` OK
  (binary tồn tại nhưng không gọi được daemon). Toàn bộ thao tác docker chuyển sang **Git Bash native
  Windows** (docker socket thật, đã verify `docker ps` thấy đúng stack). WSL2 chỉ còn cần cho
  aws/psql/pg_restore (restore drill) — chưa test vì Bước 7 hoãn.
- [x] Stack healthy: `cmcv2-prod` đã chạy sẵn (7 container, đã lên trước phiên này) — isolation-check PASS
  (sau khi sửa CRLF, xem Risk) + host-port probe thủ công (`netstat`, chỉ 1 PID docker sở hữu 80/443) +
  env-check prod PASS (22 biến bắt buộc present, NODE_ENV=production) + boot-check không FATAL hiện tại.
- [x] SSO smoke: `/auth/login` → 302 tới `login.microsoftonline.com` với tenant thật + `redirect_uri`
  khớp `erp.cmcvn.edu.vn` + `state` param có mặt (xác nhận fix C1 CSRF từ Phase 1 đã land đúng).
  **Browser round-trip tới màn hình consent CHƯA làm** — cần người thật với credential Entra thật;
  để lại cho Phase 4 (UAT) tự nhiên cover qua staff login thật.
- [x] Restore drill: **PASS** (2026-07-09 21:xx) — `=== RESTORE DRILL PASSED ===`, 49 tables,
  RT-13 backup_host≠deploy_host, smoke-2 RLS qua cmc_app OK, escrow decrypt verify OK. R2 setup:
  endpoint từ account ID (`wrangler whoami`); bucket `cmc-db-backups` (`wrangler r2 bucket create`)
  + lifecycle 30 ngày + public access disabled. R2 API token user tạo qua Dashboard (wrangler không
  tạo được S3 keypair) — token đầu scope nhầm `cmc-homework` (put/get/list đều AccessDenied), user tạo
  token thứ 2 scope đúng `cmc-db-backups` → PASS. Bổ sung 3 biến thiếu khỏi `.env.prod`:
  `BACKUP_KEEP_DAYS=30`, `BACKUP_ENCRYPTION_PASSPHRASE` (sinh mới — **user CẦN escrow vào password
  manager**, chưa xác nhận), `BACKUP_BUCKET_PRIVATE_CONFIRMED=true`.
  **2 bug script sửa fix-forward khi drill (xem mục Bugs #5, #6).** DB reachability: postgres không map
  port ra host → dùng socat sidecar tạm (`cmcv2-pgfwd` trên compose net, publish 15432, đã teardown)
  cho aws/psql/pg_dump trong WSL2 chạm được; đây là workaround local-sim, VPS thật DB reachable trực tiếp.
- [x] Seed super_admin: `<super-admin-email>` (user cấp), facility `HO` (user cấp — trụ sở chính/Holding).
  Chạy qua SQL upsert tương đương `scripts/seed-super-admin.ts` (khớp logic 1:1, kể cả deterministic
  userId) vì `DATABASE_URL` trỏ hostname `postgres` chỉ resolve được trong docker network, không phải
  từ host — script gốc theo runbook 1.4/1.8 ("chạy từ host") không chạy được as-is với compose hiện tại
  (postgres không map port ra host — đúng theo thiết kế bảo mật, nhưng mâu thuẫn với hướng dẫn runbook).
  Hardening MFA/conditional-access + thủ tục deactivate: **cần user làm phía Azure Portal**, chưa verify được từ đây.
- [x] Gate G1–G10 + STAFF_EMAIL_DOMAIN: G6 (isolation) · G8 (ALLOW_DEV_AUTH absent) · G9 (TEST_OTP_SEAM absent) (G6/G8/G9/G10 verified in narrative; ticked 2026-07-12 as docs-only formality)
  · G10 (2 session secret khác nhau — key names present, chưa so sánh giá trị) verify được từ Phase 2.
  G1-G5, G7 thuộc Phase 3/4 hoặc cần chữ ký người thứ hai — không tự tick ở đây.

## Bugs phát hiện + sửa trong phiên này (fix-forward, ngoài dự kiến ban đầu)
1. **CRLF trên `scripts/isolation-check.sh` + `scripts/env-check.sh`** — checkout Windows không có
   `.gitattributes` nên 2 file bị CRLF, vỡ khi chạy bash (`$'\r': command not found`). Fix: thêm
   `.gitattributes` (`*.sh text eol=lf`) + renormalize 2 file.
2. **nginx stale-upstream-DNS 502** (`infra/nginx/nginx.conf`) — `proxy_pass http://api:3000` dùng
   hostname trực tiếp, nginx cache IP lúc worker start; sau khi api container restart (IP đổi), nginx
   vẫn route tới IP chết → 502 tới khi tự tay restart nginx. Đây là bug ảnh hưởng **routine ops thật**
   (`docker compose up -d --no-deps api` trong runbook §2.1). Fix: thêm `resolver 127.0.0.11 valid=10s;`
   + đổi toàn bộ `proxy_pass` sang biến (`set $api_upstream api:3000; proxy_pass http://$api_upstream;`).
   Verify: restart api container thật → nginx tự phục hồi không cần restart tay.
3. **nginx `proxy_pass` biến + URI suffix = im lặng bỏ suffix** (nginx trac#1067, code-reviewer bắt) —
   bước 2 lúc đầu giữ `proxy_pass http://$lms_upstream/lms/;`, nhưng biến + suffix bị nginx bỏ suffix
   im lặng → `GET /` forward nguyên văn `/` tới container `lms` (chỉ có nội dung tại `/lms/*`) → trả về
   trang mặc định "Welcome to nginx!" của base image, KHÔNG PHẢI app LMS thật — 200 OK giả, che bug.
   Fix: `rewrite ^/(.*)$ /lms/$1 break;` trước `proxy_pass` (rewrite áp dụng được dù proxy_pass dùng biến).
   `/admin/` không cần rewrite vì prefix trùng suffix (identity mapping, đã verify không đổi hành vi).
4. **LMS prod build thiếu `VITE_API_URL`** (`infra/docker/Dockerfile.lms`, code-reviewer bắt khi trace
   theo pattern #3) — `apps/lms/src/lib/trpc.ts:22` + `session-evidence.tsx:29` đọc `VITE_API_URL`, nhưng
   Dockerfile chỉ set `VITE_API_BASE_URL` (biến chết, không code nào đọc trong lms) — bundle prod bake
   cứng fallback `http://localhost:3000`, nghĩa là **mọi API call của LMS (đăng nhập OTP PH/HS...) sẽ
   gọi tới máy của chính user, không phải server** — go-live blocker thật cho LMS nếu không bắt được.
   Fix: thêm `ARG/ENV VITE_API_URL=` (khớp pattern `Dockerfile.admin`) + parity fix `docker-compose.prod.yml`
   (lms build args thiếu `VITE_API_URL` pass-through). Rebuild + redeploy `lms` image, verify bundle
   không còn chuỗi `localhost:3000`, `GET /` trả app thật (không phải trang nginx mặc định).
5. **`backup-db.sh` pg_dump vỡ với `?schema=`** — `.env.prod` DATABASE_URL là Prisma URL kết thúc
   `?schema=public`; pg_dump/libpq reject (`invalid URI query parameter: "schema"`). Fix: strip query
   `PGDUMP_URL="${DATABASE_URL%%\?*}"` trước pg_dump. Bug thật — sẽ chết ở backup đầu tiên trên VPS thật.
6. **Backup/restore `--no-acl` = mất GRANT của cmc_app** — `backup-db.sh` dump `--no-acl` và
   `restore-drill.sh` restore `--no-acl`; nhưng quyền bảng của `cmc_app` nằm trong GRANT ở migration
   (`GRANT UPDATE ON "Receipt" TO cmc_app` …). `--no-acl` → dump/restore bỏ hết GRANT → DB phục hồi có
   bảng+data nhưng cmc_app **0 quyền** → app không query được bảng nào sau DR thật (drill smoke-2 bắt
   đúng: `permission denied for table Receipt`). Fix: bỏ `--no-acl` cả 2 file (giữ `--no-owner`). Drill
   PASS sau fix. Caveat DR (code-reviewer): restore ACL-inclusive vào host MỚI (chưa có role cmc_app) sẽ
   fail role-missing → runbook 1.7 thêm note tạo role trước restore.

## Risk Assessment
- Docker phá huỷ tiềm tàng (down -v, đè volume) → isolation-check + host-port probe trước; user xác nhận trước xoá.
- Backup remote là external dependency (R2/S3 creds) → nếu chưa có, drill KHÔNG thể pass; stop-condition.
- Local ≠ VPS thật (TLS/DNS/firewall) — ghi giới hạn vào checklist; VPS thật là bước sau GO.
- Stop-conditions: port conflict không giải, Azure creds/redirect sai (bắt ở smoke bước 6), restore drill fail 2 lần, WSL2 không sẵn.
