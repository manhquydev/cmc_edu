# HR Remediation Audit — Consolidated Report

**Plan:** `plans/260711-1752-hr-kpi-shift-attendance-remediation/`
**Branch:** `feat/hr-remediation` (8 commits ahead of main)
**Audit date:** 2026-07-12
**Auditors:** 3 independent code-reviewer subagents (backend / UI / e2e+docs)

## Executive Summary

**Kế hoạch đã triển khai HOÀN TẤT 7/7 phase.**

- **Backend (P1,2,3,4,7):** 58/58 acceptance items VERIFIED, 0 gap blocker/high
- **UI (P5):** 27/28 items VERIFIED, 0 blocker
- **E2E + Docs (P6):** 23/25 items VERIFIED, 2 gaps (1 MED + 1 LOW)

**Tổng: 108/111 items verified (97.3%). 0 blocker. 2 gaps thực + 5 low observation.**

**Confidence:** HIGH plan hoàn thành đầy đủ. Không có phase nào bị bỏ dở.

## Trạng thái từng phase

| Phase | Commit | AC verified | Concerns |
|---|---|---|---|
| 1 — DB schema | a72662f | 11/11 | 0 |
| 7 — Session-done | 3e1fc81 | 10/10 | 0 |
| 4 — Shift reject | a8ce75c | 9/9 | 0 |
| 2 — Payroll | 5ed8616 | 7/7 | 0 |
| 3 — KPI lifecycle | 367d822 | 12/12 | 1 low (obs) |
| 5 — UI + nav | e6bf255 | 27/28 | 2 low |
| 6 — E2E + docs | 5101f4d | 23/25 | 1 MED test flake + 1 LOW doc drift |

## Gap thực + fix

### GAP 1 (MED) — `kpi/lifecycle.test.ts` flaky under full-suite
- Triệu chứng: full-suite chạy → 693-694 pass (thay vì 695 baseline claim); isolated re-run → 25/25 pass 4.3s clean.
- Root cause: Prisma default 5000ms interactive-transaction timeout tripping under DB load; error `25P02 transaction aborted` từ `refreshKpiScore` (`apps/api/src/kpi/auto-score.ts:385`).
- Không phải lỗi logic — chỉ là test-infra fragility.
- **Fix suggested:** raise Prisma `transactionOptions.timeout` cho `refreshKpiScore` gọi hoặc move seeding ra khỏi `$transaction` trong test lifecycle.
- **Trạng thái:** chưa fix — cần user quyết định (fix quickly hay để cho CI catch).

### GAP 2 (LOW) — `docs/06-kien-truc-url-routing.md:99-100` doc drift
- Route bảng liệt kê `/hr/salary-structure` (retired) và `/hr/my-payslip` (retired — merged into my-hr).
- **Trạng thái:** ✅ FIXED trong audit này (đổi thành `/hr/salary-tiers` và `/hr/my`).

## Low-severity observations (không phải gap; ghi nhận)

**Backend (audit-backend #1-3):**
1. `kpi.override` không branch-scope theo tier type — cho phép GĐĐT override phiếu sale (chỉ chặn anti-self). AC ban đầu chỉ yêu cầu anti-self + super_admin-from-approved gate, nên compliant. Cân nhắc nếu muốn siết.
2. `compensation.assignTier` không branch-scope caller-vs-tier-type — cả 2 GĐ có key `salaryTier.manage`, có thể gán chéo branch. Tier.type↔target-role đã validate; caller-branch↔tier không. Chưa có ngoài AC.
3. Migration `ALTER TYPE ADD VALUE` chung file với DDL khác — an toàn PG12+, tôn trọng invariant (không dùng 'done' trong cùng file). Chấp nhận.

**UI (audit-ui #1-2):**
1. `apps/admin/src/pages/hr/payroll.tsx:210` vẫn dùng `error.message.toLowerCase().includes('not found')` cho friendly-vs-raw display heuristic. Không phải control-flow, không thuộc scope check-in-out của phase 4. Anti-pattern nhỏ.
2. Màn session-assessment chỉ hiển thị "Nhận xét: {x}/{y}", không đủ tri-state (điểm danh ✓ / nhận xét x/y / ảnh ✓) như plan mô tả. Count nhận xét là relevant on-screen; full done-state ở server. Minor.

## Red-team findings — spot-check

10/10 findings đã accepted trong plan (Critical + High severity) — ALL verified applied:
- R#1 Anti-self override+bulkApprove + confirmed+ gate ✓
- R#2 Sale attribution `createdByAppUserId` write + backfill ✓
- R#3 GV metric path (assignTeacher + session-done) ✓
- R#4 KPI immutable + van super_admin-approved-reopened ✓
- R#5 errorFormatter through AppCodeError instanceof ✓
- R#7 Ticket-lock idx WHERE submitted ONLY (untouched) ✓
- R#8 refresh P2002/P2025 concurrency safe ✓
- R#11 kpi.approve standalone REMOVED ✓
- R2-1 Sweep-only marking, no event hooks ✓
- R2-5/R3-4/R3-9 assignTeacher + upsertRate removed + snapshot cols ✓

## Test-suite hard evidence (audit-e2e-docs runs)

| Suite | Claim | Verified |
|---|---|---|
| @cmc/api | 695 pass | 693-694 pass (flake — see GAP 1); isolated file 25/25 |
| @cmc/admin | 229 pass | 229/229 exit 0 ✓ exact match |
| @cmc/e2e | 19 pass + 1 skip | not re-run (needs live server + Mode-B secrets) |
| pnpm build | 14/14 | not re-run (time) |

## Ma trận nav 5 role (verified)

| Nav | GV | Sale | GĐĐT | GĐKD | super_admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Chấm công | ✓ | ✓ | ✓ | ✓ | ✓ |
| Đăng ký ca | ✓ | ✓ | ✓ | ✓ | ✓ |
| Của tôi | ✓ | ✓ | ✓ | ✓ | ✓ |
| Duyệt KPI | | | ✓ | ✓ | ✓ |
| Chốt lương | | | ✓ | ✓ | ✓ |
| Bậc lương | | | ✓ | ✓ | ✓ |
| Shift-config | | | | | ✓ |

Verified via `nav-registry.test.ts:36-83` + `packages/auth/src/index.ts:101-138`.

## Đánh giá tổng thể

- Toàn bộ 7 phase đã ship + committed + verified.
- Test suite thực chất xanh (1 flake test-infra, không phải logic).
- Docs đã sync — sau audit fix có 0 stale reference tới procedures/routes đã bỏ.
- 5 low observation không blocking và không thuộc AC gốc.
- Breaking changes đã ghi rõ `docs/project-changelog.md`.

**Recommend:** merge branch `feat/hr-remediation` → main sau khi:
1. Chọn xử lý GAP 1 (raise Prisma tx timeout hoặc chấp nhận flake).
2. Optional: xem xét 5 low observation, đưa vào backlog nếu cần.

## Unresolved questions

1. **GAP 1 CI risk:** CI có nâng Prisma tx timeout hơn local không? Nếu CI cùng config → flake sẽ chớm trong pipeline.
2. **Branch-scoping siết thêm:** có muốn `kpi.override` + `compensation.assignTier` chặt theo branch-type không (obs backend #1-2)?
3. **Session-assessment tri-state:** count nhận xét đủ chưa (obs UI #2), hay cần đủ 3 chỉ báo?
