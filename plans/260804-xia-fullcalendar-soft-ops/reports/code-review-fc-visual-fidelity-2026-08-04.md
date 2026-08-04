# Code review: FullCalendar adoption & visual fidelity

**Date:** 2026-08-04  
**Scope:** Teaching schedule calendar vs https://github.com/fullcalendar/fullcalendar (v6.1.21 packages)  
**User ask:** Đã lấy FC chưa? Cần **layout/bo góc/trải nghiệm y hệt** FC.

---

## Verdict

| Question | Answer |
|----------|--------|
| Đã dùng FullCalendar engine? | **Có** — `@fullcalendar/react` + daygrid/timegrid/list/interaction |
| Đã “y hệt” trải nghiệm UI FC demo? | **Chưa** — B-lite **cố ý Soft Ops skin** + bớt chrome FC |
| Engine match | **~85%** (views, toolbar core, grid) |
| Visual/layout match | **~40–50%** (màu Soft Ops, radius 12/16, dual toggle, ẩn view buttons) |

**Overall residual for “y hệt UX”:** High on chrome/skin; medium on data grain (batch all-day).

---

## What was adopted (evidence)

| Piece | Status | Path |
|-------|--------|------|
| FC packages | Yes 6.1.21 | `apps/admin/package.json` |
| Wrapper | Yes | `soft-ops-fullcalendar.tsx` |
| Skin CSS | Yes (Soft Ops, not FC default) | `soft-ops-fullcalendar.css` |
| Wire schedule week/month | Yes | `schedule.tsx` → `dayGridWeek` / `dayGridMonth` |
| Events | Yes | `classBatchToEvents` all-day batches |
| Drag | Off by design | `editable={false}` |

---

## Diff vs FullCalendar **standard** experience

FC v6 injects defaults (from core `internal-common` CSS):

| Token / chrome | FullCalendar default | CMC `.ck-fc` now | Match? |
|----------------|----------------------|------------------|--------|
| Button radius | **0.25em** (~4px) | **12px** Soft Ops | No |
| Event radius | near-square / slight | **8px** | No |
| Wrapper shell | flat page bg | **16px card** + shadow + pad | No |
| Buttons | slate `#2c3e50`, white text | white/muted Soft Ops | No |
| Events | solid `#3788d8` white text | muted brand chip | No |
| Today | yellow `rgba(255,220,40,.15)` | brand-muted blue | No |
| Toolbar title | **1.75em** | 1.05rem | No |
| Header toolbar right | **view switchers** month/week/day/list | **empty** (`right: ''`) | No |
| External Soft Ops view icons | n/a | **parallel** `ck-view-toggle` | Dual chrome |
| Week view | often **timeGridWeek** (hour lanes) | **dayGridWeek** only | Partial |
| Drag / resize | common in demos | disabled | Partial (B-lite) |

### Code smells

1. **Dual navigation** — Soft Ops icon toggle + FC prev/next; FC view buttons stripped → not classic FC header.  
2. **Skin fights FC** — every radius/color override moves away from “y hệt”.  
3. **No `eventContent` SessionCard** — plan mentioned it; not shipped (actually helps FC-native if we keep default event chips).  
4. **Data not session-time** — even perfect FC chrome still feels empty without timed events.

---

## Severity findings

| ID | Sev | Finding | Fix direction |
|----|-----|---------|---------------|
| V1 | **High** | Soft Ops radius/shell overrides break FC layout language | Restore FC default CSS vars + button 0.25em; drop outer 16px “cardification” |
| V2 | **High** | Missing FC built-in view buttons | `headerToolbar.right = 'dayGridMonth,dayGridWeek,timeGridWeek,listWeek'` |
| V3 | **Medium** | Dual Soft Ops view toggle confuses “y hệt” | Prefer FC toolbar as primary; Soft Ops toggle optional for list/kanban only |
| V4 | **Medium** | dayGridWeek ≠ timeGrid demo | Add timeGridWeek in FC right toolbar (even if all-day looks sparse) |
| V5 | **Low** | Title size / toolbar spacing | Match FC 1.75em / margin-bottom 1.5em |
| V6 | **Info** | Batch all-day data | Separate product gap |

---

## Recommendation (implemented next)

**Mode: FC-native fidelity** on calendar surface (user request overrides B-lite Soft Ops skin for chrome):

1. Reset CSS to FC standard tokens (slate buttons, blue events, yellow today, 0.25em radius).  
2. Restore full FC headerToolbar (left nav · center title · right views).  
3. Soft Ops ListPage shell stays outside; calendar body looks like FC.  
4. Keep list/kanban Soft Ops; week/month/time/list calendar via FC only.  
5. Keep editable false until API exists.

---

## Checks a–e (cook residual)

| Check | Result |
|-------|--------|
| (a) Acceptance “use FC engine” | Met |
| (a′) Acceptance “y hệt visual” | **Not met** before fix |
| (b) Business logic | Adapter + click-through OK |
| (c) Public API | Admin-local only |
| (d) Patterns | Dual chrome smells |
| (e) Honesty | Callout still honest about batch grain |
