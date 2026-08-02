# 2026-08-02 — Solo-vibe operating model + the review-wave that audited its own guardrails

Continues `260802-tier1-guardrails-restoration.md` (which covered #39 Tier-1 guardrails, #46 ui-e2e restoration, #45 Tier-2, #47 toolchain majors, CodeQL enablement). This entry covers the second half of the same day: taking over a parallel session's P0 work, codifying the operating model for a solo + vibe-coding project, and a 5-scope review-wave that caught a critical hole in a guardrail we had just built.

## Context (the framing that changed the decisions)

The project is a **solo developer using vibe-coding** — AI agents generate most code, one human orchestrates. That single fact reframes "process": there is no team and no human-QA fallback, so **automated non-bypassable gates are the review team**. The operating model must maximize automation and minimize the solo human's manual toil, which is the opposite of a team model that adds review steps. Early in the day I nearly recommended team cadences / a CONTRIBUTING.md — wrong audience. The docs audience here is future AI agents (AGENTS.md), and the goal is to take the human out of the loop for routine work.

## What happened

1. **P0 takeover (diverged main).** A parallel session had committed local-sim hardening (non-root containers, loopback ports, CI least-privilege, entrypoint fail-closed) straight to **local main without pushing**, and local main had diverged from origin (missing two Dependabot merges). Reconciled without losing anything: branched the P0 commits, rebased onto origin/main, hard-reset local main, PR'd (#49). Lesson banked into AGENTS.md: **always branch + PR, never commit local main.**

2. **Operating model codified (#50).** Research-backed (2026 solo-dev + AI-code guidance): ui-e2e promoted to a required check; Dependabot patch/minor auto-merge on green CI (majors manual, post-Axios caution); operating rules written into AGENTS.md for the AI-agent audience. `enforce_admins` left false (solo keeps emergency bypass; discipline is the rule).

3. **The review-wave (5 independent scopes).** Before signing off, ran five parallel read-only code-reviewers: CI/CD, security threat-model, test integrity, infra/P0, supply-chain. Outcome:
   - **CRITICAL — the ui-e2e "required" check we had just made was itself bypassable.** The workflow triggered on push *and* pull_request; the push-only ui-e2e job emitted a second `skipped` check on every PR head SHA, and branch protection (latest-wins, skip = pass) let a red gate be cleared by re-running. We had recreated "CI green ≠ real" one layer up — inside the very guardrail meant to close it. Fixed by moving ui-e2e into its own **push-only** workflow (`.github/workflows/ui-e2e.yml`); verified the fix by counting check-runs on the fix PR's head SHA = exactly 1 (#51).
   - Real MEDs fixed: dropped unnecessary `actions: write`, unified the toolchain (scripts was still on vitest 2), narrowed the gitleaks `*.example` allowlist, forced local-sim nginx loopback-only via compose `!override`.
   - HIGH validated, not just asserted: Vite 8 silently swaps the prod bundler Rollup→Rolldown — a "zero-config" bump that CI (vitest) never validates; a real admin+lms build under Rolldown was clean.
   - Corrected an error I had made mid-session: the react-router HIGH CVE is **closed at 7.18.2**, not open needing 8.x.
   - Confirmed clean: ui-e2e coverage was preserved (two specs strengthened), and all 6 CodeQL auth/cert dismissals were independently re-derived as genuine false-positives.

## Lessons

- **For solo + AI-code, the guardrail *is* the reviewer — so the guardrail itself must be audited.** The most valuable finding of the day (C1) was a defect in the safety mechanism I had just added. Building a gate and trusting it is not the same as proving it blocks.
- **A required status check can be a phantom.** A job skipped on one trigger but run on another emits a duplicate `skipped` check; branch protection's latest-wins + skip-passes makes it bypassable. Verify required checks by counting check-runs on a real PR head SHA. (Banked as memory `ui-e2e-required-check-bypass-gotcha`.)
- **Green CI validates modules, not the shipped artifact.** Vitest passing said nothing about the Rolldown-built bundle; only a real build did.
- **Measure, don't chase.** ui-e2e went 21→40/40 over four CI rounds by adapting tests to corrected app contracts — verified as coverage-preserving, not green-chasing, by an independent reviewer.

## End state

main `c7c750f`: 0 open PRs, 0 open CodeQL alerts, required checks = `typecheck-and-test` + `ui-e2e` (now genuinely non-bypassable, proven), GitNexus re-indexed. Concrete enforced posture recorded in memory `guardrail-stack-2026-08-02`.

## Open follow-ups (non-blocking)

- ui-e2e now runs on every PR incl. docs-only — consider a path filter so trivial changes don't pay the ~7-min journey cost.
- Watch the first real Dependabot PR: the capped Dependabot `GITHUB_TOKEN` vs the now-blocking ui-e2e artifact-upload step.
- Periodic coverage re-baseline under vitest 4 (eyeballed OK at 100% on domain-payroll).
