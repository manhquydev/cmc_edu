# Harness Components

This taxonomy maps the current `repository-harness` repository to two
component frameworks used by Phase 2 and updated by Phase 3 active
observability work:

- Runtime Substrate responsibilities: the 11 responsibility areas the harness
  should cover.
- NexAU decomposition: the seven implementation surfaces that influence agent
  behavior.

Status values:

- **Covered**: the repository has an explicit file, command, or record for this
  responsibility.
- **Partial**: the repository has some support, but the support is incomplete,
  manual, or not yet measured.
- **Missing**: no meaningful support exists yet.

## Responsibility Map

| # | Responsibility | Status | Harness Files | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| 1 | Task specification | Covered | `AGENTS.md`, `docs/FEATURE_INTAKE.md`, `docs/templates/story.md`, `docs/templates/spec-intake.md`, `docs/templates/high-risk-story/*`, `docs/stories/*`, `intake` table, `story` table | Requests are classified by type and lane before implementation; normal and high-risk work have templates and durable story rows. | Keep story packets synchronized with future product docs. |
| 2 | Context selection | Covered | `AGENTS.md`, `docs/CONTEXT_RULES.md`, `docs/ARCHITECTURE.md`, `docs/decisions/*`, `docs/product/README.md`, `scripts/bin/harness-cli score-context` | Phase 2 adds phase-by-lane context rules and retrieval triggers; Phase 5 adds context scoring against recorded trace reads. | Future automation could enforce context selection instead of only measuring it. |
| 3 | Tool access | Covered | `scripts/bin/harness-cli`, `docs/TOOL_REGISTRY.md`, `tool` table, `crates/harness-cli/*`, `scripts/install-harness.sh`, `scripts/build-harness-cli-release.sh` | The Harness CLI exposes operational commands and a machine-readable tool manifest through `query tools`; external tools can be registered and removed. | Permission profiles and usage analytics remain future work. |
| 4 | Project memory | Covered | `docs/HARNESS.md`, `docs/decisions/*`, `docs/GLOSSARY.md`, `docs/HARNESS_BACKLOG.md`, `docs/stories/*`, `harness.db`, `decision`, `backlog`, and `trace` tables | Decisions, backlog, stories, and traces preserve durable knowledge across tasks. | Future work should add staleness checks and summarize old traces. |
| 5 | Task state | Covered | `scripts/bin/harness-cli query matrix`, `docs/TEST_MATRIX.md`, `intake` table, `story` table, `trace` table | Durable records track intake, story status, proof columns, and task traces. | Add lifecycle checks so in-progress stories cannot be forgotten. |
| 6 | Observability | Partial | `docs/TRACE_SPEC.md`, `trace` table, `scripts/bin/harness-cli trace`, `scripts/bin/harness-cli score-trace`, `scripts/bin/harness-cli query traces`, `scripts/bin/harness-cli query friction`, `docs/HARNESS_MATURITY.md` | Traces are auto-scored when recorded, can be rescored by command, and can be reviewed with friction context. | No dashboard or benchmark ingestion exists in this repo. |
| 7 | Failure attribution | Partial | `docs/HARNESS_COMPONENTS.md`, `docs/TRACE_SPEC.md`, `trace.errors`, `trace.harness_friction`, `docs/HARNESS_BACKLOG.md`, `backlog` table, `scripts/bin/harness-cli query friction` | Failures can be tied to files, components, friction, backlog proposals, and linked intake lane/type context. | No automated attribution from benchmark failures to harness components exists yet. |
| 8 | Verification | Covered | `docs/TEST_MATRIX.md`, `scripts/bin/harness-cli query matrix`, `scripts/bin/harness-cli story verify`, `scripts/bin/harness-cli story verify-all`, `scripts/bin/harness-cli trace`, `scripts/bin/harness-cli score-trace`, `story.verify_command`, `story.last_verified_result`, `.github/workflows/harness-cli-release.yml`, `docs/templates/validation-report.md` | Stories can store and run mechanical proof commands individually or in batch, traces warn when linked story verification has not passed, trace quality can be checked mechanically, and release workflow verifies Rust CLI releases. | Benchmark ingestion remains future work. |
| 9 | Permissions | Partial | `AGENTS.md`, `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/ARCHITECTURE.md`, installer conflict handling in `scripts/install-harness.sh` | Policy describes when agents may update docs and when to ask before architecture or workflow changes. | Permissions are instruction-level only; no enforced policy layer or command allowlist exists. |
| 10 | Entropy auditing | Covered | `docs/HARNESS_BACKLOG.md`, `docs/HARNESS_AUDIT.md`, `docs/IMPROVEMENT_PROTOCOL.md`, `backlog` table, `trace.harness_friction`, `scripts/bin/harness-cli audit`, `scripts/bin/harness-cli propose`, `docs/HARNESS_MATURITY.md` | Growth rule captures friction, audit detects drift and entropy score, backlog items compare predicted impact to actual outcome, and proposal generation can create reviewable backlog items. | Automated repair remains future work. |
| 11 | Intervention recording | Covered | `intervention` table, `scripts/bin/harness-cli intervention add`, `scripts/bin/harness-cli query interventions`, `trace` table, `docs/decisions/*`, `docs/stories/*`, `docs/HARNESS.md` | Human, reviewer, CI, and agent interventions are separate durable records and can be filtered by trace, story, or type. | Capture is still manual and advisory. |

## NexAU Cross-Reference

| Component | Harness Equivalent | Status | Notes |
| --- | --- | --- | --- |
| System prompts | `AGENTS.md` plus Harness policy docs | Covered | `AGENTS.md` is the stable shim; `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, and `docs/CONTEXT_RULES.md` carry evolving operating instructions. |
| Tool descriptions | `docs/TOOL_REGISTRY.md`, `scripts/README.md`, `docs/HARNESS.md`, `docs/TRACE_SPEC.md`, CLI help from `crates/harness-cli/src/interface.rs`, `scripts/bin/harness-cli query tools` | Covered | Commands are documented in a standalone registry and exposed as compiled plus registered tool manifest entries. |
| Tool implementations | `scripts/bin/harness-cli`, `crates/harness-cli/*`, `scripts/schema/001-init.sql`, `scripts/schema/002-story-verify.sql` | Covered | The Rust CLI is the primary durable-layer implementation and stable repo-local entrypoint. |
| Middleware | installer safety logic, feature intake workflow | Partial | The installer and intake process mediate work, but there is no runtime middleware enforcing policies. |
| Skills | `docs/templates/*`, `docs/FEATURE_INTAKE.md`, `docs/CONTEXT_RULES.md`, `docs/TRACE_SPEC.md` | Partial | Reusable procedures exist as markdown, not executable or installable agent skills. |
| Sub-agents | None in this repository | Missing | No delegated specialist agents or sub-agent protocols exist. |
| Long-term memory | `harness.db`, `docs/decisions/*`, `docs/stories/*`, `docs/HARNESS_BACKLOG.md`, `docs/GLOSSARY.md` | Covered | Durable records and markdown decisions preserve task history and project vocabulary. |

## File Inventory

CMC repository story files tracked for this project. Files are mapped to Runtime Substrate responsibilities for harness observability.

| File | Primary Responsibility | Secondary Responsibilities |
| --- | --- | --- |
| `docs/stories/README.md` | Task specification | Project memory |
| `docs/stories/backlog.md` | Task specification | Project memory |
| `docs/stories/US-001-p0-scaffolding-monorepo-health.md` | Task specification | Verification, intervention recording |
| `docs/stories/US-UI-01a.md` | Task specification | Context selection |
| `docs/stories/US-UI-01b.md` | Task specification | Context selection |
| `docs/stories/US-UI-02.md` | Task specification | Context selection |
| `docs/stories/US-UI-03.md` | Task specification | Context selection |
| `docs/stories/US-UI-04.md` | Task specification | Context selection |
| `docs/stories/US-UI-05.md` | Task specification | Context selection |
| `docs/stories/US-UI-06.md` | Task specification | Context selection |
| `docs/stories/US-UI-07.md` | Task specification | Context selection |
| `docs/stories/US-UI-08.md` | Task specification | Context selection |

## Coverage Summary

**CMC Project Story Inventory** (10 files total): README.md, backlog.md, US-001-p0-scaffolding-monorepo-health.md, 
US-UI-01a through US-UI-08. Real stories are tracked in harness.db story table by CMC domain 
(US-ADMIN-01, US-ATT-01, US-GAPS-01/02/03, US-HR-01, etc., 25 rows total). This file's coverage applies 
to harness self-improvement responsibilities across the tooling ecosystem; for product-domain story tracking, 
refer to harness.db and `query matrix` output.
