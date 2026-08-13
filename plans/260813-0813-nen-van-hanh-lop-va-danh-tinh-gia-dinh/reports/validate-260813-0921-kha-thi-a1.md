# Validate — khả thi kỹ thuật A1 (nền lịch buổi)

Góc: **A1 có thi hành được không, và kế hoạch có đủ chỗ phải sửa không.**
Không red-team. Mọi kết luận gắn `file:dòng` và `DUNG` / `SAI` / `KHONG KIEM DUOC`.

Đã đọc: `plan.md`, 6 file phase, `reports/redteam-adjudication-260813-0849.md`.
Đo bằng code: `/home/manhquy/Downloads/cmc_edu` và `/home/manhquy/Downloads/cmc-lms` (freeze khai báo `031d193`; **KHONG KIEM DUOC** HEAD thật của `cmc-lms` trong vòng này — schema/migration bên dưới là file đang có trên đĩa).

---

## Kết luận ngắn

A1 **thi hành được** trên `cmc_edu` (chưa production, đổi khoá + thêm cột là migration thuận). Đây **không** phải một thay đổi nhỏ: khoá cũ chỉ sống ở chỉ mục + `skipDuplicates`, nhưng `startTime` đích **không cùng kiểu** với nguồn, và kế hoạch **không viết hợp đồng so khớp** ngày+giờ. Thiếu chỗ đó thì bước 5 ("tra theo ngày + giờ") dễ viết sai và sinh buổi đôi đúng cái bẫy A1 định phá.

---

## 1. Đổi khoá duy nhất ClassSession — có khả thi không?

**DUNG — khả thi.** Application code **không** gọi `findUnique` / `upsert` / `onConflict` theo tên khoá cũ. Chỉ có chỉ mục + `createMany({ skipDuplicates: true })` dựa vào nó. Đổi `@@unique` rồi sửa 3 chỗ `skipDuplicates` + comment/test là đủ để Prisma chấp nhận.

### Khoá hiện tại vs khoá đề xuất

| | `cmc_edu` | `cmc-lms` |
|---|---|---|
| Khai báo | `@@unique([classBatchId, scheduleSlotId, sessionDate])` `packages/db/prisma/schema.prisma:765` | `@@unique([classBatchId, sessionDate, startTime])` `cmc-lms/packages/db/prisma/schema.prisma:388` |
| SQL | `ClassSession_classBatchId_scheduleSlotId_sessionDate_key` trên 3 cột đó `packages/db/prisma/migrations/20260706170000_p2_foundation_class_ops/migration.sql:139-140` | `class_session_class_batch_id_session_date_start_time_key` `cmc-lms/.../20260727044718_init/migration.sql:670` |
| FK khung | `ON DELETE SET NULL` `migration.sql:176-177` | Không bám id khung; khung lưu trữ (`archivedAt` `schema.prisma:347`) |

Claim "khoá bám id khung + SET NULL là bẫy buổi ma": **DUNG** (Postgres `NULL ≠ NULL` trong unique).

### Mọi chỗ dựa vào khoá cũ (bắt buộc sửa)

Không có `classBatchId_scheduleSlotId_sessionDate` trong mã ứng dụng (chỉ migration + tài liệu). Prisma `skipDuplicates` dịch thành `ON CONFLICT DO NOTHING` trên **mọi** unique của bảng — đổi khoá là đổi luôn điều kiện bỏ qua.

| `file:dòng` | Việc làm | Phải sửa? |
|---|---|---|
| `packages/db/prisma/schema.prisma:763-765` | Comment + `@@unique([classBatchId, scheduleSlotId, sessionDate])` | **Có** — đổi sang `(classBatchId, sessionDate, startTime)` |
| `packages/db/prisma/migrations/20260706170000_p2_foundation_class_ops/migration.sql:139-140` | Tạo chỉ mục cũ | **Không sửa file cũ** — thêm migration mới `DROP INDEX` + `CREATE UNIQUE` |
| `apps/api/src/class/generate-sessions.ts:5-8` | Comment: de-dupe = unique `(classBatchId, scheduleSlotId, sessionDate)`; hàm **không** tra buổi đã có | **Có** — comment + (bước 5) tra ngày+giờ trước khi caller persist |
| `apps/api/src/class/generate-sessions.ts:62-66` | Gán `scheduleSlotId`, `sessionDate = ictToUtc(date,'00:00')`, `startTime = ictToUtc(date, slot.startTime)` | **Không bắt buộc** cho khoá mới nếu caller vẫn ghi đúng 3 cột; **có** nếu đổi cách tra |
| `apps/api/src/class/schedule-router.ts:1-2, 71-81` | `generateSessions`: `createMany` + `skipDuplicates: true` | **Có** — đây là đường regenerate. Sau đổi khoá, `skipDuplicates` sẽ khớp theo `(lớp, ngày, giờ)` — đúng hướng A1 — nhưng bước 5 bắt tra tường minh |
| `apps/api/src/class/class-batch-router.ts:235-245` | `classBatch.create`: cùng `createMany` + `skipDuplicates` | **Có** — cùng cơ chế |
| `apps/api/src/lms-ops/router.ts:194-204` | `lmsOps.createClassWithUnits`: **cùng** `createMany` + `skipDuplicates` | **Có** — phase A1 **không nêu tên file này**. Bỏ sót thì một đường tạo lớp vẫn sống theo khoá mới (may) nhưng **không** tra tường minh như ràng buộc 3 |
| `apps/api/src/class/generate-sessions.test.ts:109-148` | Idempotent regenerate + nới `endDate` | **Có** — thêm case: gỡ/thêm khung cùng thứ+giờ không tăng số buổi |
| `apps/e2e/src/db.ts:1145-1158` | Seed e2e `create` từng hàng, **không** `skipDuplicates` | **Không** vì khoá cũ; **có** nếu seed hai buổi cùng ngày+`startTime` |

**SAI** nếu hiểu "chỉ `apps/api/src/class/`": còn `lms-ops/router.ts:194-204`.

### Không dựa vào khoá cũ (không phải sửa vì unique)

| `file:dòng` | Lý do |
|---|---|
| `apps/api/src/class/room-conflict.ts:30-44` | So `startTime`/`endTime` kiểu `Date`, không unique |
| `apps/api/src/kpi/auto-score.ts:362-371` | `skipDuplicates` trên bảng KPI, không phải `ClassSession` |
| Mọi `classSession.findFirst`/`findUnique` theo `id` | Không dùng compound unique |
| `apps/api/src/test/db.ts:677-694` `seedClassSession` | `create` thường, không `upsert` |

**KHONG KIEM DUOC** dữ liệu mẫu/dev DB hiện có cặp `(lớp, ngày, giờ)` trùng — bước 1 của A1 đúng là cổng chặn; không đọc được DB triển khai từ repo.

### Cạnh unique mà A1 chưa viết

`ScheduleSlot` đích **không** unique `(classBatchId, weekday, startTime)` (`schema.prisma:706-723`). `slotInputSchema` (`class-batch-router.ts:18-27`, `lms-ops/router.ts:38-47`) cũng không cấm hai khung cùng thứ+giờ. Hôm nay khoá cũ **cho phép** hai buổi cùng ngày cùng giờ (khác `scheduleSlotId`). Khoá mới **cấm**. Nguồn đã chốt bằng partial unique `schedule_slot_active_day_time_key` (`cmc-lms/.../20260727213500_schedule_slot_unique/migration.sql:13-15`) đúng vì "khớp buổi theo thứ+giờ chứ không theo slot id".

A1 không thêm chỉ mục này → hai request tạo khung song sinh vẫn ghi được hai `ScheduleSlot`, rồi `createMany` chỉ persist một buổi (`skipDuplicates`) và **im lặng nuốt** khung kia.

---

## 2. `startTime` kiểu gì — dùng làm khoá duy nhất có vấn đề không?

**Đây là điểm nặng nhất.** Kế hoạch viết "khoá `(lớp, ngày, giờ bắt đầu)`" như thể cùng nghĩa với nguồn. **SAI về kiểu.**

### Đo được

| Cột | `cmc_edu` | `cmc-lms` |
|---|---|---|
| `ClassSession.startTime` | `DateTime @db.Timestamptz(3)` `schema.prisma:740` + SQL `TIMESTAMPTZ(3)` `migration.sql:95` | `String` map `start_time` `schema.prisma:371`; SQL `TEXT NOT NULL` `init/migration.sql:201` |
| `ClassSession.endTime` | Cùng `Timestamptz(3)` `:741` | `String` `:372` |
| `ClassSession.sessionDate` | `DateTime @db.Timestamptz(3)` — **ICT midnight**, comment `:736-739` | `DateTime @db.Date` `:370`; SQL `DATE` `init/migration.sql:200` |
| `ScheduleSlot.startTime` | `String` `HH:mm` ICT `:712-713` | `String` `HH:mm` ICT `:339` |

Sinh buổi đích (`generate-sessions.ts:64-66`):

```ts
sessionDate: ictToUtc(date, '00:00'),
startTime:   ictToUtc(date, slot.startTime),
endTime:     ictToUtc(date, slot.endTime),
```

`ictToUtc` (`packages/domain-time/src/index.ts:33-43`):

- Chỉ nhận `HH:mm` (`TIME_OF_DAY_RE` `:9`, không giây).
- `Date.UTC(..., h, min, 0, 0)` — **giây và mili = 0**.
- Trừ đúng 7 giờ; comment `:1` ICT không DST.
- Test chốt: 08:00 ICT → `2026-08-03T01:00:00.000Z` (`generate-sessions.test.ts:403-415`).

Nguồn sinh buổi (`cmc-lms/.../session-generator.ts:77-83, 121-131`): khoá map `` `${dateKey(sessionDate)}|${startTime}` `` với `startTime` là **chuỗi**; `createMany` + `skipDuplicates` trên unique `(classBatchId, sessionDate DATE, startTime TEXT)`.

### Dùng `Timestamptz(3)` làm một phần unique — có ổn không?

**DUNG — ổn cho đúng một họ writer:** mọi hàng đi qua `ictToUtc(date, 'HH:mm')`. Instant trùng bit-to-bit (`.000Z`), unique Postgres trên `timestamptz(3)` khớp.

**DUNG — có rủi ro thật nếu writer khác quy ước.** Unique so **đúng mili**. Hai hàng "cùng 18:00 thứ Hai" nhưng `sessionDate` hoặc `startTime` lệch 1 ms / lệch timezone thì **không đụng khoá**.

Chứng cứ writer lệch quy ước đã có trong chính repo:

| Writer | `sessionDate` | `startTime` |
|---|---|---|
| `planClassSessions` | ICT midnight = `YYYY-MM-DDT17:00:00.000Z` (ngày hôm trước UTC) `generate-sessions.ts:64` | ICT wall-clock → UTC `:65` |
| `seedClassSession` mặc định | `2026-08-03T00:00:00.000Z` (**UTC midnight**, không phải ICT midnight) `apps/api/src/test/db.ts:685` | `2026-08-03T11:00:00.000Z` `:686` (= 18:00 ICT **nếu** hiểu là UTC instant, nhưng `sessionDate` đã lệch) |
| `attendance/gate.test.ts:380-387` | `new Date()` (now, có mili) | `now` (có mili) |
| `lms-ops/exercise-delivery.int.test.ts:93-100` | `pastEnd` (`Date.now()-60s`) | `pastEnd - 90 phút` |

Hệ quả: buổi generate `2026-08-03 18:00 ICT` và buổi seed "cùng ngày 18:00" **không** cùng cặp unique — `sessionDate` khác (`02T17:00Z` vs `03T00:00Z`). Tra "theo ngày + giờ" nếu so `Date` thô sẽ **không thấy** hàng đã có → tạo bản đôi. Đó đúng kịch bản A1 muốn chặn, nhưng do **kiểu**, không do khoá cũ.

`room-conflict.ts:42` so `Date` bằng `<` trên instant — **không** đụng unique, không chặn rủi ro này.

Đổi `startTime` sang `String HH:mm` như nguồn: **khả thi về nghiệp vụ, không rẻ.** `startTime`/`endTime` đang là instant cho conflict phòng, cửa sổ điểm danh, `collectTeacherHours` (`auto-score.ts:154`), `session-done`, sweep. A1 **không** đề xuất đổi kiểu — đúng hướng chi phí, **sai** nếu không viết hợp đồng so khớp.

### Hợp đồng A1 còn thiếu (để thi hành không gãy)

Kế hoạch nói "tra buổi đã có theo ngày + giờ" (`phase-a1` bước 5, ràng buộc 3) nhưng **không** nói:

1. `sessionDate` so khớp phải là `ictToUtc(dateOnly, '00:00')`, không phải `new Date(dateOnly)` hay `@db.Date`.
2. `startTime` so khớp phải là `ictToUtc(dateOnly, slot.startTime)` (mili = 0), không phải `new Date()`.
3. Hoặc chuẩn hoá về cặp `(ictDateOnlyOf(sessionDate), HH:mm)` rồi so chuỗi như nguồn `:81-89`.
4. `skipDuplicates` vẫn giữ làm chốt đua — câu "thay vì dựa vào skipDuplicates" (`phase-a1:82`) dễ bị hiểu là bỏ. Bỏ mà không giữ unique thì hai `generateSessions` song song đẻ đôi.

**DUNG:** giữ `Timestamptz(3)` + unique mới + tra bằng `ictToUtc` là đủ, không cần port kiểu `String`.
**SAI:** kế hoạch đã đủ để implementer không lệch mili/timezone.
**KHONG KIEM DUOC:** driver Prisma/pg có bao giờ làm tròn `timestamptz(3)` khác `.000` trên đường `createMany` hay không — test `:414` chứng minh đường create thường ra `.000Z`.

---

## 3. Thêm `ScheduleSlot.archivedAt` — truy vấn nào phải lọc?

**DUNG:** cột chưa có ở đích (`schema.prisma:706-723`). Nguồn có `archivedAt` `:347` và generator **đã** lọc `archivedAt: null` (`session-generator.ts:50-51`).

### Mọi truy vấn / ghi `ScheduleSlot` ở `cmc_edu`

| `file:dòng` | Hành vi | Sau `archivedAt` |
|---|---|---|
| `apps/api/src/class/schedule-router.ts:38-40, 61` | `classBatch.findFirst({ include: { scheduleSlots: true } })` rồi `planClassSessions(..., classBatch.scheduleSlots)` | **Phải lọc** `archivedAt: null`. Không lọc thì khung đã gỡ vẫn đẻ buổi |
| `apps/api/src/class/class-batch-router.ts:210-221` | `scheduleSlot.create` lúc lập lớp | Không đọc — không lọc. Nên set `archivedAt: null` mặc định |
| `apps/api/src/lms-ops/router.ts:174-185` | `scheduleSlot.create` lúc `createClassWithUnits` | Như trên |
| `apps/e2e/src/db.ts:1129-1137` | Seed tạo 1 khung | Như trên |
| `apps/api/src/test/db.ts:183` | `scheduleSlot.deleteMany` khi teardown facility | **Giữ DELETE.** Đây là dọn test, không phải đường vận hành. A1 "cấm DELETE khung" phải loại trừ teardown |
| `apps/e2e/src/db.ts:388` | Cùng `deleteMany` teardown | Giữ DELETE |

`classBatch.get` (`class-batch-router.ts:334-345`) và `list` **không** `include` slots. `ClassBatchDto` (`:70-79`) không có mảng khung. UI tạo lớp (`apps/admin/src/pages/classes/index.tsx:101-123, 355-358`) chỉ sửa **state form** trước khi create — `removeSlot` không đụng DB (đúng adjudication).

**DUNG:** hôm nay **không** có `scheduleSlot.delete` vận hành — chỉ `deleteMany` test. Thêm `archivedAt` + API gỡ là **viết đường mới**, không phải thay `delete` đang chạy.

**SAI:** "mọi truy vấn ScheduleSlot đều phải thêm `archivedAt: null`". Teardown và buổi lịch sử trỏ khung đã lưu trữ **không** lọc (buổi cũ phải còn FK — ràng buộc A1).

**Thiếu để thi hành bước 4 (sửa/gỡ khung):** chưa có API đọc danh sách khung của một lớp. `get` không trả slots. A1 bắt "thêm thủ tục sửa và gỡ" nhưng không nêu `listSlots`. Không có list thì UI/admin không sửa được. Nguồn có cả partial unique + `archivedAt: null` trên mọi đường đọc khung sống.

---

## 4. Thêm `ClassSession.teacherId` — payroll / KPI / chấm công có vỡ không?

**DUNG:** `ClassSession` đích **không** có `teacherId` (`schema.prisma:731-771`). Lớp có `teacherId` scalar `:661` và `teacherAppUserId` FK `:669`. Nguồn có `ClassSession.teacherId` `:373-374` và generator gán `teacherId: c.teacherId ?? null` (`session-generator.ts:127`).

### Hệ thống đang đọc giáo viên **của lớp**, không của buổi

| Hệ | `file:dòng` | Đọc gì | A1 thêm cột buổi thì sao |
|---|---|---|---|
| KPI giờ dạy | `apps/api/src/kpi/auto-score.ts:141-147` `collectTeacherHours` | `classBatch: { teacherAppUserId: appUserId }` trên buổi `done` | **Không tự đổi.** Buổi dạy thay vẫn cộng cho GV **lớp** |
| KPI nộp phiếu (quét buổi trễ) | `apps/api/src/kpi/router.ts:178-183` | Cùng `classBatch.teacherAppUserId` | Như trên |
| Comment chính thức | `class-batch-router.ts:118-119`, `assign-teacher.test.ts:73` | "`teacherAppUserId` credits teaching hours into payroll and KPI" | Payroll **không** đọc `ClassSession` — xem dưới |
| Cổng GV được phép điểm danh / nhận xét / nhật ký | `apps/api/src/attendance/assert-teacher-owns-class.ts:4-5, 49-57` | `ClassBatch.teacherAppUserId` | GV dạy thay **bị FORBIDDEN** trên buổi của mình |
| Calendar / session get | `class-session-router.ts:162, 176, 263, 283` | `teacherId: row.classBatch.teacherId` | UI vẫn hiện GV lớp dù cột buổi đã khác |
| Chấm công (punch) | `apps/api/src/checkin/`, `apps/api/src/shift/` | Ca + punch nhân sự, không đọc `ClassBatch.teacherId` | **Không đụng** |
| Payroll (phiếu lương) | `apps/api/src/payroll/router.ts` | **Không** có `classSession` / `teacherAppUserId` / `collectTeacherHours` | **Không đụng** trong A1. Giờ dạy nằm ở KPI |

Nguồn: quyền GV là **OR** khung active `teacherId` **hoặc** buổi `teacherId` (`cmc-lms/.../teaching-authz.ts:85-91`) — đúng E-3 (lớp migrate không khung thì vẫn mở được nhật ký qua `ClassSession.teacherId`).

### A1 có làm lệch chấm công / KPI không?

**DUNG** với câu A1 đã viết: *"Phase này chỉ ghi dữ liệu; không đổi cách tính lương. Nếu chấm công đang đọc giáo viên của lớp thì giữ nguyên"* (`phase-a1:104`).

- Thêm cột + backfill từ lớp: **không** đổi số KPI/payroll hôm nay.
- Đường "đổi GV một buổi" (`phase-a1` bước 6) **ghi** dữ liệu mà KPI/`assertTeacherOwnsClass` **không đọc** → GV thay không mở được điểm danh/nhật ký; giờ dạy vẫn về GV lớp. Đó không phải hỏng số, nhưng tính năng "dạy thay" **chưa dùng được** cho tới khi có quyết định riêng (đúng kế hoạch).

**SAI** nếu implementer "tiện tay" đổi `collectTeacherHours` / `assertTeacherOwnsClass` sang `ClassSession.teacherId` trong cùng PR A1 — đó là đổi hợp đồng lương/cổng, ngoài scope đã chốt.

**KHONG KIEM DUOC:** có phiếu lương/KPI thật trên môi trường triển khai hay không. Repo: payroll không đọc buổi.

Backfill "lớp chưa có GV thì để trống và báo" (`phase-a1:103`): **DUNG** khớp E-6. `ClassBatch.teacherId` nullable `:661`. Buổi mới sinh từ `createMany` hôm nay **không** ghi GV (`schedule-router.ts:72-79`) — A1 phải thêm field, nếu không cột mới sẽ null hàng loạt (đúng hình E-3).

---

## 5. Ước lượng số file A1 phải sửa

Đếm theo việc A1 **bắt buộc** làm (khoá, `archivedAt`, API sửa/gỡ khung, tra ngày+giờ, cột GV buổi + backfill + đường đổi GV + quyền + vết + test). Không đếm file chỉ đọc.

| Nhóm | File | Ghi chú |
|---|---|---|
| Schema + migration | 2 | `schema.prisma`; migration **mới** (cổng trùng + drop/create unique + `archivedAt` + `ClassSession.teacherId` + backfill) |
| Sinh / persist buổi | 4 | `generate-sessions.ts`, `schedule-router.ts`, `class-batch-router.ts`, `lms-ops/router.ts` |
| Đọc buổi / đổi GV buổi | 1 | `class-session-router.ts` (DTO `get`/`listInRange` đang lấy GV lớp `:176, :283`; thêm mutation) |
| Quyền | 2 | `packages/auth/src/index.ts` (hiện chỉ `schedule.generate` `:122`); `index.test.ts:145` |
| Seed test/e2e | 2 | `apps/api/src/test/db.ts`, `apps/e2e/src/db.ts` (ghi `teacherId` buổi; `seedClassSession` nên chuẩn hoá `sessionDate` ICT) |
| Test API hiện có | 3 | `generate-sessions.test.ts`; `class-session-get.test.ts`; `list-in-range.test.ts` |
| Test API mới | 2 | file test gỡ/sửa khung; file test đổi GV buổi (chưa có) |
| UI | 3–4 | `class-detail.tsx` (+ test) — hôm nay không sửa khung (`class-detail.tsx:367` chỉ câu "sinh tự động"); `session-detail.tsx` không có `teacherId`; có thể `schedule.tsx` nếu calendar hiện GV buổi |
| Manifest nghiệm thu | 0–1 | `scripts/acceptance-report/flow-manifest.ts:311-329` nếu claim procedure mới |

**Ước lượng: 19–22 file** nếu làm đủ API+UI+test như phase viết. **13–15 file** nếu A1 chỉ schema + generator + API, để UI sang PR sau (phase **không** tách UI).

Không cần sửa (nếu giữ quyết định "chưa đổi cách tính"): `kpi/auto-score.ts`, `kpi/router.ts`, `assert-teacher-owns-class.ts`, `payroll/router.ts`, `checkin/*`, `shift/*`. `trpc.ts` `AUDIT_EXCLUDED_PATHS` (`:98-139`) — mutation mới **không** thêm vào list thì middleware tự ghi vết (đủ "ghi vết" của A1).

---

## Kế hoạch A1 có thi hành được / có đủ không?

| Hạng mục phase | Khả thi? | Đủ chưa? |
|---|---|---|
| 1. Cổng đếm trùng `(lớp, ngày, giờ)` trước unique | **DUNG** | Đủ ý; phải định nghĩa "giờ" = instant `ictToUtc` |
| 2. Đổi unique | **DUNG** | Đủ. Không có `upsert`/`findUnique` compound |
| 3. `archivedAt`, cấm DELETE vận hành | **DUNG** | Thiếu: teardown test vẫn xoá; thiếu list khung; thiếu partial unique khung sống |
| 4. API sửa/gỡ khung, chưa huỷ buổi | **DUNG** | Thiếu tên quyền (chỉ có `schedule.generate`). A2 đã bị red-team bắt đúng lỗi này; A1 lặp "có quyền, có ghi vết" (`phase-a1:80`) không chỉ khoá |
| 5. Tra ngày+giờ, không dựa `skipDuplicates` | **DUNG có điều kiện** | **Không đủ** — xem mục 2. Sót `lms-ops/router.ts:194` |
| 6. `teacherId` buổi + backfill + đổi một buổi | **DUNG** | Đủ nếu thật sự không đụng KPI/cổng GV. Thiếu: `createMany` hôm nay không ghi GV — phải liệt kê 3 caller |

Tách A1 khỏi A3 (không huỷ/hồi trong A1): **DUNG**, khớp xương sống hiện tại (`schedule-router.ts` chỉ generate; `cancel` nằm `class-session-router.ts:292` + `cancel-session.ts`).

---

## Việc A1 phải bổ sung trước khi viết migration (không phải đập kế hoạch)

1. Viết một hàm thuần "khoá lịch buổi" = `(classBatchId, ictToUtc(date,'00:00'), ictToUtc(date, HH:mm))` và **mọi** tra/tạo đi qua nó.
2. Kể `lms-ops/router.ts` là caller thứ ba của `skipDuplicates`.
3. Thêm (hoặc từ chối có lý do) partial unique khung sống `(classBatchId, weekday, startTime) WHERE archivedAt IS NULL` — nguồn đã cần vì đúng khoá mới.
4. API `listSlots` (lọc `archivedAt: null`) trước API gỡ.
5. Chốt khoá quyền cho sửa/gỡ khung và đổi GV buổi (không tái sử dụng `class.read`).
6. Giữ `skipDuplicates` (hoặc bắt `P2002`) làm chốt đua; unique mới là lưới cuối.

---

Status: DONE_WITH_CONCERNS
Summary: Đổi khoá A1 khả thi — không có `upsert`/`findUnique` theo khoá cũ, chỉ 3 `createMany skipDuplicates` (`class-batch-router.ts:244`, `schedule-router.ts:80`, `lms-ops/router.ts:203`). Điểm nghẽn là `ClassSession.startTime` đích là `Timestamptz(3)` (`schema.prisma:740`) chứ không phải `String HH:mm` như nguồn; kế hoạch chưa viết hợp đồng `ictToUtc` nên bước "tra ngày+giờ" chưa đủ để thi hành an toàn.
