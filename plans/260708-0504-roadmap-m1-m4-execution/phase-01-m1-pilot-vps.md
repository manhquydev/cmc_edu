---
phase: 1
title: "M1 Pilot + VPS thật"
status: pending
priority: P1
dependencies: []
---

# Phase 1 (M1) — Pilot ổn định + chuyển VPS thật

## Overview
Vận hành pilot 1 cơ sở, chứng minh ổn định, rồi chuyển từ local-sim (M0) sang **VPS thật** với
TLS/DNS thật + backup R2/S3 remote. VPS đặt trước P4/P5 (user chốt) vì hạ tầng ổn định là điều kiện
cho AI agent M3; backup drill RT-13 vốn cần R2/S3 remote (đã block từ M0).

## Requirements
- **Functional:** stack `cmcv2-prod` chạy trên VPS thật (không local-sim); DNS `erp.cmcvn.edu.vn`
  trỏ VPS; TLS cert thật (Let's Encrypt/paid, không self-signed); SSO login round-trip THẬT thành công
  (redirect_uri `/api/auth/sso/callback` đã fix ở M0 — verify end-to-end với người thật trên VPS);
  restore drill pass với R2/S3 remote.
- **Non-functional:** pilot 1 cơ sở vận hành ≥2 tuần không sự cố CRITICAL; backup cron chạy off-box;
  isolation-check + boot-checks + env-check prod pass trên VPS.

## Prerequisites (stop-conditions — chốt trước phase)
- VPS thật: provider, spec (RAM/CPU/disk cho postgres+api+worker+nginx+minio), OS (Ubuntu ≥22.04).
- DNS: quyền quản lý record `erp.cmcvn.edu.vn` → IP VPS.
- R2/S3 remote backup creds (BACKUP_S3_*) — host ≠ VPS deploy (RT-13). Đã block từ M0 Phase-2 bước 7.
- Azure redirect URI `/api/auth/sso/callback` đã đăng ký khớp domain thật (verify M0).

## Implementation Steps
1. **Provision VPS + hardening cơ bản:** OS update, firewall (chỉ 80/443/22), non-root deploy user,
   Docker + Compose plugin. `hostname -f` hoạt động (bash native — không như host Windows M0).
2. **DNS + TLS thật:** trỏ A record → VPS IP; Let's Encrypt cert (certbot/DNS-01) vào `infra/nginx/certs/`;
   nginx `server_name` đổi từ placeholder `YOUR_DOMAIN` → `erp.cmcvn.edu.vn` (fix-forward: nginx.conf:40
   hiện hard-code placeholder). HTTP→HTTPS redirect verify.
3. **Deploy stack lên VPS:** `git clone` + `.env.prod` (secrets sinh MỚI trên VPS, KHÔNG copy từ local-sim —
   local-sim secrets coi như throwaway); build images; migrate deploy; `up -d`. isolation-check +
   boot-checks + env-check pass.
4. **Backup + restore drill (RT-13):** cấu hình BACKUP_S3_* = R2/S3 remote thật; `backup-db.sh` chạy;
   `restore-drill.sh` in `=== RESTORE DRILL PASSED ===`. Cron daily backup + monthly drill (runbook §5).
   **Đóng blocker M0 Phase-2 bước 7.**
5. **SSO round-trip THẬT:** người thật login qua Entra trên `https://erp.cmcvn.edu.vn` → consent →
   callback `/api/auth/sso/callback` → cookie staff → `session.me` trả roles. Verify end-to-end
   (M0 chỉ smoke được 302, không round-trip vì local-sim không có DNS thật).
6. **Seed super_admin** trên VPS DB qua `scripts/seed-super-admin.ts` (email Entra thật).
7. **Pilot vận hành ≥2 tuần:** cơ sở thật dùng thật; theo dõi log/health; fix-forward sự cố (mỗi fix 1 PR nhỏ);
   đếm CRITICAL. Exit khi ≥2 tuần liên tục 0-CRITICAL.

## Success Criteria
- [ ] VPS thật: stack healthy, isolation + boot-checks + env-check prod pass; `hostname -f` ok.
- [ ] DNS + TLS thật: HTTPS `erp.cmcvn.edu.vn`, HTTP→HTTPS redirect, cert hợp lệ (không self-signed).
- [ ] SSO round-trip thật PASS (người thật login Entra → staff cookie → role nav).
- [ ] Restore drill pass với R2/S3 remote; backup cron cấu hình; vị trí+retention ghi rõ.
- [ ] Pilot ≥2 tuần liên tục 0-CRITICAL; roadmap doc cập nhật M1 completed.

## Risk Assessment
- Secrets local-sim rò sang VPS → sinh MỚI trên VPS, coi local-sim throwaway (rotate nếu trùng).
- TLS/DNS/firewall khác local-sim → certbot rate-limit, DNS propagation delay; test staging cert trước.
- Restore drill vẫn block nếu R2/S3 creds chưa có → stop-condition, không hoàn tất M1.
- nginx `server_name` placeholder chưa đổi → HSTS/cert mismatch; bước 2 bắt buộc.
