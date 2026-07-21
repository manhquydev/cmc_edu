# Audit — HR Remediation Phase 6 (E2E specs + docs sync)

**Auditor:** code-reviewer (independent)  **Date:** 2026-07-12
**Branch:** `feat/hr-remediation`  **Phase-6 commit:** `5101f4d` (+ `25384c2` gitnexus chore)
**Scope:** `phase-06-e2e-specs-docs-sync.md` — 2 e2e specs, seed helpers, 11 doc targets, stale-claim sweep, test gates.

---

## Executive Summary

**Verified: 23/25 acceptance items. 2 gaps (1 MED, 1 LOW).**

The e2e specs and docs sync are **substantively correct and well-executed**. Both specs call only real
procedures; every assertion I spot-checked matches actual router behavior. Docs are comprehensive,
internally consistent, and the stale-claim sweep is clean (all `kpi.approve` refs are the live
**permission key** for `kpi.override`, not the dropped standalone procedure).

**Two gaps:**
1. **MED — the claimed `api 695 passed` gate is flaky, not reproducible.** Two clean full-suite runs
   produced **693** then **694** passed (transaction-timeout failures in `kpi/lifecycle.test.ts`). The
   file passes 25/25 in isolation — it is a Prisma 5s interactive-transaction timeout tripping under
   full-suite parallel DB load, not a logic defect. But "did it actually pass?" → **not on a clean run.**
2. **LOW — doc drift in `docs/06`:** URL routing table still lists `/hr/salary-structure`; the real
   route is `/hr/salary-tiers` (`nav-registry.ts:73`). Out of phase-6's declared sweep, but factually stale.

**Confidence: HIGH** (specs + docs read in full; API/admin suites executed with hard counts).

---

## Test-Suite Verification (hard evidence)

| Suite | Claimed | Observed | Verdict |
|---|---|---|---|
| `@cmc/admin` | 229 pass (32 files) | **229 passed (32 files)** — exit 0 | ✅ exact match |
| `@cmc/api` | 695 pass | **693 pass** (run 1, concurrent) → **694 pass** (run 2, isolated) | ⚠️ **flaky, never hit 695** |
| `kpi/lifecycle.test.ts` alone | — | **25/25 passed, 4.3s** | ✅ green in isolation |
| `@cmc/api` build 14/14 | 14/14 | not run (time) | ⬜ unverified |
| `@cmc/e2e` 19+1skip | 19 pass +1 skip | not run (needs live server + Mode-B secrets) | ⬜ unverified |

**API failure detail** (both runs, same file `src/kpi/lifecycle.test.ts`):
- `kpi.list > a non-director cannot list → FORBIDDEN` — `Transaction already closed ... timeout 5000ms,
  however 7095ms passed` (`lifecycle.test.ts:509`).
- `kpi.refresh` path — `25P02 current transaction is aborted` from `refreshKpiScore`
  (`auto-score.ts:385` `findFirstOrThrow`, via `router.ts:117`).

Both are **interactive-transaction timeouts under load**, concentrated in the phase-3 KPI lifecycle test
(heavy work inside `$transaction`). Isolated, the file is green. **Impact:** a fresh CI full-suite run can
fail; the "695 passed" sign-off is not deterministic.

---

## E2E Specs

| Item | Status | Evidence |
|---|---|---|
| `shift-lifecycle.spec.ts` exists | ✅ | submit→reject(reason)→myRegistrations shows rejectReason→resubmit→approve (`:122-158`) |
| — group-type gate | ✅ | sale into GIAO_VIEN group → BAD_REQUEST (`:73-86`); router `shift.submit` gate confirmed |
| — anti-self | ✅ | multi-role actor cannot reject own reg → FORBIDDEN (`:88-114`); `assertCanReview` `forbidden()` (`shift/router.ts:99-102`) |
| — ticket-lock + overlap freed after reject | ✅ | resubmit same range succeeds post-reject (`:142-151`) |
| `kpi-lifecycle.spec.ts` exists | ✅ | full refresh→submitSlip→confirm→assemble→finalize→bulkApprove (`:44-203`) |
| — receipt approvedAt API-driven stamp (FMA #10) | ✅ | `getReceiptApprovedAt` null→Date around `receiptApprove` (`:101-103`); router stamps `new Date()` (`finance/router.ts:250`) |
| — seeded past-period receipts/shifts/punches | ✅ | `seedApprovedReceipt/ShiftRegistration/TimePunchPair`, PERIOD `2026-05` backdated (`:120-147`) |
| — formula %côngca×%chỉsố×đơnGiá | ✅ | `refreshed.value === TIER_UNIT_RATE` at 1.0×1.0 (`:158`) |
| — submitSlip past bypasses day-3 | ✅ | comment + past PERIOD, no mock clock (`:11-14, 163`) |
| — assemble = base+value−penalty | ✅ | totalNet === base+unitRate, penalty 0 (`:177-184`) |
| — bulkApprove only if finalized; GĐĐT no-touch sale | ✅ | gddtBulk.approved 0 / gdkdBulk.approved 1 (`:193-202`); `resolveKpiTargetRole` branch-scope (`kpi/router.ts:337-343`) |
| Only 2 specs (3 cut per red-team #18) | ✅ | no `checkin-ip` / `payslip-policy` / `manual-punch-payroll` in `apps/e2e/tests/` |
| Boundary-clock claim NOT in e2e | ✅ | headers explicitly disclaim it, point to phase-3 unit tests (`kpi:11-14`, `shift:25-26`) |
| `db.ts` seed helpers + managerId chains | ✅ | `seedAppUser(managerId, roles)`, chains GĐKD→sale wired (`kpi:48-60`); `cleanupFacility` extended for P3-II tables (`db.ts:157-177`) |
| client `userId` ↔ AppUser.userId match | ✅ | same `e2e-kpi-*-${suffix}` on seed + client; helper doc enforces it (`db.ts:211-214`) |

**All procedures called by specs exist** — verified: shift.{createGroup,createTemplate,submit,reject,
approve,myRegistrations}, salaryTier.create, compensation.assignTier, kpi.{refresh,submitSlip,confirm,
bulkApprove,myScore}, payslip.{assemble,finalize}, finance.{receiptCreate,receiptApprove}. No phantom APIs.

---

## Docs Sync

| Doc | Claim | Verdict |
|---|---|---|
| `10-data-model-v2.md` | SalaryTier + tierId + 3 legacy nullable + CompensationPolicy + KpiScore snapshots + kpiMax nullable + Payslip.kpiBonus repurposed + variablePay dep=0 + ShiftReg.rejectReason + Receipt.approvedAt + SessionStatus.done | ✅ V8/V9 (`:88-89`) accurate, matches schema |
| `11-api-contract.md` | new procs added; dropped procs (kpi.submit/approve-standalone/getForUser, compensation.upsertRate) marked removed; errorFormatter appCode | ✅ `:88-114` full & correct; `kpi.override` labelled "khoá quyền kpi.approve" |
| `14-danh-muc...md` | 5-role nav/perm matrix | ✅ 5-role matrix present (`:20-72`) |
| `20-quy-tac...md` | tier formula + công-ca vào/ra + session-done + GĐ ngoài payslip + ticket-exempt + overlap | ✅ formula `:57`, creditFactor `:133`, GĐ-outside `:84,117` |
| `22-adr...0038-0041.md` | ADR 0042 added (no `docs/adr/`) | ✅ `## ADR 0042 — KPI auto-score + session-done engine` (`:105`); no `docs/adr/` dir |
| `25-ma-tran...md` | P3-07..11 rows (reject/bulkApprove/refresh/session-done/reschedule), 6-col TL25 | ✅ `:44-48` all 5 rows, full 6 columns, ADR0042 mapping (`:78`) |
| `27-workflow-spec-p3.md` | WF-P3-04/05/06 rewritten, no live stale refs | ✅ `:90,124,159`; `/hr/salary-structure` only in "replaced" blockquote (`:130`) |
| `uat-checklist-go-live.md` | KB4 no kpi.submit/approve | ✅ role matrix uses kpi.refresh/submitSlip + override(key kpi.approve) only (`:294-297`) |
| `codebase-summary.md` | HR remediation delta | ✅ `:3,5,223-287` + build-state line |
| `project-changelog.md` | BREAKING entry (dropped procs, tier, session-done, 5-role nav) | ✅ `:9-27` dated 2026-07-12, complete |
| Runbook: tier onboarding step | ✅ (in docs/20 §3 tier-source QĐ) | present as pre-payroll requirement |

---

## Stale-Claim Sweep

| Pattern | Result |
|---|---|
| `kpi.submit` / `kpi.getForUser` | ✅ only in removed/BREAKING/historical context (11,20,22,25,27,codebase,changelog) |
| `kpi.approve` | ✅ **all live refs are the permission key** for `kpi.override` (`kpi/router.ts:261 requirePermission('kpi','approve')`) — NOT the dropped standalone proc. Legit. |
| `compensation.upsertRate` | ✅ only in removed context (11,20,27,codebase,changelog) |
| `/hr/salary-structure` | ⚠️ `docs/27:130` historical (OK); **`docs/06:99` lists it as a LIVE route (STALE — real: `/hr/salary-tiers`)** |
| `variablePay` | ✅ marked deprecated/`luôn 0` everywhere (10,20,22); `docs/01:65` historical ADR-0025 field ref |

---

## Final Gate Verification

- ✅ `git log main..HEAD` = **8 commits**: 7 phase commits (phases 1-7) + 1 gitnexus chore. Matches.
- ✅ No `docs/adr/` directory (red-team #21 respected).
- ✅ 3 cut specs absent (red-team #18 respected).
- ⚠️ API gate flaky (see above); admin gate exact; build + e2e unverified.

---

## Gaps

| # | Sev | Gap | Suggested fix |
|---|---|---|---|
| 1 | **MED** | `api 695 passed` gate not reproducible — full-suite runs flaked to 693/694 via Prisma 5s interactive-tx timeout in `kpi/lifecycle.test.ts` (green 25/25 isolated). CI full-suite runs can fail. | Raise `maxWait`/`timeout` on the KPI lifecycle interactive `$transaction`s, or reduce work inside them (move seeding outside the tx). Not phase-6 code, but the phase-6 sign-off depends on it. |
| 2 | **LOW** | `docs/06:99` URL table lists retired `/hr/salary-structure`; real route `/hr/salary-tiers`. | Update `docs/06` row `Cơ cấu lương` → `/hr/salary-tiers` (or `Bậc lương`). |

---

## Positive Observations (risk-calibration)

- Seed helpers correctly set the **`AppUser.roles` DB column** (not just session roles) — this is exactly
  what `resolveKpiTargetRole` reads for branch-scope; a subtle trap the author handled and documented (`db.ts:204-208`).
- FMA #10 assertion uses **real `now()`** for the receipt-approve stamp check, explicitly kept outside
  PERIOD so it can't leak into metric assertions (`kpi:82-84`) — precise threat-model reasoning.
- Anti-self, group-type, and branch-scope assertions all verified against actual router source, not assumed.

---

## Unresolved Questions

1. Is the KPI lifecycle transaction-timeout flake known/tolerated in CI, or does CI run with a higher
   Prisma tx timeout than local? (Determines whether gap #1 is a real CI risk or local-only.)
2. Was `docs/06` intentionally out of phase-6 scope, or an oversight? (Determines whether gap #2 is drift or deferred.)
3. Build 14/14 and e2e 19+1skip were not run here — should they be confirmed before landing?

```
Status: DONE
Verified items: 23/25
Gaps: 2 (1 MED flaky api gate, 1 LOW doc drift)
Report: D:\project\vip\CMC\plans\reports\audit-e2e-docs-260712-0850-hr-remediation-phase6-report.md
```
