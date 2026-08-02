---
title: "P0 local-sim harden non-root loopback CI permissions"
description: "Harden local-sim (prod-on-machine): non-root api/worker, loopback host ports, CI least-privilege permissions. Repo stays public."
status: remediated
priority: P0
effort: "2-4h"
tags: [devops, docker, ci, local-sim, security]
created: 2026-08-02
---

# P0: Local-sim harden — non-root + loopback ports + CI permissions

## Overview

Hardening for **local-sim** (production stack on dev machine, closest to real VPS). User decisions locked:

1. **Environment model:** local-sim = `docker-compose.prod.yml` + `infra/compose.local-sim.yml` on this machine; later VPS = prod file only.
2. **Repo:** stay **public** during development (no self-hosted runner).
3. **P0 #2 ports:** option **A** — bind host ports to `127.0.0.1` only (keep DX for host prisma; close LAN/WAN exposure).

Brainstorm/advise: `plans/reports/brainstorm-advise-260802-1035-local-sim-vs-p0-scope.md`

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | api + worker containers run as non-root (`node` UID 1000) | P0 |
| 2 | local-sim publishes 5432/3000 on **127.0.0.1 only** | P0 |
| 3 | CI workflow default `permissions: contents: read`; artifact jobs get minimal write | P0 |

## Non-goals

- Private repo / self-hosted runner
- Slim image 1.13GB → 300MB
- CodeQL UI / Trivy image scan
- Resource limits / cap_drop (P1)
- Pure-prod only (removing local-sim DX)

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Contract lock + red-team](./phase-01-start.md) | completed |
| 2 | [Non-root api/worker Dockerfiles](./phase-02-non-root-api-worker-dockerfiles.md) | completed |
| 3 | [Local-sim loopback bind ports](./phase-03-local-sim-loopback-bind-ports.md) | completed |
| 4 | [CI workflow least-privilege permissions](./phase-04-ci-workflow-least-privilege-permissions.md) | completed |

## Success Criteria

- [x] Main process UID is non-root (`docker top` → node/UID 1000; note: bare `exec whoami` is root by default — use `-u node` or `docker top`)
- [x] same for worker
- [x] api + worker health = healthy after rebuild
- [x] `ss -lntp` shows `127.0.0.1:5432` and `127.0.0.1:3000` (not `0.0.0.0`)
- [x] host can still reach localhost:5432/3000 (loopback bind)
- [x] `.github/workflows/ci.yml` has top-level least-privilege `permissions`
- [x] entrypoint chowns BLOB_STORAGE_DIR before su-exec node

## Red-team summary (inline)

| Attack / failure | Mitigation in plan |
|------------------|-------------------|
| Named volume `/data` owned root → non-root EACCES | entrypoint as root: mkdir+chown then `su-exec node` |
| `USER node` without entrypoint | use entrypoint pattern; copy to both Dockerfiles |
| CI artifact upload fails after `contents: read` only | job-level `actions: write` on ui-e2e + security-scan |
| Loopback break host tools using LAN IP | document use `127.0.0.1` / `localhost` only |
| Prod file accidentally gets 5432 ports | phase 3 only touches `compose.local-sim.yml` |

## Validate checklist

- [x] Outcome concrete
- [x] User chose port option A
- [x] Public repo constraint recorded
- [x] Blob volume ownership risk addressed
- [x] Acceptance criteria measurable

## Handoff

After phases complete: rebuild stack, verify criteria, optional commit via user.

## Remediation (2026-08-02)

Independent review **REQUEST_CHANGES** (`plans/reports/code-review-260802-1035-…`).
Follow-up plan: `plans/260802-1038-p0-review-remediation-entrypoint-fail-closed/`.

| Finding | Status |
|---------|--------|
| I-D1 fail-open chown | fixed in 1038 |
| I-D2 chown -R | fixed in 1038 |
| I-D3 acceptance overclaim | fixed in 1038 |
| I-C1 nginx 0.0.0.0 | residual (non-goal) |


<!-- slug: p0-local-sim-harden-non-root-loopback-ci-permissions -->
