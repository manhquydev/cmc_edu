# Phase 3 (H1+H2) — Hoàn tất

**Ngày:** 2026-07-15 · **TDD:** đỏ→xanh đủ 3 bước theo plan · **Regression:** 780/780 test (90 file) · **Typecheck:** 26/26 package

## Thay đổi code
| File | Thay đổi |
|---|---|
| `apps/api/src/attendance/assert-teacher-owns-class.ts` | Mới. `assertTeacherOwnsClass` + `assertTeacherOwnsSessionClass` — director bypass, non-teacher bypass, fail-closed khi thiếu AppUser, fail-closed khi `teacherAppUserId=null` (quyết định PO) |
| `apps/api/src/attendance/router.ts` | `mark`, `markAll` gọi guard sau `loadGatedSession`; `listBySession` refactor dùng helper chung thay check inline cũ (fail-open) |
| `apps/api/src/submission/router.ts` | `grade` guard qua enrollment đang active của học sinh (resolve classBatch sở hữu) |
| `apps/api/src/assessment/router.ts` | `draftComment`, `confirm`, `discard` guard qua `assertTeacherOwnsSessionClass` |
| `apps/api/src/session-evidence/router.ts` | `upsert` (check trực tiếp classBatchId), `addPhoto`, `publish` guard qua helper |
| Test mới: `attendance/assert-teacher-owns-class.test.ts` (6 test đơn vị) |
| Test mới: `attendance/teacher-scoping-cross-router.test.ts` (10 test tích hợp — chứng minh guard được wire đúng ở tất cả router) |
| Test sửa (fixture teacher AppUser + `teacherAppUserId`): `attendance/gate.test.ts`, `attendance/list-for-child.test.ts`, `session-evidence/publish.test.ts`, `submission/grade.test.ts`, `assessment/draft-confirm.test.ts`, `exercise/open-tier.test.ts` |

## Vấn đề hạ tầng/lỗi thật gặp và xử lý
1. **RLS "not found" trong test helper đơn vị** — do gọi `assertTeacherOwnsClass(testDb(), ...)` với client chưa scope facility. Sửa: bọc mọi call trong `withFacility(testDb(), facility.id, ...)` — đúng convention thật của mọi router procedure.
2. **31 test fixture vỡ** ở 5 file do fail-closed mới (teacher thiếu AppUser+teacherAppUserId) — dự kiến trước trong plan (Step 5), sửa bằng seed AppUser + gán teacherAppUserId ở từng `beforeEach`.
3. **`tx.exercise.delete()` "permission denied"** trong test tích hợp mới — `cmc_app` không có quyền DELETE trên Exercise (convention append-only). Sửa: dùng `cleanupCurriculumUnits()` (kết nối privileged) thay vì delete thủ công.
4. **`AppUser.userId` unique constraint violation** khi chạy lại test tích hợp — `userId` là unique TOÀN CỤC (không theo facility), literal cứng `'gv-a'`/`'gv-b'` va với dữ liệu mồ côi từ lần chạy lỗi trước. Sửa tận gốc: random hoá userId mỗi lần chạy (`randomUUID().slice(0,8)` suffix).
5. **FK violation cascading, 11 facility mồ côi** — do gọi `cleanupCurriculumUnits()` TRƯỚC `cleanupFacility()` trong `afterEach` (thứ tự sai khiến lần fail đầu tiên không reset state, kéo theo mọi test sau cùng lỗi). Sửa: đảo thứ tự (`cleanupFacility` trước), dọn thủ công 11 facility mồ côi bằng script tạm rồi xoá.
6. **4 test `exercise/open-tier.test.ts` fail ngoài phạm vi rà soát ban đầu** — phát hiện qua full regression, không phải 4 file đã scope trước. Nguyên nhân: 4 test dùng caller giáo viên tạm (`teacher-ot-1..4`) không có fixture AppUser. Sửa: seed 1 AppUser dùng chung (`teacher-ot-shared`) trong `beforeEach`, đồng bộ cả 4 literal.
7. **2 lỗi type thật trong `assert-teacher-owns-class.test.ts`** phát hiện qua `pnpm typecheck` (không phải lỗi hạ tầng): (a) tham số `assertAsSubject` khai `roles: string[]` thay vì union `Role[]` — sửa dùng type `AuthSubject` từ `@cmc/auth`; (b) đọc `teacher.userId` nhưng `seedAppUser` trả về `{id, employeeCode}` không có `userId` — sửa dùng lại literal userId đã dùng để seed.
8. Sau khi sửa 6+7, chủ động grep toàn bộ `apps/api/src/**/*.test.ts` cho 10 thủ tục vừa guard — tìm thấy 8 file gọi, 7 đã có fixture đúng, 1 file (`submission/list-for-child.test.ts`) dùng caller GĐĐT (director bypass) nên không cần sửa.

## Đối chiếu Success Criteria (phần thuộc Phase 3)
- [x] Giáo viên không thể `attendance.mark`/`markAll`/`listBySession` trên lớp không phải của mình (FORBIDDEN).
- [x] Guard áp dụng nhất quán cho `submission.grade`, `assessment.draftComment/confirm/discard`, `sessionEvidence.upsert/addPhoto/publish`.
- [x] Director (`super_admin`/GĐĐT/GĐKD) không bị chặn — bypass rõ ràng.
- [x] Lớp chưa gán giáo viên (`teacherAppUserId=null`) chặn giáo viên thường, chỉ director thao tác được (quyết định PO).
- [x] Fail-closed khi không resolve được AppUser của giáo viên (không còn "để lọt cho qua test" như code cũ).

## Unresolved questions
Không có — Phase 3 khép kín theo đúng plan, không phát sinh quyết định PO mới.
