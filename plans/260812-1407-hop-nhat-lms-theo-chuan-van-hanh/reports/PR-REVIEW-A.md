# PR-REVIEW-A — Review nghiệp vụ PR #117 (review-only)

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Branch / HEAD:** `feat/lms-curriculum-axis-and-makeup-removal` @ `0cae180`  
**Base diff:** `git diff develop...HEAD`  
**Mode:** `/ak:review-pr` — **chỉ review**, không fix, không commit, không post GitHub  
**Ngày:** 2026-08-12  

## Summary

PR nạp **96 unit** từ CSV (gom 240 dòng topic), **gỡ hẳn buổi bù / Tier B**, và chuyển tiến trình unit sang **trục `order_global` có thật (gap-aware)**. Phần lõi nghiệp vụ (import, 4 hàm domain, stamp/grant/revoke) **đúng với luật đã chốt**. Không tìm thấy lỗi Critical làm sai 36/18/42, sai unit 41↔40, hoặc còn `isMakeup`/`addMakeup` trên đường production.

**Risk level:** **Medium** — schema + entitlement + restamp; đã có test domain + int Bright I.G, nhưng còn vài giả định “số 1” / không prune catalog.

## Verdict

**Comment** (an toàn merge về mặt nghiệp vụ cốt lõi; có Important/Suggestion nên xử lý follow-up, không chặn nếu chấp nhận rủi ro vận hành đã nêu).

---

## (1) Logic gom CSV → 96 unit

**Evidence:** `packages/db/prisma/import-curriculum-units.mjs` +  
`packages/db/prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv` (240 dòng).

### Kết luận: **ĐÚNG** với dữ liệu thật hiện tại

| Kiểm | Kết quả |
|-------|---------|
| Số dòng CSV | 240 |
| Gom `(program map, order_global)` | **96** unit |
| UCREA / BRIGHT_IG / BLACK_HOLE | **36 / 18 / 42** (khớp `EXPECTED_COUNTS`) |
| Map program | `UCREA`→`UCREA`, `Bright I.G`→`BRIGHT_IG`, `Black Hole`→`BLACK_HOLE` |
| `order_global` / `level` | giữ nguyên văn (Bright thiếu 40,44,48,52,56) |
| Nhất quán trong nhóm multi-topic | 0 nhóm lệch `level` / `unit_type` / `unit_code` |
| `unit_code` ↔ `(program, order_global)` | 1–1 (96 mã, không 1 code 2 og, không 1 og 2 code) |
| Guard đếm | `loadCurriculumUnitsFromCsv` throw nếu ≠ 36/18/42 |
| Idempotent | upsert `(program, orderGlobal)` |
| Test | `scripts/import-curriculum-units.test.mjs` 7/7 pass (chạy lại khi review) |

**Cách gom:** key = `programEnum + order_global`; multi-topic gộp `chu_de` (giữ thứ tự xuất hiện, khử trùng).

### `monthIndex`

- **Cách suy:** 1-based theo thứ tự `orderGlobal` trong cùng `(program, level)` — đúng comment schema / brief.
- **Không** lấy từ cột `duration_month` (CSV luôn `1` — đó là độ dài unit, không phải chỉ số).
- UCREA `U2`: 12 unit (10 LESSON + 2 REVIEW) → monthIndex 1…12; Bright mỗi level J/T/C/W/Q/U = 3 unit → 1…3. **Hợp lý** với nghĩa “seq trong level”, dù tên field mang chữ *month* (nợ đặt tên cũ, không phải bug import).

### Title

- Pattern: `` `${unit_code} — ${chu_de joined · }` ``  
- Multi-topic (vd Black Hole 4 topic): đầy đủ chủ đề; có mã unit để phân biệt.
- **Không** nhúng `bai_hoc` / tư duy khái niệm — title vẫn **có nghĩa** cho admin; chi tiết topic không nằm catalog edu (không có `CurriculumLesson`).

### Trường hợp dữ liệu có thể gom **sai** (hiện CSV **không** dính; rủi ro tương lai)

| Tình huống | Hành vi code | Mức |
|------------|--------------|-----|
| Cùng `(program, order_global)` nhưng **khác `level` / `unit_type`** | **Throw** (an toàn) | OK |
| Cùng `order_global` nhưng **khác `unit_code`** (CSV hỏng) | Gộp 1 unit; `unitCode` lấy **dòng đầu** — title có thể lệch | Important **nếu** CSV tương lai lỗi (hiện 0 case) |
| Label program lạ | Throw | OK |
| Unit thừa trong DB không còn trong CSV | **Không prune** — trục load từ DB sẽ **giữ unit ma** (vd nhãn 40) → gap-aware **hỏng im lặng** | **Important** (vận hành / re-seed) |
| Import chỉ update field có trong CSV; không xóa row | Idempotent partial catalog | Suggestion: prune có chặn FK |

**Không** có bug gom 96 trên file CSV đang ship.

---

## (2) Gap-aware domain — nghiệp vụ

**Evidence:**  
`packages/domain-lms/src/unit-progression.ts`, `package-grant.ts`  
Call sites: `stamp-sessions.ts`, `grant-units.ts`, `router.ts` (revoke).  
Test: domain **103 pass**; int Bright I.G (PR body + file `bright-ig-gaps.int.test.ts`).

### `deriveSessionUnits` — **ĐÚNG**

- Bước unit = `axis[anchorIdx + floor(k/4)]`, **không** `anchor + floor(k/4)`.
- Neo 37, buổi 13–16 (k=12..15) → bước 3 → **41** (skip 40) — đúng brief.
- **Kẹp trần:** `orderAfterSteps` khi `target >= length` → unit **cuối có thật** + `capped: true`. Neo ở unit cuối + 12 buổi → toàn 59/`capped` sau 4 buổi đầu — đúng “không invent order”.
- Neo **không** trên trục → **throw** (không im lặng bỏ qua).
- Trục rỗng → throw (stamp path early-return 0 khi DB không có unit).

### `remainingUnits` — **ĐÚNG**

- Lọc `realOrdersInRange(axis, from, to)` ∩ `>= current` — dải nhãn `[37..48]` = **9** unit thật (không 12).
- Không merge hai dải hở.

### `resolvePackageGrantRange` — **ĐÚNG** (kể cả nhiều lỗ liên tiếp)

- N unit = N **bước index**: `to = axis[fromIdx + unitCount - 1]`.
- Bright 12 unit từ 37 → to **51** (bỏ 40/44/48).
- Renewal sau `to=39` → `nextOrderOnAxis` → **41**, không 40.
- Trục thưa kiểu `[1,10,20,30,40]`, grant 4 từ 1 → to **40**, **đúng 4 unit thật** dù “nhảy” nhiều nhãn.
- **Vượt quá unit còn lại** → **throw** (không cấp thiếu im lặng) — đúng hơn “bán 12 giao 8”.

### `resolveReferenceAnchor` — **ĐÚNG**

- Lùi/tiến theo **index trục**, không cộng nhãn.

### `isEntitled` — **cố ý** theo nhãn `[from..to]`

- Vẫn `from ≤ order ≤ to` (không cần axis). Session sau gap-aware **không** mang order lỗ; open-tier filter trên **row CurriculumUnit có thật**. Không tạo path “mở unit 40”.
- Khoảng `[37..41]` “bao” nhãn 40 về mặt số học nhưng **không có row 40** → không mở bài ma.

### Call-site wiring

| Nơi | Đúng? |
|-----|--------|
| `stamp-sessions.ts` L42–61 | Load full axis → `deriveSessionUnits` |
| `grant-units.ts` package grant | `loadProgramUnitAxis` + resolve + endpoint assert |
| `router` addWithUnits / grantPast | endpoint-only (lỗ giữa OK) |
| `revokeFromNext` | `previousOrderOnAxis` (không `from-1`) |

---

## (3) Còn sót giả định trục liên tục?

Quét `apps/api` + `packages` (loại dist/node_modules), tìm cộng/trừ / vòng `for` trên `orderGlobal`.

### Production logic (nghiệp vụ)

| Vị trí | Có phải cộng nhãn? | Đánh giá |
|--------|-------------------|----------|
| Domain 4 hàm | Chỉ **index** trên axis | OK |
| `stamp-sessions` / `grant-units` / revoke | Truyền axis / endpoint | OK |
| `rangesOverlap` | Giao khoảng nhãn | **OK by design** (hai dải rời 37–39 & 41–43 không overlap) |
| `isEntitled` | Khoảng nhãn | OK by design (xem §2) |
| **`resolveClassCurrentOrder`** `grant-units.ts` **L63, L68** | `return 1` khi thiếu `currentUnitId` / missing unit | **Important** — giả định UCREA bắt đầu 1; Bright/Black Hole **1 không trên trục** → grant throw / sai neo nếu data thiếu `currentUnitId` |
| Sort `a.orderGlobal - b.orderGlobal` (import) | Chỉ sort | OK |

### Không phải production path

| Vị trí | Ghi chú |
|--------|---------|
| `apps/api/src/test/db.ts` ~L483 seed `for orderGlobal=1..max` | Helper test liên tục |
| `*.int.test.ts` expect `to-from+1` | **Chủ đích** chứng minh span nhãn ≠ số unit thật (`bright-ig-gaps.int.test.ts` ~L220) |
| Migration SQL lịch sử `isMakeup` | Đã DROP ở `20260812120000_…` |

### Admin

- Hiển thị `#order · title (Llevel/MmonthIndex)` — **không** cộng order để tiến unit.
- Không thấy `remainingUnits` / `order+1` progression trong admin.

**Kết luận:** không còn đường production “tiến unit = cộng số nguyên”. Sót đáng kể duy nhất là **default `1`** khi class không có current unit.

---

## (4) Gỡ buổi bù — mất năng lực nào? Có đường thay?

**Đã gỡ (code + migration):** `isMakeup`, `makeupForSessionId`, `addMakeup`, UI buổi bù, open-tier Tier B, sweep tạo bù / `roomConflict` tạo bù.

| Năng lực cũ | Còn đường thay? | Ghi chú |
|-------------|-----------------|---------|
| Mở bài **chỉ cho HS** dự buổi bù (Tier B) | **Một phần** — HS vắng **vẫn trong roster** → vẫn nhận bài theo Tier A + entitlement khi unit đã dạy xong | Đúng brief; không còn “mở sớm chỉ cho người bù” |
| Buổi dạy bù **một lần / một HS** trong hệ | **Không trong-app** — xếp **ngoài hệ thống** hoặc **thêm khung lịch tuần** (cả lớp) | Mất “buổi rời” có chủ đích |
| Sweep 0 present: hủy rồi **tự nối buổi bù** cuối slot | **Không** — chỉ **hủy + restamp** (`session-done-sweep.ts` B) | Lớp **thiếu 1 buổi** trên lịch trừ khi GĐĐT **kéo dài / thêm slot** tay |
| Báo `roomConflict` để xếp bù tay | **Không** (cờ luôn false, comment dead path) | Thay bằng quy trình lịch thường |

Đây là **trade-off sản phẩm đã chốt**, không phải regress vô tình: gỡ để hết lệch restamp (unit 4 buổi → 5 buổi thực).  
**Important (product, không phải bug code):** vận hành cần biết auto-cancel 0-HS **không** bù số buổi nữa.

Không còn `addMakeup` / makeup columns trên apps (chỉ comment + migration drop).

---

## Findings (severity độ)

### Critical

*Không có.*

### Important

1. **Import không prune unit thừa** — `import-curriculum-units.mjs` chỉ upsert.  
   - **Kịch bản hỏng:** DB còn `CurriculumUnit` Bright order **40** (seed tay / data cũ) → `toProgramUnitAxis` **đưa 40 vào trục** → buổi 13–16 lại ra **40** hoặc lệch so với khung CSV.  
   - **Mitigation:** migrate/seed DB sạch; hoặc prune unit không còn CSV (có chặn FK).

2. **`resolveClassCurrentOrder` default `1`** — `grant-units.ts` L63–68.  
   - **Kịch bản hỏng:** `ClassBatch.currentUnitId = null` (hoặc unit bị xóa) trên lớp Bright/Black Hole → `from=1` **off-axis** → grant fail `from order 1 is not on programUnitAxis` / validate lỗi.  
   - `createClassWithUnits` gán current (router ~L166) nên path chuẩn OK; default 1 là **giả định trục UCREA**.

3. **Mất auto-bù sau cancel 0-HS** (chủ đích).  
   - **Kịch bản vận hành:** lớp 16 buổi, 1 buổi 0 present bị sweep cancel → còn 15 buổi non-cancelled; **không** tự thêm buổi 16.  
   - Thay thế: GĐĐT thêm slot / kéo `endDate` — **không** tự động.

### Suggestion

1. Title bỏ qua `bai_hoc` — đủ cho catalog; có thể bổ sung sau nếu UI cần.  
2. Trùng helper assert endpoint (`grant-units` vs `router`).  
3. `stamp-sessions` `if (!unitId) continue` — sau gap-aware gần như unreachable; fail-loud sẽ dễ debug.  
4. `monthIndex` tên gây hiểu nhầm “tháng lịch” vs seq-in-level — doc/UI `M${monthIndex}` đã lộ.

---

## Kiểm chứng đã chạy (review session)

```text
node --test scripts/import-curriculum-units.test.mjs   → 7/7 pass
cd packages/domain-lms && npx vitest run               → 103 pass
```

Không chạy lại full `apps/api` suite (PR body claim 1198 pass — không re-verify trong session này).

## Phạm vi ngoài / không block

- Khối `plans/**` + docs trong diff rất lớn — không audit plan prose.  
- PR body contract / CI status — không post GitHub; không gate CI tại đây.

---

## Trả lời ngắn 4 câu hỏi

1. **Gom CSV 96:** đúng; monthIndex đúng nghĩa seq-(program,level); title hợp lý. Rủi ro chính = **không prune** + CSV tương lai lệch code trong cùng og.  
2. **Gap-aware:** đúng; kẹp trần đúng; cấp N unit qua nhiều lỗ đúng; vượt trục throw.  
3. **Sót trục liên tục:** không còn cộng order để tiến unit; sót **default currentOrder=1**.  
4. **Gỡ bù:** mất buổi rời + auto-bù sau 0-HS; thay bằng roster vẫn nhận bài + lịch tuần / ngoài hệ thống — **chấp nhận được nếu ops nắm**.

## Status

**DONE** — review-only, không sửa code, không commit, không post GitHub.
