# Red-Team Pre-Merge Review — `feat/premium-erp-buildout`

Date: 2026-07-12
Reviewer: code-reviewer (adversarial pass)
Branch: `feat/premium-erp-buildout` (8 commits) → `main`
Scope: 54 files, +4626/-886. apps/admin (21 screens + 6 test/harness) + packages/ui LineIcon + pnpm-lock. Zero apps/api changes (confirmed).

## Verdict

**MERGE-READY.** No blockers. All verification gates pass; no contract drift; clean merge topology. A handful of LOW/MEDIUM backlog items below — none block merge.

## Verification run (this review, not trusted from per-phase)

| Gate | Result |
|------|--------|
| `apps/admin` vitest | 193 passed / 26 files |
| `packages/ui` vitest | 45 passed / 12 files |
| `apps/admin` tsc --noEmit | exit 0 |
| One-door rule (no `@astryxdesign`/`@mantine` in `apps/admin/src/pages`) | 0 violations |
| Merge topology (`merge-base` vs `main` HEAD) | equal → clean fast-forward, no textual conflict |

## Contract-drift audit (the primary red-team target) — CLEAN

Spot-checked every payload-critical screen against the diff and, for the net-new one, against the backend. All wire payloads byte-identical; tests explicitly lock them:

- **receipt-create** (money): `finance.receiptCreate.mutate({studentName, parentPhone, parentEmail, classBatchId, amount, opportunityId})` — trim + opportunityId attach locked. `classBatch.list({pageSize:100})` and `opportunityGet` `enabled` flag locked.
- **users** (RBAC): `user.updateRoles.mutate({appUserId, roles})` (NOT `userId`) and `user.create({userId,email,fullName,position})` locked; `user.manage` permission gate preserved (premium EmptyState on deny).
- **payroll / kpi**: `{kpiScoreId}` confirm/approve, assemble/finalize/reopen unchanged — only the `selectedUser` branch was wrapped in `DetailPage`; mutations untouched. ConfirmDialog gating locked.
- **rewards** (net-new, stub→real): `{rewardId}` for approve/deliver/reject and `{status}` for list — verified byte-for-byte against `apps/api/src/rewards/reward-router.ts` (approve L119, deliver L146, reject L188, list L245). Client status-gating (approve=pending, deliver=approved, reject=pending|approved) mirrors server lifecycle guards exactly. `list` returns a plain array (findMany, L256) so client `data as RewardRow[] ?? []` cast is correct — no shape drift.
- **shifts**: register `entries.map(...=>({date, shiftTemplateId}))` shape identical (only loop var `e`→`e2`); `approve/cancel.mutate({registrationId})` preserved.
- **session-evidence** (PII upload): upload target `/upload/session-photo`, `addPhoto`, `upsert({classSessionId,summary})`, `publish({sessionEvidenceId})` all locked by tests; capture-before-await fix is a genuine correctness improvement (event no longer dereferenced post-await).
- **attendance markAll** (bulk): mutate call unchanged; only `isLoading` placement moved.

## Findings

### CRITICAL — none

### HIGH — none

### MEDIUM

1. **`apps/admin/src/pages/finance/index.tsx` is dead code and now has a test locking it.** `FinancePage` is imported only by its own `index.test.tsx`; the `/finance` index route resolves to `ReceiptListPage` (`routes/finance.routes.tsx:5,17`), and no route imports `finance/index.js`. The orphan is pre-existing (routes unchanged from main), but this branch added an 89-line test (`index.test.tsx`) that gives false confidence in an unreachable screen. Fix: delete `finance/index.tsx` + `finance/index.test.tsx`, or wire it into a route. Not a merge blocker (no runtime impact).

2. **`rewards` list is capped at 50 rows with no pagination UI.** `rewards.list` input defaults `pageSize:50` + `cursor` (reward-router.ts:249-250); the screen calls `useQuery({status})` only. In a busy facility, pending redemptions beyond the newest 50 are silently hidden from the staff queue. Fix (backlog): add cursor pagination or raise pageSize with an explicit "showing N" affordance.

3. **`rewards` screen has no client-side permission gate (inconsistent with `users`).** `users.tsx` pre-gates on `user.manage` and renders a premium EmptyState; `rewards.tsx` renders the table unconditionally and lets `rewards.list` (server-guarded `rewards.manage`) error into the DataTable error slot for unauthorized roles. Not a security hole (server is authority, no data leak) but a cross-screen UX inconsistency. Fix (backlog): add the same `canDo('rewards','manage')` gate for parity.

### LOW

4. **`receipt-create.test.tsx` "navigates to the new receipt" asserts nothing about the destination.** The test invokes `createOnSuccess({receipt:{id:'new-receipt-1'}})` but never asserts `navigate` was called with `/finance/new-receipt-1`. It guards against a throw but does not lock the nav target. Add an assertion on the navigation destination.

5. **Icon-test selector inconsistency.** `leaderboard.test.tsx` checks `container.querySelector('svg')` (any svg) while `network-ip`/`shift-config` use the stronger `svg[data-icon="globe|clock"]`. Tighten leaderboard to `svg[data-icon="trophy"]`.

6. **Dialog a11y is polyfilled away, not tested.** `test-setup.ts` stubs `HTMLDialogElement.showModal/close` to just toggle the `open` attribute — no focus-trap/ESC/backdrop. The `TODO(astryx-review)` focus-trap concern in `users.tsx` is therefore unverified by any test. Acceptable jsdom shim, but the modal-a11y claim rests on manual QA, not the suite.

## Cross-cutting consistency — GOOD

- Banner-vs-ResultPanel deviation applied uniformly: every FormPage screen (receipt-create, session-evidence, shifts) uses a guarded `const resultContent = x ? <Banner ... description/> : undefined` — `result.ok`/`.message` never dereferenced when null (shifts.tsx:131,290).
- ListPage/FormPage/DetailPage archetypes used consistently; back-button chevron `rotate(180deg)` span identical in kpi + payroll.
- `FilterBar` (pre-existing, URL-synced) reused by rewards exactly as by receipt-list/schedule; rewards reads `searchParams.get('status')` which FilterBar writes — filter is live.

## Harness assessment — SOUND

- `mock-trpc.ts` mocks only the UI↔network seam (query/mutation result shapes, memoized `useUtils` with stable spy identity). No DB/business-logic mocking — consistent with the repo "no mocks" rule.
- Function-handler pattern lets tests capture `onSuccess` and assert invalidate/refetch sequencing (used correctly across users/receipt/rewards/kpi). `mutate` is a no-op spy, so post-mutation UI is only exercised when the test explicitly fires the captured callback — the reviewed tests do this.
- `clearMocks:true` clears call history, not implementations; module-level spies are re-wired per render via the factory — no cross-test bleed, no order dependence.
- Polyfills (matchMedia no-op, dialog stub) are guarded for the node-env logic tests. Safe.

## LineIcon — additive, non-breaking

+5 keys (globe/clock/trophy/gift/star) appended to the union; existing 12-screen + shell-nav icon names untouched. `data-icon={name}` exposes only the icon identifier (e.g. "shield") — no sensitive data. `star` uses a filled-star path but the svg is `fill="none"`, so it renders as an outline consistent with the set.

## Unresolved questions

- Is `finance/index.tsx` intended for a future route, or should it be deleted? (Decision needed to resolve finding #1 — leader/PO call, not mine.)
- Is the 50-row rewards cap acceptable for phase-01 launch, or does a busy facility need pagination before go-live? (Product judgment — finding #2.)

---
Status: MERGE-READY
Summary: All gates green (193+45 tests, tsc clean, no one-door violations), zero contract drift on money/RBAC/upload/state payloads (backend-verified for the net-new rewards feature), and a clean fast-forward merge. Only LOW/MEDIUM backlog items remain.
Blockers: none
