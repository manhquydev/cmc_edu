# Red Team Round 2 — CMC Console Design System Rebrand & Hardening

**Plan:** `plans/260807-1453-cmc-console-design-system-rebrand-hardening/`
**Date:** 2026-08-07 | **Branch:** `develop` @ `26fb984`
**Reviewers:** 4 (Security/Fact-Checker, Failure-Mode/Flow-Tracer, Assumption-Destroyer/Scope-Auditor, Scope-Critic/Contract-Verifier), each independently reading all 8 plan files and re-deriving claims against the live tree.

**Why round 2:** the plan already carried a round-1 `## Red Team Review` (22 accepted findings, zero rejected) and a `## Validation Log` from earlier the same day. Reviewers were scoped to (a) independently re-derive round-1's factual corrections and (b) find flaws the round-1 edits *introduced* — not to rediscover the original 22.

**Raw findings:** 34. **Deduplicated:** 24 unique root causes. **Reported:** 15 (cap).
**Severity (reported):** 8 Critical, 7 High. Below-cap items listed at the end.

**Headline:** round 1's accept-everything rate (22/22, no rejections) produced *regressions*. Six of the 15 findings below are defects introduced by round-1 edits, and two more are round-1 "corrections" that are themselves factually wrong. Round-1's twice-stated **"Unresolved contradictions: 0"** is falsifiable in one grep.

---

## Findings

| # | Finding | Sev | Round-1 relation | Reviewers |
|---|---------|-----|------------------|-----------|
| 1 | LMS/`premium.css` exclusion rationale is false — boundary is unenforceable and Phase 2's stated goal inverts | Critical | VERIFIES-FIX-WRONG | 2/4 |
| 2 | "Shipped and CI-green" premise is wrong — design system is unmerged, in open PR #75 | Critical | NEW | 1/4 |
| 3 | Phase 1 Step 15 mandates a script that reads `.env.prod`, rotates the super-admin password, and writes screenshots to un-gitignored `outputs/` | Critical | REGRESSION | 2/4 |
| 4 | Phase 2's retirement rule covers 43 of 315 `ck-*`; Success Criteria demands zero → unsatisfiable | Critical | VERIFIES-FIX-WRONG | 2/4 |
| 5 | Local e2e gate (Phases 1/2/5/6) cannot run; local runs clobber the acceptance-ledger input file | Critical | REGRESSION | 1/4 |
| 6 | Phase 1's discovery grep omits `packages/ui/src/odoo/` itself; exit check passes vacuously | Critical | VERIFIES-FIX-WRONG | 1/4 |
| 7 | Phase 4's "real cookie auth" has the same self-asserted-claims trust model as the `x-dev-user` bypass | Critical | VERIFIES-FIX-WRONG | 1/4 |
| 8 | plan.md Success Criteria still demands "zero `sh-*`" against the `SideNav`/`AppFrame` carve-out | Critical | REGRESSION | 2/4 |
| 9 | `--odoo-*` token rename misses a TSX template-literal consumer; its test asserts the old string | High | NEW | 1/4 |
| 10 | `check:ui-frames` is blind to everything this plan changes, cited as a gate 11× | High | VERIFIES-FIX-WRONG | 2/4 |
| 11 | `apps/e2e/webwright-prod-smoke.mjs` missing from every phase list | High | VERIFIES-FIX-WRONG | 4/4 |
| 12 | Both of Phase 2's new discovery greps are broken (regenerates phantoms; misses real cross-family rules) | High | VERIFIES-FIX-WRONG | 2/4 |
| 13 | GitNexus escalated to blocking prerequisite: unpinned `npx` against a repo root holding `.env.prod` | High | REGRESSION | 2/4 |
| 14 | Phase 4's environment cannot be stood up as written | High | NEW | 2/4 |
| 15 | Phases 3 and 5 are largely ceremony; the pin file is untracked; Phase 3 cannot be zero-diff | High | NEW | 2/4 |

---

### 1. LMS/`premium.css` exclusion rationale is false — Critical

Phase 2 excludes `premium.css` because it "independently owns the same visual language for LMS." Both halves fail.

- `apps/lms/src` emits **zero** `ck-*`/`sh-*`/`tpl-*` classes. Its complete className set is `lms-page`, `lms-page__title`, `lms-shell`, `lms-star-hero{,__label,__value}`, `lms-topbar{,__brand}`, `lms-child-chip` (`apps/lms/src/pages/parent/home.tsx:156`), all defined in `apps/lms/src/app.css`.
- `premium.css` is 423 `.ck-*` / 33 `.tpl-*` / 29 `.sh-*` / 2 `.fp-*` rule heads, zero `:root`, zero `lms-`. It is dead in LMS.
- Its only emitters are **26 shared files in `packages/ui/src/components/`** (223 unique `ck-*`) — which Phase 2 explicitly *does* rewrite (`phase-02:46`). Dual-styling proof: `ck-pnl` 7 hits in `premium.css` / 14 in `odoo.css`; `ck-toast` 11/11; `ck-cmd` 16/17; `ck-fn` 35/35.
- File-level import boundary does hold (`apps/lms/src/main.tsx:20` ← `premium.css`; `apps/admin/src/main.tsx:22` ← `odoo.css`), but the *component* boundary is crossed.

**Consequence:** Phase 2 repoints the emitters and leaves the stylesheet, permanently orphaning `premium.css`'s 313 selectors with no gate. plan.md:53's stated goal — "eliminates the dual-CSS-authorship drift risk" — is inverted: today the two copies are mechanically diffable (same names); after Phase 2 they are forked forever. `odoo.css:1670-1680` states `premium.css` *is* the design-language layer for MetricCard/Panel/TaskRow/FunnelBar.

**Fix:** either prove it dead and delete it + `apps/lms/src/main.tsx:20` + two `package.json` entries, or forbid Phase 2 from touching `packages/ui/src/components/*.tsx` (reducing Phase 2 to deleting the mirror block). Not the current middle path.

### 2. "Shipped and CI-green" premise is wrong — Critical

`plan.md:18` asserts the design system is shipped. It is not on `main`.

- `gh pr view 75` → `OPEN`, `develop`→`main`, 99 files, `MERGEABLE`
- `git rev-list --count main..develop` → 18; `develop..main` → 0
- Design system committed 2026-08-06 — one day before the plan was written
- `plans/260805-1920-design3-admin-rollout/plan.md:9` — remaining blockers are "human visual smoke **+ PR merge**"

Total mechanical surface: 192 `--odoo-` occurrences, 229 `o-*` class occurrences in 24 `.tsx`, 223 `.o-*` selector lines, 71 occurrences in 12 e2e files, 1 external `OdooNavbar` consumer, 9 `git mv`s, 1 export entry, 1 import. ~700 substitutions in ~45 files — priced at 6-9 weeks.

Phase 7 also flips the rollout plan to `completed` on visual-smoke evidence alone, ignoring its second stated blocker (PR merge).

### 3. Phase 1 Step 15's prod-credential/screenshot regression — Critical

Round-1 finding #8 removed `seed-local-sim-demo.ts` from Phase 4 for reading `.env.prod` and rotating the super-admin password. The same pass then added a **mandatory** run of `apps/e2e/design3-frontend-audit.mjs` to Phase 1 (`phase-01:104-109`, `:190-193`, `:210-211`) — identical hazard profile, plus screenshot persistence, in the *first* phase.

- `design3-frontend-audit.mjs:2` — "live page walk on cmcv2-prod"
- `:35-51` `loadProdEnv()` reads `.env.prod`; `:640-643` requires `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`
- `:120` hardcodes `https://localhost/admin/login` — no configurable base URL, so Phase 1's "against a locally running admin build" is unexecutable as written
- `:149-169` forced password-change branch **rotates the super-admin password**
- `:24-27`, `:292`, `:421`, `:663` — full-page PNGs to `outputs/design3-frontend-audit/screenshots/`
- `:63-76` ROUTES include `/admin/students`
- **`outputs/` is not gitignored** — `git check-ignore outputs/x` → exit 1; `.gitignore:189` covers only `.playwright-mcp/`

Round-1 finding #18 tightened screenshot hygiene to the one directory already ignored and missed the two that are not. plan.md's Non-Goals justification also grepped only `toHaveScreenshot`/Percy/Chromatic — never `page.screenshot(`, which appears in 2 prod-targeted e2e scripts.

**Fix:** drop Step 15 (Step 11's canonical-map grep already verifies the rename), or gate it exactly as Phase 4 is gated. Add `outputs/` to `.gitignore` as a prerequisite commit. Restate the Non-Goals verification honestly.

### 4. Phase 2's retirement rule covers 43 of 315 — Critical

Rule (`plan.md:53`): fold `ck-*` into `.console-*` "where they have a real `.o-*`/`.console-*` equivalent." Round 1 corrected the count (67 → ~316) but never re-checked the rule at that scale.

- `odoo.css`: 315 unique `.ck-*`, 113 unique `.o-*`, suffix intersection = **43**
- Rules pairing `.ck-` and `.o-` in one selector list: **0** — no in-file evidence of intended pairing
- 225 unique `ck-*` tokens actively emitted across `apps/admin/src` + `packages/ui/src/components` + shell components
- Success Criteria (`phase-02:143-145`) demands zero remaining

272 classes have no defined destination. Both available branches are bad: mass-rename to `console-*` (explicitly rejected by plan.md:53, "Real retirement, not another prefix") or stop at 14% and tick a false criterion. Priced at "2-3w" on neither.

### 5. Local e2e gate cannot run; clobbers the acceptance ledger — Critical

`PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium` is cited as a phase gate in Phases 1/2/5/6.

- `apps/e2e/src/global-setup.ts:10-16,49-58,80` — `requireEnv('APP_DATABASE_URL')`, `DATABASE_URL`, `assertNotProdDatabase` on both, live Postgres with migrations + `cmc_app` role password
- `.github/workflows/ui-e2e.yml:127-129,145-152,161-162` — CI supplies all of it
- The only standup instructions in this plan are Phase 4's `synthetic-seed-env.sh` — and round-1's reorder moved Phase 4 to **last**, so all four phases citing the gate now precede its prerequisites

**Second-order:** `playwright.config.ts` registers the JSON reporter only under `PLAYWRIGHT_UI`, writing `apps/e2e/acceptance-results/journeys.json` — the exact file `scripts/acceptance-report/verify.ts:32` ingests. Four mandated local runs against a mid-rename dirty tree overwrite the acceptance ledger's input with `dirty: true` local results. AGENTS.md requires that number to come from the CI `ui-e2e` artifact.

**Fix:** hoist the throwaway-DB standup into a Phase 1 prerequisite; document that local runs clobber `journeys.json` (back up or re-derive from CI before any acceptance claim). Note `scripts/synthetic-seed-env.sh` is mode `100644` — the literal invocation at `phase-04:112,125` fails; must be `bash scripts/...`.

### 6. Phase 1's discovery grep omits the directory being renamed — Critical

`phase-01:50-61` Step 0.5 emitter grep scopes to `packages/ui/src/components apps/admin/src --include=*.tsx`. This omits:

- **`packages/ui/src/odoo/` itself** — 8 files reference `o-`/`--odoo-`, emitting `o-brand`, `o-systray`, `o-menu-item`, `o-menu-sections`, `o-app-switcher-{menu,tile,toggle}`, `o-kanban-col-{header,body,count}`, `o-kanban-card-{title,sub,footer}`
- `apps/e2e/**` (round-1's flagship addition never reached this command)
- `.ts` files — 5 of the 7 test files hardcode `.o-*`/`--odoo-*` in assertions

Step 11's exit check ("every old name zero, every new name matches the map") only checks names *in* the map, so it passes **vacuously**. Result: `.console-brand` exists in CSS while `console-navbar.tsx` still emits `o-brand` — unstyled shell chrome, invisible to typecheck and tests (emitter and assertion agree with each other). Phase 6 Step 2 then flags `.console-brand` as zero-hit and deletes it. Phase 6 already *names* these classes as living in `packages/ui/src/console/` (`phase-06:31-38`) — the plan knows; Phase 1's grep doesn't.

**Fix:** `grep -rohE '\bo-[a-z][a-z0-9-]*' packages/ui/src apps/admin/src apps/e2e --include=*.ts --include=*.tsx --include=*.mjs --include=*.css`; make Step 11 a repo-wide residual scan.

### 7. Phase 4's "real cookie auth" is the same trust model it replaces — Critical

Round-1 finding #17's rationale: permission-derived UI must not be verified under a bypass. Its prescribed remedy has the same defect.

- `apps/e2e/src/session-injection.ts:128-145` — `mintStaffCookie` takes `{userId, roles, facilityId}` as **caller-supplied arguments**
- `:135-136` — the file's own comment: "Mode-B helper: works in any NODE_ENV, bypasses SSO"
- `apps/api/src/context.ts:218-232` — builds `subject` directly from those claims, **zero DB lookup**
- `:74-86` — `parseDevUser` produces the byte-identical shape

The only difference is an HMAC over a constant. An implementer mints `roles:['super_admin']`, sees `cmc_staff_session` in DevTools, and records Success Criterion 2 as PASS — while the navbar module list and ⌘K contents derive from an array they typed.

**Also:** `session-injection.ts:143` — with `STAFF_SESSION_SECRET` exported from `.env.prod`, this mints a **production-valid** super-admin cookie. Phase 4 must prohibit that explicitly.

**Fix:** either drop the auth-fidelity claim (state the phase inspects rendering, not permission derivation), or require the real `POST /auth/staff-login` flow against a staff user seeded into the throwaway DB.

### 8. plan.md Success Criteria contradicts the `sh-*` carve-out — Critical

Round-1 finding #2 added the `SideNav`/`AppFrame` carve-out to the Naming Decision table (`plan.md:54`) and Phase 2 (`:53-57`, `:143-145`) — but not to `plan.md:201-205`, which still demands zero `sh-*` with `.o_web_client` as the only named exception. 19 unique `.sh-*` selectors exist. At close, the plan-level grep finds ~19 survivors: the executor either deletes them (a public-contract change the Non-Goals forbid twice) or ticks a measurably false criterion that Phase 7 then cites as closure evidence.

**Also imprecise:** only **13** of the 19 are emitted by `SideNav`/`AppFrame`. Six (`sh-brand-name`, `sh-brand-sub`, `sh-cta`, `sh-cta--ghost`, `sh-cta--secondary`, `sh-logo`) have **zero emitters anywhere** — yet `phase-02:75-77` says to "repoint the emitting component" for every non-carve-out `sh-*`. There is nothing to repoint.

### 9. Token rename misses a template-literal consumer — High

`phase-01:62-64`, Step 5 scope the `--odoo-*` rename to the CSS file. Token consumers outside it are never enumerated.

- `packages/ui/src/odoo/odoo-kanban.tsx:66` — `'--odoo-kanban-card-color': \`var(--odoo-kanban-color-${colorIndex})\`` (also `:4`, `:46`)
- `packages/ui/src/odoo/odoo-kanban.test.tsx:32-33` — asserts the **old** string on the inline style
- `odoo-tokens.test.ts:15-19,50-53` — 8 asserted `--odoo-*` literals
- Census: `odoo.css` 169, `odoo-tokens.test.ts` 8, `odoo-kanban.tsx` 3, `odoo-kanban.test.tsx` 2

After Step 5, every kanban card's colour accent resolves to nothing. `typecheck` passes (string literals); `pnpm test` passes (emitter and test agree with each other while both disagree with the CSS); e2e asserts DOM/text; `build` passes. Every Phase 1 gate is green against an Architecture section claiming "pixel-identical." Surfaces only in Phase 4 — five phases later.

### 10. `check:ui-frames` is blind to this plan — High

`scripts/check-ui-frames.mjs:13` walks only `apps/admin/src/pages`; `:33-45` counts 11 React symbol names; `:174-185` fails on exactly two conditions (`bulkListsOk`, `dualRisk`); `:186` exits 0 otherwise. Zero references to `o-`, `--odoo-`, `ck-`, `sh-`, `tpl-`; never reads a `.css` file; never reads `packages/ui`. Every operation in this plan is invisible to it. Cited as a gate at `plan.md:124,211`; `phase-01:112,186,206,208`; `phase-02:128,151`; `phase-05:141`; `phase-06:88`.

Round-1 finding #19 noted the counts are report-only, left it listed as a gate, and added a *new* claim (`phase-01:112-115`) that the `--json` baseline diff "is the only way to actually verify adoption counts didn't move." Nothing in Phases 1/2/6 touches those symbols, so the diff is empty by construction — and its first field is `generatedAt`, a fresh ISO timestamp, so the diff is simultaneously *always* non-empty and never meaningful.

**Fix:** demote to non-gating; state plainly it cannot detect rename breakage. Real gates are `pnpm --filter @cmc/admin build`, `pnpm test` (7 CSS-reading unit tests), and `ui-chromium`. If a CSS-name tripwire is wanted, write one.

### 11. `webwright-prod-smoke.mjs` missing from every phase — High (4/4 reviewers)

Round-1 finding #5 claimed "12+ files"; Phase 1 then enumerated **11**. The 12th is `apps/e2e/webwright-prod-smoke.mjs` — tracked, and the highest-consequence member.

- `:173` `.o-brand`; `:219` `main.o-main`; `:223` `.o-kanban-board, .o-list`; `:240` `.count()`; `:96` `o_web_client`
- `:24-40` `loadProdEnv()` reading `.env.prod`; `:48-54` super-admin creds; `:11-16` screenshots to `outputs/webwright-prod-smoke/`

Playwright `.count()` returns 0 rather than throwing, so after the rename it emits an all-zero report that reads as "smoke clean" against the prod stack — the exact fail-open pattern round 1 identified for its sibling script and fixed only there. Phase 6's `find -iname '*odoo*'` won't catch it (no "odoo" in the filename); Phase 7 doesn't name it.

**Fix:** replace every hand-enumerated e2e list in Phases 1/2/6/7 with the generating command. A hand-maintained list has now failed twice.

### 12. Both of Phase 2's new discovery greps are broken — High

**Step 0 regenerates the phantom round 1 deleted.** `phase-02:63` run verbatim → 261 unique hits, **32 of which are not CSS classes**, including `ck-trpc` (55 files, all `mock-trpc.js/.ts` import paths, e.g. `apps/admin/src/lib/permission-gate.test.tsx:17`), plus `ck-in`, `ck-out`, `ck-office`, `ck-inbox`, `ck-door`, `ck-circle` (substrings of `check-in`, `back-office`, `block-…`). Unlike Phase 1's Step 0.5, Phase 2 Step 0 carries **no false-positive filter instruction** — and Success Criterion `phase-02:141` requires recording its output as authoritative. It also omits `packages/ui/src/odoo/` (8 unique `ck-` refs).

**Step 0.5's split scan is 86% noise and misses both real cases.** `phase-02:68-72` run verbatim → 7 hits, 6 same-family (pure churn). The two genuine cross-family hazards are unmatchable by that pattern:
- `odoo.css:2481` — `.o_web_client .sh-cta:active, .o_web_client .ck-mc:active` — `[a-z-]*,` breaks on the `:` of `:active`
- `odoo.css:2709` — `.tpl-dash-metrics > .ck-mc { max-width: none; }` — a **child combinator**, no comma, so the pattern can never match

Line 2709 is the dangerous one: Phase 2 Requirement 6 says delete all `tpl-*` selectors as "a pure CSS deletion." A mechanical line-delete removes a `.ck-mc` declaration. Because `tpl-*` is genuinely inert nothing fails, the Success Criterion is ticked, and line 2481's group ships across two family commits — the exact bisectability hole finding #15 was raised to close.

### 13. GitNexus escalated to a blocking prerequisite — High

The validation round upgraded `npx gitnexus analyze` from best-effort to "troubleshoot until it succeeds" (`phase-01:36-49`, `plan.md:112-120,301`).

- `grep -rn "gitnexus" package.json .github/workflows/` → no match. Not a dependency, not pinned, not in CI, no lockfile entry.
- `npx gitnexus` resolves the latest published version at run time and executes it with read access to a repo root containing `.env.prod` and `.env.local-sim-accounts`.
- The repo has a documented convention for exactly this and it is the opposite: `scripts/bootstrap-harness.sh:28-60` installs from a pinned release tag and verifies a SHA-256 checksum before executing.
- The only symbol renamed has **1 production caller**: `grep -rn 'OdooNavbar'` → 20 hits, of which production is `packages/ui/src/index.ts:173-174` (barrel), `apps/admin/src/shell/shell.tsx:5` (import), `:129` (JSX). Rest are the definition, its own test, a prose string, and a comment.
- `ViewSwitcher`/`FormDialog` → **0 hits** repo-wide.

An unbounded-cost, unpinned prerequisite blocking a 6-9 week plan, to call-graph-analyse a rename whose call graph fits on one screen.

### 14. Phase 4's environment cannot be stood up — High

- `scripts/synthetic-seed-env.sh:85-100` seeds only a facility sentinel — **no `User` row**, so there is no `userId` to mint a session for and no login flow to complete
- Phase 4 forbids `pnpm --filter @cmc/admin dev` and says to consult `apps/admin`'s README/`package.json` — there is no README, and scripts are `{build, dev, typecheck, preview, test}`. The instruction resolves to nothing.
- The only proven local wiring is `apps/e2e/playwright.config.ts:78-96`: build + `preview --port 4173` with `VITE_API_URL:''`, `VITE_PROXY_API_TARGET:'http://127.0.0.1:3999'` — never mentioned in Phase 4
- `scripts/synthetic-seed-env.sh` is mode `100644`; `phase-04:112,125`'s literal invocation fails with Permission denied

At the last phase of a 6-9w plan, the path of least resistance is precisely what Phase 4's own Risk Assessment warns against: fall back to `x-dev-user`, or point at the already-running prod stack that *does* have a super-admin and data.

### 15. Phases 3 and 5 are largely ceremony — High

**Phase 5 (3-5d):** round 1 struck one requirement, downgraded two to "evaluate-first, likely-decline," softened the fourth to "verify already correct." What remains as confirmed new work is **one e2e assertion** that a `<thead>` is sticky (`odoo.css:423-424`, currently unasserted). The other three deliverables are memos: "record 'no work needed, verified'", "implement or document the decline" ×2. `ViewSwitcher` and `FormDialog` have **0 references** repo-wide — they are planning-session inventions. The shared chrome is one CSS class with two call sites (`pipeline.tsx:401`, `schedule.tsx:292`) whose value unions differ — textbook don't-extract.

**Phase 3 (3-4d):** Goal 1 erases "Odoo" from our identifiers because the naming "is entirely our invention"; Goal 3 then spends 3-4 days re-proving pixel fidelity *to Odoo*. The plan never reconciles them. Its stated purpose (catch rename regressions) is already gated four ways, including `odoo-tokens.test.ts:31`, `odoo-cp-sheet.test.ts:62-71`, `odoo-shell-stacking.test.ts:38`, which assert literal CSS values exhaustively — strictly stronger than Phase 3's manual three-selector spot-check.

**The pin conflict is also mis-framed.** `ODOO_PIN.txt` is **gitignored** (`.gitignore:78` `/plans/**`, re-including only `*.md`) — untracked local scratch. The real split is one tracked pin in code (`5568f6e4…` at `odoo.css:5`, `docs/design-system-odoo.md:39`, `odoo-tokens.test.ts:31`) versus `7de220c9…` in 16+ tracked plan reports plus the untracked file and the local clone HEAD. Phase 3 offers a durable and a non-durable remedy as equals, and declares itself zero-diff (`phase-03:103`, Step 5) while any resolution requires editing a live test assertion.

---

## Below the cap (accepted as real, deprioritised)

- **Phase 6 self-contradiction.** `phase-06:92-94` ("Phase 4 now runs immediately after this phase") vs `:111-113` ("Phase 4 already ran, so this phase doesn't get another visual-smoke safety net"). Stale text from before round-1's reorder, in the Risk Assessment an implementer reads before deleting ~2,300 lines of CSS. Reported by 4/4 reviewers. Falsifies `plan.md:286` and `:316` ("Unresolved contradictions: 0").
- **Phase 1's manual false-positive filter is unnecessary.** Round 1's dotless pattern matches `no-`/`to-`/`go-`; the fix is one character (`\b`), not a mandatory human review step plus a Risk Assessment bullet. `\bo-[a-z][a-z0-9-]*` → 111 distinct names, zero false positives. The two genuinely tricky sites get no special treatment: `filter-bar.tsx:97` builds an **HTML id** (`o-filter-${f.key}`, not a class — the map is class-only), and `o-dash-*` template prefixes.
- **Phase 1 is one unbisectable commit.** `phase-01:172-176` mandates atomic application; gates 12-16 all run after. ~700 substitutions, 10 `git mv`s, a symbol rename, one rollback point. Phase 2 commits per-family for exactly this reason (`phase-02:158-162`); the rationale is not applied to the larger phase.
- **Phase 6's `find -iname '*odoo*'` gate is unsatisfiable at Phase 6 time.** `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` is renamed in Phase 7 (two phases later) and matches no carve-out, so Step 1's binary classify forces either an early rename (breaking Phase 7 Step 4's `git mv`) or deletion of the map Phase 7 must rewrite. `find` also surfaces `dist/` artifacts; `git ls-files` would not.
- **`soft-ops-fullcalendar.css` path is wrong** in the authoritative Requirements checklist: `phase-01:69-71` says `packages/ui/src/components/` (does not exist); `:138` says `apps/admin/src/components/` (correct). "24 selectors" is a *line* count — actual is 12 unique / 33 occurrences.

---

## Round-1 fix verification (consolidated)

| Round-1 claim | Re-derived | Verdict |
|---|---|---|
| `ck-trpc` is a `mock-trpc` filename artifact | 55 hits, all import paths | HELD — but Phase 2 Step 0 regenerates it (#12) |
| `ck-*` ~316 selectors | 315 unique / 561 occurrences | HELD |
| `tpl-*` ~28, zero live emitters | 28 unique, 0 emitters | HELD |
| `sh-*` ~19, emitted by `SideNav`/`AppFrame` | 19 unique, only 13 emitted, 6 have no emitter | IMPRECISE (#8) |
| Retirement rule workable at that scale | 43/315 have a `.o-*` peer | **FAILED** (#4) |
| `.o-*` count ~113 | 113 in `odoo.css`, 116 across emitters, +12 in admin fullcalendar CSS | HELD |
| Dotted grep blind to JSX | Confirmed | HELD (pattern) / scope still wrong (#6) |
| `apps/e2e` has 12+ files | Exactly 12; plan enumerates 11 | **FAILED** (#11) |
| Audit script fails open on `.count()===0` | Confirmed | HELD — see #3 for what running it costs |
| `exports["./odoo.css"]` + `files` + `main.tsx:22` | All present | HELD |
| Two conflicting pin commits | Real, but one side is untracked | IMPRECISE (#15) |
| `synthetic-seed-env.sh` is the safe replacement | Gates real; Gate 2 checks URLs the script hardcodes so it cannot fail; seeds no user/demo data; mode 100644 | PARTIAL (#14) |
| `PLAYWRIGHT_UI=1` required; CI sets it | Confirmed | HELD — command still unrunnable locally (#5) |
| GitNexus not indexed | Confirmed | HELD — escalation is itself a defect (#13) |
| Navbar brand already CI-locked | Confirmed | HELD |
| Multi-family selector groups | Split grep misses both real cases | **FAILED** (#12) |
| Reorder 1→2→3→5→6→4→7 | `dependencies` frontmatter topologically consistent | HELD — but stale prose survives; created #5 and the Phase 6 gate issue |
| `session-injection.ts` gives "real auth path" | Same self-asserted-claims model as `x-dev-user` | **FAILED** (#7) |
| Screenshots confined to gitignored `.playwright-mcp/` | `outputs/` un-ignored, 2 scripts write PNGs there | **FAILED** (#3) |
| `check-ui-frames` counts report-only; `--json` exists | Confirmed; `pageCount: 52` | HELD — but new baseline claim is vacuous (#10) |
| Phase 7 referrer list correct | Correct for named files | HELD — `webwright-prod-smoke.mjs` is a 5th omission (#11) |
| Effort 6-9w vs phase sum | Phases sum ≈5.5-8w | HELD (now consistent) |
| "Unresolved contradictions: 0" | Phase 6 `:92-94` vs `:111-113`; Phase 1 `:70` vs `:138` | **FAILED** |
| `.o_web_client` is the only literal `.o_*` selector | 6 tokens, 5 in comments, 1 real | HELD |
| `SideNav`/`AppFrame` zero importers | Zero production importers | HELD |
| `premium.css` LMS-loaded, owns LMS visual language | Imported, but LMS emits zero of its classes | **WRONG** (#1) |
| `docs/06-kien-truc-url-routing.md` is an unrelated mention | Confirmed | HELD |

---

## Open questions for the plan owner

1. **Is `premium.css` genuinely dead**, or is there an unlanded LMS design phase intending to consume it? The plan's largest exclusion depends on the answer (#1).
2. **Does PR #75 merge before or after this work?** The rollout plan's blockers are "visual smoke + PR merge"; `blocks: [260805-1920-design3-admin-rollout]` implies the PR waits on 6-9 weeks of renaming (#2).
3. **Is `ck-*` retirement still worth 2-3 weeks** given #1 and #4, or should Phase 2 reduce to deleting the mirror block?
4. **Phase 4 permits fixing a defect inline**, after Phase 6's cleanup already ran. What re-verifies a Phase 4 fix? No phase gates on Phase 4's diff.
5. **`ui-chromium` `baseURL` is `http://localhost:4174`** (LMS preview) while admin previews on 4173. Phase 5's new sticky-`<thead>` assertion is an admin concern — will it silently target LMS?
6. **Does any surviving `.ck-*` suffix collide with an existing `.console-*` suffix** when Phase 2 folds? No collision-detection step exists; `.ck-fc*` vs `.o-fc*` is an immediate candidate.
