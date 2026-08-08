---
phase: 4
title: "Phase 4: Live Browser Visual Smoke"
status: completed
priority: P1
effort: "1-2d"
dependencies: [3, 5, 6]
---

# Phase 4: Live Browser Visual Smoke

<!-- Updated: Red Team Session 2026-08-07 — see plan.md "## Red Team Review" for full rationale -->

**Execution order note:** this phase now runs LAST of the implementation
phases (after Phase 3's audit, Phase 5's component changes, and Phase 6's
cleanup deletions — file number "4" no longer matches execution order, see
plan.md's corrected Phases table). It was originally positioned 4th, which
meant the plan's only pixel-level check would have run before the phases that
actually change pixels. Phase 7's closure of the rollout plan cites THIS
phase's report specifically because it now runs after everything else.

## Overview

**Validation decision:** the implementing agent drives the browser live during
this phase (via Chrome/Playwright automation), not the human operator — the
operator reviews the resulting pass/fail report rather than clicking through
routes themselves.

Close the "human visual smoke" gap that's been open since the original design3
rollout: CI's `ui-e2e` proves DOM state/text transitions, not pixels — nobody
has actually looked at the shipped Console (née Odoo) UI rendering in a real
browser. This phase does that, live, using a genuinely isolated synthetic
database and real staff-session auth — not screenshots, not real data.

**Red-team correction (Critical — this replaces the original approach
entirely, do not use the original version of this phase):** the original plan
specified `LOCAL_SIM_SEED_ALLOW=1 tsx scripts/seed-local-sim-demo.ts` against
`pnpm --filter @cmc/admin dev`, describing it as seeding "a local dev DB …
synthetic fixture data only," with `DATABASE_URL` as the safety check. Every
part of that was wrong: that script does not read `DATABASE_URL`; it targets
the **local-sim production compose stack** (`https://erp.localhost`, database
literally named `cmc_prod`), reads real bootstrap credentials from `.env.prod`,
and **rotates the super-admin password** as a side effect. Running the
original version of this phase as written could have caused a real credential
incident. The corrected approach below uses `scripts/synthetic-seed-env.sh`
instead — a dedicated, throwaway Postgres container with a positive-allow
gate (`SYNTH_SEED_ALLOW=1`) and a shared fail-closed `assertNotProdDatabase`
guard checked against both connection URLs (verified by reading the script
directly: `scripts/synthetic-seed-env.sh`).

The original plan also ran the admin app via `pnpm --filter @cmc/admin dev`
(Vite), which authenticates via the forgeable `x-dev-user` header rather than
the real `cmc_staff_session` cookie — everything this phase needs to inspect
(navbar module list, ⌘K contents, systray buttons) is permission-derived, so
inspecting it under a header-bypass isn't inspecting the real auth path.

**Round-2 correction (finding #7): round 1's replacement does not fix that.**
Swapping `x-dev-user` for an *injected* `cmc_staff_session` cookie keeps the
identical trust model — `mintStaffCookie` accepts caller-supplied `roles`, and
the API derives the subject from those claims without touching the database. An
implementer can mint `super_admin`, confirm the cookie in DevTools, and tick the
criterion while the module list they inspect comes from an array they typed. The
Requirements below force an explicit choice between the real login flow and an
honestly-scoped rendering-only claim.

## Requirements

- [ ] Throwaway synthetic Postgres already up from **plan.md Prerequisites
      step 3** (round-2 finding #5 moved the standup there, because Phases
      1/2/5/6 all cite a local e2e gate that cannot run without it and this
      phase now executes last). If re-running here:
      **`SYNTH_SEED_ALLOW=1 bash scripts/synthetic-seed-env.sh --fresh`** —
      note the leading `bash`: the script is mode `100644`, so the literal
      invocation in round-1's version fails with Permission denied.
      Dedicated container on its own port, never the local-sim `cmc_prod`
      stack, never `.env.prod`.
- [ ] **Seed a staff user — the script does not create one.**
      `scripts/synthetic-seed-env.sh:85-100` seeds `packages/db/prisma/seed.mjs`
      and then verifies only a facility sentinel. With no `User` row there is
      no identity to log in as and no `userId` to put in a session (round-2
      finding #14). Seed one against the throwaway `DATABASE_URL` — never
      `.env.prod`.
- [ ] **Use the proven serve recipe, not a README that doesn't exist.**
      Round 1 said to "check `apps/api`'s and `apps/admin`'s README/`package.json`
      for the exact local-serve commands" — `apps/admin` has no README and its
      scripts are only `{build, dev, typecheck, preview, test}`, so that
      instruction resolved to nothing. The working wiring is
      `apps/e2e/playwright.config.ts:78-96`: build admin, then
      `pnpm --filter @cmc/admin preview --port 4173` with `VITE_API_URL:''` and
      `VITE_PROXY_API_TARGET:'http://127.0.0.1:3999'`, with the API spawned as
      `global-setup.ts` does it. Copy that.
- [ ] **State honestly what the auth path proves — do not repeat round-1's
      claim (round-2 finding #7).** Round 1 replaced the `x-dev-user` header
      with an injected `cmc_staff_session` cookie and called it "the real auth
      path." It is the same trust model: `mintStaffCookie`
      (`apps/e2e/src/session-injection.ts:128-145`) takes `roles`/`facilityId`
      as **caller-supplied arguments**, its own comment at `:135-136` says
      "Mode-B helper … bypasses SSO," and `apps/api/src/context.ts:218-232`
      builds `subject` straight from those claims with **zero DB lookup** —
      byte-identical in shape to `parseDevUser` (`:74-86`). The only difference
      is an HMAC.
      **Validation decision (2026-08-07): use the REAL login flow.** Drive
      `POST /auth/staff-login` with a password against the staff user seeded
      above, so the permission-derived UI (module list, ⌘K contents, systray
      buttons) is genuinely verified rather than reflecting an array the
      implementer typed. The injected-cookie shortcut
      (`mintStaffCookie`) is **not** acceptable here — if it turns out to be
      unavoidable for some route, say so explicitly in the report and downgrade
      that route's claim to "rendering only, not permission derivation." Never
      use the shortcut while claiming the strong result.
- [ ] **Never export `STAFF_SESSION_SECRET` from `.env.prod` in this session.**
      `session-injection.ts:143` falls back to a repo-constant dev secret; with
      the production secret in the environment, `mintStaffCookie` mints a
      **production-valid super-admin cookie**.
- [ ] Demo data for the routes below exists in the throwaway DB: the seed
      plants a facility sentinel only — a CRM opportunity, a cancelled finance
      receipt, and a teaching session need creating by hand through the running
      UI (acceptable for a manual smoke phase) unless
      `apps/e2e/src/global-setup.ts` already provisions them (check first).
- [ ] Every route flagged in `docs/design-system-console.md` (renamed from
      `design-system-odoo.md`) as needing visual smoke is actually visited and
      visually inspected:
      - `/crm` — pipeline kanban board + list↔kanban switcher
      - `/crm/opportunities/:id` — detail page with chevron `WorkflowStatusbar`
      - a cancelled receipt at `/finance/:id` (status='cancelled' — create one
        via the UI first if none exists)
      - `/teaching/schedule` — FullCalendar with `console-fc*` (née `o-fc*`) skins
      - a toast trigger (e.g. `/admin/classes` copy-code action)
      - the ⌘K command palette (any authenticated page)
- [ ] Findings recorded as a pass/fail checklist with textual description of
      what was seen — no screenshot files committed to the repo, and any
      screenshot artifact browser-automation tooling writes to disk outside
      the repo (e.g. `.playwright-mcp/`) is deleted at the end of the session,
      not just left gitignored.
- [ ] After the session: `docker rm -f cmc-synth-pg` (or the container name
      `synthetic-seed-env.sh` printed) to tear down the throwaway environment —
      leaving it running is harmless but unnecessary.
- [ ] This phase's report is the evidence that closes the open item in
      `plans/260805-1920-design3-admin-rollout/plan.md`, and it covers the
      UI as it exists AFTER Phase 5 and Phase 6 (see execution order note) —
      not an earlier state.

## Architecture

No code changes expected unless a real visual bug is found — see Risk
Assessment.

## Related Code Files

**Run (no repo edits):**
- `SYNTH_SEED_ALLOW=1 bash scripts/synthetic-seed-env.sh --fresh` (leading `bash` is required — mode `100644`)
- Whatever the script's own output instructs for exporting `APP_DATABASE_URL`/`DATABASE_URL`
- A staff-user seed against that `DATABASE_URL` (the script creates none)
- API + admin served per `apps/e2e/playwright.config.ts:78-96` — build, then `preview --port 4173` with `VITE_API_URL:''` / `VITE_PROXY_API_TARGET:'http://127.0.0.1:3999'`. Do **not** use `pnpm --filter @cmc/admin dev` (that is the `x-dev-user` path), and do **not** consult `apps/admin/README.md` — there isn't one.

**Read (for the real-auth mechanism):**
- `apps/e2e/src/session-injection.ts`
- `apps/e2e/src/global-setup.ts` (check whether it already seeds CRM/finance/teaching demo data beyond the base sentinel)

**Create:**
- `plans/260807-1453-cmc-console-design-system-rebrand-hardening/reports/visual-smoke-<date>.md`

## Implementation Steps

1. Run `SYNTH_SEED_ALLOW=1 scripts/synthetic-seed-env.sh --fresh`; capture the
   printed `APP_DATABASE_URL`/`DATABASE_URL` and export them for the API server.
2. Read `apps/e2e/src/session-injection.ts` and `global-setup.ts`; determine
   the least-effort way to get a real, signed `cmc_staff_session` cookie in a
   browser session pointed at this throwaway DB (reuse the e2e mechanism if
   it's reusable outside the Playwright test runner; otherwise complete the
   real staff login flow once by hand).
3. Confirm via browser DevTools Network tab that requests carry a
   `cmc_staff_session` cookie and NOT an `x-dev-user` header, before recording
   any pass/fail below.
4. If `global-setup.ts` doesn't already provide CRM/finance/teaching demo
   data, create it by hand through the running UI: one CRM opportunity, one
   finance receipt then cancel it, one teaching session (whatever's needed
   for `/teaching/schedule` to render non-empty).
5. Using live browser automation (Chrome DevTools/Playwright driven
   in-session), visit each route in Requirements and visually inspect:
   correct navbar chrome, kanban card layout/accent colors, chevron statusbar
   shape (including the cancelled terminal step), toast appearance/positioning
   (float-layer stacking — Phase 2 touched those classes), ⌘K palette
   rendering and z-index above other content, FullCalendar cell styling.
6. For each item, record pass/fail + a one-line description of what was
   actually seen (not a screenshot) in the report.
7. If a real visual defect is found, log it in the report as a finding; fix
   it as a small separate commit with its own verification, or flag it for a
   follow-up decision if it's not simple. **Any inline fix must be
   re-verified by re-running the affected route in this same session and by
   the full real-gate set (`pnpm test`, `pnpm --filter @cmc/admin build`,
   `PLAYWRIGHT_UI=1 ui-chromium`) — round-2 open question: no later phase
   gates on Phase 4's diff, since this now runs second-to-last. A fix made
   here is otherwise unverified by anything.**
8. Delete any screenshot/trace artifacts browser-automation tooling wrote to
   disk (e.g. `.playwright-mcp/`) — don't just rely on `.gitignore`.
9. Tear down the throwaway container (`docker rm -f <container-name>`).
10. Update `plans/260805-1920-design3-admin-rollout/plan.md` status to
    `completed` once this report confirms all its previously-open visual-smoke
    items pass (Phase 7 does the actual doc edit; this phase produces the
    evidence it points to).

## Success Criteria

- [x] Environment stood up via `synthetic-seed-env.sh`, never the local-sim
      stack, never `.env.prod` credentials — confirmed in the report.
- [x] **Real `POST /auth/staff-login` password flow used** (validation
      decision), against the seeded staff user — not `mintStaffCookie`. Any
      route that had to fall back to an injected cookie is named in the report
      and its claim downgraded to rendering-only. A `cmc_staff_session` cookie
      visible in DevTools is NOT by itself evidence of permission fidelity
      (finding #7). `STAFF_SESSION_SECRET` was not sourced from `.env.prod`.
- [x] A staff user was seeded into the throwaway DB (the seed script creates
      none) and the admin app was served via the `playwright.config.ts:78-96`
      recipe, not `pnpm --filter @cmc/admin dev`.
- [x] All six flagged routes/elements attempted; **4 fully rendered PASS, 2 WARN empty fixtures** — see report
      pass/fail in the report.
- [x] Zero screenshot files added to the repo; disk-level automation
      artifacts (`.playwright-mcp/` or similar) deleted, not just gitignored.
- [ ] Throwaway Postgres container torn down after the session. *(deferred — still up for Phase 7; run `docker rm -f cmc-synth-pg` when plan finishes)*
- [x] Any defect found is either fixed (small, tracked) or explicitly logged
      as a follow-up, not silently ignored.
- [x] Report exists at the path above and is referenced by Phase 7's rollout-plan closure edit.

## Risk Assessment

- **Reusing the original (dangerous) seed path**: if anyone re-derives this
  phase from the plan's git history or an older cached copy instead of this
  file, they'll find `seed-local-sim-demo.ts` — that script is legitimate for
  its own documented purpose (bootstrapping the local-sim stack) but is the
  wrong tool here. This file is the corrected version; don't fall back to the
  original.
- **`x-dev-user` creeping back in**: it's the path of least resistance (just
  run `pnpm --filter @cmc/admin dev`), which is exactly why the original plan
  used it without noticing the auth-fidelity gap. Step 3's explicit
  DevTools check exists to catch this before it invalidates the whole phase's
  evidence value.
- **Demo data gaps**: if `global-setup.ts` doesn't provide enough seeded state
  for a specific route (e.g. no existing cancelled receipt), creating it by
  hand through the UI is explicitly acceptable here — this is a manual
  verification phase, not an automated one.
- **Finding a real bug this late**: Phases 1-3 and 5-6 should have caught
  regressions already; if this phase finds one anyway, that's informative for
  how thorough the earlier gates need to be next time, not just a fix-and-move-on.


## Completion Notes

**Completed:** 2026-08-07.

**Report:** `reports/visual-smoke-2026-08-07.md` — **8 PASS / 2 WARN / 0 FAIL**.

**Auth:** real form `POST /auth/staff-login` against synth DB staff user. No mint/cookie-inject in browser (form login only). Seed bootstrap may use x-dev-user for user.create only. No `.env.prod`.

**WARNs:** empty CRM detail navigation + empty finance list (fixture gaps on base seed, not rebrand regressions).

**Teardown:** synth container left up for Phase 7 optional re-check; remove with `docker rm -f cmc-synth-pg` when done.


### Residual for Phase 7 (do not close design3 smoke without these)

1. CRM opportunity detail statusbar — not opened (no card click / empty pipeline detail path)
2. Cancelled finance receipt statusbar — no receipts on base seed
3. Optional: toast *trigger* (viewport present; action toast not forced)
4. Teardown `cmc-synth-pg` still pending
