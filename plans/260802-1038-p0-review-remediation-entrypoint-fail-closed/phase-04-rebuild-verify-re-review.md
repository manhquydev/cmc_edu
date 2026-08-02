---
phase: 4
title: "Rebuild verify re-review"
status: pending
priority: P0
---

# Phase 4: Verify

```bash
docker compose -p cmcv2-prod --env-file .env.prod \
  -f docker-compose.prod.yml -f infra/compose.local-sim.yml \
  build api worker && up -d --no-deps api worker
# docker top → uid 1000
# curl 127.0.0.1:3000/health
# exec -u node touch blob
# grep entrypoint for || true / -R empty
```

## Success Criteria

- [ ] All checks green
- [ ] Independent re-check of entrypoint text (no Important left)
