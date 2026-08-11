# 0045 — Khóa học > Unit entitlement + dual access gates

Date: 2026-08-11

## Status

Accepted (owner decisions 2026-08-11 + LMS foundation spike plan).

## Context

Owner locked: teaching rights are **unit ranges inside a program/course axis**, not vague whole-class access. Live `cmc-lms` uses `EnrollmentUnitRange` + session unit stamps. Monorepo previously only had money-shell `Enrollment.status` (reserved/active) and ADR 0038 exercise open-tier.

## Decision

1. **Product axis:** Program (UCREA / BRIGHT_IG / BLACK_HOLE) → ordered units (`CurriculumUnit.orderGlobal`, unique per program). Facility `Course` remains ERP placement shell; unit math uses `ClassBatch.program` → units of that program.
2. **Dual gates (AND):**
   - Money/membership: `Enrollment.status = active` (primary writer: receipt provision ADR 0041; no client free-activate).
   - Teaching: session's stamped unit `orderGlobal` covered by some `EnrollmentUnitRange`.
3. **Procedure freeze:**
   - `enrollment.enroll` → reserved seat only; **never** writes ranges.
   - `enrollment.grantUnits` / `addWithUnits` → ranges only; requires active enrollment for roster; **sale excluded**.
4. **Fail-closed:** session without `curriculumUnitId` stamp ⇒ empty teaching roster for that session.
5. **ADR 0038:** still live for homework open until plan 2 kill-switch. Auto-stamping sessions for roster **also** feeds open-tier — document side effect; foundation does not claim production dual-gate for exercises.

## Consequences

- Schema: `EnrollmentUnitRange.facilityId` + FORCE RLS; ClassBatch neo anchors; non-null orderGlobal.
- Refund (later): revoke unlearned units from next; never erase attendance history.
- Break-glass (later): create identity without range ⇒ no learn until grant.
