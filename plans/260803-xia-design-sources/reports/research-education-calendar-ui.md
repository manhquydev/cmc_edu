# Research: Education / Class Schedule Calendar UI (2024–2026)

**Date:** 2026-08-03  
**Scope:** CMC EDU admin teacher/ops schedule — week/day agenda, session cards, attendance deep-links. **Not** consumer booking (Airbnb/Cal.com public book page).  
**Product locks:** brand `#0071E3` · warm canvas `#f5f3ee` · radius 12/16/20 · Inter · light-only · one interactive blue · soft-ops density · Astryx + `@cmc/ui` only (no shadcn/Tailwind DS).  
**Domain authority:** `SessionStatus` = `planned | confirmed | cancelled | done` (`packages/db/prisma/schema.prisma`); attendance deep-link contract `/teaching/attendance?session={id}` (`docs/06-kien-truc-url-routing.md`); known gap: no in-app link carries `?session=` (acceptance flow-manifest).

---

## Executive summary

**Ranked pick: Approach A — Agenda-first week + compact day strip, with session cards that deep-link attendance.**

School ops calendars (PowerSchool-style staff, Canvas instructor calendar, Google/Outlook week+agenda) converge on:

1. **Time is primary axis** (not month-of-batch cards — current `schedule.tsx` calendar view is batch-by-month, wrong grain for daily teaching ops).
2. **Status is badge/dot + soft fill**, never a second brand hue (Primer status rule; TL12 §3; CMC one-blue lock).
3. **Primary CTA on card = next ops action** (điểm danh / xác nhận / xem bằng chứng), not “open booking.”
4. **Week grid alone fails on mobile/tablet and on multi-room facilities** — agenda list wins density + scan for “what do I do now?”; week grid wins spatial conflict awareness for GĐĐT/room planning.

**Do not** transplant Cal.com orange slots, Airbnb photography cards, or full-month consumer calendars. **Do** borrow: Google/Outlook “now” line + agenda; Linear-style dense rows; Primer empty-state anatomy; Cal.com time-block density (recolored to brand-muted).

---

## Methodology

| Item | Value |
|------|--------|
| Sources consulted | 8+ independent (project tokens + schema + 3 local DESIGN extracts + Primer empty states + M3 lists/date-pickers + Google Calendar help patterns + prior xia compare report) |
| Web budget | ≤5 targeted fetches (M3, Primer empty, Apple HIG calendars, Notion calendar, Google Calendar help) — several JS-gated; patterns cross-checked vs local extracts + product code |
| Date range | Product patterns 2022–2026; CMC tokens/status locked 2026-07/08 |
| Search terms | SIS class schedule week view, Material calendar event colors, Cal.com calendar UI, school timetable agenda vs grid, Linear density status, Canvas instructor calendar |

**Credibility weighting**

| Source | Credibility | Weight for CMC |
|--------|-------------|----------------|
| CMC `tokens.css` + TL12 + SessionStatus schema | Authoritative product | **Highest** |
| Primer empty states (official) | High — a11y + ops products | High for empty/loading copy structure |
| Google Calendar / Outlook week+agenda (de facto SIS staff tools) | High for interaction model | High for layout |
| Cal.com DESIGN extract (local) | Medium — booking product | Partial: time blocks only; **skip** orange accent |
| GitHub Primer density/status | High for dense professional UI | High for status chips, not calendar chrome |
| Canvas LMS instructor calendar | Medium-high domain fit | High for education semantics (class vs personal events) |
| ClassDojo / Brightwheel / Teachable admin | Medium (closed SaaS screenshots) | Low-medium — confirm “ops list + day focus,” not unique chrome |
| Airbnb / consumer booking | Low for ERP | **Skip** |

---

## Key findings

### 1. Product grain: session, not class-batch

Current admin “Lịch” (`apps/admin/src/pages/teaching/schedule.tsx`) groups **ClassBatch** by start month. Teaching ops need **ClassSession** rows: date + slot time + room + teacher + status + attendance completeness.

US-UI-05 contract already says: “calendar view (week/month) + list view of **class sessions**.” Implementation lag is a redesign target, not a product decision.

### 2. Layout patterns in market (compressed)

| Pattern | Used by | Strength | Weakness for CMC |
|---------|---------|----------|------------------|
| **Week time-grid** (cols = days, rows = hours) | Google Calendar, Outlook, Canvas, Cal availability | Room/time conflict visible; “now” line | Crowded with many short sessions; poor on narrow tablet; hard with multi-teacher filters |
| **Agenda / schedule list** (day sections → session rows) | Outlook Agenda, Apple list, Linear-like issue lists, ClassDojo staff day | Fast scan, clear CTA, mobile-native | Weak spatial conflict view |
| **Day column strip + detail** | Outlook Day, Notion Calendar day focus | Deep ops on one day | Needs strong week navigation |
| **Month heatmap** | Google month, PowerSchool month | Planning horizon | Useless for attendance CTA; keep as secondary |
| **Kanban by status** | Current schedule.tsx | Status overview | Wrong metaphor for time-bound sessions; demote or drop for teaching schedule |

**Industry consensus 2024–26 (ops tools):** default **list/agenda for “do work”**, toggle **week grid for “plan/conflict”**. Both share one session-card atom.

### 3. Color semantics — map domain → tokens

TL12: brand blue = interactive only; green = success; amber = warning/wait; red = true danger; grey = neutral. Primer: never color-alone — icon/label + color.

**Session visual states for CMC** (UI composite states, not new DB enums):

| UI state | Domain signal | Color role | Fill / chrome | Badge label (vi) |
|----------|---------------|------------|---------------|------------------|
| **Upcoming** | `planned` / `confirmed`, start > now + buffer | Neutral surface + muted left rail | white card, hairline border, left rail `--cmc-border` or brand-muted 3px | `Sắp tới` / `Đã xác nhận` |
| **Live / now** | start ≤ now < end, status ≠ cancelled | **Brand interactive** | soft `--cmc-brand-muted` fill, 3px brand left rail, optional pulse dot | `Đang học` |
| **Done (complete)** | `done` | Success | `--cmc-success-soft` tint optional, success badge | `Hoàn tất` |
| **Done shell / past incomplete** | past end, status still planned/confirmed, attendance missing | **Warning** | `--cmc-warning-soft` fill, warning badge | `Thiếu điểm danh` |
| **Cancelled** | `cancelled` | Neutral struck + danger badge only | grey text, line-through title optional, no red fill wash | `Đã huỷ` |
| **Makeup** | `isMakeup` | Info/brand-muted chip, not new hue | pill `Học bù` on meta row | `Học bù` |

**Hard rules**

- Do **not** paint whole grid cells solid brand (Cal orange anti-pattern for CMC).
- Live = only place full brand soft wash is allowed on calendar surface.
- Missing attendance = **warning**, not danger (recoverable ops debt; danger reserved for cancel confirm / IP block errors).
- Cancelled never uses danger fill on card body (red wash = alarm; cancel is terminal history).
- Color + text + optional icon (clock / check / alert) — WCAG non-color cue.

### 4. Session card anatomy

Borrow dense row (Linear/GitHub TaskRow) + calendar chip (Google short event) hybrid:

```
┌─────────────────────────────────────────────────────────────┐
│ ▌ 08:00–09:30          [Đang học]              [Điểm danh →]│
│ ▌ CMCDEVEL-UCREA-002 · Buổi 12                              │
│ ▌ Phòng A2 · GV Lan · 18 HV                                  │
└─────────────────────────────────────────────────────────────┘
  ^left rail (state)   title/meta denser     primary CTA
```

| Slot | Content | Type | Notes |
|------|---------|------|-------|
| **Left rail** | 3px state color | chrome | Live=brand, warn=amber, done=success, cancel=border, upcoming=border |
| **Time** | `HH:mm–HH:mm` | 13px tabular / medium | Primary sort key; Inter tabular-nums |
| **Status badge** | soft badge | StatusBadge | Map table above |
| **Title** | class code + session index | 14px semibold | e.g. `CMCDEVEL-… · Buổi 12` |
| **Meta** | room · teacher · headcount · unit short name | 12px muted | Single line ellipsis |
| **CTA** | context action | Button sm / text link | See matrix |
| **Secondary** | overflow menu | icon button | Huỷ / makeup / evidence — not competing with attendance |

**CTA matrix (ops-first)**

| Condition | Primary CTA | Target |
|-----------|-------------|--------|
| Live or today + not cancelled + attendance incomplete | **Điểm danh** | `/teaching/attendance?session={id}` **required** |
| Past + missing attendance | **Bù điểm danh** (same route) | same deep-link |
| Done | **Xem buổi** / evidence | session detail |
| Cancelled | no primary CTA | meta only |
| Future confirmed | **Chi tiết** or none | detail; avoid fake urgency |

**Touch:** primary CTA min height 44px on tablet (attendance path) — already TOUCH_MIN in STYLING-BRIDGE.

### 5. Empty / loading / error states

Primer Blankslate anatomy (port structure, not Octocat):

| State | Primary text | Secondary | Action |
|-------|--------------|-----------|--------|
| **Empty week (no sessions)** | “Tuần này chưa có buổi học” | “Sinh lịch từ lớp đang mở, hoặc đổi tuần.” | `Tạo / sinh lịch` → class batch schedule generate (role-gated) |
| **Empty filtered** | “Không khớp bộ lọc” | “Xóa GV / phòng / trạng thái.” | `Xóa lọc` |
| **No sessions today (agenda default)** | “Hôm nay trống lịch” | Show next upcoming session teaser | `Tuần này` jump |
| **Loading** | skeleton | — | **Not** spinner-only: 7-col week skeleton **or** 5–8 agenda row skeletons (match target view) |
| **Error** | “Không tải được lịch” | short reason | `Thử lại` — no delight graphic |

Loading: reuse existing `Skeleton` grid pattern in schedule.tsx, but skeleton **session rows** (height ~64–72px, radius 16) not 28 month cells.

### 6. Density + warmth (soft-ops)

| Lever | Consumer calendars | CMC target |
|-------|-------------------|------------|
| Row height | 48–64 sparse | **56–64** agenda row; week cell min ~22px/30min |
| Radius | 4–8 sharp (GH) or 32 pill (Airbnb) | **card 16** session; control **12** filters; dialog **20** |
| Canvas | cool gray / pure white | **warm `#f5f3ee`**; cards white raised |
| Type | 16 body | **14 body / 13 data / 12 meta / 11 column** |
| Elevation | heavy float | hairline + `--cmc-shadow-sm` on raised only |
| Icons | emoji / filled | monochrome `LineIcon` outline only |

---

## Trade-off matrix

| Dimension | A Agenda-first + week toggle | B Full week grid primary | C Month + list only |
|-----------|------------------------------|--------------------------|---------------------|
| **Ops speed (attendance)** | **Best** — CTA per row | Medium — click into cell first | Weak for “today” |
| **Conflict / room planning** | Good with week toggle | **Best** | Poor |
| **Mobile / teacher tablet** | **Best** | Poor without redesign | Medium |
| **Impl complexity** | Medium (two views, one atom) | Higher (overlap layout, drag later) | Lowest but wrong grain |
| **Match US-UI-05** | Strong | Strong if session-grain | Weak week missing |
| **Fit CMC tokens/composites** | TaskRow/Panel/Badge native | New grid composite | ListPage only |
| **Risk of wrong default** | Low if default=today agenda | High for GV daily path | High (current gap) |
| **Maintenance** | One `SessionCard` shared | Grid-specific bugs | Low |

---

## Ranked approaches

### Approach A — **Recommended** · Agenda-first week + day focus

**Shape**

1. Default view: **Hôm nay / agenda list** (sessions sorted by start), sticky day headers for multi-day range.
2. Toggle: **Tuần** (time-grid, Mon–Sun or facility week start) · optional **Tháng** later (YAGNI until room planning asked).
3. Filters in URL: teacher, room, classBatch, status (TL6 FilterBar).
4. Shared `SessionCard` / dense `TaskRow` variant; primary CTA always carries `?session=`.
5. “Now” line on week grid + “Đang học” section pin on agenda.
6. Drop kanban from teaching schedule (or bury under admin debug) — status filter chips replace it.

**Why #1:** Matches teacher daily job (điểm danh), fixes acceptance deep-link gap, reuses `@cmc/ui` density patterns, warm soft-ops look without consumer chrome.

**Adoption risk:** Low–medium. Need session list API grain (if only batch list today). No new design system. Kanban removal may surprise if anyone relies on it (currently batch status, not session).

### Approach B — Week grid primary (Google/Canvas clone)

Full time-grid default; agenda secondary.

**When better:** GĐĐT / facility manager planning rooms all day.  
**Why not default:** Teacher tablet path is list+CTA; overlap algorithms + empty hour chrome cost more; fights soft-ops warmth if over-chrome’d.

**Adoption risk:** Medium–high (layout engine, a11y for dense cells, mobile collapse rules).

### Approach C — Month cards + batch list (status quo evolution)

Keep month batch cards; add session drawer.

**Why last:** Wrong entity grain; does not fix attendance deep-link from schedule; US-UI-05 already specified session calendar.

**Adoption risk:** Low eng cost, high product debt.

---

## CSS token proposals (compatible with existing system)

Add only **calendar-scoped** aliases; do not invent second palette. Prefer mapping to existing soft pairs.

```css
/* packages/ui/src/tokens.css — calendar / session schedule roles
 * All values reference existing CMC tokens. No new brand hues.
 */
:root {
  /* Surfaces already locked */
  /* --cmc-canvas: #f5f3ee; --cmc-brand: #0071e3; radius 12/16/20 */

  /* Session state → soft fills (badge/card wash) */
  --cmc-session-upcoming-bg: var(--cmc-surface-raised);      /* #fff */
  --cmc-session-upcoming-rail: var(--cmc-border);             /* #e0ddd5 */
  --cmc-session-live-bg: var(--cmc-brand-muted);              /* #e8f1fc */
  --cmc-session-live-rail: var(--cmc-brand);                  /* #0071e3 */
  --cmc-session-live-ink: var(--cmc-brand-ink);               /* #003d99 */
  --cmc-session-done-bg: var(--cmc-success-soft);             /* #e6f2e9 */
  --cmc-session-done-rail: var(--cmc-success);                /* #2e7d32 */
  --cmc-session-miss-bg: var(--cmc-warning-soft);             /* #faf0df */
  --cmc-session-miss-rail: var(--cmc-warning);                /* #b26a00 */
  --cmc-session-cancel-bg: var(--cmc-neutral-soft);           /* #f0ede7 */
  --cmc-session-cancel-rail: var(--cmc-border);
  --cmc-session-cancel-ink: var(--cmc-text-muted);

  /* Grid chrome */
  --cmc-cal-grid-line: var(--cmc-border-subtle);              /* #efece6 */
  --cmc-cal-now-line: var(--cmc-brand);
  --cmc-cal-now-dot: var(--cmc-brand);
  --cmc-cal-hour-label: var(--cmc-text-muted);
  --cmc-cal-today-col: color-mix(in srgb, var(--cmc-brand-muted) 55%, transparent);

  /* Card geometry */
  --cmc-session-card-radius: var(--cmc-radius-card);          /* 16px */
  --cmc-session-card-pad-y: 10px;
  --cmc-session-card-pad-x: 12px;
  --cmc-session-rail-width: 3px;
  --cmc-session-row-min-height: 56px;
  --cmc-session-cta-min: 44px; /* tablet attendance */

  /* Type (Inter already) */
  --cmc-session-time-size: var(--cmc-font-size-data);         /* 13px */
  --cmc-session-title-size: 14px;
  --cmc-session-meta-size: var(--cmc-fs-meta);                /* 12px */
}
```

**Badge mapping (StatusBadge variants already in UI)**

| UI state | Badge variant |
|----------|---------------|
| upcoming planned | `neutral` |
| confirmed | `blue` / info soft |
| live | `blue` + live bg |
| done | `success` |
| missing attendance | `warning` |
| cancelled | `error` label only on badge; card neutral |

**Component placement (YAGNI order)**

1. `SessionCard` composite in `@cmc/ui` (props-only) — or extend `TaskRow` with `railTone` + `time` slot.
2. `ScheduleAgenda` page section in admin (not new DS framework).
3. `ScheduleWeekGrid` phase 2 if room conflict UI requested.
4. No fullcalendar/react-big-calendar unless grid complexity forces it — prefer CSS grid + absolute slots for ≤50 sessions/week (KISS).

---

## Architectural fit

| Constraint | Fit of Approach A |
|------------|-------------------|
| Facility-scoped RLS sessions | List by `facilityId + date range` — existing indexes `facilityId, sessionDate` |
| Soft-ops premium layer | Panel + TaskRow + Badge + EmptyState + ListPage header |
| Attendance IP tablet | Deep-link + 44px CTA; schedule is entry, attendance owns form |
| Solo + AI codegen | One shared card atom reduces drift; tests on CTA href contract |
| No second CSS stack | Tokens only under `--cmc-*` |

**Blast radius if implemented later:** `schedule.tsx`, teaching routes, possibly new `session.listByRange` tRPC, cockpit shortcuts, e2e journey for `?session=` (currently missing).

---

## Implementation recommendations (for implementer — not this research)

### Quick start (phase-sized)

1. Switch schedule data grain to **sessions** in date range (default: current week).
2. Ship agenda list + `SessionCard` with CTA → `/teaching/attendance?session=`.
3. Status mapping table + CSS vars above.
4. Empty/loading per Primer structure, Vietnamese copy.
5. Week grid as second toggle only after agenda green on CI.

### Common pitfalls

| Pitfall | Avoid |
|---------|--------|
| Color-only status | Always badge text |
| Brand red for “current stage” | Live = brand blue soft, not danger |
| Orange Cal.com slots | brand-muted only |
| Month-first default | Teachers need today |
| CTA without session id | Breaks acceptance + tablet flow |
| Drag-reschedule v1 | YAGNI — generateSessions is source of truth |
| Kanban as primary | Time-bound domain ≠ board |

### Session card pseudo-structure

```tsx
// Conceptual — props-only composite
<SessionCard
  start={...} end={...}
  classCode="CMCDEVEL-UCREA-002"
  sessionIndex={12}
  room="A2"
  teacher="Lan"
  state="live" | "upcoming" | "done" | "miss_attendance" | "cancelled"
  isMakeup={false}
  primaryAction={{ label: "Điểm danh", href: `/teaching/attendance?session=${id}` }}
/>
```

---

## Comparative notes (sources → port/skip)

| Source idea | Verdict | CMC mapping |
|-------------|---------|-------------|
| Google/Outlook agenda + week toggle | **Port** | Default agenda |
| Google “now” red line | **Adapt** | brand now-line, not red |
| Canvas class vs personal calendars | **Adapt** | filter by classBatch/teacher; no personal calendar v1 |
| Cal.com availability blocks | **Adapt** | density of time blocks; **skip** orange |
| Linear dense rows + status | **Port** | TaskRow/SessionCard |
| Primer empty states | **Port** | EmptyState title/desc/CTA |
| Primer purple “done/merged” | **Skip** | use success/neutral |
| Airbnb photo cards | **Skip** | — |
| Shopify admin density | **Port** | 14px body, functional whitespace |
| PowerSchool mega-grid | **Skip** as default | optional week for planners |
| ClassDojo warm staff day list | **Adapt** | warmth via canvas, not cartoon |

---

## Limitations

- Live screenshots of PowerSchool / Brightwheel / ClassDojo admin blocked or paywalled; patterns inferred from public marketing + domain practice, not measured pixel audits.
- Apple HIG calendars + some Notion pages JS-gated; relied on well-known platform behaviors + local DESIGN extracts.
- Did not prototype overlap layout for concurrent multi-room sessions in week grid (defer to B).
- Did not audit actual `session.list*` tRPC surface completeness — implementer must verify query exists or add range list.
- UAT with real teachers not run; recommendation optimizes for documented acceptance gap (attendance deep-link) + schema lifecycle.

---

## Unresolved questions

1. Week start: Mon (VN school) vs Sun — product default?
2. Multi-facility super-admin: one calendar or facility switch only (likely switch — RLS)?
3. Should “missing attendance” be computed client-side (end < now && !attendance rows) or server field?
4. Does GĐĐT need week-grid in v1 enough to justify parallel build, or agenda-only for pilot?
5. Makeup session styling: same card + chip sufficient, or separate section “Học bù”?

---

## Resources

- CMC tokens: `packages/ui/src/tokens.css`
- TL12 semantics: `docs/12-design-system-ui.md` §3
- Routing: `docs/06-kien-truc-url-routing.md` (`?session=`)
- Session lifecycle: `packages/db/prisma/schema.prisma` `SessionStatus`
- Current UI debt: `apps/admin/src/pages/teaching/schedule.tsx`
- Prior port matrix: `plans/260803-xia-design-sources/reports/xia-compare-shopify-github-cal-airbnb.md`
- Primer empty states: https://primer.style/product/ui-patterns/empty-states/
- M3 lists: https://m3.material.io/components/lists/guidelines
- Cal.com local extract: `/home/manhquy/Downloads/design/cal.com-DESIGN.md`
- GitHub density extract: `/home/manhquy/Downloads/design/github.com-DESIGN.md`

---

## Decision (concrete)

| Rank | Approach | Use when |
|------|----------|----------|
| **1 · A** | Agenda-first + session cards + attendance deep-link; week grid toggle | **Ship this** for teaching schedule redesign |
| **2 · B** | Week grid primary | Only if room-conflict planning is pilot blocker |
| **3 · C** | Month/batch status quo | Do not invest |

**Status: DONE**
