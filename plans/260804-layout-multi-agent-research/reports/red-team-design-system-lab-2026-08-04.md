# Red team — CMC design system as presented on `/design`

**Date:** 2026-08-04  
**Scope:** Design Lab presentation + design-system laws vs production reality  
**Mode:** Adversarial review (find failure modes, not celebrate)

## Executive scorecard

| Dimension | Score /5 | Verdict |
|-----------|----------|---------|
| Token / visual cohesion (in code) | 4 | Strong closed palette + radius ladder |
| Frame grammar (in docs) | 4 | Clear 4-archetype OS |
| Frame adoption (in product) | 3 | ~43/55 pages touch frames; uneven depth |
| Lab honesty / inventory truth | **2** | Stale claims, over-green inventory |
| Lab usability as decision tool | **2** | Overloaded; exploration ≠ authority |
| Enforceability | **2** | Laws without lint/CI gates |
| Style gallery risk | **2** | Undermines LOCKED brand if misread |
| Overall system as *presented* | **2.5** | Docs+lab sell certainty the product has not fully earned |

---

## Critical findings

### R1 — Inventory lies about ⌘K (HIGH · evidence)

**Claim on lab:** Inventory row `Command palette · ⌘K` = **miss**.  
**Reality:** `CommandPalette` wired in `apps/admin/src/shell/shell.tsx` + demo section `#cmdk` on same page.

**Impact:** Stakeholders treat inventory as SoT → false backlog / false confidence elsewhere (if other rows also stale).

**Fix:** Re-audit inventory against code; mark ⌘K ok; date-stamp every status.

---

### R2 — Lab confuses “exploration” with “authority” (HIGH · structural)

`/design` now stacks:

- Layout OS (locked laws)
- Wireframes (canonical frames)
- **13 alternate skins** (carbon, ant, airbnb, night…)
- Xia sources (steal/skip)
- Full component inventory

**Problem:** MASTER says brand/radius **LOCKED**, while Style gallery invites “pick a better language than Soft Ops.” Without a hard banner *Exploration only — production remains Soft Ops until pilot*, decision-makers will:

1. pick Carbon density + Airbnb warmth + Soft radius (incoherent), or  
2. freeze forever comparing skins.

**Fix:** Split routes or modes: `/design` = **authority**; `/design/explore` = skins. Default collapsed “locked” strip.

---

### R3 — Style mocks are not the design system (HIGH · fidelity)

Skin gallery uses **hand-built CSS mocks**, not `@cmc/ui` composites. Wireframes are dashed boxes.  
**Impact:** Approving a skin does **not** prove MetricCard/ControlBar/DataTable can express it. Classic “looks good in mock, fails in product.”

**Fix:** For any chosen skin, pilot **real** ListPage + DetailPage + DashboardPage before token rewrite.

---

### R4 — Design Lab bloat threatens the product (MED–HIGH · maintainability)

~**5k LOC TS** + **~4k CSS** in design-lab* alone vs ~15k LOC other admin pages.  
**Impact:** Lab becomes a second product; bitrot; agents copy lab patterns that never ship.

**Fix:** Cap lab growth; archive exploration CSS; no new skins without deleting one.

---

### R5 — Laws without enforcement (HIGH · process)

21 layout laws + checklist exist only as markdown/UI text. No ESLint rule, no CI “must use ListPage,” no `rg` gate in CI for dual `h1`.

**Impact:** Solo+AI will re-invent layouts under deadline; lab becomes aspirational fiction.

**Fix:** Minimal gates: ban page-local full layout wrappers; forbid `PageHeader title` when `EntityHeader` present (lint heuristic); snapshot 3 golden pages.

---

### R6 — Over-green inventory (MED · honesty)

Almost every area = **ok**. Only partial = table sort/select, filter multi. Charts miss (YAGNI). ⌘K wrongly miss.

Missing honesty rows:

- Bulk selection **rollout** (component ok, product partial)
- SettingsShell **adoption** (shift-config only-ish)
- Mobile admin shell
- Dark mode
- Filter multi-select / date range product coverage
- Real kanban
- LMS visual parity with admin tokens

**Fix:** Inventory columns: **component exists** | **≥3 product screens** | **tested**.

---

### R7 — Dual systems of truth (MED · docs)

| Surface | Claims |
|---------|--------|
| `design-system/cmc-edu/*` | Locked soft-ops |
| `packages/ui/llms.txt` | Living inventory = `/design` |
| Style gallery | Soft-ops is just one of 13 |
| Research reports under `plans/` | Many dates, overlapping scores |

Agents reading all four will **oscillate**.

**Fix:** One sentence in MASTER + llms.txt: “Production SoT = tokens + PAGE-FRAMES. Lab explore ≠ production.”

---

### R8 — Incomplete frame coverage sold as complete (MED)

Inventory: Page frames **ok**.  
Count: many pages import frames, but **depth varies** (Detail without summary/workflow; List without ControlBar footer; Form without FormPage).

Settings: SettingsShell exists; VIEW-GRAMMAR allows FormPage **or** SettingsShell — agents pick inconsistently.

**Fix:** Adoption matrix table on lab (per module: frame used Y/N + depth score).

---

### R9 — Accessibility & content not red-teamed on lab (MED)

Lab shows color swatches and soft badges; little on:

- contrast of soft status chips on warm canvas  
- focus order in ControlBar sticky + table  
- reduced motion  
- Vietnamese label completeness  
- touch 44 on attendance vs compact ops conflict  

**Fix:** Add a11y checklist section with measured contrast samples.

---

### R10 — Style exploration creates brand debt (MED)

AirBNB coral, Ant blue, Shopify green, Cal orange all demos.  
**Risk:** Marketing/stakeholder “I like the orange one” → pressure to abandon one-blue law without product cost model.

**Fix:** Require any brand change to list: LMS parent app, print receipts, status semantics, dark, email templates.

---

### R11 — Research theater risk (LOW–MED)

5-agent synthesis is good, but mostly **re-states** PAGE-FRAMES already in repo. Limited new empirical measurement of live pages.

**Fix:** Next research = **measured** dual-title count, pages without ListPage, filter outside ControlBar.

---

### R12 — FilterBar date claim inconsistency (LOW–MED)

llms.txt: FilterBar types include `date`.  
Inventory partial: “text+select only” for date multi.  
Ambiguous whether `date` type exists but unused, or missing.

**Fix:** One line truth in inventory from source code of FilterBar.

---

## What is *not* a problem (reject false alarms)

| Concern | Why rejected |
|---------|----------------|
| “No Tailwind/shadcn” | Intentional; STYLING-BRIDGE exists |
| “Only 4 frames is rigid” | Correct for solo+AI ERP; flexibility is slots |
| Soft warm canvas “unprofessional” | Product choice; not defect |
| Missing BI charts | Explicit YAGNI |

---

## Attack scenarios

1. **Agent onboarding from lab only** → ships Carbon-density page with radius 0 inside soft-ops app.  
2. **Stakeholder skin vote** → token rewrite without real component pilot → half-migrated app.  
3. **Inventory-driven planning** → builds second ⌘K because row says miss.  
4. **No lint** → new finance page skips ListPage, invents local toolbar.  
5. **Lab LOC grows** → CI/typecheck still green, product design stagnates.

---

## Priority remediation

| P | Action | Owner signal |
|---|--------|--------------|
| P0 | Fix inventory ⌘K + date stamp | design-lab inventory |
| P0 | Banner: Explore skins ≠ production SoT | styles + layout OS |
| P1 | Split or collapse explore vs authority | routing/IA |
| P1 | Adoption matrix (real pages) | lab section |
| P1 | One ESLint/CI check for frame usage or dual title | tooling |
| P2 | Cap design-lab LOC; archive skins | process |
| P2 | Pilot only after skin pick: 1 cockpit + 1 list + 1 detail | product |
| P3 | A11y contrast section | lab |

---

## Bottom line

The **underlying design system** (tokens, 4 frames, ControlBar, Detail recipe) is **coherent and appropriate** for a facility ERP.  

The **presentation on Design Lab** currently **overstates completeness**, **mixes exploration with law**, and **lacks enforcement** — that is the real risk. Fix honesty + gates before more skins or more research theater.

**Red-team verdict:** CONDITIONAL PASS on system design; **FAIL** on lab-as-SoT until P0/P1 remediated.
