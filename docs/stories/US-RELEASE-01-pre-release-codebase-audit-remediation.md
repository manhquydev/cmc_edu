# US-RELEASE-01 Pre-Release Codebase Audit Remediation

## Status

implemented

## Lane

high-risk

## Product Contract

The pending release must not expose student assessment context to an LLM
before authorization, allow conflicting appointment terminal states, alias
invalid CRM phones, or hide valid opportunity details because of list
pagination.

## Acceptance Criteria

- Assessment draft authorization completes before LLM egress.
- Teachers may assess only students actively enrolled in an owned class.
- Concurrent appointment complete/no-show requests produce one terminal winner.
- A phone without digits is rejected and cannot create an empty dedup key.
- Opportunity detail fetches the requested id directly, independent of list pages.
- Regression tests, typecheck, lint, build, and disposable-DB migrations pass.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Phone normalizer and environment-contract checks pass. |
| Integration | Assessment, appointment, and CRM suites pass on synthetic Postgres. |
| UI | Opportunity detail tests pass with the direct-id query. |
| Platform | Migrations apply cleanly to a fresh disposable database. |

## Evidence

- Full root test suite: 102 API files and 956 API tests passed; all Turbo test tasks passed.
- Playwright API: 20 passed, 1 intentional OTP seam skipped; UI Chromium: 6/6 passed.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, and disposable-DB migrations/seed passed.
- Acceptance ledger: 38/38 flows built, 0 partial/missing, 0 untriaged routes.
- Regression tests cover pre-egress assessment authorization, appointment CAS,
  invalid phone rejection/deduplication, and direct opportunity detail lookup.
