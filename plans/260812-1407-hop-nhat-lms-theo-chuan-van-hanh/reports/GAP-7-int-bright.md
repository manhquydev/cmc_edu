# GAP-7 — Integration tests: Bright I.G gapped teaching spine

**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Scope owned:** `apps/api/src/lms-ops/**` — **tests only** (no business-logic edits in this task)  
**Workflow:** `/ak:test` design + `/ak:cook` implement test file  
**Commit:** **none** (per request)

---

## Outcome

Added a full-stack integration suite that proves the day-teaching path works on Bright I.G when `order_global` has intentional holes (40 / 44 / 48 / 52 / 56).

| Item | Detail |
|------|--------|
| New file | `apps/api/src/lms-ops/bright-ig-gaps.int.test.ts` |
| Tests | 4 (`it` blocks) covering restamp, package grant, roster, cancel+restamp |
| Business logic changed | **None** in this task (relies on existing gap-aware WIP in `stamp-sessions.ts` / `grant-units.ts` / `@cmc/domain-lms`) |
| Run result | **4/4 passed** (local throwaway DB `cmc_ci` on host Postgres) |

---

## What each test proves

### (1) `createClassWithUnits` stamps across gap 40

- Seeds real Bright axis labels `37–59` minus gaps (18 units).
- Creates Bright I.G course + class neo at unit **37**, 16 Mondays (2026-09-07 … 2026-12-21).
- Asserts sessions **13–16** (0-based indices 12–15) get **unit 41**, not 40.
- Asserts full map: `37×4, 38×4, 39×4, 41×4`.
- Asserts **no null** `curriculumUnitId` on those sessions; no stamp points at a gap label.

### (2) Package grant counts **real** units, not integer holes

- `grantUnitsFromReceipt` with `unitCount: 4` on class current 37.
- Expects range endpoints **`from=37, to=41`** (not `to=40`).
- `realOrdersInRange` → `[37, 38, 39, 41]` length **4**.
- Integer span length is 5; `remainingUnits(..., BRIGHT_AXIS)` still **4**.
- `addWithUnits` ending on hole endpoint **44** → `BAD_REQUEST` (endpoints must be real units).

### (3) Dual-gate roster never empty for entitled student

- `addWithUnits` range `37..41` (covers first four real units).
- For each of the first 16 stamped sessions, `rosterForSession` includes the student and `sessionOrderGlobal` is non-null and not a gap label.

### (4) Cancel + restamp slides on gapped axis

- Pre-cancel: index 4 → unit 38; index 12 → unit 41.
- Cancel first session via `classSession.cancel` (unified restamp path).
- Old index 4 slides **38 → 37**.
- Old index 12 slides **41 → 39** (live k=11 → `floor(11/4)=2` → axis[2]=39), **not** invented 40.
- All live sessions keep non-null stamps on real orders only.

---

## Harness / patterns followed

Copied from existing suite style:

- `createTestFacility` / `cleanupFacility` / `cleanupCurriculumUnits`
- `buildStaffContext` + `appRouter.createCaller` (role `giam_doc_dao_tao`)
- `seedCurriculumUnit` / `seedActiveEnrollment` / `testDbBypass`
- `lmsOps.createClassWithUnits`, `lmsOps.addWithUnits`, `lmsOps.rosterForSession`
- `grantUnitsFromReceipt` + raw approved `Receipt` (same shape as `grant-units.int.test.ts`)
- `classSession.cancel` restamp proof (same idea as `lms-ops.int.test.ts`)

**Catalog safety:** units are **find-or-create** by `(program, orderGlobal)`. Only units **created** by the suite are tracked in `ownedUnitIds` and deleted in `afterEach` — pre-existing imported catalog rows are left alone.

**Gap poison check:** before acting, asserts no `CurriculumUnit` exists at 40/44/48/52/56.

---

## How tests were run

Default `.env` points `APP_DATABASE_URL` at **localhost:5433** (not listening in this environment).

To verify:

1. Created throwaway DB **`cmc_ci`** on the already-running Docker Postgres (`127.0.0.1:5432`) — **not** `cmc_prod` (harness refuses pilot DB name).
2. `prisma migrate deploy` on `cmc_ci` (all migrations including `20260812120000_curriculum_level_text_drop_session_makeup`).
3. `ALTER ROLE cmc_app PASSWORD 'cmc_app_ci_password'`.
4. Ran:

```bash
DATABASE_URL='postgresql://postgres:***@127.0.0.1:5432/cmc_ci?schema=public' \
APP_DATABASE_URL='postgresql://cmc_app:cmc_app_ci_password@127.0.0.1:5432/cmc_ci?schema=public' \
pnpm --filter @cmc/api exec vitest run src/lms-ops/bright-ig-gaps.int.test.ts
```

**Result:**

```
✓ src/lms-ops/bright-ig-gaps.int.test.ts (4 tests) 1381ms
Test Files  1 passed (1)
Tests       4 passed (4)
```

Re-run after teardown harden: also **4/4 passed**.

---

## Dependencies / notes for CI

- Tests require the **gap-aware** `deriveSessionUnits(anchor, programAxis, …)` and `resolvePackageGrantRange({ programAxis })` already present in the working tree (uncommitted domain/API changes from the Bright-gap fix workstream). Without those, expectations fail the same way the original review predicted.
- No commit made.
- Temporary prisma env file for migrate was removed after use.

---

## Acceptance checklist

| Requirement | Status |
|-------------|--------|
| (1) Sessions 13–16 → unit 41 not 40; no unstamped sessions | **Proven** by test (1), green |
| (2) Grant real unit count = purchased count across hole | **Proven** by test (2), green |
| (3) Roster correct / non-empty on every session | **Proven** by test (3), green |
| (4) Cancel restamp slides correctly on gapped axis | **Proven** by test (4), green |
| Only tests under `lms-ops/**`; no business logic edits in this task | **Yes** |
| No commit | **Yes** |

---

## Residual risk

- Suite assumes gap labels are **absent** from `CurriculumUnit`. If a bad seed invents unit 40, restamp could re-break; the poison assert fails closed.
- Full 96-unit CSV import is not required; synthetic 18-unit Bright spine with the same labels/gaps is enough for the teaching math under test.
