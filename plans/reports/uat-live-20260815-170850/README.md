# UAT Live Run — evidence

- run dir: /home/manhquy/Downloads/cmc_edu/plans/reports/uat-live-20260815-170850/
- total: 5 | passed: 5 | failed: 0 | skipped: 0

## super admin logs in (forced rotation on the very first login) and creates sale/GĐKD/GĐĐT/GV via /admin/users — passed (14s)

### Data created (cleanup log)
- [staff-account] sale email: live-sale-630bcfbb@cmcvn.edu.vn
- [staff-account] sale userId: live-sale-630bcfbb
- [staff-account] giam_doc_kinh_doanh email: live-giam_doc_kinh_doanh-630bcfbb@cmcvn.edu.vn
- [staff-account] giam_doc_kinh_doanh userId: live-giam_doc_kinh_doanh-630bcfbb
- [staff-account] giam_doc_dao_tao email: live-giam_doc_dao_tao-630bcfbb@cmcvn.edu.vn
- [staff-account] giam_doc_dao_tao userId: live-giam_doc_dao_tao-630bcfbb
- [staff-account] giao_vien email: live-giao_vien-630bcfbb@cmcvn.edu.vn
- [staff-account] giao_vien userId: live-giao_vien-630bcfbb

## sale creates a lead on /crm and advances it to O4_TESTED with real clicks — passed (7s)

### Data created (cleanup log)
- [opportunity] lead name (→ student name): Live Lead 630bcfbb
- [opportunity] lead phone: 0965332587

## sale creates the receipt from the CRM opportunity; GĐKD approves it → student + active enrollment — passed (19s)

### Data created (cleanup log)
- [class-batch] enrollment class code: CMCDEVEL-UCREA-2026-001
- [receipt] receipt code: SO00001
- [parent-email] parent email (LMS OTP): live-parent-630bcfbb@example.com
- [enrollment] student (activated by approval): Live Lead 630bcfbb

## GĐĐT sees the new class; the teacher marks the student present on today's session — passed (39s)

### Data created (cleanup log)
- [class-batch] attendance class code: CMCDEVEL-UCREA-2026-002
- [course] course name: Live Attendance Course 630bcfbb
- [receipt] class-B activation receipt: SO00002
- [attendance] session attendance (present): Live Lead 630bcfbb

## super admin filters the audit log by action and sees the campaign's entries — passed (4s)

