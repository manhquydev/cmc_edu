-- FORCE ROW LEVEL SECURITY on every table that already has RLS enabled.
--
-- Without FORCE, RLS policies are silently skipped for the table OWNER, so an
-- accidental owner-credential connection (scripts, psql, misconfigured worker)
-- would read/write across facilities. The API refuses to boot when any
-- RLS-enabled table lacks FORCE (see apps/api/src/boot-checks.ts).
--
-- Note: superuser / BYPASSRLS roles still bypass RLS regardless of FORCE —
-- that is guarded separately by the non-superuser boot check.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND c.relforcerowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;
