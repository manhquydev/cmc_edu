---
title: "Phase 3: Selective Timeline Fills"
status: pending
---

# Phase 3: Selective Timeline Fills

**Priority:** P2 · **Depends on:** Phase 2

Close the `timeline-gap` exceptions honestly (RL6): add operational timelines only where value is
real, and explicitly document the rest.

## Requirements

- [ ] AfterSaleCase operational timeline (emit + `*.timeline` + `RecordTimeline` UI).
- [ ] ShiftRegistration operational timeline (emit + `*.timeline` + `RecordTimeline` UI).
- [ ] Document Reward / KpiScore / ManualAttendanceTicket as **AuditLog-only by decision**.
- [ ] Document Exercise's substrate limitation (global, no `facilityId`) — no `RecordEvent`.
- [ ] Remove the corresponding `timeline-gap` exceptions from `scripts/resource-depth-audit.mjs`
  for the two entities that gain timelines; keep/annotate the rest as intentional.
- [ ] CI green.

## Pattern (reuse, do not generalize)

Follow the existing domain-owned seam:

- `apps/api/src/<domain>/record-event.ts` — closed `kind` union + allowlisted `payload` per
  `(entity, kind)`; write via `appendRecordEvent` inside the domain mutation's transaction.
- `<domain> .timeline` procedure — authorize the parent record in-facility first, then
  `listRecordEventPage`.
- Detail page mounts `RecordTimeline` (`packages/ui`).

### AfterSaleCase kinds (proposed)

`created`, `status_changed` (open→in_progress→resolved→closed), `assigned`, `note`.

### ShiftRegistration kinds (proposed)

`submitted`, `approved`, `rejected`, `cancelled`.

Exact kinds finalized against the domain routers at implementation time; payloads secret-free.

## File inventory

| Path | Action |
|---|---|
| `apps/api/src/aftersale/record-event.ts` + timeline procedure | create |
| `apps/api/src/shift/record-event.ts` + timeline procedure | create |
| `apps/admin/src/pages/crm/aftersale-detail.tsx` | mount `RecordTimeline` |
| `apps/admin/src/pages/attendance/shifts-detail.tsx` | mount `RecordTimeline` |
| `scripts/resource-depth-audit.mjs` | move aftersale/shift out of `timeline-gap`; annotate rest |
| `plans/.../reports/timeline-gap-closure.md` | record the AuditLog-only decisions |
| tests (unit timeline authz + facility isolation; e2e mount) | add |

## Acceptance

- Aftersale + shift detail pages show a facility-scoped, RLS-safe operational timeline.
- Timeline procedures authorize the parent record first; payload allowlists enforced; secret-free.
- The four AuditLog-only entities and Exercise's limitation are documented.
- `resource-depth:audit` reflects the reduced gap set.
- CI green.

## Security

- Reuse per-domain authorization (no generic `entity/entityId` endpoint).
- Payload allowlists per `(entity, kind)`; never raw mutation input; credential actions secret-free.
