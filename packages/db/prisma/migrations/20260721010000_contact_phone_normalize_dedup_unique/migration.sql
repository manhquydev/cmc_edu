-- F8 (phase-08): make Contact dedup race-safe with @@unique([facilityId, phone]).
-- Contact.phone was stored as-entered and deduped app-side only. Normalize
-- every existing phone to the canonical 84xxxxxxxxx form, merge the duplicates
-- this exposes (keep oldest, repoint opportunities, fill null email), then add
-- the unique index. Ordered so opportunities are repointed BEFORE their dup
-- Contact is deleted (FK), and guarded so an unexpected duplicate volume aborts
-- the whole (transactional) migration instead of silently merging real data.

-- 1. Normalize phone in place: strip non-digits, map 0xx / +84 / 84 -> national
--    9 digits -> '84'||national; anything that isn't a 9-digit VN national
--    number keeps its cleaned digits (same lenient rule as normalizeContactPhone).
UPDATE "Contact" c SET "phone" = n.normalized
FROM (
  SELECT id,
    CASE
      WHEN nat ~ '^[0-9]{9}$' THEN '84' || nat
      WHEN digits = '' THEN 'invalid-' || id::text
      ELSE digits
    END AS normalized
  FROM (
    SELECT id, digits,
      CASE WHEN digits LIKE '84%' THEN substr(digits, 3)
           WHEN digits LIKE '0%'  THEN substr(digits, 2)
           ELSE digits END AS nat
    FROM (SELECT id, regexp_replace("phone", '[^0-9]', '', 'g') AS digits FROM "Contact") a
  ) b
) n
WHERE c.id = n.id;

-- 2. Abort guard: if the duplicates exposed by normalization exceed 5% of all
--    Contact rows, something is wrong (bad data / wrong normalization) — fail
--    loudly rather than destructively merge. A Prisma migration can't abort
--    imperatively, but a DO block RAISE EXCEPTION rolls back the transaction.
DO $$
DECLARE
  total_rows int;
  dupe_excess int;
BEGIN
  SELECT count(*) INTO total_rows FROM "Contact";
  SELECT COALESCE(sum(cnt - 1), 0) INTO dupe_excess
    FROM (SELECT count(*) AS cnt FROM "Contact" GROUP BY "facilityId", "phone" HAVING count(*) > 1) g;
  IF total_rows > 0 AND dupe_excess::numeric / total_rows > 0.05 THEN
    RAISE EXCEPTION 'Contact dedup aborted: % duplicate rows exceed 5%% of % total — investigate before applying.', dupe_excess, total_rows;
  END IF;
END $$;

-- 3a. Repoint opportunities from duplicate contacts to the keeper (oldest per
--     (facilityId, phone), tie-broken by id).
UPDATE "Opportunity" o SET "contactId" = r.keeper_id
FROM (
  SELECT id,
    first_value(id) OVER (PARTITION BY "facilityId", "phone" ORDER BY "createdAt" ASC, id ASC) AS keeper_id
  FROM "Contact"
) r
WHERE o."contactId" = r.id AND r.id <> r.keeper_id;

-- 3b. Fill the keeper's null email from any duplicate that has one (name is
--     NOT NULL, so the keeper always already has one — nothing to merge there).
UPDATE "Contact" k SET "email" = dv.any_email
FROM (
  SELECT r.keeper_id, max(c."email") FILTER (WHERE c."email" IS NOT NULL) AS any_email
  FROM (
    SELECT id,
      first_value(id) OVER (PARTITION BY "facilityId", "phone" ORDER BY "createdAt" ASC, id ASC) AS keeper_id
    FROM "Contact"
  ) r
  JOIN "Contact" c ON c.id = r.id
  WHERE r.id <> r.keeper_id
  GROUP BY r.keeper_id
) dv
WHERE k.id = dv.keeper_id AND k."email" IS NULL;

-- 3c. Delete the now-orphaned duplicate contacts (their opportunities were
--     repointed in 3a).
DELETE FROM "Contact" c
USING (
  SELECT id,
    first_value(id) OVER (PARTITION BY "facilityId", "phone" ORDER BY "createdAt" ASC, id ASC) AS keeper_id
  FROM "Contact"
) r
WHERE c.id = r.id AND r.id <> r.keeper_id;

-- 4. Enforce the invariant. Plain (not CONCURRENTLY): the table is tiny
--    (single-facility pilot) and CONCURRENTLY cannot run inside Prisma's
--    migration transaction.
CREATE UNIQUE INDEX "Contact_facilityId_phone_key" ON "Contact"("facilityId", "phone");
