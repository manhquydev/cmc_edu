---
phase: 2
title: "P1 Finance-Auth Runtime Proofs"
status: pending
priority: P1
dependencies: [1]
effort: "2d"
---

# Phase 2: P1 Finance-Auth Runtime Proofs

## Overview

Runtime proof cho 9 flows P1 (phễu tuyển sinh → thu tiền → kích hoạt → phụ huynh) — nhóm sai-thì-đắt-nhất. <!-- Updated: Red Team R2 - R2-1 --> Chạy signed-auth mode (Phase 1): server dev-env, specs chỉ dùng signed cookie/token, cấm x-dev-user. Mỗi flow = 1 `test()` riêng trong `describe.serial`.

## Requirements

- Functional: 9/9 flows P1 có verdict trong `runtime-evidence.json`.
- Non-functional: assert kết quả nghiệp vụ (state DB / procedure đọc lại), không chỉ "call không throw"; precondition vỡ → downstream `blocked` (skip có lý do), không phải `failed` (rt#6); negative-authz cho mọi privileged mutation (rt#10).

## Architecture

Chuỗi P1-01→P1-05 là dây chuyền: dùng `test.describe.serial` chia sẻ fixture, mỗi flow 1 `test()` + `proveFlow()` riêng — 1 bug chỉ làm đỏ đúng flow đó, flows sau `blocked`. Việc annotate spec cũ vs viết mới tuân theo coverage matrix Phase 1 (binary — không double-annotate 1 flowId).

## Related Code Files

- Reuse + annotate (theo matrix): `apps/e2e/tests/finance-approval.spec.ts` (P1-03), `enrollment.spec.ts` (P1-05), `lms-auth.spec.ts` (P1-07 — qua TEST_OTP_SEAM), `lms-login.ui.spec.ts`
- Create: `apps/e2e/tests/p1-admissions-lifecycle.spec.ts` (P1-01, P1-02, P1-04 + phần P1-05 matrix nói thiếu), `apps/e2e/tests/p1-guardian-link.spec.ts` (P1-06), `apps/e2e/tests/p1-refund-recon.spec.ts` (P1-08, P1-09)
- UI screenshots: chụp NGAY TRONG functional UI specs tại điểm assert (rt#15) — không tạo spec screenshot-only riêng

## Implementation Steps

1. Theo coverage matrix Phase 1: annotate `proveFlow()` vào specs cũ thực phủ (P1-03, P1-05); flow chỉ được 1 spec nhận. Auth conversion KHÔNG cần per-spec: cờ `E2E_AUTH_MODE=signed` flip ở tầng helper (Phase 1/R3-1) — specs cũ + mới đều dùng `createE2e*` helpers là tự signed; spec mới không được gọi thẳng `createStaffClient` (dev-header).
2. P1-07: proof qua OTP seam thật (`TEST_OTP_SEAM=1`, requestOtp → verifyOtp → enrollment.mine) — KHÔNG minted token cho chính flow này (rt#3).
3. `p1-admissions-lifecycle.spec.ts` (`describe.serial`, actor sale → GĐKD → he_thong side-effects):
   - P1-01: opportunityCreate → advance O1→O5 → markLost nhánh phụ → assert list/lookup.
   - P1-02: receiptCreate → assert Receipt PENDING.
   - P1-04: sau approve, assert StudentAccount + AppUser sinh đúng (state-level).
   - P1-05 (phần matrix nói thiếu): Enrollment ACTIVE, blockLms nhánh phụ.
   - Negative-authz (rt#10): `sale` gọi `finance.receiptApprove` → bị chặn.
4. `p1-guardian-link.spec.ts`: requestLink → listPendingLinks → approveLink; nhánh reject; `parentAccount.updateEmail` — claim bị nắn ở 3aff5f3: nếu không thuộc hành vi flow thật → finding cho Phase 6 report. Negative: role thường gọi `guardian.approveLink` → bị chặn.
5. `p1-refund-recon.spec.ts`: P1-08 receiptCancel + refundCreate (assert RefundRecord — teardown Phase 1 đã phủ); P1-09 reconciliation flags — assert theo ID flag tạo trong test, KHÔNG đếm global (rt#5). Negative: role thường gọi `receiptCancel`/`refundCreate` → bị chặn.
6. UI proof + screenshot trong cùng functional UI spec (login đúng role, assert state hiển thị, `page.screenshot()` tại điểm assert) cho uiRoutes claimed P1.
7. Chạy suite 1 lần chuẩn; spec nào Playwright flag flaky (qua `retries`) mới re-run targeted điều tra (rt#15) — không blanket 2 lần.

## Success Criteria

- [ ] 9/9 flows P1 có verdict, authPath ghi "signed"; `failed`/`blocked` có notes lý do; specs P1 tạo ParentAccount/LoginOtp gọi `cleanupParentAccountsByPhone` trong afterAll (R2-6).
- [ ] P1-04/P1-05 assert state-level; P1-07 đi qua OTP thật.
- [ ] Negative-authz pass cho receiptApprove, receiptCancel, refundCreate, guardian.approveLink.
- [ ] Screenshot evidence từ trong functional specs cho uiRoutes P1.
- [ ] Lệch semantics claim (P1-06 updateEmail) ghi thành finding nếu có.

## Risk Assessment

- OTP seam có gap còn sót (journal 260709) → được phép fix STUB/test layer, không đụng lmsAuth production; kẹt → `blocked` + notes.
- PT-/SO- receipt conflict (docs) có thể lộ ở runtime → finding High cho report, không fix trong plan.
- Negative-authz fail = lỗ hổng thật → verdict `failed` + finding Critical trong report (không fix lén).
