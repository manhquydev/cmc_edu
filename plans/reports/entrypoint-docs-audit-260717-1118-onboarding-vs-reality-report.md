# Entry-Point Docs Audit — Onboarding vs Reality

Scope: README.md, AGENTS.md, docs/README.md, docs/ARCHITECTURE.md, docs/GLOSSARY.md, docs/decisions/README.md, docs/stories/README.md. Report-only, no edits made.

## Finding 1 (CRITICAL): Root README.md describes a different product

`README.md` (295 lines, all of it) is 100% generic **repository-harness** tool documentation — a meta-tool for making repos agent-ready — not documentation of CMC EDU itself. It explicitly states:

- README.md:226-232 — "This repository is in Harness v0. There is no application implementation and no baked-in product specification yet."
- README.md:236 — "No product contract is currently defined."

Both are false. `package.json:2` names the project `cmc-edu-v2`; the repo has real apps (`apps/admin`, `apps/api`, `apps/e2e`, `apps/lms`) and packages (`packages/auth`, `db`, `domain-finance`, `domain-grading`, `domain-identity`, `domain-payroll`, `domain-time`, `llm`, `mcp-server`, `storage`, `ui`), and `docs/system-architecture.md:4` reports "532/532 tests passing (0 skipped) in 64 test files." README.md never mentions `packages/llm`, `packages/mcp-server`, or any app directory. A new human/agent reading README.md first gets zero accurate information about the actual project.

- Minor: README.md:148 references a root `CHANGELOG.md` — file does not exist (`find` confirmed missing).

## Finding 2: AGENTS.md points agents at the stale architecture doc, skips the real ones

AGENTS.md:9-27 (Harness block) tells agents to read `README.md`, `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/ARCHITECTURE.md`, `docs/CONTEXT_RULES.md`, `docs/TOOL_REGISTRY.md`. It never references `docs/system-architecture.md` (the real, current architecture doc) or `docs/README.md` (the TL00–TL31 product doc index). All referenced Harness docs do exist on disk (verified). The GitNexus block appended below it (AGENTS.md:29-129) is accurate/current and matches CLAUDE.md.

## Finding 3: docs/ARCHITECTURE.md vs docs/system-architecture.md — unresolved duplication, no cross-reference

Two docs with the same apparent purpose, no link between them, no authority marker:

- `docs/ARCHITECTURE.md` (133 lines) — 100% generic Harness template. Still says "No application stack is selected yet" (line 3) and "No application code exists yet" (line 5).
- `docs/system-architecture.md` (567 lines) — the real as-built doc, dated 2026-07-11, "P1–P4 complete and tested," 532/532 tests passing (line 2-4).

Neither file mentions the other (`grep` for cross-references returned nothing both directions). Since AGENTS.md's Harness block only lists `docs/ARCHITECTURE.md` (Finding 2), an agent following AGENTS.md literally would read the stale generic template and could conclude no code exists.

## Finding 4 (confirmed, exact wording): docs/stories/README.md stale claim

`docs/stories/README.md:6` — **"No story packets are active yet."**

Actual: `docs/stories/` has 10 files besides the README — `backlog.md`, `US-001-p0-scaffolding-monorepo-health.md`, `US-UI-01a-backend-so-codes-email-auth.md` through `US-UI-08-docs-harness-sync-e2e.md` (8 files).

Additionally, `docs/stories/README.md:14-16` and `:23-31` describe a suggested path structure `docs/stories/epics/E01-domain-name/US-001-*.md` — this `epics/` subfolder does not exist (`find` confirmed). Actual stories live flat in `docs/stories/`. The README's suggested layout doesn't match the repo's real convention.

## Finding 5: docs/decisions/README.md — prior audit flag does NOT apply here

Read the full file (docs/decisions/README.md:1-29). It contains **no** "no decisions yet" or similar stale-count claim — it is purely a procedural how-to (when/how to add a decision + `harness-cli decision add` example). `grep -rn "No decisions\|Không có\|chưa có quyết định"` against this file returned zero matches. The prior audit's flag that this file also has stale "nothing here yet" wording is **not confirmed** — only `docs/stories/README.md` has that problem.

Separately: `docs/decisions/` has 14 files (13 ADRs + README): 0001-0007, 0038-0043. Note the task brief said "0038-0044" — 0044 does not exist; highest is 0043 (`0043-attendance-daily-inout-pairing.md`), consistent with the attendance in/out ADR memory. This is a count discrepancy in the tasking, not a doc bug.

## Finding 6: docs/GLOSSARY.md is also generic-harness-only, not a CMC glossary

All 15 terms in `docs/GLOSSARY.md` (Agent, Harness, Story Packet, Trace, Tool Registry, Entropy Score, etc.) are Harness-tool vocabulary — zero CMC EDU domain terms (no mention of enrollment, receipt, RBAC roles, facility, etc.). The real product glossary is `docs/07-glossary-san-pham.md` (TL07, referenced correctly by `docs/README.md:31,95`). A reader landing on `docs/GLOSSARY.md` expecting product terms will be misled into thinking it's the canonical glossary; nothing in the file points to TL07.

## Finding 7: docs/README.md — accurate, no issues found

`docs/README.md` (TL00–TL31 index, dated 2026-07-05) correctly indexes all 32 `docs/TLxx-*.md` files — verified all exist at `docs/00-ke-hoach-tai-lieu-va-lo-trinh.md` through `docs/31-phased-build-plan.md`. No stale claims found. Slightly older than `system-architecture.md` (2026-07-11) but makes no contradicted factual claims.

## Summary Table

| Doc | Status | Core problem |
|---|---|---|
| README.md | STALE (whole doc) | Describes the harness meta-tool, not CMC EDU; claims no app exists |
| AGENTS.md | STALE reference | Harness block points to stale ARCHITECTURE.md, omits real docs |
| docs/README.md | OK | Accurate TL00-31 index |
| docs/ARCHITECTURE.md | STALE (whole doc) | Generic template, unlinked to system-architecture.md |
| docs/GLOSSARY.md | STALE (whole doc) | Harness-tool terms only, not CMC domain glossary (TL07 exists separately) |
| docs/decisions/README.md | OK | No stale claim found (contra prior audit flag) |
| docs/stories/README.md | STALE (1 line + structure) | Line 6 "No story packets active yet" false; epics/ path unused |

Status: DONE
Summary: README.md and docs/ARCHITECTURE.md/GLOSSARY.md are wholesale generic Harness-template content disconnected from the real CMC EDU product (apps/admin, apps/lms, apps/api, packages/llm, packages/mcp-server, etc.); docs/stories/README.md:6 has the confirmed stale "No story packets are active yet" line but docs/decisions/README.md has no such stale claim (prior audit flag only half-confirmed); docs/ARCHITECTURE.md and docs/system-architecture.md are unlinked duplicates with the generic one wired into AGENTS.md's read list instead of the real one.
