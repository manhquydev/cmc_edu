-- Phase-03 super-admin-completion: facilityNetwork.delete needs a real
-- DELETE grant. FacilityNetwork was originally SELECT/INSERT/UPDATE-only
-- (P3-I, matching the append-only-history convention used for most P3+
-- tables) because no admin-facing delete existed yet. This is a genuine
-- catalog row (like Course/Room/ClassBatch, which already have this same
-- grant), not an audit trail, so a hard delete is appropriate.
GRANT DELETE ON "FacilityNetwork" TO "cmc_app";
