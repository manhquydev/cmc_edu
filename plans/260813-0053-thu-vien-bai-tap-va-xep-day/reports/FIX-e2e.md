# FIX-e2e — P2-04 journey + cleanup folder

**Ngày:** 2026-08-13
**Nhánh:** `feat/lms-exercise-library`
**Phạm vi:** `apps/e2e/**` only
**Không commit**

## Intent

- Outcome: journey P2-04 đi được trên màn thư viện mới; teardown chỉ xóa đúng thứ caller truyền, kể cả folder + bài journey tạo.
- Non-goals: không sửa admin/API; không chạy Playwright (không có stack UI trong nhiệm vụ).
- Acceptance: `cd apps/e2e && npx tsc -p tsconfig.json --noEmit` = 0 lỗi.

## Chẩn đoán

| # | Symptom | Root cause |
|---|---------|------------|
| HIGH | Journey chết ở click đầu (chọn unit / không có "+ Tạo bài tập") | `exercise-publish-close.journey.ui.spec.ts` còn `getByRole('button', { name: /Đơn vị học/ })` và seed unit. `exercises.tsx` không còn selector unit: trái là folder, "+ Tạo bài tập" chỉ hiện khi đã chọn folder; 0 folder → "Chưa có thư mục". |
| MEDIUM | Bài/folder ma tích lũy | `cleanupCurriculumUnits` (`db.ts`) quét `folder.name startsWith 'E2E '` thay vì `unitIds`; **không xóa `ExerciseFolder`**. Bài P2-04 tạo qua UI nằm folder người dùng chọn (không prefix E2E) → không bao giờ được dọn. |

Blast radius GitNexus: `cleanupCurriculumUnits` **LOW** — caller duy nhất là journey P2-04. `cleanupExercises` (các journey chấm/sao) không đụng, vẫn xóa folder theo `exerciseId`.

## Sửa

1. **Journey** seed `ExerciseFolder` unique, click folder `role=button` đúng tên, điền **Tên bài tập**, loại, PDF, tạo. Tìm hàng bằng title; badge list là **Nháp** (không còn chữ `draft`). afterAll gọi `cleanupExerciseLibrary(folderId)`. Không còn seed/cleanup unit.
2. **`cleanupCurriculumUnits`** chỉ `deleteMany` đúng `unitIds`.
3. **Thêm** `seedExerciseFolder` + `cleanupExerciseLibrary(folderIds)` — xóa submission → SessionExercise → ClassExerciseItem → Exercise → ExerciseFolder.

## Verify

```
cd apps/e2e && npx tsc -p tsconfig.json --noEmit
→ exit 0
```

Playwright P2-04 **không chạy** trong lượt này (cần API + admin + `E2E_FACILITY_ID`). Chưa chứng minh click selector trên browser.

Tester (code-only): hai lỗi đã vá. Ghi nhận ngoài phạm vi: `seedPublishedExercise` vẫn tạo `CurriculumUnit` không còn FK tới bài; bốn journey kia chỉ `cleanupExercises` nên unit `E2E Unit *` vẫn có thể tích lũy. Không đụng trong lượt này.

## File

- `apps/e2e/tests/journeys/exercise-publish-close.journey.ui.spec.ts`
- `apps/e2e/src/db.ts`
