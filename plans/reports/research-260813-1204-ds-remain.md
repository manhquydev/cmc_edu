---
title: Remaining design-system bottlenecks (shared-component professionalism)
date: 2026-08-13
time: "12:04"
type: research
scope: packages/ui + apps/lms + apps/admin showcase
method: ak-research + ak-scout (file inventory, git, import evidence)
gitnexus: unavailable
---

# Research: remaining DS bottlenecks for shared-component professionalism

**Verdict:** A+B locked cascade in tests/docs/CI. They did **not** make composites look like one family. Next cheapest professionalism win is gallery + four family merges, not renaming 17 CSS vars.

LMS stays primitive+tokens. Import evidence confirms it. Do not pull `console.css` into LMS.

## Executive summary

Phase A+B on `develop` (`c6062ad` #124, `901820f` #132, `af85b78` #125, `be2a8f5` #129) changed almost **zero pixels** in `@cmc/ui`. A rewrote a comment in `astryx-theme-cmc.css` and added a 3-sheet jsdom pin. B rewrote docs, wired dead CI gates, opened the inline-style ratchet to LMS, bumped three LMS meta sizes `2xs→sm`, and deleted a dead `.sh-*` comment. The 17 overlapping `--font-size-*` / `--color-text-*` / `--font-family-*` names remain, **on purpose**. Red-team already killed the rename. Do not reopen.

What still looks unprofessional is **four duplicate families** plus a **truncated showcase** (`apps/admin/src/pages/design-showcase.tsx` — datetime + workflow only). 40/50 `@cmc/ui` sources require `console.css`. LMS loads tokens + Astryx theme only and uses **zero** ListPage/DataTable/StatusBadge/MetricCard/StatCard/FilterBar/CountBadge.

Smallest next slice: restore the gallery, then merge one card, one badge, one empty density, one filter/table chrome. Pin those with computed-style tests in the existing 3-sheet suite. Stop there.

## Research methodology

- Sources: 50 `@cmc/ui` tsx/ts sources classified by CSS coupling; `git show` of A+B; LMS `from '@cmc/ui'` + CSS imports; family callers; CSS test files.
- Date of materials: as-built `develop` 2026-08-13 (`bc3f473` HEAD at scout).
- Plan/audit files treated as **claims**. Measured against git + files.
- GitNexus MCP unavailable — used glob/rg/`git` only.
- Heavy probes used: (1) CSS-coupling classifier, (2) git log/show A+B, (3) LMS import + CSS load, (4) family callers + showcase, (5) CSS test style (readFileSync vs getComputedStyle).

## 1. File inventory — `@cmc/ui` export coupling

Rule used:

| Bucket | Meaning |
|--------|---------|
| **HYBRID** | Astryx primitive import/JSX **and** `console-*` class |
| **CONSOLE-ONLY** | `console-*` class, no Astryx component |
| **ASTRYX-ONLY** | Astryx wrap/re-export, no console class |
| **ASTRYX+INLINE** | Astryx + `style={{…}}` (no console class) |
| **INLINE-ONLY** | `style={{…}}` only |

50 sources classified (48 component/console `.tsx` + `primitives.ts` + `astryx-provider.tsx`). Claimed “46 composites” ≈ the 48 tsx files; this inventory includes the two entry helpers.

**Counts:** HYBRID 11 · CONSOLE-ONLY 29 · ASTRYX-ONLY 5 · ASTRYX+INLINE 3 · INLINE-ONLY 2.

Admin `apps/admin/src/main.tsx` loads `tokens.css` → `astryx-theme-cmc.css` → `console.css`. LMS `apps/lms/src/main.tsx` loads `tokens.css` → `astryx-theme-cmc.css` only. Any CONSOLE-ONLY or HYBRID export is **admin-only at runtime** unless LMS starts importing `console.css` (do not).

### HYBRID (Astryx + console.css) — 11

| File | Astryx | Console chrome |
|------|--------|----------------|
| `packages/ui/src/components/confirm-dialog.tsx` | `AlertDialog` | `.console-dialog*` |
| `packages/ui/src/components/dashboard-page.tsx` | layout primitives | `.console-dash*` |
| `packages/ui/src/components/data-table.tsx` | `Table`, `Banner`, `Skeleton`, `EmptyState` | `.console-list` + 1 inline |
| `packages/ui/src/components/filter-bar.tsx` | `Selector`, `TextInput` | `.console-filter-bar` + **4 width:160/180 inlines** |
| `packages/ui/src/components/form-page.tsx` | slots | `.console-form-*`, `.console-wrap` |
| `packages/ui/src/components/list-page.tsx` | via `EmptyState`/`ControlBar` | `.console-wrap`, `.console-list-body` |
| `packages/ui/src/components/metric-card.tsx` | `Skeleton` | `.console-mc*` + 1 inline (attention dot) |
| `packages/ui/src/components/page-header.tsx` | `Stack`, `Breadcrumbs`, `Heading` | `.console-page-header`, `.console-bc*` |
| `packages/ui/src/components/stage-funnel.tsx` | `EmptyState` | `.console-cstrip*` + 2 inlines |
| `packages/ui/src/components/status-badge.tsx` | `Badge` (solid path) | `.console-badge-soft*` + 3 size inlines |
| `packages/ui/src/components/work-inbox.tsx` | `Skeleton`, `EmptyState` | `.console-inbox*` |

### CONSOLE-ONLY — 29

`avatar.tsx` · `bulk-action-bar.tsx` · `callout.tsx` · `command-palette.tsx` · `control-bar.tsx` · `count-badge.tsx` · `date-field.tsx` · `datetime-field.tsx` · `detail-page.tsx` · `entity-header.tsx` · `funnel-bar.tsx` · `highlight-strip.tsx` · `key-value-list.tsx` · `list-pagination.tsx` · `meta-row.tsx` · `panel.tsx` · `progress-steps.tsx` · `section-block.tsx` · `session-card.tsx` · `settings-section.tsx` · `settings-shell.tsx` · `shortcut-chip.tsx` · `stat-actions.tsx` · `task-row.tsx` · `time-field.tsx` · `toast.tsx` · `workflow-statusbar.tsx` · `packages/ui/src/console/console-kanban.tsx` · `packages/ui/src/console/console-navbar.tsx`

These **unstyle** if LMS imported them without `console.css`. That is the LMS isolation working as designed.

### ASTRYX-ONLY — 5

| File | Note |
|------|------|
| `packages/ui/src/primitives.ts` | one-door re-export (Text/Stack/Button/Badge/Card/…) |
| `packages/ui/src/components/empty-state.tsx` | thin wrap of Astryx `EmptyState` |
| `packages/ui/src/components/async-entity-combobox.tsx` | Astryx combobox |
| `packages/ui/src/components/cmc-tabs.tsx` | Astryx tabs |
| `packages/ui/src/components/result-panel.tsx` | Astryx |

Safe on LMS **if** a page needs them. LMS currently uses none of EmptyState/ResultPanel/CmcTabs/AsyncEntityCombobox.

### ASTRYX+INLINE (no console class) — 3

| File | Inline |
|------|--------|
| `packages/ui/src/components/stat-card.tsx` | value `fontSize: 24` hex color escape |
| `packages/ui/src/components/auth-inputs.tsx` | 2 (LMS login uses these) |
| `packages/ui/src/components/master-detail.tsx` | 3 layout widths |

### INLINE-ONLY — 2

| File | Why |
|------|-----|
| `packages/ui/src/components/line-icon.tsx` | SVG size |
| `packages/ui/src/astryx-provider.tsx` | `minHeight: '100%'` theme scope |

### CSS sheets (measured, not re-litigated)

| Sheet | Lines | Loaded by |
|-------|------:|-----------|
| `packages/ui/src/tokens.css` | 152 | admin + LMS |
| `packages/ui/src/astryx-theme-cmc.css` | 147 | admin + LMS |
| `packages/ui/src/console.css` | 2498 | **admin only** |

## 2. Smallest family-merge set

Do **not** merge SessionCard, KanbanCard, or Panel into the KPI card. Different jobs. YAGNI.

Do **not** merge CountBadge into StatusBadge. Count ≠ status. One caller (`shifts.tsx`).

Do **not** push StatusBadge/ListPage into LMS.

### Merge A — one card: StatCard → MetricCard chrome

**Problem:** two KPI languages. `StatCard` = Astryx `Card` + raw `<span style={{fontSize:24,fontWeight:700}}>`. `MetricCard` = `.console-mc` (flat, label+icon+value+context, attention dot). Callers: StatCard on `revenue-report.tsx` (3) + `crm/report.tsx` (8); MetricCard only on `cockpit.tsx` (4). DashboardPage comment says “KPI strip = MetricCard grid” but finance/CRM reports still use StatCard.

**Keep API of StatCard** (label/value/trend/color/loading — no forced href). Restyle it onto `.console-mc` without `Link`. Optional `href` can render MetricCard.

**Touch:**

- `packages/ui/src/components/stat-card.tsx` — drop inline 24px; use `.console-mc` / `.console-mc-value`
- `packages/ui/src/components/metric-card.tsx` — extract shared markup or accept StatCard as non-link sibling
- `packages/ui/src/console.css` — `.console-mc` allow `div` not only `a` (if selector is `a.console-mc`)
- `apps/admin/src/pages/finance/revenue-report.tsx` — visual only if class names change
- `apps/admin/src/pages/crm/report.tsx` — same
- `packages/ui/src/components/metric-card.test.tsx` — extend; no `stat-card.test.tsx` exists
- `apps/admin/src/pages/design-showcase.tsx` — side-by-side StatCard / MetricCard

**Do not touch:** `session-card.tsx`, `console-kanban.tsx`, `panel.tsx`.

### Merge B — one badge: StatusBadge size via CSS; LMS Badge stays

**Problem:** three chips. Astryx `Badge` (LMS + StatusBadge `appearance="solid"`). StatusBadge default `soft` = `.console-badge-soft` + inline `fontSize: 1.15em/0.9em`. CountBadge = `.console-count` (tab count, 1 admin caller).

**Merge:** StatusBadge soft is the admin status chip. Move sm/lg to `.console-badge-soft--sm/--lg`. Leave `solid` as an escape hatch or delete if rg shows zero `appearance="solid"` after a cheap grep at cook time. LMS keeps primitive `Badge` from `primitives.ts`. CountBadge stays.

**Touch:**

- `packages/ui/src/components/status-badge.tsx`
- `packages/ui/src/console.css` (`.console-badge-soft*`)
- `apps/admin/src/pages/design-showcase.tsx` — Badge vs StatusBadge vs CountBadge
- existing StatusBadge call sites only if class/DOM wrapper changes (many admin lists)

**Do not touch LMS Badge call sites:** `login.tsx`, `student/home.tsx`, `student/exercise.tsx`, `student/gifts.tsx`, `parent/homework-results.tsx`.

### Merge C — one empty: Astryx EmptyState + console density, not a second component

**Problem:** EmptyState is already the one component (ListPage, DataTable, WorkInbox, StageFunnel). Visual fight is **density**: Astryx empty looks marketing-sized inside ops lists. Command palette still uses a string: `command-palette.tsx` `.console-cmd-empty` “Không có kết quả”.

**Merge:** skin Astryx EmptyState under `.o_web_client` (tighter padding). Point command-palette empty at `<EmptyState>`. Keep `.console-inbox-empty` as padding wrapper only.

**Touch:**

- `packages/ui/src/components/empty-state.tsx` — optional `className` passthrough
- `packages/ui/src/console.css` — `.o_web_client` EmptyState density + existing `.console-inbox-empty`
- `packages/ui/src/components/command-palette.tsx`
- `apps/admin/src/pages/design-showcase.tsx`

**Already done, do not rework:** `list-page.tsx`, `data-table.tsx`, `work-inbox.tsx`, `stage-funnel.tsx` (they already mount EmptyState).

### Merge D — one filter/table chrome: kill FilterBar width hacks

**Problem:** FilterBar wraps every control in `style={{ width: 160 }}` (select/date) or `180` (text). ControlBar/ListPage/DataTable already share `.console-control-bar*` / `.console-list`. The amateur bit is the four inlines, not a missing template.

**Merge:** CSS on `.console-filter-bar > * { width: 160px }` and search field `180px`. Leave DataTable as hybrid (Astryx Table inside `.console-list`) — that hybrid is correct.

**Touch:**

- `packages/ui/src/components/filter-bar.tsx`
- `packages/ui/src/console.css` (`.console-filter-bar`)
- `packages/ui/src/components/filter-bar.test.tsx`
- `apps/admin/src/pages/design-showcase.tsx` — ListPage + FilterBar + DataTable composition

**Do not rewrite:** `control-bar.tsx`, `list-page.tsx`, `data-table.tsx` unless gallery needs a demo fixture.

### Gallery (cheapest professionalism gate — do first)

`apps/admin/src/pages/design-showcase.tsx` self-documents truncation: datetime + WorkflowStatusbar only. Route: `apps/admin/src/routes/design.routes.tsx`.

Restore four sections matching the merges above. That is the review surface. Without it, family merge is guesswork.

**Touch:** `apps/admin/src/pages/design-showcase.tsx` only for gallery. Do not invent a second Storybook.

## 3. What A+B actually changed in git vs what still fights visually

`git log --oneline -- packages/ui scripts .github` (head, 2026-08-13 wave):

| SHA | PR | What landed |
|-----|-----|-------------|
| `c6062ad` | #124 A | **Tests + 1 phantom token.** New `console-precedence.test.ts` (+261). Comment-only change in `astryx-theme-cmc.css` (cascade truth). `crm/report.tsx` `--cmc-text-supporting` → `--cmc-text-muted`. **No CSS value change.** |
| `901820f` | #132 A follow | More precedence pins (color + text-role). `scripts/ui-ratchet.mjs` counts `background`. **No visual CSS.** |
| `af85b78` | #125 B | Docs authority, `check-doc-authority.mjs` + CI wire, ratchet/frames open to `apps/lms/src` with grandfather baseline, `check:ui-a11y-roles` in CI. `console.css` **1 comment line**. `index.ts` drop dead `.sh-*` comment. LMS: pinch-zoom allowed; 3 meta `2xs→sm`. |
| `be2a8f5` | #129 B follow | STYLING-BRIDGE / VIEW-GRAMMAR forbid strings. **No UI pixels.** |
| `441c0d0` | #133 | Session journal + architecture CI-gate note. Not a visual PR. |

A+B file set under `packages/ui scripts .github`: `astryx-theme-cmc.css` (comments), `astryx-theme-cmc.test.ts`, `console-precedence.test.ts`, `console.css` (comment), `index.ts` (comment), `scripts/check-doc-authority.*`, `scripts/check-ui-frames.*`, `scripts/ui-ratchet.*`, `scripts/ratchet-baseline.json`, `.github/workflows/ci.yml`.

**Still fights visually (A+B did not touch):**

1. StatCard 24px inline vs MetricCard `.console-mc-value`
2. StatusBadge soft chips vs Astryx Badge vs CountBadge
3. FilterBar `width:160` vs ControlBar CSS
4. EmptyState Astryx air vs dense ops lists; command-palette string empty
5. Showcase cannot show (1)–(4) side by side
6. 17 overlapping CSS var **names** still resolve to different px inside vs outside `.o_web_client` — **intended Odoo density vs LMS type scale**, pinned by A. Not a bug. Renaming = pixel shift already rejected.

**CSS tests after A:** `console-precedence.test.ts` and `console-astryx-remap.test.ts` **do** inject CSS and `getComputedStyle` / `getPropertyValue`. Remaining string-only: `tokens.test.ts`, `astryx-theme-cmc.test.ts`, `console-tokens.test.ts`, `console-list-sticky.test.ts`, `console-cp-sheet.test.ts`, `console-shell-stacking.test.ts`, `console-float-layer.test.ts`. jsdom still drops `@import` of `theme-neutral` — A documented that. Next tests should extend the 3-sheet file with **family computed pins** (mc value size, badge padding, filter width), not convert every `includes()`.

## 4. LMS: stay primitive + tokens (confirmed)

**CSS load** (`apps/lms/src/main.tsx`):

```
@astryxdesign/core/reset.css
@fontsource-variable/inter
@cmc/ui/tokens.css
@cmc/ui/astryx-theme-cmc.css
./app.css
```

No `console.css`. Provider: `AstryxCmcProvider` only.

**Composite grep on `apps/lms`:** `ListPage|DataTable|StatusBadge|MetricCard|StatCard|FilterBar|CountBadge` → **0 matches**.

**Actual LMS `@cmc/ui` symbols:** `Badge`, `Banner`, `Button`, `Heading`, `HStack`, `Spinner`, `Stack`, `Text`, `TextArea`, `PasswordInput`, `TextField`, `Divider`, `Tab`, `TabList`, `ProgressBar`, `Selector`, `AstryxCmcProvider`. Auth composites (`TextField`/`PasswordInput` in `auth-inputs.tsx`) are Astryx+inline, not console.

LMS is a **student/parent phone surface**. Console ListPage/DataTable/Kanban is Odoo-dense admin chrome. Pulling it in would load 2498-line `console.css` + `.o_web_client` remaps and fight the Astryx type scale A just pinned for LMS.

Phase 06 “LMS primitives” in the hardening folder is still a claim. B already bought the cheap part (ratchet+frames on `apps/lms/src`, meta size bump). Remaining LMS work is **not** sharing admin composites.

## Comparative analysis

| Option | Professionalism | Pixel risk | Complexity | Maint | Fit |
|--------|-----------------|------------|------------|-------|-----|
| Rename 17 CSS vars | Fake unity; LMS+admin still want different density | **HIGH** (+45% heading per prior red-team) | Huge | Worse | Rejected |
| Import console.css into LMS | One chrome | HIGH on phone UI | Low | Couples apps | Reject |
| New token layer / 4th sheet | None | Medium | High | 4 sheets | Reject (YAGNI) |
| Gallery only | Reviewable | Near zero | Low | Low | Necessary, not sufficient |
| Family merge (A–D) + gallery + computed pins | Real | Low if CSS-class only | Medium | DRY | **Do this** |
| Delete StatCard, force MetricCard href | One card | Breaks report pages (no href) | Low | API lie | Reject |

## Ranked recommendation

1. **Gallery first** — `apps/admin/src/pages/design-showcase.tsx`: card, badge, empty, FilterBar+DataTable.
2. **FilterBar widths → CSS** (merge D) — mechanical, 2 files + test.
3. **StatCard onto `.console-mc`** (merge A) — the actual amateur KPI.
4. **StatusBadge size → CSS** (merge B) — LMS Badge untouched.
5. **EmptyState density + command-palette** (merge C).
6. **Computed pins** in `packages/ui/src/console/console-precedence.test.ts` (or a sibling family-proof file that injects the same 3 sheets). Do not mass-convert readFileSync tests.

**Do not:** rename overlapping CSS vars; load `console.css` in LMS; merge SessionCard/Kanban/Panel/CountBadge; build Storybook.

## Implementation recommendations (next cook, not this report)

Cook order: gallery → D → A → B → C → computed pins. Each step must be screenshotable on `/admin/design` (or whatever `design.routes.tsx` mounts). Claim done only with that page + `@cmc/ui` tests green.

## Resources

- As-built CSS: `packages/ui/src/{tokens,astryx-theme-cmc,console}.css`
- Barrel: `packages/ui/src/index.ts`, `packages/ui/src/primitives.ts`
- A pin: `packages/ui/src/console/console-precedence.test.ts`
- LMS entry: `apps/lms/src/main.tsx`
- Truncated lab: `apps/admin/src/pages/design-showcase.tsx`
- Claims (not evidence): `plans/260813-0120-design-system-hardening/phase-A-precedence-pin.md`, `phase-B-docs-and-gates.md`

## Limitations

- No browser screenshots; professionalism judged from source + callers.
- Did not run vitest/`pnpm --filter @cmc/ui test`.
- Did not rg `appearance="solid"` on StatusBadge (cook should).
- GitNexus impact/detect_changes unavailable.
- Classifier treats Astryx `Skeleton` as Astryx — MetricCard/WorkInbox count as HYBRID; that is accurate coupling, slightly generous vs “uses Astryx visual API”.

## Unresolved questions

- Does `a.console-mc` selector exclude a `div.console-mc` StatCard? Cook must read the CSS rule before restyle.
- Any StatusBadge `appearance="solid"` remaining in admin?
- Showcase route auth: is `/admin/design` reachable in local without extra flags?
- Phase C/D of the hardening plan (kanban truth, DataTable keyboard) are **out of this report’s family-merge scope** — they are a11y/CRM truth, not shared-family professionalism.
