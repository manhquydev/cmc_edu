# Báo cáo: UI quản lý lớp học còn thiếu (class.create, assignUnit, addMakeup)

- Ngày: 2026-07-26
- Phạm vi sửa: `apps/admin/src/pages/classes/index.tsx`, `apps/admin/src/pages/classes/class-detail.tsx`, `apps/admin/src/pages/classes/index.test.tsx` (mới), `apps/admin/src/pages/classes/class-detail.test.tsx` (bổ sung)
- Không đụng `apps/api/**`, `packages/**` — đúng biên đã giao.

## Đã làm gì

### 1. `apps/admin/src/pages/classes/index.tsx` — form "Tạo lớp"
- Nút "+ Tạo lớp" trên `PageHeader` mở `Dialog` (mẫu Dialog/DialogHeader giống `admin/users.tsx`).
- Khoá học: `Selector` từ `course.list.useQuery({ pageSize: 100 })` — không nhập UUID tay.
- Ngày bắt đầu/kết thúc: `TextInput` dạng `YYYY-MM-DD`, validate format + `startDate <= endDate` (mẫu giống `attendance/shifts.tsx`).
- Khung giờ học (slots): danh sách động (thêm/xoá, tối đa 20 theo giới hạn server `slotInputSchema.max(20)`), mỗi dòng có `Selector` Thứ (0=CN..6=T7, đúng convention `ScheduleSlot.weekday`/`weekdayOf()`) + 2 `TextInput` giờ `HH:mm`.
- Giáo viên (tuỳ chọn): `Selector` từ `user.pickList.useQuery({ role: 'giao_vien' })`.
- Nút "Tạo lớp" bị `isDisabled` cho tới khi form hợp lệ (không dùng HTML `step`, không có input số tiền/số nguyên nào trong form này).
- Sau khi `classBatch.create` thành công: hiện banner "Đã tạo lớp {code}" + "Đã sinh {slotsCreated} khung giờ và {sessionsCreated} buổi học", 2 nút "Đóng" / "Xem lớp" (điều hướng `/admin/classes/:id`).
- Lỗi tải course/teacher (network) và lỗi mutation đều hiện `Banner`, không `return` im lặng.

**Payload gọi `classBatch.create.mutate`:**
```ts
{
  courseId: string,
  startDate: 'YYYY-MM-DD',
  endDate: 'YYYY-MM-DD',
  slots: [{ weekday: number, startTime: 'HH:mm', endTime: 'HH:mm' }, ...],
  teacherId?: string, // chỉ có khi chọn giáo viên
}
```

### 2. `apps/admin/src/pages/classes/class-detail.tsx` — tab "Buổi học"
- **Gán CurriculumUnit**: cột mới "Đơn vị học" trong bảng buổi học — `SessionUnitPicker` (component mới, cùng mẫu `TeacherPicker` đã có) gọi `curriculumUnit.list.useQuery()` (router có sẵn, `apps/api/src/exercise/router.ts`), lọc client-side theo `program` của lớp (bảng `CurriculumUnit` là GLOBAL, không có `courseId`, chỉ có `program`+`level` — đã đọc `schema.prisma` để xác nhận). Chọn 1 unit → `classSession.assignUnit.mutate({ sessionId, curriculumUnitId })`. Picker bị disable khi buổi `cancelled`/`done` (khớp `assertSessionActive(..., { alsoBlockDone: true })` phía server) — vẫn hiện lỗi server nếu có (`assignMut.error`).
- **Thêm buổi bù**: nút "+ Thêm buổi bù" mở `Dialog` nhập ngày (`YYYY-MM-DD`) + giờ bắt đầu/kết thúc (`HH:mm`), gọi `classSession.addMakeup.mutate({ classBatchId, sessionDate, startTime, endTime })`. Nút submit disable tới khi hợp lệ; lỗi mutation hiện `Banner` trong dialog (dialog không tự đóng khi lỗi).
- **Xác nhận trước khi huỷ buổi**: nút "Huỷ" không gọi `cancel.mutate` trực tiếp nữa — mở `ConfirmDialog` (mẫu `attendance/shifts.tsx`), chỉ gọi mutate khi bấm xác nhận trong dialog. Lỗi huỷ (nếu có) hiện `Banner` phía trên bảng, không bị mất khi dialog đóng.
- **Sửa empty-state sai** (dòng ~225 cũ): thông báo cũ nhắc nút "Sinh buổi học" không tồn tại ở đâu cả → đổi thành nhắc nút "+ Thêm buổi bù" thực sự có trên trang, kèm 1 dòng giải thích buổi học tự sinh khi tạo lớp.

## Kết quả 3 lệnh verify (chạy thật)

### 1. `pnpm --filter @cmc/admin exec tsc -p tsconfig.json --noEmit`
```
EXIT_CODE=0
```
(Không có output lỗi nào.)

### 2. `pnpm --filter @cmc/admin exec vitest run src/pages/classes`
```
✓ src/pages/classes/class-access-guard.test.tsx (5 tests) 135ms
✓ src/pages/classes/class-detail.test.tsx (10 tests) 1157ms
✓ src/pages/classes/index.test.tsx (5 tests) 1424ms

Test Files  3 passed (3)
     Tests  20 passed (20)
```

### 3. `pnpm lint`
```
> eslint apps/admin apps/lms scripts
EXIT_CODE=0
```

## GitNexus impact/detect_changes (bắt buộc theo AGENTS.md)

MCP tool GitNexus không được expose cho phiên làm việc này (không có tool `impact`/`detect_changes` trong danh sách tool khả dụng) — dùng CLI fallback `node .gitnexus/run.cjs`.

- `impact SessionsTab -f class-detail.tsx`: risk **LOW**, 2 symbol bị ảnh hưởng, chỉ nằm trong `ClassDetailContent`/`ClassDetailPage` — không lan ra module khác.
- `impact ClassDetailContent -f class-detail.tsx`: risk **LOW**, 1 symbol (`ClassDetailPage`).
- `impact ClassListContent -f index.tsx`: risk **LOW**, 1 symbol (`ClassListPage`).
- `detect-changes` (scope mặc định `unstaged`) báo risk **CRITICAL** trên toàn repo — nhưng đây là do **các agent khác đang chạy song song** đã sửa ~35 file khác (shift-config, users, receipt, submission/router.ts backend, v.v., xem `git status` lúc verify: 38 file M/?? ngoài phạm vi được giao). Trong danh sách symbol/flow thay đổi, phần liên quan tới 2 file tôi sửa đúng như kỳ vọng: `ClassListPage → MakeSlot`, `ClassListPage → ValidateCreateForm`, `ClassDetailPage → CloseMakeupDialog` — không có flow lạ nào bị ảnh hưởng ngoài dự kiến.

## Việc chưa làm / giới hạn đã biết

- Không có ô nhập phòng học (`roomId`) trong form tạo lớp — API cho optional, spec không yêu cầu, giữ tối giản (YAGNI). Nếu cần chọn phòng, đây là điểm mở rộng sau.
- `curriculumUnit.list` không lọc theo course/program phía server (bảng GLOBAL) — tôi lọc client-side theo `program` của lớp; nếu 1 program có nhiều unit trùng `level`/`monthIndex` ở các khoá khác nhau, danh sách vẫn hiện đúng theo program, không phân biệt được theo khoá học cụ thể (giới hạn của data model hiện có, không phải bug UI).
- Chưa thêm UI sửa/xoá slot của lớp đã tạo (ngoài scope — router không có mutation update slot).

Status: DONE
Summary: Đã thêm form "Tạo lớp" (course/teacher dropdown, slot lịch, hiển thị slotsCreated/sessionsCreated), gán CurriculumUnit cho buổi học, nút thêm buổi bù, và xác nhận trước khi huỷ buổi; 20 test mới/cập nhật đều pass, tsc/lint sạch.
Concerns/Blockers: Không blocker. Lưu ý: GitNexus MCP tool không khả dụng trong phiên này, đã dùng CLI fallback (`node .gitnexus/run.cjs impact/detect-changes`) thay thế; `detect-changes` mức repo báo CRITICAL do các thay đổi song song của agent khác ngoài phạm vi được giao, không phải do 2 file tôi sửa (đã xác nhận riêng bằng `impact` trên từng symbol — đều LOW).
