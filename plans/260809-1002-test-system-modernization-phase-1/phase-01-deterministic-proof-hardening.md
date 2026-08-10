---
title: "Phase 1: Deterministic proof hardening"
status: completed
---

# Phase 1: Deterministic proof hardening

## Overview

Close two evidence-system gaps: verifier tests that exist outside the default
test path, and generated API test copies that Vitest can collect after builds.

## Requirements

- [x] Keep `node --test ./*.test.mjs` in `@cmc/scripts test`.
- [x] Add a scripts-level Vitest config scoped to acceptance/business tests.
- [x] Refactor `business:verify` only enough to test pure classification and
      strict-failure composition; keep the CLI contract intact.
- [x] Add API `test.include` for current source `.test.ts` convention.
- [x] Do not modify `.github/workflows/ci.yml`, `turbo.json`, branch
      protection, or critical-flow keyword policy.

## Implementation Steps

1. Add `scripts/vitest.config.ts` and wire it after the existing Node tests.
2. Export/test the verifier's pure classification and strict-failure logic.
3. Add source-only discovery to `apps/api/vitest.config.ts`.
4. Run focused tests, then typecheck/lint/root tests and CI-equivalent checks
   where local Postgres/Prisma infrastructure permits.
5. Run independent review; fix evidence-backed findings and rerun validation.

## Todo

- [x] Implement script test wiring.
- [x] Implement business verifier tests.
- [x] Implement API discovery boundary.
- [x] Validate locally and record infrastructure limits.
- [x] Complete review rounds 2 and 3.

## Success Criteria

- Root test path proves verifier tests execute.
- API test list contains `src` tests and no generated `dist` tests.
- CLI behavior and policy remain unchanged.
- No new lint/type/build failure.

## Risks and Rollback

- **CLI regression:** refactor could change `business:verify` exit behavior.
  Mitigate with pure tests plus CLI smoke; rollback verifier exports/helpers.
- **Dropped legacy tests:** combined script command could omit `.mjs` tests.
  Keep and explicitly execute the existing Node test command.
- **Discovery under-match:** source include could miss a supported naming
  convention. Validate current test inventory and list output; rollback only
  the new `include`.
- **Local infrastructure:** API suite may require Postgres and generated Prisma.
  Treat CI as authority when local prerequisites are absent and report the
  blocker honestly.
