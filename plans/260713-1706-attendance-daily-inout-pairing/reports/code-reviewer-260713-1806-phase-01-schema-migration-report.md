# Code Review: Phase 1 — Schema & Migration (ADR 0043)

## Scope
- Files: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/20260713110000_attendance_daily_inout/migration.sql`, `apps/api/src/checkin/schema-shape.test.ts` (new), `apps/api/src/checkin/status-check.test.ts` (modified), `apps/api/src/checkin/ip-match.test.ts` (modified), `docs/27-workflow-spec-p3.md` (doc banner, out of stated list but in-scope/lightweight)
- LOC: ~90 lines changed across 4 code files + doc banner
- Focus: full diff review per phase-01 plan + 5 targeted questions (a)-(e)
- Scout: read `apps/api/src/checkin/router.ts` (current pre-phase-3 state) end to end, and all 4 migrations touching `TimePunch`/`ManualAttendanceTicket` to check RLS/grant history

## Overall Assessment
Correct, narrowly-scoped, well-commented phase-1 slice. Matches the phase-01 plan almost exactly (3 columns, 1 unique index, dedup-before-unique, RLS untouched). One real SQL correctness gap in the dedup logic (tie case), otherwise sound.

## Critical Issues
None.

## High Priority
None.

## Medium Priority

**M1 — Dedup DELETE does not guarantee removal of all duplicates when `createdAt` ties at the max.**

`migration.sql` lines 35-44:
```sql
DELETE FROM "ManualAttendanceTicket" t
USING (
  SELECT "appUserId", "ticketDate", MAX("createdAt") AS "keepCreatedAt"
  FROM "ManualAttendanceTicket"
  GROUP BY "appUserId", "ticketDate"
  HAVING COUNT(*) > 1
) dupes
WHERE t."appUserId" = dupes."appUserId"
  AND t."ticketDate" = dupes."ticketDate"
  AND t."createdAt" < dupes."keepCreatedAt";
```
If two or more rows for the same `(appUserId, ticketDate)` share the exact max `createdAt`, the `t."createdAt" < dupes."keepCreatedAt"` predicate is false for *all* of them (equal, not less-than), so none get deleted. Result: the group still has >1 row, and the subsequent `CREATE UNIQUE INDEX` fails, aborting the whole migration transaction.

This isn't just theoretical: Postgres' `now()` is stable within a transaction, so any bulk multi-row insert of `ManualAttendanceTicket` for the same `(appUserId, ticketDate)` executed in one transaction (e.g. a batch seed/import script, or a future re-run of similar dedup tooling) produces exact `createdAt` ties. I confirmed there is currently no seed script inserting duplicate `(appUserId, ticketDate)` rows, and the user reports the migration applied cleanly on `cmc_staging`/`cmc_prod` (local-sim), so no tie exists in the data touched so far — but the SQL itself does not *guarantee* correctness, and failure mode is a hard migration abort, not silent corruption.

Fix (tiebreak on `id`, deterministic single-winner-per-group):
```sql
DELETE FROM "ManualAttendanceTicket" t
WHERE t.id NOT IN (
  SELECT DISTINCT ON ("appUserId", "ticketDate") id
  FROM "ManualAttendanceTicket"
  ORDER BY "appUserId", "ticketDate", "createdAt" DESC, id DESC
);
```
This always keeps exactly one row per group regardless of ties. Low urgency given current data is clean (user confirmed applied), but should be fixed before this migration file is considered a template for future dedup migrations, and cheap to fix now while the migration hasn't shipped to real prod.

## Low Priority
None.

## Answers to Review Questions

**(a) Migration SQL correctness/safety, tie edge case** — See M1 above. Confirmed by manual proof: the DELETE predicate is strict `<`, so tied-at-max rows all survive. Failure mode is a loud migration-transaction abort (safe, not a silent data-loss bug), but the logic does not meet the phase-01 requirement text ("nếu có trùng → migration dọn... trước khi tạo unique") in the tie case.

**(b) `TimePunch.withinNetwork @default(true)` preserves historical semantics** — Confirmed TRUE by reading `apps/api/src/checkin/router.ts` (current, pre-phase-3): `checkInOut.punch` (lines 67-82) throws `IP_NOT_ALLOWED` (FORBIDDEN) and never calls `tx.timePunch.create` when the caller IP doesn't match an active `FacilityNetwork` CIDR. I also grepped the whole `apps/api/src` tree for `timePunch.create`/`createMany` call sites — the only non-test call site is this one gated `router.ts:107` insert. So every pre-existing `TimePunch` row is, by construction, within-network; the `@default(true)` backfill assumption is accurate, not just asserted in a comment.

**(c) Skipping (not deleting/rewriting) the ip-match.test.ts resubmit test** — Reasonable for phase 1. The `it.skip` (ip-match.test.ts:164-182) has a comment directly above it naming the phase-4 plan file and explaining exactly why (`manualPunch.create` unique-constraint conflict, replaced by `manualPunch.resubmit` in phase 4). Residual risk is low and self-limiting: this test body calls `caller(...).manualPunch.create(...)` — once phase 4 removes `manualPunch.create` from the router, this file will fail to *typecheck* (not just fail at runtime) even while skipped, since vitest still compiles skipped test bodies. That forces someone to touch this file in phase 4 regardless of whether they read the comment; it cannot be silently forgotten. No action needed now.

**(d) RLS implication of the new columns** — Confirmed inert, no policy change needed. Read the original RLS grant in `packages/db/prisma/migrations/20260707000000_p3i_appuser_timepunch/migration.sql` (lines 101-117): both tables use a single `USING ("facilityId" = current_setting(...) OR bypass_rls)` row-policy (not column-scoped) plus table-level `GRANT SELECT, INSERT[, UPDATE]` (also not column-scoped). Adding nullable/defaulted columns to an already-covered table requires no new policy or grant — Postgres RLS and privileges here operate per-row and per-table, not per-column. `ManualAttendanceTicket` already had `UPDATE` granted (needed for approve/reject), which is what phase 3 will use to populate `checkInAt`/`checkOutAt`.

**(e) Naming/formatting consistency** — Consistent with `20260712000000_hr_remediation_policy_quota_reject_done/migration.sql`: numbered `-- N. Title` section banners, quoted identifiers, a file-header comment block explaining rationale/invariants, same migration-timestamp naming convention (`<ts>_<snake_case_slug>`). No deviation worth flagging.

## Edge Cases Found by Scout
- Confirmed no other production code path writes `TimePunch` or `ManualAttendanceTicket` besides `router.ts` (checked via grep across `apps/api/src`), so the historical-default reasoning in (b) is complete, not partial.
- Confirmed no seed/import script currently produces the `createdAt`-tie scenario in M1 — the gap is latent, not actively triggered by any code in this repo today.
- `docs/27-workflow-spec-p3.md` picked up a small "SUPERSEDED-PENDING" banner and `docs/decisions/0043-...md` is new/untracked — both are documentation-only, consistent with the ADR this plan implements; not scope creep.
- Schema doc-comment on `TimePunch` forward-references `packages/domain-payroll` `computeDayAttendance` (phase 2, not yet implemented) — verified this matches the phase-02 plan's stated function name/module path, so it's an accurate forward reference, not a stale/wrong claim.

## Positive Observations
- Migration comment block explicitly documents the freeze-on-approve invariant and cites phase 3/5/6, giving future readers a single source of truth without needing to re-derive it.
- Dedup-before-unique-index ordering, RLS-untouched posture, and no-rename decision all match the phase-01 plan's explicit design constraints — no scope drift.
- `status-check.test.ts`'s `baseData(status, day)` fix is the correct, minimal adjustment for the new unique constraint (each status gets a distinct `ticketDate`), not a workaround that weakens the CHECK-constraint test's original intent.

## Recommended Actions
1. (Medium, pre-real-prod) Replace the dedup `DELETE` in `migration.sql` with the `DISTINCT ON (...) ... ORDER BY ..., id DESC` form to close the tie-case gap in M1. Since the migration hasn't been applied to real production data yet (per user, only local-sim `cmc_staging`/`cmc_prod`), this is a clean same-file edit with no re-migration complexity.
2. No action required for (b), (c), (d), (e) — claims verified as stated.

## Metrics
- Type Coverage: not independently re-measured; user reports `pnpm --filter @cmc/db typecheck` and `pnpm --filter @cmc/api typecheck` both clean — plausible given no manual type re-exports needed in `packages/db/src/index.ts` (checked, no matches).
- Test Coverage: reviewed all 5 new `schema-shape.test.ts` cases and the diffs to `status-check.test.ts` / `ip-match.test.ts` directly; did not independently re-run the suite to completion within this review session (background test run did not return output in time) — user's reported 33 passed / 1 skipped is consistent with the test files read.
- Linting Issues: none observed in the diffed files.

## Unresolved Questions
- None blocking. M1 fix is optional-but-recommended before this migration is treated as a copy-paste template for future dedup-before-unique migrations in this repo.
