# GAP-4 — Lỗ hổng kiểm thử: unit progression & quyền học (entitlement)

**Phạm vi:** `packages/domain-lms`, `apps/api` (liên quan unit progression / entitlement / roster / grant / revoke)  
**Chế độ:** CHỈ ĐỌC + chạy test; không sửa code, không commit  
**Skill:** `/ak:test`  
**Ngày:** 2026-08-12  
**Nhánh làm việc:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Lệnh đã chạy:**
- `cd packages/domain-lms && npx vitest run --coverage` → **coverage chạy được**, exit 1 do threshold 90% không đạt (không phải do test fail)
- `cd packages/domain-lms && npx vitest run` → 58/58 pass (src + dist double-run)

---

## 1. Inventory file test hiện có

### 1.1 `packages/domain-lms` (pure domain)

| File | Loại | Phủ gì |
|------|------|--------|
| `src/unit-progression.test.ts` | unit (Vitest) | `deriveSessionUnits` (4 buổi/unit, lùi khi bỏ buổi, cap trần, sort ngày/giờ, empty); `isEntitled` (range + khe hở entitlement); `remainingUnits` (từ current, overlap set, gap không merge, hết quyền); `enrollmentCoversSession` (null / trước / cùng ngày / sau); `validateNewRange` (ok / starts_in_past / inverted). **Không** import `resolveReferenceAnchor`. |
| `src/package-grant.test.ts` | unit | `resolvePackageGrantRange`: first grant, renewal after max, class đã vượt grant cũ. **Không** cover `unitCount < 1` throw. |
| `src/exercise-sequence.test.ts` | unit | Bài tập sequence (không phải progression unit/entitlement trực tiếp; cùng package domain-lms, coverage chung). |

### 1.2 `apps/api` — trực tiếp unit/roster/grant/revoke

| File | Loại | Phủ gì |
|------|------|--------|
| `src/lms-ops/on-roster.test.ts` | unit thuần | Dual-gate `onRoster`: active+entitled; reject reserved; range miss; null stamp fail-closed; blocked_lms; archive day; same-day archive still on. Gọi `isEntitled` + `enrollmentCoversSession` gián tiếp. |
| `src/lms-ops/lms-ops.int.test.ts` | integration (Postgres) | `createClassWithUnits` stamp; roster cover/miss + sale FORBIDDEN grant; null stamp empty roster; cancel+restamp lùi unit; `grantPast` vs `addWithUnits` past block; `revokeFromNext` truncate future + reject past cut; archive/unarchive roster. Seed units **101–104 liên tục**. |
| `src/lms-ops/grant-units.int.test.ts` | integration | `grantUnitsFromReceipt` / provision: continuous grant 301–304; idempotent sourceReceiptId; unitCount 0 break-glass (active, no range, not on roster); renewal 303–304; full refund xóa range; receiptCancel + audit `revokeOnCancel`. Seed **301–304 liên tục**. |
| `src/lms-ops/exercise-delivery.int.test.ts` | integration | Delivery bài + dual-gate range (201–202); cancel revoke SessionExercise; worker deliver. Seed **201–202 liên tục**. |

### 1.3 `apps/api` — liên quan entitlement / revoke (secondary)

| File | Phủ liên quan |
|------|----------------|
| `src/exercise/open-tier.test.ts` | Flag `LMS_ENTITLEMENT_GATE=1`: ẩn/hiện unit theo `EnrollmentUnitRange` (`isEntitled`). Range mẫu rộng `1..10000` hoặc 1 unit. |
| `src/worker/reconcile-orphaned-receipts.test.ts` | Plan 3: recover missing range sau crash grant; **không** re-grant sau intentional delete khi còn audit grant; refund không coi orphan. |
| `src/finance/cancel-refund.test.ts` | Cancel/refund lifecycle; void revoke LMS visibility; **không** assert chi tiết `EnrollmentUnitRange` rows (range revoke covered chủ yếu ở grant-units.int). |
| `scripts/import-curriculum-units.test.mjs` | CSV → 96 unit; **giữ order_global verbatim, không gap-compaction** — bằng chứng khung thật có hố (Bright I.G). Không test progression/grant. |

### 1.4 Không có file test (gap inventory)

| Surface production | Test riêng? |
|--------------------|-------------|
| `apps/api/src/lms-ops/stamp-sessions.ts` (`restampBatchSessions`) | Không unit; chỉ đi qua int `createClassWithUnits` / cancel |
| `apps/api/src/lms-ops/grant-units.ts` helpers (`rangesOverlap`, `defaultUnitCountFromEnv`, `loadProgramUnitOrders`, race P2002) | Không unit; một phần qua int |
| `resolveReferenceAnchor` (domain) | **Không test nào** |
| Restamp / grant trên **khung order_global có hố** (Bright I.G) | **Không** |

---

## 2. Đối chiếu hàm thuần domain ↔ test

### 2.1 `packages/domain-lms/src/unit-progression.ts`

| Hàm / export | Có test? | Nhánh / dòng chưa chạy (coverage v8) |
|--------------|----------|--------------------------------------|
| `SESSIONS_PER_UNIT` | dùng gián tiếp | — |
| `deriveSessionUnits` | **CÓ** (6 cases) | Happy + cap + sort + empty. Chưa thấy: `anchorOrder > maxOrder` toàn cap; 1 buổi duy nhất; tie-break chỉ `sessionDate` (đã có startTime). |
| `isEntitled` | **CÓ** | Empty `ranges=[]` (implicit false) không assert riêng; multi-range đã cover. |
| `remainingUnits` | **CÓ** (5 cases mạnh: gap, overlap set, 0, warning ≤1) | Empty ranges; `from > to` corrupt range không assert. |
| `enrollmentCoversSession` | **CÓ** (4 biên ngày) | — |
| `validateNewRange` | **CÓ** (ok / past / inverted) | `from == to` single unit (ok) không explicit. |
| **`resolveReferenceAnchor`** | **KHÔNG** | **Toàn bộ thân hàm không cover** — coverage báo `unit-progression.ts` lines **130–147** uncovered. Mọi nhánh: `ref_not_found`, `bad_buoi` (non-int / <1 / >4), `mid_unit_start`, `out_of_bounds`, success `{ firstUnitOrder, anchorDate }`. Export public qua `index.ts`; consumer migrate/realign (plan BR1) nhưng **0 test**. |

**Coverage file:** statements **58.33%**, branches **44.44%**, lines **57.14%**, functions **72.72%**.

### 2.2 `packages/domain-lms/src/package-grant.ts`

| Hàm | Có test? | Nhánh chưa chạy |
|-----|----------|-----------------|
| `resolvePackageGrantRange` | **CÓ** 3 happy paths | **`unitCount < 1` throw** (line 15) — coverage: package-grant **83.33%** lines, branch **75%**, uncovered line **15**. Multi-range max (reduce) chỉ 1 existing range. `unitCount` rất lớn không test. |

### 2.3 Hàm API thuần gần domain (không trong 2 file trên nhưng cùng pipeline)

| Hàm | File | Test |
|-----|------|------|
| `onRoster` | `lms-ops/on-roster.ts` | Unit tốt (7 cases) |
| `rangesOverlap` | `grant-units.ts` (+ duplicate router) | Chỉ gián tiếp (overlap BAD_REQUEST int) |
| `defaultUnitCountFromEnv` | `grant-units.ts` | Không |
| `restampBatchSessions` silent skip `!unitId` | `stamp-sessions.ts:59-60` | **Không** — hố nguy hiểm với khung gapped |

---

## 3. Dữ liệu mẫu: có phải luôn `order_global` liên tục?

### 3.1 Kết luận ngắn

**Có — gần như 100% fixture test LMS-ops/grant/roster dùng trục unit số nguyên liên tục.**  
Đó **là lỗ hổng lớn** vì khung thật **không** luôn liên tục.

### 3.2 Evidence fixture test

| Nguồn seed | orderGlobal |
|------------|-------------|
| `lms-ops.int.test.ts` | 101, 102, 103, 104 — contiguous |
| `grant-units.int.test.ts` | 301–304 — contiguous |
| `exercise-delivery.int.test.ts` | 201–202 — contiguous |
| `on-roster.test.ts` | ranges 1–4 (số giả, không seed DB) |
| `unit-progression.test.ts` | anchor 1/3/35… max 36 — **số học liên tục**, không map catalog gapped |
| `package-grant.test.ts` | 101–106 số học liên tục |
| `test/db.ts` `ensureProgramUnitAxis` | **cố ý** tạo `1..maxOrder` liên tục (comment: tránh `"orderGlobal N is not in program"`) |

Domain **có** test khe hở **entitlement range** (`[4–7]` + `[10–11]`) — đó là gap **quyền học**, không phải gap **catalog curriculum**.

### 3.3 Khung thật CSV (`packages/db/prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv`)

| Program | #units | min–max | Holes (integer missing) |
|---------|--------|---------|-------------------------|
| UCREA | 36 | 1–36 | **0 — contiguous** |
| Black Hole | 42 | 61–102 | **0 — contiguous** |
| **Bright I.G** | 18 | 37–59 | **5 holes: 40, 44, 48, 52, 56** |

Import policy: *“Keep order_global and level verbatim (no gap-compaction)”* (`import-curriculum-units.mjs` + test xác nhận order 37 Bright I.G).

### 3.4 Vì sao continuous-only fixtures là lỗ hổng lớn

1. **`deriveSessionUnits`** nhảy số học `anchor + floor(k/4)` — với Bright I.G, sau unit 39 sẽ ra order **40** (không tồn tại).
2. **`restampBatchSessions`** map `unitIdByOrder.get(stamp.order)` rồi **`if (!unitId) continue`** — stamp **im lặng bỏ qua**, session có thể null stamp → roster fail-closed (HS “biến mất”) hoặc stamp lệch, **không có test**.
3. **`resolvePackageGrantRange`** cấp dải `[from, from+unitCount-1]` liên tục số nguyên; **`grantRangeOnEnrollment`** lặp `for o=from..to` và **throw** nếu thiếu order trong program. Gói 4 unit bắt đầu tại 39 trên Bright I.G sẽ đụng 40 → fail — **không có test**.
4. `ensureProgramUnitAxis` trong harness **che** bug bằng cách nhân tạo trục 1..N full.

**UCREA/Black Hole contiguous** làm nhiều path “may mắn xanh” trên 2/3 chương trình; **Bright I.G** là canary thật chưa được test.

---

## 4. Số liệu coverage `packages/domain-lms`

Lệnh: `cd packages/domain-lms && npx vitest run --coverage`

| Metric | Total package | Threshold config | Kết quả |
|--------|---------------|------------------|---------|
| Statements | **71.92%** | 90% | **FAIL threshold** |
| Branches | **52.94%** | 90% | **FAIL** |
| Functions | **84.21%** | 90% | **FAIL** |
| Lines | **70.45%** | 90% | **FAIL** |

Theo file:

| File | Stmts | Branch | Funcs | Lines | Uncovered |
|------|-------|--------|-------|-------|-----------|
| `exercise-sequence.ts` | 100% | 100% | 100% | 100% | — |
| `package-grant.ts` | 83.33% | 75% | 100% | 83.33% | L15 (`unitCount < 1`) |
| `unit-progression.ts` | 58.33% | 44.44% | 72.72% | 57.14% | **L130–147 (`resolveReferenceAnchor`)** |

Test run: **6 files / 58 tests pass** (double-run `src` + `dist` — known smell, không fail correctness).

**API int tests:** không chạy trong phiên này (cần Postgres live); inventory dựa trên đọc source + tên case. Domain suite đủ cho pure math.

---

## 5. Test còn thiếu — ưu tiên theo rủi ro

### P0 — Rủi ro sản xuất cao (khung gapped + stamp/grant)

1. **Integration: restamp / createClassWithUnits trên Bright I.G (order có hố 40,44,…)**  
   - Seed đúng catalog (hoặc seed 37,38,39,41).  
   - Assert: session không bị “null stamp im lặng” khi arithmetic đụng hole; hoặc document+assert behavior hiện tại là fail-closed có log/error (hiện `continue` im lặng — có thể là bug).  
   - **Blast:** mọi lớp Bright I.G sau ~3 unit.

2. **Integration: `grantUnitsFromReceipt` / `addWithUnits` khi range số học chứa hố catalog**  
   - `currentOrder=39`, `unitCount=4` → expect reject rõ (`orderGlobal 40 is not in program`) **và** (product) quyết định grant theo **N unit thực** (skip holes) vs block.  
   - Hiện không có regression cho lựa chọn product.

3. **Domain: `resolveReferenceAnchor` full matrix**  
   - success pha 0; `ref_not_found`; `bad_buoi` (0, 5, 1.5); `mid_unit_start`; `out_of_bounds`.  
   - Invariant comment trong source: `deriveSessionUnits(...)[i].order == unitOrder && i % 4 == buoi-1`.  
   - Không ship migrate/realign nếu hàm này 0%.

### P1 — Domain pure còn thiếu / tiền điều kiện CI threshold

4. **`resolvePackageGrantRange({ unitCount: 0 })` và `unitCount: -1`** → throw.  
5. **`resolvePackageGrantRange` multi existing ranges** — max lấy đúng `toOrderGlobal` lớn nhất khi có gap entitlement.  
6. **`isEntitled([], n)` / `remainingUnits([], n)`** = false / 0 (contract explicit).  
7. **`deriveSessionUnits` khi toàn bộ raw > max** (anchor đã vượt) — mọi stamp capped.  
8. Nâng coverage domain lên ≥90% (config hiện tại) — chủ yếu nhờ #3 + #4.

### P2 — API writer / race / env

9. Unit `rangesOverlap` (touching edges: `[1-2]` vs `[3-4]` no; `[1-3]` vs `[3-5]` yes).  
10. `defaultUnitCountFromEnv` — unset → 4; invalid → 4; valid override.  
11. `grantRangeOnEnrollment`: archived enrollment reject; non-active reject; inverted range; missing program order (đơn lẻ).  
12. Race idempotent `sourceReceiptId` / P2002 path (commented in grant-units; khó flaky — 1 property test hoặc controlled mock).  
13. `revokeFromNext` cắt giữa multi-range rời (chỉ cover 1 range 101–104).  
14. Partial refund **giữ** ranges (comment finance router) — assert explicit vs full refund delete.

### P3 — Chất lượng harness / chống false confidence

15. **Ngừng / hạn chế `ensureProgramUnitAxis` continuous-only** cho suite “curriculum-axis realism”; thêm fixture `seedGappedBrightIgAxis()`.  
16. Vitest domain: exclude `dist/**/*.test.js` khỏi run (double count 58 = 29×2).  
17. Open-tier entitlement: range gapped catalog (unit 39 entitled, 40 không tồn tại) — list không crash.  
18. `remainingUnits` khi range “ảo” đếm integer hole (document: remaining là order integer, không phải count CurriculumUnit rows) — 1 test chốt contract.

### Mapping rủi ro → symptom người dùng

| Gap | Symptom có thể |
|-----|----------------|
| Stamp skip hole | Buổi không stamp → roster rỗng / fail-closed |
| Package grant arithmetic | Provision/renewal Bright I.G nổ BAD_REQUEST giữa chừng |
| resolveReferenceAnchor 0% | Migrate/realign neo sai pha → cả lớp lệch unit |
| Continuous-only harness | CI xanh, prod Bright I.G vỡ |

---

## 6. Tóm tắt điều hành

| Hạng mục | Trạng thái |
|----------|------------|
| Domain happy-path progression + entitlement set math | **Tốt** (`unit-progression.test.ts`) |
| Package grant happy path | **Ổn**, thiếu throw `unitCount < 1` |
| Dual-gate roster pure + int | **Tốt** trên trục contiguous |
| Grant/revoke/refund money bridge | **Có** int; chưa gapped curriculum |
| `resolveReferenceAnchor` | **Lỗ hổng 100% untested** |
| Fixture vs khung thật | **Lỗ hổng lớn**: test contiguous; Bright I.G có 5 holes |
| Coverage domain | **~71% lines / ~53% branches** — dưới threshold 90%; coverage **chạy được** |

**Không sửa code trong phiên này.** Report chỉ đọc + chạy Vitest domain.

---

Status: DONE
