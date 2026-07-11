# M1 P4 Hardening Landed · the pg_hba `trust`-vs-`scram` verification trap

**Date**: 2026-07-10 21:40
**Severity**: Info (landing) + Medium (dev-env footgun worth institutionalizing)
**Component**: apps/api worker (relay-email-outbox), packages/db (EmailOutbox), local Postgres dev container
**Status**: Resolved — PR #31 merged to main (merge commit `179c158`)

## What Happened

Landed M1 plan Phase 4 (hardening tồn đọng): the OTP-sweep write-amplification fix,
EmailOutbox `[status, createdAt]` index + `pruneTerminalOutbox` retention, and the
receipt-get RLS test fixture. Started from a worktree that was 48 commits behind main
(the entire Astryx UI migration had merged in parallel). Rebased clean — the only
in-scope collision was `receipt-get.test.ts`, which main had already fixed the same
day via `withFacility` while this branch fixed it via `testDbBypass`. Kept main's
version, dropped the duplicate. CI green (typecheck-and-test + e2e), merged, worktree
removed.

## The Brutal Truth

Mid-session I "verified" the local DB credentials were fine by running
`docker exec cmc-pg psql -U cmc_app ...` — it connected, so I declared the creds good
and blamed vitest env propagation. That verification was **worthless**, and it cost a
full diagnosis loop before I caught it.

The dev container's `pg_hba.conf` authenticates by connection source:

```
local   all  all                     trust          # unix socket inside container
host    all  all  127.0.0.1/32       trust          # loopback inside container
host    all  all  all                scram-sha-256   # everything else (host → mapped port)
```

`docker exec ... psql` connects over the container-internal loopback → hits a `trust`
line → **never checks the password at all**. Prisma connects from the Windows host
through the mapped TCP port → hits the `scram-sha-256` line → actually validates. The
live `cmc_app` role password had drifted from `.env`, so every Prisma call failed
`Authentication failed` while my psql "proof" stayed green.

## Technical Details

- **Root cause of the test wipeout:** `ALTER ROLE cmc_app` password ≠ the password in
  the worktree `.env`. Fix: re-`ALTER ROLE cmc_app WITH PASSWORD` to match `.env`
  (local throwaway DB, no secret exposure). After that, a direct
  `createPrismaClient().emailOutbox.findMany()` connected first try.
- **Correct verification** for "can the app auth?" is to exercise the *same path the
  app uses* — a Prisma client (or `psql -h localhost -p <mapped>` from the host so it
  goes through TCP/scram), **never** `docker exec psql` (internal loopback/trust).
- **Secondary cleanup:** the ~5 failed runs during diagnosis left `afterEach` cleanup
  un-run (auth was down), polluting `cmc_edu` with unique-constraint collisions. A
  blanket `TRUNCATE ... CASCADE` cleared it but also wiped the one migration-seeded
  singleton (`EmployeeCodeCounter` id=1) — had to re-`INSERT` it. Lesson: the seed
  singletons (`EmployeeCodeCounter`, any counter rows) are migration data, not test
  data; a truncate-all must reseed them.

## Lessons Learned

1. **A passing `docker exec psql` proves nothing about app auth.** Container-loopback
   is `trust`; the app's host→TCP path is `scram`. Verify on the path under test.
2. **"It connected" is not "the credentials are valid."** `trust` connects regardless.
   Distinguish *reachability* from *authentication*.
3. **Truncate-all reseeds are incomplete without migration singletons.** Counter rows
   inserted by migrations look like data but are schema fixtures.

## Follow-ups flagged (not fixed — out of Phase 4 scope)

- `EMAIL_OUTBOX_RETENTION_DAYS` bare `Number(process.env.X ?? 30)` has no validation;
  a garbage value → `Date(NaN)` → relay worker crash-loops. Consistent with existing
  repo convention (`EMAIL_MAX_ATTEMPTS` etc. are equally unvalidated), so **not**
  patched piecemeal — a shared env-number helper would be the DRY fix if this ever
  matters at pilot scale (YAGNI for now).
- Pre-existing migration↔`schema.prisma` drift (7 FK action mismatches, 18 tables'
  dropped defaults, `QualitativeAssessment.confidence` REAL→DOUBLE PRECISION) — the
  auto-generated migration tried to sweep it in alongside the index; stripped it out.
  Needs its own reviewed migration before a future `prisma migrate dev` re-bundles it.

---

**Commits**: `e988c74` (fix), `27d53f8` (docs) · **PR**: #31 · **Merge**: `179c158`
