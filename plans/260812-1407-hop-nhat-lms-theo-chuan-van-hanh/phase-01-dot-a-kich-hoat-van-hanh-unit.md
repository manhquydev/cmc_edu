---
phase: 1
title: "Đợt 1: Nền dữ liệu — khung chương trình"
status: pending
priority: P1
effort: "3–5 ngày"
dependencies: []
---

# Đợt 1 (phần A) — Nhập khung chương trình thật

> Đợt 1 gồm **file này** (khung chương trình) và
> [`phase-04`](./phase-04-dot-d-lifecycle-va-cancel-reason.md) (vòng đời + lý do hủy buổi).
> Cả hai đều là thay đổi lược đồ/dữ liệu — làm sớm khi `cmc_edu` còn chưa có dữ liệu thật.

## Overview

Nạp khung chương trình thật (96 unit) vào `cmc_edu`. Đây là **trục quyền học** — không có nó thì
mọi thứ liên quan đến unit đều không chạy được quá unit số 4.

## Vì sao đây là việc đầu tiên của cả chương trình

Khung chương trình trong `cmc_edu` mới là **bản nháp 4 dòng dùng để chạy thử**.

| | UCREA | Bright I.G | Black Hole | Tổng |
|--|------:|-----------:|-----------:|-----:|
| Dòng trong CSV `cmc-lms/docs/CMC_EDU_Khung_Chuong_Trinh.csv` | 36 | 36 | 168 | **240** |
| **Unit thật** sau khi gom dòng cùng unit | 36 | **18** | **42** | **96** |
| `cmc_edu` hiện có (`packages/db/prisma/seed.mjs:70-76`) | **4** | **0** | **0** | **4** |

> Một dòng CSV **không phải** một unit: Bright I.G và Black Hole có tới 4 dòng chủ đề cho cùng
> một unit (cùng `order_global`). UCREA thì 1 dòng = 1 unit. **Phải gom trước khi nhập**, nếu
> không sẽ vỡ ràng buộc duy nhất `(chương trình, order_global)`.

Hậu quả nếu không làm trước:

- Học sinh gia hạn gói tiếp theo ⇒ hệ cấp dải `[5..8]` ⇒ **không tìm thấy unit số 5** ⇒ báo lỗi ⇒
  **tiền đã thu mà quyền học không được cấp**.
- Lớp Bright I.G / Black Hole ⇒ **mọi lần cấp quyền đều lỗi** (trục rỗng).
- Buổi thứ 5 trở đi bị **ép về unit 4** ⇒ mua 4 unit lại **xem được toàn bộ bài còn lại**.

## Non-goals

- Không dựng giao diện (Đợt 4)
- Không đụng mô hình bài tập (Đợt 2) hay đăng nhập (Đợt 3)
- Không nhập dữ liệu dạy-học từ LMS cũ (Đợt 5)

---

## Việc phải làm

Vòng validate đã đối chiếu từng cột: CSV **không khớp 1-1** với bảng `CurriculumUnit`.

| Việc | Ghi chú |
|------|---------|
| **Gom dòng theo `(chương trình, order_global)`** | 240 dòng → 96 unit |
| Ánh xạ tên chương trình | CSV ghi `Bright I.G` / `Black Hole`; hệ dùng `BRIGHT_IG` / `BLACK_HOLE` |
| **Chuyển đổi `level`** | CSV để **chữ** (`U2`, `U3`, `J`, `G`, `B`, `P`…); `cmc_edu` khai `level` là **số** ⇒ **chặn cứng, xem tiên quyết** |
| Suy ra `monthIndex` | CSV không có cột này |
| Đặt tên unit | Ghép từ mã unit / chủ đề — CSV không có cột tiêu đề unit sẵn |
| Giữ `order_global` **nguyên văn** | Trục quyền học — đổi số là sai dữ liệu đã bán |
| Loại unit | `LESSON` (đa số) và `REVIEW` (6 unit mã có dấu `+`) |
| Idempotent | Chạy lại không tạo trùng |
| Xử lý 4 dòng nháp đang có | `cmc_edu` chưa production ⇒ **xoá và nạp lại** là lựa chọn sạch nhất |

### Điều kiện tiên quyết — chặn bước đầu

**Quy tắc chuyển `level` chữ → số.** CSV để `U2`, `J`, `G1`… trong khi cột `level` của
`cmc_edu` là số nguyên. Hai lựa chọn:

| Cách | Đánh giá |
|------|----------|
| **Đổi kiểu cột `level` sang chuỗi** | Giữ đúng nguyên bản khung chương trình. **Khuyến nghị** — `cmc_edu` chưa production nên đổi lược đồ lúc này rất rẻ |
| Đặt quy tắc quy chữ thành số | Giữ lược đồ nhưng **mất thông tin gốc**, và quy tắc sẽ thành nợ vĩnh viễn |

## Success Criteria

- [ ] `CurriculumUnit`: **96 unit** — 36 UCREA / 18 Bright I.G / 42 Black Hole
- [ ] `orderGlobal` duy nhất trong từng chương trình, khớp nguyên văn CSV
- [ ] Chạy lại script không tạo trùng
- [ ] Tạo được lớp và cấp dải unit vượt quá unit số 4 trên cả ba chương trình (test chứng minh)
- [ ] `typecheck-and-test` xanh

## Risk Assessment

| Rủi ro | Giảm thiểu |
|--------|-----------|
| Nhập sai `orderGlobal` | Giữ nguyên văn CSV; kiểm đếm theo chương trình sau khi nạp |
| Gom dòng sai ⇒ thiếu/thừa unit | Cổng đếm 36/18/42 |
| Mất thông tin `level` khi ép sang số | Ưu tiên đổi kiểu cột sang chuỗi |

Rủi ro thấp: `cmc_edu` chưa có dữ liệu thật, nạp sai thì xoá nạp lại.

---

## Đã bị bỏ khỏi đợt này (và vì sao)

Bản kế hoạch trước xếp rất nhiều việc vào đây. Sau khi xác định `cmc_edu` **chưa production**,
những việc sau **không còn lý do nằm ở đây**:

| Việc cũ | Đi đâu | Vì sao |
|---------|--------|--------|
| Cổng đo 8 truy vấn dữ liệu | **Đợt 5** | Không có dữ liệu thật để bảo vệ. Phiên bản thật của nó là bước đối soát khi nhập dữ liệu |
| Bật cờ entitlement tạm | **Bỏ hẳn** | Không có người dùng để phục vụ trong lúc chờ, và đó là cờ trên nhánh mà Đợt 2 sẽ xoá |
| Bù dải unit cho phiếu thu cũ | **Đợt 5** | Không có phiếu thu thật |
| Sửa phạm vi cổng chặn (theo lớp thay vì theo chương trình) | **Đợt 2** | Lỗi này nằm trong nhánh cũ; Đợt 2 xoá nhánh đó là lỗi biến mất theo |
| Màn cấp/thu/gỡ unit, cảnh báo sắp hết unit | **Đợt 4** | Dựng giao diện sau khi mô hình đã đúng — dựng một lần |
| Chặn tạo buổi bù mới | **Đợt 2** | Đợt 2 xoá hẳn buổi bù, không cần bước chặn tạm |

---

## Red Team Review

**Ngày:** 2026-08-12 · 4 vòng song song, 4 lăng kính (codex + pi + 2 grok).
Bản đầu bị **viết lại**, không phải chỉnh sửa nhỏ.

| ID | Mức | Phát hiện | Phân xử |
|----|-----|-----------|---------|
| RT2-1 | CRITICAL | Trục khung chương trình chỉ có 4 dòng nháp; Bright I.G / Black Hole rỗng | **Nhận** — tự xác minh; thành nội dung chính của đợt này |
| RT2-2 | CRITICAL | Bù dải bằng cấp tay tạo dải không gắn phiếu ⇒ worker cấp lại ⇒ cấp trùng | **Nhận, chuyển Đợt 5** — không còn liên quan khi chưa có phiếu thật |
| RT2-8 | HIGH | Cổng chặn gộp dải theo chương trình ⇒ học lớp chưa trả tiền | **Nhận, chuyển Đợt 2** — biến mất khi xoá nhánh cũ |
| RT2-3/4/9/10 | HIGH/MED | Cổng đo thiếu ca biên, không loại break-glass, không chạy lại, khoá bài đang dở | **Nhận, chuyển Đợt 5** cùng với cổng đo |
| RT2-6 | HIGH | Cấp nhầm dải quá khứ **không hoàn tác được** bằng API | **Nhận, chuyển Đợt 4** — ràng buộc khi thiết kế màn |
| RT3-01/04 | HIGH | Không có API đọc dải / unit còn lại / trạng thái đã gỡ | **Nhận, chuyển Đợt 4** |
| RT3-03 | MEDIUM | "Xem trước khi cấp bù" **không tồn tại** — bản đầu tự bịa | **Nhận** — ghi lại, quyết ở Đợt 4 |
| RT3-05 | HIGH | Không có API cảnh báo sắp hết unit | **Nhận, chuyển Đợt 4** |
| RT3-08 | MEDIUM | "Không phá e2e" là **xanh giả** | **Nhận** — hết ý nghĩa khi bỏ cờ tạm |
| RT4-1/3/8 | HIGH | Màn xếp dãy bài dựng trên mô hình `cmc-lms` **đã bỏ**; thư viện bài chưa tồn tại | **Nhận** — chuyển Đợt 4, sau khi Đợt 2 có thư viện bài |
| RT4-4 | MEDIUM | Cờ entitlement hết tác dụng sau Đợt 2 | **Nhận** — bỏ hẳn cờ |
| RT4-5 | MEDIUM | Không chặn tạo buổi bù mới | **Nhận, chuyển Đợt 2** — xoá hẳn thay vì chặn tạm |
| RT1-AUTH-01/03 | HIGH/MED | Cấp bù quá khứ không có xem trước; một khoá quyền gộp bốn thao tác | **Nhận, chuyển Đợt 4** |
| RT1-AUTH-05 | MEDIUM | Giáo viên đọc được roster lớp không dạy | **Ghi nhận** — có sẵn từ trước; cần chốt phạm vi giáo viên |
| RT1-AUTH-02 | MEDIUM | Màn điểm danh lỗi thì lùi về cả lớp, mất lọc unit | **Nhận, chuyển Đợt 4** |

**Bác bỏ:** không có.

## Validation Log

| Kiểm | Kết quả |
|------|---------|
| Số unit | Bản đầu ghi 239. **Sai** — 240 dòng CSV → **96 unit**. Đã sửa và tự xác minh |
| Khả thi nhập khung | **Khả thi có điều kiện** — phải gom dòng, chuyển `level`, suy `monthIndex`, đặt tên unit |
| Nhất quán toàn plan | 12 điểm lệch — đã sửa hết |

**Còn thiếu để bắt đầu:** quy tắc `level` (tiên quyết #2 trong `plan.md`).
