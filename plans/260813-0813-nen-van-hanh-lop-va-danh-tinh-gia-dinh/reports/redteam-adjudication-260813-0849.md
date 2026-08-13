# Phân xử red-team — 4 vòng song song, 2026-08-13

Bốn góc: bảo mật/phân quyền · hỏng dữ liệu/thứ tự · đập giả định · phạm vi/độc lập.
Mỗi phát hiện dưới đây đã được **chủ phiên kiểm lại bằng mã nguồn**, không nhận nguyên văn.

**Kết quả tổng:** 1 CRITICAL · 11 HIGH · 6 MEDIUM chấp nhận · **2 bác bỏ** · 1 hạ mức.

---

## Bác bỏ — có bằng chứng ngược

| # | Phát hiện | Vì sao bác |
|---|---|---|
| B1 | *"`EnrollmentUnitRange.sourceReceiptId` và `Student.createdByReceiptId` chặn cứng việc nhập 11 HS thật"* (mức HIGH) | **Cả hai đều nullable** — `schema.prisma:430` và `:603`. Nhập được. Vấn đề thật là **chính sách**: tạo học sinh ngoài đường phiếu thu, mà chú thích mã gọi là "break-glass". Ghi thành câu hỏi chính sách cho Đợt 5, **không** phải chặn lược đồ |
| B2 | *"Backfill mật khẩu gia đình bằng literal mặc định"* | Kế hoạch **không hề đề xuất** việc này; đây là cảnh báo về một cách làm không ai viết ra. Giữ lại thành **ràng buộc cấm** trong B1, không tính là lỗi của kế hoạch |

Hạ mức: *"`parseLmsToken` ⇒ localStorage luôn ghi rỗng"* — sai một phần. Chỉ `parentAccountId` rỗng; `sessionToken`, `kind`, danh sách con vẫn ghi đúng. Hạ HIGH → MEDIUM, giữ trong B1 vì mã mới rất dễ tin vào giá trị rỗng đó.

---

## CRITICAL — phải đổi cách thi hành A1 trước khi viết dòng nào

### C-1. Xóa khung lịch sẽ sinh buổi ma, không phải hủy buổi

```sql
-- migrations/20260706170000_p2_foundation_class_ops/migration.sql:139-140
CREATE UNIQUE INDEX "ClassSession_classBatchId_scheduleSlotId_sessionDate_key"
  ON "ClassSession"("classBatchId", "scheduleSlotId", "sessionDate");
-- :176-177
FOREIGN KEY ("scheduleSlotId") REFERENCES "ScheduleSlot"("id") ON DELETE SET NULL
```

Khoá duy nhất **bám vào id của khung**, và FK là `SET NULL`. Postgres coi `NULL ≠ NULL` trong
khoá duy nhất.

Kịch bản hỏng: xóa khung ⇒ buổi cũ (kể cả buổi **đã dạy**) mất `scheduleSlotId` ⇒ thêm khung mới
(id mới) rồi sinh buổi ⇒ khoá duy nhất **không chặn** ⇒ **một ngày có hai buổi**: buổi đã dạy
(khung null) và buổi mới. Điểm danh, bài tập, nhật ký bám buổi cũ; giáo viên mở buổi mới. Dãy
unit đếm thêm một buổi ma.

`cmc-lms` không dính vì khoá duy nhất của họ là **lịch**, không phải id khung:
`@@unique([classBatchId, sessionDate, startTime])` (`schema.prisma:388`), và họ **không xóa**
khung — họ lưu trữ (`archivedAt`).

**Đổi thi hành A1:**
1. Đổi khoá duy nhất sang `(classBatchId, sessionDate, startTime)`.
2. **Lưu trữ** khung, **không** `DELETE`.
3. Hồi sinh = `UPDATE` **cùng hàng** + gán lại khung; không `createMany` rồi mong khoá chặn.
4. Sinh buổi phải nhìn buổi đã có **theo ngày + giờ** trước khi tạo.

---

## HIGH — chấp nhận

| # | Phát hiện | Đổi gì |
|---|---|---|
| H-1 | **Không có API gỡ khung, cũng không có đường đóng lớp.** `schedule-router.ts:31-93` chỉ sinh buổi; `ClassBatch.status` là String tự do, chú thích tự nhận *"chưa procedure nào dùng"* (`schema.prisma:662-665`) | A1 phải **thêm** gỡ/sửa khung và đóng lớp **trước**, rồi lý do hủy mới có chỗ móc. Không phải "mở rộng hàm hủy" |
| H-2 | **`QualitativeAssessment` đã là nhận xét theo buổi**, và là **điều kiện đóng buổi** (`session-done.ts:10-12`) | A3.2 sai tiền đề — viết lại. Khác biệt thật với `cmc-lms` là **cấu trúc** (1 ô tự do vs 4 ô), không phải có/không |
| H-3 | **Quy tắc công khai của nhật ký buổi lộ nhận xét cả lớp.** Nhật ký là **một hàng / một buổi**; `listForChild` trả mọi nhật ký đã công khai của mọi lớp HS từng học, không lọc theo học sinh | A3 **không** được "đi theo quy tắc công khai của nhật ký". Nhận xét là dữ liệu **theo học sinh**, phải lọc riêng |
| H-4 | **Hai làn đụng file chung**: `schema.prisma`, `approved-children.ts`, `trpc.ts`, `flow-manifest.ts`, `apps/e2e/src/db.ts`, `apps/api/src/test/db.ts` | Câu "không đụng file chung" trong plan **sai**. Cần giao thức trộn nhánh: chốt chủ sở hữu từng file trung tâm + rebase một chiều |
| H-5 | **Đổi enum không lùi được nếu làm sai cách.** Đề xuất `RENAME VALUE blocked_lms → on_hold` + `ADD VALUE`; **cấm** thêm 4 rồi gỡ 1 trong một lần dựng lại kiểu | A2 ghi rõ dạng migration |
| H-6 | **Đóng dấu lại khi hồi sinh là phép ngược**, `stamp-sessions.ts:45-71` đóng băng theo `done` chứ không theo điểm danh, bỏ qua `capped`, không đảo `SessionExercise`/`FinalGrade` | A1 phải viết **chính sách đóng băng + đảo tác dụng phụ** riêng, không "dùng chung đường hủy" |
| H-7 | **`ClassSession` không có `teacherId`** (chỉ `ClassBatch.teacherId:661`); nguồn có trên từng buổi | Đợt 5 cạm bẫy E-3 không có chỗ gắn. Quyết trong A1 |
| H-8 | **`Student` thiếu `studentCode`, `dateOfBirth`, `gender`, `note`** — nguồn đều có | Nhập 11 HS thật sẽ mất mã, ngày sinh, ghi chú. Quyết trong A2 |
| H-9 | **Không có hợp đồng ánh xạ trạng thái lớp.** Nguồn 5 giá trị enum, đích một String tự do `"active"` | Đúng cạm bẫy E-2 đã gãy thật ở `cmc-lms`. A1 phải có bảng ánh xạ trước khi viết mở lại lớp |
| H-10 | **A3 chưa công bố khoá ổn định xuyên hệ cho bài học** | Upsert theo `lessonCode`; nếu không, Đợt 5 không gắn được buổi thật vào bài |
| H-11 | **B1.5 đếm thiếu test.** Ngoài 17 test đã đếm còn `enrollment.spec.ts:85-94`, `attendance-grading.spec.ts:108-121`, journey `parent-link-approve-reject`, và `lms-auth/login.test.ts` (file OTP lớn nhất, không lọt bộ đếm vì không chứa literal `kind`) | B1.5 tính theo **caller của thủ tục bị gỡ**, không theo bộ đếm `kind` |

---

## MEDIUM — chấp nhận

| # | Phát hiện | Đổi gì |
|---|---|---|
| M-1 | Đếm "8 router" **sót** `guardian/router.ts:71`, `exercise/open-tier.ts:250-263` (là router, không phải helper), `exercise/upload-route.ts:77-83` | B1.1 thêm vào danh sách |
| M-2 | Tập chặn hiện tại là **`{blocked_lms, withdrawn}`**, không phải chỉ `blocked_lms` (`approved-children.ts:50`). Và **`loginStudent` không đọc vòng đời** | A2 sửa bảng; nêu riêng đường đăng nhập chưa có cổng vòng đời |
| M-3 | *"Mọi procedure nhận `studentId` tường minh"* **không đúng** với phiên học sinh — `requireLmsStudent` lấy từ token (`trpc.ts:298-308`) | Hai hợp đồng khác nhau: danh sách của PH nhận `studentId`; tác vụ "con đang chọn" lấy từ phiên. Gộp gia đình phải **chọn một và viết ra** |
| M-4 | Importer **giữ** `chu_de` (ghép vào `title`, `import-curriculum-units.mjs:168-180`). Mất **3** cột, không phải 4. `ghi_chu` trống 210/240 | Sửa số trong A3; `note` phải nullable, cấm fail-closed |
| M-5 | Bỏ OTP là bỏ trần thử mật khẩu; `ParentAccount` **không có cơ chế khoá** | B1 bắt buộc có chính sách giới hạn thử |
| M-6 | *"Làm chết phiên cũ"* liệt kê lựa chọn **không tồn tại** — LMS không dùng cookie; `tokenVersion` **không tăng** khi đổi mật khẩu | B1 chốt đúng một cơ chế có thật |

---

## Kết luận

Kế hoạch **chưa an toàn để thi hành nguyên văn**. Ba chỗ nặng nhất:

1. **A1 lớn hơn nhiều so với mô tả** — phải thêm gỡ khung, đóng lớp, ánh xạ trạng thái lớp,
   đổi khoá duy nhất của buổi, và chính sách đóng băng khi hồi sinh. Đây **không phải một PR**.
2. **A3.2 sai tiền đề** — thứ nó định xây đã có, và bản thiết kế đi theo quy tắc công khai sẽ
   **lộ nhận xét của học sinh khác**.
3. **"Hai làn không đụng file chung" sai** — cần giao thức trộn nhánh trước khi chạy song song.

Status: DONE
Summary: 1 CRITICAL + 11 HIGH + 6 MEDIUM chấp nhận, 2 bác bỏ có bằng chứng ngược, 1 hạ mức. A1 phải tách nhỏ; A3.2 viết lại; hai làn cần giao thức trộn nhánh.
