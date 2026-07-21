---
phase: 1
title: "Otp-Email-Delivery"
status: completed
priority: P1
dependencies: []
---

# Phase 1: Otp-Email-Delivery

## Overview
Wire `lmsAuth.requestOtpEmail` vào đường email thật đã có sẵn (EmailOutbox → relay worker → Brevo)
để PH nhận được mã OTP ở production. Hiện procedure chỉ tạo `LoginOtp` (hash) rồi dừng — mã plaintext
chết trong memory, không ai gửi đi (`lms-auth/router.ts:282-329`, verify scout 260709-2350 §4.6).

## Requirements
- Functional: sau `requestOtpEmail` thành công, 1 dòng `EmailOutbox` được tạo (transport `brevo`,
  payload kind `otp`); relay worker render + gửi email chứa mã; PH đăng nhập được end-to-end không
  cần TEST_OTP_SEAM.
- Non-functional: OTP plaintext không tồn đọng DB sau gửi (scrub payload); không log OTP; latency
  gửi chấp nhận được so TTL 5 phút (poll mặc định 30s — ghi rõ khuyến nghị env).
- Scope: CHỈ `requestOtpEmail` (UI chỉ dùng email OTP — `login.tsx:44,54`). `requestOtp` (phone) giữ
  nguyên dormant, KHÔNG thêm SMS.

## Architecture

Tái dùng nguyên đường receipt-email, thêm 1 payload kind. **Cột recipient của `EmailOutbox` là `to`
(schema.prisma:904), KHÔNG phải `toEmail`** — dùng đúng field như receipt insert
(`relay-email-outbox.test.ts:47-53`, `relay-email-outbox.ts:136`):

```
requestOtpEmail (lms-auth/router.ts)
  └─ [MỚI] global enqueue cap: đếm EmailOutbox kind='otp' tạo trong 1h gần nhất; vượt ngưỡng
       (vd 200/h toàn hệ) → badRequest GENERIC_COOLDOWN_FAILURE (fail-closed, chống email-bomb)
  └─ [MỚI] lookup ParentAccount theo email (quyết định GỬI, không phải quyết định RESPONSE)
  └─ tạo LoginOtp {codeHash}                    (giữ nguyên — LUÔN tạo, bảo toàn no-leak response)
  └─ [MỚI] CHỈ khi ParentAccount tồn tại: db.emailOutbox.create({
       to: email, transport: 'brevo', status: 'pending',
       payload: { kind: 'otp', code, ttlMinutes: 5 }   // plaintext code — chỉ sống tới khi gửi
     })
  └─ return { ok: true }                         (ĐỒNG NHẤT dù account tồn tại hay không — no-leak)
worker/relay-email-outbox.ts (poll 30s)         (giữ nguyên claim/retry/dead-letter)
  └─ BrevoEmailTransport.send → renderOutboxEmail(payload)
       └─ [MỚI] nhánh isOtpPayload → subject "CMC EDU — Mã đăng nhập", body chứa code + TTL
  └─ [MỚI] scrub payload khi kind==='otp' ở CẢ 2 trạng thái terminal:
       'sent' (thành công) VÀ 'dead' (hết retry) → payload = { kind:'otp', scrubbed:true }.
       Row 'failed' (còn retry) GIỮ code (cần để gửi lại) — chấp nhận có kiểm soát.
  └─ [MỚI] sweep: quét row kind='otp' cũ hơn TTL (5') bất kể status → scrub (chặn code kẹt vĩnh viễn
       nếu worker chết giữa chừng); chạy cùng vòng poll.
```

Điểm thiết kế đã cân nhắc (đã qua red-team 2026-07-10):
- **Vì sao payload mang plaintext code:** `LoginOtp` chỉ lưu `codeHash` (đúng thiết kế verify);
  email phải chứa code thật → chỉ có thể mang qua payload tại thời điểm request. Trade-off: code
  plaintext nằm trong `EmailOutbox` tối đa tới lần poll kế (khuyến nghị 10s) HOẶC tới khi sweep quét
  (row failed/dead) — bù bằng scrub 2 trạng thái terminal + sweep theo TTL + single-use + TTL 5' +
  invalidate-on-new-request. **Acceptance "không tồn đọng" nghĩa là: không còn plaintext sau khi gửi
  xong HOẶC sau TTL — không phải zero-giây.**
- **No-leak ĐÚNG (sửa sai từ bản nháp):** phân biệt 2 quyết định. **Response** `{ok:true}` LUÔN đồng
  nhất (không lookup ảnh hưởng response) → không leak account tồn tại cho người gọi. **Quyết định GỬI
  email** thì ĐƯỢC phép lookup: chỉ gửi khi ParentAccount tồn tại. Không gửi cho email lạ KHÔNG leak gì
  cho người gọi (response vẫn ok) mà chặn được email-bomb tới địa chỉ bên thứ ba. (Bản nháp trước ghi
  "lookup trước = leak" là SAI — chỉ đúng cho response, không đúng cho send.)
- **Chống email-bomb / Brevo-drain (red-team High):** cooldown hiện tại per-email (bypass bằng đổi
  email); nginx `auth` 5r/m/IP vẫn cho ~7200 send/ngày/IP. Thêm **global cap kind='otp'/giờ** fail-closed
  + gate-send-theo-account ở trên. 2 lớp này chặn cả spam bên thứ ba lẫn cạn quota (self-DoS cổng LMS).
- **Transport brevo** (PH ngoài — nhất quán receipt); **scrub trong relay worker** (1 chỗ, transport
  không đụng DB).
- **Thứ tự land (chống gửi email rỗng):** template branch `isOtpPayload` PHẢI land CÙNG PR với outbox
  insert — nếu insert land trước, `renderOutboxEmail` rơi vào fallback "Thông báo" rỗng (email-templates.ts:57).

## Related Code Files
- Modify: `apps/api/src/lms-auth/router.ts` (requestOtpEmail — thêm outbox insert sau LoginOtp create)
- Modify: `apps/api/src/worker/email-templates.ts` (thêm `isOtpPayload` + template render, escape sẵn)
- Modify: `apps/api/src/worker/relay-email-outbox.ts` (scrub payload sau send thành công cho kind otp)
- Tests: `apps/api/src/lms-auth/login.test.ts` (mở rộng — outbox row được tạo, đúng shape, không chứa
  gì ngoài kind/code/ttl) · `apps/api/src/worker/email-templates.test.ts` nếu chưa có thì thêm case
  otp render (subject/body chứa code, HTML-escaped) · `apps/api/src/worker/relay-email-outbox.test.ts`
  (mở rộng — sau send, payload đã scrub, không còn field `code`)
- KHÔNG sửa: `requestOtp` (phone), `verifyOtpEmail`, schema Prisma.

## Implementation Steps
1. `email-templates.ts`: thêm `OtpPayload {kind:'otp', code, ttlMinutes}` + type-guard + nhánh render
   (tiếng Việt, escape code, ghi rõ "mã hết hạn sau 5 phút, không chia sẻ"). Unknown-shape fallback
   giữ nguyên.
2. `lms-auth/router.ts` `requestOtpEmail`: thêm global otp-enqueue cap (đếm 1h) fail-closed; lookup
   ParentAccount; LUÔN `loginOtp.create` (no-leak response); CHỈ khi account tồn tại thì
   `ctx.db.emailOutbox.create({ to: email, ... })`. **Ordering (red-team M1):** LoginOtp trước, outbox
   sau; KHÔNG bọc 1 transaction (nhất quán ADR0041 append-mindset), nhưng ghi rõ comment: outbox insert
   fail → request fail (PH bấm lại) — không strand mã verify-được-mà-không-gửi lâu dài vì TTL 5' dọn.
3. `relay-email-outbox.ts`: điểm đánh dấu `sent` thành công — nếu payload kind `otp`, update thêm
   `payload: {kind:'otp', scrubbed:true}` cùng statement.
4. Tests theo Related Code Files. Test seam `_testSeamCode` GIỮ NGUYÊN (e2e non-prod vẫn cần).
5. Verify sống trên stack local-sim: `docker compose -p cmcv2-prod` rebuild api+worker, dùng email
   thật của user test → nhận inbox → login. Ghi kết quả vào phase file.
6. Gates + code-review (auth-adjacent) + PR.

## Success Criteria
- [ ] Test: requestOtpEmail tạo đúng 1 outbox row payload `{kind:'otp', code, ttlMinutes}`.
- [ ] Test: render otp ra subject/body chứa code; code được HTML-escape.
- [ ] Test: sau relay send thành công, payload không còn `code` (scrubbed).
- [ ] Test âm tính: log worker không chứa code (transport đã không log payload — thêm assertion nếu rẻ).
- [ ] Live verify local-sim: inbox thật nhận mã, đăng nhập LMS OK, không bật TEST_OTP_SEAM.
- [ ] Gates xanh; e2e Mode-B xanh (không hồi quy — e2e vẫn dùng seam ở non-prod).

## Risk Assessment
- **OTP plaintext trong DB trước khi gửi** — chấp nhận có kiểm soát (scrub + TTL 5' + single-use);
  ghi rõ trong ADR note Phase 4.
- **Latency poll 30s** — với TTL 5' vẫn ổn; khuyến nghị đặt `WORKER_POLL_INTERVAL_MS=10000` trong
  `.env.prod` (ghi vào runbook, không hard-code).
- **Brevo quota/spam** — volume OTP thấp (cooldown 30s/email); nếu Brevo fail, retry/dead-letter đã có
  sẵn trong relay; PH bấm gửi lại sau cooldown.
- **Regression e2e** — seam không đổi; thêm outbox row trong flow e2e là side-effect mới, kiểm tra
  fixture cleanup (outbox rows của e2e nằm trong throwaway DB — không vấn đề).
