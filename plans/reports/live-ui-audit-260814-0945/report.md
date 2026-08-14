# Live UI audit — OpenEduCat fidelity (260814-0945)

Target: `https://erp.localhost` @ 1280×900 · role admin · contract OPENEDUCAT-VISUAL-CONTRACT

## Summary

| Sev | Count |
|-----|------:|
| critical | 0 |
| P0 | 33 |
| P1 | 20 |
| P2 | 0 |
| warn | 4 |

## Top defects (unique)

- **P0** [`exercises`] CP height 149px (pack ~58)
- **P0** [`finance-list`] CP height 208px (pack ~58)
- **P0** [`courses-list`] Apple-blue primary button: "+ Tạo khoá"
- **P0** [`courses-list`] primary CTA blue not purple: "+ Tạo khoá"
- **P0** [`crm-pipeline`] primary CTA blue not purple: "Tạo"
- **P0** [`classes-list`] CP height 219px (pack ~58)
- **P0** [`classes-list`] Apple-blue primary button: "+ Tạo lớp"
- **P0** [`classes-list`] primary CTA blue not purple: "+ Tạo lớp"
- **P0** [`classes-list`] primary CTA blue not purple: "Tạo lớp"
- **P0** [`parents-list`] CP height 130px (pack ~58)
- **P0** [`users-list`] Apple-blue primary button: "Thêm nhân viên"
- **P0** [`users-list`] primary CTA blue not purple: "Thêm nhân viên"
- **P0** [`users-list`] primary CTA blue not purple: "Lưu"
- **P0** [`crm-pipeline`] CP height 142px (pack ~58)
- **P0** [`crm-pipeline`] Apple-blue primary button: "Thêm cơ hội"
- **P0** [`crm-pipeline`] Apple-blue primary button: "Ghi danh"
- **P0** [`crm-pipeline`] primary CTA blue not purple: "Thêm cơ hội"
- **P0** [`finance-list`] Apple-blue primary button: "+ Tạo phiếu thu"
- **P0** [`finance-list`] primary CTA blue not purple: "+ Tạo phiếu thu"
- **P0** [`exercises`] Apple-blue primary button: "+ Tạo bài tập"
- **P0** [`exercises`] primary CTA blue not purple: "+ Tạo bài tập"
- **P0** [`exercises`] primary CTA blue not purple: "Tạo thư mục"
- **P0** [`exercises`] primary CTA blue not purple: "Tạo bài tập"
- **P0** [`audit-log`] CP height 204px (pack ~58)
- **P0** [`hr-shifts`] CP height 89px (pack ~58)
- **P0** [`hr-shifts`] Apple-blue primary button: "Soạn phiếu mới"
- **P0** [`hr-payroll`] CP height 160px (pack ~58)
- **P0** [`design`] statusbar NOT inside .console-form-sheet
- **P1** [`hr-payroll`] search height 20px (want 35)
- **P1** [`hr-payroll`] search radius 0px (want pill 999px)
- **P1** [`classes-list`] list row 30px (want ~40)
- **P1** [`users-list`] search radius 12px (want pill 999px)
- **P1** [`audit-log`] list row 52px (want ~40)
- **P1** [`hr-payroll`] list row 31px (want ~40)
- **warn** [`receipt-detail`] no detail link found

## Pages

- `cockpit` /cockpit — CP —px · blueBtns 0 · statusbar — · [shot](./shots/cockpit.png)
- `students-list` /admin/students — CP 149px · blueBtns 0 · statusbar — · [shot](./shots/students-list.png)
- `courses-list` /admin/courses — CP 208px · blueBtns 1 · statusbar — · [shot](./shots/courses-list.png)
- `classes-list` /admin/classes — CP 219px · blueBtns 1 · statusbar — · [shot](./shots/classes-list.png)
- `parents-list` /admin/parents — CP 130px · blueBtns 0 · statusbar — · [shot](./shots/parents-list.png)
- `users-list` /admin/users — CP 208px · blueBtns 1 · statusbar — · [shot](./shots/users-list.png)
- `crm-pipeline` /crm — CP 142px · blueBtns 2 · statusbar — · [shot](./shots/crm-pipeline.png)
- `finance-list` /finance — CP 208px · blueBtns 1 · statusbar — · [shot](./shots/finance-list.png)
- `schedule` /teaching/schedule — CP 142px · blueBtns 0 · statusbar — · [shot](./shots/schedule.png)
- `attendance` /teaching/attendance — CP 69px · blueBtns 0 · statusbar — · [shot](./shots/attendance.png)
- `exercises` /teaching/exercises — CP 149px · blueBtns 1 · statusbar — · [shot](./shots/exercises.png)
- `audit-log` /admin/audit-log — CP 204px · blueBtns 0 · statusbar — · [shot](./shots/audit-log.png)
- `hr-shifts` /hr/shifts — CP 89px · blueBtns 1 · statusbar — · [shot](./shots/hr-shifts.png)
- `hr-payroll` /hr/payroll — CP 160px · blueBtns 0 · statusbar — · [shot](./shots/hr-payroll.png)
- `design` /design — CP 65px · blueBtns 0 · statusbar OUT · [shot](./shots/design.png)
- `student-detail` — skipped/error
- `class-detail` — skipped/error
- `opportunity-detail` — skipped/error
- `receipt-detail` — skipped/error

Artifacts: `/home/manhquy/Downloads/cmc_edu/plans/reports/live-ui-audit-260814-0945`