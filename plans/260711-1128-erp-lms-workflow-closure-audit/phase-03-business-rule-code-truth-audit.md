# Phase 03 — Business-rule Code-truth Audit + Spec Sync

## Context
- Plan: [plan.md](plan.md)
- Report: `reports/researcher-01-business-rule-audit-criteria-report.md` (flagged-ambiguities table, lines 97–110)
- Principle (per task): audit CODE first; a doc silence is not an ambiguity if the code already decided the behavior. Escalate to the user ONLY what code cannot resolve.

## Overview
Researcher-01 flagged 7 business-rule ambiguities where design docs (TL19/TL20) are silent. This session already read the implementation for all of them: **6 are resolved in code; 1 (`Gift.minLevel`) is moot because the schema field does not exist.** This phase writes each code-truth verdict into the business-rule docs as an explicit invariant, adds a regression assertion only where a code-truth invariant lacks a test, and escalates the single genuine product question.

## Key Insights (CODE-TRUTH verified this session — cite before changing)
| WF | Flagged question | Code-truth verdict | Evidence |
|----|------------------|--------------------|----------|
| P2-05 | submit idempotent or 2nd errors? | **Not idempotent — 2nd submit rejected**; already-submitted cannot be edited | `submission/router.ts:267` ("Only a draft submission can be submitted."), `:225` |
| P2-06 | concurrent grade race | **Star award idempotent across regrades**, inside a single tx | `submission/router.ts:280` (idempotent star comment), grade tx block |
| P2-07 | confirmed comment immutable? | **Confirm is terminal** — non-draft rejected; re-confirm impossible | `assessment/router.ts:227–228` |
| P2-07 | concurrent confirm | **One wins** — atomic `updateMany WHERE status='draft'` + count==0 guard | `assessment/router.ts:233–244` |
| P2-08 | photo gate at API layer? | **Enforced at query layer** (`canAccessSessionPhoto`, guardian+enrollment+consent) | `session-evidence/photo-access.ts` + `photo-access.test.ts` |
| P4-01 | insufficient stars / stock exhaustion: reject or queue? | **Reject immediately**; stock pre-check + re-read under lock; balance gate under `SELECT FOR UPDATE` | `rewards/reward-router.ts:66,78,88` |
| P4-02 | minLevel view-vs-redeem gate | **MOOT — `Gift.minLevel` field does not exist** in schema | `packages/db/prisma/schema.prisma:1313–1326` |

## Requirements
- For each resolved item: state the invariant in the owning business-rule doc in the doc's own numbering style; cite the behavior, not the plan/phase ID (per project rule on stable artifacts).
- Add a regression test assertion ONLY where the code-truth invariant is not already asserted (most are — see researcher-02). Do not rewrite substantive tests.
- `minLevel`: do NOT build the tier system. Present the drop-vs-build decision to the user (plan.md Q1) via AskUserQuestion during execution; default recommendation = remove `minLevel` from TL20/spec text.
- Do NOT touch the TL25 / roadmap / summary / arch docs (Phase 01 owns those).

## Architecture / Data flow
Design doc invariant ⇄ implementation behavior ⇄ test assertion. This phase makes all three agree: doc describes what code does; test proves it. Source of truth on conflict = code (verified), then escalate only genuine product gaps.

## Related files (own exclusively)
- `docs/19-quy-tac-nghiep-vu-chi-tiet.md` (TL19 — P1/P2 rules)
- `docs/20-quy-tac-nghiep-vu-van-hanh.md` (TL20 — operational rules incl. rewards)
- `docs/28-workflow-spec-p4.md` (P4 spec — minLevel text lives here)
- Optional targeted assertion (coordinate — NOT owned by Phase 02): `submission/grade.test.ts`, `assessment/draft-confirm.test.ts`, `rewards/redeem-refund.test.ts`. Only add cases; never edit the 4 files Phase 02 owns.
- Read-only: the router/schema files cited above.

## Implementation Steps
1. Re-grep each cited line to confirm it still matches before writing the invariant (scout summaries go stale).
2. TL19: add explicit invariants for P2-05 (submit is one-way, 2nd rejected), P2-06 (star award idempotent across regrades), P2-07 (confirm terminal + single-winner concurrency).
3. TL20: add P4-01 invariants (insufficient stars → immediate reject; stock exhaustion → immediate reject; balance serialized via row lock).
4. TL28 + TL20: locate every `minLevel` mention; mark as NOT-IMPLEMENTED pending the Q1 decision. If user (via AskUserQuestion) says drop → remove the tier text; if build → this becomes a separate feature plan, out of THIS plan's scope.
5. For each invariant, check researcher-02's table for an existing assertion. If missing, add ONE targeted regression case in the corresponding test file (e.g. P2-05 double-submit → expect reject) and run it.
6. Run `pnpm --filter @cmc/api exec vitest run` for any file touched.

## Todo list
- [x] Re-grep + confirm all 7 code-truth citations (all matched; 1 correction found: `pg_advisory_xact_lock`, not `SELECT FOR UPDATE`)
- [x] Write P2-05/06/07/08 invariants into TL19
- [x] Write P4-01 invariants into TL20
- [x] minLevel (Q1) — pre-resolved in validation interview (drop); applied without re-asking
- [x] Add missing regression assertions (only P2-07 concurrent-confirm was missing; added)
- [x] Suite green for any test touched (59/59 touched-file subset; 532/532 full suite)

## Success Criteria
- All 6 resolved ambiguities have a written invariant in TL19/TL20 matching verified code.
- `minLevel` is either removed from docs or explicitly deferred with a logged user decision — no silent assumption.
- Any newly added regression case passes; no existing substantive test weakened.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Code changed since this session's grep | Low | High | Step 1 re-greps every citation before writing |
| Inverting behavior by mis-describing a tx guard | Low | High | Trace the actual control flow (WHERE-clause + count check), not just the line |
| Building minLevel by default (scope creep) | Med | Med | Default is DROP; build only on explicit PO ask → separate plan |
| Editing a Phase 02-owned test file (ownership clash) | Med | Med | Phase 03 only touches grade/draft-confirm/redeem-refund tests; never course/room/facility/session-me |

## Security Considerations
P2-08 (child-photo access) and P4-01 (star-balance integrity) are the compliance-sensitive invariants. When documenting them, preserve the exact enforcement point (query-layer guardian check; row-lock balance gate) — a doc that misstates the gate can mislead a future refactor into removing it.

## Rollback
Doc edits: per-file git revert. Test additions: additive, revert the single file. No production code changes in this phase.

## Next steps
minLevel decision may reshape TL25/roadmap wording (coordinate back to Phase 01 if it lands after 01 completes). Feeds Phase 05 which smoke-tests the same 4 workflows end-to-end.
