# 0042 — Row-Level Security: defense-in-depth (app scope + Postgres RLS)

Date: 2026-07-06

## Status

Accepted

## Context

Facility isolation (`facilityId`) is the core data-isolation invariant (docs/01 I10,
docs/10 §4, docs/08 §3) over the most sensitive asset — children's data — in a
multi-facility / franchise product that will add many branches, expose data to AI
agents via MCP→tRPC, and must stay stable long-term (docs/30 T12 names cross-facility
leak a hard threat).

The P1 backend enforced isolation only at the application layer (`scoped(ctx)` adding
`where facilityId` per query). A cross-audit (plans/reports/p1-backend-cross-audit-…)
empirically found a real slip — a cancel-path lookup missing `facilityId` — proving
convention-only isolation is not trustworthy at scale: one forgotten `where` or any
`$queryRaw` leaks across facilities with no backstop.

## Decision

Adopt **defense-in-depth**:

1. **Layer 1 (keep):** application `scoped(ctx)` filtering — ergonomic, index-friendly,
   the primary query path.
2. **Layer 2 (add now):** **Postgres Row-Level Security** as an enforced backstop.
   - `ENABLE ROW LEVEL SECURITY` + a `USING (facility_id = current_setting('app.current_facility_id', true)::text)`
     policy on every facility-scoped table.
   - A Prisma client extension sets `app.current_facility_id` (via `SET LOCAL` inside a
     per-request transaction) from the session's server-resolved `facilityId` — never
     from client input.
   - An **explicit, audited bypass** for cross-facility executive visibility
     (super_admin + director "read-wide", docs/14 §3): a separate GUC
     (`app.bypass_rls='on'`) set only on the narrow endpoints that need it.

Do it now while the schema is young (~12 models) — retrofitting after 30 domains would
be far costlier.

## Alternatives Considered

1. **App-level only + accept the risk (ADR).** Rejected: the audit already found a slip;
   children's data + franchise scale make a silent cross-facility leak unacceptable, and
   AI-agent access widens the blast radius.
2. **Pure DB RLS, drop app filtering.** Rejected: loses index/perf ergonomics and makes
   the director cross-facility read path awkward; app filter is still the better primary path.

## Consequences

- A forgotten `where facilityId` or a raw query can no longer leak across facilities —
  the DB refuses it. AI agents calling tRPC inherit the guard automatically.
- Cost: a Prisma client extension + per-request transaction/GUC plumbing; tests must set
  the facility GUC; the bypass path must be explicit and audited.
- Verification: RLS negative tests must prove cross-facility reads fail **at the DB even
  when the app-level filter is removed**.
- Follow-up: when DB-side time bucketing (payroll ICT) or new facility-scoped tables land,
  extend the policy set; keep the bypass surface minimal.

## Implementation notes (wave 1, 2026-07-06)

- **Restricted role required.** Postgres RLS is a silent no-op for the table owner and for
  any role with `superuser`/`BYPASSRLS` — neither can be forced to respect a policy, even
  with `FORCE ROW LEVEL SECURITY`. The dev migration role (`DATABASE_URL`) is exactly such a
  role. A separate, unprivileged login role (`cmc_app`, created in migration
  `p1_remediation_wave1_schema_rls`) is required for the application (and its tests) to
  connect as — wired via `APP_DATABASE_URL` and `createPrismaClient()`
  (`packages/db/src/index.ts`). **Any environment that points the app at the migration
  owner's connection string gets zero RLS protection with no error or warning** — this must
  be checked in every environment this ships to (staging/prod provisioning is not yet
  defined and is a follow-up decision, not covered by this wave).
- **`withFacility()`** (`packages/db/src/index.ts`) is the one required entry point: it opens
  a transaction and sets `app.current_facility_id` / `app.bypass_rls` via
  `set_config(key, value, true)` (transaction-LOCAL — safe under Prisma's pooled
  connections, auto-resets at COMMIT/ROLLBACK). A query issued without it sees neither GUC
  set, which the policies treat as "no facility, no bypass" → 0 rows, not unrestricted access.
- **Scope adjustments from the original policy list**, found while implementing:
  - `ReceiptCodeCounter` is NOT RLS-enabled. Its `facilityId` column is a global sentinel key
    (`GLOBAL_RECEIPT_CODE_COUNTER_KEY`), not real per-facility data — enabling RLS on it would
    reject every receipt-code upsert.
  - `Guardian` / `GuardianLinkRequest` are NOT RLS-enabled despite carrying `facilityId`. The
    LMS parent-facing read path (`getApprovedChildren`) legitimately spans facilities (a
    parent's children may be enrolled at different branches) and is gated by
    `parentAccountId` ownership, not facility — the same rationale as the
    ParentAccount/StudentAccount exemption.
  - Provisioning (`provisionFromReceipt`) deliberately does NOT share one `withFacility`
    transaction across its find-or-create steps: a mid-provisioning failure must leave prior
    steps' progress durable (ADR 0041 replay), and Postgres aborts an entire transaction on
    its first error, so a catch-and-refetch-on-P2002 must run in a fresh transaction, not the
    one that just failed.
