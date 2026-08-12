---
title: "Thư viện bài tập và xếp dãy bài cho lớp"
description: "Đợt 2 B5+B6: gỡ ràng buộc unit khỏi Exercise, thêm thư mục và tên bài, bỏ fallback phát bài theo unit, dựng màn thư viện và màn xếp dãy."
status: pending
priority: P1
effort: "1.5–2.5 tuần"
tags: [lms, exercise, library, sequence]
created: 2026-08-13
---

# Thư viện bài tập + xếp dãy bài (Đợt 2: B5 + B6)

> **Bản này đã qua red-team (2 lăng kính) và validate (2 lăng kính) và bị sửa đáng kể.**
> Nhật ký phân xử ở cuối file.

## Vì sao — nút thắt thật

| | |
|---|---|
| 1 unit | **4 buổi** |
| 1 buổi | **tối đa 1 bài được phát** |
| Danh mục hiện cho phép | **1 bài mỗi loại trên mỗi unit** (`@@unique([curriculumUnitId, type])`) |

⇒ **Không tạo được 4 bài tập về nhà khác nhau cho cùng một unit.** Cả chương trình UCREA (36 unit
= 144 buổi) chỉ chứa nổi **36 bài** `homework`, trong khi cần tới **144**.

> **Nói cho chính xác:** đây **không phải** "bất khả xếp dãy". Dãy của lớp là danh sách phẳng nên
> về kỹ thuật vẫn xếp được bằng cách mượn bài của unit khác. Nút thắt là **không có đủ chỗ trong
> danh mục** để soạn đúng bài cho từng buổi. Bản brainstorm đầu nói "không xếp nổi" là **nói quá** —
> validate đã bắt.

Ràng buộc `unique(unit, type)` là hệ quả của việc bài gắn vào unit. Gỡ được nó là gỡ nút thắt.

## Quyết định thiết kế — KHÔNG bê nguyên `ExerciseFile` của `cmc-lms`

`cmc-lms` **không có** `status`/publish/`type` **không phải vì chúng sai**, mà vì bên đó
**chỉ làm bài tập về nhà**. Đây là **loại 2 của Rào chắn 1: bỏ vì phạm vi hẹp ⇒ `cmc_edu` phải giữ**.

Bê nguyên sẽ **phá luồng nghiệm thu P2-04** và xoá cổng chặn `status = 'published'` mà việc phát
bài và việc học sinh mở bài đang dựa vào.

⇒ **Sửa chính `Exercise`:**

| Việc | Chi tiết |
|------|----------|
| **Bỏ** `curriculumUnitId` + `@@unique([curriculumUnitId, type])` | Gốc của nút thắt |
| **Thêm** `title` | ⚠ `Exercise` **hiện không có tên**. Bỏ liên kết unit thì bài thành vô danh trong thư viện |
| **Thêm** `ExerciseFolder` | `name`, `description`, `archivedAt` — **phẳng một cấp** |
| **Thêm** `folderId` + `orderInFolder` | `@@unique([folderId, orderInFolder])` |
| **Bỏ** fallback phát bài theo unit | Xem mục dưới — đây là thay đổi hành vi, không phải dọn dẹp |
| **Giữ** `status`, `type`, `maxScore`, `starReward`, `basePdfRef` | Đều đang được dùng thật |

**`ClassExerciseItem`, `SessionExercise`, `Submission` KHÔNG đổi** — vẫn trỏ `Exercise`.

## Thay đổi hành vi phải nói rõ: bỏ fallback phát bài theo unit

`deliverForSession` hiện có hai nhánh:

| Nhánh | Hành vi |
|-------|---------|
| Lớp **có** dãy bài | Phát bài kế tiếp trong dãy |
| Lớp **không** có dãy | **Fallback:** tìm bài `homework` `published` của unit buổi đó |

Nhánh fallback đọc `Exercise.curriculumUnitId` ⇒ bỏ cột là **giết nhánh này**.

**Quyết định: bỏ hẳn fallback.** `cmc-lms` không có nhánh này — dãy bài là bắt buộc. Giữ lại thì
phải giữ luôn liên kết unit, tức là không gỡ được nút thắt.

**Hệ quả:** lớp **không có dãy bài ⇒ không có bài tập nào được phát.** Bắt buộc:
- Màn xếp dãy (Phase 4) phải **cảnh báo rõ** khi lớp chưa có dãy
- Test đang khoá hành vi fallback phải **viết lại** để khẳng định hành vi mới, không xoá suông

## Ba mặc định (theo `cmc-lms`)

1. **Thư mục phẳng một cấp** — không lồng nhau
2. **Một bài thuộc đúng một thư mục**
3. **Bài cũ đang gắn unit** ⇒ gom vào thư mục "Chưa phân loại", không xoá

## ⚠ `ExerciseFolder` KHÔNG có `facilityId`, KHÔNG bật RLS

Đây là chỗ dễ làm sai nhất. Quy ước chung của repo là *"bảng mới phải có `facilityId` + FORCE RLS"* —
**nhưng `Exercise` và `CurriculumUnit` là danh mục dùng chung toàn hệ (QĐ 0021), không facility-scoped**,
và router bài tập gọi `ctx.db` **không** qua `withFacility`.

Gắn RLS lên `ExerciseFolder` ⇒ policy so `current_setting('app.current_facility_id')` từ chối mọi
hàng ⇒ **danh sách thư mục rỗng hoặc lỗi 500**.

⇒ `ExerciseFolder` theo đúng khuôn `Exercise`: **global, không RLS**. Nhưng **phải `GRANT` đủ**:
`SELECT, INSERT, UPDATE` cho `cmc_app` — mặc định Wave-A chỉ cấp `SELECT`/`INSERT`, thiếu `UPDATE`
thì đổi tên và ẩn thư mục sẽ bị từ chối quyền.

## Phases

| # | Phase | Outcome |
|---|-------|---------|
| 1 | [Nền dữ liệu thư viện](./phase-01-nen-du-lieu-thu-vien.md) | `ExerciseFolder`, `Exercise` thôi gắn unit + có `title`, migration ba bước |
| 2 | [API thư mục, soạn bài, bỏ fallback](./phase-02-api-thu-muc-va-soan-bai.md) | CRUD thư mục, sửa API bài tập, gỡ fallback, cập nhật manifest |
| 3 | [Màn thư viện](./phase-03-man-thu-vien.md) | GĐĐT quản thư mục và bài |
| 4 | [Màn xếp dãy bài](./phase-04-man-xep-day-bai.md) | Kéo bài từ thư viện vào dãy của lớp |

**Phase 1 và 2 phải vào cùng một lần** — Phase 1 một mình làm vỡ typecheck, delivery và e2e.
Phase 3 và 4 chạy song song được sau đó.

## Tiêu chí nghiệm thu

- [ ] `Exercise` không còn `curriculumUnitId`, **có `title`**; tạo được **nhiều bài homework** không giới hạn theo unit
- [ ] `ExerciseFolder` **không có `facilityId`, không RLS**, có `GRANT UPDATE`
- [ ] Thư mục CRUD + ẩn được; ẩn thư mục **không** đụng dãy đã gán
- [ ] Fallback phát bài theo unit **đã gỡ**; test khẳng định lớp không dãy ⇒ không phát bài
- [ ] Luồng nghiệm thu **P2-04 vẫn `built`** — manifest đã cập nhật; **chạy `acceptance:report` để chứng minh**
- [ ] Xếp được dãy ≥ 4 bài; phần **đã phát khoá không sửa được**
- [ ] Cảnh báo khi lớp **chưa có dãy** và khi dãy **ngắn hơn số buổi còn lại**
- [ ] `pnpm typecheck` **toàn repo** + toàn bộ test xanh

## Rủi ro

| # | Rủi ro | Giảm thiểu |
|---|--------|-----------|
| R1 | Gắn `facilityId`+RLS lên `ExerciseFolder` ⇒ thư mục rỗng/500 | Đã ghi rõ ở trên; kiểm bằng test list thư mục |
| R2 | Bỏ fallback ⇒ lớp chưa có dãy im lặng không có bài | Cảnh báo ở màn xếp dãy; test khẳng định hành vi mới |
| R3 | `ADD COLUMN NOT NULL` trên bảng có dữ liệu ⇒ migration đỏ | Ba bước: thêm nullable → backfill → set NOT NULL |
| R4 | Gom bài cũ vào một thư mục với `orderInFolder` trùng ⇒ unique fail | Đánh số tuần tự khi backfill, tạo unique **sau** |
| R5 | Thiếu `GRANT UPDATE` ⇒ ẩn/đổi tên thư mục bị từ chối quyền | Ghi trong migration |
| R6 | `cleanupCurriculumUnits` xoá bài theo `curriculumUnitId` ⇒ vỡ, và để lại bài "ma" | Sửa helper trong cùng phase |
| R7 | Quên cập nhật `flow-manifest.ts` ⇒ **âm thầm** tụt nghiệm thu mà CI xanh | Bài học từ PR #117; tiêu chí nghiệm thu bắt chạy `acceptance:report` |

---

## Nhật ký kiểm định

### Red Team — 2026-08-13 (2 lăng kính: phạm vi/thiết kế · hỏng dữ liệu/migration)

| ID | Mức | Phát hiện | Phân xử |
|----|-----|-----------|---------|
| F1 | **CRITICAL** | `deliverForSession` fallback đọc `Exercise.curriculumUnitId`; bỏ cột ⇒ lớp không dãy **im lặng không có bài** | **Nhận** — nâng thành quyết định thiết kế tường minh: bỏ hẳn fallback, viết lại test, cảnh báo ở UI |
| F2 | **CRITICAL** | Gắn `facilityId`+RLS lên `ExerciseFolder` ⇒ mọi truy vấn trả 0 hàng | **Nhận** — thành mục cảnh báo riêng trong plan |
| F3 | HIGH | `ADD COLUMN NOT NULL` trên bảng có dữ liệu ⇒ migration đỏ | **Nhận** — migration ba bước |
| F4 | HIGH | `orderInFolder` trùng khi gom hàng loạt ⇒ unique fail | **Nhận** — đánh số tuần tự, unique tạo sau |
| F5 | HIGH | `cleanupCurriculumUnits` xoá bài theo `curriculumUnitId` | **Nhận** — R6 |
| F6 | HIGH | Wave-A chỉ `GRANT SELECT/INSERT`; thiếu `UPDATE` cho ẩn/đổi tên | **Nhận** |
| F7 / RT-B5-4 | HIGH | Plan vừa nói `ClassExerciseItem` không đổi, vừa đòi `folderNameAtAssign` — **mâu thuẫn nội bộ** | **Nhận, bỏ yêu cầu đóng dấu tên thư mục.** Sau khi `Exercise` có `title`, màn dãy bài hiển thị bằng tên bài, không cần tên thư mục ⇒ không cần thêm cột |
| RT-B5-12 | HIGH | `Exercise` **không có `title`** — bỏ unit thì bài vô danh | **Nhận** — thêm `title`, đưa vào tiêu chí nghiệm thu |
| RT-B5-13 | HIGH | `status` và `archivedAt` là hai máy trạng thái, chưa viết rõ | **Nhận** — `status` cho **bài**, `archivedAt` cho **thư mục**. Không thêm `archivedAt` cho bài |
| RT-B5-10 | HIGH | Phase 1 một mình làm vỡ typecheck + delivery + e2e | **Nhận** — Phase 1 và 2 vào cùng một lần |
| RT-B5-1 | HIGH | Mô hình khác `cmc-lms` làm việc nhập dữ liệu ở Đợt 5 khó hơn | **Ghi nhận, chấp nhận.** `cmc-lms` không có `status`/`type` nên nhập vào `cmc_edu` là ánh xạ **thêm** giá trị mặc định, không phải mất dữ liệu. Rẻ hơn là phá P2-04 |

### Validate — 2026-08-13 (2 lăng kính: đối chiếu sự thật · trải nghiệm và ca biên)

| Khẳng định trong bản đầu | Kết quả |
|--------------------------|---------|
| 1 unit = 4 buổi | **ĐÚNG** |
| 1 buổi = 1 bài được phát | **MỘT PHẦN** — là *tối đa một*; buổi hủy bị bỏ qua, buổi chưa kết thúc bị từ chối |
| Danh mục nhỏ hơn 4 lần ⇒ **không xếp nổi dãy** | **SAI như một bất khả** — dãy là danh sách phẳng nên vẫn xếp được bằng cách mượn bài unit khác. **Đã sửa lại cách phát biểu** |
| `type` không điều khiển hành vi nào | **SAI** — fallback `findFirst({ type: 'homework' })` là rẽ nhánh thật, và unique là ràng buộc thật |
| `maxScore`/`starReward` "chưa rõ có ai dùng khác 10" | **MỘT PHẦN** — API và test **có** dùng khác 10 (`submission.grade` so `maxScore`, cộng `starReward`); chỉ form soạn bài không gửi |
| `status = 'published'` là cổng chặn thật | **ĐÚNG** — cả xếp dãy, phát bài, và học sinh mở bài |
| P2-04 là luồng nghiệm thu thật, khai 5 procedure | **ĐÚNG** |
| `ClassExerciseItem`/`SessionExercise`/`Submission` không phải đổi | **ĐÚNG** |

**Mâu thuẫn chưa giải quyết:** không còn.

<!-- slug: thu-vien-bai-tap-va-xep-day -->
