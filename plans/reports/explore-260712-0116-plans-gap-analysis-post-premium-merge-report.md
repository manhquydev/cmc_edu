# CMC EDU v2 — Plans Gap Analysis (post-premium-merge)

**Date:** 2026-07-12 · **Repo:** `D:\project\vip\CMC` @ main HEAD `414bfb3` · **Agent:** Explore (thorough, read-only)

## 1. Summary Table (all plans)

| Plan | Frontmatter status | Real % (checkbox open/done) | Action |
|---|---|---|---|
| `260706-0934-p1-identity-enrollment` | (superseded) | 0/0 (no phase files) | Skip — historical |
| `260706-1703-p2-foundation-class-ops` | (superseded) | 0/0 | Skip — historical |
| `260706-1803-master-execution-roadmap` | (no frontmatter) | 13 open / 0 done — all phases pending | **DEAD**: superseded by roadmap docs + M0–M4 plan; archive |
| `260707-0915-ui-implementation` | in-progress | 6 open / 61 done (91%) | **~DONE de facto** — all 6 open items BLOCKED-on-external or YAGNI. Flip → `completed` |
| `260707-1450-golive-production-readiness` | superseded | 30 open — irrelevant | Skip |
| `260707-1830-golive-coordination-land-stack` | superseded | 22 open — irrelevant | Skip |
| `260707-2128-staff-sso-golive-roadmap` | completed | 19 open — moved to `260707-2308` | Skip |
| `260707-2308-golive-sprint-land-sso-env-uat` | in-progress | 6 open / 16 done (72%) | **BLOCKED at UAT people/live-email** — only awaits humans |
| `260708-0504-roadmap-m1-m4-execution` | pending | 18 open / 0 done | Waits on M0 GO — accurate |
| `260708-2024-erp-prototype-ui-alignment-sale-flow` | done | 21 open (stale AC checkboxes) | Frontmatter correct |
| `260710-0005-lms-gap-closure-otp-parent-visibility` | completed | 20 open (stale AC checkboxes) | Correct |
| `260710-0228-m1-pilot-stability-real-vps` | pending | 70 open / 13 done (15%) | **Real work — awaits M0 GO + VPS decision** |
| `260710-0236-astryx-ui-migration` | completed | 7 open (phase-05 success gate) | Correct — 0 mantine verified |
| `260711-1128-erp-lms-workflow-closure-audit` | completed (phase-05 optional) | 7 open (phase-05 stretch) | Correct |
| `260711-1720-premium-erp-screen-buildout` | **completed (00–07 merged, phase-08 BLOCKED)** | 0 open / 39 done (100%) | Just updated |
| `260711-1752-hr-kpi-shift-attendance-remediation` | pending, P1 | 25 open / 0 done (0%) | **UNBLOCKED 2026-07-12** — highest-priority next |

## 2. Dependency graph (current)

```
M0 (260707-2308) ──blocks──▶ M1 (260710-0228) ──blocks──▶ M1–M4 (260708-0504)
   ▲                              ▲
   │ blocks (UAT)                 │
[cleared] astryx-ui-migration (260710-0236, done PR#28)
[cleared] lms-gap-closure   (260710-0005, done)

premium-erp-buildout (260711-1720, DONE 2026-07-12)
   └─blocks (cleared)──▶ hr-kpi-remediation (260711-1752)  ⇐ NOW UNBLOCKED

ui-implementation (260707-0915) ── de facto done, 6 open all env-blocked/YAGNI
```

Overlap: **premium phase-08 (shift-config real build)** and **hr-remediation phase-05** both own `shift-config.tsx`. HR-remediation is the real owner.

## 3. Per-plan detail

### 3.1 `260707-2308-golive-sprint-land-sso-env-uat` (P1, in-progress, 72%)

Real open items:

| Item | File:line | Verdict |
|---|---|---|
| P2 SC: Gate G1–G10 tick | phase-02:91 | Verified in narrative — docs-only formality |
| P4 SC: e2e 2/2 continuous PASS | phase-04:117 | Mode-B 2026-07-11 xanh; **stale** — tick with post-redeploy note |
| P4 SC: email Brevo + Graph ≥1 real | phase-04:118 | **Real blocker** — Brevo key 401 (addendum 104-106); rotate |
| P4 SC: UAT people PASS | phase-04:119 | Human-gated |
| P4 SC: e2e throwaway secret | phase-04:120 | Env-guard implemented — **stale**, tick |
| P4 SC: sign go/no-go | phase-04:121 | Human sign-off |

**Recommendation:** Continue holding — 100% blocked on (a) Brevo rotation, (b) UAT scheduling, (c) sign-off. No code work.

### 3.2 `260707-0915-ui-implementation` (P1, in-progress, 91%)

Real open items:

| Item | File:line | Real gap? |
|---|---|---|
| phase-01a: "Test suite xanh — BLOCKED PG stopped" | phase-01a:50 | **NOT a code gap** — dev-env; suite 532/532 verified elsewhere |
| phase-04: tablet + gate adversarial | phase-04:50 | Human-manual verification |
| phase-06: PH meeting/aftersale/refund EmptyState | phase-06:49 | Deferred ("EmptyState cần thêm sau"). **Silent gap: no follow-up plan** |
| phase-06: level-progress descoped → EmptyState ✓; report-cards ✓ | phase-06:50 | **Stale checkbox** — narrative says done; tick |
| phase-06: notifications/search — YAGNI | phase-06:54 | YAGNI-closed |
| phase-08: e2e on CI — BLOCKED-PG | phase-08:54 | Same env issue |

**Recommendation:** Flip → `completed with residual EmptyStates`. Roll 3 EmptyState screens into follow-up.

### 3.3 `260711-1752-hr-kpi-shift-attendance-remediation` (P1, pending, 0/25) — **NEXT SPRINT**

**BLOCKER CLEARED 2026-07-12** by premium plan merge (ff1b826).

| Phase | Scope | Blocker |
|---|---|---|
| 1 | DB schema/migrations: `SalaryTier`, `MakeupForSessionId @unique`, seed catalog | Clean |
| 2 | Payroll correctness (TDD): rewrite `compensation`/`payslip.assemble`; drop `variablePay`, relabel `kpiBonus` | Premium didn't touch api — clean |
| 3 | KPI auto-score lifecycle: new `kpi.list/bulkApprove/submitSlip`, drop `kpi.submit/approve` | Premium's `kpi.tsx` uses `getForUser/confirm/approve` — must migrate |
| 4 | Shift reject/list + errorFormatter: new `shift.listGroups`/`listTemplates`, `shift.reject`, AppCodeError | **Solves premium phase-08 shift-config gap** |
| 5 | UI nav + HR screens (~18h): rewrite `kpi.tsx`/`payroll.tsx`/`shifts.tsx`/`check-in-out.tsx` on premium templates + new `my-hr.tsx`/`salary-tiers.tsx` + **`shift-config.tsx` real CRUD** | **Solves 1 of 3 phase-08 stubs** + unblocks session-done engine |
| 6 | E2E + docs sync | Standard |
| 7 | Session-done engine + auto-reschedule | New backend |

**Recommendation:** **START NEXT.** Highest-value P1 work + eliminates 1 phase-08 stub. Effort ~58h.

### 3.4 `260710-0228-m1-pilot-stability-real-vps` (P1, pending, 15%)

- Phase 4 (hardening) LANDED — PR #31 + PR #32
- Phases 1/2/3/5/6 = 70 open, legitimately pending on M0 GO + VPS provider decision
- Not stale — accurate

### 3.5 `260708-0504-roadmap-m1-m4-execution` (P1, pending)

Umbrella; correctly blocked by M0. No stale.

### 3.6 `260711-1720-premium-erp-screen-buildout` (P2, completed 2026-07-12)

Frontmatter now correct. Phase-08 (3 stubs) verified BLOCKED against code:
- `leaderboard.list` — grep clean in `apps/api/src` ✓
- `facilityNetwork.list/create/delete` — only read use at `checkin/router.ts:48` ✓
- `shift.listGroups/listTemplates` — grep clean (only createGroup/createTemplate exist) ✓

## 4. Stale checkboxes

1. **UI-impl phase-06:50** — level-progress + report-cards + attendance-report; narrative says done, tick.
2. **UI-impl phase-01a:50 + phase-08:54** — "test suite BLOCKED PG stopped" is dev-env, NOT real gap.
3. **Golive phase-02:91** — G6/G8/G9/G10 verified in narrative.
4. **Golive phase-04:117,120** — e2e 2/2 + throwaway-secret assertion done.
5. **Astryx phase-05:61-67** — 7 SC open but frontmatter=completed, verified.

## 5. Silent gaps (code has but no plan covers)

1. **PH meeting / after-sale / refund EmptyState** — UI-impl phase-06 deferred; no follow-up owner.
2. **Premium plan phase-08 leaderboard + network-ip real features** — HR-remediation only owns shift-config; leaderboard + network-ip still need owner.
3. **UAT bilateral email live-verify (Brevo rotation)** — mentioned in phase-04 addendum; no separate ops task.
4. **Master roadmap plan `260706-1803`** — de facto superseded; no archive marker.
5. **ctv_mkt dormant role** — decided dormant PO 2026-07-10; correct outcome.

## 6. Priority — next sprint

1. **`260711-1752-hr-kpi-shift-attendance-remediation` phases 1 → 2/4/7 parallel → 3** — unblocked, highest tech-debt payback. ETA ~58h.
2. **`260707-2308` phase-4 close-out** — rotate BREVO_API_KEY, book UAT, sign GO/NO-GO. Not code.
3. **`260710-0228` phase-1** — once M0 GO signed, choose VPS provider, start clean-room deploy.
4. **Housekeeping** — flip `260707-0915` frontmatter → completed. Archive `260706-1803`. Fix stale checkboxes from §4.
5. **Deferred until backend+spec resolved** — premium phase-08 leaderboard + network-ip. Not P1.

## Unresolved questions

- 3 "residual EmptyState" screens (PH meeting/aftersale/refund): roll into HR-remediation phase-05 or separate P3 follow-up?
- Premium phase-08 leaderboard: TL16 dropped "bảng xếp hạng" — silent-drop candidate?
- Master roadmap plan `260706-1803` — archive explicitly?
- Brevo API-key rotation ownership — dev vs ops?
