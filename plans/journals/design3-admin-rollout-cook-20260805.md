# Journal — Design3 Admin Rollout cook (Phases 1–2)

Date: 2026-08-05  
Branch: feat/ui-copy-standard  
Command: `/ak:cook plans/260805-1920-design3-admin-rollout/plan.md --tdd --auto --deep --hard`

## What shipped

### Phase 1 (completed)
Extracted design3 into `@cmc/ui` odoo layer:
- `packages/ui/src/odoo.css` (LGPL-3, no `:root`, Astryx density remap)
- `OdooNavbar` with **required** `isChildVisible` (no SideNav fail-open)
- `KanbanBoard` / `KanbanColumn` / `KanbanCard`
- DEV-only `/design3` + fixture-only lab page
- Docs: TL12 superseded-for-admin banner; `docs/design-system-odoo.md` promoted

### Phase 2 (code complete, e2e gate open)
Replaced AppFrame/SideNav shell with Odoo navbar:
- `shell.tsx` → `.o_web_client` + OdooNavbar + `<main class="o-main">`
- change-password inside Shell, path-based chrome suppress
- `menu-nav.ts` app-switcher semantics + post-navigate settle for absence
- 7 journey content selectors retargeted; admin-shell e2e rewritten
- jsdom shell suite (5 cases)

## Verification
- `@cmc/ui`: 113 tests, typecheck clean
- `apps/admin`: 535 tests, typecheck clean
- Code review Phase 1: 7/10 → fixed high warnings
- Code review Phase 2: 7/10 → fixed assertEntryAbsent race + dead mCP cast
- **ui-e2e not run this session** — hard merge gate remains

## Decisions / notes
- Chrome suppress is path-only (`/change-password`); `session.me` still lacks `mustChangePassword` for staff
- FilterBar name preserved for check-ui-frames (plan rule) — not touched yet
- Phases 3–6 not started (~9–14w remaining per plan)

## Next
1. Run ui-e2e + gift canary against shell
2. Open PR for Phase 1+2 (or split ui then admin)
3. Phase 3: central template reskin under odoo density

## Session 2 — Phase 2 residual + Phase 3

- Closed Phase 2 unit gaps: CommandPalette permission test, RoleSwitcher PROD source gate.
- Phase 3: ported shared templates/archetypes from tpl-/ck- → o-* emission + odoo.css styles.
- FilterBar name retained for check-ui-frames.
- DataTable wrapped in `.o-list` (all states).
- ProgressSteps chevron under `.o_web_client`.
- Unit: @cmc/ui 113, admin 538, check-ui-frames exit 0.
- **ui-e2e still not run** — merge gate open.
- Phases 4–6 not started.


## Session 3 — Phase 4 CRM pilot

- Ported CRM pipeline board to KanbanBoard/Column/Card with stage color map.
- Built list DataTable (name, phone, stage, owner, source) sharing listInput.
- URL switcher `?view=table` (TL6); default kanban.
- Unit: pipeline 30/30, full crm 99/99; typecheck admin clean; check-ui-frames OK.
- E2E: smoke list/kanban in crm-receipt journey (full ui-e2e not run).
- Statusbar detail left display-only (advance via explicit buttons).

