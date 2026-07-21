---
phase: 1
title: "Lock-Contracts-And-Prefill"
status: pending
priority: P1
dependencies: []
effort: "S-M"
---

# Phase 1: Lock-Contracts-And-Prefill

## Overview
Quick-win data-reuse (G3) + defect D-UI-2, on top of a TDD safety net that locks the money-gate/SoD/
second-eye/RLS/funnel contracts first. Delivers: receipt-create prefilled from an opportunity, and
receipt detail showing the class **code** instead of a raw uuid.

## Requirements
- Functional:
  - Add `crm.opportunityGet` (query) returning `{ id, stage, contact: { name, phone, email } }` for an
    opportunity in the caller's facility. Gate with `requirePermission('crm','opportunityList')` (same
    roster that already reads the pipeline). RLS-scoped via `scoped(ctx)`.
  - `receipt-create.tsx`: when `?opportunityId=` is present and valid, fetch `opportunityGet` and prefill
    `studentName` ← contact.name, `parentPhone` ← contact.phone, `parentEmail` ← contact.email. Fields stay
    editable. Blank form when no opportunityId.
  - Relabel: page title/button "Tạo phiếu từ cơ hội" when `opportunityId` present; keep "+ Tạo phiếu thu"
    generic entry unchanged.
  - `finance.receiptGet` returns `classBatchCode` (join `classBatch.code`) alongside existing fields.
  - `receipt-detail.tsx`: render `classBatchCode ?? '—'` at line ~236 and ~315 instead of `classBatchId`.
- Non-functional: no change to `receiptCreate`/`receiptApprove` behavior or the ADR-B gate; opportunityGet
  is read-only; typecheck + build clean.

## Architecture
- `crm.opportunityGet` mirrors `opportunityList`'s scoping and permission but returns one row by id with
  its contact included (`include: { contact: { select: { name, phone, email } } }`). `notFound` for
  out-of-facility ids (RLS parity, same as `findOpportunityOrThrow`).
- `receiptGet` already returns the receipt + `canApprove`; extend its select to include
  `classBatch: { select: { code: true } }` and expose `classBatchCode`.
- Prefill is client-only: `receipt-create.tsx` gains a `trpc.crm.opportunityGet.useQuery` enabled when
  `opportunityId` is set; on data, seed `form` state once (guard against clobbering user edits).

## Related Code Files
- Modify: `apps/api/src/crm/router.ts` (add `opportunityGet`)
- Modify: `apps/api/src/finance/router.ts` (extend `receiptGet` select → `classBatchCode`)
- Modify: `apps/admin/src/pages/finance/receipt-create.tsx` (prefill + conditional label)
- Modify: `apps/admin/src/pages/finance/receipt-detail.tsx` (render class code, lines ~236 & ~315)
- Create (test): `apps/api/src/crm/opportunity-get.test.ts`
- Create/Modify (test): `apps/api/src/finance/receipt-get.test.ts` (or extend existing receipt-get coverage)

## Implementation Steps (TDD)
1. **Lock existing contracts (RED→already GREEN).** Confirm these pass unchanged before touching code:
   `finance/approve.test.ts`, `finance/can-approve.test.ts`, `finance/create-from-opp.test.ts`,
   `crm/list.test.ts`, `crm/stage.test.ts`. Run `pnpm --filter @cmc/api test`. Record baseline count.
2. **RED — `opportunityGet`.** Write `opportunity-get.test.ts`: (a) returns contact name/phone/email for a
   seeded opp; (b) `notFound` for another facility's opp (RLS); (c) permission denied for a role outside
   the `crm.opportunityList` roster (e.g. `giao_vien`).
3. **GREEN.** Implement `crm.opportunityGet`.
4. **RED — `receiptGet` class code.** Extend receipt-get test: seeded receipt with a classBatch returns
   `classBatchCode` = the batch code; null-batch receipt returns null.
5. **GREEN.** Extend `receiptGet` select + response.
6. **Prefill UI.** Wire `opportunityGet` into `receipt-create.tsx`; seed form once; conditional label.
7. **Class code UI.** Replace raw-uuid renders in `receipt-detail.tsx`.
8. **Verify.** `pnpm --filter @cmc/api test` (green, count ≥ baseline), `pnpm --filter @cmc/admin typecheck`,
   `pnpm --filter @cmc/admin build`. Manual: open `/finance/new?opportunityId=<O4 opp>` → fields prefilled;
   open a receipt detail → class code shown.

## Success Criteria
- [ ] Baseline API tests pass unchanged (money-gate/SoD/second-eye/RLS/funnel green).
- [ ] `opportunityGet` returns contact, is RLS-scoped, and permission-gated (3 tests green).
- [ ] `receiptGet` returns `classBatchCode` (2 tests green).
- [ ] `/finance/new?opportunityId=` prefills name/phone/email; blank without it; fields editable.
- [ ] Receipt detail shows class code (not uuid) in both Overview and Chi tiết thanh toán.
- [ ] admin typecheck + build clean.

## Risk Assessment
- **Prefill clobbers user edits** if the query re-fires → seed form state only once (ref/initialized flag).
- **opportunityGet leak** across facilities → test (b) enforces RLS parity; reuse `scoped(ctx)`.
- **Over-broad permission** → reuse the exact `crm.opportunityList` roster; test (c) guards it.
- Rollback: all changes additive; revert the 2 routers + 2 pages to restore prior behavior.
