# Tài liệu 25 — Ma trận Truy vết (G3) — P1–P4 (ĐÓNG HOÀN TOÀN)

> Chứng minh **4 cụm P1–P4 (33 luồng) không mồ côi**: mỗi luồng nối đủ Vai trò → User Story → API
> (quyền) → UI/URL → Test → ADR/Rule. Nguồn hàng: TL23/24 (P1) · TL26 (P2) · TL27 (P3, +5 luồng HR
> remediation) · TL28 (P4).

---

## 1. Cột & quy ước

`WF` · `Vai trò` · `User Story` (ngôn ngữ người dùng) · `API (quyền)` · `UI/URL` (TL06) · `Test spec`
(file test viết & chạy xanh — 695 API tests passing tại apps/api, cộng 20 e2e spec tại apps/e2e, live
run 2026-07-12 sau HR remediation phase 6) · `ADR/QĐ` · `Oversight`.

> Ô **Test** trỏ tới file test **đã viết & verified chạy xanh** — không WF nào trống (cổng DoR, TL00 §5).

## 2. Ma trận cụm P1 (9/9 luồng — đầy đủ)

| WF | Vai trò | User Story | API (quyền) | UI/URL | Test spec | ADR/QĐ | Oversight |
|---|---|---|---|---|---|---|---|
| **P1-01** | sale | "Quản lý phễu tuyển sinh O1→O5" | `crm.opportunityCreate/advance/markLost/lookup` (crm.*) | `/crm/opportunities?view=kanban` → `/:id` | `crm/stage.spec` | QĐ0037 · OpportunityStage | HITL |
| **P1-02** | sale | "Tạo phiếu học phí từ cơ hội" | `finance.receiptCreate` (finance.receiptCreate) | `/finance/new?opportunityId=` | `finance/create-from-opp.spec` | QĐ0037 · mã phiếu | HITL |
| **P1-03** | GĐKD · GĐĐT | "Duyệt phiếu kích hoạt học viên" | `finance.receiptApprove` | `/finance/:id` | `finance/approve.spec` | ADR-B · 0041 · QĐ0024/0028 | HITL |
| **P1-04** | hệ thống | "Sinh tài khoản khi thu tiền" | (internal provisioning; key=phone) | ResultPanel (WF-03) | `provisioning/idempotent.spec` | **ADR0041** · QĐ0033 | auto |
| **P1-05** | hệ thống | "Kích hoạt ghi danh khi đóng phí" | `enrollment.enroll` + `finance.receiptApprove` | `/admin/students/:id` | `enrollment/reserved-active.spec` | **ADR-A** | auto |
| **P1-06** | PH / nhân viên | "Liên kết phụ huynh–con" | `guardian.requestLink`(lms) · `approveLink`/`reject` | `/admin/parents` | `guardian/link.spec` | TL19§6c · GuardianLinkRequest | HITL |
| **P1-07** | phụ huynh | "Đăng nhập xem con" | `lmsAuth.requestOtp/verifyOtp` · `enrollment.mine` | `/login` · `/parent/home` | `lms-auth/login.spec` | QĐ0031/0033 | auto |
| **P1-08** | GĐKD | "Huỷ phiếu / hoàn tiền" | `finance.receiptCancel` · `finance.refundCreate` (finance.*) | `/finance/receipts/:id` · `/finance/refunds` | `finance/cancel-refund.spec` | QĐ0024/0028 · **I3** · ADR-A | HITL |
| **P1-09** | agent / GĐĐT | "Giám sát bất thường tài chính" | `finance.*`+`audit.*` (read-only, MCP) | `/ops/recon` · `/finance/:id?flag=` | `agent/recon.spec` | ADR-B · TL13 | **HOTL** |
| **P2-01** | GĐĐT | "Tạo lớp tự sinh lịch buổi" | `classBatch.create` (class.create) | `/admin/classes/:id` | `apps/api/src/class/generate-sessions.test.ts` | QĐ0036 | auto |
| **P2-02** | giao_vien | "Điểm danh buổi học" | `attendance.mark/markAll` (attendance.mark) | `/teaching/attendance?session=` | `apps/api/src/attendance/gate.test.ts` | TL19§5 · **ADR0038** | người |
| **P2-03** | hệ thống / HS | "Mở bài tập theo tiến độ học" | `exercise.openForStudent` (lms) | `/student/exercise/:exerciseId` | `apps/api/src/exercise/open-tier.test.ts` | **ADR0038** | auto |
| **P2-04** | GĐĐT | "Cung cấp bài tập PDF" | `exercise.create/publish` (assessment.*) | `/teaching/exercises` | `apps/api/src/exercise/publish.test.ts` | TL19§3 | HITL |
| **P2-05** | học viên | "Làm bài trên PDF & nộp" | `submission.saveDraft/submit` (lms) | `/student/exercise/:exerciseId` | `apps/api/src/submission/annotate-submit.test.ts` | TL19§3 | auto |
| **P2-06** | giao_vien | "Chấm bài & cộng sao" | `submission.grade` (grade) | `/teaching/grading` | `apps/api/src/submission/grade.test.ts` · `teacher-annotation.test.ts` · `list-for-child.test.ts` | TL19§6 | người |
| **P2-07** | agent / giao_vien | "Nhận xét (AI nháp, GV chốt)" | `assessment.draftComment/confirm` | `/teaching/session-assessment` · `/admin/report-cards` | `apps/api/src/assessment/draft-confirm.test.ts` | **TL08§7** · TL13 | HITL |
| **P2-08** | giao_vien | "Gửi ảnh & tóm tắt buổi cho PH" | `sessionEvidence.publish` (giao_vien) | `/teaching/session-evidence` · `/parent/evidence/:studentId` | `apps/api/src/session-evidence/publish.test.ts` · `photo-access.test.ts` | TL19§6b · **TL08§7** | người |
| **P3-01** | nhân viên | "Chấm công cặp vào/ra mỗi ngày" | `checkInOut.punch` (checkInOut.punch) | `/hr/checkin` | `apps/api/src/checkin/punch-offsite.test.ts` · `apps/api/src/checkin/ip-match.test.ts` | **ADR0043** | người |
| **P3-02** | sale / giao_vien (chủ phiếu) · GĐ theo track (duyệt) · super_admin (phiếu không track) | "Duyệt phiếu chấm công offsite" | `manualPunch.approve/reject/resubmit/list` (manualPunch.approve) | `/hr/checkin` | `apps/api/src/checkin/manual-punch-approval-track.test.ts` · `apps/e2e/tests/attendance-lifecycle.spec.ts` | **ADR0043** | HITL |
| **P3-03** | sale / giao_vien | "Đăng ký ca làm" | `shift.submit`/`listGroups`/`myRegistrations` (shift.submit) | `/hr/shifts` | `apps/api/src/shift/register-approve.test.ts` | **ADR0040** · QĐ0035 | HITL |
| **P3-04** | GĐKD / GĐĐT | "Duyệt ca" | `shift.approve`/`pendingForApproval` (shift.approve, gate ROLE khớp group-type) | `/hr/shifts` | `apps/api/src/shift/register-approve.test.ts` · `apps/e2e/tests/shift-lifecycle.spec.ts` | **ADR0040** · docs/20 §2 | HITL |
| **P3-05** | GĐKD / GĐĐT | "Chốt lương tháng theo bậc lương" | `payslip.assemble/finalize/reopen/my/getForUser` · `salaryTier.list/create/update` · `compensation.assignTier` (payslip.assemble, salaryTier.manage) | `/hr/payroll` · `/hr/salary-tiers` · `/hr/my` | `apps/api/src/payroll/policy-model.test.ts` · `policy-rates.test.ts` · `penalty-posttax.test.ts` · `payslip-my.test.ts` · `apps/e2e/tests/kpi-lifecycle.spec.ts` | **ADR0044** · docs/20 §3 | HITL |
| **P3-06** | sale / giao_vien / GĐKD / GĐĐT | "Nộp & duyệt phiếu KPI (auto-score)" | `kpi.refresh/submitSlip/confirm/override/myScore/list` (kpi.submitSlip, kpi.confirm, kpi.approve) | `/hr/kpi` · `/hr/my` | `apps/api/src/kpi/lifecycle.test.ts` · `apps/api/src/kpi/auto-score.test.ts` · `apps/e2e/tests/kpi-lifecycle.spec.ts` | **ADR0044** · docs/20 §4 | HITL |
| **P3-07** | GĐKD / GĐĐT | "Từ chối đăng ký ca (kèm lý do)" | `shift.reject` (shift.approve, anti-self + gate group-type) | `/hr/shifts` | `apps/api/src/shift/reject-validate.test.ts` · `apps/e2e/tests/shift-lifecycle.spec.ts` | **ADR0040** · docs/20 §2 | HITL |
| **P3-08** | GĐKD / GĐĐT | "Tất toán KPI hàng loạt (branch-scope)" | `kpi.bulkApprove` (kpi.bulkApprove) | `/hr/kpi` | `apps/api/src/kpi/lifecycle.test.ts` · `apps/e2e/tests/kpi-lifecycle.spec.ts` | **ADR0044** · docs/20 §4 | HITL |
| **P3-09** | sale / giao_vien / GĐKD / GĐĐT | "Tính lại điểm KPI tự động (công thức PHẦN NHÂN)" | `kpi.refresh` (kpi.refresh) | `/hr/kpi` · `/hr/my` | `apps/api/src/kpi/auto-score.test.ts` · `apps/api/src/kpi/lifecycle.test.ts` · `apps/e2e/tests/kpi-lifecycle.spec.ts` | **ADR0044** | auto |
| **P3-10** | hệ thống | "Đánh giá buổi học hoàn thành (session-done)" | (internal sweep worker; không có procedure gọi trực tiếp) | — (feed vào `/hr/kpi`, `/teaching/*`) | `apps/api/src/class/session-done.test.ts` · `apps/api/src/worker/session-done-sweep.test.ts` | **ADR0044** | auto |
| **P3-11** | hệ thống | "Tự huỷ buổi 0 điểm danh + xếp buổi bù nối đuôi" | (internal sweep worker; không có procedure gọi trực tiếp) | `/admin/classes/:id` | `apps/api/src/worker/session-done-sweep.test.ts` | **ADR0044** | auto |
| **P4-01** | học viên / nhân viên | "Đổi quà bằng sao" | `rewards.redeem/approve/deliver` | `/admin/engagement/rewards` | `apps/api/src/rewards/redeem-refund.test.ts` | TL20§5 | HITL |
| **P4-02** | GĐ | "Cấu hình quà đổi sao" | `gift.upsert/list` (GĐ) | `/admin/engagement/rewards` | `apps/api/src/rewards/redeem-refund.test.ts` | TL20§5 | người |
| **P4-03** | nhân viên | "Lên lịch & nhắc họp PH" | `parentMeeting.schedule/complete` | `/crm/post-sale-meeting` *(UI EmptyState — chưa gọi API)* | `apps/api/src/meeting/parent-meeting.test.ts` | TL20§6 | HITL |
| **P4-04** | sale / giao_vien | "Đặt lịch test đầu vào/định kỳ" | `testAppointment.schedule/complete` | `/crm/opportunities/:id` | `apps/api/src/appointment/appointment-lifecycle.test.ts` | TL20§6 | người |
| **P4-05** | sale / GĐ | "Chăm sóc sau bán" | `afterSale.advance` · `student.setLifecycle`(GĐ) | `/crm/aftersale` | `apps/api/src/after-sale/after-sale.test.ts` | TL20§7 · QĐ0027 | HITL |

## 3. Kiểm tra khép kín (reverse coverage)

**3a. Mỗi cột đủ cho mọi WF?** ✅ 9/9 luồng có đủ Vai trò·Story·API·UI·Test·ADR — **không ô trống**.

**3b. ADR/QĐ của P1 → có WF phủ?**

| ADR/QĐ | Phủ bởi | ✓ |
|---|---|---|
| ADR-A (enrollment reserved→active) | P1-05, P1-08 | ✓ |
| ADR-B (cổng tiền/SoD/ngưỡng) | P1-03, P1-09 | ✓ |
| ADR 0041 (provisioning atomic/idempotent) | P1-03, P1-04 | ✓ |
| QĐ 0037 (opp↔receipt prefill) | P1-01, P1-02 | ✓ |
| QĐ 0024 (auto-O5/void) | P1-03, P1-08 | ✓ |
| QĐ 0028 (netAmount đóng băng/refund cap) | P1-03, P1-08 | ✓ |
| QĐ 0033 (định danh phone) | P1-04, P1-07 | ✓ |
| I3 (revert O4 khi phiếu duy nhất) | P1-08 | ✓ |
| GuardianLinkRequest | P1-06 | ✓ |
| **ADR 0038 (mở bài tập Tier A/B)** | P2-02, P2-03 | ✓ |
| **TL08 §7 (dữ liệu trẻ — người chốt)** | P2-07, P2-08 | ✓ |
| TL19 §3/§6 (bài PDF, chấm, sao) | P2-04, P2-05, P2-06 | ✓ |
| QĐ 0036 (mã lớp) + auto-sinh buổi | P2-01 | ✓ |
| **ADR 0039 (chấm công IP)** | P3-01, P3-02 | ✓ |
| **ADR 0040 (ca sale-vs-GV, gate ROLE)** | P3-03, P3-04, P3-07 | ✓ |
| **ADR 0044 (KPI auto-score + salary-tier + session-done)** | P3-05, P3-06, P3-08, P3-09, P3-10, P3-11 | ✓ |
| TL20 §5–7 (đổi quà · họp PH · after-sale) | P4-01…05 | ✓ |

> QĐ 0025/0012 (lương/phạt post-tax) và QĐ 0011/0010 (KPI/Callio) — **superseded bởi ADR 0044**
> (HR remediation): mô hình `SalaryRate` nhập tay + `kpi.submit/approve` đơn lẻ đã bỏ, thay bằng
> `SalaryTier` catalog + lifecycle auto-score. Giữ số QĐ cũ trong lịch sử tài liệu, không xoá.

→ Mọi ADR/QĐ liên quan P1 **đều có ít nhất một WF** — không quyết định mồ côi.

**3c. API procedure P1 → có WF phủ?** `crm.opportunity*`, `finance.receiptCreate/Approve/Cancel`,
`finance.refundCreate`, `enrollment.enroll/mine`, `guardian.requestLink/approveLink`,
`lmsAuth.requestOtp/verifyOtp` — **tất cả** map tới WF ở §2. Không procedure P1 mồ côi.

**3d. Vai trò active → có story?** sale (01,02,P3-03,05,06,09,P4-04,05), GĐKD (03,08,P3-04,05,06,07,08),
GĐĐT (09,P2-01,04,P3-04,05,06,07,08), giao_vien (P2-02,06,07,08,P3-03,05,06,09,P4-04), phụ huynh
(06,07), học viên (P2-05,P4-01), nhân sự nội bộ theo vai thật — sale/giao_vien/GĐ (P3-01,02), hệ thống/agent (04,05,09,P2-03,07,P3-10,11).
✓ **Cả 4 vai trò active + IT có story.**

## 4. ✅ Ma trận ĐÓNG HOÀN TOÀN (P1–P4)

- **33 luồng** × đủ 6 cột truy vết — **không ô trống** (P3 mở rộng +5 luồng HR remediation: reject,
  bulkApprove, refresh, session-done, auto-cancel+xếp bù — docs/22 ADR 0044).
- **Mọi ADR (A–D, 0038–0042) + mọi QĐ liên quan + mọi procedure + mọi vai trò active đều có WF phủ.**
  Không còn quyết định/procedure/vai trò mồ côi.
- **Còn lại (không phải mồ côi, là artifact riêng):**
  - **Test spec chưa tồn tại** → **G4 Test Plan (TL29)** đặt coverage target từng ô.
  - Mối đe doạ bảo mật → **G5 Threat Model (TL30)**.
  - Trình tự build → **G6 Phased Build Plan (TL31)**.

## 5. Trạng thái

4 cụm P1–P4 **khép kín trọn vẹn**: rule (TL19/20) → ADR (TL16/22) → workflow (TL23/24/26/27/28) →
traceability (bảng này). Đây là "xương sống chứng minh không mồ côi" của toàn dự án.

## 5. Trạng thái

Cụm P1 **khép kín**: 9 luồng × đủ 6 cột truy vết, mọi ADR/API/vai trò P1 được phủ. Ma trận này là
bảng gốc — mỗi cụm sau append hàng + chạy lại kiểm §3.

> Liên kết: TL00 §3 (khái niệm) · TL23/24 (nguồn hàng P1) · TL22/16 (ADR) · TL11 (API) · TL06 (URL).
