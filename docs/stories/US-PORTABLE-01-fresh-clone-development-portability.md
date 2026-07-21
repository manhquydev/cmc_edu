# US-PORTABLE-01 Fresh-Clone Development Portability

## Status

implemented

## Lane

normal

## Product Contract

A clean clone contains every version-controlled artifact needed to install,
build, test, and continue CMC EDU development without copying machine-local
state from another checkout.

## Relevant Product Docs

- `README.md`
- `docs/HARNESS.md`
- `docs/CONTEXT_RULES.md`
- `docs/decisions/0004-sqlite-durable-layer.md`
- `docs/decisions/0005-prebuilt-rust-harness-cli.md`

## Acceptance Criteria

- Harness policy, schemas, plans, stories, and project agent rules are tracked.
- Fresh-clone bootstrap downloads the pinned Harness CLI and verifies SHA-256.
- A semantic baseline restores the durable story/proof matrix into a new local database.
- Machine-local databases, binaries, credentials, caches, and GitNexus indexes remain ignored.
- Development and production environment examples cover user-configurable runtime keys without real values.
- Frozen dependency install, typecheck, tests, build, portability verification, and secret scan provide ship evidence.

## Design Notes

- Keep `harness.db` instance-local per ADR 0004.
- Version story/proof state as a replayable changeset; keep session intakes and traces local.
- Keep the CLI binary machine-local per ADR 0005; bootstrap from the immutable pinned release.
- Preserve Markdown planning history because tracked code and durable story records reference it.
- Rebuild `.gitnexus/` on each clone instead of distributing its local index.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Bootstrap checksum/version checks and environment-contract verifier pass. |
| Integration | Harness initializes against isolated CLI/database paths. |
| E2E | Fresh local clone installs dependencies and passes project build gates. |
| Platform | PowerShell bootstrap passes; Bash syntax/contract is checked. |
| Release | Staged secret scan and `gitnexus detect_changes` match expected scope. |

## Harness Delta

Fresh-clone bootstrap becomes self-contained while durable operational state
remains instance-local. Planning history and project rules become portable.

## Evidence

- Frozen install, typecheck, full tests, lint, production build, and acceptance report passed.
- Isolated PowerShell bootstrap downloaded the pinned CLI, verified its checksum,
  restored 31 story rows, and passed a second idempotent run.
- Bash bootstrap syntax passed; synthetic PostgreSQL migrations and seed passed.
- `pnpm verify:portability` covered 996 tracked files and 55 runtime env keys.
- Staged secret/binary scan found zero sensitive filenames, high-confidence
  token signatures, binary diffs, GitNexus cache files, or local Harness state.
