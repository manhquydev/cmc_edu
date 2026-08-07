# Cook — Design3 validation pipeline (acceptance re-measure)

**Date:** 2026-08-07  
**Mode:** cook pipeline after FilterBar ship (PR #75)  
**HEAD:** `eaa223a`  
**PR:** https://github.com/manhquydev/cmc_edu/pull/75

## Brainstorm contract

| Field | Value |
|-------|--------|
| **Outcome** | Close machine-provable design3 validation gates: re-run `pnpm acceptance:report` against CI `ui-e2e` journey evidence at current HEAD; sync plan/docs |
| **Constraints** | No Search OS cook; no merge to `main`; do not commit gitignored journey artifacts; exit-code-1 orphans are pre-existing triage debt |
| **Non-goals** | Human visual pixel smoke; full UAT; inventing UI for `no-ui-path` flows |
| **Acceptance** | Evidence run `gitDirty:false` + SHA match HEAD; 31/38 proven unchanged ceiling; durable report under `plans/reports/`; design3 plan + design-system-odoo updated |

## Pipeline executed

```
[preflight PR #75 green]
  → download CI artifact acceptance-journeys-<sha>
  → place apps/e2e/acceptance-results/journeys.json (gitignored)
  → pnpm acceptance:report
  → pnpm check:ui-frames --strict
  → write plan/docs delta
  → commit + push + monitor CI
```

## Evidence source

| Item | Value |
|------|--------|
| ui-e2e run | `31139475641` |
| Artifact | `acceptance-journeys-eaa223a…` → `journeys.json` |
| metadata.gitSha | `eaa223a164d615d582b465049f249ebc75a446fa` |
| metadata.gitDirty | **false** |
| project | `ui-chromium` |
| unrunJourneys | **[]** |

## Results vs Phase 1 baseline

Phase 1 baseline (`plans/260805-1920-design3-admin-rollout/reports/baseline-acceptance-flows-phase1.md`) listed **38 flow ids** only (no proven counts).

| Metric | Phase 1 note | Re-measure @ eaa223a |
|--------|--------------|----------------------|
| Flow ids | 38 | **38** |
| Structural built / partial / missing | (not in baseline list) | **37 / 1 / 0** |
| Journey specs | — | **31/38** |
| Proven run (CI) | — | **31/38** |
| no-ui-path / not-yet | — | **7/38** |
| Actor-audit findings | — | **0** |
| Untriaged orphans | — | **6** (exit 1) |

### Proven ceiling

**31/38 proven** — same method ceiling documented in `docs/system-architecture.md` (7 `no-ui-path`). FilterBar ship did **not** regress journey coverage.

### Untriaged orphans (pre-existing; exit code 1)

```
classSession.doneProgress, classSession.get, classSession.listInRange,
parentAccount.list, user.changeOwnPassword, user.resetPassword
```

Not introduced by PR #75 FilterBar/search. Triage is separate backlog (manifest claim vs whitelist vs documented gap).

### Documented gaps (2)

`course.create`, `enrollment.mine` — already annotated in verify.ts.

## Machine smoke (non-browser)

| Gate | Result |
|------|--------|
| `pnpm check:ui-frames --strict` | **pass** (bulkListsOk ≥5) |
| Admin shell AppFrame/SideNav production | **absent** (tests only) |
| design-lab routes | **deleted** |
| Required CI on PR #75 | **green** before this docs cook |

Human visual smoke (toast / ⌘K / CRM kanban / teaching calendar) remains **manual**.

## Plan / docs impact

- `plans/260805-1920-design3-admin-rollout/plan.md` — mark acceptance re-measure done; leave human smoke open
- `docs/design-system-odoo.md` — acceptance gate closed with evidence pointer
- This report durable under `plans/reports/`

## Not done

- [ ] Human merge PR #75
- [ ] Human visual smoke checklist
- [ ] Triage 6 untriaged orphans (separate cook if desired)
EOF