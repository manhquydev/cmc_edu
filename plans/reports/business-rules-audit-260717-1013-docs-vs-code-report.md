# Business-Rule / Data-Model / RBAC — Docs vs Code Audit (2026-07-17)

Scope: docs 10, 14, 17, 19, 25 cross-checked against `schema.prisma`, `@cmc/auth`,
`apps/api/src/**/router.ts`, `@cmc/domain-payroll`, `apps/api/src/finance/router.ts`.

**Headline: the RBAC catalog and business-rule docs are mostly ACCURATE and current.**
The ADR-D 5-active-role narrowing, the removed HR procedures, the money-gate threshold,
and the salary-tier formula all match code. Only 3 real mismatches found (1 that would
genuinely mislead a reviewer), listed below.

---

## Findings

### F1 — Traceability matrix lists a dormant role as a receipt approver  [Category A — safe to fix]
- **Doc claim:** `docs/25-ma-tran-truy-vet-p1.md:23` (WF P1-03) — role column reads
  "GĐKD · GĐĐT · **ke_toan**" for `finance.receiptApprove`.
- **Code reality:** `packages/auth/src/index.ts:63` → `finance.receiptApprove` = only
  `['giam_doc_kinh_doanh','giam_doc_dao_tao']`. `ke_toan` is a **deferred** role with
  **0 permissions** and is excluded from `ACTIVE_ROLES` (`index.ts:27-33`); the ADR-D
  amendment (2026-07-08) makes it unassignable. `docs/14` §1 correctly reflects this.
- **Why it misleads:** a nghiệm-thu reviewer reading the traceability matrix would
  conclude an "accountant" role can approve receipts / operate the money gate. It cannot.
  This is a leftover from the pre-ADR-D 9-role model that `docs/14` was updated for but
  `docs/25` P1-03 was not.
- **Fix:** drop `ke_toan` from the P1-03 role cell (leave GĐKD · GĐĐT).

### F2 — `ParentAccount.email` described as a required field; column is nullable  [Category A/C]
- **Doc claim:** `docs/10-data-model-v2.md:45` ("email required (PH login)") and `:47`
  ("`ParentAccount.email` là trường bắt buộc cho luồng auth"). Similar wording in
  `docs/19-...:40`.
- **Code reality:** `schema.prisma:430` → `email String? @unique` — **nullable**. Schema
  comment (`:427-429`) states existing phone-provisioned accounts have no email until a
  parent sets one or staff captures it. So the requirement is **conditional** (only needed
  *if* using email-OTP login), not a NOT-NULL column.
- **Why it matters:** `docs/10:100` states it correctly as conditional ("bắt buộc **khi**
  tài khoản dùng cho auth email+OTP"), but the §2 table wording reads as unconditional.
  Compounding risk: email-OTP is **BLOCKED-ON-COMMS** (`docs/19:44` — ConsoleEmailTransport
  stub, not deliverable in prod). A reviewer could wrongly tick "parent email login works"
  when most accounts have no email and the transport isn't wired.
- **Fix:** align §2 table wording with the correct conditional invariant on line 100.

### F3 — `SessionStatus` enum documented with 3 values; schema has 4  [Category A — low impact]
- **Doc claim:** `docs/19-...:109` lists `SessionStatus: planned/confirmed/cancelled`.
- **Code reality:** `schema.prisma:138-143` has a 4th value **`done`** (added for the
  session-done engine, ADR 0042/0043; also noted in `docs/10:91` V11).
- **Why it's low impact:** the rule §5 is actually making — a `cancelled` session cannot be
  attendance-marked — remains correct. Only the enumerated value set is stale.
- **Fix:** add `done` to the §5 enum list (or reference docs/10 V11).

---

## Cross-checks that PASSED (no doc drift — reassurance for nghiệm thu)

- **RBAC registry vs docs/14:** 9-role enum + 5 `ACTIVE_ROLES` (super_admin, GĐKD, GĐĐT,
  sale, giao_vien) matches `docs/14` §1 exactly. Dormant roles (ke_toan/cskh/ctv_mkt/hr)
  = 0 perms, enforced by `ACTIVE_ROLES` + registry (`packages/auth/src/index.ts:24-131`).
- **docs/14 §5 permission matrix:** spot-checked ~12 rows against `PERMISSIONS` map —
  all match (receiptApprove, refundCreate=GĐKD-only, facility.*=super-only,
  class.create/schedule.generate=GĐĐT, attendance.mark, manualPunch.approve, shift.approve,
  salaryTier.manage, kpi.confirm/bulkApprove/approve). No drift.
- **Money gate (docs/19 §2b):** `APPROVAL_SECOND_EYE_THRESHOLD = 20_000_000`
  (`finance/router.ts:37`) and `SECOND_EYE_ROLES = ['giam_doc_dao_tao','super_admin']`
  (`:43`) match the doc verbatim, including the 3-part `canApprove` (notSelf + secondEye +
  permission).
- **Salary formula (docs/10 V8/V9, memory model):** `assembleSlip`
  (`packages/domain-payroll/src/assemble-slip.ts:68-98`) computes
  `totalNet = max(0, baseSalary + kpiPartAmount − penaltyAmount)`; kpiPart = the
  %côngca×%chỉ-số×đơnGiá computed upstream in `kpi.refresh`; `variablePay` always 0;
  penalty = late×rate + early×rate, capped at earnings. Matches docs.
- **Removed procedures (PR #33):** `kpi.submit`, standalone `kpi.approve`, and
  `compensation.upsertRate` are gone from code (`kpi/router.ts:27`, `payroll/router.ts:131`)
  AND no doc references them as live — `docs/14` and `docs/25` (§3 note lines 81-83)
  describe them as superseded/removed. `kpi.approve` key correctly retained to gate
  `kpi.override` (`kpi/router.ts:279`).
- **Default student password:** `Cmc2026@` + `mustChangePassword=true`
  (`provisioning/provision-from-receipt.ts:249`, `student/router.ts:94`) matches
  `docs/10:47`. Student login = phone+password (`loginStudent`), parent = phone-OTP OR
  email-OTP (both `requestOtp` and `requestOtpEmail` exist, `lms-auth/router.ts:192,333`) —
  consistent with `docs/17` §6.

---

## Unresolved / for PO judgement
- **None require code changes.** All 3 findings are doc-side (Category A). No case of code
  deviating from a documented business decision (no Category B) was found in this slice.
- Minor: `docs/19` §2 implies parent auth is *only* email+OTP, while code + `docs/17` §6
  allow phone-OTP too. Not misleading enough to flag as a numbered finding, but §2 could
  note the phone-OTP path still exists.
