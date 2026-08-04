# Advise: Session hub as durable platform pattern

**Date:** 2026-08-04  
**Goal:** triển khai bền vững, mở rộng tốt (not only teacher comfort)  
**Evidence:** research-260804-session-hub-long-term-architecture.md + project scout

---

## Reframing

### Problem

CMC has domain + URL law + detail frames that are **record-centric**, but **teacher day-ops UI is still function-centric**. That mismatch will keep spawning nav items and re-pick flows for every new session capability — unscalable for solo+AI maintenance and multi-year product growth.

### Exact requirements

1. Establish **Record-Centric Work Surface (RCWS)** for ClassSession as first teaching instance.
2. Resource URL: `/teaching/sessions/:id[/{tab}]` per TL06.
3. Compose panels (attendance/assessment/evidence); shell owns chrome only.
4. Keep ClassBatch detail as **admin** hub; Session detail as **execution** hub.
5. Preserve backend session-done + permissions; prefer server progress API.
6. Migrate docs (TL06/TL26) + optional ADR so authority matches code.
7. Extension rule: new session feature = tab/panel, not new sidebar module.

### Goals

- Teacher continuity today.
- Zero architecture tax when adding session-scoped features later.
- One mental model with CRM/finance/class detail hubs.
- Agent/HITL shareable session URLs (TL06 §6).

### Non-goals

- Port Odoo/OpenEduCat runtime
- God page merge of grading/exercises/batch admin
- Schema rewrite
- Big-bang delete all function pages day 1

### Constraints

Solo+AI · existing tRPC/RLS · VIEW-GRAMMAR · journey e2e budget · YAGNI/KISS/DRY

---

## Verdict

**Build the Session Hub as a platform instance of RCWS, not a teaching-only UI tweak.**  
Your earlier idea (schedule → session detail → linked ops) is the right product shape; for **long-term** you must also lock: **URL law, panel composition, batch-vs-session split, extension rule, docs/ADR**. Without those, the hub rots into another page pile.

---

## What you should do

1. **Adopt RCWS law** in design-system or short ADR (1 page).
2. **Ship hub** `/teaching/sessions/:id` with path tabs + DetailPage.
3. **API** `classSession.get` (+ `doneProgress`).
4. **Extract panels** from 3 teaching pages; selectors only when no sessionId.
5. **Wire** schedule + class-detail session rows + cockpit → hub.
6. **Redirect** legacy function URLs 1–2 releases.
7. **Update** TL06 + WF-P2 URLs; remove dual authority.
8. **Nav end-state:** demote attendance/evidence/assessment after dogfood.

## What you shouldn't do

- Stuff more nav cross-links as the architecture
- Embed everything into class-detail
- One 2000-line session-detail.tsx
- Clone OpenEduCat timetable module
- Change session-done business rules in the UI plan
- Put grading/exercise authoring inside hub v1

## Better / efficient

| Priority | Move |
|----------|------|
| 1 | RCWS + hub + panels (highest 5-year ROI) |
| 2 | Deep-link-only (cheap; does not scale features) |
| 3 | Docs-only URL rewrite without page (worthless) |

## My take — how to get there

Treat like CRM Opportunity (already proven in-repo):

```text
Browse: /teaching/schedule
Record: /teaching/sessions/:id/{tab}
Admin:  /classes/:id (SessionsTab links to record)
Law:    new session capability → new tab under record
```

Phased H0→H3 from research report. Prefer path tabs. Default mid-class tab = attendance.

## Benefits

- Aligns UI with domain + TL06 + VIEW-GRAMMAR
- Extensible without nav explosion
- Shareable/agent URLs
- Clear actor split (GĐĐT admin vs GV execution)
- Lower AI drift (one recipe)

## Trade-offs

- Upfront extract cost on 3 pages
- Temporary dual routes
- Docs churn (healthy)
- Teachers lose “global picker” muscle memory (schedule remains entry)

---

## Work checklist

- [ ] Accept RCWS + batch/session split + URL `/teaching/sessions/:id`
- [ ] ADR or VIEW-GRAMMAR § “Session work object”
- [ ] Plan `plans/<ts>-teacher-session-hub/` (H0–H3)
- [ ] `classSession.get` (+ doneProgress)
- [ ] Shell session-detail + tab routes
- [ ] Extract 3 panels + tests
- [ ] Calendar + class-detail + cockpit links
- [ ] Redirects + e2e journey
- [ ] Update TL06 + TL26; nav cleanup
- [ ] Extension checklist in plan: “next feature = tab only”

## Success metrics

| Metric | Target |
|--------|--------|
| Session-scoped feature without new nav | yes for next 2 features |
| Cold-start URL `/teaching/sessions/:id/attendance` | works |
| Re-pick session in day path | 0 |
| session-done API tests | green, semantics unchanged |
| Dual function nav lifetime | ≤ 2 releases after hub GA |
| File size shell | chrome only; panels isolated |
