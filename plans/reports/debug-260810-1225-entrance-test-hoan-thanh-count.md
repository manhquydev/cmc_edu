# Debug report — entrance-test journey "Hoàn thành" count(0) failure (3, not 0)

## Verdict

**Root cause: (C) — genuine e2e-spec staleness / locator-specificity gap.**
Not (A) DB pollution, not (B) an appointment complete/no-show behavior regression.
**Confidence: high** (proven with source + a first-party unit test that asserts the exact
colliding accessible-name shape, plus git history showing the collision is newly introduced
in this same merge). No local repro attempted — static analysis alone gave conclusive proof;
spinning up postgres+dev servers was unnecessary and would have cost more than it added.

## The bug

`page.getByRole('button', { name: 'Hoàn thành' })` at
`apps/e2e/tests/journeys/entrance-test-appointment.journey.ui.spec.ts:144` uses Playwright's
**default name matching**, which is substring + case-insensitive (confirmed via Playwright docs
search — `exact: false` is the default; `exact: true` is required for full-string match). It is
not scoped to the appointment list.

`WorkflowStatusbar` (rendered at `apps/admin/src/pages/crm/opportunity-detail.tsx:389-413`) shows
all 5 opportunity stages via `ProgressSteps`
(`packages/ui/src/components/progress-steps.tsx:15-46`). For any step whose `state !== 'todo'`,
the button gets an **sr-only accessible-name suffix**:
```
{state === 'done' ? 'Đã hoàn thành' : 'Đang thực hiện'}
```
(`progress-steps.tsx:36-39`), producing an accessible name like `"Tiếp cận Đã hoàn thành"`.

By the end of the journey the opportunity is at `O4_TESTED` (asserted at spec line 148),
so in the 5-stage array `['O1_LEAD','O2_CONTACTED','O3_TEST_SCHEDULED','O4_TESTED','O5_ENROLLED']`,
`activeIndex = 3`. Steps `i=0,1,2` (O1, O2, O3) are all `state='done'` → each gets the
`"... Đã hoàn thành"` suffix → each button's accessible name **contains** `"Hoàn thành"`
case-insensitively. `i=3` (current) says `"Đang thực hiện"` (no match); `i=4` (todo) has no
suffix at all. **That's exactly 3 buttons** — matching the reported "resolved to 3 elements",
deterministically, on every run and every retry, because it's a fixed function of which stage
index the journey lands on — not of any leftover data from other tests.

Independent proof of the exact accessible-name shape: the component's own unit test,
`packages/ui/src/components/progress-steps.test.tsx:36-39`, literally asserts
`screen.getByRole('button', { name: /thông tin tuyển sinh rất dài.*đã hoàn thành/i })` for a
"done" step — i.e. the library's own test confirms `"<label> Đã hoàn thành"` is the intended,
correct accessible name for that state.

## Why this is new (not a pre-existing, already-green collision)

- `git show b318a3f:packages/ui/src/components/progress-steps.tsx` — at the last-green commit,
  the button had only two spans (`aria-hidden` number + visible label). **No sr-only
  state-announcement text existed.** No collision was possible.
- `git log --oneline b318a3f..943652f -- packages/ui/src/components/progress-steps.tsx` →
  `ff862e2` (introduced the sr-only "Đã hoàn thành."/"Đang thực hiện." announcement, as
  `console-steps-status-sr`) and `7423eae` (a11y refinement, renamed to `console-sr-only`,
  same text). Both land inside the `b318a3f..943652f` range — i.e. this a11y feature is a
  **genuine new addition shipped in this same merge**, just in a different file than the
  picker migration everyone already fixed.
- `opportunity-detail.tsx` itself: `git diff b318a3f 943652f -- apps/admin/src/pages/crm/opportunity-detail.tsx`
  is 100% cosmetic (CSS var swaps for color/fontSize/margin) — confirms the appointment-list
  rendering logic (`opportunity-detail.tsx:598-646`, action buttons gated on
  `appt.status === 'scheduled'`) is unchanged and correct.

## Hypotheses considered and eliminated

1. **(A) Shared-DB pollution from the 14 upstream picker failures.** Eliminated:
   `testAppointment.forOpportunity` (`apps/api/src/appointment/router.ts:76-86`) filters by
   `facilityId` **and** `opportunityId`, and this journey creates a fresh opportunity every run
   (`randomUUID()`-suffixed lead name → its own new `opportunityId`). Pollution from unrelated
   opportunities cannot leak into this query. Also, the count (3) is fully explained by a
   deterministic UI mechanism unrelated to row count, and would reproduce identically on a
   clean DB.
2. **(B) Genuine regression in complete/no-show flow.** Eliminated: read
   `apps/api/src/appointment/router.ts:155-224` (`complete`, `noShow`) — both use
   `updateMany({ where: { id, facilityId, status: 'scheduled' } })`, correctly scoped by
   appointment id, no duplicate-row creation path exists in `schedule`/`complete`/`noShow`.
   `use-test-appointment-actions.ts` invalidation is unchanged in logic (already
   commented/known-workaround via `page.reload()` in the spec itself for the two pre-existing,
   already-documented stale-cache defects). `opportunity-detail.tsx` appointment-list JSX diff
   is cosmetic only (see above).
3. **(C) e2e-spec staleness from a UI change in the same merge.** Confirmed — see above.

## Proposed fix (NOT applied — scratchpad only, per instructions)

`/tmp/claude-1000/-home-manhquy-Downloads-cmc-edu/64863ed8-28bb-4a1c-bec1-65b43f66b3b6/scratchpad/entrance-test-appointment.spec.patch`

Add `exact: true` to the two count(0) assertions at
`apps/e2e/tests/journeys/entrance-test-appointment.journey.ui.spec.ts:144-145`:
```ts
await expect(page.getByRole('button', { name: 'Hoàn thành', exact: true })).toHaveCount(0);
await expect(page.getByRole('button', { name: 'Vắng mặt', exact: true })).toHaveCount(0);
```
This restores the assertion's intent (catch real leftover appointment action buttons) without
matching the stepper's `"<label> Đã hoàn thành"` / `"<label> Đang thực hiện"` sr-only text. The
CRM action buttons' `label` prop is the literal string `"Hoàn thành"`/`"Vắng mặt"` with no
decoration, so `exact: true` is a pure narrowing — no risk of it now missing a real leftover
button. Line 149 (`'Đặt lịch test'`, exact match not needed) and 149's stepper labels (none
contain `"Đặt lịch test"` as a substring) were checked and are not at risk.

No application-code change is needed or recommended — the sr-only stepper text is desired,
correct a11y behavior (has its own passing unit test); the assertion just needs to stop being
accidentally broad.

## Unresolved questions

- None blocking. Optional: whether to also proactively add `exact: true` to *other* CRM/CRM-adjacent
  journeys that assert `toHaveCount(0)` on short Vietnamese action-button labels near a
  `WorkflowStatusbar`/`ProgressSteps` — same substring-collision class of bug could recur
  wherever a button label is a short common word/phrase. Not scoped to this task; flagging for
  awareness only, no repo-wide search performed.

Status: DONE
Summary: Root cause is (C) — spec's default (substring, case-insensitive) `getByRole` name match on `'Hoàn thành'` at line 144 collides with new sr-only "<label> Đã hoàn thành" text added to `WorkflowStatusbar`'s done/current steps (progress-steps.tsx, commits ff862e2/7423eae, both inside b318a3f..943652f); at end-state O4_TESTED, 3 stepper steps (O1/O2/O3) are "done" → 3 false matches. Fix is `exact: true` on the two assertions (patch in scratchpad); no application code change needed.
