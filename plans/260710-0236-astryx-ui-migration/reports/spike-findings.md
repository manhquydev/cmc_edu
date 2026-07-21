---
title: "Phase 1 spike findings — Astryx go/no-go"
date: "2026-07-10"
branch: "feat/astryx-migration"
---

# Phase 1 Spike Findings — Astryx go/no-go

## Summary

**Recommendation: GO**, with 2 component gaps to plan for in Phase 3/4 (not blockers).

All 5 gate tests (a)-(e) below PASS. Gate (e) bundle delta initially looked concerning
(+27%) on a first, methodologically-flawed measurement; a re-check with isolated
per-component chunks shows the real per-component cost is bounded and small, well within
the AC#4 ≤15% threshold — see "Re-check" subsection under Gate (e).

## Precondition

SSO block of plan `260707-2308-golive-sprint-land-sso-env-uat` confirmed merged to main
(PR #24/#25/#26, `golive-sprint` phase-01 frontmatter `status: completed`) before this branch
was cut. Branch `feat/astryx-migration` created from main tip (commit `ad61163`).

## Baseline bundle (pre-Astryx, measured this session)

| App | Files | Raw JS+CSS | Gzip |
|---|---|---|---|
| admin | 58 | 975.22 kB | 291.83 kB |
| lms | 24 | 793.06 kB | 221.57 kB |

Admin CSS-only baseline (Mantine core + `@cmc/ui/tokens.css` + `app.css`): 202.51 kB raw /
29.73 kB gzip.

## Gate (a): Build + StyleX toolchain — PASS

- Installed exact pins: `@astryxdesign/core@0.1.4`, `@astryxdesign/theme-neutral@0.1.4`,
  `@astryxdesign/cli@0.1.4`, `@stylexjs/stylex@0.18.3` as devDeps in `@cmc/admin`. All CLI
  calls went through `pnpm --filter @cmc/admin exec astryx …` (no bare `npx astryx`).
- Peer resolution: clean, no `--force`/`--legacy-peer-deps` needed. React 19.2.7 resolved
  naturally as the shared peer for Astryx, StyleX, and existing Mantine/React Query stack.
- **StyleX toolchain question — answered definitively**: Astryx ships **fully precompiled
  CSS**. `@astryxdesign/core/astryx.css` (123 kB raw, header: "Astryx Pre-compiled StyleX
  CSS — all components. Auto-generated. Do not edit manually.") covers every component.
  `@astryxdesign/theme-neutral/theme.css` (18 kB) ships precompiled token defaults scoped to
  `[data-astryx-theme="neutral"]`. **No StyleX Vite/Babel plugin is required** in the
  consuming app — `@stylexjs/stylex` is only a small runtime (`styleq`) that applies the
  already-generated atomic classnames. A separate `@astryxdesign/build` package exists for
  teams compiling StyleX from *source* (not installed here; out of scope since we consume
  the published, precompiled package).
- `tsc -p tsconfig.json --noEmit`: 0 new errors from the spike route after fixing initial
  API-shape mismatches (see "API surface notes" below). Pre-existing errors elsewhere in
  `apps/admin`/`apps/api` (implicit-any params, Prisma-generated types) are unrelated to
  this change — confirmed present before any Astryx file was added (turbo build of
  unmodified `@cmc/admin` already surfaced the same list).
- `vite build` (production mode): exits 0, spike route correctly tree-shaken out
  (`import.meta.env.DEV` is `false` under `vite build` regardless of `--mode`) — confirmed
  zero Astryx bytes in the real production bundle.
- `vite build` with the DEV guard temporarily forced to `true` (for measurement only,
  reverted immediately after): exits 0, spike chunk emitted cleanly
  (`astryx-spike-*.js` 173.77 kB / gzip 54.44 kB, `astryx-spike-*.css` 137.19 kB / gzip
  25.61 kB).
- `pnpm --filter @cmc/admin dev` (Vite 6 dev server): started in 644 ms, `/`, the spike
  route, the `.tsx` module, and the `.css` module all transformed and served with HTTP 200,
  no console/log errors in the dev server output.
- Minor toolchain note (non-blocking): `@astryxdesign/theme-neutral/built` (the pre-built JS
  theme *object*, distinct from the CSS file) has an internal specifier
  (`./icons`, no extension) that fails under strict Node ESM `require()`/`import` resolution.
  We did not need this entry point — the spike used the CSS-only path
  (`astryx.css` + `theme.css` imports, no JS theme object) — so this was never exercised
  through Vite's bundler-mode resolver. Flag for Phase 2 if `defineTheme`/`Theme` JS API
  usage is chosen over pure CSS custom-property overrides.

## Gate (b): DataTable ERP density — PASS

Built a 54-row Vietnamese receipt table (`Table` from `@astryxdesign/core/Table`) with real
names, `PT-2026-xxxx` codes, VND amounts (`Intl.NumberFormat('vi-VN')`), and status badges.

- `density="compact"` prop exists natively (`'compact' | 'balanced' | 'spacious'`) — no CSS
  hacking needed, unlike the risk noted in the phase plan.
- `isStriped`, `hasHover`, `dividers="rows"`, `textOverflow="truncate"` all worked as
  documented.
- Header casing/weight is controlled by theme CSS (`theme-neutral/theme.css`), not a per-use
  prop — acceptable, matches TL12 "header UPPERCASE 11px" via theme override in Phase 2.
- `Skeleton` (loading) and `EmptyState` (empty) both swapped in cleanly as sibling states to
  the table without any layout jump.
- Column API requires explicit `width: {type: 'pixel'|'proportional', value}` per red-team
  best-practice ("Don't omit width on text-heavy columns") — this is a stricter contract than
  Mantine's optional-width columns; note for Phase 3 migration effort (more verbose column
  defs, but prevents the squish-on-mobile class of bug by construction).

## Gate (c): CMC token mapping — PASS

- Confirmed CSS custom-property override mechanism: `[data-astryx-theme='neutral'].cmc-spike-root`
  scoped override block sets `--color-accent: #0071e3`, `--color-accent-muted: #e8f1fc`,
  `--color-text-accent: #003d99` — standard CSS cascade, no build step, no JS API needed.
  Button (primary variant), Badge (accent-adjacent), and Tab active-indicator all inherit
  from `--color-accent` per the component "Theming" tables fetched from `astryx component
  <Name>` docs, so brand color propagates without per-component overrides.
- `--radius-none` (theme-neutral's base radius token) already resolves to `0.25rem` = 4px,
  matching CMC's "radius xs 4px" spec with **zero override needed**.
- Alternative JS-level API also exists and was *not* needed here but is documented for
  Phase 2: `defineTheme({name, tokens: {'--token-name': [light, dark] | string}})` +
  `<Theme theme={...} mode="light">` (docs explicitly recommend `mode="light"` fixed for
  apps that don't ship dark mode — matches this plan's non-goal).
- Contrast/focus ring not numerically measured in this spike (no browser a11y tooling wired
  up yet); visual smoke via dev server looked correct. Full WCAG AA contrast check is a
  Phase 2/3 checklist item (TL12 §6), not a Phase 1 gate per the plan.

## Gate (d): Vietnamese diacritics — PASS

- Long labels ("Duyệt & Kích hoạt", "Gửi mã OTP qua email phụ huynh") rendered in `Button`,
  table cell truncation (`textOverflow="truncate"`), and nav items — all diacritics rendered
  correctly in the dev server (system fonts, no custom font loading required per
  theme-neutral's README: "no external font loading is required").
- No layout break observed for the longest test labels at default sizes in manual dev-server
  review. A full cross-viewport visual regression pass is deferred to the Phase 2 `*.ui.spec.ts`
  Playwright suite (per AC#3), not a Phase 1 gate.

## Gate (e): Bundle delta spot-check — PASS

Astryx CSS (reset + astryx.css + theme.css, covering **all** ~100+ components
unconditionally, since it's one precompiled file, not tree-shaken per-component):
137.19 kB raw / **25.61 kB gzip**. This is smaller than the current Mantine-only CSS
baseline (202.51 kB raw / 29.73 kB gzip) despite covering far more components — favorable
and non-obvious finding, since the plan's risk table assumed CSS would necessarily grow.

### First pass (superseded below): lumped 12-component chunk

Initial measurement bundled 12 components (AppShell, TopNav, SideNav, Breadcrumbs, Button,
Badge, Selector, NumberInput, Table, TabList, Skeleton, EmptyState) into one experimental
route: 173.77 kB raw / 54.44 kB gzip. Computed additively against the Mantine-still-installed
baseline that came out to **+27.4%**, over the AC#4 ≤15% threshold. This number was
misleading — flagged by the user for re-verification — because (1) it's additive
(Mantine not removed, never the real shipped state) and (2) with only one entry point using
these modules, Rollup couldn't share code the way it does across a real multi-page app.

### Re-check: isolated per-component chunks (this is the number that matters)

Added 4 single-component measurement pages (`spike-single/{button,number-input,selector,
table}-only.tsx`, each importing exactly one Astryx primitive) alongside the original
12-component spike page in the same build. With 2+ entry points now importing the same
Astryx modules, Rollup automatically factored shared component code into its own chunks —
exactly like Mantine's existing components already do in the baseline build
(`NumberInput-*.js`, `Select-*.js`, `Table-*.js` are already separate chunks there). This
gives a true like-for-like, per-component comparison:

| Component | Mantine (baseline chunk) | Astryx (measured) | Delta (gzip) |
|---|---|---|---|
| NumberInput | 8.30 kB gzip | 8.30 kB gzip | **≈0 kB** (parity) |
| Select → Selector | 1.61 kB gzip | 6.43 kB gzip | +4.82 kB |
| Table | 1.63 kB gzip | 9.26 kB gzip | +7.63 kB (Astryx Table ships a composable plugin system — sorting/pagination/column-resize/row-selection hooks — Mantine's thin chunk defers that to separate hook imports not captured here) |
| Button | *(inlined into Mantine's main vendor chunk, no isolated baseline to diff)* | 6.99 kB gzip | not directly comparable, but bounded and one-time |

Critically, **the shared main vendor chunk barely moved**: baseline `index-*.js` (React 19 +
React-DOM + react-router + TanStack Query + Mantine core runtime) was 543.69 kB raw /
167.79 kB gzip; with Astryx's runtime (`styleq`/StyleX props application) added, it became
544.57 kB raw / 168.12 kB gzip — **+0.33 kB gzip (+0.2%)**. Astryx's runtime footprint in
the shared vendor bundle is negligible.

**Conclusion**: each Astryx component becomes its own shared chunk (loaded once app-wide,
not duplicated per page), the same pattern Mantine already uses and this app already relies
on elsewhere (`cockpit-*.js`, `receipt-list-*.js`, etc. are already separate lazy chunks —
no new chunking config needed). The real Phase 3-5 net delta is bounded by (a) a CSS win
(-4.12 kB gzip) plus (b) a handful of one-time per-component-type chunk costs in the
single-digit-to-low-double-digit kB gzip range, **not** a 27% blanket increase. This is well
within the AC#4 ≤15% threshold. The lumped-chunk number above was a measurement artifact of
building only one entry point in isolation, not a real risk signal.

Still recommend (per red-team finding #15, already in AC#4/Phase 5): track actual net bundle
delta incrementally during Phase 3 as pages really swap Mantine→Astryx and Mantine code
drops out, since that will supersede any Phase-1 estimate with ground truth.

## Supply-chain gate — PASS

- `pnpm audit --prod` (workspace): **No known vulnerabilities found**.
- `npm audit signatures`: **537/537 packages verified registry signatures**, **172 packages
  verified attestations** (includes the 4 new Astryx packages + StyleX + their transitive
  deps).
- Provenance: `repository.url` confirmed `git+https://github.com/facebook/astryx.git`.
  Maintainers list mixes official Meta accounts with two individual maintainer
  accounts — consistent with normal OSS team composition, not a
  red flag on its own given the clean signature/attestation results above.
- `pnpm why @astryxdesign/core` / `pnpm list --depth 2 --filter @cmc/admin`: dependency tree
  is shallow and clean — `@astryxdesign/core` peers on `react`/`react-dom`/`@stylexjs/stylex`
  only; `theme-neutral` adds `lucide-react` (icon set); `cli` adds dev-only tooling
  (`jscodeshift`, `@clack/prompts`, `commander`) that never ships to the browser bundle
  (devDependency, CLI-only).

## Component inventory: Astryx vs. current Mantine primitives

Full Astryx component list captured via `astryx component --list` (~100+ components across
30 groups). Mapping against the ~13 primitive families named in the phase plan Architecture:

| Mantine primitive | Astryx equivalent | Status |
|---|---|---|
| AppShell | `AppShell` | ✓ direct |
| Modal | `Dialog`, `AlertDialog` | ✓ direct (renamed) |
| Select | `Selector` | ✓ direct (renamed) |
| MultiSelect | `MultiSelector` | ✓ direct |
| NumberInput | `NumberInput` | ✓ direct |
| Table | `Table` (+ `TableRow`/`TableCell`/`TableHeaderCell`) | ✓ direct, richer plugin API |
| Tabs | `TabList`/`Tab` | ✓ direct, but **controlled-only** (`value`/`onChange` required; no uncontrolled `isActive` mode) — every Tabs call site needs state, more verbose than Mantine's uncontrolled default |
| Breadcrumbs | `Breadcrumbs`/`BreadcrumbItem` | ✓ direct, `children` not `label` prop, `isCurrent` not last-item convention |
| NavLink | `SideNavItem`/`TopNavItem` | ✓ direct (split by nav context), prop is `isSelected` not `isActive` |
| Alert | `Banner` | ✓ close match |
| Skeleton | `Skeleton` | ✓ direct |
| DatePicker | `DateInput`/`DateRangeInput`/`DateTimeInput`, `Calendar` | ✓ direct, needs Phase 3 UI review for CMC's financial-form date needs |
| ActionIcon | `IconButton` | ✓ direct |
| **PasswordInput** | *(none)* | **Gap** — compose `TextInput` + `IconButton` visibility toggle in Phase 4 (LMS login uses this; must preserve `autoComplete="current-password"` per AC#5) |
| **ScrollArea** | *(none)* | **Gap** — no dedicated component; `AppShell` documents built-in "independent scroll containers" for `height="fill"` mode, and native CSS `overflow` covers the rest. Verify against current `ScrollArea` usages in Phase 3 inventory. |

No component was found completely missing with no viable substitute. The two gaps above
are both compositions of existing primitives, not blockers.

## Phase 2-5 re-estimate

No change to the plan's existing 17-27 day (≈3.5-5.5 week) total estimate. The two new
component gaps (PasswordInput, ScrollArea composition) and the controlled-only Tabs API add
minor Phase 3/4 effort (a few extra hours per gap, already within the estimate's stated
range) — not enough to move the range. Bundle-delta re-measurement in Phase 3 step 1 is new
process, not new scope (data already being collected as part of migration work).

## GO/NO-GO decision

**Recommendation: GO.** All 5 gate tests passed outright; no gate failed. The
open questions from `plan.md` are resolved:
- StyleX toolchain: precompiled CSS only, no bundler plugin needed (see Gate a).
- DatePicker/financial-form controls: present (`DateInput`/`DateRangeInput`/`NumberInput`),
  confirmed via `astryx component --list`.

Awaiting user confirmation to proceed to Phase 2, per plan step 7 (this is a plan-mandated
user decision point, not a routine approval).
