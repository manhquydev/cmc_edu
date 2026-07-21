---
phase: 1
title: "T8 Agent-Audit Patch"
status: completed
priority: P1
dependencies: []
effort: "0.5 day"
---

# Phase 1: T8 Agent-Audit Patch

<!-- red-team R1 2026-07-19: redesigned per FMA-1/FMA-2/SA-1/SA-2/SA-3/AD-2/AD-5 -->
<!-- red-team R2 2026-07-19: lazy prod-guard, try/finally + assessmentId/outcome correlation, cast, natural-path test, rollback permanence -->

## Overview

Vá khoảng trống T8 (threat-model `docs/30-threat-model-v2.md:23-31`, yêu cầu gốc
`docs/13-ai-agent-llm-integration.md:114` "Audit mọi lượt: prompt version, model, tool
gọi, kết quả, ai/agent" và `:80` "Ghi log điều gì được gửi") tại call site LLM duy nhất:
`assessment.draftComment`.

**Thiết kế sau 2 vòng red-team: 1 manual row/lượt LLM, ghi trong finally quanh tx,
tự tương quan bằng assessmentId+outcome.** Middleware row bình thường giữ nguyên
(2 row khi thành công, 2 ngữ nghĩa: egress-đã-xảy-ra vs mutation-thành-công).

## Requirements

- Functional: mỗi lượt gọi LLM tạo đúng 1 AuditLog row
  `action: 'assessment.draftComment.llm'` với data:
  `{studentId, classSessionId, model, promptVersion, resultHash, resultLength,
  assessmentId, outcome}` — trong đó `outcome: 'created'` + `assessmentId` khi tx
  thành công (khoá tương quan với bản ghi tạo ra — R2 FMA-2: 2 row không được phép
  bất khả ghép cặp), hoặc `outcome: 'failed'` + `assessmentId: null` khi mutation
  fail SAU khi LLM đã nhận dữ liệu. KHÔNG raw prompt (tái tạo từ studentId/period +
  promptVersion), KHÔNG raw result (minimization docs/08 §7 — hash+length đủ
  tamper-evident cho "kết quả" TL13:114, deviation đã được PO chốt validation #2).
- Non-functional: audit-write fail KHÔNG phá luồng draft (best-effort try/catch +
  console.error — mirror `apps/api/src/trpc.ts:165-170`); KHÔNG sửa
  AUDIT_EXCLUDED_PATHS; KHÔNG crash API khi thiếu LLM_API_KEY (R2: guard phải lazy).

## Architecture

1. **`packages/llm/src/index.ts`** — metadata + lazy prod-guard:
   - `export const PROMPT_VERSION = 'v1';` cạnh SYSTEM_PROMPT.
   - Interface: `readonly model: string; readonly promptVersion: string;`.
     Stub: `model: 'stub'`; real: model resolve MỘT LẦN trong factory — cùng biến đó
     dùng trong fetch body (chống drift audit-vs-sent, R1-13).
   - **Hash-lock test** (R1-12): test ghi sha256 của SYSTEM_PROMPT; đổi prompt mà
     không bump PROMPT_VERSION + hash → test đỏ.
   - **Prod-guard LAZY (R2 — cả 3 reviewer):** KHÔNG throw trong `createLLMClient`
     (nó chạy ở module-import `assessment/router.ts:31`, router mount vô điều kiện →
     throw tại factory = crash TOÀN BỘ API lúc boot). Thay vào đó: bên trong
     `draftAssessment()` của NHÁNH STUB, nếu `process.env.NODE_ENV === 'production'`
     → throw `LLM_STUB_PROD_FORBIDDEN` tại call-time. Chỉ degrade tính năng
     assessment; các test gán trực tiếp NODE_ENV='production' (sso-routes.test.ts,
     boot-checks.test.ts) không bị ảnh hưởng vì không gọi draftAssessment.
     Pattern tham chiếu ĐÚNG chỗ: `apps/api/src/worker/relay-email-outbox.ts:34` +
     `apps/api/src/worker/index.ts:85-92` (KHÔNG phải email-transport.ts — R2 sửa
     citation sai của R1). Test: NODE_ENV=production + stub → gọi draftAssessment
     throw; NODE_ENV khác → stub hoạt động bình thường.
   - <!-- Updated: Validation Session 2 - PO chốt error UX -->
     **Error mapping tại call site (validation #5):** trong `draftComment`, bắt lỗi
     `LLM_STUB_PROD_FORBIDDEN` từ draftAssessment và map thành `TRPCError` code
     `PRECONDITION_FAILED` thông điệp tiếng Việt ("Tính năng AI chưa được cấu hình —
     liên hệ quản trị viên") — giáo viên không gặp 500 generic. Lỗi này throw TRƯỚC
     khi có egress → đúng ngữ nghĩa không có row audit (không gì được gửi đi).
     Test bổ sung ở bước 4: guard bắn → TRPCError đúng code, 0 row `.llm`.
   - Ngôn ngữ chính xác (R1-15): stub log full prompt ra console (`index.ts:52`) là
     hành vi hiện hữu dev/CI, GIỮ NGUYÊN; real path chỉ log length.

2. **`apps/api/src/assessment/router.ts` (`draftComment`)** — audit trong finally:
   ```ts
   const draftContent = await llmClient.draftAssessment(prompt);

   // LLM đã nhận dữ liệu — row egress PHẢI tồn tại dù tx dưới thành/bại (T8).
   // Ghi trong finally: thành công mang assessmentId (khoá tương quan), thất bại
   // mang outcome:'failed'. Best-effort — audit lỗi không phá draft (mirror
   // middleware trpc.ts:165-170). Row đã ghi là VĨNH VIỄN (REVOKE) — xem Rollback.
   let createdAssessment: AssessmentDto | undefined;
   try {
     createdAssessment = await withFacility(ctx.db, facilityId, async (tx) => {
       /* assertTeacherOwnsSessionClass + create — GIỮ NGUYÊN logic hiện tại */
     });
     return createdAssessment;
   } finally {
     try {
       await ctx.db.auditLog.create({
         data: {
           actor: ctx.subject.userId,
           action: 'assessment.draftComment.llm',
           entity: 'Student',            // tiền lệ manual sites: approved-children.ts:90
           entityId: input.studentId,
           data: sanitizeAuditData({
             studentId: input.studentId,
             classSessionId: input.classSessionId ?? null,
             model: llmClient.model,
             promptVersion: llmClient.promptVersion,
             resultHash: sha256hex(draftContent),
             resultLength: draftContent.length,
             assessmentId: createdAssessment?.id ?? null,
             outcome: createdAssessment ? 'created' : 'failed',
           }) as Prisma.InputJsonValue,   // cast như middleware trpc.ts:162 (R2)
         },
       });
     } catch (err) {
       console.error('draftComment llm-egress audit write failed', err);
     }
   }
   ```
   - `sha256hex`: local helper dùng `node:crypto` (đã xác minh không có shared
     hex-hash util nào trong repo — DRY check R2 pass).
   - `sanitizeAuditData` import từ audit-helpers — giữ denylist cho row thủ công.
   - Payload chỉ chứa ID/hash/số — err của Prisma không thể mang prompt/PII (R2
     security đã xác minh).

3. **Ràng buộc cross-phase (R2 — cả 3 reviewer):** các field
   `resultHash`/`resultLength`/`promptVersion`/`model` là **reserved-safe** đối với
   denylist. Phase 2 khi cân nhắc `hash`/`salt`/`signature` BẮT BUỘC dùng exact-match
   (như bài học `code`), KHÔNG regex substring. Test 4a dưới đây assert **giá trị**
   resultHash (không chỉ tồn tại) để nếu phase 2 vi phạm, full-suite gate đỏ ngay.

4. **Giới hạn PII trung thực (R1-4):** `assertNoPii` chỉ bắt pattern phone — không
   đảm bảo sạch tên/CCCD. Prompt hiện tại sạch vì xây từ ID thuần (router.ts:197-202,
   có test). Phase này không ghi prompt vào audit nên không nhân rủi ro đó.

## Related Code Files

- Modify: `packages/llm/src/index.ts` (PROMPT_VERSION, interface, lazy stub-guard)
- Modify: `packages/llm/src/index.test.ts` (metadata + hash-lock + stub-guard tests)
- Modify: `apps/api/src/assessment/router.ts` (finally-audit block + sha256 helper)
- Modify: `apps/api/src/assessment/draft-confirm.test.ts` (egress-row assertions)
- KHÔNG sửa: `apps/api/src/trpc.ts`, schema.prisma, middleware

## Implementation Steps

1. `gitnexus_impact({target: "createLLMClient", direction: "upstream"})` và cho
   `draftComment` — báo blast radius (kỳ vọng caller duy nhất: assessment/router.ts
   + tests; đã xác minh R2, xác nhận lại).
2. Sửa `packages/llm/src/index.ts` theo Architecture-1; test: metadata 2 nhánh,
   hash-lock, stub-guard call-time (production→throw, dev→ok).
3. Thêm finally-audit block theo Architecture-2 (đọc lại body draftComment hiện tại
   trước khi sửa — giữ nguyên toàn bộ logic tx).
4. Cập nhật `draft-confirm.test.ts`:
   a. Draft thành công → row `.llm` có đủ field, **assert resultHash === sha256 của
      content trả về** (giá trị, không chỉ tồn tại — chốt chặn cross-phase R2),
      `assessmentId` khớp id bản ghi tạo ra, `outcome:'created'`; VÀ row middleware
      `assessment.draftComment` tồn tại — đúng 2 row.
   b. `data` KHÔNG chứa key `prompt` hay raw content.
   c. Draft FAIL sau LLM — **đường tự nhiên, KHÔNG mock** (R2 AD-F4: mock static
      import phá sibling tests): seed classSession thuộc giáo viên KHÁC →
      assertTeacherOwnsSessionClass throw FORBIDDEN → row `.llm` VẪN tồn tại với
      `outcome:'failed'`, `assessmentId:null`; row middleware KHÔNG tồn tại.
   d. Audit-write fail (mock ctx.db.auditLog.create throw — feasible, R2 verified) →
      draft vẫn thành công.
   e. Test prompt-log stub hiện hữu vẫn xanh.
5. `pnpm --filter @cmc/llm test`, `pnpm --filter @cmc/api test -- assessment`,
   typecheck cả 2 (filter đúng tên `@cmc/api` — R1-6).

## Success Criteria

- [x] 1 row `.llm`/lượt LLM: thành công có assessmentId+outcome:'created', fail có
      outcome:'failed' — 2 trường hợp đều có test
- [x] Test 4a assert resultHash theo GIÁ TRỊ; không raw prompt/result ở bất kỳ row nào
- [x] Audit-write fail không phá draft; stub-guard chỉ throw tại call-time trong
      production, không crash boot, không phá test hiện hữu
- [x] Hash-lock + metadata 2 nhánh hoạt động; typecheck + tests xanh; blast radius
      không HIGH/CRITICAL bị bỏ qua (LOW, 1 direct caller — assessment/router.ts)

## Rollback

Code revert nguyên tử (1 commit riêng, additive, không migration). **NHƯNG (R2
FMA-4): row `.llm` đã ghi vào prod là VĨNH VIỄN** — AuditLog REVOKE UPDATE/DELETE
(`packages/db/prisma/migrations/20260706150000_p1_remediation_wavea_privilege_hardening/migration.sql:19`),
cleanup duy nhất là retention sweep 12 tháng. Vì vậy: verify payload shape bằng test
4a-4d TRƯỚC khi merge; nếu rollout hỏng phát hiện muộn, row sai shape nằm lại 12
tháng — chấp nhận được (không PII trong payload) nhưng phải biết trước.

## Risk Assessment

- **2 row/lượt thành công**: chủ ý (PO chốt validation #1); action string khác nhau
  → không vi phạm dedup test; ghép cặp qua `data.assessmentId` (R2 fix).
  Entity 'Student' (egress) vs 'assessment' (middleware) nằm khác nhánh index
  (entity, entityId) — viewer filter theo action vẫn dùng được; assessmentId trong
  data là khoá tra cứu chính, ghi chú này để auditor tương lai không bối rối.
- **Interface LLMClient mở rộng**: additive; caller duy nhất xác minh lại bước 1.
- **finally-audit khi LLM throw**: nếu chính `draftAssessment` throw (assertNoPii,
  HTTP fail, stub-guard) thì CHƯA có egress thành công → block finally không chạy
  (throw trước khi vào try) — đúng ngữ nghĩa: không có gì gửi đi thì không có row.
