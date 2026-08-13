---
title: "A5: Bài học trong unit"
status: pending
lane: A
dependencies: [A4]
---

# A5 — Lấy lại nội dung giáo trình đã đánh rơi

## Đây không phải thêm tính năng

Bản khung chương trình đã nhập vào `cmc_edu` có **240 dòng**, và **mọi dòng đều có nội dung
bài học**:

```
packages/db/prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv
  cột: chu_de · bai_hoc · tu_duy_khai_niem_dat_duoc · ghi_chu

  UCREA        36 dòng →  36 unit   (1 bài/unit)
  Bright I.G   36 dòng →  18 unit   (2 bài/unit)
  Black Hole  168 dòng →  42 unit   (4 bài/unit)
```

Importer hiện tại (`packages/db/prisma/import-curriculum-units.mjs`) gom 240 dòng thành 96 unit.
Nó **giữ** cột chủ đề (ghép vào tên unit, `:168-180`) nhưng **bỏ ba cột**: bài học, tư duy đạt
được, và ghi chú.

> Kế hoạch bản đầu viết "vứt bốn cột" — sai. Là **ba**. Cột chủ đề vẫn được giữ.

Hệ quả hôm nay: giáo viên mở buổi học chỉ thấy **unit nào**, không thấy **hôm nay dạy bài gì**.
Bên `cmc-lms` đúng những cột đó nằm trong bảng bài học (`schema.prisma:228-247`), và buổi học
được đóng dấu **cả unit lẫn bài**.

## Khoá ổn định — điều kiện để Đợt 5 gắn được dữ liệu

Đây là ràng buộc dễ bỏ sót nhất. Nếu A5 nhập 240 bài rồi sinh mã định danh ngẫu nhiên, thì khi
Đợt 5 nhập **buổi học thật** từ `cmc-lms` — vốn trỏ tới bài theo mã của hệ đó — sẽ **không có
cách nào nối hai bên**. Dấu bài của 137 buổi thật sẽ mất, hoặc tệ hơn là bị gán bừa.

**Khoá đã chốt** (13/08, sau vòng validate):

> Khoá chính để upsert: **`(chương trình, thứ tự unit toàn cục, thứ tự bài trong unit)`**.
> Đồng thời lưu **mã bài** dạng `{mã unit}-{số thứ tự bài}` làm trường đối chiếu.

Vì sao không lấy mã bài làm khoá chính: nguồn có sẵn cột mã bài duy nhất, nhưng **CSV của
`cmc_edu` không có cột đó** — chỉ có mã unit và số thứ tự bài trong unit. Sinh mã bài rồi lấy nó
làm khoá là dựng một khoá phái sinh và tự tin rằng cách sinh của hai hệ giống nhau. Bộ ba ở trên
thì cả hai hệ **đều có sẵn dữ liệu**, không phải suy ra.

Trường mã bài vẫn lưu, để Đợt 5 đối chiếu chéo và phát hiện nếu hai hệ đánh số lệch nhau.

## Thời lượng buổi — quyết định chưa có chỗ đứng

Chủ hệ thống đã chốt **110 phút** (Bright I.G, Black Hole) và **90** (UCREA). CSV xác nhận đúng:

```
UCREA        90 phút × 36 dòng
Bright I.G  110 phút × 36 dòng
Black Hole  110 phút × 168 dòng
```

Nhưng `cmc_edu` **không lưu thời lượng buổi ở bất kỳ cột nào** — quyết định đó hiện không tồn
tại trong hệ.

Nguồn `cmc-lms` có cột thời lượng, nhưng chú thích của nó ghi *"UCREA 90, Bright I.G / Black Hole
**120**"* — **mâu thuẫn với CSV**. Đây là một điểm lệch tài liệu nữa của `cmc-lms`, cùng loại với
10 điểm đã ghi trong plan mẹ.

⇒ Nhập cột thời lượng trong cùng phase này (rẻ, chung một importer), **lấy số từ CSV**, không lấy
từ chú thích của nguồn.

## Ràng buộc bắt buộc

| # | Ràng buộc | Vì sao |
|---|---|---|
| 1 | Bảng bài học là **danh mục toàn cục** — không cơ sở, không RLS | Cùng quy ước với unit và thư viện bài tập (QĐ 0021/0022) |
| 2 | **Mở rộng** importer hiện có; **cấm** port bộ nhập của `cmc-lms` | Bộ nhập bên đó có bước dọn dữ liệu và số thứ tự âm — không hợp với đích |
| 3 | Upsert theo **khoá ổn định đã công bố**, chạy nhiều lần không nhân bản | Importer đang chạy ở khởi động; nhân bản là hỏng danh mục |
| 4 | Số bài mỗi unit **suy ra từ dữ liệu**, cấm hằng số | Khác nhau theo chương trình: 1 / 2 / 4 |
| 5 | Cột ghi chú **cho phép trống** | 210/240 dòng đang trống — bắt buộc là gãy ngay |
| 6 | Đóng dấu bài cho buổi **đi theo** đường đóng dấu unit đã có | Hai cơ chế độc lập là hai chỗ lệch nhau |
| 7 | Unit không có bài vẫn phải mở buổi được | Thiếu nội dung không được chặn việc dạy |
| 8 | Thời lượng lấy từ **CSV**, không từ chú thích nguồn | Nguồn ghi 120, CSV ghi 110 |

## Các bước

1. Thêm bảng bài học (toàn cục) + cột thời lượng buổi trên unit.
2. Áp dụng khoá đã chốt ở trên (không chọn lại lúc thi hành).
3. Mở rộng importer: nhập 240 bài + thời lượng, upsert theo khoá đó.
4. Đóng dấu bài cho buổi, đi cùng đường đóng dấu unit hiện có.
5. Màn buổi học của giáo viên hiện **bài học hôm nay**, không chỉ unit.

## Kiểm chứng

| Cổng | Cách đo |
|---|---|
| Idempotent | Chạy importer **hai lần** ⇒ vẫn đúng 96 unit và 240 bài, không nhân bản |
| Số bài/unit | UCREA 1, Bright I.G 2, Black Hole 4 — đếm từ dữ liệu sau khi nhập |
| Thời lượng | UCREA 90; hai chương trình còn lại 110 |
| Khoá ổn định | Khoá được ghi trong phase; nhập lại từ CSV khác thứ tự ⇒ vẫn khớp đúng hàng cũ |
| Dấu bài | Buổi hiện đúng bài tương ứng với dấu unit của nó |
| Không fail-closed | Unit không có bài ⇒ buổi vẫn mở được |
| Ghi chú trống | 210 dòng trống nhập được, không lỗi |

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Nhập lại làm nhân bản bài học | Khoá duy nhất + upsert; test chạy hai lần |
| Khoá không ổn định ⇒ Đợt 5 mất dấu bài của 137 buổi thật | Ràng buộc 3 + công bố khoá trong phase |
| Port bộ nhập của nguồn kéo theo dọn dữ liệu ngoài ý muốn | Ràng buộc 2 — chỉ mở rộng importer hiện có |
| Hai cơ chế đóng dấu lệch nhau | Ràng buộc 6 — bài đi theo unit trong cùng một đường |
| Lấy nhầm thời lượng 120 từ chú thích nguồn | Ràng buộc 8; kiểm chứng đối chiếu thẳng với CSV |
