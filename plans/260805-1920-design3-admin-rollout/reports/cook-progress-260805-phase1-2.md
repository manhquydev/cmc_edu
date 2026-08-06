# Cook progress — Design3 Admin Rollout (Phases 1–2)

Date: 2026-08-05  
Mode: `/ak:cook plan.md --tdd --auto --deep --hard`  
Branch: `feat/ui-copy-standard`

## Brainstorm contract (reused)

| Field | Value |
|-------|--------|
| Outcome | Admin on design3 Odoo UI; LMS unchanged |
| Constraints | CI gates; `.o_web_client` scope; light-only; Inter; `#0071E3`; LGPL-3; no `:root` |
| Non-goals | LMS re-skin; dark mode; API/business changes |
| Acceptance | Per plan success criteria + phase files |

## Phase 1 — Completed

### Delivered
- `packages/ui/src/odoo.css` — port from design-lab-3, `.o_*` prefix, scoped tokens under `.o_web_client`, Astryx remap (font-size + text-* size/weight/leading + color-text), LGPL attribution, **no `:root`**
- `OdooNavbar` (required `isChildVisible`) + `KanbanBoard`/`Column`/`Card`
- Package exports `./odoo.css` + index exports
- Admin `main.tsx` imports odoo.css after premium
- `/design3` DEV-only gate; page repointed to `@cmc/ui` components + fixture data
- Docs: TL12 superseded-for-admin banner; `docs/design-system-odoo.md` promoted (rollout in progress)
- Baseline: `reports/baseline-acceptance-flows-phase1.md` (38 flow ids)

### Tests
- `@cmc/ui`: 113 passed (incl. gate-child-absent, tokens, astryx remap proof)
- Admin fixture-only + typecheck green

### Review
- Phase 1 code-reviewer: 7/10 → fixed high warnings (remap weight/leading/color, proof stand-ins, docs footer, DEV ternary assert)

## Phase 2 — In progress (code landed; e2e pending CI)

### Delivered
- `shell.tsx` rewritten: `.o_web_client` + `OdooNavbar` + `<main class="o-main">`; **no AppFrame/SideNav**
- Chrome-suppressed mode on `/change-password` (decision 10/10b)
- `change-password` moved under Shell children
- `menu-nav.ts` redesigned for app-switcher + section menu
- 7 journey specs: `.sh-main`/`.sh-content` → `main.o-main`
- `admin-shell.ui.spec.ts` rewritten for Odoo chrome
- jsdom shell tests (5): me present, me null, gated child, suppress chrome, no `.sh-*` markers

### Residual risk (must clear before Phase 2 merge)
- Full `ui-e2e` not run in this cook session (needs PLAYWRIGHT_UI / preview stack)
- Permission canary for `assertEntryAbsent` not executed
- Screen-role matrix regen not needed (nav-registry shape unchanged)

## Phases 3–6

Not started this session. Estimated remaining effort per plan: ~9–14 weeks.

## Validation snapshot

| Gate | Result |
|------|--------|
| `@cmc/ui` unit | 113 pass |
| admin unit | 535 pass (pre final re-run with shell) |
| typecheck ui+admin | green |
| `:root` in odoo.css | 0 hits |
| AppFrame/SideNav in shell.tsx | 0 |
| ui-e2e | **not run** |

## Next steps

1. Run `ui-e2e` against shell swap; fix any menu-nav fallout
2. PR Phase 1+2 (or split: `feat(ui): odoo layer` then `feat(admin): odoo shell`)
3. Continue Phase 3 central template reskin after CI green
