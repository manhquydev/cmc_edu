# RV-1 — Migration data fix: cancel makeups before drop `isMakeup`

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Ownership:** `packages/db/prisma/migrations/**` only  
**Date:** 2026-08-12  
**Commit:** none

## Finding (code review, medium)

`20260812120000_curriculum_level_text_drop_session_makeup/migration.sql` dropped
`ClassSession.isMakeup` without handling existing makeup rows.

**Failure scenarios after drop (if makeups left non-cancelled):**

| # | Effect |
|---|--------|
| (a) | Open-tier Tier A no longer excludes makeups → ends unit open for **whole class** |
| (b) | Unit restamp counts **every** non-cancelled session → makeup occupies a 1/4-unit slot and **shifts later sessions** (the bug this PR fixes) |

## Fix

**File:** `packages/db/prisma/migrations/20260812120000_curriculum_level_text_drop_session_makeup/migration.sql`

Before dropping makeup columns, cancel open makeup sessions:

```sql
UPDATE "ClassSession"
SET
  status = 'cancelled'::"SessionStatus",
  "updatedAt" = now()
WHERE "isMakeup" = true
  AND status IS DISTINCT FROM 'cancelled'::"SessionStatus";
```

- Enum cast: `"SessionStatus"` (`planned|confirmed|cancelled|done` — from
  `20260706170000` + `done` in `20260712000000`).
- **Cancel, not delete** — attendance / assessments stay (business rule:
  cancel never erases learning history).
- Already-`cancelled` makeups unchanged (`IS DISTINCT FROM`).
- Covers `planned`, `confirmed`, and `done` makeups (all would still pollute
  progression/open-tier if left non-cancelled).
- Then existing DROP CONSTRAINT / DROP COLUMN for `makeupForSessionId` + `isMakeup`.

Comment block in SQL documents (a)/(b) and the cancel-not-delete rule.

## Verification

### 1. Blank DB — full chain

```text
docker run postgres:16-alpine (temp)
DATABASE_URL=… pnpm exec prisma migrate deploy  (from packages/db)
→ 49 migrations applied including 20260812120000_…  OK
container removed
```

### 2. Data-path proof

1. Deploy through `20260811150000` only (isMakeup still present).
2. Insert 4 sessions:
   - makeup `planned`
   - makeup `done`
   - makeup `cancelled`
   - normal `planned`
3. Deploy `20260812120000_…`

**After:**

| id | status |
|----|--------|
| sess-makeup-planned | **cancelled** |
| sess-makeup-done | **cancelled** |
| sess-makeup-cancelled | cancelled (unchanged) |
| sess-normal | **planned** (untouched) |

- Columns `isMakeup` / `makeupForSessionId`: **gone**
- Temp containers: **removed**

## Status

**DONE** — data fix in migration before column drop; SQL verified on blank + seeded temp Postgres; no commit.
