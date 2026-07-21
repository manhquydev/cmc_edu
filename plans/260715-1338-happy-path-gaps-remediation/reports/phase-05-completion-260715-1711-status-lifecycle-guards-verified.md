# Phase 5 (Status & Lifecycle Guards) — Hoàn tất

**Ngày:** 2026-07-15 · **TDD:** đỏ→xanh đủ các bước theo plan · **Regression:** 801/801 test (92 file) · **Typecheck:** 26/26 package

## Thay đổi code
| File | Thay đổi |
|---|---|
| `apps/api/src/class/assert-session-active.ts` | Mới. `assertSessionActive(session, {alsoBlockDone?})` — chặn `cancelled` luôn; chặn thêm `done` khi opt-in |
| `apps/api/src/student/assert-student-active.ts` | Mới. `assertStudentActive(student)` — chặn `withdrawn`; KHÔNG chặn `blocked_lms` (đó là giới hạn đọc-LMS riêng, không phải chặn ghi phía staff) |
| `apps/api/src/session-evidence/router.ts` | `upsert` (session status lấy kèm select), `addPhoto`, `publish` (fetch classSession status qua `evidence.classSessionId`) đều gọi `assertSessionActive` — chặn session `cancelled` |
| `apps/api/src/class/class-session-router.ts` | `assignUnit` gọi `assertSessionActive(session, {alsoBlockDone:true})` — chặn cả `done` lẫn `cancelled` |
| `apps/api/src/meeting/router.ts` | `schedule` gọi `assertStudentActive(student)` — chặn đặt họp cho HS `withdrawn` |
| `apps/api/src/guardian/router.ts` | `approveLink` fetch Student trước khi upsert Guardian, gọi `assertStudentActive` — chặn duyệt link cho HS `withdrawn` |
| `apps/api/src/guardian/approved-children.ts` | **ĐẢO K9** (PO round 3): bỏ nhánh ẩn theo "mọi enrollment withdrawn"; filter mới thuần theo `Student.lifecycle: {notIn:['blocked_lms','withdrawn']}` — huỷ-phiếu-thường (enrollment withdrawn, lifecycle vẫn active) giờ **VẪN HIỆN** con cho phụ huynh; xoá luôn phần query `enrollment.findMany` không còn cần |
| `apps/api/src/attendance/router.ts` | `listForChild` thêm filter `classSession: {status: {not:'cancelled'}}` — đồng bộ với `recomputeFinalGrade` (submission/router.ts) vốn đã loại session cancelled khỏi mẫu số tỷ lệ chuyên cần |
| Test mới: `class/assert-session-active.test.ts` (5), `student/assert-student-active.test.ts` (3) |
| Test thêm case cancelled/done/withdrawn: `exercise/publish.test.ts` (assignUnit ×2), `session-evidence/publish.test.ts` (upsert/addPhoto/publish ×3), `meeting/parent-meeting.test.ts` (withdrawn+blocked_lms ×2), `guardian/link.test.ts` (approveLink withdrawn ×1), `attendance/list-for-child.test.ts` (cancelled session exclude ×1) |
| **Test ĐẢO K9**: `finance/cancel-refund.test.ts` — viết lại test cũ "revokes LMS visibility ... K9" thành "REGULAR cancel keeps LMS visibility" (assert `true` thay vì `false`); thêm test mới "void:true cancel DOES revoke visibility" phủ đúng nhánh còn lại |

## Đảo quyết định K9 — không phải regression
Test gốc (`finance/cancel-refund.test.ts`) từng assert: sau `finance.receiptCancel` (huỷ thường, không `void`), phụ huynh KHÔNG còn thấy con qua `enrollment.mine`. PO đã đảo quyết định này ở vòng 3 brainstorm: huỷ-phiếu-thường chỉ rút chỗ học (`Enrollment.status=withdrawn`), `Student.lifecycle` vẫn `active` → phụ huynh đã có Guardian link hợp lệ, được xem lại lịch sử con mình (rủi ro riêng tư thấp, quan hệ thật, read-only). Muốn ẩn hẳn con → dùng `void:true` (đổi `Student.lifecycle=withdrawn`), vẫn ẩn như cũ — test mới `void:true cancel DOES revoke visibility` phủ nhánh này.

## Vấn đề gặp khi implement
Không phát sinh lỗi hạ tầng hay lỗi thật ngoài dự kiến — mọi test mới/sửa đều xanh ngay lần chạy đầu (thiết kế guard đơn giản, thuần function không side-effect cho 2 helper mới).

## Đối chiếu Success Criteria
- [x] Không tạo/publish được evidence cho session `cancelled` (upsert/addPhoto/publish đều chặn).
- [x] Không đổi được curriculumUnit của session `done` (và `cancelled`).
- [x] Không đặt được họp cho HS `withdrawn`; `blocked_lms` KHÔNG bị chặn (đúng phạm vi — đó là giới hạn đọc-LMS, không phải chặn ghi phía staff).
- [x] `getApprovedChildren`: huỷ-phiếu-thường VẪN hiện con (đảo K9); `withdrawn`(void)/`blocked_lms` ẩn; test K9 cũ đã viết lại; `approveLink` chặn student withdrawn.
- [x] Attendance của session cancelled không mâu thuẫn giữa raw view (`attendance.listForChild`) và report tổng hợp (`recomputeFinalGrade`) — cả 2 giờ cùng loại `cancelled`.

## Unresolved questions
Không có.
