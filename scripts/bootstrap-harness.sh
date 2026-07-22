#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
db=${HARNESS_DB_PATH:-$root/harness.db}
cli=${HARNESS_CLI:-$root/scripts/bin/harness-cli}
source_checkout=0
if [[ -f "$root/Cargo.toml" && -f "$root/crates/harness-cli/Cargo.toml" ]]; then
  source_checkout=1
fi

release_tag_file="$root/scripts/harness-cli-release-tag"
[[ -f "$release_tag_file" ]] || {
  printf 'Harness bootstrap failed: pinned release file is missing: %s\n' "$release_tag_file" >&2
  exit 1
}
release_tag=$(awk 'NF && $1 !~ /^#/ { print $1; exit }' "$release_tag_file")
[[ "$release_tag" == harness-cli-v* ]] || {
  printf 'Harness bootstrap failed: invalid pinned release tag: %s\n' "$release_tag" >&2
  exit 1
}

fail() {
  printf 'Harness bootstrap failed: %s\n' "$*" >&2
  exit 1
}

install_pinned_cli() {
  command -v curl >/dev/null 2>&1 || fail "curl is required to install the pinned Harness CLI"

  local os arch platform asset base_url tmp_cli tmp_checksum expected actual
  os=$(uname -s)
  arch=$(uname -m)
  case "$os/$arch" in
    Linux/x86_64|Linux/amd64) platform=linux-x64 ;;
    Linux/aarch64|Linux/arm64) platform=linux-arm64 ;;
    Darwin/x86_64|Darwin/amd64) platform=macos-x64 ;;
    Darwin/arm64|Darwin/aarch64) platform=macos-arm64 ;;
    *) fail "no pinned Harness CLI artifact for $os/$arch" ;;
  esac

  asset="harness-cli-$platform"
  base_url=${HARNESS_CLI_BASE_URL:-"https://github.com/hoangnb24/repository-harness/releases/download/$release_tag"}
  base_url=${base_url%/}
  tmp_cli=$(mktemp)
  tmp_checksum=$(mktemp)
  trap 'rm -f "$tmp_cli" "$tmp_checksum"' RETURN

  curl -fsSL "$base_url/$asset" -o "$tmp_cli" || fail "unable to download $asset from $base_url"
  curl -fsSL "$base_url/$asset.sha256" -o "$tmp_checksum" || fail "unable to download checksum for $asset"
  expected=$(awk '{ print tolower($1); exit }' "$tmp_checksum")
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || fail "release checksum is malformed for $asset"
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$tmp_cli" | awk '{ print tolower($1) }')
  elif command -v shasum >/dev/null 2>&1; then
    actual=$(shasum -a 256 "$tmp_cli" | awk '{ print tolower($1) }')
  else
    fail "sha256sum or shasum is required to verify the pinned Harness CLI"
  fi
  [[ "$actual" == "$expected" ]] || fail "checksum mismatch for $asset"

  mkdir -p "$(dirname "$cli")"
  install -m 755 "$tmp_cli" "$cli"
  printf 'Installed pinned Harness CLI: tag=%s asset=%s\n' "$release_tag" "$asset"
}

contract_state() {
  local contract
  contract=$(HARNESS_REPO_ROOT="$root" HARNESS_DB_PATH="$db" "$cli" query contract --json)
  case "$contract" in
    *'"database_state":"missing"'*) printf 'missing\n' ;;
    *'"database_state":"current"'*) printf 'current\n' ;;
    *'"database_state":"needs_migration"'*) printf 'needs_migration\n' ;;
    *'"database_state":"unsupported"'*) printf 'unsupported\n' ;;
    *) fail "query contract returned an unknown database state" ;;
  esac
}

if [[ $source_checkout == 1 && "$db" == "$root/harness.db" && ! -e "$db" ]]; then
  fail "authoritative core state is unavailable; restore the verified core epoch instead of initializing an empty replacement"
fi

if [[ $source_checkout == 1 ]]; then
  HARNESS_COHERENCE_SKIP_RUNTIME=1 "$root/scripts/verify-revision-coherence.sh" >/dev/null
  command -v cargo >/dev/null 2>&1 || fail "cargo is required in a Harness CLI source checkout"
  cargo build --quiet --manifest-path "$root/Cargo.toml" -p harness-cli --locked
  built_cli="$root/target/debug/harness-cli"
  if [[ ! -e "$cli" || ! "$built_cli" -ef "$cli" ]]; then
    mkdir -p "$(dirname "$cli")"
    install -m 755 "$built_cli" "$cli"
  fi
elif [[ ! -x "$cli" ]]; then
  install_pinned_cli
fi

expected_version=${release_tag#harness-cli-v}
actual_version=$("$cli" --version | awk '{ print $NF }')
[[ "$release_tag" == harness-cli-v* && "$actual_version" == "$expected_version" ]] ||
  fail "CLI version $actual_version does not match pinned release $release_tag"

initialized_database=0
case "$(contract_state)" in
  missing)
    HARNESS_REPO_ROOT="$root" HARNESS_DB_PATH="$db" "$cli" init >/dev/null
    initialized_database=1
    ;;
  needs_migration)
    HARNESS_REPO_ROOT="$root" HARNESS_DB_PATH="$db" "$cli" migrate >/dev/null
    ;;
  current)
    ;;
  unsupported)
    fail "database schema is outside the CLI's supported range"
    ;;
esac

if [[ $initialized_database == 1 ]]; then
  baseline="$root/.harness/changesets/cmc-story-baseline-v1.changeset.jsonl"
  [[ -f "$baseline" ]] || fail "portable story baseline is missing: $baseline"
  HARNESS_REPO_ROOT="$root" HARNESS_DB_PATH="$db" "$cli" db changeset apply "$baseline" --json >/dev/null ||
    fail "portable story baseline apply failed"
  HARNESS_REPO_ROOT="$root" HARNESS_DB_PATH="$db" "$cli" import brownfield >/dev/null ||
    fail "brownfield metadata import failed"
fi

[[ "$(contract_state)" == current ]] || fail "database did not reach current schema"
if [[ $source_checkout == 1 && "$db" == "$root/harness.db" ]]; then
  HARNESS_CLI="$cli" HARNESS_SOURCE_DB="$db" "$root/scripts/verify-core-state-ownership.sh" >/dev/null
fi
printf 'Harness ready: cli=%s database=%s\n' "$cli" "$db"
