# Research: Session-centric IA for long-term extensibility

**Date:** 2026-08-04  
**Lens:** bền vững + mở rộng (not one-sprint UX patch)  
**Skills:** ak-brainstorm · ak-research · ak-advise · project scout  
**Prior:** research/advise-260804-teacher-session-centric-workflow.md

---

## Executive Summary

CMC already has **durable product laws** that imply session hub:

1. **TL06 URL grammar** — resource-oriented path detail (`/{area}/{resource}/{id}/{tab}`), not function query pages.
2. **VIEW-GRAMMAR** — List/Calendar browse → DetailPage record form; modules add **data/tabs/permissions**, not chrome.
3. **Domain** — ClassSession is first-class; attendance/assessment/evidence/exercise-open/session-done hang off it.
4. **Partial hubs exist** — Opportunity, Receipt, ClassBatch, Student detail. **Teaching day-ops is the gap.**

Long-term win is not “one page with 3 tabs”. It is adopting **Record-Centric Work Surfaces** as a platform pattern: every operational entity gets browse + detail; related actions are **tab plugins** on the record, gated by permission.

Teacher Session Hub is the **first teaching-side instance** of that law — and the template for future session-scoped features (unit link, makeup, day-credit, parent notifications, agent escalate URLs).

---

## Scout inventory (project truth)

### A. Hierarchy of work objects (already in product)

| Level | Entity | Owner role | Existing UI | Missing |
|-------|--------|------------|-------------|---------|
| Facility | Facility, network | admin | settings | — |
| Batch/term | ClassBatch | GĐĐT | `class-detail` (sessions tab: confirm/cancel/makeup/assignUnit) | — |
| **Session/day** | **ClassSession** | **GV** | schedule calendar only; ops = function pages | **session detail hub** |
| Student lifecycle | Student, Enrollment | multi | student-detail | — |
| Commercial | Opportunity, Receipt | sale/finance | opportunity/receipt detail | — |

**Critical split (must keep forever):**

- **ClassBatch detail** = training-ops / schedule *administration* (who teaches, generate sessions, assign unit, makeup admin).
- **ClassSession detail** = *execution* of one teaching event (mark, comment, evidence, done progress).

Collapsing both into class-detail would make teacher day path worse (deep nest) and GĐĐT ops noisier. **Two hubs, one link.**

### B. Docs authority vs as-built UI

| Authority | Says | As-built |
|-----------|------|----------|
| TL06 §2–4 | `/{resource}/{id}/{tab}` deep-linkable detail | Teaching uses `/teaching/attendance?session=` function pages |
| TL06 §6 | Agent escalate → stable record URL | No session URL for HITL |
| TL26 WF-P2-02 | UI `/teaching/attendance?session=` | Matches as-built (function path) — **spec lagged product law** |
| TL26 WF-P2-01 | `/classes/:id/sessions` | class-detail SessionsTab |
| VIEW-GRAMMAR | DetailPage for form/read record | Opportunity/receipt/class/student; **not session** |
| TL19/20 session-done | 3 conditions on session | UI progress only on assessment page |

**Durable move:** update TL06 map + WF-P2 URLs when hub ships — authority should converge on resource path, not freeze 2026 function URLs.

### C. Extension surface already on ClassSession (future tabs free)

Already session-scoped in backend/docs:

- Attendance, QualitativeAssessment, SessionEvidence (+ photos, child data rules)
- `curriculumUnitId` / `assignUnit` (GĐĐT)
- Makeup (`isMakeup`, `makeupForSessionId`)
- Exercise open Tier A/B (ADR 0038) — *derived* from session end + attendance
- Session-done sweep (ADR 0044)
- Future-friendly: agent escalate, substitute teacher, room change audit, parent notify status

None of these need a new top-level nav item if session detail is the **plugin host**.

### D. In-repo patterns to reuse (do not invent)

| Pattern | Source | Reuse how |
|---------|--------|-----------|
| DetailPage slots | `@cmc/ui` DetailPage | header/entity/summary/tabs/body |
| Record + actions | opportunity-detail | get-by-id, EntityHeader, WorkflowStatusbar, permissioned CTAs |
| Admin sessions table | class-detail SessionsTab | link row → session hub; keep admin mutations here |
| Calendar → deep link | schedule-fc-events | change target to session resource URL |
| Progress 3/3 UI | session-assessment | lift to hub summary (prefer server progress) |
| Panel extract | (not yet formal) | **must introduce** `*Panel` composition law |

### E. Risks if built as one-off page (anti-sustainability)

1. **God page** — paste 3 full pages into one file → untestable, unextendable.
2. **Query-only tabs** (`?tab=`) without path tabs — violates TL06 cold-start/bookmark law (use path tabs or document deliberate query exception).
3. **Nav remains function-first** — dual mental models forever.
4. **No get-by-id** — every embed re-lists sessions → fragile.
5. **Progress only client-side** — diverges from session-done engine.
6. **Merge batch admin into teacher hub** — wrong actor density.

---

## Long-term architecture (recommended)

### 1. Platform law (write once, apply everywhere)

**Record-Centric Work Surface (RCWS):**

```text
Browse surface (ListPage / Calendar / Kanban / Cockpit queue)
        │ open record
        ▼
Detail surface (DetailPage)
   identity · statusbar · smart stats
   tabs[] = permission-gated panels (compose, don't fork chrome)
   deep link: /{area}/{resource}/{id}[/{tab}]
```

Teaching Session Hub = RCWS instance for `ClassSession`.  
Same law already used for Opportunity/Receipt/Student/ClassBatch.

### 2. URL (align TL06; first-class session resource)

**Primary (teacher + agent + share):**

```text
/teaching/sessions/:sessionId                 → default tab (attendance or overview)
/teaching/sessions/:sessionId/attendance
/teaching/sessions/:sessionId/assessment
/teaching/sessions/:sessionId/evidence
/teaching/sessions/:sessionId/overview        → meta, unit, done checklist, links
```

**Why not only `/classes/:batchId/sessions/:sessionId`?**

- Calendar and agent always have **sessionId first**, not batch.
- TL06 allows area resource; teaching is the work area for GV.
- Class detail still owns `/admin/classes/:id` (or current classes path) with sessions **admin** table linking out.

Optional alias later: `/classes/:batchId/sessions/:sessionId` → redirect to teaching path (DRY single page).

**Legacy (compat ≥1 release):**

```text
/teaching/attendance?classBatch&session → redirect
/teaching/session-assessment           → redirect if session known
/teaching/session-evidence             → redirect if session known
```

### 3. Frontend module layout (extensible)

```text
apps/admin/src/
  pages/teaching/
    schedule.tsx                 # browse only
    sessions/
      session-detail.tsx         # shell: load get, chrome, tab router
      tabs/
        overview-tab.tsx
        attendance-tab.tsx       # thin; hosts panel
        assessment-tab.tsx
        evidence-tab.tsx
    panels/                      # OR packages/ui later if shared LMS
      attendance-panel.tsx       # pure: sessionId required, no class picker
      assessment-panel.tsx
      evidence-panel.tsx
    session-done-progress.tsx    # presentational from API flags
```

**Extension rule:** new session capability = new tab file + optional panel + permission + docs URL row.  
**Forbidden:** new top-level nav sibling for session-scoped work without hub registration.

### 4. API surface (stable contracts)

| Procedure | Purpose | Stability |
|-----------|---------|-----------|
| `classSession.get` | Identity + batch denorm + status + times + unit | **Required** |
| `classSession.doneProgress` | 3 flags + timestamps (evaluate inputs) | Recommended; single truth for hub/cockpit |
| existing mark/list/confirm/publish | Unchanged | Keep public contracts |

Optional later (not v1): `classSession.timeline` (audit), `classSession.related` (makeup parent/child).

### 5. Permission model (unchanged keys, tab visibility)

Tabs render only if `can(module, action)`:

| Tab | Permission (existing) |
|-----|------------------------|
| overview | `class.read` |
| attendance | `attendance.mark` |
| assessment | `assessment.draft` |
| evidence | `sessionEvidence.upsert` |
| future: unit assign | `schedule.generate` (admin; maybe hide on teacher hub or read-only) |

Do not invent super-permission “session.manage” in v1 — YAGNI; compose existing gates.

### 6. Nav & cockpit (IA evolution)

**Phase durable end-state:**

```text
Giảng dạy
  ├── Lịch dạy              browse
  ├── (optional) Hàng đợi buổi  incomplete sessions — cockpit/list
  ├── Chấm bài              submission-centric (not session)
  └── Bài tập               exercise-centric (not session)

Removed or alias:
  Điểm danh / Nhật ký / Nhận xét  → absorbed by session hub
```

Cockpit teacher: TaskRow “Hoàn tất buổi X” → `/teaching/sessions/:id` with flag query for incomplete step.

### 7. Cross-entity links (graph, not spaghetti)

```text
class-detail SessionsTab row  →  session hub
schedule event                →  session hub
student attendance history    →  session hub (future)
LMS parent evidence           →  published evidence of session (already)
agent escalate                →  session hub + ?flag=
makeup child session          →  link to parent session overview
```

### 8. What never goes into Session Hub (boundaries)

| Feature | Why elsewhere |
|---------|----------------|
| Grading PDF / submission queue | Submission-centric; multi-session |
| Exercise authoring | Course/unit authoring |
| Class create / generate sessions | Batch admin |
| Payroll / teacher HR punch | Different Attendance domain (staff) |
| Full student PII dossier | Student detail |

Hub may **link** to these with prefilled filters, not embed them.

### 9. Testing strategy (sustainable)

- Panel unit tests (sessionId fixed; no picker paths)
- Shell tests (loading/error/403/tab visibility)
- Contract: redirects preserve sessionId
- Journey e2e: schedule → session → 3 ops smoke
- Keep existing API session-done / attendance gate tests green (no semantic change)

### 10. Docs / ADR (make it durable)

When shipping:

1. **ADR** “ClassSession is teacher day-ops work object; RCWS pattern”
2. Update **TL06** teaching routes table
3. Update **TL26** WF-P2-02/06/08 UI URLs
4. VIEW-GRAMMAR example: “Session detail = calendar → form”
5. Do **not** leave function URLs as authority after migration

---

## Comparative options (long-term scored)

| Option | Extensibility | Align docs | Teacher continuity | Maintenance |
|--------|---------------|------------|--------------------|-------------|
| A RCWS Session Hub | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★ (if panels) |
| B Deep-link only forever | ★★ | ★★ | ★★★ | ★★★★ |
| C Mega class-detail tabs | ★★ | ★★★ | ★★ | ★★ god page |
| D Odoo clone / OpenEduCat port | ★★★ | ★ | ★★★ | ★ disaster |

**Choose A.** B only as migration ramp. Reject C/D for long-term.

---

## Phased roadmap (multi-year friendly, not big-bang)

| Horizon | Outcome |
|---------|---------|
| **H0** (days) | Deep-links + calendar multi-entry; zero architecture debt if temporary |
| **H1** (sprint) | `get` + shell + path tabs + attendance panel |
| **H2** (sprint) | assessment + evidence + doneProgress |
| **H3** (short) | redirects, nav cleanup, cockpit tasks, e2e, docs/ADR |
| **H4+** (later) | overview unit display, makeup links, agent flags, optional alias under classes, LMS staff mirror if needed |

Each horizon leaves system usable; no rewrite cliff.

---

## Success metrics (long-term)

| Metric | Target |
|--------|--------|
| New session-scoped feature | +1 tab/panel, **0** new top-level nav for that feature |
| Teacher path re-pick session | 0 within one session completion |
| Stable share URL for session | cold-start works |
| API session-done tests | still pass without rule change |
| Detail frame compliance | Session detail uses DetailPage |
| Dual IA time | legacy function nav ≤ 1–2 releases |

---

## Unresolved (minor; defaults below)

1. Default tab: **attendance** (ops) vs overview (status) — recommend attendance for mid-class; overview for post-class incomplete queue.
2. Path tabs vs `?tab=` — **path tabs** per TL06; exception only if RR nesting cost too high in one PR (then `?tab=` with follow-up).
3. Whether GĐĐT sees admin actions on hub — **read-only + link to class-detail** in v1.

---

## References

- `docs/06-kien-truc-url-routing.md`
- `docs/26-workflow-spec-p2.md`
- `docs/19` / `docs/20` session-done, evidence, attendance
- `design-system/cmc-edu/VIEW-GRAMMAR.md`
- `apps/admin/src/pages/crm/opportunity-detail.tsx`
- `apps/admin/src/pages/classes/class-detail.tsx` (SessionsTab)
- `apps/api/src/class/session-done.ts`
- Prior advise: `advise-260804-teacher-session-centric-workflow.md`
