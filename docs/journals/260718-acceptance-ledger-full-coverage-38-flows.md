# Acceptance Ledger: Full 38-Flow Coverage + The Orphan-Count Trap

**Date**: 2026-07-18
**Severity**: Completed / Coverage Milestone
**Component**: scripts/acceptance-report (manifest + verify whitelist/gaps), docs/25 traceability matrix
**Status**: Shipped (commit ff5c401). Dashboard coverage 9→38 flows (27%→100% of P1–P4 + ADMIN).

## What Happened

Expanded the acceptance-ledger manifest from the v1 P1-only 9 flows to the full 38:
8 P2 (class ops), 11 P3 (HR/payroll), 5 P4 (rewards/after-sale), 5 ADMIN
(super-admin surface, no TL25 WF codes). Every procedure/route/model was mapped
by dumping the real scanner output (144 procedures, 57 routes, 50 models) and
assigning against it — not by transcribing docs/25, which is itself stale in ~16
route cells (all now synced).

Result: `pnpm acceptance:report` → 38/38 built, 0 partial/missing, **orphans 114→2**,
0 unresolved namespaces.

## The Brutal Truth: the orphan target was a trap the red-team caught

The original plan set "orphan < 20" as a pass/fail gate. The assumption-destroyer
red-team proved this arithmetically unreachable: TL25 names only the *primary* 1-6
procedures per workflow, but the API exposes ~144 procedures — many secondary
CRUD/list/action procedures (`submission.listForGrading`, `classSession.cancel`,
`crm.opportunityGet`…) that no TL25 row names. Chasing "< 20" would force one of two
bad outcomes: (a) staple unrelated procedures onto workflows whose displayName
doesn't describe them (semantic pollution), or (b) dump real business procedures
into an infra whitelist (hiding capabilities from the exact tool built to surface
them). Both defeat the tool's purpose.

The fix was to make orphan-count **observational, not a gate** (E7), and to define a
principled middle path (E1): a flow may claim a *secondary* procedure IF that
procedure genuinely serves the flow's own screen/queue, each with a one-line reason.
`finance.receiptList` belongs to P1-03 because it IS the approval queue that flow
uses; `course.create` does NOT belong to any flow because it's standalone catalog
authoring with no workflow. That distinction — "does this flow's screen actually call
it" — is what keeps E1 honest and prevents the pollution S3 warned about.

Applied rigorously, residue fell to 2 genuine documented gaps
(`course.create`, `parentAccount.updateEmail` — real capabilities with real routes
but no TL25 workflow) plus one infra procedure (`session.me`) whitelisted. Not zero,
and honestly so.

## Technical Details

### Whitelist shrink + procedure-level whitelist + documented gaps — all guarded
- Namespace whitelist shrank [health,lmsAuth,audit,user,facilityNetwork] →
  [health,lmsAuth]. Safe because the 3 removed namespaces are now fully claimed by
  ADM-04/02/03 — proven by the tool reporting only 2 orphans, both outside those
  namespaces.
- Added `INFRA_PROCEDURE_WHITELIST` (session.me only — infra nav-gating, read-only,
  non-admin) and `DOCUMENTED_GAPS` (the 2 residual capabilities, each with a reason).
- **Every one of these lists has a liveness guard** that throws if an entry no longer
  resolves to a real scanned procedure. This mirrors the existing namespace guard and
  is the anti-drift invariant: a whitelist/gap map that can't lie about what it covers,
  because a stale entry crashes the run instead of silently masking. Verified by
  temporarily injecting a dead entry — the tool threw, as designed.

### Actor-guard preservation in route remap (child-data)
The `/child/:id/*` → real-route remap touched the LMS child-facing rows. Security
red-team (S5) flagged that P2-08 (session evidence = child photos, TL08 §7) is a
**parent-mediated** view: its real route is `/parent/evidence/:studentId` behind
`<ParentOnly>`, NOT a `/student/*` path. Collapsing it to a student route would have
mis-stated who authenticates to view a child's photos. Rule added to E2; the manifest
and docs/25 both keep the parent route.

### ADMIN cluster evidence exclusion
All 5 ADMIN flows are cross-facility super-admin views (facilities list across the
network, all-staff AppUser CRUD, network IP config, audit log, shift config). The
original plan flagged only the audit flow for permanent no-evidence; red-team (S2)
caught that all 5 are equally cross-facility. None set `uiEvidenceSpec` — so when the
gated Phase 4 evidence collector eventually runs, it can never screenshot cross-facility
PII from any of them.

## What We Tried
1. **"orphan < 20" as a gate** — abandoned (see Brutal Truth); replaced with
   observational metric + mandatory a/b/c triage.
2. **Aggressive full-namespace claiming** to drive orphans toward zero — rejected as
   semantic pollution. Settled on "claim only what the flow's screen calls."

## Lessons Learned
1. **A metric that's cheap to game will get gamed.** "orphan < 20" would have quietly
   corrupted the manifest or the whitelist. Removing the numeric gate and demanding
   *classification* of every residual (claimed / infra-whitelisted / documented-gap)
   keeps the tool honest without a number to chase.
2. **Anti-drift lists need liveness guards too.** A whitelist or gap-map is itself
   hand-maintained state — exactly what this tool exists to distrust. Making a stale
   entry crash the run (not silently pass) extends the anti-drift guarantee to the
   tool's own config.
3. **Route syncs on a K-12 platform must preserve the actor.** Who authenticates to
   see a child's data is security-relevant content, not a cosmetic path detail — a
   batch route-remap must never flatten parent-mediated into student-direct.
4. **Don't `git checkout <file>` on uncommitted work.** During a liveness-guard test I
   restored verify.ts with `git checkout`, silently reverting the session's whitelist
   edits to the committed version. Caught it via an anomalous orphan count and re-applied.

## Next Steps
1. **Two documented gaps for PO/tech-lead triage**: `course.create` (course-catalog
   authoring at /admin/courses, no WF) and `parentAccount.updateEmail` (email backfill).
   Decide: add a TL25 workflow, or accept as admin utilities.
2. Phase 4 (evidence screenshots) still GATED — unchanged this round.
3. docs/25 now matches real routes; future route refactors will surface as red rows on
   the next `pnpm acceptance:report`.

---

**Status**: DONE. 38/38 built, 2 documented gaps, independent code-review 9/10 no
blockers, tsc strict clean, drift test + liveness-guard test pass, both dashboard tabs
visually verified.
