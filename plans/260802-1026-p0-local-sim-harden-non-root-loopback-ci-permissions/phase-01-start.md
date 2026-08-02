---
phase: 1
title: "Contract lock + red-team"
status: completed
priority: P0
effort: "30m"
dependencies: []
---

# Phase 1: Contract lock + red-team

## Overview

Lock brainstorm/advise decisions and adversarial review before touching Docker/CI.

## Decisions locked

| Topic | Decision |
|-------|----------|
| Env model | local-sim on dev machine; pure prod later on VPS |
| Repo | public for now |
| Ports | option A — `127.0.0.1` bind |
| P0 scope | non-root + loopback + CI permissions only |

## Red-team findings (accepted into later phases)

1. **Blob volume:** local-sim mounts `cmcv2-local-blobs:/data` — if volume was created as root, `USER node` breaks writes. **Mitigation:** entrypoint chown then drop privileges.
2. **Healthcheck:** `wget` as node user OK (binary readable).
3. **CI artifacts:** need `actions: write` on jobs that upload.
4. **Do not** remove host ports entirely (breaks host prisma DX).

## Success Criteria

- [x] User confirmed option A
- [x] Contract written in plan.md
- [x] Risks documented with mitigations
