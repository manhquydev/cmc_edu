---
phase: 2
title: "Domain core computeDayAttendance"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Domain core computeDayAttendance

## Overview
Thay hàm thuần `assignPunchesToShifts` (ghép ±2h per-ca + shortSpan) bằng
`computeDayAttendance` (cặp vào/ra mỗi ngày, muộn/sớm khung ngoài cùng, 1 lần/ngày).
Đây là lõi — TDD kỹ nhất, không chạm DB.

## Requirements
- Functional: nhận danh sách ca (windows) + danh sách punch của MỘT ngày → trả
  present (day-level), checkInAt, checkOutAt, lateMinutes, earlyMinutes.
- Non-functional: thuần (no DB), deterministic, không mutate input.

## Architecture
Chữ ký mới trong `packages/domain-payroll/src/`:
```ts
export interface DayAttendanceInput { shifts: readonly ShiftWindow[]; punches: readonly Date[]; }
export interface DayAttendanceResult {
  present: boolean;          // true ⇔ có ≥2 punch AND có ≥1 ca GIAO với cặp
  checkInAt: Date | null;    // punch đầu (null nếu 0 punch)
  checkOutAt: Date | null;   // punch cuối (null nếu <2 punch)
  creditedShiftIds: string[];// id các ca có khung GIAO [checkin,checkout] (E3)
  lateMinutes: number;       // max(0, checkIn − start ca-được-tính sớm nhất), 1 lần/ngày
  earlyMinutes: number;      // max(0, end ca-được-tính muộn nhất − checkOut), 1 lần/ngày
}
export function computeDayAttendance(input: DayAttendanceInput): DayAttendanceResult;
```
Logic:
- `punches` sort asc. checkIn = punches[0] ?? null; checkOut = punches.length ≥ 2 ? punches[last] : null.
- Nếu checkOut === null (0 hoặc 1 punch) → present=false, creditedShiftIds=[], late=early=0
  (giữ checkInAt để caller lưu lịch sử minh bạch).
- **creditedShiftIds (E3):** ca có `start < checkOut && end > checkIn` (giao thực sự).
- present = `creditedShiftIds.length > 0`.
- Nếu !present → late=early=0.
- Nếu present: credited = các ShiftWindow được tính; earliestStart = min(credited.start);
  latestEnd = max(credited.end); late = max(0, round((checkIn−earliestStart)/60000));
  early = max(0, round((latestEnd−checkOut)/60000)). **Ca KHÔNG được tính không kéo khung.**
- **Validity (trong mạng / phiếu duyệt) KHÔNG thuộc hàm này** — caller (payroll/kpi)
  quyết định có gọi credit hay coi vắng. Hàm chỉ ghép giờ + overlap + tính phút.

Xử lý `assignPunchesToShifts` cũ + `shortSpan`:
- Xóa `assignPunchesToShifts`, `ShiftAttendanceOutcome.shortSpan`, `AssignPunchesResult`.
- Cập nhật `packages/domain-payroll/src/index.ts` exports: bỏ `assignPunchesToShifts`,
  `AssignPunchesResult`, `ShiftAttendanceOutcome`; thêm `computeDayAttendance`,
  `DayAttendanceInput`, `DayAttendanceResult`. Giữ `ShiftWindow`.

## Related Code Files
- Create: `packages/domain-payroll/src/day-attendance.ts`
- Create: `packages/domain-payroll/src/day-attendance.test.ts`
- Delete: `packages/domain-payroll/src/shift-attendance.ts` + `shift-attendance.test.ts`
- Modify: `packages/domain-payroll/src/index.ts` (exports)

## TDD Test Plan (test-first)
`day-attendance.test.ts` — viết TRƯỚC, đỏ trước khi có impl:
1. Đúng giờ: checkin trước giờ ca sớm nhất, checkout sau giờ ca muộn nhất → present, late=0, early=0.
2. Muộn: checkin sau giờ ca sớm nhất X phút → lateMinutes=X.
3. Sớm: checkout trước giờ ca muộn nhất Y phút → earlyMinutes=Y.
4. Nhiều ca cách quãng (ca sáng 09-11, chiều 14-16), checkin 08:50 checkout 16:10
   → cả 2 ca giao → creditedShiftIds=[cả 2], late=0 (vs 09:00), early=0 (vs 16:00).
5. Nhiều ca, checkin trong ca sớm, checkout trong ca muộn → cả 2 credited, late>0 & early>0.
6. **E3 — ca bỏ hoàn toàn**: ca sáng 09-11 + chiều 14-16, checkin 13:50 checkout 16:10
   → chỉ ca chiều credited (ca sáng không giao); earliestStart=14:00 → late=0, early=0;
   creditedShiftIds=[chiều]. Ca sáng KHÔNG công, KHÔNG kéo khung phạt.
7. **E3 — cặp không giao ca nào**: checkin/checkout lệch hẳn mọi khung → creditedShiftIds=[],
   present=false.
8. Ngày 1 punch → present=false, checkInAt=punch, checkOutAt=null, creditedShiftIds=[].
9. Ngày 0 punch → present=false, checkInAt=null, checkOutAt=null.
10. shifts rỗng → present=false, checkInAt vẫn set (lịch sử).
11. Overlap ranh giới: checkin == ca.end (đến đúng lúc ca vừa hết) → end>checkin false →
    KHÔNG giao → ca không credited (chốt biên strict).
12. Không mutate mảng input.

## Implementation Steps
1. RED: viết `day-attendance.test.ts` với 10 case trên.
2. GREEN: viết `computeDayAttendance` trong `day-attendance.ts`.
3. Xóa `shift-attendance.ts`/`.test.ts`, cập nhật `index.ts`.
4. `pnpm --filter @cmc/domain-payroll test` xanh; `pnpm typecheck` (sẽ đỏ ở
   payroll/kpi router vì mất export cũ — sẽ sửa ở phase 5/6; chấp nhận đỏ tạm ở
   package khác, hoặc tạm giữ `assignPunchesToShifts` re-export deprecated tới khi
   phase 5/6 xong rồi mới xóa — chọn cách xóa dứt điểm và sửa ngay 5/6).

## Success Criteria
- [ ] `computeDayAttendance` pass 12 case TDD (gồm E3 overlap + biên).
- [ ] Trả `creditedShiftIds`; ca không giao → không credited, không kéo khung phạt.
- [ ] Không còn `assignPunchesToShifts`/`shortSpan` trong package.
- [ ] `index.ts` export đúng bộ mới.
- [ ] Hàm thuần, không mutate input.

## Risk Assessment
- **Rủi ro:** xóa export cũ làm payroll/kpi router đỏ typecheck giữa chừng.
  Mitigation: làm phase 2 → 5 → 6 liền mạch trong cùng nhánh; không merge giữa chừng.
- **Rủi ro:** làm tròn phút (round) khác cách cũ gây lệch 1 phút ở ranh giới.
  Mitigation: test case 2/3 chốt công thức round rõ ràng.
