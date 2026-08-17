# Plan: Live suite SÂU — edge cases theo bản đồ luồng 5 vai trò (P1/P3/P4 + Admin)

**Created:** 260817-0300 | **Branch:** feat/back-before-design | **Live:** deverp/devlms.cmcvn.edu.vn
**Nền tảng:** bản đồ luồng đầy đủ đã hoàn thành (plans/reports/flow-map-by-role-260817.md) từ journal +
4 Explore agents (P1/P2/P3/P4) — 34 WF + 7 nhóm Admin map theo 5 vai trò + ~60 edge case chưa test.
**Pipeline:** ak-plan (file này) → ak-cook → ak-test (live VPS) → ak-code-review → commit.

## Outcome
Triển khai 5 live specs MỚI (12–16) test SÂU ngoài happy case: edge cases KHẢ THI trên live
(real UI, không seed DB, không ghi DB) — bổ sung cho bộ 00–11 hiện có → phủ edge theo vai trò.

## Non-goals (đã ghi nhận từ bản đồ — không test live được)
P1-06 guardian requestLink (không UI LMS), P2-03/05 HS làm bài (no-ui), P3-02 offsite (cần seed
shift TODAY), P3-10/11 worker, P4-04 periodic (không UI), blockLms (không UI consumer),
P2-07 AI nhận xét (LLM_STUB_PROD_FORBIDDEN). E5/E9 (outbox nhắc PH, priority sort) = spec-code
lệch — cần quyết định doc/code, không phải test.

## Acceptance
A1. 12-ops-finance-edge (P1-08+P1-03): GĐKD huỷ phiếu (lý do bắt buộc) → phiếu cancelled +
    **I3 revert O4** (cơ hội quay lại O4_TESTED); hoàn tiền partial (refund cap không vượt netAmount);
    **second-eye**: phiếu >20tr do sale tạo → GĐKD bị chặn (nút ẩn/disabled hoặc API FORBIDDEN) →
    GĐĐT duyệt được (kích hoạt).
A2. 13-ops-shift-reject (P3-07): sale đăng ký ca → GĐKD Từ chối kèm lý do → trạng thái "Đã từ chối";
    không tự duyệt (anti-self khi GĐKD tạo ca? — nếu áp dụng).
A3. 14-ops-user-guards (ADM-02 E12/E13): GĐKD tạo user cố set vai trò super_admin → bị chặn
    (server FORBIDDEN — UI ẩn option); GĐKD resetPassword user thường OK; last-admin guard
    (bỏ super_admin khỏi admin cuối → chặn — qua updateRoles UI nếu có).
A4. 15-ops-lifecycle (P4-05 E8): GĐKD đổi lifecycle student (active→blocked_lms) qua
    /admin/students/:id → confirm → trạng thái đổi + audit ghi.
A5. 16-ops-meeting-doublebook (P4-03 E4): đặt 2 họp cùng giờ cho cùng HS → warning "trùng giờ"
    (dialog giữ mở + nút Đóng) — nhưng họp vẫn được tạo (mềm).
A6. Typecheck xanh; chạy bộ 00–16 trên VPS tất cả PASS, 0 error mọi collector; reset credentials
    về .env.prod; commit + push.

## Phases
- P1 Scout (DONE — bản đồ flow-map-by-role-260817.md + contract đã verify: user guards,
  APPROVAL_SECOND_EYE_THRESHOLD=20tr, I3 revert, shift reject UI, student lifecycle UI).
- P2 Design (file này) — 5 specs 12–16, mỗi spec 1 luồng edge.
- P3 Implement.
- P4 Verify local (typecheck + lint).
- P5 Commit/push → VPS sync → chạy live 00–16.
- P6 Review (ak-code-review) + fix + rerun nếu cần.
- P7 Reset + update plan + final report.

## Risks / Rollback
- 12: phiếu >20tr tạo mới — cần student/class từ 02/03 (reuse state.contactName). Nếu GĐKD bị chặn
  qua UI (nút ẩn), assert bằng absence thay vì banner.
- 14: GĐKD cố tạo super_admin — nếu UI ẩn option "Quản trị hệ thống" cho director, assert absence;
  nếu hiện → click → chờ banner FORBIDDEN. Xác minh từng case trước khi chạy.
- 15: đổi lifecycle blocked_lms sẽ ẩn con khỏi LMS picker — đổi lại active sau test (rollback trong spec).
- 16: double-book warning — sau test, họp thừa để nguyên (data UAT) hoặc cancel.
