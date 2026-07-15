// computeDayAttendance unit tests (ADR 0043 — daily in/out pairing,
// plans/260713-1706-attendance-daily-inout-pairing/phase-02).

import { describe, expect, it } from 'vitest';
import { computeDayAttendance, type ShiftWindow } from './day-attendance.js';

function at(hhmm: string, day = '2099-06-10'): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
}

const MORNING: ShiftWindow = { id: 'ca-sang', start: at('09:00'), end: at('11:00') };
const AFTERNOON: ShiftWindow = { id: 'ca-chieu', start: at('14:00'), end: at('16:00') };
const SALE_SHIFT: ShiftWindow = { id: 'sale-1', start: at('08:30'), end: at('18:00') };

describe('computeDayAttendance', () => {
  it('1. on-time: checkin before earliest start, checkout after latest end → no late/early', () => {
    const result = computeDayAttendance({ shifts: [SALE_SHIFT], punches: [at('08:30'), at('18:00')] });
    expect(result).toMatchObject({
      present: true,
      lateMinutes: 0,
      earlyMinutes: 0,
      creditedShiftIds: ['sale-1'],
    });
  });

  it('2. late checkin → lateMinutes = checkin − earliestStart', () => {
    const result = computeDayAttendance({ shifts: [SALE_SHIFT], punches: [at('08:45'), at('18:00')] });
    expect(result.lateMinutes).toBe(15);
    expect(result.earlyMinutes).toBe(0);
  });

  it('3. early checkout → earlyMinutes = latestEnd − checkout', () => {
    const result = computeDayAttendance({ shifts: [SALE_SHIFT], punches: [at('08:30'), at('17:30')] });
    expect(result.earlyMinutes).toBe(30);
    expect(result.lateMinutes).toBe(0);
  });

  it('4. nhiều ca cách quãng, cặp bao trùm cả 2 → cả 2 credited, no late/early', () => {
    const result = computeDayAttendance({
      shifts: [MORNING, AFTERNOON],
      punches: [at('08:50'), at('16:10')],
    });
    expect(result.present).toBe(true);
    expect(result.creditedShiftIds.sort()).toEqual(['ca-chieu', 'ca-sang']);
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyMinutes).toBe(0);
  });

  it('5. nhiều ca, checkin trong ca sớm & checkout trong ca muộn → cả 2 credited, late>0 & early>0', () => {
    // checkin 09:30 (30' sau khi ca sáng bắt đầu 09:00) → late so với earliestStart=09:00.
    // checkout 15:30 (30' trước khi ca chiều kết thúc 16:00) → early so với latestEnd=16:00.
    // Overlap check: [09:30,15:30] giao ca sáng [09:00,11:00]? 09:00<15:30 && 11:00>09:30 → yes.
    // Giao ca chiều [14:00,16:00]? 14:00<15:30 && 16:00>09:30 → yes.
    const result = computeDayAttendance({
      shifts: [MORNING, AFTERNOON],
      punches: [at('09:30'), at('15:30')],
    });
    expect(result.creditedShiftIds.sort()).toEqual(['ca-chieu', 'ca-sang']);
    expect(result.lateMinutes).toBe(30);
    expect(result.earlyMinutes).toBe(30);
  });

  it('6. E3 — ca bỏ hoàn toàn: checkin sau khi ca sáng đã hết → chỉ ca chiều credited, khung theo ca chiều', () => {
    // checkin 13:50, checkout 16:10. Ca sáng [09:00,11:00]: giao? 09:00<16:10 && 11:00>13:50 → FALSE (11:00 < 13:50).
    // Ca chiều [14:00,16:00]: giao? 14:00<16:10 && 16:00>13:50 → true.
    const result = computeDayAttendance({
      shifts: [MORNING, AFTERNOON],
      punches: [at('13:50'), at('16:10')],
    });
    expect(result.present).toBe(true);
    expect(result.creditedShiftIds).toEqual(['ca-chieu']);
    // earliestStart/latestEnd chỉ tính trên ca ĐƯỢC credit (ca chiều 14:00-16:00).
    expect(result.lateMinutes).toBe(0); // checkin 13:50 trước 14:00 → không muộn.
    expect(result.earlyMinutes).toBe(0); // checkout 16:10 sau 16:00 → không sớm.
  });

  it('7. E3 — cặp không giao ca nào → creditedShiftIds rỗng, present=false', () => {
    // Cặp [06:00, 07:00] không giao ca sáng [09:00,11:00] hay ca chiều [14:00,16:00].
    const result = computeDayAttendance({
      shifts: [MORNING, AFTERNOON],
      punches: [at('06:00'), at('07:00')],
    });
    expect(result.present).toBe(false);
    expect(result.creditedShiftIds).toEqual([]);
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyMinutes).toBe(0);
  });

  it('8. ngày 1 punch → present=false, checkInAt=punch, checkOutAt=null, creditedShiftIds=[]', () => {
    const result = computeDayAttendance({ shifts: [SALE_SHIFT], punches: [at('08:30')] });
    expect(result.present).toBe(false);
    expect(result.checkInAt?.getTime()).toBe(at('08:30').getTime());
    expect(result.checkOutAt).toBeNull();
    expect(result.creditedShiftIds).toEqual([]);
  });

  it('9. ngày 0 punch → present=false, checkInAt=null, checkOutAt=null', () => {
    const result = computeDayAttendance({ shifts: [SALE_SHIFT], punches: [] });
    expect(result.present).toBe(false);
    expect(result.checkInAt).toBeNull();
    expect(result.checkOutAt).toBeNull();
  });

  it('10. shifts rỗng → present=false, checkInAt vẫn set (lịch sử)', () => {
    const result = computeDayAttendance({ shifts: [], punches: [at('08:30'), at('18:00')] });
    expect(result.present).toBe(false);
    expect(result.checkInAt?.getTime()).toBe(at('08:30').getTime());
    expect(result.checkOutAt?.getTime()).toBe(at('18:00').getTime());
    expect(result.creditedShiftIds).toEqual([]);
  });

  it('11. overlap ranh giới: checkin đúng bằng giờ ca hết → strict, KHÔNG giao', () => {
    // Cặp [11:00, 12:00]: ca sáng end=11:00. overlap ⇔ start<checkout && end>checkin
    // → 09:00<12:00 (true) && 11:00>11:00 (false) → không giao.
    const result = computeDayAttendance({ shifts: [MORNING], punches: [at('11:00'), at('12:00')] });
    expect(result.present).toBe(false);
    expect(result.creditedShiftIds).toEqual([]);
  });

  it('12. không mutate input arrays', () => {
    const shifts = [SALE_SHIFT];
    const punches = [at('18:00'), at('08:30')]; // unsorted on purpose
    const shiftsCopy = [...shifts];
    const punchesCopy = [...punches];
    computeDayAttendance({ shifts, punches });
    expect(shifts).toEqual(shiftsCopy);
    expect(punches).toEqual(punchesCopy);
  });

  it('unsorted punches: still picks earliest as checkin, latest as checkout', () => {
    const result = computeDayAttendance({ shifts: [SALE_SHIFT], punches: [at('18:00'), at('08:30')] });
    expect(result.checkInAt?.getTime()).toBe(at('08:30').getTime());
    expect(result.checkOutAt?.getTime()).toBe(at('18:00').getTime());
  });
});
