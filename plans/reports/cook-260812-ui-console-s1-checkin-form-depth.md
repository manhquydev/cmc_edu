# Cook report — S1 check-in `manualPunch` form-depth

**Date:** 2026-08-12  
**Worker:** Grok `ui-console`  
**Mode:** `ak:cook --auto --tdd`  
**Branch:** `feat/lms-foundation-unit-range-spike` (PR #110)  
**Authority:** `docs/ux-resource-centric-structure.md` · scout  
`plans/reports/scout-260812-ui-workspace-residual-matrix.md` §6 S1

---

## Contract

| Field | Content |
|-------|---------|
| **Outcome** | List Hàng chờ is index-only; form UUID owns Duyệt/Từ chối for ManualAttendanceTicket. |
| **Constraints** | Keep parents link-request Duyệt. No free TEKY teal. No API shape break on existing mutations. No PR merge. |
| **Non-goals** | Rewards demote (S2), exercises, workspace docs (S3). |
| **Acceptance** | `manualPunch.get` + list demote + `/hr/checkin/:ticketId` form + unit green + push. |

**Product ambiguity:** none — dialog-as-form was residual dual-HITL (GAP #1), not intentional forever. Form-depth matches shifts/KPI/aftersale recipe.

---

## Changes

| Surface | Change |
|---------|--------|
| `apps/api/src/checkin/router.ts` | **`manualPunch.get`** — owner OR track reviewer / super_admin; includes `appUser` |
| `packages/links` | `links.manualPunchTicket(id)` → `/hr/checkin/:id`; `checkInPath({scope})` |
| `hr.routes.tsx` | `checkin/:ticketId` → new detail page |
| `check-in-out.tsx` | Inbox row **Mở phiếu** navigate; remove list approve/reject + detail Dialog |
| `check-in-ticket-detail.tsx` | **NEW** form: EntityHeader + statusbar + dayPunches + ConfirmDialog Duyệt + reject dialog |
| e2e P3-02 journey | Mở phiếu → form ConfirmDialog Duyệt |

### Access model (`get`)

- Owner: own ticket  
- Director: same track as `canReviewTicket`  
- `super_admin`: any  
- Peer / wrong track: FORBIDDEN  
- Missing: NOT_FOUND  

### HITL move

```
LIST  /hr/checkin?scope=inbox  →  Mở phiếu only
FORM  /hr/checkin/:ticketId    →  Duyệt (ConfirmDialog) / Từ chối (reason dialog)
```

Parents link-request list Duyệt: **untouched**.

---

## Validation

| Suite | Result |
|-------|--------|
| API `manualPunch.get` (5) | pass |
| links `index.test.ts` (16) | pass |
| admin check-in-out + ticket-detail + hr.routes (30) | pass |
| Full `manual-punch-approval-track` (optional re-run) | get subset green with `.env` |

e2e journey source updated; not run in this cook (unit gate per request). CI `ui-e2e` will exercise P3-02 on PR.

**GitNexus impact:** `manualPunchRouter` LOW (additive get); `ApproveTicketsTab` LOW (list consumers).

---

## Residual

- Rewards dual-HITL (S2)  
- Exercises publish/close (GAP #3)  
- Payroll/report-cards Console grammar (additive)

---

## Status

**DONE** — S1 form-depth landed with TDD evidence.
