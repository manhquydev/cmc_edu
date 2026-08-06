# Code Review — design3 H2 docs honesty + M1 float-layer guard

**Date:** 2026-08-06  
**Branch:** `feat/ui-copy-standard`  
**Commit reviewed:** `d0ca846` — `fix(design3): honesty docs, float-layer CSS guard, plan validation`  
**Mode:** read-only (no code changes)

## Code Review Summary

### Scope
- **Files (commit):**
  - `docs/design-system-odoo.md` (rewrite)
  - `docs/design-system-odoo-candidate.md` (deleted)
  - `docs/system-architecture.md`
  - `docs/codebase-summary.md`
  - `packages/ui/src/odoo/odoo-float-layer.test.ts` (new)
  - `plans/260805-1920-design3-admin-rollout/plan.md`
  - `plans/reports/e2e-skip-260806-design3-stack-unavailable.md`
  - (+ session reports: full-review + tester coverage; out of behavioral scope)
- **LOC:** ~+863 / −364 (mostly reports + doc rewrite; test = 47 lines)
- **Focus:** cook slice H2 (docs honesty) + M1 (float CSS regression test)
- **Scout findings:**
  - Live CSS still has unscoped `.ck-toast*` / `.ck-cmd*` (post-`29bc469`)
  - Admin has zero production `AppFrame`/`SideNav` usage (only negative shell unit assert)
  - design-lab-3 + candidate file gone on disk
  - Plan still links deleted candidate + lab sources under Evidence

### Overall Assessment

**Approve for this slice** with **non-blocking plan-reference cleanup**.

Checks (a)–(d) hold for evergreen docs + the float guard. Check (e) is largely honest (`status: validation`, e2e-skip evidence) but the plan’s Evidence block still points at deleted paths as if current. No public runtime contract change in this commit.

### Checklist results

| Check | Verdict | Evidence |
|-------|---------|----------|
| **(a)** Docs no longer claim AppFrame/SideNav NOT ready or live `/design3` | **PASS** | `docs/design-system-odoo.md`: status “shipped for admin (unit/static)”; inventory is production shell + residual debt (LMS keeps AppFrame/SideNav). No “NOT ready / Integration with production AppFrame/SideNav”. `/design3` only as deleted/non-reintroduce. `system-architecture.md` banner + shell bullet state Odoo chrome. |
| **(b)** Candidate deleted; no broken **authority** links claiming it current | **PASS (docs)** / **FAIL-lite (plan Evidence)** | File deleted. Evergreen docs only mention it as historical/deleted. **Plan** `Evidence & References` still links `docs/design-system-odoo-candidate.md` and cites `design-lab-3.tsx` as live source — broken relative links, not “current authority”, but sloppy for a plan just demoted to `validation`. |
| **(c)** Float test fails if toast re-scoped under `.o_web_client` | **PASS** | Ran `pnpm exec vitest run src/odoo/odoo-float-layer.test.ts` → 3/3 green. Simulated re-scope (bare → `.o_web_client .ck-toast*`) ⇒ bare `ruleBlock` null + `not.toMatch` fires. Dual bare+scoped also fails via scoped assert. Matches existing `odoo-tokens.test.ts` `cwd`/`src/odoo.css` pattern. |
| **(d)** No public contract break | **PASS** | Docs + plan + new test only. No export/API/schema/component signature change. `@cmc/ui` package exports unchanged. |
| **(e)** Plan status honesty vs gates | **PASS with nits** | Frontmatter `status: validation` (was `completed`). Phases 2–6 labeled unit-complete + open ui-e2e/acceptance. `e2e-skip-260806-design3-stack-unavailable.md` records stack-down decision. Success Criteria remain unchecked. Honest vs unrun gates. |

### Critical Issues

None in this slice.

### High Priority

None for H2/M1. (Broader design3 merge still blocked by **unrun `ui-e2e` / `acceptance:report`** — documented, not introduced here.)

### Medium Priority

1. **Broken plan Evidence links after candidate/lab delete**  
   - **Where:** `plans/260805-1920-design3-admin-rollout/plan.md` lines ~149–150  
   - **Problem:** Still links `docs/design-system-odoo-candidate.md` and lists `apps/admin/src/pages/design-lab-3.tsx` + css as “Nguồn design3” after Phase 6 deleted them.  
   - **Impact:** Plan readers (and link checkers) hit 404; undercuts “docs honesty” repair for the same plan.  
   - **Fix:** Retarget Evidence to `docs/design-system-odoo.md` + `packages/ui/src/odoo*` / `apps/admin/src/shell/shell.tsx`; mark lab/candidate as historical git paths only.

2. **TL12 banner vs odoo doc strength of claim**  
   - **Where:** `docs/12-design-system-ui.md` “Superseded for apps/admin (**rolled out**, 2026-08-06)” vs `design-system-odoo.md` “shipped … (**unit/static**); merge/validation still open”.  
   - **Impact:** Mild authority tension; not a reintroduction of “NOT ready”, but “rolled out” can be read as merge-complete.  
   - **Fix (optional):** Align TL12 banner wording to “shipped unit/static; ui-e2e gate open” until CI green.

3. **Bundled full-review / tester reports in same commit still describe pre-fix world**  
   - They correctly scored float-test gap and candidate present **at review time**; post-`d0ca846` those items are fixed.  
   - **Impact:** Confusion if someone treats those reports as current truth without reading commit order.  
   - **Fix:** No rewrite required; this H2/M1 report supersedes those findings for the listed items.

### Low Priority

1. **Float-test brittleness (acceptable for static CSS gate)**  
   - Relies on single-line selectors and `(?:^|\n)selector\s*\{` — won’t match multi-line selectors or comma lists. Matches current `odoo.css` style.  
   - Does not assert mount-tree sibling of `ToastViewport` (CSS-only by design; correct for the regression class).  
   - `process.cwd()` → package root is consistent with `tokens.test.ts` / `odoo-tokens.test.ts` and `pnpm test` in `@cmc/ui`.

2. **`docs/18-tech-stack-va-chuan-ky-thuat.md` / long system-architecture Phase 3 history** still describe AppFrame/SideNav as primary design-system shell without dual-chrome note. Historical sections; top architecture banner already corrects current admin shell. Out of this cook’s file list.

3. **Media-query line** mixes unscoped `.ck-toast` with scoped peers — intentional; test still sees bare `.ck-toast{` block with `box-shadow`.

### Edge Cases Found by Scout

| Edge | Result |
|------|--------|
| Re-scope only (no bare left) | Test fails (`toBeTruthy` on body) |
| Bare kept + scoped duplicate added | Test fails (`not.toMatch` scoped) |
| Variant selectors `.ck-toast--*` scoped while base bare | Toast test asserts variants not scoped under `.o_web_client` |
| Multi-line `.o_web_client` + newline + `.ck-toast` | Not covered (low risk given file formatting) |
| Admin AppFrame/SideNav residual | Only negative unit test string; production shell clean |
| Live `/design3` | Page + route gone |

### Positive Observations (risk calibration only)

- Status language in `design-system-odoo.md` separates **unit/static shipped** from **merge gates open** — correct for solo+CI operating model.
- Float guard is a real regression test (string-level), not a phantom that only imports the module; empirically fails on the exact failure mode from Phase 6 review.
- `e2e-skip-…` report prevents “green by silence” on ui-e2e.

### Recommended Actions

1. **Before merge of plan doc polish (non-blocking for runtime):** retarget plan Evidence away from deleted candidate/lab paths.  
2. **Do not claim design3 complete** until CI `ui-e2e` green + optional `acceptance:report` — plan already says this.  
3. Optional: soften TL12 “rolled out” to match unit/static + open gates.  
4. Keep float-layer test in `@cmc/ui` suite (already `include: src/**/*.test.{ts,tsx}`).

### Metrics

| Metric | Value |
|--------|--------|
| Type coverage | N/A (docs + static CSS test) |
| Float test | **3/3 pass** (`odoo-float-layer.test.ts`) |
| Public contract delta | **0** |
| Authority doc false claims (AppFrame NOT ready / live `/design3`) | **0 found** in evergreen design docs |
| Broken plan Evidence links | **≥1** (candidate; lab sources stale) |
| Linting issues introduced | 0 observed |

### Unresolved Questions

1. Will plan Evidence cleanup land in a follow-up commit on this branch, or wait until validation close?  
2. Is TL12 “rolled out” intentional product language even while ui-e2e is open?

---

## Verdict by user check

| # | Result |
|---|--------|
| (a) Docs honesty (no AppFrame NOT ready / live `/design3`) | **PASS** |
| (b) Candidate deleted; no current-authority claim | **PASS** (plan Evidence link stale — Medium) |
| (c) Float test catches re-scope under `.o_web_client` | **PASS** (empirically verified) |
| (d) No public contract break | **PASS** |
| (e) Plan status honesty vs gates | **PASS** (`validation` + e2e-skip) |

**Slice recommendation:** Accept H2+M1 fix; treat plan Evidence retarget as small follow-up, not a revert of this commit.
