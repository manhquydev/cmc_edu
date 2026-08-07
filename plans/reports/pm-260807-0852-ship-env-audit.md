# PM — Ship environment audit (develop → main)

**Date:** 2026-08-07  
**HEAD:** `b5a36f3` · **PR:** [#75](https://github.com/manhquydev/cmc_edu/pull/75)

## Preflight verdict

| Check | Result |
|-------|--------|
| Dirty worktree | **Clean** |
| Unpushed commits | **None** (`develop` = `origin/develop`) |
| Worktrees | **1** primary only |
| Behind `main` | **0** |
| Ahead of `main` | **16** commits |
| PR exists | **#75** OPEN MERGEABLE base=`main` head=`develop` |
| Product CI (`fdc2c93`/`d25e3e9`) | **ui-e2e + typecheck SUCCESS** |

## Branch / worktree consolidation

| Branch | Action | Rationale |
|--------|--------|-----------|
| `develop` | **Ship source** | Canonical integration branch |
| `main` | PR target | No direct commits |
| `feat/ui-copy-standard` | **Do not merge** | Stale design3 lineage; merging regresses FilterBar/DateField/shell stacking already on develop |
| `jules/integration-smoke` | Cherry-picked | `plans/jules/integration-smoke.md` only |
| Stash ×2 | Left | WIP Jules AGENTS note + superseded audit rewrite — not product gates |

## Safe claims

- All FilterBar/search product code is on `develop` and pushed.
- No second worktree holding unmerged product edits.
- PR #75 is the official `develop` → `main` vehicle (title/body updated).

## Not done (human)

- Merge PR when required checks green on latest HEAD
- Optional acceptance re-measure + visual smoke
