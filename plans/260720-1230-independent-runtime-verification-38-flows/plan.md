---
title: "Xác minh độc lập 38 flows: runtime verification + tool audit + ledger proven tier"
description: "PO nghi ngờ acceptance-report (38/38 built = static existence check). Xác minh độc lập bằng runtime e2e toàn bộ flows trên DB synthetic (signed-auth mode), audit chính tool acceptance, nâng Sổ Nghiệm Thu Sống lên 3 tier proven/built/missing với evidence committed."
status: completed
priority: P1
branch: "test/independent-runtime-verification-38-flows"
tags: [verification, e2e, acceptance-ledger, audit]
blockedBy: []
blocks: [260717-1213-so-nghiem-thu-song]
created: "2026-07-20T05:56:25.884Z"
createdBy: "ck:plan"
source: skill
---

# Xác minh độc lập 38 flows: runtime verification + tool audit + ledger proven tier

## Overview

**Vấn đề:** `acceptance-report/verification.json` (commit 0b3633d) báo 38/38 flows "built" — nhưng "built" chỉ là static existence check (symbol tồn tại), không chứng minh hành vi. Manifest hand-written từng bị nắn claim (commit 3aff5f3). Phase 4 evidence của plan 260717-1213 bị GATED, chưa từng chạy.

**Giải pháp (user đã chốt — Full C):**
1. **Mini-A audit** (Phase 1): mutation-test scanner + audit lịch sử manifest + spot-check 5 handler + reconcile số flow (manifest 40 codes vs 38) → trả lời "tool có nói dối không".
2. **Runtime proofs toàn bộ flows** (Phase 2–5): Playwright e2e **signed-auth mode (R2-1: server dev-env; specs CHỈ dùng signed cookie/token với secret throwaway — đúng đường auth prod dùng; cấm x-dev-user)** — mỗi flow = 1 `test()` riêng trong `describe.serial`, verdict `proven|failed|blocked` + evidence, `authPath` ghi per flow. Screenshot chụp trong chính functional UI specs.
3. **Ledger 3 tier** (Phase 6): specs khai `proveFlow('P1-03')` → reporter (array, atomic, precedence failed>blocked>proven) gộp thành `acceptance-report/runtime-evidence.json` **committed vào git** (diff-reviewable, director/CI thấy được; screenshots vẫn local-only) → `verify.ts` xác thực spec-refs + hiển thị `proven ✓ (kèm tuổi commit) / built ◐ / missing ✗ / runtime-fail`.

**Nguyên tắc verdict trung thực (áp toàn plan):**
- Bug business tìm thấy → verdict `failed` + ghi report. KHÔNG fix production logic trong plan này (fix = plan riêng).
- Chỉ được fix tầng test-harness/stub (vd OTP seam) để unblock verification.
- Flow không dựng được điều kiện chạy → `blocked` kèm lý do; precondition vỡ trong chuỗi serial → downstream `blocked`, không phải `failed`.
- Chỉ evidence `authPath:"signed"` mới cấp `proven`; dev-header `x-dev-user` bị CẤM trong specs (guard grep = 0). Signed-auth mode chạy server dev-env nên TEST_OTP_SEAM và LLM stub hoạt động native — KHÔNG sửa production code ở bất kỳ package nào (V2 seam bị supersede bởi R2-1: TEST_OTP_SEAM hoá ra dev-gated + boot-denylist, tiền lệ ngược). Residual gap (nhánh if-prod ngoài auth) ghi trung thực trong report + legend.
- Negative-authz bắt buộc cho mọi flow có privileged mutation (approve/finalize/cancel/override/refund/updateRoles) ở mọi cluster — không blanket, không bỏ sót money-gates.

**Nguồn:** brainstorm report `plans/reports/brainstorm-260720-1230-independent-runtime-verification-38-flows-report.md`.

## Hạ tầng tái dùng (đã xác minh tồn tại)

- `apps/e2e`: Playwright 2 project — `api` (globalSetup tự spawn API server thật qua tsx, bootstrap Facility riêng) + `ui-chromium` (PLAYWRIGHT_UI=1, preview 4173/4174, same-origin proxy). 11 specs sẵn có. **Lưu ý:** teardown `cleanupFacility` là allowlist đóng (`apps/e2e/src/db.ts:121-181`) — Phase 1 PHẢI mở rộng trước khi Phase 2–5 chạy.
- Guard `assertNotProdDatabase` fail-closed nhưng tự nhận là name-check chưa đủ (`assert-not-prod.ts:6-10`) — UI screenshot run cần thêm gate sentinel synthetic facility (fail-closed).
- `scripts/synthetic-seed-env.sh` (cần `SYNTH_SEED_ALLOW=1`, chỉ IN env — chạy cùng phiên Git Bash), `scripts/seed-super-admin.ts`, local-sim postgres (docker qua Git Bash, không WSL2).
- Helpers: `mintStaffCookie` (`session-injection.ts:141`); `createStaffClient`/`createSignedStaffClient` (`trpc-client.ts:26,59`); OTP test seam (`TEST_OTP_SEAM=1`, lms-auth.spec.ts).
- Sweep entrypoints thật cho P3-10/11: `runDoneSweep`/`runCancelSweep` (worker/session-done-sweep.ts:35,70) — global scan, gọi in-process, assert per-ID.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Tool Audit + Env Baseline](./phase-01-tool-audit-env-baseline.md) | Completed |
| 2 | [P1 Finance-Auth Runtime Proofs](./phase-02-p1-finance-auth-runtime-proofs.md) | Completed |
| 3 | [P2 Learning Runtime Proofs](./phase-03-p2-learning-runtime-proofs.md) | Completed |
| 4 | [P3 HR-Payroll-KPI Runtime Proofs](./phase-04-p3-hr-payroll-kpi-runtime-proofs.md) | Completed |
| 5 | [P4-ADMIN Runtime Proofs](./phase-05-p4-admin-runtime-proofs.md) | Completed |
| 6 | [Ledger Proven Tier + Final Report](./phase-06-ledger-proven-tier-final-report.md) | Completed |

Dependencies: 1 → (2,3,4,5 tuần tự theo ưu tiên rủi ro) → 6. Phase 1 giao: teardown extension, run-mode matrix + bảng env, coverage matrix spec→flow (trọng tài annotate-vs-new), contract `proveFlow()` + reporter.

## Acceptance Criteria

- [x] Mini-A kết luận rõ: scanner có/không false-positive (3 mutation đỏ đúng chỗ); manifest history verdict per-commit; số flow chuẩn reconciled.
- [x] Toàn bộ flows có verdict `proven|failed|blocked` trong `runtime-evidence.json` (committed — gitignore pattern `/acceptance-report/*` + negation, verify bằng `git check-ignore`), authPath ghi per flow, 0 flow bỏ trống; proven chỉ từ signed-auth.
- [x] Mọi flow có uiRoutes có ≥1 screenshot chụp từ trong functional UI spec tại điểm assert (synthetic data, gate sentinel pass).
- [x] Negative-authz pass cho mọi privileged mutation flow (receiptApprove/Cancel, refundCreate, guardian.approveLink, payslip.finalize, kpi.override, rewards.approve, gift.upsert, user.updateRoles, compensationPolicy.upsert, facility.create spot-check).
- [x] `pnpm acceptance:report` render 3 tier + tuổi evidence + badge runtime-fail; spec-refs được xác thực; evidence thiếu authPath:signed không bao giờ render proven.
- [x] Sau mỗi phase e2e: teardown sạch (`facility.count===0`, 0 residue bảng facility-scoped mới, ParentAccount theo run-phones = 0; AuditLog residue chấp nhận có ghi chú — bảng không có facilityId).
- [x] Report tổng tại `plans/reports/` xếp discrepancy theo severity; bug business KHÔNG bị fix lén.
- [x] Chạy lại được với run-book đầy đủ env (bảng ở phase-01): seed + `pnpm --filter @cmc/e2e test` + `PLAYWRIGHT_UI=1 ... --project=ui-chromium` + `pnpm acceptance:report` — cùng phiên Git Bash, cùng `E2E_RUN_BATCH`, cả 2 invocation đều `E2E_AUTH_MODE=signed` (globalSetup fail-closed nếu thiếu).

## Dependencies

- **blocks `260717-1213-so-nghiem-thu-song`**: Phase 4 (Evidence Collector) của plan đó GATED chờ synthetic-seed env + evidence infra — plan này giao chính hạ tầng đó. Sau plan này, phase-04 bên đó đóng như "delivered here" hoặc thu hẹp còn dashboard-embed.
- Không blockedBy plan nào: env synthetic-seed đã shipped (260718-0519 completed).

## Red Team Review

### Session — 2026-07-20
**Reviewers:** Security Adversary (Fact Checker), Failure Mode Analyst (Flow Tracer), Assumption Destroyer (Scope Auditor), Scope & Complexity Critic (Contract Verifier). 30 findings thô → dedupe còn 15.
**Findings:** 15 (15 accepted, 0 rejected) | **Severity:** 2 Critical, 10 High, 3 Medium
**User decision:** Apply cả 15 (AskUserQuestion 2026-07-20).

| # | Finding (nguồn) | Severity | Disposition | Applied To |
|---|-----------------|----------|-------------|------------|
| 1 | Teardown allowlist đóng — FK-crash + leak Facility với ~10 bảng mới (fail#1) | Critical | Accept | Phase 1 (teardown extension + count=0) |
| 2 | runtime-evidence.json gitignored + tự khai commit → forgeable, invisible (sec#1+assum#2) | Critical | Accept | Phase 1 (.gitignore negation, commit file), Phase 6 (xác thực spec-refs) |
| 3 | Auth mode không pin; Mode-A certify path prod disable; P1-07 minted-token né OTP (sec#2+assum#8) | High | Accept | Phase 1 (run-mode matrix), Phase 2 (OTP seam) |
| 4 | Mode-B ⟷ LLM stub loại trừ (LLM_STUB_PROD_FORBIDDEN) (assum#1+sec#6+fail#6) | High | Accept | Phase 3 (carve-out Mode-A cho draft, cấm key thật, backlog LLM_TEST_STUB) |
| 5 | Bảng bare-facilityId tích tụ residue → verdict non-deterministic (fail#2) | High | Accept | Phase 1 (teardown), Phases 2/5 (assert per-ID) |
| 6 | proveFlow per-test + mega-spec → verdict pollution (fail#3) | High | Accept | Phase 1 (granularity rule), Phases 2-5 (1 flow = 1 test, serial) |
| 7 | Mapping spec→flow chưa verified; trùng P3-05; 40 vs 38 codes (assum#3+scope#6) | High | Accept | Phase 1 (coverage matrix + reconcile), Phase 4 (P3-05 dedup) |
| 8 | Sweeps global, in-process invocation khác RLS context (fail#4+assum#4) | High | Accept | Phase 4 (per-ID assert, ghi notes) |
| 9 | UI evidence run thiếu positive-gate chống prod name-spoof → rủi ro ảnh trẻ em thật (sec#3) | High | Accept | Phase 1/3 (gate sentinel synthetic, fail-closed) |
| 10 | Negative-authz: ADM-only vừa thiếu money-gates vừa blanket thừa (sec#4+scope#5) | High | Accept (merged) | Phases 2/4/5 (per privileged mutation, mọi cluster) |
| 11 | Payroll hand-calc trùng unit suite có CI gate (scope#1) | High | Accept | Phase 4 (wiring proof, cite assemble-slip.test.ts) |
| 12 | Proven stale + không consumer; silent downgrade phản tác dụng (scope#2+scope#7+fail#7) | High | Accept | Phase 6 (proven kèm tuổi commit, không silent downgrade; CI wiring → backlog) |
| 13 | Reporter string đơn; merge 2 invocation không atomic/precedence (assum#5+assum#6+fail#5) | Medium | Accept | Phase 1 (array reporter, atomic, precedence + unit test) |
| 14 | Env/run-book thiếu (SYNTH_SEED_ALLOW, TEST_OTP_SEAM, secret throwaway, same-shell); helper path mis-attribution (fail#8+assum#7+sec#7) | Medium | Accept | Phase 1 (bảng env), plan.md (sửa paths) |
| 15 | Gold plating: 4 spec screenshot-only + blanket run-twice (scope#3+scope#4) | Medium | Accept | Phases 2-5 (screenshot trong functional spec; retries + targeted re-run) |

Ghi chú fold: sec#5 (minted roles ≠ identity provisioning) → legend Phase 6; fail-minor (40 flow-codes) → Phase 1 step A.1.

### Session 2 — 2026-07-20 (post-fix delta review)
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer (3 reviewer, tập trung tấn công fixes vòng 1 + V1-V4). 11 findings thô → dedupe còn 9.
**Findings:** 9 (9 accepted, 0 rejected) | **Severity:** 3 Critical, 4 High, 2 Medium
**User decisions:** R2-1 → signed-auth mode (supersede V2 — bằng chứng mới: TEST_OTP_SEAM dev-gated `lms-auth/router.ts:39-40` + boot-denylist `boot-checks.ts:176-178`); R2-8 → giữ V4 + 2 chốt (human review per-ảnh, sentinel-provenance assert).

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| R2-1 | Mode-B (NODE_ENV=production) mâu thuẫn kiến trúc prod-gate của codebase (OTP seam dev-gated + boot-denylist + boot env đòi BREVO/CORS/proxy/storage); tiền lệ seam LLM là tiền lệ ngược | Critical | Accept — chuyển signed-auth mode, bỏ seam V2 | Phase 1 (mode + env table), 2-5 (wording), 6 (ladder authPath), plan.md |
| R2-2 | .gitignore negation dưới thư mục ignored là vô hiệu (repro thực nghiệm) → committed-evidence no-op | Critical | Accept | Phase 1 (`/acceptance-report/*` + negation + check-ignore verify) |
| R2-3 | Teardown thiếu QualitativeAssessment (FK Student) + thứ tự Reward→Gift RESTRICT | Critical | Accept | Phase 1 (list + order, mirror test/db.ts) |
| R2-4 | AuditLog không có cột facilityId — delete theo facility invalid | High | Accept | Phase 1 (gỡ khỏi list, residue documented) |
| R2-5 | Annotation trong body không chạy khi serial auto-skip → không thể blocked | High | Accept | Phase 1 (proveFlow = declaration wrapper + unit test) |
| R2-6 | ParentAccount/LoginOtp unique system-wide không cleanup → chặn re-run | High | Accept | Phase 1 (cleanupParentAccountsByPhone), Phase 2 SC |
| R2-7 | LLM_API_KEY trong shell thắng stub → egress thật | High | Accept | Phase 1/3 (strip env + fail-closed) |
| R2-8 | Commit screenshots = vĩnh viễn trong history; sentinel existence ≠ provenance | Medium | Accept (V4 amended) | Phase 1 (provenance assert), Phase 6 (human review per-ảnh) |
| R2-9 | Reset-on-commit xoá verdicts khi re-run một phần sau commit | Medium | Accept | Phase 1 (batch run-id E2E_RUN_BATCH + unit test) |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01 → phase-06 (toàn bộ, sau khi áp 15 findings)
- Decision deltas checked: 12 (Mode-B mandate + carve-out P2-07; evidence committed + gitignore negation; proven-kèm-tuổi thay silent downgrade; 1-flow-1-test serial + blocked semantics; coverage matrix là trọng tài annotate-vs-new; screenshot trong functional spec; bỏ run-twice blanket; payroll wiring-proof; negative-authz per privileged mutation; teardown extension; sentinel gate UI; helper paths trpc-client.ts)
- Reconciled stale references: 3 (phase-03 tham chiếu sentinel gate trước khi phase-01 có deliverable → đã thêm vào phase-01 Architecture/Related Files/SC; helper mis-attribution session-injection→trpc-client sửa ở plan.md Hạ tầng; "2 lần chống flaky" gỡ khỏi mọi phase + AC)
- Unresolved contradictions: 0

### Session 3 — 2026-07-20 (signed-auth verification pass)
**Reviewer:** Assumption Destroyer + Flow Tracer (1 reviewer, verify 7 giả định cốt lõi của signed-auth mode).
**Verified OK (5):** signed cookie/token validate mọi env (`context.ts:217,243`); secrets mint↔verify khớp; TEST_OTP_SEAM chạy ở dev; LLM stub chạy ở dev; gitignore pattern mới hoạt động.
**Findings:** 2 (2 accepted) | **Severity:** 1 Critical, 1 High

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| R3-1 | Signed-auth invariant không có enforcement: `createE2e*` helpers key theo NODE_ENV → dev rơi về x-dev-user; authPath tự khai; grep-guard mù (string nằm trong helper được miễn trừ); trpc-client.ts thiếu trong Modify list | Critical | Accept — cờ dương `E2E_AUTH_MODE=signed` độc lập NODE_ENV, fallback THROW, authPath dập từ config run, bootstrap flip cùng cờ | Phase 1 (architecture + env + files + step 9 + SC), Phase 2 step 1 |
| R3-2 | Auth conversion 11 specs cũ là hidden work không được budget trong "reuse + annotate" | High | Accept — flip tầng helper nên không cần rewrite per-spec; baseline step 9 chạy dưới cờ signed = re-verify 11 specs; ghi rõ trong phase-01/02 | Phase 1 step 9, Phase 2 step 1 |

Unresolved question của reviewer (bootstrap dùng x-dev-user): giải quyết — bootstrap flip theo cùng cờ (global-setup cùng gate với helpers).

### Session 4 — 2026-07-20 (final confirmation, fresh-eyes)
**Reviewer:** combined skeptic + Murphy lens (1 reviewer). Verified R3-1 code claims chính xác; thiết kế fix sound; `createSignedLmsClient` dùng trực tiếp là hợp lệ; không có raw client construction trong spec nào.
**Findings:** 2 (2 accepted) + 1 minor | **Severity:** 0 Critical, 1 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| R4-1 | Throw ở wrapper chưa đủ: primitives `createStaffClient`/`createLmsClient` vẫn export không gate, gọi trực tiếp né throw; grep-guard theo string `x-dev-user` mù với direct-call + false-positive comment (kind-isolation.spec.ts:9-11) | High | Accept — gate cờ ở PRIMITIVES; guard grep theo tên helper; sửa comment stale khi annotate | Phase 1 (architecture, files, SC) |
| R4-2 | UI authPath=signed dựa trên 2 sự thật cấu trúc chưa được ghi thành enforcement (preview=prod build không phát dev-header; login thật cấp session thật) | Medium | Accept — ghi rõ UI enforcement leg + UI specs assert signed cookie/token tại điểm assert | Phase 1 (architecture) |

Minor: run-book phải set `E2E_AUTH_MODE=signed` cho cả 2 invocation → đã ghi vào AC + phase-01 (globalSetup fail-closed).

### Session 5 — 2026-07-20 (closure check)
**Reviewer:** skeptic closure pass (1 reviewer, verify fix R4-1 против live code).
**Findings: 0 Critical, 0 High, 0 Medium** — LOOP ĐẠT TIÊU CHÍ DỪNG (plan-pipeline mandate: 0 Critical/High).
- R4-1 primitive-gate verified: gated primitives chỉ được gọi ở nhánh non-signed (`trpc-client.ts:110,123`, `global-setup.ts:114`); nhánh signed không chạm primitive → throw không thể misfire; bootstrap flip đã được plan yêu cầu đúng vị trí.
- Guard grep empirical: 1 hit duy nhất = comment stale `kind-isolation.spec.ts:10` (đã trong kế hoạch sửa); 55 occurrences `createE2e*` không false-positive.
- Không mâu thuẫn phase-01 ↔ phases 2-6.
**Tiến trình 5 vòng:** 15 (2C/10H/3M) → 9 (3C/4H/2M) → 2 (1C/1H) → 2 (0C/1H/1M) → **0**.

### Whole-Plan Consistency Sweep (Red Team Session 4)
- Files reread: plan.md, phase-01 (file bị sửa) + phase-02→06 (kiểm tra chéo — không file nào tham chiếu chi tiết wrapper/primitive cũ)
- Decision deltas checked: 2 (gate xuống primitives + guard đổi target; UI enforcement leg documented)
- Reconciled stale references: phase-01 SC + Modify list + architecture đồng bộ cùng lượt; không còn nơi nào mô tả throw-ở-wrapper
- Unresolved contradictions: 0

### Whole-Plan Consistency Sweep (Red Team Session 2)
- Files reread: plan.md, phase-01 → phase-06 (sau khi áp 9 findings R2)
- Decision deltas checked: 9 (signed-auth thay Mode-B; bỏ seam LLM_TEST_STUB; gitignore wildcard pattern; teardown +QualitativeAssessment/-AuditLog/+order; declaration-time annotation; ParentAccount cleanup; strip LLM_API_KEY; V4 + 2 chốt; batch run-id)
- Reconciled stale references: mọi mention "Mode-B"/"NODE_ENV=production"/"LLM_TEST_STUB"/"mode:B" trong 6 phase + plan.md đổi sang signed-auth/authPath:signed; env table gỡ NODE_ENV + LLM_TEST_STUB, thêm cấm LLM_API_KEY + E2E_RUN_BATCH
- Unresolved contradictions: 0 (xác nhận bằng shell-grep toàn plan dir: mọi mention còn lại của thuật ngữ cũ đều nằm trong bảng log lịch sử)

### Whole-Plan Consistency Sweep (Red Team Session 3)
- Files reread: plan.md, phase-01, phase-02 (2 file bị sửa) + phase-03→06 (kiểm tra chéo)
- Decision deltas checked: 2 (E2E_AUTH_MODE enforcement; auth-conversion qua helper flip)
- Reconciled stale references: phase-01 signed-auth section viết lại theo enforcement thật (bỏ mô tả guard-grep-là-đủ); env table + Modify list + step 9 + SC đồng bộ; phase-02 step 1 ghi rõ không rewrite per-spec
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-07-20 (sau red-team session 1)
**Questions:** 4 (mode=prompt). Verification pass: skip — Red Team Review đã có evidence 4 reviewers, 0 tag [UNVERIFIED].

| # | Câu hỏi | Quyết định | Propagated |
|---|---------|-----------|------------|
| V1 | Off-by-one tuổi evidence khi commit chính evidence file | Loại evidence-only commits (chỉ đụng acceptance-report/) khỏi phép đếm tuổi (~10 LOC verify.ts) | phase-06 |
| V2 | P2-07 LLM: carve-out Mode-A hay seam | ~~Thêm seam `LLM_TEST_STUB`~~ **SUPERSEDED bởi R2-1 (2026-07-20, user approve):** bằng chứng mới — TEST_OTP_SEAM dev-gated + boot-denylist → tiền lệ ngược. Signed-auth mode khiến stub native, không cần seam, không sửa packages/llm. Mục tiêu V2 (P2-07 proven) vẫn đạt. | phase-01, phase-03 |
| V3 | Negative-authz lộ lỗ hổng thật | Report-only: failed + finding Critical, fix là plan riêng | (đã là hành vi plan — không đổi) |
| V4 | Screenshot durability | Curate ~10 screenshot đắt nhất (synthetic) vào assets của plan reports; còn lại local-only | phase-06 |

### Whole-Plan Consistency Sweep (Validation Session 1)
- Files reread: plan.md, phase-01 → phase-06
- Decision deltas checked: 4 (V1 age-calc; V2 seam thay carve-out; V3 no-op; V4 curated screenshots)
- Reconciled stale references: 3 (plan.md principles carve-out → seam; phase-01 matrix carve-out row + env table; phase-03 P2-07 block viết lại theo seam)
- Unresolved contradictions: 0
