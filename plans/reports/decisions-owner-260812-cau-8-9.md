# Quyết định chủ hệ thống — câu 8 & 9

**Ngày chốt:** 2026-08-12
**Tiếp nối:** `decisions-owner-260811-cau-1-5.md`, `decisions-owner-260812-cau-6-7.md`
**Căn cứ:** `plans/reports/brainstorm-260812-1536-goi-ban-va-dinh-gia.md`

---

## Câu 8 — Thời lượng buổi học (chốt)

**Chủ hệ thống:** giữ theo **đúng con số tài liệu ghi**.

| Chương trình | Thời lượng buổi |
|--------------|-----------------|
| UCREA | **90 phút** |
| Bright I.G | **110 phút** |
| Black Hole | **110 phút** |

**Bối cảnh:** chủ hệ thống từng nghĩ Bright I.G và Black Hole là 120 phút. Đối chiếu hai nguồn
độc lập đều ghi **110**:

| Nguồn | Bằng chứng |
|-------|-----------|
| `packages/db/prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv`, cột `thoi_luong_buoi_phut` | UCREA `90` (36/36 dòng) · Bright I.G `110` (36/36) · Black Hole `110` (168/168) |
| `cmc-lms/docs/class-unit-spec.md:15` | *"6–7 tuổi, 110'), Black Hole (42 unit, 7–11 tuổi, 110')"* |

⇒ Không sửa CSV. Con số 110 là đúng.

**Trạng thái:** **ACCEPTED**

### Hệ quả kỹ thuật — không cần đổi code

`cmc_edu` **không lưu thời lượng buổi ở đâu cả**: `CurriculumUnit` không có cột thời lượng, và
thời lượng thực tế của một buổi đến từ **khung lịch tuần** (`ScheduleSlot.startTime`/`endTime`)
do admin đặt khi tạo lớp.

Cột `thoi_luong_buoi_phut` trong CSV hiện **không được nhập**. Đây là **dữ liệu tham chiếu** —
hữu ích để admin đặt khung lịch cho đúng, nhưng chưa có nghiệp vụ nào đọc nó.

> **Việc nhỏ có thể làm sau (chưa cấp thiết):** nhập cột này vào `CurriculumUnit` để màn tạo lớp
> gợi ý sẵn độ dài buổi theo chương trình, tránh admin đặt sai khung lịch. YAGNI cho tới khi có
> nhu cầu thật.

---

## Câu 9 — Cách hiểu "dải unit" của gói bán (chốt)

**Chủ hệ thống:** chọn **cách B**.

### Vấn đề

Lớp học ở đây **cuốn chiếu** — học sinh vào giữa chừng, bắt đầu từ unit lớp đang học. Vậy gói
*"UCREA unit 1→12"* bán thế nào cho học sinh mới vào lớp đang dạy **unit 13**?

| Cách | Nghĩa | Kết quả |
|------|-------|---------|
| A. Dải tuyệt đối | Gói bán đúng unit 1→12; học sinh ở unit 13 **không mua được** | Bị loại |
| **B. Dải chỉ để định cỡ và định giá** | Gói nghĩa là **"12 unit"**; cấp 12 unit **từ chỗ học sinh đang đứng** | **CHỌN** |

### Nghĩa vận hành

- Việc **tích chọn dải unit X→Z** khi tạo gói chỉ là **cách tiện để hệ tính hộ tổng đơn giá** —
  nó xác định **số lượng** và **giá tham chiếu**, không phải đoạn unit cố định phải bán.
- **Đặt tên gói theo số unit**, không theo dải: *"Gói 12 unit — Khai giảng tháng 8"*, tránh phụ
  huynh hiểu nhầm là học đúng unit 1–12.
- Màn lập phiếu thu phải **hiện trước** học sinh sẽ được cấp unit nào (ví dụ *"→ Cấp unit 13 → 24"*)
  để sale nói đúng với phụ huynh.

### Vì sao B

Cơ chế cấp quyền học hiện tại **luôn cấp từ vị trí hiện tại của lớp trở đi** — đã xây, đã có kiểm
thử, và sau bản sửa gap-aware thì "12 unit" nghĩa là **12 unit có thật trên trục**, tự động bỏ qua
lỗ hổng đánh số. Cách A đòi thay cơ chế cấp quyền; cách B khớp sẵn.

Nếu cần bán trọn khoá cho lớp mới mở thì vẫn diễn đạt được trong B: đó là **một gói cỡ 36 unit**.

**Trạng thái:** **ACCEPTED**

---

## Còn lại — câu 10 chưa chốt

**Biên độ tự quyết giảm giá của sale.** Đã chốt ở câu 6–7 rằng *sale được thương lượng giá nhưng
phải xin duyệt*. Còn lại: **có mức giảm nào được tự quyết khỏi cần duyệt không**, hay mọi lần
giảm đều qua hàng chờ của GĐKD.

Cần cả **bảng gói bán thật** (2–3 gói: tên, số unit, giá) để làm dữ liệu mẫu kiểm chứng mô hình.

Chặn: Đợt 4 (vận hành + gói bán).
