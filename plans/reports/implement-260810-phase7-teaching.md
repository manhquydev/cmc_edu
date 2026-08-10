# Phase 7 — Teaching Module Inline-Style Tokenization

Plan: `plans/260809-2040-erp-ui-clean-sync-complete/plan.md`, Phase 7 (vertical module slices) — TEACHING module slice.

## Scope

Replaced literal `style={{ ... }}` values with existing `@cmc/ui` design tokens
(`packages/ui/src/tokens.css`) for the 4 tokenizable property families
(spacing, fontSize, radius, color) per `scripts/ui-ratchet.mjs`'s exact-match
rules. No new tokens invented, no JSX/business-logic touched.

## Files Modified (before -> after violation count, per `node scripts/ui-ratchet.mjs --json`)

| File | Before | After |
|---|---|---|
| `apps/admin/src/pages/teaching/attendance.tsx` | 22 | 3 |
| `apps/admin/src/pages/teaching/exercises.tsx` | 5 | 0 |
| `apps/admin/src/pages/teaching/grading.tsx` | 6 | 1 |
| `apps/admin/src/pages/teaching/panels/attendance-panel.tsx` | 2 | 1 |
| `apps/admin/src/pages/teaching/panels/evidence-panel.tsx` | 5 | 0 |
| `apps/admin/src/pages/teaching/pdf-annotator.tsx` | 8 | 0 |
| `apps/admin/src/pages/teaching/schedule.tsx` | 1 | 1 |
| `apps/admin/src/pages/teaching/session-assessment.tsx` | 4 | 0 |
| `apps/admin/src/pages/teaching/session-evidence.tsx` | 7 | 0 |

Total: 60 -> 6 (54 literals tokenized, 6 correctly left untouched — no exact
token match exists for their value).

## Literals left untouched (no exact token match — confirmed against tokens.css)

- `attendance.tsx`: `borderRadius: 4` (CountTile tile) — radius scale only has 12/16/20/9999px, no 4px token.
- `attendance.tsx`: `marginTop: 2` (CountTile label) — spacing scale only has 4/8/16/24px, no 2px token.
- `attendance.tsx`: `padding: 32` (empty-roster message) — no 32px spacing token (32 only exists as a fontSize token, `--cmc-fs-metric`, not spacing).
- `grading.tsx`: `marginBottom: 2` (SubmissionListItem header row) — no 2px spacing token.
- `panels/attendance-panel.tsx`: `marginTop: 2` (CountTile label, same pattern as attendance.tsx) — no 2px token.
- `schedule.tsx`: `gap: 12` (FullCalendarSessionView wrapper) — no 12px spacing token.

One partial-shorthand case (`attendance.tsx` CountTile root `padding: '12px 16px'`)
had only its second value tokenized (`16px` → `var(--cmc-space-3)`); the first
value (`12px`) has no exact spacing-token match and was left literal, per the
side-by-side shorthand rule in the task brief: `'12px var(--cmc-space-3)'`.

## Token mappings applied

- Spacing: `4px`→`var(--cmc-space-1)`, `8px`→`var(--cmc-space-2)`, `16px`→`var(--cmc-space-3)` (many occurrences of `paddingInline`/`paddingBlock`/`paddingTop`/`margin`/`marginTop`/`marginBottom`/`padding`/`gap` across all 9 files).
- Typography: `fontSize: 24`→`var(--cmc-fs-page)` (attendance.tsx CountTile ×2, attendance-panel.tsx CountTile), `fontSize: 12`→`var(--cmc-fs-meta)` (pdf-annotator.tsx TextArea monospace font).

No color-family or 20/9999px-radius literals were present in any of these 9
files that had an exact hex/px match to a token — none of the 60 violations
were `color`/`backgroundColor`/`borderColor` family (all color values already
used `var(--cmc-*)` or CSS-var identifiers via component props, not raw
literals inside `style={{ }}`).

## Tests Status

- Command: `pnpm turbo run typecheck test --filter=@cmc/admin` (from worktree root).
- Result: **green** — 14/14 turbo tasks successful (12 cached, 2 fresh: typecheck+test for `@cmc/admin`), 55 test files / 560 tests passed, 0 failures.
- No test asserted on the old literal values (`grading.tsx`, `attendance.tsx`, etc. test files unaffected) — no test edits were needed.

## Ratchet Verification

- `node scripts/ui-ratchet.mjs` (JSON) confirms `increased: []` — no file regressed above its baseline; all 9 touched files show counts at or below their prior baseline entries.
- Did **not** edit `scripts/ratchet-baseline.json` — left for the orchestrator to regenerate once after all 5 parallel module slices land, per task instructions.
- Did **not** run any git add/commit — changes left in the working tree.

## Out of scope (untouched, per task brief)

- No replacement of hand-rolled markup with `CountBadge`/`MetaRow`/`Avatar` components.
- No changes to `console.css`'s separate Odoo radius scale (4/6/8px).
- No changes to `width`/`height`/`minWidth`/`minHeight`/`maxWidth`/`maxHeight`, layout, or typography-semantic properties (all permanently exempt).

Status: DONE
Summary: Tokenized 54 of 60 inline-style literals across the 9 TEACHING module files to existing CMC design tokens; 6 literals left untouched (no exact token match, confirmed against tokens.css); typecheck+test green (560/560), ratchet shows no regressions.
Concerns/Blockers: none.
