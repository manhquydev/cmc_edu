# Advise: Teacher session-centric workflow

**Date:** 2026-08-04  
**Input:** Optimize teaching workflow like Odoo/OpenEduCat — schedule → session detail → session-scoped actions  
**Evidence:** research-260804-teacher-session-centric-workflow.md + codebase scout

---

## Reframing (analytical — user asked dissection + direction, not pain ranking)

### Problem (reframed)

Teaching **data model is session-centric**; teaching **UI is function-centric**. Teachers re-establish class+session context on every task. Calendar already deep-links only to attendance. Session-done requires three session-scoped tasks that live on three pages. Continuity break is IA, not missing domain tables.

### Exact requirements

1. One **session work record** reachable from schedule click (and deep-link).
2. On that record: attendance, assessment, evidence **without re-picking class/session**.
3. Surface **session-done progress** (3 conditions) on the same surface.
4. Stay on CMC stack: DetailPage / EntityHeader / WorkflowStatusbar; no Odoo OWL port.
5. Preserve backend session-done semantics and teacher scoping.
6. Keep grading/exercises out of v1 hub unless trivially linked.

### Goals

- Teacher day path: open calendar → open buổi → finish 3 ops → see progress → leave.
- Fewer context resets; fewer wrong-session mistakes.
- Align UI with VIEW-GRAMMAR “record form” already used in CRM opportunity detail.

### Non-goals

- Full OpenEduCat/Odoo feature parity
- Schema redesign
- LMS student app rewrite
- Grading/PDF annotator inside session hub v1
- New design system

### Constraints

Solo+AI; existing trpc routers; facility RLS; journey smoke e2e already brittle — change incrementally with redirects.

### Recommended defaults for open product knobs

| Question | Default |
|----------|---------|
| Calendar click default tab | `attendance` (highest frequency mid-class) |
| Legacy routes | redirect to hub with tab query; keep 1 release |
| Nav items for 3 functions | keep until hub proven, then demote to aliases or remove |
| Roles | same as current page permissions |
| Pre-endTime ops | allow (backend already); checklist shows incomplete until sweep |

---

## Verdict

**Your instinct is correct and well-aligned with both the domain and Odoo/OpenEduCat.**  
Do **not** solve this by stuffing more nav links (“Điểm danh trong nav”, cross-links everywhere). That preserves function-first IA and adds noise.

Build a **Session Detail Hub** (Approach A). Use **deep-links (B)** only as Phase 0 scaffolding. Avoid calendar-only drawer (C) as the main design.

---

## What you should do

1. Treat `ClassSession` as the teacher work object (like Opportunity in CRM).
2. Add `classSession.get` + Session Detail page (`DetailPage` recipe from opportunity-detail).
3. Extract three panels from existing pages; prop-inject `sessionId` (and `classBatchId` when needed).
4. Point FullCalendar `href` to `/teaching/sessions/:id`.
5. Put 3/3 session-done progress on EntityHeader/WorkflowStatusbar (prefer shared read of evaluate inputs).
6. Redirect old paths; cleanup nav after stability.
7. Plan/cook in thin phases; test per panel.

## What you shouldn't do

- Port OpenEduCat modules or Odoo OWL/web client
- Add more peer sidebar items without a hub
- Big-bang rewrite attendance/evidence/assessment in one PR
- Fold grading + exercises into v1 hub
- Invent a new full-page layout outside DetailPage
- Change session-done 3 conditions without product ADR

## Better / efficient paths

| Rank | Path | When |
|------|------|------|
| 1 | A full hub phased 0–4 | Goal = uninterrupted day ops (your stated goal) |
| 2 | B deep-link only | Need 1–2 day win, defer shell |
| 3 | Cockpit “next incomplete session” only | Ops focus without new detail route (insufficient alone) |

## My take — route from here to goal

Mirror CRM: list/calendar browses; **detail owns work**.

```text
Phase 0  Deep-link evidence/assessment + multi-entry from schedule (optional quick win)
Phase 1  classSession.get + SessionDetail shell (identity + empty tabs)
Phase 2  Attendance tab (extract panel)
Phase 3  Assessment + Evidence tabs + done progress
Phase 4  Redirects, nav, cockpit shortcut, e2e journey
```

Reference implementation pattern: `opportunity-detail.tsx`.  
Domain pivot: `session-done.ts`.  
Calendar entry: `schedule-fc-events.ts` href change.

## Benefits

- Continuous teacher flow (one record)
- UI matches backend session model (DRY mental model)
- Reuses VIEW-GRAMMAR investment
- Natural home for session-done checklist
- Easier future: substitute teacher, makeup session ops on same surface

## Trade-offs

- Extracting panels from 3 mature pages = test churn
- Temporary dual paths (legacy + hub) until redirects
- Teachers who liked “global attendance picker” lose a rare batch-jump pattern (mitigate: schedule + optional batch filter still exist)
- Solo capacity: multi-phase, not one weekend myth

---

## Work checklist

- [ ] Accept hub IA + defaults (default tab=attendance; phased; no OWL)
- [ ] `ak:plan` under `plans/<ts>-teacher-session-hub/`
- [ ] API: `classSession.get` (+ optional doneProgress)
- [ ] Page: `session-detail.tsx` + route + params
- [ ] Extract AttendancePanel / AssessmentPanel / EvidencePanel
- [ ] Wire calendar + cockpit entry
- [ ] Redirects from old teaching paths
- [ ] Unit/component tests per panel + hub
- [ ] Journey e2e: schedule → session → mark attendance → evidence → assessment progress
- [ ] Nav cleanup after dogfood

## Success metrics

| Metric | Target | How to verify |
|--------|--------|---------------|
| Clicks to open session-scoped attendance from calendar | 1 click to hub, 0 re-picks | Manual / e2e |
| Re-pick class/session for evidence after attendance | 0 | e2e same sessionId |
| Session-done progress visible on hub | 3 conditions shown | UI assert |
| Legacy deep-links | 302/redirect or equivalent SPA navigate | route tests |
| Backend session-done semantics | unchanged | existing session-done + sweep tests green |
| Frame compliance | Session detail uses DetailPage | import grep / design law |
