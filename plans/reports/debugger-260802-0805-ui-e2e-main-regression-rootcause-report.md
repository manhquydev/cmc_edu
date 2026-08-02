# ui-e2e CI regression on main — root cause analysis

Date: 2026-08-02 | Investigator: debugger agent | Scope: read-only, no fix applied

## Executive summary

`ui-e2e` job on `main` regressed between GREEN `0b933bf` (2026-07-26) and RED
`e563f51f` (2026-08-01). Root-cause commit is **`01f6e4c`** ("fix(admin,api):
complete admin console UX, parent-account flows, and shift/grading
validation"), pushed 8s before `e563f51f` (docs-only, innocent). `e563f51f`
was just HEAD when CI ran — not the cause.

`01f6e4c` shipped 3 intentional, well-reasoned production UX/validation
fixes to `apps/admin`. Each one changed a contract the Playwright UI journey
suite (`apps/e2e`) depends on, and the e2e suite was not updated in the same
commit. Net effect: **21 of ~40 ui-chromium specs fail** (2 retries each).
Because `ui-e2e` has `continue-on-error: true` in the workflow, the run-level
status stayed green — the regression was silently masked, exactly as
flagged in the task brief.

This is a **test-suite regression, not a production bug** — all 3 admin
changes are correct, intentional, and documented with rationale in code
comments. `typecheck-and-test` and the non-UI `e2e` job (tRPC-level, 20
passed) both stayed green, confirming the break is purely in the Playwright
UI layer's assumptions about admin forms/nav.

## Evidence chain

### 1. Confirmed failing run

```
gh api repos/manhquydev/cmc_edu/actions/runs/30697018746/jobs
→ ui-e2e job id 91361510689, conclusion: failure
  (typecheck-and-test: success, e2e: success)
```

Log pulled via `gh api repos/manhquydev/cmc_edu/actions/jobs/91361510689/logs`.
`Running 40 tests using 1 worker` → 21 unique specs fail (both attempt +
retry), e.g. specs #5,7,10,12,17,20,23,25,27,29,31,33,36,39,41,43,45,48,51,53,55.

### 2. File-level diff isolates the change

```
git diff --stat 0b933bf e563f51f -- apps/admin apps/api
```
Only `01f6e4c` touches `apps/admin/src/shell/nav-registry.ts`,
`apps/admin/src/pages/finance/receipt-create.tsx`, and
`apps/admin/src/pages/admin/users.tsx` in the window — verified via
`git log --oneline 0b933bf..e563f51f -- <those 3 files>` returning only
`01f6e4c`. The other window commits (infra nginx/compose, docs) don't touch
`apps/admin`.

### 3. Three independent breakages, all from `01f6e4c`

**(a) Nav reorg: "Ca làm việc" moved out of "Quản trị"**

`apps/admin/src/shell/nav-registry.ts` diff: the `shift-config` nav entry
moved from the `admin` module (label `'Quản trị'`, gated `roles:
['super_admin']`, permission `compensationPolicy.manage`) into the `hr`
module (label `'Nhân sự'`, permission `shift.manage`). Comment in the diff
explains this was itself a bug fix — the old placement hid the screen from
the very roles the permission granted it to (only super_admin ever saw a
super-admin-only module).

3 specs still hardcode the *old* module label:
```
apps/e2e/tests/journeys/shift-config-admin.journey.ui.spec.ts:42
apps/e2e/tests/journeys/checkin-offsite-approval.journey.ui.spec.ts:92
apps/e2e/tests/journeys/shift-register-approve-reject.journey.ui.spec.ts:79
  await menuNav(page, 'Quản trị', 'Ca làm việc', { role: 'super_admin' });
```
CI error (verbatim, first failure in log):
```
Error: menuNav: entry "Quản trị → Ca làm việc" is not visible in the
side-nav (role: super_admin) — either the permission gate hid it (§4.3
regression) or the label changed.
  at apps/e2e/src/journey/menu-nav.ts:70
  at apps/e2e/tests/journeys/checkin-offsite-approval.journey.ui.spec.ts:92
```
Matches exactly — the entry is now under `'Nhân sự'`, not `'Quản trị'`.

**(b) `parentEmail` became required on the receipt-create form**

`apps/admin/src/pages/finance/receipt-create.tsx` diff:
```diff
-  if (values.parentEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.parentEmail))
+  if (!values.parentEmail.trim()) errors.parentEmail = 'Vui lòng nhập email phụ huynh';
+  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.parentEmail))
```
+ `isRequired` added to the `TextInput`. Rationale in the diff comment:
parent email is now the LMS OTP login credential, so a receipt without one
locks the child out.

The shared e2e helper `apps/e2e/src/journey/provision-student-via-receipt.ts:85`
only fills the email field `if (options.parentEmail)` — i.e. still treats
it as optional. `crm-receipt.journey.ui.spec.ts` (and siblings) create the
CRM contact with only name + phone (lines 76-77), never fill "Email phụ
huynh", then click submit and assert navigation to `/finance/{uuid}`.

CI error:
```
Error: expect(page).toHaveURL(expected) failed
Expected pattern: /\/finance\/[0-9a-f-]{36}$/
Received string:  "http://localhost:4173/finance/new?opportunityId=..."
  at apps/e2e/tests/journeys/crm-receipt.journey.ui.spec.ts:127
```
Client-side validation now blocks the submit silently — the form never
navigates. This is the single biggest blast radius: every journey that
creates a receipt without supplying a parent email is hit — `crm-receipt`,
`finance-receipt`, `enrollment-second-class`, `receipt-approve-negation`,
`recon-exceeds-threshold`, `session-assessment-roster` (and transitively
anything chaining off a receipt: `kpi-submit-confirm-bulk-approve`,
`payroll-assemble-finalize`, `grading-submission`, the `lms-*` journeys that
provision a student via receipt).

**(c) New required "Vai trò" (roles) field on the create-staff dialog**

`apps/admin/src/pages/admin/users.tsx` diff adds a `MultiSelector` for
`roles` to the create-staff form and makes it required:
```diff
   const isFormValid =
     form.userId.trim().length > 0 && ... &&
-    form.position.trim().length > 0;
+    form.position.trim().length > 0 &&
+    form.roles.length > 0 &&
+    (form.tempPassword.length === 0 || form.tempPassword.length >= PASSWORD_MIN_LENGTH);
```
Rationale in diff comment: an account with no role can log in but reach
nothing.

`apps/e2e/src/journey/create-staff-via-admin-ui.ts` (the only UI path that
creates an `AppUser`, used by many journeys) fills User ID / Họ tên / Email /
Vị trí and clicks "Tạo" — it never touches the new "Vai trò" field in the
*create* dialog. It only interacts with a *different* "Roles" MultiSelector
in a *separate* post-creation roles-assignment modal (via the optional
`roleLabels` param). With `isFormValid` now requiring roles, "Tạo" is
effectively blocked; `findInList` never finds the new row; the test hits its
30s timeout, and the `finally { await context.close() }` races the
already-aborted test:
```
Test timeout of 30000ms exceeded.
Error: browserContext.close: Target page, context or browser has been closed
  at apps/e2e/src/journey/create-staff-via-admin-ui.ts:117
  at apps/e2e/tests/journeys/checkin-punch.journey.ui.spec.ts:42
```
Same helper/error signature hits `checkin-punch`, `payroll-roster`,
`session-assessment-roster`, `user-admin-roles`.

### Hypotheses considered and eliminated

- **Infra/compose changes (`5fa2b6a`, `f354e20`) caused it** — eliminated:
  neither touches `apps/admin`, `apps/e2e`, or `apps/api`; CI uses its own
  service containers (`postgres16`), not local-sim compose.
- **Flake/environment (CI resource, timing)** — eliminated as the primary
  cause: the failures are 100% reproducible (fail + retry both fail, same
  assertion) and map 1:1 to specific line-level diffs, not intermittent
  timing. (The 30s-timeout-then-context-close failures for (c) look
  flake-shaped but the underlying block is deterministic — the create
  button never yields a valid submission.)
- **`e563f51f` (docs consolidation) is the cause** — eliminated: `git show
  --stat e563f51f` touches only docs/journals; it was HEAD at CI time by
  coincidence (pushed 8s after `01f6e4c`).
- **API/tRPC contract broke** — eliminated: `apps/api` changes in this
  window (`user/router.ts`, `parentAccount/router.ts`, etc.) keep
  `parentEmail`/roles optional server-side per the diff comments ("API still
  accepts it as optional... back-office repairs keep working"); the non-UI
  `e2e` job (tRPC-level) stayed green (20 passed). The break is entirely in
  the browser-driven UI layer's stricter *client-side* validation and nav
  structure, not the API.

## Proposed fix (not implemented — read-only investigation)

Three independent, low-risk e2e-only changes, no production code touched:

1. **Nav path**: update the 3 `menuNav(page, 'Quản trị', 'Ca làm việc', ...)`
   calls to `menuNav(page, 'Nhân sự', 'Ca làm việc', ...)` in
   `shift-config-admin.journey.ui.spec.ts`,
   `checkin-offsite-approval.journey.ui.spec.ts`,
   `shift-register-approve-reject.journey.ui.spec.ts`.

2. **Parent email**: make `provision-student-via-receipt.ts` (and any inline
   receipt-creation flow, e.g. in `crm-receipt.journey.ui.spec.ts`) always
   fill "Email phụ huynh" with a generated test address instead of treating
   it as optional — mirrors the product's new required-field contract.
   Every journey currently omitting it needs a supplied `parentEmail` (or a
   default inside the shared helper so call sites don't all need editing).

3. **Staff roles**: `createStaffViaAdminUi` needs to pick at least one role
   in the *create* dialog before clicking "Tạo" (the new `MultiSelector`
   labeled "Vai trò", distinct from the post-creation "Roles" modal it
   already drives). Likely: add a required `roleLabels`-equivalent param for
   the create-time field, or default to a sensible role when
   `opts.roleLabels` is empty, then keep the existing post-creation modal
   logic for anything needing a *different* set than the one picked at
   creation.

Suggest fixing (2) and (3) first — they cover the majority of the 21 failing
specs — then (1) for the remaining 3. After the e2e-side fix, also consider
removing `continue-on-error: true` on `ui-e2e` (or gating merges on it) so
this class of regression fails the run instead of being silently masked —
noted as a monitoring gap, not implemented here per read-only scope.

## Unresolved questions

- `kpi-submit-confirm-bulk-approve` and `payroll-assemble-finalize` failures
  show ~3min duration (vs typical 6-10s) before failing — worth confirming
  they're hitting the same receipt/parentEmail chain rather than a separate
  slow-timeout issue; not fully traced line-by-line in this pass.
- Whether any journeys assert on the *old* `/finance/new` deep-link email
  being optional (i.e., intentionally testing the no-email path) — if so
  those specs need a design decision, not just a fill-in-email patch.
- Full list of all 21 failing spec names beyond the ones enumerated above
  was cross-checked from the `✘` tick list, not individually root-caused
  line-by-line; grouped by the 3 mechanisms above with high confidence based
  on which journeys touch receipt-creation vs staff-creation vs shift-config
  nav, but a couple of the "3 min" ones warrant a second look before
  patching.

Status: DONE
Summary: Root cause is commit `01f6e4c` (2026-08-01), which shipped 3 correct admin UX/validation fixes (moved shift-config out of the Quản trị nav module, made parent email required on receipt-create, made roles required on staff-create) without updating the `apps/e2e` Playwright journeys/helpers that assumed the old, looser contracts — 21 ui-chromium specs now fail deterministically; `ui-e2e`'s `continue-on-error: true` masked it at the run level.
Concerns/Blockers: none blocking; see Unresolved questions above for two specs worth a second look before implementing the fix.
