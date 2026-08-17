# UAT Live Run — evidence

- run dir: /root/cmc-edu/plans/reports/uat-live-20260817-045557/
- total: 16 | passed: 16 | failed: 0 | skipped: 0

## super admin logs in (forced rotation on the very first login) and creates sale/GĐKD/GĐĐT/GV via /admin/users — passed (15s)

### Data created (cleanup log)
- [staff-account] sale email: live-sale-3f8322c8@cmcvn.edu.vn
- [staff-account] sale userId: live-sale-3f8322c8
- [staff-account] giam_doc_kinh_doanh email: live-giam_doc_kinh_doanh-3f8322c8@cmcvn.edu.vn
- [staff-account] giam_doc_kinh_doanh userId: live-giam_doc_kinh_doanh-3f8322c8
- [staff-account] giam_doc_dao_tao email: live-giam_doc_dao_tao-3f8322c8@cmcvn.edu.vn
- [staff-account] giam_doc_dao_tao userId: live-giam_doc_dao_tao-3f8322c8
- [staff-account] giao_vien email: live-giao_vien-3f8322c8@cmcvn.edu.vn
- [staff-account] giao_vien userId: live-giao_vien-3f8322c8

## sale creates a lead on /crm and advances it to O4_TESTED with real clicks — passed (10s)

### Data created (cleanup log)
- [opportunity] lead name (→ student name): Live Lead 3f8322c8
- [opportunity] lead phone: 0914338510

## sale creates the receipt from the CRM opportunity; GĐKD approves it → student + active enrollment — passed (19s)

### Data created (cleanup log)
- [class-batch] enrollment class code: CMCDEVEL-UCREA-2026-032
- [receipt] receipt code: SO00032
- [parent-email] parent email (LMS OTP): live-parent-3f8322c8@example.com
- [enrollment] student (activated by approval): Live Lead 3f8322c8

## GĐĐT sees the new class; the teacher marks the student present on today's session — passed (40s)

### Data created (cleanup log)
- [class-batch] attendance class code: CMCDEVEL-UCREA-2026-033
- [course] course name: Live Attendance Course 3f8322c8
- [receipt] class-B activation receipt: SO00033
- [attendance] session attendance (present): Live Lead 3f8322c8

## super admin filters the audit log by action and sees the campaign's entries — passed (2s)


## giao_vien chấm công; sale đăng ký ca; GĐKD duyệt — passed (9s)

### Data created (cleanup log)
- [checkin] punch: ok
- [shift-group] name: Ops Ca KD 3f8322c8
- [shift-reg] url: https://deverp.cmcvn.edu.vn/hr/shifts/0b72b96f-dbde-4b5c-9a46-6567c52933de
- [shift-approve] regId: 0b72b96f-dbde-4b5c-9a46-6567c52933de

## GĐKD tạo bậc lương → gán sale → sale nộp KPI → xác nhận → chốt lương → tất toán kỳ — passed (18s)

### Data created (cleanup log)
- [staff-account] kpi-sale email: live-kpi-sale-3f8322c8@cmcvn.edu.vn
- [salary-tier] name: KPI KD Bậc 3f8322c8
- [kpi-slip] period: 2026-06
- [payslip] period: 2026-06
- [kpi-settle] period: 2026-06
- [payslip-my] period+totalNet: 2026-06=10000000

## GĐĐT tạo bậc GIAO_VIEN → gán giáo viên → GV nộp KPI → xác nhận → chốt lương → tất toán kỳ — passed (20s)

### Data created (cleanup log)
- [staff-account] kpi-gv email: live-kpi-gv-3f8322c8@cmcvn.edu.vn
- [salary-tier] name: KPI GV Bậc 3f8322c8
- [kpi-slip] period: 2026-06
- [payslip] period: 2026-06
- [kpi-settle] period: 2026-06
- [payslip-my] period+totalNet: 2026-06=8000000

## GĐKD tạo quà; sale mở Đổi thưởng queue render không lỗi — passed (4s)

### Data created (cleanup log)
- [gift] name: Live Quà 3f8322c8

## GĐKD đặt lịch họp PH, hoàn thành, đặt lịch khác rồi hủy — passed (6s)

### Data created (cleanup log)
- [parent-meeting] slot1: 2026-08-18T09:00
- [parent-meeting] slot1-completed: 2026-08-18T09:00
- [parent-meeting] slot2-cancelled: 2026-08-18T14:00

## GĐKD tạo case sau bán và xử lý tới đóng — passed (5s)

### Data created (cleanup log)
- [after-sale-case] student: Live Lead 3f8322c8
- [after-sale-case] status: closed

## phiếu 21tr: GĐKD bị chặn → GĐĐT duyệt → GĐKD huỷ (I3 revert O4) — passed (12s)

### Data created (cleanup log)
- [opportunity] edge O4 lead: Live Edge 3f8322c8
- [receipt] 21tr edge receipt: 49392296-368e-42d7-8a8d-f100de70acec
- [receipt] 21tr approved by GĐĐT: 49392296-368e-42d7-8a8d-f100de70acec
- [opportunity] O5 reached via approve: Live Edge 3f8322c8
- [receipt] 21tr cancelled: 49392296-368e-42d7-8a8d-f100de70acec
- [opportunity] I3 reverted to O4: Live Edge 3f8322c8

## sale đăng ký ca; GĐKD Từ chối kèm lý do → trạng thái Đã từ chối — passed (8s)

### Data created (cleanup log)
- [shift-group] name: Reject Ca KD 3f8322c8
- [shift-template] name: Reject Ca 3f8322c8
- [shift-reg] url: https://deverp.cmcvn.edu.vn/hr/shifts/c03859dc-f0ee-4fe6-99bd-01708c9c0d14
- [shift-reject] regId: c03859dc-f0ee-4fe6-99bd-01708c9c0d14

## GĐKD cố tạo super_admin bị chặn; tạo sale OK; reset mật khẩu user hiện hữu OK — passed (8s)

### Data created (cleanup log)
- [guard] create-super-admin-blocked: FORBIDDEN
- [staff-account] guard normal sale: live-guard-sale-3f8322c8@cmcvn.edu.vn
- [password-reset] normal sale: live-guard-sale-3f8322c8@cmcvn.edu.vn
- [guard] update+reset super_admin blocked: ea4e8109-9f65-4dc9-a94c-90d50edf8d85

## GĐKD đổi active→blocked_lms→active (rollback) qua /admin/students/:id — passed (4s)

### Data created (cleanup log)
- [student-lifecycle] blocked_lms: 3af43ba1-c3e5-4529-a134-4fc0e9dc1f64
- [student-lifecycle] back-to-active: 3af43ba1-c3e5-4529-a134-4fc0e9dc1f64

## đặt họp thứ 2 cùng giờ → dialog giữ mở + banner trùng giờ + Đóng — passed (5s)

### Data created (cleanup log)
- [class-batch] double-book class: CMCDEVEL-UCREA-2026-035
- [receipt] dedicated double-book receipt: 020b1e1a-cf5d-40a8-b51f-9c71cd225110
- [student] dedicated double-book student: Live DB 3f8322c8
- [parent-meeting] slot-first: 2026-08-18T10:00
- [parent-meeting] double-book-warning: 2026-08-18T10:00
