# Astryx Migration Phase 5 · Landing SMALLER than Mantine

**Date**: 2026-07-10 15:32  
**Severity**: Info  
**Component**: UI framework migration (Mantine 7 → Astryx 0.1.4)  
**Status**: Resolved (PR #28 merged to main)

## What Happened

Phase 5 completed all 6 acceptance criteria. Removed `@mantine/*` dependencies entirely from `apps/admin` and `apps/lms`, reworded migration-context code comments to drop brand references (substance preserved), and synced design-system + tech-stack docs to reflect Astryx. CI gate green on PR #28 (merge commit, per-phase history intact). Two downstream plans (golive-sprint UAT, ui-implementation) now unblocked.

## The Brutal Truth

This is deeply satisfying because **we landed SMALLER than the baseline**, not bigger. The Phase 1 spike predicted precompiled Astryx CSS would be smaller than Mantine's per-component-loaded overhead; that bet just paid off in production. Bundle shrank −2.5% (admin) and −9.5% (lms) gzip vs Phase 1 Mantine baseline — well inside the +15% ceiling the gatekeeping set. The spike-gate discipline worked exactly as intended: speculate, validate the risk, commit only if evidence held. It held.

## Technical Details

**AC#1 (Zero Mantine)**: `rg -i "mantine"` → 0 matches across codebase, lockfile, and built artifacts. All `@mantine/*` entries stripped from lockfile after `pnpm install`.

**AC#4 (Bundle metrics)**:
- admin: 291.83 kB (baseline) → 284.4 kB (−2.5%)
- lms: 221.57 kB (baseline) → 200.6 kB (−9.5%)

Both figures verified by Vite build output (55 and 23 distributable files respectively).

**AC#3 caveat (test authority)**: Local `pnpm test` failed with `Unique constraint (phone)` on `@cmc/api` backend suites — accumulated row contamination in the shared dev DB from interrupted runs. Did NOT reset the DB destructively (other worktrees depend on it). Instead **trusted CI's authoritative gate**: PR #28's `typecheck-and-test` job ran on fresh `cmc_ci` DB and passed green (runs 29081982230 + 29081985593). Phase 5 diff touches only deps + comments + docs — zero test logic, zero API code.

**CI e2e discovery**: First CI run's `e2e` job failed because the `ui-chromium` Playwright project was registered unconditionally. Default `playwright test` tried to launch a browser CI never installed. Fixed by gating the project behind `PLAYWRIGHT_UI=1` (commit `f3005c8`), matching the webServers gating already documented in config comments but only half-implemented. Second run fully green (API-only: 18 specs; `PLAYWRIGHT_UI=1` unlocks 6 UI specs for separate workflow).

**AC#5 (Auth-parity)**: e2e verified on real DOM via `lms-login.ui.spec.ts`: OTP autocomplete, password masking, phone inputmode, generic no-leak error, no secrets in network/console.

## What We Tried

- Phase 1 (spike): measured Astryx footprint; predicted CSS would be smaller than Mantine's component granularity overhead.
- Phase 2–4: incremental admin + lms migration, testing auth-parity each phase.
- Phase 5: removed deps and ran full typecheck/build/e2e locally; discovered test failures tied to DB state, not code regression.

## Root Cause Analysis

The CI e2e bug existed because the Playwright config had the gating intent documented in comments (lines 17–18) and implemented for `webServer` array, but the `projects` array was missing the conditional — a **half-measure that only surfaced when CI actually invoked the UI specs** (they didn't exist on main before). Mirrors a recurring pattern: safety-net infrastructure (e2e config, theme fallbacks, a11y intent) gets authored with the right design in mind but implementation lags behind or has seams.

The DB contamination was orthogonal to this migration. Test authority belongs to CI on a fresh DB, not to a noisy local developer machine. Respecting that boundary prevented a destructive shortcut that would have masked whether the problem was real or environmental.

## Lessons Learned

1. **Half-measures in safety nets bite last**: The e2e config's gating was 50% complete (webServers yes, projects no). Ship safety infrastructure fully or don't ship the gating syntax at all; incomplete gating has silent failure modes.

2. **Trust the authoritative gate over local noise**: Local dev DB is a shared resource. When a test fails locally but the intent (unit tests, no API changes, no data mutations) says it shouldn't, defer to CI on a clean environment instead of destructively resetting shared state. Saved debugging time and avoided cascade impact on other sessions.

3. **Spike discipline validates investment decisions**: The Phase 1 spike measured Astryx's real-world footprint and compared it to Mantine's component-level overhead. That rigor meant we could land the full migration with confidence and actually see bundle *shrinkage* instead of regret. Speculative architectural decisions need empirical gates.

4. **Migration is smaller than baseline**: Not all framework swaps are plus-sized. Document this for future developers considering UI library upgrades — the outcome depends on bundle strategy, not just "new lib = bigger."

## Next Steps

- **For golive sprint**: UAT team now has Astryx-based admin + lms to test against real 2026-07 data. UI implementation backlog (dark mode, polish gaps like NumberInput thousand-sep) is non-blocking but tracked in follow-ups.
- **For future UI/a11y work**: Astryx TabList lacks `role=tab`/`aria-selected` (beta limitation); @cmc/ui wrapper documented as follow-up (non-blocking, doesn't affect login or core workflows).
- **For e2e infrastructure**: Review other conditional config (webServers pattern) in projects using Playwright to catch similar half-measures before CI.

---

**Commits**:
- `5982bb3` chore(deps): remove Mantine entirely — migration complete
- `f3005c8` fix(e2e): gate ui-chromium project behind PLAYWRIGHT_UI
- `614c6e8` docs(plan): record PR #28 CI-green outcome + e2e config fix

**PR #28**: Merged to main (history-preserving merge commit).
