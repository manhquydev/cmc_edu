# Research: Day-one authoring gaps

**Date:** 2026-08-02  
**Sources:** codebase scout (explore agent), timeline e2e, docs/19 curriculum notes in seed.mjs

## Findings

### 1. Course create is a known product gap
- `scripts/acceptance-report/verify.ts` documents `course.create` as list without form (PO 2026-07-18).
- API complete: `course.create` / `course.list` with `course.manage` (GĐĐT).
- Pattern to copy: `classes/index.tsx` Dialog + create mutation + invalidate list.

### 2. CurriculumUnit is global seed-only catalog
- No `facilityId`, no RLS, no `curriculumUnit.create` API.
- `seedCurriculumUnits` in `packages/db/prisma/seed.mjs` inserts 2 UCREA units if count=0.
- `seed-local-sim-demo.ts` creates course/class via HTTP only — **skips** prisma seed units.
- local-sim `cmc_prod` observed with **0** CurriculumUnit rows → exercise UI empty forever.

### 3. Class form validation is intentional
- Unit tests lock disable until course + YYYY-MM-DD + weekday + HH:mm slots.
- Not a logic bug; empty course list makes button look “broken”.

### 4. CRM Ghi danh is correct
- `pipeline.tsx` → `/finance/new?opportunityId=`. Playwright flakiness ≠ wrong product path.

### 5. Sale receiptList is SoD
- Auth matrix + API tests forbid sale list/get. Fixing needs product decision, not silent roster add.

## Recommendation
Implement Option A only: course UI create + ensure curriculum seed on local-sim path + `/classes` redirect. Defer SoD and curriculum CRUD.
