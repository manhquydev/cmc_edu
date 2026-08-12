import { describe, expect, it } from 'vitest';
import {
  axisIndexOf,
  contiguousProgramAxis,
  deriveSessionUnits,
  enrollmentCoversSession,
  isEntitled,
  nextOrderOnAxis,
  previousOrderOnAxis,
  rangeEndpointsOnAxis,
  remainingUnits,
  resolveReferenceAnchor,
  realOrdersInRange,
  toProgramUnitAxis,
  validateNewRange,
  type OrderedSession,
  type ProgramUnitAxis,
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

/** Continuous UCREA-like axis 1–36 used by legacy contiguous cases. */
const UCREA = contiguousProgramAxis(1, 36);

/**
 * Bright I.G real framework spine: 37–59 missing 40, 44, 48, 52, 56 → 18 units.
 * Matches packages/db CSV after group-by (order_global gaps intentional).
 */
const BRIGHT_IG_GAPS = new Set([40, 44, 48, 52, 56]);
const BRIGHT_IG: ProgramUnitAxis = toProgramUnitAxis(
  Array.from({ length: 59 - 37 + 1 }, (_, i) => 37 + i).filter((o) => !BRIGHT_IG_GAPS.has(o)),
);

describe('deriveSessionUnits — unit nhảy theo 4 buổi hợp lệ', () => {
  it('buổi 1-4 = anchorOrder, buổi 5-8 = +1, buổi 9 = +2 (trục liên tục)', () => {
    const out = deriveSessionUnits(3, UCREA, weekly(9));
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
    expect(orders(deriveSessionUnits(3, UCREA, withoutThird))).toEqual([3, 3, 3, 3, 4, 4, 4]);
  });

  it('kẹp tại trần khung + đánh dấu capped cho buổi vượt', () => {
    const out = deriveSessionUnits(35, UCREA, weekly(12)); // 35,35,35,35,36,36,36,36,37→cap...
    expect(orders(out)).toEqual([35, 35, 35, 35, 36, 36, 36, 36, 36, 36, 36, 36]);
    expect(out.slice(0, 8).every((s) => !s.capped)).toBe(true);
    expect(out.slice(8).every((s) => s.capped)).toBe(true);
  });

  it('tự sắp theo (ngày, giờ) — input xáo trộn vẫn đúng', () => {
    const shuffled = [weekly(5)[4]!, weekly(5)[0]!, weekly(5)[2]!, weekly(5)[1]!, weekly(5)[3]!];
    expect(orders(deriveSessionUnits(1, UCREA, shuffled))).toEqual([1, 1, 1, 1, 2]);
  });

  it('cùng ngày, khác giờ bắt đầu → giờ sớm hơn đếm trước', () => {
    const sameDay: OrderedSession[] = [
      { id: 'pm', sessionDate: new Date(Date.UTC(2026, 8, 1)), startTime: '18:00' },
      { id: 'am', sessionDate: new Date(Date.UTC(2026, 8, 1)), startTime: '09:00' },
    ];
    expect(deriveSessionUnits(1, UCREA, sameDay).map((s) => s.id)).toEqual(['am', 'pm']);
  });

  it('dãy rỗng → không có gì', () => {
    expect(deriveSessionUnits(1, UCREA, [])).toEqual([]);
  });
});

describe('deriveSessionUnits — Bright I.G có lỗ hổng thật (37–59 thiếu 40/44/48/52/56)', () => {
  it('trục Bright I.G có đúng 18 unit và không chứa các nhãn lỗ', () => {
    expect(BRIGHT_IG).toHaveLength(18);
    for (const gap of BRIGHT_IG_GAPS) {
      expect(BRIGHT_IG.includes(gap)).toBe(false);
    }
    expect(BRIGHT_IG[0]).toBe(37);
    expect(BRIGHT_IG[3]).toBe(41); // after 37,38,39 — skip 40
  });

  it('lớp neo unit 37: buổi 13–16 ra unit 41 (không phải 40)', () => {
    // Buổi 1–4 → 37, 5–8 → 38, 9–12 → 39, 13–16 → 41 (bước 4 trên trục, nhảy lỗ 40).
    const out = deriveSessionUnits(37, BRIGHT_IG, weekly(16));
    expect(orders(out).slice(0, 12)).toEqual([
      37, 37, 37, 37, 38, 38, 38, 38, 39, 39, 39, 39,
    ]);
    expect(orders(out).slice(12, 16)).toEqual([41, 41, 41, 41]);
    expect(out.slice(12, 16).every((s) => !s.capped)).toBe(true);
    // Continuous arithmetic would have produced 40 — prove we did not.
    expect(orders(out)).not.toContain(40);
  });

  it('sau unit 39 (gần lỗ 40) buổi kế nhảy thẳng 41', () => {
    const out = deriveSessionUnits(39, BRIGHT_IG, weekly(8));
    expect(orders(out)).toEqual([39, 39, 39, 39, 41, 41, 41, 41]);
  });

  it('neo sau lỗ (41): 16 buổi → 41,42,43,45 — không ra 44', () => {
    // S1.3: progression is list-index only.
    const out = deriveSessionUnits(41, BRIGHT_IG, weekly(16));
    expect([...new Set(orders(out))]).toEqual([41, 42, 43, 45]);
    expect(orders(out)).not.toContain(44);
  });

  it('neo unit cuối 59 + buổi thừa → kẹp 59, capped, không nhảy 60/61', () => {
    // S2.1 / S2.2: surplus after last real unit clamps; never invent cross-program labels.
    const out = deriveSessionUnits(59, BRIGHT_IG, weekly(12));
    expect(orders(out)).toEqual(Array(12).fill(59));
    expect(out.slice(0, 4).every((s) => !s.capped)).toBe(true);
    expect(out.slice(4).every((s) => s.capped)).toBe(true);
    expect(orders(out)).not.toContain(60);
    expect(orders(out)).not.toContain(61);
  });

  it('neo 57 + 12 buổi: 57×4, 58×4, 59×4 rồi kẹp — không 60', () => {
    const out = deriveSessionUnits(57, BRIGHT_IG, weekly(16));
    expect(orders(out).slice(0, 12)).toEqual([
      57, 57, 57, 57, 58, 58, 58, 58, 59, 59, 59, 59,
    ]);
    expect(orders(out).slice(12)).toEqual([59, 59, 59, 59]);
    expect(out.slice(12).every((s) => s.capped)).toBe(true);
  });

  it('trục chỉ 1 unit: mọi buổi stamp unit đó; buổi >4 đều capped', () => {
    // S10.1
    const one = toProgramUnitAxis([5]);
    const out = deriveSessionUnits(5, one, weekly(8));
    expect(orders(out)).toEqual([5, 5, 5, 5, 5, 5, 5, 5]);
    expect(out.slice(0, 4).every((s) => !s.capped)).toBe(true);
    expect(out.slice(4).every((s) => s.capped)).toBe(true);
  });

  it('trục rỗng → throw (không stamp null im lặng)', () => {
    expect(() => deriveSessionUnits(1, [], weekly(1))).toThrow(/programUnitAxis is empty/);
  });

  it('neo không có trên trục → throw (orphan / sai chương trình)', () => {
    // S1.4 domain surface: pure layer refuses; API maps to BAD_REQUEST.
    expect(() => deriveSessionUnits(40, BRIGHT_IG, weekly(1))).toThrow(
      /anchorOrderGlobal 40 is not on programUnitAxis/,
    );
    expect(() => deriveSessionUnits(1, BRIGHT_IG, weekly(1))).toThrow(
      /anchorOrderGlobal 1 is not on programUnitAxis/,
    );
  });
});

describe('program axis helpers', () => {
  it('toProgramUnitAxis sort + unique', () => {
    expect(toProgramUnitAxis([39, 37, 37, 41])).toEqual([37, 39, 41]);
    expect(toProgramUnitAxis([])).toEqual([]);
  });

  it('contiguousProgramAxis empty when from > to', () => {
    expect(contiguousProgramAxis(5, 3)).toEqual([]);
    expect(contiguousProgramAxis(3, 5)).toEqual([3, 4, 5]);
  });

  it('nextOrderOnAxis / previousOrderOnAxis skip holes', () => {
    expect(nextOrderOnAxis(BRIGHT_IG, 39)).toBe(41);
    expect(nextOrderOnAxis(BRIGHT_IG, 40)).toBe(41); // after a hole label
    expect(nextOrderOnAxis(BRIGHT_IG, 59)).toBeNull();
    expect(previousOrderOnAxis(BRIGHT_IG, 41)).toBe(39);
    expect(previousOrderOnAxis(BRIGHT_IG, 40)).toBe(39);
    expect(previousOrderOnAxis(BRIGHT_IG, 37)).toBeNull();
    expect(axisIndexOf(BRIGHT_IG, 41)).toBe(3);
    expect(axisIndexOf(BRIGHT_IG, 40)).toBe(-1);
  });

  it('rangeEndpointsOnAxis requires both endpoints real', () => {
    expect(rangeEndpointsOnAxis({ fromOrderGlobal: 37, toOrderGlobal: 41 }, BRIGHT_IG)).toBe(true);
    expect(rangeEndpointsOnAxis({ fromOrderGlobal: 37, toOrderGlobal: 40 }, BRIGHT_IG)).toBe(false);
    expect(rangeEndpointsOnAxis({ fromOrderGlobal: 40, toOrderGlobal: 41 }, BRIGHT_IG)).toBe(false);
    expect(rangeEndpointsOnAxis({ fromOrderGlobal: 41, toOrderGlobal: 37 }, BRIGHT_IG)).toBe(false);
  });

  it('realOrdersInRange empty when inverted', () => {
    expect(realOrdersInRange(BRIGHT_IG, 45, 37)).toEqual([]);
  });
});

describe('quyền unit của HS (EnrollmentUnitRange)', () => {
  /** Contiguous synthetic axis covering all labels used below. */
  const AXIS = contiguousProgramAxis(1, 20);
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
    expect(remainingUnits(ranges, 6, AXIS)).toBe(4); // 6,7 + 10,11
    expect(remainingUnits(ranges, 8, AXIS)).toBe(2); // chỉ còn 10,11
    expect(remainingUnits(ranges, 12, AXIS)).toBe(0); // hết quyền
  });
  it('cảnh báo "sắp hết unit" khi còn <= 1', () => {
    expect(remainingUnits([{ fromOrderGlobal: 4, toOrderGlobal: 7 }], 7, AXIS)).toBe(1);
  });
  it('dãy chồng nhau (chỉ tạo được qua ghi trực tiếp/migrate) đếm theo TẬP order, không cộng dồn đôi', () => {
    expect(
      remainingUnits(
        [
          { fromOrderGlobal: 1, toOrderGlobal: 8 },
          { fromOrderGlobal: 5, toOrderGlobal: 8 },
        ],
        5,
        AXIS,
      ),
    ).toBe(4);
  });
  it('hết quyền hoàn toàn (dãy nằm trước current) = 0', () => {
    expect(remainingUnits([{ fromOrderGlobal: 1, toOrderGlobal: 3 }], 5, AXIS)).toBe(0);
  });
  it('dãy rời qua khe hở KHÔNG bị merge thành dải liên tục', () => {
    expect(
      remainingUnits(
        [
          { fromOrderGlobal: 1, toOrderGlobal: 2 },
          { fromOrderGlobal: 5, toOrderGlobal: 6 },
        ],
        1,
        AXIS,
      ),
    ).toBe(4);
  });
});

describe('remainingUnits — Bright I.G dải nhãn có lỗ', () => {
  it('dải từ unit 37 đến 48 chỉ đếm unit có thật (9, không phải 12 số nguyên)', () => {
    // Integer walk 37..48 = 12; real orders exclude 40,44,48 → 9.
    const range = [{ fromOrderGlobal: 37, toOrderGlobal: 48 }];
    expect(realOrdersInRange(BRIGHT_IG, 37, 48)).toEqual([
      37, 38, 39, 41, 42, 43, 45, 46, 47,
    ]);
    expect(remainingUnits(range, 37, BRIGHT_IG)).toBe(9);
    // Continuous arithmetic would claim 12 — prove gap-aware count.
    expect(48 - 37 + 1).toBe(12);
  });

  it('gói 12 unit thật từ 37 kết thúc tại 51 (to label), remaining = 12', () => {
    // Axis from 37 for 12 steps: … → 51 (skips 40,44,48).
    const fromIdx = BRIGHT_IG.indexOf(37);
    const to = BRIGHT_IG[fromIdx + 12 - 1]!;
    expect(to).toBe(51);
    expect(remainingUnits([{ fromOrderGlobal: 37, toOrderGlobal: to }], 37, BRIGHT_IG)).toBe(12);
  });

  it('dải full Bright 37–59 qua mọi lỗ: remaining = 18 (không phải 23 số nguyên)', () => {
    // S3.x multi-hole span: parent must see 18 paid units max on frame.
    expect(realOrdersInRange(BRIGHT_IG, 37, 59)).toHaveLength(18);
    expect(remainingUnits([{ fromOrderGlobal: 37, toOrderGlobal: 59 }], 37, BRIGHT_IG)).toBe(18);
    expect(59 - 37 + 1).toBe(23);
  });

  it('numeric isEntitled still true for hole label; real count excludes the hole', () => {
    // S3.2: isEntitled stays closed-interval on labels (contract unchanged).
    // Money/parent count and stamps use realOrdersInRange / remainingUnits instead.
    const ranges = [{ fromOrderGlobal: 37, toOrderGlobal: 41 }];
    expect(isEntitled(ranges, 39)).toBe(true);
    expect(isEntitled(ranges, 40)).toBe(true); // label 40 lies in [37..41] numerically
    expect(realOrdersInRange(BRIGHT_IG, 37, 41)).toEqual([37, 38, 39, 41]);
    expect(remainingUnits(ranges, 37, BRIGHT_IG)).toBe(4); // not 5 integers
  });

  it('remaining on single-unit axis', () => {
    const one = toProgramUnitAxis([100]);
    expect(remainingUnits([{ fromOrderGlobal: 100, toOrderGlobal: 100 }], 100, one)).toBe(1);
    expect(remainingUnits([{ fromOrderGlobal: 100, toOrderGlobal: 100 }], 101, one)).toBe(0);
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

describe('resolveReferenceAnchor — trục có lỗ', () => {
  it('buổi mốc unit 41 buổi 1 → firstUnitOrder lùi đúng trên trục (không qua 40)', () => {
    // 8 sessions: first unit 39 for 4 sessions then 41 for 4 — ref = s5 is unit 41 buoi 1.
    const sessions = weekly(8);
    const result = resolveReferenceAnchor(sessions, 's5', 41, 1, BRIGHT_IG);
    expect(result).toEqual({
      ok: true,
      firstUnitOrder: 39,
      anchorDate: sessions[0]!.sessionDate,
    });
  });

  it('unitOrder không có trên trục → out_of_bounds', () => {
    const sessions = weekly(4);
    expect(resolveReferenceAnchor(sessions, 's1', 40, 1, BRIGHT_IG)).toEqual({
      ok: false,
      reason: 'out_of_bounds',
    });
  });

  it('ref session missing → ref_not_found', () => {
    expect(resolveReferenceAnchor(weekly(4), 'nope', 37, 1, BRIGHT_IG)).toEqual({
      ok: false,
      reason: 'ref_not_found',
    });
  });

  it('buoi outside 1..4 → bad_buoi', () => {
    expect(resolveReferenceAnchor(weekly(4), 's1', 37, 0, BRIGHT_IG)).toEqual({
      ok: false,
      reason: 'bad_buoi',
    });
    expect(resolveReferenceAnchor(weekly(4), 's1', 37, 5, BRIGHT_IG)).toEqual({
      ok: false,
      reason: 'bad_buoi',
    });
  });

  it('pha buổi đầu ≠ 0 → mid_unit_start (không neo giữa unit)', () => {
    // s2 as unit 37 buổi 1 would imply first session is buổi 0 of previous — mid start.
    expect(resolveReferenceAnchor(weekly(4), 's2', 37, 1, BRIGHT_IG)).toEqual({
      ok: false,
      reason: 'mid_unit_start',
    });
  });

  it('walk off start of axis → out_of_bounds', () => {
    // phaseFirst=0 when (buoi-1-i) ≡ 0 (mod 4), but firstIdx negative:
    // i=4 (s5), buoi=1 → firstIdx = 0 + floor(-4/4) = -1.
    const sessions = weekly(8);
    expect(resolveReferenceAnchor(sessions, 's5', 37, 1, BRIGHT_IG)).toEqual({
      ok: false,
      reason: 'out_of_bounds',
    });
  });
});
