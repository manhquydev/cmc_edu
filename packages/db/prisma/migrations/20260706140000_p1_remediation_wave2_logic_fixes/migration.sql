-- P1 remediation wave 2 (business-logic fixes) — schema additions only.
-- Hand-written (like the wave-1 migration) because `prisma migrate dev` is
-- non-interactive in this environment; content matches the schema.prisma diff.

-- H5: OTP brute-force lockout counter.
ALTER TABLE "LoginOtp" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- M4: refund idempotency key + dedup unique index. Nullable — existing rows
-- (created before this migration) get NULL, which Postgres treats as
-- distinct per row, so the unique index does not reject them.
ALTER TABLE "RefundRecord" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "RefundRecord_receiptId_idempotencyKey_key"
  ON "RefundRecord"("receiptId", "idempotencyKey");
