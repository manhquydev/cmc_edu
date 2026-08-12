# BR1 — Đặc tả nghiệp vụ: Lớp + Lịch tuần + Buổi + Tiến trình Unit

Nguồn: `/home/manhquy/Downloads/cmc-lms` (chỉ đọc).  
Đối tượng: implement lại được **không cần mở code**.  
Nhãn: `CHUẨN` | `TẠM` | `THIẾU` | `SEAM` (theo BRIEF2).

---

## 0. Hằng số & múi giờ (áp dụng toàn nhóm)

| Hằng / quy ước | Giá trị | Ý nghĩa | Bằng chứng |
|---|---|---|---|
| TZ nghiệp vụ ngày | `Asia/Ho_Chi_Minh` (ICT, UTC+7) | “Hôm nay”, năm mã lớp, horizon sinh buổi, cron | `apps/api/src/services/ict-date.ts:3-8,36-47`; `cron.ts:95-102` |
| Biểu diễn `@db.Date` | UTC-midnight `YYYY-MM-DDT00:00:00Z` | So sánh ngày = so `getTime()` của UTC-midnight | `ict-date.ts:40-43`; create session `session-generator.ts:124` |
| `ictTodayUtc()` | Ngày ICT hiện tại → UTC-midnight | Đồng hồ nghiệp vụ duy nhất (test pin được qua `__setTestClock`) | `ict-date.ts:10-15,41-43` |
| `endOfNextMonthIso()` | Ngày cuối **tháng sau** ICT | Horizon sinh buổi cuốn chiếu | `ict-date.ts:55-61` |
| `SESSIONS_PER_UNIT` | `4` | Số buổi hợp lệ / 1 unit | `packages/domain/src/unit-progression.ts:15` |
| Format mã lớp | `CMC-YY-NNNN` | YY = năm ICT % 100, NNNN = seq 4 số | `code-counter.ts:12-14` |
| Lock cấp mã lớp | advisory `(41001, year)` | Chống race counter | `code-counter.ts:8,22` |
| MAX_ATTEMPTS cấp mã | `1000` | Retry nếu mã đã tồn tại (migrate) | `code-counter.ts:10,23` |
| Day-of-week | `0=CN … 6=T7` (JS `getUTCDay`) | Slot + match buổi | `schema.prisma:337`; filter `class-batch.ts:920` |
| Giờ slot | `HH:mm` string ICT wall-clock, so sánh lexicographic | `startTime < endTime` | `class-batch.ts:19-23` |
| Unique buổi | `(classBatchId, sessionDate, startTime)` | Chống trùng | `schema.prisma:388` |
| Partial unique slot active | `(class_batch_id, day_of_week, start_time) WHERE archived_at IS NULL` | 1 khung live / (thứ, giờ bắt đầu) | migration SQL + comment `schema.prisma:350-354` |

---

## 1. Tạo lớp & vòng đời trạng thái — `CHUẨN`

### 1.1 Thực thể `ClassBatch`

| Field | Kiểu / default | Vai trò |
|---|---|---|
| `code` | unique string | Mã hiển thị, không sửa |
| `courseId` | FK Course | Chương trình |
| `startUnitId` | FK CurriculumUnit | Unit bắt đầu lúc tạo (lịch sử) |
| `currentUnitId` | FK CurriculumUnit | **Neo unit** (đếm buổi từ đây) |
| `currentUnitAnchor` | `@db.Date` | **Ngày neo** bắt đầu đếm buổi non-cancelled |
| `startDate` | `@db.Date` | Ngày khai giảng |
| `status` | `ClassStatus` default `running` | Vận hành: chủ yếu `running` / `closed` |
| `archivedAt` | DateTime? | Soft-delete (“hủy lớp tạo nhầm”) — **độc lập** status |
| `note` | string? | Ghi chú |

Nguồn: `packages/db/prisma/schema.prisma:286-310`.

Enum `ClassStatus`: `planned|open|running|closed|cancelled` — comment schema: hệ mới dùng **running/closed**; planned/open/cancelled **giữ migrate** (`schema.prisma:47-55`) → nhãn migrate: `TẠM` (không dùng làm state machine v1).

### 1.2 Tạo lớp — `classBatch.create` — `CHUẨN`

| Luật | Điều kiện kích hoạt | Hành vi | Chặn / lỗi | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Quyền | caller ADMIN | `adminProcedure` | — | CHUẨN | `class-batch.ts:129` |
| Input bắt buộc | create | `program` (enum Program), `startUnitId` UUID, `startDate` string date (cho phép quá khứ), `slots` mảng ≥1 | Zod fail | CHUẨN | `class-batch.ts:129-137` |
| Input optional | create | `note` trim max 2000 | — | CHUẨN | `class-batch.ts:135` |
| Slot shape | mỗi slot | `dayOfWeek` 0–6, `startTime`/`endTime` `^\d{2}:\d{2}$`, `startTime < endTime`, `teacherId` UUID? | Zod message giờ | CHUẨN | `class-batch.ts:16-23` |
| Slot list no-dup | trong 1 request | Không 2 dòng cùng `(dayOfWeek, startTime)` | Zod custom “Trùng khung…” | CHUẨN | `class-batch.ts:32-48` |
| Unit ∈ program | create | `CurriculumUnit` có id + `course.program = input.program` | BAD_REQUEST “Unit không thuộc chương trình…” | CHUẨN | `class-batch.ts:102-112,140` |
| GV active | nếu có teacherId | mọi teacherId `AppUser.isActive=true` | BAD_REQUEST “Có giáo viên không tồn tại hoặc đã khóa” | CHUẨN | `class-batch.ts:115-121,141` |
| Cảnh báo GV trùng | sau assert | `slotConflictWarnings` — so slot request vs slot active lớp **running** khác, cùng GV, chồng (thứ + khoảng giờ) | **Không chặn** — trả `warnings[]` | CHUẨN | `class-batch.ts:50-99,142` |
| Sinh mã | trong tx | `year = currentSaigonYear()` (năm ICT); `allocateBatchCode(tx, year)` → `CMC-YY-NNNN` | Error nếu 1000 lần vẫn trùng | CHUẨN | `class-batch.ts:145`; `code-counter.ts:12-33`; `ict-date.ts:45-47` |
| Ghi ClassBatch | trong tx | `status='running'`; `courseId=unit.courseId`; `startUnitId=currentUnitId=unit.id`; `currentUnitAnchor=startDate` UTC-midnight; `startDate` cùng; slots create với `effectiveFrom=startDate` | — | CHUẨN | `class-batch.ts:146-167` |
| Log | trong tx | RecordEvent type `created` | — | CHUẨN | `class-batch.ts:170-176` |
| Sinh buổi ngay | **ngoài** tx | `ensureSessionsUntil(batch.id, endOfNextMonthIso())` | Lỗi sinh **không** rollback lớp; trả `generateError` string | CHUẨN | `class-batch.ts:180-189` |

### 1.3 Sửa thông tin lớp — `classBatch.update` — `CHUẨN`

| Luật | Điều kiện | Hành vi | Chặn | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Lớp visible | `archivedAt == null` | cho phép | NOT_FOUND nếu discard | CHUẨN | `class-batch.ts:273-275` |
| Sửa note | mọi lúc (lớp chưa discard) | set note | — | CHUẨN | `class-batch.ts:301` |
| Đổi startDate / startUnitId | chỉ khi **chưa có buổi** (`sessionCount==0`, archivedAt null) **và** `status==running` | set startDate, startUnit, **currentUnit**, **currentUnitAnchor=startDate**; cascade `scheduleSlot.effectiveFrom` active → startDate mới; rồi `ensureSessionsUntil` | BAD_REQUEST nếu đã có buổi hoặc không running | CHUẨN | `class-batch.ts:276-327` |

### 1.4 Máy trạng thái lớp (v1 vận hành) — `CHUẨN`

Hai trục độc lập: **`status`** và **`archivedAt`**.

```
create ──► status=running, archivedAt=null
              │
    close(force) ──► status=closed  (hủy buổi tương lai reason=class_closed)
              │
    reopen ──► status=running     (chỉ hồi sinh buổi class_closed)
              │
    discard ──► archivedAt=now()  (status KHÔNG đổi; chỉ khi 0 attendance)
              │
    undiscard ──► archivedAt=null
```

| Luật | Điều kiện kích hoạt | Hành vi | Chặn / lỗi | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Đóng preflight | `close` không `force` | `closed:false` + list HS còn `remainingUnits>0` tại unit hiệu lực | — | CHUẨN | `class-batch.ts:721-727` |
| Đóng force | `force=true` + `seenStudentIds` **khớp exact** set id HS remaining hiện tại (sort join) | `status=closed`; hủy session `sessionDate>=today` status ∈ {planned,confirmed} → cancelled + `class_closed`; revoke bài; log | CONFLICT nếu danh sách đổi; NOT_FOUND nếu archived; BAD_REQUEST nếu đã closed | CHUẨN | `class-batch.ts:729-766` |
| Mở lại | `status==closed` và không archived | `status=running`; updateMany future cancelled **chỉ** `cancelReason=class_closed` → planned, reason null; `ensureSessionsUntil` | BAD_REQUEST nếu không closed; NOT_FOUND archived | CHUẨN | `class-batch.ts:771-811` |
| Xóa mềm | bất kỳ status, chưa archived | nếu `attendance.count(session.classBatchId)==0` (trong tx): set `archivedAt=now()` | BAD_REQUEST nếu đã điểm danh ≥1; NOT_FOUND nếu đã discard | CHUẨN | `class-batch.ts:820-853` |
| Khôi phục discard | `archivedAt != null` | `archivedAt=null` | NOT_FOUND nếu chưa discard | CHUẨN | `class-batch.ts:332-354` |
| Ẩn khỏi list/detail/cron | `archivedAt != null` | list default `archivedAt:null`; detail where archived null; cron where archived null | — | CHUẨN | `class-batch.ts:197-199,360`; `cron.ts:24` |
| ensureSessions chặn | `status != 'running'` | return created=0, không sinh | — | CHUẨN | `session-generator.ts:47-48` |
| restamp chặn | `status != 'running'` | return 0 | — | CHUẨN | `session-generator.ts:186` |

**Không có** transition API sang `planned`/`open`/`cancelled` trong router v1 → dùng enum migrate: `TẠM`.

---

## 2. Khung lịch tuần (ScheduleSlot) — `CHUẨN`

### 2.1 Model

| Field | Ý nghĩa | Bằng chứng |
|---|---|---|
| `dayOfWeek` | 0=CN..6=T7 | `schema.prisma:337` |
| `startTime` / `endTime` | HH:mm ICT | `schema.prisma:338-339` |
| `teacherId` | optional AppUser | `schema.prisma:340-341` |
| `effectiveFrom` | `@db.Date` — sinh buổi **chỉ từ ngày này** | `schema.prisma:342-347` |
| `archivedAt` | soft-delete khung | `schema.prisma:348` |

### 2.2 effectiveFrom — quy tắc gán — `CHUẨN`

| Sự kiện | effectiveFrom | Hệ quả | Bằng chứng |
|---|---|---|---|
| Tạo lớp | = `startDate` (kể cả quá khứ) | Sinh được buổi lịch sử (nhập bù) | `class-batch.ts:162-164` |
| Thêm slot / dời lịch (slot mới) | = `ictTodayUtc()` | **Không** đẻ buổi quá khứ ma | `class-batch.ts:900-902,1178` |
| Đổi startDate lớp trống | cascade mọi slot active → startDate mới | Cửa sổ sinh theo mốc mới | `class-batch.ts:312-315` |

Cửa sổ sinh từng slot trong generator:

```
slotFrom = max(dateKey(slot.effectiveFrom), dateKey(batch.startDate))
if slotFrom > untilIso → bỏ slot
candidates = enumerateSessions([slot], slotFrom, untilIso)
```

`session-generator.ts:63-69`.

### 2.3 Thao tác slot

| Luật | API | Điều kiện | Hành vi | Chặn | Nhãn | Bằng chứng |
|---|---|---|---|---|---|---|
| Thêm khung | `addSlot` | batch running, không archived | create slot; cascade teacherId lên buổi future non-cancelled cùng startTime + same UTC dayOfWeek; `ensureSessionsUntil` | NOT_FOUND archived; BAD_REQUEST không running; CONFLICT trùng (thứ,start) live; P2002 → CONFLICT | CHUẨN | `class-batch.ts:856-947` |
| Xóa khung | `removeSlot` | slot chưa archived | `archivedAt=now`; hủy buổi future `status=planned`, **attendances none**, same startTime+DOW → `cancelled`/`slot_removed`; revoke bài; restamp | Idempotent nếu đã archived | CHUẨN | `class-batch.ts:950-995` |
| Đổi GV only | `editSlotTeacher` | — | update slot.teacherId; nếu `applyToFuture` (default true): cascade buổi future non-cancelled, **attendances none**, same DOW+start | GV must active nếu set; warnings D4 không chặn | CHUẨN | `class-batch.ts:1000-1055` |
| Sửa tại chỗ (end/GV) | `editSlot` khi **không** đổi dayOfWeek/startTime | batch running | update endTime+teacher; cascade future non-cancelled attendances none | — | CHUẨN | `class-batch.ts:1095-1123` |
| Dời lịch (đổi thứ hoặc giờ bắt đầu) | `editSlot` rescheduled | batch running | **1 tx**: archive slot cũ + hủy planned future no-attendance reason slot_removed + revoke + create slot mới effectiveFrom=today + cascade teacher + restamp nếu cancelled>0; ngoài tx ensureSessions | CONFLICT nếu (thứ,start) trùng slot khác | CHUẨN | `class-batch.ts:1095-1215` |
| Trùng lịch GV | mọi create/add/edit | — | `slotConflictWarnings` / D4 | **Chỉ cảnh báo**, vẫn lưu | CHUẨN | `class-batch.ts:50-99`; detect `session-schedule.ts:71-72` |
| Match DOW buổi | cascade/hủy | `sessionDate.getUTCDay() === slot.dayOfWeek` | vì Date UTC-midnight = calendar date | — | CHUẨN | `class-batch.ts:920,977` |

**Buổi đã điểm danh** khi xóa/dời khung: **không hủy, không đổi GV/endTime** (filter `attendances:{none:{}}`) — `class-batch.ts:964-974,1033-1038,1145-1156`.

---

## 3. Sinh buổi — `ensureSessionsUntil` — `CHUẨN`

### 3.1 Thuật toán chính xác

**Input:** `batchId`, `untilIso` = `YYYY-MM-DD` (thường `endOfNextMonthIso()`).

```
1. Load batch: status, courseId, startDate, currentUnitAnchor, currentUnit.orderGlobal
2. Nếu status ≠ 'running' → {created:0, revived:0, skippedExisting:0, hitCeiling:false}
3. Load slots active (archivedAt null). Nếu rỗng → zero result
4. maxOrder = max(orderGlobal) của CurriculumUnit WHERE courseId = batch.courseId
5. baseIso = dateKey(startDate)
6. candidates = []
   FOR each slot:
     from = dateKey(slot.effectiveFrom)
     slotFrom = max(from, baseIso)
     IF slotFrom > untilIso CONTINUE
     candidates += enumerateSessions([slot], slotFrom, untilIso)
       // mỗi ngày d trong [slotFrom..untilIso] inclusive, UTC step +1 day
       // nếu d.getUTCDay()==slot.dayOfWeek → {sessionDate, startTime, endTime, teacherId}
7. Sort candidates: sessionDate ASC, startTime ASC
8. Load ALL ClassSession của lớp (mọi status)
9. existingByKey = map key `${dateKey(sessionDate)}|${startTime}`
10. Partition:
    FOR c in candidates:
      dup = existingByKey[c.date|c.start]
      IF dup:
        IF dup.status=='cancelled' AND dup.cancelReason=='slot_removed' → toRevive.push(dup.id)
        ELSE skip (counted skippedExisting via formula)
      ELSE freshCandidates.push(c)
11. Capacity (trần sức chứa buổi từ neo):
    anchorIso = dateKey(currentUnitAnchor)
    baseCount = count existing WHERE status≠cancelled AND dateKey(sessionDate)≥anchorIso
    capacity = (maxOrder - currentUnit.orderGlobal + 1) * 4
    allowedFresh = max(0, capacity - baseCount)
    hitCeiling = freshCandidates.length > allowedFresh
    fresh = hitCeiling ? freshCandidates[0..allowedFresh) : freshCandidates
12. IF toRevive∪fresh non-empty → TRANSACTION:
    - updateMany toRevive → status=planned, cancelReason=null
    - createMany fresh: classBatchId, sessionDate=UTC-midnight, times, teacherId, curriculumUnitId=null, status=planned, skipDuplicates
    - restampBatchUnits(tx, batchId, undefined)   // force=false
13. Return { created: fresh.length, revived: toRevive.length,
            skippedExisting: candidates.length - fresh.length, hitCeiling }
```

Nguồn: `session-generator.ts:32-144`; `enumerateSessions` `session-schedule.ts:36-61`.

### 3.2 Quy tắc sinh — bảng

| Luật | Điều kiện | Hành vi | Chặn | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Chỉ lớp running | status≠running | no-op | — | CHUẨN | `session-generator.ts:47-48` |
| Idempotent | key (date,start) đã có non-slot_removed-cancel | không tạo trùng | unique DB + skip | CHUẨN | `session-generator.ts:88-95,121-131` |
| Revive slot_removed | cancelled + reason slot_removed + khung lại có | planned, reason null; rồi restamp | — | CHUẨN | `session-generator.ts:91,114-118` |
| Không revive manual/ceiling/class_closed | cùng key tồn tại cancelled khác reason | không tạo session mới (key bị chiếm) | — | CHUẨN | `session-generator.ts:90-92` |
| Trần capacity | fresh vượt (units còn × 4 − baseCount) | chỉ lấy prefix; hitCeiling=true | không sinh vượt; **không** hủy ở bước này | CHUẨN | `session-generator.ts:97-107` |
| Unit lúc sinh | sau create | restamp gắn unit (null → id) | throw nếu khung thiếu order | CHUẨN | `session-generator.ts:134,241-243` |
| Nguyên tử | create + restamp | 1 transaction | tránh buổi null-unit nếu restamp fail | CHUẨN | `session-generator.ts:109-136` |

**Gọi khi nào (ngoài cron):** sau create, update structure, setCurrentUnit (catch), reopen, addSlot, editSlot reschedule — horizon luôn `endOfNextMonthIso()`.

---

## 4. Neo unit & restamp — `CHUẨN`

### 4.1 Công thức gắn unit (`deriveSessionUnits`) — `CHUẨN`

**Đầu vào:**

- `anchorOrderGlobal` = `batch.currentUnit.orderGlobal`
- `maxOrderGlobal` = max order trong **cùng course**
- `sessions` = các buổi **non-cancelled**, `sessionDate >= currentUnitAnchor` (restamp load)

**Thuật toán thuần:**

```
sorted = sessions sort by (sessionDate ASC, startTime ASC)
FOR k = 0..n-1:
  raw = anchorOrderGlobal + floor(k / 4)
  IF raw > maxOrderGlobal:
    stamp = { id, order: maxOrderGlobal, capped: true }
  ELSE:
    stamp = { id, order: raw, capped: false }
```

`packages/domain/src/unit-progression.ts:36-51`.

**Map order → unitId:** `CurriculumUnit` where courseId; throw nếu thiếu order (lỗ khung).

### 4.2 `restampBatchUnits` — khi ghi, đóng băng — `CHUẨN`

| Luật | Chi tiết | Bằng chứng |
|---|---|---|
| Chỉ running | else return 0 | `session-generator.ts:186` |
| Tập đếm | non-cancelled, sessionDate ≥ anchor | `session-generator.ts:198-211` |
| Đóng băng (force=false) **không ghi** nếu | (a) `attendances.count > 0` **HOẶC** (b) `sessionDate < today` **VÀ** đã có `curriculumUnitId` | `session-generator.ts:223-227` |
| Buổi quá khứ chưa stamp | vẫn gắn unit (nhập bù) | comment `session-generator.ts:220-221` |
| Buổi tương lai capped | **hủy** status cancelled, reason `ceiling`; thu hồi bài; **không** stamp max | `session-generator.ts:227-235` |
| Buổi quá khứ capped | stamp tại maxOrder, **không** hủy | `session-generator.ts:237-239` |
| force=true | bỏ đóng băng — ghi cả buổi đã điểm danh / quá khứ | `session-generator.ts:164-165,222-227` |
| Buổi đóng băng vẫn **đếm index k** | lùi đúng cho buổi sau | comment `session-generator.ts:159-160` |

**Khi restamp chạy (force=false trừ ghi chú):**

| Trigger | force | Bằng chứng |
|---|---|---|
| Cuối `ensureSessionsUntil` | false | `session-generator.ts:134` |
| `cancelSession` | false | `class-batch.ts:1248` |
| `removeSlot` / dời `editSlot` sau hủy | false | `class-batch.ts:985,1198` |
| `setCurrentUnit` sau đổi neo | false | `class-batch.ts:475` |
| `realignHistory` confirm | **true** | `class-batch.ts:645-650` |
| Ceiling cancel trong restamp | revoke batch | `session-generator.ts:253-255` |

### 4.3 Unit hiện tại của lớp (đọc UI/API) — `CHUẨN`

**Không** chỉ đọc `currentUnitId`. Derive:

1. Buổi non-cancelled, curriculumUnitId not null, `sessionDate >= today` — earliest → order đó  
2. Else buổi non-cancelled last → order  
3. Else neo `batch.currentUnit.orderGlobal`

`batch-unit.ts:35-62`.  
`atCurriculumCeiling` = order ≥ maxOrder course (`batch-unit.ts:108-109`).

### 4.4 `setCurrentUnit` vs `realignHistory` — `CHUẨN`

| | `setCurrentUnit` | `realignHistory` |
|---|---|---|
| Mục đích | Vận hành: chỉnh unit hiện tại | Migrate: sửa lệch stamp lịch sử |
| Input | batchId, unitId, confirm? | batchId, refSessionId, unitId, buoi 1–4, reason ≥1 char, confirm? |
| Neo mới | `(unit chọn, **hôm nay** ICT)` | `(firstUnitOrder suy từ mốc, **ngày buổi đầu** dãy non-cancelled)` |
| restamp force | false — quá khứ/đã điểm danh **đóng băng** | **true** — relabel cả quá khứ đã điểm danh |
| Chặn mid-unit | N/A | `resolveReferenceAnchor` reject `mid_unit_start` nếu phase buổi đầu ≠ 0 |
| Preflight | nếu lùi unit: list HS range “chưa tới” cần confirm | luôn preview diff unit; confirm mới ghi |
| Sau | ensureSessions catch (lấp nếu lùi dưới trần) | không ensure bắt buộc trong code path confirm |
| Lớp | running, không archived | running, không archived |
| Bằng chứng | `class-batch.ts:412-492` | `class-batch.ts:500-677`; domain `unit-progression.ts:122-152`; preview `realign-preview.ts` |

**Công thức `resolveReferenceAnchor`:**

```
sorted = non-cancelled sessions ASC
i = index of refSessionId
phaseFirst = ((buoi-1) - i) mod 4
IF phaseFirst ≠ 0 → mid_unit_start FAIL
firstUnitOrder = unitOrder + floor((0 - i + (buoi-1)) / 4)
IF firstUnitOrder outside [courseMin, courseMax] → out_of_bounds
anchorDate = sorted[0].sessionDate
```

`unit-progression.ts:122-152`.

---

## 5. Hủy buổi — `CHUẨN`

### 5.1 `SessionCancelReason` và hồi sinh

| Reason | Ai set | Tự hồi sinh? | Khi nào | Bằng chứng |
|---|---|---|---|---|
| `manual` | `cancelSession` admin | **Không bao giờ** | — | schema comment `schema.prisma:64`; cancel `class-batch.ts:1240` |
| `slot_removed` | removeSlot / editSlot dời | **Có** | ensureSessions thấy khung cùng (date,start) trở lại | `session-generator.ts:91` |
| `class_closed` | close | **Có** | reopen — chỉ reason này, future | `class-batch.ts:753,789-799` |
| `ceiling` | restamp future capped | **Không** tự | — | `session-generator.ts:230-232` |

### 5.2 `cancelSession` (1 buổi) — `CHUẨN`

| Luật | Điều kiện | Hành vi | Chặn | Bằng chứng |
|---|---|---|---|---|
| Quyền | ADMIN only | — | GV không có API này | `class-batch.ts:1218` |
| Idempotent | đã cancelled | return cancelled:true | — | `class-batch.ts:1232` |
| Chặn điểm danh | `_count.attendances > 0` | — | BAD_REQUEST “Buổi đã có điểm danh — không hủy được” | `class-batch.ts:1233-1236` |
| Hủy | tx | status=cancelled, reason=manual | — | `class-batch.ts:1238-1241` |
| Bài đã phát | revokeDeliveryOnCancel | nếu 0 submission: **xóa** SessionExercise (vị trí trả dãy); nếu có submission: **giữ** + log note | — | `exercise-delivery.ts:223-251`; call `class-batch.ts:1245` |
| Unit | restampBatchUnits | buổi sau lùi index → unit lùi | — | `class-batch.ts:1248` |

### 5.3 Hủy hàng loạt (slot/close/ceiling)

| Nguồn | Filter buổi | Reason | Revoke bài | Restamp | Bằng chứng |
|---|---|---|---|---|---|
| removeSlot | future, planned, no attendance, DOW+start | slot_removed | yes batch | yes | `class-batch.ts:967-985` |
| editSlot dời | như remove | slot_removed | yes | yes nếu cancelled>0 | `class-batch.ts:1150-1198` |
| close | future, planned\|confirmed | class_closed | yes | **không** restamp trong close | `class-batch.ts:744-756` |
| restamp ceiling | future capped stamp | ceiling | yes | trong restamp | `session-generator.ts:227-255` |

**Ảnh hưởng unit:** mỗi buổi non-cancelled bị bỏ khỏi dãy → `k` giảm cho buổi sau → `floor(k/4)` có thể giảm unit (cơ chế “lùi”).  
**Ảnh hưởng bài:** cancelled **không** được cron phát (`status not cancelled`); bài đã phát chưa nộp bị thu hồi → gap-aware phát lại vị trí đó (`exercise-delivery.ts:8-9,63-66`).

**Không có buổi bù** — chỉ planned/confirmed/cancelled. `THIẾU` nếu ERP cần makeup entity riêng; LMS mới chủ ý không có (`CHUẨN` = không có).

---

## 6. Đóng / mở / xóa mềm — tóm tắt bảng — `CHUẨN`

| Hành động | API | status | archivedAt | Buổi | Cron/materialize |
|---|---|---|---|---|---|
| Đóng | `close` force | → closed | giữ null | future planned+confirmed → cancelled class_closed + revoke | không sinh (status≠running) |
| Mở | `reopen` | → running | null | revive future class_closed only; ensureSessions | lại sinh |
| Xóa mềm | `discard` | **không đổi** | → now | giữ nguyên | không quét (archived filter) |
| Khôi phục xóa | `undiscard` | không đổi | → null | giữ | lại quét nếu status running |

Preflight close vs force+seen: `class-batch.ts:721-737`.  
Discard chỉ khi 0 attendance: `class-batch.ts:834-841`.

---

## 7. Cron nền (sinh buổi) — `CHUẨN`

> Job phát bài thuộc BR bài tập; ghi ở đây phần **materialize buổi** + registration.

| Mục | Giá trị | Bằng chứng |
|---|---|---|
| Lịch materialize | `5 0 1 * *` (00:05 ngày 1 hàng tháng) | `cron.ts:95` |
| Timezone cron | `Asia/Ho_Chi_Minh` | `cron.ts:96` |
| Boot catch-up | gọi ngay `materializeAllRunningBatches()` khi start server | `cron.ts:98-99`; `index.ts:42` |
| Phạm vi lớp | `status='running' AND archivedAt=null`, order createdAt, code | `cron.ts:23-28` |
| Horizon | `endOfNextMonthIso()` = cuối tháng sau ICT | `cron.ts:22`; `ict-date.ts:55-61` |
| Per-batch | try/catch riêng — 1 lớp lỗi không chặn lớp sau | `cron.ts:30-44` |
| Mutex | biến process `running`; lượt chồng → `{skipped:true}` | `cron.ts:11,16-19,51` |
| Heartbeat | `cronHeartbeat.materialize = ISO` chỉ khi **thành công** hết vòng (kể cả 0 buổi) | `cron.ts:49,89-91` |
| Health | `GET /health` → `{ ok:true, cron: cronHeartbeat }` | `index.ts:22` |
| Đa instance | comment: v1 1 instance; multi cần advisory lock DB | `cron.ts:3-4` — **TẠM** nếu scale multi |

**Phát bài (liên quan buổi, tham chiếu):** `*/5 * * * *` ICT, mutex `deliveringExercises`, scan window 14 ngày, chỉ non-cancelled running — `cron.ts:101-105`; `exercise-delivery.ts:282-296`. Nhãn: `CHUẨN` (dạy-học).

---

## 8. Thứ tự ưu tiên khi luật đụng nhau — `CHUẨN`

1. **`archivedAt` lớp** → coi như không tồn tại (NOT_FOUND) trước khi xét status.  
2. **`status≠running`** → không ensure, không restamp, không addSlot.  
3. **Attendance tồn tại** → chặn cancelSession; đóng băng unit; chặn discard lớp; chặn hủy/cascade khi remove/dời slot.  
4. **Unique (date,start)** → session cancelled manual chiếm slot vĩnh viễn (không tạo mới cùng key).  
5. **force restamp (realign)** thắng đóng băng — chỉ đường admin migrate.  
6. **Capacity sinh** cắt fresh trước; **ceiling restamp** hủy future vượt sau khi neo đổi.  
7. **GV trùng lịch** luôn soft-warn, không chặn hard.

---

## 9. Phân loại tổng hợp nhóm luật

| Nhóm | Nhãn | Lý do ngắn |
|---|---|---|
| Tạo lớp, mã CMC-YY-NNNN, slots, effectiveFrom | **CHUẨN** | Nghiệp vụ vận hành thật |
| ensureSessionsUntil + capacity + revive slot_removed | **CHUẨN** | Cốt lõi lịch |
| Neo unit + derive + restamp + setCurrentUnit + realignHistory | **CHUẨN** | Tiến độ unit đã chốt theo buổi |
| Hủy buổi multi-reason + revoke bài | **CHUẨN** | |
| close / reopen / discard / undiscard | **CHUẨN** | |
| Cron materialize mùng 1 + mutex in-process | **CHUẨN** (mutex multi-instance: **TẠM**) | 1 instance prod giả định |
| Enum ClassStatus planned/open/cancelled | **TẠM** | Chỉ migrate, không API |
| Buổi bù / makeup | **THIẾU** (chủ ý không làm) | Spec cấm; không port entity makeup |
| Tự động đóng lớp khi chạm trần | **THIẾU** | Chỉ hitCeiling flag / log; admin đóng tay |
| Facility / phòng / đa cơ sở trên slot | **SEAM** | LMS mới không có; ERP có thể có — không bê schema slot không-phòng như chuẩn ERP |
| Tiền / hoàn phí khi đóng lớp / hủy | **SEAM** | Không trong module này; “xử ngoài hệ” |

---

## 10. API surface (để map implement)

| Procedure | Vai trò |
|---|---|
| `classBatch.create` | Tạo + sinh buổi |
| `classBatch.update` | note / KG+startUnit nếu trống |
| `classBatch.list` / `detail` / `listSessions` | Đọc |
| `classBatch.setCurrentUnit` | Neo vận hành |
| `classBatch.realignHistory` | Neo migrate force |
| `classBatch.close` / `reopen` | Vòng đời status |
| `classBatch.discard` / `undiscard` | Soft delete |
| `classBatch.addSlot` / `removeSlot` / `editSlot` / `editSlotTeacher` | Lịch tuần |
| `classBatch.cancelSession` | Hủy 1 buổi manual |
| `classBatch.checkSlotConflicts` | Preview D4 |
| Service `ensureSessionsUntil` / `restampBatchUnits` | Sinh + stamp |
| Domain `deriveSessionUnits` / `resolveReferenceAnchor` / `enumerateSessions` | Thuần |

Router: `apps/api/src/routers/class-batch.ts`.

---

## Unknowns

1. Có đường runtime nào set `ClassSession.status = 'confirmed'` không — mark điểm danh **không** đổi status; close vẫn hủy confirmed → có thể dead state hoặc data migrate.  
2. `undiscard` **không** gọi ensureSessions — lớp restore sau downtime dài dựa cron mùng 1 / thao tác khác (chưa xác nhận UX).  
3. Multi-instance production hiện tại: mutex in-process có đua job không — UNKNOWN ops.  
4. Giá trị `ClassStatus.cancelled` vs discard(`archivedAt`) — enum cancelled không thấy API set.

---

Status: DONE | Summary: Đặc tả đủ thuật toán tạo lớp, slot/effectiveFrom, ensureSessionsUntil, neo/restamp, hủy đa reason, close/reopen/discard, cron ICT — nhãn CHUẨN cho cốt lõi dạy-học, TẠM multi-mutex & enum migrate, THIẾU makeup/auto-close, SEAM facility/tiền.
