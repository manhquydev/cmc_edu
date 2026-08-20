# Frame coverage map — detail pages, URLs, cross-links

**Date:** 2026-08-20  
**Scope:** current `apps/admin/src` + `packages/links` (`@cmc/links`). Read-only.  
**Builds on:** `plans/260817-1354-resource-detail-and-operational-timeline-depth/reports/source-current-resource-depth-inventory.md` (2026-08-17). That ledger is **route-depth** and is stale on Staff (`/hr/staff` now exists). This survey does **not** redo route classification; it maps **clickable relational navigation**.

**Authority:**

- Canonical path builders: `packages/links/src/index.ts` (`links.*`, section helpers, `resolveGo`)
- Routes: `apps/admin/src/routes/{hr,admin,teaching,crm,finance,go}.routes.tsx`

Legend: **Y** = present · **N** = absent · **partial** = exists but not a durable path section or not a clickable record link.

`/go` allowlist = keys of `links` only: `opportunity`, `receipt`, `student`, `classBatch`, `shiftRegistration`, `kpiScore`, `afterSaleCase`, `parentAccount`, `classSession`, `manualPunchTicket`, `reward`, `exercise`, `staff`. No `course`, `facility`, `parentMeeting`.

---

## Matrix

| Entity | (a) Dedicated detail page | (b) Stable path URL | (c) INBOUND clicks | (d) OUTBOUND clicks | (e) Addressable tabs/sections |
|---|---|---|---|---|---|
| **Staff** | Y `pages/hr/staff/staff-detail.tsx` + `profile.tsx` / `access.tsx` / `activity.tsx` | Y `/hr/staff/:staffId` → replace `/profile`. Compat: `/admin/users` + `/admin/users/:staffId` → `/hr/staff` / `staffProfilePath` | List + create-success + audit-log + users redirect. **Not** from class teacher, session, KPI, shift, opportunity owner | **None** to class/session/student | Y path: `/profile` `/access` `/activity` |
| **Student** | Y `pages/students/student-detail.tsx` | Y `/admin/students/:id` → `/profile` | List; class roster; parent children. **Not** from session roster, receipt, aftersale, meeting, reward, grading | **None**. Enrollments show class `batchCode` as text. No parent | Y path: `/profile` `/enrollments` (enrollments gated to `enrollment.grantUnits`) |
| **Parent / ParentAccount** | Y `pages/parents/parent-detail.tsx` | Y `/admin/parents/:parentId` (no section subpaths) | Parent directory list only | Children → `links.student`. **No** meetings, classes, teachers | N — single sheet + inline `ParentActivitySection` (not a URL section) |
| **ParentMeeting** | Y `pages/crm/parent-meeting-detail.tsx` | Y `/crm/post-sale-meeting/:meetingId/:section?` | List `parentMeetingPath` | Student name is **plain text**. No parent, class, teacher | Y path: `overview` / `activity` via `parentMeetingSectionPath`. **Not** a `/go` entity |
| **Class / ClassBatch** | Y `pages/classes/class-detail.tsx` | Y `/admin/classes/:id` → `/overview` | Class list; session “Lớp học” button; exercise-sequence crumbs | Roster → `studentSectionPath(..., 'profile')`. Sessions → `/teaching/sessions/:id?tab=attendance`. Teacher = **picker, not a staff link**. No course, no parents | Y path: `/overview` `/students` `/sessions` |
| **Session** | Y `pages/teaching/session-detail.tsx` | Y `/teaching/sessions/:sessionId` (`links.classSession`) | Schedule events; class sessions tab; attendance `?session=` replace | Class: **button** to hardcoded `/admin/classes/:id` (KV “Lớp” is text). Students in attendance/assessment = **text**. **No teacher, no parent** | Query only: `?tab=overview\|attendance\|assessment\|evidence` (default attendance) |
| **Course** | **N** — `pages/courses/index.tsx` list + create dialog | **N** — `/admin/courses` only. No `links.course` | n/a | n/a | n/a |
| **Exercise** | Y `pages/teaching/exercise-detail.tsx` | Y `/teaching/exercises/:exerciseId` | Exercise list | Back to list only. Sequence is class-owned workspace `/teaching/classes/:classBatchId/exercise-sequence` | N — single sheet |
| **Receipt** | Y `pages/finance/receipt-detail.tsx` | Partial. Base `/finance/:id` → `/overview`. Routes register **only** `overview` + `order-lines` | List, create-success, refund index | Student name, parent phone, class code/id = **text**. Opportunity only via create `?opportunityId=` | Partial: UI NavLink includes `activity` (`receiptSectionPath`) but **`finance.routes.tsx` does not register `:id/activity`** → that tab 404s |
| **Opportunity** | Y `pages/crm/opportunity-detail.tsx` | Y `/crm/opportunities/:id`. Timeline is in-page (reference), not a path section | Pipeline card/row | Out to `/finance/new?opportunityId=`. Contact, phone, assignee name = **text**. No student/parent/staff record links | N — local/in-page timeline |
| **Aftersale case** | Y `pages/crm/aftersale-detail.tsx` | Y `/crm/aftersale/:caseId` | List + create-success | Student title/strip = **text** (`studentName` / `studentId`). No parent/class | N — single sheet |
| **Shift** | Y `pages/attendance/shifts-detail.tsx` | Y `/hr/shifts/:registrationId` | Shift list + `/new` replace | Staff `appUser.fullName` = **text**. No `/hr/staff/:id` | N — single sheet |
| **KPI score** | Y `pages/hr/kpi-detail.tsx` | Y `/hr/kpi/:scoreId` | KPI board + `/hr/my` “Mở phiếu” | Person name = **text**. No staff link | N — single sheet |
| **Reward** | Y `pages/engagement/rewards-detail.tsx` | Y `/admin/engagement/rewards/:rewardId` | Rewards queue | Student shown as **truncated id text**. No `links.student` | N — single sheet |
| **Facility** | **N** — `pages/admin/facilities.tsx` list + edit dialog | **N** — `/admin/facilities` only. No `links.facility` | n/a | n/a | n/a |

---

## Pain focus — session / class / student / teacher / parent

Relational hops a director or teacher actually needs. **Clickable** means `Link` / `navigate` to that entity’s canonical detail.

```
                    ┌──────── staff/teacher ────────┐
                    │  detail exists (/hr/staff)    │
                    │  almost nobody links TO it    │
                    └──────────────▲────────────────┘
                                   │ MISSING
        ┌──────────────┐    picker only     ┌─────────────────┐
        │    Session   │───────────────────▶│      Class      │
        │  ?tab=… hub  │  BUTTON to class   │  path sections  │
        └──────┬───────┘  (KV class = text) └────────┬────────┘
               │ MISSING student names               │
               │ (attendance/assessment = text)      │ roster Link Y
               ▼                                     ▼
        ┌──────────────┐                      ┌──────────────┐
        │   Student    │◀──── children Link ──│    Parent    │
        │              │                      │              │
        │ no parent    │── MISSING ──────────▶│ no meetings  │
        │ no class Link│                      │ no class     │
        └──────────────┘                      └──────────────┘
```

### What works today

| Hop | Where | How |
|---|---|---|
| Class → Student | `class-detail.tsx` `StudentsTab` ~131 | `Link` to `studentSectionPath(id, 'profile')` + return state |
| Class → Session | `class-detail.tsx` sessions tab ~362 | `navigate(/teaching/sessions/${row.id}?tab=attendance)` (hardcoded, not `links.classSession`) |
| Session → Class | `session-detail.tsx` ~270–274 | Button “Lớp học” → `navigate(/admin/classes/${classBatchId})` (hardcoded; lands on base, then redirect to `/overview`) |
| Parent → Student | `parent-detail.tsx` ~257–261 | `Link` to `links.student(studentId)` |
| Schedule → Session | `schedule-fc-events.ts` ~106 | `/teaching/sessions/${id}?tab=attendance` |
| Attendance workspace → Session | `attendance.tsx` ~287–288 | `Navigate` replace to session hub |

### Missing clicks (the complaint)

| Missing hop | Shown as | File | Notes |
|---|---|---|---|
| **Session → Student** | `fullName` `<Text>` | `pages/teaching/panels/attendance-panel.tsx` ~74–76; `assessment-panel.tsx` ~173+ (`entry.fullName` text) | `studentId` is already on the row. No `Link`/`studentSectionPath` |
| **Session → Teacher/Staff** | not rendered | `session-detail.tsx` overview KV ~215–222 | No teacher field at all |
| **Session → Parent** | not rendered | same | No guardian/parent |
| **Session class code as link** | KV value `title` (plain) | `session-detail.tsx` ~217 | Only a separate button; header title is not a link |
| **Class → Teacher/Staff** | `TeacherPicker` `<Selector>` | `class-detail.tsx` ~70–105, ~517 | `teacherAppUserId` known; no `staffProfilePath` / `links.staff` |
| **Class → Parent** | not rendered | `class-detail.tsx` roster | Roster is student-only |
| **Class → Course** | not rendered | overview KV ~490–509 | Program string only; Course has no detail URL anyway |
| **Student → Class** | `e.batchCode` text | `students/enrollment-ranges-panel.tsx` ~76–80 | `enrollmentId`/`batchCode` present; no `links.classBatch` / `classSectionPath` |
| **Student → Parent** | not rendered | `student-detail.tsx` profile KV ~161–188 | Tests carry `parentPhone` on `student.get`; UI does not show phone or `links.parentAccount` |
| **Student → Teacher / Session** | not rendered | same + enrollments tab | Enrollments tab is unit-grant workspace, not a class/session index |
| **Parent → Class / Teacher / Meeting** | not rendered | `parent-detail.tsx` | Children only. Meetings live on `/crm/post-sale-meeting` with no back-link from parent |
| **Staff → Class / Session / Student** | not rendered | `pages/hr/staff/*` | Profile/access/activity only. No taught-classes or roster |
| **ParentMeeting → Student** | `data.studentName` text | `parent-meeting-detail.tsx` ~126–127 | Title + strip; no `links.student` |
| **Receipt → Student / Class / Parent** | names/codes text | `receipt-detail.tsx` ~281–282, ~668–672 | `studentName`, `parentPhone`, `classBatchCode`/`classBatchId` all non-links |
| **Aftersale → Student** | `studentLabel` text | `aftersale-detail.tsx` ~139, ~170, ~251 | `studentId` available |
| **Reward → Student** | `studentId` slice(0,8) | `rewards-detail.tsx` ~210, ~316 | Has `data.studentId`, no name, no link |
| **KPI / Shift → Staff** | `fullName` text | `kpi-detail.tsx` ~278; `shifts-detail.tsx` ~382 | Person known, no `links.staff` |
| **Opportunity → Staff / Parent / Student** | assignee + contact text | `opportunity-detail.tsx` ~495, ~639, ~705 | Lead is not a ParentAccount/Student record yet; assignee is AppUser |

---

## Per-entity notes (source, not the 08-17 inventory)

### Staff
- Canonical: `links.staff` = `/hr/staff/:id`; durable work is `/profile` `/access` `/activity` (`hr.routes.tsx` 156–213).
- Inbound: `pages/hr/staff/index.tsx` ~172; `staff-new.tsx` ~107; `admin.routes.tsx` users redirect ~216–219; `pages/admin/audit-log.tsx` via `resolveGo` (test expects `href=/hr/staff/:uuid`).
- Gap: teaching/HR operational surfaces that already know `appUserId` never emit `staffProfilePath`.

### Student
- Sections routed explicitly (`admin.routes.tsx` 103–120). Unknown section → not-found.
- Inbound besides own list: **only** class roster + parent children.
- Enrollments section is permission-empty for anyone without `enrollment.grantUnits` — even a class code list is hidden, so sale/teacher cannot hop Student → Class from detail.

### Parent
- No section grammar. Activity is embedded, not `/activity`.
- Guardian-link **queue** on the list (`parents/index.tsx`) shows `studentName` as a column, not a student link.

### Session
- Deliberate query-tab contract (inventory: keep). Not path sections.
- Class hop exists as a **workspace button**, not as a linked identity in the header/KV. Student/teacher identity is the hole.

### Receipt activity
- `packages/links` `receiptSectionPath(..., 'activity')` and `receipt-detail.tsx` ~707–719 assume `/finance/:id/activity`.
- `finance.routes.tsx` 82–98 maps only `overview` | `order-lines`. Clicking “Lịch sử vận hành” leaves the registered routes.

### Course / Facility
- Config catalogs (inventory already said this). No first-class detail, no `/go` key — so no outbound target for Class → Course or Staff → Facility.

---

## Highest-leverage missing links (if a follow-up is scoped)

1. **Session attendance/assessment names → student profile** — `studentId` already in panel rows.
2. **Class teacher control → staff profile** — `teacherAppUserId` already loaded; keep picker, add a name `Link`.
3. **Student enrollments → class overview** — `batchCode` already rendered; needs `classBatchId` on the list payload if not already returned.
4. **Student profile → parent** — only if `student.get` exposes `parentAccountId` (phone alone is not a stable hop).
5. **Receipt / aftersale / parent-meeting / reward student fields → `links.student`**.
6. **KPI / shift person → `links.staff`**.
7. Register `/finance/:id/activity` or stop linking it.

Items 1–3 are the user’s session/class/student/teacher/parent complaint.
