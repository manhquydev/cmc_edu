---
title: "Relational Depth and Permission Transparency"
description: "Make first-class records navigable to each other (click a class/student/teacher/parent → its detail), surface a truthful per-role permission reference, and close the residual operational-timeline gaps — reusing the resource-depth chrome without building an Odoo-style generic framework."
status: pending
priority: P1
effort: "12-20 engineer days, delivered as sequential protected PRs"
issue:
branch: "feat/relational-depth-and-permission-transparency"
tags: [feature, frontend, backend, api, auth, ux]
blockedBy: []
blocks: []
created: 2026-08-20
---

# Relational Depth and Permission Transparency

## Overview

The completed `260817-1354-resource-detail-and-operational-timeline-depth` program built the
record-depth **chrome** (path URLs, `DetailPage`, `@cmc/links`/`/go`, dual ledger, 7 timelines,
`/hr/staff`, CI `resource-depth:audit`). This program builds the **connective tissue and
governance surface** on top of that chrome:

1. **Relational cross-linking** — entity references render as clickable links to the target's
   detail page (session → student/teacher/class, class → teacher, student → class/parent,
   receipt/aftersale/reward/meeting → student, kpi/shift → staff), Odoo-style but reusing
   `@cmc/links`. No generic relational framework.
2. **Permission transparency** — a read-only role→permission matrix screen and reconciliation of
   nav/route/procedure permission-key consistency. Registry stays code; no runtime RBAC editor.
3. **Selective timeline fills** — add operational timelines only where they carry real value
   (AfterSaleCase, ShiftRegistration); explicitly close the rest as AuditLog-only.

## Evidence base

- [Brainstorm + advise](../reports/brainstorm-advise-260820-project-completeness-next-program.md) (kongming-supervised)
- [Frame coverage survey](../reports/survey-260820-frame-coverage.md)
- [Authz + role-UI survey](../reports/survey-260820-authz-role-ui.md)
- [Log/history survey](../reports/survey-260820-log-history.md)
- [Odoo/OpenEduCat research](../reports/research-260820-odoo-openeducat-patterns.md)

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Relational Cross-Linking](./phase-01-relational-cross-linking.md) | Pending |
| 2 | [Permission Matrix and Gate Reconciliation](./phase-02-permission-matrix-and-gate-reconciliation.md) | Pending |
| 3 | [Selective Timeline Fills](./phase-03-selective-timeline-fills.md) | Pending |

## Dependencies

- Predecessor: `plans/260817-1354-resource-detail-and-operational-timeline-depth/` (chrome + dual ledger + `@cmc/links`).
- Phase graph: `1 → 2 → 3`. One series at a time; no cross-domain big-bang PR.
- Every protected PR must be terminal-green on `typecheck-and-test` and `ui-e2e`.
- New `:id` routes must be registered in `scripts/resource-depth-audit.mjs` in the same commit.

## Locked architecture

- [Decisions](./decisions.md).
- `RecordLink` is **presentational**: it renders `<a href={links[entity](id)}>` when `id` is
  present, else plain text; the route + API remain the real authorization boundary.
- A static `no_open` list keeps config FKs (program, room, course) as text.
- Permission matrix is **read-only**, derived from `@cmc/auth`, gated behind `user.manage`/`super_admin`.
- Timelines reuse the domain-owned `record-event.ts` + `RecordTimeline` pattern; no generic
  client-supplied `entity/entityId` endpoint.

## Success Criteria

- [ ] `RecordLink` used for the enumerated hops; browser proof that a director/teacher can hop
  session → student, session → teacher, session → class, class → teacher, student → class.
- [ ] Receipt `/finance/:id/activity` resolved: registered (if a timeline renders there) or the
  dead NavLink removed. No 404 tab.
- [ ] Config FKs (program/room/course) remain text per the `no_open` policy.
- [ ] Read-only permission-matrix screen: super_admin shown as "all"; empty-roster keys shown as
  super_admin-only; each cell/row annotated "registry door" vs "door + SoD/row rule"; screen
  gated behind `user.manage`/`super_admin`.
- [ ] Nav/route/procedure key mismatches reconciled (GĐĐT can reach Parents; gate keys consistent).
- [ ] AfterSaleCase and ShiftRegistration have facility-safe operational timelines; the other four
  gap entities are explicitly documented as AuditLog-only; Exercise's substrate limitation recorded.
- [ ] `resource-depth:audit` green; both required CI checks green on every merged PR.

## Non-goals

- Odoo hash/OWL/`ir.actions.act_window` port; any generic relational or metadata-driven framework.
- Runtime role/permission editor; moving the RBAC source of truth out of code.
- Generic client-selectable `entity/entityId` timeline endpoint.
- Detail pages or `/go` keys for Course/Facility (frozen as config catalogs by predecessor D5).
- ClassSession as its own `RecordEvent` entity (schema/taxonomy ADR, out of scope here).
- Widening any `get`/list payload solely to enrich a link.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Receipt `/activity` routes to an empty timeline | Medium | Decide register-vs-delete on evidence in Phase 1 (read finance router + detail section wiring) |
| Matrix misrepresents authority (door vs SoD) | High | Annotate every cell/row; special-case super_admin; unit-test against `@cmc/auth` |
| Permission-aware link leaks a label | Medium | Never widen a payload to enrich a link; audit each hop's data source (esp. `classRoster.read`) |
| CI `resource-depth:audit` breakage on new route | Medium | Update the audit registry in the same commit as any new `:id` route |
| "Learn from Odoo" scope creep | High | Non-goals pre-committed in `decisions.md`; `RecordLink` stays presentational |

<!-- slug: relational-depth-and-permission-transparency -->
