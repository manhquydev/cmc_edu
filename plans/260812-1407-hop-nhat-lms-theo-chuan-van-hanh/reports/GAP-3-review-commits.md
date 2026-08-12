# GAP-3 — Code review: `7c17c7c` + `8f18d8f`

**Mode:** read-only (`/ak:code-review`), no code edits, no commit  
**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Commits:**

| SHA | Subject | Nature |
|-----|---------|--------|
| `8f18d8f` | docs(plans): LMS merge review, owner decisions, re-sequenced program plan | Docs/plans only (~5k lines) — **no runtime surface** |
| `7c17c7c` | feat(lms): nạp khung chương trình thật và gỡ đường buổi bù | **Runtime** — schema, import, API, admin, e2e, tests |

**Scope of this review:** runtime risks in `7c17c7c` against the five requested axes. `8f18d8f` is noted only for completeness (no defect found in executable code).

**Evidence base:** `git show` of both commits, full reads of migration/import/open-tier/session-done-sweep, live CSV grouping via the committed import module, simulation of Bright I.G restamp/grant math against domain helpers **as they exist at `7c17c7c`** (not the dirty working tree, which has uncommitted axis-aware WIP on `domain-lms`).

---

## Executive summary

The makeup removal is **coherent and mostly complete** in executable app code: `addMakeup`, `isMakeup`, Tier B, admin UI, and tests were removed together. The migration SQL for dropping makeup columns is **structurally correct** (FK → unique → columns) and intentional about data loss.

The **real high-severity defect** is not the makeup cut itself — it is **shipping a non-contiguous Bright I.G `order_global` catalog (gaps 40/44/48/52/56) while the LMS progression/grant stack at `7c17c7c` still walks contiguous integers**. That combination breaks restamp, package grant, and remaining-unit math for Bright I.G as soon as the CSV is imported.

UCREA (1–36 contiguous) and Black Hole (61–102 contiguous) are fine under the same stack. Makeup-path code in `session-done-sweep.ts` / `open-tier.ts` was **not over-deleted**.

---

## Findings (ordered by severity)

### F1 — CRITICAL — Bright I.G gaps + contiguous progression/grant = broken class ops after import

**What the commit introduces**

Import preserves CSV `order_global` verbatim. Live grouping of the committed CSV yields:

| Program | Units | `orderGlobal` span | Gaps |
|---------|------:|-------------------|------|
| UCREA | 36 | 1–36 | none |
| BRIGHT_IG | 18 | 37–59 | **40, 44, 48, 52, 56** |
| BLACK_HOLE | 42 | 61–102 | none |

Import even documents “Gaps are intentional” on `CurriculumUnit.orderGlobal` in `schema.prisma`.

**What the stack still does at `7c17c7c`**

```37:51:packages/domain-lms/src/unit-progression.ts
export function deriveSessionUnits(
  anchorOrderGlobal: number,
  maxOrderGlobal: number,
  sessions: OrderedSession[],
): SessionUnitStamp[] {
  // ...
  const raw = anchorOrderGlobal + Math.floor(k / SESSIONS_PER_UNIT);
  // contiguous integer walk — does not skip missing labels
}
```

```55:60:apps/api/src/lms-ops/stamp-sessions.ts
  const stamps = deriveSessionUnits(opts.anchorOrderGlobal, maxOrder, ordered);
  // ...
  const unitId = unitIdByOrder.get(stamp.order);
  if (!unitId) continue; // silent skip — session left without unit
```

```9:26:packages/domain-lms/src/package-grant.ts
// resolvePackageGrantRange: toOrderGlobal = from + unitCount - 1 (contiguous)
```

```126:131:apps/api/src/lms-ops/grant-units.ts
  for (let o = opts.range.fromOrderGlobal; o <= opts.range.toOrderGlobal; o++) {
    if (!unitOrders.has(o)) {
      throw badRequest(`orderGlobal ${o} is not in program ...`);
    }
  }
```

**Concrete break scenarios**

1. **Restamp (class create / cancel / cancel-sweep)**  
   Bright I.G class neo `anchorOrderGlobal=37`. After 12 valid sessions, `deriveSessionUnits` emits order **40** for sessions 12–15. `unitIdByOrder.get(40)` is `undefined` → `continue` → those sessions **never get `curriculumUnitId`**. Open-tier Tier A never opens homework for that unit; attendance dual-gate unit coverage fails for stamped units that jump over the hole then resume at 41 while “ghost” sessions sit unstamped.

2. **Receipt package grant**  
   Class current unit 37, `unitCount=4` → range `{37, 40}`. Grant loop hits missing 40 → **`BAD_REQUEST: orderGlobal 40 is not in program BRIGHT_IG`**. Student paid, enrollment active, **no units granted**.

3. **`remainingUnits` overcounts holes**  
   If a range that spans a gap ever exists, `remainingUnits` counts integer labels (hole = fake unit). Entitlement UI/alerts become wrong.

**Why this is charged to `7c17c7c`**

Domain/restamp/grant were contiguous-only before this commit, but the **catalog was only UCREA 1–4 (continuous)**. This commit is what **materializes** the gapped Bright I.G axis into every seeded/ensured DB. Follow-up commit `21c5834` already documents the hole in plans — confirming the team saw it after landing the import.

**Not fixed in these two commits.** Working-tree dirty edits on `domain-lms` look like a partial fix attempt; they are **outside** `7c17c7c`/`8f18d8f` and not reviewed as shipped.

---

### F2 — IMPORTANT — Migration does not load 96 units; post-migrate level is wrong until import/seed

**File:** `packages/db/prisma/migrations/20260812120000_curriculum_level_text_drop_session_makeup/migration.sql` L8–12

```sql
ALTER TABLE "CurriculumUnit"
  ALTER COLUMN "level" TYPE TEXT USING "level"::text;
```

- Existing seed rows `level=1..` become **`"1"`**, not `"U2"`.
- Migration **does not** call the CSV import.
- CI (`typecheck-and-test`, `ui-e2e`) runs `prisma migrate deploy` only — **not** `db seed` / `ensure-curriculum-units`.
- Import is wired into `seed.mjs` + `scripts/ensure-curriculum-units.ts` only.

**Scenario:** ops runs migrate on a long-lived env and skips seed (common for “schema-only” deploy). Result:

- Still only old UCREA 1–4 (or whatever was there)
- Bright I.G / Black Hole still empty → **the stated product bug in the commit message is not fixed by migrate alone**
- Level labels show `"1"` instead of framework codes in admin pickers (`Lv1` vs `LvU2`)

**Missing operational step (not a SQL syntax bug):** documented runbook / CI step to run import after migrate. Comment in migration acknowledges overwrite-by-import but nothing enforces it.

---

### F3 — IMPORTANT — Migration is not safely reversible; makeup data permanently destroyed

**File:** same `migration.sql` L20–23

```sql
ALTER TABLE "ClassSession" DROP CONSTRAINT IF EXISTS "ClassSession_makeupForSessionId_fkey";
ALTER TABLE "ClassSession" DROP CONSTRAINT IF EXISTS "ClassSession_makeupForSessionId_key";
ALTER TABLE "ClassSession" DROP COLUMN IF EXISTS "makeupForSessionId";
ALTER TABLE "ClassSession" DROP COLUMN IF EXISTS "isMakeup";
```

| Reverse need | Feasible? |
|--------------|-----------|
| Re-add `isMakeup BOOLEAN NOT NULL DEFAULT false` | Yes for schema, **no** historical values |
| Re-add `makeupForSessionId` + FK/unique | Schema yes, **links lost forever** |
| `level` TEXT → INTEGER after CSV import | **No** — `USING level::integer` fails on `"U2"`, `"J"`, … |
| `level` TEXT → INTEGER before import (values still `"1"`) | Possible with `USING level::integer` |

No down migration exists (project convention). **Acceptable if product accepts irreversible cut**, but rollback of a bad deploy after import is **schema+data rewrite**, not `migrate resolve`.

**Order of operations in the SQL is correct** (drop FK, then unique, then columns). `IF EXISTS` is defensive. Index `CurriculumUnit_program_level_monthIndex_idx` survives `ALTER TYPE` in PostgreSQL. No extra step required for index rebuild.

**Unintended data loss beyond product intent?**

- Dropping makeup flags/links: **intentional** product cut.
- Casting level to text `"1"`: temporary until import; not row loss.
- No `DELETE` of sessions or units — good.
- Orphan makeup sessions remain as normal `ClassSession` rows (no `isMakeup`); they typically had `curriculumUnitId=null` (old `addMakeup` never stamped unit) so open-tier impact is low.

---

### F4 — IMPORTANT — Acceptance manifest still claims `classSession.addMakeup` / buổi bù

**File:** `scripts/acceptance-report/flow-manifest.ts`

- L320: `'classSession.addMakeup'` still listed under P2-01 expected tRPC surface
- L751: flow displayName still **“Tự huỷ buổi 0 điểm danh + xếp buổi bù”**

**Scenario:** `pnpm acceptance:report` / orphan ratchet treats `addMakeup` as expected procedure that no longer exists → **false orphan / false coverage signal**, or journey ledger lies about makeup still being a product path.

This is the only **executable-adjacent leftover** of makeup in non-docs code at `7c17c7c` (`git grep` over apps/packages/scripts excluding migrations).

Product docs under `docs/*` still describe makeup/Tier B (ADR 0038, TL19, etc.) — docs drift, not a runtime bug, but authority corpus is now inconsistent with code.

---

### F5 — MODERATE — Import “idempotent” is upsert-only, non-transactional, weak edge validation

**File:** `packages/db/prisma/import-curriculum-units.mjs`

| Claim | Reality |
|-------|---------|
| Idempotent on `(program, orderGlobal)` | **Yes** for re-run of same CSV: findUnique → update/create |
| Converges under partial failure | **Soft yes** — re-run fills remaining; **no `$transaction`**, mid-failure leaves half-updated titles/levels |
| Deletes units removed from CSV | **No** — orphans stay forever |
| Validates empty `level` | **No** — empty string accepted |
| Validates `unit_type` | Unknown values silently become `LESSON` (only exact `'REVIEW'` maps to REVIEW) |
| Validates consistent `unit_code` within a group | **No** — first row wins for title prefix; current CSV has 0 multi-code groups (verified) |
| Stores `unitCode` | **No column** — only embedded in `title` |

**Grouping logic (happy path) is correct for the current CSV:**

- 240 rows → 96 units (36/18/42) — verified by running `loadCurriculumUnitsFromCsv`
- Multi-topic rows collapse on `(program, order_global)`; themes joined with ` · `
- Level / unitType mismatch across topics of same unit → throw (good)
- `monthIndex` = 1-based sequence within `(program, level)` sorted by `orderGlobal` — matches comment; UCREA U2/U3/U4 each get 1–12; Bright levels get 1–3; BH G gets 1–6, R/B/P 1–12
- Title shape `U2.1 — Bạn bè` is reasonable; multi-topic titles can reach ~116 chars (OK for `String`)

**CSV data quality (not import bug, but surfaces in product):** UCREA REVIEW at `orderGlobal=12` uses unit_code `U1.10+` while `level=U2` — title becomes `U1.10+ — Ôn tập cuối kỳ` under a U2 band. Misleading label for staff.

**`monthIndex` reasonableness:** derived sequence is consistent with owner brief; it is **not** the CSV `duration_month` column (always 1 per row). If any UI still means “calendar month of level”, labels `T1..T12` are sequence indices, not calendar months — acceptable if product language is updated.

---

### F6 — MODERATE — `resolveClassCurrentOrder` default `1` is wrong for Bright I.G / Black Hole

**File (unchanged by commit but newly lethal after catalog import):** `apps/api/src/lms-ops/grant-units.ts` ~L33–41 at `7c17c7c`

```ts
if (!classBatch.currentUnitId) return 1;
```

Bright I.G real axis starts at **37**, Black Hole at **61**. Class batch without neo → grant starts at 1 → **no units at order 1** → grant fails or grants nonsense if synthetic 1–16 helpers polluted the DB.

UCREA still OK.

---

### F7 — LOW — Makeup removal completeness (runtime) — mostly clean; not over-deleted

| Surface | Verdict |
|---------|---------|
| `class-session-router` `addMakeup` | Removed cleanly |
| Schema `isMakeup` / `makeupForSessionId` | Removed; migration drops columns |
| Admin class-detail makeup dialog | Removed |
| Schedule FC `(bù)` title | Removed |
| Session detail copy | Updated |
| DTO `isMakeup` | Removed from API responses (breaking for any external client still reading it) |
| **`session-done-sweep.ts`** | **Not over-deleted.** Already “no makeup” path; only dropped dead `makeupSessionId` / audit `makeup: false`. Cancel+restamp remains. `roomConflict` always `false` is now a dead field (hygiene only). |
| **`open-tier.ts`** | **Not over-deleted.** Tier A kept; Tier B (attendance-on-makeup) removed correctly. Dropping `isMakeup: false` filter is required once column is gone. Old `addMakeup` never set `curriculumUnitId`, so historical makeups do not suddenly open whole-class units. |
| `cancel-session.ts` | Only dropped `isMakeup` from result DTO — correct |
| `stamp-sessions` / domain progression | Unchanged; makeup was never special-cased there (makeup hurt progression by *occupying a non-cancelled slot* — removing creator is the right fix) |

**Not found:** accidental deletion of non-makeup attendance, restamp, or open-tier kill-switch logic.

---

### F8 — LOW — Tests deleted with the feature are appropriate; some gaps / type drift remain

**Deleted (acceptable — feature gone):**

- `classSession.addMakeup` integration tests (gate, date range, room conflict)
- Admin makeup dialog tests
- Open-tier Tier B suite (present/late/absent/future makeup)
- Schedule FC makeup title test
- Sweep assertions on `makeupSessionId` / `makeupForSessionId`

**Rewrites that preserve intent:**

- E2E attendance / grading now use auto-materialized weekly sessions instead of `addMakeup` — correct product path
- Open-tier still covers Tier A endTime / cancelled / entitlement

**Weaknesses / gaps:**

1. **No test that Bright I.G import + restamp + grant survive gaps** — the highest-risk path has zero coverage after introducing the real catalog.
2. **Import tests** (`scripts/import-curriculum-units.test.mjs`) prove pure grouping only — **no DB upsert / re-run idempotency / orphan retention** test.
3. **Type drift in mocks (typecheck noise):**
   - `apps/admin/src/pages/teaching/exercises.test.tsx` L24: `level: 1` while interface says `level: string`
   - `exercise-detail.test.tsx` still `level: 1`
   - `class-detail.test.tsx` UNITS still `level: 1`
4. Open-tier rewrite of “attendance on non-makeup” → “future session with present does not open” is still a valid Tier A assertion; not a weakening of Tier A. Loss of Tier B coverage is intentional product removal, not silent weakening of remaining gates.

---

### F9 — LOW — `CurriculumUnit.level` Int→String cascade

**Updated correctly in commit:**

- Prisma schema + migration
- `CurriculumUnitDto` / `toCurriculumUnitDto` (`apps/api/src/exercise/router.ts`)
- Seed / ensure / e2e axis helpers (`level: 'U2'`)
- Admin types in `class-detail.tsx`, `classes/index.tsx`, exercises test interface

**No numeric comparisons** found on curriculum `level` (grep for `<`/`>`/`Number(level)` on this field is clean). Sorting/filtering by level as text is lexicographic (`U2` vs `U10` not an issue — codes are U2/U3/U4, J/T/C…).

**Cosmetic only:** labels `Lv${level}` → `LvU2`, `L${level}` → `LU2` — readable enough.

**Risk residual:** any external report/SQL assuming integer level ranks is broken after migrate; none found in-repo.

---

## Axis-by-axis answers

### (1) Migration SQL

| Question | Answer |
|----------|--------|
| Correct? | **Yes** for stated schema change: level cast + makeup drop order is right |
| Missing steps? | **Yes operationally:** no CSV import / level code rewrite; envs that only migrate keep `"1"` levels and sparse catalog (F2) |
| Reversible? | **Not safely** after import; makeup columns irreversible data loss (F3) |
| Unintended data loss? | Makeup linkage yes (product intent). No bulk unit/session delete. Temporary wrong level strings until import |

### (2) Import script

| Question | Answer |
|----------|--------|
| Grouping correct? | **Yes** for current CSV (240→96, counts 36/18/42) |
| Boundary data? | Empty level / bad unit_type weakly handled; current file clean (F5) |
| Truly idempotent? | **Upsert-idempotent**, not delete-idempotent, not transactional (F5) |
| `monthIndex`? | Reasonable 1-based per `(program,level)` sequence |
| Unit naming? | Reasonable; one CSV REVIEW code `U1.10+` under U2 is misleading |

### (3) Makeup removal leftovers / over-delete

| Question | Answer |
|----------|--------|
| Leftover runtime path? | **Almost none** — only acceptance `flow-manifest` (F4) |
| Over-delete sweep / open-tier? | **No** — both correctly narrowed (F7) |
| Wrong removal of non-makeup? | **Not found** |

### (4) Tests

| Question | Answer |
|----------|--------|
| Deleted tests that should stay? | **No** — they tested removed product surface |
| Weakened tests? | Tier A retained; **gap**: no Bright I.G gap integration test (F8) |

### (5) Level string cascade

| Question | Answer |
|----------|--------|
| Blast radius? | Contained; DTOs/UI/seed updated; no numeric logic broken in-repo (F9) |

---

## `8f18d8f` (docs commit)

No executable code. Plans/BR/J/RT/V reports and owner decisions only. **No runtime defect.** Value is process history, not a ship gate for the feature commit.

---

## What is solid in `7c17c7c`

- Clear product rationale in commit message (makeup skews restamp; Tier B dead without makeup).
- Makeup cut is end-to-end in apps (API + admin + e2e + schema).
- CSV parser handles quoted fields; grouping validates level/unitType consistency.
- Pure grouping tests lock 36/18/42 and sample units.
- `session-done-sweep` / `open-tier` edits match product rule without gutting cancel/restamp or Tier A.

---

## Recommended fix order (advisory only — this review did not implement)

1. **Before treating Bright I.G as sellable:** make progression + grant + remainingUnits axis-aware (walk real `orderGlobal` list, not integers), or compact Bright labels (product decision). Prove with integration test: import → create Bright batch → restamp past a gap → grant package of 4.
2. **Runbook/CI:** after migrate, require `importCurriculumUnits` / seed so level codes and 96 units actually land.
3. **Strip `classSession.addMakeup` from `flow-manifest`** and rename P3 auto-cancel flow display string.
4. Harden import: transaction optional; reject empty level; optional delete-orphans flag.
5. Fix mock `level: 1` → `'U2'` (or string) in admin tests for typecheck honesty.

---

## Verdict

**Do not treat `7c17c7c` as production-ready for Bright I.G.**  
UCREA + makeup removal are in good shape for a non-prod / UCREA-first path **if** import/seed actually runs after migrate.  
**Highest true bug:** gapped Bright I.G catalog vs contiguous LMS math (F1).  
**Highest ops bug:** migrate alone does not deliver the 96-unit fix (F2).

**Significant issues found: yes (F1–F4). Not a clean bill of health.**
