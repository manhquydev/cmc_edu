# Restore Drill PASS — Backup ACL Gap Caught

**Date**: 2026-07-09 21:xx
**Severity**: High (real DR gap)
**Component**: scripts/backup-db.sh, restore-drill.sh, R2 backup
**Status**: Resolved — Phase 2 env-prod closed

## What Happened

Finished Phase 2 of the go-live plan by closing the last blocker: the R2 restore
drill. User supplied R2 API tokens; the drill went from BLOCKED to `=== RESTORE
DRILL PASSED ===` after two real bugs surfaced and were fixed.

## The Brutal Truth

The restore drill did exactly the job a drill is supposed to do — it caught a
backup that would have "succeeded" every night and then failed catastrophically
the one time it mattered. Two separate defects, both invisible until the backup
was actually exercised end-to-end against a fresh database.

## Technical Details

### R2 token scope trap
User's first token was scoped to the wrong bucket (`cmc-homework`, the app-storage
bucket) — every put/get/list to `cmc-db-backups` returned AccessDenied. Verified the
credentials were valid (secret == `sha256(token value)`, R2's derivation) and that
the same token worked on `cmc-homework`, isolating it to a pure scope mismatch rather
than a bad key. User created a second token scoped to `cmc-db-backups` → all ops pass.

### Bug 5 — pg_dump chokes on Prisma's `?schema=`
`.env.prod` DATABASE_URL is a Prisma URL ending `?schema=public`. `pg_dump`/libpq
reject it: `invalid URI query parameter: "schema"`. The first backup died on line 1.
Fix: `PGDUMP_URL="${DATABASE_URL%%\?*}"` before dumping. This would have killed the
very first backup on a real VPS too — not a local-sim artifact.

### Bug 6 — `--no-acl` silently drops every GRANT (the real DR gap)
`backup-db.sh` dumped with `--no-acl` and `restore-drill.sh` restored with `--no-acl`.
But `cmc_app`'s table privileges live entirely in migration GRANTs (`GRANT UPDATE ON
"Receipt" TO cmc_app`, `ALTER DEFAULT PRIVILEGES ... GRANT SELECT, INSERT`). With
`--no-acl`, the dump omits all of them, so a restored DB has tables + data but the app
role has **zero** privileges. A real recovery would come back up with the database
"restored" and the app unable to read a single table. The drill's smoke-2 (`SELECT
count(*) FROM "Receipt"` as cmc_app) failed `permission denied` — exactly the signal.
Fix: drop `--no-acl` from both (keep `--no-owner`). Drill passes, grants restored.

Code-reviewer surfaced the DR flip-side: an ACL-inclusive dump's GRANTs reference
`cmc_app`, so restoring to a brand-new host where that role doesn't exist yet will
fail role-missing. Added a runbook note to create the role before restore.

### DB reachability workaround
`postgres` has no host port in `docker-compose.prod.yml` (intentional). aws/psql/
pg_dump live in WSL2, which can't resolve the docker-internal `postgres` hostname.
Bridged with a throwaway `socat` sidecar on the compose network publishing 15432 to
the host, reachable from WSL2 via `localhost`. Torn down after the drill. On a real
VPS the DB is directly reachable, so this is a local-sim-only scaffold.

## Lessons Learned

1. **A backup you haven't restored is a hypothesis, not a backup.** Both defects were
   invisible to every check short of an actual restore-and-query.
2. **`--no-acl` is a footgun for DR.** It's often reflexively added to avoid ownership
   noise, but for same-topology disaster recovery you want the grants back. `--no-owner`
   alone gives the ownership flexibility without dropping privileges.
3. **Cheap invariant checks first.** Confirming secret == sha256(token) took seconds and
   turned "creds are broken" into "creds are fine, scope is wrong" — a completely
   different fix owned by a different person.

## Verification

Restore drill: 49 tables · RT-13 backup_host≠deploy_host · smoke-2 RLS via cmc_app PASS ·
escrow decrypt (openssl -pbkdf2) → valid PostgreSQL custom dump. isolation-check PASS,
stack healthy, socat sidecar removed.

## Unresolved (user action)

- Escrow `BACKUP_ENCRYPTION_PASSPHRASE` into the team password manager (currently only
  in `.env.prod`).
- Azure: enable MFA/conditional-access on the seeded `admin@cmcvn.edu.vn`; record the
  deactivation procedure.

---

**Commits**: `8bda316` (nginx/LMS/CRLF), `5133951` (UAT 5-role rewrite), `b0cd729`
(backup ACL + query-strip).
