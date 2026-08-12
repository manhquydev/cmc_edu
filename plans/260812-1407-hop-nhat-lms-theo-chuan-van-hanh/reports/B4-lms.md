# B4-lms — LMS nộp bài theo `sessionExerciseId`

**Branch:** `feat/lms-delivery-only-homework`  
**Ownership:** `apps/lms/**` only  
**Workflow:** `/ak:scout` → `/ak:fix` → `/ak:test`  
**Commit:** none

---

## (1) Nguồn danh sách & trường API

| Nguồn | Chi tiết |
|-------|----------|
| List | `trpc.exercise.openForStudent` (`apps/lms` home + exercise detail) |
| API DTO | `OpenHomeworkDto` extends `ExerciseDto` + **`sessionExerciseId: string`** |
| File API | `apps/api/src/exercise/open-tier.ts` L34–37, L135–138 |

**Kết luận:** Procedure **đã trả** `sessionExerciseId`. **Không** cần agent API bổ sung field đó cho submit.

**Thiếu cho UX tốt (ghi nhận, không sửa API trong task này):**

| Field mong muốn | Lý do |
|-----------------|--------|
| `sessionDate` (ICT) | Hiển thị “Buổi 12/08/2026” thay vì mã rút gọn |
| `batchCode` / unit title | Phân biệt lớp / unit khi cùng type |

Hiện tại LMS dùng: route theo `sessionExerciseId` + nhãn “Lần phát {8 hex}” / “Lần phát k/n” khi cùng catalog exercise xuất hiện nhiều lần trong list.

---

## (2) Sửa trang làm bài

| File | Thay đổi |
|------|----------|
| `apps/lms/src/pages/student/exercise.tsx` | Param `sessionExerciseId`; find slot by delivery id; `saveDraft` / `submit` truyền `sessionExerciseId` |
| `apps/lms/src/pages/student/home.tsx` | `key` + navigate `/student/exercise/${sessionExerciseId}`; ordinal khi re-deliver |
| `apps/lms/src/routes/index.tsx` | Path `exercise/:sessionExerciseId` |

---

## (3) UX lần phát mới

- **URL riêng** mỗi lần phát → không dính nhầm submission cũ (unique `sessionExerciseId`).
- **List:** nếu cùng `exercise.id` xuất hiện >1 → “Lần phát 1/2 (làm mới, không phải bài cũ)”.
- **Detail:** dòng supporting “Lần phát {short} · đây là lần làm gắn với buổi đã phát bài”.
- **Empty home:** copy delivery-only (“sau khi buổi kết thúc **và được phát bài**”), không còn ngữ nghĩa Tier A thuần endTime.

**Trade-off:** chưa có ngày buổi trên DTO → nhãn mã rút gọn tạm; API nên bổ sung `sessionDate` sau.

---

## (4) Typecheck

```bash
cd apps/lms && npx tsc -p tsconfig.json --noEmit
```

**Exit 0** — 0 lỗi.

---

## Status: DONE

- Submit/saveDraft dùng `sessionExerciseId`.
- List/route/key theo delivery instance.
- UX re-delivery tối thiểu + note thiếu `sessionDate` cho agent API.
- Không commit; không đụng `apps/api` / e2e / packages.
