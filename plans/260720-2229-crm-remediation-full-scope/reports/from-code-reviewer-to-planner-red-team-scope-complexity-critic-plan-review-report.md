# Red-Team Plan Review — Scope & Complexity Critic (YAGNI)

- **Plan:** `260720-2229-crm-remediation-full-scope`
- **Reviewer role:** Scope/Complexity Critic + Contract Verifier
- **Date:** 2026-07-20
- **Verdict:** REQUEST CHANGES — plan is technically sound but carries real over-engineering and mis-sizing in Phases 6, 7, 9, 10, plus cross-phase file-churn that inflates the ~41–55h estimate.

All findings verified against code before claiming. Contract checks appear at the end.

---

## Finding 1: Phase 6 — `pipelineStats` as a separate procedure is redundant; fold counts into `opportunityList`
- **Severity:** High
- **Location:** `phase-06-p1-lost-funnel-separation-pagination.md:23-25,48`; `apps/api/src/crm/router.ts:219-232`
- **Flaw:** `opportunityList` already runs a `findMany` + `count` inside one `withFacility` tx (`crm/router.ts:220-229`). The funnel needs stage counts independent of the current page — that is one extra `groupBy(['stage'])` aggregate in the SAME query response, not a second procedure. A standalone `crm.pipelineStats` doubles the query/permission/cache surface for a 1-facility dashboard and manufactures the exact consistency problem the plan then has to mitigate.
- **Failure scenario:** The plan's own risk note (`phase-06:48`, "two data sources … briefly inconsistent after mutation — invalidate both queries together") is self-inflicted by the split. Every mutation now must invalidate two queries in lockstep; miss one and the funnel disagrees with the cards. Folding removes the failure mode entirely.
- **Evidence:** `apps/api/src/crm/router.ts:228` (existing count in list); `phase-06:48` (dual-invalidation risk the split creates).
- **Suggested fix:** Return `{ items, total, page, pageSize, stageCounts, lostCount }` from `opportunityList`. `stageCounts`/`lostCount` computed via one facility-scoped `groupBy` unaffected by the page/lost filter. Delete `pipelineStats`.

## Finding 2: Phase 10 is over-bundled and mis-sized — a P3 phase carrying the plan's heaviest schema surface
- **Severity:** High
- **Location:** `phase-10-p3-owner-lead-source-schema-cleanup.md:22-33` (effort "5-6h")
- **Flaw:** One P3 phase (findings F13/F15 are **LOW**, owner/source is a §4 "gap", not a numbered finding) bundles: a new RLS-governed append-only table (`OpportunityNote` + policy + grants), `assignedToId` FK, `source` column, `remindedAt` drop, **three** new `studentId` FKs across three tables with orphan pre-validation, **three** new permission keys with a 5-role matrix test, 4+ new procedures, plus UI owner-select and a notes timeline. That is a plan-sized unit disguised as a 5–6h phase.
- **Failure scenario:** The 5–6h estimate is implausible — a new RLS/FORCE table with grant tests + a 3-table FK migration with orphan aborts + a full permission matrix + notes-timeline UI is realistically 12–18h. Because it is one phase on one migration, the genuinely trivial cleanup (`remindedAt` drop) and the KPI-critical `assignedToId` are held hostage to the speculative `OpportunityNote` feature and FK-orphan risk.
- **Evidence:** `phase-10:22-26` (schema scope); `packages/db/prisma/schema.prisma:271-286` (Opportunity has none today); brainstorm `§4` (owner/source/notes are "gaps," F13/F15 are LOW).
- **Suggested fix:** Split: (a) `assignedToId` + `source` (the real KPI foundation from PO decision #3) as one focused phase; (b) `OpportunityNote` only if a finding actually demands activity notes — §4#3 is a soft "đáng làm," not a defect; (c) `remindedAt` drop + the three FK additions as a trivial standalone schema-hygiene phase. Do not gate KPI-foundation work behind speculative notes.

## Finding 3: Phase 7 — "relaxed CHECK for legacy rows" is a permanent integrity hole, not a simplification
- **Severity:** High
- **Location:** `phase-07-p2-testappointment-opportunity-redesign.md:22` ("relax CHECK to also accept `type='entrance' AND studentId IS NOT NULL` … prefer the relaxed CHECK, simpler")
- **Flaw:** A CHECK constraint cannot reference "row created before migration date," so the relaxed arm is not scoped to legacy rows — it permanently permits NEW `entrance` appointments with `studentId` only and no `opportunityId`. That defeats the entire redesign whose point is that entrance appointments must attach to an Opportunity (PO decision #2). "Simpler" trades a one-time backfill for a forever-loose invariant.
- **Failure scenario:** Post-migration, any code path (including Phase 9's periodic/appointment UI, or a future dev) inserts an entrance row with `studentId` and null `opportunityId`; the CHECK passes; the O2→O3 / O3→O4 stage-sync never fires because there is no linked opportunity; F5 regresses silently and the funnel is wrong again — the exact bug this phase exists to kill.
- **Evidence:** `phase-07:22`; repo already uses raw CHECK constraints (`packages/db/prisma/migrations/20260707030000_p3ii_status_check_constraints/migration.sql`), so a strict CHECK is on-pattern and available.
- **Suggested fix:** Backfill legacy entrance rows in the migration (set a sentinel/null opportunity or migrate them), then apply the STRICT CHECK (`entrance ⇒ opportunityId NOT NULL`). If legacy entrance rows must remain readable without an opportunity, add an explicit `legacy boolean` column and scope the relaxed arm to `legacy = true`, defaulting false so new rows cannot use it.

## Finding 4: Cross-phase file churn — `pipeline.tsx` and `crm/router.ts` edited by 4–5 phases each
- **Severity:** Medium
- **Location:** Phases 2/3/6/7/10 all modify `apps/api/src/crm/router.ts`; Phases 3/6/7/10 all modify `apps/admin/src/pages/crm/pipeline.tsx`
- **Flaw:** `opportunityListInput` (`crm/router.ts:75-79`) gains `search` in Phase 3 and a `lost` enum in Phase 6 — two phases editing one input object and its test file. `pipeline.tsx` gets a create modal (3), stats+filter+pagination (6), a schedule-test action (7), and owner initials (10). `pipeline.test.tsx` is re-touched four times.
- **Failure scenario:** Phase 3 ships an optimistic-update cache keyed on the hardcoded `{ pageSize: 100 }` (`pipeline.tsx:98,103-106,118`). Phase 6 replaces that with real pagination, forcing a rewrite of the cache pattern Phase 3 just landed — wasted implementation + a second round of test rework. Parallelizing these phases would guarantee merge conflicts on both files.
- **Evidence:** `apps/admin/src/pages/crm/pipeline.tsx:98,103-106,118` (hardcoded pageSize cache); `apps/api/src/crm/router.ts:75-79` (single input object two phases mutate).
- **Suggested fix:** Land all `opportunityListInput` changes (`search` + `lost`) in one backend edit. Sequence the pipeline UI work 3→6 back-to-back (or merge them) so the pagination/cache pattern is written once, not written then rewritten.

## Finding 5: Phase 10 — 3 new permission keys contradict the registry convention and the plan's own Phase 9 posture
- **Severity:** Medium
- **Location:** `phase-10:29-30` (`crm.opportunityAssign`, `crm.noteAdd`, `crm.noteList`)
- **Flaw:** Post-sale domains gate every verb through a single `.manage` key (`packages/auth/src/index.ts:126-128`: `parentMeeting.manage`, `testAppointment.manage`, `afterSale.manage`). Phase 9 explicitly adopts this ("do NOT invent new permission keys without registry update," `phase-09:21`). Phase 10 then invents three. `crm.noteList` in particular gates a read behind the same two roles as `crm.opportunityList` — zero differentiation. Sale + giam_doc_kinh_doanh already do everything on leads; the granularity buys no access-control distinction.
- **Failure scenario:** Three more rows in the 5-role matrix test + docs/14 churn for keys that never separate any role from any other. `opportunityAssign`'s "sale self-only vs GĐ any" is enforced in code (an ownership check), not by the permission key — so the key adds ceremony, not control.
- **Evidence:** `packages/auth/src/index.ts:126-128` (single-key convention); `phase-09:21` (plan's own "no new keys" rule).
- **Suggested fix:** Reuse `crm.opportunityCreate` (or introduce at most ONE `crm.opportunityManage`) for assign + notes. Enforce self-vs-any assignment with an ownership check in the procedure, as the plan already does.

## Finding 6: Phase 9 — periodic-appointment tab + speculative `student.search` is scope creep beyond the cited finding
- **Severity:** Medium
- **Location:** `phase-09:13,22,26`
- **Flaw:** F10 (the phase's cited finding) is strictly the two stub screens (`aftersale.tsx`, `post-sale-meeting.tsx`) that falsely claim "no backend." The plan bolts on periodic test-appointment UI ("section or tab … decide at implementation," `phase-09:26` — undecided scope inside the phase) which traces only loosely to F5 (already owned by Phase 7 for entrance). It also proposes "if absent, add minimal `student.search`" (`phase-09:22`) without checking that `student.lookup` already exists in the registry (`packages/auth/src/index.ts:73`).
- **Failure scenario:** Effort spent building periodic-scheduling UI + a new student-search procedure that no finding requires — gold-plating a stub-removal task, and possibly duplicating `student.lookup`.
- **Evidence:** brainstorm F10 (scope = two stubs only); `packages/auth/src/index.ts:73` (`student.lookup` exists); `phase-09:26` (undecided tab scope).
- **Suggested fix:** Scope Phase 9 to exactly the two screens F10 names. Verify `student.lookup`/existing `student.*` reads before adding any search procedure. Defer periodic-appointment UI to a follow-up unless a finding demands it.

## Finding 7: Phase 4 — blanket audit of all post-sale lifecycle mutations is disproportionate
- **Severity:** Medium
- **Location:** `phase-04:26,40`
- **Flaw:** F6 (HIGH) is specifically `refundCreate` (money on an append-only ledger). F9 (MEDIUM) lists CRM + post-sale mutations. Phase 4 blanket-audits 10+ low-frequency post-sale transitions (`parentMeeting.schedule/complete/cancel`, `testAppointment.schedule/complete/noShow`, `afterSale.create/advance/resolve/close`) AND mandates "exactly one audit row per invocation … checklist test per router file" (`phase-04:40`). The test cost, not the write, is the burden.
- **Failure scenario:** A pile of "writes audit row" tests across three post-sale routers for operations with negligible dispute/compliance value in a single-facility center — effort that would be better spent hardening the money path. The success criterion forces coverage on every transition regardless of value.
- **Evidence:** brainstorm F6 (money = the real gap) vs F9 (post-sale = MEDIUM); `phase-04:40` (per-router checklist test mandate).
- **Suggested fix:** MVP-cut Phase 4 to money + CRM-stage mutations: `refundCreate`, `receiptCreate`, `opportunityAdvance/markLost/reopen`, `provisioning.completed`. Defer post-sale-router audit to a follow-up unless a compliance requirement is named.

## Finding 8: Phase 6 — server default `lost: 'include'` bakes the F7 bug in as the default behavior
- **Severity:** Medium
- **Location:** `phase-06:22` (`lost: z.enum(['exclude','include','only']).default('include')`)
- **Flaw:** The 3-state enum maps to the 3 UI views, so it is defensible. But choosing `default('include')` for backward-compat means the DEFAULT server behavior remains "lost opps mixed into stage columns" — precisely the F7 defect. Any caller (or future screen) that omits the param inherits the bug. Backward-compat only actually matters for `enroll-picker`, which already filters closed client-side (`phase-06:17`).
- **Failure scenario:** A new consumer calls `opportunityList` without `lost`, silently gets lost opps mixed into live counts, and reintroduces F7 — the very bug this phase closes.
- **Evidence:** `phase-06:22` (default choice); `apps/api/src/crm/router.ts:217` (current where-clause has no `closedAt` filter, confirming `include` = today's mixed behavior).
- **Suggested fix:** Default to `exclude` (safe funnel semantics) and have `enroll-picker` pass its explicit value. If strict backward-compat is required, document that `include` is legacy-only and no new caller may rely on the default.

---

## Contract Verification (Contract Verifier role)

| Claim | Verdict | Evidence |
|---|---|---|
| Phase 6 `default('include')` = current behavior (backward compatible) | **HOLDS** | `crm/router.ts:217` where-clause `{facilityId, ...stage}` has no `closedAt` filter → lost opps already returned today. `include` = no-op. |
| Phase 9: after-sale/meeting routers have no `list` query (UI cannot render) | **HOLDS** | grep of `after-sale/router.ts` and `meeting/router.ts` finds zero `.query(`. |
| Phase 10: 3 new permission keys are consistent with registry | **FAILS** | `packages/auth/src/index.ts:126-128` — post-sale uses single `.manage`; `crm.noteList` duplicates `crm.opportunityList`'s roster. See Finding 5. |
| Phase 9: needs a new `student.search` procedure | **QUESTIONABLE** | `student.lookup` already registered (`index.ts:73`); verify before adding. See Finding 6. |
| Phase 7 CHECK constraint is on-pattern | **HOLDS (mechanism)** but **relaxed arm is a permanent hole** | repo uses raw CHECKs (`migrations/20260707030000_...`); the legacy-relaxation defeats the invariant. See Finding 3. |

## Summary of recommended scope cuts / re-sizes
1. **Fold `pipelineStats` into `opportunityList`** (Finding 1) — removes a procedure and the dual-invalidation risk.
2. **Split Phase 10** into (a) owner+source, (b) optional notes, (c) trivial schema hygiene (Finding 2); cut `OpportunityNote` unless a real finding demands it.
3. **Use a strict CHECK + backfill in Phase 7** (Finding 3) — do not ship a permanently-loose constraint.
4. **Merge the `opportunityListInput` edits and sequence pipeline UI 3→6** (Finding 4) to avoid write-then-rewrite churn.
5. **Collapse Phase 10's 3 permission keys to ≤1** (Finding 5).
6. **Cut Phase 9's periodic tab + speculative `student.search`** to just the two F10 stubs (Finding 6).
7. **MVP-cut Phase 4** to money + CRM-stage audits (Finding 7).
8. **Default `lost` to `exclude`** (Finding 8).

## Unresolved questions
- Does any stakeholder actually require Opportunity activity **notes** now, or is `assignedToId` + `source` sufficient for the KPI foundation? If notes are speculative, `OpportunityNote` (a full RLS table) should be cut from this plan.
- Is post-sale-mutation audit (Phase 4) driven by a compliance requirement, or inferred from F9's list? If the former, keep it; if the latter, defer.
