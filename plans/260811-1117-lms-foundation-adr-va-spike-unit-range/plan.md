---
title: "LMS foundation ADR va spike unit-range"
description: "Plan 1/3: ghi luật Khóa học>Unit, ADR pack, port domain, schema+RLS, spike class+range+roster. Cook được độc lập trước teaching UI và cutover."
status: completed
priority: P1
effort: "1.5–2.5 tuần"
tags: [lms, foundation, adr, spike, unit-range]
created: 2026-08-11
blockedBy: []
blocks:
  - project:260811-1118-lms-teaching-spine-api-ui-family
  - project:260811-1118-lms-erp-money-bridge-import-cutover
---

# Plan 1/3 — LMS foundation: ADR + spike unit-range

## Program context

| Plan | Role | Cook when |
|------|------|-----------|
| **This plan** | Foundation | **Now** (active) |
| [Teaching spine](../260811-1118-lms-teaching-spine-api-ui-family/) | API/UI day loop | After this plan DONE |
| [Money bridge + cutover](../260811-1118-lms-erp-money-bridge-import-cutover/) | Receipt→unit, import, close old LMS | After teaching spine quality |
| [Program index (legacy mega)](../260811-1025-hop-nhat-lms-cmc-lms-vao-cmc-edu-erp/) | Overview only — **do not cook** | — |

## Owner decisions (locked)

See `plans/reports/decisions-owner-260811-cau-1-5.md`:

1. **Khóa học > Unit**; cấp quyền theo unit trong khóa  
2. Scenario B: data teaching từ live `cmc-lms` (import later, not this plan)  
3. Build quality on `cmc_edu` first; close old LMS last  
4. Break-glass create HS without learn until unit grant  
5. Refund: cut unlearned units from next, keep history  

## Outcome

Monorepo has:

- Written product/tech ADRs matching owner decisions  
- `@cmc/domain-lms` pure rules from live LMS  
- Additive schema: `EnrollmentUnitRange`, class unit anchors, facility+RLS  
- **Spike API**: create class (start unit) → materialize sessions → enroll unit range → roster by session unit (D1)  
- Proof: domain + integration tests green; no money path regression  

## Non-goals (this plan)

- Full teacher/family UI  
- Exercise delivery cron  
- `provisionFromReceipt` unit grant  
- Import live data / cutover  
- Gift/badge  

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Start / branch hygiene](./phase-01-start.md) | Pending |
| 2 | [Authority pack ADR](./phase-02-authority-pack-adr-va-owner-decisions.md) | Pending |
| 3 | [Port domain-lms](./phase-03-port-domain-lms-pure-package.md) | Pending |
| 4 | [Schema + RLS](./phase-04-schema-additive-enrollmentunitrange-va-rls.md) | Pending |
| 5 | [Spike vertical slice](./phase-05-spike-vertical-slice-class-range-roster.md) | Pending |
| 6 | [Prove tests CI](./phase-06-prove-spike-tests-ci-green.md) | Pending |

## Success criteria

- [ ] ADRs + procedure/RBAC/orderGlobal freezes published  
- [ ] domain-lms package tests green; wired into api  
- [ ] Migration all-or-nothing: ranges+facilityId+FORCE RLS+anchors+orderGlobal  
- [ ] Int tests: range cover/miss; reserved+range not on roster; null stamp fail-closed; sale cannot grantUnits  
- [ ] Real class create path stamps sessions (not seed-only)  
- [ ] Provision/finance regression green  
- [ ] Ship note contracts for plan 2/3  
- [ ] Red-team log resolved (this file)  

## Ready for cook when

Red Team + Validate loops complete with **zero unresolved Critical** and consistency sweep clean.

<!-- slug: lms-foundation-adr-va-spike-unit-range -->

## Red Team Review

**Date:** 2026-08-11  
**Lenses:** Security Adversary, Assumption Destroyer, Failure Mode Analyst, Scope Critic (4 parallel agents)  
**Verdict after adjudication:** Plan revised in-place — **cook-ready for rescope foundation**, not original over-broad spike.

### Findings adjudicated

| ID | Severity | Disposition | Action |
|----|----------|-------------|--------|
| F-SEC-2 / F-ASM-5 | Critical | **Accept** | `EnrollmentUnitRange.facilityId` denormalized + FORCE RLS; no join-only RLS |
| F-SEC-3 | Critical | **Accept** | New perms `enrollment.grantUnits` — **exclude sale**; reserved `enroll` never writes ranges |
| F-ASM-1 / F-FAIL-6 | Critical | **Accept** | Non-null `orderGlobal` unique per program before any range write |
| F-ASM-2 | Critical | **Accept** | ClassBatch neo anchors required for spike (not optional forever) |
| F-ASM-3 | Critical | **Accept** | ADR: ERP Course ≠ global unit catalog; map program→units |
| F-ASM-4 / F-FAIL-3 | Critical | **Accept** | Create path must stamp units in same TX; cannot reuse create-as-written |
| F-ASM-6 / F-FAIL-2 | Critical | **Accept** | Contract table enroll vs addWithUnits vs active writer |
| F-SEC-7 | High | **Accept** | Null stamp ⇒ fail-closed empty roster |
| F-ASM-8 / F-SEC-5 | High | **Accept** | Document open-tier side-effect of stamps; tests use future endTime or flag note |
| F-FAIL-1 | Critical | **Accept** | Single migration table+RLS+FORCE+grants; create+stamp one TX |
| F-FAIL-4 | High | **Accept** | Test harness cleanup/seed with ranges |
| F-FAIL-5 | High | **Accept** | Hard branch hygiene gates |
| F-SCP-1 | Critical | **Accept** | Rescope spike: no class update/slot redesign/grantPast |
| F-SEC-1 full open-tier rewrite in plan1 | Critical | **Accept partial** | Inventory consumers in ADR; dual-gate on **new** roster/grant paths; open-tier kill remains plan 2 — success criteria must not claim production dual-gate complete |
| F-SEC-6 full revoke matrix | High | **Defer plan2/3** | Spike: future-only add; no past revoke implementation |

### Whole-Plan Consistency Sweep

- [x] Removed join-only RLS option  
- [x] Spike surface cut (no update class / grantPast / multi-facility UAT as exit)  
- [x] orderGlobal + anchors elevated to blockers  
- [x] enroll/addWithUnits/active contract written  
- [x] open-tier stamp coupling named  
- [x] Sibling plans remain blocked until foundation ship note contracts  

**Unresolved contradictions:** None after edits.

**Cook recommendation:** **GO** for Plan 1 only after implementer follows revised phase-04/05 contracts.

## Validation Log

### Verification Results (2026-08-11, post red-team)

| Claim | Result | Evidence |
|-------|--------|----------|
| CurriculumUnit has no orderGlobal | VERIFIED | `schema.prisma` CurriculumUnit model |
| ClassBatch has no startUnitId | VERIFIED | `schema.prisma` ClassBatch |
| enrollment.enroll → reserved only | VERIFIED | `enrollment/router.ts` |
| sale has enrollment.enroll | VERIFIED | `packages/auth/src/index.ts` |
| ClassSession.curriculumUnitId nullable | VERIFIED | `schema.prisma` |
| generate-sessions does not stamp units | VERIFIED | `generate-sessions.ts` + class-batch create |

- Claims checked: 6 — Verified: 6 | Failed: 0 | Unverified: 0  
- Tier: Full fact-check after 4-lens red-team  
- Consistency sweep: OK (no Critical contradictions)  

### Whole-Plan Consistency Sweep

- [x] plan.md success criteria match phase-04/05 contracts  
- [x] Sibling plans reference foundation freezes  
- [x] Open-tier deferred without claiming production dual-gate  

**Cook readiness: READY**
