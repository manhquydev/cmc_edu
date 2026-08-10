# Design System: CMC Console (Admin ERP UI Language)

## Status

**Status: shipped for admin (CMC Console).** Phases 1–6 of
`plans/260807-1453-cmc-console-design-system-rebrand-hardening/` rebranded the
former “Odoo-named” design layer to **CMC Console**, retired legacy
`ck-*`/`tpl-*` mirror classes, deleted dead `premium.css`, and locked sticky
list headers. Phase 4 visual smoke (real staff-login on synth DB): **8 PASS /
2 WARN / 0 FAIL** — see
`plans/260807-1453-cmc-console-design-system-rebrand-hardening/reports/visual-smoke-2026-08-07.md`
(residuals: empty CRM detail + cancelled receipt fixtures on base seed).

**CI:** `typecheck-and-test` + `ui-e2e` are required on `main`. PR #75
(`develop` → `main`) merged 2026-08-07 before this rebrand branch.

**LMS:** separate design language — `apps/lms/src/app.css` (`lms-*` classes).
LMS does **not** import `@cmc/ui/console.css`. `packages/ui/src/premium.css` was
**deleted** (Phase 2: zero LMS class emitters).

This document is the **sole evergreen design authority for `apps/admin`**.
It supersedes [docs/12-design-system-ui.md](./12-design-system-ui.md) (TL12)
**for admin only**.

---

## Provenance (historical — keep verbatim)

The Console layer is a **source-grounded recreation** of Odoo’s backend
web-client UI (not a fork of Odoo JS). Values and structure were studied under:

- **License:** LGPL-3
- **Upstream:** https://github.com/odoo/odoo
- **Branch:** `19.0`
- **Pinned commit:** `7de220c941c77d4fffdc270a7862c69475fa4577`

Pin reconciled 2026-08-07 (Phase 3): shipped CSS values match that commit in
the local sparse clone; prior header hash `5568f6e4…` was retired. Attribution
is also asserted in `packages/ui/src/console/console-tokens.test.ts`.

Do not strip this section for “branding.” It is license lineage and fidelity
anchor history.

---

## Implementation surface (code authority)

| Surface | Path |
|---------|------|
| CSS tokens + skins | `packages/ui/src/console.css` — import `@cmc/ui/console.css` once in admin |
| Shell scope | Root class **`.o_web_client`** (only deliberate Odoo DOM-mirror class name) |
| Navbar | `ConsoleNavbar` / `ConsoleNavbarProps` — `packages/ui/src/console/console-navbar.tsx` |
| Kanban | `KanbanBoard` / `KanbanColumn` / `KanbanCard` — `packages/ui/src/console/console-kanban.tsx` |
| Templates | `ListPage`, `DetailPage`, `FormPage`, `DashboardPage`, `ControlBar`, `FilterBar`, … under `packages/ui/src/components/` |
| Package export | `packages/ui/package.json` → `"./console.css"` |
| Maintainer map | [design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md](../design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md) |

**Admin shell** (`apps/admin/src/shell/shell.tsx`): `.o_web_client` +
`ConsoleNavbar` + `main.console-main`. Brand defaults to **active module
label** (e.g. cockpit → “Tổng quan”).

**Class prefix:** our template classes are **`.console-*`** (not `.o-*`).
Legacy `ck-*` / `tpl-*` retired (Phase 2). `sh-*` classes and the `SideNav` /
`AppFrame` components they styled were removed (2026-08-10) — 0 real
consumers in admin or LMS, superseded by `ConsoleNavbar`.

---

## Tokens (spot-check vs `console.css`)

Scoped under `.o_web_client`:

| Token | Value (shipped) | Role |
|-------|-----------------|------|
| `--console-navbar-height` | `46px` | Top bar |
| `--console-brand-purple` | `#71639e` | Navbar decorative brand |
| `--console-kanban-card-width` | `320px` | Kanban card |
| `--console-kanban-card-width-sm` | `300px` | Narrow kanban |
| `--console-success` | `#28a745` | Status green |
| `--console-font-size-base` | `14px` | Dense body |

Interactive accent remains CMC blue (`--cmc-brand` / `#0071E3`), not purple.

---

## Layout grammar (admin)

```
.o_web_client
├── .console-navbar          (46px; z-index ~1000)
│   ├── app-switcher toggle + menu
│   ├── .console-brand       (active module label)
│   ├── section menu items
│   └── .console-systray
└── main.console-main
    └── page templates (.console-wrap / ListPage / DetailPage / …)
```

**Float layers** (toast, command palette, dialogs) mount **outside**
`.o_web_client` with unscoped rules in `console.css` (z-index ladder: toast
~1100, cmd ~1200). Guarded by `console-float-layer.test.ts`.

**List sticky thead:** `.console-list thead th { position: sticky; top: 0; }`
(DataTable path). Unit: `console-list-sticky.test.ts`.

**Control panel densify:** under shell, `.o_web_client .console-control-bar`
uses flat band + `padding: 8px` — locked by `console-cp-sheet.test.ts`.

---

## Explicit non-goals

- LMS `lms-*` redesign
- Renaming `.o_web_client`
- Renaming `FilterBar` (locked by `scripts/check-ui-frames.mjs`)
- Full Odoo Search OS (facets / GroupBy / Favorites) — parked
- Automated visual-regression CI (screenshot policy gated; Phase 4 is ephemeral)

Deferred product gaps (not design-system naming): `leaderboard` / `refund`
FilterBar (backend + UX blockers).

---

## Verification

| Layer | Evidence |
|-------|----------|
| Unit locks | `console-tokens.test.ts`, `console-cp-sheet.test.ts`, `console-shell-stacking.test.ts`, `console-float-layer.test.ts`, `console-list-sticky.test.ts` |
| E2e | `PLAYWRIGHT_UI=1` ui-chromium; admin-shell brand + sticky thead |
| Visual smoke | Phase 4 report (real staff-login, synth DB) |
| Pin / LGPL | CSS header + tokens test |

---

## Related plans

- Rebrand plan: `plans/260807-1453-cmc-console-design-system-rebrand-hardening/`
- Prior rollout (closes after Phase 4 smoke + PR #75): `plans/260805-1920-design3-admin-rollout/`
- Ongoing Odoo source dissection (process plan — still “Odoo” in its title because it studies upstream): `plans/260806-odoo-ui-component-dissection/`
