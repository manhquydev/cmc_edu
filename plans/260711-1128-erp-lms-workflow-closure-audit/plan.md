---
title: "ERP↔LMS Workflow Closure Audit — verify + close the docs-vs-evidence gap"
description: "Reconcile 'documented as done' against what is actually provable by real tests + running local stack for P1–P4 workflows across 7 roles."
status: completed (core: phases 01-03; phase 05 optional stretch not run)
priority: P2
effort: 6h core (+5h optional stretch)
branch: main
tags: [audit, testing, docs-reconciliation, erp, lms, workflow-closure]
created: 2026-07-11
---

# ERP↔LMS Workflow Closure Audit

## Problem
`docs/25-ma-tran-truy-vet-p1.md` (TL25) claims 28/28 workflows fully closed and that test specs "chưa tồn tại". Evidence proves the opposite: 64 test files in `apps/api/src` (docs say 54), 26/27 domains have substantive multi-invariant tests, the 4 user-named priority workflows all carry real security assertions. The real gap is **stale docs + a few thin tests + design-doc silence on behaviors the code already decided** — not missing implementation. This plan verifies code-truth and closes the provable gap. No VPS/deploy work: the local self-hosted Docker stack (`cmcv2-prod`, healthy) is treated as "real" production for this phase.

## Scope
- IN: doc reconciliation, thin-stub test expansion, code-truth audit of 7 flagged business-rule ambiguities, P4-02 test-location decision, optional local-stack E2E smoke of 4 named workflows.
- OUT: VPS provisioning, remote deploy, infra/CI changes, new business features (incl. building `Gift.minLevel` tier system unless PO asks).

## Roles in scope
ERP active: sale, giao_vien, giam_doc_kinh_doanh, giam_doc_dao_tao, super_admin. LMS-only: hoc_sinh, phu_huynh.

## Phases
| # | Phase | Status | Effort | Depends |
|---|-------|--------|--------|---------|
| 01 | [Doc-truth reconciliation](phase-01-doc-truth-reconciliation.md) | completed | 1.5h | — |
| 02 | [Thin-stub test expansion](phase-02-thin-stub-test-expansion.md) | completed | 2h | — |
| 03 | [Business-rule code-truth audit + spec sync](phase-03-business-rule-code-truth-audit.md) | completed | 2.5h | — |
| 04 | [P4-02 gift test-location decision (optional)](phase-04-gift-test-location-decision.md) | resolved-no-op (folds into 01) | 0h | 03 |
| 05 | [Local-stack E2E smoke of 4 workflows (optional stretch)](phase-05-local-stack-e2e-smoke.md) | not run (optional) | 4h | 02,03 |

Phases 01/02/03 are parallel-safe (disjoint file ownership: 01=summary/arch/roadmap/TL25 docs, 02=4 test files, 03=TL19/TL20/TL28 docs + targeted assertions). 04 and 05 optional.

## Acceptance criteria (plan-level)
- Every stale doc claim corrected against a verified source (real test file / real schema / real test-run count).
- Each of the 7 flagged ambiguities has a written resolution: code-truth verdict + doc invariant, OR an explicit AskUserQuestion escalation logged.
- 4 thin-stub tests either expanded with named cases that pass, or documented as acceptable-by-design with reason.
- `pnpm --filter @cmc/api exec vitest run` stays green after all test edits.

## Verified corrections to input reports (do not re-litigate)
- `apps/api/src/test/` is NOT a missing workflow domain — it is `test/db.ts`, a 26KB shared integration-test harness. NON-ISSUE.
- `course-crud.test.ts` / `room-crud.test.ts` live at `apps/api/src/course/` and `apps/api/src/room/`, not under `after-sale/`.
- `session/session-me.test.ts` returns the caller's OWN identity mirror — "non-owned session FORBIDDEN" does not apply; verify intent before expanding.
- `Gift.minLevel` does NOT exist in `packages/db/prisma/schema.prisma` (Gift: id, facilityId, name, imageUrl, starsRequired, stock, isActive, timestamps). The "minLevel view-vs-redeem gate" ambiguity is moot doc-drift.

## Validation Summary

**Validated:** 2026-07-11
**Questions asked:** 4

### Confirmed Decisions
- **Q1 `Gift.minLevel`:** drop from docs (YAGNI, no schema field, matches 5-role-reality discipline). Phase 01/03 must remove/correct any doc still describing it as implemented.
- **Q2 P4-02 gift test:** doc-correction only, no file split. TL25/TL28 test-column references get corrected to point at `rewards/redeem-refund.test.ts`, not a new `gift.test.ts`. Phase 04 (optional split) is now effectively skippable — closed by this decision.
- **Q3 `session-me.test.ts`:** EXPAND, not keep-as-is. Add unauth-rejection + missing-facility cases per Phase 02's plan (reverses the phase's original "verify intent, may be smoke-by-design" framing — now confirmed: expand).
- **Q4 Roadmap vs TL25:** NOT a contradiction — a timeline gap, git-verified. P4 code landed 2026-07-07 (`44f26b9`). Roadmap authored 2026-07-08 (`a018747`) correctly flagged P4-adjacent test gaps (appointment/reconciliation/course/room/parentAccount) that existed at that moment. Those gaps closed 2026-07-10 (`326dfcc`, test backfill commit). TL25's design-closure claim was correct throughout (different metric: role/ADR/procedure mapping, not test existence). Resolution written into `phase-01-doc-truth-reconciliation.md`.

### Action Items
- [x] Phase 01: correct `docs/project-roadmap.md` M2 row per the Q4 resolution (cite `326dfcc`; don't blanket-mark M2 done — WF-P4-04/05 acceptance + họp PH audit remain separately open unless verified elsewhere in this plan).
- [x] Phase 01/03: remove `Gift.minLevel` references from `docs/20-quy-tac-nghiep-vu-van-hanh.md` / TL25 / TL28 per Q1.
- [x] Phase 01/04: correct TL25/TL28 P4-02 test-file reference to `rewards/redeem-refund.test.ts` per Q2; treat phase-04 as closed/no-op (doc-only, folds into phase 01).
- [x] Phase 02: `session-me.test.ts` scope is now EXPAND (per Q3) — update phase file's "verify intent" framing to a firm requirement.

**Recommendation:** Proceed to implementation (`/ck:cook` or `/ck:plan` execution) — all 4 open questions resolved, no remaining ambiguity blocking phases 01-03. Phase 04 collapses into phase 01. Phase 05 (E2E smoke) remains genuinely optional/stretch, unaffected by this validation.

## Finalize Summary (2026-07-11, via `/ck:cook`)

**Executed:** Phases 01-03 via 3 parallel subagents (docs-manager for 01, fullstack-developer for 02/03), disjoint file ownership, zero conflicts.

**Results:**
- Phase 01: 4 docs corrected (system-architecture.md, codebase-summary.md, TL25, project-roadmap.md) — stale "P2-P4 not built"/"tests don't exist" claims replaced with verified evidence; P2-P4 router documentation added; M2/TL25 timeline reconciled.
- Phase 02: 4 test files expanded (course-crud, room-crud, facility-validation [doc-only], session-me) with role-gate + cross-facility-isolation + unauth-rejection cases.
- Phase 03: 6 code-verified invariants written into TL19/TL20; `Gift.minLevel` dropped (Q1); P4-02 test-file reference corrected in TL28; 1 missing regression case added (P2-07 concurrent-confirm).
- Phase 04: no-op, folded into Phase 01 per Q2.
- Phase 05: not run (optional stretch, user's cook invocation deferred it).

**Code review (mandatory gate):** 1 HIGH finding — stale "531 passing/13 skipped" test count survived into the "corrected" docs (mid-parallel-run capture race) plus a phantom reference to the already-deleted `lms-auth-two-tier` suite. Fixed post-review: all 3 docs (+ 2 older stale "must un-skip" checklist items in system-architecture.md/codebase-summary.md predating this plan) now read 532 passing / 0 skipped / 64 files, live-verified.

**Final verification:** `pnpm --filter @cmc/api exec vitest run` → **532/532 passing, 64 files, 0 failures** (full suite, all 3 phases' changes merged). `tsc --noEmit` clean on apps/api. Zero production code touched — docs + tests only, as scoped.

**Not done (explicitly out of scope or deferred):**
- Phase 05 E2E smoke — optional, not run this session.
- VPS/deploy — explicitly excluded from this plan's scope.
