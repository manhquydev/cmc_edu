---
title: "UI UX Sprint B — confirm, leave-guard, formatRole"
description: "Close interaction gaps after Sprint A: dirty leave guard, high-risk confirm, single role lexicon, broader toast."
status: completed
priority: P1
effort: "1-2d"
tags: [ui, ux, admin, feedback]
created: 2026-08-02
blockedBy: [project:260802-ui-ux-sprint-a]
---

# UI UX Sprint B — confirm · leave-guard · formatRole

## Brainstorm contract (`ak-brainstorm`)

| Field | Value |
|-------|--------|
| **Outcome** | Staff cannot lose unsaved điểm danh silently; publish/close/publish-evidence require explicit confirm; role labels are one lexicon; more commit actions toast success. |
| **Constraints** | One-door `@cmc/ui` / `@cmc/auth`; no shadcn; keep payroll finalize/reopen **without** ConfirmDialog (locked by `payroll.test.tsx` QĐ0025); Astryx ConfirmDialog only; YAGNI — no full useActionMutation framework unless 3+ call sites benefit. |
| **Non-goals** | Density compact tables; LMS toast; deep-link preselect session; full mutation inventory rewrite; dark mode. |
| **Acceptance** | See Success Criteria below + tests listed per phase. |

## Research / advise summary (`ak-research` + advisory)

**Scout (post Sprint A):**
- Toast + ghost logout + formatRole shell/cockpit **done**.
- ConfirmDialog used: finance receipt, shifts, KPI, student-detail, check-in-out, class-detail cancel.
- **Missing confirm:** `exercises.tsx` Publish/Đóng direct mutate; `session-evidence` publish.
- **Explicit no-confirm:** payslip finalize/reopen (test contract).
- **No leave-guard:** attendance `saved` dirty flag only local.
- **Dual ROLE_LABELS:** `users.tsx` local maps diverge from `@cmc/auth`.

**Advice (recommended approach):**
1. Small **`useUnsavedBlocker`** helper (react-router `useBlocker` + ConfirmDialog) — reusable, not framework bloat.  
2. Confirm only **external-visible / irreversible teaching actions** this sprint.  
3. **formatRole** migration for users admin.  
4. Toast on confirm success paths touched in this sprint.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Leave-guard dirty điểm danh | P1 |
| 2 | Confirm publish/close exercise + publish session evidence | P1 |
| 3 | Single ROLE_LABELS via formatRole on users admin | P2 |
| 4 | Toast after those commits | P1 |

## Phases

| # | Phase | Status | Deps |
|---|-------|--------|------|
| 1 | [Foundation: useUnsavedBlocker](./phase-01-start.md) | Pending | — |
| 2 | [Leave-guard attendance](./phase-02-leave-guard-attendance.md) | Pending | 1 |
| 3 | [Confirm matrix high-risk](./phase-03-confirm-matrix-high-risk-mutations.md) | Pending | — |
| 4 | [formatRole + toast coverage](./phase-04-formatrole-consistency-toast-coverage.md) | Pending | — |

Phases 3–4 parallelizable with 1–2 after phase 1 helper lands.

## Success Criteria

- [ ] Navigate away from dirty attendance → ConfirmDialog; confirm stays / leave discards  
- [ ] Publish exercise / close exercise / publish session evidence gated by ConfirmDialog  
- [ ] payslip finalize/reopen still **no** ConfirmDialog  
- [ ] Users admin role chips use `formatRole` (or ROLE_LABELS from auth)  
- [ ] Toast success on leave-safe save already exists; toast on new confirm successes  
- [ ] Unit tests updated/pass for attendance, exercises, session-evidence, users if present  

## Related evidence

- `design-system/cmc-edu/MASTER.md`  
- `plans/260802-research-ui-ux-product-eval/reports/ui-ux-pro-max-interaction-upgrade.md`  
- Sprint A: `plans/260802-ui-ux-sprint-a/plan.md`  

## Red Team Review

Adversarial pass (controller + design-system evidence), 2026-08-02:

| Sev | Finding | Evidence | Disposition |
|-----|---------|----------|-------------|
| High | Confirm payroll finalize would break QĐ0025 tests | `apps/admin/src/pages/hr/payroll.test.tsx:10-12` | **Accept** — explicit non-goal |
| High | Dirty false-positive if seed localStatus marks dirty | `attendance.tsx` useEffect seeds status | **Accept** — use explicit `dirty` flag on toggle only |
| Med | useBlocker flaky under MemoryRouter | RR v7 data APIs | **Accept** — test dirty flag + dialog open via unit path; e2e optional |
| Med | Publish without toast = silent success returns | Sprint A pattern | **Accept** — toast on confirm success |
| Low | Dual ROLE_LABELS in users.tsx | `users.tsx:25-35` vs `@cmc/auth` | **Accept** — phase 4 |

### Whole-Plan Consistency Sweep

- No payroll confirm in any phase.  
- Dirty = toggle-driven, not seed-driven.  
- Phases 3–4 do not depend on phase 1 except shared ConfirmDialog patterns.  
- Unresolved contradictions: **none**.

## Validation

Self-validated (no open product forks for this scope). Critical questions answered in-plan:

| Question | Answer |
|----------|--------|
| Confirm payroll finalize? | **No** — payroll.test contracts forbid |
| Leave-guard only attendance? | **Yes this sprint** — YAGNI |
| useBlocker vs beforeunload? | **Both**: useBlocker SPA + beforeunload for tab close |
| formatRole copy on users? | Prefer auth labels over local "Super Admin" |

**Ready for `/ak:cook`.**

<!-- slug: ui-ux-sprint-b-confirm-leave-guard-formatrole -->
