-- Prevent duplicate open flags for the same (facilityId, receiptId, kind)
-- under concurrent worker runs (READ COMMITTED TOCTOU gap).
CREATE UNIQUE INDEX "ReconciliationFlag_open_dedup_idx"
  ON "ReconciliationFlag"("facilityId", "receiptId", "kind")
  WHERE (status = 'open');
