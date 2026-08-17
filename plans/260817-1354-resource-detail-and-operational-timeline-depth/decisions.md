# Locked decisions

## D1 — Canonical staff information architecture

- Canonical list: `/hr/staff`.
- Create: `/hr/staff/new`.
- Detail: `/hr/staff/:staffId`.
- Durable detail sections: `/profile`, `/access`, `/activity`.
- `/hr/staff/:staffId` redirects to `/profile`.
- `/admin/users` and `/admin/users/:staffId` are compatibility redirects only.

## D2 — Staff authorization

Preserve the current `user.manage` business authority:

| Actor | Target | Read/edit profile | Roles | Reset password |
|---|---|---:|---:|---:|
| `super_admin` | same-facility staff | yes | yes | yes |
| either director | ordinary staff or peer director, same facility | yes | active roles except `super_admin` | yes |
| either director | `super_admin`, same facility | read-only | no | no |
| ordinary staff | any staff record | no | no | no |

- Cross-facility target is always `NOT_FOUND`.
- Preserve current same-facility list visibility: directors may see/open a `super_admin` profile,
  but all profile, role and credential mutations stay forbidden.
- Staff manager-picker eligibility excludes `super_admin` for a non-super-admin caller; this does
  not change unrelated payroll/teacher picker contracts.
- Self-service remains `/hr/my` and `user.changeOwnPassword`.
- Nav visibility never replaces API authorization.
- Any future restriction on peer directors or reporting-tree scope needs separate product authority; this plan does not silently change the as-built permission.

## D3 — Two ledgers

- `AuditLog`: global security/compliance ledger, `super_admin` only.
- `RecordEvent`: facility-scoped operational timeline shown on record detail.
- No UI-only widening of `audit.list`.
- No fake backfill from `AuditLog` to `RecordEvent`.
- Detail shows the truthful history epoch: events exist only after that entity starts emitting them.
- `RecordEvent` is durable business history in this program; no retention/deletion policy is added.

## D4 — Timeline security

- Each domain exposes its own timeline procedure.
- Procedure loads/authorizes the parent record in the same facility before reading events.
- No generic client-selectable `entity/entityId` endpoint.
- Event payloads use allowlists per `entity + kind`; never raw mutation input.
- Credential actions emit secret-free event metadata only.

## D5 — Record taxonomy

Create detail depth only for a first-class record with stable identity plus at least two of:

- lifecycle/HITL action;
- multi-field or relational work surface;
- share/back/F5 requirement;
- operational timeline value;
- downstream references.

Catalog/config entities remain compact when operator work is bounded CRUD with no independent
case lifecycle, even if downstream transactional records reference the catalog item. The
transactional record gets detail depth; the referenced catalog does not automatically inherit it.

Keep workspace/config/dashboard behavior for:

- check-in punch, attendance, grading, payroll-by-period, reports;
- course catalog in its current two-field deferred model, gift catalog, salary tiers,
  network/geofence and shift configuration;
- leaderboard/cockpit/report dashboards.

## D6 — Rollout order

1. Staff/AppUser P0.
2. Existing core detail records: class, student, parent, receipt.
3. Missing detail record: parent meeting.
4. Existing newer records: aftersale, reward, exercise, shift, KPI, punch ticket, session.
5. Course and Gift stay catalog/config-grid under D5. Course needs a separate curriculum product
   decision before editable detail because `program` is copied into ClassBatch/code generation.

One module series at a time. Each series must pass API, UI and deep-link proof before the next begins.

## D7 — Compatibility

- Static `/new` routes precede `/:id`.
- Canonical paths live in `@cmc/links`.
- `/go/:entity/:id` accepts only registered entities and UUIDs.
- Old URLs redirect with `replace`; no second editable screen.
- Dedicated `/new` create-success replaces the compose history entry; modal create-success pushes.
- User tab changes push history. Base-detail and compatibility redirects replace history.
- Validated same-origin return context preserves `pathname + search`; direct/F5/`/go` falls back
  to the canonical list.
- Unknown section names render route-level not-found; only the exact base detail path redirects to
  the default section.

## D8 — Canonical paths for missing records

- Parent meeting list: `/crm/parent-meetings`.
- Parent meeting detail: `/crm/parent-meetings/:meetingId`.
- Existing `/crm/post-sale-meeting` redirects to `/crm/parent-meetings`.

## D9 — ParentAccount read authority

- Add explicit `parentAccount.read` for `giam_doc_kinh_doanh`, `giam_doc_dao_tao`, and `sale`.
- `get`, list discovery, detail shell and timeline use `read`.
- `updateEmail` and `setActive` keep their current narrower, different action rosters.
- A visible detail action is enabled only when its action-specific permission passes.

## D10 — Audit record-link behavior

- Build a source-derived action manifest: `input`, `result`, `inline-owned`, or `unlinked`.
- Action-aware overrides are narrow; unknown actions retain the existing derivation and do not
  gain a link unless entity mapping and UUID both validate.
- Because `AuditLog` has no facility context, the viewer links only targets proven resolvable in
  the current facility. Other-facility, deleted and unknown targets remain plain text.
