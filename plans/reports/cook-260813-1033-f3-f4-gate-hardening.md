# Cook 260813-1033 — F3/F4 gate hardening

Branch: `fix/precedence-color-role-pins` (base `develop` `be2a8f5`)
Worktree: `/home/manhquy/.herdr/worktrees/cmc_edu/harden-precedence-test`
Commits: `10e4020` (F3), `9af69b0` (F4). Not pushed.

## Outcome

Independent review findings closed without touching CSS or components.

- **F3** — `--color-text-{primary,secondary,disabled}` now pin the resolved
  winner + fallback hex + one-hop hex/rgb. Console remaps
  `--text-heading-3-weight`, `--text-label-size`, `--text-supporting-size`
  are pinned on `.o_web_client` descendants (not the vendor theme-neutral file).
- **F4** — `FAMILY.color` now counts literal `background`. No re-baseline:
  existing `background` values are `var()` / non-literals, total stayed 61.

## What was raised

### F3 — `packages/ui/src/console/console-precedence.test.ts`

Old pin was a substring match (`/--console-gray-900/`). Mutating only the
fallback hex, or flipping the winner to CMC-first
`var(--cmc-text, var(--console-gray-900))`, stayed green.

New helper `expectResolvedConsoleColor`:

1. Read specified `var(--winner, fallback)`.
2. Assert winner token (`--console-gray-900` / `--console-gray-600`).
3. Assert fallback hex (`#212529` / `#6c757d`).
4. One-hop resolve winner → hex, then `hexAsRgb`.

Console role pins on the shell child:

| Property | Specified | Resolved |
|---|---|---|
| `--text-heading-3-weight` | `600` | `600` |
| `--text-label-size` | `var(--font-size-sm)` | `13px` |
| `--text-supporting-size` | `var(--font-size-xs)` | `12px` |

Vendor theme-neutral source suite is unchanged (upstream mapping, not console remaps).

### F4 — `scripts/ui-ratchet.mjs` + `.test.mjs`

`FAMILY.color` gained `background` only. No whitespace / spread / template-literal
parser change.

Synthetic fixture now includes `background: '#ff0000'` and asserts `color: 1`.

## Re-baseline

**None.** After adding `background`, `pnpm check:ui-ratchet` stayed:

- pages 83
- files with violations 11 (LMS only)
- total 61
- `increased: []`

No file count went up. `scripts/ratchet-baseline.json` not touched.

## Mutation evidence (must be red, then restored)

CSS and pages were mutated only for proof, then `git checkout` restored. Working
tree after restore was clean of those files.

### F3-1 — fallback hex of `--color-text-primary` `#212529` → `#ff00ff`

```
428:  --color-text-primary: var(--console-gray-900, #ff00ff);

 FAIL  src/console/console-precedence.test.ts
AssertionError: --color-text-primary fallback hex must be #212529; specified "var(--console-gray-900,#ff00ff)": expected '#ff00ff' to be '#212529'
MUTATION1_EXIT:1
```

### F3-2 — winner flip to CMC-first

```
428:  --color-text-primary: var(--cmc-text, var(--console-gray-900));

 FAIL  src/console/console-precedence.test.ts
AssertionError: --color-text-primary winner must be --console-gray-900; specified "var(--cmc-text,var(--console-gray-900))": expected '--cmc-text' to be '--console-gray-900'
MUTATION2_EXIT:1
```

### F3-3 — `--text-heading-3-weight` `600` → `400`

```
407:  --text-heading-3-weight: 400;

 FAIL  src/console/console-precedence.test.ts
AssertionError: expected '400' to be '600'
MUTATION3_EXIT:1
```

`git diff -- packages/ui/src/console.css` after restore: 0 lines.

### F4 — inject `style={{ background: '#ff0000' }}` into `apps/admin/src/pages/coming-soon.tsx`

```
FILES THAT REGRESSED (1):
  - apps/admin/src/pages/coming-soon.tsx: 0 -> 1
F4_MUTATION_EXIT:1
```

After restore:

```
  Pages scanned:        83
  Total violations:      61
No file exceeded its baseline count.
F4_CLEAN_EXIT:0
```

## Clean suite

```
pnpm --filter @cmc/ui exec vitest run src/console/console-precedence.test.ts
  ✓ 5 passed (384ms)   # after mutations restored; later re-run 5/5

pnpm --filter @cmc/ui test
  Test Files  42 passed (42)
  Tests  153 passed (153)

node --test scripts/ui-ratchet.test.mjs
  tests 5, pass 5, fail 0

pnpm check:ui-ratchet
  Pages scanned:        83
  Total violations:      61
  No file exceeded its baseline count.

pnpm typecheck
  Tasks:    34 successful, 34 total
  Time:    32.159s
```

Tester subagent independently re-ran the four clean commands: 158 unique tests
passed, 0 failed.

## GitNexus

- `impact(FAMILY)` / `familyOf` / `countFile`: **LOW**, no product processes.
- `detect_changes({scope:"all"})` before commit: 3 files, 1 symbol (`FAMILY`),
  0 processes, **risk low**.

## Review

- Tester: DONE. Re-ran the four clean commands: 158 unique tests passed, 0 failed.
- Code-reviewer: DONE_WITH_CONCERNS. Static review accepted all five ACs. Concerns
  were "suites not executed in the reviewer sandbox" — already executed here
  (mutations red, clean green, typecheck 34/34). No merge blockers. Low notes
  (jsdom 1-hop vs used-color; no single ratchet test that both injects
  `background` and asserts exit 1; CSS-in-JS strings still out of walker
  scope) are documented, not in this ticket.

## git diff --stat (F3+F4 vs pre-change)

```
 packages/ui/src/console/console-precedence.test.ts | 101 ++++++++++++++++++---
 scripts/ui-ratchet.mjs                             |   2 +-
 scripts/ui-ratchet.test.mjs                        |   6 +-
 3 files changed, 90 insertions(+), 19 deletions(-)
```

Allowed-file set only. No CSS, no components, no baseline rewrite.

F3F4 DONE
