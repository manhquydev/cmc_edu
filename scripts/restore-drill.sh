#!/usr/bin/env bash
# restore-drill.sh — download latest backup → restore into temp DB → smoke-test.
# RT-13: verifies backup is recoverable and backup host ≠ deploy host.
# Must PASS at least once before seeding production data.
#
# Usage:
#   DRILL_PG_URL=postgresql://postgres:pw@localhost:5432/cmc_drill \
#   source .env.prod && ./scripts/restore-drill.sh

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL (superuser) required for drill}"
: "${APP_DATABASE_URL:?APP_DATABASE_URL (cmc_app) required for RLS smoke test}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET required}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY required}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY required}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-auto}"

# Drill target — defaults to a throw-away DB on localhost; never the prod DB.
DRILL_PG_URL="${DRILL_PG_URL:-postgresql://postgres:postgres@localhost:5432/cmc_drill}"
DRILL_DB="$(echo "${DRILL_PG_URL}" | grep -oP '(?<=/)[^/?]+$')"

echo "=== RESTORE DRILL ==="

# RT-13: assert backup host ≠ deploy host
DEPLOY_HOST="$(hostname -f)"
BACKUP_HOST="$(echo "${BACKUP_S3_ENDPOINT}" | sed 's|https\?://||' | cut -d/ -f1)"
if [ "${BACKUP_HOST}" = "${DEPLOY_HOST}" ] || [ "${BACKUP_HOST}" = "localhost" ] || \
   [ "${BACKUP_HOST}" = "127.0.0.1" ] || [ "${BACKUP_HOST}" = "minio" ]; then
  echo "FAIL [RT-13]: backup host '${BACKUP_HOST}' must differ from deploy host '${DEPLOY_HOST}'" >&2
  exit 1
fi
echo "PASS [RT-13]: backup_host=${BACKUP_HOST} ≠ deploy_host=${DEPLOY_HOST}"

# Find latest backup
echo "[drill] listing backups in s3://${BACKUP_S3_BUCKET}/db-backups/"
LATEST_KEY="$(AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY}" \
  AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY}" \
  aws s3 ls "s3://${BACKUP_S3_BUCKET}/db-backups/" \
    --endpoint-url "${BACKUP_S3_ENDPOINT}" \
    --region "${BACKUP_S3_REGION}" | \
  sort | tail -1 | awk '{print $4}')"

if [ -z "${LATEST_KEY}" ]; then
  echo "FAIL: no backups found in s3://${BACKUP_S3_BUCKET}/db-backups/" >&2
  exit 1
fi
echo "[drill] latest backup: ${LATEST_KEY}"

DUMP_FILE="/tmp/restore-drill-$(date -u +%s).dump"
echo "[drill] downloading..."
AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY}" \
AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY}" \
aws s3 cp \
  "s3://${BACKUP_S3_BUCKET}/db-backups/${LATEST_KEY}" \
  "${DUMP_FILE}" \
  --endpoint-url "${BACKUP_S3_ENDPOINT}" \
  --region "${BACKUP_S3_REGION}"
echo "[drill] downloaded: $(du -sh "${DUMP_FILE}" | cut -f1)"

# Create throw-away drill DB (drop if exists)
echo "[drill] creating drill DB: ${DRILL_DB}"
psql "${DATABASE_URL%/*}/postgres" \
  -c "DROP DATABASE IF EXISTS ${DRILL_DB};" \
  -c "CREATE DATABASE ${DRILL_DB};"

# Restore
echo "[drill] restoring..."
pg_restore --no-acl --no-owner -d "${DRILL_PG_URL}" "${DUMP_FILE}"
echo "[drill] restore complete"

# Smoke query 1: table count
TABLE_COUNT="$(psql "${DRILL_PG_URL}" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
if [ "${TABLE_COUNT}" -lt 5 ]; then
  echo "FAIL: smoke query returned only ${TABLE_COUNT} tables (expected ≥5)" >&2
  exit 1
fi
echo "PASS [smoke-1]: ${TABLE_COUNT} tables found in restored DB"

# Smoke query 2: RLS query via cmc_app — must not error (even if 0 rows on empty DB)
DRILL_APP_URL="${DRILL_PG_URL/postgres:postgres/cmc_app:${APP_DATABASE_URL##*:}}"
DRILL_APP_URL="${DRILL_APP_URL%%@*}@${DRILL_PG_URL##*@}"
RLS_RESULT="$(psql "${APP_DATABASE_URL%/*}/${DRILL_DB}" -tAc \
  "SELECT count(*) FROM \"Receipt\";" 2>&1 || echo "ERROR")"
if echo "${RLS_RESULT}" | grep -q "ERROR"; then
  echo "FAIL: RLS smoke query via cmc_app failed: ${RLS_RESULT}" >&2
  exit 1
fi
echo "PASS [smoke-2]: RLS query via cmc_app returned ${RLS_RESULT} Receipt rows"

# Cleanup
rm -f "${DUMP_FILE}"
psql "${DATABASE_URL%/*}/postgres" -c "DROP DATABASE IF EXISTS ${DRILL_DB};"
echo "[drill] drill DB dropped"

echo "=== RESTORE DRILL PASSED ==="
echo "  backup: ${LATEST_KEY}"
echo "  tables: ${TABLE_COUNT}"
echo "  backup_host ≠ deploy_host: ${BACKUP_HOST} ≠ ${DEPLOY_HOST}"
