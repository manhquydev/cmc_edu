---
title: "Đợt D: Lifecycle + lý do hủy buổi"
status: pending
dependencies: [1]
---

# Đợt D — Mở rộng lược đồ cho khớp chuẩn

Đợt này **phải xong trước Đợt E**: import cần ánh xạ đúng các giá trị này, không thì dữ liệu vào sai.

## D1. `StudentLifecycle` 3 → 6 giá trị

| | Giá trị |
|--|---------|
| `cmc_edu` hiện tại | `active`, `blocked_lms`, `withdrawn` |
| Chuẩn `cmc-lms` | `admitted`, `active`, `on_hold`, `transferred`, `withdrawn`, `completed` |

**Thiếu:** `admitted`, `on_hold` (bảo lưu), `transferred`, `completed`.
**Thừa:** `blocked_lms` — **không tồn tại** ở chuẩn mới.

Nghiệp vụ thiếu quan trọng nhất: **bảo lưu** (`on_hold`). Hiện `cmc_edu` không diễn đạt được
"HS tạm nghỉ" ngoài cách chặn LMS.

**Khác biệt tập chặn:**

| | Giá trị chặn truy cập LMS |
|--|--------------------------|
| `cmc_edu` | `blocked_lms` |
| `cmc-lms` | `on_hold`, `withdrawn`, `transferred` — **`completed` KHÔNG chặn** (học xong vẫn xem lại được) |

**Quyết định cần chốt:** ánh xạ `blocked_lms` → giá trị nào. Đề xuất `on_hold` (gần nghĩa nhất:
tạm dừng có thể quay lại). Cần chủ hệ thống xác nhận vì ảnh hưởng dữ liệu thật.

Quy mô: **24 file, 10 test** + migration dữ liệu.

## D2. `SessionCancelReason`

`cmc_edu` hủy buổi **không phân loại lý do**. Chuẩn `cmc-lms` có 4 lý do, và lý do **quyết định
buổi có được hồi sinh hay không**:

| Lý do | Hồi sinh khi |
|-------|--------------|
| `slot_removed` | Thêm lại khung lịch cùng thứ/giờ ⇒ **tự hồi** |
| `class_closed` | Mở lại lớp ⇒ **tự hồi** |
| `manual` | **Không tự hồi** |
| `ceiling` | **Không tự hồi** (chạm trần unit còn lại) |

Không có phân loại này thì không thể mở lại lớp / thêm lại khung lịch một cách đúng đắn.

## D3. Các luật nhỏ còn lệch

Từ đối chiếu BR6 (310 luật chuẩn: 15 khớp đúng, 266 lệch chi tiết, 29 chưa có).
Đợt này xử phần lệch **có ảnh hưởng dữ liệu**; phần lệch chỉ về hằng số/định dạng gom vào cuối đợt.

Ví dụ đã biết:
- Sao thưởng: `cmc-lms` cộng **10 sao khi publish điểm**, cố định; `cmc_edu` cộng **khi chấm**, số lấy từ `Exercise.starReward` cấu hình được.
- Thang điểm: chuẩn `MAX_SCORE = 10` cố định; `cmc_edu` cho cấu hình.
- `SessionStatus.done`: `cmc-lms` **không có**; `cmc_edu` có + có sweep.
  ⚠️ **Không bỏ vội** — cần audit payroll/KPI xem có phụ thuộc `done` không (Unknown hiện tại).

## Kiểm chứng

- Migration lifecycle chạy được cả chiều tiến, dữ liệu cũ ánh xạ đúng, không hàng mồ côi
- Test: `completed` vẫn xem được dữ liệu học tập cũ
- Test: `on_hold` chặn truy cập, bỏ `on_hold` thì mở lại
- Test: hủy vì `slot_removed` → thêm lại khung ⇒ buổi hồi sinh; hủy `manual` ⇒ không hồi
- Audit payroll/KPI với `SessionStatus.done` có kết luận rõ ràng

## Rủi ro

| Rủi ro | Giảm thiểu |
|--------|-----------|
| Đổi enum lifecycle làm hỏng mọi cổng chặn | Migration + chạy lại toàn bộ test cổng; ánh xạ chốt trước |
| Bỏ `done` phá payroll/KPI | Audit trước, không bỏ trong đợt này nếu chưa rõ |
