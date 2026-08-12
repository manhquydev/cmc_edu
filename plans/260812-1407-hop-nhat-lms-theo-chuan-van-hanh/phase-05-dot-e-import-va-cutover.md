---
title: "Đợt E: Import + cutover + đóng LMS cũ"
status: pending
dependencies: [2, 3, 4]
---

# Đợt E — Nhập dữ liệu, cắt chuyển, đóng LMS cũ

**Thẩm quyền:** quyết định owner câu 2 (Scenario B — lấy dữ liệu từ LMS live) và câu 3
(build-then-cutover, đóng LMS cũ **sau cùng**).

## Trạng thái hiện tại: chưa bắt đầu

| Hạng mục | Trạng thái |
|----------|-----------|
| Script import | **Không tồn tại** (`scripts/lms-v2/` không có) |
| Dry-run | Chưa chạy, không hiện vật |
| 5 bước cutover trong runbook draft | **0/5** |
| Bảng gói bán → unit | **Trống** — chặn cứng |

## Quy mô dữ liệu (nguồn: audit prod `cmc-lms` 07/08)

**10 phụ huynh · 11 học sinh · 11 lớp · 137 buổi**, 1 gia đình có 2 con.
Quy mô nhỏ ⇒ import không phải bài toán khối lượng, mà là bài toán **đúng đắn và đầy đủ**.

---

## Checklist cạm bẫy — rút từ sự cố THẬT của `cmc-lms`

Đây là phần giá trị nhất của đợt này: `cmc-lms` đã trả giá cho từng mục dưới đây.
**Mỗi dòng là một sự cố có thật, không phải lo xa.**

| # | Cạm bẫy | Sự cố đã xảy ra | Việc phải làm |
|---|---------|-----------------|---------------|
| E-1 | **Bảng phụ bị bỏ quên** | Migrate có lớp + buổi nhưng **0 `ScheduleSlot`** ⇒ mọi tính năng theo khung lịch chết im lặng; đổi giáo viên không có tác dụng | Lập checklist FK/bảng phụ thuộc, **không** migrate happy-path |
| E-2 | **Copy enum trạng thái nguyên văn** | Copy `status='open'` từ hệ cũ, hệ mới chỉ làm việc với `running` ⇒ admin **không sửa được unit** | **Ánh xạ** state machine mới, không copy verbatim |
| E-3 | **Giáo viên NULL trên buổi** | Lớp migrate 48/48 buổi `teacher_id=NULL` ⇒ **không ai mở được nhật ký** | Backfill giáo viên + khung lịch, có bước kiểm |
| E-4 | **Blob ≠ hàng DB** | Metadata ảnh migrate xong nhưng **31 blob chưa xác nhận đã rsync** | Đối soát blob riêng, có bằng chứng |
| E-5 | **Lệch múi giờ ngày** | Lệch −1 ngày mọi cột date (pg local-midnight vs Prisma UTC) | Chuẩn hóa ICT/UTC-midnight **một chỗ** |
| E-6 | **Bịa dữ liệu để lấp chỗ trống** | Agent gán giáo viên placeholder cho lớp không có GV — chủ dự án bắt gỡ | **Để trống và hỏi**, không bịa |
| E-7 | **Giữ nguyên credential đăng nhập** | — | Hash mật khẩu giữ **nguyên văn**; không sinh lại |
| E-8 | **Đĩa đầy trước khi deploy** | Server 80% đầy ngay trước cutover | Kiểm dung lượng như một bước có cổng |
| E-9 | **"Đã gửi" ≠ "đã đến"** | SMTP trả 250 queued nhưng sai tài khoản ⇒ mail **không bao giờ đến**, im lặng | Xác minh bằng log sự kiện của nhà cung cấp, không tin cờ `emailSent` |
| E-10 | **Tài liệu lệch nguồn sự thật** | Docs ghi 3 HS trong khi live đã 10+ | Số liệu lấy từ **truy vấn**, không từ tài liệu |
| E-11 | **Backup + mốc hoàn tác trước khi cắt** | — | Dump tươi + ghi lại commit hiện tại; ưu tiên sửa tiến hơn lùi |
| E-12 | **Trạng thái thật chưa từng tồn tại** | Prod chưa có lớp "chạy lâu" ⇒ phải lùi mốc neo để mô phỏng mới tin được code | Mô phỏng lớp chạy dài trước khi tin phần tiến trình unit |

---

## Các bước

### E1. Chốt ánh xạ dữ liệu
Nguồn `cmc-lms` → đích `cmc_edu`, gồm phần `cmc_edu` có mà `cmc-lms` không có:
**`facilityId` cho mọi bảng facility-scoped** (bắt buộc, không có mặc định mở),
ánh xạ lifecycle (Đợt D), ánh xạ trạng thái lớp/buổi, ánh xạ danh tính theo **số điện thoại**.

### E2. Script import + dry-run
Đọc `cmc-lms` (chỉ đọc), ghi báo cáo đối soát **trước khi** ghi bất cứ gì.
Đối soát tối thiểu: số HS/PH/lớp/buổi/điểm danh/bài nộp hai bên khớp; không hàng mồ côi;
không buổi thiếu unit stamp; không lớp thiếu khung lịch (E-1); không buổi thiếu giáo viên (E-3).

### E3. Nhập thật + đối soát lại
Chạy trong giao dịch có thể hoàn tác; đối soát lại toàn bộ chỉ số của E2.

### E4. Cổng chất lượng
Vận hành thật trên `cmc_edu` một khoảng đủ dài, không rollback. Tiêu chí do chủ hệ thống chốt.

### E5. Cắt chuyển + đóng LMS cũ
Đóng băng ghi ở LMS cũ → chuyển nguồn sự thật → đóng. Có backup tươi + mốc hoàn tác (E-11).

---

## Kiểm chứng

- Báo cáo dry-run có số liệu hai bên khớp từng dòng
- Không hàng nào thiếu `facilityId`; RLS bật đủ trên bảng mới (boot-check phải qua)
- Điểm danh, bài nộp, điểm số, nhật ký của HS thật hiển thị đúng sau import
- Một tuần vận hành không rollback
- LMS cũ không còn là nguồn sự thật

## Rủi ro

| Rủi ro | Giảm thiểu |
|--------|-----------|
| Import thiếu bảng phụ ⇒ chết im lặng | E-1, đối soát E2 |
| Ánh xạ danh tính sai ⇒ phụ huynh thấy nhầm con | Khớp theo số điện thoại + đối soát quan hệ giám hộ; test sở hữu |
| Thiếu `facilityId` ⇒ thủng cách ly cơ sở | Ràng buộc NOT NULL + boot-check + test RLS âm |
| Cắt chuyển hỏng | Backup tươi, mốc hoàn tác, cửa sổ đóng băng ghi |
