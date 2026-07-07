-- RT-6/RT-8: add retry tracking + dead-letter to EmailOutbox.
--
-- `attempts` counts how many delivery attempts have been made; `lastError`
-- captures the last transport error message for ops triage; `nextRetryAt`
-- records the earliest retry timestamp (PD-2 will filter by it — for now
-- all `failed` rows are drained unconditionally regardless of this value).
-- `dead` is a new terminal status for rows that exhaust EMAIL_MAX_ATTEMPTS or
-- have no configured transport; dead rows are never re-drained.
--
-- `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is used so the migration is
-- idempotent and safe to re-apply. Unlike `sending` (previous migration),
-- `dead` is intentionally a terminal state: rows that reach it stay there
-- until manual intervention.
ALTER TABLE "EmailOutbox" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailOutbox" ADD COLUMN "lastError" TEXT;
ALTER TABLE "EmailOutbox" ADD COLUMN "nextRetryAt" TIMESTAMPTZ(3);
ALTER TYPE "EmailOutboxStatus" ADD VALUE IF NOT EXISTS 'dead';
