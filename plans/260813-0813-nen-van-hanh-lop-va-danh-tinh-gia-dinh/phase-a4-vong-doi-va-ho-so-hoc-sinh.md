---
title: "A4: Vòng đời học sinh + hồ sơ học sinh"
status: pending
lane: A
dependencies: [A3]
---

# A4 — Diễn đạt được bảo lưu, và giữ đủ hồ sơ học sinh

## Phần 1 — Vòng đời 3 → 6 giá trị

| | Giá trị |
|---|---|
| `cmc_edu` (`schema.prisma:93`) | `active`, `blocked_lms`, `withdrawn` |
| Chuẩn `cmc-lms` (`schema.prisma:38`) | `admitted`, `active`, `on_hold`, `transferred`, `withdrawn`, `completed` |

Thiếu quan trọng nhất là **bảo lưu** (`on_hold`). Hôm nay `cmc_edu` không có cách nào nói
"học sinh tạm nghỉ" ngoài việc chặn LMS — tức là dùng một cái cổng kỹ thuật để diễn đạt một
tình trạng nghiệp vụ.

### Ánh xạ và dạng migration

`blocked_lms` → **`on_hold`**, thực hiện bằng **đổi tên giá trị**, không phải thêm mới rồi gỡ cũ.

Lý do: **gỡ một giá trị enum không lùi lại được**. Nếu thêm 4 giá trị rồi gỡ `blocked_lms` trong
cùng một lần dựng lại kiểu, migration sẽ không có đường lùi khi hỏng giữa chừng. Đổi tên giữ
nguyên dữ liệu đang có và lùi được.

### Tập chặn — bản đầu ghi sai

Kế hoạch bản đầu viết tập chặn hiện tại là `{blocked_lms}`. **Sai.** Đo được:

```
apps/api/src/guardian/approved-children.ts:50 → loại cả blocked_lms VÀ withdrawn
```

| | Tập chặn |
|---|---|
| Hiện tại (đúng) | `{blocked_lms, withdrawn}` |
| Sau phase này | `{on_hold, withdrawn, transferred}` |

**`completed` không chặn.** Học sinh học xong vẫn phải xem lại được điểm, nhận xét, bài đã nộp.
Nếu `completed` lọt vào tập chặn thì mọi học sinh tốt nghiệp **mất quyền xem lịch sử học tập của
chính mình**.

### Lỗ hổng chưa ai nói: đường đăng nhập không kiểm vòng đời

`lms-auth/router.ts:524-621` — thủ tục đăng nhập học sinh **không đọc vòng đời** ở bất kỳ đâu.
Cổng vòng đời chỉ nằm ở đường phụ huynh đọc dữ liệu con.

Nghĩa là hôm nay học sinh đã rút vẫn **đăng nhập được**, chỉ là phụ huynh không thấy con đó nữa.
Phải nêu thành việc, không để lẫn vào "sửa mọi cổng đang so `blocked_lms`" — vì ở đây **không có
cổng nào để sửa**, phải thêm mới.

### Hai cổng chặn cùng tồn tại — luật hợp thành

`cmc_edu` có xương sống mà `cmc-lms` không có: **quyền học đến từ tiền**. Giờ thêm cổng vòng đời
thì có **hai** cổng.

**Luật phải viết thành văn:**

> Truy cập được ⇔ **vòng đời cho phép** **VÀ** **dải quyền học cho phép**.
> Hai cổng là **VÀ**, không cổng nào ghi đè cổng nào.
> Hệ quả: `completed` + hết dải ⇒ **vẫn xem lại được lịch sử**, **không** nhận bài mới.

Ranh giới "xem lại lịch sử" và "nhận bài mới" phải nói rõ, vì `completed` không chặn nhưng cũng
không nên tiếp tục được phát bài.

### Ràng buộc trộn nhánh

Theo giao thức trong `plan.md`: **A4 không sửa `approved-children.ts`** — Làn B sở hữu file đó.
A4 **xuất luật hợp thành thành một hàm thuần** trong `@cmc/domain-lms`; Làn B gọi vào. Hợp đồng
hàm chốt trước khi hai làn bắt đầu.

## Phần 2 — Hồ sơ học sinh

Chủ hệ thống chốt 13/08: **giữ cả bốn trường**.

| Trường | Nguồn (`cmc-lms schema.prisma:251-258`) | Đích hiện tại | Vì sao cần |
|---|---|---|---|
| Mã học sinh | có, duy nhất | **không có** | Phụ huynh và nhân viên đọc mã cho nhau qua điện thoại |
| Ngày sinh | có | **không có** | Khung chương trình phân theo độ tuổi (cột `do_tuoi` trong CSV) |
| Giới tính | có | **không có** | Hồ sơ cơ bản |
| Ghi chú | có | **không có** | Thường chứa thông tin sức khỏe, dị ứng |

`Student` ở đích (`schema.prisma:423-431`) hiện chỉ có họ tên, cơ sở, vòng đời và nguồn gốc phiếu.
Nhập 11 học sinh thật mà không có bốn trường này là **mất vĩnh viễn** khi đóng LMS cũ.

Mã học sinh cần một bộ đếm sinh mã — `cmc_edu` đã có mẫu cho phiếu thu, lớp và nhân viên, nhưng
**chưa có cho học sinh**.

## Ràng buộc bắt buộc

| # | Ràng buộc | Vì sao |
|---|---|---|
| 1 | Migration vòng đời dùng **đổi tên giá trị**, cấm thêm-rồi-gỡ | Gỡ giá trị enum không lùi được |
| 2 | `completed` **không** nằm trong tập chặn | Học xong vẫn xem lại được lịch sử |
| 3 | Luật hợp thành là **một hàm thuần** dùng chung | Ba chỗ tự diễn giải là ba chỗ lệch nhau |
| 4 | A4 **không** sửa `approved-children.ts` | Giao thức trộn nhánh — Làn B sở hữu |
| 5 | Mã học sinh nhập từ nguồn giữ **nguyên văn**, không sinh lại | Mã đã in trên giấy tờ, phụ huynh đang dùng |
| 6 | Ngày sinh lưu theo quy ước ngày của `cmc_edu` | Nguồn lưu kiểu khác; sai quy ước là lệch một ngày (cạm bẫy E-5) |

## Các bước

1. Migration đổi tên `blocked_lms` → `on_hold`; thêm ba giá trị còn lại.
2. Viết luật hợp thành hai cổng thành hàm thuần trong `@cmc/domain-lms` + test bốn tổ hợp.
3. Sửa các cổng đang so vòng đời sang dùng hàm chung (trừ file Làn B sở hữu).
4. Thêm cổng vòng đời cho **đường đăng nhập** — hiện chưa có.
5. Thêm bốn trường hồ sơ + bộ đếm sinh mã học sinh.
6. Đường đổi vòng đời có quyền + ghi vết, cả chiều vào và chiều ra `on_hold`.

## Kiểm chứng

| Cổng | Cách đo |
|---|---|
| Migration | Chạy tiến rồi lùi được; không hàng nào còn giá trị cũ; không hàng mồ côi |
| `completed` xem được | Học sinh `completed` vẫn đọc được điểm, nhận xét, bài đã nộp |
| `completed` không nhận bài mới | Test âm tường minh |
| `on_hold` | Chặn truy cập; bỏ `on_hold` thì mở lại ngay |
| Luật hợp thành | Test đủ **bốn** tổ hợp (vòng đời cho/không × dải cho/không) |
| Không router nào tự diễn giải | Kiểm bằng test rằng mọi cổng đi qua hàm chung |
| Đăng nhập | Học sinh đã rút **không** đăng nhập được (hôm nay đang được) |
| Hồ sơ | Bốn trường có mặt; mã học sinh duy nhất; nhập mã nguyên văn không bị sinh lại |

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Đổi enum làm hỏng mọi cổng chặn | Chạy lại toàn bộ test cổng; ánh xạ chốt trước khi viết migration |
| `completed` lọt vào tập chặn | Test dương tường minh |
| Hai cổng diễn giải khác nhau ở các router | Hàm thuần dùng chung + test bốn tổ hợp |
| A4 và B1 viết hai luật sở hữu lệch nhau | Ràng buộc 4 + chốt hợp đồng hàm trước |
| Thêm cổng vòng đời cho đăng nhập khoá nhầm người | Test âm cho từng giá trị vòng đời |
| Ngày sinh lệch một ngày khi nhập | Ràng buộc 6; đối chiếu ngày sinh của 11 học sinh thật sau khi nhập |
