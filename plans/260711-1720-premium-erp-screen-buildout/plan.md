---
title: "Premium build-out of remaining ERP admin screens"
description: "Migrate the 22 remaining apps/admin screens onto the premium @cmc/ui composite/template layer via TDD, preserving behavior + tRPC contract."
status: completed (phases 00–07 merged main 2026-07-12; phase-08 remains BLOCKED)
priority: P2
effort: ~32.5h active (+ phase-08 BLOCKED, backend-dependent)
branch: feat/premium-erp-buildout (merged main ff1b826, deleted)
tags: [frontend, admin, design-system, premium, tdd, refactor]
created: 2026-07-11
completed: 2026-07-12
---

# Premium ERP Screen Build-out

Migrate the **22 remaining `apps/admin/src/pages` screens** from ad-hoc primitive layouts to the premium
composite/template layer (`ListPage`/`DetailPage`/`FormPage`, `MetricCard`/`StatCard`/`Panel`/`TaskRow`/`FunnelBar`,
`LineIcon`) — matching the 12 already-migrated exemplars. **Presentation layer only** for the 21 non-blocked screens.
Behavior + tRPC contract unchanged. **No `apps/api` edits in scope.**

**Two user-approved deviations from the original presentation-only charter (locked 2026-07-11):**
- **`@cmc/ui` LineIcon additive extension** — add 5 outline icons (`globe`/`clock`/`trophy`/`gift`/`star`) so the
  no-emoji rule can be honored on icon-gap screens. This is an **additive public-API change to `@cmc/ui`, approved**
  (no removals/renames → non-breaking). Done early in phase-00 so all downstream phases have the keys.
- **`engagement/rewards.tsx` becomes a REAL feature** (not coming-soon) because its backend (`rewards.list` +
  `approve`/`deliver`/`reject`) already exists. The other 3 stubs have NO backend → deferred to BLOCKED phase-08.

## Scope facts (scouted)

- All 22 screens already import UI **only** from `@cmc/ui` (no raw `@mantine/*`/`@astryxdesign/*`/`@stylexjs/*`).
  Build-out = adopt the **premium template/composite** archetypes, not remove raw imports.
- Archetypes: 8 list · 6 form · 2 dashboard · 2 detail · 4 stub (see phase files for the classification table).
- 6 screens carry pictographic emoji (🔒🌐⏰⭐🏆📋) that violate the LOCKED no-emoji rule → replace with `LineIcon`.
- `apps/admin` has **no component-test harness** (only 2 node-env logic tests). Phase 00 sets it up (prerequisite).
- Design language LOCKED: light mode, monochrome `LineIcon`, Inter, warm canvas, restraint. Ref `docs/12-design-system-ui.md` §4.5.

### Stub backend scout (2026-07-11) — the 4 stubs are NOT uniform

| Stub file | Desired archetype | tRPC endpoint (scouted) | Status |
|-----------|-------------------|-------------------------|--------|
| `engagement/rewards.tsx` | list + row-action queue | **EXISTS** — `rewards.list` query + `rewards.approve`/`deliver`/`reject` mutations (`apps/api/src/rewards/reward-router.ts:41-267`, mounted `rewards` at `router.ts:91`). Stub's "rewards.list chưa triển khai" note is **stale**. | **BUILDABLE now** → phase-01 |
| `engagement/leaderboard.tsx` | ranking list | **NONE** — no leaderboard/rank/standings router (grep clean across `apps/api/src`). `StarTransaction` model exists but no ranked-aggregate endpoint. | **BLOCKED** → phase-08 (needs backend + spec) |
| `admin/network-ip.tsx` | list + form (CIDR CRUD) | **PARTIAL** — `FacilityNetwork` model exists but read-only internally (`checkin/router.ts:48` punch IP-gate). No management endpoint (`facilityNetwork.list/create/delete` absent). | **BLOCKED** → phase-08 (needs backend CRUD; spec mostly clear) |
| `admin/shift-config.tsx` | list + form (groups/templates) | **PARTIAL** — write mutations `shift.createGroup`/`shift.createTemplate` exist (`shift/router.ts:77,96`) but NO list/read query for groups or templates. | **BLOCKED** → phase-08 (needs `shift.listGroups`/`listTemplates` reads) |

Interim for the 3 blocked stubs: they stay **premium coming-soon `EmptyState`** (emoji→`LineIcon` swap only) in their cluster
phases now; the real-feature build is deferred to BLOCKED phase-08 until controller resolves backend + spec.

## Shared conventions (apply to every phase)

- TDD loop per screen: (1) write test locking current behavior (render, data-binding, action→tRPC mutate, empty/error)
  BEFORE refactor → (2) refactor presentation to premium template → (3) tests stay green, contract unchanged.
- One-door: import UI **only** from `@cmc/ui`. No self-authored `<style>` beyond page-layout wrappers (see cockpit exemplar).
- No emoji: `EmptyState.icon` and all iconography use `<LineIcon name=… />`.
- Per-phase verify gate: `pnpm --filter @cmc/admin typecheck` + `pnpm build` (14/14) + `pnpm --filter @cmc/admin test` +
  `pnpm lint` clean + `pnpm --filter @cmc/ui test` unchanged.

## Phases

| # | Phase | Screens | Effort | Depends |
|---|-------|---------|--------|---------|
| 00 ✅ | [Test harness + LineIcon extend](phase-00-admin-test-harness.md) — DONE `7f8882e` | — (infra + `@cmc/ui` icons) | 2h | — |
| 01 ✅ | [Engagement cluster](phase-01-engagement-cluster.md) | gifts, **rewards (REAL)**, leaderboard† | 4.5h | 00 |
| 02 ✅ | [Admin cluster](phase-02-admin-cluster.md) | facilities, users, network-ip†, shift-config† | 3.5h | 00 |
| 03 ✅ | [CRM cluster](phase-03-crm-cluster.md) | pipeline | 1.5h | 00 |
| 04 ✅ | [Finance-remaining cluster](phase-04-finance-remaining-cluster.md) | index, receipt-create, reconciliation, revenue-report | 5h | 00 |
| 05 ✅ | [Attendance cluster](phase-05-attendance-cluster.md) | check-in-out, shifts | 3h | 00 |
| 06 ✅ | [HR cluster](phase-06-hr-cluster.md) | kpi, payroll | 4.5h | 00 |
| 07 ✅ | [Teaching cluster](phase-07-teaching-cluster.md) | attendance, exercises, schedule, pdf-annotator, report-cards, session-evidence | 8.5h | 00 |
| 08 | [Stub real-features](phase-08-stub-real-features.md) **BLOCKED** | leaderboard, network-ip, shift-config | TBD (backend-dependent) | 01, 02 + backend + spec |

`†` = **blocked stub** — stays premium coming-soon `EmptyState` (emoji→`LineIcon`) in its cluster phase now; real build
deferred to phase-08. `rewards` is no longer a stub — built REAL in phase-01 (backend exists). Order = simple→complex,
teaching last. Phases 01–07 are independent after 00 (each owns a disjoint directory set → parallelizable). Phase-08 is
**not runnable** until the controller resolves the three missing backend endpoints + product specs (see Open decisions).

**Phase-00 pre-step: cut `feat/premium-erp-buildout` from `main` before any cook.** All work lands on this branch.

## Success criteria

- **21 screens** (all except the 3 phase-08-blocked stubs' real builds) use premium template/composite archetypes;
  0 self-styled blocks; 0 pictographic emoji **across all 22** (blocked stubs still get emoji→`LineIcon`).
- `engagement/rewards.tsx` is a working staff redemption queue: lists via `rewards.list`, `approve`/`deliver`/`reject`
  row actions bind to the existing mutations, contract byte-identical (tests lock `mutate` args).
- `@cmc/ui` LineIcon set gains exactly 5 keys (`globe`/`clock`/`trophy`/`gift`/`star`); existing keys untouched;
  `line-icon.test.tsx` monochrome invariant still green.
- Behavior + tRPC contract unchanged for all migrated real screens (per-screen behavior tests green).
- `typecheck` 26/26 · `build` 14/14 · `pnpm lint` clean · `@cmc/ui` vitest green (icon test updated, others unchanged).
- Phase-08 explicitly deferred — its 3 real features are NOT part of "done" for this plan.

## Open decisions

**RESOLVED (user, 2026-07-11):**
1. ~~LineIcon gap~~ → **(b) additively extend** `LineIcon` with `globe`/`clock`/`trophy`/`gift`/`star`. Approved `@cmc/ui` change.
2. ~~tRPC test boundary~~ → **mocking the `trpc` module is accepted** (phase-00 `mock-trpc` helper). Confirmed.
3. ~~Stub depth~~ → **build real features**, BUT gated by backend availability (scout above): only `rewards` is buildable now.

**NEWLY BLOCKED — needs controller/user before phase-08 can run:**
4. **`leaderboard` real build** needs (a) a new backend endpoint (ranked aggregate over `StarTransaction`) AND (b) product
   spec: ranking dimension (stars? attendance?), scope (facility/global/class), tie-break, time window, page size.
5. **`network-ip` real build** needs a new `facilityNetwork` CRUD endpoint (`list`/`create`/`delete`). Model + CIDR shape
   exist (`checkin/router.ts:48`, `ipMatchesCidr`), so spec is mostly derivable — but still an `apps/api` change (out of current scope).
6. **`shift-config` real build** needs new `shift.listGroups` + `shift.listTemplates` read queries (write mutations already
   exist). Also confirm the intended UX: is this admin group/template catalog management, or the employee registration flow?
