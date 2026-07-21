---
phase: 2
title: "Clean-room deploy = trả nợ full G7"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Clean-room deploy = trả nợ full G7

## Context links
- Runbook first-time deploy 1.1→1.8: `docs/runbook-deploy.md:7-116`
- G7-light defer note: `plans/260707-2308-golive-sprint-land-sso-env-uat/phase-04-uat-gonogo.md:17-20`
- 6 fix-forward bugs local-sim (đã land, phải có trong image mới): phase-02 golive:95-128
- SSO smoke (bước 6 local-sim): phase-02 golive:37

## Overview
- **Date:** 2026-07-10 · **Priority:** P1
- **Description:** Deploy stack `cmcv2-prod` từ zero trên VPS thật theo runbook, TLS/DNS thật, env-check
  + isolation-check pass, boot-checks không FATAL. **Sinh secrets MỚI** cho VPS (session secrets rotate),
  KHÔNG copy `.env.prod` local-sim mù. Đây = **full G7** (clean-room run có chữ ký second-person).
- **Implementation status:** pending (blocked-by Phase 1)
- **Review status:** not reviewed

## Key Insights
- Full G7 gốc = "redeploy từ đầu + env sign-off" bị hạ thành G7-light ở M0 vì local-sim không phải host
  thật (phase-04 golive:17). VPS deploy chính là clean-room run tự nhiên → làm đúng 1 lần là trả nợ.
- 6 bug fix-forward local-sim (CRLF `.gitattributes`, nginx stale-upstream-DNS resolver, nginx var+suffix
  rewrite, LMS `VITE_API_URL`, backup `?schema=` strip, `--no-acl` GRANT loss) **đã land trên main** →
  image build từ main mới nhất tự có; KHÔNG cần re-fix, chỉ verify bundle không còn `localhost:3000`.
- postgres không map port ra host (compose:124-134, cố ý) → `prisma migrate deploy` từ host shell fail
  resolve `postgres` (runbook:49-56). Trên VPS: chạy migrate qua throwaway container attach vào
  `cmcv2-prod_cmcv2-prod-net` (runbook note khuyến nghị), KHÔNG expose DB port vĩnh viễn.
- **[C2] P2 KHÔNG migrate/seed `cmc_prod` thật** — `cmc_prod` giữ TRỐNG cho P3 restore full dump. P2 chứng
  minh cơ chế deploy + images + boot-check logic bằng **throwaway DB** (migrate + seed vào DB tạm cùng
  postgres, drop sau). super_admin login verify chuyển sang P3 (dump từ local-sim M0 đã có super_admin).
- Secrets local-sim có thể đã dùng cho e2e/throwaway → **rotate**: sinh mới `STAFF_SESSION_SECRET`,
  `LMS_SESSION_SECRET` (`openssl rand -base64 48`, 2 giá trị KHÁC nhau); `POSTGRES_PASSWORD` + `cmc_app`
  password mới. **[C3] GIỮ `BACKUP_ENCRYPTION_PASSPHRASE` hiện hành (M0)** — KHÔNG rotate ở P2 (dump
  cutover P3 phải giải mã được bằng passphrase hiện hành). Rotate passphrase để P5 (sau cutover verified).

## Requirements
- Functional: `docker compose -p cmcv2-prod up -d` toàn service healthy (runbook 1.6); boot-checks API
  (cmc_app role, FORCE-RLS mọi bảng, STAFF≠LMS, STAFF_EMAIL_DOMAIN set) + worker không FATAL
  (`runbook-deploy.md:191-217`); `isolation-check.sh` exit 0; `env-check.sh` NODE_ENV=production PASS.
- TLS thật: Let's Encrypt cert tại `infra/nginx/certs/{fullchain,privkey}.pem`; HTTP→HTTPS redirect;
  HTTPS-only. `dig <domain>` = IP VPS.
- SSO smoke: `curl -i /auth/login` → 302 tới `login.microsoftonline.com` với `redirect_uri` = domain thật
  + `state` param present; 1 browser round-trip tới màn consent Entra (bắt AADSTS50011 sớm).
- **[H6] Email-live gate**: verify `BREVO_API_KEY` bằng **1 API call / 1 email thật** trên VPS (không chỉ
  check non-empty) — key được rotate ở M0 P-1 (local-sim trả 401), M1 verify key hoạt động trên VPS. Nếu
  fail → email OTP PH/HS không gửi được = blocker pilot.
- **Full G7 sign-off**: second-person (~15') chạy `env-check.sh` + xem boot-checks + grep xác nhận
  `ALLOW_DEV_AUTH`/`TEST_OTP_SEAM` vắng khỏi `.env.prod` → ký. **Kèm** xác nhận đây là clean-room từ zero.
- Non-functional: `.env.prod` KHÔNG commit (`git check-ignore .env.prod`); `grep CHANGE_ME .env.prod` → 0.

## Architecture
Deploy theo runbook §1 nguyên trạng — chỉ đổi host (VPS) + certs (LE thật). Migrate **throwaway DB** qua
container trên compose net (không map DB port). nginx resolver fix (phase-02 golive:99-104) + LMS
`VITE_API_URL` fix (:111-118) đã trong main → image thật đúng. **[C2] KHÔNG seed super_admin vào
`cmc_prod`** — super_admin + facility đến từ P3 dump (local-sim M0 đã seed). `cmc_prod` giữ TRỐNG cho P3.

## Related code files
- Thực thi: `docs/runbook-deploy.md` 1.1→1.8; `scripts/{isolation-check,env-check}.sh`.
- `docker-compose.prod.yml` (build + up; minio KHÔNG bật — dùng blob local-disk hoặc S3, R2 chỉ cho backup).
- `.env.prod` (VPS, KHÔNG commit): từ `.env.prod.example`; session/DB secrets sinh MỚI, GIỮ passphrase M0 (C3).
- `infra/nginx/{nginx.conf,certs/}` (LE certs thật).
- Sửa code chỉ khi lộ lỗi mới → fix-forward 1 PR (khác 6 bug đã đóng).

## Implementation Steps
1. Tạo `.env.prod` trên VPS từ `.env.prod.example`; điền domain thật (`ERP_SSO_REDIRECT_URI`,
   `CORS_ORIGINS`, `ADMIN_APP_ORIGIN`); **sinh mới** 2 session secret khác nhau + DB pw; **GIỮ passphrase
   M0 hiện hành (C3 — KHÔNG rotate)**; copy R2 backup creds (reuse bucket M0); `grep CHANGE_ME` → 0;
   `grep ALLOW_DEV_AUTH`/`TEST_OTP_SEAM` → rỗng.
2. TLS: xin LE cert cho domain (certbot standalone hoặc DNS-01); đặt vào `infra/nginx/certs/`; verify.
3. `isolation-check.sh` exit 0 (host sạch, không cmcnew-*) + `netstat` xác nhận 80/443 free trước `up`.
4. `env-check.sh` NODE_ENV=production PASS (22+ biến; SSO_ENABLED=true → Entra+Graph vars required).
5. Build images từ main mới nhất (runbook 1.3); verify LMS bundle KHÔNG chứa `localhost:3000`.
6. **[C2]** Migrate + seed vào **throwaway DB** (cùng postgres container, vd `cmc_smoke`) qua container
   attach `cmcv2-prod-net` để chứng minh images/migrate/boot-check; **KHÔNG migrate/seed `cmc_prod`**
   (giữ trống cho P3). `up -d` stack (api trỏ throwaway cho smoke, hoặc cmc_prod trống — xem note).
   > Boot-check API cần schema; nếu api trỏ `cmc_prod` trống sẽ FATAL FORCE-RLS. Cho P2 smoke: trỏ api
   > tạm vào throwaway migrated để verify boot-check logic, rồi đưa về `cmc_prod` cho P3. Drop throwaway sau.
7. Verify healthy (runbook 1.6) + boot-checks API/worker không FATAL (trên throwaway migrated).
8. SSO smoke: `curl -i https://<domain>/auth/login` → 302 login.microsoftonline.com + redirect_uri khớp
   + state present; 1 browser round-trip màn consent Entra (bắt AADSTS50011/tenant/consent).
9. **[H6] Email-live verify**: 1 API call / 1 email Brevo thật trên VPS → xác nhận `BREVO_API_KEY` hoạt động
   (không chỉ non-empty). super_admin + facility đến từ **P3 dump** (không seed cmc_prod ở P2 — C2). Bật
   MFA/conditional-access Azure cho account super_admin (F-S6); ghi thủ tục deactivate vào runbook.
10. **Full G7 sign-off**: second-person chạy env-check + boot-checks + grep dev-seam + xác nhận clean-room
    từ zero → ký biên bản "G7 full PASS (M1 clean-room)". Cập nhật `docs/uat-checklist-go-live.md` G7 row.

## Todo list
- [ ] `.env.prod` VPS: session/DB secrets MỚI, GIỮ passphrase M0 (C3), no CHANGE_ME, no dev-seam
- [ ] LE cert thật + HTTPS-only redirect
- [ ] isolation-check + env-check PASS
- [ ] migrate + seed **throwaway DB** (C2), cmc_prod giữ TRỐNG, drop throwaway sau
- [ ] Stack healthy + boot-checks không FATAL (trên throwaway migrated)
- [ ] SSO smoke 302 + browser consent round-trip
- [ ] [H6] Email Brevo verify 1 send thật trên VPS
- [ ] Azure MFA cho super_admin + deactivate procedure trong runbook (account đến từ P3 dump)
- [ ] Full G7 second-person sign-off + checklist cập nhật

## Success Criteria
- [ ] Toàn service `docker compose ps` = healthy/running trên VPS thật
- [ ] `curl -sf https://<domain>/health` OK; HTTP→HTTPS redirect; cert LE valid
- [ ] Boot-checks: cmc_app non-superuser, FORCE-RLS mọi bảng, STAFF≠LMS, STAFF_EMAIL_DOMAIN — pass
- [ ] SSO smoke 302 với redirect_uri = domain thật + state; browser tới consent OK
- [ ] [H6] Email Brevo 1 send thật thành công trên VPS (key hoạt động)
- [ ] `cmc_prod` giữ TRỐNG (không seed ở P2 — C2); throwaway smoke DB đã drop
- [ ] passphrase M0 giữ nguyên (C3 — không rotate ở P2); Azure MFA cho super_admin bật
- [ ] Full G7 sign-off ký (không phải G7-light); checklist G7 = PASS

## Risk Assessment
| Rủi ro | L×I | Mitigation |
|---|---|---|
| Copy `.env.prod` local-sim mù → secret cũ/e2e vào prod | Med×High | Bước 1 sinh MỚI toàn bộ; assert 2 session secret khác nhau |
| migrate fail resolve `postgres` từ host (runbook:49) | High×Med | Bước 6 throwaway container attach net; không expose DB port |
| LMS bundle bake `localhost:3000` (bug local-sim) | Low×High | Fix đã land; bước 5 verify bundle không còn chuỗi đó |
| Domain/redirect mismatch → AADSTS50011 | Med×High | P1 bước 8 đồng bộ Azure; SSO smoke bắt trước UAT |
| nginx stale-upstream 502 sau redeploy | Low×Med | resolver fix đã land (phase-02 golive:99); verify restart api tự phục hồi |

## Security Considerations
- Secrets rotate (session/DB) — leak local-sim không kế thừa VPS. **Passphrase M0 GIỮ nguyên (C3)** để
  giải mã dump cutover; rotate + re-escrow (giữ cả cũ+mới) chuyển P5 sau cutover verified.
- `ALLOW_DEV_AUTH`/`TEST_OTP_SEAM` vắng (boot-check + env-check fail-closed) — G8/G9.
- super_admin bypass toàn registry (F-S6, index.ts:186, không revocation) → MFA + deactivate procedure +
  không dùng account thường ngày.
- DB không expose port; TLS thật HTTPS-only; nginx strip `x-dev-user`/`x-dev-lms-user` (verify header-strip probe).

## Next steps
Stack VPS healthy (throwaway smoke pass) + `cmc_prod` trống → Phase 3 cutover: restore dump (mang
super_admin + data thật) vào `cmc_prod`. Đảm bảo P4 đã land trước P3 dump (M4).
