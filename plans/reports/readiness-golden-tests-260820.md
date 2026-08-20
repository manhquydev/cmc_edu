# Readiness: golden-number tests + SSO RLS harden

Date: 2026-08-20
Branch: `feat/readiness-golden-tests-sso-harden`

Numbers in this report come from `docs/19-quy-tac-nghiep-vu-chi-tiet.md`, `docs/20-quy-tac-nghiep-vu-van-hanh.md`, and `docs/22-adr-rule-chi-code-0038-0041.md`. Fixture amounts used only to exercise a formula are labelled as fixtures.

## (a) Flows now covered with doc-sourced golden assertions

### Receipt create → approve → cancel/refund (ledger)

| Assertion | Number / identity | Doc |
|---|---|---|
| `netAmount` frozen at approve | identity: approved net = draft net (fixture 7_500_000) | I4 is TL01; freeze behaviour is the money-gate. No catalog price in 19/20/22. |
| Approve provisions Enrollment `active` | state, not a price | ADR-A / enrollment paid-access (docs/22 ADR 0041 provisioning; enrollment test cites ADR-A) |
| Remaining balance after refund | `remaining = netAmount − SUM(refund)` (fixture 10_000_000 − 4_000_000) | docs/19/20/22 silent on I5; identity is the cheap ledger invariant requested |
| Two refunds | `remaining = 10_000_000 − 2_000_000 − 3_000_000`; `SUM ≤ net`; remaining ≥ 0 | same |
| Concurrent over-cap | `SUM(refund) ≤ netAmount` | same |
| Non-positive refund rejected | 0 and −1 → `BAD_REQUEST` | `vndAmountSchema` positive int; no-negatives invariant |

Files: `apps/api/src/finance/approve.test.ts`, `apps/api/src/finance/cancel-refund.test.ts`.

### Enrollment → tuition

| Assertion | Number / identity | Doc |
|---|---|---|
| `reserved` (unpaid) → `active` only via receipt path | state | ADR-A (enrollment file header) |
| After `receiptApprove`, Enrollment.status = `active` | state | paid-access; tuition amount is on Receipt, not Enrollment |

No tuition catalog exists in docs/19, 20, or 22. See (b).

Files: `apps/api/src/enrollment/reserved-active.test.ts`, `apps/api/src/finance/approve.test.ts`.

### Payroll assemble (tier + KPI bonus + penalty)

| Assertion | Number / identity | Doc |
|---|---|---|
| Fallback late/early rates | 500đ/phút muộn, 1000đ/phút sớm | docs/20 §3 |
| 30 min late + 30 min early | `30×500 + 30×1000 = 45_000` | docs/20 §3 applied to test punches |
| `variablePay` always 0 | 0 | docs/22 ADR 0044 |
| `totalNet = base + kpiBonus − penalty` | identity | docs/20 §3 (`base + %côngca×%chỉ-số×đơnGiá − phạt`); kpiBonus is the "Phần KPI" |
| `totalNet ≥ 0` | clamp | docs/20 §3 |
| `penaltyAmount ≤ baseSalary + kpiBonus` | cap | docs/20 §3 |
| Cap trigger (tiny fixture base 20_000, raw 45_000) | penalty = 20_000, totalNet = 0 | docs/20 §3 cap + clamp |
| Confirmed KpiScore 1_200_000 (fixture) included as kpiBonus | `totalNet = 10_000_000 + 1_200_000 − 45_000` | docs/20 §3 + docs/22 ADR 0044 (`Payslip.kpiBonus` = confirmed\|approved `KpiScore.value`) |
| Submitted/draft KpiScore not counted | kpiBonus = 0 | docs/20 §3 / docs/22 (only confirmed\|approved) |

`TIER_BASE_SALARY = 10_000_000` is a fixture, not a catalog rate. See (b).

File: `apps/api/src/payroll/penalty-posttax.test.ts`.

### KPI score / override

| Assertion | Number / identity | Doc |
|---|---|---|
| `%côngca × %chỉ-số × đơnGiá`, each pct capped at 1 | 50%×50%×1_000_000 = 250_000; 100%×100% = unitRate; overachieve still unitRate | docs/20 §3, docs/22 ADR 0044 |
| `creditFactor` | ≤24h → 1.0; ≤48h → 0.5; >48h → 0. 2h+2h+2h → `2×1 + 2×0.5 + 2×0 = 3` | docs/20 §4b, docs/22 ADR 0044 |
| Sale revenue GROSS | `SUM(Receipt.netAmount)` approved; RefundRecord of 4_000_000 does not reduce 4_000_000 | docs/20 §4 |
| Override writes director-set `value` | fixture 3_500_000 round-trips | docs/20 §4 (`kpi.override` set `value` trực tiếp) |

File: `apps/api/src/kpi/auto-score.test.ts`, `apps/api/src/kpi/override-tree.test.ts`.

### Rewards redeem / refund

| Assertion | Number / identity | Doc |
|---|---|---|
| Redeem deducts `starsRequired` | 20 − 10 = 10; balance ≥ 0 | docs/20 §5 |
| Reject refunds the stars paid | `gift_rejected_refund` +10; ledger 20 − 10 + 10 = 20; ≥ 0 | docs/20 §5 |
| `stock === -1` unlimited | stays −1 after deliver | docs/20 §5 |
| `stock === 0` reject immediately | `BAD_REQUEST` | docs/20 §5 |
| Concurrent redeem cannot go negative | final SUM = 0, not −10 | docs/20 §5 (never negative) |
| Default `starReward` 10 | documented default; not re-asserted here (gift.starsRequired is a catalog field, not homework reward) | docs/19 §6 |

File: `apps/api/src/rewards/redeem-refund.test.ts`.

## (b) Values that need operator confirmation (docs silent)

Marked `TODO(golden: needs operator)` in tests:

1. **Course tuition catalog** — no list price / program fee in docs/19, 20, or 22. Receipt amounts in tests (5M, 7.5M, 10M) are fixtures. (`approve.test.ts`, `cancel-refund.test.ts`, `reserved-active.test.ts`)
2. **SalaryTier catalog** — GV/KD `baseSalary`, `unitRate`, `requiredShifts`, `requiredMetric`. (`penalty-posttax.test.ts` `TIER_BASE_SALARY`)
3. **Second-eye threshold 20_000_000 VND** — docs/19 §2b records it as a *default* and says the figure is **not operator-locked**. Tests still use `APPROVAL_SECOND_EYE_THRESHOLD` as the code default. (`approve.test.ts`)
4. **VND rounding mode** — half-up to 33_333 from `1/3 × 100_000` is R3-13 in code comments, not in docs/19/20/22. (`auto-score.test.ts`)
5. **KPI override floor/cap** — docs/20 §4 lets a director set `value` directly; no min/max. (`override-tree.test.ts`)
6. **CompensationPolicy per-facility rates** when not using the 500/1000 fallback — docs/20 §3 says they are configurable; only the fallback is specified.

## (c) SSO RLS fix + test

**Bug.** `handleSsoCallback` did `getSsoDb().appUser.findFirst({ where: { email } })` with the unprivileged client and no facility GUC. AppUser is RLS'd (`AppUser_facility_isolation`). Re-enabling SSO would reject every Entra user.

**Fix.** `lookupSsoAppUser(db, email)` wraps the same `findFirst` in `withFacility(db, null, …, { bypass: true })`, copied from `attemptStaffPasswordLogin` in `password-routes.ts`. SSO remains env-disabled (`SSO_ENABLED`).

GitNexus `impact(handleSsoCallback, upstream)`: **LOW** — one direct caller (`server.ts`). Auth-critical path, but the change is the existing password-login escape hatch.

**Test.** `lookupSsoAppUser — RLS bypass (ADR 0042)` in `apps/api/src/auth/sso-routes.test.ts`:
- seed AppUser
- unprivileged `testDb().appUser.findFirst` → `null` (the pre-fix bug)
- `lookupSsoAppUser(testDb(), email)` → the seeded row

## Validation

- Typecheck: `pnpm --filter @cmc/api exec tsc --noEmit` — **pass** (after `prisma generate` in this worktree; first run failed with `Cannot find module '@cmc/db'` until workspace Prisma client was generated).
- Unit tests ran here (no DB):
  - `sso-routes.test.ts` CSRF / oauth_state / STAFF_EMAIL_DOMAIN / G10 — **pass**
  - `auto-score.test.ts` `computeKpiValue` (+ clamps / rounding) — **pass**
  - Combined: 20 passed, 24 skipped
- DB-backed tests **not run locally** (`APP_DATABASE_URL` / `DATABASE_URL` unset). `lookupSsoAppUser` failed immediately with `createPrismaClient: neither APP_DATABASE_URL nor DATABASE_URL is set.` Need CI `typecheck-and-test`:
  - `apps/api/src/auth/sso-routes.test.ts` — lookupSsoAppUser RLS case
  - `apps/api/src/finance/approve.test.ts`
  - `apps/api/src/finance/cancel-refund.test.ts`
  - `apps/api/src/payroll/penalty-posttax.test.ts`
  - `apps/api/src/kpi/auto-score.test.ts` collectors (GROSS revenue, creditFactor)
  - `apps/api/src/kpi/override-tree.test.ts`
  - `apps/api/src/rewards/redeem-refund.test.ts`
  - `apps/api/src/enrollment/reserved-active.test.ts`
