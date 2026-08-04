# Multi-agent code review — ClassSession timed calendar

**Date:** 2026-08-04  
**Plan:** `plans/260804-calendar-session-timed-gap`  
**Review target:** API `listInRange` + adapter + schedule week/month wire + tests  
**Method:** 4 parallel specialized `code-reviewer` agents (read-only)

| Agent | Scope | Verdict |
|-------|--------|---------|
| API | `classSession.listInRange` | **APPROVE_WITH_NITS** |
| Frontend | schedule + FC adapter | **REQUEST_CHANGES** |
| Security | authz / tenancy / XSS | **APPROVE_WITH_NITS** |
| Tests | verification honesty | **REQUEST_CHANGES** |

**Orchestrator rollup:** **REQUEST_CHANGES** — one Critical UX defect on range navigation; security/API core sound.

---

## Critical (must fix before treating feature as done)

### C1. `loading={isLoading}` unmounts FullCalendar on every range refetch

**Agents:** Frontend (Critical #1), Tests (related mock gap)  
**Evidence:**
- `schedule.tsx` passes `loading={isLoading}` from `listInRange`
- `soft-ops-fullcalendar.tsx` early-returns a loading div (destroys FC instance)
- Query key `{from,to}` changes on `datesSet` / prev-next → React Query v5 treats as new pending query without `placeholderData` → `isLoading=true`

**User impact:** Click next week/month → flash “Đang tải lịch…” → remount with only `initialView` (no `initialDate`) → **snaps back toward today**. First paint also double-fetches (default ±~2 months then datesSet shrinks).

**Fix direction:**
1. Do **not** unmount FC for range refetch (`isLoading` only for first empty load, or never).
2. Prefer `isFetching` overlay / opacity while calendar stays mounted.
3. `placeholderData: (prev) => prev` (RQ v5) to keep prior events during key change.
4. Optionally seed range from first `datesSet` only (skip wide default fetch).

---

## Important

| ID | Source | Finding |
|----|--------|---------|
| I1 | Frontend | `classBatch.list` error gates week/month (`!error?.message && view === 'week'`) even though calendar uses sessions only |
| I2 | Frontend | Always fetches `classBatch.list` on calendar views — waste + couples error UI; prefer `enabled: list \|\| kanban` |
| I3 | Frontend / Tests | `datesSet` exclusive→inclusive + thrash string-compare untested (FC fully mocked) |
| I4 | Frontend | `from`/`to` via browser-local `toDateOnly`; API is ICT inclusive — OK for VN admins; off-by-one risk for non-ICT browsers |
| I5 | API / Security / Tests | Cross-facility isolation for `listInRange` not tested (pattern solid, proof missing) |
| I6 | API | No hard `take` row cap inside 120-day window (date DoS mitigated; dense facility volume residual) |
| I7 | Tests | UI only asserts event **count**, not timed `allDay`/ISO/`href` dual params or navigate wire |

---

## Nits (non-blocking)

- Prefer Prisma `select` matching DTO over full session row + map
- Secondary `orderBy` tie-break (`id`) for stable sort
- Defense-in-depth: `classBatch: { facilityId, courseId }` nest; `href.startsWith('/')` before navigate
- Zod bad date/uuid + FORBIDDEN without `class.read` tests
- Adapter edges: missing `batchCode` fallback, `start===end`
- Phase checkbox hygiene vs status completed

---

## Security (accepted residuals)

| Residual | Why accepted |
|----------|----------------|
| sale/GĐKD see facility-wide timed schedule | Same `class.read` as `classBatch.list` / `classSession.list` |
| Large payload within 120 days | Index + day cap; not unbounded date scan |
| DTO has teacherId/code/program | Ops metadata already on batch list; no child roster PII |

No Critical security finding. Cross-facility dual gate (`scoped` + `withFacility` + `where.facilityId`) verified by static review. Cancelled sessions excluded default + client + attendance gate.

---

## Spec compliance

| Plan success criterion | Status |
|------------------------|--------|
| `listInRange` + class.read + denorm | **Met** (API) |
| Timed adapter + `?classBatch=&session=` | **Met** (adapter unit) |
| datesSet-driven range | **Implemented, UX broken by C1** |
| Cancelled default exclude | **Met** |
| Targeted tests green | **Green but incomplete proof** for UI wire |

---

## Recommended fix order

1. **C1** — stop unmounting FC on range fetch; keepPrevious/placeholderData  
2. **I1+I2** — decouple calendar mount/error from `classBatch.list`  
3. **I3+I7** — schedule tests: expose events props + call `onDatesSet` + thrash guard  
4. **I5** — API cross-facility isolation test  
5. Nits as follow-ups

---

## Agent raw verdicts

- API: `APPROVE_WITH_NITS` — no critical logic hole  
- Frontend: `REQUEST_CHANGES` — C1 blocks honest “done”  
- Security: `APPROVE_WITH_NITS`  
- Tests: `REQUEST_CHANGES` — false confidence on datesSet/deep-link UI  

**GitNexus note:** `detect_changes(scope=all)` on this branch is **noisy** (entire Soft Ops branch, risk_level critical from unrelated UI churn). Scope review intentionally limited to timed-calendar files, not whole branch.
