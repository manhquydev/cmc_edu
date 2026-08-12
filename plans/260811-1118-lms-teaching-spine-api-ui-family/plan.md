---
title: "LMS teaching spine API UI family"
description: "Plan 2/3: class engine full, enrollment ops, family auth, attendance/journal, exercise delivery, teacher/admin/family UI. Blocked by foundation spike."
status: in_progress
priority: P1
effort: "4–6 tuần"
tags: [lms, teaching, family, ui]
created: 2026-08-11
blockedBy:
  - project:260811-1117-lms-foundation-adr-va-spike-unit-range
blocks:
  - project:260811-1118-lms-erp-money-bridge-import-cutover
---

# Plan 2/3 — Teaching spine (API + UI + family)

## Depends on

**Plan 1 DONE** + ship note contracts:
- `orderGlobal` unique(program, orderGlobal)
- `EnrollmentUnitRange.facilityId` + FORCE RLS
- Procedure freeze: `enroll` reserved-only; ranges via grantUnits
- Create+stamp TX; dual-gate on rosterForSession
- Ship note: `plans/reports/ship-lms-foundation-spike.md` (after cook)

## Outcome

Daily teaching loop on monorepo without money bridge yet (admin can grant units by hand):

- Cancel session restamps units; no makeup  
- grantPast / revokeFromNext / archive  
- Family phone+password multi-child  
- Attendance window + journal + photoConsent  
- Exercise library + 1 delivery/session end + grade/stars  
- Teacher + admin ops + family UI spines  

## Non-goals

- Receipt → auto unit grant (plan 3)  
- Import live / close cmc-lms (plan 3)  
- Gifts redesign  

## Phases

| # | Phase | Dep |
|---|-------|-----|
| 1 | Start / inventory after foundation | plan1 |
| 2 | Class engine full cancel restamp | 1 |
| 3 | Enrollment ops grant revoke archive | 2 |
| 4 | Family principal ownership sinks | 1 |
| 5 | Attendance journal photoConsent | 2,4 |
| 6 | Exercise library delivery grading | 2,3 |
| 7 | Teacher admin family UI spines | 3–6 |

## Success criteria

- [ ] Teacher can run teaching loop on monorepo APIs/UI spines (staging UAT still human) — **PARTIAL**: API loop có; thiếu UI grant/archive/sequence; staging teaching-day chưa chạy
- [ ] Family can homework when entitled (open-tier default; delivery when flag off) — **PARTIAL**: `LMS_ENTITLEMENT_GATE` default OFF nên "when entitled" chưa có hiệu lực
- [x] Open-tier path flag-off ready  
- [x] Server kill-switch for dual homework models  

> **Đính chính 2026-08-12.** Plan này từng khai `status: completed`. Đo lại bằng code
> (`plans/reports/review-260812-1407-lms-merge-thuc-trang.md`) cho thấy `phase-07` success
> criteria vẫn `[ ]` ngay trong file của nó, và **phase-04 không gộp PH/HS** — Notes của
> chính phase đó ghi "Parent login remains OTP-primary; student password path exists".
> Chủ hệ thống đã chốt mô hình tài khoản gia đình ngày 2026-08-12
> (`plans/reports/decisions-owner-260812-cau-6-7.md`); phần danh tính là việc **chưa làm**,
> không phải việc đã xong.

## Progress (2026-08-11 cook)

| Phase | Status | Evidence |
|-------|--------|----------|
| 1 Start | done | Plan 1 ship + foundation commit `7d55b17` |
| 2 Class engine cancel restamp | done | unified `cancelSessionWithRestamp` |
| 3 Enrollment grant revoke archive | done | grantPast / revokeFromNext / archive |
| 4 Family principal | done | isActive + tokenVersion + setActive |
| 5 Attendance journal photoConsent | done | window + cancelled hide + photoConsent |
| 6 Exercise library delivery | done | SessionExercise + sequence + worker |
| 7 UI spines | done (spine) | dual-gate roster; cancel; createClassWithUnits |

Ship notes:
- `plans/reports/ship-lms-teaching-spine-api-ops.md`
- `plans/reports/ship-lms-teaching-spine-phases-4-7.md`
- `plans/reports/ship-lms-session-exercise-delivery.md`
- `plans/reports/gap-lms-plans-vs-impl-260811.md`

## Plan 3 handoff

**Ready to start** money bridge when owner provides package→unit examples.  
Range single-writer: `lmsOps.*` grant/revoke only.

<!-- slug: lms-teaching-spine-api-ui-family -->
