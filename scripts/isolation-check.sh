#!/usr/bin/env bash
# isolation-check.sh — assert cmcv2-prod stack shares NO resources with cmcnew-*.
# Exits non-zero if any container/network/volume/port collision is found.
# Run before first deploy and after any infrastructure change.

set -euo pipefail

FAIL=0

echo "=== cmcv2-prod isolation check ==="

# 1. Container names must not overlap with cmcnew-*
echo "[1] checking container names..."
CMCNEW_CONTAINERS="$(docker ps --format '{{.Names}}' | grep '^cmcnew' || true)"
CMCV2_CONTAINERS="$(docker ps --format '{{.Names}}' | grep '^cmcv2-prod' || true)"
for c in ${CMCV2_CONTAINERS}; do
  if echo "${CMCNEW_CONTAINERS}" | grep -qx "${c}"; then
    echo "  FAIL: container name collision: ${c}" >&2
    FAIL=1
  fi
done
echo "  cmcv2 containers: $(echo "${CMCV2_CONTAINERS}" | tr '\n' ' ' || echo '(none running)')"

# 2. Networks must not overlap
echo "[2] checking networks..."
CMCNEW_NETS="$(docker network ls --format '{{.Name}}' | grep cmcnew || true)"
CMCV2_NETS="$(docker network ls --format '{{.Name}}' | grep cmcv2 || true)"
for n in ${CMCV2_NETS}; do
  if echo "${CMCNEW_NETS}" | grep -qx "${n}"; then
    echo "  FAIL: network name collision: ${n}" >&2
    FAIL=1
  fi
done

# 3. Volumes must not overlap
echo "[3] checking volumes..."
CMCNEW_VOLS="$(docker volume ls --format '{{.Name}}' | grep cmcnew || true)"
CMCV2_VOLS="$(docker volume ls --format '{{.Name}}' | grep cmcv2 || true)"
for v in ${CMCV2_VOLS}; do
  if echo "${CMCNEW_VOLS}" | grep -qx "${v}"; then
    echo "  FAIL: volume name collision: ${v}" >&2
    FAIL=1
  fi
done

# 4. Ports — cmcv2 nginx occupies 80/443; assert no cmcnew container uses those
echo "[4] checking port conflicts on 80/443..."
PORT_USERS="$(docker ps --format '{{.Ports}} {{.Names}}' | grep -E ':80->|:443->' || true)"
CONFLICT="$(echo "${PORT_USERS}" | grep cmcnew || true)"
if [ -n "${CONFLICT}" ]; then
  echo "  FAIL: cmcnew container using port 80 or 443: ${CONFLICT}" >&2
  FAIL=1
fi
echo "  port 80/443 users: ${PORT_USERS:-none}"

if [ "${FAIL}" -eq 0 ]; then
  echo "=== PASS: no isolation violations found ==="
else
  echo "=== FAIL: isolation violations detected (see above) ===" >&2
  exit 1
fi
