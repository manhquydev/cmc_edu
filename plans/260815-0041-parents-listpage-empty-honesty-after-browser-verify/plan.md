---
title: "Parents ListPage empty honesty after browser verify"
description: "Wave 8: Parents empty under-claim copy (Students bare-string style). No invent kind/CTA. Ops seed separate non-gate."
status: completed
priority: P1
effort: "S"
tags: [design-bridge, listpage, parents, empty-state, wave-8]
created: 2026-08-15
---

# Parents ListPage empty honesty after browser verify

## Overview

Live browser verify (2026-08-15) flagged parents as the next honesty gap.
Brainstorm + kongming GO Wave 8 Parents only
(`plans/reports/brainstorm-260815-next-after-browser-verify.md`).

**Mechanism (red-team corrected):** `DataTable` already wraps bare `empty` strings in
`<EmptyState>` without publishing `kind` (`packages/ui` `resolveEmpty`). Students
authority is a **kindless string const**, not an EmptyState import. This wave is
**copy quality + honest branching**, not inventing `TableEmptySpec.kind`.

Parents is a provisioned queue/directory (`Duyệt` / `Từ chối` / email update) —
**never invent create CTA**. Anti-pattern: Classes `first-run` + create (PR #145).

**Ops draft reseed is NOT a product-PR gate** (Phase 03 optional evidence only).

## Authority

| Source | Role |
|--------|------|
| `plans/reports/brainstorm-260815-next-after-browser-verify.md` | GO / SPLIT / HOLD |
| `plans/reports/verify-browser-260815-design-bridge-live.md` | Live GAP parents |
| `apps/admin/src/pages/students/index.tsx` (`NO_MATCH_EMPTY`) | Under-claim pattern |
| `apps/admin/src/pages/students/index.test.tsx` | Assert `[data-empty-kind]` null |
| Classes empty (PR #145) | **Anti-pattern** (has create) |
| `apps/admin/src/pages/parents/index.tsx` | Target |
| `apps/admin/src/pages/parents/index.test.tsx` | Extend empties |

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Richer under-claim **copy** on both reachable Parents empties; no dishonest `kind` | P1 |
| 2 | Never invent create CTA; never publish `filtered`/`first-run` without authority | P1 |
| 3 | RTL: assert copy per matrix cell + `[data-empty-kind]` null; role-gated all-parents | P1 |
| 4 | Ops draft proof optional / SKIP-ok — does not block Parents PR | P2 |
| 5 | INDEX housekeeping + PR → `develop` | P2 |

## Non-goals

- Wave 4B StatusBadge fan-out; shell Wave 9; kanban redesign
- Payroll / exercises / shifts empties
- BulkActionBar / dishonest widen / new sort
- Changing approve/reject / email update flows
- **LinkRequestsTab pagination / over-cap count** (known debt; out of Wave 8)
- Making `TableEmptySpec.kind` optional in `@cmc/ui`
- Full demo seed rewrites

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Start](./phase-01-start.md) | Pending |
| 2 | [Phase 2: Implement Parents empty honesty](./phase-02-implement-parents-empty-honesty.md) | Pending |
| 3 | [Phase 3: Ops reseed draft receipt proof](./phase-03-ops-reseed-draft-receipt-proof.md) | Pending |
| 4 | [Phase 4: Housekeeping INDEX BRIDGE](./phase-04-housekeeping-index-bridge.md) | Pending |

## Product-PR success criteria (ship gate)

- [ ] Requests tab: under-claim string (all statuses share one honest string — no invent status-specific story without mock budget)
- [ ] All-parents: matrix `missing\|all × search empty\|non-empty` with honest copy; search+missing **names** the email constraint
- [ ] No `TableEmptySpec` / no `data-empty-kind` attribute on these empties
- [ ] Copy must not contain create/add verbs (`Tạo`, `Thêm … đầu tiên`)
- [ ] RTL cases for matrix cells under `sale` (all-parents) + requests empty under any role
- [ ] Existing parents tests still green; journey approve/reject not required to re-prove for empty-only change
- [ ] PR → `develop`

## Ops success (non-blocking)

- [ ] Draft brand visible **or** SKIP with reason recorded in cook report

## Red Team Review

**Date:** 2026-08-15  
**Reviewers:** Security Adversary, Assumption Destroyer, Failure Mode Analyst (3 lenses)

| # | Finding | Severity | Disposition | Notes |
|---|---------|----------|-------------|-------|
| S1 | EmptyState/`kind` contradiction vs Students bare string | Critical | **Accept** | Mechanism = copy consts; forbid invent kind; assert `data-empty-kind` null |
| S2 | Full seed not idempotent; money chain mutates | High | **Accept** | Phase 03: prefer query existing draft; env guard; no casual full reseed |
| S3 | Search-zero under missing-email hides filter | High | **Accept** | Copy must name missing-email when search+missing |
| S4 | Requests tab total vs pageSize 50 overflow | High | **Reject** | Out of Wave 8 scope; known debt in Non-goals |
| S5 | All-parents permission-gated tests can pass vacuously | Medium | **Accept** | Tests require `sale`/`updateEmail`; assert surface present first |
| A1 | Bare string already EmptyState — "import EmptyState" wrong | High | **Accept** | Merged with S1 |
| A2 | "empty-kind assertions" unsatisfiable | High | **Accept** | Assert copy + kind null, not kind value |
| A3 | "No create CTA" phantom test | Medium | **Accept** | Design note; assert no create/add verb in empty copy |
| A4 | Per-status requests empty under-scoped | Medium | **Accept** | One shared requests empty string |
| A5 | Permission precondition missing | Medium | **Accept** | Merged with S5 |
| F1 | Draft fixture not idempotent after approval | High | **Accept** | Phase 03 note; query first |
| F2 | Proof reruns broad mutating seed | High | **Accept** | Merged with S2 |
| F3 | Ops both optional and ship gate | High | **Accept** | Split product-PR vs ops criteria |
| F4 | Decision table invented "other" email filter | Medium | **Accept** | Matrix only `missing\|all` |
| F5 | Existing tests never hit empty | Medium | **Accept** | Phase 2 extends `index.test.tsx` |

### Whole-Plan Consistency Sweep

- Decision table rewritten to `missing|all × search`; no fictional email branch.
- Success criteria no longer require inventing `kind` or EmptyState import.
- Ops removed from product ship gate.
- Pagination overflow explicitly Non-goal (S4 rejected).
- No unresolved contradictions remaining for Wave 8 scope.

## Validation Log

### Verification Results

- Claims checked: 12
- Verified: 12 | Failed: 0 | Unverified: 0
- Tier: Standard
- Failures: none

| Claim | Result | Evidence |
|-------|--------|----------|
| Parents bare empties at ~255 / ~423-427 | VERIFIED | `parents/index.tsx` |
| DataTable string → EmptyState no kind | VERIFIED | `data-table.tsx:109-114` |
| Students NO_MATCH_EMPTY kindless | VERIFIED | `students/index.tsx:60-67` |
| Students test asserts kind null | VERIFIED | `students/index.test.tsx:127` |
| Default emailFilter=missing | VERIFIED | `parents/index.tsx:455` |
| All-parents tab gated on updateEmail | VERIFIED | `parents/index.tsx:552-566`, test `:118-122` |
| email filter only missing\|all | VERIFIED | parents EmailFilter type |
| parentAccount.list ANDs search+missing | VERIFIED | router + query args |
| parents/index.test.tsx exists, no empty cases | VERIFIED | test file `:104-168` |
| Draft seed block existence-checked | VERIFIED | seed ~232+ |
| Full seed money path unguarded | VERIFIED | seed CRM/receipt approve path |
| Classes first-run invent create | VERIFIED | `classes/index.tsx:247-257` |

### Validation Session 1 (auto — user authorized continuous pipeline)

Decisions locked without further interview (pipeline mandate: red-team↔validate until implement-ready):

1. **Empty mechanism:** Students-style kindless string consts only. **(Recommended)**
2. **Requests empty:** One shared under-claim string for all link statuses. **(Recommended)**
3. **Ops:** Non-blocking SKIP allowed. **(Recommended)**
4. **Pagination debt:** Explicitly out of scope. **(Recommended)**

### Whole-Plan Consistency Sweep (validation)

- Product ship gate vs ops criteria reconciled.
- Phase 01–04 prose matches accepted red-team delta.
- Unresolved contradictions: **none**.

**Verdict: CLEAN — ready for `/ak:cook`.**

<!-- slug: parents-listpage-empty-honesty-after-browser-verify -->
