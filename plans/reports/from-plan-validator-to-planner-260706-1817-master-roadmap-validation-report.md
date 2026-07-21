# Master Roadmap Validation Report (persisted by main agent — validator ran read-only)

Validator: Plan agent (skeptical architect). Evidence: 9 plan files, docs/22/25/26/27/28/29/31, packages/auth, apps/api source, harness.db, git.

## Ground-truth: all context claims verified (157 api tests exact; TL25=28 WF; US-001..011 in DB; RLS/cmc_app/fail-closed/workers/coverage/20tr threshold/ict-time — all as claimed; ict-time lives in apps/api/src/class/, not shared pkg).

## Per-phase verdicts
- G1 **PASS** (bound review-fix loop).
- T1 **PASS-WITH-FIXES**: mark upsert/re-mark semantics + markAll payload + listBySession perm unspecified; gate under-powered vs plan's own child-data rule; e2e config (port/env/teardown) unstated.
- T2 **PASS-WITH-FIXES**: PDF upload transport undecided (tRPC no multipart); Submission/StarTransaction thiếu facilityId/RLS (mâu thuẫn chính plan); star amount rule unstated; perm `exercise.manage` vs TL25 `assessment.*` divergence; WF-P2-04 không có story riêng.
- T3 **PASS-WITH-FIXES**: thiếu LMS read procedure cho assessment confirmed (acceptance "PH thấy" không có đường); "period" undefined.
- P3 **PASS-WITH-FIXES / FAIL sizing**: PHẢI split 2 phase (P3-I identity+chấm công, P3-II ca+lương/KPI); dev-session→AppUser tightening phá 157 test không có chiến lược; "post-tax" không có tax model — semantics unanswerable; punch-without-shift baseline undefined; thiếu e2e chấm công/duyệt ca (TL29 §1); P3a auth under-gated; ict-time cần chuyển shared pkg.
- P4 **PASS-WITH-FIXES**: blockLms(GĐKD+GĐĐT, tồn tại main) ↔ setLifecycle "CHỈ GĐ" = mâu thuẫn liên-phase duy nhất, "GĐ" chưa định nghĩa role key; Reward thiếu facilityId; cơ chế nhắc họp chưa nêu; P4a nên adversarial bắt buộc.
- P5 **PASS-WITH-FIXES**: ngưỡng N/X unbound; verify-path US-010 lệch 3 nơi (DB `src/agent/recon.test.ts` vs TL25 vs phase-07); cơ chế `ai_agent_recon` (ROLES const cấm thêm role không ADR; RLS context cho worker cross-facility) chưa quyết.
- PD **PASS-WITH-FIXES**: CI không cần creds mà đứng cuối → mọi merge trước đó chỉ gate local — kéo CI lên sớm; platform chưa nêu (TL29 nói Jenkins).

## Protocol gaps (plan.md)
Thiếu: merge-conflict handling; failing-main policy; test-flake policy (dev Postgres chung, đã từng phải fileParallelism:false); doc-conflict escalation (blockLms chứng minh corpus có thể vênh); phase-split/context-budget rule; coverage-threshold extension per money module mới; cap review→fix cycles.

## Traceability
28/28 WF phủ; orphan: WF-P2-04 story; `computeFinalGrade` + report-card aggregation (TL19 §6/TL26/TL29 yêu cầu) không phase nào own; e2e chấm công/duyệt ca; US-010 verify path.

## Top 5 câu plan chưa trả lời được
1. PDF từ client tới BlobStorage.put qua tRPC-only bằng cách nào?
2. "Phạt post-tax" nghĩa gì khi không có dòng thuế nào trong payslip model?
3. setLifecycle GĐ-only thì blockLms (GĐKD+GĐĐT, có test) số phận ra sao; "GĐ" là role key nào?
4. Sau khi buộc dev-session→AppUser, 157 test cũ (id synthetic) sống sót cách nào?
5. Ai build computeFinalGrade + tổng hợp học bạ tháng?

Status: DONE (persisted). Incidental: story verify-all chạy trong lúc validate — US-010 là story fail duy nhất (đúng kỳ vọng, chưa build).
