# Post-Merge Quality Audit — Premium ERP Screen Build-out

**Date:** 2026-07-12 01:16 (local Asia/Ho_Chi_Minh)
**Scope:** Merged main HEAD `414bfb3` — 8-phase premium build-out (21 admin screens), spanning `291b2fd..HEAD`.
**Purpose:** Post-merge cross-cutting quality audit — hunt for defects per-phase reviews + red-team missed.
**Verification bar:** admin vitest 189/189, @cmc/ui vitest 45/45, `tsc -p apps/admin/tsconfig.json --noEmit` clean.

---

## Summary

One HIGH-severity latent bug (data-loss/crash on user action). Two MEDIUM ergonomic defects. Handful of LOW/INFO items. No CRITICAL blockers; merge does not need to be reverted.

The most notable finding is a **twin bug that the phase-07 commit message explicitly claims it fixed** (`f41bea9`: "Fixed latent post-await e.currentTarget null-deref in session-evidence upload") — but the identical anti-pattern still lives one file over in `exercises.tsx`. Per-phase red-team validated `session-evidence.tsx` in isolation and did not extend the fix to the sibling with the same shape.

---

## HIGH

### H1. `exercises.tsx` — post-await `e.currentTarget` null deref (identical to session-evidence bug that WAS fixed)

**File:** `apps/admin/src/pages/teaching/exercises.tsx:270-274`

```tsx
onChange={async (e) => {
  const file = e.currentTarget.files?.[0];   // OK — sync access
  if (file) await handlePdfUpload(file);      // yields to microtask
  e.currentTarget.value = '';                 // BUG — e.currentTarget is null here
}}
```

**Compare — same phase, sibling file, FIXED shape** at `session-evidence.tsx:258-266`:

```tsx
onChange={async (e) => {
  const input = e.currentTarget;   // capture node synchronously
  const file = input.files?.[0];
  if (file) await handleUploadPhoto(file);
  input.value = '';                // uses captured ref
}}
```

**Failure scenario:** Teacher clicks "Chọn file PDF" inside the exercise-create dialog → picks a PDF → `handlePdfUpload` awaits (network round-trip to `/upload/exercise-pdf`). During that await React clears `currentTarget` on the SyntheticEvent. When the await resolves, `e.currentTarget.value = ''` throws `TypeError: Cannot read properties of null (reading 'value')`. The upload actually succeeded server-side and `pdfBlobRef` was set (that state update happened before the null-deref), but the input node isn't reset — so if the teacher picks the SAME file again to correct a mistake, the browser suppresses the second `change` event (identical value), and the upload silently no-ops. The exception also propagates as an unhandled promise rejection which is user-facing noise.

**Evidence this predates the merge but was in-scope:** `git show 5210d3d:apps/admin/src/pages/teaching/exercises.tsx` shows the same bug pre-Astryx. Phase-07 diff touched this file (`git show f41bea9 --stat -- exercises.tsx` = 25 lines changed) so it was actively in the reviewer's field of view. The phase-07 commit message *specifically calls out fixing this exact pattern* in `session-evidence.tsx`. This is a copy-paste symmetry that a per-file red-team could not have caught but a post-merge grep did.

**Fix (mechanical, matches session-evidence):**

```tsx
onChange={async (e) => {
  const input = e.currentTarget;
  const file = input.files?.[0];
  if (file) await handlePdfUpload(file);
  input.value = '';
}}
```

**Classification:** (a) fix in the next phase / hotfix branch — not a merge revert, but should not wait for the next feature cycle. Same class of test the red-team added for session-evidence should be added for exercises.tsx to prevent regression.

---

## MEDIUM

### M1. `pdf-annotator.tsx` — `useEffect` blindly resets teacher's in-progress edits on any `teacherLayer` reference change

**File:** `apps/admin/src/pages/teaching/pdf-annotator.tsx:74-77`

```tsx
useEffect(() => {
  setTeacherText(serializeLayer(teacherLayer));
}, [teacherLayer]);
```

**Failure scenario:** Teacher is mid-typing a JSON annotation layer. Any parent-side action that triggers a submission refetch (e.g., another teacher grades, `onSaved` cascades an invalidate, refocus refetch, etc.) will change `teacherLayer` by reference (fresh JSON object from tRPC), and this effect will overwrite `teacherText` — silently discarding the teacher's unsaved keystrokes. Content-equal reference change is enough (no deep compare).

**Pre-existing:** This code was not authored by phase-07 — the commit only wrapped the containers in `Card`. But the effect is now inside the audit surface via the phase-07 diff (28 lines touched, and reviewers had the file open). Not a regression, but the reviewers had opportunity to spot it.

**Fix options (pick one, get user sign-off — this is UX judgment):**
- Compare serialized string: only reset if `serializeLayer(teacherLayer) !== teacherText`.
- Reset only on `submissionId` change (real navigation): `}, [submissionId, teacherLayer]);` gated by an `isDirty` ref.
- Warn the teacher (banner) that a fresher server version exists and offer a manual "reload from server" button.

**Classification:** (b) — next phase, treat as a real bug ticket. Product decision needed on optimistic-merge vs explicit reload.

### M2. `payroll.tsx` — `mutError` mixes error state across three unrelated mutations, sticky banner across state transitions

**File:** `apps/admin/src/pages/hr/payroll.tsx:107-110`

```tsx
const mutError =
  assembleMut.error?.message ??
  finalizeMut.error?.message ??
  reopenMut.error?.message;
```

React-Query keeps mutation errors sticky until the same mutation is retried or `.reset()` is called. Scenario: `assemble` fails → banner shows. Payslip moves to `draft` via a manual DB fix / different session. User comes back, sees payslip in draft, clicks `finalize` (succeeds) → but the assemble error banner is still there because `assembleMut.error` hasn't been reset. UX shows a stale error next to a successful state.

**Fix:** wire `onSuccess/onError` for each mutation to `.reset()` the OTHER two, or track a single `latestErrorAt` ref and only surface the most recent.

**Classification:** (c) — backlog acceptable; UX confusion not data corruption.

---

## LOW

### L1. `rewards.tsx` — global `isPending` on every row action button

**File:** `apps/admin/src/pages/engagement/rewards.tsx:111,120,129`

`approveMut.isPending` is applied uniformly to every "Duyệt" cell across the entire table. Clicking Duyệt on row A causes Duyệt buttons on rows B..Z to also render as loading. Same for Giao quà / Từ chối. No data risk (row-scoped mutation payload is correct), but the loading affordance is misleading, and a rapid double-click on the same button is not visually disabled because Astryx Button's `isLoading` shows a spinner but does not by default block re-invocation — the underlying tRPC mutation is not idempotent server-side (approve of an already-approved reward → server error surfaces via the invalidate refetch).

**Fix:** track `pendingRowId` state, gate each button's `isLoading`/`isDisabled` per row.

**Classification:** (c) — backlog; not a data bug because server rejects double-approve.

### L2. `revenue-report.tsx` — dead client-side filter

**File:** `apps/admin/src/pages/finance/revenue-report.tsx:174`

```tsx
const totalApproved = items.filter((r) => r.status === 'approved').length;
```

`trpc.finance.receiptList.useQuery({ status: 'approved', ... })` already filters server-side, so `items.filter(r => r.status === 'approved').length === items.length` is always true. Harmless — but the aggregate `aggregateByBatch` (line 33 also gates on `r.status !== 'approved' && continue`) applies the same redundancy. Both are safe: aggregate guards against server contract drift. `totalApproved` is just dead code.

**Fix:** `const totalApproved = items.length;` (or reuse `aggregateByBatch`'s summed `count`).

**Classification:** (c) — backlog; cosmetic.

### L3. `shifts.tsx` — module-scoped `_keyCounter` shared across mounts

**File:** `apps/admin/src/pages/attendance/shifts.tsx:57-60`

```tsx
let _keyCounter = 0;
function newEntry(): EntryRow {
  return { _key: ++_keyCounter, date: '', shiftTemplateId: '' };
}
```

Module-level mutable state. Two mounts of `SubmitTab` in the same session (tab switch away + back) will keep incrementing — fine for React `key` uniqueness. But under Vite HMR, edits to this file reset the counter mid-session while React retains stale entry keys; keys can collide after a hot reload. Not user-visible in prod. Not a bug per se.

**Fix (optional):** `const keyRef = useRef(0);` inside the component. Trivial.

**Classification:** (c) — backlog; DX-only nit.

---

## INFO / NON-ISSUES (verified, not defects)

- **I1. Astryx `<Button>` default `type` is `'button'`, NOT `'submit'`.** Confirmed by inspecting `@astryxdesign/core@0.1.4/dist/Button/Button.js` line 291. The auxiliary buttons inside `<form>` in `receipt-create.tsx` (Hủy, ← Quay lại) and `shifts.tsx` (Xóa, + Thêm ngày) are therefore safe — clicking them does NOT accidentally submit the form. Explicit `type="submit"` is set only on the intended submit buttons.
- **I2. Nav-registry gap is pre-existing.** `apps/admin/src/shell/nav-registry.ts` does not surface links to `/admin/engagement/*`, `/admin/network-ip`, `/admin/shift-config`, `/admin/report-cards`, `/hr/checkin|shifts|payroll|kpi`, `/finance/new`. This audit confirmed via `git log -- apps/admin/src/shell/nav-registry.ts` that the file has not changed since `1b0b857` (pre-build-out). These routes existed pre-merge with the same discoverability gap. Not a regression from this build-out; log as backlog for shell/nav owner.
- **I3. Docs metric claims are accurate.**
  - `codebase-summary.md` claims "189 tests" for admin — verified `Test Files 25 passed (25), Tests 189 passed (189)`.
  - Claims "45 tests" for @cmc/ui — verified `Test Files 12 passed (12), Tests 45 passed (45)`.
  - Claims "14/14 apps build clean" — not re-verified this session (per audit instructions, build was already xanh); trust as-is.
  - Claims LineIcon "forward `data-icon` attribute" — verified in `packages/ui/src/components/line-icon.tsx:52`.
  - Claims "5 premium keys (globe, clock, trophy, gift, star)" — verified in same file lines 14, 41-45.
- **I4. TODO(astryx-review) markers are pre-declared and consistent.** Grep found 35+ TODO(astryx-review) markers across pages; every one has a comment explaining what Astryx primitive was missing (Text color enum, Divider labelPosition, Dialog focus-trap, NumberInput thousand separator, Selector nothingFoundMessage, TextArea autosize). These are documented technical debt, not silent workarounds.
- **I5. Test authenticity.** Zero `.skip` / `.todo` / `.only` / `xit` / `xdescribe` across all admin test files. `mock-trpc.ts` mocks only the tRPC-React seam; every test asserts the mutation `.mutate()` payload byte-for-byte, so mock scope does not obscure business logic.
- **I6. No inline `<svg>` bespoke icons.** All iconography routes through `LineIcon`. Search returned zero page-level `<svg` or hand-rolled `<path d="…" />` in `apps/admin/src/pages`.
- **I7. Circular / cross-page imports.** Only intra-directory import is `grading.tsx` → `pdf-annotator.tsx` (embedded widget, expected).
- **I8. Dead-file check clean.** `finance/index.tsx` was removed in `7502b46` — grep for `pages/finance/index` returns zero remaining references. No other unrouted pages found.
- **I9. `<a href>` used instead of react-router `<Link>` in `reconciliation.tsx:132`.** Comment explicitly documents this as "matches the original the prior anchor's full-page-navigation behavior exactly." Intentional; the flag deep-link is designed to trigger a hard reload so the receipt-detail SSR flag state resets. Not a bug.
- **I10. `retry: false` on `kpi.getForUser` and `payslip.getForUser`.** Intentional per file comments — a 404 (no record for this period) is expected, not exceptional. Correct pattern.

---

## Behavioral checklist

- Concurrency / race: **H1 above** (post-await stale ref); no other race found.
- Error boundaries: all mutations either have `onError` handlers or route errors via `.error?.message` to `Banner`. No swallowed errors.
- API contracts: mutation payloads unchanged; tests lock byte-identity across the diff.
- Backwards compat: no schema, no exported-API drift. `@cmc/ui` LineIcon additively extended (approved per plan Open decision #1).
- Input validation: form validation preserved (UUID regex, date format, phone dedup). Server-authority pattern intact.
- Auth/authz: `canDo(...)` gates preserved across rewards / reconciliation / kpi / payroll / shifts. Server remains authoritative.
- N+1 / query efficiency: pipeline dashboard fetches `pageSize: 100` opportunities once, aggregates client-side — no N+1. Revenue report same. Both banners disclose truncation.
- Data leaks: no PII or stack traces surfaced beyond `err.message`. Server-owned redaction preserved.
- Fact-check vs plan: plan claims "21/21 screens migrated" — verified against `apps/admin/src/pages/**/*.tsx` (35 non-test .tsx; deducting stubs, exemplars, and details = 21 migrated as claimed).

---

## Recommended Actions

1. **HOTFIX H1:** patch `exercises.tsx` post-await `e.currentTarget` bug using the session-evidence pattern; add a vitest case mirroring `session-evidence.test.tsx`'s upload-then-null-deref regression guard.
2. **Backlog M1:** decide product policy for pdf-annotator refetch-vs-in-progress-edits and implement whichever option the PO picks; add a test.
3. **Backlog M2:** consolidate payroll's tri-mutation error surface into a most-recent-error pattern with cross-reset.
4. **Backlog L1:** per-row loading gate on `rewards.tsx` action buttons.
5. **Backlog L2/L3:** cleanup only when touching those files anyway.
6. **Non-audit:** owner of `shell/nav-registry.ts` should decide whether to expose engagement/HR/report-cards/network-ip/shift-config in the side nav (pre-existing gap, out of this plan's scope).

---

## Unresolved Questions

- **Q1:** For M1 (pdf-annotator), is the intended UX to allow concurrent teacher edits with server-fresh awareness, or should refetch always win? Needs PO decision.
- **Q2:** For I2 (nav-registry), was omitting these paths a deliberate soft-launch decision, or an oversight from the design-language merge? Owner: shell/nav module.
- **Q3:** For H1, should there be a lint rule (`no-currentTarget-after-await`) added to prevent future recurrence? Custom ESLint rule feasibility TBD.

---

```
Status: DONE_WITH_CONCERNS
Summary: Post-merge audit found 1 HIGH latent bug (exercises.tsx e.currentTarget stale ref — identical twin of the phase-07-fixed session-evidence bug), 2 MEDIUM ergonomic defects, 3 LOW nits, 10 verified non-issues (including Astryx Button type='button' default). Merge does not need reverting; H1 should be hotfixed before the next admin release.
Blockers: none — H1 is a recommended hotfix, not a merge-revert trigger.
Report: D:\project\vip\CMC\plans\reports\code-review-260712-0116-post-merge-quality-audit-premium-buildout-report.md
```
