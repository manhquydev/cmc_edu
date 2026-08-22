# US-UI-08 Docs/harness sync + e2e UI-driven setup

## Status

in-progress

## Lane

normal

## Product Contract

Three deliverables:

1. **Docs sync** — update `docs/06`, `docs/10`, `docs/11`, `docs/12`, `docs/15`, `docs/18`,
   `docs/19`, `docs/24` to reflect product decisions made during the UI build phases.
   Add decision note for QĐ0033 reversal (receipt code format change PT → SO).
   Do not describe email transport as a stub. Prod uses `BrevoEmailTransport`; console is dev/test only. Current prod failure is HTTP 401 (invalid key).

2. **Harness story packets** — story files `US-UI-01a` through `US-UI-08` (this file) in
   `docs/stories/` following the US-001 template.

3. **Playwright browser project** — add `projects` array and `webServer` array to
   `apps/e2e/playwright.config.ts` so future `*.ui.spec.ts` files can use the `page` fixture
   against built previews of `apps/admin` (port 4173) and `apps/lms` (port 4174).

## Relevant Product Docs

- `docs/06-quan-ly-tuyen-sinh.md`
- `docs/10-ke-toan-va-thu-phi.md`
- `docs/11-api-contract.md`
- `docs/12-quan-he-khach-hang.md`
- `docs/15-phu-huynh-hoc-sinh-portal.md`
- `docs/18-tech-stack-va-chuan-ky-thuat.md`
- `docs/19-security-va-privacy.md`
- `docs/24-doi-soat-doanh-thu.md`

## Risk Flags

- Existing behavior (`playwright.config.ts` change must not break existing API-driven specs)

## Acceptance Criteria

- All docs reflect actual code (no stale procedure names, outdated table schemas, or wrong defaults).
- Docs must not claim `ConsoleEmailTransport` is the prod path; record Brevo + 401 key failure instead.
- Story files exist for `US-UI-01a` through `US-UI-08`.
- `playwright.config.ts` defines `projects`: `api` (matches `*.spec.ts`) and `ui-chromium`
  (matches `*.ui.spec.ts`, uses `Desktop Chrome`, `baseURL: http://localhost:4174`).
- `webServer` array starts admin preview (port 4173) and LMS preview (port 4174).
- Existing `*.spec.ts` specs still typecheck and run under the `api` project.
- `pnpm --filter @cmc/e2e typecheck` passes.

## Design Notes

- Commands: n/a (docs + config only).
- Queries: n/a.
- API: n/a.
- Tables: n/a.
- Domain rules: none.
- UI surfaces: none.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-UI-08 --unit 0 --integration 1 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | n/a. |
| Integration | `pnpm --filter @cmc/e2e typecheck` passes. |
| E2E | n/a (this story sets up the harness; specs come in subsequent stories). |
| Platform | All story files present; playwright.config.ts diff is clean. |
| Release | Existing API-driven specs run unchanged under `api` project. |

## Harness Delta

Adds Playwright `ui-chromium` browser project. Existing `api` project `testMatch` uses a
negative-lookbehind regex (`/(?<!\.ui)\.spec\.ts$/`) so `*.ui.spec.ts` files are NOT
collected by `api`. Preview servers are gated by `PLAYWRIGHT_UI=1` env var — the
`webServer` array is empty unless `PLAYWRIGHT_UI` is set, so API-only CI runs do not
attempt to start preview servers. Run UI tests with:
`PLAYWRIGHT_UI=1 pnpm test --project=ui-chromium`.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
