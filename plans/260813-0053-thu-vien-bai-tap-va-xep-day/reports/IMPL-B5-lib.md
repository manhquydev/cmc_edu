# IMPL-B5-lib — Màn thư viện bài tập

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Nhánh:** `feat/lms-exercise-library`  
**Phase:** 3 — màn thư viện  
**Không commit.**

## Việc đã làm

Đổi màn `/teaching/exercises` từ danh mục gắn unit sang thư viện theo thư mục phẳng.

| File | Việc |
|------|------|
| `apps/admin/src/pages/teaching/exercises.tsx` | Cây thư mục trái (`MasterDetail` như chấm bài) + bảng bài phải. Tạo / đổi tên / ẩn thư mục. Tải bài (`folderId` + `title` + type + PDF). Tìm theo tên khi danh sách dài. |
| `apps/admin/src/pages/teaching/exercise-detail.tsx` | Bỏ `curriculumUnit` / `curriculumUnitId`. Header = tên bài + tên thư mục. Công bố / Đóng giữ trên form. |
| `apps/admin/src/pages/teaching/exercises.test.tsx` | 11 test theo hợp đồng mới |
| `apps/admin/src/pages/teaching/exercise-detail.test.tsx` | Mock `title` + `folder`; 6 test publish/close giữ nguyên |

Ẩn thư mục gọi `exerciseFolder.archive` (chỉ `archivedAt`). Copy và toast nói rõ **dãy lớp không đổi**. Không ghi `ClassExerciseItem`.

Publish/close **không** đưa lên list — giữ quy tắc resource-centric (HITL trên phiếu).

## Scout (tóm tắt)

- API: `exerciseFolder.{create,update,archive,list}`; `exercise.create` nhận `folderId`+`title`; `list` lọc `folderId`; `get` include `folder`.
- `exercise.list` không có `q` → tìm kiếm client-side.
- Không có API “bài đang nằm trong dãy lớp nào” và không có procedure reorder → không bịa cột / nút.
- Pattern UI: `ListPage` + `FilterBar` + `MasterDetail` (`grading.tsx`).

## Kiểm chứng

```text
cd apps/admin
npx tsc -p tsconfig.json --noEmit   → 0 lỗi
npx vitest run src/pages/teaching/exercises.test.tsx \
               src/pages/teaching/exercise-detail.test.tsx
→ 17/17 xanh (tester xác nhận lại)
```

`npx vitest run` toàn `apps/admin`: **620 xanh, 2 đỏ** trong `exercise-sequence.test.tsx` — ngoài file được giao, không sửa.

Không chạy trình duyệt (không có lệnh mở app trong nhiệm vụ). Hành vi được khóa bằng unit test + typecheck.

## Review (code-reviewer)

High: dialog ghi không hiện lỗi → đã vá `Banner` + `purpose="form"`.  
Không đưa vào slice này: persist folder trên URL, rename bài, reorder, cột “đang trong dãy lớp” (thiếu API).

## Còn lại

- Phase 3 “đổi thứ tự” + “bài đang trong dãy lớp nào” cần API / phase 4.
- Toàn suite admin chưa xanh vì màn xếp dãy (file khác).
