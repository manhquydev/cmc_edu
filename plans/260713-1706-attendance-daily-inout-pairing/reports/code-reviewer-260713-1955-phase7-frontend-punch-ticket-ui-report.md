# Code Review: Phase 7 — Frontend punch+ticket UI

## Scope
- Files: `apps/admin/src/pages/attendance/check-in-out.tsx` (full rewrite), `apps/admin/src/pages/attendance/check-in-out.test.tsx` (full rewrite, 14 tests)
- Diff: 472 insertions / 183 deletions across the two files (`git diff --stat`) — no other files touched (confirmed via `git status`/`git diff --stat`).
- Verified independently: `pnpm typecheck` (clean), full admin test suite (`pnpm test`) → 235/235 pass, 32 files (the one nested-`<a>` console warning is in an unrelated pre-existing test file, not touched here).
- Focus: review-focus items (a)–(h) from the task brief, plus standard trust-boundary/state-mutation pass.

## Overall Assessment
Solid, idiomatic rewrite that closely mirrors the already-established `shifts.tsx` `ApproveTab`/dialog pattern. The state machine for the 5s auto-revert button and the approve/reject audit-trail pattern (mutation only fires from a dialog's own confirm, never a trigger `onClick`) are both correctly implemented and test-locked. Two real (if low/medium severity) dialog-state-reset bugs were found by tracing the Astryx `Dialog` component's actual `onOpenChange` semantics against this component's usage — neither is caught by the current test suite.

## Critical Issues
None.

## High Priority
**1. `ResubmitDialog` loses the user's typed reason on a failed resubmit.**
`check-in-out.tsx:190-196`:
```tsx
<Button
  label="Gửi lại yêu cầu"
  ...
  onClick={() => { if (ticketId) onConfirm(ticketId, reason.trim()); setReason(''); }}
/>
```
`setReason('')` fires unconditionally and synchronously right after calling `onConfirm` (i.e. `resubmitMut.mutate(...)`) — it does not wait for success. `resubmitMut.onError` (line 235-237) only sets an error banner; it does **not** close the dialog (`resubmitTarget` stays set) and does **not** repopulate the reason. Net effect: if the resubmit mutation fails, the dialog stays open but the textarea is now empty — the user must retype their entire reason from scratch, with no visible cause for the loss.

This deviates from the established `shifts.tsx` `ApproveTab` reject-dialog pattern, which this phase's `OffsiteReasonDialog`/reject-dialog correctly follow: there, `reason`/`rejectReason` is only cleared in `onSuccess` or the explicit "Hủy"/close paths, never as a side effect of the confirm click itself.

Fix: move `setReason('')` into `resubmitMut.onSuccess` (matching the `onClose`+`setReason('')` pattern already used elsewhere in the same file), or clear it via a `useEffect` keyed on `ticketId` transitioning to `null`.

## Medium Priority
**2. `OffsiteReasonDialog`'s `reason` state is never cleared after a successful reasoned punch — stale text can leak into the next offsite prompt.**
Traced through Astryx's `Dialog` source (`node_modules/@astryxdesign/core/src/Dialog/Dialog.tsx`): `onOpenChange` is only invoked by the Dialog itself in response to **user-initiated** dismissal (Escape key, or backdrop click when `purpose` allows it — here `purpose="form"` so only Escape applies). It is *not* called when a parent component changes the `isOpen` prop programmatically.

In `CheckInTab`, `punchMut.onSuccess` closes the modal by calling `setOffsiteModalOpen(false)` directly (`check-in-out.tsx:459`) — this is exactly the programmatic path that does **not** trigger `OffsiteReasonDialog`'s internal `onOpenChange` handler (which is the only place that calls `setReason('')` besides the "Hủy" button and the header's close button). The "Xác nhận" button's own `onClick` also never clears `reason`.

Because `OffsiteReasonDialog` is always mounted (never unmounted — only its `isOpen` prop toggles), its `reason` state is a `useState` local to a component instance that persists across opens/closes. Concretely: user punches offsite, types a reason, confirms successfully → dialog closes, `reason` state still holds the old text. If the user is offsite again later in the same session (next punch attempt), `OffsiteReasonDialog` reopens with the **previous** reason pre-filled instead of blank — stale data bleeding across two logically distinct punch events.

Not a security or data-loss issue (the actual mutate payload is always whatever's currently in the textarea at confirm time — correct at the time of use), but a real UX defect not covered by the test suite (no test reopens the dialog after a successful confirm). Simple fix: `useEffect(() => { if (!isOpen) setReason(''); }, [isOpen]);` inside `OffsiteReasonDialog`, which resets on **any** close path (success, cancel, escape) instead of relying on each call site to remember to reset explicitly.

## Low Priority
**3. Punch/confirm buttons use plain `onClick` + manually-threaded `isLoading`/`isDisabled` rather than the Button component's built-in `clickAction` dedup mechanism.**
`Button` (`@astryxdesign/core`) has a purpose-built `actionInFlightRef` + `startTransition` guard via the `clickAction` prop specifically to dedupe fire-once actions without relying on the caller re-rendering fast enough. This component (and `shifts.tsx`, which it mirrors) instead uses plain `onClick={() => punchMut.mutate(...)}` with `isLoading={punchMut.isPending}` / `isDisabled={recorded}`. Traced `Button.tsx`: `buttonDisabled = isDisabled || groupDisabled || (isLoadingState && !isInterruptible)`, and the native `<button disabled>` attribute is set whenever `buttonDisabled` is true — so this is safe in practice (native `disabled` blocks all activation, including keyboard, until React re-renders with the updated pending/recorded flag), and the backend's `COOLDOWN` guard is a second line of defense. Flagging only as a consistency note, not a defect — this is pre-existing convention carried over from `shifts.tsx`, not something introduced by this phase.

## Edge Cases Found by Scout
- Verified no leftover references anywhere in `apps/admin/src` to the removed `ManualPunchForm`, `manualPunch.create`, or "chấm bù ngày quên" / "Gửi yêu cầu chấm công thủ công" copy (grep across the whole app — only the intentional comments/tests in the two changed files mention the removal). `my-hr.tsx` has no stray references either.
- `CmcTabs` (`packages/ui/src/components/cmc-tabs.tsx`) only renders `active?.content` — inactive tab content (including `ApproveTicketsTab`) is not mounted and its query does not fire until the tab is actually selected. Confirmed via source; the "Duyệt chấm công" test correctly exercises this by clicking the tab before asserting `inboxSpy`.
- `fmtDateTime`'s `if (!v) return '—'` covers `null`, `undefined`, `''`, and any other falsy value uniformly — no `Invalid Date` path reachable from the declared `string | Date | null` row type or from a hypothetical `undefined`.
- `FormPage`'s `header` prop, though typed as required `ReactNode` (not optional), is rendered via a bare `{header}` interpolation with no further property access — passing `null` is 100% safe (`packages/ui/src/components/form-page.tsx:23-32`).

## Review-Focus Checklist (from task brief)
- (a) Double-mutate on offsite path: **not an issue.** `Button`'s `isLoading` prop forces `buttonDisabled=true` natively regardless of the `isDisabled` prop value, so the "Xác nhận" button is unclickable (including via Enter/Space, since the underlying element gets the native `disabled` attribute) for the entire duration `punchMut.isPending` is true.
- (b) 5s timer / rapid re-click: **not an issue.** Same native-`disabled` mechanism applies to the main punch button (`isDisabled={recorded}`); no keyboard bypass is possible on a natively `disabled` `<button>`. Unmount cleanup (`check-in-out.tsx:452-454`) correctly clears whatever timer id `revertTimerRef.current` holds at cleanup time, since the ref is read fresh in the closure rather than captured at effect-creation time.
- (c) Dialog reason state reset: **two real bugs found** — see High #1 (ResubmitDialog over-eager reset) and Medium #2 (OffsiteReasonDialog missing reset after success).
- (d) `ApproveTicketsTab` audit-trail: **confirmed correct** by direct JSX read (`check-in-out.tsx:388-397`). `manualPunch.approve.mutate` is only called from `ConfirmDialog`'s `onConfirm`; the row-level "Duyệt" button's `onClick` only calls `setApproveTarget(row.id)`. Identical structure to `shifts.tsx`'s `ApproveTab`.
- (e) `fmtDateTime` null/undefined handling: **confirmed safe**, see Edge Cases above.
- (f) Dialog-visibility assertion changes (COOLDOWN / generic-error tests): **confirmed genuinely meaningful**, not coincidental. `resultContent`'s ternary (`check-in-out.tsx:478-499`) is mutually exclusive per `punchAlert.kind` — only one banner renders at a time — so asserting the offsite-reason banner text is absent for COOLDOWN/generic-error cases is a real, structurally-guaranteed check.
- (g) Leftover references to removed manual-punch flow: **none found**, see Edge Cases above.
- (h) `FormPage header={null}` safety: **confirmed safe**, see Edge Cases above.

## Positive Observations
- The audit-trail non-negotiable (mutation only from dialog confirm, never trigger click) is correctly replicated for the new approve/reject tab, matching the established `shifts.tsx` precedent exactly.
- The 5s revert timer's ref-based cleanup is textbook-correct (avoids the common stale-closure bug of capturing `.current` at effect-creation time).
- Tab label / button label disambiguation (caught by the TDD test suite itself, per the task summary) reflects the tests genuinely driving real UI decisions, not rubber-stamped assertions.

## Recommended Actions
1. (High) Move `setReason('')` in `ResubmitDialog`'s confirm handler into `resubmitMut.onSuccess`, or gate it behind success, so a failed resubmit doesn't silently wipe the user's typed reason.
2. (Medium) Add a `useEffect(() => { if (!isOpen) setReason(''); }, [isOpen])` to `OffsiteReasonDialog` so reason state resets uniformly on every close path (success included), not just user-initiated Escape/Hủy/X.
3. (Optional, test coverage) Add a regression test that reopens `OffsiteReasonDialog` after a successful reasoned punch and asserts the textarea is empty — would have caught #2 directly.

## Metrics
- Type Coverage: `pnpm typecheck` clean (0 errors).
- Test Coverage: 14/14 new tests pass; full suite 235/235 pass.
- Linting Issues: not run separately (typecheck + full test suite both clean; no lint command was executed in this review pass).

## Unresolved Questions
- None blocking. Confirm with the author whether the two dialog-state-reset bugs (High #1, Medium #2) should be fixed in this phase or deferred — neither breaks the documented Phase 7 success criteria (5s revert, cooldown/offsite banners, ManualPunchForm removal, ticket columns, gated approve tab), but High #1 is a genuine data-loss-on-error UX bug worth fixing before this ships.
