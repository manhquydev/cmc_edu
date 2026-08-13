---
title: "A3: Lý do hủy buổi + hồi sinh buổi"
status: pending
lane: A
dependencies: [A1, A2]
---

# A3 — Buổi học biết vì sao mình bị hủy, và biết khi nào được sống lại

Đứng sau A1 (nền lịch an toàn) và A2 (trạng thái lớp) vì cả hai hành vi hồi sinh đều cần chúng:
hồi sinh khi **thêm lại khung** cần A1, hồi sinh khi **mở lại lớp** cần A2.

## Vì sao phải phân loại lý do

Lý do hủy **quyết định buổi có được sống lại hay không**:

| Lý do | Sống lại khi | Vì sao |
|---|---|---|
| `slot_removed` — hủy vì gỡ khung lịch | Thêm lại khung cùng thứ/giờ ⇒ **tự hồi** | Lịch quay về như cũ thì buổi cũng nên quay lại |
| `class_closed` — hủy vì đóng lớp | Mở lại lớp ⇒ **tự hồi** | Cùng lý do |
| `manual` — người ta cố ý hủy buổi đó | **Không tự hồi** | Nghỉ lễ, giáo viên ốm — lịch quay lại không có nghĩa buổi đó nên quay lại |
| `ceiling` — chạm trần unit còn lại | **Không tự hồi** | Học sinh hết quyền học; chỉ tiền mới mở lại |

Không có phân loại thì mở lại lớp sẽ hồi sinh **cả buổi nghỉ lễ đã hủy có chủ đích**, hoặc không
hồi sinh gì cả. Cả hai đều sai, và cái sai đầu tiên **im lặng**.

## Chỗ khó thật: đóng dấu unit khi hồi sinh

`cmc_edu` có thứ `cmc-lms` không có — buổi học mang **dấu unit**, và hủy buổi làm **đóng dấu lại**
dãy buổi còn lại. Kế hoạch bản đầu viết *"hồi sinh dùng chung đường đóng dấu với hủy"*. Red-team
bác, và đúng.

Đóng dấu hiện tại (`apps/api/src/lms-ops/stamp-sessions.ts:45-71`) có ba đặc điểm khiến nó
**không dùng lại nguyên văn được**:

| # | Đặc điểm hiện tại | Vì sao thành vấn đề khi hồi sinh |
|---|---|---|
| 1 | Đóng băng theo trạng thái `done`, **không** theo việc đã điểm danh | Buổi đã dạy nhưng chưa kịp chuyển `done` sẽ **bị viết lại dấu unit** |
| 2 | Bỏ qua cờ chạm trần | Buổi ở cuối dãy có thể nhảy unit sai |
| 3 | Không đụng bài đã phát và điểm tổng kết | Hồi sinh làm dãy dài ra ⇒ các buổi sau **dịch unit**, nhưng bài đã phát vẫn gắn unit cũ |

Hủy buổi làm dãy **ngắn lại**; hồi sinh làm dãy **dài ra**. Đó là phép ngược, và test hiện có
mới chỉ chứng minh chiều hủy (`lms-ops.int.test.ts:230-232`).

⇒ Phase này phải **viết ra chính sách đóng băng thành văn** trước khi viết mã, và nói rõ hồi
sinh đụng tới bài đã phát và điểm tổng kết như thế nào.

**Chính sách đề xuất** (chốt khi thi hành):

> Buổi **đã có điểm danh** thì dấu unit **đóng băng vĩnh viễn**, bất kể trạng thái.
> Chỉ buổi chưa ai điểm danh mới được đóng dấu lại.
> Hồi sinh **không** đổi dấu unit của bất kỳ buổi nào đã đóng băng — nếu việc đó làm dãy không
> liền mạch thì **báo ra**, không tự sửa.

Lý do chọn điểm danh làm mốc: điểm danh là bằng chứng buổi đã diễn ra thật, còn `done` chỉ là
kết quả của một tiến trình quét chạy sau.

## Ràng buộc bắt buộc

| # | Ràng buộc | Vì sao |
|---|---|---|
| 1 | Hồi sinh là **cập nhật đúng hàng cũ**, không tạo hàng mới | Tạo hàng mới là chính bẫy sinh buổi ma của A1 |
| 2 | Hàm hủy buổi **bắt buộc** nhận lý do, không có giá trị mặc định ngầm | Mặc định ngầm là cách lý do sai lọt vào dữ liệu |
| 3 | Chỉ hủy và hồi sinh buổi **tương lai** | Xương sống đã có: quá khứ thêm được, bớt thì không |
| 4 | Buổi đã chuyển `done` **không** hủy và **không** hồi sinh | Giữ chặn hiện có; `cmc-lms` không có trạng thái này nên không có bản mẫu để chép |
| 5 | Dữ liệu mẫu đang hủy gán lý do **`manual`** | An toàn nhất: không tự hồi |
| 6 | Chính sách đóng băng viết thành văn **trước** khi viết mã | Không để mỗi đường tự diễn giải |

## Các bước

1. Thêm tập lý do hủy 4 giá trị + cột trên buổi; dữ liệu mẫu gán `manual`.
2. Hàm hủy buổi nhận lý do bắt buộc; mọi nơi gọi truyền tường minh.
3. **Gỡ khung lịch** (đã có từ A1) ⇒ hủy buổi tương lai của khung đó với lý do `slot_removed`.
4. **Thêm lại khung** cùng thứ/giờ ⇒ tìm buổi đã hủy vì `slot_removed`, **cập nhật cùng hàng**
   về trạng thái sống và gán lại khung.
5. **Đóng lớp** (đã có từ A2) ⇒ hủy buổi tương lai với lý do `class_closed`.
   **Mở lại lớp** ⇒ hồi sinh đúng những buổi mang lý do đó.
6. Viết chính sách đóng băng + xử lý bài đã phát và điểm tổng kết khi dãy dài ra.

## Kiểm chứng

| Cổng | Cách đo |
|---|---|
| Gỡ khung | Buổi tương lai chuyển hủy với lý do `slot_removed`; buổi quá khứ **không đổi** |
| Thêm lại khung | Đúng những buổi đó sống lại, **cùng id cũ**; số buổi của lớp không tăng |
| Không hồi sai | Hủy `manual` rồi thêm lại khung ⇒ **vẫn hủy** |
| Mở lại lớp | Chỉ buổi `class_closed` sống lại; buổi `manual` và `ceiling` không |
| Đóng băng | Buổi đã điểm danh giữ nguyên dấu unit sau mọi lần hủy và hồi sinh |
| Dãy không liền mạch | Dựng tình huống hồi sinh làm dãy lệch ⇒ hệ **báo ra**, không im lặng sửa |
| Không có đường hủy thiếu lý do | Kiểm bằng kiểu dữ liệu, không bằng quy ước |

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Hồi sinh làm lệch dấu unit cả dãy | Chính sách đóng băng theo điểm danh; test dựng dãy dài rồi hủy và hồi sinh giữa dãy |
| Bài đã phát gắn unit cũ sau khi dãy dịch | Nêu tường minh trong bước 6; nếu chưa có lời giải thì **báo ra và dừng**, không sửa ngầm |
| Hồi sinh tạo hàng mới thay vì cập nhật | Ràng buộc 1 + test đối chiếu id buổi trước và sau |
| Lý do sai lọt vào dữ liệu qua giá trị mặc định | Ràng buộc 2 — bắt buộc ở tầng kiểu |
| Test hiện có chỉ chứng minh chiều hủy | Bổ sung test chiều ngược trong chính phase này |
