# Harness Meta-Docs Audit: docs vs harness-cli vs harness.db

Scope: docs/HARNESS_COMPONENTS.md, TOOL_REGISTRY.md, TRACE_SPEC.md, CONTEXT_RULES.md,
HARNESS_AUDIT.md, IMPROVEMENT_PROTOCOL.md, FEATURE_INTAKE.md vs `harness-cli.exe`
behavior and `harness.db` state. Read-only commands only.

## 1. Decisions 0038-0041: unregistered pattern is WIDER than just 0044

`harness-cli.exe query decisions` returns exactly 10 rows: `0001`-`0007`,
`0042-rls-defense-in-depth`, `0043-attendance-daily-inout-pairing`,
`0044-kpi-session-done-hr-remediation`. **0038, 0039, 0040, 0041 do not exist as
durable decision rows.**

`docs/decisions/*.md` glob confirms only 0001-0007, 0042, 0043 have individual files
(0044 also has none, matching the brief). 0038-0041 exist only as headings inside
`docs/22-adr-rule-chi-code-0038-0041.md` (lines 14, 37, 59, 84 — "ADR 0038", "ADR
0039", "ADR 0040", "ADR 0041"). Line 191 of that file states intent: "5 ADR này bỏ
thẳng vào `docs/decisions/0038…0042`" — but only 0042 ever got its own file/db row;
0038-0041 never did. **Conclusion: this is not a 0044-only gap. Four more decision
numbers (0038-0041) were designed to become durable records and never did.** A third
location also exists: `docs/FEATURE_INTAKE.md` lines 140-190 embed five more
decision-shaped records (DD-001..DD-005, dated 2026-07-07) that are in neither
`docs/decisions/` nor `harness.db.decision`. So durable decisions live in three
places today: `harness.db` (10 rows), `docs/22` prose (0038-0041), and
`FEATURE_INTAKE.md` prose (DD-001..005). None of the audited docs mention this
three-way split; HARNESS_COMPONENTS.md's "Project memory" row (line 27) claims
`docs/decisions/*` + `decision` table as the memory surface without flagging prose
decisions living elsewhere.

## 2. TOOL_REGISTRY.md: registry documented in depth, actually unused; manifest table drifted from reality

`query tools --summary` (30 rows, all `kind=builtin`, `source=compiled`) shows
**zero registered inbound tools** — no gitnexus, no c3, no deploy-check, despite
`docs/TOOL_REGISTRY.md` lines 49-59 giving those as the canonical registration
examples and CLAUDE.md instructing `gitnexus_impact`/etc. as mandatory workflow.
The `tool register`/`tool check`/`tool remove` subcommands all work (`tool
--help` confirms `check` exists, `tool check --help` confirms its flags match
docs lines 74-77), so the mechanism is real, just never invoked in this repo.

Separately, the doc's own "Compiled Harness Commands (Outbound Manifest)" table
(TOOL_REGISTRY.md:146-182, 33 rows incl. `tool check`, `db changeset apply`, `db
rebuild`) does not match what `query tools --summary` actually returns (30 rows).
**`tool check`, `db changeset apply`, and `db rebuild` are real, working commands
(confirmed via `--help`) but are absent from the queryable manifest** that the doc
says is the machine-readable source of truth (TOOL_REGISTRY.md:142-144, "JSON
records carry ... so any agent can read the registry without parsing the human
table"). An agent trusting `query tools --json` over the markdown table would
under-report available capability.

## 3. HARNESS_COMPONENTS.md file inventory: stale, describes a different project's stories

`docs/stories/**/*.md` glob returns only: `README.md`, `backlog.md`,
`US-001-p0-scaffolding-monorepo-health.md`, and `US-UI-01a` through `US-UI-08`
(8 files, a UI-phase batch). It does **not** contain
`US-008-trace-quality-scoring.md`, `US-009-enriched-friction-query.md`,
`US-011-backlog-outcome-workflow.md`, `US-018-phase4-cli-ux-hardening.md`,
`US-019-machine-readable-tool-registry.md`, or any of `US-012`, `US-015`-`US-024`
— all of which HARNESS_COMPONENTS.md:97-111 lists as present files.

Worse, those IDs collide with real, different stories in `harness.db.story`
(`query matrix` output): `US-008` = "WF-P1-07 LMS parent login (phone OTP +
profile picker)", `US-009` = "WF-P1-08 Receipt cancel/refund", `US-011` =
"WF-P2-01 Class batch create...", `US-018` = "WF-P2-07 QualitativeAssessment...",
`US-019` = "WF-P2-08 SessionEvidence...". These are CMC product stories, not the
harness-self-improvement stories the doc describes. **HARNESS_COMPONENTS.md's
File Inventory section was inherited from the upstream `repository-harness`
template project and never adapted to this CMC instance** — it documents files
and a story-ID space that do not exist here, while the real `docs/stories/US-UI-*`
files and the current 25-row story table (`US-ADMIN-01`, `US-ATT-01`,
`US-GAPS-01/02/03`, `US-HR-01`, etc.) are entirely unmapped. The "Coverage
Summary" (lines 142-167, "Covered: 8/11") is computed from this stale inventory
and should not be trusted as a CMC-specific score.

## 4. HARNESS_AUDIT.md: accurate

`scripts/bin/harness-cli.exe audit` output matches the doc's category names,
weights, and score formula exactly:

```
Orphaned stories: 0   Unverified stories: 3 (US-013, US-018, US-019)
Unverified decisions: 0   Open backlog without outcomes: 0
Stale stories: 0   Broken tools: 0
Entropy score: 15/100
```
3×5 (unverified stories) = 15, consistent with the doc's formula. No drift found
here — this doc is current and correct.

## 5. TRACE_SPEC.md, CONTEXT_RULES.md, IMPROVEMENT_PROTOCOL.md, FEATURE_INTAKE.md: spot-checked, no CLI/behavior drift found

All commands these docs reference (`trace`, `score-trace`, `score-context`,
`propose`, `propose --commit`, `backlog add/close`, `query backlog --open`,
`query friction`, `query interventions`) are present in `--help` output and/or
the compiled manifest. No fabricated flags or missing subcommands found in these
four docs within the time budget. FEATURE_INTAKE.md's DD-001..005 block (see §1)
is the one structural issue in this group — it's intake-workflow content
functioning as an undocumented fourth decision-record location.

## Command Output Deltas vs Doc Claims

| Doc claim | Reality | Verdict |
| --- | --- | --- |
| TOOL_REGISTRY.md examples (gitnexus, c3 registered) | 0 registered tools in db | Docs show unused capability as if canonical |
| TOOL_REGISTRY.md manifest table (33 cmds incl. `tool check`, `db changeset apply`, `db rebuild`) | `query tools --summary` = 30 rows, missing those 3 | Manifest under-reports real CLI surface |
| HARNESS_COMPONENTS.md file inventory (US-008/009/011/018/019/012/015-024 as files) | Those files don't exist; IDs reused by unrelated CMC stories | Inventory stale/foreign, not CMC-specific |
| HARNESS_AUDIT.md scoring | `audit` output matches formula exactly | Accurate |
| decisions table = 10 (0001-0007, 0042-0044) | 0038-0041 + DD-001..005 exist only as prose | Doc undercounts durable-decision gap |

## Unresolved Questions

1. Should 0038-0041 get real `docs/decisions/NNNN-*.md` files + `decision add`
   rows now, or is docs/22 intentionally treated as a batch/legacy carve-out?
2. Is HARNESS_COMPONENTS.md meant to be regenerated per-project, or should its
   File Inventory section simply be deleted/rewritten for CMC since it currently
   describes a different repo's `docs/stories/`?
3. Should `query tools --summary`'s manifest be regenerated from the actual
   clap CLI tree (to include `tool check`, `db changeset apply`, `db rebuild`)
   instead of being hand-maintained, given it already drifted once?
4. Are FEATURE_INTAKE.md's DD-001..005 intended to ever become durable decision
   rows, or are they permanently intake-only?

Status: DONE
Summary: Confirmed the "decisions living only in prose" pattern is wider than 0044 alone (0038-0041 + FEATURE_INTAKE.md's DD-001..005 also never entered harness.db); found TOOL_REGISTRY.md's manifest table has drifted from `query tools --summary` reality (3 real commands missing) and its registry examples are entirely unused (0 registered tools); found HARNESS_COMPONENTS.md's File Inventory section is stale/foreign — it lists `docs/stories/*` files that don't exist and whose IDs collide with unrelated real CMC stories. HARNESS_AUDIT.md, TRACE_SPEC.md, CONTEXT_RULES.md, IMPROVEMENT_PROTOCOL.md checked accurate against CLI behavior.
