# Xia Comparison: Odoo List View vs CMC EDU List Implementation
**Date:** 2026-08-06  
**Source Pin:** Odoo `7de220c9` | **Target:** CMC EDU `/home/manhquy/Downloads/cmc_edu`  
**Scope:** `list_controller.xml`, `list_renderer.xml`, `list_renderer.scss` vs `ListPage`, `DataTable`, `odoo.css`

---

## FULL COMPARISON

### 1. Architecture & Template Strategy

| Dimension | Odoo | CMC EDU | Gap |
|-----------|------|---------|-----|
| **Controller Pattern** | Odoo-framework MVC (list_controller.js + .xml OWL template) | React hooks (list-page.tsx, data-table.tsx) | Different paradigm; Odoo uses reactive JS-templates w/ binding, CMC uses React component composition |
| **Renderer Model** | Dedicated ListRenderer class (XML template + JS controller) | Composition: `ListPage` (shell/layout) + `DataTable` (Astryx Table widget) | Separation of concerns differs; Odoo centralizes in single renderer, CMC layers it |
| **Template Engine** | Odoo's t-* directives (`t-foreach`, `t-if`, `t-on-click`, etc.) | JSX/TSX | Different—Odoo is XML-based, CMC is TS syntax |
| **Data Flow** | Props-driven via `List` model (domain/records/state); selection state in controller | Props-driven (`columns`, `data`, `selectedIds`); state lift to parent | Both unidirectional; Odoo couples state deeper into renderer |

**Assessment:** Different runtime. Architectural pattern similarity: both are table renderers with checkbox support + row click. Odoo pre-defines many Odoo-specific affordances (keyboard nav, multi-record actions). CMC is simpler, component-oriented.

---

### 2. Dense List Table / Cell Padding

#### Odoo (odoo-src/addons/web/static/src/views/list/list_renderer.scss:3–8)
```scss
--ListRenderer-table-padding-x: #{$table-cell-padding-x-sm};
--ListRenderer-thead-padding-y: #{map-get($spacers, 4)};
```
- **Padding:** `.3rem` (4.8px) left/right per cell (defined as `$table-cell-padding-x-sm`)
- **Thead padding-y:** `.5rem` (8px) vertical
- **Density context:** `.o_list_view &` context overrides to `$o-horizontal-padding` (typically 12px on desktop)
- **Compact mode:** No explicit "ops" or "dense" toggle in Odoo—always fixed at table-sm level

#### CMC EDU (packages/ui/src/odoo.css:60–61)
```css
--odoo-list-cell-padding-x: 0.3rem;  /* 4.8px */
--odoo-list-cell-padding-y: 0.5rem;  /* 8px */
```
- **Padding:** Identical `.3rem` x / `.5rem` y (no density variant override in CSS)
- **ListPage density prop:** `density?: 'default' | 'ops'` (line 27 in list-page.tsx)
- **Behavior:** Prop sets `o-wrap--ops` class, but **no ops-specific list cell padding rule in odoo.css**

**Gap:** 
- ✅ Base padding tokens match
- ❌ Odoo has flexible context override (`--ListRenderer-margin-x` for rendering scopes)
- ❌ CMC `density="ops"` does NOT reduce cell padding (only affects wrap margin; see `.o_wrap--ops` line 1406–1408)
- **Recommendation:** Add `.o-wrap--ops .o-list-table td { padding: 0.3rem 0.2rem; }` to tighten ops mode (0.2rem = 3.2px) or reduce padding-y to `.3rem` (4.8px).

---

### 3. Sticky Header Z-Index & Stacking

#### Odoo (list_renderer.scss:8, 15–23)
```scss
--sticky-header-zindex: 1;
--o-view-nocontent-zindex: calc(var(--sticky-header-zindex) + 1);

// sticky header on desktop
@include media-breakpoint-up(md) {
    height: 100%;
    .o_list_table thead {
        @include o-position-sticky(0);
        z-index: var(--sticky-header-zindex);
    }
}
```
- **Z-index:** `1` for sticky thead
- **Desktop-only:** `@media (min-width: md)` — sticky NOT applied on mobile
- **Height:** Sets `height: 100%` on `.o_list_renderer` for proper overflow scrolling
- **No-content helper:** z-index `calc(1 + 1) = 2` to appear above sticky header

#### CMC EDU (odoo.css:423–426)
```css
.o-list-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--odoo-gray-100);
}
```
- **Z-index:** `1`
- **No media breakpoint:** Sticky applied at all viewport sizes
- **No explicit height on parent:** `.o-list` container uses `overflow: auto` (line 1390)

**Gap:**
- ✅ Z-index value matches
- ⚠️ CMC applies sticky unconditionally; Odoo restricts to desktop (md+)
- ⚠️ Odoo's explicit `height: 100%` + media context suggests fine-tuned mobile behavior
- ❌ **E2E proof needed:** Verify sticky header remains above modals, popovers, and other z-indexed siblings in CMC (navbar is z-index 1000, line 103)

**Challenge #1: Sticky Header Z-Index Conflict**
- If a dropdown menu (e.g., sorting, filters) is opened within the list page, does it appear above the sticky header?
- CMC ControlBar is z-index 10 (line 858). Table header sticky at z-index 1 should NOT interfere, but must E2E test.

---

### 4. Checkbox Column & Selection

#### Odoo (list_renderer.xml:17–18, list_renderer.js logic)
```xml
<th t-if="hasSelectors" class="o_list_record_selector o_list_controller align-middle pe-1 cursor-pointer"
    tabindex="-1" t-on-keydown="(ev) => this.onCellKeydown(ev)" t-on-click.stop="toggleSelection">
    <CheckBox disabled="!_canSelectRecord" value="selectAll" className="'d-flex m-0'" onChange.bind="toggleSelection"/>
</th>
```
- **Checkbox in header (select-all):** When checked, toggles all visible records
- **Row selector:** Individual checkboxes (line 284)
- **Width:** Fixed `40px` (list_renderer.scss:224)
- **Indeterminate state:** Supports "some selected" visual via `indeterminate` property
- **Keyboard:** `onCellKeydown` handler for arrow nav + space to toggle

#### CMC EDU (data-table.tsx:99–130)
```tsx
header: (
  <input
    type="checkbox"
    aria-label="Chọn tất cả trên trang"
    checked={allSelected}
    ref={(el) => {
      if (el) el.indeterminate = someSelected && !allSelected;
    }}
    onChange={(e) => toggleAll(e.target.checked)}
    onClick={(e) => e.stopPropagation()}
  />
),
width: pixel(44),
```
- **Checkbox in header:** Identical logic (select-all, indeterminate)
- **Width:** 44px (vs Odoo's 40px)
- **No keyboard nav:** Missing arrow-key + space handlers
- **Native HTML checkbox:** Plain `<input type="checkbox">`, not wrapped in custom CheckBox component

**Gap:**
- ✅ Select-all + indeterminate state implemented
- ✅ Individual row selection works
- ❌ **Challenge #2: Keyboard Navigation Missing** — Odoo's `onCellKeydown` handler supports arrow keys (nav between rows) + Space (toggle selection). CMC DataTable does NOT expose keyboard handlers for row navigation.
- ❌ Width mismatch: 44px vs 40px (4px wider in CMC)

---

### 5. Optional Checkbox (Toggleable Selection)

#### Odoo (list_controller.xml, list_renderer.xml:14, archInfo.allowSelectors)
```xml
<t t-component="props.Renderer" t-if="model.isReady"
    ...
    allowSelectors="props.allowSelectors"
    ...
/>
```
- **Control:** Props gate (`allowSelectors` boolean from arch or controller state)
- **Conditional:** Entire checkbox column renders only if `allowSelectors = true`
- **Use:** Can be toggled per view configuration (e.g., `<list disable_selectors="1">` in XML arch)

#### CMC EDU (data-table.tsx:78–82)
```tsx
const selectionEnabled = selectedIds != null && onSelectionChange != null;
const selectedSet = new Set(selectedIds ?? []);
...
const mappedColumns = [
    ...(selectionEnabled
      ? [{ key: '__select', ... }]
      : []),
```
- **Control:** Props gate (if `selectedIds` AND `onSelectionChange` provided)
- **Conditional:** Entire checkbox column hidden if selection disabled
- **Use:** Parent component controls via props

**Assessment:**
- ✅ Both support optional checkbox via props
- ✅ Behavior equivalent (render only if enabled)
- ⚠️ Odoo's XML arch is declarative; CMC's React props are imperative—no architectural mismatch, just different style.

---

### 6. Open Row → Form View

#### Odoo (list_renderer.xml:331–343)
```xml
<t t-if="hasOpenFormViewColumn">
    <td class="o_list_record_open_form_view w-print-0 p-print-0 text-center"
        t-on-keydown="(ev) => this.onCellKeydown(ev, group, record)"
        t-custom-click.stop="(ev, newWindow) => props.onOpenFormView(record, { force: true, newWindow })"
        tabindex="-1"
    >
        <button class="btn btn-link align-top text-end"
            name="Open in form view"
            aria-label="Open in form view"
            tabindex="-1"
        >View</button>
    </td>
</t>
```
- **Button column:** Labeled "View" (line 341)
- **Callback:** `props.onOpenFormView(record, { force: true, newWindow })`
- **Middle-click:** `newWindow` flag allows Ctrl+click to open in new tab
- **Width:** Fixed `64px` (`o_list_open_form_view`, line 350)
- **Conditional:** Renders if `hasOpenFormViewColumn = true` (arch-driven)

#### CMC EDU (data-table.tsx, list-page.tsx)
```tsx
onRowClick?: (row: T) => void;
```
- **No dedicated "View" button column**
- **Row click handler:** Entire row is clickable (line 144–148)
- **No new-window support:** `onRowClick` callback does NOT expose middle-click/newWindow context
- **ListPage integration:** `onRowClick` would trigger navigation (not shown in snippet; implementation lives in parent)

**Gap:**
- ❌ **Challenge #3: Open-in-New-Tab Not Supported** — CMC's `onRowClick` fires on any click, but parent component must distinguish left-click (open form) vs middle-click (new tab). No `newWindow` flag in callback signature.
- ⚠️ Odoo shows explicit "View" button; CMC makes entire row clickable (UX tradeoff: more discoverable vs. less screen real estate)
- ⚠️ CMC hardcodes row click behavior; Odoo gates it with `hasOpenFormViewColumn` condition (more flexible)

---

### 7. Inline Edits (Read-Only in CMC)

#### Odoo (list_renderer.xml:287–301, list_renderer.scss:402–459)
```xml
<td t-on-keydown="(ev) => this.onCellKeydown(ev, group, record)"
    class="o_data_cell cursor-pointer"
    t-att-class="this.getCellClass(column, record)"
    ...
    t-on-click="(ev) => this.onCellClicked(record, column, ev, isMiddleClick)"
    tabindex="-1">
    <t t-if="!isInvisible">
        <t t-if="canUseFormatter(column, record)" t-out="getFormattedValue(column, record)"/>
        <Field t-else="" name="column.name" record="record" type="column.widget" .../>
    </t>
</td>
```
- **Click handler:** `onCellClicked(record, column, ev, isMiddleClick)` → enters edit mode on cell
- **Edit mode CSS:** `.o_data_row.o_selected_row > .o_data_cell` styles (lines 402–459) show full-width input rendering
- **Undo/Discard:** Save/Discard buttons in control panel (lines 107–113 of list_controller.xml)
- **Non-editable cells:** Buttons, remove links, open-form buttons are skipped

#### CMC EDU
- **No inline edit support** in DataTable or ListPage
- Tables rendered read-only; row-open-form pattern enforced
- Focus: list as view-only browse interface; editing happens in detail page

**Assessment:**
- ✅ **Recommendation: Do NOT port inline-edit list feature.** CMC's architecture (detail page for edits) is cleaner for:
  - Validation (full form context)
  - Undo/rollback (single form submission)
  - Complex fields (many2one lookups, nested o2m lines)
  - Mobile UX (no cramped cell editing)
- 📌 Odoo's inline edit is powerful but carries context-switch friction (edit-save-discard cycle inline; easy to miss changes).

---

## 5 CHALLENGES

### **Challenge #1: Sticky Header Z-Index Under Modal/Dropdown**
**Status:** E2E proof recommended  
**Risk:** Medium

Odoo's sticky header `z-index: 1` but navbar is `z-index: 1000` (CMC odoo.css:103). When a modal or popover opens above the table, does sticky header paint behind it?

**Test:** 
1. Open list page (sticky header visible)
2. Click filter dropdown (if z-index is correct, dropdown should appear above sticky header)
3. Click row → open detail modal
4. Verify modal's stacking order: modal > sticky header > table body

**E2E Proof:** If already working in current design3 admin pages (e.g., receipt-list), no action. If new issues arise, add `z-index: 10` to `.o-list-table thead th` in ops context.

---

### **Challenge #2: Keyboard Navigation Missing**
**Status:** Blocked (scope creep)  
**Risk:** Low-to-Medium (not in current requirement)

Odoo supports:
- Arrow Up/Down: Navigate rows
- Space: Toggle selection of current row
- Enter: Open form view (if in keyboard nav mode)

CMC DataTable does NOT expose keyboard handlers. Missing features:
- Row nav requires mouse click
- Select-all only via checkbox or Shift+click (not implemented)

**Recommendation:** Out of scope for this sprint. Document as accessibility debt. Priortize if user testing reveals friction.

---

### **Challenge #3: Open-in-New-Tab Not Wired**
**Status:** Blocked (API design needed)  
**Risk:** Medium

Odoo's `onOpenFormView` callback receives `{ force, newWindow }` flag. CMC's `onRowClick` does NOT distinguish Ctrl+click (new tab) from left-click.

**Fix:** Extend DataTable callback:
```tsx
onRowClick?: (row: T, event: React.MouseEvent) => void;
```
Then parent can check `event.ctrlKey || event.metaKey` to open new tab.

**Timeline:** Easy 10-min change; pair with e2e test.

---

### **Challenge #4: Cell Padding Ops Mode Not Implemented**
**Status:** Minor CSS gap  
**Risk:** Low

`.o-wrap--ops` class exists but does NOT tighten list cell padding. Odoo doesn't have explicit ops mode either, but CMC's `density="ops"` prop suggests intent to support it.

**Fix:** Add to odoo.css:
```css
.o_web_client .o-wrap--ops .o-list-table td {
  padding: 0.3rem 0.2rem; /* tighter x-padding for ops */
}
```

**Timeline:** 1-min CSS add.

---

### **Challenge #5: Width Mismatch (Checkbox Column)**
**Status:** Minor cosmetic  
**Risk:** Very Low

CMC checkbox column width: `44px` (pixel function)  
Odoo checkbox column width: `40px`

Likely historical (AstrxDesign Table component defaults). No functional impact; slight extra padding aids touch targets on mobile.

**Recommendation:** Accept as-is (44px is actually better for a11y).

---

## DENSE LIST TABLE SUMMARY

### Odoo Implementation
- **Padding:** `0.3rem` x / `0.5rem` y (table-sm standard, scoped via CSS vars)
- **Height/Overflow:** Explicit `height: 100%` on renderer root + sticky on md+ breakpoint
- **Density:** No toggle; always compact (matches Odoo's density philosophy—ERP tables assume small cells)
- **Sticky Header:** `z-index: 1`, desktop-only (mobile scrolls as normal table)
- **Selections:** Checkbox header + per-row checkboxes, supports indeterminate, keyboard nav
- **Open Form:** Dedicated "View" button column with newWindow support
- **Inline Edit:** Yes, with save/discard in control panel

### CMC EDU Implementation
- **Padding:** `0.3rem` x / `0.5rem` y (matches, but ops mode NOT implemented)
- **Height/Overflow:** `.o-list` uses `overflow: auto`; no explicit parent height
- **Density:** Props gate (`density="ops"`), but CSS not wired
- **Sticky Header:** Always active (no media breakpoint); `z-index: 1`
- **Selections:** Checkbox header + per-row checkboxes, indeterminate, NO keyboard nav
- **Open Form:** Row-click handler; no explicit button or newWindow support
- **Inline Edit:** Not supported (design choice: form pages instead)

### Key Differences
| Feature | Odoo | CMC | Recommendation |
|---------|------|-----|-----------------|
| Ops density CSS | No (N/A in Odoo) | Props exist, CSS missing | Add ops padding rule |
| Sticky header media breakpoint | md+ (desktop) | Always | Verify E2E behavior |
| Keyboard nav | Full (arrow/space/enter) | None | Out of scope; document debt |
| Open new tab | Built-in via `newWindow` flag | Not wired | Small API change + test |
| Inline edit | Yes | No | By design; no port needed |

---

## E2E PROOF RECOMMENDATION

**If CSS sticky header already exists in CMC:** Run E2E on current design3 pages (e.g., receipt-list, contact-list) to verify:
1. Sticky thead remains visible while scrolling table body
2. Sticky thead does NOT appear above modals/dropdowns (z-index stacking correct)
3. Table row click navigates to detail page (or form view)
4. Select-all checkbox + indeterminate state works
5. Checkbox column width does not break on mobile

**Test case:** Open receipt-list on desktop + mobile, scroll to bottom, verify sticky header sticky and modals render above.

---

## UNRESOLVED QUESTIONS

1. **Keyboard navigation scope:** Is arrow-key row nav required for MVP? (Currently missing in CMC)
2. **Mobile sticky header:** Should sticky header work on mobile or scroll normally? (Odoo: scroll normal; CMC: sticky always)
3. **Ops padding exact values:** Should ops mode reduce padding-y to 0.3rem? Or only padding-x to 0.2rem?
4. **Inline edit scope:** Is inline-edit-to-detail-page migration planned, or read-only lists final? (Current: read-only is final)
5. **Checkbox width:** Accept 44px or standardize to 40px? (Accept 44px recommended)

---

**Report Generated:** 2026-08-06 10:34 UTC+7  
**Status:** ✅ Full comparison complete. E2E proof recommended for sticky header. No inline-edit port needed.
