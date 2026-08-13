# L3 — DOC↔CODE DRIFT AUDIT

**Lane:** L3 (truth only — not aesthetics)  
**Date:** 2026-08-13  
**Branch:** `audit/design-system-impeccable` (worktree, merge-base `develop` `69ab8fc`)  
**Subject:** `docs/design-system-console.md` vs live code  
**Mode:** read-only. No code edits. No `pnpm install` / `pnpm build`.  
**Method:** `/ak-engineer:ak-scout` (3 Explore scopes: `@cmc/ui` surface, admin/LMS boundary, TL12 + plans) + main-agent `rg`/`ls`/`git show` confirmation. Quality bar from `/impeccable` audit playbook: measurable implementation integrity only — no visual scoring.

**Verdicts:** `VERIFIED` = file:line agrees · `DRIFT` = code or another evergreen doc disagrees · `UNVERIFIABLE` = not locally provable (GitHub settings, production deploy).

---

## Executive verdict

`docs/design-system-console.md` is **mostly true about the shipped admin surface**. Every path in the Implementation surface table exists. Legacy `ck-*` / `tpl-*` / `odoo-*` / `sh-*` have **zero live CSS selectors and zero live `className` emitters**. `packages/ui/src/premium.css` is gone and has **no runtime import**. LMS does **not** import `@cmc/ui/console.css` or emit `console-*`. Admin does **not** emit `lms-*`. The Odoo pin `7de220c941c77d4fffdc270a7862c69475fa4577` **is** asserted in `console-tokens.test.ts`.

The dangerous lie is not inside the console doc’s code map. It is **authority split**: the console doc declares itself the sole admin SoT, but TL12’s body and several still-indexed kit/index docs still prescribe the retired AppFrame / SideNav / `ck-*` / `tpl-*` / `.premium-` / `premium.css` world. A new frontend agent following `docs/README.md` (“Frontend dev → TL12”) would implement the wrong language.

| Count | Verdict |
|------:|---------|
| 28 | VERIFIED |
| 8 | DRIFT |
| 2 | UNVERIFIABLE |

---

## 1. Implementation surface — every path

| Doc claim | Evidence | Verdict |
|-----------|----------|---------|
| CSS tokens + skins = `packages/ui/src/console.css`; import `@cmc/ui/console.css` once in admin | File exists (93 184 B). Import: `apps/admin/src/main.tsx:19`. Header: `packages/ui/src/console.css:10` | **VERIFIED** |
| Shell scope root class `.o_web_client` | `packages/ui/src/console.css:12,76`. Only live `className`: `apps/admin/src/shell/shell.tsx:130` | **VERIFIED** |
| Navbar = `ConsoleNavbar` / `ConsoleNavbarProps` at `packages/ui/src/console/console-navbar.tsx` | `:12` interface, `:24` function. Barrel `packages/ui/src/index.ts:174–175` | **VERIFIED** |
| Kanban = `KanbanBoard` / `KanbanColumn` / `KanbanCard` at `packages/ui/src/console/console-kanban.tsx` | `:13`, `:26`, `:53`. Barrel `index.ts:176–181` | **VERIFIED** |
| Templates `ListPage`, `DetailPage`, `FormPage`, `DashboardPage`, `ControlBar`, `FilterBar` under `packages/ui/src/components/` | `list-page.tsx:32`, `detail-page.tsx:52`, `form-page.tsx:21`, `dashboard-page.tsx:26`, `control-bar.tsx:18`, `filter-bar.tsx:33` | **VERIFIED** |
| Package export `packages/ui/package.json` → `"./console.css"` | `packages/ui/package.json:16` `"./console.css": "./src/console.css"`; also `"files"` `:22` | **VERIFIED** |
| Maintainer map `design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md` | File exists; header `:1–6` points at this console doc | **VERIFIED** |
| Admin shell = `.o_web_client` + `ConsoleNavbar` + `main.console-main` | `apps/admin/src/shell/shell.tsx:130–142` | **VERIFIED** |
| Brand defaults to active module label (cockpit → “Tổng quan”) | Navbar default `console-navbar.tsx:18–19,39–40`. Shell `brand={activeId ? undefined : 'CMC EDU'}` `shell.tsx:137–138`. Cockpit label `nav-registry.ts:9`. Unit `shell.test.tsx:127–128`. E2e `apps/e2e/tests/admin-shell.ui.spec.ts:41–42` | **VERIFIED** |
| Class prefix `.console-*` (not `.o-*`); only deliberate Odoo DOM-mirror is `.o_web_client` | Live `className` `o_*`: only `o_web_client`. CSS selectors `.o-*` / `.o_*` besides `.o_web_client`: **0**. Adjacent leftover (not claimed retired): `.fp-action` `console.css:1865` + comment in `form-page.tsx:10` | **VERIFIED** (prefix claim) + note `.fp-action` |
| Legacy `ck-*` / `tpl-*` retired | See §2 | **VERIFIED** |
| `sh-*` + `SideNav` / `AppFrame` removed; 0 real consumers | No CMC `AppFrame` file/export. No live `.sh-*` selectors/`className`. Admin/LMS do not import CMC AppFrame. Residual: Astryx `SideNav` re-export `packages/ui/src/primitives.ts:35–41`; stale comments `index.ts:166–169`, `console.css:1394` | **VERIFIED** (live) / **DRIFT** (comments + name still in barrel) |

---

## 2. Residual `ck-*` / `tpl-*` / `odoo-*` (doc: retired)

Probes (live CSS after comment-strip + `className=` in `*.{ts,tsx}`):

| Prefix | Live CSS selectors | Live `className` | What remains |
|--------|-------------------:|-----------------:|--------------|
| `ck-*` | 0 | 0 | Comments only (`console.css:1160,2403`) + absence test `schedule-fc-events.test.ts:51–62` |
| `tpl-*` | 0 | 0 | Comments. Fixture **data id** `tpl-1` in `shift-config.test.tsx:16` (not a CSS class) |
| `odoo-*` | 0 | 0 | Absence test `.odoo-lab-` `console-tokens.test.ts:26`. Comment analogues `.o_main_navbar` etc. are not selectors |
| `sh-*` | 0 | 0 | Comments + absence test `shell.test.tsx:172–174` (`.sh-root` / `.sh-nav` / `.sh-sb`) |

**Verdict: VERIFIED.** The console doc is not lying about retirement. Residuals are comments, tests that assert *absence*, and one data-id collision (`tpl-1`).

---

## 3. `packages/ui/src/premium.css`

| Claim | Evidence | Verdict |
|-------|----------|---------|
| File deleted | `ls`: `No such file or directory`. Tombstone `console.css:1385` | **VERIFIED** |
| Zero LMS class emitters / no import | `rg premium.css` in `*.{ts,tsx,js,mjs,json,css}` → only that comment. LMS `apps/lms/src/main.tsx:16–18` imports `tokens.css` + `astryx-theme-cmc.css` + `./app.css` only | **VERIFIED** |
| Package helper still tells authors to import it | `packages/ui/llms.txt:79` “then `premium.css` once at app root.” Also `llms.txt:83` still cites deleted `/design` lab | **DRIFT** (P1) |

---

## 4. Boundary leak

| Direction | Probe | Result | Verdict |
|-----------|-------|--------|---------|
| LMS → console.css | `rg '@cmc/ui/console.css'` under `apps/lms` | 0 | **VERIFIED** isolated |
| LMS → `console-*` classes | `rg 'console-'` under `apps/lms` | 0 | **VERIFIED** isolated |
| Admin → `lms-*` | `rg 'lms-'` under `apps/admin` | 0 | **VERIFIED** isolated |
| LMS language | `apps/lms/src/app.css:11–85` `.lms-shell`, `.lms-topbar`, `.lms-page`, `.lms-star-hero`, `.lms-child-chip` | matches doc | **VERIFIED** |

Shared `@cmc/ui` primitives (Button, Text, AstryxCmcProvider) are used by LMS; that is token/primitive sharing, not console-class leak.

---

## 5. TL12 (`docs/12-design-system-ui.md`) vs console

**Banner agrees** (`12-design-system-ui.md:8–13`): superseded for admin; still SoT for LMS + `--cmc-*`.

**Body contradicts both its own banner and the console doc.**

| Topic | TL12 | Console / code | Verdict |
|-------|------|----------------|---------|
| Admin language name | “Odoo backend UI language” `:8–9` | Rebranded to **CMC Console**; Odoo is provenance only | **DRIFT** |
| Admin chrome | `AppFrame` + `SideNav`, blur topbar, left tree `:27,95–97` | `.o_web_client` + `ConsoleNavbar` + `main.console-main`. No AppFrame file | **DRIFT** (P0) |
| Class prefixes | `--sh-*`, `--tpl-*` at app root `:29`; composites via `.premium-` `:87`; later “`.tpl-*` retired” `:109` | Live prefix `.console-*`; `ck-*`/`tpl-*`/`sh-*`/`premium-` selectors = 0 | **DRIFT** (P0) |
| `premium.css` | Never says deleted; “premium layer” described as current `:23–30` | File deleted | **DRIFT** (P1) |
| Shared tokens TL12 still claims to own | Canvas `#F7F6F3` `:25,79`; faint `#AEAEB2` `:37`; data type 13px `:38`; §4.5 pill radius 12px `:80` | `tokens.css:11` `--cmc-brand: #0071e3`; `:20` `--cmc-text-faint: #a39e96`; console base 14px; `--cmc-canvas` is `#f5f3ee` (scout). Accent `#0071E3` **agrees** | **DRIFT** on values TL12 claims as SoT |
| Status | “21/21 admin ERP” premium adoption 2026-07-12 `:111–116` | Console shipped 2026-08; FilterBar holdouts remain | **DRIFT** (stale snapshot) |
| LMS split | LMS = `app.css` / `lms-*`; do not import console.css `:118` | Same | **VERIFIED** aligned |
| Index still sends frontend to TL12 | `docs/README.md:15,41` “Frontend dev → TL12 (design)” — no console pointer | Console `:21` “sole evergreen … for `apps/admin`” | **DRIFT** (P0 authority split) |

Other evergreen files that still teach the retired admin world (not TL12, but same lie):

- `design-system/cmc-edu/STRUCTURE.md:3,19` — authority includes `.ck-*`; utilities `.ck-surface`
- `design-system/cmc-edu/PAGE-FRAMES.md` — admin shell AppFrame/SideNav + `tpl-wrap` / `.ck-*` (mixed later with `.console-*`)
- `design-system/cmc-edu/MASTER.md` — page layout AppFrame + SideNav
- `docs/18-tech-stack-va-chuan-ky-thuat.md` — premium layer + AppFrame/SideNav
- `docs/15-ra-soat-dong-bo-va-register.md` — TL12 🟢, no supersede
- `packages/ui/src/index.ts:166–169` — “Requires … (`.sh-*` classes)” above a comment that no longer exports AppFrame

Docs that correctly point at the console doc: `docs/system-architecture.md:13,77`, `docs/WORKSPACE-LEAN.md`, `design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md:6`.

---

## 6. Odoo pin `7de220c941c77d4fffdc270a7862c69475fa4577`

| Surface | Evidence | Verdict |
|---------|----------|---------|
| CSS header | `packages/ui/src/console.css:4–7` LGPL-3, github.com/odoo/odoo, branch `19.0`, full hash; prior `5568f6e4…` retired | **VERIFIED** |
| Unit assertion | `packages/ui/src/console/console-tokens.test.ts:29–31` `expect(css.includes('LGPL-3'))` + `expect(css.includes('7de220c941c77d4fffdc270a7862c69475fa4577'))` | **VERIFIED** |
| Other listed unit locks | `console-cp-sheet.test.ts`, `console-shell-stacking.test.ts`, `console-float-layer.test.ts`, `console-list-sticky.test.ts` exist; they lock layout, **not** the pin | **VERIFIED** (doc does not claim they assert the hash) |

The pin test is a **string-in-header** lock, not a re-hash of upstream SCSS. That matches what Phase 3 already recorded (`plans/260807-1453-…/reports/fresh-fidelity-audit-2026-08-07.md:16`). Not a drift of the console doc’s claim (“Attribution is also asserted in `console-tokens.test.ts`”).

---

## Remaining claims in `docs/design-system-console.md`

| Claim (doc lines) | Evidence | Verdict |
|-------------------|----------|---------|
| Status shipped; Phases 1–6 rebranded Odoo-named layer | Plan dir exists, `status: completed`. Live surface is Console-named | **VERIFIED** (code + plan). Production deploy **UNVERIFIABLE** here |
| Visual smoke 8 PASS / 2 WARN / 0 FAIL | `plans/260807-1453-cmc-console-design-system-rebrand-hardening/reports/visual-smoke-2026-08-07.md:19–32`. Residuals = empty CRM detail + no receipt rows | **VERIFIED** (report exists and matches). Re-run not executed this lane |
| CI `typecheck-and-test` + `ui-e2e` required on `main` | Jobs exist: `.github/workflows/ci.yml:28`, `.github/workflows/ui-e2e.yml:1,108`. Comments + `docs/system-architecture.md:17,513` + `dependabot-auto-merge.yml:30–32` say both are required. `ui-e2e.yml:80–104` historically said the controller “will also add” `ui-e2e` to protection | **UNVERIFIABLE** (GitHub branch-protection JSON not in-repo). Supported by docs/workflows |
| PR #75 `develop`→`main` merged 2026-08-07 before rebrand | `git show 240bec1`: `2026-08-07 16:50:06 +0700` “Merge pull request #75 from manhquydev/develop” | **VERIFIED** |
| Related plan paths | `plans/260807-1453-cmc-console-design-system-rebrand-hardening/`, `plans/260805-1920-design3-admin-rollout/`, `plans/260806-odoo-ui-component-dissection/` all exist | **VERIFIED** |
| Tokens table (`46px`, `#71639e`, `320px`/`300px`, `#28a745`, `14px`) | `console.css:14,19,41,54,66–67` exact | **VERIFIED** |
| Interactive accent CMC blue `--cmc-brand` / `#0071E3` | Not declared on `.o_web_client`. Lives in `packages/ui/src/tokens.css:11` `--cmc-brand: #0071e3` (same color, lowercase). Used throughout `console.css` (e.g. `:570`) | **VERIFIED** color / **DRIFT** hex case + “scoped under `.o_web_client`” table placement |
| Layout grammar + navbar z ~1000 | `.console-navbar` `console.css:94–100` `z-index: 1000` | **VERIFIED** |
| Float layers mount **outside** `.o_web_client`; z toast ~1100, cmd ~1200 | Toast: `ToastProvider` wraps the router `apps/admin/src/main.tsx:40–44` → viewport **outside** `.o_web_client`. Unscoped CSS `console.css:1722–1723` `z-index: 1100`. **CommandPalette is a child of `.o_web_client`** `shell.tsx:145–154` (no portal). Unscoped `.console-cmd` `console.css:2019–2020` `z-index: 1200`. ConfirmDialog: no `createPortal` | **DRIFT** (cmd/dialog mount location). CSS unscoped so paint still works |
| List sticky `.console-list thead th { position: sticky; top: 0; }` | `console.css:243–245`. Unit `console-list-sticky.test.ts:9–13`. E2e `admin-shell.ui.spec.ts:71–95` | **VERIFIED** |
| Control panel densify: `.o_web_client .console-control-bar` flat band + `padding: 8px` | `console.css:1171–1178` flat white band, `padding: 8px 16px 10px`. Test `console-cp-sheet.test.ts:44–48` only locks `/padding\s*:\s*8px/` | **DRIFT** (shorthand vs 3-value) |
| Non-goal: do not rename `.o_web_client` | Still the only live Odoo class | **VERIFIED** as current state |
| Non-goal: renaming `FilterBar` locked by `scripts/check-ui-frames.mjs` | Script exists; lists `FilterBar` `:43` and counts it `:78,157`. `--strict` (`:174–184`) fails only `bulkListsOk` and dual-title. CI runs `pnpm check:ui-frames` = `--strict` (`package.json:22`) — **still would not fail a rename** (count → 0) | **DRIFT** (P1 false gate) |
| Deferred: `leaderboard` / `refund` FilterBar | `leaderboard.tsx:1–31` ListPage + EmptyState, no FilterBar. `refund.tsx` ListPage + DataTable, no FilterBar. Extra holdout **not listed**: `apps/admin/src/pages/enrollment/class-placement.tsx` (no FilterBar; named in `docs/system-architecture.md:15`) | **VERIFIED** named pair / **DRIFT** incomplete list |
| Unit lock files listed | All five exist under `packages/ui/src/console/` | **VERIFIED** |
| E2e `PLAYWRIGHT_UI=1` ui-chromium; brand + sticky thead | `apps/e2e/playwright.config.ts:8,117`. Specs `admin-shell.ui.spec.ts:38–42,71–95` | **VERIFIED** |

---

## Severity (danger of the document being wrong)

Impeccable audit severity, applied to **doc-lies**, not a11y/perf.

### P0 — would send the next implementer into the retired language

1. **Authority split: console claims sole admin SoT; TL12 body + docs index + kit still teach AppFrame / SideNav / `ck-*` / `tpl-*` / `.premium-`.**  
   - Console: `docs/design-system-console.md:21–23`.  
   - TL12 body: `docs/12-design-system-ui.md:27,29,87,95–97`.  
   - Index: `docs/README.md:15,41`.  
   - Kit: `design-system/cmc-edu/STRUCTURE.md:3,19`.  
   - **Impact:** a frontend agent following the published reading order emits classes that no longer exist in CSS. Silent unstyled UI, or a hunt for deleted `AppFrame`.  
   - **Not a lie inside the console file’s code map** — a lie in the corpus the console file claims to have superseded.

### P1 — false safety / stale instruction that can break a build

2. **`FilterBar` is not rename-locked.** Console `docs/design-system-console.md:115` vs `scripts/check-ui-frames.mjs:174–184` + `package.json:22`. CI `--strict` does not fail if the symbol disappears.  
3. **`packages/ui/llms.txt:79` still instructs `import premium.css`.** File is deleted. Following the package’s own LLM brief breaks the app.  
4. **Deferred FilterBar list incomplete.** Console names `leaderboard` / `refund` only. `class-placement.tsx` is a third live holdout (`docs/system-architecture.md:15`).

### P2 — imprecision, not a wrong language

5. Float-layer **mount** claim: CommandPalette (and in-tree ConfirmDialog) live **inside** `.o_web_client` (`shell.tsx:130–154`). Unscoped CSS still paints. Toast *is* outside (`main.tsx:40–44`).  
6. Control-bar padding is `8px 16px 10px` (`console.css:1178`), not `padding: 8px`.  
7. `--cmc-brand` hex `#0071e3` vs documented `#0071E3`; token lives in `tokens.css:11`, not under `.o_web_client`.  
8. Stale comments treating `sh-*` / SideNav / AppFrame as still owned: `packages/ui/src/index.ts:166–169`, `console.css:1394`. Astryx `SideNav` still in `primitives.ts:35–41` (unused by admin/LMS).  
9. CI “required on `main`” cannot be proven from this worktree (no branch-protection API). Workflows + as-built docs support it.

---

## Positive findings (console doc that is true)

- Implementation surface table is path-accurate.
- Legacy prefix retirement is real in live CSS/TSX, not aspirational.
- `premium.css` is actually gone; LMS/admin class languages do not leak.
- Pin + LGPL-3 are in the CSS header **and** in a unit test.
- Brand-follows-module, sticky thead, float z-ladder, and shell grammar match code + e2e.
- Visual-smoke numbers are not invented; the Phase 4 report is on disk and matches 8/2/0.

---

## Scout report (ak-scout aggregate)

### Relevant files

- `docs/design-system-console.md` — subject
- `docs/12-design-system-ui.md` — conflicting TL12 body
- `docs/README.md` — still routes frontend → TL12
- `packages/ui/src/console.css` — live tokens + skins
- `packages/ui/src/console/console-tokens.test.ts` — pin assertion
- `packages/ui/src/console/console-{cp-sheet,shell-stacking,float-layer,list-sticky}.test.ts` — layout locks
- `packages/ui/src/console/console-navbar.tsx`, `console-kanban.tsx`
- `packages/ui/src/components/{list,detail,form,dashboard}-page.tsx`, `control-bar.tsx`, `filter-bar.tsx`
- `packages/ui/package.json`, `packages/ui/src/index.ts`, `packages/ui/src/primitives.ts`, `packages/ui/llms.txt`
- `packages/ui/src/tokens.css` — `--cmc-brand`
- `apps/admin/src/main.tsx`, `apps/admin/src/shell/shell.tsx`, `nav-registry.ts`, `shell.test.tsx`
- `apps/lms/src/main.tsx`, `apps/lms/src/app.css`
- `apps/e2e/tests/admin-shell.ui.spec.ts`
- `scripts/check-ui-frames.mjs`
- `design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md`, `STRUCTURE.md`
- `plans/260807-1453-cmc-console-design-system-rebrand-hardening/reports/visual-smoke-2026-08-07.md`
- `.github/workflows/ci.yml`, `ui-e2e.yml`

### Unresolved / out of lane

- Live GitHub branch-protection required-check list (needs `gh api`, not run).
- Whether Phase 4 visual smoke still reproduces on current HEAD (not re-run; report is 2026-08-07).
- Whether `tokens.premium` JS object (`packages/ui/src/tokens.test.ts:24`) should be treated as a leftover of the deleted CSS file (exists; not a CSS import).

---

## Recommended next (not this lane)

1. **[P0]** Point `docs/README.md` frontend path at `docs/design-system-console.md` for admin; rewrite TL12 §1 / §4.5 chrome + class-prefix bullets so they cannot be read as live admin SoT.  
2. **[P0]** Update `design-system/cmc-edu/{STRUCTURE,PAGE-FRAMES,MASTER}.md` off `.ck-*` / AppFrame.  
3. **[P1]** Delete or correct `packages/ui/llms.txt:79`.  
4. **[P1]** Either add a real FilterBar rename gate, or stop saying `check-ui-frames.mjs` locks the name; add `class-placement` to the deferred list.  
5. **[P2]** Tighten float-mount + padding + hex-case wording in the console doc; scrub stale `sh-*` comments.

No code was changed in this lane.
