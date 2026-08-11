---
title: "Phase 5: Spike vertical slice class range roster"
status: todo
priority: P1
effort: "3–5d"
dependencies: [3, 4]
---

# Phase 5: Spike — class + range + roster D1 — RED-TEAM REVISED

## Overview

Prove dual-gate **on new APIs** only: staff grant unit ranges + roster by session stamp.  
**Rescoped:** no class update, no slot redesign, no grantPast, no multi-facility UAT exit.

## Dual API contract (Critical)

| Procedure | Status effect | Range effect | On teaching roster? |
|-----------|---------------|--------------|---------------------|
| `enrollment.enroll` (existing) | create **reserved** only | **none** | never |
| Money provision (out of scope) | → **active** | none this plan | active + 0 range = **not** on new rosterForSession |
| `enrollment.addWithUnits` (new) | requires existing enrollment; **does not** set active | insert continuous range | only if status=active AND range covers stamp |
| Break-glass active (if needed for tests) | seed helper / privileged test only | optional | test harness |

**RBAC:** new permission e.g. `enrollment.grantUnits` — **exclude `sale`**.  
`enrollment.enroll` stays sale-capable but never writes ranges.  
`rosterForSession` uses `classRoster.read` (or stricter), not `enrollment.enroll`.

## Shared helper

- [x] `onRoster(student, session)`:
  - Enrollment for batch with `status === 'active'`
  - day_gate(archivedAt, sessionDate) if archivedAt set
  - Student lifecycle not in blocked set: map monorepo `blocked_lms|withdrawn` (+ document)
  - Range covers `orderGlobal` of session.curriculumUnitId
  - **If curriculumUnitId null → fail-closed (empty / reject mark)**

## API (minimal)

- [x] **Create class path delta** (cannot reuse create-as-written alone):
  - Input includes `startUnitId` (or orderGlobal)
  - Persist neo anchors
  - After session createMany: **same TX** restamp all sessions via domain `deriveSessionUnits` + program unitIdByOrder map
- [x] `enrollment.addWithUnits` — continuous future-only range; overlap reject; orders ∈ program; FOR UPDATE enrollment
- [x] `enrollment.rosterForSession`

## Explicitly OUT of spike

- Class update / edit slots / cancel restamp  
- grantPast / revokeFromNext  
- Family login  
- Exercise delivery  
- Receipt grant  
- Multi-facility as **exit criterion** (RLS still enforced; 2-facility proof optional phase 6)

## Open-tier coupling (named risk)

Auto-stamping `curriculumUnitId` **also** feeds ADR 0038 open-tier. Mitigations for spike tests:
- Prefer session `endTime` in the future so Tier A does not open homework during tests; **or**
- Document accepted dual semantics until plan 2 kill-switch.

Do **not** claim production dual-gate complete for exercise open.

## Related Code

- Read: `apps/api/src/class/class-batch-router.ts`, `generate-sessions.ts`, `enrollment/router.ts`, `packages/auth/src/index.ts`
- Source: cmc-lms enrollment + session-generator restamp
- Domain: `@cmc/domain-lms` isEntitled, deriveSessionUnits, validateNewRange + API-side course membership/overlap (port from live router, not pure domain alone)

## Implementation Steps

1. Implement unitIdByOrder map for batch.program.  
2. Extend create (or lmsOps.createClassWithUnits) with stamp TX.  
3. addWithUnits + rosterForSession + RBAC.  
4. Int tests: cover/miss range; reserved+range not on roster; null stamp empty; sale cannot grantUnits.  

## Success Criteria

- [x] Real create path stamps all non-cancelled sessions (not only seedClassSession)  
- [x] Range [1–2] miss unit 3; [1–4] hit unit 3  
- [x] reserved enrollment never on rosterForSession  
- [x] sale role forbidden on grantUnits  
- [x] Money provision tests still green  

## Risk Assessment

High — touch class create carefully; keep calendar planner or replace with documented hybrid.
