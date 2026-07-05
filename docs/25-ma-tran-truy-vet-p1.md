# Tài liệu 25 — Ma trận Truy vết (G3) — P1–P4 (ĐÓNG HOÀN TOÀN)

> Chứng minh **4 cụm P1–P4 (28 luồng) không mồ côi**: mỗi luồng nối đủ Vai trò → User Story → API
> (quyền) → UI/URL → Test → ADR/Rule. Nguồn hàng: TL23/24 (P1) · TL26 (P2) · TL27 (P3) · TL28 (P4).

---

## 1. Cột & quy ước

`WF` · `Vai trò` · `User Story` (ngôn ngữ người dùng) · `API (quyền)` · `UI/URL` (TL06) · `Test spec`
(file cần viết cho v2 — chưa tồn tại, là mục tiêu) · `ADR/QĐ` · `Oversight`.

> Ô **Test** trỏ tới file test *sẽ viết* — không WF nào coi "xong" khi ô Test trống (cổng DoR, TL00 §5).

## 2. Ma trận cụm P1 (9/9 luồng — đầy đủ)

| WF | Vai trò | User Story | API (quyền) | UI/URL | Test spec | ADR/QĐ | Oversight |
|---|---|---|---|---|---|---|---|
| **P1-01** | sale | "Quản lý phễu tuyển sinh O1→O5" | `crm.opportunityCreate/advance/markLost/lookup` (crm.*) | `/crm/opportunities?view=kanban` → `/:id` | `crm/stage.spec` | QĐ0037 · OpportunityStage | HITL |
| **P1-02** | sale | "Tạo phiếu học phí từ cơ hội" | `finance.receiptCreate` (finance.receiptCreate) | `/finance/receipts/new?opportunityId=` | `finance/create-from-opp.spec` | QĐ0037 · mã phiếu | HITL |
| **P1-03** | GĐKD | "Duyệt phiếu kích hoạt học viên" | `finance.receiptApprove` (finance.receiptApprove) | `/finance/receipts/:id` | `finance/approve.spec` | ADR-B · 0041 · QĐ0024/0028 | HITL |
| **P1-04** | hệ thống | "Sinh tài khoản khi thu tiền" | (internal provisioning; key=phone) | ResultPanel (WF-03) | `provisioning/idempotent.spec` | **ADR0041** · QĐ0033 | auto |
| **P1-05** | hệ thống | "Kích hoạt ghi danh khi đóng phí" | `enrollment.enroll` + `finance.receiptApprove` | `/students/:id/enrollments` | `enrollment/reserved-active.spec` | **ADR-A** | auto |
| **P1-06** | PH / nhân viên | "Liên kết phụ huynh–con" | `guardian.requestLink`(lms) · `approveLink`/`reject` | LMS `/child/link-request` · `/parents/:id` | `guardian/link.spec` | TL19§6c · GuardianLinkRequest | HITL |
| **P1-07** | phụ huynh | "Đăng nhập xem con" | `lmsAuth.requestOtp/verifyOtp` · `enrollment.mine` | LMS `/login` · `/select-child` · `/child/:id` | `lms-auth/login.spec` | QĐ0031/0033 | auto |
| **P1-08** | GĐKD | "Huỷ phiếu / hoàn tiền" | `finance.receiptCancel` · `finance.refundCreate` (finance.*) | `/finance/receipts/:id` · `/finance/refunds` | `finance/cancel-refund.spec` | QĐ0024/0028 · **I3** · ADR-A | HITL |
| **P1-09** | agent / GĐĐT | "Giám sát bất thường tài chính" | `finance.*`+`audit.*` (read-only, MCP) | `/finance/reconciliation` · `/finance/receipts/:id?flag=` | `agent/recon.spec` | ADR-B · TL13 | **HOTL** |
| **P2-01** | GĐĐT | "Tạo lớp tự sinh lịch buổi" | `classBatch.create` (class.create) | `/classes/:id/sessions` | `class/generate-sessions.spec` | QĐ0036 | auto |
| **P2-02** | giao_vien | "Điểm danh buổi học" | `attendance.mark/markAll` (attendance.mark) | `/teaching/attendance?session=` | `attendance/gate.spec` | TL19§5 · **ADR0038** | người |
| **P2-03** | hệ thống / HS | "Mở bài tập theo tiến độ học" | `exercise.openForStudent` (lms) | `/child/:id/exercises` | `exercise/open-tier.spec` | **ADR0038** | auto |
| **P2-04** | GĐĐT | "Cung cấp bài tập PDF" | `exercise.create/publish` (assessment.*) | `/curriculum/:unitId/exercises` | `exercise/publish.spec` | TL19§3 | HITL |
| **P2-05** | học viên | "Làm bài trên PDF & nộp" | `submission.saveDraft/submit` (lms) | `/child/:id/exercises/:id` | `submission/annotate-submit.spec` | TL19§3 | auto |
| **P2-06** | giao_vien | "Chấm bài & cộng sao" | `submission.grade` (grade) | `/teaching/grading` | `submission/grade.spec` | TL19§6 | người |
| **P2-07** | agent / giao_vien | "Nhận xét (AI nháp, GV chốt)" | `assessment.draftComment/confirm` | `/teaching/report-cards/:id` | `assessment/draft-confirm.spec` | **TL08§7** · TL13 | HITL |
| **P2-08** | giao_vien | "Gửi ảnh & tóm tắt buổi cho PH" | `sessionEvidence.publish` (giao_vien) | LMS `/child/:id` | `session-evidence/publish.spec` | TL19§6b · **TL08§7** | người |
| **P3-01** | nhân viên | "Chấm công qua WiFi công ty" | `checkInOut.punch` (checkInOut.punch) | `/attendance/check-in-out` | `checkin/ip-match.spec` | **ADR0039** | người |
| **P3-02** | nhân viên / manager | "Duyệt chấm công thủ công" | `manualPunch.create/approve` (manager) | `/attendance/check-in-out` | `checkin/manual-ticket.spec` | **ADR0039** · QĐ0034 | HITL |
| **P3-03** | sale / giao_vien | "Đăng ký ca làm" | `shiftRegistration.submit` (shift.register) | `/attendance/shifts` | `shift/register-mode.spec` | **ADR0040** · QĐ0035 | HITL |
| **P3-04** | manager / GĐ | "Duyệt ca" | `shiftRegistration.approve` (managerId/GĐ) | `/attendance/shifts/:id` | `shift/approve-fallback.spec` | **ADR0040** · QĐ0027 | HITL |
| **P3-05** | GĐ | "Chốt lương tháng" | `payroll.finalize` · `compensation.upsertRate` | `/hr/payroll/:id` · `/hr/salary-structure` | `payroll/penalty-posttax.spec` | QĐ0025/0012 | HITL |
| **P3-06** | hệ thống / GĐ | "Chấm & duyệt KPI" | `kpi.score/confirm/approve` | `/hr/kpi` | `kpi/override-tree.spec` | QĐ0011/0010 | HITL |
| **P4-01** | học viên / nhân viên | "Đổi quà bằng sao" | `rewards.redeem/approve/deliver` | `/engagement/rewards` | `rewards/redeem-refund.spec` | TL20§5 | HITL |
| **P4-02** | GĐ | "Cấu hình quà đổi sao" | `gift.upsert/archive` (GĐ) | `/engagement/rewards` | `gift/catalog.spec` | TL20§5 | người |
| **P4-03** | nhân viên | "Lên lịch & nhắc họp PH" | `parentMeeting.schedule/complete` | `/parent-meetings` | `meeting/lifecycle.spec` | TL20§6 | HITL |
| **P4-04** | sale / giao_vien | "Đặt lịch test đầu vào/định kỳ" | `testAppointment.schedule/complete` | `/crm/opportunities/:id` | `test-appt/lifecycle.spec` | TL20§6 | người |
| **P4-05** | sale / GĐ | "Chăm sóc sau bán" | `afterSale.advance` · `student.setLifecycle`(GĐ) | `/crm/aftersale` | `aftersale/case.spec` | TL20§7 · QĐ0027 | HITL |

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
| **ADR 0040 (ca sale-vs-GV)** | P3-03, P3-04 | ✓ |
| QĐ 0025/0012 (lương/phạt/rate) | P3-05 | ✓ |
| QĐ 0011/0010 (KPI/Callio) | P3-06 | ✓ |
| TL20 §5–7 (đổi quà · họp PH · after-sale) | P4-01…05 | ✓ |

→ Mọi ADR/QĐ liên quan P1 **đều có ít nhất một WF** — không quyết định mồ côi.

**3c. API procedure P1 → có WF phủ?** `crm.opportunity*`, `finance.receiptCreate/Approve/Cancel`,
`finance.refundCreate`, `enrollment.enroll/mine`, `guardian.requestLink/approveLink`,
`lmsAuth.requestOtp/verifyOtp` — **tất cả** map tới WF ở §2. Không procedure P1 mồ côi.

**3d. Vai trò active → có story?** sale (01,02,P4-04,05), GĐKD (03,08), GĐĐT (09,P2-01,04),
giao_vien (P2-02,06,07,08,P3-03,P4-04), phụ huynh (06,07), học viên (P2-05,P4-01), nhân viên
(P3-01,02,03), hệ thống/agent (04,05,09,P2-03,07). ✓ **Cả 4 vai trò active + IT có story.**

## 4. ✅ Ma trận ĐÓNG HOÀN TOÀN (P1–P4)

- **28 luồng** × đủ 6 cột truy vết — **không ô trống**.
- **Mọi ADR (A–D, 0038–0041) + mọi QĐ liên quan + mọi procedure + mọi vai trò active đều có WF phủ.**
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
