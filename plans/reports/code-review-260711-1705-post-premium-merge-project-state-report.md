# Post-Premium-Merge Project State — Independent Verification

Date: 2026-07-11 17:10 | Reviewer: code-reviewer (independent) | Branch: main @ e796dfc
Scope: verify merge claims of premium design-language promotion; no code changed.

## Verdict

All six factual claims (3a–3e + git state) VERIFIED against runnable checks and git.
No CRITICAL/HIGH findings. No regression attributable to this session. Only LOW code-quality/doc nits.

## Verification Log (commands + real results)

### Git state
- `git rev-parse HEAD` = `e796dfc145...` ; `git rev-parse origin/main` = same. HEAD == origin/main. VERIFIED.
- Commit chain: `9c396a1 → 9249bda → 7ea3abe (merge) → da02b56 (redaction) → e796dfc (gitnexus)`. Matches reported topology.

### Claim 3a — merge did not touch apps/api or packages/db
- `git diff --name-only 9249bda..7ea3abe -- apps/api packages/db` → EMPTY (exit 0). VERIFIED.
- Merge file list (49 files): only `apps/admin/{app.css,main.tsx,pages/cockpit,pages/finance/receipt-*,shell/*}`, `apps/lms/{package.json,main.tsx}`, `packages/ui/**`, `docs/**`, `pnpm-lock.yaml`. Confirms API behavior invariant.
- Post-merge commits `7ea3abe..e796dfc` touched only `AGENTS.md`, `CLAUDE.md`, `docs/journals/260711-...md` — no code. VERIFIED.

### Claim 3b — no conflict markers
- `git grep -nE '^(<{7}|={7}|>{7})( |$)'` over tracked files (excl. lockfile) → NONE FOUND. VERIFIED.
- Includes docs/codebase-summary.md, docs/project-changelog.md — clean.

### Claim 3c — typecheck / build / @cmc/ui vitest
- `pnpm typecheck` → **26 successful, 26 total** (FULL TURBO; content-hash cache hit, valid for current tree). VERIFIED.
- `pnpm build` → **14 successful, 14 total**; admin vite build `✓ built in 5.17s`. VERIFIED.
- `pnpm --filter @cmc/ui test` (vitest 2.1.9) → **12 files, 40 passed / 40**. VERIFIED (exactly 40, matches "40/40").

### Claim 3d — lint (was UNRUN in session)
- `pnpm lint` (eslint apps/admin apps/lms) → no output, **exit code 0**. Clean. VERIFIED (previously unverified — now confirmed green).

### Claim 3e — secret redaction
- Repo-wide scan `xkeysib-|xsmtpsib-|AKIA|BEGIN * PRIVATE KEY|4dd49669|LzF69gryLpDVLie2|eyJhbGci` over working tree → single hit:
  `docs/journals/260711-build-regression-brevo-otp-fix.md:63: BREVO_API_KEY=xkeysib-<REDACTED>GRAPH_TENANT_ID="<REDACTED>"`
- Key material, GUID `4dd49669`, and fragment `LzF69gryLpDVLie2` are GONE. No AWS keys, no private keys, no JWTs anywhere in HEAD tree. VERIFIED.
- Note: the literal Brevo key-format prefix `xkeysib-` remains before `<REDACTED>`. This is a public key-type prefix, not secret material — harmless. Cosmetic only; could redact the whole token if strict-clean is desired.

## Code Quality (new premium layer)

Overall: solid. Clean dumb/smart separation — `packages/ui` composites are presentational, props-only (no tRPC/session/router coupling; MetricCard/TaskRow use react-router Link peer, SideNav/AppFrame stay router-free via onNavigate). Files small and cohesive (20–40 LOC each; largest rewrite cockpit.tsx 267). Token-driven styling. Each composite ships a colocated vitest. No public-contract regression: `packages/ui/src/index.ts` only ADDS exports (LineIcon, MetricCard, Panel, TaskRow, FunnelBar, SideNav/AppFrame, ListPage/DetailPage/FormPage, tokens.premium); existing exports untouched.

### LOW
1. `apps/admin/src/pages/cockpit.tsx:96` — `TaskRow key={i}` uses array index as React key. Acceptable for these short append-only lists but reorder-fragile; prefer a stable id (e.g. `r.id`/`o.id`) where available in the wrapper mappers.
2. Cockpit metric/task/funnel counts are computed client-side over a capped page (`pageSize: 100`, and `pageSize: 1` for PendingReceiptsCard which correctly reads `data.total`). `OverThresholdCard`, `O4OpportunitiesCard`, `PipelineFunnel` filter/count the returned page only — undercount if drafts/opportunities exceed 100. Presentation-only dashboard approximation; API unchanged; likely mirrors prior cockpit behavior. Data-accuracy caveat, not a defect introduced at the trust boundary. Consider server-side aggregate counts if exactness matters.
3. `docs/codebase-summary.md:534` comment `pnpm typecheck # tsc + turbo (12 tasks)` is stale vs the measured 26-task turbo graph. Minor doc drift.
4. `apps/admin` main chunk `index-*.js` = 482 kB (148 kB gzip). Pre-existing bundle size (not this merge); page-level chunks are code-split. Informational.

## Docs Honesty Check

`docs/codebase-summary.md:5` Build State claims 26/26 typecheck green, apps build clean, @cmc/ui 40+ vitest — all match measured reality. The doc also honestly self-flags the 2026-07-11 stale-node_modules false alarm as "not a real code regression." Honest status.

Unverifiable in this environment (NOT failures): "532 tests / 64 files" and "API e2e 17 passed" — `@cmc/api` tests are integration tests needing Postgres local-sim + DATABASE_URL, absent here. Environment limitation only; the doc's claim is plausible and self-consistent but was not re-run this session.

## Classification Summary
- (i) Real issues from this session: NONE (no CRITICAL/HIGH/MEDIUM). LOW nits #1–#3 above.
- (ii) Pre-existing / unrelated: bundle size (#4), cockpit capped-count pattern likely predates rewrite (#2).
- (iii) Environment: `@cmc/api` integration + e2e suites not runnable without DB — expected, not a regression.

## Unresolved Questions
1. Should the `xkeysib-` format prefix on the redacted journal line be scrubbed too (strict-clean), or is prefix-only acceptable? (cosmetic)
2. Do cockpit dashboard counts require exactness (server-side aggregates) or is the ≤100 approximation intended? (product decision)
3. API/e2e green (532 + 17) unverified here — confirm via local-sim DB run before treating codebase-summary Build State as fully attested.
