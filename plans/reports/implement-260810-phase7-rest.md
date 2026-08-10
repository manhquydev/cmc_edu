# Phase 7 (rest slice) — inline-style tokenization report

Plan: `plans/260809-2040-erp-ui-clean-sync-complete/plan.md`, Phase 7 (vertical module slices) — "rest" files not covered by teaching/CRM/finance/hr-admin slices.

## Scope

Pure CSS-value substitution in `style={{ ... }}` — replaced raw literals with existing `@cmc/ui` design tokens (`packages/ui/src/tokens.css`) where an exact px/hex match exists, per the 4 tracked families (spacing, fontSize, radius, color) in `scripts/ui-ratchet.mjs`. No JSX structure, business logic, or exempt properties (width/height, layout, typography-semantics) touched.

## Files modified (11) — violation count before → after (via `node scripts/ui-ratchet.mjs --json`)

| File | Before | After |
|---|---|---|
| `apps/admin/src/pages/attendance/check-in-out.tsx` | 12 | 0 |
| `apps/admin/src/pages/change-password.tsx` | 2 | 1 |
| `apps/admin/src/pages/classes/class-detail.tsx` | 1 | 0 |
| `apps/admin/src/pages/classes/index.tsx` | 2 | 0 |
| `apps/admin/src/pages/courses/index.tsx` | 1 | 0 |
| `apps/admin/src/pages/engagement/gifts.tsx` | 2 | 0 |
| `apps/admin/src/pages/enrollment/class-placement.tsx` | 10 | 0 |
| `apps/admin/src/pages/login.tsx` | 2 | 1 |
| `apps/admin/src/pages/parents/index.tsx` | 4 | 0 |
| `apps/admin/src/pages/students/index.tsx` | 1 | 0 |
| `apps/admin/src/pages/students/student-detail.tsx` | 1 | 0 |

Total: 38 → 2 (the 2 remaining are documented below as no-exact-match, left as literals — not a regression, both files' counts went *down* from baseline so the ratchet gate is unaffected).

## Substitutions applied

- `marginBottom: 4` / `marginTop: 4` → `var(--cmc-space-1)`
- `gap: 8` / `marginTop: 8` → `var(--cmc-space-2)`
- `marginTop: 16` → `var(--cmc-space-3)`
- `fontSize: 12` → `var(--cmc-fs-meta)`
- `fontSize: 13` → `var(--cmc-font-size-data)` (7 occurrences across change-password, login, parents×2, student-detail, class-placement×2)
- `padding: '4px 0'` and `padding: '4px 0'` (with `textAlign`) → `'var(--cmc-space-1) 0'` (8 occurrences, check-in-out.tsx table cells; `0` side left bare per instructions — no calc()/wrap complexity)
- `padding: '8px 16px'` → `'var(--cmc-space-2) var(--cmc-space-3)'` (class-placement.tsx, 2 section-header divs)
- `padding: '8px 12px'` → `'var(--cmc-space-2) 12px'` (class-placement.tsx student-pick row; `12px` side has no token, left literal)

## Literals left untouched (no exact token match — confirmed via tokens.css scan)

- `change-password.tsx` line 51 and `login.tsx` line 71: `margin: '80px auto 0'` — `80px` and `auto` have no spacing-scale equivalent (only 4/8/16/24px exist); `0` is intentionally left bare per task instructions (no calc() wrapping). This is the 1 remaining count in each file's ratchet total.
- `class-placement.tsx` `border`, `background`, `borderBottom` shorthand values (e.g. `'1px solid var(--cmc-border)'`) — not in `ui-ratchet.mjs`'s tracked FAMILY set (only `borderColor`/`backgroundColor`, not the shorthand `border`/`background`), so not violations; also already token-driven via `var(--cmc-border)` etc.
- `class-placement.tsx` / `parents/index.tsx` `padding: '4px var(--cmc-keyline-x)'` — already contains `var(...)`, so `isComputed()` short-circuits the whole string and the ratchet script does not count it (confirmed empirically — file's violation count already excluded these before any edit). Left as-is; not a violation per the script's own rules.

## Tests / typecheck

`pnpm turbo run typecheck test --filter=@cmc/admin`: green. 14/14 tasks successful, 55 test files / 560 tests passed, 0 typecheck errors. No test asserted on any of the changed literal values, so no test edits were needed.

No git commands run (add/commit) per instructions — changes left in working tree for orchestrator to review/commit. `scripts/ratchet-baseline.json` was not touched (informational-only rerun above).

---

Status: DONE
Summary: Tokenized all fixable inline-style literals across the 11 "rest" files (38→2 violations); the 2 remaining have no exact token match (documented) and typecheck+test is green (560/560).
Concerns/Blockers: none.
