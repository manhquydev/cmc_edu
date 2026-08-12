# V4 — Quét nhất quán cuối

Phạm vi: chỉ đọc `plan.md` và 5 phase file trong `plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/`.

## Kết luận

**Chưa SẠCH.** Đã sửa phần lớn V2; còn 3 điểm cần đồng bộ: tham chiếu A0/A2 trong Đợt B, prerequisite `level` của A1, và cổng A cấp chương trình chưa ghi điều kiện xử lý draft #7.

## Theo dõi V2

| ID | Kết luận | Bằng chứng hiện tại / ghi chú |
|---|---|---|
| V2-01 | **ĐÃ SỬA** | `plan.md:72-79` là `A → (B ∥ C ∥ D) → E`; front matter B/C/D đều `dependencies: [1]`, E `[2,3,4]`. |
| V2-02 | **ĐÃ SỬA** | Outcome A ghi “**bật cổng entitlement tạm** trên nhánh bài tập cũ” (`plan.md:66`), khớp A8 (`phase-01:199-201`). |
| V2-03 | **ĐÃ SỬA** | A8 gate bắt #3/#4 = 0 (`phase-01:102-106`); parent gate A cũng bắt #1–#5 = 0 (`plan.md:115`); E vẫn đòi không thiếu stamp (`phase-05:57-60`). |
| V2-04 | **ĐÃ SỬA** | `plan.md:102-105` đính chính A không chỉ kích hoạt thứ có sẵn và liệt kê các việc mới, khớp phase-01. |
| V2-05 | **SỬA MỘT PHẦN** | Parent đã có A2 và hai quyết định quyền (`plan.md:93-95`), nhưng vẫn nói A “bắt đầu được ngay” (`:97`) trong khi A1 yêu cầu **chốt quy tắc `level` chữ → số trước khi làm** (`phase-01:77-79`). Nhật ký cũng nêu `level` là thứ còn thiếu để cook (`plan.md:162`). Cần đưa mapping `level` vào prerequisite A hoặc sửa câu “bắt đầu ngay”. |
| V2-06 | **SỬA MỘT PHẦN** | Parent đã thêm hard gate A: 96 unit, #1–#5, per-enrollment, no-makeup, CI (`plan.md:115`). Nhưng A8 còn đòi **#7 draft ngoài dải đã xử lý** (`phase-01:102`), parent không nêu; phase success criteria cũng chỉ rút gọn #1/#2/#5 (`:214`). |
| V2-07 | **SỬA MỘT PHẦN** | Parent đã thêm rekey/nộp lại và unit lùi (`plan.md:116`), nhưng không nêu proof B3: `LMS_OPEN_TIER_ENABLED=0` chỉ delivery (`phase-02:95-101`). Có thể để ở phase detail theo lời mở đầu `plan.md:111`, nhưng không còn là hard gate cấp chương trình. |
| V2-08 | **ĐÃ SỬA** | Parent hiện có cổng C0/family/journey, D lifecycle/cancel/done, E dry-run/RLS/1 tuần (`plan.md:117-119`); phần chi tiết còn lại được liên kết rõ sang phase files (`:111`). |
| V2-09 | **CHƯA SỬA** | Parent và A đều dùng A2 (`plan.md:93,115`; `phase-01:84`), nhưng B vẫn ghi “đếm ở **A0**” tại `phase-02:54,109`. |
| V2-10 | **ĐÃ SỬA** | Parent gọi đúng “cổng entitlement **tạm**” (`plan.md:66`); A phân biệt nhánh cũ với roster sau B (`phase-01:199-201`); B mô tả delivery/roster (`phase-02:59-61`). |
| V2-11 | **ĐÃ SỬA** | Toàn chương trình ghi rõ cấp tay là ngoại lệ có ghi vết, không phải đường thường ngày (`plan.md:123`), khớp A8 (`phase-01:185-190`). |
| V2-12 | **SỬA MỘT PHẦN** | Parent vẫn coi mapping `blocked_lms` là điều kiện cho D/E (`plan.md:92`), khớp D (`phase-04:31-32`). Nhưng nhật ký “còn thiếu để cook” chỉ liệt kê quyết định 1,2,5,6 + `level`, bỏ quyết định #3 (`plan.md:162`). |

## Quét mới

| Hạng mục | Kết quả |
|---|---|
| Số liệu 96 / 36 / 18 / 42 | **Nhất quán.** `plan.md:66,115,157`; phase-01: 240 dòng CSV, gom thành 96 unit = 36 UCREA / 18 Bright I.G / 42 Black Hole (`phase-01:28-29,57,64,74,207`). Không còn số 239 trong 6 file cần quét. |
| Biểu đồ phụ thuộc và front matter | **Nhất quán.** Diagram/table `plan.md:66-79` khớp A `[]`, B/C/D `[1]`, E `[2,3,4]`. |
| Màn xếp dãy bài | **Nhất quán.** A loại khỏi scope (`phase-01:51`), B6 nhận việc sau B5 (`phase-02:77-91`); parent không gán cho A. |
| Thuật ngữ còn lệch | **Còn một lỗi rõ:** A0 vs A2 ở phase-02. Ngoài ra “cổng cứng A” ở parent chưa bao gồm `#7 đã xử lý`, dù A8 gọi đó là điều kiện vào cổng. |

## Unknowns

- Không đánh giá tính đúng của số 96 với CSV gốc; chỉ kiểm tra tính nhất quán giữa sáu file được yêu cầu.
- Chưa có quyết định owner cho mapping `level` và `blocked_lms`; đây là prerequisite mở, không phải mâu thuẫn nếu được ghi đủ nhất quán.

Status: DONE | Summary: Dependency và số 96/36/18/42 đã sạch; còn A0/A2, prerequisite level, và điều kiện #7 trong cổng A cần đồng bộ.
