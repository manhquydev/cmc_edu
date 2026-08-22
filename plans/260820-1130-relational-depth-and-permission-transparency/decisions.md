# Locked decisions

Grounded in the kongming-supervised brainstorm
(`../reports/brainstorm-advise-260820-project-completeness-next-program.md`) and verified against
source. Two of these (RL1, RL2) are new externally-observable policies recorded before wiring, per
AGENTS.md.

## RL1 — `RecordLink` rendering contract (new policy)

- `RecordLink` is **presentational**. It renders `<a href={links[entity](id)}>label</a>` when a
  valid `id` is present; otherwise it renders the label as plain text.
- Prefer the direct `links.*` path for in-app navigation. Reserve `/go/:entity/:id` for
  copy/share affordances (it costs a resolver redirect).
- The link is **not** an authorization boundary. The target route + tRPC `requirePermission` are.
  Client `canDo` may downgrade a link to plain text purely as UX (avoid dead links that 403); it
  must never be relied on for access control.
- **No payload widening to enrich a link.** Never fetch or display a label the viewer could not
  otherwise see just to make it linkable. Each new hop must source its label/id from a payload the
  viewer already legitimately receives.

## RL2 — `no_open` config-FK list (new policy)

- Work records hop; configuration references stay text. The initial `no_open` set is a **static
  constant** (not a feature): `program` (course program string), `room`/classroom code, `course`
  catalog name. Extend the constant only with an explicit decision entry here.

## RL3 — Permission matrix is read-only

- The matrix screen is a **reference table** derived at build/render time from `@cmc/auth`
  (`PERMISSIONS`, `ACTIVE_ROLES`, `ROLE_LABELS`). No toggles, no buttons, no "coming soon"
  affordances that imply editability.
- `super_admin` renders as **"all"** (it is omitted from every `PERMISSIONS` row and bypasses
  `can()`), never as empty.
- Empty-roster keys (`facility.*`, `audit.list`, `facilityNetwork.manage`,
  `compensationPolicy.manage`) render as **super_admin-only**, never as "nobody".
- Every cell/row is annotated **"registry door"** vs **"door + SoD/row rule"** for keys with
  procedure-level constraints the map cannot express (`crm.opportunityAssign` ownership; finance
  SoD where sale drafts but lacks `receiptList`/`receiptGet`; `kpi.confirm` `managerId===caller`;
  directors cannot mint `super_admin`).
- The screen is itself gated behind `user.manage` (or `super_admin`) — a permission map is
  sensitive recon.

## RL4 — No runtime RBAC editor

- The role catalog (`ACTIVE_ROLES`) and permission rosters (`PERMISSIONS`) stay code + drift tests
  (`packages/auth/src/index.test.ts`). Adding/changing a role or key remains an ADR + code change,
  not a DB mutation. This program only *surfaces* the matrix, it does not make it editable.

## RL5 — Gate-key reconciliation, not re-authorization

- Reconcile nav/route/procedure permission keys so the UI matches the API's real authority. This
  fixes UX correctness (e.g. GĐĐT holds `parentAccount.read` but the Parents nav leaf uses
  `updateEmail`, hiding it). It must **not** change the API authority itself; API stays the source
  of truth. Each reconciliation is proven by an existing or added test.

## RL6 — Timeline fills are selective (D5-bound)

- Add an operational `RecordEvent` timeline only where lifecycle/operational value is real:
  **AfterSaleCase** (open→in_progress→resolved→closed) and **ShiftRegistration**
  (submit→approve/reject/cancel). Follow the domain-owned `record-event.ts` + `RecordTimeline`
  pattern with closed per-`(entity,kind)` payload allowlists.
- **Reward, KpiScore, ManualAttendanceTicket** stay **AuditLog-only** (documented decision, not an
  omission).
- **Exercise** cannot use `RecordEvent`: it is a global entity with no `facilityId`, incompatible
  with the facility-scoped, RLS-forced `RecordEvent` substrate. Any future exercise timeline needs
  a different substrate and its own decision.
- **ClassSession** keeps emitting onto `ClassBatch` (classified `workspace-detail`). Not reopened here.

## RL7 — Inherited invariants (unchanged)

- Path-based URLs and `@cmc/links` as the canonical builder (predecessor D7).
- Dual ledger: `RecordEvent` operational vs `AuditLog` compliance; no UI widening of `audit.list`;
  no fake backfill (predecessor D3/D4).
- Course/Gift/Facility remain config catalogs (predecessor D5).
- New `:id` routes register in `scripts/resource-depth-audit.mjs` (predecessor Phase 7 gate).
