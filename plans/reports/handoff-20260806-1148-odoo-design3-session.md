# HANDOFF: Design3 Odoo grammar — after detail validation harness

Generated: 2026-08-06T11:48+07:00 · Session focus: close validation slice; continue Odoo layout via Xia Settings + float

## Goal

Professional Odoo-like admin layout grammar in `@cmc/ui` / `apps/admin` (design3), dissected from odoo/odoo@19.0 pin — not OWL/XML/Bootstrap port.

## Why This Matters

Solo+AI delivery needs durable proof for form/shell grammar and a bounded research pipeline so the huge Odoo monorepo does not sprawl the branch.

## Current State

- Branch: `feat/design3-admin-rollout` @ `655299c` (local **ahead 1** of origin — harness commit not pushed).
- Thin statusbar sticky **shipped** (`afdfffa`) + **CI harness** shipped (`655299c`).
- Prior cook backlog (brand, kanban responsive, dual sheet, navbar stacking) largely **SHIPPED**.
- Remaining cook-plan debt: Phase 5 list Astryx sticky **CUT/pending**; Jules tree dirty (out of scope).
- Dirty worktree (uncommitted): `AGENTS.md`, audit report rewrite, `plans/260806-jules-integration/**`, `outputs/` — keep out of design3 commits.

## Key Decisions and Why

- Validation = two layers: Playwright contract + ops smoke; shared `openSeededDetail` via list/kanban click — DataTable has no detail `href`.
- Empty lists: **hard-fail** (ops must seed); CI creates fixtures in the spec.
- Sticky only thin `.o-detail-statusbar` md+; never whole `.o-detail-summary`.
- ControlBar densify kept; no 3-col CP port.
- Brand = active module label (not hardcoded Admin).

## Rejected Approaches and Traps

- Scraping `a[href]` for `/finance/:uuid` — always empty.
- CRM path `/crm/:uuid` — wrong; real path `/crm/opportunities/:uuid`.
- Sticky on entire summary band — unsafe / non-Odoo.
- Auto-seeding inside ops smoke — rejected by policy.

## Verification Status

- Unit/CSS: DetailPage / odoo stacking tests previously green with statusbar work.
- `PLAYWRIGHT_UI=1 … tests/design3-statusbar.ui.spec.ts` — **PASS** (synth DB migrated).
- `pnpm exec tsx apps/e2e/smoke-statusbar.ts` — login OK; **FAIL** expected when prod finance/CRM lists empty (hard-fail message clear).
- Live `menuCoveredCount=0` after admin rebuild (earlier session).

## Relevant Files and Pointers

- Playbook: `plans/260806-odoo-ui-component-dissection/AGENT-COMMAND-MAP.md`
- Cook gap plan: `plans/260806-1045-odoo-grammar-gap-cook/`
- Validation plan (done): `plans/260806-design3-detail-grammar-validation/`
- Brainstorm validation: `plans/reports/brainstorm-260806-design3-detail-grammar-validation.md`
- Synthesis (5 surfaces): `plans/reports/xia-compare-synthesis-260806-odoo-layout.md`
- Map: `design-system/cmc-edu/ODOO-COMPONENT-MAP.md`, `VIEW-GRAMMAR.md`
- Helper: `apps/e2e/src/design3/open-seeded-detail.ts`
- Pin: `/home/manhquy/Downloads/odoo-src` @ `7de220c9`

## Open Work and Dependencies

- Next research lane (allowlist): **Settings** (`webclient/settings_form_view`) then **float** (`core/dialog|notifications|commands` + CMC toast/dialog z-stack).
- Ops smoke green needs seeded receipt + opportunity visible to super_admin on cmcv2.
- Push `655299c` when ready; do not mix Jules commits.
- Phase 5 list theater still debt / cut — do not reopen unless product asks.

### Fresh-agent prompt

Read this handoff, `AGENT-COMMAND-MAP.md`, and `xia-compare-synthesis-260806-odoo-layout.md`. Verify `git log -3` and pin SHA. Continue with `/ck:xia /home/manhquy/Downloads/odoo-src "settings_form_view SettingsShell rail" --compare --auto` then float layers compare; update map; only then `/ck:plan` for ≤3 P0–P2 cook gaps.
