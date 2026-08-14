# Hybrid bridge: `design-lab/system` → `@cmc/ui`

Lab-first living spec.

Updated 2026-08-14 after the D0-D5 improvement path. Waves 1-3, part of 5-6, and
the receipt half of wave 7 have landed; the rest is still unauthorized.
Measurements behind the decisions live in `CONFLICT-LEDGER.md`, which is the
authority for what may be aliased and what may not.

**Status of each wave is recorded in the wave table below.** Anything marked
"not authorized" must not be started without an owner decision, in particular
shell topology.

## Authority split

| Layer | Authority now |
|-------|----------------|
| Visual language (Linear + Stripe, ruled metrics, purple `#71639e`) | `design-lab/system`, `design-lab/cockpit-roles`, root `DESIGN.md` |
| Production list/form/statusbar chrome | `design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md` + `@cmc/ui` console CSS |
| Product behavior / SoD | Existing API + role policies (unchanged by lab) |

## Lab structure (what to bridge from)

| Path | Layer |
|------|--------|
| `tokens.css` | Primitive → semantic → component + density + print contexts |
| `system.css` | Shell, atoms, cross-module patterns, four page archetypes |
| `modules.css` + `modules/*.html` | Module grammar (CRM, Finance, Teaching, Students, HR, Engagement, Audit, Print) |
| `patterns.html` | Cross-module pattern gallery |
| `index.html` | Foundations gallery |
| `shell.js` | Density persistence, selection, board, attendance cycle, gradebook draft |

## Token map (three layers)

Bridge by **aliasing**, not renaming production first. Landed in wave D3: an
additive block at the end of `packages/ui/src/console.css`, scoped to
`.o_web_client`, defines the lab semantic vocabulary in terms of existing
`--console-*` values. It changes no existing declaration, and all 203 `@cmc/ui`
tests pass unchanged.

Two things make it safe, and both were measured rather than assumed:

- Exactly one of 121 lab public tokens collided by name with production:
  `--radius-container` (lab 8px vs the contract's 4px). The lab token was renamed
  to `--radius-panel`, so the vocabularies no longer overlap.
- No production rule consumed any lab token name, so defining them cannot change
  a resolved value anywhere.

Production values win. A component written against these names renders with 4px
radii and the OpenEduCat palette, not the gallery's near-white 6/8px look.

| Lab semantic | Proposed `@cmc/ui` alias | Notes |
|-------------|--------------------------|--------|
| `--surface-action` / `--surface-action-hover` | Brand / primary action | Keep `#71639e` |
| `--surface-page` / `--surface-default` / `--surface-sunken` | Page / panel / table header | Near-white ledger |
| `--text-default` / `--text-muted` / `--text-faint` | Body / secondary / tertiary | |
| `--border-default` / `--border-strong` | Hairline / strong rule | |
| `--size-row` (40 default · 32 compact · 48 comfortable) | DataTable density | Default stays 40px for OpenEduCat contract |
| `--radius-control` 6 / `--radius-container` 8 / `--radius-contract` 4 | Control / container / contract | Statusbar keeps 4px |
| `--focus-ring` | Focus | 2px surface + 4px purple |
| `--table-*` / `--btn-*` / `--field-*` / `--statusbar-*` | Component tokens | Map last; use sparingly |

Density ships as `data-density`, on `.o_web_client` for the shell and on
`.console-list` for a single table, remapping only size and spacing semantics.
The type ramp does not change and 40px stays the default row.

## Component map

| Lab pattern | `@cmc/ui` export | Bridge approach |
|-------------|------------------|-----------------|
| Shell / sidebar / utility | Admin shell | Token + chrome pass |
| `.page-head` | `PageHeader` | Title + subtitle |
| `.metrics` | Dashboard metric strip | Ruled columns, not cards |
| `.control-bar` + `.filter-bar` + saved views + URL state | `ControlBar`, `FilterBar` | Persist filters in URL |
| `.data-table` + sticky header + freeze + bulk bar | `DataTable` | Select-all-across-filter copy |
| `.badge` six tones | `StatusBadge` | Shared vocabulary across modules |
| `.tabs` | `CmcTabs` | Purple underline |
| `.statusbar` | `ProgressSteps` | Keep OpenEduCat chevron geometry |
| `.funnel` | `StageFunnel` | CRM rail |
| `.gate` | New or DetailPage slot | Second-eyes threshold UI |
| `.board` | `console-kanban` | O1→O5 pipeline |
| `.schedule` / `.matrix` / `.grade-input` | Teaching-specific | Do not invent page frames |
| `.ledger` | Audit / refund timeline | Append-only copy |
| `.receipt` + `@media print` | Print surface | Token context flip |
| Empty ×3 / skeleton | List states | first-run / filtered / done |
| Toast / command palette | App toast + palette | Lab proves interaction |

## Wave order and status

| Wave | Scope | Status |
|------|-------|--------|
| 1 | Lab integrity: undefined spacing token, corrupted rule, flat-by-default leaks, Layer-3 purity, print purity, Inter 550, page-scoped density, focus mechanism | **Landed** (D0), verified in a real browser |
| 2 | Alias tokens into `console.css` over existing values, no layout rewrite | **Landed** (D3), additive and scoped |
| 3 | Density on `DataTable` only | **Landed** (D4) via `density` prop |
| 4 | Atoms: badge tones, button states, tabs indicator | **4A partial** (2026-08-14): `StatusBadge` + `brand` waiting tone + `CategoryChip` a–d. Button states + tabs indicator = **4B not started**. |
| 5 | List molecules: control bar, filters, saved views, bulk bar with across-filter selection, sticky header | **Partly landed** (D4): across-filter selection and sortable headers with `aria-sort`; saved views not started |
| 6 | Archetype spacing + empty kinds | **Partly landed** (D4 + cook): empty kinds on receipts + CRM list + courses; archetype spacing untouched |
| 7 | Gate + statusbar | **Partly landed** (D5): the receipt approval gate now names the rule and the authority. Statusbar geometry untouched, and stays untouched. |
| 8 | Module grammar, one module per PR | **CRM partial** (cook 260814) + Students honesty (#144); **Classes empty recipe** = plan `260814-2346`. Next modules = separate PRs. |
| 9 | Role cockpits / admin home shells | **Not authorized.** Requires the Q-shell decision. |

## ListPage adoption recipe

Use this checklist for each admin list PR. Prefer under-claiming over lying.

1. **Detect applied filters** from the same values that hit the API (debounced search, committed select) — not raw keystrokes.
2. **Empty kind evidence**
   - No filters + `total === 0` → `TableEmptySpec` `first-run` with a product-valid create/import action.
   - Filters on + proven baseline that rows exist outside the filter (unfiltered total, facility counts, etc.) → `filtered` + clear-filters action.
   - Filters on + **no** baseline → bare **string** empty (neutral). Never invent `filtered` or `done`.
3. **Page clamp** when `page > totalPages` before choosing empty copy.
4. **Sort** only if the list API accepts validated sort fields. Otherwise no `sortable: true`.
5. **Bulk widen** (`onSelectAllMatching`) only if the backend can materialize all matching IDs. Otherwise page-only selection copy.
6. **Status vs category:** `StatusBadge` / SoftTones for lifecycle; `CategoryChip` for taxonomy. Document any enum→category map in this file (see below). Do not invent maps in cook.
7. **Tests:** filter off empty; filter on (filtered *or* neutral string); Funnel/board pages must never set `ListPage.isEmpty` if chrome must stay.

### Program → CategoryChip (courses)

| Program | Category |
|---------|----------|
| `UCREA` | `a` |
| `BRIGHT_IG` | `b` |
| `BLACK_HOLE` | `c` |
| _(reserved)_ | `d` unused |

Proven on `apps/admin/src/pages/courses/index.tsx`.

## Out of scope until authorized

- Replacing the admin Product OS (46px navbar + 58px control panel) with the
  gallery's 240px rail. The Shared-Chrome Rule is scoped to the lab.
- Repainting production to the gallery palette or its 6/8px radii. The visual
  contract wins; see `CONFLICT-LEDGER.md`.
- Porting statusbar chevron geometry or funnel trapezoid geometry from the lab.
- Porting lab interaction demos as if they were contracts: kanban drag-drop,
  attendance cycling, gradebook drafts, and client-side sorting in the gallery
  have no permission or stage guards and no server round trip.
- Porting lab HTML into React as a parallel component library.
- Installing Tailwind / shadcn (banned in product apps).
