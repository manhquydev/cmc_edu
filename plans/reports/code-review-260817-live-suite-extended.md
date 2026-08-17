# Code Review — live-suite-extended (07–11 KPI/payroll/rewards/meeting/after-sale)

**Reviewer:** Staff Engineer (AgentKit code-reviewer) | **Date:** 2026-08-17
**Branch:** feat/back-before-design — commits beba72e, 4aa5969, d1173a5, 7e8358a
**Scope:** apps/e2e/src/live/live-ui.ts · tests/live/live-spec-utils.ts · tests/live/07…11 · plans/20260817-0225-live-suite-extended-ops/plan.md
**Method:** READ-ONLY. Every finding grep-verified against the admin pages and the API routers (kpi, payroll, meeting, after-sale, rewards, user) plus @cmc/auth PERMISSIONS. Typecheck run locally.

---

## Verdict

**APPROVE_WITH_NOTES.** The five new specs are contract-correct, hit real UI paths only, and the 12/12 live pass is genuine for the business flows (evidence shows finalized payslips with totalNet 10.000.000 / 8.000.000). One test-assertion defect means the suite's own "0 console errors" acceptance is not enforced for most pages — proven by the suite's own evidence (see F1). Fix F1 + F2 before calling the acceptance claim complete; everything else is notes.

---

## 1. Correctness vs server contracts — VERIFIED

| Contract | Server truth (grep) | Spec sequence |
|---|---|---|
| kpi.submitSlip past-period | `submitSlipOpensAt(period)` = 00:00 ICT day 3 of the FOLLOWING month (apps/api/src/kpi/auto-score.ts:275-286); refuses `Chưa gán bậc lương` when tierMissing (kpi/router.ts:207) | `pastPeriodIct(2)` → period M−2, opens day 3 of M−1 → always open. Correct + month-wrap safe (Date.UTC). |
| kpi.confirm manager link | `scoreOwner.managerId === confirmUser.id` unless super_admin (kpi/router.ts:261); anti-self (251); finalized payslip blocks confirm (269) | 07: sale created with manager=GĐKD via the REAL dialog ("Quản lý trực tiếp" Selector); 08: teacher with manager=GĐĐT. Confirm happens BEFORE assemble/finalize. Correct. |
| payslip.assemble tier | FORBIDDEN `Chưa gán bậc lương cho nhân viên này` when no SalaryRate (payroll/router.ts:327-333); kpiPartAmount from confirmed|approved slips only (444-451) | Tier created (KINH_DOANH / GIAO_VIEN with Loại selector) + assigned via Gán bậc tab before submit. Fresh accounts → value=0 → totalNet = base exactly. Evidence matches (10.000.000 / 8.000.000). |
| payslip.finalize / my | draft→finalized; my = self-scoped read (payroll/router.ts:531-636) | 'Chốt bảng lương' → 'Đã chốt'; payslip.my via the REAL sale/gv session cookie (liveStaffRoleClient). Invariants status=finalized + totalNet ≥ base are meaningful (base = tier baseSalary). |
| kpi.bulkApprove branch + finalized | branch-scoped by ROLE: GĐKD→sale, GĐĐT→giao_vien (kpi/router.ts:372-380); skips non-finalized (403) + self (395); confirmed→approved only | GĐKD settles KD bucket, GĐĐT settles GV bucket, both AFTER finalize. Banner regex `/Đã tất toán \d+ phiếu KPI/` matches the success text exactly (kpi.tsx:114). |
| Permissions | @cmc/auth PERMISSIONS: kpi.submitSlip/refresh sale+gv; kpi.confirm/bulkApprove GĐKD+GĐĐT; salaryTier.manage + payslip.assemble/finalize/reopen both GĐs; gift.upsert GĐKD; rewards.manage sale; parentMeeting.manage + afterSale.manage GĐKD; super_admin bypasses registry | All roles used match the required keys. |

- **Ordering 00→07/08/09 is guaranteed**: playwright 1.62.1 `collectFilesForProject` sorts directory entries by `localeCompare` (node_modules/.pnpm/playwright@1.62.1/lib/runner/index.js:2259) → flat tests/live/ runs 00…11; workers=1 + fullyParallel=false ⇒ sequential. 07/08/09 additionally fail FAST if 00 never ran (openStaffSession throws "no saved credentials…"). Note: running a single spec standalone is unsupported (documented in live-auth) — acceptable, but the specs do not self-document it.
- **runId collisions**: 8-hex random per campaign via rotateRun(); all created identities/names embed it; credentials keys are per-campaign overwritten. Adequate.
- **All UI locators verified against the actual admin pages** (salary-tiers, kpi, kpi-detail, payroll, my-hr, gifts, rewards, post-sale-meeting + its two dialogs, aftersale + detail): every label, tab name, dialog button, and status text matches — including the astryx contract nuance (MultiSelector with hasSearch → plain button; single Selector 'Quản lý trực tiếp' → combobox; options role="option").

## 2. Edge cases / locator fragility

- **F1 (MAIN FINDING) — assertNoErrors checks the wrong collector, proven by the suite's own evidence.** In 07/08/09 the final call is `assertNoErrors(page, scratch.collectors[0]!)` but collectors are pushed per session and `collectors[0]` is the FIRST-attached page (the super_admin page), not the page the argument names (the `_page` param of assertNoErrors is also unused — live-evidence.ts:215). The final run evidence (plans/reports/uat-live-20260817-final-kd/README.md) shows **07 and 08 both "passed" while carrying `### console error (1)` — "Failed to load resource: the server responded with a status of 404 ()"** — i.e. the error was captured on a non-first page, merged into evidence, and never asserted. This directly contradicts plan.md's "0 pageError/consoleError/requestFailure". Fix: assert every collector in scratch.collectors (or check them all in the afterEach), then decide what the 404 is (F2).
- **F2 — the 404 console error itself is unresolved.** One per KPI spec, on a non-super-admin page (the SA collector was clean, so it is not /favicon.ico on the first context load — or at least not only that). admin has no favicon and no public/ dir, so /favicon.ico 404s are at least one candidate, but the per-spec single occurrence on shared pages (salary-tiers / kpi / payroll / my / kpi-detail) suggests a missing asset on one of those pages. `isBenignRequestFailure` only filters request-failed net::ERR_FAILED+favicon — NOT console "Failed to load resource: 404" messages. Recommend: reproduce (local or VPS) to identify the resource; either fix it or extend the benign filter, then re-run to restore the "0 errors" claim.
- **10-ops-meeting weak invariant**: after completing, `row.filter({ hasText: 'Hoàn thành' }).toBeVisible()` is satisfied even if completion silently failed (the row's own 'Hoàn thành' BUTTON matches the text). Indirectly fail-closed by the later strict-mode multi-row assertions, but the direct check is soft — prefer asserting the 'Đã đặt lịch' badge is gone / the row shows the done badge without the button.
- **Unescaped name regex in 10/11**: `new RegExp(studentName!)` (spec 02 escapes its equivalent at line 58). Names are campaign-generated alphanumeric+spaces today — safe, but copy the escape for robustness.
- **Manager picker against the FULL roster**: users.tsx loads `user.list({})` unfiltered for the manager Selector; the match depends on runId-unique fullName and non-virtualized options. Passed live; low risk, unverified for large long-lived rosters.
- **Strict-mode hazards checked**: 'Gán bậc' tab vs row-action button cannot collide (AssignTab renders only when active); 'Đã trả lương kỳ X' button vs ConfirmDialog title (closed dialog not in a11y tree); payroll 'Kỳ lương (YYYY-MM)' unique on the list view; kpi 'Kỳ (YYYY-MM)' unique per page. OK.
- **07/08 board default status filter** ('submitted', kpi.tsx:88) is consistent with the flow: at step 4a the slip IS submitted; step 4c only uses the header bulk button. OK.

## 3. Trust boundaries / data

- **No secrets in specs**: temp passwords are generated at runtime (`CmcTemp!` + runId / rotated `CmcLive!`+uuid), never printed or logged (live-auth/live-env comments; grep confirms emails surface only). .env.prod is gitignored (`.env*` with example exceptions); .live-credentials.json + .live-run-state.json gitignored (apps/e2e/.gitignore). Super-admin bootstrap reads the VPS .env.prod only (never committed).
- **No DB writes**: live-otp is read-only SELECT via `docker exec psql` (with a salted-hash 6-digit brute-force fallback); live-global-setup is /health GET only. All created data goes through real UI sessions as the suite's purpose and is fully logged (staff email/name, tier name, period, gift name, meeting slots, case student) — no passwords in the created-log.
- **No PII**: synthetic emails (`live-*-<rid>@…`), synthetic names with runId, generic meeting/after-sale text. Evidence dirs contain only synthetic data.
- **Plan P7 reset** (clear hash admin/GĐs → re-seed → delete .live-credentials.json/.live-run-state.json) documented and executed; campaign data kept as UAT data is a documented, deliberate decision.

## 4. Type / lint

- `pnpm --filter @cmc/e2e typecheck` → **exit 0** (tsc --noEmit). 
- ESLint: 0 errors, but the live spec files are **ignored by the flat config** ("File ignored because no matching configuration was supplied") — the plan's "eslint 0 lỗi" means "eslint did not apply"; typecheck is the only real static gate for these files. Pre-existing convention for all live specs; worth documenting rather than relying on it.

## 5. Comment / commit hygiene

- Conventional commits, no AI attribution (test(e2e) / fix(e2e) / docs(plans)). Comments explain intent and cite the server contract each step depends on (managerId link, day-3 gate, bulkApprove branch scope, tier-required assemble) and the page labels they target — good.
- Minor: live-trcp.ts doc comment is stale/duplicated ("Use for student.lookup / enrollment.enroll" — now used for payslip.my); plan.md line 81 has a formatting artifact (old "⏳ đang chạy" sentence glued to the new "✅ 12/12" block); empty evidence dir uat-live-20260817-final/ from an aborted run (harmless).

## 6. Evidence cross-check (final run)

- uat-live-20260817-final-kd: 11/11 passed, 0 failed; invariants in evidence: `payslip-my period+totalNet: 2026-06=10000000` (07) and `…=8000000` (08); meeting/after-sale/rewards rows present; BUT console error (1) in 07 and 08 (see F1/F2).
- uat-live-20260817-final-otp: 1/1 passed (04-parent-otp, LMS project) ⇒ 12/12 total consistent with plan.md.

## Recommended fixes before closing A7

1. Make assertNoErrors cover every page of the spec (loop over `scratch.collectors`) — then decide on the 404 (fix or benign-filter), re-run 07/08, and correct the plan claim to the observed number.
2. Optionally harden the 10-ops-meeting completion assertion and escape the student-name regex in 10/11.

---

Status: APPROVE_WITH_NOTES
Summary: The five new live specs are contract-correct (verified against kpi/payroll/meeting/after-sale routers and @cmc/auth permissions), use real UI only, pass typecheck, and the 12/12 live run's business invariants (finalized payslips, totalNet = tier base) are genuine. One assertion defect (F1) means console errors on non-first pages don't fail the suite — the suite's own evidence shows 1 unasserted 404 console error in each KPI spec, contradicting the "0 errors" acceptance.
Concerns/Blockers: F1 (assertNoErrors targets collectors[0] instead of every collector — fix + decide on F2's 404 resource, re-run, correct the plan claim) is the only substantive item; F2 unresolved 404; all others are notes.
