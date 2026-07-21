# Brainstorm: Xác minh độc lập tình trạng dự án — Runtime Verification 38 Flows

**Date:** 2026-07-20 12:30 | **Trigger:** PO nghi ngờ kết quả `acceptance-report/` (38/38 "built") | **Decision:** Full C — runtime e2e toàn bộ 38 flows + mini-A audit tool + nâng cấp ledger tier "proven"

## 1. Problem Statement

- `acceptance-report/verification.json` (commit `0b3633d`, 2026-07-18): 38/38 flows status `built`, 0 missing.
- "built" = **static existence check** (tRPC procedure / UI route / Prisma model tồn tại) qua `scripts/acceptance-report/verify.ts` (ts-morph scan). KHÔNG chứng minh hành vi runtime.
- Cơ sở nghi ngờ:
  1. Manifest (`flow-manifest.ts`) hand-written, sửa được — commit `3aff5f3` nắn claim `parentAccount.updateEmail` vào P1-06 → risk "claim laundering" (trim expected-list để lên xanh).
  2. Journal tool tự nhận "◐ built, not yet proven"; Phase 4 (runtime evidence) bị gate vì child-data risk, chưa từng làm.
  3. Report stale: sinh tại `0b3633d`, HEAD hiện `5956058`.
- Gap hành vi: 38 flows vs chỉ 11 Playwright specs (`apps/e2e`, bị exclude khỏi `pnpm test` mặc định).

## 2. Approaches Evaluated

| # | Approach | Pros | Cons | Verdict |
|---|----------|------|------|---------|
| A | Audit-the-auditor: re-run HEAD, mutation-test scanner, soi lịch sử manifest | Rẻ (~0.5d), bắt false-positive tool | Vẫn static | GIỮ (mini, gần miễn phí) |
| B | Behavioral coverage matrix: map 38 flows ↔ vitest/e2e, chạy full suites | Định lượng proven%, tái dùng ~898 tests | Unit test ≠ chạy thật | Hấp thụ vào C (matrix là output phụ) |
| C | Runtime e2e sweep local-sim, synthetic seed, drive theo actor role | Bằng chứng hành vi thật, độc lập hoàn toàn với tool | Đắt (~1–2 tuần full 38) | **CHỌN — user quyết Full C tất cả 38 flows** |

User decision (AskUserQuestion 2026-07-20): Full C tất cả 38 flows; ưu tiên thứ tự P1 finance+auth → P2 học tập → P3 lương/KPI; output = report độc lập + nâng cấp ledger.

## 3. Final Solution

### 3.1 Environment
- Local-sim docker (`cmc_staging`), chạy qua **Git Bash không WSL2** (ops quirk đã biết); socat sidecar nếu cần postgres port.
- Seed: `scripts/synthetic-seed-env.sh` + `scripts/seed-super-admin.ts` — 100% synthetic data → giải toả child-data risk từng chặn Phase 4.
- Secrets: Mode-B e2e secrets (đã có).

### 3.2 Two-layer flow driver
1. **tRPC-driver theo actor role** (bắt buộc cho 4 flows `he_thong` không UI: P1-04, P1-05, P3-10, P3-11; nhanh cho assertions data-level).
2. **Playwright UI**: tái dùng 11 specs sẵn có (attendance, enrollment, finance-approval, kpi-lifecycle, shift-lifecycle, lms-auth, lms-login…), viết bổ sung specs cho flows chưa phủ.

### 3.3 Evidence & verdict
- Per-flow: verdict `proven | failed | blocked` + evidence (screenshot UI flows, JSON assertion dump tRPC flows) → `runtime-evidence.json`.
- Coverage matrix per-flow (hấp thụ tầng B): flow → tests chứng minh.

### 3.4 Ledger upgrade
- `verify.ts` đọc `runtime-evidence.json` → status 3 tầng: `proven` (✓ runtime chứng minh) / `built` (◐ symbol tồn tại) / `missing` (✗).
- Render 2 tab giữ nguyên premium design language; director đọc được built-vs-proven.

### 3.5 Mini-A (audit tool, ~0.5d, chạy trước C)
- Mutation-check: gỡ tạm 1 symbol claimed → tool phải báo đỏ; restore.
- Re-run `pnpm acceptance:report` tại HEAD, diff với bản 0b3633d.
- Audit git log của `flow-manifest.ts` tìm claim bị nắn; đối chiếu 3aff5f3.

## 4. Risks

1. **Data-chain dependency**: flows dây chuyền (opportunity→receipt→student→enrollment→class→attendance→grading→evidence). Cần "lifecycle seed narrative" — specs chạy theo thứ tự nghiệp vụ hoặc fixture độc lập per-flow. Chọn hướng nào là quyết định plan-phase.
2. **Time-based system flows**: P3-10 (session-done 24h/48h), P3-11 (auto-cancel 0 điểm danh) cần mô phỏng thời gian (fake clock / trigger job trực tiếp).
3. **OTP Mode-B stub gap** (journal 260709): lmsAuth stub từng thiếu — P1-07 có thể blocked ở stub, phải fix stub trước khi verdict.
4. **Flakiness**: e2e 38 flows dễ flaky; cần retry policy + verdict `blocked` thay vì false `failed`.
5. **Scope creep**: mục tiêu là VERDICT trung thực, không phải sửa mọi bug tìm thấy. Bug tìm thấy → ghi nhận trong report, fix là plan riêng.

## 5. Success Metrics

- 38/38 flows có verdict `proven|failed|blocked` kèm evidence, 0 flow "không rõ".
- Ledger render tier proven; re-run được bằng 1 lệnh (`pnpm acceptance:report` + e2e run).
- Mini-A kết luận rõ: tool có/không false-positive; manifest có/không bị nắn claim.
- Report độc lập trong `plans/reports/` liệt kê mọi discrepancy xếp theo severity.

## 6. Next Steps

1. `/ck:plan` từ report này (pipeline user chỉ định: plan → red-team → validate loop đến 0 Critical/High — theo plan-pipeline mandate).
2. Phasing đề xuất cho plan: Phase 1 mini-A + env/seed; Phase 2 P1 (finance+auth); Phase 3 P2; Phase 4 P3; Phase 5 P4+ADM; Phase 6 ledger upgrade + report tổng.

## Unresolved Questions

- Lifecycle-chain seed vs independent fixtures per flow (quyết ở plan phase).
- P3-10/P3-11 time simulation: fake clock hay gọi job handler trực tiếp (quyết ở plan phase, phụ thuộc kiến trúc job hiện tại).
