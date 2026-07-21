# P1 Phase 1 — CRM pipeline + receipt draft creation — Implementation Report

Date: 2026-07-06

## Status
DONE

## Summary
Implemented `crm` router (WF-P1-01: opportunityCreate/advance/markLost/lookup/list) and `finance` router
(WF-P1-02: receiptCreate) on top of the Phase 0 substrate, wired into `appRouter`, with integration tests
against the real dev Postgres. All acceptance commands pass; `pnpm typecheck`, `pnpm test`, `pnpm build`
green workspace-wide.

## Files created
- `apps/api/src/crm/router.ts` — CRM pipeline procedures (152 lines)
- `apps/api/src/crm/stage.test.ts` — WF-P1-01 integration tests, 6 tests (98 lines)
- `apps/api/src/finance/router.ts` — receiptCreate procedure (117 lines)
- `apps/api/src/finance/create-from-opp.test.ts` — WF-P1-02 integration tests, 5 tests (108 lines)
- `apps/api/src/test/db.ts` — integration test helpers: seed/cleanup Facility, cleanup ParentAccount by
  phone, hand-build staff `Context` (68 lines)
- `packages/domain-finance/src/duplicate-phone.ts` — pure `duplicatePhoneWarning` predicate (22 lines)
- `packages/domain-finance/src/duplicate-phone.test.ts` — 4 unit tests (18 lines)

## Files modified
- `apps/api/src/router.ts` — mounted `crm` and `finance` routers alongside `health`
- `apps/api/package.json` — added `@cmc/domain-finance: workspace:*` dependency (see Deviation below)
- `packages/domain-finance/src/index.ts` — export `duplicatePhoneWarning`

## Design decisions
- **O5 hard block**: `opportunityAdvance` accepts the full `OpportunityStage` zod enum (including
  `O5_ENROLLED`) so the rejection is an explicit business-rule check in the resolver (`if (input.toStage
  === 'O5_ENROLLED') throw badRequest(...)`), not an incidental zod-enum-miss. Also enforces strict
  one-stage-at-a-time advance (`ADVANCE_ORDER`) and blocks advancing a lost opportunity.
- **Lost/reopen model**: schema has no `lost` stage value — "lost" = `closedAt != null` while `stage`
  stays put. `opportunityMarkLost({reopen:true})` clears `lostReason`/`closedAt` and sets stage to
  `O2_CONTACTED` per the WF-P1-01 state diagram.
- **opportunityLookup** returns only `{ exists: boolean }` — deliberately narrow per docs/24 ("khong mo
  CRM"), existence keyed on Contact.phone within the caller's facility.
- **receiptCreate discriminated union**: `{status:'success'|'warning', receipt, message?}`. Warning
  triggers on (a) duplicate parentPhone (ParentAccount system-wide OR Receipt within facility — pure
  predicate `duplicatePhoneWarning` in `@cmc/domain-finance`), and (b) linked opportunity not yet at
  `O4_TESTED` (allowed-but-flagged per docs/24 WF-P1-02 exceptions). Messages join with a space when both
  fire.
- **classBatchId**: kept optional in the zod type (matches docs/11 §5 catalog signature `classBatchId?`)
  but enforced required at runtime in the resolver (docs/24: "Thieu lop/hoc phi -> BAD_REQUEST"). Missing
  `amount` is caught by zod itself (tRPC's default input-validation failure -> `BAD_REQUEST`, confirmed by
  reading `@trpc/server` 11.18.0's `createInputMiddleware`).
- **Receipt code assignment**: atomic single-statement `ReceiptCodeCounter.upsert({update:{value:{increment:1}}}...)`
  inside `db.$transaction`, then `nextReceiptCode(counter.value - 1)` (existing pure formatter from
  Phase 0) to render `PT-000001` etc. No `SELECT ... FOR UPDATE` needed — the upsert/increment is
  already atomic under Postgres.
- Skipped `computeNetAmount` (gross/discount) for this WF — `receiptCreate`'s input has no discount field
  per the contract; wiring it in now would be premature (YAGNI).

## Deviation from strict file-ownership (flagging per rules)
Task scoped deliverables to `apps/api/src/**` and `packages/domain-finance/**` only. Using
`@cmc/domain-finance`'s `nextReceiptCode`/`duplicatePhoneWarning` from `apps/api` requires a workspace
dependency declaration, which lives in `apps/api/package.json` (not under `src/`). This is a one-line,
additive, non-schema change with no overlap with any other phase's ownership; without it the explicit
instruction "keep pure/reusable finance logic in `@cmc/domain-finance`... DB access stays in the router"
is not satisfiable. Ran `pnpm install` after the edit to link it. Flagging this as the one boundary
exception; happy to revert to inlining the two helpers in `apps/api/src/finance/` if this dependency edit
is not acceptable.

## Tests status
- `pnpm --filter @cmc/api exec vitest run src/crm/stage.test.ts` — **6/6 passed**
- `pnpm --filter @cmc/api exec vitest run src/finance/create-from-opp.test.ts` — **5/5 passed**
- `pnpm --filter @cmc/api exec vitest run` (full api suite incl. health) — **12/12 passed**
- `pnpm --filter @cmc/domain-finance exec vitest run` — **21/21 passed** (incl. 4 new duplicate-phone tests)
- `pnpm typecheck` — green across all 6 workspace packages
- `pnpm test` (turbo, all packages) — green
- `pnpm build` (turbo, all packages) — green

Re-ran the api suite twice to confirm `afterEach` cleanup (Facility + ParentAccount by phone) leaves no
residue that would break a second run (unique constraints on `Receipt.code`, `ParentAccount.phone`) —
stable both times.

## Coverage of required test scenarios
crm/stage.test.ts: O1->O4 sequential advance; manual O5 rejected (BAD_REQUEST); skip-stage rejected
(BAD_REQUEST, bonus); markLost requires reason (BAD_REQUEST) + reopen clears closedAt/lostReason and sets
O2_CONTACTED; lookup dedup true/false; RLS cross-facility advance -> NOT_FOUND.

finance/create-from-opp.test.ts: receipt linked to O4 opportunity carries `opportunityId` + valid
`PT-000001`-style code, status `success`; duplicate parentPhone (via existing ParentAccount) ->
`status:'warning'` with non-empty `message`, narrowing required before `.receipt` typed access; missing
`amount` -> BAD_REQUEST; missing `classBatchId` -> BAD_REQUEST (bonus); role without
`finance.receiptCreate` (`giao_vien`) -> FORBIDDEN.

## Assumptions / concerns
- `apps/api/package.json` dependency edit (see Deviation above) — only boundary exception made.
- AuditLog write implemented only for `opportunityCreate` per the literal task wording ("Write an AuditLog
  row" appears only under that bullet); `opportunityAdvance`/`opportunityMarkLost` do not audit-log —
  flag if broader audit coverage was actually intended for this phase.
- `opportunityList` includes `contact:{id,name,phone}` in each item for kanban/detail UI convenience; not
  explicitly required by tests, matches docs/11 §3 pagination contract `{items,total,page,pageSize}`.
- No unresolved schema gaps encountered — Phase 0's Prisma models (`Contact`, `Opportunity`, `Receipt`,
  `ReceiptCodeCounter`) covered every field this phase needed.

## Unresolved questions
- None blocking. Open item: confirm whether the `apps/api/package.json` dependency edit is acceptable
  given the phase's stated file-ownership boundary (see Deviation section) — proceeded pragmatically
  since the alternative (duplicating `nextReceiptCode`/dup-detection logic inside `apps/api`) contradicts
  an explicit architectural instruction in this task.
