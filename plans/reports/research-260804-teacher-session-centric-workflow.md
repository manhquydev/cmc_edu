# Research Report: Teacher session-centric workflow (CMC × Odoo × OpenEduCat)

**Date:** 2026-08-04  
**Skills:** ak-brainstorm + ak-research + ak-advise  
**Scope:** Optimize teacher day-ops so work is centered on **ClassSession**, not disconnected function pages  
**Repos:** `odoo/odoo`, `openeducat/openeducat_erp`, CMC teaching cluster as-built

---

## Executive Summary

CMC domain model is **already session-centric** (attendance, assessment, evidence keyed by `classSessionId`; session-done needs all three). Admin UI is **function-first** (nav slices: Lịch / Điểm danh / Nhật ký / Nhận xét), so teachers re-pick class→session and lose continuity.

Odoo pattern: calendar/list opens a **record form**; related work lives as tabs/smart buttons **on that record**. OpenEduCat: timetable session **binds** attendance sheet (period-level), not a free-floating day roster.

**Recommendation:** Introduce **Session Detail Hub** (`DetailPage` at `/teaching/sessions/:sessionId`) as the teacher primary work surface. Keep `/teaching/schedule` as calendar entry; reframe or demote standalone attendance/evidence/assessment pages to thin deep-link shells or redirects. Do **not** port Odoo/OpenEduCat runtime.

---

## Research Methodology

- Sources: CMC repo (admin teaching pages, class-session router, session-done, VIEW-GRAMMAR, opportunity-detail recipe), prior Odoo UX advise (`plans/260803-xia-odoo-ui-architecture/reports/`), OpenEduCat product docs (timetable↔attendance), Odoo view grammar public docs
- Recency: CMC code 2026-08; Odoo/OpenEduCat product patterns evergreen ERP IA
- Key terms: session hub, record form, session-done, timetable attendance, DetailPage, VIEW-GRAMMAR

---

## Key Findings

### 1. Current CMC teacher IA (as-built)

| Surface | Frame | Session context entry |
|---------|-------|----------------------|
| `/teaching/schedule` | ListPage + FullCalendar | Click event → **attendance only** (`?classBatch&session`) |
| `/teaching/attendance` | custom/List-ish | Deep-link + Selector class→session |
| `/teaching/session-evidence` | custom | **No** URL deep-link; pick class→session |
| `/teaching/session-assessment` | FormPage | **No** URL deep-link; pick class→session; **already shows 3/3 progress UI** |
| `/teaching/grading`, `/exercises` | MasterDetail / list | Batch/exercise scoped, not session-primary |

Nav (`nav-registry.ts`) presents 6 peer children under Giảng dạy — Odoo would treat most as **actions on session**, not top-level menus.

Calendar adapter (`schedule-fc-events.ts`):

```text
href = /teaching/attendance?classBatch={batch}&session={session}
```

So the product already *partially* chose session deep-link — but only for one function.

### 2. Domain / backend readiness

| Concern | State | Gap for hub |
|---------|-------|-------------|
| `ClassSession` entity + lifecycle | Yes (`list`, `listInRange`, cancel/confirm/makeup) | **No `getById` read** for detail page identity |
| Attendance by session | `listBySession`, mark | Embeddable panel |
| Assessment by session | `listBySession`, draft/confirm | Embeddable panel |
| Evidence by session | `getBySession`, upsert/photo/publish | Embeddable panel |
| Session-done engine | Pure `evaluateSessionDone` + worker sweep | Need **read API for 3-condition progress** on hub (assessment page already computes client-side hint) |
| Teacher scoping | `assertTeacherOwnsClass` etc. | Hub must respect same gates |

**Conclusion:** Hub is primarily **frontend IA + thin API** work, not a schema redesign.

### 3. Session-done = natural hub checklist

Server truth (`session-done.ts`):

1. Attendance: ≥1 `present`
2. Assessment: every present student has confirmed qualitative assessment
3. Evidence: published + ≥1 photo  
(+ time gate: `now >= endTime`)

UI already previews this on session-assessment. Hub should own this as **WorkflowStatusbar / ProgressSteps** on the session record (like opportunity stage bar).

### 4. Odoo operating model (portable grammar only)

From CMC VIEW-GRAMMAR + prior research:

```text
AppFrame
  └── List/Calendar (browse)
        └── Form/Detail of ONE record
              ├── identity (EntityHeader)
              ├── statusbar / smart buttons
              ├── tabs (notebook) for related data
              └── chatter / activity (optional later)
```

Do **not** clone OWL, XML views, or purple Bootstrap. Map:

| Odoo | CMC |
|------|-----|
| calendar view of sessions | ListPage + SoftOpsFullCalendar |
| form view of session | DetailPage + EntityHeader |
| notebook pages | CmcTabs: Điểm danh / Nhận xét / Nhật ký |
| statusbar | WorkflowStatusbar = session status + 3/3 done |
| smart button | StatActions counts (present, comments confirmed, photos) |

### 5. OpenEduCat timetable pattern (portable intent)

- Confirmed session → attendance sheet **for that session**, roster from enrollment
- Attendance is **period/session-linked**, not free day register
- Changes to session (cancel/reschedule) cascade to attendance sheet semantics

CMC already matches data-wise; UI does not open the session as the work object.

### 6. Gold in-repo recipe for DetailPage

`apps/admin/src/pages/crm/opportunity-detail.tsx`:

- `useParams` id → `get` query
- DetailPage + PageHeader breadcrumbs + EntityHeader + WorkflowStatusbar + StatActions + sections
- Actions scoped to **this record**

Teaching session hub should mirror this shape, not invent a fifth layout.

---

## Comparative Analysis

| Approach | Description | Effort | Continuity win | Risk |
|----------|-------------|--------|----------------|------|
| **A. Session Detail Hub** | Route `/teaching/sessions/:id`; tabs embed 3 ops | M | High | Extract panels carefully; tests |
| **B. Deep-link only** | Add `?session` to evidence/assessment; calendar multi-links | L | Medium | Still 3 pages / re-nav |
| **C. Calendar drawer** | Quick attendance in modal | M | Low–med for 1 task | Weak for evidence/assessment |
| **D. Nav spam** | More cross-links in sidebar | S | Low | Noise; not Odoo-like |

**Winner for stated goal (uninterrupted teacher work):** **A**.  
**Cheapest incremental:** **B** as Phase 0 enabler while building A.

---

## Implementation Recommendations

### Target IA

```text
Giảng dạy
  ├── Lịch dạy          → browse (calendar)
  ├── [optional] Buổi hôm nay / queue on cockpit
  ├── Chấm bài          → stays (not session-primary)
  └── Bài tập           → stays

Hidden or legacy redirects:
  /teaching/attendance?…     → /teaching/sessions/:id?tab=attendance
  /teaching/session-evidence → /teaching/sessions/:id?tab=evidence
  /teaching/session-assessment → /teaching/sessions/:id?tab=assessment
```

### Session Detail layout

```text
DetailPage
  PageHeader: Giảng dạy › Lịch dạy › Buổi {date}
  EntityHeader: {batchCode} · {program} · time range · status badge
  WorkflowStatusbar: planned|confirmed|done|cancelled + 3-step progress
  StatActions: present/total · comments x/y · photos n · [optional unit]
  Tabs:
    overview   — meta, unit, links, session-done checklist
    attendance — extract from attendance.tsx body (session fixed)
    assessment — extract from session-assessment body
    evidence   — extract from session-evidence body
```

### API deltas (minimal)

1. `classSession.get` (or `getById`) — identity + batch denorm (code, program, teacherId)
2. Optional `classSession.doneProgress` — server-side 3 flags (reuse evaluateSessionDone inputs) so hub/cockpit share truth
3. No change to mark/confirm/publish mutations

### Frontend deltas

1. Route + page `session-detail.tsx`
2. Extract `AttendancePanel`, `AssessmentPanel`, `EvidencePanel` (sessionId prop required; no class/session selectors when prop set)
3. Calendar href → `/teaching/sessions/:id` (default tab=attendance or overview)
4. Cockpit teacher shortcuts → next incomplete session hub
5. Nav: demote 3 function items after hub stable (or keep as aliases)

### Phased delivery (KISS)

| Phase | Deliverable | Proof |
|-------|-------------|-------|
| 0 | Deep-link evidence/assessment + calendar multi-entry | Manual + unit |
| 1 | `classSession.get` + empty Session Detail shell | API test + page smoke |
| 2 | Tab attendance embedded | Existing attendance tests adapted |
| 3 | Tabs assessment + evidence + progress bar | session-done UI parity |
| 4 | Redirects + nav cleanup + journey e2e | e2e teacher flow |

### Common pitfalls

- Big-bang rewrite of 3 large pages without extract → flaky tests
- Putting grading/PDF into hub v1 (YAGNI; different entity)
- Client-only progress that diverges from server evaluateSessionDone
- Forcing teachers through hub when they need batch-level lists (keep schedule + batch admin elsewhere)
- Porting OpenEduCat modules wholesale

---

## Resources

- CMC: `design-system/cmc-edu/VIEW-GRAMMAR.md`, `PAGE-FRAMES.md`
- CMC: `apps/api/src/class/session-done.ts`, `class-session-router.ts`
- CMC: `apps/admin/src/pages/crm/opportunity-detail.tsx` (DetailPage recipe)
- Prior: `plans/260803-xia-odoo-ui-architecture/reports/advise-odoo-ux-grammar-2026-08-03.md`
- OpenEduCat: https://openeducat.org/feature-timetable-management-system/ (session↔attendance)
- Odoo: calendar → form record pattern (view types)

---

## Unresolved questions (product)

1. Default tab after calendar click: `overview` vs `attendance`?
2. After hub: hide nav items attendance/evidence/assessment or keep aliases?
3. Teacher may open hub mid-session before endTime — show checklist incomplete vs allow full ops (backend already allows mark before done-sweep)?
4. Scope hub to `giao_vien` only vs also `giam_doc_dao_tao`?

---

## Next steps

1. Confirm product defaults on unresolved questions (or accept recommendations below in advise).
2. `ak:plan` session hub with phases 0–4.
3. Cook phase 0–1 first; measure clicks-to-complete for dogfood teacher day path.
