# Scout Report — ship working locations → develop

**Date:** 2026-08-13 13:26 ICT  
**Mode:** ak:scout then consolidate/ship  
**Workspace:** `/home/manhquy/Downloads/cmc_edu` on `feat/hoan-thien-meter-va-diem-nghen`  
**Tip measured:** `origin/develop@2a6f666` (#135) · feature tip `718e08b` · PR [#136](https://github.com/manhquydev/cmc_edu/pull/136)

---

## Relevant Files

Product already on the feature PR (not local WIP):

- `scripts/verify-system.mjs` — one-command status meter (SHA + proof class)
- `apps/admin/src/pages/teaching/session-detail.tsx` — GĐĐT break-glass **Phát bài**
- `apps/admin/src/pages/students/enrollment-ranges-panel.tsx` — grant/cắt unit range
- `apps/api/src/lms-ops/exercise-delivery.ts` + `router.ts` — delivery + listEnrollments
- `packages/ui/src/components/{stat-card,status-badge,filter-bar,empty-state}.tsx` — family merge
- `apps/admin/src/pages/design-showcase.tsx` — live gallery
- `apps/e2e/tests/journeys/exercise-sequence.journey.ui.spec.ts` — P2-09 journey
- `apps/admin/src/pages/teaching/exercise-detail.tsx` — form HITL Công bố/Đóng (GAP #3 **already closed** on develop via #123)

Uncommitted evidence (docs only, not in #136):

- `plans/260813-0120-design-system-hardening/` — plan of record for DS wave
- `plans/reports/audit-260813-0052-ds-*.md` — 4-lane + Claude cross-check
- `plans/reports/decisions-owner-260813-0120-design-system.md`
- `plans/reports/INDEX-live-260812.md` — local pointer draft (stale TL12 note)

Do **not** ship:

- `.agents/` — duplicate of `.claude/skills/gitnexus`
- `.codex/config.toml` — local harness config

---

## Working locations

| Location | State | Ship? |
|----------|-------|-------|
| `feat/hoan-thien-meter-va-diem-nghen` + **PR #136 → develop** | 1 commit, **CI green** (`typecheck-and-test` + `ui-e2e`), `MERGEABLE` / `CLEAN` | **Yes — merge now** |
| Uncommitted `plans/` + INDEX | DS hardening evidence never landed; code already on develop via #124–#135 | **Yes — follow-up docs PR** |
| `origin/feat/lms-class-schedule-foundation` | PR **#131 squash-merged**. Two-dot content vs develop = empty for class/schema; leftover SHAs only | **No — stale branch** |
| `origin/daily-security-review-report-…` + draft **PR #130 → main** | Docs security report, draft, wrong target | **No** |
| `stash@{0}` shifts Work Schedule rewrite (+1332/−257) | INDEX already marks shifts form-depth **DONE**; not reviewed this session | **No — leave stash** |
| `stash@{1}` breadcrumb + plans | Pre-LMS-foundation WIP | **No — obsolete** |
| Extra folders (`cmc_edu-safety-*`, `worktrees/`, `CMCnew`) | Archive / other repo; no live worktree | **No unique code** |
| Local `main` | Behind `origin/main` 100 commits; last promote #101 | **Do not touch** (human OK only) |

One worktree only: this checkout. No other live `cmc_edu` worktree.

---

## develop today (before #136)

Integration tip: `2a6f666` — `fix(ui): add Console :focus-visible rings for WCAG 2.4.7 (#135)`.

Landed 2026-08-13 (newest first): #135 focus-visible · #134 DataTable keyboard · #133 DS journal/CI · #132 precedence pins · #131 session unique-by-schedule · #129 doc-authority · #128/#127 CRM kanban truth · #125/#124 DS authority + token pin · #123 exercise library.

Required gates on develop: `typecheck-and-test` + `ui-e2e`, `enforce_admins: true`, 0 approvals. Squash-merge is the repo convention.

**INDEX stale vs code:** GAP #3 teaching exercises is **closed** — list is index-only (`exercises.test.tsx`), HITL lives on `exercise-detail.tsx`. Dual-HITL residual matrix in INDEX still says GAP #3 open.

DS plan YAML still says “C local, chờ PR” — false; C/D landed as #127/#128/#134/#135.

---

## PR #136 payload (the ship)

`feat: meter trạng thái, Phát bài GĐĐT, gallery family merge`

46 files, +2691/−188. Based on current develop (no commits on develop missing from the branch).

| Slice | What |
|-------|------|
| Phase 01 | `pnpm verify:system` + ledger claim by SHA |
| Phase 02 | GĐĐT Phát bài + grant/cắt range UI; P2-09 sequence journey; P2-05 student path **still deferred** (`no-ui-path`) |
| Phase 03 | Four-family chrome + `/admin/design` gallery |

Checks at merge decision: typecheck-and-test **pass**, ui-e2e **pass**, CodeQL pass, e2e pass, security-scan pass. No `CHANGES_REQUESTED`.

---

## Patterns

- Product code for 12–13 Aug already flows through PRs; leftover risk is **uncommitted plans/reports**, not unmerged source.
- Squash-merge makes old feature branches look “ahead” in three-dot log; two-dot file diff is the truth.
- Live INDEX is a dated photo; GAP #3 and DS phase status drifted after #123/#135.

---

## Unresolved questions

1. Promote `develop` → `main` still human-only (last #101). Not this scout.
2. P2-05 student open/submit still `no-ui-path` after #136 — remaining cook in plan `260813-1211` phase 02.
3. Plan `260813-0813` A2–B1 (class lifecycle / family identity) is the next product lane; A1 already on develop via #131.
4. Two stashes: confirm later whether to drop; do not apply onto develop without a dedicated review.
5. Draft PR #130 targets `main`; leave until a human retargets or closes it.
