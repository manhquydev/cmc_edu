---
phase: 2
title: "Enroll-Entry-And-Approve-Transparency"
status: pending
priority: P1
dependencies: [1]
effort: "M"
---

# Phase 2: Enroll-Entry-And-Approve-Transparency

## Overview
The money-flow UX: a single business-framed "+ Ghi danh" entry (G2) that launches the Phase-1 prefilled
receipt-from-opportunity flow, plus approve-screen transparency (G5) and dedup surfacing (G7-remainder).
Depends on Phase 1's `opportunityGet` + prefill.

## Requirements
- Functional:
  - **G2 — "+ Ghi danh" entry.** A business-framed entry point that lets a sale pick an eligible
    opportunity (stage `O4_TESTED`, not lost) and lands on `/finance/new?opportunityId=<id>` (Phase-1
    prefilled). Placement: a header CTA on the receipt-list page (`/finance`) and the CRM pipeline page;
    the persistent top-bar CTA lands in Phase 3 with the shell change. Label "Ghi danh" (not "Tạo phiếu").
  - **G5 — pre-approval automation box.** On `receipt-detail.tsx`, for a `draft` receipt the current user
    `canApprove`, render an always-visible info box BEFORE the button: "Bấm Duyệt & Kích hoạt sẽ tự động:
    tạo tài khoản học sinh + phụ huynh · chuyển ghi danh sang active · đưa cơ hội về O5 · gửi email cho
    phụ huynh. Cổng tiền (SoD): người tạo phiếu ≠ người duyệt." (Confirm-dialog text stays.)
  - **G7 — dedup warning.** On `receipt-create.tsx`, when the entered `parentPhone` matches an existing
    contact/parent in the facility, show a non-blocking warning ("SĐT phụ huynh đã có hồ sơ — vẫn tạo
    mới? Hệ thống dùng chung 1 tài khoản/SĐT."). Reuse `duplicatePhoneWarning` (`@cmc/domain-finance`)
    semantics; surface via **`crm.opportunityLookup`** (returns `{ exists }` by phone).
    <!-- Updated: Validation Session 1 — locked to crm.opportunityLookup; roster [GĐKD, sale, ke_toan]
         verified == finance.receiptCreate roster, so no new endpoint and no permission widening. -->
    **No new endpoint.** No `finance.parentPhoneExists` fallback (roster match makes it unnecessary).
- Non-functional: second-eye over-threshold banner (already present, `receipt-detail.tsx:166`) verified
  still rendering. No change to approve mutation. Enroll entry never bypasses the money gate.

## Architecture
- Enroll picker: a modal/route listing `crm.opportunityList({ stage: 'O4_TESTED' })` (endpoint exists),
  each row → `navigate('/finance/new?opportunityId=' + id)`. No new backend.
- Automation box: pure presentation in `overviewContent`, gated by the same `receipt.canApprove &&
  status==='draft'` condition as the button.
- Dedup: reuse `crm.opportunityLookup` (`{ exists }` by phone, already gated & scoped). Roster verified
  to match the receipt-create actor's, so no fallback endpoint and no permission change needed.

## Related Code Files
- Modify: `apps/admin/src/pages/finance/receipt-list.tsx` (Ghi danh CTA + opportunity picker)
- Modify: `apps/admin/src/pages/crm/pipeline.tsx` (Ghi danh CTA on O4 cards/column)
- Modify: `apps/admin/src/pages/finance/receipt-create.tsx` (dedup warning)
- Modify: `apps/admin/src/pages/finance/receipt-detail.tsx` (pre-approval automation box)
- (Maybe) Modify: `apps/api/src/finance/router.ts` (only if a `parentPhoneExists` lookup is needed)
- Create (test): `apps/admin` component test for the automation box + dedup warning if a component test
  harness is added (see Risk); otherwise `apps/api` test for any new lookup endpoint.

## Implementation Steps (TDD)
1. **Lock approve contract.** Confirm `finance/approve.test.ts` + `finance/can-approve.test.ts` green;
   the automation box must not change any of these outcomes.
2. **G7 dedup (RED→GREEN).** Add/confirm an `opportunityLookup` test asserting `{ exists }` by phone is
   RLS-scoped and callable by the receipt-create roster (`crm/list.test.ts` area). Reuse it — no new
   endpoint.
3. **G7 UI.** Wire the existence check into `receipt-create.tsx`; render non-blocking warning; never block
   submit.
4. **G5 box.** Add the always-visible automation box to `receipt-detail.tsx`; verify it shows only for
   `canApprove && draft`, and the over-threshold banner still shows for > 20M receipts.
5. **G2 entry.** Add "Ghi danh" CTA + O4 opportunity picker on receipt-list and CRM pipeline → route to
   prefilled create. Verify the created receipt is `draft` and carries `opportunityId` (money gate intact).
6. **Verify.** `pnpm --filter @cmc/api test` green; admin typecheck + build clean. Manual: Ghi danh → pick
   O4 opp → prefilled draft → approve screen shows automation box; create with an existing phone → dedup
   warning, still submittable; seed a > 20M receipt → over-threshold banner shows.

## Success Criteria
- [ ] "+ Ghi danh" launches the prefilled receipt-from-opportunity flow (O4 opps only); result is a `draft`
      receipt linked to the opportunity — money gate unbypassed.
- [ ] Approve screen shows an always-visible automation + SoD box before the click (draft + canApprove).
- [ ] Over-threshold second-eye banner still renders for > 20M receipts (regression check).
- [ ] Receipt create shows a non-blocking dedup warning for an existing parent phone; submit still works.
- [ ] API tests green; admin typecheck + build clean.

## Risk Assessment
- **Frontend has no component-test harness today.** DECIDED (Validation S1): defer UI component tests;
  lock testable logic at the API layer (dedup existence via `opportunityLookup`) + typecheck + manual
  verify for pure-UI pieces (automation box). No RTL harness this round.
- **Dedup permission** — RESOLVED: `crm.opportunityLookup` roster `[GĐKD, sale, ke_toan]` == the
  receipt-create roster, so reuse is permission-safe. No roster change, no fallback endpoint.
- **G2 must not create an enroll path around the money gate** — the picker only pre-fills the SAME
  `receiptCreate` draft flow; O5 still only via approve. Test 5 asserts `status==='draft'`.
- Rollback: CTAs + box are additive presentation; revert pages to remove.
