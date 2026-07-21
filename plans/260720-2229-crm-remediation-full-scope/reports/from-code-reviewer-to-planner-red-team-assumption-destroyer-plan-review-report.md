# Red-Team (Assumption Destroyer) — CRM remediation full-scope plan review

Reviewer role: hostile assumption destroyer + scope auditor. Advisory only, no plan/code modified.
Scope: `plan.md` + `phase-01`, `phase-02`, `phase-05`, `phase-09`, `phase-10` (deep), others spot-checked.
Verdict: **plan is directionally sound but carries 2 correctness-breaking assumptions (Phase 5) and a cluster of factual location errors (Phase 1) plus a false cross-plan scope claim.** Not ready to execute Phase 1 or Phase 5 as written.

---

## Finding 1: Phase 5 auto-create runs BEFORE provisioning — ParentAccount name is never available
- **Severity:** Critical
- **Location:** `phase-05-...md:18,24` (Evidence + Requirement 3) vs `apps/api/src/finance/router.ts:863-885`
- **Flaw:** Phase 5 places Contact/Opportunity auto-creation *inside* `runMoneyTransaction` and specifies `Contact.name := ParentAccount name when provisioning already resolved it`. But `runMoneyTransaction` (router.ts:864) commits *before* `provisionFromReceipt` is ever called (router.ts:876), and `provision-from-receipt.ts:1-6` states outright it runs "AFTER the money transaction has committed." At the moment the auto-create code runs, no ParentAccount exists for this receipt.
- **Failure scenario:** The "resolve real parent name from ParentAccount" branch is dead code. 100% of auto-created walk-in Contacts fall through to the `"PH " + studentName` placeholder. The funnel gets populated with garbage-named contacts, and the plan's own Success Criterion (funnel reflects real revenue with usable attribution) is only cosmetically met. Worse, if the author instead tries to move auto-create *after* provisioning to fix the name, it leaves `runMoneyTransaction` (the transaction that sets O5/closedAt) and breaks the "same transaction" atomicity the phase promises.
- **Evidence:** `apps/api/src/finance/router.ts:864` (`runMoneyTransaction`), `:876` (`provisionFromReceipt`), `apps/api/src/provisioning/provision-from-receipt.ts:1-6`, `:99-101` (ParentAccount resolved here, later).
- **Suggested fix:** Drop the ParentAccount-name branch entirely (accept placeholder), OR restructure: auto-create Contact/Opportunity with placeholder inside the tx, then have provisioning backfill Contact.name from the resolved ParentAccount name in its own step. Update Evidence line 18 — it asserts an ordering that does not exist.

## Finding 2: Phase 5 phone-normalizer "DRY single import" is the WRONG normalizer and Contacts are stored raw
- **Severity:** High
- **Location:** `phase-05-...md:23,30,35` ("phone-normalized parentPhone", "share phone normalization with provisioning (single import — DRY)") vs `apps/api/src/crm/router.ts:88-94`
- **Flaw:** Phase 5 mandates reusing provisioning's normalizer for Contact matching. Provisioning uses `normalizeLoginPhone` (`provision-from-receipt.ts:25,99`), which `packages/domain-identity/src/normalize-login-phone.ts:3` explicitly documents as a *DIFFERENT* normalizer from "CRM's `normalizeContactPhone` (`+84` form)". But `normalizeContactPhone` **does not exist anywhere in source** (grep finds it only inside that comment), and the CRM router stores/looks up Contacts by **raw** `input.phone` with no normalization at all (`crm/router.ts:92` `findFirst where phone: input.phone`, `:94` `create phone: input.phone`).
- **Failure scenario:** Phase 5 looks up `Contact where phone = normalizeLoginPhone(parentPhone)` against Contacts stored in raw UI form. A lead created via the UI as `0912 345 678` won't match a receipt's `0912345678`, so a *duplicate* Contact+Opportunity is auto-created on approve — the exact dedup failure the phase exists to prevent. Phase 8's `@@unique(facilityId, phone)` would then be built on inconsistent raw values.
- **Evidence:** `packages/domain-identity/src/normalize-login-phone.ts:3`, `apps/api/src/crm/router.ts:92,94`, `apps/api/src/provisioning/provision-from-receipt.ts:25,99`.
- **Suggested fix:** Decide ONE canonical Contact-phone form and normalize on BOTH write paths (crm.opportunityCreate + walk-in auto-create) before Phase 8's unique constraint. The "just import provisioning's normalizer, DRY" instruction is unsafe — either introduce a real shared `normalizeContactPhone` and backfill existing Contacts, or the constraint/dedup will misfire.

## Finding 3: Phase 1 targets the wrong worker file for the reconciler flag
- **Severity:** High
- **Location:** `phase-01-...md:29,35` (extend `reconcile-finance-flags` with `cancelled_receipt_active_student`, "same shape as existing `cancelled_receipt_active_enrollment`")
- **Flaw:** The sibling flag it wants to mirror, `cancelled_receipt_active_enrollment`, is NOT produced by `reconcile-finance-flags.ts`. It is produced by `reconcileCancelledButProvisioned` in `apps/api/src/worker/reconcile-orphaned-receipts.ts:262`. `reconcile-finance-flags.ts` produces a different set: `self_approved`, `exceeds_threshold`, `excess_refunds`, `missing_provisioning` (`reconcile-finance-flags.ts:108,132,175,215`).
- **Failure scenario:** Following the plan literally, the author adds a cancelled-receipt reconciler into `reconcile-finance-flags.ts` — splitting cancelled-receipt reconciliation across two workers, duplicating the M9 "another approved receipt covers it" guard that already lives in `reconcile-orphaned-receipts.ts`, and diverging from the very pattern the plan cites. Related Code Files (`:35`) lists `reconcile-finance-flags.ts` and omits `reconcile-orphaned-receipts.ts`, so the correct file is never opened.
- **Evidence:** `apps/api/src/worker/reconcile-orphaned-receipts.ts:262-264`, `apps/api/src/worker/reconcile-finance-flags.ts:108,132,175,215`.
- **Suggested fix:** Extend `reconcileCancelledButProvisioned` in `reconcile-orphaned-receipts.ts` (student-level check alongside the existing enrollment-level one), not `reconcile-finance-flags.ts`. Fix the Related Code Files list.

## Finding 4: Phase 1 ignores the already-shipped C1 remediation for this exact race
- **Severity:** High
- **Location:** `phase-01-...md:13-16,36` (frames the race as unaddressed; plans a "new `cancel-race.test.ts`")
- **Flaw:** A "C1 remediation (scenario audit 2026-07-15)" already covers this race: (a) `activateEnrollmentForReceipt` re-reads `Receipt.status` under `SELECT ... FOR UPDATE` in the enrollment write tx; (b) a backstop reconciler `reconcileCancelledButProvisioned` withdraws stray active Enrollments and raises `cancelled_receipt_active_enrollment`; (c) a concurrency test already exists at `apps/api/src/finance/receipt-cancel-provisioning-race.test.ts` (incl. a real `Promise.allSettled` cancel-vs-provision race + M9 covered-receipt case). Phase 1's genuine new scope is only *extending* the guard to the earlier ParentAccount/Student commit steps and adding a *student-level* reconciler check — but the phase doesn't say that; it reads as building all three layers from scratch.
- **Failure scenario:** Author writes a parallel `cancel-race.test.ts` and a parallel reconciler that duplicate/conflict with the existing C1 test and `reconcileCancelledButProvisioned`, or "re-implements" a guard that already exists — churn plus two sources of truth for the same invariant.
- **Evidence:** `apps/api/src/finance/receipt-cancel-provisioning-race.test.ts:1-16,122-174,176-283`, `apps/api/src/enrollment/activate-enrollment.ts:106`, `apps/api/src/worker/reconcile-orphaned-receipts.ts:262`.
- **Suggested fix:** Rewrite Phase 1 as a delta on top of C1: extend the existing guard helper to the two earlier commit steps, add a student-lifecycle branch to `reconcileCancelledButProvisioned`, and add cases to the existing race test file rather than creating a new one.

## Finding 5: Phase 1 cites a non-existent file path for the guard/error type
- **Severity:** Medium
- **Location:** `phase-01-...md:16,33` (`apps/api/src/provisioning/activate-enrollment.ts:101-107`)
- **Flaw:** `activate-enrollment.ts` lives in `apps/api/src/enrollment/`, not `apps/api/src/provisioning/`. `ReceiptNoLongerApprovedError` is defined at `enrollment/activate-enrollment.ts:19` and thrown at `:106`; `finance/router.ts:19` imports it from `../enrollment/activate-enrollment.js`. There is no `provisioning/activate-enrollment.ts`.
- **Failure scenario:** An executor trusting the plan's paths edits/looks in the wrong directory; the "export/share the status-check helper" step (`:33`) points at a file that doesn't exist.
- **Evidence:** `apps/api/src/enrollment/activate-enrollment.ts:19,106`, `apps/api/src/finance/router.ts:19`.
- **Suggested fix:** Correct all `provisioning/activate-enrollment.ts` references to `enrollment/activate-enrollment.ts`.

## Finding 6: plan.md + Phase 9 make a false cross-plan scope-takeover claim (phase-08 ≠ aftersale/meeting)
- **Severity:** High (Scope Auditor)
- **Location:** `plan.md:46` and `phase-09-...md:13` ("takes over the scope of `260711-1720-premium-erp-screen-buildout` phase-08 (BLOCKED stubs) for aftersale/post-sale-meeting — its blocker 'no backend' is now false")
- **Flaw:** premium-erp `phase-08-stub-real-features.md:7` states "**Effective phase-08 scope now = network-ip only, indefinitely blocked.**" Its three stubs are `leaderboard` (dropped), `shift-config` (moved to the HR/KPI plan), and `network-ip` (still blocked). Aftersale/post-sale-meeting are **not in phase-08 at all** — a repo-wide grep of the premium-erp plan finds *no* phase file that owns `aftersale`/`post-sale-meeting`. So this plan cannot "take over phase-08's scope for these two screens" — phase-08 never had them.
- **Failure scenario:** The dependency section reads as if completing Phase 9 closes premium-erp phase-08. It doesn't: phase-08 still owns the still-blocked `network-ip` screen, which now risks being silently considered "handled." The actual owner of the two stub screens is untracked, so no one reconciles their status.
- **Evidence:** `plans/260711-1720-premium-erp-screen-buildout/phase-08-stub-real-features.md:1-7`, grep of that plan dir for aftersale/meeting → zero matches; stub files exist at `apps/admin/src/pages/crm/aftersale.tsx`, `post-sale-meeting.tsx`.
- **Suggested fix:** Reword the cross-plan claim: this plan builds the aftersale/meeting screens (whose stubs live in `pages/crm/` and are untracked by any premium-erp phase); it does NOT subsume phase-08, which remains scoped to the blocked `network-ip` screen.

## Finding 7: Phase 5 will re-implement CRM's Contact find-or-create instead of reusing it (DRY / parallel-reimpl risk)
- **Severity:** Medium
- **Location:** `phase-05-...md:23-24,30` (Contact find-by-phone + create logic, Related Code Files reuses only `opportunity-lost.ts` + a normalizer)
- **Flaw:** `crm/router.ts:88-94` already implements "find existing Contact for this phone within facility, else create {name,phone,email}". Phase 5 describes the same find-or-create inline in `finance/router.ts` and does not list crm's contact upsert as a reuse target, so it will grow a second copy of that logic in the finance module — the AI-risk "parallel reimplementation of an existing utility" pattern, and it will drift from crm's version (e.g. once phone normalization from Finding 2 is added on one side only).
- **Failure scenario:** Two divergent Contact-creation code paths; a later change to Contact shape/dedup rules (Phase 8 unique constraint) must be applied in two places, and one gets missed.
- **Evidence:** `apps/api/src/crm/router.ts:88-94`.
- **Suggested fix:** Extract crm's Contact find-or-create into a shared helper (e.g. `crm/contact-upsert.ts`) and import it from both `crm/router.ts` and the walk-in path, so normalization and the unique-constraint retry live in one place.

---

## Assumptions checked and CONFIRMED sound (no finding)
- Phase 1: `reconcile-finance-flags.ts` **does** exist at `apps/api/src/worker/` (the plan's directory is right; only the flag-family attribution in Finding 3 is wrong).
- Phase 3: `crm.*` procedures use `requirePermission('crm', ...)` (`crm/router.ts:82-213`); `@cmc/ui` exports `ListPage`/`DetailPage`/`FormPage`/`ConfirmDialog` (`packages/ui/src/index.ts:127,147-152`).
- Phase 9: after-sale/meeting/appointment routers exist and are registered, none has a `list` query (correct); `afterSale.manage`/`parentMeeting.manage`/`testAppointment.manage` all exist (`packages/auth/src/index.ts:126-128`); read-via-manage is a valid choice; `finance/rls-negative.test.ts` pattern exists.
- Phase 10: Opportunity has no `assignedToId`/`source`/notes (`schema.prisma:271-286`); the nullable-scalar-plus-nullable-AppUser-FK backfill pattern already exists (`schema.prisma:344,358-359` Receipt); registry test `packages/auth/src/index.test.ts` exists and the phase correctly plans to update it for the new `crm.opportunityAssign` key.
- Phase 2: `isOpportunityLost` helper is net-new (`crm/opportunity-lost.ts` absent today — correct); lost = `closedAt != null && stage != O5_ENROLLED` is consistent with the crm markLost path.

## Unresolved questions
1. Phase 10 claims `ParentMeeting.remindedAt` has "zero readers/writers (shell grep whole repo)" — not re-verified here; confirm before dropping the column.
2. Phase 5's documented "cancel reverts auto-created O5 → O4 open" leaves placeholder-named, activity-less Opportunities sitting in the O4 funnel bucket that Phase 6 counts — is that acceptable pollution given F4's goal is funnel accuracy?
3. What plan/owner actually tracks the `pages/crm/aftersale.tsx` + `post-sale-meeting.tsx` stubs, given premium-erp phase-08 does not?

Status: DONE_WITH_CONCERNS
Summary: Plan is executable for Phases 2/3/6/10 but Phase 5 has two correctness-breaking assumptions (provisioning-ordering makes the ParentAccount-name branch dead code; the mandated "DRY" phone normalizer is the wrong one and Contacts are stored raw), Phase 1 mislocates the reconciler file/error-path and ignores the already-shipped C1 remediation, and the plan makes a false phase-08 scope-takeover claim.
