# CMC EDU v2 — Deploy & Operations Runbook

Stack: `cmcv2-prod` · Docker Compose · VPS riêng (khác máy cmcnew-*) · Postgres 16 · nginx 1.27

---

## 1. First-time deploy

### 1.1 Prerequisites

| Item | Check |
|------|-------|
| VPS riêng (không phải máy cmcnew-*) | `hostname -f` |
| Docker ≥ 24, Compose plugin | `docker compose version` |
| AWS CLI v2 (for backup) | `aws --version` |
| TLS certs (Let's Encrypt or paid) | `ls infra/nginx/certs/` |
| `.env.prod` filled (from `.env.prod.example`) | `grep CHANGE_ME .env.prod` → 0 lines |
| `STAFF_SESSION_SECRET` ≠ `LMS_SESSION_SECRET` | `grep SESSION_SECRET .env.prod` → 2 distinct values |
| `ALLOW_DEV_AUTH` NOT in `.env.prod` | `grep ALLOW_DEV_AUTH .env.prod` → empty |
| Azure app redirect URI matches `ERP_SSO_REDIRECT_URI` | Check Azure Portal → App registrations → Redirect URIs |
| Backup target on DIFFERENT host (RT-13) | `echo $BACKUP_S3_ENDPOINT` |
| `BACKUP_ENCRYPTION_PASSPHRASE` set in `.env.prod` | `grep BACKUP_ENCRYPTION_PASSPHRASE .env.prod` → non-empty |
| Passphrase escrowed in team password manager | Verify: decrypt a test dump using passphrase from PM, not from `.env.prod` |
| R2 bucket public access disabled | CF Dashboard → R2 → bucket → Settings → Public Access = Disabled |
| `BACKUP_BUCKET_PRIVATE_CONFIRMED=true` in `.env.prod` | After verifying CF Dashboard step above |

### 1.2 Isolation check (run before any deploy)

```bash
./scripts/isolation-check.sh
```

Must exit 0. Resolve any collision before proceeding.

### 1.3 Build images

```bash
docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml build
```

### 1.4 Run database migrations (from host, not inside container)

```bash
# Source env so DATABASE_URL is available to prisma
source .env.prod
pnpm --filter @cmc/db exec prisma migrate deploy
```

> **Note (verified 2026-07-09):** `postgres` in `docker-compose.prod.yml` has no host port
> mapping (intentional — DB not exposed to host network). `DATABASE_URL`/`APP_DATABASE_URL` in
> `.env.prod` use the Docker-internal hostname `postgres`, which only resolves inside
> `cmcv2-prod_cmcv2-prod-net`. This step as written only works if run from a shell already
> attached to that network (e.g. `docker compose -p cmcv2-prod exec api sh` then run prisma from
> there, or a throwaway container on the same `--network`). Running directly from the VPS host
> shell will fail to resolve `postgres`. If a genuine host-side migration path is needed, either
> temporarily publish the postgres port or set up a bastion; do not permanently expose the DB port.

### 1.5 Start stack

```bash
docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml up -d
```

### 1.6 Verify all services healthy

```bash
docker compose -p cmcv2-prod ps
# All services should show "healthy" or "running"
```

### 1.7 Run restore drill (mandatory before seeding)

**Before running the drill, complete these one-time setup steps:**

1. **R2 bucket privacy** — in Cloudflare Dashboard → R2 → `<BACKUP_S3_BUCKET>` → Settings → verify Public Access = Disabled. Then set `BACKUP_BUCKET_PRIVATE_CONFIRMED=true` in `.env.prod`.

2. **Encryption passphrase escrow** — store `BACKUP_ENCRYPTION_PASSPHRASE` in your team password manager (e.g., 1Password, Bitwarden). This is the recovery path if the VPS is lost. The passphrase must be recoverable from the PM *without* access to the machine or `.env.prod`.

3. **Run a backup first** (creates the `.dump.enc` the drill needs):
   ```bash
   source .env.prod
   ./scripts/backup-db.sh
   ```

4. **Run the drill**:
   ```bash
   source .env.prod
   ./scripts/restore-drill.sh
   # Must print: === RESTORE DRILL PASSED ===
   ```

5. **Verify escrow** — after the drill passes, decrypt a copy of the backup using only the passphrase retrieved from your password manager (not from `.env.prod`):
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 \
     -in /tmp/test.dump.enc -out /tmp/test.dump \
     -pass pass:"<passphrase-from-PM>"
   # Must succeed without error
   rm -f /tmp/test.dump /tmp/test.dump.enc
   ```

**R2 lifecycle rule (retention):** Set an object lifecycle rule on the bucket to expire objects in `db-backups/` after 30 days — Cloudflare Dashboard → R2 → bucket → Settings → Lifecycle Rules → Add Rule (prefix: `db-backups/`, expiration: 30 days). This is belt-and-suspenders with `BACKUP_KEEP_DAYS` in the script.

### 1.8 Seed production (one-time)

```bash
source .env.prod
pnpm --filter @cmc/db exec prisma db seed
```

---

## 2. Routine operations

### 2.1 Deploy update

```bash
git pull origin main
docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml build api worker
docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml up -d --no-deps api worker
```

### 2.2 Run pending migrations

```bash
source .env.prod
pnpm --filter @cmc/db exec prisma migrate deploy
```

### 2.3 Check service health

```bash
docker compose -p cmcv2-prod ps
curl -sf http://localhost:3000/health && echo "API OK"
curl -sf http://localhost:3001/       && echo "Worker OK"
```

### 2.4 View logs

```bash
docker compose -p cmcv2-prod logs -f api
docker compose -p cmcv2-prod logs -f worker
docker compose -p cmcv2-prod logs -f nginx
```

### 2.5 Manual backup

```bash
source .env.prod
./scripts/backup-db.sh
```

### 2.6 Restore drill (run monthly or before major deploys)

```bash
source .env.prod
./scripts/restore-drill.sh
```

---

## 3. Rollback

### 3.1 Application rollback (no migration)

```bash
git checkout <previous-tag>
docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml build api worker
docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml up -d --no-deps api worker
```

### 3.2 Migration rollback

Prisma does not auto-rollback. Steps:
1. Identify the failing migration in `packages/db/prisma/migrations/`.
2. Write a compensating SQL migration manually.
3. Apply via `prisma migrate deploy` with the new compensating migration.
4. Never delete migration files from the `migrations/` directory.

---

## 4. Incident response

### 4.1 API not starting (boot-check failure)

Boot-checks run synchronously at startup. Check logs:

```bash
docker compose -p cmcv2-prod logs api | grep FATAL
```

Common causes:

| Error | Fix |
|-------|-----|
| `ALLOW_DEV_AUTH=1 must not be set` | Remove from `.env.prod`, restart |
| `LMS_SESSION_SECRET is using the insecure dev default` | Set a real secret in `.env.prod` (`openssl rand -base64 48`) |
| `STAFF_SESSION_SECRET must be set in production` | Add `STAFF_SESSION_SECRET` to `.env.prod` (`openssl rand -base64 48`) |
| `STAFF_SESSION_SECRET is using the insecure dev default` | Replace with a unique random value — MUST differ from `LMS_SESSION_SECRET` |
| `Database role is 'postgres', expected 'cmc_app'` | Check `APP_DATABASE_URL` uses the `cmc_app` role |
| `FORCE ROW LEVEL SECURITY missing on...` | `ALTER TABLE <t> FORCE ROW LEVEL SECURITY;` as superuser |
| `Database user has superuser privilege` | Revoke superuser from `cmc_app` |

### 4.2 Worker not starting

```bash
docker compose -p cmcv2-prod logs worker | grep FATAL
```

Same boot-check errors as API. Worker also validates email transport env vars at construction.

### 4.3 Email outbox row stuck in `sending` (RT-8)

The worker reaps `sending` rows older than 5 minutes back to `pending` each cycle.
If the worker is down, reap manually as superuser:

```sql
UPDATE "EmailOutbox"
SET status = 'pending',
    "lastError" = 'manual reap: worker was down'
WHERE status = 'sending'
  AND "updatedAt" < NOW() - INTERVAL '10 minutes';
```

### 4.4 Worker health returns 503

```bash
curl http://localhost:3001/
# Returns: fail: N consecutive drain failures
```

Steps:
1. `docker compose -p cmcv2-prod logs worker` — find root cause.
2. DB unreachable → fix connectivity, `docker compose -p cmcv2-prod restart worker`.
3. Email transport error → check `BREVO_API_KEY` / `GRAPH_*` env vars.

### 4.5 Nginx returning 502 for API

```bash
docker compose -p cmcv2-prod ps api
docker compose -p cmcv2-prod logs api
docker compose -p cmcv2-prod restart api
```

### 4.6 Disk full on VPS

```bash
df -h
docker system prune -f   # remove dangling images/layers
# If pg-data volume: run manual backup, then VACUUM FULL as superuser
# If blob volume (MinIO): list and remove old test objects
```

---

## 5. Backup schedule (cron on VPS host)

```cron
# Daily backup at 02:00 UTC, keep 30 days (BACKUP_KEEP_DAYS in .env.prod)
0 2 * * * cd /opt/cmcv2 && source .env.prod && ./scripts/backup-db.sh >> /var/log/cmcv2-backup.log 2>&1

# Monthly restore drill
0 3 1 * * cd /opt/cmcv2 && source .env.prod && ./scripts/restore-drill.sh >> /var/log/cmcv2-restore-drill.log 2>&1
```

---

## 6. Security checklist (before go-live)

- [ ] `.env.prod` not committed to git (`git check-ignore .env.prod`)
- [ ] `ALLOW_DEV_AUTH` absent from `.env.prod`
- [ ] `LMS_SESSION_SECRET` is ≥32 random chars (not the dev default)
- [ ] `cmc_app` DB role has no superuser privilege
- [ ] All RLS tables have `FORCE ROW LEVEL SECURITY` (boot-check verifies at start)
- [ ] nginx strips `x-dev-user` / `x-dev-lms-user` (verified by header-strip probe)
- [ ] Backup target is on a DIFFERENT host (`restore-drill.sh` asserts RT-13)
- [ ] `BACKUP_ENCRYPTION_PASSPHRASE` set and escrowed in team password manager
- [ ] R2 bucket public access disabled (CF Dashboard verified) + `BACKUP_BUCKET_PRIVATE_CONFIRMED=true`
- [ ] Restore drill passed at least once (dumps are `.dump.enc`, decrypted during drill)
- [ ] Escrow verified: decrypt test dump using passphrase from PM (not from `.env.prod`)
- [ ] R2 lifecycle rule set: `db-backups/` prefix → 30-day expiry
- [ ] TLS cert valid (HTTPS only, HTTP redirects to HTTPS)
- [ ] Isolation check passed — no cmcnew-* collision
