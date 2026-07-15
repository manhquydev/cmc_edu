-- ADR 0043 (docs/decisions/0043-attendance-daily-inout-pairing.md), phase 1
-- (plans/260713-1706-attendance-daily-inout-pairing): schema substrate for
-- the daily in/out attendance-pairing model.
--
-- 1. TimePunch.withinNetwork — records whether a punch matched an active
--    FacilityNetwork CIDR at write time. Default true: pre-0043 the app
--    rejected offsite punches outright, so every pre-existing row is, by
--    construction, within-network.
-- 2. ManualAttendanceTicket.checkInAt/checkOutAt — the day's punch pair a
--    ticket represents, filled by checkInOut.punch (phase 3) and frozen once
--    the ticket leaves pending/resubmitted (phase 3 "freeze on approve").
-- 3. Unique (appUserId, ticketDate) — ADR 0043 §1 phiếu/ngày. Pre-existing
--    duplicate (appUserId, ticketDate) rows (possible under the pre-0043
--    manualPunch.create "resubmit via new row" pattern) are deduplicated
--    first, keeping the most recently created row per pair, so the unique
--    index can be created.

-- ---------------------------------------------------------------------------
-- 1. TimePunch.withinNetwork
-- ---------------------------------------------------------------------------
ALTER TABLE "TimePunch" ADD COLUMN "withinNetwork" BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 2. ManualAttendanceTicket.checkInAt/checkOutAt
-- ---------------------------------------------------------------------------
ALTER TABLE "ManualAttendanceTicket" ADD COLUMN "checkInAt"  TIMESTAMPTZ(3);
ALTER TABLE "ManualAttendanceTicket" ADD COLUMN "checkOutAt" TIMESTAMPTZ(3);

-- ---------------------------------------------------------------------------
-- 3. Dedupe pre-existing (appUserId, ticketDate) duplicates, then enforce
--    uniqueness. Keep exactly one row per pair (latest createdAt, tiebroken
--    by id DESC so an exact-createdAt tie — plausible from a single-
--    transaction bulk insert where now() is transaction-stable — still
--    leaves exactly one survivor instead of aborting the CREATE UNIQUE
--    INDEX below). Migration role is unrestricted (no DELETE-grant
--    limitation like cmc_app has on this append-like table).
-- ---------------------------------------------------------------------------
DELETE FROM "ManualAttendanceTicket" t
WHERE t.id NOT IN (
  SELECT DISTINCT ON ("appUserId", "ticketDate") id
  FROM "ManualAttendanceTicket"
  ORDER BY "appUserId", "ticketDate", "createdAt" DESC, id DESC
);

CREATE UNIQUE INDEX "ManualAttendanceTicket_appUserId_ticketDate_key"
  ON "ManualAttendanceTicket"("appUserId", "ticketDate");
