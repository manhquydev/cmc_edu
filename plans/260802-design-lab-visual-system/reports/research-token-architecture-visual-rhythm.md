# Research: Design Token Architecture & Visual Rhythm (CMC EDU)

**Date:** 2026-08-02  
**Scope:** Spacing, type hierarchy, color roles, elevation, focus rings, status badge softness, motion  
**Stack under review:** `packages/ui` (`tokens.css`, `premium.css`, `astryx-theme-cmc.css`, StatusBadge)  
**Web sources (≤4):** Atlassian Spacing, Atlassian Elevation, Spectrum Design Tokens (Adobe), prior CMC lab reports + Astryx theme source  
**Method:** repo audit + enterprise design-system foundations + gap → ranked promotion plan  

---

## Executive Summary

Soft pass (2026-08-02) fixed the loudest “hard ERP” levers: control radius 12, card 16, warm hairlines, rest elevation, soft inputs. **Residual hardness is not brand or radius anymore** — it is **token incompleteness + magic-number drift**.

`tokens.css` declares a thin scale; `premium.css` invents ~30 off-scale sizes (7, 11, 12.5, 13.5, 20, 22, 26…). Status tokens are **solid ink only**; Astryx semantic badges render **filled saturated** chips → table rows feel loud. Focus/motion exist as one-offs, not named roles. Text neutrals are **cool Apple gray** on a **warm canvas** → subtle disconnect.

**Ranked choice:** **Promote a closed 4px/8px space+type role set + status soft surfaces + focus/duration tokens; wire StatusBadge to soft chips; stop inventing px in premium.** Do **not** change brand blue, Inter, warm canvas family, near-black metrics, or light-only constraint.

---

## Research Methodology

| Item | Detail |
|------|--------|
| Sources | Atlassian Design Spacing + Elevation (official), Spectrum tokens overview (Adobe), Astryx `neutralTheme.ts` badge rules, CMC TL12 + design-lab reports, live `tokens.css` / `premium.css` |
| Date range | Astryx badge design 2024–26 patterns; Atlassian foundations current; CMC soft pass 2026-08-02 |
| Search terms | enterprise spacing scale 8px, elevation surface shadow pairing, semantic status soft badges, focus ring tokens |
| Credibility | Official design systems > prior CMC lab evidence > component library internals |

---

## Current State Snapshot (as-built)

```css
/* Brand — LOCKED keep */
--cmc-brand: #0071e3; --cmc-brand-hover: #0055c6;
--cmc-brand-muted: #e8f1fc; --cmc-brand-ink: #003d99;

/* Canvas/surface — mostly good */
--cmc-canvas: #f5f3ee; --cmc-surface: #ffffff;
--cmc-surface-sunken: #ebe8e2; --cmc-border: #e4e2dc; --cmc-border-subtle: #efece6;

/* Gaps */
--cmc-space-1..4: 4 / 8 / 16 / 24;   /* missing 12, 20, 32, 40 */
--cmc-pad-card: 26px;                /* OFF 4px grid */
--cmc-fs-*: label 11 / body 14 / h3 18 / metric 34;  /* missing meta, page, data roles in premium */
--cmc-success/warning/danger: solid only;  /* no *-soft / *-ink pair */
/* no --cmc-focus-ring* ; no duration scale beyond 160ms */
```

Astryx Badge semantic variants = **filled T50 + white text** (`#198100`, `#ffce2f`, `#e33f4a`). Categorical variants already soft (pastel bg + colored text). CMC `StatusBadge` maps statuses → semantic variants → **loud chips**.

---

## Key Findings

### 1. Spacing scale consistency

**Industry (Atlassian):** 8px base; tokens 0/2/4/6/8/12/16/20/24/32/40/48/64/80. Small (0–8) for chip/icon gaps; medium (12–24) for component padding; large (32–80) for page rhythm. Proximity + similarity create hierarchy.

**CMC gap:**

| Issue | Evidence | Effect |
|-------|----------|--------|
| Incomplete scale | space only 4 steps | authors invent 7/11/13/20/22/26 |
| Off-grid pad-card | `26px` | cards never align with 24/32 section grid |
| Dual padding axes | pad-card token + literal `26px` horizontal | same card uses token + magic |
| Inconsistent card inset | panel head `16px 22px`, row `13px 22px`, page header `14px 20px` | “disconnected” card family |

**Trade-off:** Full Atlassian 14-step scale = more tokens to maintain. CMC solo ops → **8–10 step closed set** enough.

### 2. Type hierarchy (metric / label / body)

**Good locked rules:** metric near-black, tabular-nums, label uppercase 11/600 tracking 0.06em, body 14/lh 1.65.

**Gaps:**

| Role | Token today | Reality in CSS | Problem |
|------|-------------|----------------|---------|
| Metric | 34 | 34 | OK; rare optical 32 if grid tight |
| Page title | — | `.tpl-dash-title` **26** | orphan size |
| H3 / panel title | 18 / uses 14 for panel | panel title 14 ≠ fs-h3 | hierarchy muddy |
| Body | 14 | 14 | OK |
| Meta / secondary | — | **12.5**, **13**, **13.5** | three “almost body” sizes |
| Data cell | 13 | font-size-data | not used in premium rows |
| Label / column | 11 | fs-label + column | OK but brand-sub uses **10** |

Enterprise dashboards typically freeze **5–6 type roles**, not continuous px. Half-pixels (12.5, 13.5) read as accidental.

### 3. Color roles (surface / border / text / status)

**Spectrum/Atlassian pattern:** separate **roles** (text/bg/border/status) from raw hex; status has **fg + soft-bg** pairs for chips/banners.

**CMC strengths:** brand stack complete; canvas warm; border warm; one accent.

**Gaps that cause “hard” / “disconnected”:**

| Gap | Detail |
|-----|--------|
| Cool text on warm canvas | text `#1d1d1f` / muted `#6e6e73` (cool) vs canvas `#f5f3ee` (warm) |
| `surface-2` cool | `#f5f5f7` Apple cool gray still in palette |
| Chevron `#c7c7cc` | hardcoded cool; should be `text-faint` or warmer |
| Status solid only | success `#2e7d32` etc. — fine for **dots**, harsh for **badge fills** |
| Astryx muted not mapped | theme has `--color-success-muted` etc.; CMC overrides only solid |
| No border-strong for tables | only border / border-subtle |

### 4. Elevation layers

**Atlassian:** sunken → default → raised (+shadow) → overlay (+stronger shadow). Pair surface+shadow. Don’t raise everything.

**CMC now:** canvas (sunken-ish page), surface/raised white + shadow-sm rest, shadow-md hover, shadow-lg unused in most UI, toast uses md.

**Gaps:**

- No named **overlay** token (modal/dropdown) distinct from card hover  
- No z-index scale (page header z-10, toast z-60 — magic)  
- Flat tables vs raised cards OK; risk is **every** surface getting shadow-sm → noise (Atlassian: don’t raise for grouping alone)

### 5. Focus rings

**As-built:** field focus `0 0 0 3px brand-muted` + global `outline 2px brand / offset 2`. Works; **not tokenized**. Double treatment (box-shadow + outline) can double-ring some controls.

Need:

```css
--cmc-focus-ring: 0 0 0 3px var(--cmc-brand-muted);
--cmc-focus-outline: 2px solid var(--cmc-brand);
--cmc-focus-offset: 2px;
```

WCAG: ring must remain visible; brand-muted `#e8f1fc` alone is weak — keep **border brand + halo** (current field pattern is correct).

### 6. Status badge softness

**Root hardness:** semantic badges = filled green/yellow/red blocks in dense tables.

**Soft enterprise pattern (Linear/Notion/Polaris-adjacent):**

- Badge: pastel bg + saturated text (not white-on-solid)  
- Dot / icon: solid status color  
- Metric numbers: never status-tinted (already locked)

Astryx already documents categorical soft treatment; CMC should map StatusBadge to **soft chips** via tokens, not fight StyleX hash classes long-term.

### 7. Motion easing

**As-built:** `--cmc-ease: cubic-bezier(0.16, 1, 0.3, 1)` (decelerate / “out expo-ish”) + `160ms` — good for UI enter. Funnel width `520ms` hardcoded.

**Gaps:** no `duration-fast/base/slow`; no reduced-motion gate token usage; risk of animating layout properties beyond opacity/transform/shadow.

---

## Trade-off Matrix

| Option | Softness | Ops density | Maintenance | Adoption risk | Fit CMC |
|--------|----------|-------------|-------------|---------------|---------|
| **A. Token promotion (space/type/status/focus/motion)** | High | Kept | Low–med | Low (CSS vars) | **Best** |
| B. Full Atlassian/Primer token dump | High | May sparsen | High | Med (rename tax) | Overkill solo |
| C. Only CSS polish in premium (no new tokens) | Med short-term | OK | High drift | Low | Repeats magic-number debt |
| D. Swap font / brand / dark mode | Personality | Risk | High | High | Non-goal (locked) |
| E. Solid badges keep + only radius soft | Low residual | OK | Low | Low | Leaves loud chips |

**Ranking:** A ≫ C > E ≫ B > D  

---

## Gap → Concrete Promotion Plan

### Rank 1 — DO (high impact / low risk)

#### 1.1 Close spacing scale (4px grid)

```css
/* tokens.css — replace incomplete space-* */
--cmc-space-0: 0;
--cmc-space-1: 4px;
--cmc-space-2: 8px;
--cmc-space-3: 12px;   /* NEW — was missing; control internal */
--cmc-space-4: 16px;   /* was space-3 */
--cmc-space-5: 20px;   /* NEW — card horizontal common */
--cmc-space-6: 24px;   /* was space-4 */
--cmc-space-7: 32px;   /* NEW — section */
--cmc-space-8: 40px;   /* NEW — page top (optional) */

/* Semantic aliases (prefer these in premium) */
--cmc-pad-card: 24px;          /* was 26 — ON grid */
--cmc-pad-card-x: 20px;        /* NEW — horizontal card inset family */
--cmc-pad-row-y: 12px;         /* NEW */
--cmc-gap-section: 32px;       /* keep */
--cmc-gap-cluster: 16px;       /* NEW — related blocks */
--cmc-gap-inline: 8px;         /* NEW — icon+text */
```

**Migrate premium magic → aliases:**

| Old magic | New |
|-----------|-----|
| pad 26 / 26 | `pad-card` / `pad-card-x` |
| panel head `16px 22px` | `space-4` / `pad-card-x` |
| row `13px 22px` | `pad-row-y` / `pad-card-x` (± optical 12) |
| gaps 7, 10, 11, 13 | snap to 8 or 12 |

#### 1.2 Freeze type roles (6 roles max)

```css
--cmc-fs-label: 11px;       /* UPPERCASE chrome */
--cmc-fs-meta: 12px;        /* NEW — secondary, timestamps (kill 12.5) */
--cmc-fs-data: 13px;        /* align --cmc-font-size-data */
--cmc-fs-body: 14px;
--cmc-fs-title: 16px;       /* NEW — panel/section title (kill panel 14 vs h3 18 split) */
--cmc-fs-page: 24px;        /* NEW — page H1 (was 26 orphan) */
--cmc-fs-metric: 32px;      /* optional optical: 34→32 for denser ops; OR keep 34 */
--cmc-lh-body: 1.6;         /* 1.65→1.6 tighter ops; or keep 1.65 */
--cmc-lh-tight: 1.25;
--cmc-tracking-label: 0.06em;
--cmc-tracking-metric: -0.03em;
```

**Recommendation:** keep metric **34** (already signature); set page **24** not 26; meta **12** not 12.5/13.5.

#### 1.3 Status soft pairs (badge softness)

```css
/* Solid = dots, icons, text emphasis, toast border */
--cmc-success: #2f6f3e;          /* slightly softer than #2e7d32 optional */
--cmc-warning: #9a6700;          /* was #b26a00 — less harsh orange */
--cmc-danger: #b42318;           /* was #c62828 — Material-ish, less fire-engine */

/* Soft surfaces = badges, banners, row tags */
--cmc-success-soft: #e6f2e9;
--cmc-success-ink: #1b5e2a;
--cmc-warning-soft: #faf0db;
--cmc-warning-ink: #7a5200;
--cmc-danger-soft: #fce8e6;
--cmc-danger-ink: #8f1d14;
--cmc-neutral-soft: #f0eeea;     /* warm gray chip */
--cmc-neutral-ink: #5c5c62;
```

**StatusBadge promotion:** prefer soft chip CSS (or Astryx categorical / muted) over filled semantic:

```css
.cmc-status-badge--success {
  background: var(--cmc-success-soft);
  color: var(--cmc-success-ink);
  border-radius: var(--cmc-radius-pill);
  font-size: var(--cmc-fs-label);
  font-weight: 600;
  padding: 3px 9px; /* → space-1 / optical */
}
/* same for warning/danger/neutral */
```

Keep solid tokens for `.ck-attn` / `.ck-dot` / toast left border.

Map Astryx if possible:

```css
--color-success-muted: var(--cmc-success-soft);
--color-warning-muted: var(--cmc-warning-soft);
--color-error-muted: var(--cmc-danger-soft);
```

(Do not rely solely on Astryx filled semantic for StatusBadge.)

#### 1.4 Focus ring tokens

```css
--cmc-focus-halo: 0 0 0 3px var(--cmc-brand-muted);
--cmc-focus-outline-width: 2px;
--cmc-focus-outline-offset: 2px;
--cmc-focus-border: var(--cmc-brand);
```

Rule: **one** visible focus treatment per control class (field = border+halo; links/buttons = outline-offset). Avoid stacking both.

#### 1.5 Motion scale

```css
--cmc-ease: cubic-bezier(0.16, 1, 0.3, 1);     /* keep — enter/hover */
--cmc-ease-standard: cubic-bezier(0.2, 0, 0, 1);
--cmc-duration-fast: 120ms;
--cmc-duration-base: 160ms;   /* was transition 160 */
--cmc-duration-slow: 280ms;
--cmc-duration-emphasis: 480ms; /* funnel width; was 520 */
--cmc-transition: var(--cmc-duration-base) var(--cmc-ease);
```

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --cmc-duration-fast: 0ms;
    --cmc-duration-base: 0ms;
    --cmc-duration-slow: 0ms;
    --cmc-duration-emphasis: 0ms;
  }
}
```

### Rank 2 — DO (medium, cohesion)

#### 2.1 Elevation roles (named, not more shadows)

```css
/* Surfaces already mostly exist — alias roles */
--cmc-elev-sunken-bg: var(--cmc-surface-sunken);
--cmc-elev-default-bg: var(--cmc-canvas);
--cmc-elev-raised-bg: var(--cmc-surface-raised);
--cmc-elev-raised-shadow: var(--cmc-shadow-sm);
--cmc-elev-float-shadow: var(--cmc-shadow-md);   /* hover cards, menus */
--cmc-elev-overlay-shadow: var(--cmc-shadow-lg); /* modal, toast */

/* Optional warm-tinted tweak — keep current sm/md values; they are good */
--cmc-shadow-sm: 0 1px 3px rgba(28, 25, 20, 0.05), 0 1px 2px rgba(28, 25, 20, 0.04);
--cmc-shadow-md: 0 4px 14px rgba(28, 25, 20, 0.08);
--cmc-shadow-lg: 0 12px 32px rgba(28, 25, 20, 0.14);

--cmc-z-sticky: 10;
--cmc-z-dropdown: 40;
--cmc-z-toast: 60;
--cmc-z-modal: 70;
```

**Rule:** list/table default = border only, **no** shadow. Cards/panels = raised. Toast/dialog = overlay.

#### 2.2 Warm the cool outliers (subtle)

Do **not** recolor all text (brand-adjacent Apple gray is fine). Fix only disconnects:

```css
--cmc-surface-2: #f3f1ec;     /* was #f5f5f7 cool */
/* chevron: color: var(--cmc-text-faint); kill #c7c7cc */
```

Optional text warmth (±2 chroma) only if Design Lab A/B proves gain — default **skip** to avoid contrast regressions.

#### 2.3 TS `tokens` object + parity test

Extend `index.ts` `tokens.premium` + `tokens.color` for soft status, focus, duration, space-3..8. `tokens.test.ts` already guards parity — extend list.

### Rank 3 — DO NOT change

| Keep | Why |
|------|-----|
| Brand `#0071E3` + muted/ink/hover | Locked product identity |
| Inter / Inter Variable | Ops readability; font swap = personality tax, not cohesion |
| Light mode only | Spec locked; no dark half-system |
| Near-black metric values | Status never recolors numbers |
| Warm canvas `#f5f3ee` family | Soft ops signature |
| Control 12 / card 16 / page 20 radius | Nested harmony already correct |
| One accent (no second CTA orange) | TL12 |
| Monochrome LineIcon | Shell cohesion |
| Ops density (`tpl-wrap--ops`) | Product type = ERP not consumer landing |
| Astryx as primitive host | No second component stack |

### Rank 4 — Defer / avoid

- Full Spectrum/Atlassian token naming migration (`space.200` etc.)  
- Glassmorphism, grain, mesh gradients  
- Metric pastel backgrounds  
- Changing brand for “softer blue”  
- Storybook extraction (Design Lab `/design` is enough)  
- Dark mode  
- Rewriting every screen layout — token promote first  

---

## Architectural Fit

| Constraint | Fit of Option A |
|------------|-----------------|
| Solo + AI code | CSS vars + parity test = safe |
| `@cmc/ui` single door | All changes in tokens + premium + StatusBadge |
| Astryx theme map | Soft status via muted overrides + optional CSS chip |
| TL12 semantics | Soft chips still encode success/warn/danger |
| Ops density | 24px pad + 12 meta **tighten** hierarchy without sparse consumer UI |
| CI gates | tokens.test + component vitest; visual check `/design` |

**Adoption risk:** Low–medium. StatusBadge visual change is most user-visible; ship behind Design Lab review then promote. Space renumber (`space-3` meaning change 16→12) **is breaking** if any consumer used numbered space for 16px — prefer **additive** `space-3=12` only if typed API unused outside package; else add `space-150` style names without renumbering.

**Safer additive space API (recommended if external consumers):**

```css
/* keep old meanings */
--cmc-space-1: 4px;
--cmc-space-2: 8px;
--cmc-space-3: 16px;
--cmc-space-4: 24px;
/* add */
--cmc-space-1-5: 12px;
--cmc-space-2-5: 20px;
--cmc-space-5: 32px;
```

Prefer **semantic aliases** (`pad-card`, `gap-cluster`) over renumbering.

---

## Source Credibility Notes

| Source | Weight | Use |
|--------|--------|-----|
| Atlassian Spacing/Elevation | High (prod design system) | Scale structure, elevation pairing |
| Spectrum tokens | High | Token role separation concept |
| Astryx neutralTheme badge | High (actual dependency) | Why badges look hard; soft vs filled |
| CMC design-lab reports 2026-08-02 | High (local truth) | Soft pass residual |
| TL12 doc | Med — **stale** (still 4px radius, canvas `#F7F6F3`) | Intent only; code wins |

---

## Implementation Sequence (for implementer — not this research)

1. **tokens.css** — soft status, focus, duration, pad aliases, meta/page type, surface-2 warm  
2. **index.ts + tokens.test.ts** — parity  
3. **StatusBadge** — soft chip path (CSS class or variant map)  
4. **premium.css** — replace magic sizes with aliases; chevron color; funnel duration  
5. **astryx-theme-cmc.css** — focus vars; muted status map if exposed  
6. **Design Lab** — swatches for soft status + type roles  
7. **docs/12-design-system-ui.md** — sync radius/canvas/status soft (doc drift)  
8. Validate: `pnpm` ui package tests + eye on `/design` + cockpit + one list page  

Rollback: revert token block; StatusBadge map back to Astryx semantic.

---

## Acceptance Criteria (promotion done when)

- [ ] No new off-grid padding in `premium.css` (multiples of 4)  
- [ ] Type sizes only from role tokens (no 12.5 / 13.5)  
- [ ] StatusBadge soft bg + ink; dots still solid  
- [ ] Focus/duration named tokens used in theme + premium  
- [ ] pad-card on 4px grid (24)  
- [ ] TL12 doc matches tokens  
- [ ] tokens.test parity green  
- [ ] User no longer reports “cứng / rời” on cockpit + list after Design Lab review  

---

## Limitations

- No live browser contrast measurement on proposed soft hex (verify AA on soft-bg + ink before ship)  
- Did not audit every app page for hardcoded hex outside `packages/ui`  
- Astryx Badge StyleX may require CSS override specificity — spike in Design Lab first  
- Max 4 external doc fetches; Radix colors DNS failed — used Astryx + Atlassian instead  
- Product copy / empty-state / role workspace issues (prior product eval) **out of scope** — tokens won’t fix empty dashboards  

---

## Unresolved Questions

1. Metric stay **34** or optical **32** for denser KPI strips? (Recommend keep 34 unless 4-up grid clips.)  
2. StatusBadge: soft CSS wrapper vs fork Astryx categorical variants only?  
3. Soft status hex final values: design-lab A/B against real “approved / pending / rejected” Vietnamese labels.  
4. Is renumbering `--cmc-space-*` safe externally, or additive-only?  

---

## Recommendation (one line)

**Promote closed semantic spacing/type + status-soft pairs + focus/duration tokens; soft-chip StatusBadge; kill premium magic numbers. Do not touch brand, Inter, canvas warmth, radius family, or product density model.**

---

**Report path:** `plans/260802-design-lab-visual-system/reports/research-token-architecture-visual-rhythm.md`

Status: DONE  
Summary: Soft pass fixed radius/elevation; residual “hard/disconnected” = incomplete space/type roles, solid status badges, magic px, cool outliers, untokenized focus/motion. Ranked plan A with concrete CSS values.  
Concerns: Status soft hex need AA check; space token renumber may break external consumers — prefer semantic aliases.
