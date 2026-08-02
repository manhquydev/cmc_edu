---
phase: 3
title: "Local-sim loopback bind ports"
status: completed
priority: P0
effort: "15m"
dependencies: [1]
---

# Phase 3: Local-sim loopback bind ports

## Overview

Change local-sim host port publishes from all-interfaces to loopback only. Pure prod compose unchanged (no postgres/api host ports).

## Requirements

- `5432` and `3000` listen on 127.0.0.1 only
- Host prisma/psql via localhost still works
- nginx 80/443 may stay 0.0.0.0 (browser access on machine; optional later)

## Related Code Files

- Modify: `infra/compose.local-sim.yml` only

## Implementation Steps

1. Change:
   ```yaml
   postgres:
     ports:
       - "127.0.0.1:5432:5432"
   api:
     ports:
       - "127.0.0.1:3000:3000"
   ```
2. Recreate postgres + api:  
   `docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml -f infra/compose.local-sim.yml up -d postgres api`
3. Verify with `ss -lntp | grep -E '5432|3000'`

## Success Criteria

- [ ] Bind address is 127.0.0.1 for 5432 and 3000
- [ ] `curl -sf http://127.0.0.1:3000/health` works
- [ ] `docker-compose.prod.yml` still has no postgres host ports

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Scripts hardcode LAN IP | use localhost |
| Docker recreate postgres drops nothing (named volume) | confirm volume preserved |
