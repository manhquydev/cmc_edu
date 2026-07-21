---
phase: 3
title: "P0 Lead intake UI (create/lost/search)"
status: done
priority: P1
dependencies: []
effort: "6-8h"
---

# Phase 3: P0 Lead intake UI (create/lost/search)

## Overview
Finding F1 (CRITICAL) + F11 (search part). The CRM backend supports create/markLost/reopen/lookup but **no admin screen calls any of them** — sale cannot operate the pipeline. Add lead-create, mark-lost/reopen, and phone/name search to the pipeline UI; add server-side text search to `opportunityList`.

## Evidence (verified in-session)
- `crm.opportunityCreate` exists (`apps/api/src/crm/router.ts:81-113`), zero call sites in `apps/admin/src` (grep-confirmed; tests only).
- `crm.opportunityMarkLost` + reopen exist (:149-176), UI only displays lost (pipeline.tsx:40,57).
- `crm.opportunityLookup` dedup check exists (:178-190), unused by UI.
- `opportunityList` input has stage/page/pageSize only — no text search (:75-79).
- pipeline.tsx: advance + enroll deep-link only; detail page read-only dead-end (opportunity-detail.tsx).

## Requirements
- Functional:
  - **Create lead**: modal/form from pipeline header — name, phone, optional email; on phone blur call `opportunityLookup`, show dedup warning if exists (QD 0037) but allow proceed; submit → `opportunityCreate`; new card appears in O1 column.
  - **Mark lost**: action on card + detail — dialog with `lostReason` select (6 values from router:25-32, Vietnamese labels); calls `opportunityMarkLost`.
  - **Reopen**: action on lost card/detail → `opportunityMarkLost {reopen:true}` → back to O2.
  - **Search**: text input in pipeline header, matches contact name OR phone; server-side.
- Backend — single consolidated `opportunityList` contract change (red-team: avoid two phases editing one input object; phase 6 consumes, does not re-edit):
  - `search: z.string().trim().min(1).max(100).optional()`; where-clause `contact: { OR: [{name: {contains, mode:'insensitive'}}, {phone: {contains}}] }`.
  - `lost: z.enum(['exclude','include','only']).default('exclude')` — default **exclude** (the F7 defect must not stay default server behavior); `exclude` = `closedAt: null` OR stage O5; `only` = lost predicate (phase 2 helper). Only two callers exist (pipeline.tsx, enroll-picker.tsx) — update enroll-picker to pass an explicit value in this phase; this is a deliberate default flip, NOT backward-compatible, and both callers are updated here.
  - Response gains `stageCounts` (groupBy stage, lost excluded) + `lostCount` computed in the SAME transaction — NO separate pipelineStats procedure (red-team: redundant query/cache surface + self-inflicted consistency risk).
  Keep RLS scoping unchanged.
- Non-functional: premium `@cmc/ui` barrel only (FormPage/Panel patterns, LineIcon, light mode); optimistic update pattern consistent with existing advance (pipeline.tsx:100-124); permissions already correct (`crm.*` = giam_doc_kinh_doanh + sale).

## Related Code Files
- Modify: `apps/api/src/crm/router.ts` (search param), `apps/api/src/crm/list.test.ts`
- Modify: `apps/admin/src/pages/crm/pipeline.tsx` (+create modal, lost/reopen actions, search box)
- Modify: `apps/admin/src/pages/crm/opportunity-detail.tsx` (action bar: advance where valid, mark lost, reopen)
- Modify: `apps/admin/src/pages/crm/pipeline.test.tsx`; add detail-page tests
- No route/nav changes (screens exist in `apps/admin/src/routes/crm.routes.tsx`).

## Implementation Steps
1. Backend first (TDD): failing list.test cases for search by partial name + partial phone + facility isolation + lost filter (exclude hides lost-at-O3, keeps O5; only shows lost only) + stageCounts/lostCount correctness → implement → green.
2. `gitnexus_impact` on `opportunityList` (upstream: pipeline + enroll-picker) before edit.
3. UI create-lead modal with lookup-on-blur dedup warning; wire mutation + invalidate list.
4. UI mark-lost dialog + reopen; detail-page action bar (fixes read-only dead-end).
5. UI search box (debounced 300ms) → list query param.
6. Component tests (existing pipeline.test.tsx patterns); `pnpm -F @cmc/admin test` + typecheck + lint.

## Success Criteria
- [ ] Sale completes create → advance → mark lost → reopen → enroll-handoff entirely via UI (manual e2e walkthrough on local-sim).
- [ ] Dedup warning shown for existing phone; creation still possible (QD 0037 semantics).
- [ ] Search returns matches across pages, facility-scoped, case-insensitive on name.
- [ ] No raw component imports outside `@cmc/ui` barrel; no emoji icons.

## Risk Assessment
- **Risk**: `contains` on phone with formatting variance — normalize input (strip spaces/dashes) before query; note Contact.phone stored as-entered until phase 8 dedup normalizes.
- **Risk**: detail-page actions duplicate pipeline logic — extract shared mutation hooks (`use-opportunity-actions.ts`) to stay DRY.
- **Rollback**: UI-only + additive optional input; revert safe.
