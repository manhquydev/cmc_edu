---
phase: 2
title: "Parent-Visibility-Submission-Attendance"
status: completed
priority: P1
dependencies: []
---

# Phase 2: Parent-Visibility-Submission-Attendance

## Overview
Đóng 2 gap so với định nghĩa vai trò LMS của PO: PH xem **điểm/kết quả bài tập của con** và thấy
**buổi con nghỉ học** trong per-session view. Hiện `submission` chỉ có student-write
(saveDraft/submit), `attendance` router 0 procedure LMS (verify 2026-07-10).

## Requirements
- Functional: (a) PH (parent session) list được bài tập con đã nộp kèm điểm + sao GV chấm; (b)
  per-session view của con hiển thị trạng thái điểm danh — absent hiện "Nghỉ học", late hiện "Đi muộn",
  buổi absent không kỳ vọng ảnh/evidence.
- Non-functional: mọi truy cập qua `getApprovedChildren` + `auditChildDataAccess` (pattern y hệt
  `assessment.listForChild` — copy pattern, không sáng tạo mới); KHÔNG lộ `internalNote`/dữ liệu nội
  bộ; read-only; RLS giữ nguyên.
- Scope boundary: KHÔNG thêm view tiền/phiếu thu; KHÔNG thêm push/notification; KHÔNG đổi student UI.

## Architecture

**Gate PHẢI copy TRỌN body `assessment.listForChild` (`assessment/router.ts:294-347`), không chỉ prose:**
1. `requireLmsParent(ctx)` — **parent-only** (quyết định chốt: PH xem điểm con; HS đã có view riêng của
   mình qua `exercise.openForStudent`/`student/home`, không cần listForChild). Success criteria
   "student-kind → FORBIDDEN" khớp với `requireLmsParent`. **KHÔNG dùng biến thể cho phép student-kind
   của assessment** — chỉ copy phần RLS + approved-children, không copy phần nới student.
2. `studentId ∈ getApprovedChildren(parentAccountId)` — nếu không → FORBIDDEN.
3. Resolve `student.facilityId`, chạy read TRONG `withFacility(ctx.db, student.facilityId, ...)` —
   **BẮT BUỘC**: `getApprovedChildren` chạy RLS-bypass cross-facility (`approved-children.ts:43-59`),
   nên read con phải TÁI LẬP facility GUC (bất biến RLS, red-team H1). Bỏ bước này = mất lớp RLS
   defense-in-depth dù studentId filter vẫn bound đúng con.
4. `auditChildDataAccess({ via: 'submission.listForChild' | 'attendance.listForChild' })`.

**2a. `submission.listForChild`** (lmsProcedure mới trong `submission/router.ts`):
- Input: `{ studentId }` (uuid). Gate: 4 bước trên.
- Query trong withFacility: Submission where `studentId`, join Exercise (`title`, `starReward`).
  Select TƯỜNG MINH: `{ id, exerciseTitle: exercise.title, status, submittedAt, score, gradedAt,
  starReward: exercise.starReward }`. **Field thật (schema verify): `score` (KHÔNG phải `grade`);
  sao thưởng ở `Exercise.starReward` (KHÔNG phải cột `stars` trên Submission).**
- **CẤM select** `gradedById` (AppUser staff id), `teacherAnnotationLayer`, `annotationLayer`,
  `answerText` — test assert-shape phải FAIL nếu các field này lọt ra (red-team M2/F5).

**2b. `attendance.listForChild`** (lmsProcedure mới trong `attendance/router.ts`):
- Input: `{ studentId }`. Gate: 4 bước trên.
- Query trong withFacility: Attendance where `studentId` (KHÔNG query theo classSessionId — filter theo
  studentId đảm bảo không lộ điểm danh HS khác cùng buổi, red-team F4), join ClassSession
  (`date`/label). Select `{ classSessionId, sessionDate, status }` — enum `present|absent|late`
  (schema.prisma:141-145).

**2c. UI LMS (parent):** trang con hiện có của PH (`parent/home.tsx` = assessment list;
`parent/session-evidence.tsx` = ảnh buổi). Hướng tích hợp:
- Thêm section/trang "Bài tập & điểm" (list từ 2a): tên bài, ngày nộp, điểm, sao; trạng thái
  chưa chấm hiển thị "Chờ chấm".
- Per-session view (session-evidence page): merge attendance status theo classSessionId — buổi
  `absent` render badge "Nghỉ học" + không render khối ảnh như buổi thường (thay bằng dòng ngắn
  "Con nghỉ buổi này"); `late` render badge "Đi muộn" cạnh evidence bình thường.
- Điều hướng từ parent/home. Mobile-first như các trang LMS hiện có (Mantine, pattern sẵn).

## Related Code Files
- Modify: `apps/api/src/submission/router.ts` (+listForChild) · `apps/api/src/attendance/router.ts`
  (+listForChild)
- Modify/Create UI: `apps/lms/src/pages/parent/session-evidence.tsx` (merge attendance) ·
  Create `apps/lms/src/pages/parent/homework-results.tsx` (list bài + điểm) · route + nav trong
  LMS router/parent home.
- Tests: `apps/api/src/submission/` thêm case listForChild (parent thấy đúng con mình; sibling/parent
  khác → FORBIDDEN; student session → FORBIDDEN) · `apps/api/src/attendance/` thêm case listForChild
  (đủ 3 status; gate như trên). Pattern test lấy từ `assessment/draft-confirm.test.ts` + test âm tính
  kind-gate lấy từ e2e kind-isolation tương đương ở tầng unit.
- e2e: mở rộng `apps/e2e/tests/attendance-grading.spec.ts` hoặc spec mới nhỏ: parent client xem điểm
  con sau khi GV chấm (tái dùng fixture sẵn có của spec đó — đã có student+submission+grade flow).

## Implementation Steps
1. Backend 2a (`submission.listForChild`) — copy gate pattern từ assessment.listForChild, viết test
   trước hành vi gate (TDD cho phần security): approved-child pass, sibling FORBIDDEN, student-kind
   FORBIDDEN.
2. Backend 2b (`attendance.listForChild`) — như trên.
3. UI trang "Bài tập & điểm" + merge attendance vào session view; label tiếng Việt: "Nghỉ học",
   "Đi muộn", "Chờ chấm".
4. e2e parent-view case (Mode-aware client `createE2eLmsParentClient` — ĐÃ có sẵn từ commit a554b97).
5. Gates + PR.

## Success Criteria
- [ ] Test gate: sibling + student-kind + non-approved parent đều FORBIDDEN trên cả 2 procedure
  (student-kind FORBIDDEN vì `requireLmsParent` — parent-only).
- [ ] Test RLS: read chạy trong `withFacility(student.facilityId)` — assert facility GUC được set
  (defense-in-depth, không bỏ như prose nháp).
- [ ] Test assert-shape FAIL nếu `gradedById`/`teacherAnnotationLayer`/`annotationLayer`/`answerText`
  lọt ra DTO; `score`/`starReward` trả đúng field thật.
- [ ] Test attendance filter theo studentId (không lộ điểm danh HS khác cùng ClassSession).
- [ ] UI: buổi absent hiển thị "Nghỉ học" và không render khối evidence; bài chưa chấm = "Chờ chấm".
- [ ] e2e: parent client thấy điểm sau khi teacher grade (Mode-B).
- [ ] Gates xanh toàn repo.

## Risk Assessment
- **Lộ dữ liệu nội bộ qua select rộng** → select tường minh từng field, assert shape trong test.
- **N+1/payload nặng** → 2 query phẳng có join, limit mặc định (50, orderBy desc) — đủ cho pilot.
- **UI merge attendance-evidence lệch session** → key theo classSessionId, test case buổi có
  attendance nhưng chưa có evidence và ngược lại.
