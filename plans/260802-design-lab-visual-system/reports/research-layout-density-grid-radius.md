# Research: Layout Density, Grid, Nested Radius (CMC Ops UI)

**Date:** 2026-08-04  
**Scope:** density tiers, nested radius, keyline alignment, elevation by layer, magic-px failure modes  
**Authority (repo):** `packages/ui/src/tokens.css`, `design-system/cmc-edu/MASTER.md`, `STRUCTURE.md`  
**External (reason only — no new CMC tokens):** IBM Carbon spacing + density culture; Ant Design size/density culture  
**Method:** token audit + prior design-lab cohesion reports + enterprise density norms mapped onto **existing** CMC vars  

---

## Executive summary

CMC already has a closed soft-ops layout system. Agents should **consume** it, not invent tiers.

**Ranked choice:** keep **3 density tiers** on current tokens (comfortable / default / ops compact). Do **not** adopt Carbon condensed (~32px row) or Ant small control (~24px) as product defaults — those fight soft radius 12/16/20 and tablet teaching flows. Touch stays a **target floor** (≥44), not a fourth visual density.

---

## 1. Density tiers (px targets from existing tokens)

Industry context (credibility: official systems):

| System | Default row culture | Compact culture | Notes for CMC |
|--------|---------------------|-----------------|---------------|
| IBM Carbon | ~48 table/data rows; 8px spacing base | compact/condensed much tighter (~32 class) | Density via **mode**, not random pad |
| Ant Design | middle size (~default table ~47–54 historical) | small/compact ~39-class rows | Size prop, not ad-hoc px |
| CMC (locked) | `--cmc-row-h: 48` | `--cmc-row-h-compact: 40` | Soft ops: softer than Carbon hard compact |

### Recommended CMC tiers

| Tier | Context | Row h | Vertical pad (row/cell) | Cluster gap | Section gap | Card pad | Chip / CTA |
|------|---------|-------|-------------------------|-------------|-------------|----------|------------|
| **Comfortable** | cockpit, empty panels, marketing empty | 48 (`row-h`) | ~12–16 (`space-3` or half-card feel via section rhythm) | 16 (`gap-cluster`) | 24 (`gap-section`) | 24 (`pad-card`) | chip 22 / cta 34 |
| **Default** | detail, forms, month cards, panel body | 48 (`row-h`) | ~10–12 (head strip still `head-h` 48) | 16 | 24 | 24 pad; **x = 20** keyline | chip 22 / cta 34 |
| **Ops compact** | ListPage/DataTable, filter strip, week cells, grading queue | **40** (`row-h-compact`) | **8** (`space-2`) top/bottom | 8–16 (filters: `space-2`–`space-3`) | 16–24 | shell still raised recipe; **inner cell pad tight** | chip-sm 18 / cta-sm 28 |

**Touch (orthogonal):** min hit area **44×44** (attendance/punch). May use default row geometry + larger hit padding — **not** a radius/elevation rewrite.

**Adoption risk:** adding a third height token (e.g. 32) without product demand → table/button desync. YAGNI: two heights only.

---

## 2. Nested radius harmony rule

**Locked ladder (tokens):**

```text
control / xs  12  →  inputs, buttons, nav items, chips-in-card
card / md     16  →  Metric, Panel, Table shell, PageHeader surface
dialog / lg   20  →  modal, toast, large float shells
pill        9999  →  primary shell CTA only
```

**Harmony rule:** `r_inner ≤ r_outer` always.  
Concrete: field 12 inside card 16; card 16 inside dialog 20.  
**Never** 4–8px controls inside 16 cards (boxy “mixed toolkit”).  
**Never** 20px chips on 12px inputs (onion invert).  
Flush children of a raised shell: inherit outer edge; inner cells use **0 radius** + hairline dividers (density > fake round cells).

---

## 3. Keyline horizontal alignment

**Single horizontal inset:** `--cmc-keyline-x` ≡ `--cmc-pad-card-x` = **20px**.

```text
┌─ keyline-x (20) ─────────────────────────────┐
│ HEAD  min head-h 48 · title · actions        │
├──────────────────────────────────────────────┤
│ BODY  rows / fields (same x)                 │
├──────────────────────────────────────────────┤
│ FOOT  pagination / CTA (same x)              │
└──────────────────────────────────────────────┘
```

Rules:

1. Header title left edge = first body text left edge = footer primary left edge.  
2. Sticky PageHeader, FilterBar, table head, row cells share keyline-x.  
3. Status rail (`rail-w` 3) is **inside** keyline, not a second page margin.  
4. SideNav width (248) and content keyline are independent; do not “optically” invent 22/18 to match nav.

Trade-off: 20 is off pure 8px grid (Carbon-style 16/24). Accepted for soft-ops readable density; do **not** replace with magic 18/22 per composite (prior cohesion debt).

---

## 4. Elevation roles by layout layer

| Layer | Token | Surface | Shadow role |
|-------|-------|---------|-------------|
| Page canvas | `--cmc-canvas` | warm paper | none |
| Sticky chrome (PageHeader, quiet raised) | raised + quiet | white + hairline | **`shadow-xs`** |
| Raised content at rest (Metric, Panel, Table shell) | `--cmc-raised-*` | white + subtle border | **`shadow-sm`** |
| Hover / float chrome (metric hover, sticky form bar) | raised | same | **`shadow-md`** |
| Modal / toast / confirm | float family | raised + `radius-lg` | **`shadow-lg`** |
| Topbar | glass | blur `--cmc-blur-nav` | blur **not** heavy shadow |
| List rows | sunken hover only | no card chrome | **never** cast shadow |

Elevation encodes **layer**, not importance. Status never = deeper shadow.

---

## 5. What breaks cohesion when agents invent magic px

| Invention | Failure mode |
|-----------|--------------|
| `padding: 13px 22px` | keyline drift; heads/rows no longer stack as one family |
| `border-radius: 8` or `18` | nested harmony breaks; soft-ops reads “mixed toolkit” |
| `height: 36` / `44` rows | desync with `row-h` / compact; zebra + selection jump |
| Cool gray `#f5f5f7` pad blocks | temperature clash on warm canvas |
| Extra card around table + filter | double chrome + wasted density |
| Per-page section gap 32/40 “for premium” | consumer sparsity; cockpit ≠ ops list |
| Shadow on every row/card | elevation inflation; modals stop reading as above |

Root cause: incomplete mental model of **roles**. Tokens already name roles; magic px creates a second unofficial system.

---

## 6. Seven layout-token rules for CMC

1. **Closed space set only:** `space-1…4` (4/8/16/24) + named pads/gaps (`pad-card`, `pad-card-x`, `gap-cluster`, `gap-section`). No 7/11/13/18/22/26.  
2. **One keyline-x (20)** for head/body/foot of every composite.  
3. **Two row heights only:** 48 default · 40 ops compact. Touch = hit target ≥44, not a third row token.  
4. **Nested radius:** 12 ≤ 16 ≤ 20; inner ≤ outer; flush table cells radius 0.  
5. **One raised recipe** (`--cmc-raised-*`) for all peer cards; quiet = xs; float = lg radius + md/lg shadow.  
6. **Density is a mode, not a style fork:** `.tpl-wrap--compact` / `DataTable density="compact"` remaps row/chip/cta heights — not colors/radius/shadow.  
7. **No shadow on rows; no status-as-elevation; no consumer section gaps on list ops.**

---

## Trade-off matrix

| Option | Ops scan speed | Soft brand fit | Impl cost | Abandon/drift risk | Rank |
|--------|----------------|----------------|-----------|--------------------|------|
| **A. Current 48/40 + keyline 20 + 12/16/20** | High | High | Low (enforce) | Low if lint/docs hold | **1** |
| B. Carbon-hard compact (~32 row, 4px radius) | Highest | Low (thô) | High reverse | Medium brand regress | 3 |
| C. Consumer comfortable everywhere (pad+) | Low | Soft but sparse | Medium | High agent drift | 4 |
| D. Add full 14-step spacing like Carbon | Medium | OK | High maint (solo) | Token sprawl | 2 only if premium.css still bleeds magic |

**Recommendation:** **A** — enforce, don’t expand.

---

## Architectural fit

- Stack: Astryx + `@cmc/ui` composites; no Tailwind/shadcn.  
- Solo + AI codegen ⇒ **named roles > scales agents “almost remember.”**  
- Admin = data-dense; LMS mobile = comfortable + touch. Same tokens, different tier.  
- Prior lab already rejected Softer radius 18/22 and cool-gray chrome.

---

## Sources & credibility

1. `packages/ui/src/tokens.css` — **authoritative** as-built values  
2. `design-system/cmc-edu/MASTER.md`, `STRUCTURE.md` — locked product rules  
3. IBM Carbon Spacing overview — official enterprise spacing culture (2/4/8 multiples)  
4. Ant Design size/density culture — mode-based compact vs default (industry parallel)  
5. Prior lab: `research-token-architecture-visual-rhythm.md`, `research-erp-admin-design-cohesion-2026.md`, `research-composite-screen-cohesion.md`

---

## Limitations

- Did not re-measure live Ant/Carbon component pixel dumps in Storybook (culture-level only).  
- Did not audit every `premium.css` magic number remaining after cohesion pass.  
- Did not propose new CSS vars — out of scope; enforcement path is lint + STRUCTURE + `llms.txt`.

---

## Unresolved

1. Should FilterBar vertical rhythm stay default or always force ops compact on ListPage?  
2. Is `pad-card-x` 20 permanent, or someday normalize to 16/24 pure 8-grid (would reflow all composites)?

---

**Report path:** `plans/260802-design-lab-visual-system/reports/research-layout-density-grid-radius.md`
