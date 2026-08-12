# VALIDATE — kiểm chứng sự thật B5/B6 (không red-team)

**Ngày:** 2026-08-13  
**Nhánh:** `feat/lms-exercise-library` @ `/home/manhquy/Downloads/cmc_edu`  
**Chế độ:** chỉ đọc; không sửa repo; không commit  
**Nguồn khẳng định:**  
- `plans/260813-0053-thu-vien-bai-tap-va-xep-day/plan.md`  
- `plans/reports/brainstorm-260813-0053-thu-vien-bai-tap-b5-b6.md`  
**Đối chứng:** schema + API + test + manifest + `/home/manhquy/Downloads/cmc-lms`

Kết luận từng dòng: **DUNG** | **SAI** | **MOT PHAN**. Không công kích thiết kế; chỉ nói code đang làm gì.

---

## 8 ưu tiên

### (1) 1 unit = 4 buổi, 1 buổi = 1 bài được phát

| Mảnh | Kết luận | Bằng chứng |
|------|----------|------------|
| 1 unit = 4 buổi | **DUNG** | `SESSIONS_PER_UNIT = 4` trong `packages/domain-lms/src/unit-progression.ts:14`. Comment cùng file: CSV `sessions=4` cho mọi chương trình. Cột `4` xuất hiện trên mọi dòng `packages/db/prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv`. |
| 1 buổi = đúng 1 bài được phát | **MOT PHAN** | `SessionExercise.classSessionId String @unique` (`schema.prisma:866`) + comment “at most one per session” (`:860`). Đó là **tối đa một**, không phải **mọi buổi đều được phát**. Worker bỏ buổi `cancelled`; buổi chưa `endTime` bị từ chối; dãy hết thì `deliverForSession` trả `null` (`exercise-delivery.ts:140-182`). Không có sequence thì fallback chỉ phát nếu tìm được homework `published` của unit đóng dấu (`:188-198`). |

Suy ra “một unit cần 4 bài” (`plan.md:19`, brainstorm §1) là **suy luận sản phẩm**, không phải bất biến code. Code có thể phát **cùng một** homework cho cả 4 buổi (đường fallback, test `unit-stamp fallback delivers published homework without sequence` trong `exercise-delivery.int.test.ts:132-155`).

---

### (2) `@@unique([curriculumUnitId, type])` = mỗi unit chỉ một bài mỗi loại

**DUNG.**

- Schema: `schema.prisma:830-831` — comment “One exercise per (unit, type)”.
- `ExerciseType` chỉ có 3 giá trị: `homework | test_entrance | test_periodic` (`schema.prisma:158-162`).
- API bắt conflict: `exercise.create` bắt `P2002` → `CONFLICT` “An exercise of this type already exists for this unit.” (`apps/api/src/exercise/router.ts:165-168`).
- Test khóa: `publish.test.ts:148-161` tạo hai `homework` cùng unit → CONFLICT.

Hệ quả số học **đúng từ ràng buộc này**: tối đa **3 bài / unit** (một bài mỗi loại), không phải 1 bài / unit tuyệt đối. Câu “1 bài mỗi loại trên mỗi unit” khớp code. Câu “danh mục nhỏ hơn 4 lần” **không** suy ra trực tiếp từ unique này (xem mục 3).

---

### (3) “Danh mục nhỏ hơn 4 lần nhu cầu ⇒ không xếp nổi dãy đầy đủ”

**MOT PHAN — phần số học local đúng nếu cộng thêm giả định; kết luận “không xếp nổi” thì SAI.**

#### 3a. Một bài có xếp nhiều lần trong dãy **một lớp** không?

| Đường | Được lặp không? | Bằng chứng |
|-------|-----------------|------------|
| `assignExerciseSequence` lần đầu | **Không** | `writeSequenceUpdate` từ chối mảng trùng: `exerciseIds must be unique.` (`exercise-delivery.ts:77-78`). Không có `@@unique([classBatchId, exerciseId])` trên `ClassExerciseItem` — chặn ở **tầng API**, không phải DB. |
| Gán lại sau khi đã phát | **Có thể** | Unique chỉ kiểm mảng `exerciseIds` mới, không đối chiếu phần `kept`. `planSequenceUpdate` giữ vị trí đã phát rồi nối toàn bộ mảng mới từ `deliveredCount+1` (`exercise-sequence.ts:33-41`). Nếu truyền lại id đã nằm ở phần đóng băng, dãy có thể chứa cùng `exerciseId` hai vị trí. |
| Không có dãy (fallback unit-stamp) | **Có** | Mọi buổi cùng unit, không sequence, đều `findFirst` cùng một homework (`exercise-delivery.ts:190-199`). Test fallback chứng minh. |
| Model `SessionExercise` / `Submission` | **Cho phép** | Không unique `(classBatchId, exerciseId)`. Comment `Submission` (`schema.prisma:892-893`): “Same catalog exercise delivered on two sessions yields two independent submissions”. |

Vậy: **ý định xếp dãy = không lặp** (và plan R3 “không tự lặp bài” khớp ý định đó). **Hạ tầng phát/nộp thì cho phép lặp.** Không thể lấy “lặp trong dãy” làm đường chính để phủ nhận nút thắt unique.

#### 3b. Một bài dùng chung giữa các lớp được không?

**DUNG — được, và đây là thiết kế catalog.**

- `Exercise` **global**, không `facilityId`, không RLS; comment: “one catalog of exercises per curriculum unit, **shared system-wide**” (`schema.prisma:807-810`).
- `ClassExerciseItem` chỉ unique `(classBatchId, position)` + index `exerciseId` (`:854-857`). Không cấm hai lớp trỏ cùng `exerciseId`.
- `writeSequenceUpdate` không kiểm “exercise này đã thuộc lớp khác”.

Dùng chung **không** tạo thêm slot phân biệt cho **một** lớp. Nên dùng chung **không** làm sai luận “1 homework / unit thì không đủ 4 bài khác nhau cho 4 buổi của unit đó”.

#### 3c. Có đường khác để một lớp có đủ bài không?

**Có. Ít nhất ba đường đang chạy trong code/test.**

1. **Mượn bài unit khác.** `assignExerciseSequence` chỉ đòi id tồn tại + `status = 'published'`. **Không** kiểm `exercise.curriculumUnitId` khớp unit của lớp/buổi. Test thật đã xếp homework unit 0 và unit 1 vào **một** lớp (`exercise-delivery.int.test.ts:71-77`).
2. **Dùng cả 3 loại.** Sequence nhận `test_periodic` (`:115-129`). Mỗi unit tối đa 3 bài catalog. 3 < 4 nếu bắt buộc 4 bài **của đúng unit đó**; không phải “nhỏ hơn 4 lần”.
3. **Không xếp dãy.** Fallback phát lại cùng homework mỗi buổi. Lớp **có bài để phát**, chỉ không có 4 PDF khác nhau.

Số học “4 lần”: 1 homework / unit vs 4 buổi = 1/4 **chỉ đúng** nếu (a) chỉ đếm loại `homework`, (b) mỗi buổi cần bài **khác nhau**, (c) bài phải thuộc **đúng unit đó**. Code không buộc (c); fallback không buộc (b). Enum có 3 loại nên trần catalog/unit = 3, không phải 1.

**Kết luận mục 3:** nút thắt “không tạo được 4 homework cho cùng một unit” là **DUNG**. Câu “không xếp nổi một dãy đầy đủ cho lớp” là **SAI** như một bất khả kỹ thuật. Dùng chung giữa lớp **không** đảo luận 4-lần. Lặp trong dãy lần gán đầu **bị cấm**, nên cũng **không** đảo luận đó.

---

### (4) `status = published` là cổng chặn thật của việc phát bài

**MOT PHAN — đúng ở cửa xếp dãy, fallback, và HS nhìn thấy; không đúng ở bước tạo `SessionExercise` khi đã có dãy.**

Cổng `published` có thật ở:

| Cửa | File |
|-----|------|
| Xếp dãy | `writeSequenceUpdate` lọc `status: 'published'`; thiếu → `Every exerciseId must exist and be published.` (`exercise-delivery.ts:81-86`) |
| Fallback không dãy | `findFirst({ type: 'homework', status: 'published' })` (`:190-195`) |
| HS mở bài | `listOpenExercisesForStudent` `exercise: { status: 'published' }` (`open-tier.ts:100`); `assertSessionExerciseOpenForStudent` ném nếu không published (`:201-202`) |

Cửa **không** kiểm lại `published`:

- Nhánh dãy của `deliverForSession` lấy `exerciseId` từ `ClassExerciseItem` rồi `sessionExercise.create` — không đọc `Exercise.status` (`:170-226`).
- Publish rồi xếp, sau đó `close`, buổi vẫn có thể được phát; HS sẽ **không** thấy vì open-tier lọc published.

`exercise.publish` comment nói published là precondition của open-tier, “not evaluated here” (`router.ts:174-175`). State machine draft → published → closed là có thật (`router.ts:174-202`).

Brain: “open-tier **và** phát bài đều đòi published” — nửa sau chỉ đúng nếu “phát bài” = xếp vào dãy hoặc fallback, không phải mọi lần ghi `SessionExercise`.

---

### (5) P2-04 là luồng nghiệm thu thật và khai 5 procedure `exercise.*`

**DUNG** (với một chỗ đếm 5 vs 6).

- Manifest: `scripts/acceptance-report/flow-manifest.ts:392-413`. `id: 'P2-04'`, `displayName: 'Cung cấp bài tập PDF'`, journey `apps/e2e/tests/journeys/exercise-publish-close.journey.ui.spec.ts`.
- `expected.trpc`: `exercise.create`, `exercise.publish`, `exercise.close`, `exercise.get`, `exercise.list`, **và** `curriculumUnit.list` — **5 procedure exercise + 1 unit list**.
- Comment actor (`:396-397`): “cả **5 procedure** của luồng đều gate `exercise.manage`” — chỉ 5 `exercise.*`.
- Comment journey (`:407-409`) đếm `create/publish/close/list/curriculumUnit.list` (sót `get` trong ngoặc, nhưng journey **có** mở phiếu `/teaching/exercises/:id` → `exercise.get`).
- Journey UI thật: tạo (unit + loại + upload PDF) → list thấy draft → mở phiếu → Công bố → Đóng.
- `verifyFlow` đánh `built` khi mọi symbol khai có trong scan và route không phải placeholder (`verify.ts:191-196`). Cả 6 procedure và `/teaching/exercises` đang tồn tại; P2-04 **cấu trúc là luồng nghiệm thu thật**. Trạng thái `proven` vs `built-unproven` phụ thuộc artifact CI — phiên này không chạy `pnpm acceptance:report`.

Bê nguyên `ExerciseFile` (không publish/close/get/list theo contract hiện tại) sẽ **gãy khai P2-04** — phần đó khớp.

---

### (6) `type` không điều khiển hành vi nào

**SAI.**

Không có `if (exercise.type === …)` trên chấm/nộp/publish. Nhưng `type` **có hành vi**:

1. **Unique catalog** — `(curriculumUnitId, type)` là khóa nghiệp vụ; tạo trùng loại bị CONFLICT (`router.ts:165-168`, `publish.test.ts:148-161`).
2. **Fallback phát bài chỉ lấy `homework`** (`exercise-delivery.ts:190-194`). `test_entrance` / `test_periodic` **không** tự phát khi lớp chưa có dãy.
3. **API list + UI lọc** theo `type` (`router.ts:135, 212`; `exercises.tsx:104-106`).
4. **Create bắt chọn type**; journey P2-04 chọn “Bài tập về nhà”.

Đúng phần “nhãn”: chấm điểm, sao, open-tier, submit **không** rẽ nhánh theo loại. Sai phần “không code nào rẽ nhánh” — fallback + unique là rẽ nhánh/ràng buộc thật.

`maxScore` / `starReward`: không phải “chưa rõ có ai dùng khác 10”. API nhận giá trị khác default; `submission.grade` so với `exercise.maxScore` và cộng `exercise.starReward` (`submission/router.ts:376-428`). Test dùng `starReward` 12 / 5 / 15. UI tạo bài **không** gửi hai field này → form luôn default 10. Kết luận brainstorm “có cấu hình được, chưa rõ ai dùng khác 10” = **MOT PHAN** (API/test có; UI soạn bài thì không).

---

### (7) `ClassExerciseItem` / `SessionExercise` / `Submission` không phải đổi nếu bỏ `curriculumUnitId` khỏi `Exercise`

**MOT PHAN.**

Schema ba bảng **không** chứa `curriculumUnitId`. Chúng chỉ FK `exerciseId` hoặc `sessionExerciseId` (`schema.prisma:843-930`). Bỏ cột trên `Exercise` **không** bắt đổi hình ba bảng đó. R4 brainstorm (“FK không đổi nên dãy cũ không vỡ”) **DUNG** về FK.

Nhưng chuỗi phát–nộp–chấm **có đọc** `Exercise.curriculumUnitId`:

- Fallback phát: `where: { curriculumUnitId: session.curriculumUnitId, type: 'homework', … }` (`exercise-delivery.ts:190-195`). Bỏ cột = phải sửa (hoặc xóa) fallback.
- `ExerciseDto` / `toExerciseDto` mang `curriculumUnitId` (`router.ts:61-91`).
- `assertSessionExerciseOpenForStudent` select `curriculumUnitId` (`open-tier.ts:162, 182`).

`ClassExerciseItem` của **edu hiện không có** `folderNameAtAssign`. Plan B6 muốn lưu tên thư mục lúc gán — đó **sẽ** đổi `ClassExerciseItem`, nhưng vì feature mới, không vì bỏ `curriculumUnitId`.

---

### (8) `cmc-lms` `ExerciseFile` thật sự không có `status` và `type`

**DUNG.**

Đối chiếu `/home/manhquy/Downloads/cmc-lms/packages/db/prisma/schema.prisma:636-655`:

```
model ExerciseFile {
  id, folderId, title, pdfRef, orderInFolder, archivedAt, createdById, createdAt
  @@unique([folderId, orderInFolder])
}
```

Không có `status`, `type`, `published`, `maxScore`, `starReward`, `curriculumUnitId`. Ẩn bằng `archivedAt`. Điểm/sao là hằng `MAX_SCORE = 10`, `STAR_REWARD = 10` (`cmc-lms/packages/domain/src/grading-scale.ts`).

`published` trong schema cmc-lms thuộc `SessionEvidence` / `Grade.isPublished`, **không** phải bài tập.

Comment model: “Bài tập KHÔNG gắn khung chương trình” (`:615-617`). `ExerciseFolder` một cấp, `archivedAt` (`:619-630`). `ClassExerciseItem.folderNameAtAssign` có thật (`:668`).

---

## Các khẳng định khác trong hai file

| # | Khẳng định | Kết luận | File đóng |
|---|------------|----------|-----------|
| A | `curriculumUnitId` trên `Exercise` bắt buộc (NOT NULL) | **DUNG** | `schema.prisma:816` `curriculumUnitId String` (không `?`). `create` bắt UUID unit (`router.ts:122, 147-150`). |
| B | Catalog bài là hệ quả của việc gắn unit; unique biến mất nếu gỡ unit | **DUNG** (cơ học) | Unique gồm `curriculumUnitId`. Gỡ cột thì unique đó không còn nghĩa. |
| C | `assignExerciseSequence` đã có, chưa có màn | **DUNG** | Procedure `lms-ops/router.ts:632`. `rg assignExerciseSequence apps/admin` = 0. `verify.ts:78-79` ghi documented gap “no student-facing UI/journey yet”. |
| D | `exercise-sequence.ts` đóng băng phần đã phát | **DUNG** | `planSequenceUpdate` giữ `position <= deliveredCount` (`exercise-sequence.ts:33-41`). Test freeze `exercise-delivery.int.test.ts:114-129`. |
| E | Chỉ bài `published` mới xếp vào dãy | **DUNG** | `exercise-delivery.ts:81-86`. |
| F | Không còn Tier A (PR #118) | **DUNG** | Commit `7abe1d4` `#118`. Test `open-tier.test.ts:158` “no Tier A”: buổi ended, có bài published, **không** `SessionExercise` → HS thấy `[]`. |
| G | B1–B4 đã ship PR #117, #118 | **MOT PHAN** | Hai PR tồn tại (`9acd2d7` #117 khung/unit; `7abe1d4` #118 phát/nộp). Không tự chứng 4 hạng mục B1–B4 map 1-1 vào đúng hai PR; chỉ chứng hai PR đó đã có trên history. |
| H | Mốc đóng băng cmc-lms = `031d193` (chốt 12/08) | **MOT PHAN** | `cmc-lms` HEAD/`031d193` = `031d19360845bf1d4f680ef911e16282d583f69b` (merge #34, **2026-08-09**). PR edu `#120` (12/08) mới là chỗ **chốt mốc**. Hash đúng; ngày trên commit không phải 12/08. |
| I | cmc-lms chỉ làm bài tập về nhà, không có kiểm tra đầu vào/định kỳ, không soạn–duyệt–phát hành | **DUNG** (schema) | `ExerciseFile` không type/status. Không model tương đương `ExerciseType` / `ExerciseStatus`. |
| J | cmc-lms thư mục phẳng một cấp; một bài một thư mục | **DUNG** | `folderId` đơn, comment “MỘT CẤP, không lồng nhau”. Không self-FK parent. |
| K | `@@unique([folderId, orderInFolder])` là chuẩn cmc-lms | **DUNG** | `cmc-lms` schema `:652`. |
| L | Giữ `status`, `type`, `maxScore`, `starReward`, `basePdfRef` vì đang dùng thật | **DUNG** (trừ cường độ `type`, xem §6) | `basePdfRef` bắt buộc lúc create; `status` là state machine + cổng; `maxScore`/`starReward` đi vào chấm/sao. |
| M | Bê nguyên `ExerciseFile` phá P2-04 và xóa cổng published | **DUNG** như hệ quả | P2-04 sống nhờ create/publish/close/get/list + UI trạng thái. `ExerciseFile` không có các field/procedure đó. |
| N | Exercise global, chia sẻ như CurriculumUnit | **DUNG** | `schema.prisma:807-810`. |
| O | Plan R3 “không tự lặp bài” khớp code hiện tại của **xếp dãy** | **DUNG** | Unique `exerciseIds` lúc gán. Fallback **có** tự dùng lại cùng homework — khác ý “không tự lặp” nếu hiểu cả đường không-dãy. |
| P | Chưa production nên gom bài cũ vào thư mục mặc định là rẻ | Không kiểm được từ code | Không có bằng chứng production/không production trong schema. Để **không kết luận**. |
| Q | UI đang dùng `type` để lọc; `type` nằm trong luồng nghiệm thu | **DUNG** | Filter bar `exercises.tsx`; journey chọn loại. |
| R | `folderNameAtAssign` là bất biến đóng dấu bên cmc-lms | **DUNG** | Cột + comment schema `:667-668`; domain `exercise-sequence.ts` ghi snapshot tên thư mục. Edu **chưa** có cột này. |

---

## Tóm tắt ưu tiên (một bảng)

| # | Khẳng định | Kết luận |
|---|------------|----------|
| 1 | 1 unit = 4 buổi; 1 buổi = 1 bài phát | **DUNG** / **MOT PHAN** |
| 2 | Unique `(unit, type)` = 1 bài mỗi loại / unit | **DUNG** |
| 3 | Danh mục nhỏ hơn 4 lần ⇒ không xếp nổi dãy | **MOT PHAN** (nút tạo 4 homework/unit đúng; “không xếp nổi lớp” sai; dùng chung lớp không đảo luận; lặp dãy lần đầu bị cấm) |
| 4 | `published` là cổng phát bài | **MOT PHAN** |
| 5 | P2-04 nghiệm thu thật, 5 procedure exercise | **DUNG** |
| 6 | `type` không điều khiển hành vi | **SAI** |
| 7 | Ba bảng kia không phải đổi khi bỏ `curriculumUnitId` | **MOT PHAN** |
| 8 | cmc-lms `ExerciseFile` không `status`/`type` | **DUNG** |

---

## Hệ quả sự thật cho luận B5 (không phải khuyến nghị thiết kế)

- Nút thắt **có thật** là: không tạo được **nhiều bài cùng loại trên cùng unit**. Đó là lý do kỹ thuật để gỡ `curriculumUnitId` + unique nếu sản phẩm muốn nhiều homework cho một unit.
- Luận “catalog = 1/4 nhu cầu nên lớp không có dãy” **thêm giả định** mà code không giữ: bài phải thuộc đúng unit, mỗi buổi một PDF khác, và chỉ tính `homework`.
- Đường “lặp bài / dùng chung lớp” **không** phải phản ví dụ mạnh cho luận 4-lần: dùng chung không tăng số bài khác nhau của một lớp; lặp dãy bị cấm lúc gán đầu. Phản ví dụ mạnh hơn là **mượn bài unit khác** (đã có test) và **fallback lặp homework**.
- `status`/`publish`/`type` trên edu **đang được dùng**; cmc-lms bỏ chúng vì model bài-về-nhà + `archivedAt`. Phần “đừng bê nguyên ExerciseFile” **khớp code**, độc lập với việc luận 4-lần có phóng đại hay không.

Status: DONE  
Summary: Đã đối chiếu từng khẳng định hai file với schema/API/test/cmc-lms; 8 ưu tiên ra DUNG/SAI/MOT PHAN kèm file dòng.  
Concerns: Không chạy `pnpm acceptance:report` nên không khẳng định P2-04 đang `proven` trên HEAD, chỉ khẳng định nó là luồng nghiệm thu có thật và khai đủ symbol.
