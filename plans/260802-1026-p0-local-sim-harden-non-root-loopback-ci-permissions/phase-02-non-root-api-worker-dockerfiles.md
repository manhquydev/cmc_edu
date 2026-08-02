---
phase: 2
title: "Non-root api worker Dockerfiles"
status: completed
priority: P0
effort: "1-2h"
dependencies: [1]
---

# Phase 2: Non-root api/worker Dockerfiles

## Overview

Run api + worker as the stock Alpine `node` user (UID 1000) via entrypoint that chowns blob dir then `su-exec node`.

## Requirements

- Functional: process user is not root; health endpoints still pass
- Functional: local-disk blob storage under BLOB_STORAGE_DIR remains writable
- Non-functional: no change to app source; image-only

## Related Code Files

- Create: `infra/docker/docker-entrypoint-node.sh`
- Modify: `infra/docker/Dockerfile.api`
- Modify: `infra/docker/Dockerfile.worker`
- Do not modify: admin/lms Dockerfiles

## Implementation Steps

1. Add shared entrypoint script:
   - if uid 0: `mkdir -p` blob dir from `BLOB_STORAGE_DIR` (default `/data` or `.data/blobs`), `chown -R node:node`, `exec su-exec node "$@"`
   - else: exec args
2. Runtime stage both Dockerfiles:
   - `apk add --no-cache su-exec` (or wget already there for health — add su-exec)
   - COPY entrypoint, chmod +x
   - ENTRYPOINT + existing CMD
   - Do **not** set `USER node` before entrypoint (entrypoint must start as root for chown)
3. Rebuild api worker:  
   `docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml -f infra/compose.local-sim.yml build api worker && ... up -d --no-deps api worker`
4. Verify whoami + health + optional touch blob path

## Success Criteria

- [x] Main process UID 1000: `docker top <api|worker> -eo uid,user,cmd` (node on `node dist/…`)
- [x] `docker compose exec -u node -T api whoami` → `node`
- [x] Bare `docker compose exec -T api whoami` → **root** (expected: no image USER; entrypoint drop only)
- [x] healthchecks healthy
- [x] blob dir writable as node (entrypoint fail-closed after remediation 1038)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| su-exec missing on alpine | apk add in runtime stage |
| chown on huge volume slow | chown only baseDir once at start |
| S3 mode no local dir | entrypoint still OK; mkdir only when BLOB_STORAGE_DIR set or default path exists |
