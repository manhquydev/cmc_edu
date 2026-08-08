# Prerequisites — confirmed 2026-08-07

| # | Prerequisite | Status | Evidence |
|---|---|---|---|
| 1 | Merge PR #75 | **DONE** | `gh pr view 75` → MERGED at 2026-08-07T09:50:07Z; merge commit `240bec1` on main |
| 2 | `outputs/` in `.gitignore` | **DONE** | `git check-ignore outputs/foo` hits; own commit on this branch |
| 3 | Throwaway synthetic DB | **DEFERRED to first e2e gate** | Will run `bash scripts/synthetic-seed-env.sh --fresh` with `SYNTH_SEED_ALLOW=1` before Phase 1 step 12; backup `journeys.json` first |
| 4 | GitNexus | **SKIP (manual path)** | Per plan Constraints + round-2 finding #13: no unpinned `npx gitnexus`. Primary path is `grep -rn 'OdooNavbar' packages apps` → edit 3 sites → typecheck → count diff. |

Branch: `feature/cmc-console-design-system-rebrand` off `main` @ `240bec1`.
