-- Add CHECK constraints so unknown status strings cannot be stored.
ALTER TABLE "ShiftRegistration"
  ADD CONSTRAINT "ShiftRegistration_status_check"
  CHECK (status IN ('draft', 'submitted', 'approved', 'cancelled'));

ALTER TABLE "Payslip"
  ADD CONSTRAINT "Payslip_status_check"
  CHECK (status IN ('draft', 'finalized'));

ALTER TABLE "KpiScore"
  ADD CONSTRAINT "KpiScore_status_check"
  CHECK (status IN ('draft', 'submitted', 'confirmed', 'approved'));
