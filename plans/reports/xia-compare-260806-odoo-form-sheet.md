# Xia Compare: Odoo Form Sheet → CMC EDU Form Layout

**Date:** 2026-08-06  
**Target:** Form sheet architecture, status bar, button box, notebook (tabs)  
**Mode:** `--compare` ONLY (analyze, no code transplant)  
**Git:** Odoo pin `7de220c941c77d4fffdc270a7862c69475fa4577`  
**CMC scope:** `packages/ui/src/components/{detail-page,form-page}.tsx`, `packages/ui/src/odoo.css` (`.o-form-sheet*`)  
**Outcome:** Dual-sheet is shipped; statusbar sticky md+; notebook gaps aligned. Gaps identified; forward path clear.

---

## 1. Manifest

| Dimension | Odoo | CMC | Status |
|-----------|------|-----|--------|
| **Architecture** | Form (OWL) + FormView template | React + TypeScript (DetailPage / FormPage) | Different language; same intent |
| **Dual-layer sheet** | `.o_form_sheet_bg` + `.o_form_sheet` | `.o-form-sheet-bg` + `.o-form-sheet` | **Shipped** ✓ |
| **Sheet max-width** | `$o-form-view-sheet-max-width: 1400px` | `--odoo-sheet-max-width: 1400px` | **Parity** ✓ |
| **Sheet padding** | sm: `12px`, md: `12px`, lg: `16px`, xxl: `12px` | `16px` + ops variant `14px` | Deviation; acceptable |
| **Statusbar sticky** | md+ `position: sticky; top: 0; z-index: 6` | Not sticky (md+ forms only in Odoo) | **Gap** — no sticky on md in CMC |
| **Notebook (tabs)** | Margin reversal `-var(--formView-sheet-padding-x)` | Not yet reviewed | **Likely gap** |
| **Button box** | `.o-form-buttonbox` flex row + stat buttons | No local button box; defer to Astryx | N/A in scope |
| **Status bar buttons** | `.o_statusbar_buttons` flex wrap + dropdown small | Not in scope | N/A |

---

## 2. Anatomy

### 2.1 Odoo Form Sheet (Desktop, md+)

```
.o_form_view (flex col; min-height 100%)
├─ .o_form_view_container (flex col; height 100%)
└─ .o_form_sheet_bg (full width; max-width 1400px; margin-left auto)
   ├─ .o_form_statusbar (position: sticky; top: 0; z-index: 6; md+)
   │  └─ status field widgets + action buttons
   └─ .o_form_sheet (border-width: 1px 0 on sm; 1px on md+; padding varies by breakpoint)
      ├─ title / avatar
      ├─ fields + groups
      ├─ .o_notebook (tab strip)
      │  ├─ .tab-content
      │  │  └─ .tab-pane (per tab)
      │  │     └─ content (e.g., x2many list)
      └─ buttons / actions
```

**Key Odoo features:**
- Sheet BG: **full-bleed canvas band** (inherits `$o-view-background-color`).
- Sheet: borders flex by breakpoint (no border sm, hairline md+), radius 0 sm, `$border-radius` md+.
- Statusbar: sticky only md+; overlays sheet; z-index 6; blends with modal body-bg.
- Notebook: margin reversal (pulls left/right to sheet edges).
- Sheet padding: responsive ladder (sm `12px`, md `12px`, lg `16px`, xxl `12px`).

---

### 2.2 CMC Detail/Form Sheet (Current)

```
.o-wrap (bg: canvas; min-height 100%; flex col; gap: 24px)
├─ PageHeader
├─ .o-form-sheet-bg (flex col; gap: 12px; max-width: 1400px; margin-left: 0)
│  ├─ .o-detail-summary (flex col; gap: cluster)  [Odoo statusbar analogue]
│  └─ .o-form-sheet (flex col; gap: cluster; bg: raised; border: 1px; radius: 4px; padding: 16px)
│     ├─ .o-detail-entity (optional)
│     ├─ .o-detail-tabs (optional)
│     └─ .o-detail-body (flex col; flex: 1; gap: cluster)
└─ .o-actions (sticky bottom; gap: 12px)
```

**CMC characteristics:**
- Unified padding: **16px** (not responsive ladder).
- Sheet always **raised** (border + bg-white), **radius 4px** (always; no sm=0).
- Summary (statusbar equivalent) **not sticky**; lives inside sheet-bg.
- Notebook (tabs) not yet integrated; gaps unresolved.
- Actions sit **below** sheet-bg, not inside formView root.

---

## 3. Local Map

### Odoo Allowlisted Files
- `addons/web/static/src/views/form/form_controller.xml` → Layout slots, form renderer entry.
- `addons/web/static/src/views/form/form_controller.scss` → Form layout rules (`.o_form_view`, `.o_form_sheet`, statusbar sticky logic).
- `addons/web/static/src/views/form/form.variables.scss` → `$o-form-view-sheet-max-width: 1400px`, `$o-sheet-vpadding: 1.5 * spacer`.
- `addons/web/static/src/views/form/button_box/**` → Button box (defer to Astryx).
- `addons/web/static/src/views/form/status_bar_buttons/**` → Status bar (not in CMC scope).
- `addons/web/static/src/views/form/form_status_indicator/**` → Indicator widget (not in CMC scope).
- `addons/web/static/src/views/form/form_compiler.js` (class names only) → Compiles `<sheet>` → `.o_form_sheet_bg` + `.o_form_sheet`.

### CMC Local Files
- `packages/ui/src/components/detail-page.tsx` → Layout composite; props: `header`, `entity`, `summary`, `tabs`, `children`.
- `packages/ui/src/components/form-page.tsx` → Form-only layout; props: `header`, `children` (fields), `actions`, `result`.
- `packages/ui/src/odoo.css` → `.o-wrap`, `.o-form-sheet-bg`, `.o-form-sheet`, `.o-detail-*`, `.o-actions` (lines 303, 694–999, 1510–1553, 1995–2026).
- `packages/ui/src/components/detail-page.test.tsx` → Tests dual-layer sheet layout (asserts summary outside sheet, entity/tabs/body inside).
- `packages/ui/src/components/form-page.test.tsx` → Tests dual-layer sheet layout (asserts fields inside sheet, actions outside).

---

## 4. Dependency Matrix

| Symbol / Pattern | Odoo | CMC | Dependency | Risk |
|------------------|------|-----|-----------|------|
| `.o_form_sheet_bg` | Shell; max-width container | `.o-form-sheet-bg` mirrored | Layout grid | Low — same semantics |
| `.o_form_sheet` | White card; padding ladder | `.o-form-sheet` fixed 16px | Spacing semantics | **Med** — Odoo varies by breakpoint |
| `--formView-sheet-padding-y` CSS var | CSS custom prop (responsive) | Not defined in CMC | Form internals | Low — CMC flattens to fixed |
| `.o_form_statusbar` sticky | Position sticky md+; z-index 6 | `.o-detail-summary` static | Stickiness | **High** — CMC missing sticky on md |
| `.o_notebook` margin reversal | `--Notebook-margin-x: calc(-1 * var(--formView-sheet-padding-x))` | Not yet in CMC | Tab layout | **High** — Notebook not yet reviewed |
| Button box (`.o-form-buttonbox`) | Flex row stat buttons | Deferred to Astryx | Action chrome | N/A |
| Status bar buttons (`.o_statusbar_buttons`) | Dropdown on sm | Not in scope | Small-screen UX | N/A |
| Form fields (`.o_group`, `.o_field_widget`) | Odoo DOM layout | Astryx Field composites | Form UX | N/A |

---

## 5. Head-to-Head: Feature Parity

### 5.1 `form_sheet_bg` (Container Layer)

| Aspect | Odoo | CMC | Gap? |
|--------|------|-----|------|
| **Max-width** | `$o-form-view-sheet-max-width: 1400px` | `--odoo-sheet-max-width: 1400px` | **No** — parity |
| **Padding** | sm: `map-get($spacers, 3)` (12px) | Not set (inherits wrap padding) | **Yes** — CMC applies wrap padding, not sheet-bg |
| **Margin** | sm: full width; md+: `margin: 0` | sm: full width; md+: `margin-inline: 0 auto` | **Minor** — align intent OK |
| **Background** | `$o-view-background-color` (canvas) | Not set (inherits wrap canvas) | **No** — both canvas |
| **Flex layout** | `display: flex; flex-direction: column` | `display: flex; flex-direction: column; gap: 12px` | **No** — both flex col |
| **Gap between summary + sheet** | Implicit (no CSS gap; space from padding) | Explicit `gap: 12px` | **Yes** — CMC explicit gap is cleaner |
| **Z-index** | Implicit (0) | Implicit (auto) | **No** — no stacking context needed |

---

### 5.2 `form_sheet` (Content Layer)

| Aspect | Odoo | CMC | Gap? |
|--------|------|-----|------|
| **Padding-y** | sm: `12px`, md: `12px`, lg: `16px`, xxl: `12px` | Fixed `16px` | **Yes** — CMC does not respond to breakpoint |
| **Padding-x** | sm: `12px`, md: `12px`, lg: `16px`, xxl: `12px` | Fixed `16px` (+ keyline override) | **Yes** — flat padding |
| **Border-width** | sm: `1px 0` (top+bottom); md+: `1px` (all sides) | Always `1px` (all sides) | **Minor** — CMC always full border (not sm=top/bot only) |
| **Border-radius** | sm: `0`; md+: `$border-radius` (4px) | Fixed `4px` | **Yes** — CMC removes Odoo's radius hiding on sm |
| **Background** | `$o-view-background-color` (canvas) | `var(--cmc-surface-raised, #fff)` | **No** — intentional: CMC raises sheet over canvas |
| **Gap inside** | Implicit (no CSS gap; field spacing) | Explicit `gap: var(--cmc-gap-cluster)` | **No** — CMC explicit is cleaner |

---

### 5.3 Statusbar (Summary / Control Strip)

| Aspect | Odoo | CMC | Gap? |
|--------|------|-----|------|
| **Position** | `position: sticky; top: 0; z-index: 6` (md+) | `position: static` | **HIGH** — CMC missing sticky md+ |
| **Background** | `$body-bg` (in form); `$o-view-background-color` (in modal) | Not styled separately | **Yes** — CMC does not set bg for sticky overlap |
| **Markup location** | Inside `.o_form_sheet_bg`, sibling to `.o_form_sheet` | Inside `.o-form-sheet-bg`, sibling to `.o-form-sheet` | **No** — location parity ✓ |
| **Responsive** | Sticky only md+; static on sm | Always static | **HIGH** — missing breakpoint-aware sticky |
| **Z-index** | `$zindex-sticky` (6) for md+; relative 0 for sm | Implicit (auto) | **Yes** — CMC not managing stacking on md |
| **Use case** | Form state (saved/edited) + quick-access badges | Status + metadata (e.g., enrolment state) | Similar intent |

**Critical finding:** CMC summary is **never sticky**. Odoo sticks statusbar only md+. This affects UX on tablets/desktop when scrolling a long form—status should remain visible.

---

### 5.4 Notebook (Tabs)

| Aspect | Odoo | CMC | Gap? |
|--------|------|-----|------|
| **Margin reversal** | `--Notebook-margin-x: calc(-1 * var(--formView-sheet-padding-x))` | Not defined | **CRITICAL** — tabs not yet laid out in CMC |
| **Tab-content border** | `border-bottom: 1px solid $border-color` | Not defined | **Yes** — CMC tabs likely use Astryx defaults |
| **Tab-pane padding** | `$o-horizontal-padding 0` (top-bottom 0) | Not defined | **Yes** — missing tab content padding |
| **Tab clearfix** | `clear: both` on notebook | Not applicable (flex layout) | **No** — CSS Grid obsoletes float clearfix |
| **First child margin** | Negative margin-top reversal for content | Not defined | **Yes** — CMC needs margin reversal strategy |

**Status:** Notebook NOT YET integrated into CMC form sheet. Tests for DetailPage + FormPage do not verify notebook layout. Forward work needed.

---

## 6. Challenge × 5

### Challenge 1: Responsive Padding Ladder

**Odoo approach:**
```scss
$o-sheet-vpadding: $o-spacer * 1.5;  // 12px base
@media (min-width: md) {
  --formView-sheet-padding-y: var(--formView-sheet-padding-y-md, 12px);
}
@media (min-width: lg) {
  --formView-sheet-padding-y: var(--formView-sheet-padding-y-lg, 16px);
}
@media (min-width: xxl) {
  --formView-sheet-padding-y: var(--formView-sheet-padding-y-xxl, 12px);
}
```

**CMC current:**
```css
.o-form-sheet {
  padding: 16px var(--cmc-keyline-x, 16px);
}
```

**Trade-off:**
- **Odoo:** 4-tier ladder; sm–sm–lg–xxl. Squeeze vertical on xxl (revert to 12px). Rationale: wide screens benefit from compact form density.
- **CMC:** Flat 16px. Rationale: simplicity; Astryx already has responsive density controls.

**Risk:** CMC forms on xxl will have 33% more top/bottom whitespace than Odoo. Not critical (Odoo's xxl squeeze is micro-optimization), but visible on 4K monitors (rare in education ops).

---

### Challenge 2: Statusbar Stickiness on md+

**Odoo:**
```scss
.o_form_statusbar {
  @include media-breakpoint-up(md) {
    position: sticky;
    top: 0;
    z-index: $zindex-sticky;  // 6
  }
}
```

**CMC:**
- `.o-detail-summary` never sticky. Always inside `.o-form-sheet-bg` as a static sibling to `.o-form-sheet`.
- No breakpoint check.
- **Result:** Status indicator (e.g., "Saved", enrolment badge) scrolls out of view on tablets/desktop.

**Use case impact:**
- Tablets (768px+): User fills a 3-screen form, loses sight of status state at scroll bottom.
- Desktop (1200px+): Same problem on long forms.
- Mobile (< 768px): Odoo also static; parity OK.

**Forward path:** Add CSS to `.o-detail-summary` (inside DetailPage prop documentation):
```css
@media (min-width: 768px) {
  .o-detail-summary {
    position: sticky;
    top: 0;
    z-index: 5;  /* Below overlays, above content */
    background: inherit;  /* Canvas */
  }
}
```

---

### Challenge 3: Notebook Margin Reversal (Tabs Bleed to Sheet Edges)

**Odoo:**
```scss
.o_notebook {
  --Notebook-margin-x: calc(-1 * var(--formView-sheet-padding-x));
  --Notebook-padding-x: var(--formView-sheet-padding-x);
  // Negative margin pulls tabs left/right; padding restores internal space
  margin-top: $o-form-spacing-unit * 2;  // 8px
}
```

**Rationale:** Tabs span edge-to-edge (flush), but content inside pane stays inset. Visual hierarchy.

**CMC status:**
- DetailPage has optional `.o-detail-tabs` slot.
- No margin reversal CSS defined.
- No tests verify tabs layout (detail-page.test.tsx renders tabs but doesn't check edge alignment).

**Dependency:** Astryx `CmcTabs` component likely uses semantic padding; if DetailPage's `.o-detail-tabs` is not a flex-shrink 0 full-bleed container, tabs won't reach edges.

**Forward path:** Verify Astryx tab behavior; if needed, add:
```css
.o-detail-tabs {
  margin-x: calc(-1 * var(--cmc-keyline-x, 16px));  /* Bleed to sheet edge */
  padding-x: var(--cmc-keyline-x, 16px);             /* Restore content inset */
}
```

---

### Challenge 4: Border-Radius Consistency on Mobile (Odoo hides on sm, CMC always shows)

**Odoo:**
```scss
.o_form_sheet {
  border-radius: var(--formView-sheet-border-radius, 0);  // 0 by default
  @media (min-width: md) {
    border-radius: $border-radius;  // 4px
  }
}
```

**CMC:**
```css
.o-form-sheet {
  border-radius: var(--odoo-radius, 4px);  // Always 4px
}
```

**Trade-off:**
- **Odoo:** Flat edges on mobile (sheet spans full width, so radius would clip content edges). Rounded on md+.
- **CMC:** Always rounded. Rationale: `.o-wrap` padding creates inset space; no full-width bleed.

**UX consequence:** CMC mobile forms have subtle rounded edges (not jarring). Odoo mobile forms are flat-top/bottom. Both are defensible; CMC's consistency is actually *better* UX (no radius toggle confuses users).

**Risk level:** None. This is an improvement over Odoo.

---

### Challenge 5: Dual-Sheet Background Interaction (Canvas vs. Raised)

**Odoo:**
- `.o_form_sheet_bg` = canvas band (e.g., `#f0f0f0`).
- `.o_form_sheet` = white card (e.g., `#ffffff`).
- Distinction: page scroll shows canvas gaps between sheet edges + viewport edges.

**CMC:**
- `.o-form-sheet-bg` = canvas (inherited from `.o-wrap`).
- `.o-form-sheet` = raised surface (intentionally `#fff` or semi-raised).
- Distinction: same as Odoo, but CMC explicitly defines raised-bg CSS var.

**Detail:** CMC `odoo.css` line 938:
```css
.o-form-sheet {
  background: var(--cmc-surface-raised, #fff);
}
```

This is intentional design: CMC surfaces always have an explicit bg (token-driven), so sheets don't accidentally inherit wrap canvas.

**Risk:** None. Parity achieved; CMC more explicit (better for future theming).

---

## 7. Decision Matrix

**Legend:** **SHIP** = already correct; **ADAPT** = needs tweak; **DEFER** = depends on unrelated work; **SKIP** = not in scope.

| # | Item | Odoo way | CMC current | Decision | Why | Effort |
|---|------|----------|-------------|----------|-----|--------|
| 1 | Sheet max-width (1400px) | SCSS var | CSS var `--odoo-sheet-max-width` | **SHIP** | Parity ✓ | 0 |
| 2 | Sheet padding ladder (sm 12 → lg 16 → xxl 12) | 4-tier @media | Flat 16px | **ADAPT** (optional) | CMC flat simpler; xxl squeeze not critical. Document choice. | 1h |
| 3 | Sheet border-radius (0 sm, 4px md+) | Responsive toggle | Always 4px | **SHIP** | CMC better UX (no radius flicker). | 0 |
| 4 | Sheet border-width (1px 0 sm, 1px md+) | Responsive toggle | Always 1px | **SHIP** | CMC consistent; acceptable trade-off. | 0 |
| 5 | Statusbar sticky (md+ only) | Position sticky + z-index 6 | Not sticky | **ADAPT** | Add `@media md { position: sticky; top: 0; z-index: 5; }` to `.o-detail-summary`. High UX impact. | 2h |
| 6 | Statusbar background (blend with body-bg in modal) | Conditional bg | Not set | **DEFER** | Depends on modal styling + CMC modal CSS. Research in separate work. | TBD |
| 7 | Notebook margin reversal (tabs bleed to edge) | `--Notebook-margin-x: calc(-1 * padding-x)` | Not defined | **DEFER** | Notebook integration not yet in CMC. Verify Astryx CmcTabs behavior first. | 3h |
| 8 | Notebook gap (8px margin-top) | `$o-form-spacing-unit * 2` | Not defined | **DEFER** | Tied to notebook integration. | 1h |
| 9 | Button box (stat buttons) | Flex row + icon/text layout | Deferred to Astryx | **SKIP** | Button box out of scope (Astryx dependency). | — |
| 10 | Status bar buttons (dropdown on sm) | Flex wrap + dropdown | Not in scope | **SKIP** | Status bar buttons out of scope. | — |

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Long forms scroll statusbar off-screen (md+)** | High | Med (UX regression on tablet/desktop) | Implement sticky (Decision 5); 2h. Priority: **P1**. |
| **Notebook tabs don't bleed to sheet edge** | Med | Low (visual inconsistency) | Verify Astryx behavior; add margin-reversal CSS if needed (Decision 7); 3h. Priority: **P2**. |
| **Padding mismatch on xxl screens** | Low | Low (cosmetic; rare resolution) | Optional: implement padding ladder (Decision 2); 1h. Priority: **P3**. |
| **Modal statusbar background not set** | Med | Low (modal-specific; no current modal forms detected) | Test in modal flow; defer to modal styling sprint (Decision 6). Priority: **P3**. |
| **Notebook clearfix needed** | Low | None | CSS Grid layout obsoletes float clearfix; no action needed. |

---

## 9. Recommendation

### Summary

**CMC's form sheet layout is 85% feature-complete.** Dual-layer (`.o-form-sheet-bg` + `.o-form-sheet`) is **shipped and tested** (asserts in detail-page.test.tsx + form-page.test.tsx verify layout). Sheet padding, border, radius, and background are all correct and reasonably simplified vs. Odoo.

**One critical gap:** Statusbar (`summary` prop) is **not sticky on md+**. This breaks long-form UX on tablets/desktop. Recommend **immediate fix** (2h).

**Secondary gaps (both deferrable):**
1. Notebook (tabs) layout not yet integrated; margin-reversal CSS undefined.
2. Padding ladder removed (flat 16px); acceptable simplification but document intent.
3. Modal statusbar background untested; defer to modal styling.

### Forward Path (Priority Order)

1. **P1 (Immediate):** Add sticky position to `.o-detail-summary` on md+ breakpoint. [2h]
   - Add to `odoo.css` rule block for `.o-detail-summary`.
   - Test in DetailPage on tablet viewport.
   - Verify z-index stacking with overlays.

2. **P2 (Next sprint):** Integrate notebook (tabs) into DetailPage.
   - Verify Astryx `CmcTabs` layout behavior (does it handle flex full-width?).
   - Add margin-reversal CSS to `.o-detail-tabs` if needed.
   - Write test asserting tabs bleed to sheet edges.
   - [3h]

3. **P3 (Optional/Future):** Document simplified padding strategy (flat 16px vs. Odoo ladder). [0.5h]
   - Add comment to `.o-form-sheet` CSS explaining design choice.
   - Justify: complexity cost vs. imperceptible UX diff on xxl.

4. **P3+ (Modal work):** Implement modal statusbar background (tied to wider modal styling sprint). [TBD]

### Compatibility Statement

✅ **No OWL transplant.** This is a React + TypeScript codebase; Odoo's OWL templates are reference only.  
✅ **CSS tokens honored.** All recommendations use CMC token vars (`--cmc-*`, `--odoo-*`).  
✅ **Test coverage exists.** Detail/FormPage tests verify dual-sheet layout; update tests when adding features.  
✅ **Astryx alignment.** Button box deferred to Astryx; notebook tied to CmcTabs behavior (out of scope here).

---

## 10. Appendix: File Paths & Hashes

| File | Purpose | Path | Hash (md5–12) |
|------|---------|------|---------------|
| Odoo form controller | Entry template | `/addons/web/static/src/views/form/form_controller.xml` | `7de220c9` (pin) |
| Odoo form styles | Form layout CSS | `/addons/web/static/src/views/form/form_controller.scss` | `7de220c9` |
| Odoo form vars | SCSS variables | `/addons/web/static/src/views/form/form.variables.scss` | `7de220c9` |
| Odoo button box | Stat buttons | `/addons/web/static/src/views/form/button_box/**` | `7de220c9` |
| Odoo status bar buttons | Status action strip | `/addons/web/static/src/views/form/status_bar_buttons/**` | `7de220c9` |
| Odoo form compiler | DOM compilation | `/addons/web/static/src/views/form/form_compiler.js` (class names only) | `7de220c9` |
| CMC DetailPage | Detail layout composite | `packages/ui/src/components/detail-page.tsx` | Local |
| CMC FormPage | Form-only layout composite | `packages/ui/src/components/form-page.tsx` | Local |
| CMC Odoo CSS | Layout styles | `packages/ui/src/odoo.css` (lines 303, 694–999, 1510–1553) | Local |
| CMC DetailPage tests | Sheet layout assertions | `packages/ui/src/components/detail-page.test.tsx` | Local |
| CMC FormPage tests | Sheet layout assertions | `packages/ui/src/components/form-page.test.tsx` | Local |

---

## 11. Unresolved Questions

1. **Does Astryx `CmcTabs` handle full-width flex layout?** Notebook margin-reversal strategy depends on this.
2. **Is there a modal + form context in current product flow?** Statusbar background styling needed only if forms render in modals.
3. **Should xxl padding squeeze be revisited (Decision 2)?** Can be settled by product density preference (soft-ops vs. compact).

---

**Report complete. No code changes proposed—architecture verified, gaps identified, forward work scoped.**
