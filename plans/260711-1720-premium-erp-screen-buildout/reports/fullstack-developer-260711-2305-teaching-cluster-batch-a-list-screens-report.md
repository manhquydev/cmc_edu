# Phase 07 batch A — teaching cluster list screens

## Executed
- Plan: `plans/260711-1720-premium-erp-screen-buildout/phase-07-teaching-cluster.md`
- Scope: 3 LIST screens only (schedule, attendance, exercises). Form screens (report-cards, session-evidence, pdf-annotator) untouched — batch B.
- Branch: `feat/premium-erp-buildout` (no commit/push per instruction).

## Files changed
- `apps/admin/src/pages/teaching/schedule.tsx` — wrapped in `ListPage` (header + `FilterBar` slots); view-switch (list/calendar/kanban) body unchanged.
- `apps/admin/src/pages/teaching/attendance.tsx` — wrapped in `ListPage`; `✓ Đã lưu` glyph replaced with `Button icon={<LineIcon name="check-circle" size={16}/>}` (accessible name now "Đã lưu", icon rendered before label).
- `apps/admin/src/pages/teaching/exercises.tsx` — wrapped in `ListPage`; no emoji present (spec: NO).
- New tests (TDD, written+locked green BEFORE each refactor): `schedule.test.tsx` (5), `attendance.test.tsx` (6), `exercises.test.tsx` (8).

## Tasks completed
- [x] schedule → ListPage → green
- [x] attendance → ListPage → green (markAll bulk payload locked)
- [x] exercises → ListPage → green (create/publish/close + invalidate locked)
- [ ] report-cards / session-evidence / pdf-annotator — out of scope (batch B)

## Tests status
- `pnpm --filter @cmc/admin test`: 23 files / 165 tests passed (19 new in this batch).
- `pnpm --filter @cmc/admin typecheck`: clean.
- `pnpm lint` (apps/admin apps/lms): clean.
- `pnpm --filter @cmc/ui test`: 12 files / 45 tests passed, unchanged.

## Contract locks verified
- `classBatch.list.useQuery({page,pageSize,...courseId})` — byte-identical, FilterBar courseId URL param unchanged.
- `attendance.listBySession.useQuery({sessionId})` + `attendance.markAll.mutate({sessionId, entries: RosterEntry[]})` — full bulk record set asserted (2-entry payload with per-row toggle state), no invalidate call (screen relies on local `saved` flag onSuccess, unchanged).
- `curriculumUnit.list.useQuery()`, `exercise.list.useQuery({})`, `exercise.publish/close.mutate({exerciseId})`, `exercise.create.useMutation({onSuccess})` → `utils.exercise.list.invalidate()` on success — all asserted via captured mutation options (mock-trpc function-handler pattern), matching `reconciliation.test.tsx` precedent.

## Deviations / notes
- One test-infra issue surfaced and fixed locally in `attendance.test.tsx`: the page's `useEffect(() => {...}, [data])` mirrors real react-query's stable object identity across renders. A naive per-call `queryResult(...)` mock (fresh object every render) tripped React's "Maximum update depth exceeded" — fixed by caching the mocked query result and only rebuilding it when the underlying test fixture (`items`/`error`) reference actually changes. This is a test-file-only fix (no page logic touched) and follows the same spirit as the existing `prefilled.current` ref-guard pattern in `receipt-create.tsx`'s test.
- `exercises.tsx` DataTable renders exercise "type" labels that collide with the (always-mounted, closed) create-dialog's type Selector text in some Selector implementations — scoped the row-text assertion with `within(screen.getByRole('table'))` to avoid ambiguous multi-match.

## Gate
DONE — all instructed verification commands green.

## Concerns
- `markAll` bulk payload: verified byte-identical for both the untouched-state save and the after-toggle save (2-record roster); no partial-record risk introduced by the `ListPage` wrap since only the header composition moved.
- `exercises` 3 mutations: `publish`/`close` payload (`{exerciseId}`) locked via direct `mutate` assertion; `create`'s `onSuccess → invalidate` locked via captured-options assertion (mutate payload itself was already covered by pre-existing dialog gating logic, untouched).
- No unresolved questions.
