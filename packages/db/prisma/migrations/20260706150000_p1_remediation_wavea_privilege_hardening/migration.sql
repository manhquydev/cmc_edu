-- P1 remediation Wave A (K5) — append-only ledger enforcement + least
-- privilege for the `cmc_app` role. Hand-written (like the wave-1/wave-2
-- migrations — `prisma migrate dev` is non-interactive here); pure
-- GRANT/REVOKE, no schema change.
--
-- Deep-review finding K5 (CONFIRMED): the wave-1 migration granted `cmc_app`
-- blanket `SELECT, INSERT, UPDATE, DELETE ON ALL TABLES`, with no REVOKE —
-- so the I5/append-only invariant on `RefundRecord` and `AuditLog` (docs/01
-- §4: ledgers are corrected by new rows, never edited/erased) was only a
-- convention the application code happened to follow, not something Postgres
-- enforced. This migration makes it real.

-- ---------------------------------------------------------------------------
-- Append-only ledgers: revoke the write privileges that let the app role
-- edit or erase ledger history. INSERT/SELECT stay granted (both ledgers are
-- still written via normal `create`/`createMany` and read via the app).
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON "RefundRecord" FROM "cmc_app";
REVOKE UPDATE, DELETE ON "AuditLog" FROM "cmc_app";

-- ---------------------------------------------------------------------------
-- Least privilege: any FUTURE table defaults to SELECT/INSERT only, not the
-- wave-1 blanket 4-verb grant. Tables the app legitimately mutates get an
-- explicit UPDATE grant below instead of relying on a broad default.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE UPDATE, DELETE ON TABLES FROM "cmc_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT ON TABLES TO "cmc_app";

-- Explicit UPDATE grants for the tables the application actually updates
-- today (docs/10 data model + confirmed call sites in apps/api/src):
--   Receipt              - receiptApprove/receiptCancel status + kind flips
--   Opportunity           - stage advance (O*) / revert (I3)
--   Enrollment             - reserved -> active, withdraw
--   Student                 - lifecycle (void-cancel, K8 blockLms)
--   ParentAccount             - identity upsert fields
--   StudentAccount             - (created once; no in-place update today, but
--                                 kept alongside its sibling identity tables)
--   Guardian                   - upsert on guardian.approveLink / provisioning (K1)
--   GuardianLinkRequest          - pending -> approved/rejected
--   LoginOtp                      - attempts/status
--   ReceiptCodeCounter             - atomic increment
--   EmailOutbox                     - pending -> sent/failed (K6 relay)
-- `RefundRecord` and `AuditLog` are deliberately excluded — append-only, above.
GRANT UPDATE ON "Receipt" TO "cmc_app";
GRANT UPDATE ON "Opportunity" TO "cmc_app";
GRANT UPDATE ON "Enrollment" TO "cmc_app";
GRANT UPDATE ON "Student" TO "cmc_app";
GRANT UPDATE ON "ParentAccount" TO "cmc_app";
GRANT UPDATE ON "StudentAccount" TO "cmc_app";
GRANT UPDATE ON "Guardian" TO "cmc_app";
GRANT UPDATE ON "GuardianLinkRequest" TO "cmc_app";
GRANT UPDATE ON "LoginOtp" TO "cmc_app";
GRANT UPDATE ON "ReceiptCodeCounter" TO "cmc_app";
GRANT UPDATE ON "EmailOutbox" TO "cmc_app";

-- DELETE is intentionally left granted on every table EXCEPT RefundRecord and
-- AuditLog (revoked above): the integration-test harness
-- (apps/api/src/test/db.ts `cleanupFacility`/`cleanupParentAccountsByPhone`/
-- `cleanupLoginOtpsByPhone`) tears down every facility-scoped and identity row
-- through the SAME `cmc_app` connection the running app uses — there is no
-- separate "test admin" role in this stack — and Contact/Opportunity/
-- Student/Enrollment/StudentAccount/Guardian/GuardianLinkRequest/
-- ParentAccount/LoginOtp/ReceiptCodeCounter/EmailOutbox/Facility have no
-- other production deletion path either, so revoking DELETE there would
-- break the test harness without changing any real production behavior.
-- RefundRecord's test-cleanup delete now runs via a separate privileged
-- (migration-role) connection instead — see test/db.ts.
