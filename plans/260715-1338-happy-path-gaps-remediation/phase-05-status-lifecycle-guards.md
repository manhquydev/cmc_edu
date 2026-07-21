---
phase: 5
title: Status & Lifecycle Guards
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 5: Status & Lifecycle Guards (pattern gốc #2)

## Overview
Model đã có field `ClassSession.status` (`cancelled`/`done`) và `Student.lifecycle` (`withdrawn`/`blocked_lms`) nhưng nhiều thủ tục liên quan **quên kiểm** → tạo evidence cho buổi đã huỷ, đặt họp cho HS nghỉ học, phụ huynh vẫn thấy HS đã rút. Gom thành 1 pattern guard tái dùng + áp ~6 điểm.

## Requirements
- Functional:
  - Session `cancelled` → chặn `sessionEvidence.upsert/addPhoto/publish`; chặn `classSession.assignUnit` khi `done`; khi `classSession.cancel`, xử lý Attendance đã ghi (flag, không xoá).
  - Student `withdrawn` (void/xoá hẳn) → chặn `parentMeeting.schedule`; `guardian.approveLink` chặn; `getApprovedChildren` ẩn (`withdrawn` + `blocked_lms`).
  - Huỷ-phiếu-thường (lifecycle vẫn active, enrollment withdrawn) → phụ huynh **VẪN thấy** con (đảo K9 — PO chốt vòng 3, xem chi tiết dưới).
- Non-functional: guard nhất quán (cùng thông báo lỗi, cùng nơi đặt), không nuốt lỗi im lặng.

## Architecture
Hai guard nhỏ thuần, đặt cạnh domain tương ứng:
- `assertSessionActive(session)` — ném `badRequest` nếu `status==='cancelled'` (hoặc `done` cho các thao tác cấm-sau-done như assignUnit).
- `assertStudentActive(student)` — ném `badRequest`/`forbidden` nếu `lifecycle` ∈ {withdrawn, blocked_lms} tùy ngữ cảnh.
- `getApprovedChildren` (`approved-children.ts:43-87`) — **ĐẢO quyết định K9 (PO chốt vòng 3):**
  - K9 hiện ẩn học sinh có MỌI enrollment `withdrawn` (dòng 80-85) — coi "con đã huỷ phiếu hiện mãi" là bug. PO đổi: **giữ hiện để phụ huynh xem lịch sử** (phụ huynh đã có link Guardian hợp lệ, xem lại con mình — rủi ro riêng tư thấp).
  - **BỎ** nhánh ẩn theo enrollment-all-withdrawn; **giữ** ẩn theo lifecycle. Filter mới: `lifecycle: { notIn: ['blocked_lms','withdrawn'] }`. Nghĩa: huỷ-phiếu-thường (enrollment withdrawn, lifecycle vẫn active) → **VẪN HIỆN**; cấm kỷ luật (`blocked_lms`) hoặc xoá-hẳn/void (`withdrawn`) → **ẨN**.
  - Đây là con đường "xoá hẳn" rõ ràng: muốn ẩn con khỏi phụ huynh thì dùng huỷ chế độ `void` (set lifecycle=withdrawn), không phải huỷ thường.

Quyết định "dọn attendance khi huỷ buổi" (open question #2): **flag, KHÔNG xoá** — giữ append-only (TimePunch/Attendance là lịch sử). Cách: khi `classSession.cancel`, KHÔNG đụng Attendance rows; thay vào đó đảm bảo `attendance.listBySession`/`listForChild` + report tính toán đã loại session cancelled (một số đã loại ở `recomputeFinalGrade` — verify + đồng bộ nơi đọc raw).

## Related Code Files
- Create: `apps/api/src/class/assert-session-active.ts` (+ test)
- Create: `apps/api/src/student/assert-student-active.ts` (+ test)
- Modify: `apps/api/src/session-evidence/router.ts:159,243,274` (upsert/addPhoto/publish)
- Modify: `apps/api/src/class/class-session-router.ts:213-238` (`assignUnit` — chặn khi `done`), `:96-135` (`cancel` — đảm bảo nơi đọc loại session cancelled)
- Modify: `apps/api/src/meeting/router.ts:28-47` (`schedule` — assertStudentActive)
- Modify: `apps/api/src/guardian/router.ts:124-171` (`approveLink` — kiểm lifecycle)
- Modify: `apps/api/src/guardian/approved-children.ts:54` (filter thêm `withdrawn`)
- Modify (test): các sibling `*.test.ts` tương ứng

## Implementation Steps (TDD)
1. **Guards đỏ→xanh:** unit test `assert-session-active` (active pass, cancelled throw, done throw khi cấm) + `assert-student-active` (active pass, withdrawn/blocked throw). Impl. Xanh.
2. **session-evidence (upsert/addPhoto/publish):** mỗi thủ tục — test đỏ: gọi trên session cancelled → assert lỗi. Impl chèn `assertSessionActive`. Xanh.
3. **assignUnit khi done:** test đỏ đổi curriculumUnit của session `done` → assert lỗi. Impl. Xanh. (Mirror rule một-chiều của `cancel`.)
4. **meeting.schedule:** test đỏ đặt họp cho HS `withdrawn` → assert lỗi. Impl. Xanh.
5. **guardian.approveLink + approved-children (đảo K9):**
   a. Test đỏ — `getApprovedChildren`: HS huỷ-phiếu-thường (enrollment all withdrawn, lifecycle active) → **VẪN trả về** (đảo K9). Chạy → đỏ (K9 đang ẩn).
   b. Test đỏ — HS `void`/`withdrawn` lifecycle → **KHÔNG** trả về; HS `blocked_lms` → KHÔNG trả về. Chạy → đỏ.
   c. Impl: bỏ nhánh ẩn enrollment-all-withdrawn, đổi filter lifecycle `notIn [blocked_lms, withdrawn]`.
   d. **Cập nhật test K9 cũ** (`guardian/link.test.ts`, `lms-auth/login.test.ts`) đang assert hành vi ẩn — viết lại theo quyết định mới. Chạy → xanh.
   e. approveLink khi student `withdrawn` → chốt: chặn (không link tới bé đã xoá hẳn). Test + impl. Xanh.
6. **cancel session ↔ attendance consistency:** test đỏ — huỷ session có Attendance rồi đọc qua `listBySession`/`listForChild` → assert session cancelled không hiện như buổi hợp lệ / hoặc gắn cờ rõ ràng; đối chiếu report tổng hợp nhất quán. Impl nơi đọc. Xanh.
7. **Regression:** `pnpm --filter @cmc/api test session-evidence class meeting guardian` xanh.

## Success Criteria
- [ ] Không tạo/publish được evidence cho session cancelled.
- [ ] Không đổi được curriculumUnit của session `done`.
- [ ] Không đặt được họp cho HS withdrawn/blocked.
- [ ] `getApprovedChildren`: huỷ-phiếu-thường VẪN hiện con (đảo K9); `void`/`blocked_lms` ẩn; test K9 cũ đã viết lại; approveLink chặn student withdrawn.
- [ ] Attendance của session cancelled không mâu thuẫn giữa raw view và report tổng hợp.

## Risk Assessment
- Rủi ro: siết `done`/`cancelled` phá luồng sửa-sai hợp lệ (vd cần sửa evidence sau khi buổi done?). Mitigation: chỉ chặn `cancelled` cho evidence-write; với `done` chỉ chặn assignUnit (đổi bài cho cả lớp) — không chặn sửa evidence của buổi đã dạy. Xác nhận ranh giới với hành vi hiện có trước khi siết.
- Rủi ro CAO (đảo K9): thay đổi ranh giới hiển-thị-dữ-liệu-trẻ (privacy boundary có test). Mitigation: cập nhật đúng test K9 cũ + thêm test mới cho cả 3 trạng thái (huỷ-thường hiện / void ẩn / blocked ẩn); xác nhận `enrollment.mine`/`listForChild` nhất quán. Ghi rõ đây là quyết định PO đảo K9, không phải bug regression.
- Ghi chú riêng tư: giữ hiện con huỷ-phiếu-thường an toàn vì phụ huynh đã có Guardian link hợp lệ (quan hệ thật, xem lại con MÌNH, read-only). Ai muốn cắt hẳn → dùng huỷ `void`.
