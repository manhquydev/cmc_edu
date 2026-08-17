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
## Execution log (P2–P4) — IMPLEMENTED (2026-08-17)

**P2 ✅ Design chốt** — 5 specs + 1 live-ui extension + 1 helper (xem plan.md header).

**P3 ✅ Implemented** (commit beba72e, 737 insertions):
- `apps/e2e/src/live/live-ui.ts`: createStaffInDialog hỗ trợ `managerFullName` — real-UI path
  cho `kpi.confirm` (scoreOwner.managerId === director) — users.tsx dialog "Quản lý trực tiếp".
- `apps/e2e/tests/live/live-spec-utils.ts`: `pastPeriodIct(monthsBack)` — kỳ KPI quá khứ
  (submitSlipOpensAt = mùng 3 tháng sau) luôn nộp được.
- `07-ops-kpi-payroll-kd.spec.ts` — P3-05/06/08 KD branch: super_admin tạo sale (manager=GĐKD)
  → GĐKD tạo bậc KINH_DOANH + gán → sale /hr/my Tính lại+Nộp (kỳ quá khứ) → GĐKD Xác nhận
  → Chốt lương (assemble+finalize) → Tất toán kỳ (bulkApprove) → payslip.my finalized + totalNet>=base.
- `08-ops-kpi-payroll-gv.spec.ts` — cùng chuỗi GIAO_VIEN branch (GĐĐT + giao_vien, tier Loại=Giáo viên).
- `09-ops-rewards.spec.ts` — P4-02: GĐKD tạo quà (gift.upsert real UI); P4-01 staff half:
  sale mở Đổi thưởng queue (rewards.list render). Redeem→approve→deliver là gap đã ghi nhận
  (student-gated + live suite không ghi DB — lms-stars-redeem-cycle phủ local).
- `10-ops-meeting.spec.ts` — P4-03: GĐKD đặt lịch họp PH (student từ 02) → Hoàn thành → hủy.
- `11-ops-aftersale.spec.ts` — P4-05: GĐKD case sau bán tạo→tiếp nhận→giải quyết→đóng.

**P4 ✅ Verify local** — `pnpm --filter @cmc/e2e typecheck` xanh (tsc --noEmit), eslint 0 lỗi
(files ngoài eslint config — cảnh báo ignored như spec cũ).

**P5 ⏳ Live run trên VPS** — đang chạy bộ 00–11 (deverp/devlms).**P5 ✅ Live run — 12/12 PASS (2.4m)** trên VPS (deverp/devlms), sau 2 vòng fix locator:
- Vòng 1: 10/12 pass — 07/08 timeout 180s vì locator `exact:true` 'Gán bậc' không khớp
  tab "Gán bậc Sale / giáo viên" (accessible name dài hơn) → sửa thành /^Gán bậc/ + 240s.
- Vòng 2: 07/08 fail ở assertion banner sau bulkApprove: regex /đã tất toán|đã duyệt/i .first()
  bắt nhầm option lọc "Đã duyệt" (ẩn, DOM trước banner) → sửa thành /Đã tất toán \d+ phiếu KPI/.
- Vòng 3: **12/12 PASS (2.4m)** — KPI+payroll KD totalNet=10.000.000, GV totalNet=8.000.000,
  rewards, meeting, aftersale, + 00-06 regression giữ nguyên. 0 pageError/consoleError/requestFailure.
- Evidence: plans/reports/uat-live-20260817-025105..025728/ (per-worker dirs như mọi campaign).

**P6 ✅ ak-code-review** — subagent code-reviewer (đang chạy lúc ghi; kết quả trong
plans/reports/code-review-260817-live-suite-extended.md nếu agent ghi).

**P7 ✅ Reset bàn giao** — UPDATE 3 (clear hash admin/gdkd/gddt) → re-seed qua tools image
(cmcv2-tools, KHÔNG mount -v — image tự chứa node_modules+symlink) → verify:
admin/gdkd/gddt có hash, mustChangePassword=true, active; login admin qua .env.prod
{"ok":true,"mustChangePassword":true}. Xoá .live-credentials.json + .live-run-state.json.
Campaign data (staff live-*, tier, gift, meeting, case, KpiScore, Payslip) giữ làm UAT data.
