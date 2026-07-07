# US-UI-06 HR + Finance screens

## Status

done

## Lane

normal

## Product Contract

Five screen groups in `apps/admin/src/pages/`:

1. **IP attendance** — check-in/out form (shared IP-validation logic with teaching attendance).
2. **Shift registration** — kanban board of open shifts + modal to register/withdraw.
3. **Payroll/KPI** — generic sortable DataTable showing payroll period + KPI score per employee.
4. **Revenue dashboard** — StatCard row (total, collected, pending) + DataTable of receipts by period.
5. **Reconciliation** — HOTL agent view listing flagged discrepancies for review/dismiss.

## Relevant Product Docs

- `docs/11-api-contract.md`
- `docs/24-doi-soat-doanh-thu.md`

## Risk Flags

- Authorization (IP attendance endpoint rejects requests from non-facility IPs)

## Acceptance Criteria

- IP attendance check-in endpoint validates request IP against facility subnet; mismatch → error.
- Shift registration modal saves shift assignment; confirmed shifts appear in list.
- Revenue dashboard StatCards display summed values from real DB data (no hardcoded fixtures).
- Reconciliation view lists HOTL flags; dismiss action removes row from list.

## Design Notes

- Commands: `hrAttendance.checkIn`, `hrAttendance.checkOut`, `shift.register`, `shift.withdraw`,
  `reconciliation.dismiss`.
- Queries: `payroll.list`, `kpi.list`, `revenue.dashboard`, `reconciliation.flags`.
- API: tRPC procedures.
- Tables: `HrAttendance`, `ShiftRegistration`, `PayrollPeriod`, `KpiScore`,
  `ReconciliationFlag` (existing from phase-5).
- Domain rules: IP validation shared with teaching attendance via `validateFacilityIp()` util.
- UI surfaces: `pages/hr/`, `pages/finance/revenue/`, `pages/finance/reconciliation/`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-UI-06 --unit 0 --integration 1 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | n/a. |
| Integration | Build + typecheck pass; IP check rejects non-matching IP. |
| E2E | n/a (covered by HR integration tests in prior phases). |
| Platform | `pnpm build` green for `apps/admin`. |
| Release | `pnpm typecheck` workspace-wide passes. |

## Harness Delta

No harness rule changes.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
