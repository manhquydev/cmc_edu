#!/usr/bin/env bash
# synthetic-seed-env.sh — stand up a throwaway, synthetic-seeded Postgres for
# UI e2e / Phase-4 evidence capture. Self-contained: it runs its OWN dedicated
# Postgres container (NOT the local-sim `cmcv2-prod-*` stack, which physically
# hosts the real `cmc_prod` child-data DB — plan 260718-0423 D6). Reusable and
# idempotent.
#
# Safety model (plan 260718-0519 F5, red-team R1-S4 Critical): a DB-NAME check
# alone is bypassable (socat can present a `cmc_synth` pathname over a prod
# server). So this script requires a POSITIVE out-of-band signal
# `SYNTH_SEED_ALLOW=1` before it will write, AND runs the shared fail-closed
# `assertNotProdDatabase` guard (apps/e2e/src/assert-not-prod.ts — single source
# of truth, same guard the e2e global-setup uses) against BOTH connection URLs.
#
# Usage:
#   SYNTH_SEED_ALLOW=1 scripts/synthetic-seed-env.sh [--fresh]
#     --fresh   drop & recreate the container from scratch (default: reuse if up)
#
# On success it prints the two URLs to export for the e2e run:
#   APP_DATABASE_URL  — connects as the restricted `cmc_app` role (RLS-enforced,
#                       NOSUPERUSER — the API server refuses a superuser, ADR 0042)
#   DATABASE_URL      — connects as the `postgres` owner (migrations + teardown)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CONTAINER="${SYNTH_PG_CONTAINER:-cmc-synth-pg}"
PORT="${SYNTH_PG_PORT:-55432}"
PG_PASSWORD="${SYNTH_PG_PASSWORD:-synth}"
DB_NAME="cmc_synth"
FRESH=0
[ "${1:-}" = "--fresh" ] && FRESH=1

OWNER_URL="postgresql://postgres:${PG_PASSWORD}@localhost:${PORT}/${DB_NAME}"
APP_URL="postgresql://cmc_app:${PG_PASSWORD}@localhost:${PORT}/${DB_NAME}"

# ── Gate 1: positive allow signal ────────────────────────────────────────────
if [ "${SYNTH_SEED_ALLOW:-}" != "1" ]; then
  echo "REFUSING: set SYNTH_SEED_ALLOW=1 to build the synthetic-seed env (a name check alone is not a control — plan R1-S4)." >&2
  exit 1
fi

# ── Gate 2: shared fail-closed prod guard on BOTH urls ───────────────────────
APP_DATABASE_URL="$APP_URL" DATABASE_URL="$OWNER_URL" npx tsx -e '
import { assertNotProdDatabase } from "./apps/e2e/src/assert-not-prod.ts";
assertNotProdDatabase(process.env.APP_DATABASE_URL);
assertNotProdDatabase(process.env.DATABASE_URL);
console.log("prod guard OK (both URLs)");
'

# ── Container lifecycle (dedicated, outside local-sim) ────────────────────────
if [ "$FRESH" = "1" ]; then
  echo "--fresh: removing container $CONTAINER"
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Starting dedicated throwaway Postgres container: $CONTAINER (port $PORT)"
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_PASSWORD="$PG_PASSWORD" -e POSTGRES_USER=postgres \
    -p "${PORT}:5432" postgres:16-alpine >/dev/null
fi

echo -n "Waiting for Postgres to accept connections"
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then echo " — ready"; break; fi
  echo -n "."; sleep 1
done

# ── Create DB (idempotent) — via the container's own psql, host psql not required
docker exec "$CONTAINER" psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" \
  | grep -q 1 || docker exec "$CONTAINER" psql -U postgres -c "CREATE DATABASE ${DB_NAME}"

# ── Migrate (owner role) — via the @cmc/db package's OWN prisma (v6): the repo
#    root resolves a newer prisma (v7) that rejects `url = env()` in schema. ────
echo "Applying migrations (prisma migrate deploy)"
DATABASE_URL="$OWNER_URL" pnpm --filter @cmc/db exec prisma migrate deploy >/dev/null

# ── Restricted role password (migration creates cmc_app NOSUPERUSER without a
#    password; set it out-of-band so the app can log in as it — ADR 0042) ──────
docker exec "$CONTAINER" psql -U postgres -d "$DB_NAME" -c "ALTER ROLE cmc_app WITH PASSWORD '${PG_PASSWORD}'" >/dev/null

# ── Seed (plants dev facility + synthetic sentinel) ──────────────────────────
echo "Seeding (node prisma/seed.mjs)"
DATABASE_URL="$OWNER_URL" node packages/db/prisma/seed.mjs

# ── Verify sentinel via the RESTRICTED cmc_app role (proves the app role can
#    read it — RLS/grants OK), querying through the container's own psql so the
#    check does not depend on a Prisma-client version or a stray prisma/.env.
#    Expected code comes from the shared constants module (DRY, no hardcode). ──
EXPECTED_CODE="$(node -e 'import("./packages/db/prisma/seed-constants.mjs").then(m => process.stdout.write(m.SYNTHETIC_SEED_FACILITY_CODE))')"
FOUND_CODE="$(docker exec "$CONTAINER" psql "postgresql://cmc_app:${PG_PASSWORD}@localhost:5432/${DB_NAME}" -tAc "SELECT code FROM \"Facility\" WHERE code = '${EXPECTED_CODE}'" 2>/dev/null | tr -d '[:space:]')"

if [ "$FOUND_CODE" != "$EXPECTED_CODE" ]; then
  echo "FAILED: sentinel '${EXPECTED_CODE}' not readable by cmc_app after seed (found: '${FOUND_CODE}')" >&2
  exit 1
fi
SENTINEL_CODE="$FOUND_CODE"

echo ""
echo "✅ synthetic-seed env ready. Sentinel facility code: ${SENTINEL_CODE}"
echo "Export these for the UI e2e run:"
echo "  export APP_DATABASE_URL=\"${APP_URL}\""
echo "  export DATABASE_URL=\"${OWNER_URL}\""
