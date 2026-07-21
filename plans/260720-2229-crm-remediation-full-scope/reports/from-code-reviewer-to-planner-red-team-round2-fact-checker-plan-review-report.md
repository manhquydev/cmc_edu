# Red-Team Round 2 — Fact-Check + Assumption Destroyer (CRM remediation full-scope)

Scope: plan.md + phases 01–10. Read-only. Every cited file:line in the fact-check list was opened and compared against source.

## Verdict
Almost every factual claim in the rewritten plan checks out (see "Verified-OK" below). One **HIGH** internal contradiction survives in phase-05 (money path). Two lower-severity consistency defects in phase-04 and plan.md deps.

---

## Finding 1: Phase-05 walk-in auto-link cannot reach O5 as positioned (ordering contradiction)
- **Severity:** HIGH
- **Location:** `phase-05-p1-walk-in-auto-opportunity-o5.md:21,23` vs `apps/api/src/finance/router.ts:318-338`
- **Flaw:** Phase-05 says the walk-in block runs "inside runMoneyTransaction (**after** the existing opportunity-advance block)" (line 21). Step (b) for the found-open-opportunity case says: "set `receipt.opportunityId` to it and **let the existing O5-advance block run**" (line 23). But the existing advance block (`finance/router.ts:318-338`) is gated on `if (approved.opportunityId)` and executes ONCE, earlier in the transaction, when `approved.opportunityId` is still `null` for an unlinked walk-in receipt. Setting `opportunityId` afterward does not re-trigger it. The two code regions are mutually exclusive at execution time (`approved.opportunityId != null` vs walk-in's `receipt.opportunityId == null`).
- **Failure scenario:** Walk-in receipt with no `opportunityId`, matching Contact has an open opp at O2_CONTACTED. Approve runs: advance block sees null → no-op; walk-in block links the O2 opp but the advance block already passed → opp stays at **O2 with an approved, enrolled receipt**. The funnel-coverage goal ("lead conversion, attribution preserved", success criterion "any newly-approved receipt ends with non-null opportunityId") is met on the FK but the linked opp is never advanced to O5 — exactly the funnel-blindspot F4 is meant to close, now reintroduced for the auto-link path.
- **Evidence:** advance block gate at `finance/router.ts:319` (`if (approved.opportunityId)`), O5 write at `:330-337`; phase-05 explicitly positions its block "after" that block (line 21) yet depends on it firing (line 23). The else-branch (step 3, line 24) sidesteps this by writing `stage: O5_ENROLLED` directly — the asymmetry confirms step (b) genuinely expects the existing block to re-run.
- **Suggested fix:** Either (a) place the walk-in link/create block **before** the advance block so a linked opp flows into the existing O5-advance naturally, or (b) keep it after and have step (b) perform the O5 advance itself (same `lostReason:null` + conditional `closedAt` write as the else-branch). Pick one and make line 21 and line 23 agree.

---

## Finding 2: Phase-04 risk note re-mandates the per-router checklist test that red-team #15 rejected
- **Severity:** MEDIUM
- **Location:** `phase-04-p1-auditlog-coverage.md:46` vs `:35`, `:40`, and plan.md:87 (red-team disposition #15)
- **Flaw:** Risk Assessment line 46 states: "forgetting a mutation — success criterion enforced by **checklist test per router file**, not memory." This directly contradicts (a) step 2 line 35 ("assert coverage with ONE parameterized test table … **NOT a bespoke checklist test per router file** (red-team: disproportionate test cost)"), (b) success criterion line 40 ("verified by the single parameterized coverage test"), and (c) the accepted red-team remediation #15 recorded in plan.md:87 ("shared helper + one parameterized test").
- **Failure scenario:** Implementer reading the Risk section builds the per-router checklist tests that the rewrite explicitly cut, reintroducing the disproportionate test surface finding #15 removed.
- **Evidence:** leftover pre-rewrite sentence at line 46; the rest of the phase (35/40) and plan.md:87 are internally consistent against it.
- **Suggested fix:** Replace line 46's clause with "enforced by the single parameterized coverage test (mutation → expected action/entity)".

---

## Finding 3: plan.md dependency narrative under-declares phase-3/phase-4 fan-out
- **Severity:** LOW
- **Location:** `plan.md:45` vs phase frontmatter (`phase-08:6` deps [3], `phase-09:6` deps [3], `phase-04:6` deps [1,2], `phase-07:6` deps [3] but relies on phase-4 audit helper per `phase-07:31`)
- **Flaw:** plan.md's Dependencies bullet lists only "3 → 6, 7, 10" and "2, 8 → 5" / "5, 7 → 10". It omits that phase-03 also blocks 8 and 9 (both declare `dependencies: [3]`), omits phase-04's `[1,2]`, and omits phase-07's reliance on phase-04's shared audit helper (`phase-07:31` "phase 4 helper"; phase-07 frontmatter is `[3]` only).
- **Failure scenario:** Non-blocking — the linear execution order `1→2→3→4→8→5→6→7→9→10` still places every dependency before its dependent, so scheduling is coherent. Risk is only that a reader trusting the narrative mis-parallelizes 8/9 against 3, or 7 against 4.
- **Evidence:** frontmatter deps read from all 10 phase files; execution order line plan.md:26. Order verified coherent against every declared frontmatter dep.
- **Suggested fix:** Extend plan.md:45 to "3 → 6, 7, 8, 9, 10; 1, 2 → 4; 4 → 7 (audit helper)". Or add `4` to phase-07's frontmatter `dependencies`.

---

## Verified-OK (claims opened and confirmed accurate)
- **Phase-01:** `activate-enrollment.ts:101-106` FOR UPDATE + `ReceiptNoLongerApprovedError` ✓; `reconcileCancelledButProvisioned` inner-joins active Enrollment at `reconcile-orphaned-receipts.ts:225-228` (cannot see no-enrollment partial state) ✓; standalone Guardian `provision-from-receipt.ts:328`, StudentAccount `:343` ✓; `findOrCreateParentAccount` global/no-facility-tx `:94-128` ✓; void-only Student withdraw `finance/router.ts:487-495` ✓; race test file exists ✓.
- **Phase-02:** plain `findFirst` at `finance/router.ts:320` ✓; FOR UPDATE cancel path `:434-438` ✓; force-advance + conditional closedAt `:330-336` ✓; markLost write `crm/router.ts:171-174`, lost def `:167-173` (stage unchanged), reopen `:157-165` ✓; no lost stage in enum `schema.prisma:40-46` ✓; receiptCreate soft warning `finance/router.ts:714-718` ✓.
- **Phase-05:** ordering `runMoneyTransaction` at `:864` vs `provisionFromReceipt` at `:876` (provisioning AFTER money) ✓; draft-only atomic claim `:304-313` ✓; Receipt has parentPhone/parentEmail?/studentName, no parentName `schema.prisma:329-333` ✓.
- **Phase-08:** `normalize-login-phone.ts:3` comment names `normalizeContactPhone` ✓; `normalizeContactPhone` truly absent from source (only that comment) ✓; find-or-create + raw phone `crm/router.ts:88-95,92,94` ✓; no Contact unique, only `@@index([facilityId])` `schema.prisma:258-269` ✓. NOTE: the same comment says the CRM normalizer should "live with the CRM domain" and uses `+84` form vs login's `84xxx` — phase-08's "co-locate with normalize-login-phone.ts / identical digit rules" is defensible but the canonical output form differs; keep the functions separate (phase-08 already says so).
- **Phase-09:** `student.lookup` key `packages/auth/src/index.ts:73` ✓; a real student lookup procedure exists (`apps/api/src/student/router.ts` + `lookup.test.ts`) ✓; meeting double-book warning `meeting/router.ts:60-63` ✓; the three post-sale routers have **no** `list` query (grep-empty) ✓.
- **Phase-10:** `Receipt.createdByAppUserId String?` nullable-FK pattern `schema.prisma:343-345` ✓; `index.test.ts` exists ✓; `can()` role-only `packages/auth/src/index.ts:137-149` (no row-level → `opportunityAssign` must be coded) ✓; no existing `crm.opportunityAssign` key ✓; `remindedAt` present in payloads `meeting/router.ts:61,82-83` ✓; three post-sale `studentId` scalars at `schema.prisma:1519,1534,1550` ✓.
- **Phase-07:** migration `20260707030000_p3ii_status_check_constraints` contains raw CHECK constraints ✓; `20260707050000_p4_meetings_appointments:37,43` TestAppointment ENABLE RLS + isolation policy ✓; `Student.createdByReceiptId String? @unique` `schema.prisma:402` ✓; scheduleInput requires `studentId` `appointment/router.ts:12`, old invariant comment `:3-4` ✓; `assertStudentActive` NOT used in appointment router (missing there — exists only in `student/`) ✓.
- **Phase-04:** `runRefundTransaction:548-626` writes zero AuditLog ✓; audited-today set (receiptApprove `:340`, cancel `:498`, provisioning fail `:895-914`, opportunityCreate `crm/router.ts:101-109`) ✓.
- **Validation decisions:** post-sale audit deferred (phase-04:26, phase-07:31), O1 schedule rejected (phase-07:48), PH placeholder (phase-05:18), auto rule-based dedup (phase-08) — all consistent, no residual contradiction. Execution order coherent with every frontmatter dep.

## Unresolved questions
- Finding 1 needs a planner decision (move block vs. self-advance) — it changes the phase-05 implementation shape.
