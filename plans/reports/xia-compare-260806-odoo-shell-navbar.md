# Feature Comparison: Odoo Shell / Navbar

## Source: odoo/odoo@19.0 (local odoo-src pin 7de220c9)
## Local Project: cmc_edu admin design3  
**Date:** 2026-08-06  
**Comparison scope:** Shell container stacking, navbar scroll-owner geometry, z-index layering, brand label decision.

---

## Source Manifest

**Odoo 19.0 reference files:**
- `addons/web/static/src/webclient/webclient.xml` — WebClient template; defines NavBar + ActionContainer + MainComponentsContainer
- `addons/web/static/src/webclient/webclient_layout.scss` — Column flex, height 100%, overflow rules, scroll-owner flip at md breakpoint
- `addons/web/static/src/webclient/webclient.scss` — Body + root styling (non-layout)
- `addons/web/static/src/webclient/navbar/navbar.xml` — NavBar OWL component; apps dropdown, brand, sections menu, systray slots
- `addons/web/static/src/webclient/navbar/navbar.scss` — Navbar entry height, padding, hover/active states
- `addons/web/static/src/webclient/navbar/navbar.variables.scss` — Token defaults: 46px height, purple brand, .9 opacity text

**CMC EDU reference files:**
- `apps/admin/src/shell/shell.tsx` — Shell.tsx root: .o_web_client div, OdooNavbar, main.o-main, float children (CommandPalette, EnrollPicker)
- `packages/ui/src/odoo/odoo-navbar.tsx` — OdooNavbar component (46px nav.o-navbar)
- `packages/ui/src/odoo.css` — Tokens + navbar/main stacking rules

---

## Source Anatomy

### Odoo webclient.xml
```xml
<t t-name="web.WebClient">
  <t t-if="!state.fullscreen">
    <NavBar/>                          <!-- Conditional on fullscreen state -->
  </t>
  <ActionContainer/>                   <!-- Multi-action stack + ControlPanel -->
  <MainComponentsContainer/>           <!-- Float layer: dialogs, toasts -->
</t>
```

**Topology:** Three-level stacking (NavBar conditionally rendered), paired with nested action container hierarchy.

### Odoo webclient_layout.scss — Scroll-owner flip

**Desktop (lg+):**
```scss
.o_web_client {
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
  
  > .o_action_manager {
    flex: 1 1 auto;
    height: 100%;
    overflow: hidden;
    
    > .o_action {
      height: 100%;
      display: flex;
      flex-flow: column nowrap;
      overflow: hidden;     // ← NO scroll here on desktop
      
      > .o_control_panel {
        flex: 0 0 auto;
      }
      .o_content {
        overflow: auto;      // ← SCROLL owner here
        height: 100%;
      }
    }
  }
}
```

**Mobile (md-down):**
```scss
@include media-breakpoint-down(md) {
  .o_action {
    overflow: auto;          // ← SCROLL owner flips TO outer action
    
    .o_content {
      overflow: initial;     // ← Inner content loses scroll
    }
  }
}
```

**Key fact:** Sticky headers (statusbar) & control-panel positioning changes behavior per breakpoint—this is not just CSS, it's a layout ownership flip.

### Odoo navbar.scss — Entry styling

```scss
.o_main_navbar {
  display: flex;
  height: var(--o-navbar-height);    // 46px
  padding-top: 0px;
  padding-bottom: 0px;
  border-bottom: 1px solid darken($o-brand-odoo, 10%);
  background: $o-brand-odoo;         // Purple #71639e
  font-size: $o-font-size-base;      // 14px
}

%-main-navbar-entry-base {
  position: relative;
  display: flex;
  align-items: center;
  height: calc(var(--o-navbar-height) - 0px);  // Full 46px
  color: var(--NavBar-entry-color, rgba(#fff, .9));
}

%-main-navbar-entry-spacing {
  margin: 0;
  padding-left: var(--NavBar-entry-padding-left, 0.63em);  // ~10px @ 14px base
  padding-right: var(--NavBar-entry-padding-right, 0.63em);
  line-height: calc(46px);  // Full height for text centering
}
```

**Entry height:** Full navbar height (46px), using `line-height` for vertical centering.

### Odoo navbar.variables.scss — Brand label

```scss
$o-navbar-brand-font-size: 1.2em;    // ~16.8px @ 14px base
$o-navbar-brand-color: rgba(#fff, .9);
```

**Brand in template:**
```xml
<DropdownItem
  t-if="!this.ui.isSmall and currentApp"
  t-esc="currentApp.name"
  class="'o_menu_brand d-flex'"
  ...
/>
```

**Odoo decision:** Brand = **current app name** (dynamic, from currentApp). Shown only md+ (not on small screens).

---

## Local Map

### Shell.tsx — Structure
```tsx
<div className="o_web_client">
  {!suppressChrome && (
    <OdooNavbar
      apps={modules}
      activeAppId={activeId}
      isChildVisible={(c) => isNavChildVisible(c, canDo)}
      onNavigate={navigate}
      brand="CMC EDU"           // ← Fixed string
      systray={systray}
    />
  )}
  <main className="o-main" role="main">
    <Outlet />                  <!-- Single route, not nested actions -->
  </main>
  {!suppressChrome && (
    <>
      <EnrollPicker ... />      <!-- Float sibling -->
      <CommandPalette ... />    <!-- Float sibling -->
    </>
  )}
</div>
```

**Key anatomy:**
- `.o_web_client` flex column, height 100%, no nested ActionManager/action stack
- `OdooNavbar` component rendered as header (no conditional fullscreen yet)
- `main.o-main` is the only viewport scroll owner (no layout flip)
- Float children are JSX siblings (not portaled into document.body)

### OdooNavbar.tsx — Component

```tsx
export function OdooNavbar({
  apps,
  activeAppId,
  isChildVisible,
  onNavigate,
  brand,      // ← Prop-driven; accepts ReactNode
  systray,
  className,
}: OdooNavbarProps) {
  const brandContent = brand ?? activeApp?.label ?? (apps[0] ? apps[0].label : 'CMC EDU');
  
  return (
    <nav ref={rootRef} className={rootClass} aria-label="Ứng dụng">
      <button className="o-app-switcher-toggle">
        <LineIcon name="grid" size={18} />
      </button>

      <span className="o-brand">{brandContent}</span>

      <ul className="o-menu-sections">
        {menuChildren.map((child) => (
          <li key={child.id}>
            <button className="o-menu-item" ...>
              {child.label}
            </button>
          </li>
        ))}
      </ul>

      {systray ? <div className="o-systray">{systray}</div> : null}

      {switcherOpen && (
        <div className="o-app-switcher-menu" role="menu">
          {apps.map((mod) => (
            <button key={mod.id} className="o-app-switcher-tile" ...>
              {mod.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
```

**Design:** Dumb, props-only. Drawer logic internal only (open/close state). No permission gate (caller must filter via `isChildVisible`).

### odoo.css — Stacking & scroll

```css
.o-navbar {
  position: relative;
  z-index: 1000;                   /* Navbar stacks above all */
  display: flex;
  align-items: center;
  height: var(--odoo-navbar-height);  /* 46px */
  background: var(--odoo-brand-purple);
  color: rgba(255, 255, 255, 0.9);
}

.o-app-switcher-menu {
  position: absolute;
  top: var(--odoo-navbar-height);   /* 46px below navbar top */
  left: 0;
  z-index: 10;                      /* Below navbar z-index 1000 */
  min-width: 220px;
  background: #fff;
  border-radius: 0 0 var(--odoo-radius) var(--odoo-radius);
}

.o_web_client > .o-main {
  flex: 1 1 auto;
  overflow: auto;
  z-index: 5;                       /* Below navbar's 1000, above typical sticky headers */
  /* Quiet surface so scrolled table rows do not bleed through */
  background: var(--odoo-gray-100);
}
```

**Scroll owner:** Single `.o-main` with `overflow: auto` (no flex siblings, no action stack).

**Z-index stack:**
1. `.o-navbar` = 1000 (topmost)
2. `.o-app-switcher-menu` = 10 (inside navbar event scope, but z-stacked below navbar bar itself)
3. `.o-main` = 5 (content scroll owner)
4. Sticky headers / control panel = auto (inherit, below 5)

---

## Dependency Matrix (EXISTS/NEW/CONFLICT/SKIP)

| Element | Odoo 19.0 | CMC EDU | Status | Risk | Notes |
|---------|-----------|---------|--------|------|-------|
| **Shell topology** | NavBar (conditional) + ActionContainer + MainComponents | OdooNavbar (rendered) + main + siblings (EnrollPicker, CommandPalette) | **EXISTS** | LOW | CMC is SPA (no action stack). Conditional fullscreen not yet implemented. |
| **Navbar height** | 46px (var) | 46px (var) | **EXISTS** | LOW | Exact token match. |
| **Navbar z-index** | Implicit (first in flex, topmost visual) | z-index: 1000 | **EXISTS** | LOW | CMC added explicit z-index after live audit (2026-08-06) proved cover bug on session-assessment + 6 forms. Odoo does not need it because OWL template order dominates. |
| **App-switcher menu z-index** | Implicit (nested in NavBar, last child) | z-index: 10 | **EXISTS** | LOW | Positioned absolutely below navbar; z-index 10 intentional (below navbar 1000, above main content 5). Odoo relies on flex/stacking context; CMC explicit. |
| **Scroll owner (desktop)** | `.o_content` inside `.o_action` | `main.o-main` | **NEW** | MED | Odoo has nested action/content; CMC collapsed into single main. No media breakpoint logic in CMC yet. |
| **Scroll owner flip (mobile)** | `.o_action` becomes scroll at md-down | Not implemented | **SKIP** (for now) | HIGH | Odoo flips scroll owner + sticky statusbar at md breakpoint. CMC always scrolls main. Sticky headers + responsive form layout require careful planning. |
| **Brand label** | Dynamic (currentApp.name) | Fixed ("CMC EDU") | **CONFLICT** | MED | **DECISION PENDING:** Switch CMC to module name. Not yet coded. |
| **Navbar conditional fullscreen** | `!state.fullscreen` hides NavBar | Path-based Chrome suppress (/change-password) | **PARTIAL** | LOW | CMC uses route-based logic; Odoo uses app state. Both suppress navbar. CMC's is more explicit (fail-safe). |
| **Systray slot** | OWL service registry | JSX systray prop + shell local buttons | **NEW** | LOW | CMC centralizes systray in shell.tsx (search, enroll, role, logout); Odoo registers via service. Different architecture, same output. |
| **Control panel stacking** | .o_control_panel nested in .o_action, flex 0 0 auto | Not a nested structure; control bar is inside page template | **NEW** | MED | Odoo centralizes ControlPanel in the action hierarchy; CMC scatters it per-page template (ListPage, DetailPage, etc.). Different routing models. |

---

## Head-to-Head

| Aspect | Source (Odoo 19.0) | Local (CMC EDU) | Recommendation |
|--------|-------------------|-----------------|-----------------|
| **Navbar height** | 46px fixed | 46px fixed | ✓ In sync. Keep both at 46px. |
| **Navbar background** | Purple brand (`#71639e`) | Purple brand (`#71639e`) | ✓ In sync. Keep both. |
| **Navbar z-index** | Implicit (template order) | Explicit 1000 | ✓ CMC correct. Odoo OWL allows implicit; React must be explicit. No conflict. |
| **App-switcher menu stacking** | Nested, last child of NavBar | Positioned absolutely, z-index 10 | ✓ Both correct. CMC explicit is safer for future float layers. |
| **Scroll owner** | `.o_content` inside `.o_action` (nested, desktop only) | `main.o-main` (flat, always) | ⚠ CMC simplified. Odoo nesting allows per-action scroll behavior. CMC SPA model has single main. **Not a bug, architectural choice.** |
| **Scroll-owner flip (mobile)** | `.o_action` becomes scroll at md-down; `.o_content` → overflow initial | Not implemented | ⚠ **GAP.** Odoo sticky statusbar + form field density need this. CMC: placeholder only (no responsive form sheet yet). |
| **Brand label value** | `currentApp.name` (dynamic) | `"CMC EDU"` (fixed) | ✗ **Mismatch.** Odoo: per-app; CMC: fixed. **DECISION: Switch CMC to module name.** No code yet. |
| **Brand label visibility** | Shown md+ only (`!this.ui.isSmall`) | Always shown | ⚠ Minor: CMC shows brand on all breakpoints. Odoo hides on mobile. Acceptable UX choice. |
| **Navbar conditional render** | OWL `t-if="!state.fullscreen"` | Path-based suppress (on /change-password) | ✓ Both suppress navbar in special states. CMC is more explicit (fail-safe). |

---

## Challenge (min 5 Qs with source/local/risk)

### Q1: Should CMC implement scroll-owner flip on mobile (md-down)?

**Source (Odoo):**
```scss
@include media-breakpoint-down(md) {
  .o_action {
    overflow: auto;
    .o_content {
      overflow: initial;
    }
  }
}
```
On mobile, entire action scrolls. Sticky statusbar + control panel remain fixed at top of scrolled region.

**Local (CMC):**
```css
.o_web_client > .o-main {
  overflow: auto;  /* Always */
  z-index: 5;
}
```
Single scroll owner regardless of breakpoint.

**Risk:** **HIGH.** Odoo's flip enables two behaviors:
- Desktop: tall form sheets scroll internally; navbar stays fixed, CP stays fixed
- Mobile: entire form scrolls; CP + statusbar scroll out of view OR need `position: sticky` at scroll-action level (structural change)

CMC's simplified model (always main scrolls) works for small forms but breaks on:
- Long settings pages (content scrolls away, CP visible always)
- Mobile landscape forms (CP top-sticks above scrolling form sheet)

**Recommendation:** Defer to Phase 7 (responsive form layout). Current smoke-test: "Works on desktop + tablet portrait." Mark as **accepted tech debt** in docs/system-architecture.md.

---

### Q2: Brand label — show current module name or fixed "CMC EDU"?

**Source (Odoo):**
```xml
<DropdownItem
  t-if="!this.ui.isSmall and currentApp"
  t-esc="currentApp.name"
  class="'o_menu_brand d-flex'"
/>
```
Shows active app name dynamically. Example: when on CRM, brand = "CRM".

**Local (CMC):**
```tsx
<OdooNavbar
  ...
  brand="CMC EDU"    /* Fixed */
/>
```

**Risk:** **MEDIUM.** CMC decision (doc authority: `docs/design-system-odoo.md` §1):
> "~~Odoo brand shows current app name; CMC shows fixed 'CMC EDU'~~ → **DECIDED** adopt module name; implement later."

Recommendation says: switch to module name (e.g., "Finance", "Enrollment") on route change.

**Implementation:**
1. Read `activeId` from `shell.tsx` (already computed)
2. Find module label from modules list
3. Pass as `brand={activeModule?.label ?? 'CMC EDU'}`
4. Component updates on activeId change (useMemo dependency)

**Recommendation:** **Implement now** — low-risk, high-UX gain. Est. 15 min.

---

### Q3: Should navbar be hidden on /change-password to prevent escape?

**Source (Odoo):**
Odoo checks `state.fullscreen` (OWL state). Hides NavBar + sections + systray when in fullscreen mode (e.g., loading, forced action).

**Local (CMC):**
```tsx
const suppressChrome = location.pathname === '/change-password' || location.pathname.startsWith('/change-password/');
```
Path-based. Hides navbar, app-switcher, command palette, systray on forced password rotation. **This is correct** — more explicit than state.fullscreen.

**Risk:** **LOW.** CMC implementation is better (fail-safe). Odoo's state-based approach allows accidental navigation away (staff could mCP violation). CMC's path-based check is stricter.

**Recommendation:** Keep CMC's approach. Note in docs: "Chrome suppression is enforced by path, not state; server-side redirect to /change-password is the gate."

---

### Q4: Is navbar z-index 1000 too high? Risk of modal/dialog occlusion?

**Source (Odoo):**
Template order + OWL event hierarchy means navbar never occludes dialogs. MainComponentsContainer (floats) is last in template, so it's topmost in visual stacking.

**Local (CMC):**
```css
.o-navbar {
  z-index: 1000;
}

.o_web_client .ck-dialog {
  position: fixed; inset: 0;
  z-index: 1200;  /* Modal above navbar */
}
```
CMC dialogs (ck-dialog, ck-toast, ck-cmd-palette) use z-index 1200+, explicitly above navbar 1000. **Correct.**

**Risk:** **LOW.** Explicit z-index stacking is safer than relying on template order. Any future float layer must declare z-index > 1000; guards against accidental occlusion.

**Audit trail:** Live audit 2026-08-06 found session-assessment + 6 form pages showing app-switcher menu painting over sticky page headers **before** navbar z-index was explicit. After setting `.o-navbar { z-index: 1000 }` + review, issue resolved.

**Recommendation:** Keep z-index 1000. Document in odoo.css: "Navbar stacks above content but below modals (z-1200+)."

---

### Q5: Should app-switcher menu remain z-index 10, or inherit navbar's 1000?

**Source (Odoo):**
App-switcher is nested in OWL NavBar component, rendered last (topmost in HTML). Its stacking context is the navbar itself.

**Local (CMC):**
```css
.o-app-switcher-menu {
  position: absolute;
  top: 46px;
  left: 0;
  z-index: 10;  /* Positioned relative to viewport, not navbar */
}
```
Menu is positioned absolutely (relative to nav.o-navbar, which has `position: relative`). z-index 10 stacks it above sticky page headers (z-auto) but below modals (z-1200+).

**Risk:** **LOW.** Current z-index 10 is correct. If we ever need the menu to overlay modals, change to 1100. Current implementation is future-proof.

**Recommendation:** Keep z-index 10. Add comment: "Positioned relative to navbar; stacks above page sticky headers but below modals."

---

## Decision Matrix

| Decision | Owner | Status | Notes |
|----------|-------|--------|-------|
| **Scroll-owner flip on mobile** | CMC product (future phase) | Deferred → Phase 7 | Accept tech debt: "CMC always scrolls main, no responsive flip." Document in system-architecture.md. |
| **Brand label = module name** | CMC product | **APPROVED** (authority: docs/design-system-odoo.md §1) | Implement: read activeId, find module label, pass to OdooNavbar brand prop. Est. 15 min. |
| **Navbar suppress on /change-password** | CMC product | **APPROVED** | Already implemented (path-based, fail-safe). Keep. |
| **Navbar z-index 1000** | CMC product | **APPROVED** | Correct (live audit 2026-08-06). Document: "Stacks above main content, below modals z-1200+." |
| **App-switcher menu z-index 10** | CMC product | **APPROVED** | Correct. Document: "Below navbar scope; above sticky page chrome." |

---

## Risk Score

**Overall: MEDIUM (score 6/10)**

| Component | Risk | Reason |
|-----------|------|--------|
| Navbar height / z-index stacking | **LOW** | CMC + Odoo aligned; explicit z-index is safer than implicit |
| Scroll-owner flip (mobile) | **HIGH** | Not implemented in CMC; tech debt for Phase 7 responsive form layout. Forms on mobile will scroll CP out of view. |
| Brand label (module name) | **MED** | Approved but not coded. Low implementation risk; moderate UX gap if delayed. |
| Fullscreen/chrome suppress logic | **LOW** | CMC path-based is better than Odoo's state-based. |
| Control panel stacking | **MED** | CMC scatters CP per-page; Odoo centralizes. Architectural difference, not a bug. Requires careful attention on multi-pane refactors. |

---

## Recommendation (compare only — no cook plan)

**No port required.** CMC's shell + navbar implementation is **source-grounded, production-ready** with one deliberate deviation and two minor gaps:

### 1. **Deviation: Scroll-owner topology (by design)**

CMC collapsed Odoo's nested action/content stack into a single `main.o-main`. This is **correct for a SPA** (Odoo has multi-action history; CMC routes via React Router). No change needed.

**Tech debt marker:** Add 1-line comment to `odoo.css`:
```css
.o_web_client > .o-main {
  /* SPA scroll owner; Odoo has nested .o_action/.o_content with md-down flip.
     Responsive form sheet sticky behavior deferred to Phase 7. */
  overflow: auto;
  z-index: 5;
}
```

### 2. **Gap 1: Scroll-owner flip on mobile (defer to Phase 7)**

Odoo flips scroll ownership at md-down (mobile). CMC does not (always main scrolls). This is **acceptable for current smoke-test** ("desktop + tablet portrait works") but will require attention when:
- Long settings pages ship (need sticky CP + scrolling content)
- Mobile form sheets become production-critical (need responsive CP behavior)

**Mitigation:** Mark in `docs/system-architecture.md` under "Known Issues > Mobile Form Layout":
> "Form sheets on mobile scroll the entire page (including control panel). Odoo achieves sticky CP via scroll-owner flip (.o_action scrolls, not .o_content). CMC Phase 7 will implement this when needed."

### 3. **Gap 2: Brand label = module name (low-effort, high-UX)**

**Current state:** Fixed "CMC EDU" in all modules.  
**Odoo:** Dynamic, shows active app name.  
**CMC authority:** Already decided to adopt module name (docs/design-system-odoo.md §1).  
**Status:** Approved, not coded.

**No blocker.** Implement when next shell.tsx change is planned. Estimated effort: 15 min.

---

## Comparison Summary

| Axis | Source | Local | Verdict |
|------|--------|-------|---------|
| **Height & layout token sync** | 46px, purple brand | 46px, purple brand | ✓ Perfect alignment |
| **Navbar stacking (z-index)** | Implicit (template order) | Explicit 1000 | ✓ CMC better (React explicit > OWL implicit) |
| **App-switcher positioning** | Nested, OWL template | Positioned absolute, z-index 10 | ✓ Functionally equivalent; CMC explicit |
| **Scroll owner (desktop)** | `.o_content` inside `.o_action` | `main.o-main` (flat) | ✓ Correct for SPA; defer nested actions to Phase 8+ |
| **Scroll owner flip (mobile)** | `.o_action` at md-down | Not implemented | ⚠ Tech debt; acceptable for now |
| **Brand label** | `currentApp.name` | `"CMC EDU"` | ✗ Mismatch; decision to fix (16 lines code) |
| **Navbar suppress (fullscreen)** | OWL state | Path-based (/change-password) | ✓ CMC stricter, more fail-safe |
| **Float layer z-index** | Implicit (last in template) | Explicit 1200+ (ck-dialog, ck-modal) | ✓ CMC explicit is safer |

**Conclusion:** CMC implementation is **production-ready, well-layered, and intentionally simplified for SPA architecture**. Two deliberate tech-debt items (scroll flip, brand label) are tracked and low-risk to defer.

---

## Unresolved Questions

1. **When should mobile scroll-owner flip land?** Phase 7 confirmed in roadmap? Or slip to backlog-pending UX research?
2. **Brand label module name — is "Finance", "Enrollment", etc. decided in i18n corpus?** Or derive from nav registry `mod.label`?
3. **Navbar conditional fullscreen (OWL `state.fullscreen`)** — does CMC need this beyond /change-password? Other suppression scenarios (setup wizard, onboarding)?
4. **ControlPanel stacking centralization** — is CMC scatter-per-page-template a permanent SPA model, or future refactor to unify (like Odoo's action hierarchy)?
5. **Sticky control panel on scroll** — current desktop behavior sticky? Or inherit scroll behavior? (Verify in CI e2e against design spec.)
