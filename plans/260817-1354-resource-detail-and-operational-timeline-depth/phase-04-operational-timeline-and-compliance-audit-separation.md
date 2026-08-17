---
title: "Phase 4: Operational Timeline and Compliance Audit Separation"
status: todo
---

# Phase 4: Operational Timeline and Compliance Audit Separation

## Overview

**Priority:** P0 · **Depends on:** Phase 3

Add a tenant-safe staff activity timeline and formally separate it from the global compliance log.
Improve compliance entity-link correctness without widening `audit.list`.

## Requirements

- [ ] Extract only the minimal shared `RecordEvent` persistence/cursor seam needed outside CRM.
- [ ] Define AppUser event kinds and allowlisted payloads.
- [ ] Emit staff create/profile/access/active/reset events in the same transaction as the mutation.
- [ ] Password events contain no password, hash, token, OTP or credential metadata.
- [ ] Freeze exact AppUser event payloads:
  `created {}`, `profile_updated {fields[]}`, `roles_updated {roles[]}`,
  `password_reset {}`, `activated {}`, `deactivated {}`,
  `manager_changed {managerId|null}`. Never store old/new email, name or position.
- [ ] Timeline actor is a server-projected safe identity/label, not a raw userId.
- [ ] Add domain-owned `user.timeline`; it authorizes the AppUser before reading events.
- [ ] Add `/hr/staff/:staffId/activity` only now, then render `RecordTimeline` with a
  Staff-specific truthful history epoch.
- [ ] Keep `audit.list` super-admin-only.
- [ ] Add `entityId` filter and current-facility-resolvable record links to the global audit viewer.
- [ ] Fix ambiguous `AuditLog` entity/id derivation through an action-aware exception registry;
  do not globally reverse input/result precedence.

## Architecture

`RecordEvent` is the operational source. A low-level helper may append/list by fixed server-side
entity, but event labels and payload schemas remain in each domain. `user.timeline` hardcodes
`AppUser` and validates the parent through the same facility and permission contract as `user.get`.
Each domain owns its own `historySince`; do not reuse the CRM date constant for Staff.

`AuditLog` remains best-effort compliance telemetry. Its UI may link known canonical entities through
an allowlisted server/client mapping only after current-facility resolvability is proven; unknown,
other-facility, deleted or empty targets render as plain text.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `apps/api/src/crm/record-event.ts` | refactor minimally | retain CRM semantics; use shared store seam |
| `apps/api/src/record-event/store.ts` | create | append/cursor primitives only |
| `apps/api/src/user/record-event.ts` | create | AppUser event kinds/payload allowlist |
| `apps/api/src/user/router.ts` | modify | transactional emit + timeline |
| `apps/api/src/audit/audit-helpers.ts` | modify | action-aware entity/id override tests; preserve default precedence |
| `apps/api/src/audit/router.ts` | modify | entityId filter; no permission widening |
| `apps/admin/src/pages/hr/staff/activity.tsx` | create | timeline |
| `apps/admin/src/routes/hr.routes.tsx` | modify | expose activity only when functional |
| `apps/admin/src/pages/admin/audit-log.tsx` | modify | entityId filter + safe links |
| `packages/ui/src/components/record-timeline.tsx` | reuse; modify only for proven shared gap | shared display |
| API/Admin/UI tests | modify/create | RLS, payload, cursor, links |

## Implementation Steps

Deliver as two protected PRs: **4A Staff operational timeline** and **4B compliance-link
correctness**. Each PR independently passes required CI and can be reverted without removing the
other ledger.

1. In 4A, write security tests before refactoring `RecordEvent`.
2. Extract storage/cursor seam; keep CRM tests green.
3. Define AppUser event contract: `created`, `profile_updated`, `roles_updated`,
   `password_reset`, `activated`, `deactivated`, `manager_changed`.
4. Emit in the mutation transaction; avoid duplicate logical events.
5. Implement `user.timeline` with parent authorization and cursor pagination.
6. Render staff activity and empty/history-epoch states.
7. In 4B, add `audit.list.entityId`; add narrowly scoped action-aware entity/id overrides with
   regression tests.
8. Build and test the mutation manifest, including `user.create`, `afterSale.create`,
   `parentMeeting.schedule` and `testAppointment.schedule`.
9. Add safe link mapping only for entities registered in `@cmc/links` and resolvable in the current
   facility.

## Test scenario matrix

| Scenario | Expected |
|---|---|
| Profile mutation commits | record + one event commit together |
| Mutation rolls back | no event |
| Director reads same-facility timeline | allowed |
| Cross-facility UUID | not found / zero leakage |
| Client changes entity string | impossible; endpoint hardcodes it |
| Password reset event | no secret values or secret-shaped keys |
| Director timeline actor | safe server projection, no raw hidden/internal identifier |
| Audit `user.create` | entityId is created AppUser UUID |
| Audit create/schedule manifest | every ambiguous action resolves to its owned result or stays unlinked |
| Director calls `audit.list` | forbidden |
| Unknown audit entity | no unsafe link |
| Other-facility/deleted audit target | plain text, no broken or widened detail link |

## Success Criteria

- Staff activity is operationally useful and tenant-safe.
- CRM timeline behavior remains unchanged.
- Global audit remains restricted and can filter/link correct entity ids.
- No event payload leaks secrets; focused API/UI tests pass.

## Risks

- **Generic-router confused deputy:** forbidden by domain-owned endpoints.
- **Split transaction:** event emit must receive the same transaction client.
- **Duplicate history:** one logical event per state transition; middleware AuditLog is separate semantics.
- **Historical expectations:** explicit “recorded from rollout” copy.

## Security considerations

`RecordEvent` keeps FORCE RLS and SELECT/INSERT-only grants. Payloads are allowlists, not sanitized
raw input. `AuditLog` permission stays `audit.list` with no director roster.

## Rollback

- Reverting 4A UI/API leaves already-written append-only Staff events intact and invisible; do not
  delete or rewrite them.
- Reverting 4B restores plain audit rows/links without affecting operational timelines.
- No backfill is required in either direction. History copy continues to state the per-domain
  recording epoch.
