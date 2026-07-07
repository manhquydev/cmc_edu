#!/usr/bin/env bash
# backup-db.sh — pg_dump → external S3 (off-box, RT-13).
# Run as a cron job on the VPS HOST (not inside the compose stack).
# Requires: pg_dump, aws CLI v2, .env.prod sourced or vars exported.
#
# Cron example (daily at 02:00 UTC):
#   0 2 * * * /opt/cmcv2/scripts/backup-db.sh >> /var/log/cmcv2-backup.log 2>&1

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT must be set (RT-13: off-box target)}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET must be set}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY must be set}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY must be set}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-auto}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

# RT-13: Assert backup target host differs from this host.
DEPLOY_HOST="$(hostname -f)"
BACKUP_HOST="$(echo "${BACKUP_S3_ENDPOINT}" | sed 's|https\?://||' | cut -d/ -f1)"
if [ "${BACKUP_HOST}" = "${DEPLOY_HOST}" ] || [ "${BACKUP_HOST}" = "localhost" ] || \
   [ "${BACKUP_HOST}" = "127.0.0.1" ] || [ "${BACKUP_HOST}" = "minio" ]; then
  echo "ERROR: RT-13 VIOLATION — backup target '${BACKUP_HOST}' appears to be on the same host as '${DEPLOY_HOST}'." >&2
  echo "Backup must use a different hardware/provider (external S3, R2, Backblaze, etc.)." >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="/tmp/cmc-prod-${TIMESTAMP}.dump"
S3_KEY="db-backups/cmc-prod-${TIMESTAMP}.dump"

echo "[backup] $(date -u +%FT%TZ) starting pg_dump → ${DUMP_FILE}"
pg_dump --format=custom --no-acl --no-owner "${DATABASE_URL}" > "${DUMP_FILE}"
DUMP_SIZE="$(du -sh "${DUMP_FILE}" | cut -f1)"
echo "[backup] dump complete: ${DUMP_SIZE}"

echo "[backup] uploading to s3://${BACKUP_S3_BUCKET}/${S3_KEY} via ${BACKUP_S3_ENDPOINT}"
AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY}" \
AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY}" \
aws s3 cp "${DUMP_FILE}" \
  "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" \
  --endpoint-url "${BACKUP_S3_ENDPOINT}" \
  --region "${BACKUP_S3_REGION}"

echo "[backup] upload complete"
rm -f "${DUMP_FILE}"

# Prune backups older than KEEP_DAYS
echo "[backup] pruning backups older than ${KEEP_DAYS} days"
CUTOFF="$(date -u -d "-${KEEP_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
          date -u -v-"${KEEP_DAYS}"d +%Y-%m-%dT%H:%M:%SZ)"
AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY}" \
AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY}" \
aws s3 ls "s3://${BACKUP_S3_BUCKET}/db-backups/" \
  --endpoint-url "${BACKUP_S3_ENDPOINT}" \
  --region "${BACKUP_S3_REGION}" | \
while read -r _ _ _ key; do
  KEY_DATE="$(echo "${key}" | grep -oP '\d{8}T\d{6}Z' | head -1 || true)"
  if [ -n "${KEY_DATE}" ] && [[ "${KEY_DATE}" < "$(date -u -d "-${KEEP_DAYS} days" +%Y%m%dT%H%M%SZ 2>/dev/null || date -u -v-"${KEEP_DAYS}"d +%Y%m%dT%H%M%SZ)" ]]; then
    echo "[backup] pruning: ${key}"
    AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY}" \
    AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY}" \
    aws s3 rm "s3://${BACKUP_S3_BUCKET}/db-backups/${key}" \
      --endpoint-url "${BACKUP_S3_ENDPOINT}" \
      --region "${BACKUP_S3_REGION}"
  fi
done

echo "[backup] $(date -u +%FT%TZ) done. backup=${S3_KEY} size=${DUMP_SIZE}"
