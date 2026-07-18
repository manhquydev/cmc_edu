# P1-07: A Render-Race Login Bug, Proven by Capture — and a Throwaway DB That Refused to Touch Prod

**Date**: 2026-07-18
**Severity**: Completed / Bug fix (UX) + Infra capability
**Component**: apps/lms student auth guards, packages/db seed, apps/e2e, scripts/synthetic-seed-env.sh
**Status**: Shipped (commit 0344fd7). Opens Phase-4 evidence gate: condition 2 (env) ✅, condition 3 (blocker) ◐, condition 1 (PO) ⏳.

## What Happened

Two deliverables from one plan (fully red-teamed, 2 rounds):
1. Fixed a real LMS bug: a student logging in with the default password `Cmc2026@`
   (`mustChangePassword=true`) landed on `/student/home` instead of the forced
   `/student/change-password` screen — so a child could never be routed to change
   the shared default password.
2. Built a reusable throwaway synthetic-seed DB so UI e2e (and the gated Phase-4
   evidence collector) can run without ever touching the real `cmc_prod` data.

## The Brutal Truth: the 2026-07-10 hypothesis was wrong, and only capture proved it

The bug had sat as a `test.fixme` for eight days with a plausible-sounding hypothesis
in the comment: "session-context timing lag — the change-password guard reads a stale
session on first render." The red-team refused to accept one suspect and made me
enumerate three render-body `navigate()` guards (login root, change-password, home)
and **capture before fixing**.

I instrumented all three guards + the login handler with console logs, rebuilt, ran
the real browser test, and read the output:
```
onSuccess data.mustChangePassword= true
LoginPage root guard fired, session.mCP= true   ← the actual culprit
StudentHomePage render, session.mCP= true
```
The change-password page **never rendered**. The real mechanism: `setSession()` in the
login handler triggers a re-render of `LoginPage` (which consumes session and contains
the tab that fired the login). On that re-render, LoginPage's render-body
`navigate('/student/home')` guard fired and **clobbered** the handler's own
`navigate('/student/change-password')` — a classic side-effect-in-render race. The
eight-day-old hypothesis blamed the wrong file entirely. Had I "fixed" the
change-password guard as the fixme suggested, the bug would have survived untouched.

**Lesson burned in: a stale hypothesis in a comment is not evidence. Capture the
actual runtime behavior before changing a line.**

## The Fix

Convert all three student navigate-in-render guards to `<Navigate>` elements (the
correct React Router pattern — declarative, no side-effect-in-render race), and make
the LoginPage guard's destination honor `mustChangePassword` so the declarative guard
and the login handler always agree on where a given session should go. The
change-password guard now tests `mustChangePassword === false` explicitly (the field
is optional — `!undefined` would wrongly bounce a flagless session). The three guards
form mutually-exclusive fixpoints, so no redirect loop is possible. Server-side
enforcement (`assertPasswordNotExpired`, which blocks mutations for such students) was
untouched — this was a UX routing bug, not a security hole.

## The Infra Sub-Plot: a throwaway DB that never risks prod

The only Postgres running on the machine was the local-sim stack — which physically
hosts the real `cmc_prod` child data. The red-team had already flagged (Critical) that
a DB-name check is socat-bypassable and must not be the write-path control. So the
script stands up its OWN dedicated Postgres container (port 55432, never the local-sim
stack), gated by a positive `SYNTH_SEED_ALLOW` signal AND the shared
`assertNotProdDatabase` guard (extracted into `apps/e2e/src/assert-not-prod.ts` so the
e2e setup and the script share one source of truth) on both connection URLs.

Four infra snags, each handled rather than worked around:
- **The dev seed was silently broken.** The red-team predicted it; running it confirmed
  `Argument 'code' is missing` — `Facility.code` became a required unique with no DB
  default in migration 20260706170000, but the direct-Prisma seed create omitted it
  (the API-layer `facility.create` auto-derives code; the seed bypasses that layer).
  Fixed, plus a sentinel facility and an import-safe entrypoint guard.
- **Two Prisma versions.** `npx prisma` from repo root resolves v7 (which rejects
  `url = env()` in schema); the migrate must run via `@cmc/db`'s own v6.
- **RLS role split (ADR 0042).** The API server refuses to boot as a superuser. The
  throwaway needs `cmc_app` (NOSUPERUSER, for the app) plus `postgres` (owner, for
  migrate/teardown) — the migration creates `cmc_app` but leaves its password to be
  set out-of-band.
- **A stray `prisma/.env`.** The first sentinel verify (via a Prisma client in the
  script) read the wrong DB; switched to `psql` inside the container as `cmc_app`.

## Pre-existing failures, kept honest

Against a fresh throwaway DB, 5 attendance e2e specs (single-day batch date-range) and
2 admin-shell UI specs (EmptyState) fail. Both sets were proven to fail **identically on
clean HEAD** (changes stashed) — pre-existing, environment/date-sensitive, and out of
scope. They are not in this change's diff and were not attributed to it.

## Lessons Learned
1. **Reproduce-and-capture beats reasoning for timing bugs.** Three plausible suspects,
   one real culprit; the console capture settled it in one run where eight days of
   staring at code did not.
2. **Side-effect-in-render is a real bug class, not a style nit.** `navigate()` in a
   render body races the router; `<Navigate>` is declarative and race-free.
3. **A safe throwaway env is worth building carefully.** When the only DB on the box is
   prod-adjacent, "make a new database on it" is the wrong move — stand up an isolated
   container and gate every write with a positive signal + a shared guard.
4. **Prove pre-existing failures; never absorb them into your change's blame.** `git
   stash` + re-run on clean HEAD is the cheap, honest proof.

## Next Steps
1. Phase-4 evidence collector still needs gate 1 (PO shows the dashboard to a director)
   and its own real business-flow UI spec (`acceptance-evidence-p1.ui.spec.ts`) — the
   fixed login test cleared the blocker but is not itself a valid evidence target.
2. The pre-existing attendance/admin-shell e2e failures deserve a separate triage — they
   fail against any fresh throwaway DB.

---

**Status**: DONE. P1-07 test un-fixmed and passing; synthetic-seed env reusable and
prod-safe; independent code-review 9/10, no blockers; typecheck + lint clean.
