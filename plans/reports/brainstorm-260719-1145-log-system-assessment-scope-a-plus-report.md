# Brainstorm Report — Đánh giá hệ thống log & chốt phạm vi Hướng A+

**Date:** 2026-07-19 · **Branch:** main · **Status:** Approved by PO (Hướng A+)
**Input:** 4 parallel scouts (docs-spec, backend-impl, frontend-wiring, tech-logging) + T8 verification pass + artifact https://claude.ai/code/artifact/8e692cc2-fab4-4ac8-96cb-e6f910c94a89

## Problem Statement

PO cần biết hệ thống log (AuditLog + technical logging) có đúng yêu cầu thiết kế không, tốt hơn hay tệ hơn, và hướng làm tiếp.

## Findings (facts, verified)

### AuditLog core — 8/10, tốt hơn thiết kế
- Immutability: `REVOKE UPDATE, DELETE ON "AuditLog" FROM "cmc_app"` (migration `20260706150000`), test `append-only-privilege.test.ts`. Không RLS trên AuditLog (đúng chủ ý TL10 §4 inv#3).
- Coverage: middleware tRPC tự động audit mọi mutation thành công (`apps/api/src/trpc.ts:148-176`), 24 path exclude tự log tay giàu hơn, test chống double-write. Vượt spec (spec chỉ nói "mọi hành động ghi/duyệt" chung chung).
- Retention 12mo qua privileged connection riêng (`audit-log-retention-sweep.ts`), chạy mỗi ~30s tick trong `drainOnce()` (`worker/index.ts:126-129`) — đúng nhưng lãng phí, tối ưu tùy chọn.
- Viewer: super_admin-only, wiring đầy đủ route→nav→page-gate→backend (`packages/auth/src/index.ts:77` empty-array + `can()` bypass).

### T8 (agent audit) — verified 2026-07-19, gap nhỏ hơn lo ngại
- MCP server = skeleton stub (`packages/mcp-server/src/tools.ts:1-10`, SDK chưa cài, `callTool` placeholder) → chưa có tool-calling agent thật.
- Reconciliation worker (`reconcile-finance-flags.ts:244-265`): rule-based thuần, không LLM; actor `ai:recon` có audit scanned/failed — đủ cho bản chất nó.
- **Call site LLM duy nhất:** `assessment.draftComment` (`apps/api/src/assessment/router.ts:181-223`). Có audit row middleware + `draftedBy:'ai'`; prompt PII-free có test. **Thiếu:** model, promptVersion, prompt-content trong audit data (TL13:80 + TL13:114 yêu cầu). SYSTEM_PROMPT hardcode không version.

### Gaps/lỗi khác
1. `project-changelog.md:568` SAI: liệt AuditLog vào "RLS on 6 tables" — migration `20260706054322:96-97` nói ngược lại ("never facility-scoped"), không có ENABLE RLS statement nào cho AuditLog.
2. `system-architecture.md:189` SAI: claim PrismaClient "JSON logging" — `packages/db/src/index.ts:26-29` không config `log:`.
3. RBAC super_admin-only cho `audit.list` chỉ tồn tại trong journal 260716, không có trong `docs/14-danh-muc-vai-tro-phan-quyen.md` — spec-drift risk.
4. PII denylist (`/password|otp|token|secret/i` + exact `code`, `audit-helpers.ts:73-81`) là blacklist vá reactive sau sự cố OTP thật (journal 260716:34-40); chưa từng quét chủ động toàn bộ input schema.
5. Technical logging: không structured logger/APM/log-shipping toàn repo; Docker json-file driver không rotation → nguy cơ đầy đĩa VPS; catch-block nuốt lỗi (`server.ts`, `session-evidence.tsx:83`).

## Approaches Evaluated

| Hướng | Nội dung | Verdict |
|---|---|---|
| A+ | Vá rẻ đúng trọng tâm (chi tiết dưới) | **CHỌN** — rủi ro thật có bằng chứng, 0 dep mới, ~1 phiên |
| B | A+ + pino structured logging api/worker | Hoãn — giá trị chỉ hiện khi live; đưa vào checklist go-live |
| C | Full observability (Sentry/Loki) | Loại — ngược quyết định PO hoãn infra, ngược YAGNI |

## Approved Scope — Hướng A+ (6 hạng mục)

1. **Vá T8 tại `assessment.draftComment`**: thêm `{model, promptVersion, prompt}` vào audit data (prompt đã PII-free by construction). Thêm hằng `PROMPT_VERSION` cạnh SYSTEM_PROMPT trong `@cmc/llm` hoặc expose từ client. 1 call site.
2. **Sửa `project-changelog.md:568`**: bỏ AuditLog khỏi danh sách RLS, ghi đúng REVOKE-only.
3. **Sửa `system-architecture.md:189`**: bỏ claim "JSON logging".
4. **Chốt RBAC vào `docs/14-danh-muc-vai-tro-phan-quyen.md`**: audit.list = super_admin-only, chủ ý.
5. **Quét chủ động input schema**: rà toàn bộ zod input của mutations tìm field nhạy cảm chưa match denylist (pin, cccd, answer, secret-adjacent names...); mở rộng denylist nếu tìm thấy.
6. **Docker log rotation**: thêm `logging:` block (json-file, max-size/max-file) vào `docker-compose.prod.yml` services.
+ **Backlog note**: khi walk-phase wire MCP thật, tool-call audit phải trong thiết kế từ đầu (ghi vào HARNESS_BACKLOG hoặc TL13).

## Risks
- Item 1 chạm audit middleware path của assessment — có test hiện hữu (`draft-confirm.test.ts` assert prompt log) cần giữ xanh.
- Item 6 là config prod — chỉ sửa file, không deploy (dự án chưa live).
- Item 5 có thể phát hiện field cần exclude-path mới → phạm vi nở nhẹ, xử lý trong plan.

## Success Criteria
- Audit row của draftComment chứa model + promptVersion + prompt; test cập nhật.
- 2 docs sửa đúng, khớp code; RBAC ghi vào doc 14.
- Báo cáo quét schema: danh sách field nhạy cảm tìm thấy + hành động.
- docker-compose.prod.yml có rotation cho mọi service.
- Toàn bộ test/typecheck xanh.

## Unresolved Questions
- PromptVersion đặt ở đâu chuẩn nhất: hằng trong `@cmc/llm` (theo SYSTEM_PROMPT) hay per-call-site? → quyết trong plan.
- Retention sweep 30s→daily có gộp vào đợt này không? (không bắt buộc, tối ưu nhỏ) → mặc định KHÔNG, giữ YAGNI.
