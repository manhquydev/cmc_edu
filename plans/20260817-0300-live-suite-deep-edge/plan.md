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
## Execution log (P2–P7) — COMPLETE (2026-08-17)

**P2 ✅ Design chốt** — 5 edge specs (12–16) theo bản đồ flow-map-by-role-260817.md (journal + 4 Explore agents: P1/P2/P3/P4 đã map 34 WF + 7 ADM + ~60 edge cases chưa test).

**P3–P5 ✅ Implement + live run** (commits 72bc324 → 36de1a7, 4 vòng fix):
- Vòng 1: 13/17 — fix: 12 needs_confirmation (SĐT trùng → "Đây là bé mới"), 13 overlap shift (ngày +2),
  14 nav 'Quản trị' super-admin-only (goto URL), 16 student riêng qua real money chain.
- Vòng 2: 14/17 — fix: 12 SĐT unique + email exact label, 14 user.create 403 benign (guard mong đợi),
  16 classBatchId qua createLiveClass (không phải code string).
- Vòng 3: 15/17 — fix: 12 tạo phiếu qua tRPC (UI email flaky), 16 strict /trùng giờ/ .first().
- Vòng 4: **17/17 PASS (3.2m) — mọi spec 0 error trên mọi collector** (console/pageerror/reqfail=0).
  Evidence: plans/reports/uat-live-20260817-040924/ (16 admin) + 041232/ (parent OTP).

**P6 ⏳ ak-code-review** — subagent code-reviewer đang chạy; report → plans/reports/code-review-260817-live-suite-deep-edge.md.

**P7 ⏳ Reset + bàn giao** — sau review xong.**P6 ✅ ak-code-review (subagent code-reviewer) → APPROVE_WITH_NOTES** — plans/reports/code-review-260817-live-suite-deep-edge.md.
Đã fix M1/M2 + L1/L2/L3 + rerun:
- **M1 (12)**: assert O5 sau approve dời sang session GĐKD (GĐĐT KHÔNG có crm.opportunityList — docs/14):
  card edgeName mất nút 'Ghi danh' trước khi huỷ → khép phantom O5 (walk-in auto-link lên O5_ENROLLED).
- **M2 (15)**: lifecycle assert qua tRPC readback (student.lookup trả lifecycle) — text có thể khớp
  Selector pending value; + waitForResponse student.setLifecycle + exact 'Xác nhận' (rollback từng không ăn).
- L1: escapeRegExp hoisted vào live-spec-utils (bỏ duplicate 12). L2: recordCreated receipt 16 + template 13.
  L3: comment 16 sửa (tự tạo student riêng).
- **Rerun cuối: 17/17 PASS (3.3m) — MỌI spec 0 error trên mọi collector** (dir 043355: 16 admin + 043705: parent OTP).
  Evidence: plans/reports/uat-live-20260817-final-edge-admin/.

**P7 ✅ Reset bàn giao** — UPDATE 3 (clear hash) → re-seed 3 tài khoản .env.prod (mustChangePassword=true);
login admin verify {"ok":true,"mustChangePassword":true}; xoá .live-credentials.json/.live-run-state.json.
Campaign data UAT giữ lại (opp edge, receipt 21tr cancelled, student, meeting, staff guard).

## Tổng kết (goal)
Bản đồ luồng: 34 WF + 7 ADM × 5 vai trò + ~60 edge cases (plans/reports/flow-map-by-role-260817.md).
Live suite: 00–16 (17 specs) PASS — happy + edge theo vai trò: KPI/lương KD+GV, đổi quà, họp PH + double-book,
after-sale, finance second-eye/I3, shift reject, user escalation guards, student lifecycle, CRM, chấm công, audit.
Còn lại (no-ui-path / cần quyết định): P1-06 guardian UI, P2-03/05 HS làm bài, P3-02 offsite seed, P4-04 periodic,
P2-07 AI nhận xét, E5/E9 spec-code lệch (outbox, priority sort), blockLms UI.
**P8 ✅ Chốt an toàn tài khoản (theo yêu cầu user, 2026-08-17)** — spec 14 mở rộng phủ nốt E12 nửa sau:
- Bước 4: với real session GĐKD, `user.update` (đổi email admin) + `user.resetPassword` (đặt mật khẩu tạm admin)
  đều reject FORBIDDEN ("Only a super admin can update another super admin" / "...reset another super admin's password") —
  khép 2 guard bảo mật trống duy nhất còn lại.
- Fix phụ: live-global-setup đọc LIVE_ADMIN_ORIGIN/LIVE_LMS_ORIGIN từ env (trước hardcode erp.clawcmc.io.vn cũ —
  khi tunnel cũ chết HTTP 525, preflight chặn campaign dù specs nhắm deverp/devlms).
- **Rerun: 17/17 PASS (dir 045557: 16 admin + 045905: parent OTP), 0 error mọi collector** —
  evidence: plans/reports/uat-live-20260817-final-guards/.
- Reset bàn giao: 3 tài khoản về .env.prod bootstrap (mustChangePassword), login verified.
