---
phase: 6
title: "KPI integration"
status: pending
priority: P1
dependencies: [2, 3, 4, 5]
---

# Phase 6: KPI integration

## Overview
Viết lại `collectActualShifts` theo mô hình ngày: `shiftActual` = số ca đăng ký
approved trên các ngày có cặp vào/ra HỢP LỆ (trong mạng hoặc phiếu approved). Bỏ
`shortSpanShifts`.

## Requirements
- Functional:
  - shiftActual = Σ **`creditedShiftIds.length`** trên các ngày `dayValid` (E3 —
    chỉ đếm ca GIAO cặp vào/ra, KHÔNG đếm ca bỏ hoàn toàn). Phải khớp số ca payroll
    tính công (dùng chung `computeDayAttendance`/`resolveDayCredit`).
  - dayValid giống payroll: mọi punch trong mạng OR phiếu approved (giờ đóng băng).
  - Ngày <2 punch → 0. Ngày offsite pending/rejected → 0. Ca không giao → không đếm.
  - Bỏ `shortSpanShifts` khỏi kết quả + snapshot + refreshKpiScore result type.
- Giữ: DISTINCT (date, templateId) collapse (R3-8); computeKpiValue nhân %ca; role
  gate; không ghi đè non-draft.

## Architecture
- `collectActualShifts` trả `{ shiftActual: number }` (bỏ `shortSpanShifts`).
- **Red-team R2 — DÙNG CHUNG `resolveDayCredit` với payroll** (`apps/api/src/
  attendance/day-credit.ts`, tạo ở phase 5). KPI phải cho ra `present`/validity
  GIỐNG HỆT payroll để shiftActual không lệch số công payroll dùng. Nếu present →
  cộng `byTemplate.size` (số ca distinct ngày đó).
- **R1 đóng băng:** ngày offsite-approved → dùng `ticket.checkInAt/checkOutAt`, KHÔNG
  punch live (giống payroll).
- `RefreshKpiScoreResult`: bỏ `shortSpanShifts`. Sửa callers (`kpi/router.ts`
  refresh) + UI nếu có surface `shortSpanShifts`.
- `CollectActualShiftsResult` type bỏ field.

## Related Code Files
- Modify: `apps/api/src/kpi/auto-score.ts` (`collectActualShifts`, `refreshKpiScore`
  result, types)
- Modify: `apps/api/src/kpi/auto-score.test.ts`
- Modify: callers dùng `shortSpanShifts` (grep: `kpi/router.ts`, có thể my-hr UI)

## TDD Test Plan (test-first)
1. Ngày trong mạng, 2 punch, 1 ca → shiftActual=1.
2. Ngày trong mạng nhiều ca (distinct template) → shiftActual = số ca.
3. Ngày <2 punch → 0.
4. Ngày offsite pending → 0; offsite approved → tính đủ.
5. Đăng ký trùng (date,template) → collapse, không double count.
6. Đăng ký không chấm (0 punch) → 0.
7. Kết quả không còn field `shortSpanShifts` (type + runtime).
8. computeKpiValue: shiftActual/shiftRequired là hệ số nhân (0 ca → value 0).
9. **E3**: ngày 2 ca, cặp chỉ giao 1 ca → shiftActual += 1 (không phải 2); khớp
   số ca payroll credit cùng ngày.

## Implementation Steps
1. RED: cập nhật `auto-score.test.ts` (bỏ case shortSpan; thêm case offsite/validity).
2. GREEN: viết lại `collectActualShifts`; bỏ shortSpan khắp nơi; sửa callers.
3. `pnpm --filter @cmc/api test -- kpi` xanh; typecheck xanh.

## Success Criteria
- [ ] shiftActual theo ngày hợp lệ + present; offsite pending/rejected = 0.
- [ ] `shortSpanShifts` bị bỏ hoàn toàn (type, snapshot, callers, UI).
- [ ] DISTINCT collapse giữ; KPI value nhân %ca giữ.
- [ ] 8 case TDD xanh.

## Risk Assessment
- **Rủi ro:** duplication logic dayValid giữa payroll + kpi (đã là nợ kỹ thuật
  trước đây). Mitigation: cân nhắc helper chung trong `@cmc/domain-payroll` hoặc
  `apps/api/src/*/attendance-validity.ts` — Red Team sẽ chốt DRY-vs-KISS.
- **Rủi ro:** bỏ `shortSpanShifts` phá UI my-hr nếu đang hiển thị. Mitigation:
  grep + gỡ ở phase 6 hoặc 7.
