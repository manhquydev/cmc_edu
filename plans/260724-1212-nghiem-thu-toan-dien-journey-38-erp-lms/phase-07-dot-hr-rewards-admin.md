---
phase: 7
title: "Đợt HR/payroll + rewards/admin"
status: partial
completed: '2026-07-25 — ADM-01/02/03/04/05 + P3-09 + P3-03/04/07(shift) + P3-05(payroll assemble→finalize) + P4-03(họp PH) + P4-05(sau bán tạo→tiếp nhận→giải quyết→đóng) xanh 4×; P3-10/11 no-ui-path (V7); sổ 27/38 (P3-05 đóng false-green roster; P4-03 + P4-05 là count-mover mới +2)'
remaining: 'Còn 4 luồng chưa có journey, đều đã khảo sát là KHẢ THI (không cái nào phải red-fixme): (a) P3-06/P3-08 kpi-confirm + bulkApprove — RỦI RO TIME-TRAVEL ĐÃ GỠ 2026-07-26: submitSlipOpensAt(period) = ngày 3 tháng kế tiếp ICT (apps/api/src/kpi/auto-score.ts:275), nên kỳ 2026-06 mở từ 2026-07-03, hôm nay đã qua ⇒ dùng kỳ QUÁ KHỨ là chạy được tự nhiên, KHÔNG cần mock đồng hồ; vẫn cần seed managerId (B1/V6) + SalaryRate.tier (submitSlip chặn nếu chưa gán bậc). (b) P4-04 test đầu vào — crm.opportunityCreate có UI thật (create-lead-dialog) nên tạo Opportunity qua UI được. (c) P1-06 liên kết PH–con — màn /admin/parents có thật (guardian.listPendingLinks/approveLink/rejectLink); cần dựng được một pending link trước. Trần qua journey = 31/38; 7 luồng no-ui-path là gap có hồ sơ. Fixture student: seedStudent (db.ts) — không có student.create UI.'
report: 'plans/reports/phase-07-part1-admin-260725-1920-report.md'
priority: P2
effort: "3-4d"
dependencies: [6]
---

# Phase 7: Đợt HR/payroll + rewards/admin

## Overview
Đợt cuối ERP theo D4: flow thuộc cột `đợt`="HR" + "rewards-admin" trong triage Phase 2 (shift, punch/check-in offsite, KPI, payroll, rewards, meeting, appointment, after-sale, super-admin, facility, audit log) chưa có journey. Sau đợt này, 38/38 flow ERP có trạng thái máy-chứng.

## Requirements
- Functional: như Phase 5; payroll chú ý khuôn 2 ngoại lệ đã có tiền lệ trong journey F4 hiện hành (nhân sự tạo qua UI `create-staff-via-admin-ui`, KHÔNG seedAppUser — bài học instance 2a fabricated-approvals).
- Non-functional: khuôn TDD/negative giữ nguyên; flow admin cần vai `super_admin` — dùng bootstrap super_admin sẵn có (seed tối thiểu hợp lệ theo Q5).

## Architecture
Như Phase 5/6. Flow KPI/payroll phụ thuộc dữ liệu thời gian (punch theo ngày) → dùng đồng hồ dữ liệu trong-ngày-test, không mock thời gian hệ thống (giữ hành vi thật; nếu flow cần "qua tháng" thì đó là ứng viên statusReason `red-fixme` với lý do "cần time-travel — quyết ở plan sửa", không hack).

## Related Code Files
- Create: `apps/e2e/tests/journeys/<flow>.journey.ui.spec.ts` theo triage; helper mới nếu đạt ngưỡng
- Modify: `scripts/acceptance-report/flow-manifest.ts`

## Implementation Steps
1. Lặp khuôn Phase 5 bước 1–4 cho từng flow đợt này.
2. Flow phụ thuộc thời gian: ghi rõ trong spec dữ liệu ngày nào được tạo và assertion đọc theo ngày đó; nếu bất khả trong 1 phiên chạy → statusReason nghi thức.
3. Kết đợt (nghi thức RT-9): 4× spec-của-đợt + 1× full suite (full-suite 4× liên tiếp dồn về Phase 8); regen report — thời điểm này 38/38 ERP có trạng thái.

## Success Criteria
- [ ] 38/38 flow ERP có trạng thái máy-chứng trong sổ (proven/đỏ-fixme/no-ui-path — 0 not-written trừ khi triage xếp "trùng")
- [ ] 4× spec-của-đợt xanh liên tiếp + 1× full suite xanh
- [ ] Không có `seedAppUser` mới nào cho nhân sự (đường UI đã chứng minh tồn tại)

## Risk Assessment
- Payroll "qua kỳ lương" có thể không tái hiện trong 1 run → chấp nhận red-fixme trung thực thay vì mock đồng hồ (đổi hành vi test ≠ đổi hành vi app; mock time là quyết định thuộc plan sửa).
- Mệt mỏi cuối chặng → mỗi flow vẫn bắt buộc đủ ô bằng-chứng như Phase 2 đã lập.
