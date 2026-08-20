---
title: "Phase 1: Relational Cross-Linking"
status: pending
---

# Phase 1: Relational Cross-Linking

**Priority:** P1 · **Depends on:** predecessor chrome

Make first-class records navigable to each other. This is the user's #1 pain: detail pages exist
but entity references render as plain text. Reuse `@cmc/links`; do not build a relational framework.

## Requirements

- [ ] Add a presentational `RecordLink` component per decision RL1.
- [ ] Add the static `no_open` config-FK list per decision RL2.
- [ ] Wire the highest-leverage hops (below) using `RecordLink` + `links.*`.
- [ ] Resolve receipt `/finance/:id/activity` (register the section if a timeline renders there,
  else remove the dead NavLink) — no 404 tab.
- [ ] Tail: reconcile the nav/route/procedure gate mismatches (RL5).
- [ ] `resource-depth:audit`, `typecheck-and-test`, `ui-e2e` green.

## Hops to wire (evidence: `../reports/survey-260820-frame-coverage.md`)

Highest leverage first (ids already present in the payloads unless noted):

1. Session attendance/assessment rows → student — `pages/teaching/panels/attendance-panel.tsx` ~74-76, `assessment-panel.tsx` ~173+ (`studentId` on row) → `links.student`.
2. Session overview → class (make the class code a link, keep the button) — `session-detail.tsx` ~217 → `classSectionPath(id,'overview')`.
3. Session overview → teacher — `session-detail.tsx` overview KV ~215-222 (teacher not shown; add field) → `links.staff` when `staff.pickList`/`user.manage`, else text.
4. Class teacher control → staff — `class-detail.tsx` ~70-105, ~517 (`teacherAppUserId` loaded; keep picker, add name link) → `links.staff`.
5. Student enrollments → class — `students/enrollment-ranges-panel.tsx` ~76-80 (`batchCode` text). **Authz note:** the enrollments section is gated to `enrollment.grantUnits` (GĐĐT-only); wire the class link where read-eligible roles receive `classBatchId` (profile section or a payload they already get), never widen a payload (RL1).
6. Receipt/aftersale/reward/parent-meeting → student — `receipt-detail.tsx` ~281-282, `aftersale-detail.tsx` ~139/170/251, `rewards-detail.tsx` ~210/316, `parent-meeting-detail.tsx` ~126-127 → `links.student`.
7. KPI/shift → staff — `kpi-detail.tsx` ~278, `shifts-detail.tsx` ~382 → `links.staff`.
8. Student profile → parent — only if `student.get` already exposes `parentAccountId` (phone alone is not a stable hop); otherwise defer, do not widen payload.

Config FKs that stay text (RL2): program string (`class-detail.tsx` overview), room/classroom, course name.

## Receipt `/activity` resolution

Evidence: Receipt emits `RecordEvent` and `finance.receiptTimeline` exists (`finance/router.ts:922`),
and a timeline panel renders in `receipt-detail.tsx:562`; but `finance.routes.tsx` registers only
`overview|order-lines` while `receiptSectionPath` + a NavLink emit `activity`. Decide in scoping:
if the timeline should live on its own `/activity` section (matching student/class), register it and
add the audit entry; if it already renders under `overview`, remove the `activity` NavLink. No 404.

## Gate reconciliation (tail)

- `parentAccount.read` vs Parents nav leaf using `updateEmail` (`nav-registry.ts:55`) — GĐĐT holds
  `read` but can't reach the leaf; align the nav key to `parentAccount.read`.
- `gift.list` route gate vs `gift.upsert` nav — cosmetic; make gate/nav keys consistent.
- Prove each with a nav-visibility/route test; do not change API authority (RL5).

## File inventory

| Path | Action |
|---|---|
| `packages/ui/src/components/record-link.tsx` (or `apps/admin/src/lib/record-link.tsx`) | create |
| `apps/admin/src/lib/no-open-fields.ts` | create (static list) |
| session/class/student/receipt/aftersale/reward/kpi/shift/parent-meeting detail + panels | wire hops |
| `apps/admin/src/routes/finance.routes.tsx` | register `activity` or remove NavLink |
| `apps/admin/src/shell/nav-registry.ts` | gate-key reconciliation |
| `scripts/resource-depth-audit.mjs` | register any new `:id` section route |
| `apps/e2e/tests/**` | browser proof of the key hops |

## Acceptance

- Browser proof: director hops session→student, session→teacher, session→class, class→teacher, student→class.
- Config FKs remain text.
- No 404 on receipt tabs.
- Gate mismatches fixed with test proof.
- CI green.

## Security

- `RecordLink` never becomes an authz boundary; API stays authoritative.
- No payload widening; audit each hop's data source (esp. anything near `classRoster.read`).
