---
title: "Phase 6: UI admin teacher LMS"
status: todo
priority: P1
effort: "5–8d"
dependencies: [5]
---

# Phase 6: UI admin / teacher / LMS portal

## Overview

Port màn hình vận hành từ `cmc-lms/apps/web` vào monorepo: admin class ops (trong `apps/admin` teaching module), teacher zone (admin app hoặc route group), family portal (`apps/lms`).

## Requirements

- Functional:
  - [ ] Admin: classes, class detail (units, students enroll modal, sessions, realign), students/parents intake, curriculum view, exercise library, expiring, attendance report
  - [ ] Teacher: week calendar, session attendance/journal/grading, PDF workspace
  - [ ] Family LMS: profile picker, classes, exercises work, attendance, journal, rewards balance, account
- Non-functional:
  - [ ] Respect Console design system on admin (`docs/design-system-console.md`)
  - [ ] LMS mobile-first (port clay/astryx styles carefully or adapt to monorepo UI package)
  - [ ] No Mantine reintroduction

## Architecture

| Zone | Host app | Note |
|---|---|---|
| LMS admin ops | `apps/admin` under teaching/ops nav | Not a separate deploy |
| Teacher | `apps/admin` role-filtered routes OR `/teacher` section | Prefer one staff SPA |
| Family | `apps/lms` | Replace thin parent/student dual shells |

Port screens from `cmc-lms/apps/web/src/{admin,teacher,lms}`.

## Related Code Files

- Modify: `apps/admin/src/routes/teaching.routes.tsx` (+ new pages)
- Rewrite: `apps/lms/src/**` family shell
- Shared: PDF annotator components (may already exist in monorepo grading UI)

## Implementation Steps

1. Map each cmc-lms page → monorepo route + nav entry + required roles.
2. Port teacher schedule + session tabs first (highest daily use).
3. Port admin class/enroll next (ops dependency).
4. Replace LMS SPA with family portal.
5. Visual smoke + a11y role checks (`scripts/check-ui-a11y-roles.mjs` if applicable).

## Success Criteria

- [ ] Staff can run teaching day without cmc-lms deploy
- [ ] Family can complete homework on monorepo LMS
- [ ] Admin enroll units works end-to-end against new API

## Risk Assessment

Design system mismatch (cmc-lms Astryx clay vs Console Odoo). Prefer functional port first, restyle second if needed — do not block ops on pixel parity.
