# Quyết định chủ hệ thống — câu 6 & 7 (danh tính + chiến lược port)

**Ngày chốt:** 2026-08-12
**Người yêu cầu / chủ hệ thống** — trả lời 2 câu hỏi sản phẩm còn thiếu, phát hiện qua review thực trạng merge
**Tiếp nối:** `decisions-owner-260811-cau-1-5.md` (câu 1–5)
**Căn cứ phát hiện:** `plans/reports/review-260812-1407-lms-merge-thuc-trang.md`

---

## Bối cảnh vì sao có 2 câu này

Review 2026-08-12 đo lại thực trạng hợp nhất bằng code (không tin status tài liệu) và phát hiện:

- Việc **gộp Phụ huynh + Học sinh** thành một tài khoản — khác biệt nghiệp vụ lớn nhất giữa LMS live và `cmc_edu` — **chưa từng là một quyết định sản phẩm**. Deep-scout 11/08 có nêu là hạng mục HIGH, `phase-04` plan 2 đặt tên "Family principal" và đánh `done`, nhưng Notes của chính phase đó ghi *"Parent login remains OTP-primary; student password path exists"*. Tức là chỉ làm ownership plumbing, không gộp tài khoản.
- `cmc-lms` đang live và **vẫn tiến hóa** trong lúc `cmc_edu` port ⇒ mục tiêu di động, không xác định được bao giờ xong.

Hai điều trên là quyết định sản phẩm, không phải lựa chọn kỹ thuật ⇒ phải do chủ hệ thống chốt.

---

## Câu 6 — Mô hình danh tính LMS (chốt)

**Chủ hệ thống:** **Gộp thành tài khoản gia đình**, theo đúng LMS đang chạy thật.

| Ý nghiệp vụ | Hệ phải hiểu như |
|-------------|------------------|
| Tài khoản khu học tập | **Một** principal `family` — không còn tách PH và HS |
| Đăng nhập | **SĐT + mật khẩu**, một bước |
| Nhiều con | Một tài khoản gia đình quản nhiều con; chọn con bằng picker "Ai đang học hôm nay?" |
| OTP | **Bỏ** — không còn là đường đăng nhập |
| Đường login riêng của HS | **Bỏ** — hồ sơ HS vẫn còn, nhưng không phải principal đăng nhập |

**Hệ quả vận hành đã ghi nhận:**

- Mọi API khu gia đình phải nhận `studentId` tường minh + kiểm quyền sở hữu qua quan hệ giám hộ; không mặc định lấy con đầu tiên.
- Import từ LMS live sẽ khớp theo **số điện thoại** của tài khoản gia đình — không phải tách ngược ra hai loại tài khoản.
- PH cũ chỉ có OTP sẽ cần đường đặt mật khẩu lần đầu khi chuyển hệ.

**Trạng thái:** **ACCEPTED**

---

## Câu 7 — Chiến lược hoàn tất port (chốt)

**Chủ hệ thống:** **Port tiếp, đồng thời đóng băng `cmc-lms`.**

| Giai đoạn | Việc làm | `cmc-lms` |
|-----------|----------|-----------|
| **Đóng băng** | Chốt một mốc phiên bản của `cmc-lms` làm chuẩn port | **Ngừng thêm tính năng mới**; chỉ sửa lỗi vận hành |
| **Port dứt điểm** | Port phần còn thiếu theo **đúng mốc đã chốt**, không chạy theo thay đổi mới | Vẫn phục vụ vận hành |
| **Chuyển + đóng** | Import → kiểm thử → cắt chuyển → **đóng** | Không còn SoT |

**Lý do:** giữ `cmc-lms` tiến hóa song song trong lúc port khiến đích đến di chuyển liên tục — mỗi tuần port thêm thì bản gốc cũng đổi, không bao giờ hội tụ.

**Hệ quả cho đội làm hệ thống:**

- Bất kỳ tính năng mới nào phát sinh sau mốc đóng băng ⇒ làm **trên `cmc_edu`**, không làm ở LMS cũ.
- Thứ tự ưu tiên đảo lại: **danh tính → UI vận hành unit → import → cutover**, đặt trước việc đánh bóng thêm UI ERP.

**Trạng thái:** **ACCEPTED**

---

## Ánh xạ sang quyết định kỹ thuật

| Owner Q | Nội dung ngắn | Chặn việc gì nếu chưa có |
|---------|---------------|--------------------------|
| Câu 6 | Một principal `family`, SĐT+mật khẩu, bỏ OTP và login HS | Toàn bộ import + cutover (khớp danh tính) |
| Câu 7 | Freeze `cmc-lms` tại một mốc; port theo mốc đó | Không xác định được điều kiện "đủ chất lượng" để cắt chuyển |

---

## Việc làm tiếp theo (không phải câu hỏi dev)

1. **Chốt và ghi lại mốc đóng băng** của `cmc-lms` (commit/ngày) — chưa có, cần lấy.
2. Ghi mô hình danh tính gia đình vào ADR sản phẩm.
3. Sửa metadata plan 2 về đúng thực trạng (đang khai `completed` trong khi phase cuối chưa đạt).
4. Bảng gói bán → số unit (3–5 gói thật) — **vẫn còn trống**, đã nêu từ 11/08, chặn việc rời khỏi mặc định 4 unit.

**Còn thiếu để bắt đầu port danh tính:** mốc đóng băng (mục 1). Mô hình đã đủ rõ để thiết kế.
