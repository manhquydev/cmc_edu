#!/usr/bin/env bash
# CMC EDU — deploy to VPS 152.42.167.189 (co-located with cmc-lms, zero impact).
# Usage (run ON the VPS, from /root/cmc-edu):
#   ./infra/vps/deploy-vps.sh
set -euo pipefail

C() { docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml -f infra/vps/docker-compose.override.yml "$@"; }
log() { echo "### $(date -u +%FT%TZ) $*"; }
fail() { log "FAIL: $*"; exit 1; }

[ -f .env.prod ] || fail ".env.prod missing — create from .env.prod.example (47 keys, NEW random secrets, perms 600)"
command -v docker >/dev/null || fail "docker missing"

# 0) Isolation gate: must not collide with cmc-lms (cmclms-*, 80/443, 172.28/16, volumes)
./infra/vps/isolation-check-vps.sh || fail "isolation check failed (see above)"

log "1/6 build images (api/worker/admin/lms)"
C build 2>&1 | tail -3 || fail "build failed"

log "2/6 migrate (fresh postgres volume expected)"
C up -d postgres 2>&1 | tail -2
for i in $(seq 1 30); do C exec -T postgres pg_isready -U postgres >/dev/null 2>&1 && break; sleep 2; done
docker run --rm --network cmcv2-prod_cmcv2-prod-net --env-file .env.prod   -w /app/packages/db cmcv2-prod-api:latest sh -c './node_modules/.bin/prisma migrate deploy'   || fail "migrate deploy failed"

log "3/6 ALTER ROLE cmc_app (password from APP_DATABASE_URL, redacted)"
APP_PW="$(grep '^APP_DATABASE_URL=' .env.prod | sed -E 's#^APP_DATABASE_URL=postgresql://cmc_app:([^@]+)@.*#\1#')"
C exec -T postgres psql -U postgres -v pw="$APP_PW" <<'SQL' >/dev/null
ALTER ROLE "cmc_app" WITH PASSWORD :'pw' LOGIN;
SQL
log "ALTER ROLE done (network auth verified in gate)"

log "4/6 up full stack (nginx publishes 0.0.0.0:8080; LMS 80/443 untouched)"
C up -d 2>&1 | tail -5 || fail "up failed"
for i in $(seq 1 60); do
  A=$(docker inspect --format '{{.State.Health.Status}}' cmcv2-prod-api-1 2>/dev/null || echo none)
  W=$(docker inspect --format '{{.State.Health.Status}}' cmcv2-prod-worker-1 2>/dev/null || echo none)
  [ "$A" = healthy ] && [ "$W" = healthy ] && break
  sleep 3
done
[ "$(docker inspect --format '{{.State.Health.Status}}' cmcv2-prod-api-1 2>/dev/null)" = healthy ] || fail "api not healthy — check 'docker logs cmcv2-prod-api-1' (likely cmc_app auth: re-run ALTER ROLE step)"

log "5/6 verify INSIDE compose network (AOP blocks external without CF client cert)"
H() { docker run --rm --network cmcv2-prod_cmcv2-prod-net curlimages/curl:latest -s -m 8 -o /dev/null -w '%{http_code}' -H "Host: $1" http://cmcv2-prod-nginx-1/$2; }
E1=$(H deverp.cmcvn.edu.vn /health); [ "$E1" = 200 ] || fail "erp /health = $E1"
T1=$(H deverp.cmcvn.edu.vn / | grep -o '<title>[^<]*' || true)
T2=$(H devlms.cmcvn.edu.vn / | grep -o '<title>[^<]*' || true)
log "erp /health=$E1; erp title=$T1; devlms title=$T2"

log "6/6 done. Seeds + Cloudflare origin rules are separate steps (see runbook)."
log "Rollback: docker compose -p cmcv2-prod down (keeps volumes); NEVER --rmi all (postgres:16-alpine shared with LMS)."
