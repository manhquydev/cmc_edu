---
phase: 2
title: "PD-1 — Tích hợp thật (SSO/email/storage/LLM)"
status: pending
priority: P1
dependencies: [1]
effort: "4-6 ngày"
---

# Phase 2: PD-1 — Tích hợp thật (SSO/email/storage/LLM)

## Overview
Thay 4 stub bằng tích hợp thật + **đóng session infra thật cho CẢ staff (Entra) VÀ LMS (parent/student)** — không được scope-out LMS auth (RT-1). Mọi creds qua env — không vào repo. **Review gate: adversarial bắt buộc cho SSO/auth (staff + LMS)**; reviewer 1 vòng cho email/storage/LLM.

## Requirements
- Functional: staff login qua Entra SSO thật (session ký + expiry); **LMS session thật (token ký + hạn dùng, middleware decode server-side) cho parent/student — thay token base64 chưa ký hiện tại (RT-1)**; email OTP phụ huynh gửi thật (Brevo) + email nội bộ (Graph); `@cmc/storage` impl S3/MinIO thật; `@cmc/llm` cắm key thật (draft-only, có guard PII tại boundary).
- Non-functional: dev-header GIỮ LẠI sau env-gate cho e2e nhưng **fail-closed ở prod** (RT-2); fail-closed khi thiếu config; không log secrets/PII.

> **[RT-1] LMS auth KHÔNG được "giữ nguyên".** Token LMS hiện tại = `base64url(JSON{parentAccountId,kind})` KHÔNG ký, không hạn dùng (`apps/api/src/lms-auth/router.ts:89-110`); chỉ dev-header `x-dev-lms-user` populate `ctx.lmsSubject` (`apps/api/src/context.ts:80-115`); `lmsProcedure`/parent/student gate tin `ctx.lmsSubject` mù (`apps/api/src/trpc.ts:112-185`); frontend LMS gửi token qua `x-dev-lms-user` (`apps/lms/src/lib/trpc.ts:66-74`). Ở prod (dev-header tắt): LMS chết HOẶC nếu bật dev-auth thì ai cũng giả được `x-dev-lms-user` đọc dữ liệu con bất kỳ (T12). Phase này PHẢI thêm: token LMS ký (HMAC/JWT) + expiry + middleware decode → `ctx.lmsSubject`; frontend LMS đổi `x-dev-lms-user` → bearer token.
>
> **[RT-2 / V2] Backdoor `ALLOW_DEV_AUTH=1` ở prod — GỠ HẲN.** Gate thật là `NODE_ENV !== 'production' || ALLOW_DEV_AUTH === '1'` (`apps/api/src/context.ts:42-43`) — env var bật lại impersonation `x-dev-user`/`x-dev-lms-user` NGAY CẢ khi `NODE_ENV=production`. **Quyết định (V2): XÓA HẲN vế `|| ALLOW_DEV_AUTH==='1'`** sau khi Entra + LMS session hoạt động — không giữ hatch. Hệ quả: dev-header chỉ còn sống khi `NODE_ENV!=='production'`; e2e prod-config phải dùng session-injection (xem Phase 5, V3), KHÔNG dùng dev-header. Boot-check vẫn giữ assert phòng thủ (refuse nếu vì lý do gì hatch còn + prod). nginx strip `x-dev-*` tại proxy.

## Architecture
- **SSO staff:** `@azure/msal-node` (TL18) — auth-code flow trên api server; sau verify → **map Entra identity (oid/email) → AppUser DB → roles** (RT-11: roles LẤY TỪ AppUser, KHÔNG từ token claim); phát session token ký (HMAC/JWT) + expiry; middleware trong `apps/api/src/context.ts`/`trpc.ts` đọc session thay dev-header. Entra user không có AppUser active → 401, KHÔNG default role.
- **LMS session (RT-1):** thêm token ký + expiry + middleware decode → `ctx.lmsSubject` trong `apps/api/src/context.ts`; frontend `apps/lms/` đổi từ `x-dev-lms-user` sang bearer.
- **Email:** giữ outbox pattern nhưng **contract relay ĐỔI để route theo người nhận** (RT-6): `EmailTransport.send` / call-site đọc `EmailOutbox.transport` (`packages/db/prisma/schema.prisma:885`) chọn Brevo (PH) vs Graph (nội bộ). `apps/api/src/worker/index.ts:29` hiện gọi `relayEmailOutbox(db)` KHÔNG truyền transport → prod dùng `ConsoleEmailTransport` (log cả OTP, luôn mark `sent`) — PHẢI sửa. Thêm cột `attempts`+`lastError` (migration hand-written, `packages/db/prisma/`) cho retry-count + max-attempts→`dead`+backoff (RT-6). Reap row kẹt `sending` quá timeout về `pending` (RT-8).
- **Storage:** `packages/storage/src/blob-storage.ts` là interface; thêm `s3-blob-storage.ts` (S3-compatible, dùng cả MinIO) cạnh `local-disk-blob-storage.ts`; chọn impl theo env; **memoize instance ở module-level trong `createBlobStorage()`** (RT-15: hiện gọi mới mỗi request tại `upload-route.ts:64,85` → S3 client/request = socket churn; mirror pattern Prisma singleton `context.ts:48-56`). **Bucket PRIVATE + presigned URL ngắn hạn hoặc proxy có auth** — không public-read ACL (RT bucket-auth).
- **Serve ảnh trẻ (RT-3):** `apps/api/src/exercise/upload-route.ts:68-99` `handleSessionPhotoGet` hiện KHÔNG auth ("consent gate enforced by frontend" — không phải trust boundary). Phase này thêm: GET ảnh phải qua LMS-session + check consent/facility server-side, hoặc presigned URL ngắn hạn khi lên S3.
- **LLM (V4 — bật ngay go-live):** `packages/llm/src/index.ts` cắm provider thật với key thật; **guard PII TẠI boundary `@cmc/llm`** (RT-10: hiện chỉ comment "callers responsible" `llm/src/index.ts:8-9`, mask ad-hoc 1 chỗ `assessment/router.ts:185`) — reject/scrub prompt chứa pattern tên/SĐT trước khi gửi vendor (TL08 §7). AI nhận xét draft-only; UAT phải cover luồng này (Phase 5). Vì bật go-live nên guard PII là gate cứng, không defer.

## Related Code Files
- Modify: `apps/api/src/context.ts` (SSO staff + LMS session decode + role-from-AppUser), `apps/api/src/trpc.ts`, `apps/api/src/session/router.ts` (session.me role mapping), `apps/api/src/lms-auth/router.ts` (token ký thay base64), `apps/api/src/worker/email-transport.ts`, `apps/api/src/worker/relay-email-outbox.ts` (đọc `row.transport` + attempts + reap `sending`), `apps/api/src/worker/index.ts` (truyền transport thật, refuse `ConsoleEmailTransport` ở prod), `apps/api/src/exercise/upload-route.ts` (auth GET ảnh trẻ), `packages/storage/src/index.ts` (memoize), `packages/llm/src/index.ts` (guard PII boundary)
- Modify: `apps/lms/src/lib/trpc.ts` + `apps/lms/src/lib/lms-client.ts` (bearer thay `x-dev-lms-user`)
- Create: `apps/api/src/security/entra-sso.ts` (+ test), `packages/storage/src/s3-blob-storage.ts` (+ test), transport Brevo/Graph (+ test), migration `packages/db/prisma/` (cột `attempts`+`lastError` trên `EmailOutbox`)
- Modify: `apps/api/src/boot-checks.ts` (fail-closed khi prod thiếu config SSO/storage/email; refuse `NODE_ENV=production && ALLOW_DEV_AUTH=1` — RT-2)

> **Cross-phase note (RT-5):** `apps/api/src/context.ts` được sửa ở CẢ Phase 2 (SSO+LMS session) và Phase 3 (trusted-proxy `resolveIp`). KHÔNG chạy song song 2 nhánh trên file này — Phase 3 trusted-proxy làm SAU khi PD-1 merge, hoặc gộp cùng nhánh.

## Tests first (TDD — viết TRƯỚC khi cắm SDK thật)
1. **SSO staff contract:** token hết hạn → 401 · token sửa chữ ký → 401 · thiếu session ở prod-mode → 401 · **dev-header bị từ chối ở prod-mode (hatch đã gỡ, V2)** · session hợp lệ → context có userId+roles đúng · **roles lấy từ AppUser DB, KHÔNG từ token claim; Entra identity không có AppUser active → 401 (không default role)** (RT-11). Boot-check phòng thủ: nếu code còn ref `ALLOW_DEV_AUTH` + prod → refuse start.
2. **LMS session contract (RT-1):** token base64 chưa ký → từ chối · token ký hợp lệ → `ctx.lmsSubject` đúng · token hết hạn/sửa → 401 · student mượn danh tính parent → chặn (giữ bất biến tách danh tính trẻ).
3. **Email transport (RT-6/8):** outbox `pending` → transport đúng người nhận (PH→Brevo, nội bộ→Graph, đọc `row.transport`) → `sent`; transport lỗi → `failed` + `attempts++`; đạt max-attempts → `dead` (không retry vô hạn); row `sending` quá timeout → reap về `pending`; **prod worker refuse `ConsoleEmailTransport`**; KHÔNG log nội dung OTP.
4. **Storage (RT-3/15):** contract test chung local-disk + S3 (put/get/delete, mime, ≤10MB); **negative: fetch object KHÔNG auth/không đúng facility → denied**; GET ảnh trẻ không LMS-session → 401; `createBlobStorage()` gọi 2 lần trả cùng instance (memoize). Chạy S3 test với MinIO container hoặc skip-nếu-thiếu-env có đánh dấu.
5. **LLM (RT-10):** thiếu key → stub; có key → gọi provider (mock); **prompt chứa pattern tên/SĐT → guard boundary reject/scrub trước khi gửi** (test tại `@cmc/llm`, không chỉ tại caller).
6. Sau đó mới implement từng tích hợp cho test xanh. Mock ở tầng HTTP/SDK, không mock logic domain.

## Implementation Steps
1. Branch `feat/pd1-real-integrations`; harness intake + 4 story (mỗi tích hợp 1 story, verify = test path).
2. Viết test contract (mục Tests first) — đỏ.
3. Implement theo thứ tự rủi ro tăng dần: storage → email → LLM → SSO (SSO cuối để adversarial review tập trung).
4. Boot-checks: prod thiếu env bắt buộc → refuse start.
5. Gates xanh → adversarial review (auth) + reviewer (còn lại) → cap 2 vòng fix → PR → merge → changelog.

## Success Criteria
- [ ] Login staff bằng tài khoản Entra thật; roles đến từ AppUser; user không có AppUser → 401 (RT-11)
- [ ] **LMS parent/student login qua token ký thật, không còn `x-dev-lms-user` ở frontend prod (RT-1)**
- [ ] **Boot refuse start khi `NODE_ENV=production && ALLOW_DEV_AUTH=1`; nginx strip `x-dev-*` (RT-2)**
- [ ] OTP phụ huynh nhận qua email thật, route đúng Brevo/Graph; row lỗi có `attempts`/`dead`, không retry vô hạn (RT-6)
- [ ] **GET ảnh trẻ yêu cầu LMS-session + consent check; fetch object không auth → denied (RT-3)**
- [ ] PDF/ảnh qua MinIO/S3 private bucket + presigned/proxy; local-disk vẫn pass cùng contract test; storage instance memoized (RT-15)
- [ ] Guard PII tại boundary `@cmc/llm` reject prompt chứa tên/SĐT (RT-10)
- [ ] Không secret nào trong repo (git grep + hook pre-commit pass)

## Risk Assessment
- SSO + LMS session chạm mọi auth path → adversarial bắt buộc; giữ dev-header env-gated + fail-closed prod làm đường lùi cho e2e; rollback = revert PR.
- Đổi contract relay email + migration `EmailOutbox` → tuân stop-condition migration; chạy trên DB test trước, hand-written migration.
- Brevo/Graph rate-limit hoặc sandbox → verify bằng 1 email thật, còn lại mock; max-attempts chống đốt quota.
- MinIO self-host vs S3 API drift → dùng S3-compatible client chuẩn, test cả 2 qua contract test.
