-- Idempotent re-backfill: rows still labeled 'none' while withinNetwork=true
-- become 'open' (history never ran a real network/geo check). Safe if P1+P2
-- ship together (0 rows updated).
UPDATE "TimePunch" SET "verification" = 'open' WHERE "withinNetwork" AND "verification" = 'none';
