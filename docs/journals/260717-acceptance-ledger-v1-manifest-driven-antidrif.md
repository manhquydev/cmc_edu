# Acceptance Ledger v1: Why Manifest Encodes Real Code, Not Docs

**Date**: 2026-07-17 11:20  
**Severity**: Completed / Design Pattern  
**Component**: scripts/acceptance-report (new tool), tRPC/React Router/Prisma scanners, flow manifest  
**Status**: Shipped v1 (Phases 1–3, ~920 LOC across 10 new files, commit d8ba223). Phase 4 (screenshot evidence) explicitly gated pending child-data risk review.

## What Happened

Shipped v1 of *Sổ Nghiệm Thu Sống* (living acceptance ledger) — a static analysis tool that regenerates truth from code at HEAD, replacing hand-maintained acceptance status docs that drifted repeatedly. The tool scans:
- **tRPC API surface**: ts-morph parsing + recursive router resolution (handles `mergeRouters()`, multi-exports, namespace decoupling from filenames)
- **React Router trees**: apps/admin + apps/lms page hierarchies
- **Prisma models**: packages/db/prisma/schema.prisma entities

Cross-references against a hand-written manifest (currently 9 flows from docs/25-ma-tran-truy-vet-p1.md), renders dual-tab HTML: technical "Builder" drill-down (dev-facing) and "Nghiệm Thu" acceptance view in Vietnamese (director-facing). Zero hand-maintained state between runs — everything recomputed. Command: `pnpm acceptance:report`.

**Critical finding during implementation:** the flow manifest deliberately encodes CURRENT REAL code, not copies from docs/25. Found & flagged 4 places where docs are stale vs actual code (e.g., TL25 says `/finance/receipts/new`, code is `/finance/new`; TL25 lists `/finance/reconciliation`, code has `/ops/recon`). These are inline NOTE comments in flow-manifest.ts, left unresolved intentionally — the tool exists precisely because maintaining docs-vs-code sync manually is what failed before. A human (PO/tech lead) owns sync'ing TL25 to reality; the tool's job is to expose the drift.

## The Brutal Truth

This tool is an antidote to a recurring pattern: business-logic docs in docs/25-ma-tran-truy-vet-p1.md have drifted from code THREE times in this project. Each drift took 6–12 hours to debug and sync. We could keep trying to enforce "update docs when you refactor routes" — humans have tried, humans have failed. Instead: **make the ground truth regenerable**. No more "did someone remember to update TL25?"

The manifest approach feels like cheating (hand-written YAML = human work), but it's a ONE-TIME cost. Run the tool once every sprint; manifest stays pinned to reality by automation, not discipline. When a route disappears or a model gets renamed, the next run shows ◐ (incomplete, needs re-investigation). The tool's honesty is the win.

One secondary benefit: the director-facing "Nghiệm Thu" tab is pure Vietnamese text, no code. Directors can read "Quản lý lương bậc (salary): ◐ built, not yet proven" without understanding what "tRPC procedure" means. This bridges the gap between PO acceptance criteria and dev execution.

## Technical Details

### 1. tRPC Scanner — Recursive Router Resolution

- **Challenge**: `apps/api/src/router.ts` mounts sub-routers via `mergeRouters()`, and some are imported with aliases (`import { fooRouter as bar }`). Naive glob of filename would miss routes; namespace-aware resolution required.
- **Solution**: ts-morph AST walk of the appRouter object. For each `mergeRouters()` call, resolve each argument to its original export name (not the local alias). Recursively parse each resolved file. Handles multi-export files (`export { router1, router2 }`).
- **Latent bug caught by code reviewer**: original code resolved by alias name instead of exported name — would silently fail on `import { fooRouter as bar }; mergeRouters(bar)`. No aliased imports exist today (fortunate), but failure mode (silent unresolved) is exactly what this tool exists to prevent. Fixed + re-verified before ship.

### 2. Manifest — Real Code Snapshot

- **Format**: `FlowEntry[]` in `flow-manifest.ts` — id (WF code from TL25), Vietnamese displayName, cluster, actor roles, and `expected: { trpc, uiRoutes, models }`. No `built`/`verified` boolean fields — status is always computed at run time by `verify.ts`, never hand-set. Example (P1-03):
  ```ts
  {
    id: 'P1-03',
    displayName: 'Duyệt phiếu kích hoạt học viên',
    cluster: 'P1',
    actorRoles: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
    expected: {
      trpc: ['finance.receiptApprove'],
      uiRoutes: ['/finance/:id'],
      models: ['Receipt'],
    },
  },
  ```
- **Philosophy**: This is the "contract we're committing to right now." Not aspirational (docs/25), not reactive (git log). A snapshot of what actually exists, written once.
- **Found 4 drift issues**: inline NOTE comments flag them, e.g.:
  ```ts
  // NOTE: TL25 ghi route "/finance/reconciliation" — route thật là "/ops/recon"
  // (ops.routes.tsx).
  uiRoutes: ['/ops/recon'],
  ```

### 3. Self-Caught .gitignore Bug

- **Symptom**: After writing 200+ LOC of new source files, `git status` showed ZERO new files.
- **Root cause**: `.gitignore` had `acceptance-report/` (no leading `/`). In git's pattern semantics, this matches at ANY depth — so it was silently gitignoring `scripts/acceptance-report/` (the tool's own source) alongside the intended repo-root `/acceptance-report/` output directory.
- **Impact**: Entire tool would have shipped untracked, invisible in git. Next developer clones, missing source, tool fails.
- **Fix**: Anchored pattern to `/acceptance-report/`. This bug would NOT have been caught by CI (git tracking is pre-CI). Caught only by manually running `git status` after writing code.

### 4. Vacuous-Truth Bug Caught by Code Reviewer

- **Symptom**: verify.ts computed totalMissing vs totalExpected for each flow. A flow with zero expected symbols would show totalMissing===totalExpected===0, misclassified as "built" when nothing was actually verified.
- **Impact**: Small risk today (our 9 flows all have symbols), but a booby trap for future manifest entries.
- **Fix**: Added startup guard that throws if any flow has zero expected symbols across trpc/uiRoutes/models. Forces manifest entries to be meaningful.

### 5. End-to-End Verification

- **Code review**: independent subagent, score 9/10, no blockers. Caught bugs (1) and (4) above.
- **Tester verification**: ran tool on different procedure than dev test (independence), confirmed zero regression on clean revert. Drift detection working correctly.
- **Visual (chrome-devtools)**: both tabs render correctly at 1440×900. Zero console errors. Matches locked premium design language (monochrome icons, Inter, restraint).

## What We Tried

1. **Full Phase 4 in scope**: Original plan included Playwright screenshot automation (40% of effort, 100% of child-data risk surface — live UI screenshots of real student/guardian data if pointed at wrong database). Red-team round 2 flagged this; decided to gate it.
2. **Filename-glob router scanning**: First instinct for the tRPC scanner was globbing `**/router*.ts`. Red-team caught this early (before any code was written) — namespaces decouple from filenames (`meeting/router.ts` mounts as `parentMeeting`), some files export multiple named routers, some namespaces are `mergeRouters()` composites. Went straight to ts-morph AST resolution of the `appRouter` object instead.

## Root Cause Analysis

**Why hand-maintained docs failed before, why anti-drift automation succeeds:**
- Docs are static text. Routes are code. When code changes, docs don't auto-update. Over 12 sprints, dozens of route refactors, TL25 fell out of sync.
- **Solution: make ground truth regenerable.** Run `pnpm acceptance:report` once per sprint. Tool scans code, finds what's real, compares to manifest. No more "did someone remember to update the docs?"
- **Manifest is not docs; it's a contract snapshot.** It doesn't drift because it's code + tests, not prose. When a tRPC procedure disappears, the next `pnpm acceptance:report` run fails visibly (◐ unresolved). Failure forces a choice: restore the procedure or update the manifest. No silent divergence.
- **Phase 4 gating was the right call.** Child-data risk (live screenshots of student data) outweighs the benefit (visual proof). v1 already delivers core value: regenerable truth + director-readable view with honest status (◐ = "built but not proven"), not false green checkmarks.

## Lessons Learned

1. **Anti-drift tools must regenerate from source-of-truth, not replicate docs.** Manifest encodes real code (procedures/pages/models that actually exist), not a copy of TL25. When code refactors, manifest becomes "wrong" automatically (tool fails on next run), forcing a sync decision. This is the opposite of hidden drift.

2. **Static analysis + scanners catch latent bugs that tests miss.** Aliased-import bug (bug 1) and vacuous-truth bug (bug 4) would never surface in today's code (no aliased imports, no zero-symbol flows). But both are silent failure modes. Static analysis made them visible + fixable preemptively.

3. **.gitignore pattern scope is easy to get wrong.** Anchoring to `/` is non-obvious (most patterns don't need it). Need to teach: always run `git status` after writing new files, even if CI "passed."

4. **Phase-gating for risk is honest and cheap.** Phase 4 (screenshots) is 40% effort for 100% of the child-data risk surface. Shipping v1 without it costs nothing (tool works, directors see honest status). Shipping Phase 4 unprepared costs reputational + legal risk. Gate it, own the risk explicitly, revisit next sprint with fresh threat model.

5. **Manifest as contract snapshot.** The manifest is not a bug tracker, not a TODO list, not a design doc. It's "this is what we've built, this is what we claim to build next, and this is the gap." Clarity on those three things beats hand-waving.

## Next Steps

1. **PO/tech-lead sync TL25 to manifest** — 4 drift items flagged as NOTE comments in flow-manifest.ts. Decide: is the code wrong (rename routes back), or is TL25 wrong (update docs)?
2. **Weekly `pnpm acceptance:report` in sprint ritual** — add to Definition of Done. Manifest stays pinned to reality.
3. **Phase 4 threat model re-review next sprint** — child-data risk assessment for screenshot automation. If risk is acceptable, implement Playwright stage.
4. **Docs: link flow-manifest.ts in docs/system-architecture.md** — teams should know the tool exists + when to expect it to fail (means code/manifest are out of sync).

---

**Status**: v1 DONE (Phases 1–3, all tests passing, code review ✓, end-to-end verified, 4 docs-drift findings flagged for PO sync). Phase 4 gated pending child-data risk review. Tool ready for weekly adoption in sprint workflow.
