-- phase-01 cancel-provisioning race fix: reconcile-orphaned-receipts' new
-- partial-provisioning scan (and the receiptApprove abort handler) raise a
-- ReconciliationFlag of kind 'cancelled_receipt_partial_provisioning' for a
-- cancelled receipt whose Student was provisioned but never got an Enrollment
-- seat. Extend the allowed-kind CHECK (additive/permissive — all prior kinds
-- stay valid, so rolling back app code is safe without reverting this).

ALTER TABLE "ReconciliationFlag" DROP CONSTRAINT "ReconciliationFlag_kind_check";
ALTER TABLE "ReconciliationFlag" ADD CONSTRAINT "ReconciliationFlag_kind_check"
  CHECK (kind IN ('self_approved','exceeds_threshold','excess_refunds','missing_provisioning','cancelled_receipt_active_enrollment','cancelled_receipt_partial_provisioning'));
