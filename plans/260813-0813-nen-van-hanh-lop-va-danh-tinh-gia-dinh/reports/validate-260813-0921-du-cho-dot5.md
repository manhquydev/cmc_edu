# Validate — Đủ chưa để mở khóa Đợt 5?

**Góc:** kiểm kế hoạch A1–A5 + B1 có **thi hành được** và có **đủ chỗ chứa + hợp đồng ánh xạ** để Đợt 5 (nhập từ `cmc-lms` freeze `031d193`) chạy được hay không. Đây **không** phải red-team.

**Phạm vi đọc:** `plan.md`, `phase-a1`…`phase-a5`, `phase-b1`, `reports/redteam-adjudication-260813-0849.md`, `plans/260812-1407-hop-nhat-lms-theo-chuan-van-hanh/phase-05-dot-e-import-va-cutover.md`, schema hai repo.

**Nguồn:** `/home/manhquy/Downloads/cmc-lms/packages/db/prisma/schema.prisma` (40 model, dòng 164–927).
**Đích:** `/home/manhquy/Downloads/cmc_edu/packages/db/prisma/schema.prisma` (55 model).

Quy ước: **DUNG** / **SAI** / **KHONG KIEM DUOC**. Mỗi kết luận kèm `file:dong`.

---

## Kết luận ngắn

**SAI — sau A1–A5 + B1, Đợt 5 vẫn bị chặn.** A1–A5 vá được đúng những lỗ schema mà red-team đã chỉ (khoá buổi, giáo viên buổi, enum lớp, vòng đời, hồ sơ HS, bảng bài học). Chúng **không** viết hợp đồng nhập, **không** khóa hết khoá ổn định xuyên hệ, **không** xử lý chuyển đổi `@db.Date` + `HH:mm` → `Timestamptz`, và **không** gỡ các chặn cứng đã ghi trong chính phase-05 (script chưa có, bảng gói bán trống, `facilityId`).

---

## (1) 40 bảng nguồn vs chỗ chứa đích

Đếm **DUNG**: `rg -n '^model '` trên schema nguồn = đúng 40 model (`cmc-lms` `schema.prisma:164–916`).

Cột **Sau A1–A5**: chỗ chứa **lược đồ** nếu thi hành đúng phase, chưa kể script nhập (script thuộc Đợt 5).

| # | Nguồn (`cmc-lms`) | Dòng nguồn | Đích hiện tại | Sau A1–A5 | Chỗ chứa? | Ghi chú |
|---|-------------------|------------|---------------|-----------|-----------|---------|
| 1 | `AppUser` | 164 | `AppUser` 1197 | giữ | **Có, lệch khoá** | Nguồn: `email` unique (167). Đích: `userId` + `employeeCode` unique, `email` mặc định `""` (1199–1210). A1–A5 **không** công bố khoá giáo viên. |
| 2 | `Course` | 185 | `Course` 618 | giữ | **Có, lệch** | Nguồn: `code` unique + `program` unique (188–190). Đích: facility-scoped, **không** unique `program` (618–628). |
| 3 | `CurriculumUnit` | 201 | `CurriculumUnit` 782 | A5 thêm `sessionMinutes` | **Có, thiếu `unitCode`** | Nguồn `unitCode` unique (206). Đích unique `(program, orderGlobal)` (801). A5 không thêm `unitCode`. |
| 4 | `CurriculumLesson` | 228 | **không có** | A5 tạo bảng | **Có sau A5** | A5:78–82. Khoá xuyên hệ **chưa chốt** (A5:40–42). |
| 5 | `Student` | 251 | `Student` 423 | A4 thêm 4 trường | **Có sau A4, còn cột dư** | A4:79–84 thêm `studentCode`/`dateOfBirth`/`gender`/`note`. Nguồn còn `program`/`level`/`archivedAt` (261–263) — A4 **không** nhận. |
| 6 | `ClassBatch` | 286 | `ClassBatch` 651 | A2 đổi status enum | **Có, lệch cột** | Nguồn **không** có `teacherId`/`endDate`. Đích `endDate` **bắt buộc** Timestamptz (658). Nguồn có `note`/`archivedAt` (299–301) — A1–A5 không thêm. |
| 7 | `ParentMeeting` | 312 | `ParentMeeting` 1701 | không đụng | **Có tên, SAI hình** | Nguồn: theo lớp, `title`/`location`/`note`, unique `(classBatchId, scheduledAt)` (315–327). Đích: theo `studentId`, không FK Student, không `title` (1701–1711). |
| 8 | `ScheduleSlot` | 333 | `ScheduleSlot` 706 | A1 thêm lưu trữ | **Có, thiếu cột** | A1:79 thêm `archivedAt`. Nguồn còn `teacherId` + `effectiveFrom @db.Date` (340–346). A1 **không** thêm hai cột này. |
| 9 | `ClassSession` | 366 | `ClassSession` 731 | A1 GV + khoá; A3 lý do hủy; A5 FK bài | **Có sau A1–A5, lệch kiểu ngày** | Nguồn: `sessionDate @db.Date` + `startTime` String (370–372). Đích: cả ba `Timestamptz` (739–741). |
| 10 | `Enrollment` | 396 | `Enrollment` 568 | không đụng | **Có** | Nguồn unique `(classBatchId, studentId)` (409). Đích: unique từng phần SQL `(facilityId, studentId, classBatchId) WHERE reserved/active` (`20260706054322…/migration.sql:80`). |
| 11 | `EnrollmentUnitRange` | 416 | `EnrollmentUnitRange` 596 | không đụng | **Có** | Đích thêm `sourceReceiptId?` unique (603). Red-team bác “chặn cứng” vì cột nullable (`adjudication:14`). Chính sách tạo HS ngoài phiếu thu **còn mở cho Đợt 5**. |
| 12 | `Attendance` | 429 | `Attendance` 1006 | không đụng | **Có, thiếu cột** | Nguồn: `excused`, `note`, `markedById?` (437–439). Đích: **không** `excused`/`note`; `markedById` **bắt buộc** (1013–1014). |
| 13 | `SessionEvidence` | 449 | `SessionEvidence` 1153 | không đụng | **Có** | 1:1 theo buổi cả hai bên (452 / 1156). |
| 14 | `SessionEvidencePhoto` | 471 | `SessionEvidencePhoto` 1176 | không đụng | **Có** | Nguồn `photoRef` (476). Đích `blobRef` (1180). Ánh xạ blob = E-4, không thuộc A1–A5. |
| 15 | `SessionStudentComment` | 484 | không cùng tên | **không tạo bảng** | **Ghép vào đích đã có** | Đích `QualitativeAssessment.classSessionId` (1124–1128). `plan.md:140–144` + A3: bỏ bảng mới; ghép 4 ô lúc nhập = **Đợt 5**. |
| 16 | `BatchCodeCounter` | 505 | `ClassBatchCodeCounter` 1032 | không đụng | **Có, khác hạt** | Nguồn PK `year` (507). Đích unique `(facilityId, program, year)` (1040). Bộ đếm nguồn **không** nhập nguyên văn. |
| 17 | `StudentCodeCounter` | 513 | **không có** | A4 tạo | **Có sau A4** | A4:89–90, 105. |
| 18 | `RecordEvent` | 522 | không có (khác `AuditLog`) | không đụng | **Không chỗ chứa** | A1–A5 im lặng. `AuditLog` 1092 là vết nhân sự, không phải timeline LMS. |
| 19 | `RecordFollower` | 536 | **không có** | không đụng | **Không chỗ chứa** | A1–A5 im lặng. |
| 20 | `ParentAccount` | 548 | `ParentAccount` 452 | B1 xác thực | **Có** | Nguồn `phone?` unique (551). Đích `phone` **bắt buộc** unique (454). Nguồn `displayName` (552) — đích không có. |
| 21 | `StudentAccount` | 566 | `StudentAccount` 473 | B1 ranh giới #5 **chưa chốt** | **Có, khoá `loginCode` mở** | Nguồn `loginCode` unique, comment “migrate giữ nguyên chuỗi” (`cmc-lms` 565–570). Đích **không** có `loginCode` (473–491). B1:80. |
| 22 | `Guardian` | 579 | `Guardian` 515 | không đụng | **Có, enum hẹp hơn** | Unique `(parentAccountId, studentId)` cả hai (589 / 533). Nguồn enum có `grandparent`/`other` (`cmc-lms` 143–148). Đích chỉ `father`/`mother`/`guardian` (80–84). |
| 23 | `GuardianLinkRequest` | 594 | `GuardianLinkRequest` 544 | không đụng | **Có, lệch cột** | Nguồn: `studentPhone`/`studentCode`/`matchedStudentId`. Đích: một `studentRef` (548). |
| 24 | `ExerciseFolder` | 620 | `ExerciseFolder` 810 | không đụng | **Có** | Cả hai global, `name` không unique. |
| 25 | `ExerciseFile` | 636 | `Exercise` 827 | không đụng | **Có (đổi tên)** | Unique `(folderId, orderInFolder)` cả hai (653 / 845). Đích thêm `type`/`status` bắt buộc. |
| 26 | `ClassExerciseItem` | 660 | `ClassExerciseItem` 857 | không đụng | **Có** | Unique `(classBatchId, position)` (673 / 868). |
| 27 | `SessionExercise` | 681 | `SessionExercise` 877 | không đụng | **Có** | 1:1 buổi (684 / 880). |
| 28 | `Submission` | 699 | `Submission` 908 | không đụng | **Có** | Unique `(sessionExerciseId, studentId)` (715 / 940). |
| 29 | `Grade` | 721 | **không có bảng** | không đụng | **Gấp vào `Submission`** | Đích `score`/`gradedAt`/`gradedById` trên `Submission` (931–933). Mất `feedback`/`rubric`/`isPublished` (726–732). |
| 30 | `Gift` | 740 | `Gift` 1662 | không đụng | **Có** | Nguồn `name` unique toàn cục (743). Đích facility-scoped, không unique tên (1665–1674). |
| 31 | `StarTransaction` | 761 | `StarTransaction` 980 | không đụng | **Có** | Nguồn `reference`. Đích `refType`+`refId` (985–987). |
| 32 | `Reward` | 776 | `Reward` 1681 | không đụng | **Có** | Cùng ý đổi quà. |
| 33 | `Notification` | 796 | **không có** | không đụng | **Không chỗ chứa** | `EmailOutbox` 1070 là hàng đợi SMTP, không phải hộp thư trong app. |
| 34 | `Badge` | 812 | **không có** | không xây | **Cố ý bỏ** | `plan.md:46`. |
| 35 | `StudentBadge` | 827 | **không có** | không xây | **Cố ý bỏ** | `plan.md:46`. |
| 36 | `LevelProgress` | 843 | **không có** | không xây | **Cố ý bỏ** | `plan.md:46`. |
| 37 | `GradingTemplate` | 863 | **không có** | không đụng | **Không chỗ chứa** | A1–A5 im lặng. |
| 38 | `QualitativeAssessment` (học bạ kỳ) | 878 | `QualitativeAssessment` 1124 | không đụng | **Có tên, SAI hình** | Nguồn: `period` enum + `periodKey` + `criteria` Json, unique `(studentId, periodKey)` (885–893). Đích: `content` String, session **hoặc** `period` `YYYY-MM`, **không** unique (1128–1146). Một bảng đích đang gánh cả nhận xét buổi **và** học bạ kỳ. |
| 39 | `FinalGrade` | 896 | `FinalGrade` 955 | không đụng | **Có tên, SAI hình** | Nguồn: `(studentId, program, periodKey)` + 4 thành phần điểm (899–912). Đích: `(studentId, classBatchId, period YYYY-MM)` + một `score` (959–968). |
| 40 | `AcademicTerm` | 916 | **không có** | không đụng | **Không chỗ chứa** | `startDate`/`endDate` `@db.Date` (920–921). A1–A5 im lặng. |

### Tóm bảng (1)

| Nhóm | Số | Kết luận |
|---|---|---|
| Có chỗ chứa khớp đủ để nhập (sau A1–A5) | 18 | Course*, Unit*, Enrollment, UnitRange, Evidence, Photo, Folder, Exercise, ClassExerciseItem, SessionExercise, Submission, Gift, StarTxn, Reward, Guardian*, LinkRequest*, ParentAccount*, BatchCounter* — dấu * = lệch cột/khoá, nhập được nếu Đợt 5 viết ánh xạ |
| A1–A5 **tạo** chỗ chứa đang thiếu | 4 | `CurriculumLesson` (A5), 4 trường HS + `StudentCodeCounter` (A4), `ClassSession.teacherId`+khoá (A1), lý do hủy + enum lớp (A2/A3) |
| Cố ý không xây | 3 | Badge, StudentBadge, LevelProgress — `plan.md:46` |
| **Không chỗ chứa sau A1–A5** | 6 bảng | `RecordEvent`, `RecordFollower`, `Notification`, `GradingTemplate`, `AcademicTerm`, và `ParentMeeting`/`FinalGrade`/QA kỳ **sai hình đến mức không nhét được nguyên vẹn** |
| **Cột nguồn không có chỗ sau A1–A5** | xem dưới | `ScheduleSlot.teacherId`/`effectiveFrom`; `Attendance.excused`/`note`; `ClassBatch.note`/`archivedAt`; `ClassSession.archivedAt`; `Student.program`/`level`; `CurriculumUnit.unitCode`; `StudentAccount.loginCode`; `GuardianRelation.grandparent/other`; `ParentAccount.displayName`; `Grade.feedback`/`rubric` |

**DUNG:** sau A1–A5 vẫn còn bảng/cột nguồn **không có chỗ chứa** ở đích.

**KHONG KIEM DUOC:** prod `cmc-lms` lúc nhập còn bao nhiêu hàng `Notification` / `RecordEvent` / `AcademicTerm` / `GradingTemplate` / `ParentMeeting` / học bạ kỳ — phase-05 chỉ công bố 10 PH · 11 HS · 11 lớp · 137 buổi (`phase-05:23`), không đếm bảng phụ.

---

## (2) Cạm bẫy E-1 … E-12

Nguồn checklist: `phase-05:33–46`.

| # | A1–A5 / B1 xử lý? | Kết luận | Bằng chứng |
|---|-------------------|----------|------------|
| **E-1** bảng phụ bị quên | **Một phần schema, chưa có checklist nhập** | **HO** | Sự cố gốc: nhập lớp+buổi, **0 `ScheduleSlot`** (`phase-05:35`). Đích **đã có** `ScheduleSlot` (706). A1 thêm lưu trữ khung, **không** viết checklist FK (`phase-a1:75–84`). Sau A1 vẫn thiếu `ScheduleSlot.teacherId`/`effectiveFrom` (`cmc-lms` 340–346 vs đích 706–716) — đúng triệu chứng “đổi GV không có tác dụng” nếu GV nằm trên khung. Các vệ tinh khác (Attendance, Evidence, Photo, Enrollment, UnitRange, SessionExercise, Submission, Guardian) đã có bảng nhưng A1–A5 **không** lập danh sách bắt nhập. |
| **E-2** copy enum trạng thái | **A2 xử lý lớp** | **Lớp: DUNG đã xử lý. Buổi/ghi danh: HO** | A2:40–58 bảng ánh xạ 5 giá trị nguồn → `{running, closed, cancelled}`; `open`/`planned` → `running`. **Không** có bảng ánh xạ `SessionStatus`: nguồn `{planned, confirmed, cancelled}` (`cmc-lms` 57–61); đích thêm `done` (137–142). **Không** có ánh xạ `EnrollmentStatus` (nguồn mặc định `active` 403; đích mặc định `reserved` 577). |
| **E-3** GV NULL trên buổi | **A1 tạo cột + backfill dữ liệu đích** | **Schema: DUNG. Nhập nguồn: HO** | A1:54–61, 83–84 thêm `ClassSession.teacherId`, backfill từ **lớp**. Nguồn **không có** `ClassBatch.teacherId` (`cmc-lms` 286–309) — GV nằm trên `ScheduleSlot.teacherId` và `ClassSession.teacherId` (340, 373). Backfill A1 chỉ đúng dữ liệu mẫu đích. Đợt 5 phải lấy GV từ buổi/khung nguồn; A1–A5 **không** viết ánh xạ đó. |
| **E-4** blob ≠ hàng DB | Không | **HO** | `phase-05:38`. A1–A5 không đụng `@cmc/storage` / `blobRef`. |
| **E-5** lệch múi giờ ngày | A4 chỉ nhắc ngày sinh | **HO** — xem mục (3) | A4:101–102, 134. A1–A5 **không** nói `ictToUtc` cho buổi/lớp. |
| **E-6** bịa dữ liệu | A1/A2 nhắc “để trống và hỏi” | **Một phần — chỉ văn bản** | A1:103; A2:61–62. Chưa thành cổng dry-run. |
| **E-7** giữ nguyên hash | Hoãn sang Đợt 5 | **HO (cố ý)** | `plan.md:47`; B1:85–86 dồn một hàm để Đợt 5 thêm nhánh bcrypt. |
| **E-8** đĩa đầy | Không | **HO** | `phase-05:42`. Vận hành cutover, không thuộc A1–A5. |
| **E-9** gửi ≠ đến | Không | **HO** | `phase-05:43`. |
| **E-10** tài liệu lệch số liệu | Không | **HO** | `phase-05:23` là ảnh chụp 07/08. Đợt 5 phải truy vấn lại. |
| **E-11** backup + mốc hoàn tác | Không | **HO** | `phase-05:45`. |
| **E-12** chưa có lớp chạy lâu | A3 viết chính sách đóng băng; không mô phỏng lớp dài | **HO** | `phase-05:46`. A3:48–53 là chính sách hồi sinh, không phải mô phỏng tiến trình unit trên dữ liệu thật. |

**Đặc biệt bốn mục được hỏi:**

- **E-1 — HO.** Có bảng khung rồi, nhưng checklist vệ tinh + cột GV/hiệu lực trên khung vẫn thiếu.
- **E-2 — HO một nửa.** Hợp đồng lớp có (`phase-a2:52–58`). Buổi và ghi danh chưa có.
- **E-3 — HO lúc nhập.** Cột buổi sẽ có sau A1; đường lấy GV từ nguồn (buổi/khung, không phải lớp) chưa viết.
- **E-5 — HO.** Xem (3).

---

## (3) Múi giờ: `@db.Date` + `HH:mm` ICT → `Timestamptz`

### Sự thật hai schema — DUNG

Nguồn (`cmc-lms`):

| Cột | Kiểu | Dòng |
|---|---|---|
| `Student.dateOfBirth` | `@db.Date` | 256 |
| `ClassBatch.startDate`, `currentUnitAnchor` | `@db.Date` | 297–298 |
| `ScheduleSlot.effectiveFrom` | `@db.Date` | 346 |
| `ScheduleSlot.startTime`/`endTime` | `String` HH:mm ICT | 338–339 |
| `ClassSession.sessionDate` | `@db.Date` | 370 |
| `ClassSession.startTime`/`endTime` | `String` | 371–372 |
| `AcademicTerm.startDate`/`endDate` | `@db.Date` | 920–921 |

Đích (`cmc_edu`):

| Cột | Kiểu | Dòng |
|---|---|---|
| `ClassBatch.startDate`/`endDate` | `Timestamptz` | 657–658 |
| `ClassBatch.currentUnitAnchor` | `@db.Date` (cột `@db.Date` **duy nhất** của đích) | 676 |
| `ScheduleSlot.startTime`/`endTime` | `String` HH:mm ICT | 712–715 |
| `ClassSession.sessionDate` | `Timestamptz`, comment “ICT midnight” | 736–739 |
| `ClassSession.startTime`/`endTime` | `Timestamptz` | 740–741 |

Hàm chuyển đổi **đã có** ở đích: `ictToUtc(dateOnly, timeOfDay)` và `ictDateOnlyOf` — `packages/domain-time/src/index.ts:32–57`.

### A1–A5 có xử lý chuyển đổi này không?

**SAI — chưa xử lý, còn ngỏ.**

- `rg` trong thư mục plan `260813-0813-nen-van-hanh-lop-va-danh-tinh-gia-dinh/` (trừ red-team cũ) **không** có `ictToUtc`, `Timestamptz`, `@db.Date`, hay “chuyển đổi” ngày buổi.
- A1 đổi khoá sang `(lớp, ngày, giờ bắt đầu)` (`phase-a1:67`) nhưng **không** nói ngày/giờ nguồn là `Date`+`String` còn đích là hai `Timestamptz`. Nếu unique đích so sánh instant, cùng một ngày ICT có thể thành hai hàng nếu import một lần parse UTC và một lần parse ICT.
- A4 ràng buộc 6 chỉ nói **ngày sinh** “lưu theo quy ước ngày của `cmc_edu`” và nhắc E-5 (`phase-a4:101–102, 134`). Không chỉ định `ictToUtc` / ICT midnight, không đụng `sessionDate`/`startDate`/`effectiveFrom`.
- A5 không đụng ngày.
- B1 không đụng ngày.

**DUNG:** đích đã có một chỗ chuẩn (`@cmc/domain-time`). **SAI:** A1–A5 không bắt Đợt 5 (hay chính A1) phải dùng đúng chỗ đó khi đổi kiểu buổi/lớp.

Cột `ScheduleSlot.effectiveFrom` nguồn (`cmc-lms` 346) **không có chỗ** ở đích sau A1 — đây vừa là lỗ cột vừa là lỗ ngày.

---

## (4) Khoá ổn định xuyên hệ

A5 nói đúng điều kiện Đợt 5 gắn 137 buổi vào bài (`phase-a5:34–42`) rồi **để ngỏ hai phương án** (`lessonCode` **hoặc** bộ ba chương trình / thứ tự unit / thứ tự bài). Bước 2 = “chọn và ghi ra” (A5:81) — **chưa chọn**.

| Thực thể | Khoá tự nhiên nguồn | Đích sau A1–A5 | Kế hoạch có nói? | Đủ để nhập? |
|---|---|---|---|---|
| **Bài học** | `lessonCode` unique (`cmc-lms` 234) | A5 sẽ tạo bảng; khoá **chưa chốt** | Có, nhưng **chưa công bố một khoá** (A5:40–42, 81) | **Chưa** |
| **Unit** | `unitCode` unique (206) | Unique `(program, orderGlobal)` (801); **không** `unitCode` | A5 không công bố khoá unit để gắn `ClassSession.curriculumUnitId` | **Chưa** — buổi nguồn trỏ UUID unit nguồn |
| **Học sinh** | `studentCode` unique (253) | A4 thêm và **giữ nguyên văn** (A4:100, 105) | Có | **Đủ cho HS** |
| **Lớp** | `ClassBatch.code` unique toàn cục (289) | Unique `(facilityId, code)` (693) | **Không** nói giữ mã lớp / thêm tiền tố cơ sở | **Chưa** |
| **Buổi** | `(classBatchId, sessionDate, startTime)` (388) | A1 đổi sang cùng bộ ba, nhưng đích `sessionDate`/`startTime` là `Timestamptz` (739–740) | A1 nói khoá lịch, **không** nói đây là khoá nhập hay cách so ngày | **Chưa** (dính E-5) |
| **Phụ huynh** | `phone?` unique (551) | `phone` unique bắt buộc (454). Phase-05 E1: ánh xạ theo SĐT (`phase-05:55`) | B1 dùng SĐT đăng nhập (B1:16–17) nhưng **không** công bố SĐT là khoá nhập Đợt 5. C0 chuyển Đợt 5 (B1:48) | **Một phần** — thiếu xử lý `phone` null nguồn |
| **Giám hộ** | `(parentAccountId, studentId)` (589) | Cùng unique (533) | Phase-05:86 nói đối soát quan hệ; A1–A5/B1 không viết bảng ánh xạ | **Chưa viết hợp đồng** |
| **Giáo viên** | `AppUser.email` unique (167) | `employeeCode` unique; email không unique cứng (1210, unique từng phần SQL) | **Không** | **Chưa** — E-3 không gắn được người |
| **Tài khoản HS** | `loginCode` unique (571) | Không cột; B1 ranh giới #5 chưa chọn (B1:80) | Có câu hỏi, **không** có câu trả lời | **Chưa** |

Thực thể khác cần khoá mà A5 không nhắc: **lớp, buổi, phụ huynh, giáo viên, unit, loginCode**.

**SAI:** kế hoạch mới bắt buộc công bố khoá cho **bài học**, rồi vẫn chưa chốt. Các thực thể còn lại gần như im lặng (trừ `studentCode`).

---

## (5) Sau A1–A5 + B1, Đợt 5 còn bị chặn bởi gì

Chặn **không** phải “script nhập chưa viết” — đó là việc của chính Đợt 5. Chặn ở đây = **làm xong A1–A5+B1 rồi vẫn không được phép / không thể chạy E1 an toàn**.

| # | Chặn | Loại | Căn cứ |
|---|---|---|---|
| 1 | **Bảng gói bán → unit trống** | Chặn cứng Đợt 4, phase-05 tự ghi | `phase-05:19` “Trống — chặn cứng”. `phase-05:4` phụ thuộc đợt 2, 3, **4**. A1–A5+B1 **không** tạo model giá. |
| 2 | **`facilityId` cho mọi bảng facility-scoped** | Hợp đồng E1 chưa có | `phase-05:53–54`. Nguồn không có cơ sở. A1–A5 không chỉ định cơ sở đích / cấm mặc định mở. |
| 3 | **Chuyển đổi ngày/giờ buổi–lớp** | E-5 còn ngỏ | Mục (3). Không có một hàm bắt buộc trên đường nhập. |
| 4 | **Khoá ổn định chưa đủ** | E1 không gắn được hàng | Bài học chưa chốt (A5:40–42). Lớp / buổi / GV / unit / `loginCode` không có hợp đồng. |
| 5 | **Cột/bảng vẫn không có chỗ** | Mất dữ liệu lúc đóng LMS cũ | Mục (1): `effectiveFrom`, GV trên khung, `excused`/`note`, `ClassBatch.endDate` bắt buộc trong khi nguồn không có cột, `ParentMeeting`/`FinalGrade`/QA kỳ sai hình, 6 bảng không chỗ. |
| 6 | **Ánh xạ GV nguồn → buổi đích** | E-3 lúc nhập | Nguồn không có GV lớp (`cmc-lms` 286–309). A1 backfill từ lớp đích. |
| 7 | **C0 mật khẩu null trên dữ liệu nguồn** | B1 đẩy sang Đợt 5 | B1:42–49; `plan.md:65`. Phải chạy trên DB `cmc-lms` trước khi nhập. |
| 8 | **Hash bcrypt (nguồn) ↔ hàm đích** | Hoãn có chủ ý | `plan.md:47`. B1 chỉ chuẩn bị một hàm (`B1:85–86`), chưa có nhánh. |
| 9 | **B1 còn 8 ranh giới chưa chọn** | Có thể làm lệch hình danh tính lúc nhập | B1:74–83 (claim token, giết phiên, registry `family`, `passwordHash` NOT NULL, giữ/bỏ `StudentAccount`+`loginCode`, trần thử, quên mật khẩu, chiến lược PR). |
| 10 | **Chính sách HS ngoài phiếu thu** | Không chặn schema, chặn nghiệp vụ | Adjudication B1 (`adjudication:14`): `createdByReceiptId` nullable (430). Đợt 5 vẫn phải được phép tạo HS “break-glass”. |
| 11 | **E-4 / E-8 / E-9 / E-11 / E-12** | Việc Đợt 5, chưa có tiền đề trong A | Đúng chỗ của phase-05; A1–A5 không pretends xử lý. |

Chặn **đã gỡ** so với plan mẹ 12/08:

- Ánh xạ `blocked_lms` → `on_hold` — **DUNG đã chốt** (`plan.md:64`, A4:23–27). Đây từng là mục 3 chặn Đợt 5 ở `plan.md` mẹ dòng 122.
- Hồ sơ 4 trường HS — A4 nhận.
- Enum lớp + bảng ánh xạ E-2 (lớp) — A2 nhận.
- Cột GV buổi — A1 nhận.
- Bảng bài học — A5 nhận (khoá thì chưa).

---

## Kế hoạch A1–A5+B1 có thi hành được không?

**DUNG — thi hành được như một gói nền**, sau red-team 13/08 (`adjudication:84–92` đã tách A1, viết lại nhận xét, thêm giao thức trộn nhánh). Thứ tự A1→A5 và B rebase lên A (`plan.md:130–132`) khớp file chung.

**SAI — không đủ để mở khóa Đợt 5.** Phase-05 vẫn cần: hợp đồng ánh xạ E1 (cơ sở, ngày giờ, khoá, GV, trạng thái buổi/ghi danh), chỗ chứa còn thiếu hoặc tuyên bố bỏ có chủ đích, gói bán Đợt 4, C0 + thuật toán hash, rồi mới tới script.

Việc Đợt 5 **được phép bắt đầu soạn E1 trên giấy** ngay bây giờ (đọc-only nguồn). Việc Đợt 5 **được phép dry-run ghi đích** thì chưa.

---

## Việc A1–A5 nên bổ sung nếu muốn mở Đợt 5 sớm

Không yêu cầu làm trong validate này. Chỉ liệt kê lỗ **trong phạm vi nền** (không phải việc cutover):

1. A1 hoặc phụ lục E1: `sessionDate`/`startTime` nguồn = `ictToUtc(date, time)`; `sessionDate` đích = `ictToUtc(date, '00:00')`. Một hàm, một test lệch −1 ngày.
2. A5: **chốt một** khoá bài — `lessonCode` nguồn đã unique (`cmc-lms` 234); ghi luôn khoá unit `(program, orderGlobal)`.
3. A1: thêm `ScheduleSlot.effectiveFrom` + `teacherId` trên khung, hoặc viết tường minh “GV khung đổ hết sang buổi, khung đích không lưu GV” và chấp nhận mất chỗ đổi GV theo khung.
4. A4: thêm `Gender` enum; tuyên bố `Student.program`/`level` nguồn bỏ hay giữ.
5. A2: bảng ánh xạ `SessionStatus` và `EnrollmentStatus`.
6. Plan: tuyên bố bỏ hoặc giữ `AcademicTerm`, `GradingTemplate`, `Notification`, `RecordEvent`/`RecordFollower`, hình `ParentMeeting`/`FinalGrade`/QA kỳ — đừng để Đợt 5 đoán.
7. B1: chốt `loginCode` và SĐT null trước khi nhập.
8. Đợt 4 gói bán vẫn là chặn cứng riêng (`phase-05:19`) — A1–A5 không thay được.

---

Status: DONE_WITH_CONCERNS
Summary: A1–A5+B1 thi hành được như nền lược đồ nhưng chưa mở được Đợt 5 — còn lỗ chỗ chứa (khung GV/`effectiveFrom`, điểm danh excused, học bạ/họp PH sai hình, 6 bảng không nhà), E-1/E-2/E-3/E-5 vẫn thủng lúc nhập, khoá xuyên hệ mới đủ cho mã học sinh, và phase-05 vẫn chặn cứng vì gói bán trống + `facilityId` + C0/hash.
