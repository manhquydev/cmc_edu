-- P2: Opportunity.stageChangedAt — rotting-clock anchor.
-- Order is mandatory (red-team): nullable add → backfill → SET DEFAULT now().
-- Backfill uses updatedAt (approx). Bias: non-stage updates (e.g. assign) bump
-- updatedAt so old rows look "fresher" than true stage age — under-reports
-- rotting (safe direction); self-corrects on the next real stage change.

-- 1. Nullable column, NO default (avoids full-table rewrite + migration-time stamp).
ALTER TABLE "Opportunity" ADD COLUMN "stageChangedAt" TIMESTAMPTZ NULL;

-- 2. Backfill approximate anchor from updatedAt.
UPDATE "Opportunity" SET "stageChangedAt" = "updatedAt" WHERE "stageChangedAt" IS NULL;

-- 3. Default for future INSERTs only (metadata-only; no rewrite of existing rows).
--    UPDATE paths that change stage must still set stageChangedAt explicitly.
ALTER TABLE "Opportunity" ALTER COLUMN "stageChangedAt" SET DEFAULT now();
