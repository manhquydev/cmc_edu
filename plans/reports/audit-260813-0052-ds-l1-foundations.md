# L1 — Foundations audit (design tokens)

**Lane:** L1 Foundations · read-only  
**Date:** 2026-08-13  
**Branch:** `audit/design-system-impeccable` (worktree, base `develop`)  
**Authority:** `/impeccable audit` (craft + measurable quality) · files listed below  
**Not done:** no code edits, no `pnpm install` / `pnpm build`

## Scope

| File | Lines | Role |
|---|---:|---|
| `packages/ui/src/tokens.css` | 152 | `:root` `--cmc-*` (claimed single source) |
| `packages/ui/src/astryx-theme-cmc.css` | 147 | Astryx bridge: `--color-*` / `--radius-*` / `--font-size-*` → CMC |
| `packages/ui/src/console.css` | 2498 | Admin ERP chrome under `.o_web_client`; `--console-*` + remaps |
| `packages/ui/src/tokens.test.ts` | 42 | TS `tokens` ↔ CSS declaration parity (partial) |
| `packages/ui/src/console/console-tokens.test.ts` | 60 | Scope leak + string-existence guards |

**Cascade (admin):** `apps/admin/src/main.tsx:11-20` — reset → Inter → `tokens.css` → `astryx-theme-cmc.css` → `console.css` → `app.css`.  
**Provider:** `AstryxCmcProvider` wraps the tree with `data-astryx-theme="neutral"` (`astryx-provider.tsx:14-16`). Shell then opens `.o_web_client` (`apps/admin/src/shell/shell.tsx:130`).

---

## Scout Report

### Relevant Files

- `packages/ui/src/tokens.css` — 88 unique `--cmc-*` declarations; no dark layer.
- `packages/ui/src/astryx-theme-cmc.css` — 33 Astryx var overrides; `color-scheme: light`.
- `packages/ui/src/console.css` — 105 unique custom properties (116 declarations); Odoo 3/4/6 radius + Bootstrap palette + premium `--cmc-*` composites in one file.
- `packages/ui/src/index.ts:8-82` — typed `tokens` object is a **partial** mirror of `tokens.css`.
- `packages/ui/src/astryx-theme-cmc.test.ts` — asserts `--radius-inner` unset and `--font-size-*` *declared*, not that they `var(--cmc-*)`.
- `packages/ui/src/console/console-astryx-remap.test.ts` — **proves** `.o_web_client` remaps `--font-size-*` to Odoo 14/13/12.
- `apps/admin/src/main.tsx` — import order that makes console win inside the shell.
- `apps/admin/src/app.css` — almost fully tokenized (good consumer).
- `apps/admin/src/pages/attendance/shifts.tsx` — heaviest hardcode island (`--ws-*`).
- `apps/admin/src/pages/login.css` — scoped dark door that rewrites `--cmc-brand`.
- `apps/admin/src/components/soft-ops-fullcalendar.css` — FullCalendar stock palette.
- `design-system/cmc-edu/STYLING-BRIDGE.md:37-64` — documents two radius zones; **also claims `--cmc-radius-inner: 8px` which does not exist**.

### Unresolved / out of this lane

- LMS `apps/lms/src/app.css` consumes `--cmc-*` but was not scored.
- Astryx `theme-neutral` defaults for unmapped vars (spacing, elevation, `--radius-inner` = 4px) live in `node_modules` and were not re-indexed.
- No live computed-style contrast in a browser this pass (ratios are from declared hex via WCAG 2.x relative luminance).

---

## Audit Health Score (`/impeccable audit`)

| # | Dimension | Score | Key finding |
|---|-----------|------:|-------------|
| 1 | Accessibility | 2/4 | `--cmc-text-faint` 2.66:1; console warning `#ffac00` 1.88:1; several muted/brand pairs miss AA |
| 2 | Performance | 3/4 | 2498-line CSS with duplicated blocks; not a runtime perf incident |
| 3 | Responsive Design | 3/4 | Breakpoints exist (767 / 768 / 1040 / 1200) but 767 vs 768 is a one-pixel fork |
| 4 | Theming | 1/4 | Two (really four) palettes; `color-scheme: light` only; name-collision remaps |
| 5 | Implementation Integrity | 1/4 | Not one system — CMC soft-ops + Odoo console + login midnight + FC navy |
| **Total** | | **10/20** | **Acceptable — significant work needed** |

**Implementation Integrity verdict: FAIL.**  
The foundations are a **federation of discrete value sets** that share a few names, not one scale. Evidence: two radius languages (`tokens.css:44-47,79-81` vs `console.css:46-48`), two status palettes (`tokens.css:28-30` vs `console.css:19-22`), two type scales that collide on `--font-size-*` (`astryx-theme-cmc.css:70-81` vs `console.css:373-384`), and a test that *requires* the collision (`console-astryx-remap.test.ts:42-50`).

---

## Executive summary

- **Score:** 10/20 (Acceptable).
- **Counts:** **3 P0 · 9 P1 · 8 P2** (20 findings). No P3 listed — they would be noise next to the system split.
- **Top 5:**
  1. Two design languages in one admin shell (warm CMC vs cool Odoo/Bootstrap).
  2. `--font-size-*` / `--color-text-*` name collision: Astryx “pin” on `:root` loses to `.o_web_client`.
  3. WCAG AA failures on faint/muted/warning/console-status pairs.
  4. No dark-mode token layer; login invents a third brand (`#4f7dfb`).
  5. `apps/admin` still has 118 color literals / 266 `px` — half in `shifts.tsx`.
- **Next:** pick one type/color/radius owner inside `.o_web_client`, then tokenise the three admin islands.

---

## 1. Scales — system or discrete pile?

**Verdict: discrete pile with two intended cores and several unofficial extras.**  
`tokens.css` is internally a *thin* system (warm neutrals, one blue, 4-step space, nested 12/16/20 radius, whisper elevation). `console.css` is a second system (Bootstrap gray + purple + 3/4/6 radius). `astryx-theme-cmc.css` tries to map the first onto Astryx and then loses the fight on admin.

### Color

| Set | Evidence | Character |
|---|---|---|
| CMC brand + warm neutrals | `tokens.css:11-25,65-69` `#0071e3` / `#1d1d1f` / `#f5f3ee` | One accent, cream canvas |
| CMC status (Material-ish) | `tokens.css:28-40` `#2e7d32` / `#b26a00` / `#c62828` + soft/ink pairs | Muted, designed for badges |
| Console Bootstrap status | `console.css:19-22` `#28a745` / `#17a2b8` / `#ffac00` / `#dc3545` | Saturated, unused as `var()` |
| Console Bootstrap gray | `console.css:34-38` `#f8f9fa`…`#212529` | Cool silver on cream? No — used as *the* admin canvas (`console.css:79`) |
| Console purple chrome | `console.css:14-16` `#71639e` / `#5a4f7e` / `#714b67` | Navbar brand, not CMC blue |

**Breaks:**

- Two canvases: `--cmc-canvas #f5f3ee` (`tokens.css:65`) vs `--console-gray-100 #f8f9fa` painted on `.o_web_client` (`console.css:79`) and then again flattening `.console-wrap` (`console.css:1305-1307`). Warm paper dies at the shell.
- Two success/warning/danger ramps that do not share a hue or a step. Console copies sit unused; kanban 1–6 (`console.css:26-31`) duplicate those same Bootstrap hexes.
- Extra blues that are not tokens: `#5eb0ff` mixed into funnel fills (`console.css:1560,1674`); login remaps `--cmc-brand` to `#4f7dfb` (`login.css:23`) and adds `#7c5cff`.
- Alias collapse inside CMC: `--cmc-info-soft` === `--cmc-brand-muted` (`#e8f1fc`, `tokens.css:13` & `:37`); `--cmc-info-ink` === `--cmc-brand-ink` (`#003d99`); `--cmc-neutral-soft` === `--cmc-surface-2` (`#f0ede7`); `--cmc-surface` === `--cmc-surface-raised` (`#ffffff`).

### Spacing

Declared CMC scale is **4 · 8 · 16 · 24** (`tokens.css:48-51`) plus `--cmc-pad-card-x: 20px` (`tokens.css:111`) and aliases `--cmc-gap-cluster = 16` / `--cmc-gap-section = 24`.

**Break:** there is **no 12px step** even though 12px is the most-used spacing number in `console.css` (71 occurrences). Histogram of literal `px` in `console.css` (top): `1×75, 12×71, 8×52, 10×49, 14×42, 4×40, 16×32, 13×31, 6×30`. Off-grid crowd: `10, 14, 18, 22, 26, 30, 33, 34, 38, 46`. Console’s only spacing token is a single `--console-spacer: 16px` (`console.css:51`) that is **never referenced**.

Structural heights are a second unaligned scale: `--cmc-row-h: 48` / `--cmc-cta-h: 34` / `--cmc-chip-h: 22` (`tokens.css:125-131`) vs `--console-navbar-height: 46` / `--console-statusbar-height: 33` then locally overridden to `38` (`console.css:54,73,1223`) vs view-switcher `30×30` (`console.css:227-228`).

### Typography

| Scale | Steps (px) | Where |
|---|---|---|
| CMC role scale | 11, 12, 13, 14, 16, 18, 24, 32 | `tokens.css:55-56,99-105` |
| Astryx map (claimed CMC) | 11, 11, 12, 12, 13, 14, 16, 18, 24, 24, 32, 32 | `astryx-theme-cmc.css:70-81` — **collapsed** 4xs=3xs, 2xl=3xl, 4xl=5xl |
| Console / Odoo | 10, 10, 11, 12, 13, 14, **15**, 16, 18, 20, 22, 24 | `console.css:373-384` |

**Breaks:**

- 15 / 20 / 22 exist only on the console scale. Astryx comments (`astryx-theme-cmc.css:63-69`) say they pin every step so Astryx never inherits console’s `15px` — but they pin **literals on `:root`**, and console redeclares the **same names** on `.o_web_client`. Cascade: class beats `:root`. Proof test: `console-astryx-remap.test.ts:42-50`.
- Off-scale leftovers still in console CSS: `11.5px` (`console.css:988,2329,2365`), `9.5px` (`console.css:2283`), `font-weight: 650` (`console.css:1073,1152,1570`).
- Two Inter stacks: `--cmc-font-sans` includes `"Inter Variable"` (`tokens.css:54`); console hardcodes `'Inter'` without Variable (`console.css:80,402-403`).

### Radius

Documented as **two deliberate zones** (`STYLING-BRIDGE.md:37-54`):

| Zone | Values | Source |
|---|---|---|
| Soft-ops | 12 / 16 / 20 + pill 9999 | `tokens.css:44-47,79-81` |
| Odoo chrome | 3 / 4 / 6 | `console.css:46-48` |

That dual-zone decision is real. What the doc then gets **wrong**:

- Claims `--cmc-radius-inner/control/card/dialog` = **8 / 12 / 16 / 20** (`STYLING-BRIDGE.md:44,58`). `tokens.css` has **no `--cmc-radius-inner`**. `--cmc-radius-xs` is 12, not 8 (`tokens.css:44`). Astryx `--radius-inner` is intentionally unset (`astryx-theme-cmc.css:48-53`, locked by `astryx-theme-cmc.test.ts:8-14`) and falls through to Astryx **4px** — a *third* radius that belongs to neither table.
- Session cards invent a fourth: `--console-sc-radius: 14px` / compact `12px` (`console.css:2181,2226`). 14px is explicitly “real drift” per the same bridge (`STYLING-BRIDGE.md:55-57`).
- Aliases hide emptiness: `--cmc-radius-xs` === `--cmc-radius-control` (12); `--cmc-radius-card` === `--cmc-radius-md` (16); `--cmc-radius-dialog` === `--cmc-radius-lg` (20).

### Elevation

CMC has a real role ladder (`tokens.css:71-76`): `xs` sticky · `sm` raised rest · `md` hover · `lg` modal. Console then:

- uses a **cool** shadow `0 4px 12px rgba(0,0,0,0.15)` (`console.css:188`) instead of `--cmc-shadow-md` (warm `rgba(28,25,20,…)`);
- **strips** elevation under the shell (`box-shadow: none` on control-bar / page-header / form-sheet / metric, `console.css:1176,1315,1336,1373`);
- invents brand-tinted shadows `rgba(0, 113, 227, 0.06/0.1)` (`console.css:2460,2468`) that are hex-of-brand, not `var(--cmc-brand)`.

---

## 2. Duplicates, orphans, overlapping overrides

### Same name, different file, different value (the overlap)

Declared in **both** `astryx-theme-cmc.css` (`:root, [data-astryx-theme='neutral']`) **and** `console.css` (`.o_web_client`). Inside the admin shell the console value wins.

| Variable | Astryx / CMC (`astryx-theme-cmc.css`) | Console (`console.css`) |
|---|---|---|
| `--font-size-4xs` | `var(--cmc-font-size-column)` = 11 (`:70`) | `10px` (`:373`) |
| `--font-size-3xs` | same 11 (`:71`) | `10px` (`:374`) |
| `--font-size-2xs` | `12px` (`:72`) | `11px` (`:375`) |
| `--font-size-lg` | `16px` (`:76`) | **`15px`** (`:379`) |
| `--font-size-xl` | `18px` (`:77`) | `16px` (`:380`) |
| `--font-size-2xl` | `24px` (`:78`) | `18px` (`:381`) |
| `--font-size-3xl` | `24px` (`:79`) | `20px` (`:382`) |
| `--font-size-4xl` | `32px` (`:80`) | `22px` (`:383`) |
| `--font-size-5xl` | `32px` (`:81`) | `24px` (`:384`) |
| `--color-text-primary` | `var(--cmc-text)` `#1d1d1f` (`:27`) | `var(--console-gray-900)` `#212529` (`:428`) |
| `--color-text-secondary` | `var(--cmc-text-muted)` `#6e6e73` (`:28`) | `var(--console-gray-600)` `#6c757d` (`:429`) |
| `--color-text-disabled` | `var(--cmc-text-faint)` `#a39e96` (`:29`) | **same as secondary** `#6c757d` (`:430`) — disabled === secondary |
| `--font-family-body/heading` | `var(--cmc-font-sans)` Inter Variable (`:60-61`) | `'Inter', …` no Variable (`:402-403`) |

`--font-size-xs/sm/base` happen to match (12/13/14). Everything from `lg` up is a silent restyle of Astryx primitives rendered under the shell.

### True orphans (declared, never `var()`-referenced)

**`tokens.css` (never used outside the file):**

| Token | Line | Value |
|---|---:|---|
| `--cmc-duration-slow` | 90 | `280ms` |
| `--cmc-lh-tight` | 107 | `1.25` |
| `--cmc-row-h-compact` | 126 | `40px` |
| `--cmc-cta-h-sm` | 131 | `28px` |
| `--cmc-line-body` | 139 | `20px` |
| `--cmc-chip-h` | 128 | `22px` (only `--cmc-chip-h-sm` is consumed) |

**`console.css` (declared, never consumed — kanban 1–6 *are* consumed dynamically in `console-kanban.tsx:66`):**

| Token | Line | Note |
|---|---:|---|
| `--console-enterprise-purple` | 16 | `#714b67` — dead |
| `--console-success` | 19 | `#28a745` — dead (kanban-5 copies the hex) |
| `--console-info` | 20 | `#17a2b8` — dead |
| `--console-warning` | 21 | `#ffac00` — dead |
| `--console-danger` | 22 | `#dc3545` — dead |
| `--console-spacer` | 51 | `16px` — dead |
| `--console-breadcrumb-padding-x` | 58 | `0.5rem` — dead |

### Ghost references (used, never declared)

- `var(--console-border, #dee2e6)` and `var(--console-bg-subtle, #f1f3f5|#f8f9fa)` in `apps/admin/src/pages/attendance/shifts-detail.tsx:113-116`. Those `--console-*` names do not exist in `console.css`. Fallbacks always fire.

### Intra-file override

- `--console-statusbar-height` `33px` (`console.css:73`) then `38px` on `.o_web_client .console-steps` (`:1223`).
- `--console-statusbar-arrow-width` `1em` (`:74`) then `16px` (`:1222`) — the comment at `:1215-1220` explains a 14-vs-13 seam; the root token is now a lie.
- `--console-sc-*` default vs `.is-compact` (`:2173-2181` vs `:2218-2226`) — legitimate variant, but 14px radius is still off both official scales.

### Typed object drift (`index.ts` vs `tokens.css`)

`tokens.test.ts:13-20` only asserts that *whatever `index.ts` already lists* exists in CSS. It does **not** walk CSS → TS. Missing from `tokens` (so charts/canvas cannot read them): status soft/ink pairs (`tokens.css:31-40`), `--cmc-duration*`, `--cmc-focus-ring`, `--cmc-dot-size`, `--cmc-rail-w`, `--cmc-line-*`, `--cmc-raised-border/shadow/radius`.

Wrong fallbacks inside `console.css` (values that are **not** the token they claim to stand in for):

```715:736:packages/ui/src/console.css
  color: var(--cmc-text-muted, #6b7280);          /* real token #6e6e73 */
  ...
  border-radius: var(--cmc-radius-control, 4px);  /* real token 12px */
  border: 1px solid var(--cmc-border, #d1d5db);   /* real token #e0ddd5 */
  background: var(--cmc-surface-sunken, #fff);    /* real token #ebe8e2 */
  color: var(--cmc-text, #111);                   /* real token #1d1d1f */
```

If `tokens.css` fails to load, date fields snap to a cool-gray 4px Astryx look — the opposite of the token.

---

## 3. WCAG AA contrast (declared pairs)

Method: sRGB relative luminance, WCAG 2.x `(L1+0.05)/(L2+0.05)`. AA normal text **4.5:1**; large/UI graphic **3:1**. No browser paint this pass.

### Fail — treat as text (AA 4.5)

| Pair | fg | bg | Ratio | Used as |
|---|---|---|---:|---|
| `--cmc-text-faint` / `--cmc-surface` | `#a39e96` | `#ffffff` | **2.66** | `.console-eh-meta` `console.css:1080-1082` (12px copy) |
| `--cmc-text-faint` / `--cmc-canvas` | `#a39e96` | `#f5f3ee` | **2.40** | icons + hints on canvas |
| `--cmc-text-faint` / `--cmc-surface-2` | `#a39e96` | `#f0ede7` | **2.28** | |
| `--cmc-text-faint` / `--cmc-surface-sunken` | `#a39e96` | `#ebe8e2` | **2.18** | |
| `--cmc-text-muted` / `--cmc-surface-2` | `#6e6e73` | `#f0ede7` | **4.34** | `.console-filter-bar` `console.css:688-695` |
| `--cmc-text-muted` / `--cmc-surface-sunken` | `#6e6e73` | `#ebe8e2` | **4.15** | settings rail hover / rows |
| `--cmc-brand` / `--cmc-canvas` | `#0071e3` | `#f5f3ee` | **4.24** | links/actions on canvas |
| `--cmc-brand` / `--cmc-brand-muted` | `#0071e3` | `#e8f1fc` | **4.12** | `.console-row-tag` `:634-640`, `.console-count.is-emphasize` `:2159-2160` (11px) |
| `--cmc-brand` / `--cmc-accent-soft` | `#0071e3` | `#d6e9fb` | **3.78** | chips on accent wash |
| `--cmc-warning` / white | `#b26a00` | `#ffffff` | **4.24** | warning as body ink |
| `--cmc-warning` / canvas | `#b26a00` | `#f5f3ee` | **3.82** | |
| `--console-gray-600` / `--console-gray-100` | `#6c757d` | `#f8f9fa` | **4.45** | `.o_web_client` body + kanban headers `:79-82,284-291` |
| `--console-gray-600` / `--console-gray-200` | `#6c757d` | `#e9ecef` | **3.95** | todo steps on gray-200 `:1250-1251` |
| `--console-success` / white | `#28a745` | `#ffffff` | **3.13** | if ever used as text |
| `--console-info` / white | `#17a2b8` | `#ffffff` | **3.04** | |
| `--console-warning` / white | `#ffac00` | `#ffffff` | **1.88** | also **fails 3:1** as a graphic |

### Fail — UI / graphic 3:1

| Pair | Ratio | Where |
|---|---:|---|
| Kanban color 3 `#ffac00` on white | **1.88** | `--console-kanban-color-3` `console.css:28` via `console-kanban.tsx:66` |
| Attendance unmarked `#868e96` on `#f1f3f5` | **2.99** | `apps/admin/src/pages/teaching/attendance.tsx:54` (duplicated in `attendance-panel.tsx:32`) |
| WS todo `#868e96` on `#e9ecef` | **2.80** | `shifts.tsx:95` |
| WS todo `#adb5bd` on `#e9ecef` | **1.75** | `shifts.tsx:112` |

### Pass (keep)

| Pair | Ratio |
|---|---:|
| `--cmc-text` / `--cmc-surface` | 16.83 |
| `--cmc-text` / `--cmc-canvas` | 15.18 |
| `--cmc-text-muted` / white | 5.07 |
| `--cmc-text-muted` / canvas | 4.57 (bare AA) |
| `--cmc-brand` / white (and white on brand) | 4.70 |
| `--cmc-brand-ink` / `--cmc-brand-muted` | 8.66 |
| status-ink / status-soft (success/warning/danger/info/neutral) | 5.66–8.66 |
| `--console-gray-900` / gray-100 | 14.63 |
| white / `--console-brand-purple` | 5.28 |
| composited `rgba(255,255,255,0.9)` on `#71639e` (navbar `:107`) | **4.61** AA pass |
| Login `#f5f7ff` / `#101a35` | 16.08 |
| Login muted `#a9b3d6` / `#101a35` | 8.28 |

`--color-text-disabled` under the shell is `#6c757d` (`console.css:430`) — same as secondary. Disabled is indistinguishable from secondary, which is an a11y state problem even though the ratio on white (4.69) scrapes AA.

---

## 4. Dark mode

**Not defined. Not consistent. Not enough.**

| Check | Evidence |
|---|---|
| Dark token block | **None** in all three CSS files |
| `prefers-color-scheme` | **None** in `packages/ui/src` |
| `[data-theme]` / `.dark` | **None** |
| `color-scheme` | `light` only — `astryx-theme-cmc.css:83`, `console.css:431` |
| Form controls | Softened for light sunken fill (`astryx-theme-cmc.css:92-121`); no dark counterpart |
| Login | Local *dark-looking* page (`login.css:14-48`) that **rewrites** `--cmc-brand`, `--cmc-text`, `--cmc-danger`, surfaces — a one-off, not a theme |

Consequences if a user agent or OS requests dark:

- `color-scheme: light` forces light scrollbars/form native widgets.
- All `--cmc-*` stay cream/white; no inversion path.
- Login’s rewritten `--cmc-*` are scoped to `.login-page` and must not be mistaken for a dark theme (different brand `#4f7dfb`, decorative gradients the rest of the system forbids — `login.css:1-12,23,43-46`).

Product may have chosen light-only (TL12 soft-ops). The foundation still cannot *express* dark: there is no slot to fill. That is a theming-completeness fail, not a contrast fail.

---

## 5. Hard-coded hex / px in `apps/admin`

Scanned 171 source files under `apps/admin` (no `node_modules` / `dist`). Tests excluded from totals below.

| Metric | Count |
|---|---:|
| Color literals (hex + rgb/hsl) | **118** (hex 89 · rgb/a 27 · hsl/a 2) |
| `px` occurrences | **266** |
| of which `1px` hairlines | 79 |
| non-hairline `px` | **187** |
| `var(--` references (non-test) | **554** — most pages *are* tokenised |

### Heaviest files

| File | Colors | px | What it is |
|---|---:|---:|---|
| `apps/admin/src/pages/attendance/shifts.tsx` | **41** | **104** | Parallel `--ws-*` worksheet. Teal aliases `--cmc-brand` (`:44-45`) but neutrals are Bootstrap hex `:46-49` `#dee2e6/#6c757d/#fff/#f8f9fa`. Extra danger `#c92a2a/#fa5252/#fff5f5` (`:77,116-120`). Radius 2–3px. |
| `apps/admin/src/pages/login.css` | **38** | **45** | Dark door. Remaps `--cmc-brand` → `#4f7dfb` (`:23`), adds `#7c5cff` gradient (`scout sample ~:168`). |
| `apps/admin/src/components/soft-ops-fullcalendar.css` | **25** | 6 | FC stock navy `#2c3e50`, event `#3788d8`, `grey`/`red` named colors (`:12-32`). Filename says Soft Ops; values are FullCalendar defaults (comment `:1-6` admits this). |
| `apps/admin/src/pages/attendance/shifts-detail.tsx` | 4 | 9 | Ghost `--console-border` / `--console-bg-subtle` + hex fallbacks `:113-116`. |
| `apps/admin/src/pages/teaching/attendance.tsx` + `panels/attendance-panel.tsx` | 3+3 | 7+4 | Shared `UNMARKED_CONFIG` `#868e96/#f1f3f5` (2.99:1). |
| `apps/admin/src/pages/crm/report.tsx` + `bulk-import.tsx` | 0 | 10+10 | Repeated `padding: '0 22px 20px'` — 22px is on neither space scale. |
| `apps/admin/src/app.css` | 0 | 17 | Tokenised colors; leftover 44/52 tap targets + 18px checkbox. **Not a color problem.** |

`#101` in `classes/index.tsx` is a course-code comment, not a color.

---

## Findings

Severity = how badly the item **breaks the system** (one scale, one owner, one cascade), not ticket drama. P0 = the foundation cannot be trusted as a single language.

### P0

**[P0-1] Two design languages share one admin shell**  
- **Location:** `tokens.css:9-76` vs `console.css:12-74,79` vs flattening block `console.css:1170-1379`  
- **Category:** Implementation Integrity / Theming  
- **Impact:** Same page paints warm raised cards (`--cmc-raised-*`) next to cool `#f8f9fa` chrome and 4px sheets. Operators cannot form a stable visual model.  
- **Recommendation:** Decide the shell owner. Either (A) console chrome consumes `--cmc-canvas / --cmc-border / --cmc-text*` and keeps only density/geometry from Odoo, or (B) officially document two *named* themes (`cmc-soft` vs `console-odoo`) with no shared var names and no flattening that undoes the other. Do not leave both writing `--color-text-*`.  
- **Suggested command:** `/impeccable distill` (one language) then `/impeccable document`.

**[P0-2] `--font-size-*` / `--color-text-*` collision: Astryx pin loses to `.o_web_client`**  
- **Location:** `astryx-theme-cmc.css:63-81` (intent) vs `console.css:371-431` (winner) vs `astryx-provider.tsx:14-16` + `shell.tsx:130` (nesting) vs `console-astryx-remap.test.ts:42-50` (proof)  
- **Category:** Theming  
- **Impact:** Astryx Button/Text/Heading inside admin render on the Odoo ladder (15px `lg`, 10px `4xs`, cool `#212529`), not the CMC ladder the bridge claims to pin. LMS (no `console.css`) gets the other ladder.  
- **Recommendation:** Stop reusing Astryx’s names on `.o_web_client`. Prefix console remaps (`--console-font-size-lg`) **or** set the Astryx pins on `.o_web_client[data-astryx-theme], .o_web_client` *after* console.css. Change `astryx-theme-cmc.test.ts:16-24` to require `var(--cmc-fs-*)` / `var(--cmc-font-size-*)`, not a bare `--font-size-lg:`.  
- **Suggested command:** `/impeccable typeset`

**[P0-3] Status + brand color is not a closed set**  
- **Location:** CMC `tokens.css:11-13,28-40`; console `console.css:14-31`; login `login.css:23,43-46`; funnel `#5eb0ff` `console.css:1560`; FC `#3788d8` `soft-ops-fullcalendar.css:23`  
- **Category:** Theming  
- **Impact:** “One interactive blue `#0071E3`” (`tokens.css:4`) is false in production. Warning/success mean different hues in kanban vs badges.  
- **Recommendation:** Delete unused `--console-success/info/warning/danger`. Point kanban 2–5 at `--cmc-danger/--cmc-warning/--cmc-brand/--cmc-success` (or named semantic tokens). Ban a second brand hex; login should tint `--cmc-brand` via `color-mix`, not replace it.  
- **Suggested command:** `/impeccable colorize`

### P1

**[P1-1] `--cmc-text-faint` fails AA everywhere it is used as type**  
- **Location:** `tokens.css:20` `#a39e96`; consumers `console.css:1080-1082` (entity meta), `:1548` (funnel hint)  
- **WCAG:** 1.4.3 Contrast (Minimum) — 2.66:1 on white, 2.18–2.40 on warm surfaces  
- **Recommendation:** Darken to ≤ `#8a8580` (verify ≥4.5 on `--cmc-canvas` and `--cmc-surface-sunken`). Keep the current value only for 7px dots / decorative icons, under a new `--cmc-icon-faint`.  
- **Suggested command:** `/impeccable harden`

**[P1-2] Brand-on-muted chips and muted-on-sunken miss AA**  
- **Location:** `--cmc-brand` / `--cmc-brand-muted` 4.12:1 (`tokens.css:11,13`) used at 11px in `console.css:634-640,868-872,2159-2160`; `--cmc-text-muted` / `--cmc-surface-2` 4.34:1 (`tokens.css:19,24`) on `.console-filter-bar` `:688-695`  
- **Recommendation:** Chip ink → `--cmc-brand-ink` (already 8.66:1 on muted). Nudge `--cmc-text-muted` one step darker *or* stop putting muted copy on `--cmc-surface-2`/`sunken`.  
- **Suggested command:** `/impeccable harden`

**[P1-3] Console / kanban warning `#ffac00` fails even 3:1**  
- **Location:** `console.css:21,28`  
- **Ratio:** 1.88:1 on white  
- **Recommendation:** If the token stays, use it only as a 3px rail on a dark enough ink; text/icons use `--cmc-warning` / `--cmc-warning-ink`. Prefer deleting `--console-warning` (orphan) and pointing kanban-3 at `--cmc-warning`.  
- **Suggested command:** `/impeccable harden`

**[P1-4] No dark-mode slots**  
- **Location:** `astryx-theme-cmc.css:83`; `console.css:431`; absence of any `@media (prefers-color-scheme: dark)`  
- **Recommendation:** Either declare light-only in `tokens.css` header + `DESIGN.md`, or add a `[data-theme=dark]` / `.o_web_client[data-theme=dark]` block that reassigns the same `--cmc-*` names. Do not grow `login.css` into the dark theme.  
- **Suggested command:** `/impeccable document` (if light-only) or `/impeccable colorize` (if adding dark)

**[P1-5] Orphan console status/spacer/enterprise tokens + ghost `--console-border`**  
- **Location:** `console.css:16-22,51,58`; `shifts-detail.tsx:113-116`  
- **Recommendation:** Delete the seven orphans. Add `--console-border` / `--console-bg-subtle` as aliases of `--console-gray-300` / `--console-gray-100` **or** retarget the page to those existing names.  
- **Suggested command:** `/impeccable distill`

**[P1-6] `--console-sc-radius: 14px` is a third radius zone**  
- **Location:** `console.css:2181,2226` plus avatar `14px` (`:1062,2424`)  
- **Recommendation:** Snap to `--cmc-radius-control` (12) or `--cmc-radius-md` (16). Compact can stay 12.  
- **Suggested command:** `/impeccable layout`

**[P1-7] `apps/admin` worksheet + calendar bypass the token file**  
- **Location:** `shifts.tsx:42-49` (41 hex / 104 px); `soft-ops-fullcalendar.css:9-32` (25 color literals)  
- **Impact:** Half of all admin color hardcodes live in two files. WS muted `#6c757d` on `#f8f9fa` is 4.45:1; todo `#adb5bd` on `#e9ecef` is 1.75:1.  
- **Recommendation:** `--ws-border/muted/sheet/bg` → `--console-gray-*` or `--cmc-*`. FC `--fc-*` should at least map page/border/text/button to `--cmc-surface / --cmc-border / --cmc-text / --cmc-brand` unless a written exception says “FC demo fidelity wins.”  
- **Suggested command:** `/impeccable distill`

**[P1-8] Wrong CSS fallbacks invert the token if `tokens.css` is missing**  
- **Location:** `console.css:715,733-736`  
- **Recommendation:** Delete fallbacks (admin always loads `tokens.css` first) or copy the real hex/px. Never `4px` behind `--cmc-radius-control`.  
- **Suggested command:** `/impeccable harden`

**[P1-9] Tests do not protect the scale**  
- **Location:** `tokens.test.ts:22-41` (subset only); `console-tokens.test.ts:8-41` (string includes); `astryx-theme-cmc.test.ts:16-24` (declaration, not `var(--cmc-*)`)  
- **Recommendation:** Add: (1) every `--cmc-*` appears in `index.ts` or is listed as unused; (2) Astryx `--font-size-*` values are `var(--cmc-…)` not raw px; (3) contrast fixtures for the pairs in §3; (4) no second `--font-size-lg` under `.o_web_client` **or** an explicit allowlist.  
- **Suggested command:** `/impeccable harden`

### P2

**[P2-1] Spacing scale skips 12px while the file lives on 10/12/14**  
- **Location:** `tokens.css:48-51`; `console.css` px histogram  
- **Recommendation:** Insert `--cmc-space-2_5: 12px` (or rename to a 6-step 4/8/12/16/20/24) and replace the 71 raw `12px` in console composites.  
- **Suggested command:** `/impeccable layout`

**[P2-2] Radius aliases + STYLING-BRIDGE lie about `--cmc-radius-inner: 8px`**  
- **Location:** `tokens.css:44-47,79-81`; `STYLING-BRIDGE.md:44,58`; `astryx-theme-cmc.css:48-53`  
- **Recommendation:** Either add `--cmc-radius-inner: 8px` and map `--radius-inner` to it, or strike the 8px sentence from the bridge. Collapse `xs`/`card`/`dialog` into `control`/`md`/`lg` if they will always be equal.  
- **Suggested command:** `/impeccable document`

**[P2-3] Duplicate rule blocks in `console.css`**  
- **Location:** `.console-dash*` `:835-891` repeated `:892-948`; callout/av modifiers `:2404-2424` repeated under `.o_web_client` `:2433-2453`  
- **Recommendation:** Delete the first dash copy; keep one specificity layer.  
- **Suggested command:** `/impeccable distill`

**[P2-4] Off-scale type crumbs**  
- **Location:** `11.5px` `console.css:988,2329,2365`; `9.5px` `:2283`; `font-weight: 650` `:1073`  
- **Recommendation:** Snap to `--cmc-fs-label` (11) / `--cmc-fs-meta` (12) and weight 600.  
- **Suggested command:** `/impeccable typeset`

**[P2-5] Elevation uses cool black / raw brand rgba**  
- **Location:** `console.css:188,2460,2468` vs `tokens.css:73-76`  
- **Recommendation:** `box-shadow: var(--cmc-shadow-md)` on the app-switcher; session-card glow via `color-mix(in srgb, var(--cmc-brand) 10%, transparent)`.  
- **Suggested command:** `/impeccable polish`

**[P2-6] Login remaps `--cmc-brand` to a different blue**  
- **Location:** `login.css:23` `#4f7dfb` vs `tokens.css:11` `#0071e3`  
- **Recommendation:** Keep the midnight canvas; keep `--cmc-brand` as `#0071e3` (or `color-mix` a lighter *tint* of it). One accent.  
- **Suggested command:** `/impeccable colorize`

**[P2-7] Typed `tokens` object is incomplete; `--cmc-duration-fast` is used in `app.css:165-167` but absent from `index.ts`**  
- **Recommendation:** Generate the TS object from a single list, or fail `tokens.test.ts` when CSS has a `--cmc-*` that TS does not expose.  
- **Suggested command:** `/impeccable harden`

**[P2-8] 767 vs 768 mobile fork**  
- **Location:** `console.css:473,826` (`max-width: 767px`) vs `:276` and `astryx-theme-cmc.css:141` (`768px`); `tokens.css:151` documents `≤767`  
- **Recommendation:** One documented cut. Prefer `767` to match the comment in `tokens.css`, or `768` to match Astryx touch-target media.  
- **Suggested command:** `/impeccable adapt`

---

## Patterns (systemic, not one-offs)

1. **Name reuse as a theming strategy.** Console “remaps” Astryx by hijacking `--font-size-*` and `--color-text-*`. That cannot compose with a `:root` bridge.
2. **Odoo fidelity and CMC soft-ops are both enforced in the same stylesheet**, then the Odoo half *un-does* the CMC half (`.o_web_client .console-* { box-shadow: none; background: #fff; border-radius: 4px }`).
3. **Fallbacks and page-local CSS invent a third palette** (`#6b7280`, `#d1d5db`, `#868e96`, `#dee2e6`) that is neither CMC warm nor the declared console gray scale.
4. **Tests assert presence of strings, not the invariant.** A token can be orphaned, colliding, or unreadable and still green.
5. **Admin is mostly tokenised** (554 `var(--` vs 118 color literals). The remaining hex is concentrated — fix three files and the color leak mostly ends.

---

## Positive findings

- `tokens.css` itself is a coherent *soft-ops* kit: one brand, warm neutrals, nested 12/16/20, whisper elevation, motion + focus roles, status soft/ink pairs.
- `astryx-theme-cmc.css` refuses to invent `--radius-inner: 10px` (`:48-53`) — correct restraint.
- `console-tokens.test.ts:8-11` forbids document-global `:root` in `console.css` — LMS isolation is real.
- Admin `app.css` header (`:1`) is honest and mostly kept: no hardcoded palette.
- Login contrast on the midnight canvas passes AA comfortably.
- Soft/ink badge pairs (`tokens.css:31-40` used at `console.css:2426-2429`) all clear 4.5:1.
- Navbar `rgba(255,255,255,0.9)` on `#71639e` is 4.61:1 — close, but it passes.

---

## Recommended actions (impeccable commands)

1. **[P0] `/impeccable distill`** — one owner for color/type/radius inside `.o_web_client`; delete orphan `--console-success/info/warning/danger/spacer/enterprise-purple`; collapse duplicate dash/callout blocks.
2. **[P0] `/impeccable typeset`** — stop the `--font-size-*` collision; bind Astryx steps to `var(--cmc-fs-*)`; snap 11.5 / 9.5 / 15.
3. **[P0] `/impeccable colorize`** — close the brand set; retarget kanban + WS + FC to `--cmc-*` / `--console-gray-*`.
4. **[P1] `/impeccable harden`** — raise `--cmc-text-faint` and chip ink; fix fallbacks; add contrast + orphan + collision tests.
5. **[P1] `/impeccable layout`** — add the missing 12px space step; snap 14px radii.
6. **[P1] `/impeccable document`** — PRODUCT.md / DESIGN.md still missing (`context.mjs`: `NO_PRODUCT_MD`); fix `STYLING-BRIDGE.md` `--cmc-radius-inner` claim; state light-only or add a dark slot.
7. **[P2] `/impeccable adapt`** — one mobile breakpoint.
8. **[final] `/impeccable polish`** — elevation + Inter Variable consistency after the language is one.

Re-run `/impeccable audit` on these three CSS files after the P0 pass.

`/impeccable init` is still available: there is no `PRODUCT.md` / `DESIGN.md` at repo root. This audit treated the incumbent CSS as authority.

---

## How the five questions resolve

| # | Question | Answer |
|---|---|---|
| 1 | Consistent scale? | **No.** Two cores (CMC 4/8/16/24 + 12/16/20 + 11–32 roles; Console 3/4/6 + 10–24 Odoo + Bootstrap gray) plus unofficial 14px / 15px / 10px / 11.5px. |
| 2 | Dupes / orphans / overrides? | **Yes.** 18 colliding `--font-size-*` / `--color-text-*` / `--font-family-*`; 6 unused `--cmc-*`; 7 unused `--console-*`; ghost `--console-border`. |
| 3 | WCAG AA? | **Mixed.** Body ink on white/canvas passes. Fails listed in §3; worst `#ffac00` 1.88 and `--cmc-text-faint` 2.18–2.66. |
| 4 | Dark mode? | **No.** `color-scheme: light` only. Login is a scoped dark *page*, not a theme. |
| 5 | Admin hardcodes? | **118 colors / 266 px** (187 non-hairline). Heaviest: `shifts.tsx`, `login.css`, `soft-ops-fullcalendar.css`. |
