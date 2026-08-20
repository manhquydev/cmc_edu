# Brainstorm + Advise — Project completeness & next program

**Date:** 2026-08-20
**Mode:** `ak:brainstorm --advise` (kongming-supervised). Read-only survey; shapes intent, does not implement.
**Predecessor:** `plans/260817-1354-resource-detail-and-operational-timeline-depth/` (completed, main green).

## Evidence base (4-stream omp survey)

- Frame coverage: [`survey-260820-frame-coverage.md`](./survey-260820-frame-coverage.md)
- Authz + role UI: [`survey-260820-authz-role-ui.md`](./survey-260820-authz-role-ui.md)
- Log/history: [`survey-260820-log-history.md`](./survey-260820-log-history.md)
- Odoo/OpenEduCat research: [`research-260820-odoo-openeducat-patterns.md`](./research-260820-odoo-openeducat-patterns.md)

## Where the project stands

The completed resource-depth program built the **chrome**: path-based routing, `DetailPage`, `@cmc/links` + `/go/:entity/:id`, the dual ledger (`RecordEvent` operational vs `AuditLog` compliance), per-domain timelines for **7 entities** (Opportunity, AppUser/Staff, Student, ClassBatch, Receipt, ParentAccount, ParentMeeting), the canonical `/hr/staff` surface, and a CI-enforced `resource-depth:audit` (0 unknown routes, 13 registered exceptions).

What is **not** done is the *connective tissue and governance surface* the user is describing.

## Gap clusters

**A. Relational cross-linking (user's #1 pain).** Detail pages exist but entity references render as **plain text**, not links. Concretely missing hops (all with `file:line` in the frame survey): session→student (attendance/assessment rows have `studentId`), session→teacher (not shown at all), session class-as-link (only a side button), class→teacher (picker only), student→class (`batchCode` text), student→parent, and receipt/aftersale/reward/parent-meeting→student, kpi/shift→staff. Infra already exists (`@cmc/links` + `/go`); needs a small `RecordLink` + wiring. **Live bug:** receipt links `/finance/:id/activity` but that route isn't registered (`finance.routes.tsx` only has `overview|order-lines`) → 404.

**B. Permission/role transparency (user's #2 theme: "giao diện quyền hạn của từng vai trò").** No screen shows the role→permission matrix. `PERMISSIONS` is a 68-key code table over 5 active roles (+`super_admin` bypass). `/hr/staff/:id/access` only assigns role slugs. Plus latent nav-vs-route-gate mismatches (`gift.list` lets sale type past the SPA gate — cosmetic; `parentAccount.read` vs nav `updateEmail` hides the Parents leaf from GĐĐT — a real functional gap). None is a security hole (API `requirePermission` is authoritative).

**C. Timeline coverage gaps.** 6 registered `timeline-gap` entities (AfterSaleCase, Reward, Exercise, ManualAttendanceTicket, ShiftRegistration, KpiScore) + ClassSession have detail but no `RecordEvent` timeline. Taxonomy D5: add a timeline only where it has real operational value.

**D. Course/Facility** stay config catalogs by prior decision (D5) — not gaps.

## Brainstorm contract

- **Outcome:** Users can navigate the center's records relationally (click a class code / student / teacher / parent anywhere → that record's detail page), see a truthful per-role permission reference, and reach an operational timeline on the records where it matters — closing the residual "frame" of the resource-depth program.
- **Constraints:** Reuse existing primitives (path routing, `DetailPage`, `@cmc/links`/`/go`, dual ledger, `module.action` RBAC + RLS); one series at a time (D6); every protected PR terminal-green on `typecheck-and-test` + `ui-e2e`; new `:id` routes must register in `resource-depth:audit`; record new externally-observable policies in `decisions.md` before wiring.
- **Non-goals:** No Odoo hash/OWL/generic relational or metadata framework; no runtime RBAC/role editor; no generic client-supplied `entity/entityId` timeline; no detail pages for Course/Facility; no ClassSession-as-own-timeline-entity in this program; no payload widening to enrich links.
- **Acceptance:** `RecordLink` used for the enumerated hops with browser proof; receipt `/activity` resolved (registered or NavLink removed); read-only permission-matrix screen (gated behind `user.manage`/`super_admin`, super_admin shown as "all", door-vs-SoD annotated); AfterSaleCase + ShiftRegistration timelines live; the other 4 gap entities explicitly closed as "AuditLog-only by decision"; both required CI checks green.

## Options compared

| Option | Scope | Pros | Cons |
|---|---|---|---|
| **1. Relational depth first** | `RecordLink` + wire hops + `no_open` config-FK rule + receipt `/activity` fix + gate-mismatch fixes | Hits the explicit #1 pain; lowest risk; reuses infra; fast | Leaves matrix + timeline gaps open |
| **2. Depth + governance** | Opt 1 + read-only permission-matrix viewer + reconcile nav/route/procedure keys | Adds the transparency the user asked for; still low-risk (read-only) | Larger; matrix must be annotated carefully or it misleads |
| **3. Full frame closure** | Opt 2 + fill timeline-gap entities + decide ClassSession | Closes the residual program | Largest; Exercise needs new substrate; ClassSession is an ADR, not a chore |

## Recommendation (kongming-endorsed, with adjustments)

**One new multi-phase plan, sequenced A → B → C, one series at a time:**

- **Phase 1 — Relational depth.** Build a thin, presentational `RecordLink` (renders `<a href={links[entity](id)}>` when `id` present; degrade to text via `canDo` for UX only — the route+API are the real boundary; prefer `links.*` over `/go` for in-app hops). Wire the enumerated hops. Apply an Odoo-style **static `no_open` list** (program, room, course stay text). **Resolve receipt `/activity`** by evidence: Receipt *does* emit `RecordEvent` and `finance.receiptTimeline` exists, so register the section to match student/class — unless Phase-1 scoping shows the timeline renders elsewhere, in which case delete the dead NavLink. **Tail of Phase 1:** the nav/route-gate reconciliations (cheap correctness, same mental model). Watch: the **student→class hop** has a real authz wrinkle — the enrollments section is gated to `enrollment.grantUnits` (GĐĐT-only); put the link where read-eligible roles get it, don't widen a payload.
- **Phase 2 — Read-only permission matrix + gate reconciliation.** Derive from `@cmc/auth` (already public; free drift tests). **Traps to encode:** super_admin = "all" (it's omitted from `PERMISSIONS` + bypasses `can()`); empty-roster keys = super_admin-only; annotate **"registry door" vs "door + SoD/row-rule"** (e.g. sale has `crm.opportunityAssign` but only over own leads; sale has `finance.receiptCreate` but not `receiptList`; `kpi.confirm` needs `managerId===caller`; directors can't mint super_admin). Gate the screen behind `user.manage`/`super_admin`.
- **Phase 3 — Selective timeline fills.** **AfterSaleCase + ShiftRegistration only** (clear facility-scoped lifecycles), following the domain-owned `record-event.ts` + `RecordTimeline` pattern. Write an explicit decision that Reward/KpiScore/ManualAttendanceTicket stay AuditLog-only, and that **Exercise cannot** use `RecordEvent` (it's global, no `facilityId`; RLS substrate mismatch) — closing the `timeline-gap` exceptions honestly.

**Delivery mechanics:** fresh plan dir + feature branch, delivered in a **git worktree** (other agent sessions are live in this repo — workspaces `wQ`/`wR`/`wS` — so isolate the working tree/index). Record two new policies in `decisions.md` before wiring: (1) the `no_open` config-FK list; (2) the `RecordLink` permission-rendering contract.

## Top risks to watch

1. **Receipt `/activity` → empty page:** confirm the emit/timeline path in Phase-1 scoping; register-or-delete on evidence, never route to a blank timeline.
2. **Matrix misrepresents authority:** an un-annotated table ("sale can assign leads / GĐĐT can't see parents") is worse than none — highest-consequence correctness risk.
3. **Link leaks a label:** the anchor is safe (names are already shown as text today); the trap is widening a `get`/list payload to enrich a link for a role lacking read — audit each hop's data source, especially anything near `classRoster.read`.
4. **CI audit gate:** any new `:id` route must land in `DETAIL_DEPTH`/`STATIC_ROUTE_CATEGORIES`/`EXCEPTIONS` in the same commit or `resource-depth:audit` fails.
5. **Odoo scope creep:** "learn from Odoo" must stay directional. Pre-commit the "no generic framework / no runtime RBAC editor / no Course-Facility detail / no payload widening" boundary in `decisions.md`.

## Handoff

Next workflow: the installed **plan skill** to author `plans/<ts>-relational-depth-and-permission-transparency/` (phases above), then `ak:cook`/implementation, carrying `--advise` so kongming supervises to green CI. This brainstorm shapes intent only; no code was changed.

## Unresolved (confirm at plan time)

- Receipt `/activity`: register vs delete (read `finance/router.ts` + `receipt-detail.tsx` section wiring).
- Any explicit user demand for KPI/Reward timelines would promote them into Phase 3.
- Worktree vs branch assumes other sessions may touch this repo concurrently — confirmed live at survey time.
