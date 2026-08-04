# Red-team failure-mode analysis — Cycle 4 Soft Ops governance plan

**From:** code-reviewer (hostile Failure Mode Analyst)  
**To:** planner  
**Plan:** `plans/260804-cycle-4-soft-ops-governance/`  
**Date:** 2026-08-04  
**Lens:** cook-time failure · CI false confidence · doc/code drift · wrong tier classification · axe scope creep  

**Verdict:** Plan direction (docs + measure, no axe CI, no re-skin) is sound, but **success metrics and cook steps still allow green CI while depth/a11y governance is theater**. Fix the authority model before `/ck:cook --auto` or residual work will look done without being enforceable.

**Live baseline (measured, not assumed):** `node scripts/check-ui-frames.mjs --strict --json` → dualTitle=0, bulk=8, detailTiers full2/standard2/settings3/thin2; tests pass. `A11Y-BASELINE.md` does **not** exist yet. No `axe-core` dependency in repo.

---

## Findings (max 8)

### F1 — CI green ≠ depth governance (false confidence)

**Severity:** Critical (CI false confidence)  
**Evidence:**
- `plan.md:57-68` success metrics list `detailTiers … present`, `filterBarCount ≥ 5`, and `--strict` pass as **peer** rows.
- `phase-01-close-4a-depth-report.md:40-43` success: `--strict exit 0 · dualTitle=0 · bulkListsOk` **and** `detailTiers classifies 9…` without saying only the first is gated.
- `scripts/check-ui-frames.mjs:146-147` explicitly: *“Report-only depth signals (not strict gates)”*.
- `scripts/check-ui-frames.mjs:181-191` strict fails **only** bulk + dual-title.
- `.github/workflows/ci.yml:110-113` step comment still: *“bulk-enabled lists ≥5”* — depth matrix not named as gate.
- MS-2 original ask (`research-redteam-ds-multi-scope-2026-08-04.md:258`): *“Depth matrix not CI”* — plan claims 4a fixed report (`plan.md:24`) while CI still does not fail on empty `detailTiers` / FilterBar collapse **except** via unit tests that pin named anchors only.

**Failure scenario:** After cook, agent/PR claims “governance complete, CI green.” A later page removes FilterBar from 4 of 6 lists or demotes opportunity-detail off WorkflowStatusbar; if named test anchors remain, or tests are weakened, `--strict` stays 0. Lab scorecard already scores Detail recipe **4/5** and Enforceability **3.5** as if depth were CI-backed.

**Fix:** Split success table into **Gated (must fail CI)** vs **Report-only (must appear in JSON + cook-complete snapshot)**. Either (a) keep depth report-only and **forbid** wording “CI depth matrix fixed,” or (b) add **explicit non-strict assertions only in `test:ui-frames`** for filterBarCount≥5 + all four tier keys non-empty + full≥2/settings≥3 (already partially there) and document that *tests*, not `--strict`, own depth. Update CI step comment so humans stop reading bulk-only.

---

### F2 — Substring tier classifier mis-buckets pages (wrong tier)

**Severity:** High (wrong tier classification)  
**Evidence:**
- `phase-01-close-4a-depth-report.md:50-51` Risk: *“Misclassification thin vs standard → trust SettingsShell/EntityHeader/Workflow heuristics already in script.”* — that trust **is** the failure mode.
- `scripts/check-ui-frames.mjs:68-73`: `src.includes('SettingsShell'|'EntityHeader'|'WorkflowStatusbar')` on **raw file text**.
- Simulated: comment-only `// EntityHeader` on a DetailPage → **standard**; string `"WorkflowStatusbar is optional"` + real EntityHeader → **full**.
- Live classify is currently lucky (receipt/opp full, student/class standard, 3 settings, payroll/my-hr thin) but unhardened.

**Failure scenario at cook time:** Phase 1 “verify only” leaves classifier untouched. Later cook/docs add “promote to EntityHeader” TODO comments or import-for-type strings → thin ops pages flip to standard/full without chrome. PAGE-FRAMES examples and lab H6 evidence then lie. Agents follow wrong tier for new screens.

**Fix:** Classify only on **import/JSX usage** (or AST-light: `<EntityHeader`, `SettingsShell`, `WorkflowStatusbar` as tags/imports), not bare word includes. Add a hostile unit test: fixture source with comment `EntityHeader` must stay **thin**. Phase 1 should **not** mark complete on current heuristics without that test.

---

### F3 — A11y “baseline lite” is file-existence theater (MS-3 false close)

**Severity:** High (CI / governance false confidence)  
**Evidence:**
- Original MS-3 (`research-redteam-ds-multi-scope-2026-08-04.md:259`): *“No a11y automation | No axe in CI | Minimal: axe … **OR** periodic manual keyboard pass doc”*.
- `phase-02-a11y-baseline-lite.md:50-56,65-69` success/validation: `test -f A11Y-BASELINE.md`, `grep` MASTER/llms, `check-ui-frames --strict` — **zero** requirement to execute one keyboard path on a real page.
- `phase-02-a11y-baseline-lite.md:20,38-39` also updates red-team MS-3 to *partial→partial or fixed-lite* with “evidence path” that can be the markdown file itself.
- Outcome `plan.md:38`: *“A11y has a minimal written baseline maintainers can re-run”* — “can re-run” without “must have been run once with date/evidence.”

**Failure scenario:** Cook creates a polished checklist, links it, marks lab MS-3 fixed-lite. No maintainer ever tabs through FilterBar → table → bulk → dialog. Next multi-scope red-team scores L6 higher because “baseline exists.” Same class of failure as clipboard bulk honesty before inventory labeling.

**Fix:** Success criteria must require **one dated manual pass** (or Playwright keyboard smoke if already available) recorded in `reports/` with: shell ⌘K open/close, one ListPage FilterBar+pager, one DetailPage EntityHeader h1, Toast live region. Checklist alone = **open/partial**, never fixed-lite. Keep axe out; do not substitute doc for pass.

---

### F4 — Dual a11y SoT → doc/code drift on day one

**Severity:** High (doc/code drift)  
**Evidence:**
- `design-system/cmc-edu/MASTER.md:189-198` already ships **“Accessibility checklist (ship gate)”** (contrast, focus, aria-label, toast live, keyboard table, reduced-motion, touch).
- `phase-02-a11y-baseline-lite.md:17-19,36-38` creates **new** `A11Y-BASELINE.md` + link from MASTER + llms — no step to **merge, supersede, or demote** the MASTER section.
- Phase 2 architecture lists composite role expectations; packages already implement many (`filter-bar` role=search, `list-pagination` role=navigation, `bulk-action-bar` role=toolbar, EntityHeader `<h1>`, toast aria-live). Inventory without cross-walk will restate or contradict MASTER.

**Failure scenario:** Agents update one checklist and not the other. MASTER “ship gate” stays unchecked forever; A11Y-BASELINE claims operator paths; red-team cites whichever is greener. Six months later neither matches `packages/ui` roles.

**Fix:** Single authority: either expand MASTER §Accessibility into the Soft Ops operator matrix **or** make A11Y-BASELINE the only detailed checklist and reduce MASTER to a one-line pointer + link. Phase 2 steps must include **diff against live roles** (grep `role=` / `aria-` in named composites) so the doc cannot invent roles components lack.

---

### F5 — Phase 1 status vs reality: re-cook or rubber-stamp

**Severity:** Medium-High (cook-time failure)  
**Evidence:**
- `plan.md:53`: Phase 1 *“**Mostly done in prior cook — verify only**”*.
- `phase-01-close-4a-depth-report.md:4` frontmatter `status: pending`.
- `phase-01-close-4a-depth-report.md:14,28-38`: *Do not re-implement if verification green* but steps still invite *“patch only missing piece”* and *“Mark phase complete”*.
- Prior cook already delivered tiers/docs/script/tests/lab (`cook-validate-cycle-4a-2026-08-04.md:16-26`); live metrics match.
- Advise checklist for 4a still unchecked (`advise-ms-p1-detail-governance-2026-08-04.md:49-54`) while work-definition already marks Slice D ✅ (`work-definition-clear-2026-08-04.md:125`).

**Failure scenario:** `/ck:cook --auto` either (1) rewrites working `check-ui-frames.mjs` “to be sure,” introducing regressions, or (2) auto-completes Phase 1 from plan prose without running verify commands. Phase 3 then checkboxes advise history inconsistently with work-def.

**Fix:** Phase 1 frontmatter → `status: verify` with **hard short-circuit**: if both validation commands pass and PAGE-FRAMES §C table exists, **no file writes** except phase status. Explicit “exit 0 = phase complete; do not edit scripts.” Move advise checkbox cleanup to Phase 3 only, with evidence commands not re-implementation.

---

### F6 — Cook inventory of composites invites axe / role “fixes” (scope creep)

**Severity:** High (axe / product scope creep)  
**Evidence:**
- Non-goals: `plan.md:44` *Full axe CI gate*; `phase-02:21,48` *no axe dependency unless already present* / *Do not add CI axe job*.
- MS-3 original fix text still says *“axe on shell+list+dialog smoke”* in multi-scope report agents will re-read.
- `phase-02-a11y-baseline-lite.md:44`: Step 1 *“Inventory existing aria/role in packages/ui/src/components (FilterBar, ListPagination, BulkActionBar, CommandPalette, Toast, DataTable, PageHeader)”* — large product surface with **modify** allowed only for lab/docs, but inventory path sits next to “missing role” discovery.
- `phase-02-a11y-baseline-lite.md:45`: *“optional future axe”* inside the baseline doc — cook may implement the optional.

**Failure scenario:** During inventory, agent finds DataTable checkbox labels incomplete or dialog focus trap undocumented, installs `@axe-core/playwright` “because MS-3 High,” or patches composites mid Phase 2. Plan non-goals become commit noise; CI grows a flaky a11y job solo operator cannot maintain.

**Fix:** Phase 2 **allowed write set** is hard: `A11Y-BASELINE.md`, MASTER link line, `llms.txt` pointer, red-team finding text only. Inventory is **read-only**; gaps become a table of “known residual” not PRs. Baseline doc must say *“axe CI deferred; do not add in this cycle”* in the first 20 lines. Reject any `package.json` dependency diff in Phase 2 review.

---

### F7 — Phase 3 multiplies SoT (plan reports + lab + docs) → inevitable drift

**Severity:** Medium (doc/code drift)  
**Evidence:**
- `phase-03-governance-finalize.md:17-28` modifies **prior plan** work-definition + advise checklists, creates cook-complete, and may re-touch `design-lab-redteam.tsx` again after Phase 2.
- `phase-03-governance-finalize.md:49`: Risk admits *“Doc-only drift again”*; mitigation *“point metrics to `pnpm check:ui-frames`”* does not stop rewriting historical advise checklists.
- Lab already claims H6/C2 fixed and depth report present (`design-lab-redteam.tsx:42-49,96-102`); Phase 2–3 will mutate again for MS-3.
- Work-definition already has Cycle 4a row ✅ while Phase 3 still plans “update with Cycle 4a/4b rows.”

**Failure scenario:** Three narratives diverge: (1) prior-plan work-def, (2) this plan cook-complete, (3) live lab scorecard. Next cycle red-team reads stale advise unchecked boxes or inflated lab scores. “Governance finalize” becomes the drift source.

**Fix:** **One** completion artifact owns the cycle: `reports/cook-complete-2026-08-04.md` with command output paste. Prior-plan files: append a **dated pointer** only (“Cycle 4 residual: see …”), do not rewrite historical checklists to [x] retroactively. Lab scorecard: change MS-3/a11y note only; freeze Detail recipe score unless metrics regress. Authority sentence required in cook-complete: *numbers from last `pnpm check:ui-frames --json` win over prose.*

---

### F8 — Plan success metrics treat report-only and gated alike; thin can grow silently

**Severity:** Medium (CI false confidence + wrong tier honesty)  
**Evidence:**
- `plan.md:61-65`: dualTitleReview 0, bulkListsOk, detailTiers present, filterBarCount≥5 — same table weight.
- Tests pin **named** full/standard/settings/thin exemplars (`check-ui-frames.test.mjs:42-61`) but **not** `detailPageCount === sum(tiers)` stability, nor “no new thin without PAGE-FRAMES note.”
- Non-goal `plan.md:47`: *Strict fail on thin DetailPage* — correct — but nothing requires thin residual to stay **named** in docs when a 10th DetailPage lands as thin by default (`classifyDetailTier` default branch).
- Phase 1 expects thin includes payroll+my-hr (`phase-01:35`) — does not forbid silent thin growth.

**Failure scenario:** New entity detail ships without EntityHeader → auto-**thin**. CI green (strict + exemplar tests still pass). Lab still says “thin=payroll·my-hr residual.” Agents copy thin pattern. MS-1 “under-adopted EntityHeader” returns while governance claims closed.

**Fix:** Report metric in cook-complete: `detailThinCount` + file list must match PAGE-FRAMES thin examples **or** doc must be updated in same PR. Optional test: `detailThinCount <= 2` **or** every thin file appears in PAGE-FRAMES thin row (string match). Keep non-strict; make **doc sync** the gate in Phase 3 validation (`grep` each thin file basename in PAGE-FRAMES).

---

## Cross-cutting cook risks (not separate findings)

| Risk | Note |
|------|------|
| Phase 2 depends on Phase 1 | OK if Phase 1 is verify-only; if verify fails, do not start a11y prose until classifier/docs true. |
| `--auto` cook | High risk of F5+F6; prefer cook Phase 2–3 only after human confirms Phase 1 short-circuit. |
| Positive control | 4a depth report + PAGE-FRAMES §C + live 9-way tier split **already exist** — do not re-litigate Option B. |

---

## What the plan gets right (risk calibration only)

- Explicit non-goals: no re-skin, no full axe CI, no domain bulk, no forced EntityHeader on settings/thin.
- Phase 1 verify-first intent (if enforced as no-write on green).
- MS-3 scoped to lite checklist rather than WCAG certification claim **if** wording stays honest (F3).

---

## Recommended plan edits (planner)

1. Rewrite whole-plan success metrics into **Gated / Test-pinned / Report-only / Manual-once** columns (F1, F8).  
2. Phase 1: status=verify, zero product writes on green; add hostile classifier fixture test or accept misclassification residual explicitly (F2, F5).  
3. Phase 2: hard allowlist of files; require one dated keyboard pass artifact; resolve MASTER vs A11Y-BASELINE single SoT (F3, F4, F6).  
4. Phase 3: append-only prior reports; cook-complete is sole cycle scoreboard; thin list must match docs (F7, F8).  
5. Drop any lab score inflation for a11y until manual pass exists.

---

## Checklist coverage (analyst)

- [x] Cook-time failure (re-implement, inventory scope, --auto)  
- [x] CI false confidence (strict vs report vs tests)  
- [x] Doc/code drift (MASTER/A11Y, prior-plan rewrite, lab)  
- [x] Wrong tier classification (substring includes)  
- [x] Scope creep to axe (MS-3 wording + inventory + optional future)  

**Findings count:** 8 (at cap).  

---

Status: DONE  
Summary: Eight failure modes; worst are CI treating report-only depth as gated, substring tier misclassification, and MS-3 checklist-without-pass false close—plus dual a11y docs and axe creep via inventory.  
Concerns: Do not cook Phase 2–3 until planner splits gated vs report-only success metrics and freezes Phase 1 as verify-only.  
