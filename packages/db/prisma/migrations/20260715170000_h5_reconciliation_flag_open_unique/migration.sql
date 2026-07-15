-- H5 remediation (scenario audit, 2026-07-15): maybeCreateFlag's dedup check
-- (findFirst-then-create) has a TOCTOU gap — nothing at the schema level
-- actually enforced "at most 1 open flag per (facilityId,receiptId,kind)"
-- despite the code comment implying so. Add a REAL partial unique index.
-- Prisma schema DSL cannot express a WHERE-qualified unique index, so this
-- constraint is raw SQL only and is not mirrored as an `@@unique` in
-- schema.prisma (documented on the model instead).

-- Step 1: consolidate any pre-existing duplicate OPEN flags down to 1 per key
-- (keep earliest createdAt, dismiss the rest) — required before the index can
-- be created, or CREATE UNIQUE INDEX below fails on existing duplicates.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY "facilityId", "receiptId", kind
           ORDER BY "createdAt" ASC, id ASC
         ) AS rn
  FROM "ReconciliationFlag"
  WHERE status = 'open'
)
UPDATE "ReconciliationFlag"
SET status = 'dismissed'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: the real constraint. NOTE: Postgres treats NULL "receiptId" values
-- as distinct from each other in a unique index (standard SQL NULL
-- semantics) — this does not dedup NULL-receiptId flags. Every current
-- maybeCreateFlag call site always passes a concrete receiptId, so this is a
-- theoretical gap only, not an active one; documented here for the next
-- caller that might pass NULL.
CREATE UNIQUE INDEX "ReconciliationFlag_open_dedup_key"
  ON "ReconciliationFlag" ("facilityId", "receiptId", kind)
  WHERE status = 'open';
