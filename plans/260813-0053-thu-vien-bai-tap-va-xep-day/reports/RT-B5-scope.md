# RT-B5 — Red-team phạm vi + quyết định thiết kế

**Ngày:** 2026-08-13
**Phương pháp:** `/ak:predict` (5 persona) + đối chiếu code (read-only)
**Đối tượng:** `plans/260813-0053-thu-vien-bai-tap-va-xep-day/plan.md`
**Nguồn kèm:** `plans/reports/brainstorm-260813-0053-thu-vien-bai-tap-b5-b6.md`
**Nhánh:** `feat/lms-exercise-library` — **không sửa code, không commit**
**Chuẩn đối chiếu:** `cmc-lms` @ `/home/manhquy/Downloads/cmc-lms` (schema + `exercise-sequence.ts`), Đợt 5 `plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/phase-05-dot-e-import-va-cutover.md`

---

## Prediction Report: Thư viện bài tập + xếp dãy (B5+B6)

## Verdict: **CAUTION**

Không STOP. Quyết định *không bê nguyên `ExerciseFile`* (giữ `status`/publish/P2-04) **đúng hướng**.
Quyết định *như đang viết* — “chỉ gỡ `curriculumUnitId`, thêm `folderId`, còn lại không đụng” — **sai ở mức đặc tả**. Một giả định then chốt (`ClassExerciseItem`/`SessionExercise` không đổi) **mâu thuẫn tiêu chí nghiệm thu của chính plan**. Implement theo đúng chữ plan sẽ phải quay lại schema ở giữa B6, hoặc bỏ AC “lưu tên thư mục lúc gán”.

Không có lỗ hổng auth không giảm thiểu được. Có giả định sai làm **vỡ ước lượng rủi ro**, không làm **vô hiệu toàn bộ hướng**.

---

## Câu 1 — Giữ `Exercise`, gỡ unit, thêm `folderId`: có đúng không?

### Kết luận

**Hướng đúng. Đặc tả sai / thiếu.** Đừng thay `Exercise` bằng `ExerciseFile`. Đừng tin rằng đó chỉ là “sửa cột trên bảng có sẵn”.

Lý do hướng đúng (brainstorm §2–3 đứng vững khi đối chiếu code):

- `status` là cổng chặn thật: `writeSequenceUpdate` chỉ nhận `status: 'published'` (`apps/api/src/lms-ops/exercise-delivery.ts:81-87`); `listOpenExercisesForStudent` lọc `exercise: { status: 'published' }` (`apps/api/src/exercise/open-tier.ts:100`).
- P2-04 khai 5 procedure + `curriculumUnit.list` (`scripts/acceptance-report/flow-manifest.ts:392-414`); journey UI thật tạo → publish → đóng (`apps/e2e/tests/journeys/exercise-publish-close.journey.ui.spec.ts`).
- Bê nguyên `ExerciseFile` (không `status`, không publish) **phá** các cổng trên. Brainstorm gọi đúng đây là Rào chắn 1 loại 2.

Lý do đặc tả **sai** — tìm được, không phải lo xa:

### RT-B5-1 — HIGH — Hybrid thiếu đúng những cột mà dữ liệu `cmc-lms` *là*

`ExerciseFile` nguồn (`cmc-lms/packages/db/prisma/schema.prisma:636-655`):

| Cột nguồn | `Exercise` đích (plan) | Hậu quả nhập Đợt 5 |
|-----------|------------------------|--------------------|
| `title` (NOT NULL) | **Không có** | Mọi bài nhập thành PDF vô danh. HS đã thấy `item.type` làm tiêu đề (`apps/lms/src/pages/student/home.tsx:87`). Admin thấy UUID + loại (`exercise-detail.tsx:218-220`). |
| `archivedAt` | Không có — chỉ `draft/published/closed` | Ánh xạ state. Phase-05 **E-2** đã là sự cố thật: copy enum nguyên văn → admin không sửa được. `archived` ≠ `closed`. |
| `pdfRef` (sha256 content-addressed) | `basePdfRef` = `exercise-pdf/${uuid}.pdf` (`upload-route.ts:194`) | Blob không copy được theo hash. Phase-05 **E-4** (blob ≠ hàng DB) tái diễn. |
| `createdById` nullable | `createdById` NOT NULL (`schema.prisma:822`) | Import phải bịa actor — phase-05 **E-6** cấm bịa. |
| `orderInFolder` + `folderId` | Plan có | Đây là phần plan lấy đúng. |

Kịch bản hỏng: Đợt 5 đọc `ExerciseFile` live. Script không có chỗ ghi `title`. GĐĐT mở thư viện thấy 40+ hàng “homework / published / UUID”. Không phân biệt “UCREA U2 T3 buổi 1” với “kiểm tra định kỳ tháng 5”. Phải đặt tên tay sau import, hoặc viết lại migration thêm `title` — đúng việc lẽ ra phải có ở B5 phase 1.

**Plan không nhắc Đợt 5 một chữ.** Brainstorm cũng không. Đây là lỗ hổng phạm vi, không phải chi tiết implement.

### RT-B5-2 — HIGH — “Không đổi model, chỉ thêm folder” giấu một fork nghiệp vụ

`cmc-lms` xếp dãy **theo thư mục**, không theo từng file:

```36:54:/home/manhquy/Downloads/cmc-lms/packages/domain/src/exercise-sequence.ts
 * Nối các thư mục theo đúng thứ tự admin chọn thành một dãy phẳng.
 * Gán [1, 2, 3] → phát 1.1, 1.2, …, 3.n
```

`cmc_edu` đã port **bản cắt**: `buildClassSequence(exerciseIds)` (`packages/domain-lms/src/exercise-sequence.ts:21-26`). Plan B6 “kéo bài từng cái” **cố định fork này**, không khôi phục mô hình nguồn.

Kịch bản hỏng lúc nhập: lớp live có dãy dựng từ folder `UCREA-U2-T3` (4 file). Import `ClassExerciseItem` vẫn giữ thứ tự nếu map `exerciseFileId → exerciseId`. Nhưng GĐĐT **không tái tạo được** dãy đó bằng thao tác cũ (chọn 1 thư mục). Họ phải kéo 4 file. Ops được train trên `cmc-lms` làm sai. “Một bài thuộc một thư mục” + “kéo từng bài” biến thư mục thành tag, không còn là đơn vị xếp dãy.

Nhập **không chết** nếu giữ UUID file = UUID exercise. Nhập **vận hành lại thì khó hơn**, vì UI/API đích không nói cùng ngôn ngữ với dữ liệu nguồn.

### RT-B5-3 — MEDIUM — Giữ `Exercise` không làm nhập dễ hơn; plan nói ngược ngầm

Bảng so sánh brainstorm §3: “Quy mô: sửa cột trên bảng có sẵn” vs “thay bảng”. Với Đợt 5, hướng `ExerciseFile` 1:1 **dễ copy hơn** (folder/file/item/delivery cùng tên cột). Hướng hybrid **bắt buộc tầng biến đổi**: bịa `type`/`maxScore`/`starReward`/`status`/`createdById`, bỏ hoặc nhét `title`/`archivedAt`, đổi `pdfRef` → `basePdfRef` sau khi re-ingest blob.

Đó không phải lý do để bê nguyên `ExerciseFile` (P2-04 vẫn thắng). Đó là lý do plan phải **viết bảng ánh xạ Đợt 5 ngay bây giờ**, không để “sửa cột = rủi ro thấp” ru ngủ.

Cách hybrid *đúng* (vẫn giữ `Exercise`): thêm `title`, thêm `archivedAt` (ẩn thư viện, **không** thay `status`), thêm `folderNameAtAssign` trên item. Khi đó nhập = map + default, không phải đoán.

---

## Câu 2 — `ClassExerciseItem` / `SessionExercise` / `Submission` có thật không phải đổi?

### Kết luận

**FK thì đúng. “Không đổi” thì sai.** Plan và brainstorm khẳng định cả chuỗi phát–nộp–chấm không đụng. Code chứng minh ít nhất **ba chỗ phải đụng**, một chỗ là AC của chính B6.

### RT-B5-4 — HIGH — `folderNameAtAssign` vs “item không đổi” (mâu thuẫn nội bộ)

Plan:

- `:45-46` — “`ClassExerciseItem`, `SessionExercise`, `Submission` KHÔNG đổi”
- `:71` — “Lưu **tên thư mục lúc gán**, hiển thị đúng kể cả khi thư mục đổi tên/ẩn”

Hai câu không thể cùng đúng.

Nguồn chuẩn (`cmc-lms` schema `:668`): `ClassExerciseItem.folderNameAtAssign` NOT NULL.
`cmc_edu` `ClassExerciseItem` (`schema.prisma:843-858`): `id, facilityId, classBatchId, position, exerciseId, createdAt` — **không có** snapshot.
`writeSequenceUpdate` `createMany` (`exercise-delivery.ts:98-105`) không ghi tên thư mục.
`SequenceItem` domain (`packages/domain-lms/src/exercise-sequence.ts:5-8`) chỉ `{ position, exerciseId }`.
`listExerciseSequence` (`lms-ops/router.ts:664-676`) trả `{ items }` đúng shape đó.

Kịch bản hỏng: Phase 1 ship đúng plan (không đụng item). Phase 4 tới AC “lưu tên thư mục lúc gán”. Phải migration lần 2 trên `ClassExerciseItem` + sửa `writeSequenceUpdate` + sửa domain `SequenceItem` + sửa list API. Dãy đã gán giữa hai lần migration = `folderNameAtAssign` NULL. Đúng cái plan hứa “không vỡ”.

### RT-B5-5 — HIGH — `deliverForSession` fallback **đọc** `Exercise.curriculumUnitId`

```188:197:apps/api/src/lms-ops/exercise-delivery.ts
    const homework = await tx.exercise.findFirst({
      where: {
        curriculumUnitId: session.curriculumUnitId,
        type: 'homework',
        status: 'published',
      },
```

Test sống: `exercise-delivery.int.test.ts:132-155` — “unit-stamp fallback delivers published homework without sequence”.

`SessionExercise` schema không đổi, nhưng **hành vi tạo** `SessionExercise` phụ thuộc cột plan xoá. Lớp chưa có dãy (trạng thái hiện tại của hầu hết môi trường: chưa có màn B6) → buổi kết thúc → worker `deliverDueExercises` → fallback → Prisma lỗi hoặc `null` → HS hết bài im lặng.

Plan rủi ro R4 chỉ nói “sửa dãy làm lệch con trỏ” (`exercise-sequence.ts` đóng băng). **Không nói fallback.** Gỡ unit mà không xoá/thay fallback = phase 1 tự phá P2-03/delivery.

### RT-B5-6 — MEDIUM — `listExerciseSequence` không đủ để khoá vị trí đã phát

B6 AC: “phần đã phát khoá không sửa được”.
`listExerciseSequence` không trả `deliveredCount`. `deliveredCount` chỉ có trên **response của `assign`**. UI mở màn xếp dãy lần đầu không biết vị trí nào đóng băng trừ khi gọi thêm query `SessionExercise` — API đó **không có** cho GĐĐT.

Kịch bản: phase 4 “chỉ dựng UI trên API có sẵn”. Màn hiện 8 bài, không biết bài 1–3 đã phát. GĐĐT kéo thay bài 2. Server giữ bài 2 (đúng), UI tưởng đã đổi. Ops tin dãy lệch.

`Submission` — **đúng là không phải đổi schema**. Trỏ `sessionExerciseId`. Khẳng định này đứng.

Tóm tắt câu 2:

| Model | Schema FK ổn? | Có được để nguyên? |
|-------|---------------|-------------------|
| `Submission` | Có | **Có** |
| `SessionExercise` | Có (vẫn `exerciseId`) | Schema có thể để. **Hàm tạo** phải sửa (fallback). |
| `ClassExerciseItem` | FK `exerciseId` ổn | **Không**, nếu giữ AC snapshot. Domain + write + list phải theo. |

---

## Câu 3 — `type` / `maxScore` / `starReward`: sống hay chết?

### Kết luận

**`starReward` sống. `maxScore` sống trong chấm, chết trên form tạo. `type` là nhãn + 1 nhánh fallback — không có hành vi loại bài.**

Giữ cả ba **không sai** (P2-04/P2-06 đọc chúng). Gọi chúng là “năng lực đang dùng thật” ngang `status` thì **thổi**.

### `type`

Nhánh hành vi duy nhất:

- `deliverForSession` fallback **chỉ** lấy `type: 'homework'` (`exercise-delivery.ts:193`).
- Unique `[curriculumUnitId, type]` (`schema.prisma:831`) — chính ràng buộc B5 xoá.
- Filter/label UI (`exercises.tsx:42-46, 180-182`); HS render `item.type` như tên (`home.tsx:87`).

Không có `if (type === 'test_entrance')` nào trong chấm, nộp, sao, open-tier.

Bản ghi `type !== homework` **chỉ có trong test**:

- `publish.test.ts:80` — `test_entrance` (cấm teacher `get`).
- `exercise-delivery.int.test.ts:117` — `test_periodic` **được gán vào dãy** sau khi vị trí 1 đã phát. Test loại vào cùng ống homework.
- `exercises.test.tsx:36` — mock UI `test_periodic`.

Mọi seed/e2e/journey: `type: 'homework'` (`apps/e2e/src/db.ts:876`, P2-04 chọn “Bài tập về nhà”).

**Không có bản ghi production/seed nào dùng type khác homework** trong repo. Form admin *cho phép* chọn 3 loại; không loại nào đổi luật phát/nộp/chấm.

Brainstorm `:33` đúng: “Có nhãn, không có hành vi.” Plan `:43` nói “đang dùng thật” — **thổi**, trừ nghĩa “UI lọc + DTO + unique”.

### `maxScore`

- API create optional, default 10 (`router.ts:126, 158`).
- Form tạo **không có field** `maxScore` (`exercises.tsx:283-365` — chỉ unit + loại + PDF). Mọi bài tạo từ UI = 10.
- Chấm **đọc thật**: `submission/router.ts:376-378` từ chối `score > exercise.maxScore`.
- `computeFinalGrade` chuẩn hoá theo `maxScore` từng bài (`packages/domain-grading/src/compute-final-grade.ts:57`); test chủ đích `maxScore: 100` (`compute-final-grade.test.ts:23-25`).
- Seed e2e luôn `maxScore: 10` (`attendance-grading.spec.ts:148`, `seedPublishedExercise` default 10).

**Không có chỗ nào đặt `maxScore ≠ 10` trên bài thật/seed.** Chỉ test domain và banner lỗi UI giả `maxScore: 100` (`grading.test.tsx:139`).

Cột không chết: guard chấm + công thức điểm cuối dùng nó. Scale khác 10 **chưa từng được tạo từ sản phẩm**.

### `starReward`

Sống rõ. Form tạo cũng không có field (default 10), nhưng:

- `submission/router.ts:428` cộng `exercise.starReward`.
- Test/e2e đặt 5 / 12 / 15: `grade.test.ts:69` (15), `list-for-child.test.ts:56` (12), `seedPublishedExercise` default **5** (`e2e/src/db.ts:879`), journey sao/phụ huynh (`lms-stars-redeem-cycle.journey.ui.spec.ts:91`).
- HS/PH hiển thị (`home.tsx:88`, `homework-results.tsx:69`).

Khác `maxScore`: giá trị ≠ 10 đã được **chứng minh end-to-end**.

### RT-B5-7 — LOW — Giữ cả ba không phình mô hình; đừng tự nhận “dùng thật” như `status`

Không bắt xoá trong đợt này (brainstorm §6 ngoài phạm vi — đúng). Bắt plan nói thẳng: `type` = nhãn + nợ; `maxScore` = guard mặc định 10; `starReward` = ledger thật. Xoá `type` lúc nhập Đợt 5 cũng được (mọi file nguồn = homework).

---

## Câu 4 — Ba mặc định: phẳng / một bài một thư mục / gom “Chưa phân loại”

### 4.1 Thư mục phẳng một cấp — **đúng với nguồn, rủi ro UX sau khi cắt unit**

`cmc-lms` schema comment `:618-619`: “MỘT CẤP, không lồng nhau”. Import 1:1. Không sai so với chuẩn đã chọn.

### RT-B5-8 — MEDIUM — Cắt unit + folder phẳng = mất trục phân loại duy nhất

`CurriculumUnit` đang là cây ngầm: 3 chương trình × cấp × tháng (TL19 §1, 96 unit). Admin list bài **là** cột unit (`exercises.tsx:168-177`). Detail subtitle = unit (`exercise-detail.tsx:189-221`).

Gỡ `curriculumUnitId` rồi thay bằng folder phẳng: không còn program/level/tháng trừ khi **tên folder mã hoá**. `cmc-lms` chấp nhận vì chưa từng gắn unit. `cmc_edu` đang *tháo* hierarchy.

Kịch bản: GĐĐT có ~96 unit × tối đa 3 loại. Folder phẳng “UCREA U2 T3”, “UCREA U2 T4”, … dài 96+ hàng, không group. Tìm bài = search tên. Plan không có search. Chấp nhận được nếu product ký; plan viết như thể “theo `cmc-lms`” nên khỏi bàn.

Không bắt lồng nhau trong B5. Bắt nói rõ: mất trục unit là **cái giá**, không phải “miễn phí vì nguồn cũng phẳng”.

### 4.2 Một bài thuộc đúng một thư mục (`folderId` đơn) — **đúng**

Trùng `ExerciseFile.folderId` đơn. Import không cần bảng nối.

Lưu ý ngôn ngữ: “một bài một thư mục” ≠ “một thư mục một bài”. Nguồn: **nhiều file / một folder**; folder là đơn vị xếp dãy (4 bài / unit). Nếu ai đọc thành 1:1 file↔folder thì **sai** — phá đúng bài toán 4 bài / 4 buổi.

`@@unique([folderId, orderInFolder])` nguồn có. Reorder 2-phase (âm → dương) là luật sống (`cmc-lms` `exercise.ts:216-274`, BR3). Plan không nhắc. Thiếu = P2002 lúc kéo thứ tự trong thư viện.

### 4.3 Gom bài cũ vào “Chưa phân loại” — **sai mặc định**

Rẻ vì chưa production (R2 plan) — đúng về **mất dữ liệu**. Sai về **giữ nghĩa**.

### RT-B5-9 — HIGH — Dump xoá identity hiện tại; unique thứ tự dễ vỡ migration

Bài cũ = `(unit, type)`. Đó là tên hiển thị (cột unit + loại). Một folder “Chưa phân loại”:

- Trộn UCREA / Bright / Black Hole / homework / test.
- `@@unique([folderId, orderInFolder])` bắt migration gán `orderInFolder` 1..N tuần tự. `UPDATE … SET folderId = default` không đủ — hai hàng `orderInFolder` NULL hoặc 0 = P2002.
- B6 “lưu tên thư mục lúc gán”: mọi dãy gán từ đống này đóng dấu **“Chưa phân loại”** vĩnh viễn. Đổi folder sau không sửa snapshot. AC biến thành rác.

Kịch bản: seed/demo còn bài gắn unit. Phase 1 dump. GĐĐT xếp dãy cho lớp UCREA từ folder rác, lưu. Sau tách folder đúng. Màn lớp vẫn hiện “Chưa phân loại” ở 12 vị trí đã gán. Không có tool sửa snapshot.

Mặc định đúng hơn (vẫn rẻ, chưa prod): **một folder / unit** (`{program} {level} T{monthIndex}: {title}`), `orderInFolder` theo `type` (homework=1, entrance=2, periodic=3). Giữ nghĩa, thoả unique, khớp 4-bài-nếu-họ-thêm-sau. “Chưa phân loại” chỉ cho hàng không map được.

Xoá sạch cũng được nếu product ký “không giữ seed”. Plan đề xuất *gom để giữ dữ liệu thử* rồi **huỷ đúng thứ làm dữ liệu thử có nghĩa**.

---

## Câu 5 — 4 phase: thứ tự phụ thuộc có đúng không?

Plan: `1 → 2 → (3 ∥ 4)`.

### Kết luận

**Khung đúng, biên phase sai.** 3 ∥ 4 chỉ an toàn sau khi phase 1–2 mang **đủ** cột/API mà AC phase 4 đòi. Hiện phase 1 (theo plan) **không shippable**.

### RT-B5-10 — HIGH — Phase 1 một mình làm vỡ typecheck + delivery + e2e

Phase 1 = gỡ `curriculumUnitId`, thêm folder, migration dump.

Cùng lúc, chưa sửa:

- `ExerciseDto` / `toExerciseDto` / `create` input (`exercise/router.ts:61-170`)
- `open-tier.ts:162,182` select `curriculumUnitId`
- `deliverForSession` fallback
- `cleanupCurriculumUnits` xoá bài theo unit (`e2e/src/db.ts:841-843`)
- `seedPublishedExercise` ghi `curriculumUnitId` (`e2e/src/db.ts:875`)
- Journey P2-04 chọn unit (`exercise-publish-close.journey.ui.spec.ts:66-69`)
- Admin form bắt buộc unit (`exercises.tsx:289-297`)

Kịch bản: merge phase 1 vào nhánh. `pnpm typecheck` đỏ ngay. Worker phát bài lớp không dãy chết. CI `ui-e2e` P2-04 đỏ. Plan không có “phase 1 + 2 phải cùng PR” hay “feature flag”.

### RT-B5-11 — MEDIUM — 3 ∥ 4 tranh DTO và nhân đôi picker

Phase 3 = cây folder + list bài (title? status? “đang nằm trong dãy lớp nào?”).
Phase 4 = hai cột, kéo từ thư viện.

Cùng đọc `exercise.list` / DTO mới. Hai agent song song sửa `router.ts` + `ExerciseDto` = conflict. Phase 4 cần cây thư viện — hoặc chờ 3, hoặc viết picker thứ hai.

`listExerciseSequence` thiếu `deliveredCount` + `folderNameAtAssign` (câu 2). API đó thuộc **phase 2**, không phải “UI phase 4 tự lo”.

Thứ tự đúng:

```
1  schema đủ: Folder + folderId + orderInFolder + title
              + folderNameAtAssign trên item
              + gỡ unit + gỡ unique
              + gỡ/thay fallback delivery
2  API: folder CRUD, create/list bài theo folder, update sequence
       ghi snapshot, list sequence kèm deliveredCount,
       preview, manifest P2-04
3  màn thư viện          ─┐
                           ├─ song song được nếu contract phase 2 đóng băng
4  màn xếp dãy           ─┘
```

Phụ thuộc nghiệp vụ thêm: nếu dump “Chưa phân loại”, phase 4 **dùng được nhưng vô nghĩa** cho đến khi phase 3 tổ chức folder. 3 trước 4 về mặt ops, dù compile song song được.

File phase `phase-01-…md` … `phase-04-…md` **không tồn tại**. `plans/260813-0053-thu-vien-bai-tap-va-xep-day/` chỉ có `plan.md`. Bảng phase là link chết.

---

## Câu 6 — Việc quan trọng plan bỏ sót

Ngoài các mục trên:

### RT-B5-12 — HIGH — Không có `Exercise.title`

Thư viện không có tên bài. Nguồn bắt buộc `title`. HS/admin đang lấy tên từ **unit + type**. Cắt unit = không còn tên. Ngoài phạm vi “thêm folder” nhưng **chặn** màn 1 và Đợt 5.

### RT-B5-13 — HIGH — `status` vs `archivedAt`: hai máy trạng thái không được viết

Nguồn: ẩn file/folder = `archivedAt`, không xoá, không đụng dãy (BR3 §1.2).
Đích: `draft → published → closed`; `closed` = HS không thấy (`open-tier.ts:100`).

Plan: “ẩn thư mục không đụng dãy đã gán” (lấy luật archive) **và** giữ `status` (luật publish). Không nói:

- Ẩn **bài** = `close` hay `archivedAt` mới?
- `close` một bài đang trong dãy chưa phát: còn phát không? (`writeSequenceUpdate` đòi published — lần gán *mới* loại; lần đã gán thì `deliverForSession` lấy `exerciseId` đã đóng băng, **không** re-check published lúc phát.)
- HS còn tải PDF bài `closed` nếu `SessionExercise` đã tạo? `listOpenExercisesForStudent` ẩn; bài đang làm dở?

Kịch bản: GĐĐT “ẩn bài” bằng `close`. Lớp đã gán vị trí 5. Buổi tới phát bài `closed`. HS không thấy (list lọc published) nhưng `SessionExercise` đã tạo. GV chấm hàng ma. Nguồn tránh đúng case này bằng archive metadata, delivery đọc file theo id, discovery mới ẩn.

### RT-B5-14 — HIGH — Cấm sửa `pdfRef` sau khi đã phát: không có trong plan

Nguồn: đổi `pdfRef` chỉ khi **zero** `SessionExercise` (BR3; `cmc-lms` `exercise.ts:163-174`).
Đích: không có `exercise.update` nội dung PDF. Upload tạo blob mới; không khoá.

Màn thư viện “tải bài lên / đổi file” (brainstorm màn 1) nếu cho đổi `basePdfRef` trên bài đã phát → HS cũ / bài nộp cũ đổi đề. B4 submission giữ `annotationLayer` trên PDF gốc. Đổi blob = overlay lệch trang.

### RT-B5-15 — MEDIUM — Reorder `@@unique([folderId, orderInFolder])` không có thuật toán

Nguồn: 2-phase âm/dương, tập id phải khớp file live. Plan chỉ ghi unique. Implement naive swap = P2002. Không phải nit: đây là thao tác chính của màn thư viện.

### RT-B5-16 — MEDIUM — Không có `sequencePreview`; cảnh báo “dãy < số buổi còn lại” không có công thức

Brainstorm màn 3: bảng buổi → bài. Nguồn có `sequencePreview`. Đích không.
“Số buổi còn lại” ≠ `remainingUnits`. Phải đếm buổi future non-cancelled của lớp trừ slot đã phát. Không helper. Dễ đếm nhầm unit còn lại × 4 (bao gồm buổi đã huỷ / đã phát). Cảnh báo sai → AC giả.

### RT-B5-17 — MEDIUM — P2-04 journey + manifest: plan nhắc R1 nhưng thiếu hợp đồng thay thế

R1 đúng (bài học PR #117). Thiếu: `curriculumUnit.list` ra khỏi form thì journey `:66-69` chọn unit **vỡ**. Manifest phải thay procedure **và** viết lại journey (chọn folder + title). `acceptance:report` không tụt chỉ khi journey mới drive đủ procedure mới. Plan ghi checkbox, không ghi journey nào sửa.

### RT-B5-18 — MEDIUM — `exercise.get` nhúng `curriculumUnit`; DTO toàn repo mang `curriculumUnitId`

`router.ts:227-237`. Mọi test/UI detail. Không phải “đổi một cột”.

### RT-B5-19 — LOW — TL19 §3 vẫn là luật unique unit+type

`docs/19-quy-tac-nghiep-vu-chi-tiet.md:18-19`, `docs/26-workflow-spec-p2.md:131`. Frozen docs. Plan không xin đổi thẩm quyền sản phẩm. Agent khác đọc TL19 sẽ “sửa ngược” unique. Harness: “identify repository authority … If materially different choices remain open, stop.” Unique là authority đã ghi. B5 *cố ý* phá. Cần quyết định ghi đè, không chỉ migration.

### RT-B5-20 — LOW — Thư viện global, không `facilityId` (giống `Exercise` hiện tại)

Đúng QĐ 0022. Plan không nhắc. Mọi cơ sở thấy cùng folder. Nguồn cũng “dùng chung toàn trung tâm”. OK nếu ký. Không OK nếu Đợt 5 có nội dung cơ sở-riêng (hiện không thấy).

### RT-B5-21 — MEDIUM — “Bài đang nằm trong dãy lớp nào” (màn 1) không có API

Brainstorm màn 1. Cần join `ClassExerciseItem` + `ClassBatch`. Chưa có. Dễ N+1 nếu làm ở phase 3 không thiết kế ở phase 2.

---

## 5 persona (độc lập, rồi tranh)

### Architect

Hướng giữ `Exercise` khớp kiến trúc hiện tại (catalog global, delivery trỏ `exerciseId`, P2-04). Sai lầm là **port nửa `ExerciseFile`**: lấy `folderId` bỏ `title` / snapshot / xếp-theo-folder / archive. `domain-lms` đã fork `SequenceItem`; plan đóng đinh fork thay vì quyết định có khôi phục không. Phase 1 không độc lập. Dual state (`status` + archive) nếu không thiết kế sẽ thành hai nút “ẩn” chồng nhau.

### Security

Không thấy lỗ auth mới nếu folder CRUD giữ `exercise.manage` (GĐĐT). Rủi ro: đổi PDF sau phát (đề thi thay im lặng); `close` vs ẩn không rõ → HS mất bài đang làm hoặc GV thấy delivery ma. `createdById` bịa lúc nhập = audit giả. Blob re-ingest sai quyền = E-4. Không đủ STOP.

### Performance

`@@unique([folderId, orderInFolder])` + dump một folder = hotspot reorder. List thư viện “bài nào đang trong dãy lớp nào” không cẩn = N+1 trên mọi lớp. Không phải blocker.

### UX

Cắt unit mà không có `title` = thư viện toàn “homework”. HS đã xấu (`item.type`). Dump “Chưa phân loại” + kéo từng file = GĐĐT không tìm được 4 bài của unit. Cảnh báo dãy ngắn không có định nghĩa “buổi còn lại”. Màn preview không API.

### Devil’s advocate

Vì sao không **chỉ xoá unique `[unit, type]`**, giữ `curriculumUnitId` nullable, cho 4 homework / unit? Giải bài toán số học (1 unit 4 bài) **không cần thư viện**. B5+B6 gói “thư viện vì cmc-lms có” vào nút thắt unique. Nếu mục tiêu thật là 4 bài / unit, folder là scope creep.

Phản: brainstorm đã chốt thư viện là chuẩn vận hành (Rào chắn 1, A4 đã cắt chờ B5). Xoá unique-only là **lùi** về catalog-theo-unit mà `cmc-lms` cố ý bỏ. Devil thua về hướng, thắng về “plan đang giải hai bài một lúc và viết như thể một”.

Giả định sai lớn nhất: “item không đổi ⇒ rủi ro thấp”. Sai. AC B6 đòi đổi item. Fallback đòi đổi delivery. Title đòi đổi catalog. Đó không phải “sửa cột”.

---

## Conflicts & resolutions

| Chủ đề | Architect | Security | Perf | UX | Devil | Resolution |
|--------|-----------|----------|------|-----|-------|------------|
| Giữ `Exercise` vs bê `ExerciseFile` | Giữ | Giữ (P2-04) | — | Giữ publish | Unique-only đủ? | **Giữ `Exercise`.** Không bê `ExerciseFile`. Không unique-only. |
| `ClassExerciseItem` không đổi | Sai | — | — | Snapshot cần cột | Plan tự mâu thuẫn | **Đổi item: thêm `folderNameAtAssign` ở phase 1.** Sửa câu “không đổi”. |
| `type`/`maxScore` | Giữ, nói thật | — | — | `type` đang là tên bài | Xoá `type` | **Giữ.** Thêm `title`. Không nhận `type` là hành vi. |
| Dump “Chưa phân loại” | Sai | — | Unique vỡ | Mất tìm kiếm | Xoá seed cũng được | **Folder theo unit, hoặc xoá sạch có chữ ký.** Không dump một đống. |
| 3 ∥ 4 | Chỉ sau contract đủ | — | — | 3 trước 4 về ops | — | **1+2 đủ cột/API, cùng PR nếu cần. 3 ∥ 4 chỉ UI.** |
| Nhập Đợt 5 | Phải có bảng map | E-2/E-4/E-6 | — | Mất title | Hybrid khó hơn 1:1 | **Viết bảng ánh xạ trong plan trước implement.** |

---

## Risk summary

| ID | Risk | Severity | Mitigation bắt buộc trước code |
|----|------|----------|--------------------------------|
| RT-B5-1 | Hybrid thiếu `title`/`archivedAt`/blob semantics → Đợt 5 mất tên, lệch state, lệch blob | High | Thêm `title` phase 1. Viết bảng map Đợt 5 (kể cả blob re-ingest). |
| RT-B5-2 | Xếp dãy theo file ≠ theo folder nguồn | High | Chốt product: kéo file (fork) hay gán folder (chuẩn). Ghi rõ. |
| RT-B5-4 | AC snapshot vs “item không đổi” | High | Thêm `folderNameAtAssign`. Sửa `SequenceItem` + `writeSequenceUpdate` + list. |
| RT-B5-5 | Fallback `curriculumUnitId` chết delivery | High | Xoá fallback trong cùng PR gỡ cột, hoặc thay bằng “hết dãy = hết bài”. Sửa test `:132`. |
| RT-B5-9 | Dump “Chưa phân loại” xoá identity + vỡ unique | High | Folder-theo-unit hoặc xoá sạch. Migration gán `orderInFolder` tuần tự. |
| RT-B5-10 | Phase 1 không shippable | High | Gộp 1+2, hoặc cấm merge phase 1 lẻ. |
| RT-B5-13 | `close` ≠ archive | High | Hai việc: `status` = soạn/phát hành; `archivedAt` = ẩn thư viện. |
| RT-B5-14 | Đổi PDF sau phát | High | Cấm đổi `basePdfRef` khi đã có `SessionExercise`. |
| RT-B5-6 | List sequence thiếu `deliveredCount` | Medium | List trả `deliveredCount` + (nên) snapshot tên folder. |
| RT-B5-8 | Mất hierarchy unit | Medium | Product ký folder phẳng; hoặc folder-theo-unit lúc migrate. |
| RT-B5-11 | 3 ∥ 4 tranh DTO | Medium | Đóng contract phase 2 trước khi song song UI. |
| RT-B5-15 | Reorder P2002 | Medium | Port 2-phase từ `cmc-lms`. |
| RT-B5-16 | Preview / “buổi còn lại” không định nghĩa | Medium | Công thức + API preview trong phase 2. |
| RT-B5-17 | P2-04 journey vỡ | Medium | Viết lại journey trong cùng PR đổi form. |
| RT-B5-7 | Thổi `type`/`maxScore` | Low | Sửa wording plan. |
| RT-B5-19 | TL19 unique còn là authority | Low | Ghi đè docs / quyết định sản phẩm. |

---

## Trả lời ngắn 6 câu

1. **Giữ `Exercise` đúng. “Chỉ gỡ unit + thêm folder” sai.** Thiếu `title`, lệch `archivedAt`/`pdfRef`/`createdById`, fork xếp-dãy. Đợt 5 nhập **khó hơn 1:1**, không chết nếu giữ UUID + viết map; plan đang giả vờ không có map.
2. **`Submission` thật không đổi. `SessionExercise` schema có thể không đổi, hành vi tạo phải đổi (fallback). `ClassExerciseItem` phải đổi nếu giữ AC snapshot.** Plan sai.
3. **`starReward` dùng thật (cả giá trị ≠ 10). `maxScore` là guard, UI/seed luôn 10. `type` là nhãn; không có hàng thật nào khác `homework`; một nhánh fallback chỉ nhận homework.** Không phải nợ chết, cũng không phải năng lực ngang `status`.
4. **Phẳng: đúng nguồn, đắt sau khi cắt unit. `folderId` đơn: đúng. Dump “Chưa phân loại”: sai.**
5. **1→2→(3∥4) đúng khung, sai biên.** Phase 1 hiện không độc lập. Snapshot + fallback + title + list `deliveredCount` thuộc 1–2, không phải 4.
6. **Bỏ sót lớn:** `title`, snapshot vs “không đổi”, fallback delivery, archive vs close, khoá PDF sau phát, bảng map Đợt 5, file phase không tồn tại, P2-04 journey, preview/cảnh báo, reorder unique, thẩm quyền TL19.

---

## Recommendations (chặn implement cho đến khi plan sửa)

1. Sửa `plan.md`: xoá câu “`ClassExerciseItem` không đổi”; thêm `folderNameAtAssign` + `title` vào bảng quyết định.
2. Viết 1 trang ánh xạ Đợt 5: `ExerciseFile` → `Exercise` (default từng cột, blob, actor, archive→status). Không implement B5 khi trang này trống — đúng câu hỏi (1).
3. Chốt xếp dãy: gán folder (chuẩn `cmc-lms`) hay kéo file (API hiện tại). Một câu, có chữ ký.
4. Phase 1+2 cùng PR (hoặc 1 không merge). Gỡ fallback trong cùng thay đổi schema.
5. Đổi mặc định migrate: folder-theo-unit, không “Chưa phân loại”.
6. Tách `archivedAt` (thư viện) khỏi `status` (soạn). Cấm đổi `basePdfRef` khi đã deliver.
7. `listExerciseSequence` trả `deliveredCount` (+ snapshot). Định nghĩa “buổi còn lại” bằng số buổi.
8. Viết 4 file phase đang là link chết, hoặc bỏ link.

**Sau khi 1–4 xong: GO có điều kiện.** Trước đó implement = đóng đinh mâu thuẫn, sửa schema lần hai giữa B6.

---

## Evidence index (file đã đọc)

- `plans/260813-0053-thu-vien-bai-tap-va-xep-day/plan.md` (thư mục chỉ có file này)
- `plans/reports/brainstorm-260813-0053-thu-vien-bai-tap-b5-b6.md`
- `packages/db/prisma/schema.prisma:158-170, 807-930`
- `packages/domain-lms/src/exercise-sequence.ts`
- `apps/api/src/exercise/router.ts`, `open-tier.ts`, `upload-route.ts:194`
- `apps/api/src/lms-ops/exercise-delivery.ts:55-227`, `router.ts:632-676`
- `apps/api/src/lms-ops/exercise-delivery.int.test.ts:114-155`
- `apps/api/src/submission/router.ts:376-428`
- `apps/admin/src/pages/teaching/exercises.tsx`, `exercise-detail.tsx`
- `apps/lms/src/pages/student/home.tsx:87`
- `apps/e2e/src/db.ts:839-879`
- `apps/e2e/tests/journeys/exercise-publish-close.journey.ui.spec.ts`
- `scripts/acceptance-report/flow-manifest.ts:392-414`
- `docs/19-quy-tac-nghiep-vu-chi-tiet.md:18-19, 61-65`
- `cmc-lms` schema `620-693`, `packages/domain/src/exercise-sequence.ts`
- `plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/phase-05-dot-e-import-va-cutover.md` (E-2, E-4, E-6)
- `plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/reports/BR3-baitap-cham-sao-nhatky.md` §1–2
