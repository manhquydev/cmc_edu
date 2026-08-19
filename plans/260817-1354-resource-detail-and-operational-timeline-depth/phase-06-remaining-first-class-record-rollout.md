---
title: "Phase 6: Remaining First Class Record Rollout"
status: todo
---

# Phase 6: Remaining First Class Record Rollout

## Overview

**Priority:** P1 · **Depends on:** Phase 5

Roll the proven staff/detail/timeline contract across remaining true records, one protected PR series
per module. Never run these module series concurrently against shared route/link files.

## Requirements

- [ ] Existing core records receive operational events/timeline where business history matters.
- [ ] ParentMeeting receives `get`, link, detail and lifecycle actions on the record.
- [ ] Existing newer records are audited for missing create-success/timeline only; do not rebuild them.
- [ ] Course and Gift remain source-backed config catalogs; no detail/update is invented here.
- [ ] Every module series passes its own API/UI/deep-link gate before the next starts.

## Module status

| Module | Status |
|---|---|
| 1 Class | Done (PR #159, CI green on 808d89d, merged 2026-08-19). Follow-ups: load-more dedup in class-activity.tsx; denied-role timeline test. |
| 2 Student | Implemented; final local gates green (API 1308/1308, Admin 712/712, typecheck 34/34, acceptance manifest 0 unclassified). PR/CI pending. |

## Rollout matrix

| Order | Module | Required delta |
|---|---|---|
| 1 | Class | timeline for material class/session/roster changes; URL tabs already Phase 5 |
| 2 | Student | lifecycle/enrollment/guardian events + timeline |
| 3 | Parent | email/active/child-link events + timeline |
| 4 | Receipt | approve/cancel/refund/provisioning events + timeline without leaking money beyond existing receipt readers |
| 5 | ParentMeeting | canonical D8 routes; `get`, link/go, detail; schedule→detail; complete/cancel on detail; timeline |
| 6 | AfterSale/Reward/Exercise/Shift/KPI/PunchTicket/Session | gap-only sweep; reuse existing detail |
| Exempt | Course | minimal two-field catalog; curriculum/update semantics require separate authority |
| Exempt | Gift | catalog configuration; Reward owns the transactional lifecycle |

## Per-module architecture contract

1. Server: facility-scoped `get`; parent authorization; domain-owned timeline.
2. Link: canonical builder and optional `/go`.
3. Route: static `/new` before `/:id`; permission gate aligned to API.
4. List: row click to detail; dedicated `/new` success replaces compose; modal create success pushes.
5. Detail: `DetailPage`, real actions, timeline, no partial “roles-only” work surface.
6. Proof: API authorization, UI action, cold/F5/back/share.

For each module, freeze an actor × record × action matrix and an event-producer map before edits.
The producer map must include cross-domain routers, provisioning helpers and workers that mutate the
record; PR ownership follows producers, not directory names. Do not reuse a mutation key
as a read key when the module has multiple action rosters; ParentAccount is the known example
(`read`, `updateEmail` and `setActive` differ).

## File inventory

Each module series owns only its domain router/page/tests plus the shared integration files below:

| Shared file | Ownership rule |
|---|---|
| `packages/links/src/index.ts` | one module PR at a time |
| `apps/admin/src/routes/*.routes.tsx` | one route-domain PR at a time |
| `apps/api/src/router.ts` | only if a new router is required |
| `packages/ui/src/components/record-timeline.tsx` | no module-specific behavior |

Domain files include `apps/api/src/{class,student,parentAccount,finance,meeting,...}`,
their Admin pages, and adjacent tests.

## Implementation Steps

1. At each module start, refresh its inventory row and verify no newer detail contract exists.
2. Run GitNexus impact on every symbol to modify; warn on HIGH/CRITICAL blast radius.
3. Freeze the entity event-kind × producer × transaction-owner map.
4. Write API authorization and event tests first.
5. Add/repair get, links, routes, list/create navigation and detail actions.
6. Emit allowlisted operational events at every mapped producer using its transaction boundary.
7. Add UI timeline and deep-link tests.
8. Run focused API/Admin tests, affected package typechecks, `git diff --check`, and
   `detect_changes()` before opening the module PR.
9. Push the final commit and require terminal-green `typecheck-and-test` plus `ui-e2e` on that exact
   PR head SHA before merging or starting the next module.

## Test scenario matrix per module

| Layer | Required cases |
|---|---|
| API get | allowed role, denied role, cross-facility, missing id |
| Timeline | parent authorized first, cursor order, secret/PII allowlist |
| Routing | list/new/id order, base redirect, invalid UUID |
| UI | row/create→detail, F5, action error, empty timeline |
| Navigation | back/query preservation, `/go` if registered |
| Regression | existing domain lifecycle tests |
| CI identity | required checks belong to the final PR head SHA, not an earlier push |

## Success Criteria

- ParentMeeting is no longer popup/list-only.
- Core existing detail records show tenant-safe material history.
- Existing modern detail pages are repaired, not duplicated.
- Course/Gift/config/workspace exceptions remain documented.
- Each module series has independent green evidence.

## Risks

- **Program too large:** strict one-module gates and order; stop on failed shared contract.
- **Timeline payload leaks:** per-domain allowlist tests.
- **Permission-key mismatch:** module-specific read/action matrix before choosing route and timeline gates.
- **Duplicate AuditLog/RecordEvent expectations:** document different semantics.
- **Shared-file conflicts:** sequential ownership.

## Rollback per module

- Revert one module PR series without reverting earlier proven modules.
- Compatibility redirects remain until their canonical replacement is confirmed in production;
  a rollback may point the legacy path back to the prior queue but must not expose two editable
  details.
- Already-written `RecordEvent` rows remain append-only and may become temporarily invisible;
  never delete them as rollback.

## Security considerations

Timeline visibility follows authorized record visibility, not a generic `timeline.read` shortcut.
Finance/student/family payloads must not expose fields absent from the existing detail API.
