# Hai việc cần chủ hệ thống quyết

**Ngày:** 2026-08-12
**Viết cho:** người đặt hàng / chủ hệ thống — không phải tài liệu kỹ thuật
**Liên quan:** `plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/`

---

# Việc 1 — Chốt ngày ngừng thêm tính năng cho LMS cũ

## Chuyện đang xảy ra

Anh đang có **hai hệ thống**:

- **LMS cũ** (`cmc-lms`) — đang chạy thật, trung tâm dùng hằng ngày.
- **Hệ thống mới** (`cmc_edu`) — nơi ta đang gộp ERP và LMS lại làm một.

Việc đang làm là **chép nghiệp vụ từ hệ cũ sang hệ mới**. Nhưng hệ cũ **vẫn đang được thêm
tính năng mới**. Nghĩa là ta đang chép lại một cuốn sổ mà người ta vẫn đang viết thêm vào.

Kết quả: chép xong phần A thì hệ cũ đã có thêm phần B. Chép xong B thì có thêm C.
**Không bao giờ đuổi kịp, và không ai trả lời được câu "bao giờ xong".**

## Tôi cần anh quyết cái gì

Một câu duy nhất: **từ ngày nào thì LMS cũ ngừng nhận tính năng mới?**

Ví dụ: *"Từ 15/08/2026, LMS cũ chỉ sửa lỗi, không thêm tính năng mới nữa."*

Sau ngày đó:

| Loại việc | LMS cũ | Hệ mới |
|-----------|--------|--------|
| Sửa lỗi, sự cố vận hành | ✅ vẫn làm bình thường | ✅ |
| Thêm tính năng mới | ❌ không làm nữa | ✅ làm ở đây |

**Không phải "tắt LMS cũ".** LMS cũ **vẫn chạy phục vụ trung tâm** cho tới khi hệ mới đủ tốt
để thay. Chỉ là **ngừng làm nó phình to thêm**.

## Cái giá phải trả nếu chọn đóng băng

Phải nói thật: trong vài tháng tới, nếu trung tâm phát sinh nhu cầu mới thì hoặc **chờ**,
hoặc **làm trên hệ mới** — mà hệ mới thì hiện chưa dùng được hằng ngày.

Đây chính là lý do tôi đề nghị làm **Đợt A trước tiên**: Đợt A biến hệ mới thành dùng được
cho việc cấp và thu quyền học. Sau Đợt A, "làm trên hệ mới" mới là câu trả lời thật.

## Cái giá phải trả nếu KHÔNG đóng băng

Việc gộp hệ thống **không có điểm kết thúc**. Ta sẽ mãi mãi chạy hai hệ song song, và mỗi
tháng trôi qua là thêm một tháng phải nuôi cả hai.

## Gợi ý của tôi

Đóng băng, và chọn **ngày càng sớm càng tốt**. Nếu có tính năng nào đang làm dở ở LMS cũ thì
liệt kê ra, cho nó xong nốt, rồi đóng băng ngay sau đó.

---

# Việc 2 — Bảng gói bán quy ra số buổi học

## Chuyện đang xảy ra

Trong hệ thống mới, quyền học của học sinh được cấp theo **unit**.

> **Một unit = 4 buổi học.**

Khi phụ huynh đóng tiền, sale lập phiếu thu, phiếu thu được duyệt → hệ thống **tự động cấp
quyền học** cho học sinh. Đây là điểm nối giữa tiền và việc học, và nó đã chạy được.

**Nhưng hệ thống chưa biết mỗi gói bán tương ứng bao nhiêu unit.** Hiện tại nó đang
**mặc định cấp 4 unit cho mọi phiếu thu** — tức là **16 buổi cho tất cả mọi người**,
bất kể phụ huynh đóng bao nhiêu tiền.

## Điều này sai ở đâu

| Tình huống | Hệ thống hiện làm | Đúng ra phải |
|------------|-------------------|--------------|
| Phụ huynh đóng gói nhỏ | Cấp 16 buổi | Cấp đúng số đã mua |
| Phụ huynh đóng gói lớn | Cấp 16 buổi | Cấp đúng số đã mua |

Nghĩa là: **người mua ít được học nhiều, người mua nhiều bị học ít**. Tiền và quyền học
không khớp nhau.

## Tôi cần anh cho cái gì

Danh sách **các gói trung tâm đang bán thật**, và mỗi gói tương ứng bao nhiêu unit (hoặc
bao nhiêu buổi — tôi tự quy đổi). Khoảng 3–5 gói là đủ.

Dạng như thế này:

| Tên gói trung tâm đang bán | Học phí | Học được bao nhiêu buổi | = bao nhiêu unit |
|----------------------------|---------|-------------------------|------------------|
| (ví dụ) Gói trải nghiệm | … | 8 buổi | 2 unit |
| (ví dụ) Gói 1 khoá | … | 32 buổi | 8 unit |
| … | | | |

Nếu trung tâm không bán theo gói cố định mà bán theo số buổi lẻ, thì chỉ cần nói vậy —
tôi sẽ làm form phiếu thu cho nhập thẳng số buổi.

## Nếu chưa có bảng này thì sao

- **Đợt A vẫn làm được bình thường** — không bị chặn.
- Nhưng **không thể chuyển dữ liệu thật sang và đóng LMS cũ**. Vì lúc nhập dữ liệu học sinh
  thật vào, hệ thống sẽ cấp sai số buổi cho tất cả mọi người, và sai ngay từ ngày đầu.

Việc này đã treo từ **11/08**.

---

# Tóm tắt

| # | Việc | Anh cần đưa gì | Chặn cái gì |
|---|------|----------------|-------------|
| 1 | Ngày ngừng thêm tính năng cho LMS cũ | Một ngày cụ thể | Toàn bộ việc chép nghiệp vụ (từ Đợt B) |
| 2 | Bảng gói bán quy ra số buổi | 3–5 dòng gói thật | Việc chuyển dữ liệu và đóng LMS cũ (Đợt E) |

**Cả hai đều KHÔNG chặn Đợt A.** Đợt A bắt đầu được ngay hôm nay.
