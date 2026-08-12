# Quyết định chủ hệ thống — câu 10

**Ngày chốt:** 2026-08-13
**Tiếp nối:** `decisions-owner-260811-cau-1-5.md`, `decisions-owner-260812-cau-6-7.md`, `decisions-owner-260812-cau-8-9.md`
**Căn cứ:** `plans/reports/brainstorm-260812-1536-goi-ban-va-dinh-gia.md`

---

## Câu 10 — Biên độ tự quyết giảm giá của sale (chốt)

**Chủ hệ thống:** **KHÔNG có biên độ miễn duyệt.**

> Mọi giá deal riêng mà sale muốn đều **phải xin duyệt**, nếu hệ thống không có gói ứng với giá đó.

### Luật rút gọn

| Sale bán ở giá nào | Cần duyệt giá? |
|---------------------|----------------|
| **Giá hệ tính ra được** — chọn gói cố định, hoặc mua lẻ N unit × đơn giá | **Không** |
| **Bất kỳ giá nào khác** | **Có — luôn luôn, không có ngưỡng miễn** |

Không có mức "giảm dưới X% thì khỏi duyệt". Chênh 1% hay 30% đều qua hàng chờ như nhau.

### Vì sao luật này gọn

Ranh giới **không nằm ở số tiền** mà nằm ở chỗ: **giá đó có phải do danh mục sinh ra không.**

- Danh mục sinh ra ⇒ GĐKD đã duyệt sẵn khi tạo gói ⇒ sale chỉ chọn.
- Không sinh ra được ⇒ chưa ai duyệt ⇒ phải duyệt.

Nhờ vậy không cần cấu hình ngưỡng, không cần bảng phân quyền theo mức giảm, và không có vùng
xám kiểu "giảm 9,9% để né duyệt".

### Hệ quả thiết kế

1. **Sale không bao giờ gõ được số tiền tự do vào phiếu thu.** Ô tiền do hệ điền — từ gói, hoặc
   từ đơn giá × số unit. Muốn khác thì mở luồng **đề xuất giá**, không phải sửa thẳng.
2. **Luồng xin–duyệt là bắt buộc, không phải tuỳ chọn.** Phải xây ngay ở Đợt 4, không hoãn được,
   vì không có đường tắt nào cho deal riêng.
3. **Ghi vết mỗi lần duyệt:** giá gốc hệ tính, giá đề xuất, chênh lệch, lý do, ai duyệt, lúc nào.
4. **Ngưỡng duyệt hai mắt hiện có vẫn áp độc lập** — phiếu trên 20 triệu vẫn cần thêm
   GĐĐT/super_admin, kể cả khi giá đã được duyệt ở bước đề xuất. Hai cơ chế cộng dồn, không thay nhau.

### Gợi ý vận hành (không phải luật)

Nếu một mức giá deal **lặp lại nhiều lần**, đó là tín hiệu nên **tạo hẳn một gói** cho nó thay vì
duyệt từng phiếu. GĐKD có hai cần gạt: tạo gói (dùng lại được, không cần duyệt nữa) và duyệt deal
lẻ (một lần, cho từng phiếu). Màn hàng chờ duyệt nên hiện số lần một mức giá đã được duyệt để
GĐKD tự nhận ra điều đó.

**Trạng thái:** **ACCEPTED**

---

## Còn lại cho Đợt 4

| # | Việc | Ghi chú |
|---|------|---------|
| 1 | **Bảng gói bán thật** — 2–3 gói (tên, số unit, giá) | Để làm dữ liệu mẫu kiểm chứng mô hình chịu được ca thật; **không** cứng hoá vào hệ |
| 2 | Một gói có được **thu làm nhiều lần** không (trả góp) | Nếu có, mô hình phiếu thu phải đổi đáng kể |
| 3 | Gói và bảng giá **dùng chung toàn hệ thống hay riêng từng cơ sở** | Các cơ sở có được đặt giá khác nhau không |
