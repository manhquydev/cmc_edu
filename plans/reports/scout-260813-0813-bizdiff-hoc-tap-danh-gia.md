# Scout — đối sánh năng lực HỌC TẬP VÀ ĐÁNH GIÁ

**Phạm vi:** CurriculumLesson, SessionStudentComment, Grade, GradingTemplate, FinalGrade, AcademicTerm, thang điểm, sao thưởng, Badge/StudentBadge/LevelProgress.

**Nguồn (chuẩn nghiệp vụ, freeze):** `/home/manhquy/Downloads/cmc-lms` @ `031d193` (xác minh `git rev-parse` = `031d193`).

**Đích (ERP+LMS, chưa production):** `/home/manhquy/Downloads/cmc_edu` @ `af85b78` (thời điểm scout).

**Phương pháp:** ak-scout, chỉ đọc. Mỗi khẳng định có `file:dòng` hai bên; không thấy thì ghi «không tìm thấy».

**Quyết định chủ hệ thống (nhiệm vụ này):** đích **phải xây** `CurriculumLesson` và `SessionStudentComment`. **Không** xây Badge / StudentBadge / LevelProgress — vẫn liệt kê `BO DUOC` để đủ hồ sơ.

**Quy ước mức độ**

| Mức | Nghĩa trong bảng này |
|-----|----------------------|
| `BAT BUOC` | Chủ hệ thống đã chốt xây ở đích, hoặc đây là năng lực đang chạy thật ở nguồn mà đích không có tương đương. |
| `NEN CO` | Có ở nguồn (hoặc lệch hợp đồng với nguồn) nhưng chưa được chủ hệ thống chốt bắt buộc trong nhiệm vụ này. |
| `BO DUOC` | Schema/seed nguồn không có router người dùng, hoặc đích đã có bản khác chủ đích chọn, hoặc chủ hệ thống cấm xây. |

---

## Bảng đối sánh

| Năng lực | cmc-lms (file:dòng) | cmc_edu (file:dòng hoặc THIEU) | Mức độ + lý do |
|----------|---------------------|--------------------------------|----------------|
| Xem bài học (topic) trong unit: `content` / `thinkingGoal` / `lessonCode` | Model `CurriculumLesson` `packages/db/prisma/schema.prisma:227-247`. Seed: mỗi dòng CSV = 1 lesson `packages/db/src/seed-curriculum.ts:3`, upsert `packages/db/src/seed-curriculum.ts:297-314`. Admin đọc qua `curriculum.listUnits` nest `lessons` `apps/api/src/routers/curriculum.ts:15-37`. UI `apps/web/src/admin/curriculum-page.tsx:102-108`. | **THIEU** model/router `CurriculumLesson` (grep `packages/db/prisma/schema.prisma` = không tìm thấy). Import gom nhiều topic → 1 `CurriculumUnit`, title = `unit_code` + `chu_de`, **không** ghi `bai_hoc` / tư duy `packages/db/prisma/import-curriculum-units.mjs:1-4`, `:174-186`. `curriculumUnit.list` DTO không có lessons `apps/api/src/exercise/router.ts:27-41`, `:120-126`. | **BAT BUOC** — chủ hệ thống đã chốt xây; nguồn đang vận hành catalog topic, đích làm mất nội dung bài học khi gom CSV. |
| Gắn một lesson vào buổi học (`ClassSession.curriculumLessonId`) | Cột + FK `packages/db/prisma/schema.prisma:380-381`. Seed demo ghi `packages/db/src/seed-demo-student.ts:325-336`. **không tìm thấy** procedure nào trong `apps/api` ghi cột này. | **THIEU** cột. `ClassSession` chỉ có `curriculumUnitId` `packages/db/prisma/schema.prisma:743-757`. Writer duy nhất: `classSession.assignUnit` `apps/api/src/class/class-session-router.ts:335-366`. | **NEN CO** — nguồn có cột nhưng chưa có router ghi; nếu xây `CurriculumLesson` thì cần writer buổi, nếu không lesson chỉ còn catalog. |
| Nhận xét từng HS sau mỗi buổi (template 4 trường) | Model `SessionStudentComment` unique `(sessionEvidenceId, studentId)` `packages/db/prisma/schema.prisma:484-499`. Template `participation/strength/needsImprovement` + `teacherNote` `apps/api/src/routers/session-evidence.ts:17-39`. GV lưu `sessionEvidence.upsertDraft` `apps/api/src/routers/session-evidence.ts:296-374` (`comments` `:305`, persist `:359-368`). Publish **bắt buộc** có comment `apps/api/src/routers/session-evidence.ts:434`. UI checklist `apps/web/src/teacher/session-journal-page.tsx:413-416`. | **THIEU** model (grep schema = không tìm thấy). `SessionEvidence` chỉ `photos` `packages/db/prisma/schema.prisma:1149-1171`. Staff DTO không có comments `apps/api/src/session-evidence/router.ts:36-47`. `upsert`/`publish` chỉ summary + ảnh `apps/api/src/session-evidence/router.ts:156-208`, `:298-338` (publish chỉ chặn 0 ảnh `:324-326`). UI «tóm tắt + ảnh» `apps/admin/src/pages/teaching/session-evidence.tsx:1-2`. | **BAT BUOC** — chủ hệ thống đã chốt xây; nguồn đang chặn publish nhật ký nếu thiếu nhận xét từng em. |
| PH/HS đọc nhận xét từng buổi đã publish | `sessionEvidence.listForPrincipal` lọc comment theo `studentId` `apps/api/src/routers/session-evidence.ts:469-499`. `detailForPrincipal` `apps/api/src/routers/session-evidence.ts:502-525`. UI `apps/web/src/lms/journal-detail-page.tsx:374-413`. | **THIEU** comment trên nhật ký. `listForChild` DTO chỉ `summary` + `photos` `apps/api/src/session-evidence/router.ts:50-57`, `:349`. Thay thế khác hình: `QualitativeAssessment` văn tự do `packages/db/prisma/schema.prisma:1124-1147`; PH đọc `assessment.listForChild` (chỉ `confirmed`) `apps/api/src/assessment/router.ts:403-456`; parent home in `content` `apps/lms/src/pages/parent/home.tsx:79-110`. | **BAT BUOC** — PH nguồn thấy 4 trường trên nhật ký buổi; đích không đính comment vào evidence (QA là kênh khác, xem dòng dưới). |
| Đánh giá định tính (AI/GV, session hoặc tháng) | Model `QualitativeAssessment` period `MONTHLY`/`END_LEVEL` + `criteria` JSON + `narrative` `packages/db/prisma/schema.prisma:157-160`, `:878-894`. Seed ghi `packages/db/src/seed-demo-student.ts:738-773`. **không tìm thấy** router/UI trong `apps/`. | **CO, khác hình.** Model `content` tự do, `classSessionId` **hoặc** `period` `YYYY-MM` `packages/db/prisma/schema.prisma:1124-1147`. Live: `draftComment`/`confirm`/`discard`/`listBySession`/`listForChild` `apps/api/src/assessment/router.ts:147-155`, `:191-458`. UI per-buổi `apps/admin/src/pages/teaching/session-assessment.tsx:1-5`; học bạ tháng `apps/admin/src/pages/teaching/report-cards.tsx:1-6`. Session-done **bắt** mỗi HS `present` có QA `confirmed` `apps/api/src/class/session-done.ts:10-12`, `:85-96`. | **NEN CO** (giữ QA đích) — nguồn có bảng nhưng không có procedure; đích đã chạy QA và gắn vào session-done. Không thay QA bằng `SessionStudentComment`. |
| Chấm điểm bài nộp vào bảng `Grade` riêng | Model `Grade` 1-1 `submissionId`, `score` Float, `feedback`, `isPublished` `packages/db/prisma/schema.prisma:719-735`. `submission.grade` upsert `apps/api/src/routers/submission.ts:443-506`. | **THIEU** model `Grade` (grep schema = không tìm thấy). Comment schema nói gộp Grade/FinalGrade `packages/db/prisma/schema.prisma:946-948`. Điểm nằm `Submission.score` Int? `packages/db/prisma/schema.prisma:931-932`. `submission.grade` ghi thẳng cột đó `apps/api/src/submission/router.ts:344-441` (`score` nguyên `apps/api/src/submission/router.ts:44-47`). | **NEN CO** — nguồn tách điểm khỏi bài nộp (có feedback/publish); đích gộp vào Submission và **không** có `feedback` trên grade input. Không bắt buộc tách bảng nếu thêm publish/feedback trên Submission. |
| Công bố điểm rồi mới lộ cho PH/HS (`isPublished`) | `redactGrade` che điểm khi chưa publish `apps/api/src/routers/submission.ts:153-166`. `submission.publish` `apps/api/src/routers/submission.ts:509-540`. UI GV `apps/web/src/teacher/grading-page.tsx:13-15`, `:181`. | **THIEU** `isPublished` / `submission.publish` (grep `apps/api/src/submission` = không tìm thấy procedure publish điểm). `listForChild` trả `score` ngay khi `status != draft` `apps/api/src/submission/router.ts:622-656`. PH thấy điểm lúc chấm `apps/lms/src/pages/parent/homework-results.tsx:58-70`. | **NEN CO** — nguồn đang vận hành «chấm ≠ công bố»; đích lộ điểm ngay khi chấm. Chủ hệ thống chưa chốt cổng này. |
| Thang điểm tối đa | Hằng `MAX_SCORE = 10` toàn hệ, không cột DB `packages/domain/src/grading-scale.ts:1-7`. Validate `[0, MAX_SCORE]`, cho điểm lẻ `packages/domain/src/grading-scale.ts:12-14`. API `apps/api/src/routers/submission.ts:453-454`. | **CO, khác.** `Exercise.maxScore` mặc định 10, cấu hình được `packages/db/prisma/schema.prisma:834`. `exercise.create` nhận `maxScore` `apps/api/src/exercise/router.ts:135`, `:187`. Chấm so với `exercise.maxScore` `apps/api/src/submission/router.ts:376-379`. Admin hiện số `apps/admin/src/pages/teaching/exercise-detail.tsx:259-262`. Điểm chấm **nguyên** `apps/api/src/submission/router.ts:46`. | **BO DUOC** (ép 10 cố định) — đích đã cấu hình per-bài. **NEN CO** điểm lẻ 7.5 nếu muốn khớp nguồn (`isValidScore` vs `z.number().int()`). |
| Cộng sao khi hoàn thành bài | Hằng `STAR_REWARD = 10` `packages/domain/src/grading-scale.ts:9-10`. Cộng **khi publish**, idempotent `apps/api/src/services/star-ledger.ts:13-27` gọi từ `submission.publish` `apps/api/src/routers/submission.ts:530`. | **CO, khác thời điểm + số.** `Exercise.starReward` mặc định 10 `packages/db/prisma/schema.prisma:835`. `exercise.create` nhận `starReward` `apps/api/src/exercise/router.ts:136`, `:188`. Cộng **khi chấm**, số lấy `exercise.starReward` `apps/api/src/submission/router.ts:414-432`. Test khóa `apps/api/src/submission/grade.test.ts:188-189`. PH thấy `+starReward sao` `apps/lms/src/pages/parent/homework-results.tsx:68-69`. | **BO DUOC** (copy «cộng 10 khi PUBLISH») — đích đã cộng lúc chấm, số theo bài. Đổi trigger sẽ lệch session-done / e2e hiện có. |
| Học bạ `FinalGrade` | Model giàu cột (`homeworkAvg`, `attendanceRate`, `testScore`, `qualitativeScore`, `finalScore`, `passed`, `complete`) khóa `(studentId, program, periodKey)` `packages/db/prisma/schema.prisma:896-914`. Seed ghi `packages/db/src/seed-demo-student.ts:775-789`. **không tìm thấy** router/service tính điểm. | **CO, đang chạy.** Model gọn: `score` khóa `(studentId, classBatchId, period)` `packages/db/prisma/schema.prisma:955-971`. `recomputeFinalGrade` `apps/api/src/submission/router.ts:143-219`. Công thức 0.7 bài + 0.3 chuyên cần `packages/domain-grading/src/compute-final-grade.ts:3-8`, `:45-65`. PH đọc `reportCard.getForChild` `apps/api/src/assessment/router.ts:465-519`. | **NEN CO** (giữ bản đích) — nguồn chỉ có bảng + seed; đích đã recompute khi chấm/điểm danh. Đừng thay bằng schema nguồn chưa gắn API. |
| Kỳ học `AcademicTerm` | Model `periodKey`, `startDate`/`endDate`, `isLocked` `packages/db/prisma/schema.prisma:916-927`. **không tìm thấy** router/UI. | **THIEU** model (grep schema = không tìm thấy). Kỳ = tháng ICT `YYYY-MM`: `ictMonthBounds` `packages/domain-time/src/index.ts:104-111`; input `period` `apps/api/src/assessment/router.ts:147-151`; UI học bạ `apps/admin/src/pages/teaching/report-cards.tsx:29`. Doc đích **kê** `AcademicTerm` dù schema không có `docs/10-data-model-v2.md:62`. | **BO DUOC** — nguồn không có procedure; đích đã bucket theo tháng ICT. |
| Công thức học bạ `GradingTemplate` | Model `formula`/`criteria`/`qualitativeWeight`/`quantitativeWeight` unique `(program, level)` `packages/db/prisma/schema.prisma:863-876`. **không tìm thấy** router/UI. | **THIEU** model (grep schema = không tìm thấy). Trọng số cứng `EXERCISE_WEIGHT = 0.7` / `ATTENDANCE_WEIGHT = 0.3` `packages/domain-grading/src/compute-final-grade.ts:18-19`. Doc đích kê `GradingTemplate` `docs/10-data-model-v2.md:66`. | **BO DUOC** — nguồn chưa gắn người dùng; đích đã có công thức code. |
| Huy hiệu `Badge` (catalog) | Model `packages/db/prisma/schema.prisma:812-825`. Seed 3 huy hiệu `packages/db/src/seed-demo-student.ts:688-705`. **không tìm thấy** router trong `apps/api` (kể cả `apps/api/src/routers/rewards.ts:18-34` chỉ đọc số sao). | **THIEU** model (grep schema = không tìm thấy). Doc vẫn kê `docs/10-data-model-v2.md:77`. | **BO DUOC** — chủ hệ thống cấm xây; nguồn cũng không có API trao/xem. |
| Trao huy hiệu `StudentBadge` | Model unique `(studentId, badgeId)` `packages/db/prisma/schema.prisma:827-840`. Seed `packages/db/src/seed-demo-student.ts:707-721`. **không tìm thấy** router. | **THIEU** (grep schema = không tìm thấy). | **BO DUOC** — cùng lệnh cấm. |
| Đề xuất lên cấp `LevelProgress` | Model `pending/approved/rejected` `packages/db/prisma/schema.prisma:129-133`, `:842-859`. Seed 1 dòng `approved` `packages/db/src/seed-demo-student.ts:724-736`. **không tìm thấy** router. | **THIEU** (grep schema = không tìm thấy). Doc vẫn kê `docs/10-data-model-v2.md:67`. | **BO DUOC** — cùng lệnh cấm; nguồn chỉ seed. |

---

## Năng lực đích có thêm (không phải lỗ nguồn)

Không tính «thiếu» theo chiều nguồn → đích. Ghi để khi thêm `SessionStudentComment` / `CurriculumLesson` **không** xóa nhầm:

| Đích đang làm | File:dòng |
|---------------|-----------|
| Session-done: mỗi HS `present` phải có QA `confirmed` + evidence publish ≥1 ảnh | `apps/api/src/class/session-done.ts:8-12`, `:85-107` |
| AI nháp nhận xét (`draftedBy: 'ai'`) rồi GV `confirm` | `apps/api/src/assessment/router.ts:191-335` |
| `maxScore` / `starReward` per bài, form tạo bài | `apps/api/src/exercise/router.ts:135-136`, `:187-188` |
| Recompute `FinalGrade` khi chấm / điểm danh | `apps/api/src/submission/router.ts:435-439`; `apps/api/src/attendance/router.ts:251-256` |

---

## Lệch tài liệu đích

`docs/10-data-model-v2.md:62-67,77` liệt kê `AcademicTerm`, `SessionStudentComment`, `Grade`, `GradingTemplate`, `LevelProgress`, `Badge`, `StudentBadge` như model đích. Grep `packages/db/prisma/schema.prisma` = **không tìm thấy** các model đó. Đây là trôi doc, không phải bằng chứng đích đã có.

---

## DE XUAT

Thứ tự ưu tiên (BAT BUOC trước, không đụng BO DUOC):

1. **`CurriculumLesson`** — bảng topic (`lessonCode`, `seqInUnit`, `content`/`bai_hoc`, `thinkingGoal`), seed từ CSV như nguồn `seed-curriculum.ts:297-314`, trả về trong `curriculumUnit.list` / trang khung chương trình. Import hiện tại `import-curriculum-units.mjs:1-4` đang bỏ topic.
2. **`SessionStudentComment`** — unique `(sessionEvidenceId, studentId)`, 4 trường template nguồn `session-evidence.ts:17-39`. Gắn `sessionEvidence.upsert` + chặn `publish` nếu chưa có comment (`session-evidence.ts:434`). PH đọc comment của đúng con trên nhật ký đã publish (không nhét vào `QualitativeAssessment.content`).
3. **Giữ `QualitativeAssessment` đích** — session-done và học bạ tháng đang phụ thuộc QA (`session-done.ts:10-12`, `report-cards.tsx:1-6`). Comment buổi ≠ nhận xét AI/tháng.
4. **Writer `ClassSession.curriculumLessonId`** (sau khi có lesson) — nguồn có cột nhưng chưa có API; đích hiện chỉ `assignUnit` unit.
5. **Quyết định cổng công bố điểm** — nguồn `submission.publish` + `redactGrade`; đích lộ điểm + cộng sao lúc chấm. Nếu muốn khớp vận hành nguồn: thêm `isPublished` (có thể trên `Submission`, không bắt buộc tách bảng `Grade`) và dời cộng sao sang publish.
6. **Điểm lẻ** — nguồn `isValidScore` cho 7.5; đích `score` Int. Chỉ làm nếu GV nguồn đang chấm lẻ.
7. **Không port** `GradingTemplate`, `AcademicTerm`, `Badge`, `StudentBadge`, `LevelProgress`. Không thay `FinalGrade` đích bằng schema nguồn (nguồn chưa có API tính điểm).
8. **Sửa doc** `docs/10-data-model-v2.md:62-67,77` cho khớp schema, tránh scout sau tưởng đích đã có các bảng đó.

---

## Unresolved

- `ClassSession.curriculumLessonId` nguồn: có schema + seed demo, **không tìm thấy** writer live trong `apps/api`.
- `GradingTemplate` / `AcademicTerm` / `FinalGrade` / `QualitativeAssessment` / `Badge` / `StudentBadge` / `LevelProgress` nguồn: có schema (+ seed demo), **không tìm thấy** procedure người dùng.
- Doc đích `docs/10-data-model-v2.md` kê model không có trong schema.

Status: DONE_WITH_CONCERNS
Summary: Đích thiếu hai năng lực nguồn đang chạy và đã được chủ hệ thống chốt xây — catalog `CurriculumLesson` (topic/tư duy) và `SessionStudentComment` trên nhật ký buổi; `QualitativeAssessment` đích không thay được comment template. Grade/publish/sao/thang điểm lệch hợp đồng nhưng đích đã có bản sống; Badge/LevelProgress/AcademicTerm/GradingTemplate nguồn không có API — xếp BO DUOC.
