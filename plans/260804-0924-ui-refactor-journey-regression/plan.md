# UI-refactor journey regression — separate workstream (HIGH priority)

Status: SCOPED (diagnosis started, not fixed). Opened 2026-08-04 from the business-verify
full-suite run on `develop` HEAD 559755b. Owner decision: investigate as its own workstream.

## Symptom

Full `ui-chromium` suite = **27/40 pass, 13 fail**. The 13 failures are NOT test rot from
the business-verify retrofit — they fail in UI interaction / setup, before any added
readback. Two root-cause signatures:

- **(A) `tpl-wrap tpl-detail` overlay intercepts pointer events — 9 of 13.** A full-canvas
  detail panel (`div.tpl-wrap.tpl-detail`) overlaps the master/list area, so a later
  `locator.click` (e.g. `+ Thêm mẫu ca`, a nav button) waits forever: Playwright log shows
  `<div class="tpl-wrap tpl-detail">…</div> intercepts pointer events`, retrying to timeout.
- **(B) `createStaffViaAdminUi` helper timeout — 2 of 13.** `apps/e2e/src/journey/create-staff-via-admin-ui.ts:164`
  (`context.close()`) times out — the admin staff-create flow doesn't complete.

## Affected journeys (13)

Signature A (overlay): checkin-offsite-approval (P3-02), shift-register-approve-reject
(P3-03/04/07), shift-config-admin (ADM-05), enrollment-second-class (P1-05),
entrance-test-appointment (P4-04), exercise-publish-close (P2-04), session-evidence-publish
(P2-08 GV), lms-parent-evidence-consent (P2-08 PH), parent-link-approve-reject (P1-06),
admin-shell safety net. Signature B (staff-create): kpi-submit-confirm-bulk-approve
(P3-06/08), user-admin-roles (ADM-02).

**Impact on business-verify:** signature A/B block 3 money/state flows (P3-02, P3-04,
P3-06/08) from reaching `verified-correct` — their journeys can't complete, so the appended
assertions never run. Fixing this workstream is the gate to finishing those 3.

## Root-cause hypothesis

The list/detail cohesion refactor (uncommitted `packages/ui/src/components/list-page.tsx`,
`detail-page.tsx`, `premium.css` `.tpl-detail*`, MasterDetail usage) changed the detail
panel's layout/stacking so the detail canvas sits over the master column instead of beside/
replacing it. `.tpl-detail` (premium.css:910) is a plain flex column — the overlap is likely
in the MasterDetail wrapper's positioning/width, not `.tpl-detail` itself. Signature B may be
a separate admin-create regression or a downstream symptom of the same shell change.

## Next steps (not yet done)

1. Reproduce one signature-A journey headed (`shift-config-admin`) and inspect the live DOM:
   is the `.tpl-wrap.tpl-detail` panel absolutely positioned / full-width over the master?
2. Diff the uncommitted MasterDetail/list-page/detail-page/premium.css changes against the
   last green commit (baseline f354e20 passed these journeys).
3. Fix the layout so the detail panel does not capture pointer events over master controls.
4. Triage signature B separately (createStaffViaAdminUi) — may be same shell change or its own.
5. Re-run full `ui-chromium` suite; expect the 3 money flows to reach `verified-correct`
   (target 10/38) plus the 9 non-money journeys restored.

## Notes

- Prereq to run any UI e2e on this branch: rebuild `@cmc/ui` (stale dist) — already done.
- Baseline f354e20 had these journeys green (they were `reachable-only`/`proven`), so this is
  a regression introduced by the in-flight UI work, not a long-standing gap.
