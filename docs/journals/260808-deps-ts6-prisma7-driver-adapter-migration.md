# 2026-08-08 — TypeScript 6 + Prisma 7 (Driver Adapter) Migration

**Session:** Held Dependabot majors #83 (TypeScript 5.7→6.0.3) and #84 (Prisma 6.19.3→7.9.1)
**Branch/PRs:** `chore/deps-typescript-6` (PR #88), Prisma 7 (PR #90, merged via #91)
**Plan:** `plans/260808-1122-prisma-7-driver-adapter-migration/`
**Status:** DONE — both merged to `main`, `develop` resynced, CI green on both

---

## Why split these two

Dependabot had been holding both majors back because they're both "breaking"
labels, but they are not the same *kind* of breaking. TS6 is a config problem
(tighter default lib/types resolution). Prisma 7 is an architectural problem
(it deletes the `datasource.url` / `datasources` constructor override that our
RLS app-role wiring depends on). Bundling them would have made a failing
typecheck ambiguous — mine or Prisma's? — so they went in as two PRs,
sequenced so TS6 landed clean before Prisma 7 touched anything. That call paid
for itself almost immediately (see below).

## TS6: the "mechanical" one that bit anyway

The actual fix was small: TS6 no longer implicitly pulls in `@types/node`
globals the way 5.7 did, so `"types": ["node"]` plus the `@types/node`
dependency had to be added explicitly to 6 packages. That part was exactly as
boring as advertised.

What wasn't boring: mid-session, a Prisma 7 version bump was tried early,
found to need more work than expected, and reverted in `package.json`. The
lockfile did not get regenerated cleanly, and it kept a stray `prisma@7.9.1`
entry around after the "revert." Consequence: `@cmc/scripts` typecheck broke
with `@prisma/client has no exported member 'Role'` — a real regression, not
noise. A review pass on this looked at the failure and called it
"pre-existing," which was flatly wrong: baseline before this session was
29/29 packages green. Nothing about a stray lockfile entry is pre-existing;
it's self-inflicted and traceable to one incomplete revert.

Root cause: reverting `package.json` version pins is not the same operation
as reverting the resolved dependency graph. `pnpm-lock.yaml` had already
resolved transitive `@prisma/*` packages against 7.9.1 and nothing forced a
re-resolve. Fixed by restoring the clean pre-Prisma-7 lockfile and
reinstalling from scratch rather than trying to hand-edit the lock.

**Lesson:** a version revert is only safe once the lockfile has been
regenerated from a known-clean base and reinstalled — checking the diff on
`package.json` alone is not verification. And "pre-existing" is a claim that
needs a baseline number attached to it, not a vibe. 29/29 green before this
session is not a caveat to wave away.

## Prisma 7: the one that needed real design work

Prisma 7 removes the `datasource: { url }` constructor override entirely and
requires either the new driver-adapter model or accepting whatever
`DATABASE_URL` the schema was generated against. Our RLS design (ADR 0042)
depends on choosing between an app-role connection string
(`APP_DATABASE_URL`) and a privileged one at *runtime*, per request context —
that's the whole mechanism that makes row-level security actually enforce
per-tenant/per-facility scoping instead of relying on client-side discipline.
Losing constructor-level URL override is not a cosmetic API change for us,
it's load-bearing.

Migrated to `@prisma/adapter-pg` + `prisma.config.ts`. Kept the precedence
rule `APP_DATABASE_URL ?? DATABASE_URL` inside `createPrismaClient()` exactly
as before, and added two new explicit constructors —
`createPrivilegedPrismaClient()` and `createPrismaClientWithUrl()` — instead
of overloading the default one, so call sites have to be honest about which
privilege level they're asking for. Also added a fail-loud guard so an
unset/misconfigured `PG*` env var throws instead of `pg.Pool` silently
falling back to local Postgres defaults and quietly connecting as a
super-user in dev.

The genuinely frustrating part: the migration recipe pulled from context7
up front (`experimental.adapter`, `engine: 'js'` shape) was stale — it
described an earlier or different Prisma 7 pre-release config shape, not what
`@prisma/config@7.9.1` actually validates. `@prisma/config`'s own validator
throws on excess/unknown properties, which is exactly what caught this: the
recipe's shape failed validation immediately instead of silently
misconfiguring anything. Recovered by reading the installed package's actual
schema and using the `datasource` + `migrations` shape it expects. Cheap
save this time because the config validator is strict — it would have been a
much worse afternoon against a looser config format that just ignores unknown
keys.

**Lesson:** treat any fetched "here's how to migrate to library X" recipe as
a hypothesis, not a fact, and verify it against the version actually
`pnpm list`'d in the lockfile — not the version the recipe assumes. This is
now the second time in this project a generic recipe didn't match the pinned
version; it should be standard practice by now, not a lesson re-learned.

## Verification before calling it done

- Typecheck: 29/29 packages green (post lockfile fix)
- `apps/admin` and `apps/lms` build clean
- `@cmc/api`: 2144 tests against a real synthetic Postgres (not mocked)
- RLS smoke: facility scoping verified both directions (in-scope row visible,
  out-of-scope row hidden), explicit bypass path checked, and the fail-closed
  default re-confirmed to return 0 rows when no context is set
- CI: `typecheck-and-test` and `ui-e2e` green on both PR #88 and PR #90/#91
- `develop` and `main` ended the session synced at the same commit

## Process notes worth keeping

- Every change went through branch + PR + CI, including the lockfile fix —
  no direct pushes to `main`.
- A subagent overstepped earlier in this general workstream; after that,
  subagents on this session were constrained to read-only / no-git so a
  half-finished edit couldn't get committed out from under the session again.
- The Prisma 7 driver-adapter plan (`plans/260808-1122-prisma-7-driver-adapter-migration/`)
  was written down *before* starting the implementation, specifically so that
  the scouting/research work (which config shape, which adapter, how RLS
  precedence maps onto it) wouldn't evaporate if the session got interrupted
  mid-migration. That paid off — the stale-recipe correction above is
  documented in that plan rather than having been rediscovered from scratch.

## Next steps

- Watch Dependabot for any Prisma 7.9.x patch releases that touch
  `@prisma/config` validation — the strict validator that saved us here is a
  double-edged sword if a patch adds new required keys.
- No further TS6 or Prisma 7 follow-up expected; both are considered closed
  unless CI regresses on `main`.
