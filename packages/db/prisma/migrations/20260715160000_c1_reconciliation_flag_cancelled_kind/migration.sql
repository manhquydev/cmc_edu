-- C1 remediation (scenario audit, 2026-07-15): reconcile-orphaned-receipts'
-- new cancelled-but-provisioned scan (layer 2 backstop for the
-- receiptCancel-vs-provisioning race) raises a ReconciliationFlag of kind
-- 'cancelled_receipt_active_enrollment' — add it to the allowed set.

ALTER TABLE "ReconciliationFlag" DROP CONSTRAINT "ReconciliationFlag_kind_check";
ALTER TABLE "ReconciliationFlag" ADD CONSTRAINT "ReconciliationFlag_kind_check"
  CHECK (kind IN ('self_approved','exceeds_threshold','excess_refunds','missing_provisioning','cancelled_receipt_active_enrollment'));
