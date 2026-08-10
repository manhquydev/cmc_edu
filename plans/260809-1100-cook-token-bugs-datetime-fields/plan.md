---
title: "Fix 3 token bugs + ship S1 Date/Time field helpers (TimeField, DateTimeField)"
status: completed
priority: P2
effort: "S — 2 phases, single session"
tags: [design-system, tokens, date-field, bugfix]
created: 2026-08-09
completed: 2026-08-10 (landed via plans/260809-2040-erp-ui-clean-sync-complete Phase 1, worktree feat/erp-ui-clean-sync-cook-b)
---

# Cook slice — token bugs + S1 Date/Time helpers

## Outcome

Fix 3 confirmed token/dependency bugs found during the design-system sync audit, and ship the S1 slice from the real Odoo field-widget dissection (`plans/260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit/reports/g2-form-fields-inventory-map.md` §7): `TimeField` + `DateTimeField` components, adopted by the 4 real consumers already carrying free-text/raw-input workarounds.

## Constraints / non-goals

- No new design decisions: reuse existing `--cmc-success/warning/danger/brand/brand-muted` tokens and the existing `.console-date-field*` CSS recipe — do not invent new tokens or new CSS classes beyond what's needed for `type="time"`/`type="datetime-local"`.
- Do not touch validation logic (`DATE_RE`/`TIME_RE` in `class-detail.tsx`, `timeOk` in `shift-config.tsx`) — pure swap of input primitive, business logic unchanged (minimizes blast radius).
- Do not deduplicate the two identical `STATUS_CONFIG` objects in `attendance.tsx`/`attendance-panel.tsx` — out of scope (separate refactor, not a bug fix).
- Do not touch Chatter, Activity view, Calendar drag/create, or Pivot/Graph — explicitly out of scope per the dissection reports (parked / blocked / no product trigger).

## Acceptance criteria

- [x] `--cmc-accent` / `--cmc-accent-subtle` no longer referenced anywhere in `apps/admin/src` or `packages/ui/src` (both are undefined tokens); replaced with real tokens that render the same *intended* brand-highlight look.
- [x] `attendance.tsx` and `attendance-panel.tsx` status colors use `var(--cmc-success/-soft)`, `var(--cmc-warning/-soft)`, `var(--cmc-danger/-soft)` instead of hand-typed hex.
- [x] `apps/lms/package.json` explicitly declares `@astryxdesign/theme-neutral` + `@stylexjs/stylex` (matching `apps/admin/package.json`); `packages/ui/package.json` peerDependencies includes `@astryxdesign/theme-neutral`.
- [x] New `TimeField` (`type="time"`) and `DateTimeField` (`type="datetime-local"`) components exist in `packages/ui`, same API shape as `DateField`, exported from the barrel.
- [x] 4 real consumers migrated: `class-detail.tsx` makeup dialog (DateField + 2×TimeField), `shift-config.tsx` NewTemplateForm (2×TimeField), `schedule-test-dialog.tsx` + `schedule-parent-meeting-dialog.tsx` (DateTimeField replacing raw `<input type="datetime-local">` + manual label + inline styles).
- [x] `pnpm --filter @cmc/ui typecheck`, `pnpm --filter @cmc/admin typecheck`, `pnpm --filter @cmc/lms typecheck` all pass.
- [x] Existing tests for touched files still pass (`class-detail.test.tsx`, `shift-config` tests if any, CRM dialog tests if any — confirmed during Phase 1 of the erp-ui-clean-sync-complete cook run: 55 files / 557 tests green).
- [x] `detect_changes()` / repo-wide grep confirms no other file references the removed patterns unexpectedly.

## Phase 1 — Token & dependency bug fixes (independent, no shared code with Phase 2)

**Files:**
1. `apps/admin/src/pages/teaching/grading.tsx:109-110` — replace `var(--cmc-accent-subtle, #e8f4fd)` → `var(--cmc-brand-muted)`; `var(--cmc-accent, #228be6)` → `var(--cmc-brand)`.
2. `apps/admin/src/pages/teaching/attendance.tsx:55-58` — match the existing `StatusBadge` convention (soft bg + `-ink` text) — `bg: var(--cmc-success-soft)` / `color: var(--cmc-success-ink)` (present), `var(--cmc-danger-soft)` / `var(--cmc-danger-ink)` (absent), `var(--cmc-warning-soft)` / `var(--cmc-warning-ink)` (late). `UNMARKED_CONFIG` left untouched (no semantic status token to map to).
3. `apps/admin/src/pages/teaching/panels/attendance-panel.tsx` — identical fix.
4. `packages/ui/src/console.css:780` — same `--cmc-accent` bug (`.console-date-field-input:focus`) → `outline: 2px solid var(--cmc-brand); outline-offset: 1px;`.
5. `packages/ui/package.json` — add `"@astryxdesign/theme-neutral": "0.2.0"` to `peerDependencies`.
6. `apps/lms/package.json` — add `"@astryxdesign/theme-neutral": "0.2.0"` and `"@stylexjs/stylex": "0.19.0"` to `devDependencies`.

**Validation:** `pnpm install`, `pnpm --filter @cmc/admin typecheck`, `pnpm --filter @cmc/lms typecheck`, visual sanity.

## Phase 2 — S1 Date/Time field helpers

**New files:**
1. `packages/ui/src/components/time-field.tsx` — `TimeField` component, copies `DateField`'s structure exactly, only difference: `type="time"` on the `<input>`. **No `step` prop** — native `type="time"` only emits `"HH:mm:ss"` when `step<60`; omitting `step` guarantees `TIME_RE`/`timeOk` regex compatibility.
2. `packages/ui/src/components/datetime-field.tsx` — `DateTimeField` component, same pattern, `type="datetime-local"`.
3. Comment on the `.console-date-field` rule header noting it's the shared recipe for Date/Time/DateTime fields.

**Barrel exports** (`packages/ui/src/index.ts`, next to `DateField`).

**Consumer migrations — labels kept byte-identical:**
1. `apps/admin/src/pages/classes/class-detail.tsx:409-434` — makeup dialog.
2. `apps/admin/src/pages/admin/shift-config.tsx:133,136` (`NewTemplateForm`).
3. `apps/admin/src/pages/crm/schedule-test-dialog.tsx` — label `"Thời gian test"`.
4. `apps/admin/src/pages/crm/schedule-parent-meeting-dialog.tsx` — label `"Thời gian họp"`.

**Known deferred residue:** `apps/admin/src/pages/classes/index.tsx:84-136` (class-create form) has the same free-text pattern — left untouched, candidate for a follow-up slice.

**Validation:** `pnpm --filter @cmc/ui test`, `pnpm --filter @cmc/admin typecheck && test`.

## Risks / rollback

- Native `type="time"`/`type="datetime-local"` browser chrome differs slightly across browsers — acceptable, same risk `DateField` already carries for `type="date"`.
- Rollback: each phase is an independent, revertable commit.

## Dependencies

None — both phases touch already-shipped, stable code paths.

## Landing note (2026-08-10)

Landed as commit 2 of Phase 1 in `plans/260809-2040-erp-ui-clean-sync-complete/` (worktree
`feat/erp-ui-clean-sync-cook-b`), alongside the WorkflowStatusbar redesign (commit 1) and the
`/design` showcase route (commit 3, reduced scope — see that plan's Phase 1 notes). Verified:
`pnpm turbo run typecheck --filter=@cmc/ui --filter=@cmc/admin` 14/14 tasks green;
`pnpm turbo run test --filter=@cmc/ui --filter=@cmc/admin` 45+55 files / 149+557 tests green.
