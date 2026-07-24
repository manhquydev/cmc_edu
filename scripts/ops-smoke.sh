#!/usr/bin/env bash
# ops-smoke.sh — post-deploy operational smoke test. Prints PASS/FAIL/SKIP for
# each of 6 marks; exit 0 only when every mark is PASS or an intentionally
# flagged SKIP.
#
# Run on the HOST after a deploy (SSH'd in, `.env.prod` sourced/exported into
# this shell so DATABASE_URL/APP_DATABASE_URL/BREVO_API_KEY are present —
# same expectation as scripts/backup-db.sh). Also requires the Brevo outbound
# IP already added to Brevo's authorised-IPs (docs/runbook-uat-golive.md §8d)
# for mark 4 to have any chance of passing.
#
# Usage:
#   scripts/ops-smoke.sh            # prod mode: reads docker healthcheck/logs
#   scripts/ops-smoke.sh --local    # local dev stack: mark 4 SKIPs, mark 5
#                                    # confirms enqueue+drain via ConsoleTransport
#                                    # (does not send a real email either way)
#
# `--local` requires OPS_SMOKE_API_CONTAINER / OPS_SMOKE_WORKER_CONTAINER /
# OPS_SMOKE_PG_CONTAINER to be set explicitly (see usage()) — this repo has no
# separate local/dev docker-compose file, only `docker-compose.prod.yml`,
# which hardcodes `NODE_ENV: production` for both `api` and `worker`
# unconditionally. The default container names below are shaped for THAT
# file's auto-generated names on purpose, so `--local` refuses to silently
# fall back to them (an operator who ran `docker compose -f
# docker-compose.prod.yml up` and then `--local` would otherwise point this
# script at a container that is actually running in production mode).
#
# Belt-and-suspenders on top of that: mark 5 independently reads the worker
# container's ACTUAL `NODE_ENV` via `docker inspect` right before enqueuing,
# and refuses (FAIL, not skip) if it is `production` — regardless of how the
# operator brought the stack up. `buildTransportMap()`
# (apps/api/src/worker/index.ts) selects the real `BrevoEmailTransport` for
# `NODE_ENV=production`, which would otherwise attempt a genuine outbound
# Brevo call — this guard is what actually keeps that from happening, not the
# `--local` flag by itself.
#
# What this script does NOT do (by design, red-team C4/H3):
#   - It never requests Graph `Mail.Read` and never reads any real mailbox.
#     "Email actually arrived" is a separate HUMAN step (photo of the inbox,
#     see docs/runbook-uat-golive.md §9) — deliberately out of scope here.
#   - It never inserts into EmailOutbox via raw psql. Mark 5 enqueues through
#     `scripts/ops-smoke-enqueue.ts`, which writes via Prisma as the `cmc_app`
#     role — the same path a real request uses.
#   - Mark 5's sink address is a hardcoded allowlist constant in THIS file
#     (see OPS_SMOKE_SINK_ALLOWLIST below), never derived from
#     STAFF_EMAIL_DOMAIN (that var legitimately can be empty in prod and
#     guards an unrelated SSO-login check, not an email sink).
#
# Deliberately does NOT use `set -e`: unlike scripts/env-check.sh or
# backup-db.sh (each step there is fatal), this script's whole purpose is to
# run all 6 marks even when an earlier one fails, and report every result
# before exiting. Every command whose failure is expected/checked is guarded
# explicitly instead.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage: scripts/ops-smoke.sh [--local]

  --local   Check a local/throwaway stack instead of the prod deploy. Mark 4
            (Brevo GET /v3/account) SKIPs. Mark 5 (email relay) still runs,
            against whatever transport the checked worker container is
            actually running — refuses (FAIL) if that container's real
            NODE_ENV reads "production" (see header comment for why).

            REQUIRES OPS_SMOKE_API_CONTAINER, OPS_SMOKE_WORKER_CONTAINER, and
            OPS_SMOKE_PG_CONTAINER to be set explicitly — there is no local
            dev docker-compose file in this repo, only docker-compose.prod.yml
            (hardcodes NODE_ENV=production), so --local will NOT fall back to
            this script's prod-shaped default container names. Point these at
            your own throwaway containers, e.g. built from
            infra/docker/Dockerfile.api|worker and run via
            `docker run -e NODE_ENV=development ...` (NOT
            `docker compose -f docker-compose.prod.yml up`).

Env overrides:
  OPS_SMOKE_API_CONTAINER      prod default: cmcv2-prod-api-1
                                REQUIRED (no default) with --local
  OPS_SMOKE_WORKER_CONTAINER   prod default: cmcv2-prod-worker-1
                                REQUIRED (no default) with --local
  OPS_SMOKE_PG_CONTAINER       prod default: cmcv2-prod-postgres-1
                                REQUIRED (no default) with --local
  OPS_SMOKE_DB_NAME            default: cmc_prod
  OPS_SMOKE_SSO_LOGIN_URL      default: http://localhost:3000/auth/login
  OPS_SMOKE_SINK_EMAIL         default: first entry of the hardcoded allowlist
                                below — must already be IN that allowlist or
                                mark 5 refuses to run (fail-closed).
  OPS_SMOKE_POLL_TIMEOUT_S     default: 60 (mark 5 outbox-status poll budget)

Also required in this shell (not read from a file by this script):
  DATABASE_URL / APP_DATABASE_URL — for scripts/ops-smoke-enqueue.ts (mark 5)
  BREVO_API_KEY                  — for mark 4 (skipped entirely with --local)
EOF
}

LOCAL=0
for arg in "$@"; do
  case "$arg" in
    --local) LOCAL=1 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "unknown argument: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

# --local must not silently fall back to the prod-shaped default container
# names below (High finding, code review 260723): this repo has no separate
# local/dev docker-compose file, so those defaults only make sense pointed at
# a real docker-compose.prod.yml deploy. Require the operator to name their
# own throwaway containers explicitly instead of guessing right.
if [ "$LOCAL" -eq 1 ]; then
  if [ -z "${OPS_SMOKE_API_CONTAINER:-}" ] || [ -z "${OPS_SMOKE_WORKER_CONTAINER:-}" ] || [ -z "${OPS_SMOKE_PG_CONTAINER:-}" ]; then
    {
      echo "ERROR: --local requires OPS_SMOKE_API_CONTAINER, OPS_SMOKE_WORKER_CONTAINER,"
      echo "and OPS_SMOKE_PG_CONTAINER to be set explicitly (none default with --local)."
      echo "There is no local dev docker-compose file in this repo — only"
      echo "docker-compose.prod.yml, which hardcodes NODE_ENV=production for api/worker."
      echo "Point these at your own throwaway containers; run --help for details."
    } >&2
    exit 2
  fi
fi

API_CONTAINER="${OPS_SMOKE_API_CONTAINER:-cmcv2-prod-api-1}"
WORKER_CONTAINER="${OPS_SMOKE_WORKER_CONTAINER:-cmcv2-prod-worker-1}"
PG_CONTAINER="${OPS_SMOKE_PG_CONTAINER:-cmcv2-prod-postgres-1}"
DB_NAME="${OPS_SMOKE_DB_NAME:-cmc_prod}"
SSO_LOGIN_URL="${OPS_SMOKE_SSO_LOGIN_URL:-http://localhost:3000/auth/login}"
POLL_TIMEOUT_S="${OPS_SMOKE_POLL_TIMEOUT_S:-60}"

# ── Mark 5 sink: hardcoded fail-closed allowlist (red-team H3) ──────────────
# Deliberately a literal array in this file, not derived from any env var —
# adding a new sink address requires an actual code change/review, which is
# the point. Replace this placeholder with a mailbox your ops team controls
# before relying on this for a real prod run (needed to take the §9 human
# "photo of the inbox" evidence step — this script never reads that mailbox).
readonly OPS_SMOKE_SINK_ALLOWLIST=(
  "ops-smoke@cmcedu.vn"
)
SINK_EMAIL="${OPS_SMOKE_SINK_EMAIL:-${OPS_SMOKE_SINK_ALLOWLIST[0]}}"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

pass() { echo "  [$1] PASS — $2"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  [$1] FAIL — $2"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
skip() { echo "  [$1] SKIP — $2"; SKIP_COUNT=$((SKIP_COUNT + 1)); }

sink_allowlisted() {
  local candidate="$1" allowed
  for allowed in "${OPS_SMOKE_SINK_ALLOWLIST[@]}"; do
    if [ "$candidate" = "$allowed" ]; then
      return 0
    fi
  done
  return 1
}

# ── Mark 1: api + worker health ──────────────────────────────────────────────
# Reads the docker healthcheck status Docker itself already maintains
# (`docker-compose.prod.yml` defines `wget http://localhost:3000/health` /
# `.../3001/` HEALTHCHECKs) — never a log marker (M3: a boot-time marker only
# prints once and prod's real transports don't print one at all).
check_health() {
  local api_health worker_health
  api_health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$API_CONTAINER" 2>/dev/null)"
  if [ -z "$api_health" ]; then api_health="not-found"; fi
  worker_health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$WORKER_CONTAINER" 2>/dev/null)"
  if [ -z "$worker_health" ]; then worker_health="not-found"; fi

  if [ "$api_health" = "healthy" ] && [ "$worker_health" = "healthy" ]; then
    pass "mark1" "api=$api_health worker=$worker_health"
  else
    fail "mark1" "api=$api_health worker=$worker_health (expected healthy/healthy)"
  fi
}

# ── Mark 2: no FATAL since the CURRENT boot window ──────────────────────────
# Anchors to `docker inspect .State.StartedAt`, then `docker logs --since`
# that timestamp — never the whole log history (a `restart: unless-stopped`
# container's log stream survives restarts, so an unscoped grep would catch a
# stale FATAL from a previous crash and never clear, the exact "restore-drill
# sort|tail" trap this mark exists to avoid).
check_no_fatal_for() {
  local container="$1" started fatal_count logs_file
  started="$(docker inspect -f '{{.State.StartedAt}}' "$container" 2>/dev/null)"
  if [ -z "$started" ]; then
    fail "mark2" "$container: cannot read StartedAt (container not found?)"
    return 1
  fi

  # High finding (code review 260723): capture `docker logs` to a file and
  # check ITS OWN exit status first — piping straight into `grep -c` merges
  # a `docker logs` failure (container removed mid-check, permission issue,
  # log-driver problem) into the same stream grep scans, so a failure would
  # silently read back as "0 FATAL" (PASS) instead of failing the mark.
  logs_file="$(mktemp)"
  if ! docker logs --since "$started" "$container" >"$logs_file" 2>&1; then
    fail "mark2" "$container: docker logs failed — cannot confirm no FATAL"
    rm -f "$logs_file"
    return 1
  fi
  fatal_count="$(grep -ic 'FATAL' "$logs_file")"
  rm -f "$logs_file"
  if [ -z "$fatal_count" ]; then fatal_count=0; fi
  if [ "$fatal_count" -gt 0 ]; then
    fail "mark2" "$container: $fatal_count FATAL line(s) since boot ($started)"
    return 1
  fi
  echo "  [mark2]   $container: 0 FATAL since boot ($started)"
  return 0
}

check_no_fatal() {
  local api_ok=1 worker_ok=1
  check_no_fatal_for "$API_CONTAINER" || api_ok=0
  check_no_fatal_for "$WORKER_CONTAINER" || worker_ok=0
  if [ "$api_ok" -eq 1 ] && [ "$worker_ok" -eq 1 ]; then
    pass "mark2" "no FATAL in api/worker logs since their current boot"
  fi
}

# ── Mark 3: staff SSO login redirects to Entra, without logging in ──────────
check_sso() {
  local location
  location="$(curl -s -o /dev/null -D - "$SSO_LOGIN_URL" 2>/dev/null | grep -i '^location:' | tr -d '\r' | awk '{print $2}')"
  case "$location" in
    *login.microsoftonline.com*)
      pass "mark3" "GET /auth/login redirects to login.microsoftonline.com"
      ;;
    *)
      fail "mark3" "no Entra redirect from $SSO_LOGIN_URL (got Location: ${location:-<none>})"
      ;;
  esac
}

# ── Mark 4: Brevo GET /v3/account from this host, branching the 401 cause ───
check_brevo() {
  if [ "$LOCAL" -eq 1 ]; then
    skip "mark4" "--local: Brevo reachability not checked (see usage)"
    return
  fi
  if [ -z "${BREVO_API_KEY:-}" ]; then
    fail "mark4" "BREVO_API_KEY is not set in this shell"
    return
  fi
  local resp status body
  resp="$(curl -s -w '\n%{http_code}' -H "api-key: ${BREVO_API_KEY}" https://api.brevo.com/v3/account)"
  status="${resp##*$'\n'}"
  body="${resp%$'\n'*}"
  case "$status" in
    200)
      pass "mark4" "GET /v3/account = 200 (key valid, host IP allowlisted)"
      ;;
    401)
      if echo "$body" | grep -qi "unrecognized ip\|unrecognised ip"; then
        fail "mark4" "401 unrecognised IP address — allowlist issue, not the key (see runbook §8d)"
      elif echo "$body" | grep -qi "key not found"; then
        fail "mark4" "401 Key not found — key or malformed-line issue (see runbook §8d)"
      else
        fail "mark4" "401 (cause not recognised from response body)"
      fi
      ;;
    *)
      fail "mark4" "unexpected HTTP status $status"
      ;;
  esac
}

# Critical (code review 260723): docker-compose.prod.yml hardcodes
# `NODE_ENV: production` for both `api` and `worker` UNCONDITIONALLY, and
# this repo has no separate local compose file — so an operator who brings a
# stack up via that compose file and then runs `--local` would otherwise get
# a worker actually running in production mode. `buildTransportMap()`
# (apps/api/src/worker/index.ts) picks the real `BrevoEmailTransport` for
# `NODE_ENV=production`, not Console — a genuine outbound Brevo call. This
# reads the worker container's ACTUAL env at runtime (not assumed from the
# `--local` flag) and refuses mark 5 outright if it is production, regardless
# of how the operator brought the stack up.
worker_node_env_is_production() {
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$WORKER_CONTAINER" 2>/dev/null \
    | grep -q '^NODE_ENV=production$'
}

# ── Mark 5: email through the worker, proven by outbox status only ──────────
# Never reads any mailbox (C4). Enqueues via scripts/ops-smoke-enqueue.ts
# (Prisma, not raw psql — H3), then polls EmailOutbox.status via the
# `postgres` role until `sent`/`dead`/timeout. EmailOutbox is never
# RLS-enabled (unlike the mark-6 tables) — using `postgres` here is just
# reusing the same docker-exec-psql tooling as mark 6, not an RLS necessity.
# "Arrived in the inbox" is the separate human step at runbook §9.
check_email_relay() {
  if [ "$LOCAL" -eq 1 ] && worker_node_env_is_production; then
    fail "mark5" "--local but worker container '$WORKER_CONTAINER' has NODE_ENV=production — refusing (would use real BrevoEmailTransport, not Console; see header comment)"
    return
  fi

  if ! sink_allowlisted "$SINK_EMAIL"; then
    fail "mark5" "sink '$SINK_EMAIL' is not in the hardcoded OPS_SMOKE_SINK_ALLOWLIST — refusing (fail-closed)"
    return
  fi

  local row_id enqueue_err enqueue_rc
  # Separate stdout (exactly one line: the row id) from stderr (pnpm/tsx
  # banners, or this helper's own FATAL diagnostics) — merging them would
  # corrupt row_id with unrelated banner text.
  enqueue_err="$(mktemp)"
  row_id="$(cd "$SCRIPT_DIR/.." && pnpm exec tsx "$SCRIPT_DIR/ops-smoke-enqueue.ts" "$SINK_EMAIL" 2>"$enqueue_err")"
  enqueue_rc=$?
  row_id="$(echo "$row_id" | tail -n1 | tr -d '[:space:]')"
  if [ "$enqueue_rc" -ne 0 ] || [ -z "$row_id" ]; then
    fail "mark5" "enqueue failed: $(tr '\n' ' ' < "$enqueue_err")"
    rm -f "$enqueue_err"
    return
  fi
  rm -f "$enqueue_err"

  # Defense in depth (Medium finding, code review 260723): row_id is spliced
  # into a raw SQL string below run as the `postgres` superuser — refuse
  # anything that isn't shaped like the UUID ops-smoke-enqueue.ts actually
  # prints, rather than trusting stdout unconditionally.
  if ! [[ "$row_id" =~ ^[0-9a-fA-F-]{36}$ ]]; then
    fail "mark5" "enqueue returned an unexpected id shape (not a UUID): '$row_id'"
    return
  fi

  local waited=0 status=""
  while [ "$waited" -lt "$POLL_TIMEOUT_S" ]; do
    status="$(docker exec "$PG_CONTAINER" psql -U postgres -d "$DB_NAME" -tAc \
      "SELECT status FROM \"EmailOutbox\" WHERE id='${row_id}'" 2>/dev/null | tr -d '[:space:]')"
    if [ "$status" = "sent" ] || [ "$status" = "dead" ]; then
      break
    fi
    sleep 2
    waited=$((waited + 2))
  done

  if [ "$status" = "sent" ]; then
    pass "mark5" "outbox row $row_id -> sent (waited ${waited}s, sink=$SINK_EMAIL)"
  else
    fail "mark5" "outbox row $row_id status=${status:-unknown} after ${waited}s (expected sent)"
  fi
}

# ── Mark 6: row counts via the `postgres` role (RLS-bypassing by design) ────
# cmc_app cannot be used here: 5/7 of these tables run RLS `facility_isolation`
# + FORCE, so a cmc_app connection without a facility GUC set would silently
# read back 0 rows with no error (docs/runbook-uat-golive.md §6) — not a bug
# to "fix", the documented, accepted way to get a real total.
check_row_counts() {
  local sql out
  sql="SELECT 'Facility' t, count(*) FROM \"Facility\"
       UNION ALL SELECT 'Student', count(*) FROM \"Student\"
       UNION ALL SELECT 'ParentAccount', count(*) FROM \"ParentAccount\"
       UNION ALL SELECT 'Receipt', count(*) FROM \"Receipt\"
       UNION ALL SELECT 'AppUser', count(*) FROM \"AppUser\"
       UNION ALL SELECT 'Enrollment', count(*) FROM \"Enrollment\"
       UNION ALL SELECT 'ClassBatch', count(*) FROM \"ClassBatch\" ORDER BY 1;"
  if out="$(docker exec "$PG_CONTAINER" psql -U postgres -d "$DB_NAME" -c "$sql" 2>&1)"; then
    local line
    while IFS= read -r line; do
      echo "  [mark6]   $line"
    done <<< "$out"
    pass "mark6" "row counts read via postgres role (docker exec $PG_CONTAINER)"
  else
    fail "mark6" "psql query failed: $out"
  fi
}

main() {
  echo "ops-smoke.sh — $(date -u +%FT%TZ)$([ "$LOCAL" -eq 1 ] && echo ' [--local]')"
  echo

  echo "[1/6] api + worker health"
  check_health
  echo

  echo "[2/6] no FATAL since current boot"
  check_no_fatal
  echo

  echo "[3/6] staff SSO login redirect"
  check_sso
  echo

  echo "[4/6] Brevo GET /v3/account"
  check_brevo
  echo

  echo "[5/6] email enqueue -> outbox sent"
  check_email_relay
  echo

  echo "[6/6] row counts (role postgres)"
  check_row_counts
  echo

  echo "Summary: ${PASS_COUNT} PASS, ${FAIL_COUNT} FAIL, ${SKIP_COUNT} SKIP"
  if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
  fi
  exit 0
}

main
