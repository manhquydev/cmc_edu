# UAT Live Run — evidence

- run dir: /root/cmc-edu/plans/reports/uat-live-20260817-043355/
- total: 16 | passed: 16 | failed: 0 | skipped: 0

## super admin logs in (forced rotation on the very first login) and creates sale/GĐKD/GĐĐT/GV via /admin/users — passed (14s)

### Data created (cleanup log)
- [staff-account] sale email: live-sale-dfe1bb42@cmcvn.edu.vn
- [staff-account] sale userId: live-sale-dfe1bb42
- [staff-account] giam_doc_kinh_doanh email: live-giam_doc_kinh_doanh-dfe1bb42@cmcvn.edu.vn
- [staff-account] giam_doc_kinh_doanh userId: live-giam_doc_kinh_doanh-dfe1bb42
- [staff-account] giam_doc_dao_tao email: live-giam_doc_dao_tao-dfe1bb42@cmcvn.edu.vn
- [staff-account] giam_doc_dao_tao userId: live-giam_doc_dao_tao-dfe1bb42
- [staff-account] giao_vien email: live-giao_vien-dfe1bb42@cmcvn.edu.vn
- [staff-account] giao_vien userId: live-giao_vien-dfe1bb42

## sale creates a lead on /crm and advances it to O4_TESTED with real clicks — passed (11s)

### Data created (cleanup log)
- [opportunity] lead name (→ student name): Live Lead dfe1bb42
- [opportunity] lead phone: 0993085803

## sale creates the receipt from the CRM opportunity; GĐKD approves it → student + active enrollment — passed (18s)

### Data created (cleanup log)
- [class-batch] enrollment class code: CMCDEVEL-UCREA-2026-028
- [receipt] receipt code: SO00028
- [parent-email] parent email (LMS OTP): live-parent-dfe1bb42@example.com
- [enrollment] student (activated by approval): Live Lead dfe1bb42

## GĐĐT sees the new class; the teacher marks the student present on today's session — passed (41s)

### Data created (cleanup log)
- [class-batch] attendance class code: CMCDEVEL-UCREA-2026-029
- [course] course name: Live Attendance Course dfe1bb42
- [receipt] class-B activation receipt: SO00029
- [attendance] session attendance (present): Live Lead dfe1bb42

## super admin filters the audit log by action and sees the campaign's entries — passed (3s)


## giao_vien chấm công; sale đăng ký ca; GĐKD duyệt — passed (10s)

### Data created (cleanup log)
- [checkin] punch: ok
- [shift-group] name: Ops Ca KD dfe1bb42
- [shift-reg] url: https://deverp.cmcvn.edu.vn/hr/shifts/1e06e3c3-a53c-4424-8e04-c5f828ceec88
- [shift-approve] regId: 1e06e3c3-a53c-4424-8e04-c5f828ceec88

## GĐKD tạo bậc lương → gán sale → sale nộp KPI → xác nhận → chốt lương → tất toán kỳ — passed (19s)

### Data created (cleanup log)
- [staff-account] kpi-sale email: live-kpi-sale-dfe1bb42@cmcvn.edu.vn
- [salary-tier] name: KPI KD Bậc dfe1bb42
- [kpi-slip] period: 2026-06
- [payslip] period: 2026-06
- [kpi-settle] period: 2026-06
- [payslip-my] period+totalNet: 2026-06=10000000

## GĐĐT tạo bậc GIAO_VIEN → gán giáo viên → GV nộp KPI → xác nhận → chốt lương → tất toán kỳ — passed (20s)

### Data created (cleanup log)
- [staff-account] kpi-gv email: live-kpi-gv-dfe1bb42@cmcvn.edu.vn
- [salary-tier] name: KPI GV Bậc dfe1bb42
- [kpi-slip] period: 2026-06
- [payslip] period: 2026-06
- [kpi-settle] period: 2026-06
- [payslip-my] period+totalNet: 2026-06=8000000

## GĐKD tạo quà; sale mở Đổi thưởng queue render không lỗi — passed (4s)

### Data created (cleanup log)
- [gift] name: Live Quà dfe1bb42

## GĐKD đặt lịch họp PH, hoàn thành, đặt lịch khác rồi hủy — passed (5s)

### Data created (cleanup log)
- [parent-meeting] slot1: 2026-08-18T09:00
- [parent-meeting] slot1-completed: 2026-08-18T09:00
- [parent-meeting] slot2-cancelled: 2026-08-18T14:00

## GĐKD tạo case sau bán và xử lý tới đóng — passed (6s)

### Data created (cleanup log)
- [after-sale-case] student: Live Lead dfe1bb42
- [after-sale-case] status: closed

## phiếu 21tr: GĐKD bị chặn → GĐĐT duyệt → GĐKD huỷ (I3 revert O4) — passed (13s)

### Data created (cleanup log)
- [opportunity] edge O4 lead: Live Edge dfe1bb42
- [receipt] 21tr edge receipt: 69ff2a61-2794-4830-a9b1-8a62521a9c9b
- [receipt] 21tr approved by GĐĐT: 69ff2a61-2794-4830-a9b1-8a62521a9c9b
- [opportunity] O5 reached via approve: Live Edge dfe1bb42
- [receipt] 21tr cancelled: 69ff2a61-2794-4830-a9b1-8a62521a9c9b
- [opportunity] I3 reverted to O4: Live Edge dfe1bb42

## sale đăng ký ca; GĐKD Từ chối kèm lý do → trạng thái Đã từ chối — passed (8s)

### Data created (cleanup log)
- [shift-group] name: Reject Ca KD dfe1bb42
- [shift-template] name: Reject Ca dfe1bb42
- [shift-reg] url: https://deverp.cmcvn.edu.vn/hr/shifts/0b6e9580-ce7f-42ab-b1d2-884b5c7f77be
- [shift-reject] regId: 0b6e9580-ce7f-42ab-b1d2-884b5c7f77be

## GĐKD cố tạo super_admin bị chặn; tạo sale OK; reset mật khẩu user hiện hữu OK — passed (7s)

### Data created (cleanup log)
- [guard] create-super-admin-blocked: FORBIDDEN
- [staff-account] guard normal sale: live-guard-sale-dfe1bb42@cmcvn.edu.vn
- [password-reset] normal sale: live-guard-sale-dfe1bb42@cmcvn.edu.vn

## GĐKD đổi active→blocked_lms→active (rollback) qua /admin/students/:id — passed (5s)

### Data created (cleanup log)
- [student-lifecycle] blocked_lms: e64b52ae-5b49-4f2a-91a2-1d63786db415
- [student-lifecycle] back-to-active: e64b52ae-5b49-4f2a-91a2-1d63786db415

## đặt họp thứ 2 cùng giờ → dialog giữ mở + banner trùng giờ + Đóng — passed (6s)

### Data created (cleanup log)
- [class-batch] double-book class: CMCDEVEL-UCREA-2026-031
- [receipt] dedicated double-book receipt: d4b17e9a-0404-4b93-a269-05b3640dcf99
- [student] dedicated double-book student: Live DB dfe1bb42
- [parent-meeting] slot-first: 2026-08-18T10:00
- [parent-meeting] double-book-warning: 2026-08-18T10:00
