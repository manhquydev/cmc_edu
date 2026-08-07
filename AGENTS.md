# Agent Instructions

## Project Skills

Use `.codex/skills/harness-intake-griller/SKILL.md` when a request needs
discussion, feature intake, docs, or story shaping before Symphony execution.
The skill is project-scoped; do not use a global copy as the source of truth.

<!-- HARNESS:BEGIN -->
## Harness

Start with the requested outcome, then use the repository as the system of
record. Read `docs/WORKFLOW.md` and only the product, design, plan,
code, and validation material relevant to the task.

- Answers, explanations, reviews, diagnoses, plans, and status reports are
  read-only. Inspect only what is needed and do not mutate repository or Harness
  state.
- For a bounded change, use an ephemeral plan: inspect the affected behavior and
  existing proof, implement the change, and run behavior-appropriate validation.
  No control-plane operation is required.
- Create or update one file under `docs/plans/active/` when work spans sessions,
  needs coordination or an ordered sequence, has meaningful dependencies, or
  requires explicit recovery steps. Move it to `docs/plans/completed/` only
  after validation.
- Before editing, identify repository authority for each new externally
  observable policy. If materially different choices remain open, stop before
  edits; configurable defaults are not authority.
- Also pause when product intent remains ambiguous, an action is difficult to
  recover, validation would be weakened, or the request does not authorize the
  needed action.
- Claim completion only with relevant executable or observable evidence. Report
  the outcome, important changed surfaces, validation, and unresolved risks.

SQLite intake, story, trace, scoring, audit, and proposal commands are optional
compatibility features. Use them only when explicitly requested or required by
an external orchestrator.
<!-- HARNESS:END -->

## Project Context (CMC EDU v2)

This repo runs Harness on top of the **CMC EDU v2** product (ERP + LMS). When a
request needs product knowledge, read in order:

**Product context:**
- `README.md` — what CMC EDU v2 is, stack, monorepo structure, getting started
- `docs/README.md` — design corpus index (TL00–TL31, frozen docs)
- `docs/system-architecture.md` — **authoritative as-built architecture** (P1–P4, all routers, test coverage, RLS, known issues)
- **Trạng thái nghiệm thu là số ĐO, không phải số chép:** nguồn đúng luôn là `pnpm acceptance:report`
  (sinh từ artifact CI job `ui-e2e`) + run CI gần nhất. Con số trong tài liệu là ảnh chụp kèm ngày —
  nếu lệch, tin lệnh, đừng tin tài liệu. Ảnh chụp 2026-07-26 (main `0b933bf`): **31/38 luồng đã chứng
  minh chạy — đã chạm trần của phương pháp journey** (7 luồng còn lại `no-ui-path`). Journey ở mức smoke
  (chạy thông ≠ đúng số học nghiệp vụ); **UAT người thật chưa chạy** ⇒ chưa được mô tả dự án là
  "production-ready". Staff đăng nhập bằng email/password; Entra SSO + Graph tạm tắt vì mất quyền M365
  (chi tiết + điều kiện bật lại: `docs/system-architecture.md`, mục Auth Integration).
- `docs/codebase-summary.md` — current implementation status, phases complete, build verification

## Operating model (solo + AI-generated code)

Một người vận hành, phần lớn code do AI sinh ra ⇒ không có đội review con người
đứng sau. Các gate tự động (CI) chính là đội review đó — coi chúng là
non-bypassable, không phải gợi ý.

- Trước khi báo một thay đổi "done": `typecheck-and-test` VÀ `ui-e2e` phải
  xanh trên CI (cả hai đều là required checks trên `main`).
- Luôn làm việc trên branch + PR; không bao giờ commit thẳng vào `main` cục bộ
  (tránh sự cố `main` phân kỳ giữa local và remote).
- Dependabot patch/minor auto-merge khi CI xanh (`.github/workflows/dependabot-auto-merge.yml`);
  major/breaking dependency bump cần người xem lại thủ công.
- Chạy `pnpm acceptance:report` trước khi phát biểu số liệu nghiệm thu — đó là
  nguồn đo lường thật; số trong tài liệu chỉ là ảnh chụp có ngày.
- Tín hiệu bảo mật (CodeQL, Trivy misconfig, secret scanning, Dependabot
  security) — với một người vận hành, liếc qua tab Security khoảng mỗi tuần là
  đủ; dismiss false-positive kèm bằng chứng cụ thể.

**Glossary:**
- `docs/07-glossary-san-pham.md` (TL07) — CMC product terms (ubiquitous language)
- `docs/GLOSSARY.md` — Harness tooling terms

**Where plans live — this project overrides the Harness default.** Durable
execution plans belong in `plans/<timestamp>-<slug>/`, not `docs/plans/active/`.
That directory already holds this project's plan history and templates
(`plans/templates/`). Read the Harness block above with that substitution.
`docs/plans/` stays in place because it is a Harness-managed path — deleting it
makes `harness update` stop with a `MissingManagedFile` conflict — but do not
write plans into it.

**Before using the intake skill.** `.codex/skills/harness-intake-griller/SKILL.md`
requires `scripts/bin/harness-cli`, which is `.gitignore`d and absent on a fresh
clone. Run `scripts/bootstrap-harness.sh` (PowerShell:
`.\scripts\bootstrap-harness.ps1`) first — it downloads and checksum-verifies the
pinned CLI release, then initializes the local database. The SQLite intake,
story, and trace commands remain optional, as the Harness block states; bootstrap
only when a request actually calls for that flow.

> This section lives outside the `HARNESS:BEGIN…END` markers on purpose: the
> marked block above is regenerated by `install-harness` on each upgrade, so
> project-specific guidance must stay here to survive refreshes.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **cmc_edu** (16428 symbols, 23042 relationships, 206 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/cmc_edu/context` | Codebase overview, check index freshness |
| `gitnexus://repo/cmc_edu/clusters` | All functional areas |
| `gitnexus://repo/cmc_edu/processes` | All execution flows |
| `gitnexus://repo/cmc_edu/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
