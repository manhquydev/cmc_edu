# Brainstorm + Advise — Thư viện bài tập (Đợt 2: B5 + B6)

**Ngày:** 2026-08-13 · **Trạng thái:** phân tích, chưa implement
**Bối cảnh:** B1–B4 đã ship (PR #117, #118). Mốc đóng băng `cmc-lms` = `031d193` (chốt 12/08).

---

## 1. Vì sao B5 tồn tại — bài toán số học

| | |
|---|---|
| 1 unit | **4 buổi** (`SESSIONS_PER_UNIT = 4`) |
| 1 buổi | **1 bài được phát** (`SessionExercise.classSessionId @unique`) |
| ⇒ Một unit cần | **4 bài** |
| Danh mục hiện cho phép | **1 bài mỗi loại trên mỗi unit** (`@@unique([curriculumUnitId, type])`) |

**Danh mục nhỏ hơn 4 lần so với nhu cầu.** Không thể xếp nổi một dãy bài đầy đủ cho lớp — đây là
lý do thật sự của B5, không phải "muốn có thư viện PDF cho đẹp".

Ràng buộc `unique(unit, type)` là **hệ quả của việc bài gắn vào unit**. Gỡ được nó thì gỡ luôn
nút thắt.

---

## 2. Cạm bẫy: đừng bê nguyên `ExerciseFile` của `cmc-lms`

Mô hình `cmc-lms` **gọn hơn** `cmc_edu` ở đúng những chỗ `cmc_edu` **đang dùng thật**:

| Trường | `cmc_edu` `Exercise` | `cmc-lms` `ExerciseFile` | `cmc_edu` có dùng thật không? |
|--------|----------------------|--------------------------|-------------------------------|
| `status` draft/published/closed | ✅ | ❌ chỉ có `archivedAt` | **CÓ — và là cổng chặn thật.** `open-tier` và phát bài đều đòi `status = 'published'` |
| Quy trình publish / close | ✅ | ❌ | **CÓ — là luồng nghiệm thu P2-04**, khai 5 procedure `exercise.create/publish/close/get/list` |
| `type` homework / test_entrance / test_periodic | ✅ | ❌ | **Có nhãn, không có hành vi** — không code nào rẽ nhánh theo `type` |
| `maxScore` / `starReward` theo từng bài | ✅ | ❌ hằng số 10 / 10 | Có cấu hình được, chưa rõ có ai dùng khác 10 |
| Gắn vào unit | ✅ **bắt buộc** | ❌ không gắn | **Đây là thứ phải bỏ** |
| Thư mục + thứ tự trong thư mục | ❌ | ✅ | **Đây là thứ phải thêm** |

### Áp đúng Rào chắn 1

Rào chắn 1 của chương trình nói: *"cái `cmc-lms` đã bỏ" có hai loại — bỏ vì **nghiệp vụ sai**
(cũng phải bỏ theo) và bỏ vì **phạm vi hẹp** (phải giữ)*.

`cmc-lms` **không có** `status`/publish/`type` **không phải vì chúng sai**, mà vì bên đó
**chỉ làm bài tập về nhà**, không có bài kiểm tra đầu vào / định kỳ và không có quy trình soạn–duyệt–phát hành bài.

⇒ Chúng thuộc **loại 2: phải giữ**. Bê nguyên `ExerciseFile` sẽ:
- **Phá luồng nghiệm thu P2-04** (5 procedure biến mất) ⇒ tụt số nghiệm thu
- Xoá quy trình publish/close đang là cổng chặn thật của việc phát bài
- Xoá phân loại bài kiểm tra

---

## 3. Đề xuất: **gỡ ràng buộc unit + thêm thư mục**, không thay model

Thay vì thay `Exercise` bằng `ExerciseFile`, **sửa chính `Exercise`**:

| Việc | Chi tiết |
|------|----------|
| **Bỏ** `curriculumUnitId` | Bài tập thôi gắn vào unit — đây là gốc của nút thắt |
| **Bỏ** `@@unique([curriculumUnitId, type])` | Ràng buộc 4-lần-quá-nhỏ biến mất theo |
| **Thêm** model `ExerciseFolder` | `name`, `description`, `archivedAt` |
| **Thêm** `folderId` + `orderInFolder` vào `Exercise` | `@@unique([folderId, orderInFolder])` như chuẩn |
| **Giữ** `status`, `type`, `maxScore`, `starReward`, `basePdfRef` | Đây là năng lực `cmc_edu` đang dùng thật |

### Vì sao cách này tốt hơn

| | Bê nguyên `ExerciseFile` | **Gỡ unit + thêm thư mục** |
|---|---|---|
| Đạt mục tiêu B5 (thư viện tự do, xếp dãy được) | ✅ | ✅ |
| Giữ luồng nghiệm thu P2-04 | ❌ vỡ | ✅ |
| Giữ publish/close | ❌ mất | ✅ |
| Giữ phân loại bài kiểm tra | ❌ mất | ✅ |
| Quy mô | Thay bảng, sửa `ClassExerciseItem` + `SessionExercise` + toàn bộ UI | **Sửa cột trên bảng có sẵn**; `ClassExerciseItem`/`SessionExercise` **không đổi** vì vẫn trỏ `Exercise` |
| Rủi ro | Cao | Thấp hơn hẳn |

**Điểm hay nhất:** `ClassExerciseItem` và `SessionExercise` **giữ nguyên** — chúng đã trỏ
`exerciseId`, và `Submission` (sau B4) trỏ `SessionExercise`. Cả chuỗi phát bài–nộp bài–chấm
**không phải đụng gì**.

### `type` có nên giữ không

Giữ, nhưng **thư mục sẽ dần thay vai trò phân loại** — admin tạo thư mục "Kiểm tra đầu vào" thì
tự nhiên gom nhóm được mà không cần sửa enum. Không xoá `type` trong đợt này vì UI đang dùng nó
để lọc và nó nằm trong luồng nghiệm thu; để nó thành nợ nhỏ, xử sau nếu thấy thừa.

---

## 4. B6 — màn xếp dãy bài

Sau B5, `lmsOps.assignExerciseSequence` đã có sẵn (nhận `exerciseIds` theo thứ tự) nhưng
**chưa có màn**. B6 dựng nó.

### Ba màn

**Màn 1 — Thư viện** (GĐĐT): cây thư mục bên trái, danh sách bài bên phải. Mỗi bài hiện tên,
loại, trạng thái, và **có đang nằm trong dãy của lớp nào không**. Tạo/sửa thư mục, tải bài lên,
đổi thứ tự trong thư mục, ẩn bài.

**Màn 2 — Xếp dãy bài cho lớp** (GĐĐT): hai cột — thư viện bên trái, dãy của lớp bên phải.
Kéo sang, sắp thứ tự. Hiện rõ:
- Vị trí nào **đã phát rồi** ⇒ **khoá, không sửa được**
- Vị trí kế tiếp sẽ phát vào buổi nào
- Cảnh báo khi dãy **ngắn hơn số buổi còn lại** — lớp sẽ hết bài giữa chừng

**Màn 3 — Xem trước lịch phát**: bảng buổi → bài sẽ phát, để GĐĐT soát trước khi lưu.

### Ràng buộc nghiệp vụ phải giữ

- Phần dãy **đã phát** đóng băng (đã có trong `exercise-sequence.ts`)
- Chỉ bài `status = 'published'` mới xếp được vào dãy
- Lưu **tên thư mục lúc gán** như `cmc-lms` (`folderNameAtAssign`) để hiển thị đúng kể cả khi
  thư mục bị đổi tên hoặc ẩn — đây là bất biến "đóng dấu" giống chuyện giá bán
- Sửa dãy **không** làm lệch con trỏ phát bài

---

## 5. Rủi ro

| # | Rủi ro | Giảm thiểu |
|---|--------|-----------|
| R1 | Bỏ `curriculumUnitId` làm vỡ Tier A | **Không còn Tier A** — đã gỡ ở PR #118. Rủi ro này đã tự biến mất |
| R2 | `curriculumUnit.list` rời khỏi luồng P2-04 | Đúng và mong muốn: màn soạn bài thôi chọn unit, chuyển sang chọn thư mục. Phải cập nhật manifest — **bài học đã có, đừng quên lần nữa** |
| R3 | Dữ liệu `Exercise` cũ có `curriculumUnitId` NOT NULL | Chưa production ⇒ tạo thư mục mặc định rồi gán hết vào, hoặc xoá sạch. Rẻ |
| R4 | Lớp đã có dãy bài trỏ bài cũ | `ClassExerciseItem` không đổi FK nên không vỡ |
| R5 | Dãy ngắn hơn số buổi ⇒ lớp hết bài giữa chừng | Cảnh báo ở màn 2 + báo cáo; **không** tự lặp lại bài |

---

## 6. Phạm vi đề xuất

**Trong phạm vi:** `ExerciseFolder` + `folderId`/`orderInFolder` trên `Exercise`; bỏ ràng buộc
unit; API thư mục (CRUD, ẩn); màn thư viện; màn xếp dãy bài; cập nhật manifest nghiệm thu.

**Ngoài phạm vi:** xoá `type`; đổi `maxScore`/`starReward` thành hằng số; điểm lẻ 7.5; thư mục
lồng nhau; phiên bản bài tập.

---

## Câu hỏi còn lại

1. **Thư mục có cần lồng nhau không?** `cmc-lms` để **phẳng một cấp**. Đề xuất theo: phẳng.
2. **Bài cũ đang gắn unit xử lý sao** — gom vào một thư mục "Chưa phân loại", hay xoá sạch làm lại?
   Chưa production nên cả hai đều rẻ; đề xuất gom để giữ dữ liệu thử.
3. **Một bài có được nằm ở nhiều thư mục không?** `cmc-lms`: không (`folderId` đơn). Đề xuất theo.
