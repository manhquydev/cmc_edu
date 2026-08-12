# Brainstorm — Bộ gói bán, định giá, và hoàn tiền

**Ngày:** 2026-08-12 · **Trạng thái:** phân tích phạm vi, chưa implement
**Bối cảnh:** `cmc_edu` **chưa production**; `cmc-lms` **không có nghiệp vụ tiền** ⇒ phần này
**không có bản mẫu để chép**, phải tự thiết kế.

---

## 1. Hiện trạng đo được

| Thành phần | Thực tế |
|-----------|---------|
| Số tiền trên phiếu thu | `Receipt.netAmount` — **ô nhập tay** |
| Số unit trên phiếu thu | `Receipt.unitCount` — **ô nhập tay**, mặc định 4 nếu bỏ trống |
| Ràng buộc giữa tiền và unit | **Không có** — hai ô độc lập hoàn toàn |
| Danh mục gói / bảng giá | **Không tồn tại model nào** |
| Giá gắn với khóa học hay unit | **Không có** |

Hôm nay sale gõ "10 unit" và "0 đồng" thì hệ vẫn nhận.

### Phân quyền tiền đang có

| Quyền | Ai |
|-------|-----|
| Lập phiếu thu | GĐKD, sale |
| Duyệt phiếu thu | GĐKD, GĐĐT (**sale bị loại — SoD**) |
| Hoàn tiền | GĐKD |
| Duyệt "hai mắt" | Bắt buộc thêm GĐĐT/super_admin khi phiếu **> 20 triệu** |

---

## 2. Quyết định của chủ hệ thống (2026-08-12)

| # | Nội dung |
|---|----------|
| 1 | Đơn giá **theo unit** là giá nền; **đổi nhanh được toàn bộ** giá unit của một chương trình |
| 2 | GĐKD/admin **tích chọn dải unit X→Z** để tạo gói mới, đặt giá riêng cho gói |
| 3 | Quản trị set được giá chung, đồng thời tạo được gói riêng |
| 4 | Sale **được thương lượng giá, nhưng phải xin duyệt** |
| 5 | Hoàn tiền giữa khóa: xây quy trình đầy đủ dù thực tế ít khi được duyệt |

---

## 3. Mô hình định giá — hai tầng

### Tầng nền: đơn giá từng unit

| Nội dung | Ghi chú |
|----------|---------|
| Mỗi unit trong khung chương trình có **một giá** | 96 unit ⇒ 96 dòng giá |
| **Sửa hàng loạt theo chương trình** | "Đặt tất cả unit UCREA = 1.200.000" hoặc "Tăng tất cả 10%" |
| Sửa riêng từng unit | Khi unit nâng cao có giá khác |
| Đây là giá **mua lẻ** | Mua 1 unit thì trả đúng giá đó |

Vì sao gắn giá vào **unit** chứ không vào **chương trình**: nó làm cho mọi phép tính khác trở
nên tự nhiên — tổng giá một dải, phần đã học đáng bao nhiêu, phần chưa học hoàn bao nhiêu.
Nếu chỉ có một giá cho cả chương trình thì mọi tính toán hoàn tiền đều phải chia trung bình.

### Tầng gói: một dải unit có giá riêng

| Trường | Ghi chú |
|--------|---------|
| Tên hiển thị | Sale nhìn thấy khi bán |
| Chương trình | Gói thuộc một chương trình |
| **Dải unit** | Tích chọn từ unit X đến unit Z |
| Giá gói | GĐKD đặt |
| Hiệu lực từ – đến | Trống = không giới hạn. **Chiến dịch chính là gói có hạn** |
| Trạng thái | đang bán / ngừng bán |

**Ưu đãi tự xuất hiện, không cần công thức:** hệ hiện sẵn tổng đơn giá của dải đã chọn, GĐKD gõ
giá gói, hệ hiện ngay mức giảm.

```
Chương trình: UCREA
Dải đã chọn:  unit 1 → 12   (12 unit)
Tổng đơn giá: 14.400.000
Giá gói:      12.000.000        ← GĐKD gõ
                                  ⇒ Ưu đãi 16,7% — tiết kiệm 2.400.000
```

Không có engine tính giá bậc thang. **Nghệ thuật bán hàng nằm ở tay người kinh doanh, không phải
trong code.** Hệ chỉ hiện đủ số để họ quyết.

---

## 4. Điểm phải chốt: "dải unit" của gói nghĩa là gì khi bán

Đây là **câu hỏi thiết kế quan trọng nhất**, vì lớp học ở đây **cuốn chiếu** — học sinh vào lớp
giữa chừng, bắt đầu từ unit mà lớp đang học.

Tình huống: gói *"UCREA unit 1→12"*. Học sinh mới vào lớp đang dạy **unit 13**. Bán gói này thế nào?

| Cách hiểu | Nghĩa | Ưu | Nhược |
|-----------|-------|-----|-------|
| **A. Dải tuyệt đối** | Gói bán đúng unit 1→12. Học sinh ở unit 13 **không mua được** gói này | Giá bám đúng nội dung; đoạn nâng cao đắt hơn được | Phải tạo rất nhiều gói cho mọi điểm vào; đa số học sinh vào giữa chừng sẽ không có gói phù hợp |
| **B. Dải chỉ để định cỡ và định giá** | Gói nghĩa là "12 unit, giá 12tr". Bán cho ai cũng được, **cấp 12 unit từ chỗ học sinh đang đứng** | Bán được cho mọi học sinh; ít gói phải quản | Học sinh mua "gói unit 1→12" nhưng học unit 13→24 — tên gói dễ gây hiểu nhầm |
| **C. Lai** | Gói có cờ: *bám dải cố định* hay *chỉ định cỡ* | Phủ cả hai nhu cầu | Thêm một khái niệm người dùng phải hiểu |

> ✅ **CHỦ HỆ THỐNG ĐÃ CHỐT 12/08/2026: cách B.** Xem `decisions-owner-260812-cau-8-9.md`.

**Khuyến nghị: B**, và đặt tên gói theo **số unit** chứ không theo dải (*"Gói 12 unit — Khai giảng
tháng 8"*), còn việc tích chọn dải X→Z chỉ là **cách tiện để đặt giá** (chọn 12 unit đầu để hệ
tính hộ tổng đơn giá).

Lý do: hệ cấp quyền học hiện **luôn cấp từ vị trí hiện tại của lớp trở đi** — đó là hành vi đã
xây và đã có kiểm thử. Cách A đòi thay đổi cơ chế cấp quyền, cách B thì khớp sẵn.

Nếu trung tâm thật sự cần bán theo đoạn cố định (ví dụ "trọn khóa từ đầu" cho học sinh mới), thì
đó là **một gói dải 1→36 kèm điều kiện chỉ bán cho lớp mới mở** — vẫn diễn đạt được trong B.

---

## 5. Bất biến bắt buộc: đóng dấu giá lúc bán

> Khi lập phiếu, hệ **sao chép** số unit và số tiền **vào phiếu**.
> Phiếu **không bao giờ** tra ngược sang gói hay bảng giá để tính lại.

Tháng 9 sửa giá gói từ 12tr xuống 10tr. Nếu phiếu tra ngược, **toàn bộ phiếu bán tháng 8 tự đổi
giá** — sổ sách sai, hoàn tiền sai, đối soát vỡ.

`Receipt.netAmount` và `Receipt.unitCount` **đã là cột riêng** ⇒ đã đóng dấu sẵn. Chỉ cần thêm
dấu vết: gói nào, tên gói lúc bán, đơn giá từng unit lúc bán. **Tuyệt đối không** thay hai cột đó
bằng tham chiếu.

Đơn giá từng unit lúc bán phải lưu vì nó là **căn cứ hoàn tiền** sau này (mục 7).

---

## 6. Luồng thương lượng giá

Chủ hệ thống chốt: sale được thương lượng, **phải xin duyệt**.

```
Sale chọn gói (12tr)
   └─► Đề xuất giá khác: 10,5tr + lý do
          └─► Hàng chờ duyệt của GĐKD
                 ├─► Duyệt  → phiếu lập được ở giá 10,5tr, ghi vết đầy đủ
                 └─► Từ chối → sale bán giá gốc hoặc thôi
```

| Ràng buộc | Vì sao |
|-----------|--------|
| Sale **không tự đặt giá được** ở bất kỳ đường nào khác | Giữ SoD hiện có |
| Ghi vết: giá gốc, giá đề xuất, chênh lệch, lý do, người duyệt, thời điểm | Kiểm soát và báo cáo |
| Giảm giá **không đổi số unit** | Số unit đến từ gói; thương lượng chỉ chạm tiền |
| Vẫn áp ngưỡng duyệt hai mắt > 20 triệu | Hai cơ chế độc lập, cộng dồn |

**Câu còn mở:** có biên độ tự quyết cho sale không (ví dụ dưới 5% thì khỏi duyệt)? Nếu có thì
giảm tải cho GĐKD; nếu không thì mọi lần giảm đều qua hàng chờ.

---

## 7. Hoàn tiền giữa khóa — nghiên cứu và đề xuất

### 7.1 Rủi ro đang có trong hệ (phát hiện khi rà)

| Trường hợp | Hệ đang làm | Vấn đề |
|-----------|-------------|--------|
| Hoàn **toàn phần** | Xoá dải unit của phiếu đó | Đúng |
| Huỷ phiếu | Xoá dải unit | Đúng |
| **Hoàn một phần** | **Giữ nguyên dải unit** — ops phải tự nhớ đi cắt tay | **Tiền trả lại nhưng quyền học còn nguyên** |

Đây là chỗ tiền và quyền học có thể lệch nhau. Với hoàn tiền một phần — đúng là ca đang bàn —
phụ huynh có thể nhận lại tiền **mà vẫn học tiếp** nếu không ai nhớ cắt.

⇒ **Phải sửa:** hoàn một phần bắt buộc đi kèm việc cắt dải, làm trong cùng một thao tác.

### 7.2 Các cách xử lý ngoài đời

| Cách | Nội dung | Nhận xét cho CMC |
|------|----------|------------------|
| **Chia đều theo giá đã trả** | Hoàn = (unit chưa học ÷ tổng unit) × tiền đã trả | Dễ giải thích nhất. Nhưng phụ huynh **giữ được ưu đãi mua nhiều** cho phần đã học — trung tâm chịu thiệt |
| **Thu hồi ưu đãi** | Phần đã học tính theo **giá lẻ niêm yết**; hoàn = đã trả − (unit đã học × giá lẻ) | Công bằng với trung tâm: ưu đãi là để thưởng cam kết dài, không cam kết thì không hưởng. **Phổ biến nhất trong ngành** |
| **Bậc thang theo tiến độ** | Học <25%: hoàn 80% · 25–50%: hoàn 50% · >50%: không hoàn | Đơn giản, dễ ghi vào hợp đồng, nhưng thô |
| **Trừ phí hành chính** | Cách nào cũng trừ một khoản cố định | Thường cộng thêm vào cách khác |
| **Không hoàn — chuyển đổi** | Bảo lưu, chuyển chương trình, chuyển cho người khác | **Trung tâm thường muốn nhất**; giữ doanh thu, giữ học sinh |

**Ví dụ số** — mua gói 10 unit giá ưu đãi 9tr (giá lẻ 1,2tr/unit), học 5 unit:

| Cách | Hoàn bao nhiêu |
|------|----------------|
| Chia đều theo giá đã trả | 4.500.000 |
| **Thu hồi ưu đãi** | 9.000.000 − (5 × 1.200.000) = **3.000.000** |
| Bậc thang (học 50%) | 0 hoặc rất ít |

### 7.3 Đề xuất cho CMC

Chủ hệ thống nói thực tế **ít khi duyệt hoàn** ca này. Vậy hệ nên **hỗ trợ tính chứ không tự
quyết**:

1. **Hệ tính sẵn cả hai con số** — chia đều và thu hồi ưu đãi — hiện cạnh nhau kèm cách tính.
2. **Người duyệt nhập số cuối cùng**, có thể khác cả hai, **bắt buộc ghi lý do**.
3. **Luôn phải duyệt** — không có đường tự động hoàn.
4. **Gợi ý phương án thay thế ngay trên màn**: bảo lưu / chuyển chương trình — để nhân viên chào
   trước khi hoàn tiền.

Cách này phản ánh đúng thực tế: hoàn tiền là **thương lượng**, không phải phép tính.

### 7.4 Bảo toàn dữ liệu — ràng buộc bắt buộc

| Ràng buộc | Vì sao |
|-----------|--------|
| **Chỉ cắt quyền học từ unit kế tiếp trở đi, không bao giờ cắt quá khứ** | Đúng xương sống đã có: *"quá khứ THÊM được, BỚT thì không"* |
| **Không xoá điểm danh, bài nộp, điểm số, nhận xét đã có** | Đó là lịch sử học tập thật; hoàn tiền không xoá được việc đã học |
| **Cắt dải và ghi nhận hoàn tiền phải cùng một thao tác** | Tránh lệch tiền/quyền học như 7.1 |
| **Ghi vết đầy đủ** | Ai duyệt, số tính ra, số duyệt thật, lý do chênh |
| **Đơn giá lúc bán phải còn lưu trên phiếu** | Không có nó thì không tính lại được (mục 5) |

---

## 8. Giao diện — 5 màn

### Màn 1 — Bảng giá theo unit (GĐKD)

```
Chương trình: [ UCREA ▾ ]                    Tổng trọn khóa: 43.200.000

  Đặt tất cả = [__________]  ·  Tăng/giảm tất cả [ __ %]   [Áp dụng]

  #   Mã unit   Tên                          Giá
  1   U2.1      Bạn bè                       1.200.000   [sửa]
  2   U2.2      Bốn mùa I (Mùa Thu)          1.200.000   [sửa]
  ...                                         36 dòng
```

Điểm UX quan trọng: **sửa hàng loạt phải xem trước** — hiện "36 unit sẽ đổi từ X sang Y" và bắt
xác nhận, vì đây là thao tác chạm toàn bộ bảng giá.

### Màn 2 — Danh sách gói (GĐKD)

Cột: tên · chương trình · số unit · giá gói · tổng đơn giá · **mức ưu đãi** · hiệu lực · trạng thái.
Lọc theo: đang bán / hết hạn / ngừng bán.

### Màn 3 — Tạo / sửa gói (GĐKD)

```
Tên gói:      [ Gói 12 unit — Khai giảng tháng 8        ]
Chương trình: [ UCREA ▾ ]
Chọn unit:    [✓] 1  [✓] 2  ... [✓] 12  [ ] 13 ...      ← tích, kéo chọn dải
              → 12 unit · tổng đơn giá 14.400.000
Giá gói:      [ 12.000.000 ]   ⇒ ưu đãi 16,7% — tiết kiệm 2.400.000
Hiệu lực:     [01/08/2026] → [31/08/2026]
```

Mức ưu đãi hiện **ngay khi gõ giá**, không cần bấm gì — đây là thông tin GĐKD cần để quyết.

### Màn 4 — Lập phiếu thu (sale)

```
Học sinh: ...     Lớp: UCREA-A (đang học unit 13)

Hình thức:  ( ) Chọn gói có sẵn      ( ) Mua lẻ theo unit

  Gói: [ Gói 12 unit — Khai giảng tháng 8 ▾ ]
       12 unit · 12.000.000        (khoá, không sửa)
       → Cấp unit 13 → 24

  [ Đề xuất giá khác ]   ← mở ô nhập giá + lý do, gửi GĐKD duyệt
```

Điểm quan trọng: **hiện trước học sinh sẽ được cấp unit nào** (13→24), để sale nói đúng với phụ
huynh và tránh hiểu nhầm tên gói (xem mục 4).

### Màn 5 — Hàng chờ duyệt giảm giá (GĐKD)

Cột: phiếu · sale đề xuất · giá gốc · giá đề xuất · chênh lệch · lý do · [Duyệt] [Từ chối].

### Màn hoàn tiền (GĐKD) — bổ sung vào màn đã có

```
Đã trả: 9.000.000 · Đã học 5/10 unit

  Chia đều theo giá đã trả:      4.500.000
  Thu hồi ưu đãi (giá lẻ 1,2tr): 3.000.000

  Số hoàn thực tế: [__________]   Lý do: [________________]

  ⚠ Sẽ cắt quyền học từ unit kế tiếp. Điểm danh và bài đã nộp giữ nguyên.

  Cân nhắc trước khi hoàn:  [ Bảo lưu ]  [ Chuyển chương trình ]
```

### DX — giữ cho hệ dễ bảo trì

- **Không có engine giá.** Chỉ có bảng giá và bảng gói. Mọi "thông minh" nằm ở màn hiện số cho
  người quyết, không nằm trong logic ẩn.
- **Một nguồn duy nhất tính tiền** — dùng chung cho lập phiếu, thương lượng, và hoàn tiền. Ba
  chỗ tính riêng là ba chỗ lệch nhau.
- Tính tiền là **hàm thuần** ⇒ đặt trong package dùng chung, test không cần cơ sở dữ liệu.

---

## 9. Phạm vi

### Trong phạm vi

Bảng giá theo unit + sửa hàng loạt · gói theo dải unit có hiệu lực · form phiếu thu chọn gói ·
đóng dấu giá vào phiếu · luồng xin–duyệt giảm giá · màn hoàn tiền có hai cách tính và bắt duyệt ·
sửa lỗi hoàn một phần không cắt quyền học.

### Ngoài phạm vi

Mã giảm giá / voucher · giá riêng theo từng khách · nhiều loại tiền tệ · gói ghép nhiều chương
trình · tự động gia hạn · lịch sử bảng giá theo thời gian (chỉ giữ giá hiện hành + dấu trên phiếu).

---

## Câu hỏi còn lại

1. ~~**Thời lượng buổi**~~ — **ĐÃ CHỐT 12/08: giữ 110** (UCREA 90). Hai nguồn độc lập đều ghi 110,
   CSV không sai. Xem `decisions-owner-260812-cau-8-9.md`.
2. ~~**Cách hiểu dải unit của gói**~~ — **ĐÃ CHỐT 12/08: cách B**. Dải chỉ để **định cỡ và định giá**;
   gói nghĩa là "N unit", cấp từ vị trí học sinh đang đứng. Đặt tên gói theo **số unit**, không theo
   dải. Xem `decisions-owner-260812-cau-8-9.md`.
3. **Biên độ tự quyết của sale** — có mức giảm nào khỏi cần duyệt không? *(vẫn mở)*
4. **Một gói có được thu làm nhiều lần không** (trả góp)? Nếu có, mô hình phiếu thu phải đổi.
5. **Gói và bảng giá dùng chung toàn hệ thống hay riêng từng cơ sở?**
6. **2–3 gói có thật** đang bán, để làm dữ liệu mẫu kiểm chứng mô hình.
