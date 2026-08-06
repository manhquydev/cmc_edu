# Red-team plan review — Failure Mode Analyst / Flow Tracer

**To:** planner  
**From:** code-reviewer (hostile; plan-only; codebase-grepped)  
**Plan:** `plans/260806-1045-odoo-grammar-gap-cook/`  
**Date:** 2026-08-06  
**Lens:** Murphy — race, deploy, rollback, cascading UI breakage  
**Out of scope:** default code-quality nits on a future cook

## Verdict

**Do not cook Phase 3 or Phase 5 as written.** Phase 3 sticks the wrong DOM node (tall summary composite). Phase 5 “sticky thead e2e” cannot prove viewport stickiness under the current nested scrollport without either fixing scroll ownership (explicitly deferred) or defining a different proof. Remaining phases need serial CSS ownership, brand→audit cascade fixes, and a hard gate on P0 deploy evidence before claim-done.

Findings: **9**

---

### 1. CRITICAL — Phase 5 sticky-thead proof is architecturally inert (nested scrollport)

**Failure mode:** “Scroll long list; thead still visible” e2e / audit probe passes or skips while thead never sticks in the viewport users actually scroll.

**Flow:** `ListPage` → `DataTable` wraps table in `.o-list` → `.o-list { overflow: auto }` creates the sticky containing block → `thead th { position: sticky; top: 0 }` sticks only when `.o-list` scrolls → `.o-list` has **no max-height**, so it grows with rows → primary scroll is `main.o-main { overflow: auto }` → whole table (incl. sticky header) scrolls away as one unit.

**Evidence:**

- `packages/ui/src/components/data-table.tsx:154` — wrapper `className="o-list"`
- `packages/ui/src/odoo.css:1386-1391` — `.o-list { overflow: auto; … }` (no max-height)
- `packages/ui/src/odoo.css:423-426` — `.o-list-table thead th { position: sticky; top: 0; z-index: 1 }`
- `packages/ui/src/odoo.css:678-681` — `.o_web_client > .o-main { overflow: auto }`
- Plan `phase-05-list-ops-pad-sticky-e2e.md:33` — scroll + thead visibility without naming which scrollport
- Plan `plan.md:48` — scroll-owner mobile flip **out of this plan**

**Required plan change:** Either (a) constrain list scrollport (height/flex) before claiming sticky, or (b) redefine Phase 5 success as “CSS contract only + tracked debt: thead sticky pending scroll-owner,” and remove false e2e acceptance. Do not allow “skip with reason” to count as shipped sticky.

---

### 2. CRITICAL — Phase 3 sticks `.o-detail-summary`, which is a tall composite, not Odoo’s thin statusbar

**Failure mode:** Sticky band eats half the desktop viewport; content hidden under HighlightStrip + WorkflowStatusbar + StatActions; rollback is a CSS fight with every DetailPage pilot.

**Flow:** Detail pilots put **HighlightStrip + statusbar (+ actions)** inside `summary={…}` → `DetailPage` mounts that as `.o-detail-summary` → Phase 3 adds `position: sticky` on that selector at md+ → entire stack sticks.

**Evidence:**

- `packages/ui/src/odoo.css:1545-1550` — explicit **“Not sticky: pilot summaries include tall HighlightStrip + statusbar; sticky only when summary is thin statusbar-only (later split).”**
- `apps/admin/src/pages/crm/opportunity-detail.tsx:336-358` — `summary` = HighlightStrip + WorkflowStatusbar
- `apps/admin/src/pages/finance/receipt-detail.tsx:401-429` — same + StatActions
- `packages/ui/src/components/detail-page.tsx:60-61` — `{summary}` → `.o-detail-summary`
- Xia `plans/reports/xia-compare-260806-odoo-form-sheet.md:231-232` — recommends sticky on `.o-detail-summary` without the split
- Plan `phase-03-statusbar-sticky-md.md:18,30-32` — sticky `.o-detail-summary` with no “thin-only / split first” gate

**Required plan change:** Split statusbar node (thin sticky) from HighlightStrip **before** sticky, or target a new thin selector only. Treat lines 1545–1547 as authority over xia’s ADAPT row until split ships.

---

### 3. HIGH — Phase 3 sticky + z≤5 races existing sticky chrome (`o-control-bar` z:5, `.o-page-header` historical z:10)

**Failure mode:** Statusband paints under/over CP or covers app content; stacking re-opens navbar-cover class of bugs on Form/Detail routes that already failed live audit.

**Evidence:**

- Plan `phase-03-statusbar-sticky-md.md:31` — “z-index below navbar (≤5 local sheet layer)”
- `packages/ui/src/odoo.css:704-706` — `.o-control-bar { position: sticky; top: 0; z-index: 5 }`
- `packages/ui/src/odoo.css:860` / `1851` — page-header sticky layer `z-index: 10` (base; shell clears under `.o_web_client` at `1521-1524`)
- `packages/ui/src/odoo.css:98-103` — navbar `z-index: 1000` landed specifically because page sticky chrome covered menus (audit 2026-08-06)
- `outputs/design3-frontend-audit/results.json:11` — last measured `menuCoveredCount: 7`

**Required plan change:** Sequence Phase 3 **after** Phase 1 live `menuCoveredCount=0` (or blocker with freeze on new sticky layers). Specify sticky top offset + stacking relative to control-bar; add regression case: open app-switcher on sticky scrolled detail.

---

### 4. HIGH — Brand cook cascades across e2e / smoke / audit while Phase 2 only lists a subset

**Failure mode:** Remove `brand="CMC EDU"` → Playwright + prod smoke red; deploy ships module labels while CI and ops scripts still assert product name; “fix green unit, red pipe” rollback scramble.

**Evidence:**

- `apps/admin/src/shell/shell.tsx:134` — override `brand="CMC EDU"`
- `packages/ui/src/odoo/odoo-navbar.tsx:39-40` — default already `brand ?? activeApp?.label ?? apps[0].label ?? 'CMC EDU'`
- Plan `phase-02-brand-module-name.md:29` — tests: `shell.test.tsx`, `admin-shell.ui.spec.ts` only
- `apps/e2e/tests/admin-shell.ui.spec.ts:42` — `getByText('CMC EDU', { exact: true })`
- `apps/e2e/design3-frontend-audit.mjs:249-250` — `brandCmc` requires `.o-brand` text `CMC EDU`
- `apps/e2e/webwright-prod-smoke.mjs:93,173` — prod smoke still keys on `CMC EDU`

**Required plan change:** Expand Phase 2 touch list to audit runner + webwright smoke (or explicitly waive with owners). Make brand change and assert updates **same commit**. Open Q1 (NAV label vs i18n) must close **before** cook — Vietnamese module labels (`nav-registry.ts:9+`) become public chrome.

---

### 5. HIGH — Parallel CSS cook (Phases 3–5) on one `odoo.css` megatable = merge/race + deploy atomics

**Failure mode:** Cook parallelizes “CSS-only 3–5” (`plan.md:84`); three PRs / worktrees rewrite the same densify block (~1510–1550) and kanban (~468–540); last merge silently reverts gutter or sticky; rollback cannot untangle.

**Evidence:**

- Plan `plan.md:84` — “phase-serial unless cook supports parallel for CSS-only 3–5”
- Plan phases 3, 4, 5 all list `packages/ui/src/odoo.css` as Modify
- Sibling plan `plans/260805-1920-design3-admin-rollout/plan.md` — status `validation`, same branch `feat/design3-admin-rollout`, same CSS surface
- Dissection backlog still owns overlapping Form/List stickiness (`plans/260806-odoo-ui-component-dissection/plan.md:111-114`)

**Required plan change:** Hard serial on `odoo.css` (3 → 4 → 5 or single cook PR). Freeze sibling rollout edits to that file during cook. Name one owner branch for densify block.

---

### 6. HIGH — Phase 1 fail-open + dual P0 ownership lets production stay at `menuCoveredCount=7` while grammar cook proceeds

**Failure mode:** Deploy lag → `phase-01-blocked-deploy.md` checked → Phase 2–5 land more sticky/z-index on Form/Detail → cascading cover regressions → docs Phase 6 marks sticky/brand SHIPPED while shell still fails live audit.

**Evidence:**

- `outputs/design3-frontend-audit/results.json:11` — `menuCoveredCount: 7`
- Plan `phase-01-p0-stacking-reaudit.md:33-34,44` — blocker artifact allowed as success path
- Plan `phase-06-docs-matrix-sync.md:7` — depends `[2,3,4,5]` **not** Phase 1
- Dissection acceptance still open: `plans/260806-odoo-ui-component-dissection/plan.md:125` — live re-audit checkbox
- Plan `blockedBy: 260806-odoo-ui-component-dissection` but cook does not wait on that checkbox

**Required plan change:** Gate Phase 3/5 (new sticky) on Phase 1 **live** green, not on blocker note. Phase 6 must depend on Phase 1 evidence type. Single owner for `menuCoveredCount` claim.

---

### 7. MEDIUM — Kanban “double gutter” diagnosis is partially stale; wrong fix breaks empty/DnD paths

**Failure mode:** Cook removes `margin-bottom` globally “as xia said”; DevTools on pipeline looks fine; empty column / non-`col-body` wrappers regress spacing; or cook no-ops because override already zeroes margin — phase “green” without responsive work.

**Evidence:**

- `packages/ui/src/odoo.css:497-510` — comment “gap replaces per-card margin-bottom” + `.o-kanban-col-body > .o-kanban-card { margin-bottom: 0 }`
- `packages/ui/src/odoo.css:536-539` — `.o-kanban-card { margin-bottom: var(--odoo-kanban-gutter) }` still present (orphan / outside body)
- `packages/ui/src/odoo.css:468-481` — board `gap` + col `padding` both use `--odoo-kanban-gutter` (8+8+8 edge-to-edge between cards of adjacent columns)
- `packages/ui/src/odoo.css:65-66` — `--odoo-kanban-card-width-sm` defined; no media consumer (grep: token unused in layout rules)
- Xia `…-odoo-kanban.md:250,305` — double-gutter + unused sm width
- Plan `phase-04-….md:30-32` — “remove redundant margin if gap” without citing the existing zeroing rule

**Required plan change:** Step 0 = DevTools on `crm/pipeline` + measure between *in-body* cards and *column* gutters separately. Prefer consume `--odoo-kanban-card-width-sm` / 90vw; treat margin delete as conditional, not default.

---

### 8. MEDIUM — Phase 5 “thead under modal” uses wrong z-index reference; ConfirmDialog stacking unowned

**Failure mode:** E2e opens Astryx `AlertDialog` / portal; thead `z-index: 1` vs cmd palette `1200` is not representative; false confidence; or dialog portals into main and stacks under sticky chrome.

**Evidence:**

- Plan `phase-05-….md:33` — “open a dialog and confirm thead does not paint above modal”
- `packages/ui/src/odoo.css:426` — thead `z-index: 1`
- `packages/ui/src/odoo.css:2862-2863` — `.ck-cmd { z-index: 1200 }` (command palette only)
- `packages/ui/src/components/confirm-dialog.tsx:3-4` — Astryx `AlertDialog` (stacking not specified in plan or local CSS)

**Required plan change:** Name the exact dialog component + assert portal root outside `.o_web_client` / stacking ≥ navbar. Do not treat ⌘K overlay as the only modal class.

---

### 9. MEDIUM — Phase dependency graph delays brand behind deploy audit and under-couples sticky risk

**Failure mode:** Phase 2 `dependencies: [1]` blocks a 15m brand fix on prod image availability; meanwhile Phases 3–5 with empty deps can land sticky races first — inverted risk order.

**Evidence:**

- `phase-02-brand-module-name.md:7` — `dependencies: [1]`
- `phase-03-….md:7`, `phase-04-….md:7`, `phase-05-….md:7` — `dependencies: []`
- Brand does not require menuCovered proof; sticky layers do (Finding 3/6)

**Required plan change:** Phase 2 independent of Phase 1. Phases 3 and 5 depend on Phase 1 live green. Phase 4 (kanban geometry) may stay independent.

---

## Cascading UI breakage map (cook-as-written)

```text
deploy lag (menuCovered=7)
  → Phase1 blocker “success”
  → Phase3 sticky tall .o-detail-summary (md+)
  → Form/Detail sticky layers compete with historic cover class
  → parallel Phase5 “sticky thead” e2e scrolls main (thead inert)
  → Phase2 brand lands; audit brandCmc + smoke still expect CMC EDU
  → Phase6 docs mark SHIPPED without Phase1 live
```

## Planner actions (priority)

1. Rewrite Phase 3 around thin statusbar split; do not sticky HighlightStrip composite.  
2. Rewrite Phase 5 sticky acceptance around scrollport truth or demote to debt.  
3. Invert deps: 2 ∥ 1; 3&5 → 1(live); serialise 3→4→5 on `odoo.css`.  
4. Expand Phase 2 consumers (audit + webwright).  
5. Single owner for `menuCoveredCount`; Phase 6 depends on Phase 1 evidence.

## Metrics (plan review)

| Item | Value |
|------|-------|
| Plan files read | 7 |
| Findings | 9 |
| Critical | 2 |
| High | 4 |
| Medium | 3 |
| Default quality checks | ignored (per request) |

DONE — 9 findings
