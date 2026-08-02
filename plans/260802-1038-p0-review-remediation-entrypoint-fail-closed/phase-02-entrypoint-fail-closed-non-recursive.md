---
phase: 2
title: "Entrypoint fail-closed non-recursive"
status: pending
priority: P0
---

# Phase 2: Entrypoint fail-closed

## Overview

Rewrite `infra/docker/docker-entrypoint-node.sh` per I-D1/I-D2.

## Implementation

1. `mkdir -p "$blob_dir"`
2. `chown node:node "$blob_dir"` (no `-R`, no `|| true`)
3. When blob_dir set: `su-exec node sh -c "test -w \"$blob_dir\""` before app
4. `exec su-exec node "$@"`
5. elif `/data` exists: chown `/data` non-recursive only (or mkdir not needed)

## Success Criteria

- [ ] `grep -E '\|\| true|chown -R' infra/docker/docker-entrypoint-node.sh` → empty
- [ ] Rebuild + boot healthy
