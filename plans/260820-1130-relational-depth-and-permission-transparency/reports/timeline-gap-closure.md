# Timeline gap closure (RL6)

Phase 3 added operational `RecordEvent` timelines for **AfterSaleCase** and
**ShiftRegistration** only. The remaining `timeline-gap` audit exceptions are
intentional, not unfinished work.

## Closed in this phase

| Entity | Route | Kinds |
|---|---|---|
| AfterSaleCase | `/crm/aftersale/:caseId` | `created`, `status_changed` |
| ShiftRegistration | `/hr/shifts/:registrationId` | `submitted`, `approved`, `rejected`, `cancelled` |

AfterSaleCase has no assign or note mutations; those proposed kinds were not
invented. Status hops are `open → in_progress → resolved → closed`.

## Stay AuditLog-only (decision, not omission)

- **Reward** (`/admin/engagement/rewards/:rewardId`)
- **KpiScore** (`/hr/kpi/:scoreId`)
- **ManualAttendanceTicket** (`/hr/checkin/:ticketId`)

These keep the compliance `AuditLog` ledger. No operational `RecordEvent`
timeline will be added without a new decision.

## Cannot use RecordEvent

- **Exercise** (`/teaching/exercises/:exerciseId`) is a global catalog with no
  `facilityId`. `RecordEvent` is facility-scoped and RLS-forced. A future
  exercise timeline needs a different substrate and its own decision.

`ClassSession` continues to emit onto `ClassBatch` (classified
`workspace-detail`). Not reopened here.
