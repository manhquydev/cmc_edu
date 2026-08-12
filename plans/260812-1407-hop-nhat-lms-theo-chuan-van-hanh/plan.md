---
title: "Hợp nhất LMS theo chuẩn vận hành cmc-lms"
description: "Sửa LMS của cmc_edu cho khớp nghiệp vụ vận hành thật của cmc-lms. Tái tuần tự 12/08 sau khi xác định cmc_edu chưa production: sửa mô hình trước, dựng giao diện một lần, nhập dữ liệu sau cùng."
status: pending
priority: P1
effort: "multi-sprint"
tags: [lms, erp, merge, unit, danh-tinh, cutover, gia-ban]
created: 2026-08-12
---

# Hợp nhất LMS theo chuẩn vận hành `cmc-lms`

## Sự thật nền — đọc trước mọi thứ khác

| Hệ | Trạng thái |
|----|-----------|
| `cmc-lms` | **Đang vận hành thật.** Là **chuẩn nghiệp vụ**, không phải hệ phụ |
| `cmc_edu` | **Đang phát triển, chưa production.** Không có người dùng thật, không có dữ liệu thật cần bảo vệ |

**Chiều của việc này: sửa LMS trong `cmc_edu` cho khớp nghiệp vụ vận hành thật của `cmc-lms`.**
Không phải "gộp hai hệ ngang hàng". `cmc-lms` đúng, `cmc_edu` phải theo.

### Điều này thay đổi cách làm như thế nào

Vì `cmc_edu` chưa có người dùng, **mọi rủi ro về dữ liệu và mất quyền truy cập đều dồn về
Đợt 5 (nhập dữ liệu)**. Trước Đợt 5, `cmc_edu` là sân tập — sửa gãy cũng không ai đau.

| Thứ tưởng là rủi ro | Thực tế khi chưa production |
|---------------------|------------------------------|
| "Bật cổng chặn sẽ cắt quyền học sinh đang học" | **Không có học sinh thật.** Không cần cổng đo, không cần bật dần bằng cờ |
| "Gỡ OTP sẽ khoá cửa phụ huynh" | **Không có phụ huynh thật.** Đổi thẳng sang tài khoản gia đình |
| "Đổi khoá bài nộp sẽ mất lịch sử" | **Không có lịch sử thật.** Đổi lược đồ, tạo lại dữ liệu mẫu |
| "Bù dải unit có thể cấp trùng" | **Không có phiếu thu thật.** Vấn đề này chỉ tồn tại ở Đợt 5 |
| "Phá bộ chứng cứ nghiệm thu" | **Vẫn thật** — journey e2e là tài sản CI, phải viết lại |

⇒ **Làm các thay đổi phá vỡ NGAY BÂY GIỜ, mạnh tay, khi chưa có gì để mất.**

### Hệ quả về thứ tự: sửa mô hình trước, dựng giao diện sau

Bản kế hoạch đầu đặt "dựng giao diện vận hành" lên đầu với lý do *"để hệ dùng được sớm"*.
**Lý do đó không còn đứng vững**: không ai dùng `cmc_edu` hằng ngày, nên "dùng được sớm"
không mang lại giá trị gì — trong khi giao diện dựng trên mô hình sắp đổi thì **phải làm lại**.

> Nguyên tắc: **mô hình đúng trước, giao diện dựng một lần, nhập dữ liệu sau cùng.**

---

## Hai rào chắn không được vi phạm

### Rào chắn 1 — "Cái `cmc-lms` đã bỏ" có HAI loại, đừng lẫn

| Loại | Ví dụ | `cmc_edu` phải làm gì |
|------|-------|----------------------|
| **Bỏ vì nghiệp vụ sai** | Buổi bù, unit theo mùng-1, 3 cửa login, teacher tạo HS/lớp | **Cũng bỏ** |
| **Bỏ vì phạm vi hẹp** (LMS đơn cơ sở, không tiền) | Facility + RLS, 9 vai trò + registry quyền, toàn bộ ERP | **Bắt buộc giữ** — đây là lý do `cmc_edu` tồn tại |

### Rào chắn 2 — Port LUẬT, không port CODE, không port TRIGGER

- **Luật thuần** → `@cmc/domain-lms`, port nguyên + test.
- **Service** → **viết lại** theo khuôn `cmc_edu`: `withFacility` + `requirePermission` + audit.
  Service `cmc-lms` thiếu cả ba lớp này.
- **Trigger** → giữ của `cmc_edu`: quyền học đến từ **tiền**, không phải admin bấm tay.

> Tài liệu `cmc-lms` **có drift** (10 điểm lệch). `class-unit-spec.md` đáng tin;
> `project-overview` / `role-matrix` / `README` còn câu "unit theo mùng 1" đã lỗi thời.
> Nguồn "vì sao" thật = `class-unit-spec` + `architecture` + `plans/journals`.

---

## Các đợt

| # | Đợt | Outcome | Phụ thuộc |
|---|-----|---------|-----------|
| 1 | **Nền dữ liệu** — [khung chương trình](./phase-01-dot-a-kich-hoat-van-hanh-unit.md) + [vòng đời & lý do hủy](./phase-04-dot-d-lifecycle-va-cancel-reason.md) | 96 unit thật; vòng đời 6 giá trị; lý do hủy buổi | — |
| 2 | [**Mô hình bài tập**](./phase-02-dot-b-chuoi-domino-bai-tap.md) | Một mô hình duy nhất: bỏ buổi bù, bỏ nhánh cũ, đổi khoá bài nộp, thư viện bài | 1 |
| 3 | [**Danh tính gia đình**](./phase-03-dot-c-danh-tinh-gia-dinh.md) | Một tài khoản gia đình SĐT+mật khẩu | 1 |
| 4 | **Vận hành + gói bán** | Giao diện cấp/thu unit, cảnh báo hết unit, xếp dãy bài; **bộ gói bán cho GĐKD** | 2, 3 |
| 5 | [**Nhập dữ liệu + cắt chuyển**](./phase-05-dot-e-import-va-cutover.md) | Đóng LMS cũ | 4 |

```
Đợt 1 ──┬──► Đợt 2 ──┐
        └──► Đợt 3 ──┴──► Đợt 4 ──► Đợt 5
```

Đợt 2 và Đợt 3 chạy song song được (bài tập và đăng nhập không đụng nhau), nhưng phải **tách
nhánh làm việc** — Đợt 3 đụng 67 file vùng đăng nhập.

> **Ghi chú về file phase:** tên file còn theo cách đánh số cũ (A–E). Nội dung nghiệp vụ vẫn
> đúng; chỉ **thứ tự** và **mức độ thận trọng** thay đổi theo phần "Sự thật nền" ở trên.
> Phần bị bỏ khỏi Đợt 1 (cổng đo 8 truy vấn, cờ entitlement tạm, bù dải) đã ghi rõ trong
> `phase-01`; giao diện chuyển sang Đợt 4.

### Đợt 4 — gói bán (chưa có phase file riêng)

Phân tích phạm vi: `plans/reports/brainstorm-260812-1536-goi-ban-va-dinh-gia.md`.
Tóm tắt: `cmc_edu` **không có model gói/giá nào**; số tiền và số unit hiện đều là ô nhập tay
độc lập. Cần một danh mục gói do GĐKD tự quản, sale chỉ được chọn. `cmc-lms` **không có nghiệp
vụ tiền** nên phần này **không có bản mẫu để chép** — phải tự thiết kế.

---

## Điều kiện tiên quyết chưa có

| # | Việc | Chặn đợt | Ai quyết |
|---|------|----------|----------|
| 1 | **Mốc đóng băng `cmc-lms`** (commit + ngày) | 2, 3 | Chủ hệ thống |
| 2 | ~~Quy tắc `level`~~ — **ĐÃ CHỐT 12/08: đổi kiểu cột `level` sang chuỗi**, giữ nguyên bản khung chương trình | ~~1~~ | ✅ |
| 3 | Ánh xạ `blocked_lms` → giá trị nào trong bộ 6 | 1 | Sản phẩm (đề xuất `on_hold`) |
| 4 | **5 câu hỏi về gói bán** (xem báo cáo brainstorm) | 4 | Chủ hệ thống |
| 5 | Chốt: cấp bù unit quá khứ có bước xem trước hay xác nhận hai lớp | 4 | Sản phẩm |
| 6 | Chốt: một khoá quyền gộp cấp/thu/gỡ, hay tách khoá | 4 | Sản phẩm |

**Đợt 1 chỉ còn chờ mục 3.** Mục 2 đã chốt ⇒ **Đợt 1 bắt đầu được ngay.**
Mục 1 chặn từ Đợt 2.

### Quyết định đã chốt 2026-08-12 (ghi để không hỏi lại)

| Nội dung | Quyết định |
|----------|-----------|
| Cột `level` của khung chương trình | **Đổi sang chuỗi**, giữ nguyên bản CSV (`U2`, `J`, `G1`…) |
| Sale thương lượng giá | **Được, nhưng phải xin duyệt** — cần luồng xin–duyệt |
| Định giá | Đơn giá **theo từng unit** (sửa hàng loạt được) + **gói theo dải unit** có giá riêng |
| Hoàn tiền giữa khóa | **Xây đầy đủ** dù thực tế ít khi duyệt |

---

## Tiêu chí nghiệm thu

| Đợt | Cổng cứng |
|-----|-----------|
| 1 | 96 unit (36/18/42), `orderGlobal` duy nhất theo chương trình; vòng đời 6 giá trị; lý do hủy buổi phân loại được |
| 2 | Không còn đường tạo buổi bù; **chỉ một** mô hình mở bài; **học lại unit nộp lại được**; hủy buổi làm unit lùi đúng |
| 3 | Không còn `kind` parent/student; nhà nhiều con đổi con không rơi về con đầu; **journey LMS viết lại xong** |
| 4 | Cấp/thu/gỡ unit làm được trên màn; cảnh báo sắp hết unit; **gói bán do GĐKD tự tạo, sale chỉ chọn**; giá và số unit **đóng dấu** vào phiếu |
| 5 | Dry-run đối soát khớp; không hàng nào thiếu `facilityId`, boot-check qua; một tuần vận hành không hoàn tác |

Toàn chương trình:

- [ ] Quyền học chỉ đến từ tiền; cấp tay là ngoại lệ có ghi vết
- [ ] `typecheck-and-test` + `ui-e2e` xanh
- [ ] LMS cũ đóng, không còn là nguồn sự thật

## Rủi ro

| # | Rủi ro | Giảm thiểu |
|---|--------|-----------|
| R1 | Mục tiêu di động — `cmc-lms` vẫn tiến hóa | Tiên quyết #1 (đóng băng) |
| R2 | Đợt 3 phá bộ chứng cứ nghiệm thu (67 file, 25 test) | Đợt 3 đứng riêng, có mốc viết lại journey trong chính đợt |
| R3 | Port lại thứ `cmc-lms` đã cố ý gỡ | Rào chắn 1 |
| R4 | Copy service `cmc-lms` làm thủng RLS/RBAC/audit | Rào chắn 2 |
| R5 | **Toàn bộ rủi ro dữ liệu dồn vào Đợt 5** | Checklist 12 cạm bẫy rút từ sự cố thật của `cmc-lms`, trong `phase-05` |

> **Giả định phải kiểm lại nếu sai:** `cmc_edu` chưa có người dùng và dữ liệu thật. Nếu thực tế
> đã có bản triển khai đang dùng, **toàn bộ phần "Sự thật nền" và thứ tự đợt phải xem lại**.

---

## Nhật ký kiểm định

### Red Team — 2026-08-12 (4 vòng song song)

Bảo mật/phân quyền · Hỏng dữ liệu/thứ tự · Đập giả định · Phạm vi/độc lập.
**Đợt A bị viết lại.** 2 phát hiện CRITICAL, 8 HIGH. Bảng phân xử ở cuối `phase-01`.

### Validate — 2026-08-12 (4 vòng)

| Kiểm | Kết quả |
|------|---------|
| Sự thật trong `phase-01` | 7/8 đúng; sai số đếm khung chương trình — đã sửa |
| Số unit thật | Bản đầu ghi 239. **Sai.** 240 dòng CSV → **96 unit** (36/18/42) — đã sửa |
| Khả thi nhập khung | **Khả thi có điều kiện** — CSV không khớp 1-1; `level` là chữ; phải gom dòng |
| Nhất quán toàn plan | 12 điểm lệch (3 HIGH) — đã sửa hết; vòng quét cuối xác nhận sạch |

### Tái tuần tự — 2026-08-12 (sau đính chính "chưa production")

Chủ hệ thống xác nhận `cmc_edu` **chưa production**. Hệ quả:

1. Bỏ cổng đo 8 truy vấn khỏi Đợt 1 — không có dữ liệu thật để bảo vệ; phiên bản thật của nó
   thuộc Đợt 5
2. **Bỏ hẳn cờ entitlement tạm** — không có người dùng để phục vụ trong lúc chờ, và nó là cờ
   trên nhánh sắp bị xoá
3. Bỏ việc bù dải unit khỏi Đợt 1 — không có phiếu thu thật
4. **Chuyển toàn bộ giao diện sang Đợt 4**, sau khi mô hình đã đúng — dựng một lần
5. Gộp vòng đời + lý do hủy vào Đợt 1 (cùng là thay đổi lược đồ, làm sớm khi còn rẻ)
6. Thêm **gói bán** vào Đợt 4

**Mâu thuẫn chưa giải quyết:** không còn.

<!-- slug: hop-nhat-lms-theo-chuan-van-hanh -->
