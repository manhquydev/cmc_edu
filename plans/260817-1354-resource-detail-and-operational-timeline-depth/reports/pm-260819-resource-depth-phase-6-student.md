# Phase 6 Module 2 — Student progress

## Status

Implemented in PR #161 (`https://github.com/manhquydev/cmc_edu/pull/161`).
CodeRabbit’s seven actionable findings were verified against current source and
fixed locally; follow-up commit/CI is pending. Phase 6 remains pending because
modules 3–6 are not implemented.

## Delivered

- Facility-scoped `student.timeline`, gated by the existing `student.lookup` read roster.
- Server-fixed `Student` RecordEvent entity with allowlisted lifecycle, enrollment,
  guardian, provisioning, password-reset, and withdrawal event kinds.
- Transaction-bound event emission at Student, enrollment, activation, finance,
  guardian, provisioning, and reconciliation-worker producers.
- Dual enrollment view: ClassBatch `student_enrolled` remains; Student receives
  `enrolled`.
- Shared Guardian pair advisory lock, Student row locks, conditional activation,
  and no-op withdrawal count gate for exactly-once behavior.
- Student profile operational timeline UI and detail test coverage.
- P1-05 acceptance manifest claim for `student.timeline`.
- Frozen producer/PII report: `phase-06-module-2-student-freeze.md`.

## Evidence

- API: 136 test files, 1308 tests passed.
- Admin: 75 test files, 713 tests passed.
- Workspace typecheck: 34/34 Turbo tasks passed.
- Acceptance report: 43 built, 0 partial, 0 missing, 9 documented gaps, 0 unclassified.
- GitNexus detect_changes: 26 changed symbols, 5 affected processes, medium risk.
- Targeted QA: Student 17/17; changed producer suites 86/86; Admin detail 9/9.

## Review

- CodeRabbit produced seven actionable comments. All seven were confirmed:
  pagination sentinel, stale pagination responses, query errors, lifecycle
  invalidation, active-only withdrawal, receipt/Guardian transaction scope,
  and GitNexus evidence accuracy.
- Fixes add a pagination generation guard, query-error rendering, timeline
  invalidation, active-only finance updates, a locked Student reread, an
  atomic receipt guard + Guardian create, and expanded impact evidence.
- The dedicated code-reviewer adapter failed twice before inspection due an
  external Cloud Code Assist schema error; fallback reviewer and Kongming
  completed the equivalent review cycle.

## Residual risk

Pre-existing finance M9 sibling receipt cancellation can race its approved-receipt
check when no shared Opportunity row serializes the calls. This module does not
redesign finance cancellation; the Student timeline now avoids false events when
an enrollment update changes zero rows. CI evidence on the final PR head remains
required before treating this module as merged.
