# US-UI-02 UI foundation — @cmc/ui components + Mantine v7 + tRPC client

## Status

done

## Lane

normal

## Product Contract

Install Mantine v7 in `packages/ui` and wire 10 reusable components:
`PageHeader`, `DataTable`, `EmptyState`, `StatCard`, `StatusBadge`, `FilterBar`,
`MasterDetail`, `Tabs`, `ConfirmDialog`, `ResultPanel`.

Wire tRPC client in `apps/admin` (QueryClient + TRPCProvider + typed router).

Build chain: `packages/ui/tsconfig.build.json` emits `dist/index.js` via `tsc`.

## Relevant Product Docs

- `docs/18-tech-stack-va-chuan-ky-thuat.md`
- `docs/09-kien-truc-c4-v2.md`

## Risk Flags

- Public contracts (component API shapes consumed by both `apps/admin` and `apps/lms`)
- Existing behavior (`@cmc/ui` already imported by apps — build breakage is immediate)

## Acceptance Criteria

- `pnpm build` for `@cmc/ui` emits `dist/index.js` without error.
- All 10 components importable from `@cmc/ui` in TypeScript strict mode.
- `cmcTheme` (Mantine theme object) exported and applied in `apps/admin` `MantineProvider`.
- `apps/admin` tRPC queries resolve against live `apps/api` in dev.

## Design Notes

- Commands: n/a.
- Queries: n/a (foundation layer only).
- API: n/a.
- Tables: n/a.
- Domain rules: none.
- UI surfaces: `packages/ui/src/` (10 components + theme).

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-UI-02 --unit 0 --integration 1 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | n/a (pure UI components; visual testing deferred). |
| Integration | `pnpm --filter @cmc/ui build` emits dist; all 10 imports resolve in typecheck. |
| E2E | n/a. |
| Platform | `pnpm build` (turbo) green including `@cmc/ui`. |
| Release | `pnpm typecheck` workspace-wide passes. |

## Harness Delta

No harness rule changes.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
