# Plan red-team — Assumption Destroyer / Scope Auditor

**Plan:** `plans/260806-1045-odoo-grammar-gap-cook/`  
**Date:** 2026-08-06  
**Mode:** Hostile claim verification via grep/read (no code-quality nitpick).  
**Verdict:** Plan is not cook-ready as written. Several phases target dead selectors, already-mitigated bugs, or contradict in-code authority. Fix assumptions before `/ck:cook`.

---

## Findings (9)

### F1 — CRITICAL — Phase 5 ops-pad + sticky e2e target a class that nothing mounts

**Claim (plan):** Wire denser padding under `.o-wrap--ops .o-list-table td` and prove sticky `thead` (~phase-05; xia list rec echoed).

**Destroyed:** `.o-list-table` exists only as unused CSS. Production lists use Astryx `Table` inside `.o-list`, not `.o-list-table`.

| Evidence | |
|----------|--|
| CSS-only class | `packages/ui/src/odoo.css:416–445` (`.o-list-table` / sticky `thead`) |
| Zero TSX emitters | repo grep `o-list-table` in `*.{ts,tsx}` → **0 hits** |
| Real list path | `packages/ui/src/components/data-table.tsx:153–163` → `<div className="o-list"><Table density="compact" …/></div>` |
| Real cell chrome under shell | `packages/ui/src/odoo.css:2233–2249` (`.ck-table-shell thead/td` — **no sticky**, no ops pad) |

**Impact:** Shipping the planned selector is a no-op. Sticky e2e against `.o-list-table thead` cannot prove production behavior. Phase 5 “will work” is false unless retargeted to Astryx/`ck-table-shell` / StyleX table DOM.

**Required plan fix:** Replace selectors with the actual table surface; or drop ops-cell CSS as YAGNI (tokens already `0.3rem`/`0.5rem` at `odoo.css:60–61`, consumed at `441–442`) and redefine sticky proof against whatever sticky affordance actually exists (today: comment at `1383–1391` claims sticky lives on `.o-list`, but `.o-list` only sets `overflow: auto` — no sticky thead rule for Astryx).

---

### F2 — CRITICAL — Phase 3 “sticky `.o-detail-summary` md+” contradicts shipping CSS authority and pilot pages

**Claim:** Stick `.o-detail-summary` at md+; spot-check CRM deal / finance receipt.

**Destroyed:** Same file already documents **why sticky is deferred** — summaries include tall HighlightStrip + statusbar. Pilot detail pages put exactly that stack in `summary`.

| Evidence | |
|----------|--|
| Intentional not-sticky | `packages/ui/src/odoo.css:1545–1551` (“Not sticky: pilot summaries include tall HighlightStrip… later split”) |
| Finance receipt summary | `apps/admin/src/pages/finance/receipt-detail.tsx:401–429` — HighlightStrip **+** WorkflowStatusbar **+** StatActions |
| CRM opportunity summary | `apps/admin/src/pages/crm/opportunity-detail.tsx:336–358` — HighlightStrip + WorkflowStatusbar |
| Class detail | `apps/admin/src/pages/classes/class-detail.tsx:602–604` — HighlightStrip |

**Impact:** Blind sticky on `.o-detail-summary` sticks a multi-block band (highlights + status + actions), not Odoo’s thin statusbar. That is a product/UX regression and ignores in-tree authority. Xia form report and this cook plan both skip the prerequisite “thin statusbar-only / later split”.

**Required plan fix:** Gate phase 3 on splitting thin statusbar out of `summary` **or** sticky a narrower selector (e.g. only `.o-workflow-statusbar` / ProgressSteps), and stop claiming CRM/finance receipt as happy-path proof as currently composed.

---

### F3 — HIGH — Phase 4 “double gutter” is already neutralized on the CRM path the plan cites

**Claim:** Fix potential double gutter (gap + card margin → 16px); DevTools before CSS change.

**Destroyed:** CSS already zeroes card margin inside column body (including one-level nesting). CRM wraps `KanbanCard` in exactly one wrapper `div` — matches the nest selector.

| Evidence | |
|----------|--|
| Body gap | `packages/ui/src/odoo.css:497–504` (`gap: var(--odoo-kanban-gutter)`) |
| Margin kill | `packages/ui/src/odoo.css:507–510` (`.o-kanban-col-body > .o-kanban-card` and `> * > .o-kanban-card` → `margin-bottom: 0`) |
| Residual base margin | `packages/ui/src/odoo.css:536–539` (still on `.o-kanban-card`, overridden in body) |
| CRM wrap | `apps/admin/src/pages/crm/pipeline.tsx:115–131` (`div` → `KanbanCard`) |

**Impact:** Phase 4 step 1 risks a false-positive cook (“remove redundant margin”) that changes nothing measurable on the primary board, while inheriting a stale Xia challenge (`xia-compare-260806-odoo-kanban.md` “potential double”) that the override already answers.

**Keep:** Responsive width work is still real (`--odoo-kanban-card-width-sm` at `odoo.css:66` is **unused**; cards lock `320px` at `526`/`538` — no `90vw` / media rule in `odoo.css`). Split “gutter confirm” (docs/measure only) from “responsive width” (actual CSS).

---

### F4 — HIGH — Phase 2 brand change silently breaks design3 audit brand marker + existing e2e

**Claim:** Remove `brand="CMC EDU"`; update shell unit + `admin-shell.ui.spec`. Risks table mentions brand hardcodes.

**Destroyed / unstated dependents:** Live audit script and smoke still assert literal `CMC EDU` on `.o-brand`. Plan phase 2 file list omits the audit. Plan acceptance still requires running that audit.

| Evidence | |
|----------|--|
| Shell override | `apps/admin/src/shell/shell.tsx:134` |
| Navbar default (valid) | `packages/ui/src/odoo/odoo-navbar.tsx:39–40` |
| Unit hardcode | `apps/admin/src/shell/shell.test.tsx:113` |
| Playwright hardcode | `apps/e2e/tests/admin-shell.ui.spec.ts:42` |
| **Audit brand metric** | `apps/e2e/design3-frontend-audit.mjs:249–250` (`.o-brand` filter `CMC EDU` → `brandCmc`) |
| Extra smoke | `apps/e2e/webwright-prod-smoke.mjs:173` |

**Impact:** After phase 2, `brandCmc` goes false on every walked route; phase 1 “run audit” and plan-level acceptance will report a new false shell regression even if stacking is green. Cross-phase dependency is unstated (`phase-02` does not list audit; `phase-01`/`acceptance` do not list brand contract update).

**Required plan fix:** Add audit + smoke brand-assert updates to phase 2 success criteria (or explicitly redefine `brandCmc` as “non-empty `.o-brand`”).

---

### F5 — HIGH — Phase 1 “source fix already landed ⇒ menuCoveredCount=0 after deploy” is unproven; audit needs hard infra deps

**Claim:** z-index 1000 is in tree; run `design3-frontend-audit.mjs`; expect `menuCoveredCount=0` or blocker note.

**Destroyed partials:**
1. Last recorded run still has **7** covered menus — plan treats CSS as sufficient without naming image rebuild / package embed path as a hard dependency.
2. Audit is not a local unit gate: hardcoded prod URL + `.env.prod` credentials path.

| Evidence | |
|----------|--|
| Source z-index | `packages/ui/src/odoo.css:97–103` |
| Last artifact | `outputs/design3-frontend-audit/results.json` → `"menuCoveredCount": 7` (paths include session-assessment, finance/new, …) |
| Hardcoded target | `apps/e2e/design3-frontend-audit.mjs:120,172,180` → `https://localhost/admin…` |
| Secret env load | `apps/e2e/design3-frontend-audit.mjs:35–51` → reads `.env.prod` |
| Duplicate entry | also `outputs/design3-frontend-audit/run-audit.mjs` (plan cites only `apps/e2e/…`) |

**Impact:** “Will work when deploy available” hides: Docker `cmcv2-prod-admin` rebuild with updated `@cmc/ui` CSS, TLS localhost admin up, `.env.prod` present, Playwright chromium. Without those, phase 1 correctly allows a blocker doc — but plan-level acceptance still waves the audit metric as if it’s optional ops. Sibling dissection plan still has the **same** unchecked live re-audit (`plans/260806-odoo-ui-component-dissection/plan.md` acceptance) — duplicated P0 across `blockedBy` “already refreshed”.

**Required plan fix:** Explicit deploy checklist (image tag / rebuild command); treat `menuCoveredCount=0` as blocked until artifact exists; de-dupe ownership with dissection plan.

---

### F6 — HIGH — Phases 3/4/5 declare `dependencies: []` but all mutate the same high-blast file

**Claim:** Next after validate: “phase-serial unless cook supports parallel for CSS-only 3–5”.

**Destroyed:** Frontmatter says no deps among 3–5; cook parallelization is invited. Shared write target is `packages/ui/src/odoo.css` (thousands of lines; shell densify + kanban + list blocks adjacent). Sibling rollout plan `260805-1920-design3-admin-rollout` also owns `odoo.css` + `shell.tsx` on the **same branch** `feat/design3-admin-rollout` (this plan `plan.md:8–9,28–29`).

**Impact:** Unstated merge/serialization debt. Parallel cook of 3–5 is conflict-by-construction. Cross-plan edits to `shell.tsx` (brand) race sibling status-validation work.

**Required plan fix:** Mark phases 3→4→5 serial on `odoo.css` in frontmatter `dependencies`, and require a sync point with `260805-1920-design3-admin-rollout` before cooking shell/CSS.

---

### F7 — MEDIUM — Open Q #1 reopens a decision the plan already locks

**Claim (locked):** Brand = active module label (product decision 2026-08-06).  
**Claim (open):** Source-of-truth `activeApp.label` from `NAV_MODULES` vs i18n corpus?

Removing `brand="CMC EDU"` already selects `activeApp?.label` from the permission-filtered `modules` passed as `apps` (`shell.tsx:38–40,130–131` + `odoo-navbar.tsx:37–40`). Labels are Vietnamese strings on `NAV_MODULES` today (`nav-registry.ts:9+`). There is no separate i18n brand corpus in scope.

**Impact:** False ambiguity. Cookers may invent i18n work mid-phase (scope creep) or stall waiting for a second decision that is implementation-complete once override is removed.

**Required plan fix:** Close open Q #1: SoT = `activeApp.label` on filtered `apps`; fallback `apps[0].label` then `'CMC EDU'`; no new corpus.

---

### F8 — MEDIUM — Phase 3 sticky “within sheet-bg under `main.o-main` scroll” glosses over sticky/stacking interactions

**Claim:** Stick within sheet-bg; z-index ≤5; won’t cover navbar.

**Partially true / unstated risks:**
- Scrollport **is** `main.o-main` (`odoo.css:678–681` `overflow: auto`), not an inner sheet scroller — sticky on summary therefore sticks to **main**, which is intended for Odoo-like chrome-under-navbar, but plan wording “inside sheet scroll context” is inaccurate.
- ControlBar already uses `position: sticky; top: 0; z-index: 5` (`odoo.css:700–706`). Same `top:0` + plan z≤5 means statusband and list CP share the sticky slot language; on long pages with both patterns in one scroll tree, stacking needs an explicit rule (plan open Q #2 leaves this unresolved while still claiming “z-order OK” in success criteria).
- Navbar cover regressions previously came from sticky page chrome (`odoo.css:97–101` comment; page-header forced `position: static` under shell at `1516–1524`). Re-introducing sticky bands without a stacking contract is how P0 came back.

**Required plan fix:** Resolve open Q #2 with numeric layers (navbar 1000 / sticky CP / statusband / thead) before cook; rewrite success criteria to measure against `main.o-main`, not “sheet scroll context”.

---

### F9 — MEDIUM — “`--odoo-kanban-card-width-sm` / ~90vw pattern from Odoo compare” oversells what exists in-repo

**Claim (phase-04):** Add tablet/mobile column width using existing `--odoo-kanban-card-width-sm` / ~90vw pattern.

**Destroyed:** Token exists; **pattern does not**. No media query references the sm token or `90vw` in `odoo.css`. Kanban unit tests assert markup/color only — no geometry/media contracts (`odoo-kanban.test.tsx` has no gutter/media asserts).

**Impact:** Cook is greenfield CSS + new tests, not “wire existing pattern.” Effort cue “0.5–1d” may be fine, but “will use existing pattern” understates novelty and validation gap.

---

## Checklist (Assumption Destroyer)

| Area | Result |
|------|--------|
| Cited authority files exist | Mostly yes (synthesis + 5 xia reports + map) |
| Dead / unused selectors | **Fail** — F1 `.o-list-table` |
| Contradicts in-code comments/authority | **Fail** — F2 sticky summary |
| False bug already fixed | **Fail** — F3 double gutter on CRM |
| Unstated cross-phase / audit deps | **Fail** — F4, F5, F6 |
| Locked vs open decisions | **Fail** — F7 |
| Sticky stacking contract | Incomplete — F8 |
| “Existing pattern” accuracy | **Fail** — F9 |

## What still looks true (risk calibration)

- Navbar default brand fallback chain is correctly described (`odoo-navbar.tsx:39–40`); shell override is the real blocker (`shell.tsx:134`).
- Form dual-sheet **SHIPPED** matches map/tests (`ODOO-COMPONENT-MAP.md:75,123`; `detail-page.test.tsx:45–61`).
- Non-goals (no OWL / no 3-col CP / no inline edit) align with synthesis.
- Kanban **responsive width** gap is real even if double-gutter is not.

## Planner actions (ordered)

1. **Rewrite phase 5** around Astryx/`ck-table-shell` (or drop cell-pad no-op; redefine sticky proof).
2. **Rewrite phase 3** with summary split prerequisite or thin-selector sticky; remove “receipt/opportunity summary as-is” smoke.
3. **Demote phase 4 gutter** to measure-only; keep responsive width as the real cook.
4. **Extend phase 2** to audit `brandCmc` + smoke asserts; close open Q #1.
5. **Serialize** CSS phases + deploy checklist for phase 1; close stacking open Q #2 before cook.
6. Re-run `ck:plan validate` after frontmatter/deps updates.

---

## Metrics

- Findings: **9** (Critical 2 · High 4 · Medium 3)
- Grep-verified false “will work” claims: **F1, F2, F3, F9** (hard); **F4/F5** (acceptance broken by unstated deps)
- Files cited with line evidence: `odoo.css`, `data-table.tsx`, `odoo-navbar.tsx`, `shell.tsx`, `pipeline.tsx`, `receipt-detail.tsx`, `opportunity-detail.tsx`, `design3-frontend-audit.mjs`, `results.json`, phase md frontmatter
