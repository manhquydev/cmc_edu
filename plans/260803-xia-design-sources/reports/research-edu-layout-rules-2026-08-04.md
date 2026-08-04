# Education layout rules — CMC EDU surfaces

**Date:** 2026-08-04 · **Role:** layout research (read-only)  
**Sources:** `pages/attendance.md`, `cockpit.md`, `list-ops.md`; `SessionCard`/`WeekSchedule`; `VIEW-GRAMMAR.md`, `MASTER.md`; `calendar-field-hierarchy.md`, `research-education-calendar-ui.md`, `unified-component-structure-system.md`.

---

## 1. Calendar / week vs list-ops

| Use | When | Frame |
|-----|------|--------|
| **Agenda / list-ops** | “Do work now”: attendance, queues, finance, CRM, class lists | `ListPage` + ControlBar + table/rows |
| **WeekSchedule + SessionCard** | Time-bound teaching: today/week sessions, room/teacher conflict | `ListPage` + `WeekSchedule` (VIEW-GRAMMAR calendar) |
| **Month** | Horizon only | Secondary; never default for GV daily ops |

**Rule:** session grain (ClassSession), not ClassBatch-by-month. Industry + local research: **agenda default for ops speed**; week grid toggle for GĐĐT room/conflict. Both share one `SessionCard` atom. Kanban is wrong metaphor for time-bound sessions.

**Ranked:** A agenda-first + week toggle → B week-primary (planner only) → C month/batch (do not invest).

---

## 2. Session card field hierarchy (P0–P3)

| Tier | Field | Compact (week) | Default (month/list) |
|------|--------|----------------|----------------------|
| **P0** | `timeLabel` | short / ellipsis | full short form |
| **P0** | `title` (class code) | always, 1 line | always |
| **P0** | `status` chip | always (+ label, not color alone) | always |
| **P0** | `actionLabel` CTA | if href; spacer if none | same |
| **P1** | `subtitle` (CTĐT) | 1 foot via `footPriority` | own line |
| **P2** | `meta` (phòng · GV) | foot or skip (`actionable` prefers meta) | own line |
| **P3** | `detail` (full range, ids, notes) | tooltip only | tooltip only |

Fixed slot geometry; multi-line wrap that breaks equal height = reject. Live/today incomplete attendance → CTA **Điểm danh** → `/teaching/attendance?session=`.

---

## 3. Attendance touch density vs desktop finance tables

| Surface | Density | Hit target | Notes |
|---------|---------|------------|--------|
| Attendance roster | touch override always | **≥44×44** cycle status | labels + color; no silent whole-class present |
| Week schedule cells | `compact` | CTA min 44px on tablet path | 1 secondary foot line |
| Finance / CRM / users tables | `compact` / ListPage `ops` | desktop **≥32px**; 44px if touch primary | sticky header, FilterBar always, overflow row actions |
| Cockpit | comfortable metrics + dense queue | chips 34px | queue is ops, not marketing air |

Touch is a **target override**, not a fourth layout language (unified structure). Density changes pad + secondary line count only — not brand, radius, or type roles.

---

## 4. Parent/LMS vs staff admin — diverge / share

| Shared (must) | Diverge |
|---------------|---------|
| Tokens (`--cmc-*`), one brand blue, StatusBadge semantics, Inter, warm canvas | Shell: admin `AppFrame`+SideNav vs LMS mobile frame |
| Raised surface recipe, StatusBadge soft + text, EmptyState anatomy | Page frames: admin 4 frames; LMS mobile-first, separate (YAGNI keep separate) |
| `SessionCard` vocabulary if parent sees schedule | Density default: admin soft-ops compact; LMS more comfortable, fewer columns |
| Vietnamese status labels | Nav, task queues, bulk/table ops = admin only |
| Deep-link contracts (`?session=`) when same entity | Parent: read visibility (attendance/submission); staff: mutate + queues |

Do not fork a second CSS stack or second status color system for LMS.

---

## 5. Anti-patterns (edu ops)

1. Marketing sparsity (48–64 section gaps, 16 body everywhere) on ops screens  
2. Photo-first / Airbnb cards; Cal.com orange slots; dual brand accents  
3. Month/batch as teacher default; kanban as primary schedule  
4. Color-alone status; whole-cell solid brand wash  
5. Silent whole-class present; primary save on tiny control; no unmarked count  
6. CTA without `?session=`; hide CTA on live sessions  
7. UUID/teacher id as primary text; full ISO range in compact week cells  
8. Display 40px marketing titles in admin; empty queue without CTA  
9. Full-bleed single empty metric bar; custom page outside `DashboardPage`/`ListPage`  
10. Shadow on table rows; rainbow metrics

---

## 6. Seven layout rules for CMC education surfaces

1. **One OS, four frames** — Dashboard / List / Detail / Form only; modules change data + perms, not chrome.  
2. **Grain matches job** — sessions for teaching time; list-ops for money/CRM/HR entities.  
3. **Agenda does work; week shows conflict** — default agenda for GV; week toggle for planners.  
4. **P0 always visible** — time · title · status · next action; P3 hover only.  
5. **Density by surface, touch by target** — compact tables/week; 44px attendance & mobile interactives.  
6. **One primary CTA per card/header** — ops verb (Điểm danh / Tạo…); overflow for rare actions.  
7. **Shared tokens + cards; split shells** — admin desktop dense ERP vs LMS mobile parent; same brand system.

---

## Trade-off (layout modes)

| Mode | Ops speed | Conflict view | Mobile/tablet | Maint. | Rank |
|------|-----------|---------------|---------------|--------|------|
| Agenda + week toggle + SessionCard | Best | Good | Best | Medium | **1** |
| Week grid primary | Medium | Best | Poor | Higher | 2 (planner) |
| List-ops only (no calendar) | Good for non-time | N/A | Good | Low | Use for finance/CRM |
| Month/batch cards | Weak for today | Poor | Medium | Low | Reject as teaching default |

**Adoption risk:** Low for Agenda+SessionCard (already in `@cmc/ui`). Medium if week grid needs overlap engine. LMS frame separate is locked (MASTER, STYLING-BRIDGE).

**Architectural fit:** Soft-ops density, Astryx+`@cmc/ui`, facility RLS session lists, attendance deep-link contract.

---

## Limitations

- No live teacher UAT pixel audit of SIS tools.  
- LMS parent mobile frames intentionally out of admin structure scope.  
- Week-start (Mon VN vs Sun) unresolved in prior research.

## Unresolved

1. GĐĐT week-grid v1 vs agenda-only pilot?  
2. `ListPage density="ops"` rename to `compact` forever?

**Status: DONE**
