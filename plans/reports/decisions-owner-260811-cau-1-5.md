# Quyết định chủ hệ thống (ngôn ngữ nghiệp vụ)

**Ngày chốt:** 2026-08-11  
**Người yêu cầu / chủ hệ thống** — trả lời 5 câu hỏi sản phẩm  
**Gắn plan:** `plans/260811-1025-hop-nhat-lms-cmc-lms-vao-cmc-edu-erp/`

---

## Tóm tắt một câu

**Xây / hoàn thiện hệ thống gộp trên `cmc_edu` (ERP + LMS theo chuẩn vận hành thật): khóa học → unit, quyền học cấp theo unit; lấy dữ liệu dạy–học từ LMS đang live; chỉ đóng LMS cũ sau khi hệ mới đạt chất lượng; tạo HS đặc biệt có kiểm soát; hoàn tiền cắt unit từ phần chưa học.**

---

## Câu 1 — Cách hiểu “quyền học” (chốt)

**Chủ hệ thống:**  
Hệ thống phân tầng **Khóa học (chương trình) → Unit**.  
Khi cấp quyền (sau đóng tiền, hoặc cấp có kiểm soát), **cấp theo unit thuộc khóa học đó** — không cấp mơ hồ “cả lớp / cả khóa” không gắn unit.

| Ý nghiệp vụ | Hệ hiểu như |
|-------------|-------------|
| Khóa học / chương trình | UCREA, Bright I.G, Black Hole (khung sẵn) |
| Unit | 1 đơn vị học trong khung (thường = 4 buổi) |
| Quyền học của HS | Một hoặc nhiều **dãy unit liên tục** trong **đúng khóa học** của lớp |
| Vào điểm danh / nhận bài | Chỉ khi unit của **buổi đó** nằm trong dãy đã cấp |

**Hệ quả vận hành (đã ghi nhận):**

- Phiếu thu / gói bán phải gắn được với **khóa học + số unit (hoặc dãy unit)** trong khóa đó.  
- Sale không “bán lớp” trừu tượng; bán **unit của khóa** (lớp là nơi HS học các unit đó).  
- Chi tiết “mấy unit / gói nào = bao nhiêu unit” có thể tinh chỉnh khi làm form phiếu thu, nhưng **mô hình bắt buộc: Khóa học > Unit > cấp quyền theo unit**.

**Trạng thái:** **ACCEPTED**

---

## Câu 2 — Nguồn dữ liệu dạy–học (chốt)

**Chủ hệ thống:** Đồng ý **phương án B**.

- Dữ liệu lớp, HS, PH, điểm danh, vận hành dạy–học **lấy từ LMS đang chạy thật** (`cmc-lms`).  
- Hệ thống thống nhất (`cmc_edu` sau merge) là đích đến.  
- Không lấy monorepo LMS mỏng làm nguồn “sự thật dạy–học” nếu đang lệch thực tế live.

**Trạng thái:** **ACCEPTED (Scenario B)**

---

## Câu 3 — Cách chuyển hệ / đóng LMS cũ (chốt, hiểu lại cho đúng ý)

**Chủ hệ thống:**

- `cmc_edu` **đang xây và phát triển** — chưa phải “cắt cuối tuần rồi xong”.  
- Cần **tái cấu trúc + merge ERP với LMS chuẩn vận hành**, **hoàn thiện và kiểm chất lượng** trên hệ mới.  
- **Chỉ sau khi** hệ gộp đạt chất lượng vận hành → **đóng LMS kia** (`cmc-lms`).  
- Không bắt buộc “freeze 4–12h ngay tuần này”; freeze/cutover **nằm ở giai sau**, khi đã sẵn sàng chuyển.

| Giai đoạn | Việc làm | LMS cũ (`cmc-lms`) |
|-----------|----------|---------------------|
| **Hiện tại – xây** | Làm trên `cmc_edu`: gộp chuẩn LMS + cầu ERP; test, chỉnh | Vẫn có thể phục vụ vận hành hiện tại |
| **Đủ chất lượng** | Import / đồng bộ dữ liệu dạy–học (theo B); kiểm thử thật | Chuẩn bị bàn giao |
| **Cắt chuyển** | Một cửa sổ chuyển chính thức (có thể vài giờ cuối tuần) | **Đóng** — không còn SoT |

**Hệ quả cho đội làm hệ thống:**

- Ưu tiên **chất lượng merge trên monorepo**, không ép dual-write hai prod song song lâu dài.  
- Kế hoạch cutover + đóng LMS cũ = **cổng cuối**, không phải bước đầu.  
- Trong lúc xây: tránh phụ thuộc “hai hệ cùng sửa dữ liệu dạy–học” — rõ **ai là SoT tạm thời** (live LMS) vs **đích** (`cmc_edu`).

**Trạng thái:** **ACCEPTED** (build-then-cutover, not freeze-first)

---

## Câu 4 — Tạo HS trước khi có tiền (chốt)

**Chủ hệ thống:** Đồng ý **A**.

- Chỉ **GĐĐT / quản trị tối cao** (break-glass).  
- Phải có lý do / kiểm soát.  
- HS **chưa được học / chưa vào điểm danh–bài** cho đến khi được **cấp unit** (sau thu tiền hoặc cấp unit có kiểm soát).

**Trạng thái:** **ACCEPTED**

---

## Câu 5 — Hoàn tiền / hủy gói (chốt)

**Chủ hệ thống:** Đồng ý **A**.

- Unit **đã học**: giữ lịch sử (điểm danh, bài, …).  
- Unit **chưa học**: **cắt từ unit kế tiếp** (thu hồi phần còn lại), có lý do / log.  
- Wave 1: thao tác có kiểm soát (admin), không xóa quá khứ.

**Trạng thái:** **ACCEPTED**

---

## Mặc định vẫn giữ (chưa bị phản đối)

| Mục | Nội dung |
|-----|----------|
| Cách dạy–học | Theo LMS live: unit theo số buổi, không buổi bù trong hệ, 1 bài/buổi |
| Wave 1 ưu tiên | Thu tiền ↔ unit + lớp + GV + gia đình; chưa quà/huy hiệu/multi-cơ sở/sơn lại ERP |

---

## Ánh xạ sang mã quyết định kỹ thuật (cho đội implement)

| Owner Q | Tech ID | Nội dung ngắn |
|---------|---------|----------------|
| Câu 1 | D2 + D2b + D12 | Khóa học > unit; entitlement = unit ranges trong course |
| Câu 2 | D9 | Scenario B import live |
| Câu 3 | D10 (refined) | Build quality on cmc_edu first; cutover+close old LMS last |
| Câu 4 | D1 | Hybrid break-glass A |
| Câu 5 | D11 | revokeFromNext / cắt phần chưa học |

---

## Việc làm tiếp theo (không phải câu hỏi dev)

1. Ghi mô hình **Khóa học > Unit > quyền unit** vào tài liệu sản phẩm / ADR gọn.  
2. Làm trên `cmc_edu`: port chuẩn LMS + cầu ERP (theo plan WP spike-first).  
3. Khi đủ chất lượng: import dữ liệu live → cắt chuyển → **đóng** `cmc-lms`.  
4. Form bán hàng / phiếu thu sau này phải chọn được **khóa + unit / số unit** (chi tiết gói có thể tinh sau, mô hình đã chốt).

**Phase 1 decision freeze:** đủ để bắt đầu xây (WP-02 ADR + WP-03…06 spike).  
**Chi tiết “gói A = mấy unit”** có thể bổ sung khi thiết kế phiếu thu — không chặn mô hình Khóa học > Unit.
