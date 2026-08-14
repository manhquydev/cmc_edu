# Live UI audit — OpenEduCat fidelity (260814-0945)

> **Re-run 11:21 (+07) after #139 + `rebuild-cmcv2-admin.sh`.** Folder id kept; body below is the post-rebuild measure (P0 CP+CTA MATCH). Baseline FAIL narrative: `INDEX.md`.

Target: `https://erp.localhost` @ 1280×900 · role admin · contract OPENEDUCAT-VISUAL-CONTRACT

## Summary

| Sev | Count |
|-----|------:|
| critical | 0 |
| P0 | 1 |
| P1 | 6 |
| P2 | 0 |
| warn | 4 |

## Top defects (unique)

- **P0** [`design`] statusbar NOT inside .console-form-sheet
- **P1** [`hr-payroll`] search radius 0px (want pill 999px)
- **P1** [`users-list`] search radius 4px (want pill 999px)
- **P1** [`audit-log`] list row 57px (want ~40)
- **P1** [`hr-payroll`] search height 20px (want 35)
- **warn** [`receipt-detail`] no detail link found

## Pages

- `cockpit` /cockpit — CP —px · blueBtns 0 · statusbar — · [shot](./shots/cockpit.png)
- `students-list` /admin/students — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/students-list.png)
- `courses-list` /admin/courses — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/courses-list.png)
- `classes-list` /admin/classes — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/classes-list.png)
- `parents-list` /admin/parents — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/parents-list.png)
- `users-list` /admin/users — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/users-list.png)
- `crm-pipeline` /crm — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/crm-pipeline.png)
- `finance-list` /finance — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/finance-list.png)
- `schedule` /teaching/schedule — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/schedule.png)
- `attendance` /teaching/attendance — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/attendance.png)
- `exercises` /teaching/exercises — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/exercises.png)
- `audit-log` /admin/audit-log — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/audit-log.png)
- `hr-shifts` /hr/shifts — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/hr-shifts.png)
- `hr-payroll` /hr/payroll — CP 58px · blueBtns 0 · statusbar — · [shot](./shots/hr-payroll.png)
- `design` /design — CP 67px · blueBtns 0 · statusbar OUT · [shot](./shots/design.png)
- `student-detail` — skipped/error
- `class-detail` — skipped/error
- `opportunity-detail` — skipped/error
- `receipt-detail` — skipped/error

Artifacts: `/home/manhquy/Downloads/cmc_edu/plans/reports/live-ui-audit-260814-0945`