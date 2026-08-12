# IMPL — Màn xếp dãy bài (Phase 4 / B6)

**Ngày:** 2026-08-13  
**Nhánh:** `feat/lms-exercise-library`  
**Commit:** không — user cấm commit  
**Quy trình:** `/ak:scout` → `/ak:cook` → `/ak:test`

## Outcome

Màn xếp dãy bài của lớp đã dựng trên admin Console. GĐĐT vào từ phiếu lớp, kéo / thêm bài **đã công bố** từ thư viện sang dãy, sắp đuôi chưa phát, lưu bằng `lmsOps.assignExerciseSequence`. Bốn cảnh báo bắt buộc đều hiện. Typecheck admin 0 lỗi. `npx vitest run` trong `apps/admin`: **65 file / 622 test xanh**.

## Blast radius (GitNexus, trước khi sửa)

| Symbol | Direction | Risk | Ghi chú |
|--------|-----------|------|---------|
| `ClassDetailContent` | upstream | **LOW** | 1 caller: `ClassDetailPage` |
| `teachingRoutes` | upstream | **LOW** | Chỉ lắp route mới |

Không đụng `exercises.tsx`, `exercise-detail.tsx`, `apps/api`, `packages`.

## Scout — hợp đồng dùng lại

- `lmsOps.listExerciseSequence` → `{ items: { position, exerciseId }[] }` — **không** trả `deliveredCount`
- `lmsOps.assignExerciseSequence` → `{ classBatchId, exerciseIds: uuid[] 1..200 }` là **đuôi sau biên đóng băng**, không phải cả dãy
- `Exercise` đã có `title` + `folderId`; `exercise.list` lọc `status` / `folderId` / `type`
- `classSession.list` không kèm `SessionExercise` — biên khoá phải ước lượng từ buổi đã kết thúc + đã đóng dấu unit
- Frame sẵn: `ListPage` + `MasterDetail` (chấm bài), `Callout`, `ConfirmDialog`, `HighlightStrip`, `FilterBar`

## File đổi

| File | Việc |
|------|------|
| `apps/admin/src/pages/teaching/exercise-sequence-model.ts` | **Mới.** Path helper + công thức remaining / freeze / tail / short / addable |
| `apps/admin/src/pages/teaching/exercise-sequence.tsx` | **Mới.** Màn 2 cột + preview lịch |
| `apps/admin/src/pages/teaching/exercise-sequence.test.tsx` | **Mới.** 15 test (model + page) |
| `apps/admin/src/routes/teaching.routes.tsx` | Route `classes/:classBatchId/exercise-sequence` |
| `apps/admin/src/pages/classes/class-detail.tsx` | Nút **Xếp dãy bài** nếu `exercise.manage` |
| `apps/admin/src/pages/classes/class-detail.test.tsx` | 1 test CTA |

URL: `/teaching/classes/:classBatchId/exercise-sequence`  
Vào từ: `/admin/classes/:id` → **Xếp dãy bài**  
Không thêm lá nav (đúng UX report: work-surface của lớp).

## Bốn thứ bắt buộc

| Yêu cầu | Cách hiện |
|---------|-----------|
| Vị trí đã phát khoá + lý do | Vùng mờ, `StatusBadge` “Đã phát — khoá”, `aria-disabled`, không Gỡ/Lên/Xuống, chữ “không sửa được vì học sinh đã nhận bài này.” Callout info giải thích freeze. |
| Vị trí kế phát vào buổi nào | Hàng đầu đuôi: “Vị trí kế tiếp sẽ phát vào buổi {ngày}.” HighlightStrip “Buổi kế phát”. |
| Lớp chưa có dãy | `Callout tone="danger"` + `EmptyState`. Copy: sau khi bỏ fallback, không dãy = không có bài nào. Nút Lưu disabled. |
| Dãy ngắn hơn buổi còn lại | `Callout tone="warning"`: còn N bài chưa phát / M buổi; không tự lặp. Preview buổi thiếu: “Không có bài — dãy đã hết”. |

Chỉ `status === 'published'` hiện ở cột trái và `canAddExercise`. Không nhân bản bài đã có trong dãy. Không tự lặp khi dãy ngắn.

Lưu chỉ gửi `exerciseIds` của **đuôi**. Test khoá: dãy `[1=A, 2=B]` + 1 buổi đã phát → mutate `{ exerciseIds: [B] }`.

## Ca biên từ VD-B5-ux đã giữ

- Empty = danger, không cho lưu 0 bài (API `min(1)`)
- Payload chỉ đuôi — tránh nhân bản bài đã phát
- Draft không kéo được
- Dirty leave: `ConfirmDialog`
- Gỡ đuôi: confirm trước khi lưu
- Lớp `completed` / `cancelled` / `closed`: read-only
- Giáo viên gõ URL: EmptyState `exercise.manage`
- Keyboard: Thêm / Lên / Xuống / Gỡ (kéo HTML5 chỉ phụ)

## Review (code-reviewer) và cách xử lý

Reviewer chặn ship vì UI **đoán** `deliveredCount` từ buổi đã kết thúc rồi gửi đuôi đoán đó. Overestimate → Lưu xoá bài chưa phát. Underestimate → nhân bản bài đã phát.

**Đã sửa, vẫn không đụng API:**

- Không còn `estimateDeliveredCount` trên đường lưu / khoá
- Lớp **chưa có dãy**: xếp lần đầu, gửi cả draft (biên = 0)
- Lớp **đã có dãy** mà chưa có `deliveredCount` từ mutation phiên này: Callout danger, **không lưu**, không sửa — fail-closed
- Sau `assign` thành công: dùng `result.deliveredCount`, khoá phần đã phát, lần lưu sau chỉ gửi đuôi
- Cảnh báo ngắn so **đuôi** với buổi còn lại (không so tổng dãy)
- Lưu chỉ khi dirty + toàn bộ đuôi published
- `useUnsavedBlocker`, `ListPagination`, hàng khoá `role="group"` + `aria-describedby`

**Nợ API thật:** `listExerciseSequence` cần trả `deliveredCount` thì mới sửa được dãy đã có khi mở lại trang. Ghi rõ trên màn.

## Validation

```
cd apps/admin && npx tsc -p tsconfig.json --noEmit   # exit 0
cd apps/admin && npx vitest run                      # 65 files, 622 passed
```

Test mới phủ: empty danger, ẩn draft, short warning, khoá phần đã phát, save chỉ đuôi, xếp ≥ 4 bài, 403 giáo viên, CTA từ phiếu lớp.

## Không làm

- Không commit
- Không sửa thư viện / phiếu bài / API / packages
- Không thêm nav “Xếp dãy bài”
