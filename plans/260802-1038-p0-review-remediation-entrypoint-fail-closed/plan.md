---
title: "P0 review remediation entrypoint fail-closed"
description: "Close review I-D1/I-D2/I-D3 + M1: fail-closed non-recursive chown, honest acceptance, local-sim header."
status: completed
priority: P0
effort: "1h"
tags: [devops, docker, security, review-remediation]
created: 2026-08-02
---

# P0 review remediation — entrypoint fail-closed

## Overview

Address independent review **REQUEST_CHANGES** (`plans/reports/code-review-260802-1035-p0-devops-harden-independent-review.md`).

Contract: `plans/reports/brainstorm-advise-260802-1038-p0-review-remediation-contract.md`

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Entrypoint chown fail-closed, non-recursive | P0 |
| 2 | Honest acceptance criteria (PID non-root) | P0 |
| 3 | local-sim header: loopback only | P1 |
| 4 | Live rebuild verify + re-review | P0 |

## Non-goals

- nginx loopback (I-C1 residual)
- Full README rewrite
- Slim image / cap_drop / CodeQL

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Red-team + validate contract](./phase-01-start.md) | completed |
| 2 | [Entrypoint fail-closed](./phase-02-entrypoint-fail-closed-non-recursive.md) | completed |
| 3 | [Docs + local-sim header](./phase-03-docs-acceptance-local-sim-header.md) | completed |
| 4 | [Rebuild verify re-review](./phase-04-rebuild-verify-re-review.md) | completed |

## Red-team (inline)

| Risk | Mitigation |
|------|------------|
| Fail-closed chown breaks boot if volume root_squash | Correct — better fail loud than silent EACCES later |
| Writability test before app exec double-drops | Use `su-exec node sh -c 'test -w …'` then `exec su-exec node "$@"` |
| Parent dir not owned by node after mkdir -p deep path | chown only leaf blob_dir after mkdir -p; node creates children |
| S3 mode no BLOB_STORAGE_DIR | Skip chown path; only su-exec |

## Validate

- [x] Scope = review findings only
- [x] Acceptance measurable via docker top + health + touch
- [x] No secret handling change

## Success Criteria

- [x] No `|| true` / no `chown -R` in entrypoint
- [x] Image rebuilt; PID1 Uid 1000; health ok; node write blob ok (2026-08-02T03:42Z)
- [x] Plan acceptance language fixed (prior plan + this plan)
- [x] Re-review: **APPROVE_WITH_NITS** then nit applied (`su-exec node test -w`)

## Delivery evidence

| Check | Result |
|-------|--------|
| `/proc/1` Uid | 1000 |
| api health | ok |
| worker health (in-container) | ok |
| node touch BLOB | blob_ok |
| entrypoint | fail-closed non-recursive + `test -w` |
| independent re-review | APPROVE_WITH_NITS → nit landed |

<!-- slug: p0-review-remediation-entrypoint-fail-closed -->
