-- P2-Foundation follow-up: `schedule.generateSessions` legitimately updates
-- `ClassBatch.endDate` when a caller extends the schedule range (WF-P2-01
-- "sinh lai mo rong lich"). The prior migration
-- (p2_foundation_class_ops) only granted `cmc_app` SELECT/INSERT/DELETE on
-- ClassBatch (matching wave-A's "future tables default to SELECT/INSERT,
-- explicit grant for anything else" policy) and missed this one UPDATE path.
GRANT UPDATE ON "ClassBatch" TO "cmc_app";
