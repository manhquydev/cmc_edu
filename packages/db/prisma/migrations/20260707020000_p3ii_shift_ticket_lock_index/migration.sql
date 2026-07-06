-- Enforce ticket-lock invariant at DB level:
-- at most one ShiftRegistration per appUser in 'submitted' status.
CREATE UNIQUE INDEX "ShiftRegistration_appUserId_submitted_unique"
  ON "ShiftRegistration"("appUserId")
  WHERE (status = 'submitted');
