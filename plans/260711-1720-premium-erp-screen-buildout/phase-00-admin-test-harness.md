# Phase 00 — Admin test harness + `@cmc/ui` LineIcon extend (prerequisite)

## Context links
- Parent: [plan.md](plan.md)
- Pattern to copy: `packages/ui/vitest.config.ts`, `packages/ui/test-setup.ts`, `packages/ui/src/components/list-page.test.tsx`
- Existing admin tests (node-env, must stay green): `apps/admin/src/pages/cockpit-counter.test.ts`, `apps/admin/src/shell/nav-registry.test.ts`
- LineIcon source (extend here): `packages/ui/src/components/line-icon.tsx:9` (`IconName` union) + `:15` (`PATHS` map); barrel re-export `packages/ui/src/index.ts:70-71`; icon test `packages/ui/src/components/line-icon.test.tsx`

## Pre-step: branch
Cut `feat/premium-erp-buildout` from `main` before any edits. All plan work lands on this branch.

## Overview
`apps/admin` currently has no jsdom/testing-library harness (see `apps/admin/package.json` — no `@testing-library/*`,
no `jsdom`; `vite.config.ts` has no `test` block). TDD for the screen phases needs: jsdom opt-in, jest-dom matchers,
and a shared `renderWithProviders` helper that mounts a Router + a **mocked tRPC** client + session, so a screen can be
rendered and its behavior asserted without a live API.

## Key insights
- `@cmc/ui` scopes jsdom to its own package and documents the convention: apps keep node default; component tests
  opt in per file via `// @vitest-environment jsdom`. Follow the same convention — do NOT force jsdom globally
  (the 2 node-env logic tests must be untouched).
- Screens are tRPC-coupled (unlike dumb `@cmc/ui` components). Behavior tests assert data-binding + `mutate` calls,
  which requires stubbing the `trpc` module (`apps/admin/src/lib/trpc.ts`).
- `MetricCard`/`TaskRow` render react-router `Link` → the render helper must provide a `MemoryRouter`.

## Requirements
### A. Admin component-test harness
- Add jsdom + testing-library devDeps to `apps/admin`.
- Provide a vitest config enabling per-file jsdom + jest-dom setup, keeping `include` covering `src/**/*.test.{ts,tsx}`.
- Provide `src/test/render-with-providers.tsx` and `src/test/mock-trpc.ts` helpers.
- One smoke test proving the harness works (render cockpit or a trivial screen with mocked trpc).

### B. `@cmc/ui` LineIcon additive extension (user-approved public-API change)
- Add exactly 5 keys to `IconName` union (`line-icon.tsx:9-13`) and matching entries to `PATHS` (`line-icon.tsx:15-39`):
  `globe`, `clock`, `trophy`, `gift`, `star`. Copy geometry from **Feather (MIT)** to match the existing set's provenance
  — suggested Feather sources: `globe`, `clock`, `award` (→ `trophy`), `gift`, `star`.
- **Additive only**: no existing key renamed/removed → non-breaking for the 12 migrated screens + shell nav.
- Honor the monochrome invariant enforced by `line-icon.test.tsx`: outline only, no `fill`/`stroke`/`color` on child
  shapes (inherit `currentColor` from the `<svg>`). Do NOT use a filled `star` polygon-with-fill.
- Extend `line-icon.test.tsx` to assert each new key renders an svg (cheap loop over the 5 names) so the additive keys
  are locked.
- Icon→screen mapping (consumed downstream): `trophy`→leaderboard, `globe`→network-ip, `clock`→shift-config,
  `gift`/`star`→engagement gifts. This is the earliest place all consumers (phase-01, phase-02) can share the keys.

## Architecture / data flow
- Test → `renderWithProviders(<Screen/>)` mounts `MemoryRouter` + `QueryClientProvider` + session context stub.
- `vi.mock('../lib/trpc.js', …)` (per test file) returns `{ useQuery: () => ({data, isLoading, error}), useMutation: () => ({ mutate, isPending, error }) }` shaped stubs. Assert `mutate` called with expected input on action.

## Related code files
- Create: `apps/admin/vitest.config.ts` (or add `test` block to `vite.config.ts`) — jsdom via `environmentMatchGlobs`/per-file pragma, `globals: true`, `setupFiles`.
- Create: `apps/admin/test-setup.ts` (import `@testing-library/jest-dom`).
- Create: `apps/admin/src/test/render-with-providers.tsx`, `apps/admin/src/test/mock-trpc.ts`.
- Modify: `apps/admin/package.json` (devDeps: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`; match `@cmc/ui` versions).
- Verify unchanged: `apps/admin/src/pages/cockpit-counter.test.ts` still passes under node env.

## Implementation steps
1. Add devDeps mirroring `@cmc/ui` versions; `pnpm install`.
2. Add vitest config: keep node default, allow jsdom per-file, wire `test-setup.ts` (globals + jest-dom).
3. Write `render-with-providers` (MemoryRouter + QueryClient + session stub) and `mock-trpc` factory.
4. Write one smoke test (`// @vitest-environment jsdom`) asserting a screen renders text.
5. Run gate; confirm the 2 pre-existing node tests still pass.

## Todo list
- [x] cut `feat/premium-erp-buildout` branch from main
- [x] LineIcon: add 5 keys (globe/clock/trophy/gift/star) + extend line-icon.test.tsx
- [x] `@cmc/ui` gate: `pnpm --filter @cmc/ui test` + typecheck green (icon test updated)
- [x] devDeps + install
- [x] vitest config + setup
- [x] render + trpc-mock helpers
- [x] smoke test
- [x] verify gate + legacy tests green

## Success criteria
- `@cmc/ui` exports 5 new `IconName` keys; existing keys untouched; `line-icon.test.tsx` green (incl. new-key assertions).
- `pnpm --filter @cmc/admin test` runs both node-env logic tests AND ≥1 jsdom component test, all green.
- `pnpm --filter @cmc/admin typecheck` + `pnpm build` (14/14) + `pnpm lint` clean.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| Global jsdom breaks node logic tests | Med×Med | Per-file `// @vitest-environment jsdom`; do not set global env |
| trpc-mock shape drifts from real client | Med×Med | Type the mock against `trpc` inferred types; keep helper thin |
| Version skew with `@cmc/ui` deps | Low×Low | Copy exact versions from `packages/ui/package.json` |
| New icon breaks monochrome invariant (filled star/gift) | Med×Med | Outline-only geometry; run `line-icon.test.tsx` fill/stroke assertion over the 5 keys |
| `@cmc/ui` public-API change surprises other consumers | Low×Low | Additive only (no rename/remove); barrel re-export unchanged; `pnpm build` 14/14 covers all consumers |

## Security considerations
None — test-only infra, no secrets, no network. Mock data is synthetic.

## Next steps
Unblocks phases 01–07 (harness + icon keys). Branch `feat/premium-erp-buildout` already cut in the pre-step.
