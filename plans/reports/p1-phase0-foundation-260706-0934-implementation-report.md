# P1 Phase 0 — Foundation (data · RBAC · tRPC substrate) — Implementation Report

Date: 2026-07-06
Plan: `plans/260706-0934-p1-identity-enrollment/phase-01-foundation.md`

## Status: DONE

Substrate-only phase landed: P1 Prisma schema + migration, real `@cmc/auth`
RBAC registry, extended tRPC context/procedures (dev session stub, LMS gate,
error helpers, RLS `scoped()` helper), and a new `@cmc/domain-finance`
package with pure money functions at 100% test coverage. No business
procedures were added (by design — out of scope for this phase). Existing
health smoke test still passes.

## Files created/changed

**`packages/db/`**
- `prisma/schema.prisma` (rewritten, +~290 lines) — 10 enums + 14 models
  (`Contact`, `Opportunity`, `ReceiptCodeCounter`, `Receipt`, `RefundRecord`,
  `Student`, `ParentAccount`, `StudentAccount`, `Guardian`,
  `GuardianLinkRequest`, `Enrollment`, `LoginOtp`, `EmailOutbox`, `AuditLog`),
  keeping `Facility`.
- `prisma/migrations/20260706025956_p1_identity_enrollment/` (new, applied).
- `prisma/.env` (new, gitignored via `.env*`) — schema-level Prisma env file;
  see "Assumption" below on why this was needed.
- `src/index.ts` — unchanged (already exported `PrismaClient`/`createPrismaClient`).

**`packages/auth/`**
- `src/index.ts` (rewritten) — `ROLES`/`Role` (9-key union), `PERMISSIONS`
  registry (P1 subset), `can()`.
- `src/index.test.ts` (new) — 8 unit tests.
- `package.json` — added `vitest` devDependency + `test` script.

**`packages/domain-finance/`** (new package `@cmc/domain-finance`)
- `package.json`, `tsconfig.json`
- `src/refund-cap.ts` + `.test.ts` — `assertRefundWithinCap`, `RefundCapExceededError`.
- `src/receipt-code.ts` + `.test.ts` — `nextReceiptCode`.
- `src/net-amount.ts` + `.test.ts` — `computeNetAmount`.
- `src/index.ts` + `.test.ts` — barrel + re-export smoke test.
- No Prisma import anywhere in this package (constraint honored).

**`apps/api/src/`**
- `trpc.ts` (rewritten) — `Context` gains `facilityId`, `lmsSubject`, `db`
  (Prisma client), `ip`; added `lmsProcedure` (no super_admin bypass) and
  `scoped(ctx)` RLS helper; `requirePermission` now uses `errors.ts` helpers.
- `context.ts` (rewritten) — dev-session stub parses `x-dev-user` (zod-validated
  against `@cmc/auth` `ROLES`) and `x-dev-lms-user` headers; lazy `db` getter
  (no PrismaClient instantiated unless `ctx.db` is actually read); `ip` from
  `x-forwarded-for`/socket.
- `server.ts` — forwards `req` into `createContext` so headers are available.
- `errors.ts` (new) — 5 `TRPCError` helpers (`badRequest`/`forbidden`/
  `conflict`/`notFound`/`unauthorized`).
- `router.ts`, `health.test.ts` — unchanged, still pass.

## Tasks completed
- [x] Prisma schema extended per phase spec; `migrate dev` applied; `generate` succeeds.
- [x] `@cmc/auth` registry with `can()`; `sale` excluded from `finance.receiptApprove`.
- [x] tRPC `protectedProcedure`/`lmsProcedure`/`requirePermission`/`scoped()`/error helpers.
- [x] `@cmc/domain-finance` pure functions + unit tests (100% coverage, exceeds ≥90%).
- [x] `pnpm typecheck && pnpm test && pnpm build` green.

## Verify command outputs (tails)

**`prisma migrate status`**
```
1 migration found in prisma/migrations
Database schema is up to date!
```

**`pnpm typecheck`**
```
Tasks:    9 successful, 9 total
Cached:    6 cached, 9 total
```

**`pnpm test`**
```
@cmc/auth:test:  ✓ src/index.test.ts (8 tests)
@cmc/domain-finance:test:  ✓ 4 test files, 17 tests
@cmc/api:test:  ✓ src/health.test.ts (1 test)
 Tasks:    6 successful, 6 total
```

**`pnpm build`**
```
Tasks:    6 successful, 6 total
```

**`@cmc/domain-finance` coverage** (`vitest run --coverage`)
```
All files        |     100 |      100 |     100 |     100 |
```

## Assumptions / decisions (flagging per review-audit rule)

1. **`packages/db/prisma/.env`** (new, gitignored) holds the same
   `DATABASE_URL` as root `.env`. Root `.env` isn't discovered by the Prisma
   CLI when invoked via `pnpm --filter @cmc/db exec ...` (cwd = `packages/db`,
   not repo root) — confirmed by reproducing `P1012: Environment variable not
   found: DATABASE_URL` before adding this file. Placing a `.env` next to
   `schema.prisma` is Prisma's own documented auto-load location, so this is
   the standard fix, not a workaround. Root `.env` is untouched.
2. **`requirePermission` stays in `apps/api/src/trpc.ts`**, not `@cmc/auth`.
   The phase file offered both options ("Keep it framework-light; the tRPC
   middleware wiring can live in apps/api if you prefer importing can()
   there.") — kept `@cmc/auth` free of a `@trpc/server` dependency, matching
   the pre-existing P0 split (this is literally how the stub was already
   wired) and TL18's framework-light intent.
3. **`db` on `Context` is a lazy getter**, not an eagerly-constructed
   `PrismaClient`. Health test never touches `ctx.db`, so it never opens a
   DB handle / never requires `DATABASE_URL` — preserves "no DB connection
   opened at import time" from the original P0 comment while still exposing
   a real client. `apps/api` currently has no dotenv loading wired for the
   *running server* (only the Prisma CLI got the `.env` fix above) — flagged
   as a gap for whichever phase first calls `ctx.db` from a live process
   (TODO left as a comment is unnecessary since it will fail loudly with
   Prisma's own clear error if `DATABASE_URL` is missing at runtime).
4. **Facility-scoping judgment call**: added `facilityId` to `Contact`,
   `Opportunity`, `ReceiptCodeCounter`, `Receipt`, `Student`, `Enrollment`,
   `Guardian`, `GuardianLinkRequest` (staff-facing, facility-bound).
   Deliberately did NOT add it to `RefundRecord` (explicit 4-field list in
   the phase spec — append-only, joins to `Receipt`), `AuditLog`,
   `EmailOutbox`, `LoginOtp` (system/global-ish, not enumerated with
   `facilityId` in the phase spec), or `ParentAccount`/`StudentAccount`
   (identity models with system-wide uniqueness by `phone` per TL10 §4
   invariant #3).
5. **New enums not explicitly given values in source docs** — had to pick a
   reasonable minimal set, flagged for confirmation:
   - `LostReason`: `no_response | price_too_high | chose_competitor |
     schedule_conflict | not_interested | other`.
   - `StudentLifecycle`: `active | blocked_lms | withdrawn`.
   - `LoginOtpStatus`: `pending | verified | expired`.
   - `EmailTransport`: `graph | brevo` (matches docs/18 tech stack).
   - `EmailOutboxStatus`: `pending | sent | failed`.
   - `guardian.approveLink` roles: `giam_doc_kinh_doanh, giam_doc_dao_tao,
     sale, giao_vien, cskh` — TL14 §5's summary table doesn't list this
     action explicitly; picked "front-line staff who'd handle a parent
     approaching them" as the working definition.
6. **`Enrollment.classBatchId` / `Receipt.classBatchId`** are plain `String`
   scalars, not FK relations — `ClassBatch` isn't modeled until the academic
   domain phase. Documented inline in the schema; a later migration will add
   the FK once that model exists.
7. **`Receipt.createdById`/`approvedById`** are plain `String` scalars (no FK)
   — no `AppUser`/staff-identity model exists yet; they reference the dev
   session's `userId` string. Will need an FK migration once identity/HR
   lands.

## Unresolved questions
- Confirm the `LostReason`/`StudentLifecycle`/`LoginOtpStatus`/
  `EmailTransport`/`EmailOutboxStatus` enum value sets above against whatever
  canonical list exists elsewhere (not found in docs/10, /11, /14, /16, /18,
  /22) — proceed with these unless a later phase's spec overrides them.
- Confirm `guardian.approveLink` role set (assumption #5 above) against the
  actual TL14 full registry (only the summary table was available, and it
  doesn't list this action).
