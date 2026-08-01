# Rà soát P2 — Giảng dạy / Vận hành lớp (2026-07-26)

Kết quả agent rà soát, đã kiểm chứng bằng grep. Lưu lại vì agent trả inline.

## Chứng minh "no-ui-path"

```bash
grep -rnE "^\s+[a-zA-Z][a-zA-Z0-9]*:\s*(requirePermission|lmsProcedure)" \
  apps/api/src/{class,attendance,exercise,submission}/ --include=*.ts | grep -v ".test.ts"   # 28 procedure
grep -rohE "trpc\.(classBatch|classSession|schedule|attendance|exercise|submission)\.[a-zA-Z]+" \
  apps/admin/src apps/lms/src --include=*.tsx --include=*.ts | sort -u                        # 21 được gọi
```

**Mồ côi (0 caller UI):** `schedule.generateSessions`, `classBatch.create`,
`classSession.addMakeup`, `classSession.assignUnit`, `attendance.mark`, `exercise.listForStudent`.

## Findings

| # | Mức | Vấn đề | file:line | Đề xuất |
|---|-----|--------|-----------|---------|
| 1 | Chặn | Menu "Điểm danh" trỏ `/teaching/attendance` không kèm `?session=`; 0 link in-app sinh param này ⇒ phải gõ UUID vào URL | `apps/admin/src/pages/teaching/attendance.tsx:139,204-224`; `shell/nav-registry.ts:20` | Bê picker lớp→buổi từ `session-assessment.tsx:45-52` |
| 2 | Chặn | `classSession.assignUnit` là writer DUY NHẤT của `curriculumUnitId`, 0 UI gọi; tier lọc `curriculumUnitId not null` ⇒ `openForStudent` luôn rỗng, `saveDraft` luôn ném "Exercise is not open yet" | `class-session-router.ts:245,266`; `exercise/open-tier.ts:100,125,176` | Thêm nút "Gán bài học" ở tab Buổi học (`class-detail.tsx:146`) |
| 3 | Chặn | `classBatch.create` 0 UI gọi ⇒ không tạo được lớp trong app (backend đã gộp lớp+slot+sinh buổi 1 call) | `class-batch-router.ts:142` | Form "Tạo lớp" ở `classes/index.tsx` |
| 4 | Chặn | Màn Điểm danh hiện UUID 8 ký tự thay tên HS; comment nói thiếu procedure là SAI — `listStudents` đã trả `fullName` | `teaching/attendance.tsx:102`; `class-batch-router.ts:302` | Join như `session-assessment.tsx:90-100` |
| 5 | Cao | Mặc định `'present'`: mở trang bấm Lưu là cả lớp thành có mặt; không phân biệt "chưa đụng" | `teaching/attendance.tsx:84,183` | `status: null` = chưa đánh dấu; chặn Lưu khi còn null |
| 6 | Cao | `numScore > 10` hardcode rồi `return` im lặng — bài `maxScore=100` bấm Chấm không phản hồi | `teaching/grading.tsx:116` vs `exercise/router.ts:117` | Lấy maxScore từ exercise, hiện lỗi |
| 7 | Cao | Queue chấm hiện "HS: A1B2C3D4" — không biết chấm bài của ai | `teaching/grading.tsx:74` | Trả `fullName` trong `listForGrading` |
| 8 | Cao | `classFilter` hiển thị "Lớp: xxx" nhưng query truyền `{}` — bộ lọc giả | `teaching/grading.tsx:249,261,288-292` | Bỏ hiển thị hoặc thêm `classBatchId` vào input |
| 9 | Cao | `take: 100` chạy TRƯỚC filter phân quyền ⇒ GV mất bài của mình nếu cơ sở >100 bài chờ | `submission/router.ts:424,434-449` | Lọc theo lớp GV ở `where` rồi mới take |
| 10 | Cao | "Lịch dạy" query `classBatch.list` thay vì `classSession.list` ⇒ không hiện buổi/giờ dạy | `teaching/schedule.tsx:229,90-98` | Đổi sang `classSession.list`, group theo `sessionDate` |
| 11 | TB | Empty state chỉ dẫn dùng nút "Sinh buổi học" — nút không tồn tại | `classes/class-detail.tsx:225` | Thêm nút hoặc sửa câu chữ |
| 12 | TB | `classSession.addMakeup` 0 caller ⇒ không tạo được buổi bù | `class-session-router.ts:186` | Nút "Thêm buổi bù" |
| 13 | TB | Nút "Huỷ" buổi học không xác nhận, không undo | `classes/class-detail.tsx:204-212` | Bọc Dialog xác nhận |
| 14 | TB | `confirmMut`/`cancelMut` dùng chung instance ⇒ bấm 1 dòng, mọi nút cùng loại spinner | `classes/class-detail.tsx:200,209` | So `variables?.sessionId === row.id` |
| 15 | TB | Danh sách lớp read-only, `pageSize: 50` cứng, không phân trang; filter backend không dùng | `classes/index.tsx:68-71` vs `class-batch-router.ts:40` | Phân trang + filter GV/khoá |
| 16 | TB | Không có `classBatch.update`: tạo xong không sửa được ngày/phòng/trạng thái | `class-batch-router.ts:320-325` | Bổ sung `update` |
| 17 | TB | Form tạo bài tập thiếu `maxScore`, `starReward` ⇒ mọi bài vĩnh viễn 10 điểm/10 sao | `teaching/exercises.tsx:292-296` vs `exercise/router.ts:117` | Thêm 2 NumberInput |
| 18 | TB | `markAll` lặp tuần tự 3 query/HS trong 1 transaction — lớp 30 HS ≈ 90+ round-trip | `attendance/router.ts:204-246` | `createMany`/`updateMany` gộp |
| 19 | TB | Bộ lọc "ID khóa học" là ô text nhập UUID tay | `teaching/schedule.tsx:36-38` | Selector nạp từ `course.list` |
| 20 | Thấp | `exercise.listForStudent` là bản sao `openForStudent`, 0 caller | `exercise/open-tier.ts:190-195` | Xoá alias |

## 4 luồng "no-ui-path" — đứt đúng MỘT mắt xích, không thiếu hoàn toàn

- **P2-01**: backend đã gộp sẵn; thiếu đúng một form.
- **P2-02**: màn + API đủ; thiếu cầu nối sinh `?session=`; roster không tên.
- **P2-03**: nghiêm trọng nhất — `assignUnit` là writer duy nhất của `curriculumUnitId` và
  `generate-sessions.ts` không set trường này ⇒ gate ADR 0038 **không bao giờ mở được**.
- **P2-05**: bị chặn phái sinh từ P2-03; sửa P2-03 là tự thông.

## 3 việc trước nhất
1. UI gán CurriculumUnit cho buổi học — mở khoá cả P2-03 lẫn P2-05.
2. Cầu nối vào màn Điểm danh + hiện tên HS (#1, #4, #5).
3. Form tạo lớp (#3).

## Câu hỏi tồn đọng
1. `assignUnit` thủ công từng buổi hay `generate-sessions` tự rải unit theo `monthIndex`? — quyết định sản phẩm.
2. Grading queue cố tình giấu `studentCode` (`grading.tsx:72`); `fullName` có cùng ràng buộc riêng tư không?
