---
phase: 3
title: "Close-Integrations"
status: pending
priority: P1
dependencies: [2]
---

# Phase 3: Close-Integrations

## Overview
Đóng các integration còn STUB để "done code" thành "done thật": LLM real fetch (router.clawcmc),
email transport (Brevo thật / Graph quyết định), S3 put/get bucket thật, và đóng
`TODO(RT-3-ownership)` blobRef. Mỗi integration có test hợp đồng + 1 verify round-trip thật.

## Requirements
- Functional: LLM gọi API thật trả text; email gửi thật qua transport đã chọn; S3 put→get khớp bytes; blobRef ownership được verify trước khi trả PDF.
- Non-functional: che PII trước mọi call LLM (assertNoPii giữ nguyên); không log payload/secret; giữ AI draft-only.

## Auth audit (2026-07-07) — khuyến nghị Entra SSO, KHÔNG better-auth
- Docs/18 chốt: Microsoft Entra SSO qua `@azure/msal-node` (msal 2.16). `.env` đã có
  `ENTRA_CLIENT_ID/TENANT_ID/CLIENT_SECRET`, `ERP_SSO_REDIRECT_URI`, `SSO_ENABLED`.
- Hiện trạng: `apps/admin/src/pages/login.tsx` chỉ có dev-login (localStorage, DEV) + nút "Entra sắp có" disabled; **msal chưa cài** ở package nào; `context.ts` SSO = TODO.
- **Khuyến nghị: Entra SSO** — khớp docs + creds sẵn có + DÙNG CHUNG Entra app registration với Graph email (email=cả-hai). better-auth bị loại: đảo docs/18, bỏ phí ENTRA creds, tạo hệ auth trùng lặp (vi phạm DRY + không đảo quyết định đã ghi khi không có bằng chứng mới). *(chờ user xác nhận trước khi code auth)*
- Việc Entra SSO: BE — msal-node confidential client + `/auth/login` (redirect) + `/auth/callback` (đổi code→token, validate, map Entra user→AppUser+roles+facility, phát app-session); wire `context.ts` đọc session thật. FE — nối nút Microsoft ở login.tsx tới `/auth/login`. Gate: chỉ code sau khi user xác nhận hướng.

## Email decision (user 2026-07-07): CẢ HAI
- **Brevo** (transactional): email PH/HS (OTP, thông báo). BrevoEmailTransport đã hoàn chỉnh.
- **Graph** (nội bộ): HR/payroll/notify — `.env` có `GRAPH_SENDER_HR/NOTIFY/PAYROLL`. Cần implement GraphEmailTransport (client-credentials → /sendMail) dùng chung Entra app với SSO; map ENTRA_*→GRAPH_TENANT_ID/CLIENT_ID + chọn sender theo loại email.
- Router chọn transport theo `EmailOutbox.transport` ('brevo'|'graph') — schema đã có cột này.

## Architecture
- **LLM** (`packages/llm/src/index.ts`): real path hiện là TODO trả chuỗi cố định. Thay bằng fetch tới `LLM_BASE_URL` (`/chat/completions` OpenAI-compatible), header `Authorization: Bearer LLM_API_KEY`, body model=`LLM_MODEL` (ag/gemini-3.5-flash-low). Giữ `assertNoPii(prompt)` TRƯỚC fetch. Stub vẫn dùng khi thiếu key (offline test).
- **Email**: `BrevoEmailTransport` đã hoàn chỉnh (POST api.brevo.com). `GraphEmailTransport.send` THROW "not implemented". → Chọn transport theo quyết định P2: nếu Brevo → wiring worker chọn Brevo; nếu Graph → implement client-credentials flow (token → /sendMail) + env GRAPH_*.
- **S3** (`packages/storage/src/s3-blob-storage.ts`): impl đã đủ (put/get/delete). Cần wiring factory chọn S3BlobStorage khi `S3_*` có mặt (thay Console/local-disk); verify bucket private.
- **RT-3** (`apps/api/src/exercise/upload-route.ts` `TODO(RT-3-ownership)`): verify blobRef thuộc về submission/exercise mà caller có quyền trước khi GET/serve.

## Related Code Files
- Modify: `packages/llm/src/index.ts` (real fetch), `apps/api/src/worker/index.ts` hoặc factory (chọn email transport), storage factory (chọn S3), `apps/api/src/exercise/upload-route.ts` (RT-3 ownership check).
- Create: `packages/llm/src/*.test.ts` (contract test real path, mock fetch), tests cho storage factory + ownership guard.
- Đọc: `apps/api/src/worker/relay-email-outbox.*`, `packages/storage/src/blob-storage.ts` + factory hiện tại.

## Implementation Steps
1. LLM: mở rộng env contract `LLM_BASE_URL`/`LLM_MODEL` (P2 đã thêm biến); implement fetch OpenAI-compatible; assertNoPii giữ trước fetch; test mock fetch (200 → text; non-2xx → throw; PII → throw trước network).
2. LLM verify: 1 draft round-trip thật tới router.clawcmc (prompt không PII) → nhận text. Ghi kết quả (không log prompt PII).
3. Email: theo quyết định P2 — (a) Brevo: đảm bảo worker chọn BrevoEmailTransport khi BREVO_API_KEY có; gửi 1 email test thật. (b) Graph: implement token+sendMail, hoặc để off + document.
4. S3: factory chọn S3BlobStorage khi S3_* đủ; test put→get→delete round-trip trên bucket thật; xác nhận bucket private (không public ACL).
5. RT-3: **[RT-E] trước tiên investigate schema** — xác minh có liên kết blobRef→submission/exercise (FK hoặc cột tham chiếu) để biết "owner" là ai; nếu chưa có liên kết → bổ sung trước. Rồi thêm ownership check trong upload-route trước khi serve blobRef (caller phải sở hữu/được phép submission liên quan, dựa RLS/`can()`); test âm tính (blobRef của người khác → FORBIDDEN).
6. Chạy typecheck+unit+e2e; mở rộng coverage cho path mới.

## Success Criteria
- [ ] LLM: real fetch tới router.clawcmc verify 1 round-trip; test mock (ok/throw/PII-guard) xanh; stub vẫn hoạt động offline.
- [ ] Email: transport đã chọn gửi thật 1 email (hoặc Graph off + document rõ); không log payload.
- [ ] S3: put→get→delete round-trip bucket thật khớp bytes; bucket private.
- [ ] RT-3: ownership check chặn blobRef trái quyền (test âm tính xanh); `TODO(RT-3-ownership)` gỡ.
- [ ] typecheck+unit+e2e xanh.

## Risk Assessment
- PII rò ra LLM ngoài: assertNoPii PHẢI chạy trước fetch (không đảo thứ tự); test PII-guard bắt buộc.
- Router API shape khác OpenAI: verify round-trip (step 2) bắt lệch sớm; nếu khác → điều chỉnh body/parse, không giả định.
- Graph OAuth phức tạp: nếu vượt 1 lượt/không có tenant thật → chọn Brevo, để Graph off (stop-condition tránh sa lầy).
- S3 creds/bucket thiếu: stop-condition, báo user.
- RT-3: xác định đúng "owner" (student sở hữu submission vs teacher chấm) — dựa RLS/can(), không tự chế quyền mới.
