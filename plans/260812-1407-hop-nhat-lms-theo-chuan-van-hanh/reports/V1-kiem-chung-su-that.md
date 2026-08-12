# V1 — Kiểm chứng sự thật phase-01 Đợt A (bản viết lại sau red-team)

**File:** `plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/phase-01-dot-a-kich-hoat-van-hanh-unit.md`  
**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Chế độ:** validate (xác minh ĐÚNG/SAI/MỘT PHẦN), chỉ đọc.

---

## (1) Bảng số liệu khung chương trình 4 dòng trong cmc_edu

| Khẳng định plan | Kết luận | Sự thật + bằng chứng |
|-----------------|----------|----------------------|
| `cmc_edu` seed chỉ **4** unit UCREA | **ĐÚNG** | `packages/db/prisma/seed.mjs` L70–76: 4 object `orderGlobal` 1–4, program `UCREA` only. |
| Bright I.G / Black Hole trong seed = **0** | **ĐÚNG** | Cùng mảng `rows` L71–76: không có `BRIGHT_IG` / `BLACK_HOLE`. `ensure-curriculum-units.ts` L48–87 cũng chỉ UCREA 1–4. |
| CSV thật UCREA **36** / Bright I.G **36** / Black Hole **168** | **ĐÚNG** | `/home/manhquy/Downloads/cmc-lms/docs/CMC_EDU_Khung_Chuong_Trinh.csv`: Counter `program` = UCREA:36, Bright I.G:36, Black Hole:168. |
| Tổng CSV **239** | **SAI** | 36+36+168 = **240**. File CSV có **240** data rows (không kể header). Plan L28 và L52 ghi **239**. Domain comment cũng nói 240: `unit-progression.ts` L12–13. |
| Trích dẫn `seed.mjs:70-76` | **ĐÚNG** | L70 comment; L71–76 data. |

**Ghi chú hệ quả L33–36 (mở rộng, không trong 8 mục ưu tiên):**  
- Cấp dải `[5..8]` khi program chỉ có 1–4: `addWithUnits`/`grantPast` loop `unitOrders.has(o)` → BAD_REQUEST (`lms-ops/router.ts` L249–254, L443–447). **ĐÚNG hướng**.  
- “Buổi 5+ ép unit 4”: `restampBatchSessions` lấy `maxOrder` từ catalog (`stamp-sessions.ts` L36–37); `deriveSessionUnits` kẹp trần (`unit-progression.ts` L46–49). Session sau ceiling stamp unit max. Mô tả “xem toàn bộ bài còn lại” **MỘT PHẦN** — catalog draft chỉ 4 unit nên không còn unit 5+ để “còn lại”; thực tế là **mọi buổi sau đều dính unit 4** / mở bài unit 4 lặp.

---

## (2) Không API đọc dải unit / số unit còn lại; listStudents không `archivedAt`

| Khẳng định | Kết luận | Bằng chứng |
|------------|----------|------------|
| Không API trả **danh sách dải unit** của HS trong lớp | **ĐÚNG** | `lmsOps.rosterForSession` return students: chỉ `enrollmentId, studentId, fullName` — `apps/api/src/lms-ops/router.ts` L370–374. `classBatch.listStudents` return: `enrollmentId, studentId, fullName, status` — `class-batch-router.ts` L325–330. Không procedure `listUnitRanges` / tương đương trong `lms-ops` hay `enrollment`. |
| Không API **số unit còn lại** (dù có pure function) | **ĐÚNG** | `remainingUnits` export domain: `packages/domain-lms/src/unit-progression.ts` L70; `index.ts` L8. Grep `apps/api/src` (non-test): **không** mount tRPC procedure gọi `remainingUnits` / `expiring`. |
| `listStudents` **không** trả `archivedAt` | **ĐÚNG** | `class-batch-router.ts` L325–330: không field `archivedAt`. Query vẫn lấy enrollment `status in reserved\|active` L314 — enrollment đã archive (vẫn `active` + `archivedAt` set) **có thể vẫn xuất hiện** nhưng UI không biết đã gỡ. |

Plan A3 L93–96 khớp code.

---

## (3) Không API cảnh báo sắp hết unit

| Khẳng định | Kết luận | Bằng chứng |
|------------|----------|------------|
| `cmc_edu` chưa có API “sắp hết unit” | **ĐÚNG** | Không `expiring` trong `apps/api/src`. Domain chỉ có pure `remainingUnits`. Đối chứng chuẩn: `cmc-lms` có `enrollment.expiring` (`apps/api/src/routers/enrollment.ts` ~L796+). Plan A7 L152 khớp. |

---

## (4) Cổng entitlement gộp dải theo **chương trình**, không theo **lớp/ghi danh**

| Khẳng định | Kết luận | Bằng chứng |
|------------|----------|------------|
| Khi `LMS_ENTITLEMENT_GATE` bật, open-tier gộp ranges theo `program` | **ĐÚNG** | `open-tier.ts` L172–214: comment L190–191 “scoped by program”; L196–206: `rangesByProgram` gộp `unitRanges` mọi `activeEnrollments` cùng `classBatch.program`; L208–212: `isEntitled(ranges, u.orderGlobal)` trên bucket program. |
| Kịch bản 2 lớp cùng UCREA: dải lớp A mở unit lớp B | **ĐÚNG** (về logic entitlement open-tier) | Tier A lấy session end của **mọi** classBatch active (L126–144). Unit id lớp B (cùng program, order trong dải A) pass `isEntitled` trên bucket gộp. |

**MỘT PHẦN / phạm vi:**  
- Lỗi gộp program **chỉ** trên nhánh open-tier khi gate ON.  
- **Roster dual-gate / attendance** dùng ranges **từng enrollment**: `on-roster.ts` L33 `isEntitled(input.ranges, …)`; attendance load `enrollment.unitRanges` per row. Không gộp program.  
- Khi `LMS_OPEN_TIER_ENABLED=0` (delivery path L102–110), entitlement gate path program-merge **không** chạy như Tier A/B. Plan A8 nói cờ tạm trên nhánh cũ — **khớp**.

---

## (5) `revokeFromNext` không cắt được quá khứ

| Khẳng định | Kết luận | Bằng chứng |
|------------|----------|------------|
| `revokeFromNext` không cắt quá khứ (so unit hiện tại lớp) | **ĐÚNG** | `lms-ops/router.ts` L505–517: nếu `fromOrderGlobal < currentOrder` (từ `classBatch.currentUnitId` → `orderGlobal`) → BAD_REQUEST “Cannot revoke past units…”. Truncate chỉ từ `fromOrderGlobal` trở đi L530–542. Int test: `lms-ops.int.test.ts` (revoke past subtract rejected). |

**Làm rõ nghĩa “quá khứ”:** so với **con trỏ unit hiện tại của lớp**, không phải “dải đã cấp trong quá khứ lịch sử” theo nghĩa calendar. Khớp wording plan “BỚT quá khứ không”.

---

## (6) Gỡ khỏi lớp: hiệu lực từ hôm sau; buổi cùng ngày vẫn giữ HS

| Khẳng định | Kết luận | Bằng chứng |
|------------|----------|------------|
| Gỡ có hiệu lực **từ hôm sau** | **ĐÚNG** | Domain: `enrollmentCoversSession` — `unit-progression.ts` L83–87 comment + L86: `sessionDate <= archivedDayUtc` ⇒ cùng ngày vẫn thuộc lớp; ngày sau `>` ⇒ false. |
| Buổi **cùng ngày** vẫn giữ HS | **ĐÚNG** | Test: `unit-progression.test.ts` L102 (same day true), L105 (next day false). API roster: `lms-ops/router.ts` L355–357 `archivedDayUtc` từ `ictDateOnlyOf(e.archivedAt)` rồi `onRoster` → `enrollmentCoversSession`. |

---

## (7) Cấp bù (`grantPast`) trên ghi danh đã gỡ bị chặn

| Khẳng định | Kết luận | Bằng chứng |
|------------|----------|------------|
| Cấp bù trên enrollment đã archive ⇒ chặn | **ĐÚNG** | `grantPast` L433–435: `if (enrollment.archivedAt) throw badRequest('Cannot grant units on an archived enrollment.')`. Cùng rule `addWithUnits` L227–229. |

---

## (8) Worker đối soát chạy mỗi 30 giây

| Khẳng định | Kết luận | Bằng chứng |
|------------|----------|------------|
| Worker chạy mỗi **30 giây** | **MỘT PHẦN** | Default: `DEFAULT_POLL_INTERVAL_MS = 30_000` — `apps/api/src/worker/index.ts` L42–46, L148 `WORKER_POLL_INTERVAL_MS ?? DEFAULT`. Comment L42–45: “placeholder… configurable via env”. **Không** hard-pin 30s production nếu env khác. `drainOnce` gồm reconcile orphaned receipts (cấp unit từ phiếu) — L119+. |

---

## Bảng tổng hợp (8 mục ưu tiên)

| # | Khẳng định | Kết luận |
|---|------------|----------|
| 1 | Seed 4 UCREA / 0 / 0; CSV 36/36/168 | **ĐÚNG** seed + phân rã CSV; **SAI** tổng **239** (thật **240**) |
| 2 | Không API đọc dải; không API remaining; listStudents không archivedAt | **ĐÚNG** cả ba |
| 3 | Không API sắp hết unit | **ĐÚNG** |
| 4 | Entitlement gộp theo program | **ĐÚNG** (open-tier + gate); roster/attendance per-enrollment |
| 5 | revokeFromNext không cắt quá khứ (so current unit) | **ĐÚNG** |
| 6 | Archive hiệu lực hôm sau; cùng ngày còn roster | **ĐÚNG** |
| 7 | grantPast trên archived chặn | **ĐÚNG** |
| 8 | Worker 30s | **MỘT PHẦN** — default 30s, override bằng env |

---

## Unknowns

1. DB runtime hiện tại sau seed/migrate (có ai import thêm CurriculumUnit ngoài seed không) — không query DB.  
2. Giá trị `WORKER_POLL_INTERVAL_MS` trên deploy thật.  
3. Plan success criteria / A1–A8 (việc sẽ làm) không thuộc “khẳng định sự thật hiện trạng” — không chấm ở đây.

---

Status: DONE | Summary: 7/8 khối chính khớp code; lệch duy nhất đáng kể là tổng CSV 239 vs 240 và worker 30s chỉ là default.
