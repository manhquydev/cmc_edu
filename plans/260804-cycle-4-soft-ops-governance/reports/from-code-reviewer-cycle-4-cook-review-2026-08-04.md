# Code Review — Soft Ops cycle 4 residual (cook)

**Date:** 2026-08-04  
**Reviewer:** code-reviewer (Staff / production-readiness)  
**Plan:** `plans/260804-cycle-4-soft-ops-governance/`  
**Mode:** acceptance residual + regression (read-only; no code edits)

---

## Code Review Summary

### Scope

| Area | Paths |
|------|--------|
| A11y SoT | `design-system/cmc-edu/A11Y-BASELINE.md` |
| MASTER link | `design-system/cmc-edu/MASTER.md` (Accessibility §) |
| Role smoke | `scripts/check-ui-a11y-roles.mjs` · `.test.mjs` |
| Frames depth | `scripts/check-ui-frames.mjs` · `.test.mjs` |
| Agent brief | `packages/ui/llms.txt` |
| Lab honesty | `apps/admin/src/pages/design-lab-redteam.tsx` |
| Scripts | root `package.json` (`check:ui-a11y-roles`, `test:ui-a11y-roles`, `check:ui-frames`) |

**LOC (residual surface):** ~A11Y-BASELINE ~110 lines · role smoke ~125 · test ~47 · lab MS-3/scorecard deltas small · frames depth report already present (4a).  
**Focus:** plan residual acceptance (4b + governance finalize), not full Soft Ops product re-review.  
**Scout findings:** residual is docs/scripts/lab only — no API/DB/business mutation in this slice. SideNav still lacks `aria-label`/`aria-current` (documented gap). Toast smoke needle is weak (`role=`). Lab banner still labels “cycle 3”.

### Overall Assessment

**Accept residual.** Acceptance criteria are met with honest partial a11y language, working role smoke + tests, frames depth report intact, `--strict` still dual-title+bulk only, no axe dep, no EntityHeader force, MS-3 remains **partial**. Two non-blocking quality/honesty nits (weak Toast substring; stale cycle-3 banner) do not reverse acceptance.

### Acceptance matrix (requested)

| Criterion | Result | Evidence |
|-----------|--------|----------|
| `A11Y-BASELINE.md` exists, honest partial not WCAG cert | **PASS** | Status banner “partial forever”; Gaps table bans WCAG cert / axe CI / “a11y fixed”; status language table forbids greenwash |
| `check-ui-a11y-roles` smoke + tests pass | **PASS** | 8/8 ok · `node --test …test.mjs` 2/2 · `pnpm check:ui-a11y-roles` exit 0 |
| No axe dependency | **PASS** | No `@axe-core` / `jest-axe` / `pa11y` in package.json / lock grep; not wired in CI |
| `check-ui-frames` depth report works; strict only dual-title+bulk | **PASS** | Report: FilterBar 6 · ListPagination 11 · detailTiers 2/2/3/2 · dualTitle 0 · bulk 8; strict block only `bulkListsOk` + `dualRisk` (L181–192) |
| design-lab-redteam MS-3 stays partial | **PASS** | `status: 'partial'`; scorecard A11y 2.5 “not WCAG cert; no human keyboard pass” |
| No re-skin, no forced EntityHeader | **PASS** | Residual does not restyle product skins; payroll / my-hr / settings pages have **no** EntityHeader |

### Checks (a–e)

| Check | Result |
|-------|--------|
| **(a) Acceptance met** | **Yes** — residual delivery matches plan phases 2–3 success criteria |
| **(b) No business logic regression** | **Yes** — residual files are design-system docs, static scanners, package scripts, design-lab panel. No trpc/router/schema change in this slice |
| **(c) No public API break** | **Yes** — no `@cmc/ui` export contract change in residual; scanners read source only |
| **(d) Patterns match repo** | **Yes** — role smoke mirrors `check-ui-frames.mjs` (node ESM, `--json`, exit codes, `node:test` spawn) |
| **(e) No false “fixed a11y” claims** | **Yes** — MS-3 partial; MASTER/llms/A11Y/cook-complete all say partial / not WCAG |

### Critical Issues

None.

### High Priority

None blocking merge of residual.

### Medium Priority

1. **Toast smoke needle is under-specified**  
   - **Where:** `scripts/check-ui-a11y-roles.mjs` Toast `requires` includes bare `'role='`.  
   - **Impact:** Real source uses `role={item.tone === 'error' ? 'alert' : 'status'}` (correct). Smoke would still pass if that expression were replaced by an unrelated `role=` elsewhere in the file.  
   - **Fix (optional):** require a more specific substring, e.g. `role={item.tone === 'error' ? 'alert' : 'status'}` or both `alert` + `status` with the tone ternary.  
   - **Acceptance impact:** none (markers present today).

2. **Lab banner still says “cycle 3” after cycle-4 rebase**  
   - **Where:** `design-lab-redteam.tsx` L183–188: `Verdict (2026-08-04 cycle 3)` while findings include cycle 4a/4b (H6, C2 depth report, MS-3).  
   - **Impact:** Mild authority confusion for agents reading the banner only; scorecard + MS-3 body are accurate.  
   - **Fix (optional):** retitle to cycle 4 Soft Ops governance residual; mention a11y partial + depth report in the one-liner.  
   - **Acceptance impact:** none (MS-3 status itself is correct).

### Low Priority

1. **Role smoke has no negative-path unit test** — only proves current tree is green. Acceptable for smoke; optional fixture with stripped file would lock exit-1 behavior.  
2. **`check:ui-a11y-roles` not in CI** — intentional (phase 2: zero new a11y CI fail gates). Package scripts exist for local/re-run. Enforceability scorecard already says “optional”.  
3. **Inventory lists SideNav / PasswordInput / EntityHeader** while automated CHECKS cover 8 composites only — consistent with “partial”; SideNav gap is honestly documented.

### Edge Cases Found by Scout

| Edge | Disposition |
|------|-------------|
| Dual SoT for a11y | **Avoided** — MASTER + llms link only; A11Y-BASELINE is single SoT |
| Strict depth gate creep | **Avoided** — depth metrics report-only; strict = dual-title + bulk |
| “Fixed-lite” greenwash | **Avoided** — banned in A11Y status language; MS-3 partial |
| Force EntityHeader on thin/settings | **Avoided** — thin 2 (payroll, my-hr); settings 3; no EH in those files |
| Clipboard bulk privacy | **Out of residual** — cook-complete residual risk; not this slice’s fix |
| `/design` authz | **Out of residual** — plan rejected as must-fix here |
| Role smoke false pass on Toast | **Open low/med** — see Medium #1 |
| Substring drift if labels reworded | Known property of literal smoke; intentional cheap gate |

### Positive Observations (risk calibration only)

- A11Y-BASELINE language is unusually clear for AI-generated governance: partial forever, how-to re-check, status phrase allowlist.  
- Frames depth classification (settings > full > standard > thin) matches measured product files 2/2/3/2.  
- Role markers asserted by smoke are present in real composite sources (FilterBar search landmark, pager nav, bulk toolbar, table selection labels, breadcrumbs nav, command dialog/listbox, toast live region, settings rail).

### Recommended Actions

1. **Accept residual** as cycle 4 Soft Ops governance complete for MS-1/2/3/4 scope (MS-5 deferred).  
2. Optional follow-up (non-blocking): tighten Toast needle; fix red-team banner “cycle 3” → “cycle 4”.  
3. Do **not** promote MS-3 to fixed without a logged human keyboard pass (paths 1–6 in A11Y-BASELINE).  
4. Do **not** add axe CI in this track unless product explicitly expands non-goals.

### Metrics (re-run 2026-08-04)

| Command | Result |
|---------|--------|
| `node scripts/check-ui-a11y-roles.mjs` | 8/8 pass, exit 0 |
| `node --test scripts/check-ui-a11y-roles.test.mjs` | 2/2 pass |
| `pnpm check:ui-a11y-roles` | pass |
| `node scripts/check-ui-frames.mjs --strict` | exit 0 · dualTitle 0 · bulkListsOk true (8) |
| `node --test scripts/check-ui-frames.test.mjs` | 3/3 pass |
| detailTiers | full 2 · standard 2 · settings 3 · thin 2 |
| FilterBar / ListPagination / EntityHeader | 6 / 11 / 4 |
| axe dep | absent |
| Type / line coverage | N/A (structural gates, not Istanbul) |

### Fact-check vs plan residual

| Plan claim | Verified |
|------------|----------|
| A11Y-BASELINE exists with ≥5 paths + gaps | Yes (6 keyboard paths + Gaps table) |
| MASTER + llms link only | Yes |
| Role smoke script + test | Yes |
| MS-3 partial never fixed without keyboard log | Yes (lab + A11Y + cook-complete) |
| No axe CI / no re-skin / no force EH | Yes |
| frames strict still green | Yes |

### Unresolved Questions

None material for acceptance. Optional product follow-ups (keyboard pass log; SideNav aria; CI optional wire for role smoke as non-blocking report) remain outside this residual.

---

## Status

**DONE_WITH_CONCERNS**

**Summary:** Cycle 4 residual acceptance is met — honest partial a11y baseline + role smoke, frames depth report/strict regression green, no axe/re-skin/forced EntityHeader, MS-3 stays partial. Concerns are non-blocking: weak Toast `role=` smoke needle and stale “cycle 3” lab banner.

**Concerns:**  
1. Toast smoke under-specified (`role=`).  
2. Red-team banner still labels cycle 3 after cycle-4 findings rebase.
