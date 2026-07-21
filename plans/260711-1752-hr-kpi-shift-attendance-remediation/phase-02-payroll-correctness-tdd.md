---
phase: 2
title: "Payroll correctness (TDD)"
status: pending
priority: P1
dependencies: [1]
effort: "7h"
---

# Phase 2: Payroll correctness (TDD)

## Overview
Sửa lỗi nghiệp vụ trong `payslip.assemble` + **đổi công thức lương sang mô hình bậc (validate session 3)** + CompensationPolicy procedures + warning ticket-duyệt-muộn.

## Requirements
- **Công thức mới (`assembleSlip` VIẾT LẠI)**: `totalNet = max(0, baseSalary + kpiPartAmount − penaltyAmount)`. `baseSalary` từ `SalaryTier`; `kpiPartAmount` = `value` phiếu KpiScore `confirmed|approved`. **Write contract Payslip (R3-2): `kpiBonus` := kpiPartAmount (cột tái dụng — UI/docs nhãn "Phần KPI"); `variablePay` := 0 (deprecated)** — 2 cột NOT NULL vẫn được ghi hợp lệ. `assemble-slip.test.ts` (18 tests) rewrite; penalty post-tax QĐ0025 giữ.
- **Payslip CHỈ cho role sale/giao_vien (validate s4)**: assemble/finalize target là GĐ/super_admin → BAD_REQUEST "lương GĐ ngoài hệ thống".
- **Phạt PER-CA (R3-6/R3-7 — thay per-ngày "use first entry")**: rewrite penalty loop trong assemble — mỗi `ShiftRegistrationEntry` của ngày: gán punch vào/ra theo rule công-ca (phase 3, cùng module dùng chung); late = max(0, in − start), early = max(0, end − out); punch không tái dùng giữa các ca (pool loại dần theo thứ tự start); deterministic (order by template.startTime). Ca thiếu cặp = ca vắng: không công, KHÔNG phạt phút, đếm unpunched (QĐ user s4: phạt chỉ áp cho ca được ghi nhận).
- Functional: (1) ngày có `ManualAttendanceTicket` approved → miễn unpunched + miễn phạt + **credit đủ chấm cho MỌI ca đăng ký ngày đó**; (2) rates từ CompensationPolicy, fallback 500/1000; (3) kpiPartAmount từ phiếu `confirmed | approved`; (4) chưa gán `tierId` → FORBIDDEN "chưa gán bậc lương" (greenfield — gán bậc là onboarding bắt buộc, ghi runbook phase 6).
- **BỎ `compensation.upsertRate`** (R3-4): xóa procedure + key `compensation.upsertRate` khỏi PERMISSIONS; nguồn baseSalary duy nhất = tier. `penalty-posttax.test.ts` seed toàn bộ qua upsertRate → **RECLASSIFY: REWRITE toàn file** (seed qua salaryTier + assignTier).
- (4) **Ticket duyệt muộn** (red-team #13): `manualPunch.approve` kiểm tra payslip kỳ của ticket đã `finalized` chưa → nếu có, vẫn approve nhưng response kèm `warning: 'PAYSLIP_FINALIZED'` để UI hiển thị "cần GĐ reopen kỳ lương nếu muốn hoàn phạt"; ghi quy tắc vào docs/20 (phase 6).
- Non-functional: payslip đã `finalized` KHÔNG tự recompute; logic mới chỉ áp dụng khi assemble/reopen.

## Related Code Files
- Modify: `apps/api/src/payroll/router.ts` (assemble ~:211-224; thêm sub-router `compensationPolicy`)
- Modify: `apps/api/src/checkin/router.ts` (approve: warning finalized)
- **Rewrite**: `apps/api/src/payroll/penalty-posttax.test.ts` (seed qua tier; per-ca penalty cases: GV 2 ca/ngày, ca vắng không phạt, deterministic)
- Create: `apps/api/src/payroll/manual-ticket-exemption.test.ts`
- Create: `apps/api/src/payroll/policy-rates.test.ts`
- Modify: `packages/auth/src/index.ts` + `index.test.ts` (key `compensationPolicy.manage` — super_admin; `salaryTier.manage` — 2 GĐ)
- **Rewrite: `packages/domain-payroll/src/assemble-slip.ts` + `assemble-slip.test.ts`** (công thức bậc — validate s3 thay ghi chú cũ "không sửa"); thêm procedures `salaryTier.list/create/update` + `compensation.assignTier({appUserId, tierId})` (2 GĐ) trong payroll router

## Implementation Steps (TDD — tests trước)
1. `manual-ticket-exemption.test.ts`: seed user + shift entries + punches thiếu 1 ngày + ticket approved ngày đó → assemble → không đếm unpunched, penalty ngày đó = 0. Đối chứng: ticket `pending`/`rejected` → vẫn phạt. Case ticket duyệt SAU finalize → payslip giữ nguyên + approve trả warning.
2. `policy-rates.test.ts`: facility có policy (700/1200) → dùng 700/1200; không có → fallback 500/1000; RLS không leak cross-facility.
3. Mở rộng `penalty-posttax.test.ts`: KpiScore `confirmed` → tính; `submitted` → không; `approved` → tính; chưa gán tier → FORBIDDEN.
4. Rewrite `assemble-slip.ts` + 18 tests theo invariant mới (`totalNet = max(0, base + kpiPartAmount − penalty)`); code assemble: approved tickets exclude khỏi unpunched/penalty loop (ICT `ictDateOnlyOf`); load policy + tier; KPI `status IN ('confirmed','approved')` lấy `value`.
5. `compensationPolicy.get`/`upsert` + `salaryTier` CRUD (audit updatedById) + `assignTier` — **guards vào Requirements + tests (R3-5-Med)**: target role ∈ {sale, giao_vien} (GĐ/super_admin → BAD_REQUEST); tier.type khớp role target (GIAO_VIEN tier gán sale → BAD_REQUEST); xóa upsertRate + cập nhật docs key.
6. `pnpm --filter @cmc/api test` + **`pnpm --filter @cmc/admin typecheck`** (gate chống break UI giữa chừng — red-team #11).

## Success Criteria
- [ ] 3 test files mới/mở rộng xanh; test cũ không weaken (diff ghi chú thay đổi có chủ đích).
- [ ] `gitnexus_impact` chạy cho assemble handler + manualPunch.approve trước khi sửa.
- [ ] Hằng số 500/1000 chỉ còn trong named fallback constant + policy default.

## Risk Assessment
- Đổi công thức lương + nguồn kpiPartAmount là thay đổi tiền thật → test đối chứng submitted-không-tính + chưa-gán-tier bắt buộc; so sánh song song 1 kỳ số cũ/mới trước khi tin (chạy tay khi UAT).
- Ranh giới ngày dùng ICT (`ictDateOnlyOf`) nhất quán QĐ0025.
- Warning finalized chỉ là tín hiệu — chính sách hoàn phạt (reopen hay chấp nhận mất) là quyết định vận hành, ghi docs, không tự động hoá đợt này.
