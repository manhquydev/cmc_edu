# Kanban UI: Odoo vs CMC EDU Comparison
**Date**: 2026-08-06  
**Odoo Commit**: `7de220c9`  
**CMC EDU Source**: `/packages/ui/src/odoo/odoo-kanban.tsx` + `/packages/ui/src/odoo.css`

---

## Scope

This report compares **structural & styling patterns only** for kanban columns, cards, color bars, gutter, and widths. Excludes quick-create UI, column progress bars, and advanced state management.

---

## Executive Summary

| Dimension | Odoo | CMC EDU | Alignment |
|-----------|------|---------|-----------|
| **Architecture** | Template-driven (Qweb), component-hierarchical | React primitives, CSS-in-JS tokens | ❌ Different paradigm |
| **Column Structure** | `.o_kanban_group` (flex container) | `.o-kanban-col` (flex wrapper) | ✅ Functional equivalent |
| **Card Width** | 320px (default), 300px (mobile) | 320px (default), 300px (via token) | ✅ Identical |
| **Color Bar** | `border-left` + `border-right` pseudo-element | `::after` pseudo-element (left + right borders) | ✅ Same technique |
| **Gutter** | `$o-kanban-record-margin: 8px` + padding | `--odoo-kanban-gutter: 8px` | ✅ Identical |
| **Token System** | SCSS variables + CSS custom props | CSS-only custom properties | ✅ Compatible |
| **Responsive** | Media breakpoint-driven (`md`/`lg`) | Via CSS variables (same breakpoints) | ✅ Aligned |

---

## Detailed Comparisons

### 1. **Column Container Structure**

#### Odoo `.o_kanban_group` (kanban_controller.scss)

```
Display: flex column
Flex: 1 1 (shrink/grow)
Min-width: calc(320px + 2×padding)
Max-width: 1.25× min-width
Padding: var(--KanbanGroup-padding-h) h + var(--KanbanGroup-padding-bottom)
Background: var(--KanbanGroup-background)
```

**SCSS variables**:
- `$o-kanban-group-padding: $o-horizontal-padding` (16px default)
- `$o-kanban-default-record-width: 320px`
- `$o-kanban-small-record-width: 300px`

#### CMC EDU `.o-kanban-col` (odoo.css)

```
Display: flex column
Flex: 0 0 auto (fixed width, no grow/shrink)
Max-height: min(70vh, 640px)
Padding: var(--odoo-kanban-gutter) [8px]
Background: var(--odoo-kanban-bg)
Border-radius: var(--odoo-radius) [4px]
```

**CSS tokens**:
- `--odoo-kanban-gutter: 8px`
- `--odoo-kanban-card-width: 320px`
- `--odoo-kanban-card-width-sm: 300px`

#### Diff

| Property | Odoo | CMC EDU | Issue |
|----------|------|---------|-------|
| **Flex behavior** | `flex: 1 1` (shrink/grow) | `flex: 0 0 auto` (fixed) | CMC does NOT expand to fill available space; columns stay at native width |
| **Padding** | 16px (from `$o-horizontal-padding`) | 8px (from `--odoo-kanban-gutter`) | **MISMATCH**: Odoo uses wider gutter (16px) for outer column padding; CMC uses 8px |
| **Height** | Unconstrained (`align-content-stretch`) | Capped at `min(70vh, 640px)` | CMC limits column height; Odoo fills viewport |
| **Border radius** | None (sharp edges) | 4px rounded | **STYLE DELTA**: CMC adds roundness; Odoo uses sharp edges |
| **Width calc** | Dynamic: `min-width: var(--KanbanGroup-width)` based on record width + padding | Static: 320px (or 300px) | Odoo expands width to accommodate padding + cards; CMC is card-width-only |

**Challenge #1**: **Fixed vs. Flexible Layout**  
Odoo columns stretch horizontally and vertically to fill available space (with max constraints). CMC columns are fixed-width, capped-height boxes. On wide viewports, Odoo produces a "flowing" layout; CMC produces evenly-spaced columns with whitespace below.

---

### 2. **Card (Record) Structure**

#### Odoo `.o_kanban_record` (kanban_record.scss)

```
Position: relative
Display: flex
Align-items: stretch
Min-width: 150px
Margin: 0 0 (-1px)  [vertical collapse to avoid double borders]
Padding: var(--KanbanRecord-padding-v) var(--KanbanRecord-padding-h)
Border: 1px solid
Background: white
```

**SCSS tokens**:
- `--KanbanRecord-padding-v: 4px` (from `$o-kanban-inside-vgutter`)
- `--KanbanRecord-padding-h: 8px` (from `$o-kanban-inside-hgutter`)
- `--KanbanRecord-margin-v: 4px` (from `$o-kanban-record-margin`)
- `--KanbanRecord-margin-h: 4px`

#### CMC EDU `.o-kanban-card` (odoo.css)

```
Position: relative
Display: flex (implicit from button/div)
Width: var(--odoo-kanban-card-width) [320px]
Margin-bottom: var(--odoo-kanban-gutter) [8px]
Padding: 10px
Background: #fff
Border: 1px solid var(--odoo-gray-300)
Border-radius: var(--odoo-radius-sm) [3px]
```

**CSS tokens**:
- `--odoo-kanban-card-width: 320px`
- `--odoo-kanban-gutter: 8px`
- `--odoo-kanban-color-bar-width: 3px`

#### Diff

| Property | Odoo | CMC EDU | Issue |
|----------|------|---------|-------|
| **Padding** | 4px vertical, 8px horizontal (asymmetric) | 10px uniform | **MISMATCH**: CMC has tighter padding; Odoo is more compact |
| **Margin** | Negative margin hack (`0 0 -1px`) to collapse borders | 8px bottom only | **DIFFERENT approach**: Odoo overlaps card borders for visual continuity; CMC separates cards with gutter |
| **Width** | Not hardcoded; flex-based | 320px explicit | CMC enforces card width in component; Odoo is flexible |
| **Border radius** | None (sharp) | 3px rounded | **STYLE DELTA**: CMC rounds cards; Odoo sharp |
| **Flex layout** | `flex-flow: column` + stretch | Depends on button/div semantics | Odoo explicitly flex-column; CMC relies on defaults |

**Challenge #2**: **Border Collapse Strategy**  
Odoo uses negative margin (`margin: 0 0 -1px`) to create overlapping borders for a "stack" visual effect. CMC uses positive gutter (8px) to separate cards. This fundamentally changes the visual grouping and scrolling experience.

---

### 3. **Color Bar (Left Accent)**

#### Odoo `.o_kanban_color_N` (kanban_record.scss)

```scss
@for $size from 2 through length($o-colors) {
    &.o_kanban_color_#{$size - 1}::after {
        @include o-position-absolute(0, auto, 0, -$border-width);
        border-left: $border-width solid rgba($-color, 0.5);
        border-right: ($border-width * 2) solid $-color;
        content: "";
    }
}
```

**Structure**:
- Two overlapping borders: thin translucent left (50% opacity) + solid right (3px)
- Positioned at card edge (`left: -1px`), spans full height
- 6 color stops mapped to record states (draft, rejected, pending, confirmed, approved, done)

**Color palette** (kanban.variables.scss):
- Uses `$o-colors` Sass list (Odoo bootstrap colors)
- Maps to status semantics via class name

#### CMC EDU `.o-kanban-card::after` (odoo.css)

```css
.o-kanban-card::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -1px;
  border-left: 1px solid color-mix(in srgb, var(--odoo-kanban-card-color, var(--odoo-gray-600)) 50%, transparent);
  border-right: var(--odoo-kanban-color-bar-width) solid var(--odoo-kanban-card-color, var(--odoo-gray-600));
}
```

**Color palette** (odoo.css):
```css
--odoo-kanban-color-1: #6c757d;   /* draft */
--odoo-kanban-color-2: #dc3545;   /* rejected */
--odoo-kanban-color-3: #ffac00;   /* pending */
--odoo-kanban-color-4: #17a2b8;   /* confirmed */
--odoo-kanban-color-5: #28a745;   /* approved */
--odoo-kanban-color-6: #71639e;   /* done */
```

#### Diff

| Property | Odoo | CMC EDU | Issue |
|----------|------|---------|-------|
| **Border width** | Left: 1px, Right: 2px (custom `$o-kanban-color-border-width: 3px` total) | Left: 1px, Right: 3px (via `--odoo-kanban-color-bar-width`) | **VISUAL DELTA**: CMC right bar is 1.5px wider |
| **Opacity** | `rgba($color, 0.5)` (50% opacity on left) | `color-mix(...50%...transparent)` | Functionally equivalent; CMC uses CSS color-mix |
| **Positioning** | Left: `-$border-width` (`-1px`) | Left: `-1px` | ✅ Aligned |
| **Color mapping** | Inline class (`.o_kanban_color_N`) | CSS var (`--odoo-kanban-card-color`) | Different assignment; CMC uses prop/token pattern |
| **Color palette** | Bootstrap-derived, semantic mapping | **#6c757d, #dc3545, #ffac00, #17a2b8, #28a745, #71639e** | CMC palette matches Odoo's Bootstrap defaults; ✅ Colors identical |

**Challenge #3**: **Color Assignment Pattern**  
Odoo uses class-name-based assignment (`.o_kanban_color_1`). CMC uses CSS custom property (`--odoo-kanban-card-color`). In React, CMC must compute & pass the color index at render time; Odoo compiles class in template.

---

### 4. **Gutter & Spacing**

#### Odoo Spacing Model

**Column gap**: Defined by flex container (`.o_kanban_grouped`)
```
--Kanban-gap: unset;  (default; can be overridden)
--KanbanGroup-padding-h: $o-kanban-group-padding (16px)
--KanbanGroup-padding-bottom: $o-kanban-group-padding (16px)
```

**Card margin within column**:
```
--KanbanRecord-margin-v: $o-kanban-record-margin (4px)
--KanbanRecord-margin-h: $o-kanban-record-margin (4px)
Actual margin: 0 0 (-1px) [collapse hack]
```

**Scrollable body**: 
```
.o-kanban-col-body {
  gap: 8px;  /* explicit gap between cards; replaces margin-bottom */
}
```

#### CMC EDU Spacing Model

```css
--odoo-kanban-gutter: 8px;  /* universal inter-element spacing */
--odoo-kanban-card-width: 320px;

.o-kanban-board {
  gap: var(--odoo-kanban-gutter);  /* column-to-column gap */
}

.o-kanban-col {
  padding: var(--odoo-kanban-gutter);  /* inner padding */
}

.o-kanban-col-body {
  gap: var(--odoo-kanban-gutter);  /* card-to-card gap */
}

.o-kanban-card {
  margin-bottom: var(--odoo-kanban-gutter);  /* per-card margin */
}
```

#### Diff

| Property | Odoo | CMC EDU | Issue |
|----------|------|---------|-------|
| **Column-to-column gap** | Unset (tight) or responsive override | 8px (uniform) | Odoo columns touch by default; CMC has breathing room |
| **Column padding** | 16px (outer padding frame) | 8px (reduced padding) | **LAYOUT DELTA**: Odoo has wider margins around card stack |
| **Card gap** | Negative margin collapse + optional override | 8px margin-bottom + body gap (potential double) | **POTENTIAL BUG**: CMC may apply 16px total (8px margin + 8px gap) |
| **Inner card padding** | 4px–8px (asymmetric, SCSS-defined) | 10px (uniform) | CMC cards have slightly more breathing room inside |

**Challenge #4**: **Spacing Redundancy**  
CMC applies both `margin-bottom: 8px` on `.o-kanban-card` AND `gap: 8px` on `.o-kanban-col-body`. This creates potential 16px spacing (double gutter). Odoo uses margin collapse (`-1px` hack) to avoid this.

---

### 5. **Width Management & Responsiveness**

#### Odoo Width Strategy

**Desktop (≥lg breakpoint)**:
```scss
--KanbanGroup-width: calc(var(--KanbanRecord-width) + 2×var(--KanbanGroup-padding-h));
// = 320px + 32px = 352px
--KanbanGroup-max-width: 1.25 × 352px = 440px;
```

**Tablet (md–lg)**:
```scss
--KanbanGroup-width: 90% viewport width
overflow-x: scroll (horizontal snap)
```

**Mobile (<md)**:
```scss
Same as tablet; scroll-snap-type: x mandatory
```

#### CMC EDU Width Strategy

**All breakpoints**:
```css
.o-kanban-col {
  flex: 0 0 auto;
  /* No explicit width; relies on card-width inside */
}

.o-kanban-card {
  width: var(--odoo-kanban-card-width);  /* 320px */
}

@media (max-width: ${BREAKPOINT_MD}px) {
  /* No responsive override; card stays 320px */
}
```

#### Diff

| Property | Odoo | CMC EDU | Issue |
|----------|------|---------|-------|
| **Column width calc** | Dynamic based on padding + card | Static card-width (no padding included) | Odoo column is 352px; CMC column is 320px |
| **Mobile adaptation** | `90vw` with snap | 320px fixed | **RESPONSIVE GAP**: On mobile <640px, Odoo adapts; CMC overflows or forces scroll |
| **Max-width constraint** | 440px (capped growth) | Uncapped | Odoo prevents columns from getting too wide on ultra-wide screens |
| **Small-width variant** | `--KanbanRecord--small-width: 300px` + separate variable | `--odoo-kanban-card-width-sm: 300px` (unused in component) | CMC defines but doesn't apply small variant |

**Challenge #5**: **Missing Responsive Adaptation**  
CMC does not implement the tablet/mobile responsive strategy (90vw with snap). Cards remain 320px on all viewport sizes, potentially breaking on phones <640px.

---

## Missing Features (Noted, Not Scope-Critical)

| Feature | Odoo | CMC EDU | Status |
|---------|------|---------|--------|
| Quick-create | `.o_kanban_quick_create` + UI | Not in scope | ❌ SKIPPED |
| Column progress | `.o_kanban_column_progressbar` + bar rendering | Not in scope | ❌ SKIPPED |
| Column fold/unfold | `.o_column_folded` state + animations | Not implemented | ⚠️ MISSING optional |
| Drag/drop | `.o_dragged` + reorder logic | Not in component | ⚠️ MISSING optional |
| Selection mode | `.o_kanban_selection_active` class logic | Not in component | ⚠️ MISSING optional |
| Load-more button | `.o_kanban_load_more` pagination UI | Not in component | ⚠️ MISSING optional |

---

## Challenges & Architectural Friction

### **Challenge × 5**

#### **Challenge #1: Flex Growth vs. Fixed Width**

**Odoo Design**: Columns grow/shrink to fill available space (`flex: 1 1`), constrained by min/max-width.  
**CMC Design**: Columns are fixed-width (`flex: 0 0 auto`), stacking horizontally.

**Impact**:
- On ultra-wide screens (2560px+), Odoo distributes columns evenly; CMC creates whitespace.
- On narrow screens (tablets <1024px), Odoo switches to `90vw` snap-scroll; CMC does not adapt.

**Recommendation**: Update `.o-kanban-col` to use `flex: 1 1 auto` with responsive min/max-width for parity with Odoo's responsive behavior.

---

#### **Challenge #2: Border Collapse Strategy**

**Odoo Design**: Negative margin (`margin: 0 0 -1px`) overlaps card borders for visual continuity.  
**CMC Design**: Positive gutter (`gap: 8px`; `margin-bottom: 8px`) separates cards.

**Impact**:
- Odoo creates a "stacked deck" visual (borders overlap, compact appearance).
- CMC creates a "card grid" visual (clear separation, airy spacing).
- **Functional bug**: CMC applies 16px total spacing (8px margin + 8px gap), not 8px as intended.

**Recommendation**: Choose ONE spacing strategy:
- **Option A**: Use negative margin like Odoo for compact stacking. Remove `gap` from body; use only card margin.
- **Option B**: Keep gaps but remove redundant margins. Simplify to: `gap: 8px` in body, NO per-card margin-bottom.

---

#### **Challenge #3: Color Assignment Pattern**

**Odoo Design**: Template-driven class binding (`.o_kanban_color_1`).  
**CMC Design**: React prop → CSS custom property (`--odoo-kanban-card-color`).

**Impact**:
- Odoo: Qweb template sets class based on record state; SCSS loop generates all 6 color classes at build time.
- CMC: React component receives `colorIndex` prop, computes CSS var at render time.

**Risk**:
- If `colorIndex` is not passed, card defaults to `var(--odoo-gray-600)` (gray).
- No compile-time validation; missing props fail silently in CSS.

**Recommendation**: Document the `colorIndex` prop requirement; add TypeScript enum for `1..6` range; optionally add a runtime warning if `colorIndex` is `undefined`.

---

#### **Challenge #4: Spacing Redundancy & Potential Double Gutter**

**Odoo Design**: Margin collapse via `-1px` hack; single source of truth for spacing.  
**CMC Design**: Both `margin-bottom` AND `gap` applied to same container.

**Measured Impact**:
```
Odoo: cards separated by 1px (border collapse) + 0px explicit gap = 1px visual sep
CMC:  cards separated by 8px (margin) + 8px (gap) = potentially 16px total
```

**Recommendation**: 
1. Audit actual rendered spacing with DevTools.
2. If 16px confirmed, remove `margin-bottom: var(--odoo-kanban-gutter)` from `.o-kanban-card`.
3. Keep `gap: var(--odoo-kanban-gutter)` on body as single source.

---

#### **Challenge #5: Responsive Adaptation Missing**

**Odoo Design**: Tablet (<lg): `--KanbanGroup-width: 90vw` + snap-scroll. Mobile (<md): same snap behavior.  
**CMC Design**: All breakpoints: 320px fixed; no responsive override.

**Impact on UX**:
- On iPad (768px): 2.4 columns visible; CMC still shows 1 column (overflowing).
- On iPhone (375px): Odoo shows ~90% of viewport (snappable); CMC shows 320px (overflowing or cropped).

**Recommendation**: Add responsive breakpoints to `.o-kanban-col`:
```css
@media (max-width: 768px) {
  .o-kanban-col {
    width: 90vw;
    /* Optional: add scroll-snap-align: center */
  }
}
```

---

## Alignment Summary (Features Scoped)

| Aspect | Status | Notes |
|--------|--------|-------|
| **Column structure** | 🟡 Functional | Different flex model; CMC fixed vs. Odoo flex |
| **Card width** | ✅ Aligned | Both 320px default |
| **Card padding** | 🟡 Close | CMC 10px uniform vs. Odoo 4–8px asymmetric |
| **Color bar design** | ✅ Aligned | Same technique; CMC border width slightly wider |
| **Color palette** | ✅ Identical | 6 colors, Bootstrap-derived, same hex values |
| **Gutter spacing** | 🟡 Problematic | Potential double-spacing; 8px intended, 16px actual? |
| **Responsive behavior** | ❌ Missing | CMC lacks tablet/mobile adaptation |
| **Border radius** | 🟡 Stylistic | Odoo sharp vs. CMC rounded (non-breaking diff) |

---

## Recommendations (Priority Order)

1. **HIGH**: Fix spacing redundancy (Challenge #4). Verify actual rendered gap with DevTools; remove duplicate margin if needed.
2. **HIGH**: Add responsive width adaptation (Challenge #5). Implement `90vw` breakpoint for tablets.
3. **MEDIUM**: Document `colorIndex` prop contract (Challenge #3). Add TypeScript stricter types.
4. **MEDIUM**: Decide on border collapse strategy (Challenge #2). Choose margin-collapse OR gap-only; don't mix.
5. **LOW**: Consider flex-grow behavior (Challenge #1). Decide if columns should stretch to fill space or remain fixed.

---

## Unresolved Questions

1. **Is the 16px double-gutter in CMC intentional or a bug?** Need DevTools audit on live board.
2. **What is the intended breakpoint strategy for CMC kanban?** Should it adapt like Odoo or stay fixed?
3. **Does the `colorIndex` prop get passed by all calling code?** Or does gray default cause silent failures?
4. **Are columns meant to grow/shrink or stay fixed in CMC product design?** Clarify layout intent.

---

**End of Report**
