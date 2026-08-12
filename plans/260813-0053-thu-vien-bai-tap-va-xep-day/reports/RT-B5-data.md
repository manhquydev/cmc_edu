# RT-B5 — Red team dữ liệu & migration: bỏ `Exercise.curriculumUnitId`, thêm thư mục

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Nhánh:** `feat/lms-exercise-library`  
**Chế độ:** chỉ đọc — không sửa code, không commit  
**Kính:** hỏng dữ liệu và migration  
**Nguồn plan:** `plans/260813-0053-thu-vien-bai-tap-va-xep-day/plan.md`  
**Phase-01:** file `phase-01-nen-du-lieu-thu-vien.md` **không tồn tại** — các bước SQL dưới đây suy từ code/migration thật, không phải từ phase đã viết.

**Kết luận ngắn:** bỏ cột được, nhưng **không được** `ADD COLUMN ... NOT NULL` một phát, **không được** gán `orderInFolder` cùng một số, **không được** gắn `facilityId`+RLS lên `ExerciseFolder`, và **phải giết fallback phát bài theo unit** nếu không muốn lớp hết bài im lặng.

---

## Bảng phát hiện

| ID | Mức | Phát hiện | Kịch bản hỏng |
|----|-----|-----------|----------------|
| F1 | **CRITICAL** | `deliverForSession` fallback vẫn `findFirst` theo `Exercise.curriculumUnitId` | Lớp **không** có `ClassExerciseItem` → buổi kết thúc → worker không tìm được homework → `return null` → HS không thấy bài. Test `unit-stamp fallback delivers published homework without sequence` đang khóa hành vi này. |
| F2 | **CRITICAL** | Gắn `facilityId` + RLS lên `ExerciseFolder` trong khi `Exercise` là catalog global | Router bài tập gọi `ctx.db` **không** `withFacility`. Policy `facilityId = current_setting('app.current_facility_id')` từ chối mọi hàng → list/tạo thư mục rỗng hoặc 500. Migration gốc T2-I đã cảnh đúng chuyện này. |
| F3 | **HIGH** | `ADD COLUMN "folderId" TEXT NOT NULL` trên bảng đã có hàng | Postgres: `column contains null values`. Migration dừng giữa chừng. Toàn bộ deploy `prisma migrate deploy` đỏ. |
| F4 | **HIGH** | Gom mọi bài cũ vào một thư mục rồi `orderInFolder = 0` (hoặc cùng một số) | `CREATE UNIQUE INDEX (folderId, orderInFolder)` fail. Cột mới có, unique chưa lên, dữ liệu nửa vời. |
| F5 | **HIGH** | `cleanupCurriculumUnits` xóa bài bằng `where: { curriculumUnitId }` | Sau khi bỏ cột: typecheck vỡ; nếu chỉ xóa unit, bài test **ở lại** thư mục "Chưa phân loại" (global). `exercise.list` của test sau nhìn thấy bài published ma. |
| F6 | **HIGH** | Wave-A default grant bảng mới = `SELECT`/`INSERT` only | Đổi tên / `archivedAt` là `UPDATE`. Quên `GRANT UPDATE ON "ExerciseFolder"` → GĐĐT ẩn thư mục bị permission denied. |
| F7 | **HIGH** | Plan vừa nói `ClassExerciseItem` **không đổi**, vừa đòi `folderNameAtAssign` | Cột đó **không có** trên model. Muốn đóng dấu tên thư mục thì **phải** thêm cột (NOT NULL + backfill). Im lặng bỏ qua thì đổi tên/ẩn thư mục làm UI dãy bài đổi theo — trái tiêu chí nghiệm thu. |
| F8 | **MEDIUM** | Unique `(folderId, orderInFolder)` không `DEFERRABLE` | Đổi chỗ 2 bài (`1↔2`) bằng hai UPDATE thẳng → P2002 giữa chừng. Reorder thư mục hỏng. |
| F9 | **MEDIUM** | Thư mục mặc định nhận diện bằng **tên** "Chưa phân loại" | User đổi tên / ẩn / tạo trùng tên → migration/re-seed tạo thư mục thứ hai, hoặc bài mới không biết vào đâu. |
| F10 | **LOW** | Mất `Exercise_curriculumUnitId_idx` + unique `(unit, type)` | Không chậm **nếu** đã xóa hết query theo unit. Để sót một `where: { curriculumUnitId }` thì seq scan + Prisma P2022. |

GitNexus `impact({target: "toExerciseDto", direction: "upstream"})`: **MEDIUM**, 97 symbol (phần lớn là đồ thị import `appRouter`). Đường thật nằm ở grep bên dưới — `deliverForSession` **không** có trong index (index lệch nhánh).

---

## (1) Bỏ `Exercise.curriculumUnitId` NOT NULL + FK — thứ tự nào, vỡ gì?

### Hiện trạng (quan sát)

`packages/db/prisma/schema.prisma` L814–833:

```text
curriculumUnitId String                          // không ?
curriculumUnit   CurriculumUnit @relation(...)   // default onDelete = Restrict
@@unique([curriculumUnitId, type])
@@index([curriculumUnitId])
```

Migration tạo bảng `20260706190000_t2i_exercise_foundation/migration.sql` L39–59:

```sql
"curriculumUnitId" TEXT NOT NULL
CREATE UNIQUE INDEX "Exercise_curriculumUnitId_type_key" ...
CREATE INDEX "Exercise_curriculumUnitId_idx" ...
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_curriculumUnitId_fkey"
  FOREIGN KEY ("curriculumUnitId") REFERENCES "CurriculumUnit"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

`CurriculumUnit.exercises Exercise[]` (schema L798) phải gỡ cùng lúc, nếu không `prisma generate` / `db pull` lệch.

### Mẫu repo — không được bịa

| Việc | Mẫu đã ship | File |
|------|-------------|------|
| Thêm cột rồi backfill rồi mới `SET NOT NULL` | `CurriculumUnit.orderGlobal` | `20260811120000_lms_foundation_unit_range` L5–26 |
| Sửa dữ liệu **trước** `DROP COLUMN` | cancel makeup rồi mới drop | `20260812120000_curriculum_level_text_drop_session_makeup` L26–43 |
| Đổi FK trên bảng có hàng, chấp nhận xóa dữ liệu thử | `TRUNCATE "Submission"` rồi add `sessionExerciseId NOT NULL` | `20260812210000_submission_bind_session_exercise` — **không** dùng cho B5 vì plan chọn **giữ** bài cũ |
| SQL viết tay, không `prisma migrate dev` | comment mọi migration LMS | T2-I L4–6 |

### Thứ tự đúng (một migration, một transaction Postgres)

1. `CREATE TABLE "ExerciseFolder"` — **không** `facilityId`, **không** RLS (câu 6).
2. `GRANT UPDATE ON "ExerciseFolder" TO "cmc_app"` (và `DELETE` chỉ nếu có procedure xóa cứng).
3. `INSERT` thư mục mặc định với **UUID cố định** (sentinel), không tìm theo tên.
4. `ALTER TABLE "Exercise" ADD COLUMN "folderId" TEXT;`  
   `ALTER TABLE "Exercise" ADD COLUMN "orderInFolder" INTEGER;`  
   — cả hai **nullable**. `ADD ... NOT NULL` ở bước này = F3.
5. Backfill `folderId` + `orderInFolder` (câu 2–3).
6. `ALTER COLUMN ... SET NOT NULL` cho cả hai.
7. `ADD CONSTRAINT "Exercise_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ExerciseFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE` — cùng tư thế RESTRICT như FK unit hiện tại.
8. `CREATE UNIQUE INDEX "Exercise_folderId_orderInFolder_key" ON "Exercise"("folderId", "orderInFolder");`
9. Gỡ phía cũ (tường minh, đừng dựa vào `DROP COLUMN` nuốt phụ thuộc):
   - `DROP CONSTRAINT "Exercise_curriculumUnitId_fkey"`
   - `DROP INDEX "Exercise_curriculumUnitId_type_key"`
   - `DROP INDEX "Exercise_curriculumUnitId_idx"`
   - `DROP COLUMN "curriculumUnitId"`
10. Cùng PR: schema Prisma, `CurriculumUnit.exercises`, DTO/API/test (câu 4). Migration **không** tự sửa TypeScript — deploy DB xanh / `pnpm typecheck` đỏ là trạng thái dở.

### Vỡ nếu đảo thứ tự

| Làm sai | Hỏng cụ thể |
|---------|-------------|
| `ADD folderId NOT NULL` trước insert thư mục + backfill | F3 — migrate fail, không cột mới, không cột cũ mất |
| `SET NOT NULL` trước `UPDATE` | Còn hàng `folderId IS NULL` → fail. Bảng có cột nullable dở |
| Unique `(folderId, orderInFolder)` trước backfill unique | F4 |
| `DROP COLUMN curriculumUnitId` trước khi API/test thôi đọc | Typecheck + runtime Prisma `Unknown argument curriculumUnitId` |
| `DROP CONSTRAINT` FK rồi xóa unit trong lúc cột còn | Được (cột thành orphan scalar). Không cần. Đừng xóa unit — buổi học vẫn FK tới `CurriculumUnit` |
| Hai migration: add NOT NULL ở file 1, backfill ở file 2 | File 1 không bao giờ apply trên DB có hàng |

`TRUNCATE "Exercise"` theo kiểu B4 **cấm** nếu đã có `ClassExerciseItem` / `SessionExercise` (FK `ON DELETE RESTRICT` từ `20260811140000` L16–18, L56–58). Xóa bài đang nằm trong dãy/đã phát = mất lịch sử phát bài.

---

## (2) Thêm `folderId` NOT NULL vào bảng đã có dữ liệu

Plan: *bài cũ → thư mục "Chưa phân loại"*. Đúng hướng. Câu chữ SQL phải theo mẫu `orderGlobal`, không theo mẫu B4.

```sql
-- 1) sentinel folder (UUID cố định, idempotent)
INSERT INTO "ExerciseFolder" ("id", "name", "createdAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Chưa phân loại', now())
ON CONFLICT ("id") DO NOTHING;

-- 2) cột nullable
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "folderId" TEXT;
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "orderInFolder" INTEGER;

-- 3) gom + đánh số (xem câu 3)
UPDATE "Exercise" e
SET
  "folderId" = '00000000-0000-4000-8000-000000000001',
  "orderInFolder" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC)::int AS rn
  FROM "Exercise"
) sub
WHERE e.id = sub.id
  AND (e."folderId" IS NULL OR e."orderInFolder" IS NULL);

-- 4) khóa
ALTER TABLE "Exercise" ALTER COLUMN "folderId" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "orderInFolder" SET NOT NULL;
```

Biến thể một bước (hợp lệ nếu **mọi** hàng cũ vào đúng một thư mục):

```sql
ALTER TABLE "Exercise"
  ADD COLUMN "folderId" TEXT NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Exercise" ALTER COLUMN "folderId" DROP DEFAULT;
```

Vẫn **phải** đánh `orderInFolder` riêng — default `0` cho mọi hàng = F4.

Bảng rỗng (CI migrate từ zero): `UPDATE` 0 hàng, `SET NOT NULL` vẫn qua.

**Không** nhận diện thư mục mặc định bằng `WHERE name = 'Chưa phân loại'` (F9). Tên là dữ liệu user. Cần cột `kind`/`isUncategorized` hoặc UUID sentinel bất biến.

---

## (3) Unique `(folderId, orderInFolder)` khi gom hàng loạt

`ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC)` — **bắt buộc có `id`**.  
`createdAt` có `@default(now())`; seed/test tạo nhiều hàng trong cùng transaction → cùng timestamptz → `ROW_NUMBER` không ổn định / trùng nếu thiếu tie-break.

Không được:

```sql
SET "orderInFolder" = 0;           -- mọi hàng = 0
SET "orderInFolder" = EXTRACT(...); -- không unique
-- vòng lặp app MAX+1 từng hàng: chậm + race
```

Mẫu đã có sẵn: `20260811120000` L7–21 (`ROW_NUMBER() OVER (PARTITION BY program ORDER BY ... id ASC)`).

Sau go-live, `MAX(orderInFolder)+1` khi `exercise.create` **đụng unique** nếu hai GĐĐT tạo cùng thư mục. `writeSequenceUpdate` đã dùng `pg_advisory_xact_lock` (`exercise-delivery.ts` L63–66). Create/reorder bài trong thư mục phải khóa theo `folderId` hoặc retry P2002. Unique hiện tại **không** `DEFERRABLE` (không migration nào trong repo tạo unique deferrable) → swap `1↔2` phải qua giá trị tạm âm, hoặc xóa unique lúc reorder (đừng).

---

## (4) `apps/api` đang query `Exercise` theo `curriculumUnitId` — liệt kê hết

Chỉ những chỗ đụng **cột/FK `Exercise.curriculumUnitId`**.  
`ClassSession.curriculumUnitId` (điểm danh, stamp buổi, `assignUnit`, dual-gate roster) **không** nằm trong danh sách này — không bỏ.

### Production — sẽ không compile hoặc sai nghĩa

| # | File | Việc | Sau khi bỏ cột |
|---|------|------|----------------|
| 1 | `apps/api/src/exercise/router.ts` L61–91, L121–128, L147–169 | `ExerciseDto.curriculumUnitId`; `create` bắt unit + ghi cột; unique `(unit, type)` → `conflict` | Input schema + create SQL vỡ. Procedure P2-04 `exercise.create` chết. |
| 2 | `apps/api/src/exercise/router.ts` L205–216 | `list` `where: { curriculumUnitId }` | Prisma `Unknown argument`. |
| 3 | `apps/api/src/exercise/router.ts` L224–237 | `get` `include: { curriculumUnit: true }` rồi nhét `curriculumUnit` vào response | Relation biến mất → typecheck + runtime. Admin `exercise-detail.tsx` L189–191 đang vẽ nhãn unit từ payload này. |
| 4 | `apps/api/src/exercise/open-tier.ts` L156–183 | `select.exercise.curriculumUnitId` trong `assertSessionExerciseOpenForStudent` | Select vỡ. **Caller** `submission/router.ts` L232–236 **không** đọc field này (chỉ lấy `sessionExerciseId`). Field là xác sống trên DTO, không phải cổng chấm bài. |
| 5 | `apps/api/src/lms-ops/exercise-delivery.ts` L187–198 | Fallback không dãy: `exercise.findFirst({ where: { curriculumUnitId: session.curriculumUnitId, type: 'homework', status: 'published' } })` | **F1.** `deliverForSession` rơi vào nhánh `sequence.length === 0` → `homework` không bao giờ match → `return null`. Worker `deliverDueExercises` đếm `skipped`. HS không có bài. |
| 6 | `apps/api/src/test/db.ts` L618–621 | `exercise.deleteMany({ where: { curriculumUnitId: { in } } })` rồi xóa unit | Teardown test toàn cục vỡ / rò bài global (F5). |

`listOpenExercisesForStudent` load `exercise: true` rồi `toExerciseDto` — DTO **bắt** `curriculumUnitId`. Không phải `where` theo unit, nhưng **mọi** `openForStudent` / `listForStudent` vỡ type cho đến khi DTO đổi.

`submission/router.ts` L173 `exercise.findMany({ where: { id: { in: exerciseIds } } })` — query theo **id**, không theo unit. Không vỡ vì cột này.

### Test / seed trong `apps/api` (cùng field, cùng vỡ)

Mọi `gddt.exercise.create({ curriculumUnitId: unit.id })`:

- `exercise/publish.test.ts` (cả cụm unique unit+type L146–160)
- `exercise/open-tier.test.ts`
- `lms-ops/exercise-delivery.int.test.ts` (`publishedHomework`, test **đúng** fallback L132–155)
- `submission/{grade,annotate-submit,teacher-annotation,list-for-child}.test.ts`
- `attendance/{gate,teacher-scoping-cross-router}.test.ts`

Ngoài `apps/api` nhưng cùng cột (để khỏi sót khi sửa harness):

- `apps/e2e/src/db.ts` L841–842, L875, L958, L973 (`cleanupCurriculumUnits` / `seedPublishedExercise` / `cleanupExercises`)
- `apps/admin/src/pages/teaching/exercises.tsx` + `exercise-detail.tsx` (UI, không phải API)

### Không phải query Exercise theo unit — đừng "sửa nhầm"

`attendance/router.ts`, `class-session-router.ts`, `lms-ops/{stamp-sessions,cancel-session,router}.ts`: đây là **unit của buổi**, dual-gate `onRoster`. Bỏ nhầm = HS mất entitlement.

---

## (5) Index mất → chậm?

Trên `Exercise` hôm nay chỉ có:

| Index | Việc | Sau B5 |
|-------|------|--------|
| `Exercise_pkey` (`id`) | get/publish/close, delivery theo id | giữ |
| `Exercise_curriculumUnitId_type_key` | unique nghiệp vụ + lookup `(unit, type)` | **xóa có chủ đích** |
| `Exercise_curriculumUnitId_idx` | lookup theo unit (`list` filter, fallback delivery, cleanup) | **xóa** |

`@@index([curriculumUnitId])` **thừa** so với unique `(curriculumUnitId, type)` (cột trái giống nhau). Mất cả hai không làm chậm path còn sống.

Index mới `UNIQUE (folderId, orderInFolder)` đủ cho `WHERE folderId = $1 ORDER BY orderInFolder`. Không cần thêm `Exercise_folderId_idx` trừ khi query `folderId` mà không đụng `orderInFolder` ở plan khác.

Không có index `status` / `createdAt` hôm nay (`list` `orderBy: { createdAt: 'desc' }` đã seq scan). Không hồi quy.

**Chậm thật** chỉ khi để sót `where: { curriculumUnitId }` (cột đã mất = lỗi, không phải chậm) hoặc list cả catalog không lọc thư mục khi số bài lớn — đã là tình trạng hiện tại.

---

## (6) `ExerciseFolder` có cần `facilityId` và RLS không? — câu quan trọng nhất

**Không. Không được thêm `facilityId`. Không được bật RLS.**

### Bằng chứng catalog vs nghiệp vụ cơ sở

| Bảng | `facilityId` | RLS / FORCE | Nguồn |
|------|--------------|-------------|--------|
| `CurriculumUnit` | không | không | schema L777–779; T2-I L71–78; docs/10 L106; docs/07 "QĐ 0021"; docs/19 §1 |
| `Exercise` | không | không | schema L807–811 **"GLOBAL, no facilityId, no RLS (QĐ 0022)"**; T2-I L71–83 |
| `ClassExerciseItem` / `SessionExercise` | **có** | ENABLE + FORCE + policy `facility_isolation` | `20260811140000` L30–42, L69–81 |
| `Submission` / `FinalGrade` / `StarTransaction` | **có** | RLS vì "child-produced… tied to one facility" **khác** catalog | schema L882–886; T2-II L107–110 |

T2-I nói thẳng vì sao catalog không RLS được:

> neither carries a `facilityId` column, so a `current_setting('app.current_facility_id')` policy would **reject every read/write**.

`exercise/router.ts` L2–6: procedure catalog gọi `ctx.db` **trực tiếp**, **cấm** `withFacility`/`scoped`.

Quy ước bảng mới + RLS (khi **có** `facilityId`): `ENABLE` + `FORCE` + policy `OR bypass_rls = 'on'` + grant tường minh. Boot `assertForceRlsOnAllRlsTables` (`boot-checks.ts` L36–51) từ chối start nếu ENABLE mà quên FORCE.

Wave-A (`20260706150000` L22–27): bảng mới mặc định `SELECT`/`INSERT`, **không** `UPDATE`/`DELETE`.

### Hai giả thuyết, một cái chết

**H1 — Folder là catalog (đúng).** Cha của `Exercise.folderId`. `Exercise` global ⇒ folder global. Cùng blast radius GĐĐT ghi catalog dùng chung (red-team cũ đã ghi nhận, QĐ 0021/0022, không phải bug mới).

**H2 — Folder theo cơ sở vì "GĐĐT quản".** Gắn `facilityId` + RLS.

H2 vỡ cơ chế:

1. `Exercise` không có `facilityId`. Một bài global không thể thuộc thư mục của đúng một cơ sở trừ khi **cũng** facility-scope `Exercise` — đảo QĐ 0022, đổi `exercise.list/create/get`, mọi test, open-tier join. Plan **không** mở scope đó.
2. RLS trên folder + router theo mẫu `exercise.router` (`ctx.db`, không set GUC) ⇒ `current_setting(..., true)` = NULL ⇒ policy false ⇒ **mọi** đọc/ghi folder bị nuốt (F2). Migration T2-I đã mô tả đúng failure mode này.
3. `withFacility` cho folder nhưng `Exercise` vẫn global: GĐĐT B thấy `exercise.folderId` của A, `include: { folder: true }` trả null. UI thư viện ma. Worker bypass thấy hết, UI staff không.
4. `facilityId` mà không RLS: trái ADR 0042 ("nếu có facilityId thì cô lập"). Ngoại lệ có chủ đích (`Guardian`, `ReceiptCodeCounter`) là bảng định danh / sentinel — folder không thuộc loại đó.

`ClassExerciseItem`/`SessionExercise` có `facilityId` vì chúng là **dãy lớp / lần phát** — dữ liệu cơ sở. Thư mục là **phân loại catalog**, cùng tầng `CurriculumUnit`, không cùng tầng enrollment.

### Grant bắt buộc (dù không RLS)

| Lệnh | Có cần | Lý do |
|------|--------|-------|
| `GRANT UPDATE ON "ExerciseFolder"` | **có** | rename, `description`, `archivedAt` |
| `GRANT DELETE` | không, nếu chỉ ẩn | giống `Exercise` — teardown test đi privileged connection |
| `ENABLE ROW LEVEL SECURITY` | **không** | F2 |
| `GRANT UPDATE ON "Exercise"` | đã có (T2-I L85) | đổi `folderId` / `orderInFolder` tái sử dụng |

`cleanupFacility` **không** xóa catalog (`test/db.ts` L576–579). Folder mới = rò test giống `CurriculumUnit` nếu không có `cleanupExerciseFolders`.

---

## (7) Sau khi cắt unit, còn suy ra unit của một bài không? Ai cần?

### Catalog: hết

Không còn `Exercise → CurriculumUnit`. `exercise.get` hết `curriculumUnit`. Admin hết nhãn unit (`exercise-detail.tsx` L189–191). `exercise.list?curriculumUnitId=` hết.

### Còn suy được — nhưng là unit của **buổi / lớp**, không phải "bài thuộc unit X"

| Đường | Ý nghĩa | Ai dùng |
|-------|---------|---------|
| `SessionExercise` → `ClassSession.curriculumUnitId` | Unit **đóng dấu lúc phát** | Dual-gate `onRoster` (`open-tier.ts` L109, L190). **Vẫn cần.** Không phải unit của bài. |
| `ClassBatch.startUnitId` / `currentUnitId` | Neo tiến độ lớp | `stamp-sessions.ts`. Không dính catalog bài. |
| `EnrollmentUnitRange` | HS được học unit nào | Entitlement. Không dính catalog bài. |
| `ClassExerciseItem` | Chỉ `(classBatchId, position, exerciseId)` | **Không** có unit. Dãy tự do sau B6. |

Một bài có thể nằm trên buổi unit 5 dù từng được tạo cho unit 1. Đó là **hệ quả có chủ đích** của B5. Đừng viết lại "bài thuộc unit" từ delivery — sai nghĩa.

### Ai đang cần unit-của-bài?

| Người / path | Có cần sau B5? |
|--------------|----------------|
| Fallback phát bài khi chưa xếp dãy (`exercise-delivery.ts` L187–205) | **Có, hôm nay.** Bỏ cột mà không giết nhánh này = F1. Plan B6 bắt xếp dãy — phải đổi fallback thành `return null` (đã có sẵn khi hết dãy) **và** sửa test L132–155. Lớp chưa `assignExerciseSequence` sẽ hết bài giữa chừng. |
| Dual-gate / nộp bài | **Không.** Roster đọc unit **buổi**. |
| `toExerciseDto` / LMS student payload | Chỉ echo catalog. Student UI không query theo field này trong `apps/api`. |
| P2-04 create form | Có, UI hiện tại. Plan đổi sang chọn thư mục — manifest phải theo (R1 plan). |
| `cleanupCurriculumUnits` | Có, để tìm bài con (F5). |
| `folderNameAtAssign` trên dãy lớp | Plan đòi, schema **chưa có**. Không suy được từ unit. Phải thêm cột trên `ClassExerciseItem` (F7) — trái câu "KHÔNG đổi ClassExerciseItem". |

### Kịch bản F1 viết rõ

1. Lớp mới, GĐĐT chưa mở màn xếp dãy (B6 chưa ship, hoặc quên).
2. Buổi có `assignUnit` / stamp, `endTime` đã qua, có homework published (trước đây match theo unit).
3. Worker `deliverDueExercises` vào nhánh `sequence.length === 0`.
4. `findFirst({ curriculumUnitId })` không còn cột → nếu code chưa sửa: Prisma throw, catch ở L269–272 → `skipped++`. Nếu code đã xóa where mà quên thay: `return null`.
5. Không có `SessionExercise`. `openForStudent` = `[]`.
6. Acceptance "chạy thông" P2-04 (soạn/publish) vẫn xanh; HS hết bài — đúng loại "CI xanh, nghiệp vụ chết" plan đã sợ ở R1 nhưng gắn nhầm chỗ.

---

## Việc plan im

- File phase-01 không có — SQL trên là yêu cầu tối thiểu, chưa được plan viết.
- `ClassExerciseItem.folderNameAtAssign` vs "không đổi model dãy".
- Sentinel thư mục mặc định (UUID / `kind`), không phải string tên.
- `GRANT UPDATE` folder.
- Giết fallback unit-stamp + test tương ứng **trong cùng PR schema**.
- `cleanupCurriculumUnits` / `cleanupExercises` / e2e seed.
- Unique defer / lock khi reorder.
- Đảo QĐ 0022 chỉ nếu muốn thư viện **theo cơ sở** — đó là ADR mới, không phải "thêm cột facilityId cho có".

## Yếu nhất trong review này

Không đếm được số hàng `Exercise` trên DB thật của máy này (không chạy query sống). Plan + B4 giả định chưa production. Nếu môi trường nào đã có dãy/`SessionExercise`, `TRUNCATE`/`DELETE` bài là mất lịch sử phát — RESTRICT sẽ chặn, migration xóa bài sẽ fail. Backfill (không xóa) là đường duy nhất an toàn.

Status: **DONE** (chỉ đọc).  
Summary: Bỏ unit được nếu migration theo thứ tự add-null → backfill `ROW_NUMBER` → NOT NULL → unique → drop; `ExerciseFolder` phải global không RLS; fallback phát bài theo unit là chỗ hỏng dữ liệu vận hành lớn nhất.
