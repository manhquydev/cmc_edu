# Research: ERP/Admin Design Cohesion (2024–2026) → CMC Soft Ops

**Date:** 2026-08-02  
**Scope:** visual cohesion only (radius, elevation, borders, neutrals, density, page chrome, metrics, inbox)  
**Stack constraint:** Astryx + `@cmc/ui` tokens — **no** shadcn/Tailwind second system  
**Sources:** 4 primary (Atlassian Elevation, IBM Carbon Color, Shopify Polaris Color, CMC as-built) + prior design-lab cohesion audit  

---

## Executive summary

CMC soft pass (control 12 / card 16 / large 20, warm canvas `#f5f3ee`, whisper shadows) is **already aligned** with 2024–26 enterprise “soft ops” direction. Biggest remaining cohesion leaks are **not** radius — they are:

1. **Cool gray leftovers** (`--cmc-surface-2: #f5f5f7`, `--cmc-text-faint: #aeaeb2`) mixed into warm family  
2. **Elevation applied uniformly** (every card = raised+shadow) → noise; industry pairs surface+shadow by *role*  
3. **Density drift** toward consumer sparsity (`pad-card 26`, `gap-section 32`, metric `34px`) while product is ops ERP  
4. **Chrome inconsistency** — FilterBar/MasterDetail still cool surface-2; page header sticky competes with cards  

**Ranked path:** promote small token deltas + composition rules **today** — do **not** adopt design-lab Softer 18/22 radii.

---

## Methodology

| # | Source | Credibility | Used for |
|---|--------|-------------|----------|
| 1 | [Atlassian Design — Elevation](https://atlassian.design/foundations/elevation) | Official enterprise DS | sunken/default/raised/overlay pairing; don’t overuse raised |
| 2 | [IBM Carbon — Color](https://carbondesignsystem.com/elements/color/overview/) | Official enterprise DS | layering model; neutrals organize zones; one action blue |
| 3 | [Shopify Polaris — Color](https://polaris-react.shopify.com/design/colors) | Official merchant admin DS | monochrome base; color = meaning not decoration |
| 4 | CMC `tokens.css` / `premium.css` / cohesion audit | As-built product | fit + residual cool leaks |

Search budget: 4 web fetches + repo audit (≤5). No Gemini.

---

## Key findings (industry consensus)

### 1. Elevation is a *system*, not a card decoration

**Atlassian:** four levels — sunken → default → raised → overlay. Raised/overlay **must** pair surface + shadow. Default cards often = **flat + border only**. Raised reserved for movable/emphasized content. Hover prefers **surface tint** over stacking more shadows.

**CMC gap:** MetricCard, Panel, PageHeader, ShortcutChip all use `shadow-sm` at rest → everything floats equally → less hierarchy.

### 2. Neutrals must share one temperature

**Carbon:** light themes layer White ↔ Gray-10; midtones break the model.  
**Polaris:** admin is intentionally near-monochrome so brand/status pop.

**CMC gap:** canvas/borders warm; `--cmc-surface-2` + `--cmc-text-faint` still **cool Apple grays** → “mixed toolkits” feel on FilterBar/MasterDetail.

### 3. Radius hierarchy = nested harmony, not max softness

Industry rule (M3 shape, Atlassian containers, CMC cohesion audit):

```text
control ≤ card ≤ dialog/page
outer_r ≥ inner_r   (prefer outer ≈ inner + 4)
```

**12 / 16 / 20 already correct** for soft ops. Design-lab Softer (18/22) reads consumer SaaS, wastes ops density, forces more nested-radius bugs.

### 4. Soft ops density ≠ consumer sparsity

Enterprise admins (Carbon, Polaris, Jira): tighter rows, compact headers, metrics secondary to **work lists**. Consumer SaaS (Linear marketing, Notion home): large metrics, 32–48px section gaps.

CMC should stay **soft-but-dense**: friendly radius + warm paper, **not** landing-page whitespace.

### 5. Color purpose (Polaris)

- One interactive blue (CMC `#0071E3` ✓)  
- Status for state only  
- Metrics near-black; status = small dot/badge, not rainbow fills  
- Don’t decorate cards with brand wash at rest (hover accent-soft OK if subtle)

---

## Trade-off matrix

| Option | Professional cohesion | Ops density | Change cost | Risk | Rank |
|--------|----------------------|-------------|-------------|------|------|
| **A. Token deltas + composition rules** (this report) | High | Keeps | Low (CSS vars + few class tweaks) | Low | **1 — do now** |
| B. Promote design-lab Softer (18/22, pad+) | Softer but consumer | Worse | Medium | Medium (nested radius, table clash) | 3 |
| C. Carbon-hard (4px radius, cool gray, flat) | Consistent but “thô” again | Best density | High reverse | High brand regress | 4 |
| D. Full second DS (shadcn/Tailwind) | High if rebuilt | TBD | Very high | Stack split — forbidden | Reject |

---

## Architectural fit

| Constraint | Fit of Option A |
|------------|-----------------|
| Astryx + CSS tokens only | Maps 1:1 to `tokens.css` + `astryx-theme-cmc.css` + `premium.css` |
| Brand `#0071E3`, Inter, warm canvas | Preserved; only temperature-align neutrals |
| Soft pass already shipped | Incremental; no redesign |
| Solo + AI codegen | Rules are enforceable via tokens; composition rules → design-lab checklist |

**Adoption risk:** Low. Token renames for aliases only; hex swaps on rarely-themed surfaces. Watch FilterBar/MasterDetail visual after `--cmc-surface-2` rewarm.

---

## Concrete recommendations (apply TODAY)

### A. `tokens.css` — token deltas

```css
/* === 1. Warm the cool leftovers (family temperature) === */
/* was #f5f5f7 — Apple cool gray used by FilterBar/MasterDetail */
--cmc-surface-2: #f0ede7;

/* was #aeaeb2 — cool silver; icons/meta should match warm muted */
--cmc-text-faint: #a39e96;

/* optional clarity: keep subtle for hairlines on white, slightly stronger for control shells */
--cmc-border-subtle: #efece6;           /* unchanged — hairline on raised */
--cmc-border: #e0ddd5;                  /* was #e4e2dc — +1 step for fields/dividers */
/* add if useful for tables/emphasized chrome only: */
--cmc-border-strong: #d4d0c6;

/* === 2. Elevation ladder (Atlassian pairing) — rest quieter, float clearer === */
/* rest cards: whisper only */
--cmc-shadow-sm: 0 1px 2px rgba(28, 25, 20, 0.045), 0 1px 3px rgba(28, 25, 20, 0.035);
/* hover / elevated chrome */
--cmc-shadow-md: 0 4px 12px rgba(28, 25, 20, 0.08), 0 1px 2px rgba(28, 25, 20, 0.04);
/* dialog / toast / popover */
--cmc-shadow-lg: 0 12px 32px rgba(28, 25, 20, 0.14), 0 2px 6px rgba(28, 25, 20, 0.06);

/* optional extra step for true flat→raised intermediate */
--cmc-shadow-xs: 0 1px 2px rgba(28, 25, 20, 0.035);

/* === 3. Radius — KEEP scale; add semantic aliases only === */
--cmc-radius-xs: 12px;
--cmc-radius-control: 12px;
--cmc-radius-md: 16px;
--cmc-radius-card: 16px;     /* alias → md */
--cmc-radius-lg: 20px;
--cmc-radius-dialog: 20px;   /* alias → lg; AlertDialog / drawers */
/* DO NOT: 18 / 22 from design-lab Softer as default */

/* === 4. Soft-ops density (not consumer SaaS) === */
--cmc-pad-card: 22px;        /* was 26 — still soft, less “marketing tile” */
--cmc-gap-section: 24px;     /* was 32 — cockpit breathes less emptily */
--cmc-fs-metric: 30px;       /* was 34 — ops dashboard, not hero KPI */
--cmc-fs-label: 11px;        /* keep */
--cmc-fs-body: 14px;         /* keep */
--cmc-lh-body: 1.55;         /* was 1.65 — slightly denser body in panels */

/* === 5. Surfaces (role clarity) === */
--cmc-canvas: #f5f3ee;           /* keep warm paper */
--cmc-surface-raised: #ffffff;   /* cards, panels, headers */
--cmc-surface-sunken: #ebe8e2;   /* fields, wells, track backgrounds */
--cmc-hover: #e8e6e1;            /* keep */
```

### B. Composition rules (enforce in `premium.css` + design-lab)

| # | Rule | Concrete |
|---|------|----------|
| R1 | **Radius nest** | `control 12 ≤ card 16 ≤ dialog 20`. Nested chip/control inside card: use control radius, never lg. |
| R2 | **Elevation by role** | **Raised content** (MetricCard, Panel, WorkInbox shell): `bg raised + border-subtle 1px + shadow-sm`. **Default ops chrome** (FilterBar, table wrapper, master list): `bg surface-2/sunken + border only, shadow: none`. **Overlay** (toast, dialog, popover): `shadow-lg` (+ optional border-subtle). |
| R3 | **Hover** | Prefer **surface/border** change (sunken row, accent-soft border) over always jumping sm→md shadow. MetricCard may keep sm→md; rows must not elevate. |
| R4 | **One border temperature** | Never `#d4d4d4` / cool gray. Hairline = `border-subtle`; field edge = `border`; strong chrome = `border-strong` only. |
| R5 | **Page header** | Soft card OK, but sticky: either (a) keep card with `shadow-sm` **or** (b) when stuck, use `border-bottom: 1px solid border-subtle` + drop side/top border competition. Avoid full-bleed slab. |
| R6 | **Metric card anatomy** | Label 11px uppercase muted + 0.06em tracking; value 30px/600 tabular −0.03em near-black; context 13px muted; status = **6–7px dot** not colored fill; icon faint. Hover: brand on ctx text only. |
| R7 | **Work inbox** | Section label: 11px uppercase muted; section dividers hairline; rows 12–13px pad-y; sunken hover; tags pill + brand-muted; no per-row shadow. |
| R8 | **Controls in cards** | Field = sunken fill + control radius + warm border; focus = brand border + `0 0 0 3px brand-muted`. Never white field on white card without border. |
| R9 | **Color restraint** | Brand only: primary CTA, links, focus, active nav. Status colors only for state. No multi-color metric fills. |
| R10 | **Density budget** | Page pad ~28×32 OK; section gap 24; card pad 20–22; row 12–13. If gap > 32 everywhere → consumer drift. |

### C. `premium.css` deltas (minimal)

```css
/* Page header: less competition with metric grid — whisper only */
.ck-page-header {
  box-shadow: var(--cmc-shadow-xs, var(--cmc-shadow-sm));
  /* keep border + radius-md */
}

/* Filter / ops chrome pattern (when classes exist): NO rest shadow */
/* .ck-filter-bar, .ck-table-shell {
  background: var(--cmc-surface-2);
  border: 1px solid var(--cmc-border-subtle);
  box-shadow: none;
  border-radius: var(--cmc-radius-md);
} */

/* Metric: use pad token */
.ck-mc { padding: var(--cmc-pad-card); }

/* Funnel link nest: control radius not magic 8 */
.ck-fn-link { border-radius: var(--cmc-radius-control); }

/* Toast = overlay family */
.ck-toast {
  border-radius: var(--cmc-radius-dialog, var(--cmc-radius-lg));
  box-shadow: var(--cmc-shadow-lg);
}
```

### D. Component callouts (FilterBar / MasterDetail)

```tsx
// filter-bar.tsx / master-detail.tsx — after surface-2 rewarm, prefer tokens:
background: 'var(--cmc-surface-2)'     // now warm #f0ede7
borderBottom: '1px solid var(--cmc-border-subtle)'  // was border — softer hairline OK for chrome
// do NOT add boxShadow
```

### E. Design-lab checklist (do not promote Softer defaults)

| Lever | Lab Softer | **Promote?** |
|-------|------------|--------------|
| Radius 18/22 | experiment | **No** — keep 12/16/20 |
| Canvas warmer | same `#f5f3ee` | already |
| Whisper rest shadow | yes | **Yes** (already) + quieter sm values |
| Input sunken 12 | yes | **Yes** (already) |
| surface-2 rewarm | not explicit | **Yes — do** |
| metric 34→30 | not explicit | **Yes — do** |
| pad-card 26→22 | opposite of Softer | **Yes — ops** |

---

## Page patterns (quick recipes)

### Page header
```
[ sticky soft card 16r | pad 14×20 | hairline | shadow-xs ]
  title 18/600 −0.01em | actions: secondary control 12r + primary pill CTA
```

### Metric strip
```
grid gap 16 | each: raised 16r + hairline + shadow-sm | pad 22
label / value 30 / ctx+dot — no brand wash at rest
```

### Work inbox panel
```
raised shell 16r + hairline + shadow-sm
  head 16×22 + hairline bottom
  section-label 11 upper muted
  rows hairline + sunken hover
  empty: centered faint icon, no illustration chrome
```

### Layer stack (Carbon + Atlassian mapped to CMC)
```
canvas #f5f3ee          → page well
surface-2 #f0ede7       → filter/table chrome (flat)
raised #fff + sm shadow → cards/panels/inbox
overlay + lg shadow     → dialog/toast
sunken #ebe8e2          → fields, progress tracks, row hover
```

---

## What NOT to do

- Second design system (shadcn/Tailwind)  
- Glassmorphism on ERP chrome  
- Rainbow metric accents  
- Cool gray midtones (`#f5f5f7`, `#d2d2d7`) next to warm canvas  
- Raising every surface (visual noise — Atlassian)  
- Consumer sparsity (gap 40+, metric 40px+) on ops screens  
- Hard 2px inset field hover (already killed — keep dead)

---

## Ranked implementation order (1 PR worth)

1. **tokens.css** — surface-2, text-faint, shadow ladder, pad-card, gap-section, fs-metric, radius aliases  
2. **premium.css** — page-header shadow-xs, toast dialog radius/lg shadow, metric pad token, fn-link radius token  
3. **FilterBar / MasterDetail** — confirm surface-2 + no shadow (token swap may be enough)  
4. **design-lab** — document composition rules R1–R10 as living checklist; mark Softer radii as **reject**  

---

## Limitations

- No live eye-check of post-delta screenshots in this research pass  
- Material 3 elevation URL returned empty; relied on Atlassian + Carbon as primary enterprise sources  
- Did not audit every Astryx StyleX hash for residual cool borders (theme overrides should cover; verify in lab)  
- Dark mode out of scope  
- Did not re-benchmark against Linear internal app (closed source; pattern inferred via industry blogs only — not cited as authority)

---

## Unresolved

1. Sticky page-header: keep floating card vs border-only when stuck? (product taste — lab A/B)  
2. Metric 30 vs 28 for very dense finance dashboards?  
3. Should `--cmc-surface-2` alias to sunken (`#ebe8e2`) fully, or stay one step lighter (`#f0ede7`)? Recommend lighter for filter chrome contrast.

---

## Sources (brief)

1. Atlassian Design — Elevation (surface/shadow pairing, raised restraint)  
2. IBM Carbon — Color layering (neutral zones, one action blue)  
3. Shopify Polaris — Color purpose (monochrome admin, color = meaning)  
4. CMC cohesion audit `component-cohesion-soft-inputs.md` + `tokens.css` as-built  

**Recommendation:** Option A — ship token temperature + elevation ladder + density tighten; keep radius 12/16/20; reject Softer radius promote.
