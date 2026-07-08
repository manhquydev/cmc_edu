#!/usr/bin/env bash
# env-check.sh — fail-closed assertion that required env vars are present.
# Prints only VARIABLE NAMES that are missing, never their values.
# Run at container entrypoint / CI pre-boot before the API starts.
#
# Usage: scripts/env-check.sh
# Exit:  0 = all required present; 1 = one or more missing.
set -euo pipefail

NODE_ENV="${NODE_ENV:-development}"

# Always required (every environment).
REQUIRED=(
  DATABASE_URL
  APP_DATABASE_URL
  LMS_SESSION_SECRET
)

# Required only in production (dev/test tolerate stubs/defaults).
if [ "$NODE_ENV" = "production" ]; then
  REQUIRED+=(
    BREVO_API_KEY
    TRUSTED_PROXY_CIDRS
    CORS_ORIGINS
  )
  # Object storage: either S3 (all five) or the local-disk fallback.
  if [ -z "${S3_ENDPOINT:-}" ]; then
    REQUIRED+=(BLOB_STORAGE_DIR)
  else
    REQUIRED+=(S3_ENDPOINT S3_BUCKET S3_REGION S3_ACCESS_KEY S3_SECRET_KEY)
  fi
  # Staff session cookie secret (always required in prod — guards cookie forgery).
  REQUIRED+=(STAFF_SESSION_SECRET)
  # Backup dump encryption (AES-256 via openssl; passphrase must be escrowed in password manager).
  REQUIRED+=(BACKUP_ENCRYPTION_PASSPHRASE)
  # Staff SSO only enforced once enabled (Entra shares its app with Graph email).
  if [ "${SSO_ENABLED:-false}" = "true" ]; then
    REQUIRED+=(ENTRA_TENANT_ID ENTRA_CLIENT_ID ENTRA_CLIENT_SECRET ERP_SSO_REDIRECT_URI)
    REQUIRED+=(ADMIN_APP_ORIGIN)
    REQUIRED+=(GRAPH_TENANT_ID GRAPH_CLIENT_ID GRAPH_CLIENT_SECRET GRAPH_SENDER_EMAIL)
  fi
fi

# TEST_OTP_SEAM must never be truthy in production.
if [ "$NODE_ENV" = "production" ] && [ -n "${TEST_OTP_SEAM:-}" ]; then
  echo "FATAL: TEST_OTP_SEAM must not be set in production." >&2
  exit 1
fi

# BACKUP_BUCKET_PRIVATE_CONFIRMED must equal "true" in production (explicit acknowledgment).
if [ "$NODE_ENV" = "production" ] && [ "${BACKUP_BUCKET_PRIVATE_CONFIRMED:-}" != "true" ]; then
  echo "FATAL: BACKUP_BUCKET_PRIVATE_CONFIRMED must be set to 'true' in production." >&2
  echo "  1. Open Cloudflare Dashboard → R2 → bucket → Settings → Public Access = Disabled." >&2
  echo "  2. Set BACKUP_BUCKET_PRIVATE_CONFIRMED=true in .env.prod." >&2
  exit 1
fi

missing=()
for var in "${REQUIRED[@]}"; do
  if [ -z "${!var:-}" ]; then
    missing+=("$var")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "FATAL: missing required env var(s) for NODE_ENV=$NODE_ENV:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  echo "Set them (see .env.example) and retry. Values are never printed by this check." >&2
  exit 1
fi

echo "env-check OK (NODE_ENV=$NODE_ENV, ${#REQUIRED[@]} required vars present)."
