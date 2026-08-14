---
title: "Next UI wave: affordances, brand tone, students, CRM sort"
description: "Successor to 260814-1656. Four PR-sized phases after red-team R1: shared ListPage polish; approval-gated brand (receipts draft + KPI submitted) + CRM waiting stages; Students empty recipe (no bulk widen); CRM orderBy whitelist with tie-breaker."
status: active
priority: P1
effort: "4-6d"
tags: [ui, listpage, bridge, crm, students]
created: 2026-08-14
blockedBy: []
blocks: []
---

# Next UI wave: affordances, brand tone, students, CRM sort

## Overview

Successor to completed CRM E2E bridge (`plans/260814-1656-ui-bridge-crm-e2e-after-d0-d5`, PR #143 merged). Owner-confirmed contract in `plans/reports/brainstorm-260814-next-ui-wave-after-browser-audit.md`, **amended by Red Team R1** (see § Red Team Review).

Ship as **four sequential PRs** (one concern each). Do not squash into one branch.

## Contract (locked + R1 amendments)

| Field | Content |
|-------|---------|
| **Outcome** | Shared ListPage grammar visibly improved (sort chevron, applied filter chip, EmptyState default icons by kind); approval-waiting badges use brand where workflow meaning is waiting; Students empty states honest; CRM table stage tones + CRM table sort backed by API whitelist. |
| **Constraints** | OPENEDUCAT chrome wins; CI required; no duplicate Playwright names; **no invented category maps**; **do not flip global `STATUS_SOFT['draft']`**; one concern / PR; sort only with real API truth + **stable tie-breaker `{ id }`**; no bulk “select all matching” unless every ID is actually selectable. |
| **Non-goals** | Attendance matrix; CRM kanban card redesign; mass ListPage fan-out; invent CategoryChip maps; Wave 4B; shell rail; classes batch; **Students bulk widen** (LOOKUP_LIMIT=20); **payroll draft→brand** (draft ≠ approval queue); **relation sort by contact.name** this wave; **prod-sim proof of select-all across >PAGE_SIZE** (component-test only until ID endpoint exists). |
| **Acceptance** | Per-phase success criteria. Select-all-matching across pages = unit fixture only (not prod-sim). |

### Owner decision amendments (R1)

| Original | Amendment | Why |
|----------|-----------|-----|
| Brand on payroll/KPI/receipts **draft** | Receipts: `draft`→`tone="brand"`. KPI: **`submitted`**→`tone="brand"` (not draft). **Payroll: keep neutral** (draft = editable/reopened assembly). | API lifecycle evidence |
| Report cards in approval list | **Defer StatusBadge migration**; keep existing waiting Banner. Document as out of this wave. | Banner-only; avoid inventing badge |
| Brand purple for waiting vs docs/12 amber | **Owner + lab Wave 4A win** for waiting→brand; docs/12 drift noted, not blocking. Optional one-line docs pointer later. | Owner lock + shipped atom |
| CRM sort now | Stay in wave, but whitelist **frozen**: `createdAt`, `nextActionAt`, `stage` only; always append `{ id: 'asc' }`; **no `contactName`/`studentName`**. | Schema + pagination stability |
| Students fan-out | Empty kinds only; **no** bulk widen | LOOKUP_LIMIT=20 |

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | PR1 — affordances + EmptyState icons + idempotent draft seed + honest receipt bulk | P1 |
| 2 | PR2 — brand tones (receipts draft, KPI submitted) + CRM table waiting stages | P1 |
| 3 | PR3 — Students empty recipe (no widen, no fake filtered) | P1 |
| 4 | PR4 — CRM opportunityList orderBy whitelist + table sort | P1 |

## Phases

| # | Phase | Status | Depends |
|---|-------|--------|---------|
| 1 | [Kickoff gate](./phase-01-start.md) | Pending | — |
| 2 | [PR1 polish affordances + icons + seed](./phase-02-pr1-polish-affordances-icons-seed.md) | Pending | 1 |
| 3 | [PR2 brand tone + CRM waiting](./phase-03-pr2-brand-tone-approval-and-crm-waiting.md) | Pending | 2 |
| 4 | [PR3 students list adopt recipe](./phase-04-pr3-students-list-adopt-recipe.md) | Pending | 2 |
| 5 | [PR4 CRM opportunityList orderBy](./phase-05-pr4-crm-opportunity-list-orderby.md) | Pending | **3** |

PR4 **depends on PR2** (both edit `pipeline.tsx`). PR3 may parallel PR2 after PR1 merges, but prefer sequential merges for CI blame.

## Scout anchors (2026-08-14)

| Topic | Evidence |
|-------|----------|
| Sort chevron inactive opacity | `packages/ui/src/console.css:3335` (`0.35`) |
| Facet chip gray | `packages/ui/src/console.css:2975` |
| EmptyState no default icon | `packages/ui/src/components/empty-state.tsx:14–44` |
| `draft` → neutral | `packages/ui/src/components/status-badge.tsx:19` |
| Receipt bulk widen button vs page-only IDs | `receipt-list.tsx:245–251` + `bulk-action-bar.tsx:46–51` |
| Students LOOKUP_LIMIT | `apps/api/src/student/router.ts:44–45` |
| KPI lifecycle draft→submitted→… | `apps/api/src/kpi/router.ts:1–20` |
| Payroll reopen → draft | `apps/api/src/payroll/router.ts:550–568` |
| Opportunity has contact, not studentName | `packages/db/prisma/schema.prisma:277–305` |
| `opportunityList` fixed createdAt desc | `apps/api/src/crm/router.ts:573` |
| Seed always approves | `scripts/seed-local-sim-demo.ts:224–226` |

## Risks

1. Explicit `tone=` only — never global draft flip.
2. ui-e2e name collision — unique VI labels.
3. Seed must be idempotent (stable fixture key).
4. CRM orderBy whitelist + id tie-breaker; fix `crm-rotting` journey if it uses first-match locators before enabling sort.
5. Receipt-list must not offer “Chọn tất cả N” unless N IDs are selected.

## Success Criteria

- [ ] Four PRs green on `typecheck-and-test` + `ui-e2e`
- [ ] No dishonest bulk widen on receipts or students
- [ ] Brand tones only on receipts `draft` + KPI `submitted` + CRM O3/O4
- [ ] CRM sort: whitelist only + stable pagination tests
- [ ] Students empty under-claimed

## Related

- Brainstorm: `plans/reports/brainstorm-260814-next-ui-wave-after-browser-audit.md`
- Prior plan (completed): `plans/260814-1656-ui-bridge-crm-e2e-after-d0-d5/`

## Red Team Review

### Session — 2026-08-14 (R1)
**Findings:** 15 unique after dedupe (8 accepted Critical/High applied, 4 accepted Medium/High applied, 3 rejected)
**Reviewers:** Assumption Destroyer, Failure Mode Analyst, Scope Critic

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Students bulk widen lies (LOOKUP_LIMIT=20) | Critical | Accept | Phase 4 — remove widen |
| 2 | Students `filtered` without facility evidence | High | Accept | Phase 4 — neutral string |
| 3 | Seed not idempotent | Critical | Accept | Phase 2 |
| 4 | Select-all prod-sim vs PAGE_SIZE=50 | High | Accept | Contract — fixture-only; Phase 2 |
| 5 | Receipt “Chọn tất cả N” selects page only | Critical | Accept | Phase 2 — remove dishonest widen |
| 6 | Payroll draft ≠ waiting | High | Accept | Phase 3 — exclude payroll |
| 7 | KPI waiting = `submitted` not `draft` | High | Accept | Phase 3 |
| 8 | `studentName` field nonexistent | High | Accept | Phase 5 — drop; freeze whitelist |
| 9 | Pagination needs id tie-breaker | Critical | Accept | Phase 5 |
| 10 | PR4 must depend on PR2 (pipeline.tsx) | High | Accept | plan deps |
| 11 | Kanban “don’t contradict” untestable | Medium | Accept | Phase 3 — kanban unchanged |
| 12 | EmptyState must cover all kinds or constrain claim | High | Accept | Phase 2 |
| 13 | crm-rotting first-button locator | High | Accept | Phase 5 risk + step |
| 14 | Brand vs docs/12 amber waiting | High | Reject as blocker | Owner+lab brand lock; note drift |
| 15 | Defer entire CRM sort out of wave | High | Reject | Owner locked “now”; harden instead |
| 16 | Report-cards under-claim vs owner list | High | Accept amend | Phase 3 — defer Banner migration |
| 17 | Split PR2 across domains | High | Reject split | Narrowed (drop payroll) keeps one PR |

### Whole-Plan Consistency Sweep (R1)

- Re-read `plan.md` + all `phase-*.md` after edits.
- Removed: students widen, payroll brand, studentName sort, prod-sim multi-page select-all claim, vague kanban badge work.
- Added: Phase 5 depends on Phase 3; frozen orderBy fields; KPI submitted; honest receipt bulk; idempotent seed.
- **Unresolved contradictions:** none.

### Session — 2026-08-14 (R2)
**Findings:** 1 High accepted, 2 Medium residual (non-blocking)
**Reviewer:** Fact Checker R2

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Table cannot sort `createdAt` — no such column; stage label is 「Giai đoạn」 not 「Đã được」 | High | Accept | Phase 5 — UI sort = stage + nextActionAt only; API keeps createdAt; kanban omits sort |

### Whole-Plan Consistency Sweep (R2)

- Phase 5 success criteria aligned with `pipeline.tsx:459–509`.
- **Unresolved contradictions:** none.
- **Residual Medium (non-blocking):** shared list query must not apply table sort in kanban mode; Lost+stage sort stays within existing lost filter — covered in Phase 5 steps.
- **Verdict: CLEAN — ready to cook** after R2 apply.

## Validation Log

### Session — 2026-08-14
**Mode:** Verification-only (owner interview already completed in brainstorm; R1 amendments applied)
**Tier:** Standard

### Verification Results
- Claims checked: 12
- Verified: 12 | Failed: 0 | Unverified: 0
- Key verifies: LOOKUP_LIMIT=20; KPI submitted lifecycle; payroll reopen→draft; Opportunity has contact not studentName; pipeline columns Giai đoạn/Việc tiếp; receipt bulk button copy vs page IDs; EmptyStateKind union; STATUS_SOFT.draft=neutral
- Failures: none

### Decisions confirmed (no re-interview)
- Brand waiting = purple (owner) despite docs/12 amber — accepted with R1 note
- Payroll excluded; KPI brand on submitted; receipts on draft
- Students: empty honesty only, no widen
- CRM sort whitelist frozen; UI exposes stage + nextActionAt only
- Select-all multi-page = unit fixture only

### Whole-Plan Consistency Sweep (Validation)
- Unresolved contradictions: none
- Cook recommendation: proceed `/ak:cook` with `--auto` per user request


<!-- slug: next-ui-wave-affordances-brand-students-crm-sort -->
