// Logic thuần tiến trình unit theo SỐ BUỔI HỢP LỆ (docs/class-unit-spec.md mục 3, 6):
// - Unit của lớp nhảy sang orderGlobal kế tiếp sau đúng 4 buổi hợp lệ (không hủy),
//   KHÔNG theo mùng-1-tháng-lịch. Cùng khuôn con trỏ bài (exercise-sequence.ts):
//   hủy buổi → buổi tương lai "lùi" một bậc, unit lùi theo ("đủ 4 buổi mới nhảy").
// - "buổi hợp lệ" = status != cancelled; buổi tương lai planned vẫn được đếm.
// - Neo (anchorOrder, anchorDate): buổi non-cancelled thứ k (0-based) tính TỪ
//   anchorDate mang unit = anchorOrder + floor(k/4). Tạo lớp: neo = (unit bắt đầu,
//   khai giảng). Admin chỉnh tay = neo mới (unit chọn, hôm nay); buổi trước anchor
//   đóng băng, không đếm lại.
// - Quyền học của HS: dãy [fromOrderGlobal..toOrderGlobal], nhiều đợt được phép hở.

/** Số buổi/unit — khung CMC đồng nhất 4 buổi/unit (đã xác minh: 240/240 unit CSV
 * cột `sessions`=4, mọi chương trình + unit REVIEW). Biến-thiên theo unit là thay
 * đổi tương lai (sẽ cần duyệt theo CurriculumUnit.sessions thay vì hằng này). */
export const SESSIONS_PER_UNIT = 4;

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
 * đếm buổi: sắp theo (ngày, giờ bắt đầu) rồi buổi thứ k mang anchorOrder+floor(k/4),
 * kẹp tại trần khung. Thuần, không biết trạng thái đóng-băng — tầng API quyết
 * buổi nào được GHI (chỉ buổi tương lai chưa điểm danh). */
export function deriveSessionUnits(
  anchorOrderGlobal: number,
  maxOrderGlobal: number,
  sessions: OrderedSession[],
): SessionUnitStamp[] {
  const sorted = [...sessions].sort(
    (a, b) =>
      a.sessionDate.getTime() - b.sessionDate.getTime() || a.startTime.localeCompare(b.startTime),
  );
  return sorted.map((s, k) => {
    const raw = anchorOrderGlobal + Math.floor(k / SESSIONS_PER_UNIT);
    return raw > maxOrderGlobal
      ? { id: s.id, order: maxOrderGlobal, capped: true }
      : { id: s.id, order: raw, capped: false };
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
 * Đếm theo TẬP order thực có quyền (Set khử trùng dãy chồng nhau) — KHÔNG cộng
 * dồn độ dài từng range: hai range chồng lên nhau (chỉ tạo được qua ghi trực
 * tiếp/migrate, add HS thường đã chặn overlap) sẽ đếm lố nếu cộng dồn thẳng.
 * KHÔNG merge dải liền qua khe hở — [1-2] và [5-6] vẫn là 4 unit, không phải
 * dải liên tục [1-6]. */
export function remainingUnits(ranges: UnitRange[], currentOrderGlobal: number): number {
  const covered = new Set<number>();
  for (const r of ranges) {
    const from = Math.max(r.fromOrderGlobal, currentOrderGlobal);
    for (let order = from; order <= r.toOrderGlobal; order++) covered.add(order);
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
 * Kiểm tra dãy unit mới khi add HS: phải liên tục (validate ở UI bằng danh sách
 * orderGlobal thực của chương trình) và bắt đầu từ unit hiện tại của lớp trở đi
 * (được phép bắt đầu ở unit tương lai — HS vào cuối tháng học từ tháng sau).
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
 * Bất biến (khi ok): `deriveSessionUnits(firstUnitOrder, max, sessions)[i]`
 * có order == unitOrder và i % 4 == buoi-1.
 */
export function resolveReferenceAnchor(
  sessions: OrderedSession[],
  refSessionId: string,
  unitOrder: number,
  buoi: number,
  courseMinOrder: number,
  courseMaxOrder: number,
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
  const firstUnitOrder = unitOrder + Math.floor((0 - i + (buoi - 1)) / SESSIONS_PER_UNIT);
  if (firstUnitOrder < courseMinOrder || firstUnitOrder > courseMaxOrder) {
    return { ok: false, reason: 'out_of_bounds' };
  }
  return {
    ok: true,
    firstUnitOrder,
    anchorDate: sorted[0]!.sessionDate,
  };
}
