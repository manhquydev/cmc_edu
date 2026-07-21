# Harness CLI v0.1.17 — Independent Install Verification

- Date: 2026-07-18 08:13 (+07)
- Verifier: independent (recomputed every fact from ground truth; no prior claim trusted)
- Project: D:\project\vip\CMC
- Upstream: https://github.com/hoangnb24/repository-harness @ tag `harness-cli-v0.1.17`
- Reference clone authenticity: `/tmp/rh-check` HEAD `9cc306d2e06f34bac02237d20d14084553aefc64` == `harness-cli-v0.1.17^{commit}` → **AUTHENTIC** (used as upstream source of truth)

## Overall Verdict

| Claim | Verdict |
|-------|---------|
| GENUINE (cài thật) | **PASS** |
| CORRECT (cài đúng) | **PASS** |
| PRECISE (cài chính xác) | **PASS** |

Key hashes:
- Installed binary sha256:  `2d7edff22ae25308c2ba23ab85bb9acb18d87eea28a9ca4efb2014a0f11a51a6`
- Official published sha256: `2d7edff22ae25308c2ba23ab85bb9acb18d87eea28a9ca4efb2014a0f11a51a6`
- Published binary re-hash:  `2d7edff22ae25308c2ba23ab85bb9acb18d87eea28a9ca4efb2014a0f11a51a6`
- 3-way MATCH.

## A. Binary Authenticity (cài thật)

| Check | Expected | Observed | Result | Evidence |
|-------|----------|----------|--------|----------|
| A1 installed binary sha256 | (recompute) | `2d7edff2…51a6` | PASS | `sha256sum scripts/bin/harness-cli.exe` |
| A2 official published sha256 | fetched from GH release | `2d7edff2…51a6` | PASS | `gh release download …exe.sha256` |
| A2b published binary re-hash | == its own checksum | `2d7edff2…51a6` | PASS | downloaded `harness-cli-windows-x64.exe`, sha256sum |
| A3 installed == published | MATCH | MATCH (3-way) | PASS | hashes equal |
| A4 version string | `harness-cli 0.1.17` | `harness-cli 0.1.17` | PASS | `--version` |

## B. File Correctness (cài đúng) — CRLF-normalized byte compare vs upstream

| File | Result |
|------|--------|
| scripts/schema/009-improvement-identity.sql | IDENTICAL |
| scripts/schema/010-story-backlog-links.sql | IDENTICAL |
| scripts/schema/011-legacy-evidence-snapshots.sql | IDENTICAL |
| scripts/schema/012-review-finding-closure.sql | IDENTICAL |
| scripts/schema/013-changeset-content-sha.sql | IDENTICAL |
| scripts/bootstrap-harness.ps1 | IDENTICAL |
| scripts/bootstrap-harness.sh | IDENTICAL |
| scripts/agent-harness-block.md | IDENTICAL |
| scripts/claude-harness-block.md | IDENTICAL |
| scripts/harness-cli-release-tag | IDENTICAL (`harness-cli-v0.1.17`) |
| docs/contracts/harness-orchestration-v1.md | IDENTICAL |

All 11 files PASS.

## C. Schema / DB Precision (cài chính xác)

| Check | Expected | Observed | Result |
|-------|----------|----------|--------|
| C1 migrate | version 13, 0 applied | `Current schema version: 13` / `Already up to date.` | PASS |
| C2 NEW stats | 10/28/15/17/39 | intakes 10, stories 28, decisions 15, backlog 17, traces 39 | PASS |
| C2 OLD stats (backup db, old bin 0.1.11) | 10/28/15/17/39 | intakes 10, stories 28, decisions 15, backlog 17, traces 39 | PASS |
| C2 decision-id parity | NEW ⊇ OLD, 0 lost | `diff` old vs new IDs → IDENTICAL (15 ids, 0 lost) | PASS |
| C3 marker pair | exactly one BEGIN/END | one HTML-comment pair at AGENTS.md L9/L26 (L43 is prose mention `HARNESS:BEGIN…END`, outside pair) | PASS |
| C3 block content | byte-identical to upstream | inclusive block L9–26 (18 lines w/ markers) == upstream agent-harness-block.md | PASS |
| C3 CMC pointers outside markers | present, outside | README.md / docs/system-architecture.md / docs/07-glossary-san-pham.md at L34–40 (after L26 END) | PASS |

OLD backup DB queried independently by copying `.harness-preupgrade-backup-20260718080453/harness.db` + old 0.1.11 binary into a temp dir — durable state preserved intact.

## D. Git Precision

| Check | Expected | Observed | Result |
|-------|----------|----------|--------|
| D1 commit 4047237 scope | exactly 13 harness paths, nothing unrelated | 13 files: .gitignore, AGENTS.md, docs/contracts/harness-orchestration-v1.md, scripts/{agent-harness-block.md, bootstrap-harness.ps1, bootstrap-harness.sh, claude-harness-block.md, harness-cli-release-tag}, scripts/schema/009–013 — no apps/, packages/, seed | PASS |
| D2 binary + db gitignored | ignored, not tracked | `check-ignore` matches both; `ls-files --error-unmatch` errors (not tracked) for both | PASS |
| D3 working tree | no uncommitted harness source | `git status --short` empty for harness source (backups/runtime gitignored) | PASS |

Note: commit 4047237 stat shows AGENTS.md as `42 +/- 17`; this reflects the harness block refresh + relocation of CMC pointers outside markers, consistent with the commit message and the C3 findings. No unrelated files.

## E. Functional Smoke (new binary)

| Command | Exit | Result |
|---------|------|--------|
| `query matrix --active --summary` | 0 | PASS |
| `audit` | 0 | PASS (entropy 15/100; 3 unverified stories US-013/018/019 — pre-existing informational drift, not install-related) |

## Conclusion

The v0.1.17 install is independently proven GENUINE (published binary hash 3-way match + version), CORRECT (all 11 installer files byte-identical to upstream), and PRECISE (schema at v13 idempotent, durable state preserved 0-loss, marker block exact, commit scope clean, runtime artifacts gitignored). No FAIL on any check.

## Unresolved Questions

- None blocking. The 3 unverified stories reported by `audit` are pre-existing harness data drift unrelated to this install and out of scope for this verification.
