# Test Matrix (Live Source)

The authoritative test matrix lives in **harness-cli**, not this file.

## How to Access

Run this command from the repo root:

```bash
scripts/bin/harness-cli.exe query matrix
```

This returns the live matrix with **26 story rows**, each showing:
- Unit/integration/e2e/platform proof flags (0 or 1)
- Evidence citations (concrete test files and pass counts)
- Updated on every test run

## Why Not This File

Early in the project, this file was intended as a manual tracker. It is now superseded by:

1. **Harness CLI** — automated, real-time, tied to actual test results
2. **docs/29-test-plan.md** — policy and strategy (coverage targets, test pyramid, spec catalog)
3. **CONTEXT_RULES.md & HARNESS_COMPONENTS.md** — pointer to the CLI (this is the source of truth)

Maintaining a separate .md copy creates inconsistency (has happened multiple times). The CLI is single-source-of-truth; this file is deprecated.

## For High-Risk Stories

When starting work on a high-risk feature:

```bash
scripts/bin/harness-cli.exe query matrix --numeric
```

Review the `evidence` column for story-specific test coverage details.
