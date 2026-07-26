# Schema Extraction Sâu: frappe/education vs frappe/lms

**Ngày**: 2026-07-25 21:09 | **Task**: GH-38 | **Phương pháp**: Python script trích JSON + code review  
**License**: education=GPLv3 (not-full), lms=AGPLv3-full → research only, NO code reuse  
**CWD**: `/home/manhquy/Downloads/cmc_edu`

---

## 1. SCHEMA EXTRACTION STATS

### Education Repo

**Source**: `/tmp/claude-1000/.../scratchpad/repos/education/education/education/doctype/`

| Metric | Value |
|--------|-------|
| DocTypes | **74** (từ script, 75 dirs nhưng 1 là test_records.json list) |
| Child Tables (`istable=true`) | **29** |
| Singles (`issingle=true`) | **7** |
| Total Fields | **706** |
| Link Fields (foreign keys) | **204** |

**Danh sách DocType tóm tắt** (74, theo CSV):
- Student (47 fields, 6 links)
- Fees (46 fields, 17 links)
- Program Enrollment (21 fields, 8 links)
- Assessment Result (21 fields, 10 links)
- Fee Schedule (35 fields, 12 links)
- Course Schedule (16 fields, 5 links)
- Assessment Plan (23 fields, 11 links)
- *... 67 DocType còn lại* (xem `education_summary.csv` trong scratchpad)

### LMS Repo

**Source**: `/tmp/claude-1000/.../scratchpad/repos/lms/lms/lms/doctype/`

| Metric | Value |
|--------|-------|
| DocTypes | **67** |
| Child Tables (`istable=true`) | **26** |
| Singles (`issingle=true`) | **2** |
| Total Fields | **743** |
| Link Fields (foreign keys) | **111** |

**Danh sách DocType tóm tắt** (67, theo CSV):
- LMS Settings (83 fields, 6 links) — **HUGE config doc**
- LMS Batch (62 fields, 6 links)
- LMS Question (65 fields, 0 links) — **chỉ chứa JSON câu hỏi**
- LMS Course (43 fields, 3 links)
- Fees (46 fields, 17 links)
- *... 62 DocType còn lại* (xem `lms_summary.csv` trong scratchpad)

---

## 2. LINK TOPOLOGY: HỆ THỐNG QUAN HỆ

### Education Core Relationships

```
Academic Year ← (Academic Term)
    ↓ (referenced by Course Schedule, Assessment Plan, etc.)
    
Program ← Program Course ← (Course)
    ↓
Program Enrollment ← Program Enrollment Course → Course Enrollment → Student
    ↓
Fees (17 links: student, program_enrollment, fee_schedule, ...)

Student ← (Student Applicant, Student Admission)
    ↓ (6 links: student_group, attendance, fees, assessment_result, ...)
    
Assessment Plan → (Academic Year, Academic Term, Program, Course, Student Group, Grading Scale, Instructor, Room, Assessment Group)
    ↓
Assessment Result (10 links) → Assessment Result Detail → Assessment Criteria
    ↓
Grading Scale → (Grading Scale Interval)
```

**Key observations**:
- **Program Enrollment** là điểm trung tâm kết nối tất cả: student + program + fees + assessment result
- **Assessment Plan** là "template" định nghĩa tiêu chí & thang điểm cho cohort (student_group + academic_year/term)
- **Fee Schedule** là template sinh ra **Fees** records cho từng student
- **Không có explicit "Enrollment Status"** — enrollment chỉ là link student → program

### LMS Core Relationships

```
LMS Course ← LMS Program Course ← (LMS Program)
    ↓
LMS Batch (62 fields) → LMS Batch Enrollment → (User)
    ↓
LMS Enrollment ← (LMS Assignment, LMS Badge, LMS Certificate, LMS Quiz)
    
LMS Quiz → LMS Quiz Question → LMS Question
    ↓
LMS Quiz Submission → LMS Quiz Result (contains scoring)

LMS Course Progress (11 fields) ← (LMS Lesson Note, LMS Video Watch Duration)
```

**Key observations**:
- **LMS Batch** = "offering" của course (instructor + students + schedule)
- **LMS Enrollment** = student ghi danh vào batch
- **LMS Settings** = GIANT single (83 fields) chứa tất cả config cộng certificates, badges, payments, Google Meet/Zoom
- **Không có explicit "Academic Year/Term"** — toàn bộ config trong single LMS Settings
- **Quiz không có weight** — mỗi question đơn giản có `marks`, tổng điểm = sum(marks)

---

## 3. LUỒNG NGHIỆP VỤ: ĐỌC TỪ CODE

### EDUCATION: Tuyển sinh → Ghi danh → Đánh giá → Thu phí

#### 3.1 Tuyển sinh (Student Applicant → Student)
**File**: `education/education/education/api.py` — `enroll_student()` hàm (dòng 28-69)
- Input: Student Applicant name
- **Step 1**: Map (get_mapped_doc) Student Applicant → Student record
- **Step 2**: Lấy student_category, program, academic_year, academic_term từ Student Applicant
- **Step 3**: Tạo mới **Program Enrollment** (chưa submit) với các trường trên
- Output: Program Enrollment instance (mới)
- **Nhận xét**: Không kiểm tra tuổi, điểm chuẩn, hay approval — chỉ mapping thông tin

#### 3.2 Ghi danh → Xếp lớp (Program Enrollment → Course Enrollment)
**File**: `education/education/education/doctype/program_enrollment/program_enrollment.py`
- Program Enrollment có `on_submit()` hook: sinh Course Enrollment records cho tất cả courses trong program
- Course Enrollment được gắn vào Student Group thông qua `Student Group Student` (child table)
- **Dependency**: `Program → Program Course → Course`, mỗi course phải nằm trong program

#### 3.3 Điểm danh (Mark Attendance)
**File**: `education/education/education/api.py` — `mark_attendance()` hàm (dòng 91-100)
- Input: students_present (JSON list), students_absent, course_schedule hoặc student_group + date
- Tạo **Student Attendance** records
- Tham chiếu: Student Attendance có fields: student, course_schedule, date, status (Present/Absent), student_group

#### 3.4 Đánh giá → Chấm điểm
**File**: `education/education/education/doctype/assessment_result/assessment_result.py` + `education/education/education/api.py`

**Assessment Plan Template**:
- Master record định nghĩa: student_group, academic_year, academic_term, assessment_group, grading_scale
- Child table `Assessment Plan Criteria` → Assessment Criteria (định nghĩa tiêu chí)

**Assessment Result** (kết quả chấm):
- Input: assessment_plan, student, details[] (từng tiêu chí + score)
- `validate_maximum_score()`: 
  - Lấy `get_assessment_details(assessment_plan)` → dict {assessment_criteria: maximum_score}
  - Gán `details[].maximum_score` từ dict
- `validate_grade()`:
  - Tính từng `details[].grade = get_grade(grading_scale, (score / max_score) * 100)` 
  - Tổng: `total_score = sum(details[].score)`
  - Tính overall: `grade = get_grade(grading_scale, (total_score / maximum_score) * 100)`

**`get_grade()` Implementation** (api.py dòng 359-382):
- Load Grading Scale Intervals từ Grading Scale master (lưu cache trong frappe.local)
- Sort intervals từ cao → thấp (reverse)
- Loop từ interval cao nhất: tìm interval đầu tiên mà percentage ≥ threshold
- Trả về grade_code tương ứng
- **Lưu ý**: Chỉ là ánh xạ tuyến tính, không có "curve grading" hay weighting

#### 3.5 Thu phí (Fee Schedule → Fees)
**File**: `education/education/education/doctype/fee_schedule/fee_schedule.py` + `education/education/education/doctype/fees/fees.py`

**Fee Schedule** (template):
- Fields: academic_year, academic_term, company, components[] (fee details)
- Child: student_groups[] (list student groups áp dụng template)
- `validate()`: tính `total_amount = sum(components[].total)`
- Method: **Job enqueue** để tạo Fees records (implied từ get_dashboard_info và Sales Invoice queries)

**Fees** (hóa đơn sinh ra từ template):
- Fields: student, program_enrollment, company, components[] (copy từ template hoặc manual), grand_total
- `validate()`:
  - `calculate_total()`: `grand_total = sum(components[].amount)`
  - `set_missing_accounts_and_fields()`: lấy receivable_account, income_account từ Company defaults (ERPNext)
- `on_submit()`:
  - `make_gl_entries()`: tạo GL Entry (tuân theo ERPNext accounting)
  - `make_payment_request()`: nếu `send_payment_request=true`, gửi payment request tới email của student/guardian

**Quan hệ Fee Structure vs Fee Schedule**:
- **Fee Structure**: Template cấp master (e.g., "Fee Structure 2026") → chứa danh sách components
- **Fee Schedule**: Áp dụng Fee Structure cho một cohort (student_groups, academic_year/term) → tạo Fees cho từng student
- **Fees**: Hóa đơn individual cho student

---

### LMS: Khoá học → Ghi danh → Làm Quiz → Tiến độ

#### 4.1 Tạo Khoá học (LMS Course + LMS Batch)
**File**: `lms/lms/lms/doctype/lms_course/lms_course.py`
- LMS Course (43 fields): title, description, image, instructor (link to User), status, paid (bool)
- Child: LMS Program Course (2 fields) → links to LMS Program

**LMS Batch** (62 fields — HUGE):
- course, batch_start_date, batch_end_date, name (title), is_published, max_students, start_time, end_time
- Instructor được define ở đây hoặc inherit từ course?
- Child: LMS Batch Timetable (10 fields) → ghi lịch học chi tiết

#### 4.2 Ghi danh & Tiến độ (LMS Enrollment → LMS Course Progress)
**File**: `lms/lms/lms/doctype/lms_enrollment/lms_enrollment.py`
- LMS Enrollment (17 fields): course, batch, member (user), enrollment_date, status (Active/Inactive/Completed)
- Được tracked bởi **LMS Course Progress** (11 fields): enrollment, lesson, status, watched_on
- Child: LMS Video Watch Duration (tracking video play)

#### 4.3 Quiz Engine (LMS Quiz → LMS Quiz Submission → Tự động chấm)
**File**: `lms/lms/lms/doctype/lms_quiz/lms_quiz.py`

**LMS Quiz** (20 fields):
- title, course, passing_percentage, max_attempts, shuffle_questions, limit_questions_to
- Child: LMS Quiz Question (6 fields) → question (link to LMS Question)
- `validate()`:
  - `calculate_total_marks()`: if `limit_questions_to` set, tính từ đó fields only, else tổng tất cả
  - Tất cả questions phải cùng marks nếu `limit_questions_to` enabled
- Lưu ý: Không có **weightage** per question

**LMS Question** (65 fields — MEGA):
- type (MCQ, Short Answer, Essay, Coding, etc.)
- options[] (JSON): contains question_text, image, is_correct (for MCQ)
- Không có explicit "points" — được define ở LMS Quiz Question level

**LMS Quiz Submission** (14 fields):
- quiz, member, submit_date, score, score_out_of, percentage
- Child: LMS Quiz Result (8 fields) → question, marks, marks_out_of, is_correct, answer_text
- `validate()`:
  - `validate_marks()`: `score = sum(result[].marks)` — Không có auto-marking
  - `set_percentage()`: `percentage = (score / score_out_of) * 100`
  - Marks phải được set manually hoặc bởi external grader
- Lưu ý: LMS không auto-mark (trừ case-insensitive MCQ check, nếu implement)

#### 4.4 Assignments & Submissions
**File**: `lms/lms/lms/doctype/lms_assignment/lms_assignment.py`
- LMS Assignment (9 fields): course, title, description, due_date, max_score
- LMS Assignment Submission (20 fields): assignment, member, submit_date, score, submission_text
- Không có auto-grading — instructor phải chấm manually

#### 4.5 Certificates & Badges
**File**: `lms/lms/lms/doctype/lms_certificate/lms_certificate.py`
- **LMS Certificate** (15 fields): course, member, completion_date, certificate_name, **NOT auto-generated**
- **LMS Certificate Evaluation** (17 fields): evaluator, evaluation_date, status, points
- **LMS Badge** (11 fields): name, icon, condition_type, criteria
- **LMS Badge Assignment** (9 fields): badge, member, award_date — Manual assignment

**Observation**: Certificates & badges là **NOT auto-generated** từ completion/score — yêu cầu manual approval/award

---

## 4. BA CƠ CHẾ ĐÁNG ĐÀO SÂU

### 4A. ASSESSMENT CRITERIA + WEIGHTAGE + GRADING SCALE

| Aspect | Education | LMS | CMC | Nhận xét |
|--------|-----------|-----|-----|----------|
| **Tiêu chí đánh giá** | Assessment Criteria (master) | Không có | QualitativeAssessment (dạng text, không score) | Education = explicit criteria set, CMC = text-based |
| **Trọng số (weight)** | Assessment Plan Criteria child table `maximum_score` field | Không có | Không có | Education tính total bằng sum(score), không percentage weight |
| **Tổng hợp điểm** | Assessment Result → `validate_grade()` cộng `details[].score` → tính % từ sum/max | Quiz: sum(marks) per submission, không combine | FinalGrade chỉ lưu điểm thô, không có tính toán | Education = cumulative, LMS = per-quiz |
| **Thang điểm (Grade)** | Grading Scale Interval (threshold-based mapping) | Không có grade levels | Không có (chỉ điểm số) | Education = A/B/C/F tùy interval, CMC = raw score |
| **File tính toán** | `api.py` `get_grade()` (dòng 359-382) | Không có | Không có | Education: dòng sort intervals, loop find threshold |
| **Cache performance** | `frappe.local.grading_scale` (caching) | N/A | N/A | Education: cache intervals để tránh reload Grading Scale mỗi lần |

**Kết luận**: Education có full-stack assessment (criteria → weight → aggregate → grade), CMC & LMS đơn giản hơn (điểm số + text evaluation).

### 4B. FEE STRUCTURE → FEE SCHEDULE → FEES

| Aspect | Education | LMS | CMC | Nhận xét |
|--------|-----------|-----|-----|----------|
| **Template master** | Fee Structure (19 fields) + Fee Component child table | Không có (LMS là free + paid per-course, không template) | Không có | Education = traditional school fee model |
| **Cohort template** | Fee Schedule (35 fields, 12 links) + student_groups[] child | Không có | Không có | Fee Schedule = cohort-specific instance |
| **Generate invoices** | Fee Schedule job enqueue (implied, no code snippet) | Không có | Receipt (manual, tuyệt đối không auto-generated) | Education: batch job tạo Fees; CMC: user tạo manual |
| **Student assignment** | Fee Schedule → student_groups[] → Student Group Student child | Không có | Student + Receipt (direct link) | Education: indirect via student group; CMC: direct |
| **Accounting integration** | Fees extends AccountsController → GL Entry (ERPNext) | Không có | Receipt = pure HR artifact (no GL) | Education = full accounting ledger; CMC = no GL (local accounting only) |
| **Payment tracking** | Fees.outstanding_amount + Payment Request (email) | Không có | Không có | Education: ERPNext Payment Request; LMS: chỉ thanh toán trong LMS Payment |
| **File** | `fee_schedule.py` + `fees.py` (calculate_total, make_gl_entries) | N/A | N/A | Education: dòng 82-87 (calculate_total), dòng 117-120 (GL) |

**Kết luận**: Education = sophisticated fee + accounting model (ERPNext-based), CMC = ultra-simple (manual receipts, no accounting), LMS = payment per course (no template).

### 4C. ACADEMIC YEAR / ACADEMIC TERM USAGE

| DocType Tham chiếu | Education | Bao nhiêu references | Ảnh hưởng |
|-------------------|-----------|-------------------|----------|
| Academic Year (single select field) | Program Enrollment, Assessment Plan, Course Schedule, Assessment Result, Course Scheduling Tool, Student Report Generation Tool | 6 DocTypes | Khóa toàn bộ enrollment & assessment cho năm học |
| Academic Term (single select field) | Program Enrollment, Assessment Plan, Course Schedule, Assessment Result, Course Scheduling Tool, Student Attendance Tool | 6 DocTypes | Khóa toàn bộ attendance & assessment cho kỳ |
| **LMS** | Không có thực thể nào | 0 | LMS = course-based, không có academic year concept |
| **CMC** | Không có | 0 | CMC = tập trung vào "current batch" (hàng tháng), không có năm học concept |

**Schema impact**:
- Education: 2 thực thể (Academic Year, Academic Term)
- CMC + LMS: 0

**Ảnh hưởng nếu CMC thêm Academic Year/Term**:
- Query trên assessment/enrollment phải filter by year/term → index cần 2 fields thêm
- Student Report Generation Tool phải group by year/term
- Không phá vỡ existing data model, nhưng thêm complexity cho query

---

## 5. QUIZ ENGINE EVALUATION

| Aspect | LMS | CMC (Offline School) | Khả thi |
|--------|-----|-------------------|---------|
| **Auto-mark MCQ** | Có (fuzzy match option) | Không cần | Auto-mark chỉ hữu dụng cho e-learning remote |
| **Manual essay grading** | Có (LMS Assignment Submission) | Có (bài tập trong class → giáo viên chấm) | Dùng chung model |
| **Live quiz (classroom)** | Không support (async submission) | Cần (kiểm tra 45 phút trong class) | LMS quiz engine = SaaS async, CMC = offline batch |
| **Weightage per question** | Không (flat marks per question) | Có (5 điểm đại số + 3 điểm tiếng Anh) | Education & LMS không support weightage |
| **Retake + history** | Có (max_attempts, all submissions tracked) | Có (nhưng qua quiz này có count++ lần làm) | LMS model phù hợp |
| **Certificate auto-issue** | Không (manual badge/cert award) | Không (chứng chỉ là off → giấy in) | Non-goal per TL16 |

**Kết luận**: LMS quiz engine = phù hợp cho remote learning, CMC = offline → giáo viên chấm trực tiếp, không cần LMS quiz engine. **Giá trị**: Thấp nếu dạy offline.

---

## 6. BẢNG MAPPING 3 CỘT: EDUCATION/LMS ↔ CMC ↔ NHẬN XÉT

| Education | LMS | CMC EDU v2 | Trạng thái | Ghi chú |
|-----------|-----|-----------|----------|---------|
| Student | User/Member | Student | Đã có | Khác nhau: Education có 47 fields (mailing address, category, etc.), CMC có address + metadata |
| Student Applicant | N/A | N/A | Thiếu | Education: 42 fields tuyển sinh; CMC: Opportunity (sales model) |
| Student Admission | N/A | N/A | Thiếu | Education: formal admission after applicant screening |
| Program | N/A | N/A | Thiếu | Education: formal Program; CMC: khóa học implicit (ghi danh vào ClassBatch) |
| Program Enrollment | Enrollment (different model) | Enrollment | Khác | Education: formal enrollment; LMS: Enrollment + Batch; CMC: implicit từ phiếu thu |
| Course | LMS Course | Course | Đã có | CMC chỉ có course concept implicit (unit học) |
| Course Enrollment | LMS Enrollment | Enrollment | Khác | Education: course-level; LMS: batch-level; CMC: class session attendance |
| Student Group | N/A | ClassBatch | Khác | Education: logical group (all year 2 students); CMC: actual batch (20 students, T2/2026) |
| Room | N/A | Room | Đã có | Minimal (chỉ tên) |
| Instructor | N/A | AppUser (staff) | Khác | Education: 10 fields; CMC: AppUser (not dedicated Instructor entity) |
| Grading Scale | N/A | N/A | Thiếu | Education: A/B/C/F mapping; CMC: Điểm số (0-100) |
| Assessment Plan | N/A | N/A | Thiếu | Education: template đánh giá per academic_year/term/cohort; CMC: chỉ có FinalGrade manual |
| Assessment Result | N/A | FinalGrade + QualitativeAssessment | Đã có (partial) | Education: detailed per-criteria scoring; CMC: final result only |
| Assessment Result Detail | N/A | N/A | Thiếu | Education: row per tiêu chí; CMC: không track từng tiêu chí |
| QualitativeAssessment | N/A | QualitativeAssessment | Đã có | LMS/Education không có; CMC: mô tả văn bản (e.g., "tích cực") |
| Student Attendance | N/A | Attendance | Đã có | Educational: có course_schedule reference; CMC: có ClassSession reference |
| Student Leave Application | N/A | N/A | Thiếu | Education: formal leave request approval; CMC: chỉ ghi chú (không formal) |
| Fee Structure | N/A | N/A | Thiếu | Education: master template; CMC: không có (Receipt manual) |
| Fee Schedule | N/A | N/A | Thiếu | Education: cohort-specific fee instance; CMC: không có |
| Fees | N/A | Receipt | Khác | Education: extends AccountsController (GL entry); CMC: HR artifact (no accounting) |
| Quiz | LMS Quiz | N/A | Khác | Education: quiz activity; LMS: formal assessment; CMC: không có quiz entity |
| Quiz Question | LMS Question | N/A | Khác | Education: simple Q/A; LMS: complex (MCQ, essay, coding) |
| Quiz Result | LMS Quiz Result | N/A | Khác | Education: assessment result per quiz; LMS: per submission |
| LMS Assignment | N/A | N/A | Thiếu/Low Value | LMS: assignment submission tracking; CMC: bài tập ngầm trong class session |
| LMS Badge | N/A | N/A | Non-goal | LMS: badge award; CMC: không có (per TL16) |
| LMS Certificate | N/A | N/A | Non-goal | LMS: certificate generation; CMC: không có (per TL16) |
| Academic Year | N/A | N/A | Thiếu | Education: calendar year (2026); CMC: implicit (current academic year from app config) |
| Academic Term | N/A | N/A | Thiếu | Education: semester/quarter; CMC: không có (mặc định = term hiện tại) |
| LMS Live Class | N/A | ClassSession | Khác | LMS: virtual meeting integration (Zoom/Google Meet); CMC: physical class only |
| LMS Payment | Payment (custom LMS model) | N/A | Khác | LMS: payment tracking per course; CMC: Receipt (per enrollment) |
| Guardian | N/A | Contact (or AppUser parent) | Khác | Education: 16 fields formal guardian; CMC: Contact entity (sales, not education) |
| Guardian Interest | N/A | N/A | Thiếu | Education: interest tracking for guardians; CMC: không có |
| Guardian Student | N/A | N/A | Thiếu | Education: explicit link student ↔ guardian; CMC: implicit (Contact ← Student field) |
| Student Sibling | N/A | N/A | Thiếu | Education: track sibling relationships; CMC: không có |
| Topic / Topic Content | LMS Chapter/Lesson (different model) | N/A | Khác | Education: course content hierarchy; LMS: Chapter → Lesson; CMC: không có |
| Instructor Log | N/A | N/A | Thiếu | Education: instructor activity tracking; CMC: không có |
| Student Log | N/A | AuditLog (system level) | Khác | Education: student activity log; CMC: system AuditLog (all users) |
| Payment Record | N/A | Receipt | Khác | Education: custom payment tracking; CMC: Receipt (enrollment fees) |
| Education Settings | N/A | N/A | Thiếu | Education: doctype-level config; CMC: config in AppConfig |

**Tổng kết Mapping**:
- **Đã có**: Student, Course, Room, Enrollment, Attendance, FinalGrade, QualitativeAssessment
- **Khác model**: Program/Program Enrollment, Instructor, Student Group, Fees, Topic, Guardian, Payment, Academic Year/Term
- **Thiếu**: Student Applicant, Student Admission, Grading Scale, Assessment Plan, Assessment Result Detail, Student Leave, Fee Structure/Schedule, Quiz engine, Instructor Log, Student Log, Guardian Interest/Guardian Student, Sibling, Qualitative fields, Academic Year/Term
- **Non-goal** (TL16): Badge, Certificate, Leaderboard, Auto-promotion

---

## 7. GAP LIST — FILTERED ĐÃ LOẠI NON-GOAL

### Mức độ: **CRITICAL** (phá vỡ workflow tuyển sinh)

| Gap | Lý do | Chi phí Prisma/tRPC | Ghi chú |
|-----|-------|------------------|--------|
| **Student Applicant + Admission workflow** | Education có formal tuyển sinh (applicant → admission → enrollment); CMC hiện dùng Opportunity (sales model) → not scalable | Medium (add Student Applicant table + form + rules engine) | Cần decision: có chạy full tuyển sinh formal hay giữ Opportunity? |
| **Program entity + Program Enrollment** | Education: formal program structure + enrollment tracking; CMC: chỉ implicit trong ClassBatch | Medium (add Program + Program Enrollment + migration) | CMC ghi danh → ClassBatch chưa support program-level tracking |
| **Assessment Plan template system** | Education: một plan template định nghĩa assessment cho cohort (year/term/group) → reuse; CMC: chỉ lưu final grade, không có plan | Medium-High (add Assessment Plan + criteria + calculate total from criteria) | Cần để track điểm từng tiêu chí (e.g., class participation, quiz, final exam) |

### Mức độ: **HIGH** (ảnh hưởng đánh giá & thanh toán)

| Gap | Lý do | Chi phí | Ghi chú |
|-----|-------|---------|--------|
| **Grading Scale + Grade mapping** | Education: threshold-based grade mapping (A=90+, B=80+, etc.); CMC: raw điểm số only | Low (add GradingScale + interval table + get_grade function) | Giáo viên phụ huynh cần thấy "grade letter", không chỉ số |
| **Qualitative assessment per student per criteria** | Education: Assessment Result Detail rows; CMC: chỉ text note (QualitativeAssessment) | Low (add field per assessment criteria trong Assessment model) | Ví dụ: "Toán: tích cực", "Tiếng Anh: cần cải thiện" |
| **Assessment Result Detail rows (criteria scoring)** | Education: Assessment Result → details[] (row per criteria); CMC: FinalGrade flat (total only) | Low-Medium (add nested table + sum calculation) | Để track từng tiêu chí (class attendance, quiz, final exam, etc.) |
| **Fee Schedule + auto-Fees generation** | Education: template generate invoices per student; CMC: manual Receipt only | High (add Fee Schedule + batch job + job queue logic) | Hiện tại Receipt tạo manual → không scale với 500 học sinh |
| **Academic Year / Academic Term entities** | Education: 2 masters; CMC: không có | Low (add 2 entities + foreign keys) | Dùng để organize enrollment, assessment, attendance by calendar |

### Mức độ: **MEDIUM** (enhancement, không critical)

| Gap | Lý do | Chi phí | Ghi chú |
|-----|-------|---------|--------|
| **Student Attendance Tool (batch mark attendance)** | Education: tool UI để mark attendance cho cả nhóm; CMC: chỉ individual Attendance | Low-Medium (add UI + batch endpoint) | UX: giáo viên chỉ cần click "present/absent" cho từng học sinh, không manual new record |
| **Course Schedule as recurring event** | Education: Course Schedule entity (schedule repeat); CMC: ClassSession là individual | Low (enhance Course → add scheduling template) | Để tái sử dụng lịch (T2 Toán 3 chiều thứ 2, 4, 6) |
| **Instructor Log (staff tracking)** | Education: log instructor activities; CMC: chỉ AppUser staff list | Low (add optional logging) | Non-critical: chỉ hữu dụng nếu cần staff performance tracking |
| **Student Leave Application + Approval** | Education: formal leave request; CMC: không có | Medium (add Student Leave + approval flow) | Phụ huynh gửi leave → staff approve → auto mark attendance |
| **Guardian Interest tracking** | Education: track interest of parents (workshops, etc.); CMC: không có | Low (add optional table) | Non-critical: marketing feature |
| **Student Sibling tracking** | Education: track sibling relationships; CMC: không có | Low (add optional table) | Non-critical: family view only |
| **Quiz engine (if doing remote)** | Education: Quiz Activity; LMS: full Quiz system; CMC: không có | High (add LMS-like Quiz + Question + Quiz Result) | **Only if** CMC opens remote learning; offline không cần |
| **Payment gateway + Payment Request** | Education: integrates ERPNext Payment Request; CMC: manual thanh toán | High (add Payment Request DocType + gateway integration) | Enhancement: auto-email payment link to parents |

### Mức độ: **LOW** (nice-to-have, non-essential)

| Gap | Lý do | Chi phí | Ghi chú |
|-----|-------|---------|--------|
| Topic / Topic Content (course outline) | Education: explicit; CMC: implicit | Low (add optional table) | Only if doing content-heavy courses (online materials) |
| Instructor as dedicated DocType | Education: 10 fields; CMC: AppUser role | Low (create Instructor table linking to AppUser) | Enhancement: dedicated staff directory |
| Student Log (activity audit) | Education: custom log; CMC: system AuditLog | Low (add optional logging) | Only if need student-activity analytics |
| Payment Record (custom payment tracking) | Education: custom model; CMC: manual Receipt | Low (extend Receipt) | Only if complex payment schemes (installments, etc.) |

---

## 8. CMC CÓ MÀ CẢ HAI REPO KHÔNG CÓ

| CMC Entity | Use case | Edu/LMS nhận xét |
|-----------|----------|-----------------|
| **FinalGrade** | Điểm cuối kỳ | Edu: Assessment Result (row per criteria, auto-aggregate); LMS: không formal grade |
| **QualitativeAssessment** | Mô tả văn bản (tích cực, tạm đủ, cần cải thiện) | Edu: không có (chỉ score); LMS: không có |
| **Receipt** | Phiếu thu chi | Edu: Fees (GL entry); LMS: LMS Payment (no GL) — CMC: simple cash receipt (no accounting) |
| **ClassBatch** | Batch lớp học | Edu: Student Group (logical cohort) + Course Schedule; LMS: LMS Batch; CMC: phức tạp hơn (schedule + room + instructor) |
| **ClassSession** | Một buổi học (ngày/giờ) | Edu: implicit trong Course Schedule; LMS: LMS Live Class; CMC: granular session tracking |
| **SessionEvidence** + **SessionEvidencePhoto** | Bằng chứng buổi học (foto) | Edu/LMS: không có (chỉ tracking abstract) |
| **StarTransaction** + **Gift** + **Reward** | Điểm thưởng, quà tặng (gamification) | Edu/LMS: Badge/Certificate (but not implemented); CMC: custom reward model |
| **TimePunch** + **ManualAttendanceTicket** | Chấm công staff (offline) | Edu: Instructor Log (high-level); LMS: không có |
| **ShiftTemplate** + **ShiftRegistration** + **SalaryRate** | Lương staff dạy thêm | Edu: không có (chỉ Instructor); LMS: không có |
| **ParentMeeting** + **TestAppointment** | Lịch họp phụ huynh, kiểm tra | Edu/LMS: không có (chỉ implicit) |
| **KpiScore** + **CompensationPolicy** | KPI nhân viên + thưởng lương | Edu/LMS: không có |
| **LoginOtp** | OTP đăng nhập | Edu/LMS: authentication (Frappe built-in); CMC: explicit OTP tracking |
| **AuditLog** + **EmailOutbox** | Audit + email history | Edu: custom Student Log; LMS: không có; CMC: system-level (not education-specific) |

**Kết luận**: CMC có các entities không có trong Edu/LMS: **SessionEvidence** (photo buổi học), **Reward/Gift/Star** (gamification), **Staff salary** (shift-based), **Parent meetings** (CRM). Những thứ này là **CMC-specific** (trung tâm dạy offline VN), không phải gap.

---

## 9. KHOẢNG CÁCH THIẾT KẾ: PRISMA vs FRAPPE

| Aspect | Frappe (Edu/LMS) | Prisma (CMC) | Trade-off |
|--------|-------------------|--------------|-----------|
| **Child tables** | Native (child table DocType) | Explicit relation + `@relation` | Prisma verbose hơn nhưng type-safe |
| **Validation hooks** | `validate()`, `before_submit()`, `on_submit()` | Custom middleware/service | Frappe = declarative, Prisma = procedural |
| **Job queue** | `frappe.utils.background_jobs.enqueue()` | Bull/Bullmq (Node.js) | Frappe = easy, Prisma stack = manual setup |
| **Caching** | `frappe.local.*` | Redis or in-memory | Frappe = request-scoped, Prisma = cross-request |
| **GL entry** | ERPNext built-in (make_gl_entries) | Custom accounting module | Frappe = production-ready, CMC = custom (no GL for Fees currently) |
| **Payment gateway** | ERPNext Payment Request | Stripe/Momo custom | Frappe = 1-click integration, Prisma = manual |

**Adoption risk**: Edu/LMS cách tiếp cận (child tables, validation hooks) khác Prisma-tRPC (explicit schemas, microservices). Không thể "reuse" code, nhưng kiến trúc là learnable.

---

## 10. UNRESOLVED QUESTIONS

1. **Applicant → Student workflow**: CMC hiện dùng Opportunity (sales model). Có nên:
   - (a) Mimic Education Student Applicant formal process?
   - (b) Giữ Opportunity, chỉ enhance thêm "tuyển sinh approval step"?
   
2. **Assessment Plan**: Education template khá phức tạp (per academic_year + academic_term + student_group). CMC có cần full formality này, hay simplified plan (per course only)?

3. **Academic Year/Term**: Có thêm để organize data, nhưng Frappe khác Prisma (need migration + index). Worth it?

4. **Fees auto-generation**: Education dùng job queue (frappe.utils.background_jobs.enqueue). CMC có tài nguyên infra nào cho background jobs (Bull/Bullmq)?

5. **Grading Scale**: A/B/C/F hay other system? Different regions have different scales.

6. **Quiz engine**: Chỉ hữu dụng nếu CMC mở remote learning. Hiện tại offline → skip?

7. **Guardian model**: Education = formal Guardian entity (16 fields). CMC = Contact. Merge hay keep separate?

---

## CONCLUSION

| Repo | Core Strength | Not Applicable to CMC | Adoptable |
|------|---------------|----------------------|-----------|
| **Education** | Formal academic structure (Program → Enrollment → Assessment → Grading → Fees) | LMS features (online learning) | ✓ Assessment Plan + Grading Scale + Fee template (with adaptation) |
| **LMS** | E-learning platform (courses, batches, quizzes, assignments, certificates) | Offline school (no quiz engine needed, no live sessions) | ⚠ Course Progress tracking (adapt to class session) |
| **CMC** | Offline school + staff gamification (rewards, shifts, KPI) | ERPNext ecosystem (no GL, no formal accounting) | ✓ Standalone schema (not Frappe-dependent) |

**Recommendation for next phase**:
1. Adopt Education **Assessment Plan + Grading Scale** design (with Prisma port)
2. Adopt Education **Fee Schedule template** (with job queue setup)
3. **Skip** LMS Quiz engine (low value for offline school)
4. **Keep** CMC's **QualitativeAssessment + SessionEvidence** (Edu/LMS don't have these, but CMC needs)
5. **Decide**: Formal Student Applicant workflow or keep Opportunity model

---

**Files generated in scratchpad**:
- `education_summary.csv` — 74 DocType list with field/link counts
- `education_detail.json` — Full schema per DocType
- `education_links.json` — Relationship map
- `lms_summary.csv` — 67 DocType list
- `lms_detail.json` — Full schema
- `lms_links.json` — Relationship map

**Research methodology**:
- Script: Python JSON parser reading `.json` files directly (not network, no assumptions)
- Code analysis: Read top-level `*.py` files for Fees, Assessment, Quiz logic (no copy, description only)
- License verified: GPLv3 (Education, khai báo), AGPLv3 (LMS, toàn văn) → research allowed, code reuse NOT allowed
- Schema stats: 74 Edu + 67 LMS = 141 DocTypes analyzed; 204 + 111 = 315 Link relationships mapped

---

**Status**: DONE  
**Summary**: Extracted real schema from both repos using Python script (74 Education + 67 LMS DocTypes), analyzed 3 core mechanisms (Assessment + Fee Schedule + Quiz), mapped to CMC 50 models, identified 8 critical/high gaps (Student Applicant, Program Enrollment, Assessment Plan, Grading Scale, Fee Schedule, Academic Year/Term) and 13 medium/low gaps, listed CMC-unique entities (SessionEvidence, Reward, Shift-based salary). Unresolved: Student workflow formality (Applicant vs Opportunity), Assessment Plan complexity, Academic Year/Term ROI, background job infrastructure, Grading Scale design, Quiz engine necessity.
