# PHASE-D LANE B — Console `:focus-visible`

**Branch:** `fix/console-focus-visible` (base `develop` `bc3f473`)  
**Commit:** `23d882d` (not pushed)  
**Worktree:** `/home/manhquy/.herdr/worktrees/cmc_edu/fix-console-focus-visible`  
**Date:** 2026-08-13

## Outcome

Keyboard Tab on Console chrome now has an explicit 2px `:focus-visible` outline (WCAG 2.4.7). Additive CSS only — no token / variable redeclarations, `data-table.tsx` untouched.

## Selectors added

All scoped under `.o_web_client` so specificity ties the Astryx `[data-astryx-theme='neutral'] :is(...):focus-visible` rule `(0,3,0)` and wins by source order (`console.css` after `astryx-theme-cmc.css`).

| Selector | Token | Offset | Surface |
|---|---|---|---|
| `.console-app-switcher-toggle` | `--console-gray-100` (`#f8f9fa`) | `2px` | navbar purple `#71639e` |
| `.console-menu-item` | `--console-gray-100` | `2px` | navbar purple |
| `.console-systray-badge` | `--console-gray-100` | `2px` | navbar purple |
| `.console-app-switcher-tile` | `--cmc-brand` (`#0071e3`) | `2px` | white menu |
| `button.console-kanban-card` | `--cmc-brand` | `2px` | white card |
| `.console-view-switcher button` | `--cmc-brand` | `-2px` (inset) | white / gray-100; parent `overflow: hidden` |

`--cmc-brand` on navbar purple is ~1.07:1 (fails 3:1). `--console-gray-100` on `#71639e` is ~5:1. `--cmc-brand` on `#fff` is ~4.8:1.

## Files

- `packages/ui/src/console.css` — six additive `:focus-visible` rules
- `packages/ui/src/console/console-focus-visible.test.ts` — source pin for each selector + token + `.o_web_client` prefix + no locked-family redeclarations

## GitNexus

- `impact(console.css, upstream)`: **LOW**, 0 callers, 0 processes
- `detect_changes(all)`: **low**, 1 file, 0 symbols, 0 processes

## Validation

| Gate | Result |
|---|---|
| `pnpm --filter @cmc/ui test` | **163/163** green (43 files) |
| `console-precedence.test.ts` | **5/5** green — precedence lock intact |
| `console-tokens.test.ts` | **7/7** green |
| `console-focus-visible.test.ts` | **10/10** green |
| Focus test after deleting `.console-menu-item:focus-visible` | **RED** (3 fail / 8, then 5 fail / 10 after prefix pin) — restored |
| `pnpm check:ui-ratchet` | green (no file over baseline) |
| `pnpm check:ui-frames` | green (`bulkListsOk (≥5): true`) |
| `pnpm check:ui-a11y-roles` | green (8/8) |
| `pnpm typecheck` | green (34/34) |

Code-reviewer (first pass) flagged Astryx `:is()` specificity beating unprefixed class rules. Fixed by prefixing `.o_web_client`. Tester re-confirmed full `@cmc/ui` suite + checks green.

Browser Tab walk was not run in this worktree (no live admin server). Proof is source contract + cascade-specificity fix, not a rendered keyboard walk.

## `git diff --stat`

```
 packages/ui/src/console.css | 32 ++++++++++++++++++++++++++++++++
 1 file changed, 32 insertions(+)
```

Untracked then added: `packages/ui/src/console/console-focus-visible.test.ts` (87 lines).

LANE B DONE
