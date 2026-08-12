# FIX-manifest — Ba lỗi review (orphan claim, lý do gap, race order)

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Nhánh:** `feat/lms-exercise-library`  
**Không commit.**

## Intent

Sửa sổ nghiệm thu cho khớp UI thật, và hết race `orderInFolder`. Không thêm tính năng để hợp thức hóa claim.

## Chẩn đoán

| # | Triệu chứng | Gốc |
|---|-------------|-----|
| 1 | P2-04 khai `exercise.update` | `rg exercise.update apps/admin/src apps/lms/src` = 0. Chỉ Prisma `exercise.update` trong test API. Bánh xe chắn orphan đếm phủ không tồn tại. |
| 2 | DOCUMENTED_GAPS nói list/assign sequence "chưa có UI" | Sai. Màn `/teaching/classes/:classBatchId/exercise-sequence` gọi cả hai. Không có journey. |
| 3 | Hai `create` cùng thư mục → CONFLICT | `nextOrderInFolder` đọc MAX rồi ghi ngoài transaction (`router.ts` create + chuyển thư mục). |

GitNexus `impact(nextOrderInFolder)`: symbol chưa có trong index (hàm mới). Blast radius quan sát: chỉ `exercise.create` / `exercise.update` trong cùng file. Rủi ro sửa: LOW.

## Sửa

### 1 — `exercise.update` → DOCUMENTED_GAPS

- Bỏ khỏi `expected.trpc` của P2-04.
- Thêm vào `DOCUMENTED_GAPS` với lý do: API có, không màn nào gọi.

Không thêm UI đổi tên/chuyển thư mục.

### 2 — P2-09 + lý do gap đúng

Thêm luồng **P2-09** "Xếp dãy bài cho lớp":

- `lmsOps.assignExerciseSequence`, `lmsOps.listExerciseSequence`
- route `/teaching/classes/:classBatchId/exercise-sequence`
- model `ClassExerciseItem`
- **không** khai journey (không bịa spec)

Hai procedure rời DOCUMENTED_GAPS. Comment còn lại của `lmsOps.*` nói rõ list/assign đã có màn.

**Còn thiếu journey.** P2-09 là `built` + `built-unproven` / `no-journey`. Màn đóng băng dãy cả lớp chưa có e2e. Việc tiếp: viết `*.journey.ui.spec.ts` rồi gắn vào P2-09.

### 3 — Khóa cấp số trong transaction

Cùng khuôn `writeSequenceUpdate` (`pg_advisory_xact_lock`, class 91006 theo `folderId`):

- `create`: `$transaction` → lock → `nextOrderInFolder` → insert
- `update` khi đổi thư mục: lock thư mục đích rồi mới lấy MAX

## Kiểm chứng

```text
npx tsx scripts/acceptance-report/verify.ts
→ 43 luồng (43 built, 0 partial, 0 missing)
→ 13 orphan documented, 0 chưa phân loại
→ exit 0

cd apps/api && npx tsc -p tsconfig.json --noEmit
→ 0 lỗi
```

P2-04 vẫn `built` (không tụt). P2-09 `built`, badge `no-journey`.

`exercise.update` trong `verification.json` orphans.documented với lý do đã viết.

Không thêm test song song (ngoài file sở hữu). Test tuần tự hai homework cùng thư mục vẫn đúng.

## File đụng

- `scripts/acceptance-report/flow-manifest.ts`
- `scripts/acceptance-report/verify.ts`
- `apps/api/src/exercise/router.ts`
