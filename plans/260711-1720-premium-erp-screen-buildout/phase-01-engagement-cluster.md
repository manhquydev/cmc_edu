# Phase 01 — Engagement cluster

## Context links
- Parent: [plan.md](plan.md) · Prereq: [phase-00](phase-00-admin-test-harness.md)
- Exemplars: `pages/finance/receipt-list.tsx` (ListPage), `pages/cockpit.tsx` (LineIcon/EmptyState)
- Design ref: `docs/12-design-system-ui.md` §4.5

## Overview
First real cluster — smallest, lowest risk. Establishes the list-template pattern AND the first stub→REAL upgrade
(`rewards`). `leaderboard` stays a premium coming-soon stub (backend absent → real build deferred to phase-08).

| Screen | Archetype | State | tRPC | Emoji→Icon |
|--------|-----------|-------|------|-----------|
| `engagement/gifts.tsx` | list | REAL | `gift.list.useQuery`, `gift.upsert.useMutation`, `useUtils` | ⭐→`gift` |
| `engagement/rewards.tsx` | list + row-action | **REAL (upgraded from stub)** | `rewards.list.useQuery`, `rewards.approve`/`deliver`/`reject.useMutation`, `useUtils` | 📋→`gift` (header) |
| `engagement/leaderboard.tsx` | stub (premium coming-soon) | **BLOCKED — no backend** | none | 🏆→`trophy` |

## Key insights
- gifts: `DataTable` + create/edit `Dialog` → wrap in `ListPage` (header slot = `PageHeader` + create `Button`).
- **rewards is NOT a stub** — `rewards.list` + `approve`/`deliver`/`reject` exist (`apps/api/src/rewards/reward-router.ts:41-267`,
  mounted `rewards` at `router.ts:91`). Build a real staff **redemption queue**: `ListPage` + `DataTable` of rewards, status
  filter (`pending`/`approved`/`delivered`/`rejected`), row actions that call the lifecycle mutations, invalidate on success.
  The stub's "rewards.list chưa triển khai" note is stale — delete it.
- leaderboard: premium `EmptyState` + `LineIcon`, stays coming-soon. Real ranking build deferred (phase-08) — needs a new
  backend aggregate + product spec.
- Icons now exist (phase-00 added `gift`/`star`/`trophy`) → no interim mapping needed.

## Requirements
- gifts adopts `ListPage`; keep `gift.upsert` dialog flow + `gift.list` query identical.
- rewards: real `ListPage` queue bound to `rewards.list`; row actions `approve`/`deliver`/`reject` call the existing
  mutations with **byte-identical inputs** (`{rewardId, note?}`); success → `useUtils().rewards.list.invalidate()`.
  Respect the lifecycle guards (approve only `pending`; deliver only `approved`; reject only `pending|approved`) in the UI
  (disable/hide actions per row status) — do not re-implement server logic, just gate the buttons. No `apps/api` edits.
- leaderboard: `EmptyState` with `<LineIcon name="trophy" />` (no emoji). Real build out of scope (phase-08).

## Architecture / data flow
- gifts: `gift.list` → rows → `DataTable`; create/edit → `gift.upsert.mutate` → `useUtils().gift.list.invalidate()` (unchanged).
- rewards: `rewards.list({status?})` → rows (`{id, status, gift:{name,starsRequired}, ...}`) → `DataTable`; row action →
  `rewards.<action>.mutate({rewardId})` → on success `useUtils().rewards.list.invalidate()`. Permission `rewards.manage`
  already enforced server-side; UI shows actions only for allowed status.

## Related code files
- Modify: `apps/admin/src/pages/engagement/gifts.tsx`, `rewards.tsx`, `leaderboard.tsx`.
- Create: co-located `*.test.tsx` for each (`// @vitest-environment jsdom`).
- Read-only ref (contract shape, do not edit): `apps/api/src/rewards/reward-router.ts`.
- Consume only: `@cmc/ui` (ListPage, DataTable, PageHeader, EmptyState, LineIcon, Dialog, Button, …).
- Route/nav: confirm `rewards.tsx` route already registered (was a stub route) — no nav change expected, verify.

## Implementation steps (TDD per screen)
1. gifts: test render + `gift.list` binding + create→`gift.upsert.mutate(input)` + empty/error → refactor to `ListPage` → green.
2. rewards (REAL): test (a) `rewards.list` binding renders rows, (b) status filter passes `{status}` to query, (c) each row
   action calls `rewards.<action>.mutate({rewardId})` + invalidate, (d) actions gated by row status, (e) empty/error →
   build `ListPage` queue → green.
3. leaderboard: test renders premium EmptyState (no emoji text node) → swap emoji→`LineIcon name="trophy"` → green.
4. Run phase gate.

## Todo list
- [x] gifts test → refactor → green
- [x] rewards test → BUILD real queue → green
- [x] leaderboard test → premium coming-soon (trophy icon) → green
- [x] phase verify gate

## Success criteria
- gifts on `ListPage` (contract unchanged); rewards is a working queue (list + 3 lifecycle actions, inputs byte-identical);
  leaderboard premium coming-soon; 0 emoji across all three.
- typecheck + build 14/14 + admin test + lint clean + `@cmc/ui` test green.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| gift.upsert dialog wiring regresses in refactor | Med×Med | Test locks `mutate` args + invalidate before refactor |
| rewards action wired to wrong mutation / bad status gate | Med×High | Test asserts exact `mutate({rewardId})` per action + per-status button visibility; mirror server guards |
| rewards row shape assumption drifts from `rewards.list` output | Med×Med | Type rows against inferred router output; assert against a fixture matching `reward-router.ts:253-266` include shape |
| leaderboard scope-creep into a real build | Low×Med | Explicitly deferred to phase-08; keep as EmptyState only |

## Security considerations
- rewards: server enforces `requirePermission('rewards','manage')` + facility scope — UI gating is UX-only, never the
  authority. Tests assert the payload sent is exactly `{rewardId, note?}` so no extra fields leak.
- Presentation for gifts/leaderboard; permission gating (`canDo`) unchanged; no new data exposure.

## Next steps
Pattern validated → proceed to [phase-02](phase-02-admin-cluster.md). Blocked leaderboard real build tracked in
[phase-08](phase-08-stub-real-features.md).
