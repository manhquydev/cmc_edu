#!/bin/sh
# Drop root after ensuring local blob storage is writable by the node user.
# Used by api + worker production images.
#
# Fail-closed: if we cannot make blob_dir writable for node, abort boot
# (do not su-exec into a process that will later EACCES on upload).
# Non-recursive chown: only the directory itself; node owns new children.
#
# When BLOB_STORAGE_DIR is unset (S3 mode), skip local chown unless /data
# exists (local-sim volume mount).
set -eu

if [ "$(id -u)" = "0" ]; then
  blob_dir="${BLOB_STORAGE_DIR:-}"
  if [ -n "$blob_dir" ]; then
    mkdir -p "$blob_dir"
    chown node:node "$blob_dir"
    # Prove writability as node before starting the app (health alone is not enough).
    su-exec node test -w "$blob_dir"
  elif [ -d /data ]; then
    chown node:node /data
    su-exec node test -w /data
  fi
  exec su-exec node "$@"
fi

exec "$@"
