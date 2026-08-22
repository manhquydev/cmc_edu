# Scout Report — Staff Activity Timeline

## Relevant Files
- `apps/admin/src/pages/hr/staff/staff-detail.tsx` — detail shell owns `trpc.user.get`, validates UUID/permissions/return path, supplies `staff` + `backPath` through `Outlet`; tabs currently Profile/Access only. Add Activity URL/tab here.
- `apps/admin/src/pages/hr/staff/profile.tsx` — profile child consumes outlet context; no timeline concern.
- `apps/admin/src/pages/hr/staff/access.tsx` — explicit roles/password actions; password remains dialog-local.
- `apps/admin/src/routes/hr.routes.tsx` — lazy imports, Suspense+Skeleton wrapper, static `/new` before `:staffId`; base detail redirects to profile; profile/access are route-owned nested children. Activity must match this layout.
- `apps/admin/src/routes/hr.routes.test.tsx` — mocks shell/children; tests base redirect plus Profile/Access route resolution. Add activity mock/route assertion.
- `packages/links/src/index.ts` — canonical helpers: `staffProfilePath`, `staffAccessPath`; no activity helper yet. Update public links/tests if adding route.
- `packages/ui/src/components/record-timeline.tsx` — presentational only; props: `items`, `nextCursor`, optional `onLoadMore`, `onAddNote`, `pending`, `historySince`. Client entity never enters props. Empty state appears only without epoch; epoch renders `Lịch sử ghi từ dd/mm/yyyy` ICT.
- `packages/ui/src/components/record-timeline.test.tsx` — asserts unknown labels/raw JSON suppression, epoch display, pagination, trimmed note callback.
- `apps/admin/src/pages/crm/opportunity-detail.tsx` — only current consumer. First-page query + accumulated `moreItems`; reset accumulation when `id`/`timelineUpdatedAt` changes; fetch cursor through `utils.crm.opportunityTimeline.fetch`; passes pending, epoch, optional note action.
- `apps/admin/src/pages/crm/opportunity-detail.test.tsx` — baseline consumer assertions: timeline renders, later pages append, loaded pages reset after first-page refresh.
- `apps/api/src/crm/router.ts`, `apps/api/src/crm/record-event.ts`, `apps/api/src/crm/record-event.test.ts` — reference contract: fixed server entity, parent facility authorization before event read, newest-first composite cursor (createdAt,id), safe labels, unknown payload null, epoch when no created event.
- `plans/260817-1354-resource-detail-and-operational-timeline-depth/phase-04-operational-timeline-and-compliance-audit-separation.md` — authoritative pending design: domain-owned `user.timeline`; AppUser entity fixed server-side; staff-specific epoch; planned `activity.tsx` and `/hr/staff/:staffId/activity`; event allowlist excludes secrets.

## Conventions
- Detail sections use `/hr/staff/:staffId/<section>`, lazy import, `Suspense fallback={<Fallback />}`, shell plus index child.
- Base `/hr/staff/:staffId` redirects with `replace` to default Profile. Preserve this default; Activity is explicit.
- UI should reuse `RecordTimeline`; no component API gap identified.
- Timeline needs a staff-owned API/epoch. Do not reuse CRM entity, permission, labels, or `RECORD_EVENT_HISTORY_SINCE`.
- Expected staff event contract already frozen: `created {}`, `profile_updated {fields[]}`, `roles_updated {roles[]}`, `password_reset {}`, `activated {}`, `deactivated {}`, `manager_changed {managerId|null}`. No old/new profile values or credential-shaped data.

## Tests To Add
- Route test: activity section resolves through shell.
- Staff activity UI test: query input, empty/epoch state, cursor append/reset; reuse CRM consumer test shape.
- API: same-facility allowed, cross-facility no leakage, cursor non-overlap, mutation-transaction atomicity, fixed entity boundary, safe actor projection, password payload exclusion.

## Unresolved Questions
- None for scaffolding. API persistence/event emission remains unimplemented; plan labels Phase 4 `todo`.

Status: DONE
Summary: Read-only scout completed. Staff shell, route pattern, shared timeline contract, CRM consumer, epoch behavior, planned domain boundary mapped.
Concerns/Blockers: Staff operational timeline API/events do not yet exist; required before exposing Activity route.
