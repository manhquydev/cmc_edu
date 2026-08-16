#!/usr/bin/env bash
# CMC EDU — VPS isolation check: assert cmc_edu can co-locate WITHOUT touching
# cmc-lms (project "docker", containers cmclms-*). Gate for deploy-vps.sh.
set -euo pipefail
FAIL=0
warn() { echo "ISOLATION-FAIL: $*"; FAIL=1; }

# 1) LMS containers must be running and untouched
docker ps --format '{{.Names}}' | grep -q '^cmclms-web$' || warn "cmclms-web not running?"
docker ps --format '{{.Names}}' | grep -q '^cmclms-api$' || warn "cmclms-api not running?"

# 2) cmc_edu project must NOT exist yet (fresh deploy)
docker compose -p cmcv2-prod ls 2>/dev/null | grep -q cmcv2-prod && warn "cmcv2-prod project already exists (not a fresh deploy)"

# 3) No cmcv2-prod-* containers or volumes
docker ps -a --format '{{.Names}}' | grep -q '^cmcv2-prod-' && warn "cmcv2-prod-* containers exist"
docker volume ls --format '{{.Name}}' | grep -q '^cmcv2-prod-' && warn "cmcv2-prod-* volumes exist"

# 4) Port 8080 free (LMS owns 80/443 only)
ss -tln | grep -q ':8080 ' && warn "port 8080 already bound"

# 5) Pinned subnet 172.28.0.0/16 free
ip -4 addr show | grep -q '172.28.' && warn "172.28.0.0/16 already in use on host"

# 6) LMS regression baseline (hoc must still answer 200 via its own nginx)
HOC=$(curl -s -m 8 -o /dev/null -w '%{http_code}' -H 'Host: hoc.cmcvn.edu.vn' https://127.0.0.1/ 2>/dev/null || echo 0)
# 6) LMS regression baseline — via Cloudflare (AOP blocks direct-to-origin localhost)
HOC=$(curl -s -m 10 -o /dev/null -w '%{http_code}' https://hoc.cmcvn.edu.vn/ 2>/dev/null || echo 0)
[ "$HOC" = 200 ] || warn "hoc.cmcvn.edu.vn not 200 via Cloudflare (got $HOC)"
exit 1