# Phase T2 — Bài tập PDF + mở ADR0038 + chấm (Grade/computeFinalGrade) + sao (WF-P2-03..06) (v2)

## Goal
Vòng lặp học tập lõi LMS: upload PDF → published → mở theo tiến độ (ADR 0038) → làm bài annotation → nộp → chấm (Grade + computeFinalGrade) → sao.

## Nguồn spec
TL26 WF-P2-03/04/05/06 · TL19 §3-4, §6 · **ADR 0038 verbatim** · TL25 P2-03..06 · TL29 §1 (computeFinalGrade unit target).

## Scope

### Schema (+ RLS + GRANT — LƯU Ý fix validate)
- `CurriculumUnit` (GLOBAL không RLS — QĐ0021; unitType LESSON|REVIEW, program, level, monthIndex) + seed UCREA tối thiểu.
- **`classSession.assignUnit`** (perm `schedule.generate`) — gán `curriculumUnitId` cho buổi (C1 phần còn lại; addMakeup/cancel đã có từ T1).
- `Exercise` (GLOBAL không RLS — QĐ0022; curriculumUnitId, type homework|test_entrance|test_periodic, basePdfRef, maxScore=10, starReward=10, status draft|published|closed, createdById) · unique `(curriculumUnitId,type)`.
- `Submission` (**facilityId + RLS** — dữ liệu trẻ, fix validate; exerciseId, studentId, annotationLayer Json ≤1MB, answerText?, version, status draft|submitted|graded, submittedAt?, score?, gradedById?) · unique `(exerciseId,studentId)`.
- `Grade`/`FinalGrade` (**facilityId + RLS**; per student×class/period) + **`computeFinalGrade` pure func trong package mới `@cmc/domain-grading`** (điểm bài + tỉ lệ chuyên cần từ Attendance — TL19 §5/§6; unit ≥90% — H1 fix: T2 OWN phần tính; T3 own phần học bạ đọc).
- `StarTransaction` (**facilityId + RLS**, append-mindset; type homework_completed|gift_redeemed|gift_rejected_refund|manual, amount, refType/refId).
- **Blob seam** `@cmc/storage` (interface put/get/delete; impl local-disk dev `.data/`).

### Upload transport (pre-resolved — validator Q1)
**HTTP multipart route riêng** trên api server (ngoài tRPC): `POST /upload/exercise-pdf` — cùng dev-auth header, check `can(exercise.manage)`, validate mime application/pdf + ≤10MB → `BlobStorage.put` → trả `blobRef`; tRPC `exercise.create` nhận blobRef.

### Procedures
- `exercise.create/publish/close` (perm **`exercise.manage`** — GĐĐT/super_admin; deviation vs TL25 `assessment.*` ghi nhận).
- **`exercise.openForStudent`** (lms) — ADR 0038: nền published + không blocked_lms; **Tier A** buổi không-makeup dạy unit đã KẾT THÚC (ICT, không cancelled) → mở cả batch; **Tier B** buổi makeup HS present/late → mở riêng HS.
- `submission.saveDraft` (lms; version++; chặn sau submitted) · `submission.submit` · `submission.grade` (perm `submission.grade` — giao_vien/GĐĐT; score≤maxScore; → graded + Grade + **sao flat starReward đúng 1 lần kể cả regrade**).
- `exercise.listForStudent` (lms — chỉ bài đã mở) · `submission.listForGrading` (GV queue).

### Tests bắt buộc
Tier A (chưa dạy ẩn / kết thúc ICT mở / cancelled không mở) · Tier B (makeup+present riêng HS; makeup+absent không) · blocked_lms rỗng · annotation version/immutable-after-submit/unique · grade chỉ submitted, score cap, sao 1 lần idempotent · computeFinalGrade unit (biên tỉ lệ chuyên cần) · upload route: mime/size/permission · RLS Submission/Star negative · HS chỉ thấy của mình.

## Review gate
**Adversarial bắt buộc** (dữ liệu trẻ + ADR0038 + sổ sao).

## Harness (1 story / 1 WF — fix validate)
Intake high-risk · **US-014** WF-P2-04 exercise CRUD/publish/upload (verify=`vitest run src/exercise/publish.test.ts`) · **US-015** WF-P2-03 open-tier (`src/exercise/open-tier.test.ts`) · **US-016** WF-P2-05 submission (`src/submission/annotate-submit.test.ts`) · **US-017** WF-P2-06 grade+stars+finalGrade (`src/submission/grade.test.ts`).

## Split option (nếu chạm context-budget — protocol)
T2-I = blob seam + CurriculumUnit + assignUnit + exercise (US-014) · T2-II = open-tier + submission + grade/sao (US-015..017). Mỗi nửa PR riêng.

## Acceptance
4 story verify pass · e2e thêm flow publish→open→submit→grade→sao · coverage giữ (+ threshold cho domain-grading ≥90) · merge protocol.
