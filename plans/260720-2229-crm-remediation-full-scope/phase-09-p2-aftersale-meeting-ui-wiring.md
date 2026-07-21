---
phase: 9
title: "P2 Aftersale + meeting UI wiring"
status: done
priority: P2
dependencies: [3]
effort: "6-8h"
---

# Phase 9: P2 Aftersale + meeting UI wiring

## Overview
Finding F10 (MEDIUM). `aftersale.tsx` and `post-sale-meeting.tsx` are "coming soon" EmptyState stubs whose header comments claim **no backend exists** — false: `after-sale/router.ts` and `meeting/router.ts` are complete and registered. Wire real screens to the existing backends.

> Rescoped after red-team: (1) the earlier claim that this "takes over premium-erp-buildout phase-08's scope" was **wrong** — phase-08's effective scope is network-ip only (phase-08-stub-real-features.md:7); no prior plan ever owned these two screens, and nothing here touches or closes premium phase-08. (2) Periodic TestAppointment UI is **cut** (scope creep — no finding demands it; entrance UI belongs to phase 7; periodic scheduling stays backend-only until a real demand exists). (3) Do not add a new `student.search` blindly — `student.lookup` already exists in the permission registry (packages/auth/src/index.ts:73); verify its router procedure's shape first and only extend if insufficient.

## Evidence (verified in-session)
- Stubs wired into nav + routes: `apps/admin/src/shell/nav-registry.ts:51-52`, `apps/admin/src/routes/crm.routes.tsx:34-49`; stub comments claim no backend (aftersale.tsx:1-22, post-sale-meeting.tsx:1-23).
- Backends exist: `apps/api/src/after-sale/router.ts` (create/advance/resolve/close), `apps/api/src/meeting/router.ts` (schedule/complete/cancel), `apps/api/src/appointment/router.ts` (schedule/complete/noShow) — **but none has a `list` query**; UI cannot render without them.
- Permissions in place: `afterSale.manage`/`parentMeeting.manage`/`testAppointment.manage` = giam_doc_kinh_doanh, giam_doc_dao_tao, sale (`packages/auth/src/index.ts:126-128`) — list procedures gate on the same registry keys (read via manage; no new roles).

## Requirements
- Backend (TDD): add `list` queries to the two routers this phase wires — afterSale (filter by status) and parentMeeting (status + date range) — facility-scoped, paginated (page/pageSize≤100), include student name (join select minimal fields). Same `requirePermission(domain,'manage')` gate (read-with-manage is the existing norm for these domains; do NOT invent new permission keys).
- Student picker: reusable `student-picker.tsx` in `apps/admin/src/lib/` (mirrors `enroll-picker.tsx` pattern) — backed by the EXISTING `student.lookup` procedure (registry key packages/auth/src/index.ts:73); extend its input/output only if the current shape can't serve a name-search picker (scout first, document the verdict).
- Screens (premium `@cmc/ui` templates):
  - **aftersale.tsx**: case list (status filter), create-case (student picker + description + priority), advance/resolve(resolution required)/close actions per lifecycle.
  - **post-sale-meeting.tsx**: meeting list (upcoming/done/cancelled), schedule (student picker + datetime, surfaces double-booking `warning` from router:60-63), complete (result required), cancel. UI must NOT render/depend on `remindedAt` (field is dropped in phase 10 — it appears in current API return payloads, meeting/router.ts:61,82-83).
- Delete stub comments; screens leave "coming soon" state.

## Related Code Files
- Modify: `apps/api/src/after-sale/router.ts`, `apps/api/src/meeting/router.ts` (+list), respective test files
- Possibly modify: student router (only if `student.lookup` shape insufficient) — `gitnexus_impact` first
- Create: `apps/admin/src/lib/student-picker.tsx`
- Modify: `apps/admin/src/pages/crm/aftersale.tsx`, `post-sale-meeting.tsx` (+ their test files)

## Implementation Steps
1. Backend list procedures TDD (facility isolation negative tests included — repo norm, see `finance/rls-negative.test.ts` pattern).
2. Verify `student.lookup` procedure shape for the picker (scout `apps/api/src/student/`); extend only if needed.
3. student-picker component (clone enroll-picker structure).
4. Aftersale screen → meeting screen; component tests each.
5. Full suites; `gitnexus_detect_changes`; update `scripts/acceptance-report/flow-manifest.ts` entries for WF-P4-03/05 if they assert UI absence.

## Success Criteria
- [ ] Staff completes: open case → in_progress → resolved(with resolution) → closed entirely in UI.
- [ ] Meeting schedule shows double-booking warning; complete requires result (server error surfaced inline).
- [ ] No EmptyState stubs remain under pages/crm; stale "no backend" comments deleted.
- [ ] Meeting UI has zero references to `remindedAt`.

## Risk Assessment
- **Risk**: list-via-manage permission too broad? Same three roles either way — no widening; documented.
- **Risk**: student search performance — bounded by facility scope + take limit; index on Student(facilityId) exists.
- **Rollback**: additive procedures + screen replacement; revert restores stubs.
