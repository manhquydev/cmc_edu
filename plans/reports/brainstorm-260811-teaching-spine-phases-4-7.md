# Brainstorm — Plan 2 phases 4–7 (cook slice)

**Date:** 2026-08-11  
**Plan:** `plans/260811-1118-lms-teaching-spine-api-ui-family/`

## Contract

| Field | Decision |
|-------|----------|
| **Outcome** | Family principal can be deactivated / sessions invalidated; cancelled sessions hide journal; teacher attendance window with admin override; dual-gate roster used in teaching UI; open-tier kill-switch remains the dual homework model control |
| **Constraints** | TDD; additive migration only; do not touch unrelated HR `shifts.tsx`; monorepo Submission still exercise-scoped (not full cmc-lms SessionExercise port) |
| **Non-goals** | Full SessionExercise library+cron+grading redesign; money→units (plan 3); full cmc-lms UI port |
| **Acceptance** | isActive/tokenVersion enforced on LMS auth path; listForChild hides cancelled; attendance window + GĐĐT override; attendance panel prefers dual-gate roster; cancel restamp on session UI; tests green |

## Approaches compared

| Approach | Pros | Cons |
|----------|------|------|
| **A. Full port 4–7 from cmc-lms** | Complete parity | Weeks; Submission model rewrite |
| **B. Hardening + UI spine (chosen)** | Ship daily teaching loop with monorepo contracts | SessionExercise deferred |
| **C. UI-only wiring** | Fast | Leaves isActive/cancel journal gaps |

**Recommend B.** Evidence: photoConsent + LMS family pages already exist; gap is ParentAccount lifecycle, cancelled journal filter, attendance window, dual-gate roster UI, cancel restamp UI.

## Phase mapping this cook

| Phase | Work |
|-------|------|
| 4 | ParentAccount.isActive + tokenVersion; login reject inactive; token embeds tv; lmsProcedure validates tv/isActive; staff deactivate bumps tv |
| 5 | sessionEvidence.listForChild excludes cancelled; attendance mark window (teacher) + giam_doc_dao_tao override |
| 6 | Keep kill-switch; SessionExercise full model **deferred** (document) |
| 7 | Attendance dual-gate roster; session cancel→restamp; class create can use createClassWithUnits |

## Risks

- Async account check on every lmsProcedure (DB hit) — acceptable pilot scale
- Attendance window may surprise teachers on late corrections — admin override required
- Dual cancel path still exists until UI exclusively uses restamp cancel
