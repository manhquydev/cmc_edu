// Logic thuần tiến trình unit theo SỐ BUỔI HỢP LỆ (docs/class-unit-spec.md mục 3, 6):
// - Unit của lớp nhảy sang unit KẾ TIẾP TRONG KHUNG sau đúng 4 buổi hợp lệ
//   (không hủy), KHÔNG theo mùng-1-tháng-lịch và KHÔNG cộng số nguyên vào
//   order_global (Bright I.G có lỗ 40/44/48/52/56 — nhãn, không phải unit).
// - "buổi hợp lệ" = status != cancelled; buổi tương lai planned vẫn được đếm.
// - Neo (anchorOrder, anchorDate): buổi non-cancelled thứ k (0-based) tính TỪ
//   anchorDate mang unit = axis[anchorIdx + floor(k/4)], kẹp tại unit cuối có thật.
// - Quyền học của HS: dãy [fromOrderGlobal..toOrderGlobal] theo nhãn khung
//   (hở giữa dải OK); đếm unit thật = lọc programAxis, không đếm mọi số nguyên.

/** Số buổi/unit — khung CMC đồng nhất 4 buổi/unit (đã xác minh: 240/240 unit CSV
 * cột `sessions`=4, mọi chương trình + unit REVIEW). Biến-thiên theo unit là thay
 * đổi tương lai (sẽ cần duyệt theo CurriculumUnit.sessions thay vì hằng này). */
export const SESSIONS_PER_UNIT = 4;

/**
 * Trục unit có thật của một chương trình: `order_global` tăng dần, duy nhất.
 * Chỉ nhãn — tiến k unit = dịch k vị trí trong mảng, không cộng số vào nhãn.
 */
export type ProgramUnitAxis = readonly number[];

/** Sort + unique ascending. Empty input → empty axis. */
export function toProgramUnitAxis(orders: Iterable<number>): ProgramUnitAxis {
  return [...new Set(orders)].sort((a, b) => a - b);
}

/** Contiguous labels [from..to] inclusive — for continuous programs / tests. */
export function contiguousProgramAxis(from: number, to: number): ProgramUnitAxis {
  if (from > to) return [];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Index of `order` on axis, or -1 if missing. */
export function axisIndexOf(axis: ProgramUnitAxis, order: number): number {
  // Axis is small (≤ ~100); linear scan keeps the surface dependency-free.
  return axis.indexOf(order);
}

/** First real order strictly greater than `after`, or null if past end. */
export function nextOrderOnAxis(axis: ProgramUnitAxis, after: number): number | null {
  for (const o of axis) {
    if (o > after) return o;
  }
  return null;
}

/** Last real order strictly less than `before`, or null if before the first unit. */
export function previousOrderOnAxis(axis: ProgramUnitAxis, before: number): number | null {
  let prev: number | null = null;
  for (const o of axis) {
    if (o >= before) break;
    prev = o;
  }
  return prev;
}

/**
 * Real unit labels in [from..to] that exist on the program axis (gaps skipped).
 * Order preserved (axis is already ascending).
 */
export function realOrdersInRange(
  axis: ProgramUnitAxis,
  fromOrderGlobal: number,
  toOrderGlobal: number,
): number[] {
  if (fromOrderGlobal > toOrderGlobal) return [];
  return axis.filter((o) => o >= fromOrderGlobal && o <= toOrderGlobal);
}

/** Both endpoints exist on axis (gaps between them are allowed). */
export function rangeEndpointsOnAxis(range: UnitRange, axis: ProgramUnitAxis): boolean {
  return (
    range.fromOrderGlobal <= range.toOrderGlobal &&
    axisIndexOf(axis, range.fromOrderGlobal) >= 0 &&
    axisIndexOf(axis, range.toOrderGlobal) >= 0
  );
}

/**
 * Unit at `fromIdx + steps` on axis, clamped at last real unit.
 * `capped` when steps would walk past the end (or axis empty / fromIdx invalid).
 */
function orderAfterSteps(
  axis: ProgramUnitAxis,
  fromIdx: number,
  steps: number,
): { order: number; capped: boolean } {
  if (axis.length === 0) {
    throw new Error('programUnitAxis is empty');
  }
  if (fromIdx < 0) {
    throw new Error('anchor/from order is not on programUnitAxis');
  }
  const target = fromIdx + steps;
  if (target >= axis.length) {
    return { order: axis[axis.length - 1]!, capped: true };
  }
  if (target < 0) {
    return { order: axis[0]!, capped: true };
  }
  return { order: axis[target]!, capped: false };
}

/** Một buổi để xếp thứ tự khi tính unit (chỉ cần khóa sắp + id để gắn kết quả). */
export interface OrderedSession {
  id: string;
  sessionDate: Date;
  startTime: string;
}

/** Kết quả gắn unit cho một buổi. `capped` = order kỳ vọng vượt trần khung (buổi
 * tương lai chạm trần cần hủy; buổi quá khứ chạm trần giữ nguyên — xử ở tầng API). */
export interface SessionUnitStamp {
  id: string;
  order: number;
  capped: boolean;
}

/** Gắn orderGlobal cho dãy buổi NON-CANCELLED (từ anchorDate trở đi) theo mô hình
 * đếm buổi: sắp theo (ngày, giờ bắt đầu) rồi buổi thứ k mang unit tại vị trí
 * anchorIdx + floor(k/4) trên programAxis, kẹp tại unit cuối có thật.
 * Thuần — tầng API quyết buổi nào được GHI (chỉ buổi tương lai chưa điểm danh). */
export function deriveSessionUnits(
  anchorOrderGlobal: number,
  programAxis: ProgramUnitAxis,
  sessions: OrderedSession[],
): SessionUnitStamp[] {
  const sorted = [...sessions].sort(
    (a, b) =>
      a.sessionDate.getTime() - b.sessionDate.getTime() || a.startTime.localeCompare(b.startTime),
  );
  const anchorIdx = axisIndexOf(programAxis, anchorOrderGlobal);
  if (programAxis.length === 0) {
    throw new Error('programUnitAxis is empty');
  }
  if (anchorIdx < 0) {
    throw new Error(
      `anchorOrderGlobal ${anchorOrderGlobal} is not on programUnitAxis`,
    );
  }
  return sorted.map((s, k) => {
    const { order, capped } = orderAfterSteps(
      programAxis,
      anchorIdx,
      Math.floor(k / SESSIONS_PER_UNIT),
    );
    return { id: s.id, order, capped };
  });
}

export interface UnitRange {
  fromOrderGlobal: number;
  toOrderGlobal: number;
}

/** HS có quyền học unit này không (hiện trong roster của tháng đó). */
export function isEntitled(ranges: UnitRange[], orderGlobal: number): boolean {
  return ranges.some((r) => r.fromOrderGlobal <= orderGlobal && orderGlobal <= r.toOrderGlobal);
}

/** Số unit còn lại kể từ unit hiện tại (tính cả unit đang học nếu có quyền).
 * 0 = đã hết quyền. Dùng cho danh sách cảnh báo "sắp hết unit" (còn <= 1).
 * Đếm theo TẬP order THẬT trên programAxis ∩ quyền (Set khử trùng dãy chồng
 * nhau) — KHÔNG duyệt mọi số nguyên trong [from..to] (Bright I.G [37..48] chỉ
 * có 9 unit thật, không phải 12).
 * KHÔNG merge dải liền qua khe hở — [1-2] và [5-6] vẫn là 4 unit khi trục liên tục. */
export function remainingUnits(
  ranges: UnitRange[],
  currentOrderGlobal: number,
  programAxis: ProgramUnitAxis,
): number {
  const covered = new Set<number>();
  for (const r of ranges) {
    for (const order of realOrdersInRange(programAxis, r.fromOrderGlobal, r.toOrderGlobal)) {
      if (order >= currentOrderGlobal) covered.add(order);
    }
  }
  return covered.size;
}

/** HS còn thuộc lớp tại buổi ngày sessionDate. So sánh THUẦN theo ngày (đã
 * chuẩn hóa sẵn — hàm này KHÔNG biết múi giờ). `archivedDayUtc` = ngày ICT của
 * mốc gỡ (UTC-midnight), do TẦNG API tính bằng `ictTodayUtc(enrollment.archivedAt)`
 * (services/ict-date.ts) rồi truyền vào — domain thuần không chứa offset ICT.
 * Buổi CÙNG NGÀY mốc gỡ vẫn được tính là còn thuộc lớp (gỡ có hiệu lực từ hôm
 * sau, không phải tức thì). */
export function enrollmentCoversSession(archivedDayUtc: Date | null, sessionDate: Date): boolean {
  return archivedDayUtc == null || sessionDate.getTime() <= archivedDayUtc.getTime();
}

/**
 * Kiểm tra dãy unit mới khi add HS: phải liên tục theo nghĩa nhãn from≤to
 * (validate unit có thật ở tầng API bằng programAxis) và bắt đầu từ unit hiện
 * tại của lớp trở đi (được phép bắt đầu ở unit tương lai — HS vào cuối tháng
 * học từ tháng sau).
 */
export function validateNewRange(
  range: UnitRange,
  currentOrderGlobal: number,
): { ok: true } | { ok: false; reason: 'starts_in_past' | 'inverted' } {
  if (range.fromOrderGlobal > range.toOrderGlobal) return { ok: false, reason: 'inverted' };
  if (range.fromOrderGlobal < currentOrderGlobal) return { ok: false, reason: 'starts_in_past' };
  return { ok: true };
}

/** Lỗi khi suy neo từ buổi mốc (realignHistory — docs/class-unit-spec.md §3 migrate). */
export type ResolveReferenceAnchorError =
  | 'ref_not_found'
  | 'bad_buoi'
  | 'mid_unit_start'
  | 'out_of_bounds';

export type ResolveReferenceAnchorResult =
  | { ok: true; firstUnitOrder: number; anchorDate: Date }
  | { ok: false; reason: ResolveReferenceAnchorError };

/**
 * Suy neo (unit buổi đầu + ngày buổi đầu) từ 1 buổi mốc non-cancelled.
 * Chỉ chấp nhận khi pha buổi đầu = 0 (lớp bắt đầu đúng buổi-1 của unit) —
 * mô hình neo (currentUnitId, currentUnitAnchor) không biểu diễn "bắt đầu giữa unit".
 *
 * Bất biến (khi ok): `deriveSessionUnits(firstUnitOrder, programAxis, sessions)[i]`
 * có order == unitOrder và i % 4 == buoi-1.
 */
export function resolveReferenceAnchor(
  sessions: OrderedSession[],
  refSessionId: string,
  unitOrder: number,
  buoi: number,
  programAxis: ProgramUnitAxis,
): ResolveReferenceAnchorResult {
  const sorted = [...sessions].sort(
    (a, b) =>
      a.sessionDate.getTime() - b.sessionDate.getTime() || a.startTime.localeCompare(b.startTime),
  );
  const i = sorted.findIndex((s) => s.id === refSessionId);
  if (i < 0) return { ok: false, reason: 'ref_not_found' };
  if (!Number.isInteger(buoi) || buoi < 1 || buoi > SESSIONS_PER_UNIT) {
    return { ok: false, reason: 'bad_buoi' };
  }
  // Pha (0..3) của buổi ĐẦU: từ pha mốc lùi i bước trong chu kỳ 4.
  const phaseFirst =
    (((buoi - 1) - i) % SESSIONS_PER_UNIT + SESSIONS_PER_UNIT) % SESSIONS_PER_UNIT;
  if (phaseFirst !== 0) return { ok: false, reason: 'mid_unit_start' };

  const unitIdx = axisIndexOf(programAxis, unitOrder);
  if (unitIdx < 0) return { ok: false, reason: 'out_of_bounds' };

  // Walk axis positions, not integer labels (gaps are not units).
  const firstIdx = unitIdx + Math.floor((buoi - 1 - i) / SESSIONS_PER_UNIT);
  if (firstIdx < 0 || firstIdx >= programAxis.length) {
    return { ok: false, reason: 'out_of_bounds' };
  }
  return {
    ok: true,
    firstUnitOrder: programAxis[firstIdx]!,
    anchorDate: sorted[0]!.sessionDate,
  };
}
