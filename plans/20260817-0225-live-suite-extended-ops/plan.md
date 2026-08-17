# Plan: Live Suite mở rộng — KPI/lương/đổi quà/họp PH/after-sale + phủ 5 vai trò

**Created:** 260817-0225 | **Branch:** feat/back-before-design | **Live:** deverp/devlms.cmcvn.edu.vn (VPS 152.42.167.189)
**Pipeline:** ak-plan (file này) → ak-cook @plan → ak-test (live trên VPS) → ak-code-review → commit/push

## Outcome
Bổ sung 5 live specs (07–11) mô phỏng người dùng thật trên VPS, phủ các luồng còn thiếu
(KPI, lương, đổi quà, họp PH, chăm sóc sau bán) và **cả 5 vai trò**: super_admin, GĐKD,
GĐĐT, sale, giao_vien — theo cùng pattern 06-ops-hr (real UI login qua live-auth, capture
pageerror/console/requestfail → assert 0 lỗi, evidence vào plans/reports/uat-live-<ts>/).

## Constraints
- Live suite KHÔNG ghi DB (chỉ đọc EmailOutbox OTP qua docker exec psql) — không seed.
- Real UI cho mọi bước; chỉ dùng tRPC với session thật cho bước không có UI (payslip.my đọc).
- Rate limit staff-login 5r/m → dùng cookie replay (live-auth) + pacing; workers=1.
- Kỳ KPI phải là kỳ QUÁ KHỨ (submitSlipOpensAt = mùng 3 tháng sau, ICT) — chọn kỳ trước 2 tháng.
- Không đụng cmc-lms (hoc.cmcvn.edu.vn); không sửa product code (chỉ test + helper live).

## Non-goals
- Không test vòng đời sao xuyên app (exercise→submit→grade→redeem): cần exercise-delivery +
  student session — ghi nhận gap (journey local lms-stars-redeem-cycle đã phủ; live spec riêng sau).
- Không offsite check-in approval (P3-02): cần FacilityNetwork + shift-config + shift TODAY
  (shift.submit chặn non-future) → seed DB bị cấm trên live. Ghi nhận gap.
- Không load test / không đổi production code.

## Acceptance
A1. 5 spec mới viết theo pattern 06 (openStaffSession/closeRoleSession/menuNav/attachErrors/
    finishLiveSpec/recordCreated/assertNoErrors), typecheck xanh local.
A2. 07-ops-kpi-payroll-kd: GĐKD tạo bậc lương KD → gán cho sale (manager=GĐKD qua dialog thật) →
    sale Tính lại+Nộp KPI kỳ quá khứ → GĐKD Xác nhận → Chốt lương (assemble+finalize) →
    GĐKD tất toán kỳ (bulkApprove) → payslip.my(sale).totalNet = base (10.000.000).
A3. 08-ops-kpi-payroll-gv: cùng chuỗi cho giao_vien với GĐĐT (tier GIAO_VIEN, manager=GĐĐT,
    GĐĐT confirm/finalize/bulkApprove) → payslip.my(giao_vien).totalNet = base.
A4. 09-ops-rewards: GĐKD tạo quà (gift.upsert real UI, /admin/engagement/gifts) → tìm thấy
    trong danh sách; sale mở /admin/engagement/rewards thấy queue render (rewards.list).
A5. 10-ops-meeting: GĐKD đặt lịch họp PH cho học viên của 02 (student.lookup theo tên) →
    Hoàn thành (kèm kết quả) → đặt lịch thứ 2 → Hủy (P4-03).
A6. 11-ops-aftersale: GĐKD tạo case sau bán → Tiếp nhận → Giải quyết → Đóng (P4-05).
A7. Chạy đủ bộ 00–11 trên VPS: tất cả PASS, 0 pageError/consoleError/requestFailure,
    evidence + created-log đầy đủ; sau đó reset credentials về .env.prod + xoá .live-credentials.json.

## Phases
- P1 Scout (done — trước file này): journey specs kpi/payroll/rewards/meeting/aftersale,
  page labels admin, live-auth/live-ui/live-trcp contracts, manager field trong users dialog.
- P2 Design (file này): 5 specs + 1 extension live-ui (manager trong createStaffInDialog).
- P3 Implement: live-ui.ts (optional managerFullName) + 07/08/09/10/11 spec mới.
- P4 Verify local: pnpm typecheck + lint (e2e).
- P5 Commit + push; VPS: git fetch + reset --hard + pnpm install (nếu cần) + chạy bộ live đủ.
- P6 Review (ak-code-review) + fix nếu có.
- P7 Reset: super-admin + 2 GĐ về .env.prod (mustChangePassword), xoá .live-credentials.json,
  cập nhật plan + commit.

## Risks / Rollback
- Locator đổi mật khẩu / dialog lệch → fix locator (pattern 06). Không ảnh hưởng production.
- KPI confirm cần managerId — nếu dialog users không lưu manager → fallback: dùng user.update
  qua tRPC session thật (guard super_admin không chặn set manager) — ghi rõ trong spec.
- Chạy live tạo data test trên cmcv2-prod (staff, tier, gift, meeting, case) — ghi log created
  để dọn khi cần (như 00-06).
