#!/usr/bin/env bash
# backup-db.sh — pg_dump → AES-256 encrypt → external S3 (off-box, RT-13).
# Run as a cron job on the VPS HOST (not inside the compose stack).
# Requires: pg_dump, aws CLI v2, openssl, .env.prod sourced or vars exported.
#
# Cron example (daily at 02:00 UTC):
#   0 2 * * * /opt/cmcv2/scripts/backup-db.sh >> /var/log/cmcv2-backup.log 2>&1

set -euo pipefail

# aws-cli v2 + Cloudflare R2: disable default checksum to avoid CRC32 mismatch
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT must be set (RT-13: off-box target)}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET must be set}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY must be set}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY must be set}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE must be set (escrow passphrase in password manager)}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-auto}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

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
ENC_FILE="${DUMP_FILE}.enc"
S3_KEY="db-backups/cmc-prod-${TIMESTAMP}.dump.enc"

# Remove both plaintext and encrypted temp files on any exit (including errors).
trap 'rm -f "${DUMP_FILE}" "${ENC_FILE}"' EXIT

echo "[backup] $(date -u +%FT%TZ) starting pg_dump → ${DUMP_FILE}"
# Strip any libpq-incompatible query params (Prisma appends ?schema=public, which
# pg_dump rejects with "invalid URI query parameter").
PGDUMP_URL="${DATABASE_URL%%\?*}"
# Keep ACLs (GRANTs) in the dump: cmc_app's table privileges live in GRANT
# statements from migrations. A --no-acl dump restores tables+data but no grants,
# leaving the app role unable to touch any table after a real recovery. --no-owner
# is still safe (objects owned by whoever runs the restore).
pg_dump --format=custom --no-owner "${PGDUMP_URL}" > "${DUMP_FILE}"
DUMP_SIZE="$(du -sh "${DUMP_FILE}" | cut -f1)"
echo "[backup] dump complete: ${DUMP_SIZE}"

echo "[backup] encrypting → ${ENC_FILE}"
openssl enc -aes-256-cbc -pbkdf2 -in "${DUMP_FILE}" -out "${ENC_FILE}" \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE
rm -f "${DUMP_FILE}"  # remove plaintext before upload
ENC_SIZE="$(du -sh "${ENC_FILE}" | cut -f1)"
echo "[backup] encrypted: ${ENC_SIZE}"

echo "[backup] uploading to s3://${BACKUP_S3_BUCKET}/${S3_KEY} via ${BACKUP_S3_ENDPOINT}"
AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY}" \
AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY}" \
aws s3 cp "${ENC_FILE}" \
  "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" \
  --endpoint-url "${BACKUP_S3_ENDPOINT}" \
  --region "${BACKUP_S3_REGION}"

echo "[backup] upload complete"

# Prune backups older than KEEP_DAYS
echo "[backup] pruning backups older than ${KEEP_DAYS} days"
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

echo "[backup] $(date -u +%FT%TZ) done. backup=${S3_KEY} size=${ENC_SIZE}"
