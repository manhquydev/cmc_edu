-- Phase S1: enum Role + AppUser.roles[] + partial unique email index
-- (docs/14 §1: "bám thẳng enum Role trong schema")

-- 1. Create Role enum — 9 values locked by ADR-D (docs/14 §1).
CREATE TYPE "Role" AS ENUM (
  'super_admin',
  'giam_doc_kinh_doanh',
  'giam_doc_dao_tao',
  'sale',
  'giao_vien',
  'ke_toan',
  'cskh',
  'ctv_mkt',
  'hr'
);

-- 2. Add roles column to AppUser.
ALTER TABLE "AppUser" ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT '{}';

-- 3. Partial unique index: email must be unique when non-empty.
--    Empty-string default rows are excluded (backfill-safe).
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser" ("email") WHERE "email" <> '';
