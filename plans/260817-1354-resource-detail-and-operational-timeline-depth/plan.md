---
title: "Resource Detail and Operational Timeline Depth"
description: "Complete staff record management, safe per-record operational timelines, and source-current detail depth across CMC EDU without forcing workspaces or configuration grids into record pages."
status: pending
priority: P1
effort: "30-45 engineer days, delivered as sequential protected PRs"
issue:
branch: "feat/back-before-design"
tags: [feature, frontend, backend, database, api, auth, critical]
blockedBy: []
blocks: []
created: 2026-08-17
---

# Resource Detail and Operational Timeline Depth

## Overview

Fix the system-wide record-depth gap behind the staff popup complaint. Staff/AppUser is P0.
Then normalize existing detail URLs and roll operational history across true business records.
Use path-based CMC routing, `DetailPage`, `@cmc/links`, and facility-scoped `RecordEvent`.
Keep global `AuditLog` restricted to compliance use.

## Current verdict

| Area | Source-current finding | Decision |
|---|---|---|
| Staff | `/admin/users` only; row opens roles dialog; UI ignores `user.update` | Build canonical `/hr/staff` list/new/detail |
| Director access | Directors have `user.manage`; parent Admin nav is super-admin-only | Put Staff leaf under HR; API remains authority |
| Audit | `AuditLog` has no facilityId/RLS and `audit.list` is global | Do not expose as director timeline |
| Timeline | `RecordEvent` is facility-scoped, RLS, append-only; `RecordTimeline` exists | Use operational timeline per domain |
| Other modules | 2026-08-11 matrix is stale | Use [source-current inventory](./reports/source-current-resource-depth-inventory.md) |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Contract, Inventory and Decision Freeze](./phase-01-start.md) | Done |
| 2 | [Staff Authorization and API Contract](./phase-02-staff-authorization-and-api-contract.md) | Done |
| 3 | [Staff Routes, Forms and Navigation](./phase-03-staff-routes-forms-and-navigation.md) | In progress |
| 4 | [Operational Timeline and Compliance Audit Separation](./phase-04-operational-timeline-and-compliance-audit-separation.md) | Pending |
| 5 | [Existing Detail URL and Cross-Link Normalization](./phase-05-existing-detail-url-and-cross-link-normalization.md) | Pending |
| 6 | [Remaining First-Class Record Rollout](./phase-06-remaining-first-class-record-rollout.md) | Pending |
| 7 | [Coverage Gates, E2E and Documentation](./phase-07-coverage-gates-e2e-and-documentation.md) | Pending |

## Dependencies

- Predecessor: `plans/260811-1408-record-centric-url-form-depth/`.
- This plan inherits its URL/link/cold-start contract and supersedes only its Phase 05 matrix.
- Phase graph: `1 → 2 → 3 → 4 → 5 → 6 → 7`.
- One module series at a time; no cross-domain big-bang PR.
- Every protected PR must have terminal-green `typecheck-and-test` and `ui-e2e`; do not defer
  required CI until Phase 7.

## Locked architecture

- [Decisions](./decisions.md)
- [Brainstorm + advice](../reports/brainstorm-advise-260817-resource-detail-audit-depth.md)
- `AuditLog` = global compliance; `RecordEvent` = user-facing record timeline.
- No generic client-selectable timeline endpoint.
- Old URLs redirect to one canonical work surface.

## Success Criteria

- [ ] Directors can discover and manage same-facility staff through `/hr/staff`.
- [ ] Staff create, row click, deep link, F5, share, back and compatibility redirects work.
- [ ] Staff detail edits all supported profile fields and keeps role/password actions explicit.
- [ ] Cross-facility guards and super-admin read-only target rules pass API integration tests.
- [ ] Operational timelines are facility-safe, domain-authorized and secret-free.
- [ ] Class/student/receipt durable tabs are URL-addressable; class roster links to student.
- [ ] ParentMeeting receives get/link/detail/create-success contracts.
- [ ] Course and Gift remain explicit source-backed catalog/config exceptions.
- [ ] Source-current coverage gate reports zero unclassified routed production surfaces.
- [ ] Required CI checks are green on every merged PR and on the final program state.

## Non-goals

- Odoo hash/action/OWL port.
- Global generic record framework.
- UI-only exposure of `AuditLog` to directors.
- Payroll-domain redesign.
- Fake historical timeline backfill.

## Red Team Review

### Session 1 — 2026-08-17

**Findings:** 20 raw → 15 deduplicated/capped (11 accepted, 4 accepted modified)  
**Severity:** 11 High, 4 Medium  
**Report:** [Round 1 adjudication](./reports/red-team-round-1-adjudication.md)

Key deltas: route-complete inventory; source-backed Course/Gift exceptions; read-only super-admin
target rule; section-level Class gates; explicit ParentAccount read authority; cross-domain event
producer maps; typed return context and browser-history semantics; closed AppUser/audit manifests.

### Session 2 — 2026-08-17

**Findings:** 5 accepted (3 High, 2 Medium)  
**Report:** [Round 2 rollout and evidence](./reports/red-team-round-2-rollout-and-evidence.md)

Key deltas: migrate every legacy Staff consumer; Phase 3 browser proof; split Phase 4 into PR 4A/4B;
explicit rollback; exact-head-SHA CI gates.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, `decisions.md`, all seven phase files, inventory and brainstorm report.
- Decision deltas checked: 15.
- Reconciled stale references: 19.
- Unresolved contradictions: 0 at the red-team gate.

<!-- slug: resource-detail-and-operational-timeline-depth -->
