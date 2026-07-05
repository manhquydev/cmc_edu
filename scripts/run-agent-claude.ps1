# Harness Symphony custom agent adapter -> Claude Code (headless), Windows/PowerShell.
#
# Symphony invokes this as a one-shot process from inside the run worktree
# (cwd = worktree root) with these env vars set:
#   HARNESS_DB_PATH  - path to the run's copied harness.db
#   HARNESS_RUN_ID   - the run id
#   HARNESS_RUN_MODE - "execute"
# Must exit 0 on success and leave the required run artifacts on disk.
#
# NOTE: this project uses a PowerShell (not bash) adapter because Symphony's
# `bash` resolves to WSL on this machine, which does NOT inherit Windows env
# vars (HARNESS_*), uses /mnt/d paths, and lacks the `claude` CLI on PATH.
$ErrorActionPreference = "Stop"

$runId = $env:HARNESS_RUN_ID
if (-not $runId) { Write-Error "HARNESS_RUN_ID not set (Symphony provides it)."; exit 2 }
$contract = ".harness/runs/$runId/RUN_CONTRACT.json"

$prompt = @"
You are running inside a Harness Symphony worktree; the current working directory is the worktree root.
Read AGENTS.md and the run contract at $contract before doing anything.
Complete ONLY the story assigned in that contract for run $runId. Do not change unrelated product code.
Write the required artifacts (UTF-8, no BOM): .harness/runs/$runId/SUMMARY.md and .harness/runs/$runId/RESULT.json.
Use the Harness CLI (.\scripts\bin\harness-cli.exe, or the repo-root binary if the worktree copy is absent) for durable
writes so HARNESS_DB_PATH, HARNESS_RUN_ID and HARNESS_RUN_MODE from the environment produce
.harness/changesets/$runId.changeset.jsonl in this worktree.
RESULT.json must have: version 1, run_id $runId, the assigned story_id, an allowed outcome
(completed|blocked|needs_intake|partial|failed|cancelled), summary_path ".harness/runs/$runId/SUMMARY.md", and a
top-level validation object that is either {"commands":[{"command":"<exact command>","result":"pass|fail|unavailable"}]}
or {"unavailable":"<non-empty reason>"}. Do not write a validation_evidence field.
"@

# Resolve the Claude Code CLI (npm global bin is on the Windows PATH). Override with CLAUDE_BIN if needed.
$claude = if ($env:CLAUDE_BIN) { $env:CLAUDE_BIN } else { "claude" }
if (-not (Get-Command $claude -ErrorAction SilentlyContinue)) {
  Write-Error "'$claude' not found on PATH; set CLAUDE_BIN to the Claude Code binary."; exit 127
}

# Headless, unattended run. --dangerously-skip-permissions is required because
# Symphony runs this without a human; the worktree is already git-isolated.
& $claude -p $prompt --dangerously-skip-permissions
exit $LASTEXITCODE
