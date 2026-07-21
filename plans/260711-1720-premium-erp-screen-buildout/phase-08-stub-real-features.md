# Phase 08 — Stub real-features (SCOPED DOWN 2026-07-12)

> **STATUS UPDATE 2026-07-12 (user decisions post-merge):**
> - **`leaderboard` — DROPPED from v2 scope** per TL16 ("bảng xếp hạng" already out-of-scope). Coming-soon EmptyState stays as a permanent "not in v2" surface. No backend work planned.
> - **`shift-config` — moved to plan `260711-1752-hr-kpi-shift-attendance-remediation` phase-05** (has real CRUD + backend design). Removed from this phase.
> - **`network-ip` — remains BLOCKED** here (no backend + no clear owner). Screen stays coming-soon indefinitely until product picks an owner. Charter "no `apps/api` edits" still applies to this plan.
> - **Effective phase-08 scope now = network-ip only, indefinitely blocked.**

## Context links
- Parent: [plan.md](plan.md) · Interim stubs shipped in [phase-01](phase-01-engagement-cluster.md) (leaderboard) + [phase-02](phase-02-admin-cluster.md) (network-ip, shift-config)
- Depends: phase-01 + phase-02 (icons + coming-soon screens in place) **AND** new backend + spec approval

## Why blocked (scouted 2026-07-11)

| Screen | Current stub | Backend today | Missing to build real |
|--------|--------------|---------------|-----------------------|
| `engagement/leaderboard.tsx` | coming-soon (`trophy`) | none — no leaderboard/rank/standings router; `StarTransaction` model exists but no ranked aggregate | **new endpoint** `leaderboard.list` (ranked aggregate) **+ product spec** |
| `admin/network-ip.tsx` | coming-soon (`globe`) | `FacilityNetwork` model read-only inside `checkin.punch` (`apps/api/src/checkin/router.ts:48`); no management surface | **new endpoint** `facilityNetwork.list`/`create`/`delete` (spec mostly derivable: CIDR CRUD) |
| `admin/shift-config.tsx` | coming-soon (`clock`) | write mutations `shift.createGroup`/`createTemplate` exist (`apps/api/src/shift/router.ts:77,96`); no read | **new read queries** `shift.listGroups` + `shift.listTemplates`; **confirm UX** (admin catalog vs. registration flow) |

## Open questions for controller / user (must answer before this phase can be planned in detail)

**Leaderboard**
1. Ranking dimension — accumulated stars (`SUM(StarTransaction.amount)`)? attendance? something else?
2. Scope — per-facility, per-class, or global?
3. Time window — all-time, monthly, rolling?
4. Tie-break rule + page size + does it need student PII exposure gating (LMS vs staff view)?

**Network-IP**
5. Confirm the entity is `FacilityNetwork` (CIDR rows consumed by the punch IP-gate). CRUD shape: list + add(cidr,label) + delete? Any activate/deactivate toggle?
6. Who may manage — which permission (`facility.manage`? a new `network.manage`)?

**Shift-config**
7. Is this screen the **admin catalog** (manage `ShiftGroup` + `ShiftTemplate`) or the **employee registration** flow (`shift.submit`/`approve`/`cancel`)? The nav label "Cấu hình ca làm việc" implies catalog.
8. If catalog: needed reads are `shift.listGroups` + `shift.listTemplates` (facility-scoped). Confirm and confirm the create UI reuses existing `createGroup`/`createTemplate`.

## Requirements (pending unblock — provisional)
- Backend endpoints added (separate, approved `apps/api` work) with tests, following existing router conventions
  (`requirePermission`, `withFacility`, facility scoping per ADR 0042).
- Each screen then follows the same TDD screen loop as the real clusters: lock behavior → build premium archetype
  (leaderboard→list/dashboard, network-ip→list+form, shift-config→list+form) → green.
- Reuse `@cmc/ui` one-door + the phase-00 icons; no self-styled blocks; no emoji.

## Related code files (when unblocked)
- Backend (new, approved separately): leaderboard router; `facilityNetwork` CRUD; `shift` list queries.
- Frontend: `apps/admin/src/pages/engagement/leaderboard.tsx`, `apps/admin/src/pages/admin/network-ip.tsx`,
  `apps/admin/src/pages/admin/shift-config.tsx` (+ co-located `*.test.tsx`).

## Success criteria (when unblocked)
- 3 screens become real premium features bound to the new endpoints; contracts tested; no emoji; gates green
  (typecheck / build 14/14 / admin test / lint / `@cmc/ui`).

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| Backend built without spec → wrong semantics | High×High | Do NOT invent backend; wait for spec answers above |
| Scope silently expands current plan into API work | Med×High | This phase stays BLOCKED + out of the plan's "done" definition until user approves |
| Leaderboard exposes student PII in staff/LMS view incorrectly | Med×High | Resolve Q4 (view gating) before building |

## Rollback / interim
No rollback needed — the coming-soon `EmptyState` screens from phases 01/02 remain the shipped state until this phase is
explicitly unblocked and executed.

## Next steps
Controller: raise the 8 open questions with the user + decide whether `apps/api` work enters scope. Until then this phase
is parked.
