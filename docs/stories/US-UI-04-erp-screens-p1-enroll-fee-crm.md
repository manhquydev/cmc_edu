# US-UI-04 ERP screens P1 — enrollment + fee approval + CRM

## Status

done

## Lane

high-risk

## Product Contract

Three ERP screen groups in `apps/admin/src/pages/`:

1. **Enrollment form** — select students, opportunity, classBatch; creates an enrollment record.
2. **Fee approval master-detail** — receipt list + detail panel with SoD gate:
   - `canApprove` = `submittedBy !== currentUser AND role IN ('truong_phong','giam_doc_kinh_doanh','giam_doc_dao_tao','super_admin') AND NOT alreadyApprovedByCurrentUser`.
   - Over-threshold amounts (> configurable limit) require `giam_doc_dao_tao` or `super_admin`.
3. **CRM kanban** — opportunity cards draggable through stages O1 → O2 → O3 → O4 → O5.

## Relevant Product Docs

- `docs/11-api-contract.md`
- `docs/06-quan-ly-tuyen-sinh.md`
- `docs/10-ke-toan-va-thu-phi.md`
- `docs/12-quan-he-khach-hang.md`

## Risk Flags

- Authorization (SoD gate — `ke_toan` must not approve own receipts)
- Public contracts (enrollment and receipt procedures)
- Audit/security (approval actions logged with `approvedBy` + timestamp)

## Acceptance Criteria

- `ke_toan` role cannot approve receipts they submitted.
- `giam_doc_kinh_doanh` can approve under-threshold receipts.
- Over-threshold → only `giam_doc_dao_tao` or `super_admin` approval button enabled.
- CRM kanban renders opportunity cards with stage labels O1–O5.
- Drag-drop stage change persists on reload.

## Design Notes

- Commands: `enrollment.create`, `receipt.approve`, `opportunity.moveStage`.
- Queries: `enrollment.list`, `receipt.listPending`, `opportunity.kanban`.
- API: tRPC procedures; `canApprove` guard checked server-side.
- Tables: `Enrollment`, `Receipt`, `Opportunity` (existing).
- Domain rules: SoD = submitter ≠ approver; threshold configured via `FacilitySettings`.
- UI surfaces: `pages/enrollment/`, `pages/finance/fee-approval/`, `pages/crm/`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-UI-04 --unit 0 --integration 1 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | n/a. |
| Integration | `canApprove` logic unit-testable via tRPC caller. |
| E2E | `finance-approval.spec.ts` — 4 tests covering SoD, threshold, role-elevation. |
| Platform | `pnpm build` green for `apps/admin`. |
| Release | `pnpm test` passes all finance-approval specs. |

## Harness Delta

Adds `finance-approval.spec.ts`. No harness rule changes.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
