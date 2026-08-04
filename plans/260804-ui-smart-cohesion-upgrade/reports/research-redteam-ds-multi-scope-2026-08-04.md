# Research + Red-team: Design System multi-scope evaluation

**Date:** 2026-08-04  
**Product:** CMC EDU Soft Ops (`@cmc/ui` + admin frames)  
**Method:** Industry metric synthesis (ak-research) → map → adversarial score per scope  
**Non-goal:** Re-skin · second DS (shadcn/Tailwind) · OWL port  

---

## Executive summary

Industry practice treats design systems as **layered systems** (foundations → components → patterns → product adoption → governance → a11y/ROI), not a single “looks good” score. CMC Soft Ops is **strong on foundations, frames, and enforceable list grammar**; **mid on depth/consistency of recipes and a11y maturity**; **weak/unmeasured on multi-surface LMS, snowflake cost, and true domain bulk power**.

**Overall maturity (solo ERP admin, Option B):** ~**3.6 / 5** — *productized ops OS with CI gates*, not full enterprise multi-brand DS.

**What to review next (priority order for this repo):**

1. **Enforceability matrix** beyond dual-title/bulk (FilterBar/pager/detail tiers)  
2. **Recipe depth honesty** (detail tiers documented)  
3. **A11y baseline** (axe/keyboard on shells + tables)  
4. **Snowflake inventory** (inline layout vs frames)  
5. **Defer:** ROI calculators, Figma analytics, multi-product adoption %  

---

## Research methodology

| Item | Detail |
|------|--------|
| Sources | Supernova “9 DS metrics” (2025); thedesignsystem.guide metrics; Figma DS 104 metrics (2025); Knapsack checklist; Sparkbox/Brad Frost maturity ideas (foundations→patterns→docs); CMC lab + `check-ui-frames` + corpus |
| Date range | Industry 2023–2026; product evidence 2026-08-04 |
| Search terms | design system metrics, adoption, accessibility audit, maturity model, consistency score |
| Local measure | `node scripts/check-ui-frames.mjs --json` (2026-08-04) |

### Industry metric ladder (basic → advanced)

| Tier | Scope | Industry signals (what to score) | Typical tools |
|------|--------|----------------------------------|---------------|
| **L0 Foundations** | Color, type, space, radius, elevation, motion, icon | Token coverage · closed palette · nested harmony · dark/theme optional | Token lint, visual review |
| **L1 Primitives** | Button, input, select, badge, icon | API stability · states (hover/focus/disabled/error) · density | Story/lab, unit tests |
| **L2 Components** | Table, filter, dialog, nav, toast | Composition rules · a11y roles · variants not forks | Usage count in code |
| **L3 Patterns / templates** | List/detail/form/dashboard recipes | One chrome language · single identity h1 · control panel grammar | Frame audit script |
| **L4 Product adoption** | % screens/modules on system | Frame counts · reuse rate · snowflake rate | Static analysis (`check-ui-frames`) |
| **L5 Consistency** | Override/detachment rate | Inline styles · ad-hoc selectors · dual DS risk | Grep audit, visual QA |
| **L6 Accessibility** | WCAG-oriented | Labels, keyboard, live regions, contrast | axe, keyboard pass |
| **L7 Content & UX ops** | Density, empty states, bulk power, honesty | Ops completeness · no fake domain actions | Inventory + red-team |
| **L8 Docs & discoverability** | SoT, agent brief, lab | Doc completeness · stale risk · dual authority | Lab inventory honesty |
| **L9 Governance / CI** | Breaking change, lint gates | Automated fail on regression | CI strict scripts |
| **L10 Outcomes (advanced)** | Time-to-build, ROI, satisfaction | Cycle time · defect rate · NPS of builders | Surveys (skip if solo AI) |

**Consensus:** Measure **adoption + consistency + a11y + maintenance** early; **ROI** only after stable adoption. “Adoption alone is a red herring” if quality/depth is fake (clipboard bulk = classic trap CMC already labeled partial).

---

## CMC measured baseline (2026-08-04)

```json
{
  "pageCount": 47,
  "ListPage": 23,
  "DetailPage": 9,
  "FormPage": 7,
  "DashboardPage": 2,
  "BulkActionBar": 8,
  "ListPagination": 11,
  "EntityHeader": 4,
  "SettingsShell": 3,
  "bulkListsOk": true,
  "dualTitleReview": 0
}
```

**FilterBar product (excl lab):** receipts · schedule · rewards · students · aftersale · post-sale-meeting (**≥6**).  
**Docs SoT:** `design-system/cmc-edu/{MASTER,PAGE-FRAMES,STRUCTURE,VIEW-GRAMMAR}.md` · `packages/ui/llms.txt` · `/design` lab.  
**Stack lock:** Astryx + `@cmc/ui` CSS tokens — **no** second Tailwind/shadcn DS.  
**Composite count:** ~40+ under `packages/ui/src/components`.

---

## Multi-scope red-team scorecard

Scale: **1 = broken / missing · 3 = usable mid · 5 = mature enforced**.  
Status: **PASS** · **PARTIAL** · **FAIL** · **N/A (non-goal)**.

### L0 — Foundations (tokens / brand / structure)

| Param | Target (industry → CMC) | Evidence | Score | Status |
|-------|-------------------------|----------|-------|--------|
| Closed token set | No ad-hoc brand colors | `tokens.css` + MASTER locked `#0071E3`, Inter, warm canvas | 4.5 | PASS |
| Nested harmony | control ≤ card ≤ dialog radius | STRUCTURE: 12/16/20 | 4.5 | PASS |
| Elevation / surface families | Raised/quiet/sunken/float recipes | STRUCTURE + premium.css | 4 | PASS |
| Type roles | Finite scale, no invent sizes | STRUCTURE type table | 4 | PASS |
| Density tiers | Default / compact / touch | STRUCTURE | 4 | PASS |
| Motion / reduced-motion | Documented | MASTER motion | 3.5 | PARTIAL (honor in CSS uneven) |
| Dark mode | Optional mature | Explicit miss inventory | — | N/A non-goal |

**Verdict L0:** Strong. Risk = **token drift via page-local hex** (not fully linted).

---

### L1–L2 — Primitives & components

| Param | Target | Evidence | Score | Status |
|-------|--------|----------|-------|--------|
| Component library breadth | Enough for ERP ops | Table, FilterBar, Bulk, Toast, CommandPalette, Funnel, Schedule… | 4 | PASS |
| States | Focus, disabled, loading, empty | Mixed; Astryx + ck-* | 3.5 | PARTIAL |
| API stability / package boundary | Single import `@cmc/ui` | `index.ts` + llms.txt | 4 | PASS |
| Variant explosion | Prefer composition | Mostly good; design-lab skins explore-only | 3.5 | PARTIAL (lab LOC) |
| Unit tests on components | Critical composites tested | Many `*.test.tsx` in packages/ui | 4 | PASS |

**Verdict L1–L2:** Production-ready for admin. Gap: no systematic **state matrix** (focus ring audit).

---

### L3 — Patterns / page frames / view grammar

| Param | Target | Evidence | Score | Status |
|-------|--------|----------|-------|--------|
| Mandatory page archetypes | 4 frames only | PAGE-FRAMES + ListPage 23 / Detail 9 / Form 7 / Dash 2 | 4.5 | PASS |
| List ControlBar grammar | header · filters · pager/bulk | VIEW-GRAMMAR + ControlBar | 4.5 | PASS |
| Detail single identity | One h1 (EntityHeader) | dualTitle=0 strict CI | 4.5 | PASS |
| Detail recipe depth | Highlight · workflow · stats · tabs | Full on receipt/opportunity; thinner class/student | 3 | PARTIAL (H6) |
| Form sticky actions | FormPage | 7 pages | 3.5 | PARTIAL (thin coverage) |
| Settings pattern | SettingsShell rail | ×3 | 4 | PASS |
| Odoo grammar mapping | CP / form sheet (layout only) | VIEW-GRAMMAR + wireframes | 4 | PASS |

**Verdict L3:** Frame OS is real. **Depth of detail recipe is two-tier** — honesty needed (document tiers) not force full stack everywhere.

---

### L4 — Product adoption

| Param | Target | Evidence | Score | Status |
|-------|--------|----------|-------|--------|
| ListPage adoption | High % list screens | 23/47 pages (~49% include ListPage) | 4 | PASS |
| ListPagination | High-traffic lists | 11 files; cycle 3 residual closed | 4 | PASS |
| Bulk selection | ≥5 lists | 8 bulkListsOk | 4 | PASS (chrome) |
| FilterBar systemic | High-traffic | ≥6 product | 3.5 | PARTIAL |
| EntityHeader on entity routes | 100% entity details | EntityHeader 4 files only | 2.5 | FAIL-ish (under-adoption) |
| DashboardPage | Role dashboards | 2 (cockpit + revenue) | 3.5 | PARTIAL |
| LMS surface on Soft Ops | Shared tokens | Admin-first; LMS separate | 2 | FAIL (out of Option B scope) |

**Verdict L4:** Admin list OS adopted well; **EntityHeader / full detail recipe under-adopted** relative to DetailPage count (9 Detail vs 4 EntityHeader).

---

### L5 — Consistency & snowflakes

| Param | Target | Evidence | Score | Status |
|-------|--------|----------|-------|--------|
| Dual DS risk | 0 second system | Explicit ban shadcn/Tailwind | 5 | PASS |
| Ad-hoc filter chrome | Prefer FilterBar | Residual boards/wizards exempt | 3.5 | PARTIAL |
| Ad-hoc pager | Prefer ListPagination | Cycle 3 closed cohort | 4 | PASS (cohort) |
| Explore skins vs SoT | Clear authority | Lab banners; multi-skin gallery residual | 3 | PARTIAL (R2) |
| Visual brand cohesion | Soft Ops only in product | Brand locked | 4 | PASS |

**Verdict L5:** Cohesion **directionally good**; residual **authority noise in Design Lab** and unmeasured snowflake LOC.

---

### L6 — Accessibility

| Param | Target | Evidence | Score | Status |
|-------|--------|----------|-------|--------|
| Semantic roles on composites | search, nav, toolbar, dialog | FilterBar, ListPagination, Bulk, CommandPalette, Toast live | 3.5 | PARTIAL |
| Keyboard / focus | WCAG 2.2 operable | Focus halo token; no automated axe gate | 2.5 | FAIL (no gate) |
| Contrast | Token contrast intentional | Soft ops brand+text designed | 3.5 | PARTIAL (unverified) |
| Assistive labeling | Labels on filters/tables | Combobox labels in tests | 3.5 | PARTIAL |
| Reduced motion | Honor media query | Documented, uneven enforcement | 3 | PARTIAL |

**Verdict L6:** **Components have a11y hooks; no product a11y CI**. Industry would flag this as mid-maturity risk for public/regulated UX; for internal staff ERP lower urgency but not zero.

---

### L7 — Content & UX ops (CMC-specific “smart”)

| Param | Target | Evidence | Score | Status |
|-------|--------|----------|-------|--------|
| Ops density | ControlBar sticky, compact rows | density=ops, STRUCTURE compact | 4 | PASS |
| Empty + next CTA | Actionable empties | Cockpit checkin fixed | 4 | PASS |
| Bulk **power** vs **chrome** | Domain multi-action or honest partial | Inventory partial; 7/8 clipboard | 3 | PARTIAL (honest) |
| Filter power | text/select/date; multi thin | date type exists; multi/range thin | 3 | PARTIAL |
| Table sort depth | Sortable columns | Component partial | 2.5 | PARTIAL |
| Status language | Soft badges default | StatusBadge soft | 4 | PASS |

**Verdict L7:** Smart ops chrome **real**; smart domain power **intentionally thin + labeled**. Do not inflate score.

---

### L8 — Documentation & discoverability

| Param | Target | Evidence | Score | Status |
|-------|--------|----------|-------|--------|
| Written SoT | Frames + grammar + structure | design-system/cmc-edu/* | 4.5 | PASS |
| Agent brief | llms.txt | packages/ui/llms.txt | 4.5 | PASS |
| Living inventory | Design Lab | `/design` inventory matrix | 4 | PASS |
| Inventory honesty | No oversell | Bulk partial after cycle 3c | 4 | PASS |
| Stale risk | Lab tracks product | Red-team panel rebased cycle 3 | 3.5 | PARTIAL (always drifts) |

**Verdict L8:** Unusually strong for solo+AI repo.

---

### L9 — Governance / enforceability

| Param | Target | Evidence | Score | Status |
|-------|--------|----------|-------|--------|
| Automated frame audit | CI strict | `check:ui-frames` dual-title + bulk | 4 | PASS |
| Depth matrix gate | FilterBar/pager/detail | Not in script | 2.5 | FAIL |
| Breaking change policy | Semver components | Informal monorepo | 2.5 | PARTIAL |
| Review checklist | Human/AI | PAGE-FRAMES rules | 3.5 | PARTIAL |

**Verdict L9:** **Best-in-class for dual-title/bulk**; incomplete for full grammar matrix.

---

### L10 — Outcomes (advanced / optional)

| Param | Target | Evidence | Score | Status |
|-------|--------|----------|-------|--------|
| Builder satisfaction | Survey | N/A solo AI | — | N/A |
| Time-to-screen | Before/after frames | Qualitative only | — | N/A |
| ROI | $ hours | Not tracked | — | N/A |
| Defect rate UI | dual-title regressions | Strict CI prevents one class | 3.5 | PARTIAL |

**Verdict L10:** Correctly **not instrumented**. Do not invent vanity ROI.

---

## Composite maturity radar

```text
L0 Foundations     ████████░░  4.3
L1–2 Components    ███████░░░  3.8
L3 Patterns        ████████░░  4.0
L4 Adoption        ███████░░░  3.5  (EntityHeader drag)
L5 Consistency     ███████░░░  3.7
L6 Accessibility   █████░░░░░  3.0
L7 Ops UX smart    ███████░░░  3.5
L8 Docs            █████████░  4.2
L9 Governance      ██████░░░░  3.3
L10 Outcomes       ██░░░░░░░░  N/A
─────────────────────────────
Weighted (admin)   ≈ 3.6 / 5
```

**Industry maturity stage label:**  
**“Productized internal design system — pattern OS phase”**  
(past component dump; not yet multi-product platform / a11y-certified / ROI-tracked)

---

## Adversarial findings (multi-scope, rebased)

| ID | Scope | Sev | Title | Evidence | Fix direction |
|----|-------|-----|-------|----------|---------------|
| MS-1 | L4 | High | EntityHeader under-adopted vs DetailPage | DetailPage 9 · EntityHeader 4 | Either adopt EntityHeader on remaining entity routes **or** document hybrid “settings Detail without entity” |
| MS-2 | L9 | High | Depth matrix not CI | Script only dual-title+bulk | Extend `check-ui-frames` optional counts: FilterBar≥N, ListPagination≥N (report; strict later) |
| MS-3 | L6 | High | No a11y automation | No axe in CI | Minimal: axe on shell+list+dialog smoke OR periodic manual keyboard pass doc |
| MS-4 | L3/H6 | Med | Detail recipe two-tier | receipt/opp full; class/student thinner | **Document tiers** full/standard/settings — do not force WorkflowStatusbar everywhere |
| MS-5 | L7 | Med | Bulk power partial | clipboard majority | Keep honesty; optional 1 domain bulk P2 |
| MS-6 | L5 | Med | Lab multi-skin noise | explore gallery | No new skins; optional collapse default |
| MS-7 | L4 | Med | LMS not on Soft Ops frames | Separate app | Defer unless product asks |
| MS-8 | L5 | Low | Unmeasured snowflakes | inline styles uncounted | One-shot snowflake audit script |
| MS-9 | L0 | Low | Motion/prefers-reduced uneven | MASTER vs CSS | Tokenize + utility if needed |

**Not issues (keep rejecting):** re-skin Odoo purple · OWL · generic Kanban · dark mode v1 · ROI vanity · “clipboard bulk = total fail”.

---

## Review checklist for future red-teams (copy-paste)

Use this **every** multi-scope design review. Score 1–5 + evidence path.

### Basic (must every cycle)

- [ ] **Tokens closed** — no new brand hex  
- [ ] **One page frame** per screen (or documented exempt)  
- [ ] **dual-title = 0** (`check-ui-frames --strict`)  
- [ ] **bulkListsOk** if list selection in scope  
- [ ] **Inventory honesty** matches product (partial vs ok)  
- [ ] **No second DS**  

### Intermediate (each depth cycle)

- [ ] **FilterBar** on new list filters (not ad-hoc)  
- [ ] **ListPagination** or exempt documented  
- [ ] **ControlBar** structure (header/filters/footer)  
- [ ] **Empty + CTA** on queues  
- [ ] **EntityHeader** if entity record page  
- [ ] **Detail tier** stated (full / standard / settings)  
- [ ] **Bulk action honesty** (clipboard vs domain)  

### Advanced (periodic / release)

- [ ] **A11y:** keyboard path list→filter→row→dialog; live regions toast  
- [ ] **Contrast** sample on canvas/brand  
- [ ] **Snowflake rate** trend  
- [ ] **Adoption deltas** frame counts period-over-period  
- [ ] **FormPage / SettingsShell** growth if new admin domains  
- [ ] **Multi-surface** LMS if in scope  
- [ ] **Governance:** new composite has test + lab demo + llms.txt line  

---

## Mapping industry metrics → CMC instrumentation

| Industry metric | CMC proxy (cheap) | CMC gap |
|-----------------|-------------------|---------|
| Adoption rate | Frame counts / pageCount | No Figma analytics |
| Component reuse | Import graph / includes() | No automated component heat map |
| Consistency | dual-title, FilterBar, snowflake grep | Partial |
| Accessibility | role/aria presence + future axe | No score |
| Documentation usage | Lab + llms.txt existence | No pageview analytics |
| Time savings | Qualitative cook speed | Unmeasured |
| Maintenance cost | premium.css size + lab bloat | Lab LOC risk |
| ROI | Skip | Appropriate for solo |

---

## Recommended next actions (only if continuing Soft Ops)

| Pri | Action | Scope | Effort |
|-----|--------|-------|--------|
| P1 | Document **detail tiers** in PAGE-FRAMES / VIEW-GRAMMAR | L3 L8 | S |
| P1 | Expand `check-ui-frames` **report** FilterBar + ListPagination counts (non-strict first) | L9 | S |
| P1 | EntityHeader gap list: which DetailPage lack EntityHeader & why | L4 | S |
| P2 | Optional axe smoke or keyboard checklist in work-def | L6 | M |
| P2 | One domain bulk (export) if product wants power score | L7 | M |
| P3 | Snowflake audit script | L5 | M |
| ❌ | Re-skin · dark mode · multi-brand tokens · ROI theater | — | — |

---

## One-line verdict

> Soft Ops is a **real, enforceable admin design OS** at foundations + list grammar; multi-scope red-team says **raise EntityHeader/detail honesty, CI depth matrix, and a11y baseline** before chasing advanced industry vanity metrics.

---

## Unresolved questions

1. Should **settings hybrid** pages (DetailPage + SettingsShell) count as “EntityHeader exempt” forever?  
2. Is **LMS Soft Ops alignment** in product roadmap or permanent split?  
3. Accept **clipboard bulk** long-term as ops utility, or commit one domain bulk per quarter?

## References

- [Supernova — 9 Design System Metrics](https://www.supernova.io/blog/9-design-system-metrics-that-matter)  
- [thedesignsystem.guide — Metrics collection](https://thedesignsystem.guide/design-system-metrics)  
- [Figma — Design systems 104: Making metrics matter](https://www.figma.com/blog/design-systems-104-making-metrics-matter/)  
- [Knapsack — Design system checklist / success metrics](https://www.knapsack.cloud/blog/all-you-need-for-your-design-system-checklist)  
- CMC: `design-system/cmc-edu/*`, `packages/ui/llms.txt`, `scripts/check-ui-frames.mjs`, lab red-team panel, cycle-3 note  
