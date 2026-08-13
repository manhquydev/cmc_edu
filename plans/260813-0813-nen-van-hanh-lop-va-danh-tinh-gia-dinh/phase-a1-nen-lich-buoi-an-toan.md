---
title: "A1: Nền lịch buổi an toàn"
status: completed
lane: A
dependencies: []
---

# A1 — Sửa cái nền trước, vì nó đang là bẫy

Đây là phase **đầu tiên** của cả kế hoạch, và nó không thêm tính năng nào cho người dùng. Nó
sửa một chỗ mà nếu để nguyên thì mọi việc dựng lên trên sẽ **hỏng dữ liệu thật khi nhập**.

## Bẫy: xóa khung lịch sẽ sinh buổi ma

```sql
-- migrations/20260706170000_p2_foundation_class_ops/migration.sql:139-140
CREATE UNIQUE INDEX "ClassSession_classBatchId_scheduleSlotId_sessionDate_key"
  ON "ClassSession"("classBatchId", "scheduleSlotId", "sessionDate");
-- :176-177
FOREIGN KEY ("scheduleSlotId") REFERENCES "ScheduleSlot"("id") ON DELETE SET NULL
```

Khoá chống trùng buổi **bám vào id của khung lịch**, và khi xóa khung thì buổi được gán `NULL`.
Postgres coi **`NULL` khác `NULL`** trong khoá duy nhất — nên hai hàng cùng `(lớp, ngày)` với
khung `NULL` đều hợp lệ.

### Vì sao khoá mới dùng được — đã kiểm

Giờ bắt đầu của buổi ở `cmc_edu` là **thời điểm đầy đủ** (khác nguồn, nơi nó chỉ là chuỗi
`"HH:mm"`). Dùng một cột như vậy làm khoá duy nhất chỉ an toàn khi **mọi hàng đều sinh ra theo
cùng một quy ước**. Đã kiểm:

```ts
// apps/api/src/class/generate-sessions.ts:66-68
startTime: ictToUtc(date, slot.startTime),   // slot.startTime là chuỗi "HH:mm"
```

Hàm chuyển giờ chỉ nhận `"HH:mm"` và đặt giây, mili về 0. Nên hai buổi cùng ngày cùng giờ luôn
trùng **đúng từng bit**, và khoá duy nhất bắt được.

Đây cũng là lý do có ràng buộc 3c: nếu sau này một đoạn mã ghi giờ buổi bằng đường khác — lấy
giờ hiện tại, hay cộng thêm phút — thì phần giây khác 0 sẽ **lách qua khoá**, và bẫy sinh buổi
ma quay lại.

Chuyện sẽ xảy ra khi vận hành thật:

| Bước | Kết quả |
|---|---|
| Đổi lịch học: xóa khung "Thứ 3, 18h" | Mọi buổi sinh từ khung đó — **kể cả buổi đã dạy xong** — mất liên kết khung |
| Thêm khung mới "Thứ 3, 18h" (id khác) | Khung mới, id mới |
| Sinh lại buổi | Khoá duy nhất **không chặn** ⇒ tạo buổi mới cho đúng những ngày đã có buổi |
| Hậu quả | **Một ngày có hai buổi.** Điểm danh, bài tập, nhật ký nằm ở buổi cũ; giáo viên mở buổi mới thấy trống. Dãy unit đếm thêm một buổi không có thật |

`cmc-lms` **không dính bẫy này** vì hai lý do, và cả hai đều là quyết định có chủ ý:

```prisma
// cmc-lms/packages/db/prisma/schema.prisma:388
@@unique([classBatchId, sessionDate, startTime])   // khoá theo LỊCH, không theo id khung
```
và họ **không xóa** khung — họ đánh dấu lưu trữ (`archivedAt`).

## Vấn đề thứ hai: chưa có đường nào sửa hay gỡ khung

`apps/api/src/class/schedule-router.ts:31-93` **chỉ có** `generateSessions`. Khung lịch chỉ được
tạo một lần lúc lập lớp (`class-batch-router.ts:212-221`). Sau đó **không có thủ tục nào**
sửa hoặc gỡ.

Nghĩa là hôm nay trung tâm **không đổi được lịch học của một lớp**. Đây là nghiệp vụ hằng ngày
ở `cmc-lms`, và là lý do lý do-hủy tồn tại bên đó.

## Vấn đề thứ ba: buổi học không có giáo viên riêng

`ClassSession` không có cột giáo viên; chỉ `ClassBatch.teacherId` (`schema.prisma:661`).
`cmc-lms` có trên **từng buổi** (`schema.prisma:373-374`).

Chủ hệ thống đã chốt 13/08: **thêm cột giáo viên trên buổi**, mặc định theo lớp.

Đây đúng là cạm bẫy **E-3** trong danh sách sự cố thật của `cmc-lms`: một lớp nhập sang với
48/48 buổi thiếu giáo viên ⇒ **không ai mở được nhật ký buổi**.

## Ràng buộc bắt buộc

| # | Ràng buộc | Vì sao |
|---|---|---|
| 1 | Khoá duy nhất buổi đổi sang **`(lớp, ngày, giờ bắt đầu)`** | Khoá phải mô tả *thực tế lịch*, không mô tả *hàng nào trong bảng khung* |
| 2 | **Cấm `DELETE`** trên khung lịch — chỉ đánh dấu lưu trữ | Buổi đã dạy tham chiếu khung; xóa là mất dấu vết vĩnh viễn |
| 3 | Sinh buổi phải **tra buổi đã có theo ngày + giờ** trước khi tạo | Không dựa vào khoá duy nhất để bắt lỗi — dựa vào nó là đã muộn |
| 3b | **Ba** đường tạo buổi đều phải sửa, không phải hai | Ngoài `class-batch-router.ts` và `schedule-router.ts`, còn `apps/api/src/lms-ops/router.ts:194-204` cũng tạo buổi hàng loạt. Bỏ sót đường này là bỏ sót một cửa |
| 3c | **Hợp đồng thời điểm:** mọi nơi ghi giờ buổi phải đi qua đúng một hàm chuyển giờ ICT nhận chuỗi `"HH:mm"` | Khoá duy nhất so **tới mili giây**. Hai buổi "cùng 18h thứ Hai" mà lệch 1 mili giây thì khoá **không chặn** — bẫy cũ quay lại dưới hình dạng khác |
| 4 | Đổi khoá duy nhất phải **kiểm dữ liệu trùng trước** khi tạo chỉ mục | Nếu dữ liệu mẫu đã có hai buổi cùng ngày+giờ thì migration sẽ gãy giữa chừng |
| 5 | Giáo viên buổi **mặc định lấy theo lớp**, không để trống | Để trống chính là E-3 |
| 6 | Đổi giáo viên cho một buổi có quyền riêng + ghi vết | Đây là dữ liệu chấm công và tính lương |

## Các bước

1. **Kiểm dữ liệu trùng** — đếm các cặp `(lớp, ngày, giờ)` đang có nhiều hơn một buổi. Có thì
   xử lý trước; đây là cổng chặn của migration.
2. **Đổi khoá duy nhất** sang `(lớp, ngày, giờ bắt đầu)`; bỏ khoá cũ.
3. **Thêm đánh dấu lưu trữ cho khung lịch**; đổi mọi đường xóa (nếu phát sinh) thành lưu trữ.
4. **Thêm thủ tục sửa và gỡ khung lịch** — có quyền, có ghi vết. Gỡ khung **chưa** hủy buổi ở
   phase này; việc đó thuộc A3.
5. **Sinh buổi tra theo ngày + giờ** trước khi tạo, thay vì dựa vào `skipDuplicates`.
6. **Thêm cột giáo viên trên buổi**, backfill từ giáo viên của lớp; thêm đường đổi giáo viên
   cho một buổi.

## Kiểm chứng

| Cổng | Cách đo |
|---|---|
| Không còn khoá bám id khung | Chỉ mục duy nhất trên `(lớp, ngày, giờ bắt đầu)`; chỉ mục cũ đã bỏ |
| Gỡ khung không xóa hàng | Sau khi gỡ, hàng khung vẫn còn và mang dấu lưu trữ; buổi cũ **vẫn** trỏ tới nó |
| Không sinh buổi đôi | Gỡ khung → thêm khung cùng thứ/giờ → sinh buổi ⇒ **số buổi không tăng** cho những ngày đã có |
| Giáo viên buổi | Mọi buổi hiện có đều có giáo viên sau backfill; buổi mới sinh cũng vậy |
| Đổi giáo viên một buổi | Chỉ buổi đó đổi; lớp và buổi khác không đổi; có bản ghi vết |
| Migration an toàn | Chạy trên dữ liệu mẫu có buổi trùng ⇒ dừng với thông báo rõ, **không** ghi nửa chừng |

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Dữ liệu mẫu đã có buổi trùng ⇒ tạo chỉ mục duy nhất gãy | Bước 1 là cổng chặn, chạy trước |
| Đổi khoá làm hỏng chỗ đang dựa vào khoá cũ | Rà mọi nơi dùng `skipDuplicates` trên buổi; bước 5 thay bằng tra tường minh |
| Backfill giáo viên gán sai khi lớp chưa có giáo viên | Để trống và **báo ra**, không bịa — đúng luật E-6 của `cmc-lms` |
| Thêm cột giáo viên buổi làm lệch chấm công | Phase này chỉ ghi dữ liệu; không đổi cách tính lương. Nếu chấm công đang đọc giáo viên của lớp thì giữ nguyên cho tới khi có quyết định riêng |
