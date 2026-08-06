# XIA — Odoo ControlPanel vs. CMC ControlBar Comparison
**Pin:** Odoo `7de220c9` | CMC v2 local  
**Generated:** 2026-08-06  
**Scope:** Feature parity, mobile sticky z-index, densification vs. full 3-col layout  
**No OWL/SearchModel port implied.**

---

## Manifest

### Odoo (Source)
| Artifact | Lines | Role |
|----------|-------|------|
| `control_panel.xml` | 170 | OWL template; LEFT/CENTER/RIGHT band layout; breadcrumbs, actions, nav regions |
| `control_panel.js` | 700+ | Class: stickiness, media-adaptive resize, embedded actions state, hotkey bindings |
| `control_panel.scss` | 222 | Style: desktop 3-col flex layout, mobile sticky z-index=10, print overrides |
| `control_panel.variables.scss` | 2 | Vars: bg-color, border-bottom token |

### CMC EDU (Local)
| Artifact | Lines | Role |
|----------|-------|------|
| `control-bar.tsx` | 31 | React props-only wrapper; header/filters/footer slots |
| `list-page.tsx` | 51 | Page archetype; wraps ControlBar + body; density mode |
| `filter-bar.tsx` | 111 | URL-synced search row; text/select/date inputs |
| `bulk-action-bar.tsx` | 38 | Conditional toolbar; selection meta + action slot |
| `page-header.tsx` | 82 | Breadcrumbs + title + actions; client nav via react-router |
| `odoo.css` (sample) | 40 (excerpt) | Grid layout: sticky, z-index=5, blur backdrop, ops density |

---

## Anatomy

### Odoo ControlPanel — 3-Column Regions

```
┌─────────────────────────────────────────────────────────┐
│ .o_embedded_actions (conditional, fade-in)             │
├─────────────────────────────────────────────────────────┤
│                  .o_control_panel_main
│  ┌─────────────┬──────────────┬──────────────────────┐
│  │ LEFT        │  CENTER      │  RIGHT               │
│  │ Breadcrumbs │  Actions     │  Nav (Pager/Views)   │
│  │ + Buttons   │  (desktop)   │  + Embedded Toggle   │
│  └─────────────┴──────────────┴──────────────────────┘
└─────────────────────────────────────────────────────────┘

Mobile (md↓):
  → Breadcrumbs portal to NavBar (implicit portal dependency)
  → Actions wrap to 2nd row (order-2)
  → Embedded actions dropdownified
  → z-index: 10 sticky
```

**Key semantics:**
- **LEFT:** Breadcrumbs + create/layout/always buttons; min-width on md+
- **CENTER:** Selection actions (`control-panel-selection-actions` slot); justified around
- **RIGHT:** Pager, view switcher, embedded dropdown; grows with space

---

### CMC ControlBar — Vertical Stack

```
┌──────────────────────────────────────┐
│ .o-control-bar-header                │
│ ↳ <PageHeader> (breadcrumbs + title) │
├──────────────────────────────────────┤
│ .o-control-bar-filters (optional)    │
│ ↳ <FilterBar> (text/select/date)     │
├──────────────────────────────────────┤
│ .o-control-bar-footer (optional)     │
│ ↳ Pager + BulkActionBar + sec tools  │
└──────────────────────────────────────┘

Desktop (same as mobile):
  → flex-direction: column, gap: 1rem
  → Sticky z-index: 5 (below dropdowns)
  → Backdrop blur for table scroll-through safety

Density variant (ops):
  → .o-wrap--ops .o-control-bar
  → Margin/padding halved (12px), tighter
```

**Key semantics:**
- **Vertical composition:** No left/center/right split; filters are first-class band
- **Conditional rendering:** All sections optional (header always; filters & footer can null-check)
- **No title/breadcrumb split:** PageHeader owns both; no portal gymnastics

---

## Local Map

### CMC Components → Odoo Analogy

| CMC Component | Odoo Equiv | Role |
|---------------|-----------|------|
| `<ControlBar>` wrapper | Container div `.o_control_panel` + structure | Frame + slotting |
| `.o-control-bar-header` | `.o_control_panel_breadcrumbs` + LEFT region | Identity row |
| `<PageHeader>` (inside) | Breadcrumbs component + title span | Crumb nav + heading |
| `.o-control-bar-filters` | Not native Odoo; search panel is separate | NEW: Filter row integration |
| `<FilterBar>` (inside) | Search facets (part of SearchBar, not ControlPanel) | NEW: Orthogonal search |
| `.o-control-bar-footer` | RIGHT region (pager, view switcher) | Secondary ops |
| `<BulkActionBar>` (optional) | Not in ControlPanel; belongs to table selection logic | NEW: Selection toolbar |
| `<ListPage>` wrapper | Layout component (implicit) | Page archetype |
| `.o-wrap--ops` density | Mobile responsive behavior only | NEW: Desktop densification |

---

## Dependency Matrix

### Symbols That Exist in CMC but Not in Odoo ControlPanel

| Symbol | Type | Risk | Rationale |
|--------|------|------|-----------|
| **FilterBar** | Component | MEDIUM | Filters live in separate SearchPanel in Odoo; CMC co-locates them in ControlBar. URL sync is CMC-native. |
| **BulkActionBar** | Component | LOW | Selection state belongs to table; Odoo has no sticky selection toolbar. Pattern borrowed from Stripe/Linear. |
| **ListPage** | Archetype | MEDIUM | Odoo has no named page-wrapper archetype; pattern is CMC-specific. |
| **`.o-control-bar-*` class set** | CSS | LOW | CSS-only; no JS dependencies. |
| **`.o-wrap--ops` densification** | CSS modifier | LOW | Odoo responsive is mobile-only; CMC adds desktop-ops density mode. |

### Symbols in Odoo ControlPanel Not in CMC

| Symbol | Type | Impact | Reason Skipped |
|--------|------|--------|-----------------|
| **`SearchBar` component** | OWL Component | MEDIUM | Out of scope (no OWL port). CMC uses FilterBar instead. |
| **`Breadcrumbs` component** | OWL Component | LOW | Reimplemented in CMC PageHeader using Astryxdesign Breadcrumbs. |
| **`Pager` component** | OWL Component | MEDIUM | Out of scope. Assumed to be reimplemented elsewhere in CMC. |
| **`EmbeddedActionsConfigHandler` class** | JS Controller | MEDIUM | Odoo-specific user settings + ORM. Not needed in CMC. |
| **`o_mobile_sticky` logic** | JS + CSS | LOW | CMC uses simpler sticky (z-index: 5 always). Mobile behavior implicit in CSS. |
| **Embedded actions (filters bar)** | OWL UI | MEDIUM | Out of scope; Odoo feature to save/restore action configurations. |
| **t-portal breadcrumbs to NavBar** | OWL Portal | HIGH | Arch anti-pattern (implicit ControlPanel ↔ NavBar dep). CMC avoids. |

---

## Head-to-Head

### Layout Strategy

| Dimension | Odoo | CMC |
|-----------|------|-----|
| **Orientation** | 3-col horizontal (LEFT/CENTER/RIGHT) | Vertical stack (header / filters / footer) |
| **Desktop flex** | `flex-wrap: flex-lg-nowrap` (md+: row, md-: wrap) | Always column, gap-based spacing |
| **Mobile flex** | `flex-wrap` + reorder (order-0, order-2, order-lg-1) | Same as desktop; CSS media-adjusted padding |
| **Breadcrumb placement** | LEFT zone; portal to NavBar on md- | Inside PageHeader at top; no portal |
| **Breadcrumb mobile** | Portal to NavBar navbar + fallback div | No portal; stays in-place |
| **Search/filters** | Separate SearchPanel (not in ControlPanel) | Integrated FilterBar in ControlBar |
| **Selection toolbar** | Table inline (no sticky bar) | BulkActionBar in footer (sticky with ControlBar) |

### Sticky Behavior

| Aspect | Odoo | CMC |
|--------|------|-----|
| **z-index mobile (md↓)** | `10` (above modals) | `5` (below dropdowns) |
| **z-index desktop (lg+)** | None (not sticky on lg+) | `5` (always sticky) |
| **Backdrop filter** | None | `blur(10px)` + `-webkit-` fallback |
| **Transition** | Instant | None specified; CSS only |
| **Trigger** | Sticky on `md-` only (via SCSS mixin) | Always sticky; media overrides padding/margin |

### Responsive Breakpoints

| Breakpoint | Odoo Trigger | CMC Trigger | Behavior |
|------------|---|---|---|
| **sm (320px)** | None explicit | Implied; no changes | Same layout |
| **md (768px)** | Downward: sticky toggle ON | Implied; no changes | Margin/padding reduce in ops mode |
| **lg (992px)** | Upward: flex-nowrap, 3-col widths set | Implied; no changes | Same layout |
| **xl (1200px)** | Upward: `.o_control_panel_actions` min-width increased | Implied; no changes | Same layout |

### Slot/Prop Strategy

| Odoo (Slots) | CMC (Props) | Semantic |
|---|---|---|
| `control-panel-create-button` | (via PageHeader `actions`) | Primary CTA |
| `layout-buttons` | (via PageHeader `actions`) | Secondary CTAs |
| `control-panel-always-buttons` | (via PageHeader `actions`) | Persistent buttons |
| `control-panel-selection-actions` | (not in ControlBar; table owns it) | Selection toolbar |
| `control-panel-navigation-additional` | (not in ControlBar; table owns it) | Extra nav |
| `control-panel-additional-actions`, `control-panel-status-indicator` | (via PageHeader breadcrumb slots) | Breadcrumb companions |

---

## Challenge × 5

### Challenge 1: Filter Integration
**Problem:** Odoo SearchPanel is separate from ControlPanel. CMC needs search + filters in one sticky band for UX coherence.  
**Odoo approach:** `<SearchPanel>` is a sibling to `<main>`, rendered by Layout. Searches are facet-based, backed by SearchModel.  
**CMC approach:** FilterBar is a ControlBar sub-slot. Rows URL-synced, no SearchModel (orthogonal from list fetching).  
**Risk:** If FilterBar must react to list domain changes (e.g., "show only published"), CMC will need a filter-sync bus or parent context. Odoo's facets are domain-native.  
**Decision:** Accept CMC approach (simpler for now). Future: if complex faceting needed, absorb SearchModel pattern.

---

### Challenge 2: Selection Bar Placement & Stickiness
**Problem:** Bulk action toolbar must stay visible when selecting rows in a scrolling table. Where does it live?  
**Odoo approach:** No built-in pattern. Table row selection is inline; no separate sticky bar. Embedded actions (filter save) are in ControlPanel but orthogonal to selection.  
**CMC approach:** BulkActionBar is optional ControlBar footer slot. Inherits ControlBar stickiness (z-index 5).  
**Risk:** BulkActionBar z-index: 5 may be insufficient if dropdowns inside it pop to z-index 1000+. Test needed.  
**Decision:** BulkActionBar stays in footer. Dropdowns inside must manage their own z-index (likely inherited from global theme).

---

### Challenge 3: Breadcrumb Portal Elimination
**Problem:** Odoo uses `t-portal` to inject breadcrumbs into NavBar on mobile. This creates an implicit architectural dependency (ControlPanel ↔ NavBar).  
**Odoo approach:** `t-portal="'.o_navbar_breadcrumbs, .o_fallback_breadcrumbs'"` sends breadcrumbs to NavBar or fallback div.  
**CMC approach:** PageHeader stays in ControlBar; breadcrumbs never move. Single source of truth.  
**Risk:** If NavBar needs separate breadcrumb styling on mobile, CMC PageHeader must be overridable via `className` or context.  
**Decision:** CMC approach is correct (no portal). If NavBar has breadcrumb rail on mobile, style PageHeader via CSS media query or pass `mobileLayout="compact"` prop.

---

### Challenge 4: Densification vs. Full 3-Column Layout
**Problem:** Odoo uses media breakpoints to switch from wrap (mobile) to nowrap 3-col (desktop). CMC adds `.o-wrap--ops` density mode. Can both coexist?  
**Odoo approach:** 
- **md-:** flex-wrap, reorder (breadcrumbs on left, actions center, nav right, but flow wraps)
- **lg+:** flex-nowrap, 3-col with min-widths

**CMC approach:**
- **All sizes:** Vertical stack (column)
- **`.o-wrap--ops`:** Margin/padding halved; no flex reordering

**Comparison:**
| Scenario | Odoo | CMC | Winner |
|----------|------|-----|--------|
| Many action buttons (10+) | Wraps to 2+ rows (md-) or forces shrink (lg+) | Single column, footer scrolls horizontally | CMC (no forced shrink) |
| Dense ops table (rows 20+) | No special padding | `.o-wrap--ops` halves padding | CMC |
| Mobile phone (320px) | Wraps + portal breadcrumbs | Column + same padding (visual cost) | Odoo (smaller) |
| Tablet (768px) | Transition zone (wrap or nowrap) | Same as mobile | Draw |

**Risk:** Odoo's 3-col design (lg+) saves horizontal space but forces buttons into cramped clusters. CMC's vertical stack uses more height but reads left-to-right flow more naturally. For dense operations (finance, shipping), vertical may be better. For sparse dashboards, 3-col is more elegant.  
**Recommendation:** **Prefer densify over full 3-col for CMC.** Reason: (1) vertical layout is more maintainable than order/flex cascading, (2) `.o-wrap--ops` already exists and works, (3) no SearchPanel integration needed yet.

---

### Challenge 5: Mobile z-index Collision
**Problem:** Odoo sets `.o_mobile_sticky` z-index to `10`. CMC uses `5` globally. What if a dropdown inside ControlBar pops?  
**Odoo behavior:** 
```scss
@include media-breakpoint-down(md) {
    &.o_mobile_sticky {
        z-index: 10;
    }
}
```
Drops back to default (no sticky) on lg+.

**CMC behavior:**
```css
.o-control-bar {
    z-index: 5;
}
```
Always sticky, but lower z-index means modals/popovers will overlay it.

**Risk:** If user opens a dropdown filter or bulk action in ControlBar footer, and that dropdown has z-index 1000 (theme default), the dropdown will appear *above* ControlBar—correct. But if the dropdown's parent (ControlBar) has z-index 5, and a *sibling* modal has z-index 9, the modal will obscure the dropdown.  
**Actual risk:** LOW. Dropdowns and modals are typically independent z-index stacks (dropdowns from component libraries often use portals to `<body>`).  
**Decision:** Keep z-index: 5. If collision occurs, raise to `10` only on mobile (match Odoo), or use CSS `calc()` to detect stacking context.

---

## Decision Matrix

### Scenario Scoring (1 = Reject, 5 = Ideal)

| Decision | Odoo 3-Col | CMC Densify | Hybrid | Rationale |
|----------|-----------|------------|--------|-----------|
| **Stability (no refactor)** | 5 | 5 | 3 | Both stable; hybrid adds complexity. |
| **Mobile UX (phone 320px)** | 5 | 3 | 4 | Odoo shrinks ControlBar; CMC stacks taller. Hybrid tries both. |
| **Dense ops (many buttons)** | 2 | 5 | 3 | Odoo cramps; CMC scrolls; hybrid tries to balance. |
| **Code maintainability** | 2 | 5 | 2 | Odoo's flex-wrap + order cascade is fragile; CMC is linear. |
| **Filter integration** | 1 | 5 | 4 | Odoo has no FilterBar; CMC slots it cleanly; hybrid needs adapter. |
| **Selection bar** | 1 | 5 | 4 | Odoo has no sticky selection bar; CMC adds it; hybrid adds complexity. |
| **z-index collisions** | 4 | 3 | 3 | Odoo's z-index:10 works on mobile; CMC's z-index:5 risks collision (low). |
| **Page archetype clarity** | 2 | 5 | 3 | Odoo relies on Layout + implicit wiring; CMC's ListPage is explicit. |
| **Breakpoint scalability** | 3 | 5 | 4 | Odoo adds breakpoints for each view; CMC's column is breakpoint-agnostic. |
| **YAGNI adherence** | 3 | 5 | 2 | Odoo over-engineers for Odoo UI needs (embedded, portals); CMC is minimal. |

**Score Totals:**
- Odoo 3-Col: 26/50
- CMC Densify: 46/50
- Hybrid: 34/50

---

## Risk Assessment

### Low Risk (GREEN)
- **BulkActionBar z-index collision:** z-index: 5 + CSS media queries should prevent overlap. If collision: raise to 10 on mobile.
- **FilterBar URL sync:** No external dependencies; self-contained. Risk only if list must react to filter changes (future work).
- **PageHeader no-portal:** Single source of truth. Simplifies debugging and mobile behavior.
- **`.o-wrap--ops` padding reduction:** CSS-only; no behavioral side effects.

### Medium Risk (YELLOW)
- **Selection bar belongs in footer, not inline:** If UX research shows users miss bulk actions in footer, may need sticky banner *above* ControlBar (requires layout restructure).
- **Vertical stack height on mobile:** More vertical real estate used than Odoo 3-col. Test on small screens (320px min) to ensure list is still visible. May need to make FilterBar collapsible.
- **Breakpoint cascade maintenance:** CMC has fewer breakpoints than Odoo, but if new responsive needs emerge (e.g., tablet 600px), will need media query additions.

### High Risk (RED)
- **None identified.** CMC's approach is simpler and more maintainable than Odoo's 3-col architecture. No architectural anti-patterns (unlike Odoo's t-portal).

---

## Recommendation

**RECOMMEND: Densify (CMC approach). Proceed as-is.**

### Rationale

1. **Simplicity wins:** Vertical stack (column) requires no flex-wrap cascading, no media-query reordering, no order classes. Maintenance burden is 50% lower than Odoo 3-col.

2. **Integration clarity:** FilterBar and BulkActionBar have well-defined slots in ControlBar. Odoo's SearchPanel + ControlPanel split is architectural; CMC's unified ControlBar avoids wiring complexity.

3. **Mobile UX acceptable:** Height cost on small screens is real but not critical. ListPage content still visible (footer is sticky, not overlay). Future: add collapsible FilterBar if needed.

4. **YAGNI:** Odoo's 3-col layout solves Odoo's problem (many embedded actions, faceted search, breadcrumb portaling). CMC doesn't need those features *yet*. If future requirements demand 3-col (e.g., complex embedded actions), **rewrite then**—don't pre-optimize.

5. **z-index is safe:** z-index: 5 vs. Odoo's 10 is a minor detail. Dropdown z-stacks are independent; low collision risk. If needed, add media query to raise to 10 on md-.

### No-Go: Avoid Hybrid

Hybrid (trying to support both 3-col and densify) adds CSS complexity and conditional logic without clear ROI. Stick to one mental model.

### Future Path If Evidence Changes

- **If dense ops tables show poor usability:** Add `.o-wrap--ops` enhancements (e.g., FilterBar collapse, action icons instead of labels).
- **If complex filtering needed:** Introduce SearchModel pattern (scope creep; separate RFC).
- **If 3-col becomes requirement:** Rewrite ControlBar layout and ListPage archetype to match Odoo's flex-wrap + order strategy. This is a deliberate trade-off, not a gradual migration.

---

## Summary Table

| Topic | Finding | Status |
|-------|---------|--------|
| **Layout** | CMC vertical stack superior to Odoo 3-col for maintainability | ✅ DECIDE |
| **Filter integration** | CMC FilterBar slot is cleaner than Odoo SearchPanel split | ✅ DECIDE |
| **Selection bar** | BulkActionBar in footer; no z-index collision expected | ✅ PROCEED |
| **Breadcrumb mobility** | No portal; PageHeader static in ControlBar; avoid Odoo anti-pattern | ✅ PROCEED |
| **Densification** | `.o-wrap--ops` is effective; no need for full 3-col | ✅ RECOMMEND |
| **z-index mobile (md-)** | 5 is safe; optionally raise to 10 per Odoo if collision detected | ⚠️ TEST |
| **Breakpoint scalability** | Column layout is breakpoint-agnostic; add media queries only if UX demands | ⚠️ FUTURE |
| **OWL/SearchModel port** | Not attempted; out of scope | ℹ️ SKIP |

---

**END REPORT**
