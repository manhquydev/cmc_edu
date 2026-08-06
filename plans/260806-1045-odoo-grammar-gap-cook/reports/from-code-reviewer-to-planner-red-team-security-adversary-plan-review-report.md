# Plan review — Security Adversary + Fact Checker

**Plan:** `plans/260806-1045-odoo-grammar-gap-cook/`  
**Lens:** Security Adversary (UI overlay / nav integrity / false evidence)  
**Role:** Fact Checker (claims vs repo)  
**Verdict:** REJECT as written — do not cook until Critical/High items are rewritten.  
**Findings:** 8

---

## Critical

### 1. Sticky phases re-arm app-switcher cover without mandatory re-audit

**Problem:** P0 exists because page chrome under `main.o-main` paints over the open app-switcher (`menuCoveredByPage`). Phase 1 allows completion via a blocker note alone. Phases 3 and 5 then **add** sticky chrome inside the same scroll owner, with **no dependency on Phase 1** and **no required `menuCoveredCount` re-run after sticky lands**. That is a fail-open path for restoring a navigation-integrity defect (users cannot reach other modules; click targets land on page chrome).

**Evidence:**
- `packages/ui/src/odoo.css:97-103` — navbar stacking was added specifically because sticky/page chrome covered the switcher.
- `plans/260806-1045-odoo-grammar-gap-cook/phase-01-p0-stacking-reaudit.md:39-40` — success = live `menuCoveredCount=0` **or** blocker note.
- `plans/260806-1045-odoo-grammar-gap-cook/phase-03-statusbar-sticky-md.md:7` — `dependencies: []` (may land before any live stacking proof).
- `plans/260806-1045-odoo-grammar-gap-cook/phase-05-list-ops-pad-sticky-e2e.md:7` — same; sticky list proof may be skipped (`phase-05:33-34`).
- `outputs/design3-frontend-audit/results.json:11-19` — last captured live result still `menuCoveredCount: 7` on seven admin routes.

**Fix required in plan:** Make Phase 3/5 blocked by Phase 1 **green live audit** (not blocker note). After any sticky CSS change, mandate re-run of `design3-frontend-audit.mjs` with `menuCoveredCount=0` as a hard gate. Delete “blocker note completes P0” as an acceptance path for plan-level done.

---

### 2. Phase 3 sticks the whole summary band that already holds money/status HighlightStrips

**Problem:** Plan treats `.o-detail-summary` as a thin Odoo statusbar. In this codebase that node is the **summary slot for HighlightStrip + status** on finance/CRM/detail pilots. Sticking that band on md+ overlays scrolled form/body content (including controls near approve/amount UI) — classic sticky UI-redress risk — and contradicts the **intentional** non-sticky comment that requires a thin statusbar-only split first.

**Evidence:**
- `packages/ui/src/odoo.css:1545-1551` — explicitly **Not sticky**; “sticky only when summary is thin statusbar-only (later split).”
- `design-system/cmc-edu/ODOO-COMPONENT-MAP.md:85` — `.o-detail-summary ← statusbar / HighlightStrip band`.
- `apps/admin/src/pages/finance/receipt-detail.tsx:401-418` — summary = `HighlightStrip` with **Số tiền** + status (financial surface).
- `apps/admin/src/pages/crm/opportunity-detail.tsx:336-338` — same pattern.
- `plans/260806-1045-odoo-grammar-gap-cook/phase-03-statusbar-sticky-md.md:18-31` — implements sticky on `.o-detail-summary` without the split; risk section only mentions “sticky inert,” not overlay/redress.

**Fix required in plan:** Block sticky until summary is split into thin statusbar vs HighlightStrip (as `odoo.css` already states). Scope sticky selector to statusbar-only. Add adversarial acceptance: sticky band must not cover primary actions or editable fields on receipt/opportunity detail after scroll.

---

## High

### 3. “Source fix landed; Phase 1 is evidence only” is not backed by live proof; unit test is a CSS greptest**Problem:** Plan asserts the stacking fix is already in CSS and Phase 1 is merely evidence. Live artifact still shows seven covered menus. Unit “stacking” test only asserts `z-index >= 100` exists in a file string — it cannot prove `elementsFromPoint` integrity. Treating that unit as interim P0 evidence is security theater.

**Evidence:**
- `plans/260806-1045-odoo-grammar-gap-cook/phase-01-p0-stacking-reaudit.md:14` — “Source fix already landed.”
- `packages/ui/src/odoo.css:103` — `z-index: 1000` present in source.
- `outputs/design3-frontend-audit/results.json:11-19` — still `menuCoveredCount: 7`.
- `packages/ui/src/odoo/odoo-shell-stacking.test.ts:22-28` — grep CSS; threshold `>= 100`, not behavioral hit-test.
- `plan.md:70-71` — lists “local stacking unit tests as interim” under deploy lag.

**Fix required in plan:** State that P0 is **open** until live `menuCoveredCount=0`. Demote unit test to regression-only; forbid calling Phase 1 complete on unit green + blocker markdown.

---

### 4. Phase 6 can mark matrix SHIPPED without Phase 1 — document lies about nav integrity

**Problem:** Docs sync depends on phases 2–5 only. Phase 6 text says “do not claim P0 without phase 1 evidence,” but the dependency graph does not enforce it. Evergreen map becomes a false security status surface.

**Evidence:**
- `plans/260806-1045-odoo-grammar-gap-cook/phase-06-docs-matrix-sync.md:7` — `dependencies: [2, 3, 4, 5]` (no `1`).
- `phase-06-docs-matrix-sync.md:35` — soft prose warning only.
- `design-system/cmc-edu/ODOO-COMPONENT-MAP.md:123` — status legend consumers treat this file as shipping authority.

**Fix required in plan:** `dependencies: [1, 2, 3, 4, 5]` and hard criterion: no brand/statusbar/kanban/list SHIPPED claims if Phase 1 live audit is missing or non-zero.

---

### 5. Phase 4 “double gutter” premise is false for the shipped kanban path

**Problem:** Plan proposes removing “gap + card margin” as if both still apply. Canonical structure puts cards in `.o-kanban-col-body`, and CSS already zeroes card margin there. Cooking blind “fix double spacing” churns hit geometry on CRM pipeline without a verified defect.

**Evidence:**
- `packages/ui/src/odoo/odoo-kanban.tsx:37` — children render inside `.o-kanban-col-body`.
- `packages/ui/src/odoo.css:497-510` — col-body uses `gap`; direct/nested `.o-kanban-card` get `margin-bottom: 0`.
- `packages/ui/src/odoo.css:536-539` — base card still declares margin (dead for in-body cards).
- `phase-04-kanban-gutter-responsive.md:14-31` — “potential double gutter” as functional work.
- `--odoo-kanban-card-width-sm` unused is real (`odoo.css:66`; no consumer outside docs/xia) — responsive width is the only factually supported gap; double-gutter is not.

**Fix required in plan:** Drop double-gutter removal as a deliverable unless DevTools shows a non-`KanbanColumn` consumer still stacking margin+gap. Scope Phase 4 to unused `card-width-sm` / viewport width only.

---

### 6. Phase 5 allows skipping sticky/modal stacking proof; modal stack not named

**Problem:** Requirement says sticky thead must stay under navbar **and under modals**, then implementation allows skipping Playwright / audit with a tracked skip. No concrete modal primitive or z-index contract (Astryx `AlertDialog` vs `.ck-cmd-*` at `z-index: 1200`) is specified. Optional skip = optional verification of overlay trust boundary.

**Evidence:**
- `phase-05-list-ops-pad-sticky-e2e.md:18-19` — functional: thead under navbar and modals.
- `phase-05-list-ops-pad-sticky-e2e.md:33-34` — explicit skip path.
- `packages/ui/src/odoo.css:423-426` — thead `sticky; z-index: 1`.
- `packages/ui/src/odoo.css:2863` — command palette overlay `z-index: 1200` (only one audited dialog stack in odoo.css).
- `packages/ui/src/components/confirm-dialog.tsx:1-4` — production confirms use Astryx `AlertDialog` (stacking not defined in this plan).

**Fix required in plan:** Name exact dialog used on the chosen list route; require one automated probe (Playwright or audit). Remove skip-as-success. Assert portal z-index > sticky thead and > navbar where appropriate.

---

## Medium

### 7. Ops pad target misidentified; global tokens already match Odoo table-sm

**Problem:** Phase 5 points cooks at “densify block ~1515,” which only tightens **wrap** padding, not cells. List cells already use `--odoo-list-cell-padding-*: 0.3rem / 0.5rem`. Further `0.3rem 0.2rem` under `.o-wrap--ops` invent denser-than-token (and denser-than-Odoo-sm) hit targets without product authority — shrinks click/tap areas on ops lists (receipts, etc.).

**Evidence:**
- `packages/ui/src/odoo.css:60-61` — list cell tokens already `0.3rem` / `0.5rem`.
- `packages/ui/src/odoo.css:441-442` — `td` uses those tokens.
- `packages/ui/src/odoo.css:1515` — `.o_web_client .o-wrap--ops` wrap padding only.
- `plans/reports/xia-compare-260806-odoo-list-density.md:42-48` — correctly notes missing ops **cell** rule; proposal `0.3rem 0.2rem` is advisory, not locked product policy.
- `phase-05-list-ops-pad-sticky-e2e.md:23-30` — cites densify ~1515 / example `0.3rem 0.2rem`.

**Fix required in plan:** If ops pad proceeds, declare authority (why denser than Odoo sm), target a new selector explicitly, and add min touch-target / regression on finance list.

---

### 8. Unresolved open questions contradict locked implementation recipes

**Problem:** Plan leaves brand SoT and statusbar z-index open, then phases prescribe concrete behavior (`activeApp.label`, sticky `z-index ≤5`, “keep default stacking”). Cooking with unresolved security-relevant stacking ambiguity is how the last switcher bug shipped.

**Evidence:**
- `plan.md:77-80` — open Qs: brand SoT; sticky z-index under dropdowns; list sticky proof venue.
- `phase-02-brand-module-name.md:18` — locks `activeApp.label` from nav registry.
- `phase-03-statusbar-sticky-md.md:31` — “z-index below navbar (≤5 local sheet layer).”
- Xia/Odoo compare cites statusbar `z-index: 6` (`plans/reports/xia-compare-260806-odoo-form-sheet.md:147-151`) — plan’s ≤5 is neither “default” nor Odoo’s 6.
- Brand fallback `apps[0].label` when `activeApp` null (`packages/ui/src/odoo/odoo-navbar.tsx:37-40`) can mislabel context; Phase 2 success only requires “non-empty” (`phase-02:42`).

**Fix required in plan:** Close open questions before cook. Specify sticky z-index relative to navbar (1000), app-switcher menu (10 inside navbar context), control-bar (5), thead (1), and command palette (1200). Brand fallback must be correct-module or explicit product string — not “any non-empty.”

---

## Behavioral checklist (plan scope)

| Check | Result |
|-------|--------|
| Concurrency / race | Phases 3–5 all mutate `odoo.css` with empty deps — collision risk with stacking |
| Error / fail-open | Phase 1 + Phase 5 skip paths fail open on overlay defects |
| Authz | Out of scope; brand fallback can mis-signal active module |
| Input validation | N/A (layout) |
| Data exposure | Sticky HighlightStrip keeps money/status pinned while scrolling |
| Fact-check | Multiple false/stale premises (double gutter; densify line; P0 “fixed”) |

---

## Recommended planner actions (ordered)

1. Rewrite Phase 1 acceptance: live `menuCoveredCount=0` only; unit test demoted.
2. Gate Phase 3 on summary split; forbid sticky on HighlightStrip-bearing summaries.
3. Add post-sticky re-audit to Phases 3 and 5; wire Phase 6 → Phase 1.
4. Correct Phase 4 to responsive width only unless new evidence of double gutter.
5. Close stack/z-index and brand SoT open questions with explicit layer table before cook.
