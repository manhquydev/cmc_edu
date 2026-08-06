#!/usr/bin/env bash
# Rebuild + recreate only the admin SPA on local cmcv2-prod (local-sim overlay).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -p cmcv2-prod --env-file .env.prod \
  -f docker-compose.prod.yml \
  -f infra/compose.local-sim.yml \
  up -d --build --no-deps admin
docker compose -p cmcv2-prod ps admin
echo "OK — re-run: node apps/e2e/design3-frontend-audit.mjs"
