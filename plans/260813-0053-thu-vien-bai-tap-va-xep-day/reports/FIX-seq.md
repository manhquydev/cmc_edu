# FIX — listExerciseSequence thiếu deliveredCount

**Ngày:** 2026-08-13  
**Nhánh:** `feat/lms-exercise-library`  
**Commit:** không  
**Quy trình:** `/ak:fix` → `/ak:test`

## Intent

- **Outcome:** Tải lại / mở lại màn xếp dãy của lớp đã có dãy vẫn sửa được phần đuôi chưa phát.
- **Constraints:** Chỉ sửa `lms-ops/router.ts` + màn/model/test xếp dãy. Không đoán biên từ buổi học.
- **Non-goals:** Không đổi `writeSequenceUpdate` / con trỏ phát bài.
- **Acceptance:** API trả `deliveredCount`; UI đọc field đó; test reload sửa đuôi; tsc api+admin 0 lỗi; vitest admin xanh.

## Chẩn đoán

| | |
|---|---|
| Symptom | Callout “Chưa biết biên đã phát — không lưu”; nút Lưu disabled vĩnh viễn với lớp đã có dãy. |
| Repro | Lưu dãy → reload / mở lại hôm sau. |
| Expected | Đuôi chưa phát sửa và lưu được. Phần đã phát vẫn khoá. |
| Actual | `hasAuthoritativeFreeze(items.length, assignedDeliveredCount=null)` = false khi `items.length > 0`. |
| Root cause | `listExerciseSequence` (`router.ts` ~664) chỉ `{ items }`. `assignedDeliveredCount` chỉ set sau `assign` **trong cùng phiên**. `deliveredCountForBatch` đã có sẵn, không được trả ra. |
| Why now | Fail-closed sau review đoán biên — đúng hướng nhưng thiếu field list. |
| Blast radius | Chỉ consumer: màn xếp dãy. Additive: thêm field, không xoá `items`. |

## Sửa

1. **API** — `listExerciseSequence` gọi `deliveredCountForBatch` (cùng hàm `writeSequenceUpdate` dùng: `MAX(SessionExercise.position)`), trả `{ items, deliveredCount }`.
2. **Màn** — `deliveredCount = assigned ?? seq.deliveredCount`. `0` là biên hợp lệ. Freeze-unknown chỉ còn khi payload thiếu field.
3. **Test**
   - Admin: reload với `listedDeliveredCount: 1` → không hiện “Chưa biết biên”; Xuống + Lưu gửi đúng đuôi `[C, B]`.
   - Admin: list thiếu field vẫn fail-closed.
   - API int: sau deliver, `listExerciseSequence.deliveredCount === 1`.

## Validation

```
cd apps/api   && npx tsc -p tsconfig.json --noEmit   # 0
cd apps/admin && npx tsc -p tsconfig.json --noEmit   # 0
cd apps/admin && npx vitest run                      # 65 files, 623 passed
```

Không commit.
