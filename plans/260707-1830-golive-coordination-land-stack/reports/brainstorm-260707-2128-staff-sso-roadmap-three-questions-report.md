# Brainstorm — Trả lời 3 câu hỏi SSO + lộ trình build tiếp theo (S1–S4)

- Date: 2026-07-07 21:28 ICT · Branch: main · Mode: plan-only (không implement)
- Kế thừa: plan `260707-1830-golive-coordination-land-stack` (P1/P2/P3 non-SSO đã xong, PR #16–#23 merged)

## Bối cảnh
P3 đã land: LLM real (live-verified), email Brevo+Graph, RT-3 photo authz, env contract + boot-check.
Hạng mục cuối = Entra SSO, bị chặn bởi 3 câu hỏi. Scout docs corpus cho thấy thiết kế đã quyết sẵn
phần lớn — chỉ có code chưa theo kịp.

## Bằng chứng scout
- docs/14 (RBAC nguồn sự thật): đúng 9 role cố định (ADR-D), không thêm role; "quản lý" = `managerId`,
  không phải role; docs tự nhận "bám thẳng `enum Role` trong schema.prisma".
- **Drift**: schema.prisma KHÔNG có `enum Role` — role chỉ ở TS (`@cmc/auth` ROLES). AppUser không có
  field roles.
- `session.me` ghi chú sẵn: identity thành authoritative "sau khi Entra SSO wired".
- docs/18 chốt: Entra SSO qua `@azure/msal-node` (msal 2.16) cho staff.
- `.env` đã có ENTRA_TENANT_ID/CLIENT_ID/CLIENT_SECRET + ERP_SSO_REDIRECT_URI + STAFF_EMAIL_DOMAIN.

## 3 câu hỏi — quyết định (user 2026-07-07 21:35)

| # | Câu hỏi | Quyết định | Căn cứ |
|---|---------|-----------|--------|
| Q1 | Mô hình lưu/gán role staff | **`enum Role` (9 giá trị) trong Prisma + `AppUser.roles Role[]`**; super_admin gán qua màn admin user sẵn có; multi-role cho kiêm nhiệm | docs/14 đã tuyên bố enum thuộc schema; AuthSubject.roles đã là array toàn codebase (KISS/DRY); bảng UserRole riêng = YAGNI; Azure app-roles = quản trị rời khỏi ERP |
| Q2 | Cơ chế staff-session | **HttpOnly signed cookie** (HMAC — tái dùng kỹ thuật ký LMS token; claims userId/roles/facilityId/iat/exp); context.ts đọc cookie → subject; dev-header giữ non-prod | SSO redirect flow đáp xuống server → cookie tự nhiên; chống XSS hơn bearer/localStorage |
| Q3 | Entra creds | **Đã có trong `.env`** (user cung cấp). Việc còn lại: khớp redirect URI với app registration + verify live 1 vòng login trong S2 | Key names xác nhận có mặt; không phải blocker thiết kế |

## Lộ trình build tiếp theo (S1–S4, đã duyệt)

| # | Phase | Nội dung | Phụ thuộc | Gate |
|---|-------|----------|-----------|------|
| S1 | Staff identity substrate | Migration `enum Role` + `AppUser.roles Role[]` (+GRANT/RLS giữ nguyên); seed super_admin; admin UI gán role; khớp AppUser.email làm khoá map Entra | — | adversarial (auth substrate) |
| S2 | Entra SSO flow | msal-node confidential client; `/auth/login` redirect + `/auth/callback` (code→token→validate→lookup AppUser theo email→cookie ký); context.ts đọc cookie; login.tsx nút Microsoft; logout; STAFF_EMAIL_DOMAIN restrict | S1 | adversarial (auth) + live verify creds thật |
| S3 | ENV cmcv2-prod (task #8) | Stack prod cô lập + S3 creds (hoặc local-disk) + env-check prod pass + backup/restore drill | song song S1/S2 | reviewer |
| S4 | UAT go/no-go (task #9) | e2e critical 2 lần xanh + email live send + UAT người-thật docs/29 + biên bản | S2+S3 | checklist docs/uat |

SSO xong → đóng RT-CRITICAL (staff production login) → staff go-live hết blocker.

## Rủi ro chính
- S1 đụng auth substrate: migration enum phải giữ nguyên RLS/GRANT hiện có; dev-header path không được hỏng (e2e dựa vào).
- S2: cookie cần HttpOnly+Secure+SameSite=Lax; CSRF cân nhắc (tRPC mutations — SameSite đủ cho same-origin, xác nhận CORS_ORIGINS).
- Entra: email khớp `AppUser.email` — cần backfill email cho staff trước khi bật SSO_ENABLED=true.
- docs/14 cần sync sau S1 (enum đã thật sự vào schema) — 1 dòng cập nhật.

## Unresolved
- S3: S3 creds thật (hoặc chốt local-disk cho UAT) — chờ user cấp.
- S4: VPS target + lịch UAT người-thật — chờ user.
