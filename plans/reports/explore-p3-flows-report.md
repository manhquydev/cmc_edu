# Explore Report — Cụm P3 (Nhân sự & Lương) CMC EDU v2

> Explore agent · 2026-08-17 · Nguồn chuẩn: docs/27 (WF-P3-01…06), docs/25 §2 (P3-01…11), docs/14 (RBAC).
> Xác minh code: apps/api/src/{checkin,shift,payroll,kpi,user}/router.ts + kpi/auto-score.ts + session-done + worker.
> Test: journeys (8 spec P3) · live 06/07/08 · legacy API-driven (attendance/shift/kpi-lifecycle) · ledger business-verification.json.

## Ma trận 11 luồng P3 (tóm tắt)

| WF | Tên | Vai trò | UI | API (permission) | Test hiện có |
|---|---|---|---|---|---|
| P3-01 | Chấm công vào/ra | sale/giao_vien (+GĐ/super) | /hr/checkin (tab Tự chấm) | checkInOut.punch (checkIn.punch) + geoPunchSummary | journey checkin-punch + **live 06** |
| P3-02 | Duyệt chấm công offsite theo track | chủ phiếu; GĐKD(sale)/GĐĐT(gv); super_admin (phiếu không track) | /hr/checkin (tab Duyệt) → /:ticketId | manualPunch.approve/reject/resubmit/list (manualPunch.approve) | journey checkin-offsite-approval (**verified-correct**) |
| P3-03 | Đăng ký ca (sale SINGLE / GV MULTIPLE) | sale/giao_vien | /hr/shifts → /new → /:id | shift.submit/listGroups/myRegistrations (shift.submit) | journey shift-register-approve-reject + **live 06** |
| P3-04 | Duyệt ca (gate ROLE khớp group-type) | GĐKD/GĐĐT/super | /hr/shifts/:id (+ /go/shiftRegistration/:id) | shift.approve (shift.approve) | journey + **live 06** |
| P3-07 | Từ chối ca (lý do ≥3) | GĐKD/GĐĐT (anti-self) | /hr/shifts/:id | shift.reject (shift.approve) | journey + **live 13-ops-shift-reject** |
| P3-05 | Chốt lương theo bậc | GĐKD/GĐĐT; sale/gv (my) | /hr/payroll · /hr/salary-tiers · /hr/my | payslip.assemble/finalize/reopen/my (payslip.*) · salaryTier (salaryTier.manage) | journey payroll-assemble-finalize + **live 07/08** |
| P3-06 | Nộp & duyệt KPI | sale/gv; manager(confirm); GĐ(bulk) | /hr/kpi · /hr/my | kpi.refresh/submitSlip/confirm/override/bulkApprove (kpi.*) | journey kpi-submit-confirm-bulk-approve + **live 07/08** |
| P3-08 | Tất toán KPI (branch-scope) | GĐKD/GĐĐT/super | /hr/kpi (nút Tất toán) | kpi.bulkApprove (kpi.bulkApprove) | journey + **live 07/08** |
| P3-09 | Tính lại điểm KPI | sale/gv(self); GĐ | /hr/kpi · /hr/my | kpi.refresh (kpi.refresh) | journey kpi-refresh-my + **live 07/08** |
| P3-10 | Session-done sweep | hệ thống | — (no-ui-path) | internal markSessionDoneIfEligible | API only (ledger not-yet) |
| P3-11 | Huỷ buổi 0 điểm danh + restamp | hệ thống | — (no-ui-path) | internal runCancelSweep | API only |

## Edge CHƯA test (đã verify — có thể test bằng pattern hiện có, không cần đổi code)

- **user guards (quan trọng nhất — bảo mật):** user.update escalation (GĐ không sửa email/isActive super_admin — router.ts:308) · user.resetPassword escalation (GĐ không reset mật khẩu super_admin — router.ts:436) · user.create (GĐ không tạo super_admin — router.ts:162) — **đã test user.create trong live 14-ops-user-guards; update/resetPassword CHƯA test**.
- P3-01: ranh giới ngày ICT; punch ngày phiếu REJECTED; geoPunchSummary days <7/>90; cooldown 10.000ms.
- P3-02: chủ phiếu isActive=false; approve kèm note; inbox non-director → [].
- P3-03: entries rỗng/366; toDate<fromDate; overlap với cancelled.
- P3-04: super_admin approve (bypass group-type) — không test tường minh.
- P3-07: reject phiếu cancelled/rejected → BAD_REQUEST; reason đúng 3 ký tự.
- P3-05: reopen phiếu draft; assemble kỳ trống; finalize 2 lần; ictMonthBounds cross-year.
- P3-06: confirm bởi super_admin (bypass managerId); submitSlip GV session quá hạn.
- P3-08: payload skippedUnfinalized chi tiết; hỗn hợp finalized/unfinalized.
- P3-09: refresh giữa 2 period; tierIdSnapshot sau đổi tier.
- P3-10/11: tích hợp sweep→collectTeacherHours (KPI); restamp room-conflict (path đã bỏ).

## Drift tài liệu
- docs/25 ô Test P3-02/P3-04 trỏ attendance-lifecycle/shift-lifecycle — tồn tại nhưng là **API-driven**, journey UI thật là checkin-offsite-approval / shift-register-approve-reject.
- docs/27 ghi /hr/payroll/:id — route thực chỉ có /hr/payroll (detail inline).
- manualPunch.create + kpi.submit/kpi.approve(đơn lẻ)/kpi.getForUser/compensation.upsertRate — **ĐÃ BỎ** (ADR 0043/0044).

## Status
- Ledger: P3-01 reachable-only (smoke); P3-02…09 **verified-correct**; P3-10/11 not-yet (no-ui-path).
- Phủ edge rất tốt ở API layer; khoảng trống chính = **guard "không chạm super_admin" (user.update/resetPassword/create)** + ~10 biên nhỏ.

Status: DONE
