#!/usr/bin/env bash
# Harness Symphony custom agent adapter -> Claude Code (headless).
#
# Symphony invokes this script as a one-shot process from inside the isolated
# run worktree (cwd = worktree root) with these env vars set:
#   HARNESS_DB_PATH  - path to the run's copied harness.db
#   HARNESS_RUN_ID   - the run id
#   HARNESS_RUN_MODE - "execute"
# The script must exit 0 on success and leave the required run artifacts on disk.
#
# Prereq: the `claude` CLI must be on PATH. Tune the prompt / flags as needed.
set -euo pipefail

RUN_ID="${HARNESS_RUN_ID:?HARNESS_RUN_ID not set (Symphony provides it)}"
CONTRACT=".harness/runs/${RUN_ID}/RUN_CONTRACT.json"

read -r -d '' PROMPT <<EOF || true
You are running inside a Harness Symphony worktree; the current working directory is the worktree root.
Read AGENTS.md and the run contract at ${CONTRACT} before doing anything.
Complete ONLY the story assigned in that contract for run ${RUN_ID}. Do not change unrelated product code.
Write the required artifacts under the current working directory:
  .harness/runs/${RUN_ID}/SUMMARY.md
  .harness/runs/${RUN_ID}/RESULT.json
Use the Harness CLI for durable writes (scripts/bin/harness-cli.exe on Windows, or the repo-root binary if the
worktree copy is absent) so that HARNESS_DB_PATH, HARNESS_RUN_ID, and HARNESS_RUN_MODE from the environment
produce .harness/changesets/${RUN_ID}.changeset.jsonl in this worktree.
RESULT.json must have: version 1, run_id ${RUN_ID}, the assigned story_id, an allowed outcome,
summary_path ".harness/runs/${RUN_ID}/SUMMARY.md", and a top-level validation object that is either
{"commands":[{"command":"<exact command>","result":"pass|fail|unavailable"}]} or {"unavailable":"<reason>"}.
Do not write a validation_evidence field.
EOF

# Headless, non-interactive Claude Code run. --dangerously-skip-permissions is
# required because Symphony runs this unattended; the worktree is already isolated.
exec claude -p "$PROMPT" --dangerously-skip-permissions
