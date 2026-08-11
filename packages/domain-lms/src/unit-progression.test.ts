import { describe, expect, it } from 'vitest';
import {
  deriveSessionUnits,
  enrollmentCoversSession,
  isEntitled,
  remainingUnits,
  validateNewRange,
  type OrderedSession,
} from './unit-progression.js';

/** Dựng dãy buổi 1 buổi/tuần từ ngày đầu, giờ cố định — chỉ cần thứ tự đúng. */
function weekly(count: number, startDay = 1): OrderedSession[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    sessionDate: new Date(Date.UTC(2026, 8, startDay + i * 7)),
    startTime: '18:00',
  }));
}
const orders = (stamps: { order: number }[]) => stamps.map((s) => s.order);

describe('deriveSessionUnits — unit nhảy theo 4 buổi hợp lệ', () => {
  it('buổi 1-4 = anchorOrder, buổi 5-8 = +1, buổi 9 = +2', () => {
    const out = deriveSessionUnits(3, 36, weekly(9));
    expect(orders(out)).toEqual([3, 3, 3, 3, 4, 4, 4, 4, 5]);
  });

  it('"lùi buổi": bỏ 1 buổi khỏi dãy hợp lệ → buổi kế thừa vị trí, unit lùi', () => {
    // Đầy đủ 8 buổi: buổi 5 lẽ ra là unit 4. Nếu buổi 3 bị hủy (không nằm trong
    // dãy non-cancelled truyền vào), 7 buổi còn lại: buổi-lịch-thứ-5 giờ ở index 3
    // → vẫn unit 3, đúng "đủ 4 buổi hợp lệ mới nhảy".
    const full = weekly(8);
    const withoutThird = full.filter((s) => s.id !== 's3');
    // 7 buổi còn lại: index 0-3 → unit 3, index 4-6 → unit 4. Buổi-lịch-thứ-5 (s5)
    // tụt từ index 4 xuống index 3 → unit 4 → 3, đúng "lùi buổi".
    expect(orders(deriveSessionUnits(3, 36, withoutThird))).toEqual([3, 3, 3, 3, 4, 4, 4]);
  });

  it('kẹp tại trần khung + đánh dấu capped cho buổi vượt', () => {
    const out = deriveSessionUnits(35, 36, weekly(12)); // 35,35,35,35,36,36,36,36,37→cap...
    expect(orders(out)).toEqual([35, 35, 35, 35, 36, 36, 36, 36, 36, 36, 36, 36]);
    expect(out.slice(0, 8).every((s) => !s.capped)).toBe(true);
    expect(out.slice(8).every((s) => s.capped)).toBe(true);
  });

  it('tự sắp theo (ngày, giờ) — input xáo trộn vẫn đúng', () => {
    const shuffled = [weekly(5)[4]!, weekly(5)[0]!, weekly(5)[2]!, weekly(5)[1]!, weekly(5)[3]!];
    expect(orders(deriveSessionUnits(1, 36, shuffled))).toEqual([1, 1, 1, 1, 2]);
  });

  it('cùng ngày, khác giờ bắt đầu → giờ sớm hơn đếm trước', () => {
    const sameDay: OrderedSession[] = [
      { id: 'pm', sessionDate: new Date(Date.UTC(2026, 8, 1)), startTime: '18:00' },
      { id: 'am', sessionDate: new Date(Date.UTC(2026, 8, 1)), startTime: '09:00' },
    ];
    expect(deriveSessionUnits(1, 36, sameDay).map((s) => s.id)).toEqual(['am', 'pm']);
  });

  it('dãy rỗng → không có gì', () => {
    expect(deriveSessionUnits(1, 36, [])).toEqual([]);
  });
});

describe('quyền unit của HS (EnrollmentUnitRange)', () => {
  const ranges = [
    { fromOrderGlobal: 4, toOrderGlobal: 7 },
    { fromOrderGlobal: 10, toOrderGlobal: 11 }, // add lại sau khi nghỉ 2 tháng — được phép hở
  ];
  it('trong dãy → hiện roster; ngoài dãy/khe hở → ẩn', () => {
    expect(isEntitled(ranges, 4)).toBe(true);
    expect(isEntitled(ranges, 7)).toBe(true);
    expect(isEntitled(ranges, 8)).toBe(false);
    expect(isEntitled(ranges, 10)).toBe(true);
    expect(isEntitled(ranges, 12)).toBe(false);
  });
  it('remainingUnits đếm từ unit hiện tại, cộng cả đợt tương lai', () => {
    expect(remainingUnits(ranges, 6)).toBe(4); // 6,7 + 10,11
    expect(remainingUnits(ranges, 8)).toBe(2); // chỉ còn 10,11
    expect(remainingUnits(ranges, 12)).toBe(0); // hết quyền
  });
  it('cảnh báo "sắp hết unit" khi còn <= 1', () => {
    expect(remainingUnits([{ fromOrderGlobal: 4, toOrderGlobal: 7 }], 7)).toBe(1);
  });
  it('dãy chồng nhau (chỉ tạo được qua ghi trực tiếp/migrate) đếm theo TẬP order, không cộng dồn đôi', () => {
    expect(remainingUnits([{ fromOrderGlobal: 1, toOrderGlobal: 8 }, { fromOrderGlobal: 5, toOrderGlobal: 8 }], 5)).toBe(4);
  });
  it('hết quyền hoàn toàn (dãy nằm trước current) = 0', () => {
    expect(remainingUnits([{ fromOrderGlobal: 1, toOrderGlobal: 3 }], 5)).toBe(0);
  });
  it('dãy rời qua khe hở KHÔNG bị merge thành dải liên tục', () => {
    expect(remainingUnits([{ fromOrderGlobal: 1, toOrderGlobal: 2 }, { fromOrderGlobal: 5, toOrderGlobal: 6 }], 1)).toBe(4);
  });
});

describe('enrollmentCoversSession — mốc gỡ so theo NGÀY', () => {
  it('chưa gỡ (null) → luôn còn thuộc lớp', () => {
    expect(enrollmentCoversSession(null, new Date(Date.UTC(2026, 7, 20)))).toBe(true);
  });
  it('buổi TRƯỚC mốc gỡ → còn thuộc lớp', () => {
    expect(enrollmentCoversSession(new Date(Date.UTC(2026, 7, 20)), new Date(Date.UTC(2026, 7, 15)))).toBe(true);
  });
  it('buổi CÙNG NGÀY mốc gỡ → còn thuộc lớp (Q1: gỡ có hiệu lực từ hôm sau)', () => {
    expect(enrollmentCoversSession(new Date(Date.UTC(2026, 7, 20)), new Date(Date.UTC(2026, 7, 20)))).toBe(true);
  });
  it('buổi SAU mốc gỡ → không còn thuộc lớp', () => {
    expect(enrollmentCoversSession(new Date(Date.UTC(2026, 7, 20)), new Date(Date.UTC(2026, 7, 21)))).toBe(false);
  });
});

describe('validateNewRange khi add HS', () => {
  it('bắt đầu từ unit hiện tại hoặc tương lai đều hợp lệ', () => {
    expect(validateNewRange({ fromOrderGlobal: 5, toOrderGlobal: 8 }, 5)).toEqual({ ok: true });
    expect(validateNewRange({ fromOrderGlobal: 6, toOrderGlobal: 8 }, 5)).toEqual({ ok: true });
  });
  it('không được cấp unit đã qua', () => {
    expect(validateNewRange({ fromOrderGlobal: 4, toOrderGlobal: 8 }, 5)).toEqual({
      ok: false,
      reason: 'starts_in_past',
    });
  });
  it('dãy ngược bị chặn', () => {
    expect(validateNewRange({ fromOrderGlobal: 8, toOrderGlobal: 5 }, 5)).toEqual({
      ok: false,
      reason: 'inverted',
    });
  });
});
