---
phase: 5
title: "Payroll integration"
status: pending
priority: P1
dependencies: [2, 3, 4]
---

# Phase 5: Payroll integration

## Overview
Viết lại vòng lặp tính công trong `payslip.assemble`: mỗi ngày dùng
`computeDayAttendance`; validity theo trong-mạng/phiếu-approved; late/early
1 lần/ngày; phiếu approved = cặp giờ hợp lệ (thay cho "miễn cả ngày").

## Requirements
- Functional (per ngày ICT có ≥1 ca approved):
  - `dayValid` = (mọi punch ngày đó `withinNetwork=true`) OR (phiếu ngày đó
    `status='approved'`).
  - Nếu `dayValid`: gọi `computeDayAttendance(windows, dayPunches)`.
    - `present=true` → mọi ca ngày đó có công; cộng `lateMinutes`/`earlyMinutes`
      (day-level, 1 lần).
    - `present=false` (ngày <2 punch) → mọi ca ngày đó `unpunchedDays += n`.
  - Nếu `!dayValid` (offsite pending/rejected, hoặc không phiếu mà có offsite):
    mọi ca ngày đó `unpunchedDays += n` (không công, không phạt phút).
- Giữ: KpiScore confirmed|approved → kpiPartAmount; penalty rate policy/fallback;
  TOCTOU guard finalized; append-like payslip.
- Bỏ: nhánh "exemptDates = ticket approved → full credit bypass" CŨ (thay bằng
  logic dayValid + computeDayAttendance dùng cặp giờ thực).

## Architecture
- Bỏ import `assignPunchesToShifts`; import `computeDayAttendance`.
- Cần cờ `withinNetwork` per punch → query `timePunch.findMany` thêm field (đã có
  sau phase 1). Nhóm punch theo ngày như cũ nhưng giữ cả cờ để tính `allWithinNetwork`.
- Query phiếu ngày đó: `manualAttendanceTicket` status + ticketDate (đã có). Map
  `ticketByDate: dateKey → status`.
- **Red-team R2 — helper CHUNG payroll↔KPI:** tách `resolveDayCredit(...)` (đặt ở
  `apps/api/src/attendance/day-credit.ts`, dùng chung phase 5 + 6) để hai nơi
  KHÔNG lệch logic. Helper nhận: entries (windows) + dayPunches (kèm cờ withinNetwork)
  + ticket ngày đó → trả `{ present, lateMinutes, earlyMinutes, creditedShiftCount }`.
- Vòng lặp `for (dateKey, entries) of entriesByDate`:
  - dayPunches = punchesByDate.get(dateKey) ?? [] (kèm cờ withinNetwork per punch)
  - ticket = ticketByDate.get(dateKey)
  - allWithin = dayPunches.length>0 && mọi punch withinNetwork===true
  - **Nguồn cặp giờ (Red-team R1 — đóng băng):**
    - allWithin (ngày tin cậy, không phiếu) → cặp = mốc đầu/cuối của `dayPunches`.
    - !allWithin & ticket?.status==='approved' → cặp = **`ticket.checkInAt`/
      `ticket.checkOutAt`** (giờ ĐÃ DUYỆT/đóng băng — KHÔNG dùng punch live, chặn
      kéo dài công sau duyệt).
    - còn lại (offsite pending/rejected, hoặc offsite không phiếu) → `dayValid=false`.
  - if !dayValid → unpunchedDays += entries.length; continue.
  - result = computeDayAttendance({ shifts: windows, punches: <cặp giờ ở trên> })
  - **E3 — credit theo `result.creditedShiftIds`**: số ca có công =
    `result.creditedShiftIds.length`; ca đăng ký ngày đó KHÔNG nằm trong danh sách
    (bỏ hoàn toàn) → `unpunchedDays += (entries.length − creditedShiftIds.length)`.
  - if result.present → lateMinutes += result.lateMinutes; earlyMinutes += result.earlyMinutes.
  - else (không ca nào giao / thiếu checkout) → unpunchedDays += entries.length.
- **E1 — chặn sàn totalNet:** sửa `assembleSlip` (@cmc/domain-payroll): cap
  `penaltyAmount = min(penaltyRaw, baseSalary + kpiBonus)`; `totalNet = max(0,
  baseSalary + kpiBonus − penaltyAmount)`. Số hiển thị nhất quán (base+kpi−penalty=net≥0).
- `flaggedPunches`: **giữ** đếm punch ngày không có ca (display-only, không ảnh
  hưởng tiền) để tương thích cột `Payslip.flaggedPunches`.

## Related Code Files
- Create: `apps/api/src/attendance/day-credit.ts` (helper CHUNG, R2)
- Modify: `apps/api/src/payroll/router.ts` (`payslip.assemble` attendance loop)
- Modify: `packages/domain-payroll/src/assemble-slip.ts` (E1 floor totalNet=0 + cap penalty)
- Modify: `packages/domain-payroll/src/assemble-slip.test.ts` (E1 cases)
- Modify: `apps/api/src/payroll/*.test.ts` (policy-rates, penalty-posttax,
  manual-ticket-exemption → đổi ngữ nghĩa exemption sang cặp-giờ-hợp-lệ)

## TDD Test Plan (test-first)
Đổi/thêm test golden payroll:
1. Ngày trong mạng, đúng giờ (checkin trước, checkout sau) → 0 phạt, ca có công.
2. Ngày trong mạng, muộn 30' → penalty = 30×rateLate (1 lần/ngày, KHÔNG ×số ca).
3. Ngày nhiều ca, khung ngoài cùng: muộn tính theo ca sớm nhất, sớm theo ca muộn nhất.
4. Ngày <2 punch → ca unpunched, không phạt phút.
5. Ngày offsite phiếu `pending` → không công (unpunched), dù có 2 punch.
6. Ngày offsite phiếu `approved` → dùng **giờ đóng băng trên phiếu**, tính công + muộn/sớm.
7. Ngày offsite phiếu `rejected` → unpunched.
7b. **R1 fraud**: phiếu `approved` (checkout 17:00) + punch offsite mới 19:00 cùng
    ngày → payroll VẪN dùng 17:00 (đóng băng), KHÔNG 19:00.
7c. **E3**: ngày ca sáng 09-11 + chiều 14-16, checkin 13:50 checkout 16:10 → chỉ
    ca chiều credited (unpunchedDays += 1 cho ca sáng), late=0 (vs 14:00).
7d. **E1 floor**: phạt raw > base+kpi → penaltyAmount cap = base+kpi, totalNet=0
    (không âm).
8. Reassemble idempotent; TOCTOU finalized guard giữ (P2025 → BAD_REQUEST).
9. Ngày không ca nhưng có punch → flaggedPunches += n, không phạt (display-only).
10. Fallback rate 500/1000 khi không có CompensationPolicy; override rate khi có.

## Implementation Steps
1. RED: cập nhật/thêm test 1-10 (đổi `manual-ticket-exemption.test.ts` từ
   "full credit bypass" sang "approved = cặp giờ hợp lệ").
2. GREEN: viết lại vòng lặp assemble.
3. `pnpm --filter @cmc/api test -- payroll` xanh; `pnpm typecheck` xanh (mất
   assignPunchesToShifts đã được thay).

## Success Criteria
- [ ] Muộn/sớm 1 lần/ngày theo khung ngoài cùng của ca ĐƯỢC TÍNH; không ×số ca.
- [ ] E3: chỉ credit ca giao cặp vào/ra; ca bỏ → unpunched, không kéo khung.
- [ ] E1: totalNet sàn 0, penaltyAmount cap = base+kpi.
- [ ] dayValid = mọi punch trong mạng OR phiếu approved (dùng giờ đóng băng); else unpunched.
- [ ] Helper `resolveDayCredit`/`computeDayAttendance` dùng chung với KPI (R2).
- [ ] TOCTOU + fallback rate giữ nguyên.
- [ ] 12 case TDD xanh (gồm E1/E3).

## Risk Assessment
- **Rủi ro:** đổi ngữ nghĩa exemption làm lệch số lương so kỳ trước. Mitigation:
  greenfield chưa go-live; golden test khóa số mới; ghi Validation Log.
- **Rủi ro:** `allWithin` sai khi ngày có 0 punch (dayPunches rỗng). Mitigation:
  entries có nhưng punch rỗng → present=false → unpunched (đúng). allWithin phải
  yêu cầu length>0.
