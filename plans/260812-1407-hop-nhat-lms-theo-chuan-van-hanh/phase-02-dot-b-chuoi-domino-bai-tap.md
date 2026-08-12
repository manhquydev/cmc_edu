---
title: "Đợt B: Chuỗi domino bài tập"
status: pending
dependencies: [1]
---

# Đợt B — Một mô hình bài tập duy nhất

## Vì sao làm trọn gói

Bốn thứ dưới đây **khóa lẫn nhau**, làm rời sẽ để hệ nửa vời (đã xảy ra rồi: sweep tự tạo buổi bù
đã cắt nhưng API và UI buổi bù vẫn sống):

```
Bỏ buổi bù ──→ Tier B chết ──→ open-tier hết lý do ──→ rekey Submission
```

## Bằng chứng: buổi bù làm lệch cách đếm unit

Không phải suy đoán, đã đọc code `cmc_edu`:

- `addMakeup` (`apps/api/src/class/class-session-router.ts:361-411`) tạo `ClassSession` `isMakeup=true`,
  **không gán unit, không restamp**.
- `restampBatchSessions` (`apps/api/src/lms-ops/stamp-sessions.ts:39-55`) lấy **mọi buổi chưa hủy**
  từ mốc neo và gán `unit = neo + floor(vị trí/4)` — **không loại trừ `isMakeup`**.

| Thời điểm | Hậu quả |
|-----------|---------|
| Ngay khi tạo | Buổi bù `curriculumUnitId = null` ⇒ dual-gate fail-closed ⇒ **roster rỗng**, không điểm danh được |
| Khi restamp chạy sau (hủy bất kỳ buổi nào) | Buổi bù **chiếm một vị trí** ⇒ đẩy lệch mọi buổi sau ⇒ **unit 4 buổi âm thầm thành 5 buổi thực** ⇒ dải unit đã bán phủ ít bài hơn số đã bán |

## Lý do `cmc-lms` bỏ buổi bù (giữ nguyên lý do, đừng chỉ giữ kết quả)

Buổi bù ở `cmc-lms` **đã làm xong, có test, có UI, đã áp migration — rồi mới gỡ có chủ đích**.
Hai lớp lập luận (nguồn: journal `260728-0034`, `class-unit-spec` §4):

1. **28/07** — dưới mô hình unit-theo-tháng, hủy buổi **không tạo nợ** ⇒ máy trạng thái bù là thừa.
2. **01/08** — sau khi unit đếm theo **số buổi hợp lệ**, hủy buổi **có** tạo nợ, nhưng nợ được xử bằng
   **lùi tiến độ**: lớp vẫn đủ 4 buổi/unit, chỉ dài hơn ⇒ vẫn không cần buổi bù.

**Quyết định vận hành đi kèm:** HS nghỉ vẫn **ở trong roster** nên **vẫn nhận bài về nhà**;
học bù thật do **cơ sở sắp xếp ngoài hệ thống**. Muốn dạy thêm thì **thêm khung lịch tuần**,
không tạo buổi rời.

> ⚠️ Đừng tái lập buổi bù với lý do "giờ đã có nợ buổi" — nợ đó đã có cơ chế lùi.

---

## Thứ tự thi công — sửa lại 2026-08-12 sau khi rà code thật

**B1 và B2 đã xong** trong PR #117 (merge vào `develop`).

| Đợt sóng | Bước | Phụ thuộc mốc đóng băng `cmc-lms`? |
|----------|------|-----------------------------------|
| **1** | **B3** rồi **B4** | **Không** — chỉ gỡ nợ của chính `cmc_edu` và đổi khoá nội bộ |
| **2** | **B5** rồi **B6** | **Có** — đây là phần port mô hình từ `cmc-lms` |

Hai điều làm rõ sau khi đọc code:

1. **`Submission` chỉ migrate MỘT lần.** B4 đổi `Submission` sang trỏ `SessionExercise`; B5 đổi
   `SessionExercise` trỏ sang `ExerciseFile`. Hai bước chạm hai bảng khác nhau. Bản kế hoạch
   trước lo phải migrate hai lần — **lo thừa**.
2. **B3 rẻ hơn tưởng.** Ba hàm trong `open-tier.ts` đều đã có sẵn nhánh rẽ sang phát bài. Giao
   diện học sinh gọi cùng procedure `exercise.openForStudent` nên **không phải sửa `apps/lms`**.

**B5 lớn hơn tên gọi rất nhiều — 31 file (52 kể cả test).** Nó không phải "thêm thư viện PDF"
mà là **thay hẳn mô hình danh mục bài tập**:

| | `cmc_edu` hiện tại | Chuẩn `cmc-lms` |
|---|---|---|
| Bài tập | `Exercise` **bắt buộc gắn unit**, `unique(unit, type)` — mỗi unit chỉ **một** bài mỗi loại | `ExerciseFile` trong thư mục, **không** gắn unit |
| Dãy bài lớp | trỏ `exerciseId` | trỏ `exerciseFileId` + **lưu tên thư mục lúc gán** |
| Điểm tối đa / thưởng sao | cấu hình theo từng bài | **hằng số 10 / 10** |
| Điểm | **số nguyên** | cho **điểm lẻ 7.5** |

Hai dòng cuối là khác biệt **nghiệp vụ thật**: giáo viên ở `cmc_edu` hiện **không chấm được 7.5**.

Và `Exercise` gắn unit chính là mô hình `cmc-lms` đã cố ý bỏ ⇒ B5 xoá nó cũng làm **Tier A chết
theo**. Làm B3 trước chỉ là dọn sớm, không mâu thuẫn.

## Các bước

### B1. Gỡ đường buổi bù
Quy mô: **20 file, 9 test**. Gồm API `addMakeup`, UI "Thêm buổi bù", cột `isMakeup` /
`makeupForSessionId`, badge lịch, seed e2e.
Cần quyết định dữ liệu: các hàng `isMakeup=true` đang có xử lý ra sao (đếm ở cổng đo A2, truy vấn #8).

### B2. Gỡ Tier B của open-tier
Tier B mở bài theo buổi bù có điểm danh ⇒ mất buổi bù thì Tier B chết. Quy mô: `open-tier.ts:146-170` + test.

### B3. Tắt open-tier, chuyển hẳn sang delivery
`LMS_OPEN_TIER_ENABLED=0` ⇒ bài mở **chỉ** qua `SessionExercise` đã phát (dual-gate roster).
Quy mô open-tier: **13 file, 5 test**. Phải chuyển UI học sinh sang nguồn delivery trước khi tắt.

### B4. Rekey `Submission`

| | Hiện tại `cmc_edu` | Chuẩn `cmc-lms` |
|--|-------------------|-----------------|
| Khóa | `unique(exerciseId, studentId)` | `unique(sessionExerciseId, studentId)` |

**Hệ quả nghiệp vụ của khóa hiện tại** (dễ bỏ sót): một bài **chỉ nộp được một lần vĩnh viễn**.
HS học lại unit (lớp ôn / học lại khóa) **không nộp lại được** — bản ghi cũ chặn.
Đây là lỗi nghiệp vụ, không chỉ khác biệt kỹ thuật.

Cần migration dữ liệu: ánh xạ `Submission` cũ sang `SessionExercise` tương ứng; bài không map được
phải có quyết định (giữ lịch sử hay bỏ). `cmc-lms` khi migrate đã **bỏ submission cũ có chủ đích** —
cân nhắc phương án tương tự.

### B5. Thư viện bài PDF (`ExerciseFolder` / `ExerciseFile`)
`cmc_edu` **chưa có**. `cmc-lms` dùng thư mục + file có `pdfRef` sha256, archive không xóa blob.
Cần cho mô hình delivery (dãy bài của lớp lấy từ thư viện).

### B6. Màn xếp dãy bài cho lớp — **chuyển từ Đợt A sang đây**

Red-team 12/08 cắt việc này khỏi Đợt A. Lý do:

- `cmc_edu` hiện gắn bài tập vào unit (`Exercise` bắt buộc có `curriculumUnitId`), còn chuẩn
  `cmc-lms` lấy bài từ **thư viện thư mục** (`ExerciseFile`) — mô hình gắn-bài-vào-unit là thứ
  `cmc-lms` **đã cố ý bỏ**. Dựng màn trên mô hình cũ = **vi phạm Rào chắn 1** của chương trình.
- Nếu Đợt A ship màn này rồi vận hành xếp dãy thật, B5 đổi sang thư viện file sẽ khiến
  **dữ liệu dãy đã xếp phải vứt hoặc chuyển đổi**, và màn phải làm lại.

⇒ Chỉ dựng màn xếp dãy **sau B5**, trên thư viện file.

---

## Kiểm chứng

- Không còn đường tạo buổi bù (grep sạch, test cũ gỡ hoặc viết lại)
- Test: hủy buổi → unit lùi đúng, không có buổi nào chiếm vị trí sai
- Test: HS học lại unit **nộp lại được** (chứng minh B4 đã sửa lỗi nghiệp vụ)
- Test: `LMS_OPEN_TIER_ENABLED=0` → bài chỉ đến từ delivery
- `typecheck-and-test` + `ui-e2e` xanh

## Rủi ro

| Rủi ro | Giảm thiểu |
|--------|-----------|
| Tắt open-tier khi UI học sinh chưa chuyển ⇒ HS mất bài | B3 chỉ sau khi UI đọc nguồn delivery; có thể bật lại bằng env |
| Migration `Submission` mất lịch sử | Quyết định dữ liệu trước; backup trước migration |
| Gỡ `isMakeup` khi prod còn hàng | Đếm ở cổng đo A2 (#8); có bước xử lý dữ liệu tồn |
