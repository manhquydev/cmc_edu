/*
  Warnings:

  - You are about to drop the column `code` on the `LoginOtp` table. All the data in the column will be lost.
  - Added the required column `codeHash` to the `LoginOtp` table without a default value. This is not possible if the table is not empty.
  - Added the required column `facilityId` to the `RefundRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Contact" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "EmailOutbox" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Enrollment" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Facility" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Guardian" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "GuardianLinkRequest" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "LoginOtp" DROP COLUMN "code",
ADD COLUMN     "codeHash" TEXT NOT NULL,
ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Opportunity" ALTER COLUMN "closedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "ParentAccount" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "studentId" TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "ReceiptCodeCounter" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "RefundRecord" ADD COLUMN     "facilityId" TEXT NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "StudentAccount" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "Receipt_facilityId_parentPhone_idx" ON "Receipt"("facilityId", "parentPhone");

-- CreateIndex
CREATE INDEX "RefundRecord_facilityId_idx" ON "RefundRecord"("facilityId");

-- H2 remediation (docs/16 ADR-A, re-enroll policy): Prisma `@@unique` cannot
-- express a partial index, so this is hand-written. At most one
-- `reserved`/`active` Enrollment per (facilityId, studentId, classBatchId);
-- re-enrollment after `withdrawn`/`completed` is unaffected. NOT represented
-- in schema.prisma — future `prisma migrate dev` runs may report drift for
-- this index; always inspect with `--create-only` rather than blind-applying.
CREATE UNIQUE INDEX "enrollment_active_reserved_unique"
  ON "Enrollment"("facilityId", "studentId", "classBatchId")
  WHERE status IN ('reserved', 'active');

-- ---------------------------------------------------------------------------
-- ADR 0042 — Postgres Row-Level Security (defense-in-depth backstop).
--
-- Enabled on every table whose primary access-control boundary IS a single
-- facility: Contact, Opportunity, Receipt, RefundRecord, Student, Enrollment.
-- Deliberately NOT enabled on:
--   - ReceiptCodeCounter: `facilityId` is a global sentinel key, not real
--     per-facility data (see schema.prisma comment) — RLS would break every
--     receipt creation.
--   - Guardian, GuardianLinkRequest: carry `facilityId` but the LMS
--     parent-facing read path legitimately spans facilities by
--     parentAccountId ownership (see schema.prisma comments).
--   - AuditLog, ParentAccount, StudentAccount, LoginOtp, EmailOutbox: global
--     identity/audit tables, never facility-scoped (TL10 §4 invariant #3).
--
-- Each policy: `USING (facility_id = current_setting(...) OR bypass = 'on')`.
-- The GUCs are set via `set_config(..., true)` (transaction-LOCAL) inside
-- `withFacility()` (packages/db/src/index.ts) — see that helper's doc comment
-- for why LOCAL scope is required under Prisma's pooled connections.
-- ---------------------------------------------------------------------------

ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "Contact"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "Opportunity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "Opportunity"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "Receipt" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "Receipt"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "RefundRecord" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "RefundRecord"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "Student"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facility_isolation" ON "Enrollment"
  USING ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("facilityId" = current_setting('app.current_facility_id', true) OR current_setting('app.bypass_rls', true) = 'on');

-- ---------------------------------------------------------------------------
-- Restricted application role.
--
-- CRITICAL: Postgres RLS policies are silently NO-OPs for the table owner and
-- for any role with the superuser or BYPASSRLS attribute (this cannot be
-- overridden, even with `FORCE ROW LEVEL SECURITY`). The migration role used
-- by `prisma migrate` is exactly such a role in every environment seen so
-- far. `cmc_app` is a separate, unprivileged login role the APPLICATION (and
-- its tests) must connect as — via `APP_DATABASE_URL` — for the policies
-- above to have any effect. Migrations keep running as the privileged owner
-- role (DDL requires it); only runtime queries move to `cmc_app`.
--
-- No password is set here (this file is committed to git) — set one
-- out-of-band per environment: `ALTER ROLE cmc_app WITH PASSWORD '...';`.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cmc_app') THEN
    CREATE ROLE "cmc_app" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO "cmc_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "cmc_app";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "cmc_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "cmc_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "cmc_app";
