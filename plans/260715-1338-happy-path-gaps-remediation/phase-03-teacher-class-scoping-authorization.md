---
phase: 3
title: Teacher Class-Scoping Authorization
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 3: Teacher Class-Scoping Authorization (H1 + H2 + Học vụ #3)

## Overview
Lỗ hổng lặp ở 4+ router: giáo viên có quyền `attendance.mark` / `submission.grade` / `assessment.*` / `sessionEvidence.*` thao tác được trên **mọi** lớp trong cơ sở, không riêng lớp mình phụ trách. Cơ chế kiểm tra "lớp của mình" đã tồn tại ĐÚNG 1 chỗ (`attendance.listBySession:240-259`, dùng `ClassBatch.teacherAppUserId`) nhưng chưa lan sang các thủ tục GHI, và bản thân nó fail-open khi thiếu AppUser.

## Requirements
- Functional: giáo viên chỉ-là-giáo-viên (không kiêm director) chỉ thao tác được trên lớp có `teacherAppUserId === chính họ`. Director (super_admin/GĐĐT/GĐKD) giữ quyền rộng.
- **Quyết định PO — lớp CHƯA gán giáo viên (`teacherAppUserId = null`): CHẶN giáo viên, chỉ director thao tác được.** (Trước đây plan định cho pass — PO đổi: buộc gán GV đúng trước khi GV đụng lớp.)
- Non-functional: 1 helper dùng chung (DRY) thay 5 bản copy; **fail-closed** khi không resolve được AppUser (đóng lỗ hổng Học vụ #3), kèm chiến lược test-fixture để không phá test cũ.

## Architecture
Trích pattern từ `listBySession` thành helper thuần, đặt cạnh các helper attendance sẵn có:
```
// apps/api/src/attendance/assert-teacher-owns-class.ts  (mới)
export async function assertTeacherOwnsClass(
  tx, facilityId, subject, classBatchId
): Promise<void> {
  const hasDirectorRole = subject.roles.some(r =>
    ['super_admin','giam_doc_dao_tao','giam_doc_kinh_doanh'].includes(r));
  if (hasDirectorRole) return;                 // director: broad access
  if (!subject.roles.includes('giao_vien')) return; // no teacher scope to enforce
  const appUser = await tx.appUser.findFirst({
    where: { userId: subject.userId, facilityId }, select: { id: true } });
  if (!appUser) throw forbidden('Teacher profile not found in this facility.'); // FAIL-CLOSED
  const batch = await tx.classBatch.findFirst({
    where: { id: classBatchId, facilityId }, select: { teacherAppUserId: true } });
  if (!batch?.teacherAppUserId)                 // PO: lớp chưa gán GV → chỉ director
    throw forbidden('Class has no assigned teacher; only a director can act on it.');
  if (batch.teacherAppUserId !== appUser.id)
    throw forbidden('Teachers may only act on their own classes.');
}
```
Áp helper vào mọi thủ tục GHI có `classBatchId` (qua session/submission/evidence). `listBySession` refactor để gọi cùng helper (bỏ bản copy inline + bỏ fail-open cũ).

## Related Code Files
- Create: `apps/api/src/attendance/assert-teacher-owns-class.ts`
- Create: `apps/api/src/attendance/assert-teacher-owns-class.test.ts` (unit thuần cho helper)
- Modify: `apps/api/src/attendance/router.ts` — `mark:125`, `markAll:174`, refactor `listBySession:240-259` gọi helper
- Modify: `apps/api/src/submission/router.ts:283` (`grade`)
- Modify: `apps/api/src/assessment/router.ts:180` (`draftComment`), `:225`/`:267` (`confirm`)
- Modify: `apps/api/src/session-evidence/router.ts:159` (`upsert`/`addPhoto`), `:274` (`publish`)
- Modify (test fixtures): các test hiện dùng synthetic userId cho giáo viên — seed AppUser + gán `teacherAppUserId` cho batch dùng trong test.

## Implementation Steps (TDD)
1. **Test helper đỏ:** unit `assert-teacher-owns-class.test.ts` — 6 case: director bypass; non-teacher bypass; teacher đúng lớp pass; teacher sai lớp FORBIDDEN; teacher thiếu AppUser → **FORBIDDEN (fail-closed)**; **teacher trên lớp chưa gán GV (`teacherAppUserId=null`) → FORBIDDEN (PO)**. Chạy → đỏ (chưa có file).
2. **Impl helper.** Chạy → xanh.
3. **Refactor `listBySession`** gọi helper; xoá bản inline + fail-open. Chạy test attendance list cũ → sửa fixture nếu đỏ do fail-closed (seed AppUser). Xác nhận hành vi giữ nguyên cho case hợp lệ.
4. **Từng thủ tục GHI (lặp cho mark, markAll, grade, draftComment, confirm, upsert, addPhoto, publish):**
   a. Test đỏ: giáo viên B thao tác trên lớp của giáo viên A → assert FORBIDDEN. Chạy → đỏ.
   b. Impl: chèn `await assertTeacherOwnsClass(tx, facilityId, ctx.subject, batchId)` sau khi resolve session/batch. Chạy → xanh.
   c. Giữ test "giáo viên đúng lớp thao tác được" xanh (bổ sung nếu chưa có).
5. **Migrate test fixtures fail-open→fail-closed:** rà mọi test giáo viên dùng synthetic userId; seed AppUser thật + `teacherAppUserId`. Đây là công việc chính khiến lỗ hổng tồn tại — làm dứt điểm, không để lại escape hatch trong code sản phẩm.
6. **Regression:** `pnpm --filter @cmc/api test attendance submission assessment session-evidence` xanh.

## Success Criteria
- [ ] Helper 6 case xanh, gồm fail-closed khi thiếu AppUser VÀ chặn GV trên lớp chưa gán GV.
- [ ] 8 thủ tục GHI (mark, markAll, grade, draftComment, confirm×2, upsert, publish) đều FORBIDDEN khi giáo viên thao tác lớp không phụ trách; director vẫn rộng quyền.
- [ ] `listBySession` dùng chung helper, không còn bản copy/fail-open.
- [ ] Không còn escape hatch "let through to avoid breaking tests" trong code sản phẩm.

## Prod-safety của fail-closed (red-team)
Fail-closed an toàn cho prod vì hệ thống **đã** yêu cầu staff có AppUser: `checkin.punch:175` ném `forbidden('Staff profile not found in this facility')` khi thiếu AppUser. Không có giáo viên thật nào vận hành mà không có AppUser row → siết fail-closed không khoá nhầm người dùng thật, chỉ chặn synthetic test userId. Đây là lý do "let through to avoid breaking tests" chỉ là nợ test, không phải ràng buộc sản phẩm.

## Risk Assessment
- Rủi ro CHÍNH: siết fail-closed phá nhiều test synthetic-userId. Mitigation: Step 5 budget riêng cho migrate fixtures; đây là lý do fail-open tồn tại → phải trả dứt điểm, không lách. Prod an toàn (xem mục trên).
- Rủi ro: batch chưa gán `teacherAppUserId` (null) → helper CHẶN giáo viên (PO chốt). Hệ quả vận hành: buổi học của lớp chưa gán GV, giáo viên KHÔNG điểm danh/chấm được tới khi giám đốc gán GV. Cần đảm bảo luồng gán GV cho lớp tồn tại & dễ dùng trước khi bật gate này (nếu nhiều lớp đang null, gán trước). **Không có dạy-thay trong scope** (PO chọn "chặn, chỉ giám đốc" — chưa cần model multi-teacher).
- Rủi ro: giáo viên kiêm director → bypass. Đúng thiết kế (director rộng quyền).
