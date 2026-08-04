# Xia: FullCalendar → CMC Soft Ops calendar

**Date:** 2026-08-04  
**Source:** https://github.com/fullcalendar/fullcalendar.git (MIT, sparse recon v7 monorepo layout)  
**Local:** CMC EDU admin teaching schedule + `@cmc/ui` WeekSchedule / SessionCard / ScheduleMonth  
**User intent:** “xia giao diện calendar… học hỏi **lấy y hệt**”  
**Mode signal:** “y hệt” ≈ copy fidelity · Soft Ops stack ≈ port/adapt  

---

## 1. Source manifest

| Field | Value |
|-------|--------|
| Repo | fullcalendar/fullcalendar |
| License | MIT (Adam Shaw) |
| Nature | Full-sized **drag & drop** JS event calendar monorepo |
| Public install path | **npm packages**, not vendor monorepo into app |
| React path | `@fullcalendar/react` + plugins (`daygrid`, `timegrid`, `list`, `interaction`, …) |
| Core product views | month dayGrid · week/day timeGrid · list · multiMonth · resources (premium plugins) |
| Theming | Plugin CSS + classic/skeleton themes; own design language (not Soft Ops) |
| Sparse sample | `/tmp/fullcalendar-src` (depth-1 sparse packages tree) |

**What “y hệt FullCalendar” means in industry practice:**  
Use **`@fullcalendar/*` runtime** so layout, toolbar, navigation, event placement, drag (if enabled) match FullCalendar.  
**Not:** copy thousands of monorepo source files into `packages/ui`.

---

## 2. Local calendar map

| Piece | Role | Limit |
|-------|------|--------|
| `SessionCard` | Session/batch tile P0–P3 | Soft Ops atom |
| `WeekSchedule` | 7 day **columns** of cards | **Not** hour grid · no drag · no now-line |
| `ScheduleMonth` | Group by month | **Not** month matrix grid |
| `teaching/schedule.tsx` | ListPage + view toggle list/week/calendar/kanban | Data = **`classBatch.list`** only (period overlap, not ClassSession clock) |
| VIEW-GRAMMAR | calendar → ListPage + WeekSchedule | Explicit |
| Design lab | “Không calendar library nặng nếu WeekSchedule đủ” | Doctrine |
| Prior research | `research-education-calendar-ui.md`: avoid FC unless grid forces it | Conflict with “y hệt” |

**Zero** calendar npm deps today.

---

## 3. Dependency matrix

| Source capability | Local equivalent | Status |
|-------------------|------------------|--------|
| dayGridMonth matrix | ScheduleMonth (grouped cards) | CONFLICT (different UX) |
| timeGridWeek hour lanes | WeekSchedule columns | CONFLICT (no hours) |
| listWeek agenda | missing as default GV path | NEW |
| headerToolbar prev/next/title/views | partial `ck-view-toggle` + no week toolbar wired | PARTIAL |
| Event chip | SessionCard | EXISTS (map as eventContent) |
| Drag/resize | — | NEW (needs API + product policy) |
| Interaction dateClick | attendance deep-link | PARTIAL |
| Soft Ops tokens | tokens.css | EXISTS |
| FullCalendar CSS | — | NEW (second visual language unless themed) |
| Session-range API | only per-batch `classSession.list` | **GAP / CONFLICT** for real grid |

---

## 4. Challenge (≥5)

| # | Question | Source answer | Local answer | Risk if wrong |
|---|----------|---------------|--------------|---------------|
| 1 | **Necessity** | Need full FC product UX | Have edu board + SessionCard; research said avoid FC | Heavy dep + dual visual system for little session data |
| 2 | **Y hệt how?** | Ship FC package | “Copy monorepo” is wrong path | Months of unmaintainable fork |
| 3 | **Overlap** | FC owns layout engine | WeekSchedule owns Soft Ops board | Two week UIs confuse staff/agents |
| 4 | **Maintenance** | Upstream FC releases | Solo+AI owns Soft Ops CSS | FC major break + theme drift |
| 5 | **Data grain** | Events with start/end datetime | Schedule uses **batch date range**, not session times | “Y hệt” grid empty/wrong until API |
| 6 | **No second DS** | FC brings its own CSS | Soft Ops forbids second toolkit | Brand/radius/type fracture |
| 7 | **Drag** | interaction plugin | No reschedule product API on schedule page | Fake editable calendar |
| 8 | **Prior doctrine** | N/A | Explicit “no heavy calendar lib” | Silent reverse of Option B/KISS |

**Critical risks count: 4** (data grain, dual DS, doctrine reverse, monorepo transplant) → **Medium–High** if naive copy.

---

## 5. Decision matrix

| # | Decision | FullCalendar way | Local way | Hybrid | Risk | **Recommendation** |
|---|----------|------------------|-----------|--------|------|---------------------|
| 1 | Delivery vehicle | npm `@fullcalendar/*` | Custom `.ck-week*` | FC package + Soft Ops CSS bridge | Med | **Hybrid package** (not monorepo) |
| 2 | Visual SoT | FC classic theme | Soft Ops tokens | Override FC CSS vars / wrapper `.ck-fc` | Med | **Soft Ops skin on FC** |
| 3 | Event atom | default event el | SessionCard | `eventContent` → SessionCard density compact | Low | **SessionCard** |
| 4 | Data | EventInput[] | classBatch.list | Map batch→all-day events **or** new session feed | **High** | Phase 0: **session-range API** or honest all-day batch events |
| 5 | Drag | editable true | none | **off** until reschedule API | High | **editable: false** v1 |
| 6 | Views | month/week/day/list | list/week/month/kanban | FC: dayGridMonth + timeGridWeek + listWeek; keep list/kanban batch | Med | **Replace week+calendar views with FC** |
| 7 | Scope LMS | N/A | separate mobile | out of scope | Low | **Admin only** |
| 8 | Deps | several plugins | zero | pin exact versions in admin package | Med | **Minimal set** react+core+daygrid+timegrid+list+interaction |

---

## 6. Three approaches (do not skip)

### A — Vendor / rewrite FC monorepo into `@cmc/ui`
- “Y hệt” source code  
- **Reject:** size, dual build, license noise, unmaintainable  

### B — Install FullCalendar React + Soft Ops theme (closest “y hệt” UX)
- Same toolbar, month grid, time grid, list as FC  
- Theme via wrapper CSS to warm canvas / brand / radius  
- SessionCard in `eventContent`  
- **Requires:** event model; drag off v1  

### C — Port FC *patterns only* into WeekSchedule/ScheduleMonth (doctrine-safe)
- Learn headerToolbar, day cell density, list agenda  
- Stay Soft Ops, no FC dep  
- **Not** “y hệt” pixel/interaction fidelity  

### D — Do nothing / status quo
- WeekSchedule + ScheduleMonth  
- Document gap  

---

## 7. Brutal honesty

User asked **“lấy y hệt”**.  
- **True y hệt interaction = Option B (npm FullCalendar).**  
- **True Soft Ops doctrine + prior research = Option C or D.**  
- Option A is never correct.

Also: even with B, calendar is **not** “y hệt teaching ops” until events are **ClassSession** with real start/end — currently **batch periods**. Shipping FC on batch-only data is a **pretty empty grid** risk.

---

## 8. Recommended path (for plan if approved)

**B-lite (Hybrid):**

1. **Phase 0 — Data honesty**  
   - Prefer: tRPC sessions-in-range for facility (or compose)  
   - Fallback v1: map classBatch → all-day events (label honestly: “khoá/lớp”, not giờ buổi)

2. **Phase 1 — Deps**  
   - `@fullcalendar/react` `@fullcalendar/core` `@fullcalendar/daygrid` `@fullcalendar/timegrid` `@fullcalendar/list` `@fullcalendar/interaction`  
   - Pin versions; MIT license notice if required  

3. **Phase 2 — Soft Ops bridge**  
   - `packages/ui` or admin: `soft-ops-fullcalendar.css` mapping FC chrome → `--cmc-*`  
   - Wrapper `SoftOpsFullCalendar` presentational component  

4. **Phase 3 — Wire `teaching/schedule`**  
   - view `week` → timeGridWeek (or keep WeekSchedule toggle “Board Soft Ops”)  
   - view `calendar` → dayGridMonth  
   - optional listWeek  
   - `editable: false`  
   - eventClick → existing attendance deep-link  

5. **Phase 4 — Tests**  
   - unit map batch/session → EventInput  
   - schedule page test mounts FC mock  
   - visual: design-lab demo panel optional  

6. **Non-goals**  
   - drag reschedule  
   - resource timeline (rooms)  
   - LMS  
   - re-skin whole Soft Ops to FC purple/blue defaults  

**Risk score residual:** Medium (dep + dual CSS) · **Critical if data grain ignored**.

---

## 9. Compare strip

| Aspect | FullCalendar | CMC today | If B-lite |
|--------|--------------|-----------|-----------|
| Month grid | dayGridMonth | ScheduleMonth groups | FC month |
| Week | timeGrid hours | 7 card columns | FC timeGrid **or** dual mode |
| Event chip | FC event | SessionCard | SessionCard in eventContent |
| Soft Ops | no | yes | CSS bridge |
| Data | events | classBatch | must upgrade |
| Drag | yes | no | off v1 |

---

## 10. Handoff

**This skill does not cook.**  
After user picks A/B/C/D (or B-lite), run plan + cook.

```text
Plan path (after approval): plans/260804-xia-fullcalendar-soft-ops/plan.md
Cook: /ak:cook plans/260804-xia-fullcalendar-soft-ops/plan.md
```

**Unresolved until approval:**  
1. Package FC (B) vs pattern-only (C)?  
2. Accept batch all-day events v1 or block until session-range API?  
3. Replace WeekSchedule or keep as alternate Soft Ops board view?
