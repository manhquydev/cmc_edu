---
title: "Test System Modernization Phase 1"
description: "Deterministic verifier coverage and source-only API test discovery"
status: completed
priority: P1
effort: "small"
tags: [testing, ci, vitest, acceptance]
created: 2026-08-09
---

# Test System Modernization Phase 1

## Overview

Harden the existing automated proof system without changing product contracts,
branch protection, critical-flow policy, or broad CI gates. The change makes
acceptance/business verifier tests part of the existing blocking root test
path and prevents Vitest from collecting generated API test copies.

## Outcome Contract

- **Outcome:** root `pnpm test` exercises deterministic acceptance/business
  verifier tests, and API Vitest discovers only source tests.
- **Constraints:** preserve CLI output/exit behavior, serial shared-Postgres
  execution, coverage thresholds, and existing CI policy.
- **Non-goals:** no Testcontainers rollout, no property/mutation testing gate,
  no Playwright sharding, no branch-protection changes, no rewrite of
  money/state criticality policy.
- **Evidence:** prior research, baseline, and two independent review reports in
  `plans/reports/`.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Run verifier unit tests through the existing blocking root test path | P1 |
| 2 | Make API Vitest discovery explicitly source-only | P1 |
| 3 | Preserve all existing public and maintainer contracts | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Deterministic proof hardening](./phase-01-deterministic-proof-hardening.md) | Completed |

## Success Criteria

- [x] Existing script `.mjs` tests still run.
- [x] Existing acceptance-report TypeScript tests run under `@cmc/scripts test`.
- [x] Business verifier pure behavior has deterministic tests for
      not-proven, reachable-only, verified-correct, stale SHA, empty evidence,
      and strict/non-strict outcomes.
- [x] `apps/api/dist/**/*.test.js` is not discovered by API Vitest.
- [x] API tests remain serialized and coverage configuration is unchanged.
- [x] Focused tests, typecheck, lint, and the broadest feasible root suite pass;
      infrastructure-only blockers are recorded distinctly.
- [x] Independent code-reviewer finds no unresolved correctness or contract
      regression.

<!-- slug: test-system-modernization-phase-1 -->

## Completion Record

- **Phase status:** completed — 1/1 phase and 10/10 tracked checklist items
  reconciled on 2026-08-09.
- **Validation:** focused verifier tests, scripts typecheck, workspace
  typecheck, lint, API source-only discovery, and `business:verify` passed.
  Strict verifier failure was expected and confirmed.
- **Known limitations:** root `pnpm test` remains red outside this phase because
  `@cmc/llm`'s generated `dist/index.test.js` hash test timed out while its
  source test passed. There is also no artifact-dependent command-level
  `business:verify` smoke in the blocking suite; acceptance artifacts are
  ignored/generated in CI.
- **Risk posture:** no Phase 1 correctness or public-contract regression was
  found by independent review. CI remains the authority for DB-backed API
  tests because no local Postgres service was available.
