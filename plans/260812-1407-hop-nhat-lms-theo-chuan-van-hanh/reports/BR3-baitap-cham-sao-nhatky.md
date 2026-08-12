# BR3 — Đặc tả nghiệp vụ: Bài tập + Chấm điểm + Sao thưởng + Nhật ký buổi

Nguồn: `/home/manhquy/Downloads/cmc-lms` (chỉ đọc).  
Đối tượng: implement lại được **không cần mở code**.  
Nhãn: `CHUẨN` | `TẠM` | `THIẾU` | `SEAM` (theo BRIEF2).  
Hợp đồng gốc: `docs/class-unit-spec.md` §8–§9.

---

## 0. Hằng số & múi giờ

| Hằng / quy ước | Giá trị | Ý nghĩa | Nhãn | Bằng chứng |
|---|---|---|---|---|
| TZ nghiệp vụ | `Asia/Ho_Chi_Minh` (ICT, UTC+7) | Cron phát bài, tính `sessionEndInstant` | CHUẨN | `apps/api/src/cron.ts:101-103`; `exercise-delivery.ts:28,32-49` |
| `ICT_OFFSET_HOURS` | `7` | Đổi `sessionDate`(@db.Date UTC-midnight) + `endTime` (HH:mm ICT) → UTC | CHUẨN | `exercise-delivery.ts:28,39-48` |
| `MAX_SCORE` | `10` | Thang điểm mọi bài; điểm lẻ (7.5) được | CHUẨN | `packages/domain/src/grading-scale.ts:7,12-14` |
| `STAR_REWARD` | `10` | Sao cộng khi **publish** điểm 1 bài | CHUẨN | `grading-scale.ts:10` |
| `LOW_EXERCISE_THRESHOLD` | `4` | Cảnh báo “sắp hết bài” khi remaining ≤ 4 | CHUẨN | `exercise-delivery.ts:29` |
| `DUE_EXERCISE_SCAN_WINDOW_DAYS` | `14` | Cửa sổ quét cron: chỉ buổi `sessionDate ≥ now−14d` | CHUẨN | `exercise-delivery.ts:282` |
| Cron phát bài | `*/5 * * * *` + catch-up lúc boot | Mỗi 5 phút; mutex in-process chặn chồng | CHUẨN | `cron.ts:59-74,101-105` |
| Bài / buổi | **1** (`classSessionId` unique trên SessionExercise) | Không phát nhiều bài cùng buổi | CHUẨN | `schema.prisma:683`; `exercise-delivery.ts:326-328` |
| `MAX_PHOTOS` | `20` | Ảnh nhật ký / buổi | CHUẨN | `session-evidence.ts:14`; spec §9 |
| Ảnh max size | `10 MB` (`MAX_IMAGE_BYTES`) | jpeg/png/webp + magic byte | CHUẨN | `file-store.ts:14`; `session-evidence.ts:178` |
| PDF max size | `20 MB` (`MAX_PDF_BYTES`) | magic `%PDF-` | CHUẨN | `file-store.ts:13` |
| `pdfRef` / `photoRef` | sha256 hex 64 ký tự `^[a-f0-9]{64}$` | Content-addressed; nhiều entity dùng chung 1 blob | CHUẨN | `file-store.ts:33-35`; `session-evidence.ts:15` |
| Annotation `MAX_ITEMS` | `500` | Cap payload layer | CHUẨN | `packages/domain/src/annotation.ts:12` |
| Annotation `MAX_INK_POINTS` | `2000` / item | Cap điểm vẽ | CHUẨN | `annotation.ts:13` |
| Annotation `MAX_TEXT_LEN` | `500` | Cắt text item | CHUẨN | `annotation.ts:14` |
| Annotation `MAX_COLOR_LEN` | `32` | Chuỗi màu | CHUẨN | `annotation.ts:15` |
| Annotation schema version | `v: 1` | Sai v → reject | CHUẨN | `annotation.ts:48-50,133` |
| Ink width | `[0.1, 40]` | Ngoài → drop item | CHUẨN | `annotation.ts:73` |
| Text size | `[4, 200]` | Ngoài → drop item | CHUẨN | `annotation.ts:82` |
| `answerText` max | `20_000` | Lưu nháp HS | CHUẨN | `submission.ts:288` |
| `feedback` max | `2_000` | Chấm GV | CHUẨN | `submission.ts:448` |
| Folder name max | `200` | Thư viện | CHUẨN | `exercise.ts:53` |
| File title max | `300` | Thư viện | CHUẨN | `exercise.ts:118` |
| Evidence summary/internalNote max | `2000` | Nhật ký | CHUẨN | `session-evidence.ts:299-300` |
| Comment `teacherNote` max | `500` | Nhận xét HS | CHUẨN | `session-evidence.ts:33` |
| Upload rate limit | env `UPLOAD_RATE_LIMIT` default `200` / cửa sổ login | Staff only | TẠM | `files.ts:30-32` (số đo prod, cấu hình env) |
| Sao ledger unique | partial unique `(type, reference) WHERE reference IS NOT NULL` | Chống cộng trùng | CHUẨN | `migrations/.../init/migration.sql:914-916`; `star-ledger.ts:3-9` |
| Star type earn bài tập | `homework_completed` | `reference = Submission.id` | CHUẨN | `star-ledger.ts:23-26`; `schema.prisma:117-118` |

---

## 1. Thư viện bài tập — `ExerciseFolder` + `ExerciseFile` — `CHUẨN`

### 1.1 Mô hình

| Entity | Field then chốt | Vai trò | Nhãn |
|---|---|---|---|
| `ExerciseFolder` | `name`, `description?`, `archivedAt?`, `createdById?` | Thư mục **một cấp**, không lồng | CHUẨN |
| `ExerciseFile` | `folderId`, `title`, `pdfRef`, `orderInFolder`, `archivedAt?` | **1 PDF = 1 bài**; thứ tự do hệ giữ | CHUẨN |

Nguồn schema: `packages/db/prisma/schema.prisma:620-655`.  
Unique: `(folderId, orderInFolder)`.  
FK folder: `onDelete: Restrict` (không xóa cứng folder còn file).

**Không có** cột `maxScore` / `starReward` trên file — hằng số toàn hệ (`grading-scale.ts`).

### 1.2 Luật CRUD thư viện (ADMIN only)

| Luật | Điều kiện kích hoạt | Hành vi | Chặn / lỗi | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Quyền thư viện | mọi CRUD folder/file/library | `adminProcedure` | FORBIDDEN cho GV/family | CHUẨN | `exercise.ts:52-290` |
| Tạo folder | name 1–200, desc ≤2000? | create + RecordEvent `created` | — | CHUẨN | `exercise.ts:52-67` |
| Sửa folder | folderId + name/desc | update + log | P2025→NOT_FOUND seam | CHUẨN | `exercise.ts:70-93` |
| Ẩn/hiện folder | `archived: boolean` | set/clear `archivedAt`; **không** đụng dãy lớp đã gán | — | CHUẨN | `exercise.ts:95-115`; schema comment 624 |
| Thêm file | folder **chưa** ẩn; title + pdfRef | `orderInFolder = max+1` (cuối); log | BAD_REQUEST “Thư mục đã ẩn…” | CHUẨN | `exercise.ts:117-151` |
| Sửa title file | mọi lúc | update title | — | CHUẨN | `exercise.ts:153-191` |
| Sửa `pdfRef` | chỉ khi **chưa** có bất kỳ `SessionExercise` nào trỏ file | update pdfRef | BAD_REQUEST “File đã giao… tạo file mới” | CHUẨN | `exercise.ts:163-174` — pdfRef đọc **sống** (không snapshot trên lần phát) |
| Ẩn/hiện file | `archived` boolean | set/clear `archivedAt` — **không** xóa row, **không** xóa blob đĩa | — | CHUẨN | `exercise.ts:194-214`; schema 644-646 |
| Reorder live | `orderedFileIds` = đúng tập file **live** của folder (không thiếu/thừa) | 2-phase âm→dương; file archived xếp **sau** live, giữ relative order | BAD_REQUEST “Danh sách sắp xếp…”; tránh P2002 unique | CHUẨN | `exercise.ts:216-274` |
| List thư viện | ADMIN | mọi folder + files (kể cả archived), order `orderInFolder` asc | — | CHUẨN | `exercise.ts:276-290` |
| Import hàng loạt từ đĩa | spec §8.1 “v1 nhập kho bằng import” | — | **Chưa có API/import path trong router** — chỉ `fileCreate` lẻ sau upload HTTP | THIẾU | spec `class-unit-spec.md:269-272`; router chỉ `fileCreate` |

### 1.3 Kho file PDF

| Luật | Hành vi | Nhãn | Bằng chứng |
|---|---|---|---|
| Content-addressed sha256 | 2 bài cùng đề → cùng blob | CHUẨN | `architecture.md:68-71`; schema `pdfRef` |
| Driver đĩa, không S3 | `FILE_STORE_DIR` | CHUẨN | `file-store.ts` + architecture §Lưu file |
| Upload | staff only (`teacher`/`admin`); magic + size | CHUẨN | `files.ts:247-` |
| Xóa blob khi archive file | **Không** — archive chỉ ẩn metadata | CHUẨN | schema comment; `exercise.ts:197-198` |

---

## 2. Dãy bài của lớp — `ClassExerciseItem` — `CHUẨN`

### 2.1 Snapshot lúc gán

| Field | Vai trò |
|---|---|
| `classBatchId` + `position` (unique) | Vị trí 1..N trong dãy lớp |
| `exerciseFileId` | File tại thời điểm gán (Restrict) |
| `folderNameAtAssign` | Snapshot tên folder — hiển thị sau khi folder đổi tên/ẩn |

Thư viện chèn/ẩn/đổi thứ tự **không** tự dịch dãy lớp.

### 2.2 Build dãy từ folder list

| Luật | Hành vi | Nhãn | Bằng chứng |
|---|---|---|---|
| Nối folder theo đúng thứ tự admin chọn | folder A rồi B → file A.1..A.n rồi B.1..B.m; đổi order folder → đổi dãy | CHUẨN | `exercise-sequence.ts:36-54` |
| Chỉ file live (`archivedAt: null`) vào lần gán **mới** | file ẩn không vào `loadSourceFolders` | CHUẨN | `exercise-delivery.ts:84-118` |
| Folder ẩn / trùng / không tồn tại | BAD_REQUEST | CHUẨN | `exercise-delivery.ts:88-112` |
| Preview trước ghi | `sequencePreview` — không ghi DB | CHUẨN | `exercise.ts:322-328` |

### 2.3 Cập nhật dãy khi đã phát một phần (đóng băng)

**Con trỏ khóa dãy** = `deliveredCount = MAX(SessionExercise.position)` của lớp (0 nếu chưa phát).  
**Không** dùng số bản ghi live cho biên khóa.

| Luật | Điều kiện | Hành vi | Chặn | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Giữ phần đã phát | `position ≤ deliveredCount` | `kept` — không ghi đè | — | CHUẨN | `exercise-sequence.ts:64-74`; `writeSequenceUpdate:143-147` |
| Thay phần chưa phát | `position > deliveredCount` | deleteMany rồi createMany dãy mới từ `deliveredCount+1` | — | CHUẨN | `exercise-delivery.ts:148-158` |
| Gap đã thu hồi dưới biên MAX | vị trí < MAX từng phát nhưng SessionExercise đã xóa | **Vẫn giữ** nội dung ClassExerciseItem cũ — không gán file mới vào gap | — | CHUẨN | comment `writeSequenceUpdate:143-147` (CROSS-2) |
| Advisory lock | 2 admin ghi cùng lớp | `pg_advisory_xact_lock(hashtext(batchId), 91004)` | serialize | CHUẨN | `exercise-delivery.ts:141` |
| Hiển thị remaining | `remaining = sequenceLength − liveDeliveredCount` | `lowWarning = remaining ≤ 4` | — | CHUẨN | `exercise.ts:34-47,389-397` |
| Quyền sequence | ADMIN only (preview/write/current) | — | FORBIDDEN GV | CHUẨN | `exercise.ts:294-346` |

`planSequenceUpdate(current, newFolders, deliveredCount)`:

- `kept = current.filter(p ≤ deliveredCount)`
- `replaced = buildClassSequence(newFolders, start=deliveredCount+1)`
- `droppedCount = current.length − kept.length`

---

## 3. Phát bài — `SessionExercise` — `CHUẨN`

### 3.1 Điều kiện buổi được phát (cron `deliverDueExercises`)

Candidate SQL:

| Filter | Giá trị | Ý nghĩa |
|---|---|---|
| `archivedAt` buổi | `null` | buổi còn |
| `status` | `≠ cancelled` | hủy không phát |
| `batch.status` | `running` | lớp đóng/hủy không phát |
| `batch.archivedAt` | `null` | |
| `deliveredExercise` | `null` | chưa có SessionExercise |
| `sessionDate` | `≥ now − 14 ngày` | cửa sổ quét |
| Hết giờ | `sessionEndInstant(sessionDate, endTime) < now` | mốc “buổi thực diễn ra” = **hết giờ** |

Trong transaction re-check: status cancelled / đã có delivery → skip.

| Luật | Hành vi | Nhãn | Bằng chứng |
|---|---|---|---|
| Đúng 1 bài / buổi | create 1 `SessionExercise` | CHUẨN | unique `classSessionId` |
| Không nút phát tay GV | chỉ cron | CHUẨN | spec §8.3; không procedure deliver manual trong `exercise.ts` |
| Hết bài | `nextPosition === null` → skip, **không** chặn điểm danh | CHUẨN | `exercise-delivery.ts:322-323` |
| Lỗi 1 buổi | try/catch riêng — không chặn buổi sau | CHUẨN | `exercise-delivery.ts:311-334` |
| Buổi ngoài 14 ngày chưa phát | **không** tự phát nữa | CHUẨN | comment 274-280 |
| Sắp xếp due | theo `endsAt` tăng dần | CHUẨN | `exercise-delivery.ts:307` |

`sessionEndInstant`: UTC = date parts của `sessionDate` + (hour_ict − 7, minute).

### 3.2 Chọn bài tiếp theo khi có lỗ hổng (gap-aware)

| Luật | Hành vi | Nhãn | Bằng chứng |
|---|---|---|---|
| Tập vị trí sống | `deliveredPositionsForBatch` = mọi `SessionExercise.position` còn row | CHUẨN | `exercise-delivery.ts:67-73` |
| Next | `nextDeliverablePosition` = **min** p ∈ [1..sequenceLength] **không** có trong set | CHUẨN | `exercise-sequence.ts:85-94` |
| Không nhảy cóc | thu hồi vị trí giữa → phát lại vị trí đó trước khi tăng MAX | CHUẨN | test CROSS-2; comment sequence |
| Gán file | `sequence.find(position === next)` → `exerciseFileId` + `position` | CHUẨN | `exercise-delivery.ts:324-328` |

**Phân biệt 2 con trỏ:**

| Con trỏ | Công thức | Dùng cho |
|---|---|---|
| `deliveredCount` (MAX) | `MAX(position)` | Biên khóa dãy (`writeSequenceUpdate`) |
| live positions | tập position còn row | Chọn bài phát tiếp + remaining UI |

### 3.3 Ai nằm trong danh sách nhận bài (roster D1)

Hàm `rosterForDeliverySession` / cùng tinh thần `assertStudentInDeliveryRoster`:

HS nhận bài buổi **khi đồng thời**:

1. Có `Enrollment` lớp đó (không filter `archivedAt` ở where).
2. `isEntitled(unitRanges, orderGlobal_của_buổi)` — unit **stamp** buổi (`curriculumUnit.orderGlobal`), fallback unit hiệu lực lớp nếu thiếu stamp.
3. `!BLOCKED_LMS_LIFECYCLE.has(lifecycle)` — block: `on_hold | withdrawn | transferred`; **`completed` không block**.
4. `enrollmentCoversSession(archivedDayUtc, sessionDate)`: gỡ lớp (`Enrollment.archivedAt`) → buổi **trước/cùng ngày** mốc vẫn cover; buổi **sau** mốc không.

| Luật | Hệ quả | Nhãn | Bằng chứng |
|---|---|---|---|
| HS vắng vẫn nhận bài | roster ≠ attendance present | CHUẨN | `exercise-delivery.ts:168-217`; spec §8.3 |
| Hết quyền unit | không trong roster → không discovery/nộp mới; bài cũ xem vĩnh viễn | CHUẨN | spec §6 + `submission.ts:89-94,237-238` |
| HS vắng mặt / lifecycle completed | vẫn trong roster nếu entitled + cover | CHUẨN | `exercise-delivery.ts:203-206` |
| Gỡ giữa chừng | buổi ≤ mốc gỡ vẫn làm bài; buổi > mốc không | CHUẨN | `unit-progression.ts:85-86` |

Discovery HS: `exercise.forStudent` — thêm filter:

- buổi `status ≠ cancelled`, `archivedAt null`, batch not archived  
- `exerciseFile.archivedAt: null` (nhất quán download; **nợ mở** vs “bài đã phát giữ vĩnh viễn” khi ẩn file)  
- redact grade tới publish  

Bằng chứng: `exercise.ts:417-551` (comment 464-465 ghi nợ).

---

## 4. Thu hồi bài khi hủy buổi — `CHUẨN`

Gọi `revokeDeliveryOnCancel` **trong cùng tx** hủy buổi (`cancelSession`, đóng lớp, ceiling, …).

| Luật | Điều kiện | Hành vi | Log | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Không có SessionExercise | — | return `'none'` | — | CHUẨN | `exercise-delivery.ts:228-232` |
| Có delivery **và** `submissions.count == 0` | hủy buổi | **DELETE** `SessionExercise` → vị trí trả về dãy chưa phát | RecordEvent note “Thu hồi bài…” | CHUẨN | `exercise-delivery.ts:243-251` |
| Có delivery **và** đã có ≥1 Submission (draft cũng tính) | hủy buổi | **GIỮ** SessionExercise | note “đã có bài nộp — giữ nguyên” | CHUẨN | `exercise-delivery.ts:233-241` |
| Batch cancel nhiều buổi | list session ids | loop cùng luật | — | CHUẨN | `revokeDeliveriesForCancelledSessions:260-268` |
| Buổi hủy **trước** cron phát | không delivery | bài dồn buổi kế (next gap/min free) | — | CHUẨN | spec §8.3 “không tiêu bài” |
| Race cron vs cancel | re-check cancelled trong tx deliver | không tạo delivery | — | CHUẨN | `exercise-delivery.ts:314-318` |
| Orphan delivery trên cancelled (race) | đã tạo trước cancel, không revoke kịp | HS **không** thấy/nộp/tải (filter cancelled); GV staff vẫn chấm được nếu đã có sub | B-M1 | CHUẨN | `submission.ts:36-41,69-71`; `exercise.ts:456-459`; `files.ts:117-120` |

---

## 5. HS làm bài — draft / submit / version / annotation / file access — `CHUẨN`

### 5.1 Mô hình `Submission`

| Field | Ý nghĩa |
|---|---|
| Unique `(sessionExerciseId, studentId)` | 1 bài nộp / HS / lần phát |
| `answerText?` | text tự do ≤20k |
| `annotationLayer` JSON | layer v1 trên PDF gốc (không flatten PDF) |
| `version` default 1 | optimistic concurrency |
| `status` | `draft` → `submitted` → `graded` |
| `submittedAt?` | set lúc submit |
| `archivedAt?` | soft; query thường `archivedAt: null` |

### 5.2 Draft (`submission.save`)

| Luật | Điều kiện | Hành vi | Chặn | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Ownership | `principalOwnsStudent` | family session | FORBIDDEN | CHUẨN | `submission.ts:294` |
| Buổi hợp lệ cho HS | load delivery `forStudent:true` | reject cancelled / archived | NOT_FOUND | CHUẨN | `submission.ts:43-72,296` |
| Roster D1 | entitled + cover | — | FORBIDDEN “không thuộc roster” | CHUẨN | `submission.ts:96-112,297` |
| Tạo mới | chưa có row | create status draft version=1 | P2002 → CONFLICT “tải lại” | CHUẨN | `submission.ts:312-326` |
| Update | status **phải** `draft` | `version` input bắt buộc = current; updateMany + increment version | status≠draft → CONFLICT “đã nộp/chấm”; version miss/sai → CONFLICT | CHUẨN | `submission.ts:329-349` |
| Annotation input | raw unknown | sanitize; **hình gốc hỏng → BAD_REQUEST** (không im lặng xóa) | “Lớp annotation không hợp lệ” | CHUẨN | `submission.ts:223-231,299` |
| Sanitize item lẻ | item sai shape | drop item; cap MAX_ITEMS/points | — | CHUẨN | `annotation.ts:119-140` |

### 5.3 Submit (`submission.submit`)

| Luật | Hành vi | Chặn | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Input | `submissionId` + `studentId` (không sessionExerciseId) | sub.studentId ≠ input → FORBIDDEN “không nộp giùm” | CHUẨN | `submission.ts:357-372` |
| Chỉ draft | → `submitted` + `submittedAt=now` | status≠draft → CONFLICT | CHUẨN | `submission.ts:373-384` |
| Roster + buổi | re-check forStudent | cancelled/out roster | CHUẨN | `submission.ts:376-377` |

**Không có** “rút bài / unsubmit” trong router.

### 5.4 Xem lại (không gate roster)

| API | Ai | Gate | Grade redact | Nhãn |
|---|---|---|---|---|
| `myForSessionExercise` / `mine` / `detail` | family | ownership + archivedAt null | score/feedback/GV-annotation null nếu `!isPublished` | CHUẨN |
| `forStudent` / `detailForParent` | family (alias) | idem | idem | CHUẨN |

Redact server-side: `redactGrade` — `submission.ts:153-176`.

### 5.5 Quyền truy cập file PDF

HTTP `GET /files/download/:ref` — không tin biết ref là đủ.

| Vai trò | Điều kiện tải PDF đề | Nhãn | Bằng chứng |
|---|---|---|---|
| ADMIN | luôn (ref hợp lệ) | CHUẨN | `files.ts:50-51` |
| GV | ref gắn ClassExerciseItem lớp mình (slot) **hoặc** SessionExercise buổi mình dạy; file not archived | CHUẨN | `files.ts:53-79` |
| Family | (a) có Submission của con với pdfRef đó + enrollment cover buổi; **hoặc** (b) roster D1 buổi đã phát (kể cả chưa nháp) + session not cancelled + file not archived | CHUẨN | `files.ts:93-242` |
| Family | buổi cancelled | **không** tải qua roster path | CHUẨN | `files.ts:117-120` |

Upload: staff only.

---

## 6. Chấm điểm — `Grade` — `CHUẨN`

### 6.1 Thang & chặn

| Luật | Điều kiện | Hành vi | Chặn | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Score | `isValidScore`: finite ∈ [0, 10] | — | BAD_REQUEST “Điểm phải trong [0, 10]” | CHUẨN | `submission.ts:453-455`; `grading-scale.ts:12-14` |
| Không chấm draft | status == draft | — | BAD_REQUEST “Học sinh chưa nộp bài” | CHUẨN | `submission.ts:461-467` |
| Cho phép chấm | `submitted` **hoặc** re-grade `graded` | upsert Grade; set submission `graded` | — | CHUẨN | `submission.ts:464,474-505` |
| Ownership buổi | `assertTeachingSessionAccess` (GV đúng `teacherId` buổi; ADMIN opt-in) | — | NOT_FOUND/FORBIDDEN | CHUẨN | `submission.ts:469`; `teaching-authz.ts:46-71` |
| Roster HS | `assertStudentInDeliveryRoster` | chấm được HS vắng/đã qua nếu thuộc roster stamp | FORBIDDEN | CHUẨN | `submission.ts:470` |
| Upsert Grade | create hoặc update score/feedback/annotation/gradedBy/gradedAt | **không** tự đụng `isPublished` khi re-grade | — | CHUẨN | `submission.ts:475-494` |
| Annotation GV | layer riêng trên Grade | sanitize giống HS | BAD_REQUEST nếu hỏng | CHUẨN | `submission.ts:472` |
| Staff list | `bySessionExercise` | full grade (kể unpublished) | ownership buổi | CHUẨN | `submission.ts:422-433` |
| Unpublish điểm | — | **Không có API** (chốt sổ sao) | — | CHUẨN / quyết định product | plans `260801-1058...` N1/N11; router không có unpublish grade |

Re-grade sau publish: đổi điểm PH thấy ngay (`isPublished` giữ true); **không** cộng sao lại (idempotent ledger).

---

## 7. Publish điểm + cộng sao — `CHUẨN`

### 7.1 Publish

| Luật | Điều kiện | Hành vi | Chặn | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Cần Grade | đã chấm | `isPublished=true` | BAD_REQUEST “Chưa chấm điểm” | CHUẨN | `submission.ts:514-519` |
| Quyền | staff + ownership buổi + roster HS | — | — | CHUẨN | `submission.ts:520-522` |
| Sao | `creditHomeworkStars(tx, studentId, submissionId)` trong cùng tx | return `starsEarned` | — | CHUẨN | `submission.ts:524-539` |
| Publish lần 2 | đã published + đã có star row | `starsEarned=0`; isPublished vẫn true | không lỗi | CHUẨN | `star-ledger.ts:14-27` |

### 7.2 Cơ chế chống cộng trùng

| Cơ chế | Chi tiết | Nhãn | Bằng chứng |
|---|---|---|---|
| Append-only ledger | `StarTransaction`; balance = `SUM(amount)` | CHUẨN | schema 756-772 |
| Type | `homework_completed` | CHUẨN | `star-ledger.ts:24` |
| Reference | `Submission.id` (không phải Grade.id / SessionExercise.id) | CHUẨN | `star-ledger.ts:21-24` |
| Amount | `+STAR_REWARD` (=10) | CHUẨN | `star-ledger.ts:24` |
| Idempotency | `createMany({ skipDuplicates: true })` + partial unique `(type, reference) WHERE reference IS NOT NULL` | CHUẨN | `star-ledger.ts:23-27`; migration init:914-916 |
| Số sao / bài | cố định 10 — **không** phụ thuộc điểm số (0 điểm vẫn 10 sao nếu publish) | CHUẨN | không đọc score trong creditHomeworkStars |

**Không** hoàn sao khi re-grade / đổi điểm / (không có) unpublish điểm.

---

## 8. Nhật ký buổi — `SessionEvidence` — `CHUẨN`

### 8.1 Mô hình

| Entity | Field then chốt |
|---|---|
| `SessionEvidence` | 1:1 `classSessionId`; `summary?`, `internalNote?`, `status` draft\|published, `publishedAt?`, `publishedById?`, `createdById?`, `archivedAt?` |
| `SessionEvidencePhoto` | `photoRef`, `sortOrder` |
| `SessionStudentComment` | unique `(sessionEvidenceId, studentId)`; template fields + `teacherNote` |

### 8.2 Draft / ảnh / nhận xét (staff)

| Luật | Điều kiện | Hành vi | Chặn | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Quyền | GV của buổi **hoặc** ADMIN | `assertTeachingSessionAccess` | NOT_FOUND | CHUẨN | `session-evidence.ts:102-104,308` |
| Lock | mọi write evidence | `pg_advisory_xact_lock(hashtext(sessionId))` | serialize | CHUẨN | `session-evidence.ts:165-171` |
| `upsertDraft` | optional summary/internalNote/photos/comments | field **vắng** = giữ nguyên; mảng `[]` tường minh = xóa hết | — | CHUẨN | `session-evidence.ts:296-373` |
| Draft **không** đổi status/audit publish | kể cả khi status=published | sửa sau publish được (spec §9) | — | CHUẨN | `session-evidence.ts:343-349`; spec 323-325 |
| Ảnh | max 20; ref unique trong buổi; inspect image ≤10MB | attach/remove riêng hoặc qua upsert | CONFLICT trùng; BAD_REQUEST max 20 / invalid image | CHUẨN | `session-evidence.ts:14,309-313,376-408` |
| Comment template | enum cố định participation/strength/needsImprovement | ít nhất 1 field non-empty / comment | Zod refine | CHUẨN | `session-evidence.ts:17-39` |
| Comment roster | student ∈ roster D1 **hoặc** đã có comment persisted | cho phép giữ HS rời roster giữa chừng nếu gửi lại | BAD_REQUEST “không thuộc roster” | CHUẨN | `session-evidence.ts:319-338` |
| Roster nhật ký | = entitled + not blocked lifecycle + enrollmentCovers — **không** filter attendance present | — | CHUẨN | `session-evidence.ts:116-161` |
| `internalNote` | staff only | **không** trả family select | — | CHUẨN | `principalEvidenceSelect` không có internalNote:80-96 |

### 8.3 Publish / unpublish

| Luật | Điều kiện | Hành vi | Chặn | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Publish lần đầu | draft + summary trim nonempty + ≥1 photo + ≥1 comment + re-validate image refs | status=published; set publishedAt/By nếu chưa có | thiếu → BAD_REQUEST tương ứng | CHUẨN | `session-evidence.ts:411-451` |
| Buổi cancelled | — | **chặn publish** (vẫn lưu nháp) | “Buổi học đã bị hủy…” | CHUẨN | `session-evidence.ts:428-430` |
| Lớp batch cancelled | — | chặn publish | “Lớp đã hủy…” | CHUẨN | `session-evidence.ts:431` |
| Idempotent publish | đã published | return row, không đổi audit | — | CHUẨN | `session-evidence.ts:425-427` |
| Unpublish | published → draft | **giữ** publishedAt/By (first-publish immutable) | — | CHUẨN | `session-evidence.ts:454-466` |
| Re-publish sau unpublish | đủ điều kiện | status published; **không** ghi đè publishedAt/By cũ | — | CHUẨN | `session-evidence.ts:440-445` |

### 8.4 Gia đình xem được khi nào

| Luật | Điều kiện | Hành vi | Nhãn | Bằng chứng |
|---|---|---|---|---|---|
| Visibility | `status=published` AND `publishedAt≠null` AND evidence `archivedAt=null` | list/detail principal | CHUẨN | `publishedEvidenceWhere:191-201` |
| Buổi | session not archived, **status ≠ cancelled**, batch not archived | ẩn khỏi PH dù lỡ publish | CHUẨN | `publishedEvidenceWhere` + comment 196-199 |
| Con trong lớp | enrollment some (kể archived) + `filterEvidenceByEnrollmentCoverage` | buổi ≤ mốc gỡ vẫn xem; sau mốc ẩn | CHUẨN | `session-evidence.ts:213-228,469-525` |
| Comment lộ | chỉ comment của **con được chọn / studentIds** | không lộ nhận xét HS khác | CHUẨN | select comments where studentId in … |
| Ảnh tải | published evidence path + cover + not cancelled | `principalCanAccessRef` photos nhánh | CHUẨN | `files.ts:167-226` |
| Staff vẫn xem cancelled | `detailForStaff` không dùng publishedEvidenceWhere | khôi phục nháp nếu hủy nhầm | CHUẨN | comment 197-199 |

### 8.5 Quy tắc đồng ý cho phép đăng ảnh

| Hạng mục | Trạng thái | Nhãn | Bằng chứng |
|---|---|---|---|
| Model/flag “PH đồng ý cho đăng ảnh con” | **Không có** trong schema Student/Guardian/Enrollment | THIẾU | grep consent/photoConsent = 0 nghiệp vụ; schema SessionEvidence không gate consent |
| Kiểm tra consent lúc attach/publish | **Không có** | THIẾU | `session-evidence.ts` chỉ validate image magic/size/roster |
| UI/policy ngoài hệ | UNKNOWN (có thể xử lý giấy tờ thủ công) | UNKNOWN | không thấy trong code/spec §9 |

Khi merge ERP: nếu cmc_edu có consent PH → **SEAM** thiết kế lại, không bê nguyên “publish không hỏi consent”.

### 8.6 Buổi bị hủy thì sao (nhật ký)

| Tình huống | Hành vi | Nhãn | Bằng chứng |
|---|---|---|---|
| Hủy trước publish | nháp còn; publish bị chặn | CHUẨN | publish guard cancelled |
| Hủy sau publish | PH/HS **không còn thấy** (filter read); data không migrate/xóa | CHUẨN | `publishedEvidenceWhere`; class-unit-spec ~150 |
| Staff | vẫn detail/sửa nháp | CHUẨN | detailForStaff |

---

## 9. Ma trận quyền tóm tắt

| Hành động | Family | GV (đúng buổi/lớp) | ADMIN | Nhãn |
|---|---|---|---|---|
| CRUD thư viện / gán dãy | ✗ | ✗ | ✓ | CHUẨN |
| Phát bài | ✗ (cron) | ✗ | ✗ manual | CHUẨN |
| Làm/nộp bài | ✓ con mình + roster | ✗ | ✗ | CHUẨN |
| Chấm / publish điểm | ✗ | ✓ buổi mình | ✓ | CHUẨN |
| Xem điểm unpublished | ✗ (redact) | ✓ | ✓ | CHUẨN |
| Nhật ký draft/publish | ✗ | ✓ buổi mình | ✓ | CHUẨN |
| Xem nhật ký published | ✓ con cover | ✓ | ✓ | CHUẨN |

---

## 10. Edge case & thứ tự ưu tiên (khi luật đụng nhau)

1. **Roster vs attendance:** roster D1 (unit stamp + cover + lifecycle) **thắng** — vắng mặt vẫn nhận bài / nhận xét nhật ký.  
2. **MAX vs live positions:** khóa dãy = MAX; phát tiếp = min gap live.  
3. **Thu hồi vs đã nộp:** có bất kỳ Submission → không xóa SessionExercise.  
4. **File archive vs đã phát:** ClassExerciseItem/SessionExercise giữ FK; discovery HS hiện **ẩn** file archived (nợ vs “vĩnh viễn” — ghi SEAM/UNKNOWN product).  
5. **pdfRef live:** đổi nội dung file đã giao = reject; title đổi tự do.  
6. **Cancelled session:** cron không phát; HS không discovery/save/download; staff chấm/nhật ký nháp vẫn được (publish nhật ký thì không).  
7. **Publish điểm vs sao:** sao neo Submission.id; re-publish/re-grade không nhân sao.  
8. **Gỡ enrollment:** quá khứ (buổi ≤ mốc) giữ; tương lai cắt — áp dụng đồng bộ bài tập + nhật ký + download.  
9. **Optimistic version vs dual-tab create:** version conflict / P2002 → CONFLICT reload.  
10. **Evidence upsert field absent vs []:** absent giữ; [] xóa — ưu tiên không mất dữ liệu khi client omit.

---

## 11. Bảng nhãn tổng hợp theo hạng mục

| Hạng mục | Nhãn chính | Ghi chú |
|---|---|---|
| Thư viện folder/file + archive không xóa blob | CHUẨN | |
| Import kho hàng loạt từ đĩa | THIẾU | spec có, code CRUD lẻ |
| Snapshot dãy lớp + partial update | CHUẨN | |
| Cron phát 1 bài/buổi, 14 ngày, 5 phút | CHUẨN | |
| Gap-aware next position + revoke on cancel | CHUẨN | |
| Roster D1 / unit stamp / archive day | CHUẨN | |
| Submission draft/submit/version/annotation | CHUẨN | |
| Grade scale 10 + block draft | CHUẨN | |
| Publish + STAR_REWARD 10 + partial unique | CHUẨN | |
| Unpublish điểm / hoàn sao | THIẾU (cố ý không làm) | product chốt |
| SessionEvidence draft/publish/unpublish/photos | CHUẨN | |
| Photo consent PH | THIẾU | |
| Upload rate limit env | TẠM | số vận hành |
| Discovery ẩn file archived sau khi đã phát | SEAM / nợ product | comment exercise.ts:464-465 |
| Gift/redeem/star spend | ngoài scope BR3 (rewards khác) | ledger type khác `gift_*` |

---

## Unknowns

1. Product chốt cuối: khi `ExerciseFile` bị archive sau khi đã phát — HS có được tiếp tục thấy/tải đề không? (code hiện **ẩn** discovery+download; comment ghi nợ chủ dự án).  
2. Có chính sách pháp lý “đồng ý đăng ảnh” ngoài hệ không? Code không enforce.  
3. Cơ chế import hàng loạt thư viện (đường dẫn đĩa / tool) ngoài seed — chưa thấy API production.  
4. `Grade.rubric` Json — schema có, API grade **không** set/đọc; UNKNOWN intentional vs leftover.  
5. `Submission.archivedAt` / `SessionEvidence.archivedAt` — field có; đường API archive submission/evidence **không** thấy mutation riêng trong các router đã đọc (chỉ filter null).  
6. Hành vi re-publish điểm khi `isPublished` đã true: sao = 0 (OK); có UI confirm riêng không — ngoài scope backend.

---

Status: DONE | Summary: Đặc tả đủ implement lại pipeline thư viện→dãy lớp→cron phát 1 bài/buổi (gap-aware, revoke khi hủy nếu chưa nộp)→HS draft/submit/annotation→chấm [0,10]→publish +10 sao idempotent theo Submission.id→nhật ký draft/ảnh/publish/unpublish với filter PH; gán nhãn CHUẨN/TẠM/THIẾU/SEAM và liệt kê hằng số/unknowns.
