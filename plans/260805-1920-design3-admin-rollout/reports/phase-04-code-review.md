# Code Review — Phase 4 CRM pilot (design3 admin rollout)

Date: 2026-08-05  
Reviewer: staff-engineer (read-only)  
Plan: `plans/260805-1920-design3-admin-rollout/phase-04-pilot-crm-migration.md`

## Code Review Summary

### Scope
- Files:
  - `apps/admin/src/pages/crm/pipeline.tsx`
  - `apps/admin/src/pages/crm/pipeline.test.tsx`
  - `apps/e2e/tests/journeys/crm-receipt.journey.ui.spec.ts`
  - `apps/admin/src/pages/crm/opportunity-detail.tsx` (statusbar only — unchanged wire)
  - `plans/260805-1920-design3-admin-rollout/reports/phase-04-gap-ledger.md`
- LOC: ~550 pipeline page + ~430 tests + e2e smoke block
- Focus: Phase 4 pilot acceptance criteria (a–e)
- Scout findings: nested interactive card wrapper; KanbanColumn double-count; list source labels vs detail; e2e URL assert weak; ui-e2e still open merge gate

### Overall Assessment

Phase 4 delivers the contracted pilot shape: board ported to `@cmc/ui` Kanban primitives, new list DataTable, TL6 `?view=` switcher, shared `listInput` (no backend), stageCounts/funnel/lost filter/pagination preserved. Unit surface matches claim counts (30 pipeline / 99 crm `it` blocks by static count). No public API or tRPC input breaks. Residual issues are UX/pattern and test-depth, not stage-machine regressions. Full ui-e2e remains an open branch gate per gap ledger.

**Score: 7.5/10**

### Critical Issues

None that block unit-complete Phase 4 acceptance.

- No backend contract change (`opportunityListInput` still stage/search/lost/page/pageSize).
- Advance still mutates `{ opportunityId, toStage }` with adjacent stages only (server-enforced).
- O5 still not advanceable from UI; enroll remains `/finance/new?opportunityId=`.
- `opportunity-detail` still imports/renders `WorkflowStatusbar` → `check-ui-frames` full-tier assertion remains valid.

### High Priority

None for correctness of listed ACs.

Open **merge gate** (documented, not a code defect of this PR shape):

1. **Full ui-e2e not proven green in cook** — gap ledger item 3 / success criteria unchecked. Smoke switcher is inlined in P1-02 journey only; branch still needs `ui-e2e` CI green.

### Medium Priority

1. **Kanban column count rendered twice**  
   `KanbanColumn` already paints `count` as `.o-kanban-col-count`, but title is still `` `${stage.label} · ${count}` `` (legacy Panel header format).  
   Result: headers show e.g. `Tiếp cận · 5` **and** pill `5`.  
   Design-lab / primitive usage uses `title={label}` + `count={n}` only.  
   Fix: `title={stage.label}` and keep `count={count}`; update unit assertions that look for `Tiếp cận · 5`.

2. **List `Nguồn` shows raw enum, not product labels**  
   List render: `row.source ?? '—'`.  
   Detail uses `SOURCE_LABELS[opp.source]` (`Giới thiệu`, `Fanpage`, …).  
   Ops will see `fanpage` / `walkin` in table while detail shows Vietnamese.  
   Fix: import `SOURCE_LABELS` from `create-lead-dialog.js` and map in the column.

3. **Nested interactive a11y on cards**  
   Outer `div role="button"` wraps real `<Button>`s (advance / mark lost / schedule).  
   Gap ledger accepts this; still a WCAG nested-control smell and keyboard ambiguity.  
   Prefer `KanbanCard` non-button + explicit title link/button, or card `onClick` only when no child actions (harder). Non-blocking for pilot if documented.

4. **E2E smoke URL assertion is weak after return to kanban**  
   ```ts
   await expect(page).toHaveURL(/\/crm\/?(?:\?.*)?$/);
   ```  
   Matches `/crm?view=table` as well. Real signal is `aria-pressed="true"` on kanban.  
   Prefer assert URL does **not** match `/view=table/` after restore.

5. **Optimistic `setData` not behavior-proven**  
   Tests prove listInput has no `view` key and invalidate-on-settle. Mock `setData` is a spy and does not drive re-render, so optimistic stage move is structural only. Acceptable given mock limits; not a phantom for input sharing, but do not claim “optimistic UI tested end-to-end.”

### Low Priority

1. List switcher unit test asserts columns Học viên / SĐT / Giai đoạn / Phụ trách but **not** `Nguồn` (AC lists source).
2. `?view=kanban` left in URL is treated as kanban but not normalized away until toggle (only default path deletes param).
3. List is navigate-on-row-click only (no advance/mark-lost) — intentional gap; train ops that actions live on kanban/detail.
4. Owner shown both as initials chip and footer full name on card — pre-existing density choice.

### Edge Cases Found by Scout

| Edge | Risk | Notes |
|------|------|-------|
| Stage-filtered URL + optimistic advance | Pre-existing | Item stage flips client-side while query still stage-scoped until invalidate |
| Filter/page change mid-advance | Pre-existing | `onError` rollback uses render-closure `listInput`; classic RQ stale-input risk |
| Multi-div e2e card locators after Kanban port | Residual | Journey already scopes by contactName + button; structure still has nested divs — smoke+advance path depends on `.last()` |
| Table view empty + funnel ready | OK | Stage columns always exist; ListPage never page-level empty |
| Invalid `?view=foo` | OK | Falls through to kanban |

### Mandatory checklist (a–e)

| # | Criterion | Verdict |
|---|-----------|---------|
| (a) | AC met for unit-testable items | **Pass with nits** — switcher, deep-link, shared input, columns (source label quality/test gap), kanban primitives, funnel/stageCounts/lost/pagination/advance |
| (b) | No business-logic regression | **Pass** — advance payload, lost visibility, stageCounts vs items, O4 Ghi danh, schedule/mark-lost gates unchanged |
| (c) | Public contracts unchanged | **Pass** — no API/router change; statusbar still present on detail |
| (d) | Patterns match | **Mostly** — KanbanBoard/Column/Card, `o-view-switcher`, ListPage/DataTable; double-count title is anti-pattern vs primitive |
| (e) | Tests green (30 / 99 claim) | **Static match** — 30 `it` in `pipeline.test.tsx`; 99 `it` under `apps/admin/src/pages/crm/**/*.test.tsx`. **Not re-executed in this review session** (no shell). Treat cook claim as unverified here. |

### Positive Observations (risk calibration)

- Shared `listInput` is the right KISS fix for dual-view cache; optimistic path targets that key; broad `invalidate()` on settle converges consumers.
- Funnel/column counts correctly remain server `stageCounts` / `lostCount` (F7 preserved).
- View default omits query param (short URLs); `replace: true` avoids history spam.
- Gap ledger is honest about non-goals (drag-drop, list row actions, dialog chrome, full e2e).

### Recommended Actions

1. Before merge: run `pnpm --filter @cmc/admin test` (crm) + `node --test scripts/check-ui-frames.test.mjs`; land only with CI `typecheck-and-test` + `ui-e2e` green.
2. Quick fix (same PR if open): drop count from KanbanColumn `title`; map list source via `SOURCE_LABELS`.
3. Tighten e2e: after kanban restore, `expect(page).not.toHaveURL(/view=table/)`.
4. Optional follow-up: assert `Nguồn` header; card a11y restructure in Phase 5 if CRM polish continues.

### Metrics

- Type Coverage: n/a (not measured)
- Test Coverage: pipeline unit 30 cases; crm suite 99 cases (static inventory)
- Linting Issues: not run this session
- Backend API delta: 0

### Unresolved Questions

- None blocking product intent; list-without-actions was an accepted pilot tradeoff in gap ledger.

### Plan status recommendation

- Phase 4 unit success criteria: treat as **complete with follow-ups** listed above.
- Do **not** close the phase’s e2e success criterion until `ui-e2e` is green vs main.
- Do not mutate plan task state from this review; lead/planner owns that.

---

**Status: DONE_WITH_CONCERNS**  
**Summary:** Phase 4 meets pilot ACs for KanbanBoard port, list+switcher, shared listInput, and preserved CRM board behavior with no API break; score 7.5/10. Concerns are double-count column headers, raw source labels in list, nested interactive cards, weak e2e URL assert, and full ui-e2e still an open merge gate (unit counts match claim but were not re-run here).  
**Concerns/Blockers:** No critical blockers for unit-complete sign-off; merge should wait on ui-e2e CI.
