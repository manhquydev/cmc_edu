# Plan xác minh độc lập 38 flows: 5 vòng red-team đến 0 Critical/High

**Date**: 2026-07-20 21:15
**Severity**: Completed / Planning Pattern
**Component**: plans/260720-1230-independent-runtime-verification-38-flows (6 phases), apps/e2e (target), scripts/acceptance-report (target)
**Status**: Plan clean, chưa implement — user review trước khi cook.

## What Happened

PO nghi ngờ `acceptance-report` (38/38 "built"). Brainstorm xác nhận nghi ngờ có cơ sở: "built" = static existence check; manifest hand-written từng bị nắn claim (3aff5f3); Phase 4 evidence của plan 260717-1213 GATED chưa từng chạy. User chốt Full C: runtime e2e toàn bộ 38 flows + audit tool + ledger tier "proven".

Pipeline: brainstorm → ck:plan → red-team ⟲ validate, 5 vòng: 15 → 9 → 2 → 2 → 0 findings (28 applied). 8 reviewer subagents, mọi finding đều file:line evidence.

## The Brutal Truth

Plan đầu tiên của tôi trông hợp lý nhưng chứa 2 Critical + 10 High. Những cái chết người đều là **giả định về hạ tầng có sẵn không được verify**:

1. **Teardown "everything scoped to facility" là lời nói dối của comment** — `cleanupFacility` là allowlist đóng; 10 flows mới sẽ FK-crash và leak Facility. Vòng 2 còn bắt tiếp: thiếu `QualitativeAssessment`, và `AuditLog` không có cột facilityId (lệnh delete theo facility là invalid).
2. **`.gitignore` negation dưới thư mục bị ignore là VÔ HIỆU** (git semantics; reviewer repro thực nghiệm) — thiết kế "evidence committed" fix Critical vòng 1 sẽ âm thầm no-op. Fix: `/acceptance-report/*` + negation.
3. **Mode-B (NODE_ENV=production) mâu thuẫn kiến trúc codebase** — mọi test-seam đều dev-gated + boot-denylist (do red-team TRƯỚC ĐÂY đóng). Quyết định validation "thêm seam LLM_TEST_STUB" dựa trên tiền lệ TEST_OTP_SEAM là **tiền lệ ngược** — bị supersede bằng signed-auth mode: server dev-env, test chỉ dùng signed cookie/token (server validate identical mọi env — verified `context.ts:217,243`).
4. **Invariant không có enforcement = quy ước** — vòng 3-4 bắt: authPath tự khai, helpers key theo NODE_ENV rơi về x-dev-user, throw ở wrapper vẫn né được bằng direct-call primitive. Chuỗi fix: cờ dương `E2E_AUTH_MODE=signed` gate ở PRIMITIVE, fallback throw, guard grep theo tên helper.

## Lessons Learned

1. **Red-team loop hội tụ thật** (15→9→2→2→0) khi mỗi vòng chỉ đạo rõ "đừng lặp adjudicated findings, tấn công bản fix". Vòng 2 quan trọng nhất: 2 fix Critical của vòng 1 đều có lỗ (gitignore vô hiệu, seam tiền lệ ngược).
2. **Mutation-test cái checker trước khi tin checker** — Phase 1 mini-A giữ nguyên giá trị.
3. **Grep tool có thể trả false-negative** — lần sweep cuối Grep tool báo 0 match trong khi shell grep tìm ra 15; luôn kiểm chứng chéo khi kết quả "quá sạch".
4. **User decisions cần bằng chứng mới mới được đảo** — V2 (seam) bị supersede đúng quy trình: trình bằng chứng (dev-gate + boot-denylist file:line), user approve.

## Next Steps

1. User review plan → `/ck:cook D:\project\vip\CMC\plans\260720-1230-independent-runtime-verification-38-flows\plan.md` (tasks #1-#6 đã hydrate, chain 1 → 2-5 → 6).
2. Backlog: CI wiring cho runtime-evidence refresh (docs/HARNESS_BACKLOG.md — ghi ở Phase 6).
3. Plan 260717-1213 phase-04 disposition khi Phase 6 chạy.
