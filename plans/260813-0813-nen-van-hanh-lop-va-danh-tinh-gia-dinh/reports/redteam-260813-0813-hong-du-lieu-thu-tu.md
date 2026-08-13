# Red team — Hỏng dữ liệu và thứ tự

**Plan:** `plans/260813-0813-nen-van-hanh-lop-va-danh-tinh-gia-dinh/`
**Góc nhìn:** hỏng dữ liệu + thứ tự (restamp unit, migration song song, idempotency importer, buổi `done`)
**Repos:** `cmc_edu` (cwd) · `cmc-lms` freeze `031d193`
**Phạm vi:** chỉ đọc code; không sửa sản phẩm. Báo cáo này là file duy nhất được ghi.

Phát hiện dưới đây chỉ giữ những chỗ **làm đổi cách thi hành**. Mỗi mục (a)–(f) kết luận rõ; chỗ không có lỗi thì ghi `không tìm thấy`.

---

## Tóm tắt — đổi cách thi hành trước khi viết A1

| # | Mức | Đổi gì |
|---|---|---|
| F1 | **CRITICAL** | Đừng `DELETE ScheduleSlot`. Đổi unique buổi sang `(classBatchId, sessionDate, startTime)` như `cmc-lms`. Khớp + lật **cùng hàng**, không `createMany` theo `scheduleSlotId` mới. |
| F2 | **HIGH** | `restampBatchSessions` hiện tại **không** đủ cho hồi sinh: đóng băng theo `done` chứ không theo điểm danh; bỏ qua `capped`; không đụng `SessionExercise` / `FinalGrade`. Phải viết chính sách đóng băng + đảo side-effect, đừng “dùng chung đường hủy” nguyên văn. |
| F3 | **HIGH** | A2: `RENAME VALUE blocked_lms → on_hold` + `ADD VALUE` ba giá trị mới. **Cấm** “thêm 4 rồi gỡ `blocked_lms`” trong một lần rebuild type. |
| F4 | **HIGH** | A ‖ B: **bảng** đúng là rời nhau; **file thì không** (`schema.prisma`, `approved-children.ts`). R1 phải nói protocol merge file, không chỉ “bảng khác”. |
| F5 | **MEDIUM** | A3: mở rộng `import-curriculum-units.mjs` hiện tại. **Cấm** port `seed-curriculum.ts` của `cmc-lms` (đỗ `order_global` âm + prune). |

---

## (a) Hồi sinh buổi + `restampBatchSessions` lệch cả dãy

Kế hoạch **có** nhìn ra restamp phải chạy lại, nhưng kê đơn sai so với code thật.

> phase-a1:49–50 — *«Hồi sinh dùng chung đường đóng dấu với hủy, không viết đường thứ hai.»*
> phase-a1:71 — *«Thêm lại khung cùng thứ/giờ ⇒ đúng những buổi đó hồi sinh, dấu unit đúng lại»*
> phase-a1:74 — *«Hồi sinh xong, dấu unit của cả dãy khớp với kết quả tính lại từ neo»*
> phase-a1:81 — *«Hồi sinh buổi làm dấu unit lệch cả dãy \| Dùng chung đường đóng dấu với hủy»*

### F1 — Unique buổi bám `scheduleSlotId` + `ON DELETE SET NULL` → sinh đôi — CRITICAL

**Câu kế hoạch sai / thiếu:**

> phase-a1:58–62 — *«sửa/xóa `ScheduleSlot` thì buổi tương lai … hủy với lý do `slot_removed`»* rồi *«sinh buổi thấy buổi `cancelled` + `slot_removed` cùng thứ/giờ ⇒ hồi thay vì tạo mới»*

Kế hoạch nói khớp **thứ/giờ**, nhưng không nói unique thật và không cấm `DELETE`.

**Bằng chứng:**

```139:140:packages/db/prisma/migrations/20260706170000_p2_foundation_class_ops/migration.sql
CREATE UNIQUE INDEX "ClassSession_classBatchId_scheduleSlotId_sessionDate_key"
  ON "ClassSession"("classBatchId", "scheduleSlotId", "sessionDate");
```

```176:177:packages/db/prisma/migrations/20260706170000_p2_foundation_class_ops/migration.sql
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_scheduleSlotId_fkey"
  FOREIGN KEY ("scheduleSlotId") REFERENCES "ScheduleSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

```69:81:apps/api/src/class/schedule-router.ts
        const before = await tx.classSession.count({ where: { classBatchId: classBatch.id } });
        if (planned.length > 0) {
          await tx.classSession.createMany({
            data: planned.map((p) => ({
              // ...
              scheduleSlotId: p.scheduleSlotId ?? null,
```

`skipDuplicates` chỉ tránh trùng `(classBatchId, scheduleSlotId, sessionDate)`. Postgres coi `NULL ≠ NULL` trong unique ⇒ nhiều hàng `(batch, NULL, cùng ngày)` sống cùng lúc.

Chuẩn đang chạy (`cmc-lms`) **không xóa** khung — `archivedAt` — và unique là lịch, không phải id khung:

```388:388:/home/manhquy/Downloads/cmc-lms/packages/db/prisma/schema.prisma
  @@unique([classBatchId, sessionDate, startTime])
```

```84:92:/home/manhquy/Downloads/cmc-lms/apps/api/src/services/session-generator.ts
  // Buổi bị hủy vì XÓA KHUNG nay có khung cùng thứ/giờ trở lại → hồi sinh thay vì
  // để nó chiếm chỗ vĩnh viễn (review I1).
      if (dup.status === 'cancelled' && dup.cancelReason === 'slot_removed') toRevive.push(dup.id);
```

`cmc_edu` chưa có `ScheduleSlot.archivedAt`, chưa có API gỡ khung.

**Hậu quả nếu thi hành nguyên văn “xóa khung rồi sinh lại”:**

1. `DELETE ScheduleSlot` → buổi cũ (kể cả `done`) mất `scheduleSlotId` (`SET NULL`).
2. Thêm khung mới (id mới) + `generateSessions` → `createMany` **không** đụng unique cũ → một ngày có **hai** buổi: buổi `done`/`cancelled` (slot null) + buổi `planned` mới.
3. Điểm danh / bài tập / nhật ký bám id cũ; giáo viên mở id mới. Dãy unit đếm thêm một buổi “ma”. Đây là hỏng dữ liệu, không phải lệch UI.

**Đổi thi hành:** (1) archive khung, không `DELETE`; (2) đổi unique sang `(classBatchId, sessionDate, startTime)` như nguồn; (3) hồi sinh = `UPDATE` cùng hàng + gán lại `scheduleSlotId`; (4) `generateSessions` phải nhìn buổi đã có theo ngày+giờ **trước** khi `createMany`.

---

### F2 — “Dùng chung đường đóng dấu với hủy” viết lại unit của buổi đã dạy — HIGH

**Câu kế hoạch:**

> phase-a1:50 — *«Hồi sinh dùng chung đường đóng dấu với hủy»*
> phase-a1:74 — *«dấu unit của cả dãy khớp với kết quả tính lại từ neo»*

Đóng dấu hiện tại **cố ý** làm lệch dãy khi số buổi hợp lệ đổi — và test đã chứng minh chiều hủy:

```45:71:apps/api/src/lms-ops/stamp-sessions.ts
  const sessions = await tx.classSession.findMany({
    where: {
      classBatchId: opts.classBatchId,
      status: { not: 'cancelled' },
      sessionDate: { gte: opts.anchorDate },
    },
    // ...
  });
  const frozenIds = new Set(sessions.filter((s) => s.status === 'done').map((s) => s.id));
  const stamps = deriveSessionUnits(opts.anchorOrderGlobal, programAxis, ordered);
  for (const stamp of stamps) {
    if (frozenIds.has(stamp.id)) continue;
    // ghi curriculumUnitId
```

```230:232:apps/api/src/lms-ops/lms-ops.int.test.ts
    // Boundary proof: old index-4 session slides 102 → 101 after cancel+restamp.
    const slid = live.find((s) => s.id === ordered[4]!.id);
    expect(slid?.curriculumUnitId).toBe(unitIds[0]);
```

Hồi sinh buổi giữa dãy là phép **ngược**: mọi buổi live sau nó tăng `k` thêm 1 → `floor(k/4)` có thể nhảy unit. Kế hoạch chấp nhận chuyện này. Ba lỗ mà “dùng chung đường hủy” **không** xử:

**1. Đóng băng sai vị từ so với chuẩn.**

`cmc_edu` chỉ bỏ qua `status === 'done'`. Buổi `planned`/`confirmed` **đã có điểm danh** vẫn bị ghi đè unit.

Chuẩn `cmc-lms` đóng băng theo điểm danh / quá khứ đã có unit — đúng vì đổi unit sau khi đã dạy làm mồ côi roster:

```220:226:/home/manhquy/Downloads/cmc-lms/apps/api/src/services/session-generator.ts
    const frozen =
      s._count.attendances > 0 ||
      (s.sessionDate.getTime() < today.getTime() && s.curriculumUnitId != null);
    if (!force && frozen) continue;
```

`cmc_edu` còn cho hủy buổi đã điểm danh miễn chưa `done` (`cancel-session.ts:60–66` chỉ chặn `planned|confirmed`, không nhìn attendance). Hồi sinh + restamp sẽ đẩy unit của những buổi đó.

**2. Buổi `done` phía sau bị lệch so với công thức.**

Restamp **đếm** `done` nhưng **không ghi**. Kịch bản: hủy S3 → S4/S5 thành `done` trên unit đã trượt → hồi S3. Công thức muốn S5 = unit kế; hàng `done` giữ unit cũ. “Cả dãy khớp neo” **fail** nếu so với `deriveSessionUnits`, và **giả xanh** nếu so với những hàng restamp vừa ghi.

**3. Side-effect của hủy không được đảo, và restamp cố ý không đụng bài tập.**

```116:148:apps/api/src/lms-ops/cancel-session.ts
  // FinalGrade attendance-rate denominator excludes cancelled sessions.
  // ...
  // Class-unit-spec §8.3: cancelled session must not burn sequence position.
  // Revoke SessionExercise when no student has submitted
```

```53:54:apps/api/src/lms-ops/exercise-delivery.ts
 * Unit restamp never touches this pointer.
```

Hủy: loại buổi khỏi mẫu số `FinalGrade`, có thể xóa `SessionExercise`. Hồi sinh theo kế hoạch chỉ lật status + restamp unit. Hệ quả: tỉ lệ chuyên cần vẫn tính như buổi còn hủy; bài đã giao của buổi sau vẫn là bài của **unit cũ** trong khi stamp đã nhảy; buổi hồi sinh không có bài (đã revoke).

`deriveSessionUnits` trả `capped` (`unit-progression.ts:111–116, 141–147`) nhưng `restampBatchSessions` **nuốt** cờ đó — buổi vượt trần bị đóng dấu unit cuối, không hủy `ceiling`. Kế hoạch liệt `ceiling` là lý do không tự hồi (`phase-a1:39`) nhưng đường đóng dấu dùng chung **chưa bao giờ sinh** lý do đó.

**Hậu quả:** sau một lần gỡ/thêm khung giữa khóa, một phần buổi đã dạy mang unit sai, bài tập sai unit, điểm chuyên cần sai. Đợt 5 nhập dữ liệu thật sẽ kế thừa dãy lệch này.

**Đổi thi hành:** không gọi nguyên `restampBatchSessions` của hủy. Viết đường hồi sinh với: (1) đóng băng = `done` **hoặc** đã có attendance (chuẩn I8); (2) nếu phía sau đã `done`/`attendance` thì **từ chối hồi sinh** hoặc `realignHistory` có chủ đích — đừng lặng lẽ lệch; (3) `recomputeFinalGrade` sau hồi; (4) thu hồi / không tái dùng `SessionExercise` của buổi bị đổi unit nếu chưa có bài nộp; (5) nếu giữ lý do `ceiling` thì restamp phải hủy buổi tương lai `capped`, không stamp unit cuối lần hai.

`schedule.generateSessions` hiện **không** gọi restamp (`schedule-router.ts:69–84`). Mọi hồi sinh móc vào đó mà quên restamp thì unit giữ trạng thái “đã trượt lúc hủy”.

---

## (b) Thứ tự A1 rồi A2 — xung đột migration enum

**không tìm thấy** xung đột DDL giữa `SessionCancelReason` (type mới + cột `ClassSession.cancelReason`) và `StudentLifecycle` (đổi giá trị trên `Student.lifecycle`) nếu A1 → A2 tuần tự trên cùng nhánh.

Hai type Postgres khác nhau, hai cột khác nhau. Repo chưa từng có migration nào đụng `StudentLifecycle` sau lần tạo (`20260706025956_p1_identity_enrollment/migration.sql:23`). A1 không đụng enum đó.

Rủi ro còn lại là **quy trình** (`prisma migrate dev` trên A2 nếu local chưa apply A1) — không phải hai enum đụng nhau.

---

## (c) Hai nhánh A ‖ B cùng thêm migration — kiểm chứng bảng

Kế hoạch:

> plan.md:25 — *«Hai làn không đụng file chung \| A ở `class/`, `lms-ops/`, `curriculum`; B ở `lms-auth/`, `guardian/`, `apps/lms`»*
> plan.md:135 — *«A và B đụng bảng khác hẳn nhau; B chỉ có một migration (drop `LoginOtp`) và để cuối»*

### Bảng Postgres — kế hoạch **đúng** (đã đối chiếu schema)

| Làn | Object sẽ đổi | File schema |
|---|---|---|
| A1 | type mới `SessionCancelReason`; `ClassSession.cancelReason`; có thể thêm `ScheduleSlot.archivedAt` | `ClassSession`, `ScheduleSlot` |
| A2 | type `StudentLifecycle` / cột `Student.lifecycle` | `Student` |
| A3 | bảng mới `CurriculumLesson`, `SessionStudentComment`; `CurriculumUnit.sessionMinutes`; rất có thể `ClassSession.curriculumLessonId` | unit / lesson / comment / lại `ClassSession` |
| B1 | `DROP TABLE LoginOtp` (+ type `LoginOtpStatus`); có thể `ParentAccount.passwordHash` NOT NULL; có thể `StudentAccount` | `LoginOtp`, `ParentAccount`, `StudentAccount` |

Không có bảng dữ liệu nào A và B cùng `ALTER`. `EnrollmentStatus` đã có `completed`/`transferred` — đó là **type khác**, không đụng `StudentLifecycle`.

Cùng timestamp khác slug (`20260814…_a1` vs `20260814…_drop_login_otp`) Prisma vẫn coi là hai migration; thứ tự = so chuỗi tên thư mục. Trùng **nguyên** tên thư mục mới vỡ checksum. Head hiện tại: `20260813010000_exercise_library_folders`.

### F4 — “Không đụng file chung” là sai — HIGH

Cả hai làn **bắt buộc** sửa:

1. `packages/db/prisma/schema.prisma` — một file. Git có thể tự merge nếu hunk xa nhau, cũng có thể nuốt enum/`model LoginOtp` nếu resolve tay ẩu.
2. `apps/api/src/guardian/approved-children.ts` — A2 phải đổi cổng `notIn: ['blocked_lms', 'withdrawn']` (`approved-children.ts:50`); B1 liệt đúng file này trong phạm vi đo (`phase-b1:56`).

R1 (“trộn nhánh gãy”) giảm thiểu bằng “bảng khác” là **thiếu**. Hai PR song song trên `approved-children.ts` có thể giữ cổng `blocked_lms` sau khi enum đã đổi, hoặc giữ cổng `on_hold` nhưng helper sở hữu nhà bị B1 viết đè.

**Đổi thi hành:** giữ “B migration cuối” như đã viết; thêm: rebase `schema.prisma` thường xuyên; A2 merge cổng vòng đời **trước** B1 đụng `approved-children.ts` (hoặc B1 nhận A2 trước khi sửa file đó). Đừng sửa migration lịch sử `20260706150000` (GRANT `LoginOtp`) — DROP TABLE mang GRANT đi; gỡ GRANT chỉ trong migration drop của B.

---

## (d) `blocked_lms` → `on_hold` — tiến/lùi và hàng mồ côi

> phase-a2:57 — *«Thêm 4 giá trị vào enum; migration ánh xạ `blocked_lms` → `on_hold` rồi gỡ giá trị thừa.»*
> phase-a2:65 — *«Migration chạy được, không hàng mồ côi, không hàng còn giá trị cũ»*

### F3 — Gỡ giá trị enum không lùi được; cách viết trong plan sai với precedent repo — HIGH

**Bằng chứng:**

- Tạo type: `packages/db/prisma/migrations/20260706025956_p1_identity_enrollment/migration.sql:23` — `CREATE TYPE "StudentLifecycle" AS ENUM ('active', 'blocked_lms', 'withdrawn')`.
- Mọi enum sau này trong repo **chỉ `ADD VALUE`**, không drop/rename (`20260712000000_…/migration.sql:7–10` còn cấm dùng giá trị mới trong cùng file với `ADD VALUE`).
- Không có down-migration. Rollback chính thức:

```199:204:docs/runbook-deploy.md
### 3.2 Migration rollback
Prisma does not auto-rollback.
...
2. Write a compensating SQL migration manually.
4. Never delete migration files from the `migrations/` directory.
```

Postgres không có `DROP VALUE`. “Gỡ `blocked_lms`” = tạo type mới + `USING` + drop type cũ. Lùi = rebuild lần nữa.

**Hàng mồ côi:** `seed.mjs` **không** ghi `blocked_lms` (mặc định `active`). Không có hàng seed mồ côi. Hàng “mồ côi” thật nếu rebuild type khi vẫn còn writer `enrollment.blockLms` (`enrollment/router.ts:98`) hoặc `student.setLifecycle` zod (`student/router.ts:125`) đẩy `'blocked_lms'` — lệnh fail, không để lại label lạ.

`ADD VALUE 'on_hold'` rồi `UPDATE … 'on_hold'` **trong cùng migration** trái precedent repo (`20260706160000` / `20260712000000`). PG 16 (compose `postgres:16-alpine`) cho dùng label mới trong cùng transaction, nhưng đây không phải cách repo đang đi.

**Lùi sau khi đã có `admitted`/`transferred`/`completed`:** không ánh xạ 1-1 về bộ 3 cũ. `RENAME VALUE 'on_hold' TO 'blocked_lms'` gộp bảo lưu mới với cổng kỹ thuật cũ.

**Đổi thi hành:**

```sql
ALTER TYPE "StudentLifecycle" RENAME VALUE 'blocked_lms' TO 'on_hold';
-- migration sau (không dùng ngay trong file ADD):
ALTER TYPE "StudentLifecycle" ADD VALUE IF NOT EXISTS 'admitted';
ALTER TYPE "StudentLifecycle" ADD VALUE IF NOT EXISTS 'transferred';
ALTER TYPE "StudentLifecycle" ADD VALUE IF NOT EXISTS 'completed';
```

Không rebuild type, không “gỡ” gì cả. Lùi rename được bằng `RENAME` ngược. Ba giá trị mới không lùi được — chấp nhận và **không** đưa chúng vào cùng transaction với rename. Đổi hết writer/test/UI trước khi deploy code đọc enum mới.

---

## (e) A3 nhập 240 bài học vs importer hiện tại

> phase-a3:41–45 — *«Nhập lại từ CSV phải idempotent. `ensure-curriculum-units` đang chạy ở khởi động; thêm bài học không được nhân bản»*
> phase-a3:98 — *«Mở rộng importer khung chương trình: nhập 240 bài học + thời lượng, idempotent»*
> phase-a3:117 — *«Khoá duy nhất `[unit, seqInUnit]` + upsert»*

### Cách importer đang làm — không phá unit nếu chỉ **mở rộng**

`packages/db/prisma/import-curriculum-units.mjs`:

- 240 dòng CSV → gom theo `(program, orderGlobal)` → 96 unit (`groupCurriculumUnits`, dòng 122–222).
- `importCurriculumUnits` (250–296): `findUnique({ program_orderGlobal })` rồi **update tại chỗ** (giữ `id`) hoặc `create`. Không `delete`, không prune, không bọc transaction cả catalog.
- Bỏ qua hoàn toàn `bai_hoc`, `topic_no`, `tu_duy_khai_niem_dat_duoc`, `ghi_chu`, `thoi_luong_buoi_phut`.
- `unit_code` chỉ để ghép `title`, **không lưu** — `CurriculumUnit` không có cột `unitCode` (`schema.prisma:782–804`).

CSV đã đo: 240 dòng, `topic_no` không trùng trong một unit, phân bố bài 1/2/4 đúng UCREA / Bright I.G / Black Hole. `sessions=4` mọi dòng. `thoi_luong_buoi_phut` = 90 (UCREA) / 110 (hai chương trình kia).

Thêm 240 `CurriculumLesson` bằng upsert theo `(curriculumUnitId, seqInUnit)` (và nên thêm `lessonCode` ổn định `` `${unit_code}#${topic_no}` `` từ CSV) **không** phá idempotency unit: id unit giữ nguyên, FK buổi/`startUnitId` sống.

### F5 — “Bản mẫu ở nguồn” dễ kéo theo prune/đỗ số âm — MEDIUM

`cmc-lms` `packages/db/src/seed-curriculum.ts:263–320` (freeze `031d193`):

- `UPDATE … SET order_global = -order_global`
- upsert unit theo **`unitCode`** (cột `cmc_edu` không có)
- upsert lesson theo `lessonCode`
- `pruneUnitsAbsentFromCsv` — xóa unit không còn trên CSV

Port nguyên file đó vào `cmc_edu` sẽ: fail vì không có `unitCode`; hoặc nếu tự thêm rồi prune, `ClassSession.curriculumUnitId` / neo lớp `ON DELETE RESTRICT` (t2i `migration.sql:59`) **chặn hoặc để buổi mồ côi**. Unique `(program, orderGlobal)` cũng vỡ nếu đỗ số âm lọt ra ngoài transaction.

A3 không ra lệnh port file đó, nhưng dẫn schema nguồn và gọi đó là bản mẫu.

**Đổi thi hành:** chỉ mở rộng `import-curriculum-units.mjs` + `seed.mjs` / `ensure-curriculum-units.ts`. Cấm negate `orderGlobal`. Cấm prune. `seqInUnit = Number(topic_no)` (đã unique).

### Câu “chạy ở khởi động” — sai, không phải lỗi dữ liệu

`ensure-curriculum-units.ts` **không** chạy khi API boot. Chỉ: CLI có cổng env, `seed.mjs`, và spawn best-effort từ `seed-local-sim-demo.ts:104`. Idempotency vẫn bắt buộc vì seed/ensure chạy lại được — nhưng đừng thêm hook boot `cmc_app` (default privilege bảng mới = SELECT+INSERT, không UPDATE — `20260706190000_t2i_exercise_foundation/migration.sql:75–78`). Upsert bài học dưới role app sẽ fail lần hai.

**không tìm thấy** lỗi trong chính chữ “unique + upsert trên importer hiện tại” — hướng đó khớp code.

Ghi thêm (không bịa thành finding độc lập): restamp **production** của `cmc-lms` cũng **không** ghi `curriculumLessonId` — chỉ demo seed (`seed-demo-student.ts:322–337`, `i % lessons.length`). A3 “đóng dấu bài đi theo unit” là cơ chế **mới**, không có ở đường sống của nguồn. Nếu nhét vào `restampBatchSessions`, F2 lan sang cả bài học.

---

## (f) Buổi `done` — hủy / hồi sinh

> phase-a1:84 — *«`cmc-lms` không có `done`; `cmc_edu` có. Giữ chặn hiện tại: `done` không hủy được, và không nằm trong tập hồi sinh»*

**Chặn hủy `done` — kế hoạch đúng, code đã có.**

```55:56:apps/api/src/lms-ops/cancel-session.ts
  if (session.status === 'cancelled') throw badRequest('Session is already cancelled.');
  if (session.status === 'done') throw badRequest('A done session cannot be cancelled.');
```

Race-safe: `updateMany` chỉ `planned|confirmed` (`cancel-session.ts:60–66`). `assignUnit` cũng chặn `done` (`assert-session-active.ts:15–16`). Không có đường `cancelled → *` hôm nay.

**Hồi sinh chính hàng `done`:** nếu tập hồi chỉ `cancelled + slot_removed`, hàng `done` không vào. Phần này **không tìm thấy** lỗ trên chữ kế hoạch.

**Lỗ thật nằm cạnh `done`, không phải trên hàng `done`:**

1. F1: xóa khung → `SET NULL` trên **cả** buổi `done` → sinh buổi `planned` trùng ngày. Hàng `done` không bị hủy, nhưng ngày đó có twin. Đây là cách `done` bị “hồi” giả.
2. F2: hồi buổi `cancelled` **trước** một buổi đã `done` làm công thức unit của hàng `done` lỗi thời.
3. Worker `cancelZeroPresentWithRestamp` (`session-done-sweep.ts:88–99`) hủy `planned|confirmed` quá `endTime+24h` **không lý do**. A1 cấm mặc định ngầm (`phase-a1:56–57`). Gán nhầm `slot_removed` ⇒ thêm khung sẽ hồi buổi quá khứ trống (đường `cmc-lms` cũng không lọc ngày khi revive). Gán `manual` thì an toàn. Kế hoạch chưa chọn.

**Đổi thi hành:** ngoài “không hồi `done`”, cấm tạo hàng mới cho `(batch, ngày, giờ)` đã có **bất kỳ** buổi nào (`done`/`cancelled`/`planned`). Worker hủy phải có `reason` tường minh ≠ `slot_removed`/`class_closed`.

---

## Bảng đối chiếu (a)–(f)

| Mục | Kết luận |
|---|---|
| (a) Restamp khi hồi sinh giữa dãy | **Có lỗi.** Dãy unit **sẽ** đổi — đó là toán đếm buổi. Kế hoạch thấy nhưng kê “dùng chung đường hủy” thì viết đè buổi đã dạy, bỏ `FinalGrade`/`SessionExercise`/`ceiling`, và unique/slot-delete đẻ twin. |
| (b) A1 rồi A2 cùng nhánh | **không tìm thấy** xung đột enum/migration. |
| (c) A ‖ B cùng migration | **Bảng rời nhau — đã kiểm schema.** **File không rời.** R1 viết thiếu. |
| (d) `blocked_lms` → `on_hold` | **Tiến được; lùi không sạch nếu gỡ giá trị.** Seed không có hàng mồ côi. Đổi thành `RENAME VALUE`. |
| (e) Importer 240 bài | **không tìm thấy** phá idempotency unit nếu mở rộng upsert hiện tại. Có bẫy port prune/negate của nguồn + câu “khởi động” sai. |
| (f) Buổi `done` | Chặn hủy/hồi **đúng**. Twin sau xóa khung và lệch stamp phía sau `done` là lỗ thật. |

---

## Việc A1 phải ghi vào phase trước khi code

1. `ScheduleSlot`: thêm `archivedAt` (hoặc tương đương), **cấm DELETE**.
2. Unique `ClassSession`: `(classBatchId, sessionDate, startTime)` — migration đổi index, xử lý trùng null hiện có nếu có.
3. Hồi sinh = lật hàng cũ; `generateSessions` match theo ngày+giờ trước `createMany`; restamp sau cùng tx.
4. Chính sách đóng băng restamp khi hồi: từ chối nếu phía sau đã `done` hoặc đã điểm danh — hoặc document `force` như `realignHistory`.
5. Hồi sinh gọi lại `recomputeFinalGrade`; quy tắc `SessionExercise` (revoke nếu stamp unit đổi và chưa có bài nộp).
6. `ceiling`: hoặc implement trên restamp, hoặc bỏ khỏi enum cho đến khi có đường sinh ra nó.
7. Worker auto-cancel: `reason` bắt buộc, không phải `slot_removed`.

A2: `RENAME VALUE` + 3× `ADD VALUE` tách file; không rebuild type.

A3: mở rộng importer hiện tại; không port `seed-curriculum.ts`.

B1: không sửa `approved-children.ts` cho đến khi A2 đã đổi tập chặn; migration drop `LoginOtp` sau cùng, timestamp sau A3.
