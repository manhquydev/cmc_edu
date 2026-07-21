---
title: "Log System Remediation — Hướng A+ (AuditLog T8 + docs sync + PII sweep + log rotation)"
description: "6 hạng mục vá rẻ đã được PO chốt sau audit hệ thống log: T8 agent-audit tại call site LLM duy nhất, quét chủ động field nhạy cảm, sửa 2 lỗi docs, chốt RBAC vào doc 14, Docker log rotation, backlog note MCP tool-audit."
status: completed
priority: P2
branch: "main"
tags: [audit-log, security, docs-sync, infra-config]
blockedBy: []
blocks: []
created: "2026-07-19T12:02:23.399Z"
createdBy: "ck:plan"
source: skill
---

# Log System Remediation — Hướng A+ (AuditLog T8 + docs sync + PII sweep + log rotation)

## Overview

Thực thi phạm vi Hướng A+ đã được PO phê duyệt trong brainstorm
`plans/reports/brainstorm-260719-1145-log-system-assessment-scope-a-plus-report.md`
(đầu vào: 4 scout song song + T8 verification, artifact
https://claude.ai/code/artifact/8e692cc2-fab4-4ac8-96cb-e6f910c94a89).

Bối cảnh: lõi AuditLog đúng/vượt thiết kế (REVOKE-immutability, middleware auto-audit,
retention 12mo). Còn lại 6 khoảng trống rẻ-để-vá, không dependency mới, không đụng
quyết định hoãn infra của PO (item Docker rotation chỉ sửa file config, không deploy).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [T8 Agent-Audit Patch](./phase-01-t8-agent-audit-patch.md) | Done |
| 2 | [Sensitive-Field Schema Sweep](./phase-02-sensitive-field-schema-sweep.md) | Done |
| 3 | [Docs Sync](./phase-03-docs-sync.md) | Done |
| 4 | [Docker Log Rotation + Verification](./phase-04-docker-log-rotation-verification.md) | Done |

Phase 1 và 2 độc lập nhau nhưng cùng chạm `audit-helpers.ts`/exclude-list → chạy tuần tự
(1 → 2) để tránh conflict. Phase 3, 4 độc lập hoàn toàn, có thể làm bất kỳ lúc nào sau 1-2.

## Dependencies

- Không blockedBy plan nào. Lưu ý mềm: `plans/260710-0228-m1-pilot-stability-real-vps`
  (pending) có thể chạm infra sau này — Phase 4 chỉ sửa `docker-compose.prod.yml`
  thêm `logging:` block, không xung đột nội dung hiện có; nếu plan VPS chạy sau,
  nó kế thừa config này.

## Acceptance Criteria (toàn plan)

- Mỗi lượt gọi LLM của `assessment.draftComment` tạo đúng 1 row egress
  `assessment.draftComment.llm` chứa `model`/`promptVersion`/`resultHash`/`resultLength`
  + khoá tương quan `assessmentId`+`outcome` ('created'/'failed') — KHÔNG raw
  prompt/result; tồn tại kể cả khi mutation fail sau LLM call; audit-write fail
  không phá draft; stub prod-guard throw tại call-time (không crash boot);
  `draft-confirm.test.ts` cũ + mới xanh, test resultHash assert theo giá trị.
- Báo cáo sweep (2-pass) liệt kê mọi field nhạy cảm + hành động; `sanitizeAuditData`
  đệ quy nested; FULL suite `@cmc/api` xanh.
- Docs sửa đúng khớp code: changelog đính chính RLS bằng danh sách enumerated từ
  migrations thật (không hardcode), system-architecture:189 bỏ "JSON logging", doc 14
  có audit.list=super_admin-only; HARNESS_BACKLOG có 2 item (MCP tool-audit +
  log-shipping trước go-live).
- `docker-compose.prod.yml` có log rotation cho MỌI service enumerated từ file thật
  (gồm minio profile-gated).
- `pnpm typecheck` toàn monorepo + `pnpm --filter @cmc/llm test` +
  `pnpm --filter @cmc/api test` xanh (filter đúng tên package `@cmc/api`);
  `gitnexus_detect_changes()` khớp scope khai báo từng phase.

## Red Team Review

### Session — 2026-07-19
**Reviewers:** Security Adversary, Assumption Destroyer, Failure Mode Analyst (3 parallel)
**Findings:** 15 sau dedup (15 accepted — 1 accept-modified, 0 rejected)
**Severity breakdown:** 1 Critical (hạ High sau đối chứng tiền lệ in-tx), 6 High, 8 Medium/Low
**Reports:** `reports/redteam-failure-260719-1907-*.md`, `reports/from-code-reviewer-to-planner-red-team-security-adversary-*.md`, `reports/redteam-assumptions-260719-1906-*.md`

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | In-tx audit write ngược contract best-effort middleware | Critical→High | Accept (redesign) | Phase 1 |
| 2 | LLM egress trước tx — authz fail = egress không audit | High | Accept (redesign) | Phase 1 |
| 3 | Manual write bỏ qua sanitizeAuditData | High | Accept (redesign) | Phase 1 |
| 4 | "PII-free by construction" sai (assertNoPii chỉ bắt phone); raw prompt vào bảng 12mo | High | Accept — bỏ field prompt | Phase 1 |
| 5 | Changelog fix "5 bảng" tạo lỗi mới (Contact/QualitativeAssessment có RLS) | High | Accept — enumerate từ migrations | Phase 3 |
| 6 | `pnpm --filter api` match 0 package (thật: `@cmc/api`) — gate chạy rỗng | High | Accept | Phase 1,2,4 + AC |
| 7 | Denylist đổi ảnh hưởng mọi mutation, chỉ test `-- audit` | High | Accept — full suite in-phase | Phase 2 |
| 8 | Không rollback notes | High | Accept | Phase 1,2 |
| 9 | sanitizeAuditData shallow — nested/array mù (shift.submit) | Medium | Accept — thêm đệ quy | Phase 2 |
| 10 | Service list phase 4 sai (minio có thật, socat không) | Medium | Accept | Phase 4 |
| 11 | TL13:114 "kết quả" không được audit | Medium | Accept-modified — resultHash+length, không raw content (minimization docs/08) | Phase 1 |
| 12 | PROMPT_VERSION không có cơ chế ép bump | Medium | Accept — hash-lock test | Phase 1 |
| 13 | Model audit có thể drift khỏi model gửi (2 điểm resolve) | Medium | Accept — resolve 1 lần trong factory | Phase 1 |
| 14 | Rotation 30MB anti-forensic; pre-session security events chỉ ở stdout | Medium | Accept — backlog log-shipping | Phase 3 |
| 15 | Sweep 1-pass sót schema đặt tên riêng/compose; premise resolveAuditActor sai; stub logs prompt; citation thiếu prefix | Low | Accept (gộp các vá nhỏ) | Phase 1,2,3 |

### Whole-Plan Consistency Sweep (R1)
Đã rà lại toàn bộ plan.md + 4 phase sau khi áp: exclude-list KHÔNG còn bị sửa ở bất kỳ
phase nào (thiết kế cũ đã gỡ sạch khỏi phase 1 — Related Code Files ghi rõ "KHÔNG sửa
trpc.ts"); mọi `--filter api` đã đổi thành `@cmc/api`; AC plan.md khớp thiết kế
egress-event; không còn tham chiếu "prompt trong audit data" ở file nào. 0 mâu thuẫn
tồn đọng.

### Session R2 — 2026-07-19 (vòng 2 theo yêu cầu PO)
**Reviewers:** cùng 3 lens, chỉ thị KHÔNG lặp finding R1 — săn lỗi do bản sửa R1 tạo ra
**Findings:** 8 sau dedup (8 accepted, 0 rejected) · **0 Critical, 3 High, 5 Medium/Low**
**Reports:** `reports/from-code-reviewer-to-planner-red-team-r2-{security-adversary,assumption-destroyer,failure-mode-analyst}-plan-review-report.md`

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| R2-1 | Prod-guard tại factory = crash toàn API lúc import (3/3 reviewer); citation email-transport sai chỗ; test-env NODE_ENV pollution | High | Accept — guard lazy trong stub draftAssessment() call-time; citation → relay-email-outbox.ts:34 + worker/index.ts:85-92 | Phase 1 |
| R2-2 | 2 row không có khoá tương quan (cả 2 entityId=studentId, không tham chiếu assessment.id) | High | Accept — audit trong finally quanh tx: assessmentId+outcome('created'/'failed') | Phase 1 |
| R2-3 | Phase 2 `hash` substring sẽ strip resultHash của Phase 1 (3/3 reviewer) | High | Accept — exact-match bắt buộc cho hash/salt/signature; reserved-safe fields; test 4a assert giá trị; negative test phase 2 | Phase 1, 2 |
| R2-4 | Rollback note sai về append-only — row đã ghi là vĩnh viễn (REVOKE) | Medium | Accept — rollback viết lại trung thực, verify payload trước merge | Phase 1 |
| R2-5 | Test 4c mock static import phá sibling tests | Medium | Accept — đường tự nhiên: seed class giáo viên khác → FORBIDDEN | Phase 1 |
| R2-6 | Changelog "số bảng đúng" mâu thuẫn "không viết lại lịch sử" (~35 bảng RLS hiện tại) | Medium | Accept — phạm vi đính chính giới hạn wave-1 migration | Phase 3 |
| R2-7 | Code sample thiếu cast Prisma.InputJsonValue → typecheck fail | Low | Accept | Phase 1 |
| R2-8 | Entity 'Student' vs 'assessment' tách 2 nhánh index — viewer cần assessmentId làm khoá tra | Low | Accept — ghi chú trong Risk phase 1; entity 'Student' đúng tiền lệ (minh oan) | Phase 1 |

Minh oan R2 (không thành finding): entity='Student' đúng tiền lệ manual sites; catch(err)
không leak PII (payload chỉ ID/hash); sanitizeAuditData semantics giữ; sha256 local
helper đúng DRY (không có shared util); 11 claim khác verified clean (2-row premise,
minio:145, Contact RLS:105, QualitativeAssessment RLS, typecheck scripts...).

### Whole-Plan Consistency Sweep (R2)
Sau khi áp 8 finding: phase 1 không còn chỗ nào throw tại factory (chỉ call-time);
mọi tham chiếu "ghi ngay sau khi LLM trả về" đã đổi thành finally-quanh-tx; phase 2
có ràng buộc exact-match khớp với reserved-fields phase 1 (2 chiều cross-reference);
phase 3 hết cụm "số bảng đúng" hiện tại; AC plan.md khớp payload mới
(assessmentId/outcome). 0 mâu thuẫn tồn đọng.

### Post-Implementation Code Review — 2026-07-19
**Reviewer:** code-reviewer subagent (independent pass after all 4 phases implemented +
tested green). **Findings:** 2 (1 Medium fixed in-session, 1 High backlogged).

| # | Finding | Severity | Disposition |
|---|---------|----------|-------------|
| 1 | Real-LLM HTTP failure (non-2xx / malformed body) throws AFTER the request was sent, but propagates past the router's audit-write block → 0 audit row for that egress. Plan's Risk Assessment blanket-claimed "any `draftAssessment` throw = no egress = no row needed," true for the PII/prod-guard cases but not for this one — new evidence not raised in R1/R2 red-team. | High | Backlogged (`docs/HARNESS_BACKLOG.md` — "T8 audit gap: LLM provider HTTP-failure-after-egress"); needs PO/lead call on outcome-value design, not a unilateral fix mid-review |
| 2 | `sanitizeValue`'s recursive object branch collapses a nested `Date` to `{}` (`Object.entries(new Date())` is `[]`). Dormant today (no current caller passes a `Date` through `sanitizeAuditData`) but a real trap for a future manual audit call site. | Medium | Fixed — `instanceof Date` guard added in `audit-helpers.ts`, regression test added; full `@cmc/api` suite re-verified green (898/898) |

Everything else (finally-block control flow under tx failure, `model`/`fetch`-body drift,
hash-lock value, all 4 doc citations, docker-compose diff cleanliness, no raw
prompt/result in the audit row) independently re-verified clean — see the reviewer's
full report for the verification method per item.

## Validation Log

### Session 1 — 2026-07-19
**Questions asked:** 3 (config 3-8; plan đơn giản sau red-team, chỉ còn 3 decision point thật)
**Verification pass:** skipped theo guard — Red Team Review đã chứa verification evidence, không còn `[UNVERIFIED]` tag.

| # | Decision point | PO chọn | Hệ quả |
|---|---------------|---------|--------|
| 1 | Ngữ nghĩa 2-row/lượt draft (egress .llm + middleware) | **2 row** | Giữ thiết kế red-team; viewer hiển thị 2 dòng/hành động — chấp nhận |
| 2 | TL13:114 "kết quả" | **resultHash + length** | Deviation có chủ ý khỏi câu chữ threat-model vì minimization docs/08 §7; ghi chú deviation khi cập nhật changelog (phase 4 bước 4d) |
| 3 | Stub LLM trong production | **Thêm guard** | Phase 1 mở rộng: guard cấm stub trong production. *(Vị trí guard sửa lại ở red-team R2-1: throw LAZY tại call-time trong stub draftAssessment(), KHÔNG tại createLLMClient — factory-throw sẽ crash toàn API lúc import)* |

### Whole-Plan Consistency Sweep
Sau propagate quyết định #3 vào phase 1: rà lại plan.md + 4 phase — không phát sinh
mâu thuẫn mới; quyết định #1/#2 vốn đã là thiết kế hiện hành của phase 1 (xác nhận,
không đổi nội dung). 0 mâu thuẫn tồn đọng. Failed: 0 → đủ điều kiện implement.

### Session 2 — 2026-07-19 (vòng 2 sau red-team R2, theo yêu cầu PO)
**Questions asked:** 2 (chỉ còn 2 decision point thật phát sinh từ thay đổi R2)
**Verification pass:** skipped theo guard — Red Team Review R1+R2 đã chứa verification evidence.

| # | Decision point | PO chọn | Hệ quả |
|---|---------------|---------|--------|
| 4 | Guard timing: lazy call-time vs fail-fast boot-checks (convention hiện có) | **Lazy call-time** | Giữ thiết kế R2-1; deviation khỏi convention boot-checks có chủ ý — LLM key là config tính năng phụ, không chặn deploy toàn hệ thống |
| 5 | Bề mặt lỗi khi guard bắn | **TRPCError rõ nghĩa** | Phase 1: draftComment map lỗi guard thành TRPCError PRECONDITION_FAILED thông điệp tiếng Việt, không để 500 generic |

### Whole-Plan Consistency Sweep (Validation 2)
Propagate quyết định #5 vào phase 1 (bước test thêm case error-mapping). Rà lại
plan.md + 4 phase: không mâu thuẫn mới; quyết định #4 xác nhận thiết kế hiện hành.
0 mâu thuẫn tồn đọng. Failed: 0 → plan đủ điều kiện implement.

## Quy tắc bắt buộc (project CLAUDE.md)

- Trước khi sửa symbol nào: `gitnexus_impact({target, direction: "upstream"})`,
  báo blast radius; dừng nếu HIGH/CRITICAL.
- Trước commit: `gitnexus_detect_changes()`.
- Sau plan: chạy red-team + validate loop đến 0 Critical/High (plan-pipeline mandate).
