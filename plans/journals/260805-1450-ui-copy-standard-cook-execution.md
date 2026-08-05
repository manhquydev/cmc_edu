# Journal — Cooking the UI copy-standard plan end-to-end

**Date**: 2026-08-05 14:50
**Component**: Design system copy standards, LMS auth copy, ESLint config
**Status**: Completed — all 5 phases, all required CI checks green on `feat/ui-copy-standard`

## What happened

Ran `plans/260805-1153-chuan-hoa-tu-ngu-ui-frontend/plan.md` end-to-end
(`--tdd --auto`), after the plan itself had already survived 3 rounds of
red-team before this session started (see `plan.md` §"Red Team Review" for
that history — not repeated here). This entry covers the *execution* session:
git hygiene before branching, the 5 phases, two CI-caught misses, and a
concurrent-session collision discovered mid-work.

## Pre-cook: git hygiene split

Before touching the plan, `develop`'s working tree had two unrelated
uncommitted work streams mixed together: a security fix (LMS default-password
disclosure in `login.tsx`) and an unrelated in-progress feature (Design Lab 2
UI exploration — new route, new page, mockup assets). The plan's own
"Git hygiene" section mandated commit → PR → merge → *then* cut the branch,
and forbade `git stash` (Phase 3 touches the same `login.tsx` line). Asked the
user how to handle the two streams; they chose to split them into separate
PRs. Created `fix/lms-default-password-disclosure` (PR #66) and
`feat/design-lab-2-exploration` (PR #67), merged both into `develop`, then cut
`feat/ui-copy-standard` from the resulting clean `develop`.

## Phases 1–5

- **Phase 1** — wrote the tightened subtitle rule into `PAGE-FRAMES.md` (kept
  the slot, added a "must carry non-inferable information" constraint),
  extended `MASTER.md`, built `eslint.copy-audit.config.js` as a throwaway
  audit-only config, proved it with a TDD fixture (1 positive hit, 0 false
  positives), then generated the real worklist — matched the plan's
  machine-generated artifact 16/16.
- **Phase 2** — applied a fully deterministic decision table to 34 subtitle
  strings (1 keep-as-is test-coupled anchor, 5 keep-and-shorten, 28 delete).
  All 7 dynamic subtitles read individually (can't be grepped) — all
  legitimately informative, none changed.
- **Phase 3** — scrubbed 22 internal-identifier strings (API names, component
  names, dev-role codes) to business language. Also fixed the LMS OTP banner,
  which disclosed `ConsoleEmailTransport`/Brevo/Graph internals to any
  unauthenticated visitor — gated it behind `import.meta.env.DEV` instead of
  just rewording it, so production now shows nothing.
- **First CI-caught miss**: `finance/refund.test.tsx` asserted on the literal
  string being removed — a coupling the plan's machine-generated worklist
  didn't track (it only tracked e2e + other `*.test.tsx`, and this one slipped
  through). Caught by local `pnpm test`, fixed same-phase.
- **Phase 4** — dual-edited source+test+e2e for 3 of the plan's 4 coupled
  strings. The plan's Open Question 1 (rename the `users.tsx:346`
  "User ID (auth identity)" form label?) had gone unanswered; the plan had
  pre-defined a time-bound default for exactly this case, so that default was
  applied autonomously (drop the string, remove the token from the lint
  pattern, document why in `MASTER.md`) rather than blocking the pipeline.
- **Phase 5** — promoted the copy rule from the throwaway audit config into
  `eslint.config.js` as a deliberate *second* flat-config object, verified via
  `eslint --print-config` (not finding-count comparison) that the existing
  "single door" import rule still applies to `design-lab.tsx`. Added a
  `docs/12` §8 pointer to the SoT. Corrected the original brainstorm report in
  place (kept as history, added a correction note) since 3 of its foundational
  claims were the ones the plan's own red-team had overturned.
- **Second CI-caught miss**: after pushing Phase 5, `ui-e2e` failed —
  `lms-login.ui.spec.ts:107` asserted the OTP banner text was visible, but
  `ui-e2e` builds production mode, so the newly DEV-gated banner correctly no
  longer renders there. Same *class* of miss as the refund test (a real
  coupling the plan's inventory never listed). Fixed by dropping the
  now-inapplicable assertion while keeping the test's actual intent (tab
  switching + per-tab fields); confirmed green on the next CI run.

## Noticed but deliberately not touched

Mid-session, `apps/admin/src/pages/design-lab-2.tsx`/`.css` (merged via PR #67
*before* this branch was cut) started showing large unstaged diffs — a
substantial "Odoo ERP Minimalist Cockpit" addition appearing live in the
working tree — and a new `plans/260805-1421-design-lab-3-odoo-ui-recreation/`
directory appeared. Since git branches share one working tree, this showed up
in every `git status` even though it belongs to a separate, apparently
still-running session. Every commit explicitly named its files (never
`git add -A`), verified via `git diff --cached --stat` before committing.
Flagged directly to the user rather than silently working around it.

## Lessons learned

1. **A machine-generated worklist still isn't a completeness proof.** The
   plan's artifact was built by running the real lint rule against the real
   codebase — as authoritative as a static-analysis-only design gets — and it
   still missed 2 real couplings, because both were forms static AST matching
   structurally cannot see: a JSXText assertion on an *old* string value
   (`refund.test.tsx`) and an e2e assertion on content whose visibility
   depends on a *runtime* build-mode flag (`import.meta.env.DEV`) rather than
   its literal text. `pnpm test` locally caught the first before push; CI
   caught the second because `ui-e2e` runs a different build mode than local
   dev. Running the narrowest test first (unit before e2e, per project rules)
   paid for itself directly here.
2. **A plan that pre-writes its own escape hatches survives unattended
   execution.** Open Question 1 blocking Phase 4 had a documented, time-bound
   default ("no answer ⇒ do X, mark Phase 4 completed anyway") written *into
   the plan itself* during red-team. That's what let `--auto` mode proceed
   through a real unresolved decision without stalling or guessing.
3. **Shared working tree + concurrent session = read every `git status` before
   staging.** `git add -A` would have silently swept another session's
   in-progress, unrelated work into this plan's commits at least three
   separate times across this session.
