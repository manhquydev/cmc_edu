---
title: "Phase 5: Existing Detail URL and Cross Link Normalization"
status: in_review
---

# Phase 5: Existing Detail URL and Cross Link Normalization

## Overview

**Priority:** P1 · **Depends on:** Phase 4

Repair deep-link gaps on records that already have detail pages. This phase changes addressing and
navigation, not domain behavior.

## Requirements

- [ ] Class tabs become `/admin/classes/:id/{overview,students,sessions}`.
- [ ] Student exposes only `/admin/students/:id/{profile,enrollments}` in this phase.
  Current attendance/grades/guardians placeholders are removed from navigation or remain non-routed
  until real data contracts exist.
- [ ] Receipt tabs become `/finance/:id/{overview,order-lines}`.
- [ ] Base detail routes redirect to the default subpath.
- [ ] Class roster rows link via `links.student`.
- [ ] Aftersale create-success navigates to `links.afterSaleCase(created.id)`.
- [ ] Existing session `?tab=` contract remains until a dedicated migration proves value; do not mix patterns silently.
- [ ] Browser back and list-query preservation are tested separately.
- [ ] User tab clicks push history and preserve search + validated return state.
- [ ] Exact base paths redirect with replace; unknown sections are route-level not-found.
- [ ] Class detail sections use separate gates: shell/overview `class.read`, students
  `classRoster.read`, sessions by their actual read contract, edit controls `class.create`.

## Architecture

Use nested route segments for durable entity sections, per TL06. Keep filter/view state in query.
Do not turn modal confirmations or bounded actions into routes. Add builders for subpaths rather than
hard-coded strings.

## File inventory

| Path | Action |
|---|---|
| `apps/admin/src/routes/admin.routes.tsx` | nested class/student routes |
| `apps/admin/src/routes/finance.routes.tsx` | nested receipt routes |
| `apps/admin/src/pages/classes/class-detail.tsx` | route-owned tab |
| `apps/admin/src/pages/students/student-detail.tsx` | route-owned tab |
| `apps/admin/src/pages/finance/receipt-detail.tsx` | route-owned tab |
| `apps/admin/src/pages/crm/create-after-sale-case-dialog.tsx` / caller | return created id + navigate |
| `packages/links/src/index.ts` | subpath builders |
| corresponding tests | route/back/cross-link proof |

## Implementation Steps

1. Inventory current tab ids and render conditions; remove any proposed empty route.
2. Add link builders and nested route tests.
3. Replace component-state tab selection with route params/outlet or route-derived section.
4. Add base-route replace redirects; unknown sections 404 and malformed IDs avoid API calls.
5. Link class roster students with return context back to the class `students` section.
6. Return created aftersale case from dialog flow and navigate on success.
7. Prove back behavior and cold navigation for every changed record.

## Test scenario matrix

| Scenario | Expected |
|---|---|
| Paste class students subpath | correct class + roster |
| Click class roster student | canonical student profile |
| Refresh student enrollments | same section |
| Placeholder student sections | no routable empty work surface |
| Receipt action opens dialog | URL remains record section |
| Invalid section | route-level not-found; only exact base redirects |
| Aftersale create | created case detail opens |
| Browser back | previous list/query restored when history contains it |
| Tab history | user tab push; Back/Forward traverses sections |
| Cross-record explicit return | class roster → student → explicit return goes back to class roster |

## Success Criteria

- No targeted durable tab depends solely on React local state.
- Cross-record links use `@cmc/links`.
- No domain calculation changes; existing section-specific authorization is represented accurately.
- Focused route/page tests and admin typecheck pass.

## Risks

- **Breaking bookmarks:** base redirect and compatibility route tests.
- **Route explosion:** only real, durable sections.
- **State loss:** preserve validated `pathname + search` return state across tab and cross-record links.

## Rollback

- Keep exact base-detail redirects and old canonical detail paths valid while reverting nested
  section rendering.
- Never restore local-state tabs while leaving subpath links emitted; route emitters and renderers
  roll back together in the same module PR.

## Security considerations

Nested routes reuse the same parent permission and API gates. A new URL must not expose a panel whose
API permission is narrower than the parent; add a nested gate where needed.

## Current validation

- Local Admin suite: 75 files / 704 tests passed.
- Focused route suite: 11 tests passed, including canonical base-detail redirects
  preserving pathname and query.
- `@cmc/links` tests: 42 tests passed.
- Admin typecheck and build passed; workspace typecheck passed (34/34 tasks).
- Remaining review gates: executable browser history/back-forward proof and required CI
  `typecheck-and-test` + `ui-e2e`.
- Review: prior redirect finding addressed locally; fresh formal review and required CI
  evidence remain.
