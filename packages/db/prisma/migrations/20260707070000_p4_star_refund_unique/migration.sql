-- Backstop the "refund exactly once" invariant at DB level.
-- Two concurrent reject calls both read rejectionRefundedAt=null and both insert;
-- this unique index makes the second insert fail with a unique violation.
CREATE UNIQUE INDEX "StarTransaction_gift_refund_unique"
  ON "StarTransaction"("refId")
  WHERE (type = 'gift_rejected_refund');
