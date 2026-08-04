# UI-refactor journey regression — separate workstream (HIGH priority)

Status: RESOLVED 2026-08-04 — ui-chromium suite went 27/40 → **40/40** (pinned cli, 0 flakes).
Two root causes, both fixed: (1) horizontal overflow past the 1280px viewport (form/action rows
not shrinking/wrapping), fixed with `min-width:0`+`flexWrap` on the affected pages; (2) the
UI-cohesion refactor changed intended FLOWS (added ConfirmDialogs for publish/enroll/reject/close,
banner→toast success feedback, `Cơ hội —`→`Giai đoạn ·` stage label, role slugs→`formatRole`
labels) — the pre-refactor journeys were reconciled to the new flows (click-through dialogs,
canonical labels, reactive FilterBar search, no stale submit buttons). NO app behavior changed by
the reconciliation (journeys/helper/specs only); the overflow CSS fixes + the refactor itself stay
in the working tree as the user's UI-cohesion WIP. Details below are the trail.

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

## Diagnosis progress (2026-08-04)

- Intercepting element `div.tpl-wrap.tpl-detail` = the `DetailPage` root
  (`packages/ui/src/components/detail-page.tsx:50` → `className="tpl-wrap tpl-detail"`).
- `shift-config.tsx` renders a SINGLE `DetailPage > SettingsShell > GroupsTab` on the main
  path (the two `DetailPage` blocks are mutually exclusive: no-perm early-return vs main).
  So it's NOT a double-mounted overlay — the button is a DESCENDANT of the intercepting
  `tpl-wrap tpl-detail`, which means a CSS stacking/positioning regression (an overlay child,
  a `position:absolute` full-cover, or a large sticky hit-area) inside the new
  `SettingsShell`/`DetailPage`/`premium.css .tpl-detail*` layer, not a JSX bug.
- Suspects to check in the WIP diff: `SettingsShell` (new rail+content component used by
  shift-config), `.tpl-actions { position: sticky; bottom: 0 }` (premium.css:966),
  `.tpl-detail*` rules (premium.css:910+). shift-config.tsx WIP diff is +44/-22.
- Repro of ADM-05 launched to capture the failure `error-context.md` ARIA/DOM snapshot and
  pin the exact overlapping node.

## ROOT CAUSE FOUND (probe, 2026-08-04)

NOT a stacking overlay — **horizontal overflow past the 1280px e2e viewport**
(`devices['Desktop Chrome']`). Ancestor-chain probe at the `+ Thêm mẫu ca` button:
- button rect = x 1257→1383 (center ~1320) → **past viewport 1280**, so
  `elementFromPoint` returns the `tpl-wrap` canvas → Playwright reports "intercepts".
- the template-form `HStack` (shift-config.tsx:128) has `clientW=662` but `scrollW=822`
  — 160px of content that won't shrink. The `Tên mẫu ca` wrapper is `flex:1` with the
  default `min-width:auto`, the classic flexbox trap: a flex child won't shrink below its
  content's min size, so the row overflows and the trailing button is pushed off-screen.
- The layout primitives above (`ck-settings-main`, `tpl-detail-body`, `ck-settings-shell`)
  correctly carry `min-width:0`; the overflow originates at the inline form row.

**Fix pattern:** on an inline form row (`HStack` of inputs + trailing button), give the
flexible child `minWidth:0` (so it shrinks) and/or `flexWrap:'wrap'` on the row (so the
button drops to a new line when tight). Applied to shift-config.tsx template form.

**Systemic:** the 9 signature-A journeys each fail the same way — a form/action row wider
than 1280 with a trailing interactive control pushed off-screen. Each affected page needs the
same min-width:0 / wrap treatment on its overflowing row (not one shared fix — these are
per-page inline forms). Signature-B (createStaffViaAdminUi timeout, 2 journeys) is separate.

## Diagnosis — ruled out (evidence-based, 2026-08-04)

Reproduced ADM-05 headless; captured `error-context.md` ARIA snapshot.
- NOT a mounted overlay/dialog: the ARIA content tree is a single clean region
  (banner → breadcrumb/heading → SettingsShell rail + main → GroupsTab form + group card).
  No duplicate detail region, no dialog/modal node.
- NOT JSX double-mount: shift-config renders ONE `DetailPage` on the main path.
- NOT an obvious CSS overlay: `grep` on premium.css finds NO `::before/::after`, `z-index`,
  `isolation`, `transform`, `position:absolute`, or `pointer-events` on `.tpl-wrap`,
  `.tpl-detail`, or `.ck-settings-*`. `.ck-settings-shell` is a clean grid; `.ck-settings-rail`
  is `position:sticky; top:8px`; `.ck-settings-main` is a flex column.
- Symptom precisely: Playwright `elementFromPoint(buttonCenter)` returns the outer
  `div.tpl-wrap.tpl-detail` (DetailPage root), not the button — after scroll-into-view, button
  is "visible, enabled, stable". Systemic across 9 journeys with different locators.

Remaining hypotheses (need live evidence): a route-transition wrapper leaving a second
`tpl-wrap` painted over content, or an `overflow`/scroll-container + sticky interaction that
puts the button's hit-point under the root box.

## Decisive next probe (one run, definitive)

Throwaway spec: navigate as the ADM-05 journey does to the shift-config screen, locate the
`+ Thêm mẫu ca` button, then `page.evaluate` at its rect center:
`document.elementsFromPoint(cx, cy)` (plural) → log the FULL stack of elements + each one's
`getComputedStyle` `position/zIndex/transform/pointerEvents/overflow`. The first element above
the button in that list, with the style that captures the point, IS the culprit. That names the
exact element + property to fix (expected: something on `.tpl-detail`/DetailPage or a transition
wrapper). This avoids further guess-and-run cycles.

## Ownership note

`SettingsShell`, `DetailPage`, `MasterDetail`, and `premium.css .tpl-*`/`.ck-settings-*` are
part of the in-flight UI-cohesion refactor (uncommitted WIP, plans `260804-ui-smart-cohesion-*`
/ `260804-layout-*`). The fix likely belongs INSIDE that refactor workstream — coordinate so it
doesn't collide with parallel edits to the same files.

## Verified standalone (pinned cli, 2026-08-04)

- ✅ ADM-05 (shift-config) — green.
- ✅ P3-03/04/07 (shift-register, shifts.tsx) — green.
- ⚠️ ADM-02 (user-admin): overflow fix let staff-create COMPLETE (was a timeout before), now fails
  LATER at `table row nth(1) getByText('sale')` not visible — a separate role-display/data issue,
  NOT overflow. Needs its own diagnosis (is the role persisted? table refresh? locator drift?).

## Tooling flake fixed (important)

`npx playwright test` drifts to a floating `playwright` version (my `npx playwright install`
pulled a newer CLI expecting browser build 1234 vs the pinned `@playwright/test@1.62`'s), causing
`browserType.launch: Executable doesn't exist` and cascading `did not expect test.describe()`
worker errors — an ENTIRE full-suite red that was pure tooling drift. FIX: always run via the
pinned local cli — `node node_modules/@playwright/test/cli.js test ...` and install its browser
with `node node_modules/@playwright/test/cli.js install chromium`. Never `npx playwright` here.

## Fixes applied (2026-08-04, awaiting full-suite verify)

`min-width:0` + `flexWrap:'wrap'` on overflowing rows:
- shift-config.tsx (template form) — VERIFIED green (ADM-05).
- attendance/shifts.tsx (SubmitTab: date row + entry row `wrap="nowrap"`→`wrap`) — P3-04.
- crm/opportunity-detail.tsx (`entityActions` 5-button row + appointment row) + schedule-test-dialog.tsx — P4-04.
- teaching/session-evidence.tsx (actions bar) — P2-08 GV.
- teaching/exercises.tsx (create-dialog submit) — P2-04 (UNCERTAIN: overflow may be DataTable-level in packages/ui).
- admin/users.tsx (create-staff dialog footer) — signature-B (P3-06/08, ADM-02).
- enrollment/class-placement.tsx (lookup + confirm rows) — P1-05.
- parents/index.tsx (approve/reject action cell) — P1-06.

Left unchanged (no matching input+button HStack — flagged, may fail for another reason):
- attendance/check-in-out.tsx (P3-02) — only dialog action bars + DataTable action cell; suspected DataTable width.
- lms parent consent-settings.tsx (P2-08 PH) — clicked button is full-width in a vertical Stack.

If those (or exercises) still fail the full suite, re-probe them individually — likely a
`packages/ui` DataTable min-width, a different overflow surface, or (P2-08) a non-overflow cause.

## Scout of the 8 remaining (2026-08-04) — NOT overflow, it's refactor-divergence

Overflow fixes worked (no more "intercepts pointer events"). The 8 now fail because the
UI-cohesion refactor changed intended flows/structure; pre-refactor journeys no longer match:
- session-evidence (P2-08 GV): refactor ADDED a confirm `alertdialog` ("Công bố nhật ký cho
  phụ huynh?") — journey publishes once (opens dialog), never clicks the dialog's own "Công bố".
- user-admin (ADM-02): table `tbody` EMPTY after create — row/role not rendered (render change
  or refactor bug); journey waits for row nth(3) role 'sale'.
- grading & success-feedback flows: banner → transient TOAST (`toastSuccess('Đã lưu điểm')` now
  in grading.tsx) — journeys asserting a persistent banner (`Đã công bố`, `Đã xếp lớp thành công`)
  fail because feedback is now a vanishing toast or renamed.
- enrollment (P1-05), entrance-test (P4-04), parent-link (P1-06), kpi (P3-06/08), exercise (P2-04),
  lms-parent-evidence (P2-08 PH): same class — need per-flow reconciliation with intended UI.

**These require product-intent decisions (is the confirm dialog / toast / new structure the
intended final behavior?) — they belong to the UI-cohesion refactor workstream, not a blind
fix-loop. Do NOT guess-fix journeys to match a half-built refactor, nor revert the app to old
flows (would contradict the refactor).** Reconciliation = update each journey to the INTENDED
flow once that flow is settled, OR fix genuine refactor bugs (empty user table) in the refactor.

## Reconciliation phases (accepted 2026-08-04: adapt journeys to intended UI + fix real bugs)

- **G — users page (REAL BUG, highest value):** `/admin/users` table `tbody` empty after create /
  createStaffViaAdminUi hangs → blocks BOTH ADM-02 AND kpi P3-06/08 (money/state). Investigate
  users.tsx create+list (did the create succeed? does the list refetch? did the flexWrap edit
  break the "Tạo" submit?). Fix the app bug.
- **H — teaching/publish flows (adapt journeys):** session-evidence (click the ADDED confirm
  `alertdialog`'s "Công bố"), lms-parent-evidence (same publish→toast/dialog change), exercise
  (create/publish/close click flow).
- **I — CRM/enrollment flows (adapt journeys):** enrollment (`Đã xếp lớp thành công` → toast?),
  entrance-test (`Cơ hội — Tiếp cận` stage label), parent-link (`waitForResponse` after approve).

Method: each fix is either a journey adaptation to the intended new flow (dialog/toast/structure)
or a genuine refactor-bug fix; subagents edit + typecheck (no concurrent e2e → no build race);
one final pinned-cli full suite verifies. Red-team/validate here = the churn-risk flag + the
bug-vs-intended judgment already recorded; heavyweight governance is disproportionate for
test-flow adaptations (KISS).

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
