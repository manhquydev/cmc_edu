---
phase: 2
title: "Entra-SSO"
status: completed
priority: P1
dependencies: [1]
---

# Phase 2: Entra-SSO

## Overview
Staff đăng nhập production qua Microsoft Entra (docs/18, msal-node): authorization-code flow →
lookup `AppUser` theo email → phát **HttpOnly signed cookie** (Q2) → `context.ts` đọc cookie thành
`subject` authoritative. Đóng RT-CRITICAL.

## Requirements
- Functional: `/auth/login` redirect Entra; `/auth/callback` đổi code→token, validate, map email→AppUser (isActive, cùng STAFF_EMAIL_DOMAIN), phát cookie ký (userId/roles/facilityId/iat/exp); `/auth/logout` xoá cookie; login.tsx nút Microsoft hoạt động; `session.me` trả roles thật từ DB.
- Non-functional: cookie HttpOnly + Secure(prod) + SameSite=Lax + maxAge ~8h; secret ký riêng (`STAFF_SESSION_SECRET`, không dùng chung LMS secret); dev-header vẫn hoạt động non-prod (e2e giữ nguyên); fail-closed: email không khớp AppUser/không active/sai domain → từ chối, không auto-provision.

## Architecture
- msal-node ConfidentialClientApplication (authorization-code + PKCE nếu msal hỗ trợ mặc định); `ENTRA_TENANT_ID/CLIENT_ID/CLIENT_SECRET`, redirect = `ERP_SSO_REDIRECT_URI`.
- Ký cookie: tách util HMAC chung từ `lms-auth/session-token.ts` (DRY) → `apps/api/src/auth/staff-session.ts` (sign/verify, claims staff). KHÔNG tái dùng LMS secret (tách miền ký).
- `context.ts`: thứ tự resolve subject = staff-cookie (mọi env) → dev-header (non-prod). `SSO_ENABLED=true` bật route; boot-check env (đã có) siết ENTRA_* khi bật.
- CSRF: mutations tRPC same-origin + SameSite=Lax + kiểm Origin header với CORS_ORIGINS (đã có middleware CORS) — đủ cho cookie flow; state param chống CSRF trên OAuth roundtrip (msal quản lý).
- `roles` đọc từ DB tại callback (snapshot vào cookie) — đổi role/deactivate có hiệu lực ở lần login sau, maxAge ~8h (RT-ε: chấp nhận, stateless; revocation store = YAGNI).
- **[RT-α] Facility switching:** `ctx.facilityId` resolve = header `x-facility-id` (nếu có) else cookie snapshot. Server validate header: non-super_admin PHẢI khớp `AppUser.facilityId` (mismatch → FORBIDDEN); super_admin được set facility bất kỳ tồn tại (giữ facility-switcher UI). `scoped()`/RLS không đổi.
- **[RT-β] Staff Mode-B cho e2e:** export util mint staff-cookie ký bằng `STAFF_SESSION_SECRET` (mirror `session-injection.ts` của LMS) để e2e chạy được trên stack production-config (dev-header tắt). Util sống ở apps/e2e/src (test-side), KHÔNG mở đường tắt trong api.

## Related Code Files
- Create: `apps/api/src/auth/staff-session.ts` (+ test), `apps/api/src/auth/sso-routes.ts` (+ test — mock msal/fetch).
- Modify: `apps/api/src/context.ts` (đọc cookie trước dev-header), `apps/api/src/server.ts` (mount /auth/*), `apps/api/src/boot-checks.ts` (STAFF_SESSION_SECRET required khi SSO_ENABLED, tương tự LMS secret check).
- Modify: `apps/admin/src/pages/login.tsx` (nút Microsoft → /auth/login; bỏ label "sắp có"), client fetch `credentials: 'include'` (đã có wrapper).
- Modify: `.env.example` + `scripts/env-check.sh` (thêm STAFF_SESSION_SECRET).
- Deps: thêm `@azure/msal-node` vào apps/api.

## Implementation Steps
1. `staff-session.ts`: sign/verify claims (HMAC-SHA256, constant-time compare, exp check) — mirror LMS token util, secret riêng. Unit tests (round-trip, expired, tampered, wrong-secret).
2. msal wiring: confidential client factory từ env; `/auth/login` (authCodeUrl + state) → redirect; `/auth/callback`: acquireTokenByCode → lấy email/upn → validate domain (STAFF_EMAIL_DOMAIN) → `AppUser.findUnique({email})` + isActive → set cookie → redirect ADMIN_APP_ORIGIN. Sai bất kỳ bước → redirect login?error=... (không lộ chi tiết).
3. `context.ts`: parse cookie → verify → subject {userId, roles} + facilityId từ AppUser (cookie mang facilityId snapshot). Dev-header fallback non-prod giữ nguyên. Unit tests context (cookie hợp lệ/expired/tampered/no-cookie).
4. `/auth/logout`: clear cookie. FE nút logout gọi.
5. FE login.tsx: enable nút Microsoft; giữ dev-login DEV-only.
6. Env: STAFF_SESSION_SECRET vào .env/.env.example/env-check/boot-check.
7. **Live verify** (creds thật): 1 vòng login từ browser → cookie set → `session.me` trả roles DB; sai domain/không AppUser → từ chối. Ghi kết quả vào report phase.
8. Gates: typecheck + unit + e2e (dev-header flows untouched) + adversarial review (auth).

## Success Criteria
- [ ] Login Microsoft end-to-end hoạt động với creds thật (live verify ghi nhận).
- [ ] Cookie: HttpOnly/Secure(prod)/SameSite=Lax; tampered/expired bị từ chối (tests).
- [ ] Email sai domain / không có AppUser / inactive → từ chối, không auto-provision (test âm tính).
- [ ] session.me trả roles snapshot-từ-DB (thời điểm login SSO); dev-header non-prod + toàn bộ e2e cũ xanh.
- [ ] [RT-α] Facility override: non-super_admin mismatch → FORBIDDEN (test âm tính); super_admin switch OK.
- [ ] [RT-β] e2e staff mode-B mint cookie hoạt động trên NODE_ENV=production config (spec probe).
- [ ] STAFF_SESSION_SECRET enforced (boot-check + env-check); không log token/secret.

## Risk Assessment
- Auth mới = adversarial review bắt buộc; mọi nhánh lỗi fail-closed.
- Đổi thứ tự resolve subject trong context.ts có thể ảnh hưởng test hiện có → cookie-path chỉ kích hoạt khi có cookie; không cookie = hành vi cũ nguyên vẹn.
- msal phiên bản/API thay đổi → dùng docs hiện hành (ck:docs-seeker) khi cook; không code theo trí nhớ.
- Stop-conditions: creds Entra sai/thiếu quyền app registration; cần thao tác Azure Portal (user làm, không phải agent).
