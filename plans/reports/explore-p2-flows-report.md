# Explore Report - Cum P2 (Lop & Hoc tap): map luong nghiep vu WF-P2-01..09

> Agent: Explore (P2 cluster) - Nguon chuan: docs/26-workflow-spec-p2.md (WF-P2-01..08) + docs/25-ma-tran-truy-vet-p1.md sec2 (rows P2-01..08) + ADR 0038/0045 + code as-built (apps/api/src/{class,attendance,exercise,submission,assessment,session-evidence,lms-ops}) + acceptance-report/verification.json (P2-01..09).
> Vai tro: 5 vai active (super_admin bypass moi registry - packages/auth can()); quyen that tu packages/auth PERMISSIONS + procedure gates.

## Tom tat

9 luong P2 (P2-01..08 spec trong TL26; **P2-09 chi co o journey + acceptance-report, KHONG co section trong TL26 va KHONG co row trong TL25 sec2**). Cham diem coverage e2e: **3/9 co journey UI** (P2-04, P2-06, P2-08 - moi luong 1-2 journey), **2/9 no-ui-path** (P2-03, P2-05 - hoc vien lam bai khong co e2e), **2/9 no-journey** (P2-01, P2-02 - class create/attendance chi co live 03 + RTL), P2-07 journey chi chung minh roster-read (KHONG phai luong AI draft/confirm), P2-09 journey chi mo man hinh (KHONG freeze sequence qua UI). Live: **1 live spec cham P2** (03-class-attendance: P2-01 view + P2-02 mark); 09-ops-rewards cham nua sau cua P2-06 (star economy redeem).

---

## Bang luong (9 luong)

| WF | Ten / Module | Vai tro (that tu auth) | UI path | API chinh (quyen) | Journey spec | Live spec | ADR/QD |
|---|---|---|---|---|---|---|---|
| **P2-01** | Tao lop -> tu sinh buoi / class | **GDDT** (class.create, schedule.generate) - super_admin - GDKD/sale/giao_vien chi class.read (doc) | /admin/classes (+ dialog "Tao lop" -> lmsOps.createClassWithUnits) - /admin/classes/:id (sessions) - /admin/courses | classBatch.create (class.create) - lmsOps.createClassWithUnits (class.create) - schedule.generateSessions (schedule.generate) - classSession.assignUnit/confirm/cancel (schedule.generate) - classBatch.assignTeacher (class.create) | **khong co** (no-journey; RTL: apps/admin/src/pages/classes/index.test.tsx) | **03-class-attendance** (tao qua tRPC createLiveClass - seed exception, KHONG qua UI dialog; GDDT chi XEM lop qua UI) | QD 0036 - ADR 0045 |
| **P2-02** | Diem danh / attendance | **giao_vien + GDDT** (attendance.mark) - super_admin - PH/HS xem qua attendance.listForChild (lmsProcedure + Guardian) | /teaching/attendance?session= - /teaching/sessions/:sessionId - LMS /parent/... | attendance.mark/markAll/listBySession (attendance.mark) - lmsOps.rosterForSession (classRoster.read) - attendance.listForChild (LMS) | **khong co** (no-journey) | **03-class-attendance** (GV mark present qua UI pickers) - e2e khong-journey: attendance.spec.ts, attendance-grading.spec.ts, attendance-deeplink.ui.spec.ts | TL19 sec5 - ADR 0038 |
| **P2-03** | Mo bai tap theo lan phat (ADR 0038 dual-gate) / exercise | **hoc vien** (LMS student session) - PH qua profile con | LMS /student/home - /student/exercise/:sessionExerciseId | exercise.openForStudent/listForStudent (lmsProcedure) - nen: lmsOps.deliverSessionExercise (exercise.manage) + onRoster (ADR 0045) | **khong co** (**no-ui-path** - chua co journey seed SessionExercise cho HS) | **khong co** | **ADR 0038** - ADR 0045 |
| **P2-04** | Cung cap bai tap PDF -> published / exercise | **GDDT** (exercise.manage) - super_admin - giao_vien chi exercise.view (doc) | /teaching/exercises - /teaching/exercises/:exerciseId (+ upload) | exercise.create/update/publish/close/get/list + exerciseFolder.* (exercise.manage) - POST /upload/exercise-pdf (HTTP route) | **exercise-publish-close** (tao->publish->dong + upload PDF that) | **khong co** | TL19 sec3 |
| **P2-05** | Hoc vien lam bai PDF & nop / submission | **hoc vien** (lmsProcedure) | LMS /student/exercise/:sessionExerciseId | submission.saveDraft/submit (lmsProcedure, sessionExerciseId) - submission.listForChild (PH) | **khong co** (**no-ui-path** - nop phu thuoc P2-03) | **khong co** | TL19 sec3 |
| **P2-06** | GV cham bai -> graded + sao / submission | **giao_vien + GDDT** (submission.grade) - super_admin - PH xem submission.listForChild | /teaching/grading - LMS /parent/homework/:studentId | submission.grade/saveTeacherAnnotation/listForGrading (submission.grade) - submission.listForChild (LMS) | **grading-submission** + **lms-grade-parent-view** (xuyen app ERP->LMS) + **lms-stars-redeem-cycle** (star mint->redeem, P4) | **khong co** (09 chi nua redeem) | TL19 sec6 |
| **P2-07** | Nhan xet AI nhap -> GV chot / assessment | **giao_vien** (draft+confirm+discard) - **GDDT** (draft CHI - assessment.confirm la **giao_vien-only**) - super_admin | /teaching/session-assessment - /admin/report-cards | assessment.draftComment (assessment.draft) - confirm/discard (assessment.confirm) - listBySession (assessment.draft) - listForChild + reportCard.getForChild (LMS) | **session-assessment-roster** (F2: chi chung minh roster present - KHONG cham draft/confirm AI) | **khong co** | TL08 sec7 - TL13 |
| **P2-08** | Session-evidence -> published gui PH / session-evidence | **giao_vien** (upsert+publish) - super_admin - **PH/HS** xem (LMS + consent) | /teaching/session-evidence - LMS /parent/evidence/:studentId - /parent/consent/:studentId | sessionEvidence.upsert/addPhoto/publish/getBySession (sessionEvidence.upsert/publish) - listForChild (LMS) - guardian.setPhotoConsent (LMS) - POST /upload/session-photo + GET anh (HTTP) | **session-evidence-publish** (nua GV) + **lms-parent-evidence-consent** (nua PH, cong consent) | **khong co** | TL19 sec6b - TL08 sec7 |
| **P2-09** | Xep day bai cho lop / lms-ops (sequence) | **GDDT** (exercise.manage) - super_admin | /teaching/classes/:classBatchId/exercise-sequence | lmsOps.assignExerciseSequence/listExerciseSequence/deliverSessionExercise/sessionDeliveryStatus (exercise.manage) | **exercise-sequence** (chi mo man hinh - KHONG freeze sequence qua UI; spec ghi ro picker+save do RTL) | **khong co** | ADR 0045 - class-unit-spec sec8 |

---

## Edge cases - da test vs. CHUA test

### P2-01 (class create / auto-schedule) - class/generate-sessions.test.ts (30 tests), assign-teacher.test.ts (7), lms-ops/*.int.test.ts
- DA TEST: startDate>endDate - span > MAX_CLASS_SPAN_DAYS - >20 slots -> BAD_REQUEST - room overlap -> CONFLICT - re-generate idempotent - extend endDate chi sinh buoi moi - ma class format + counter nguyen tu (concurrent) - RLS cross-facility - teacher resolve/validate - slot update/archive - duplicate weekday+start -> 1 session - regen tu today ICT - generateSessions room-conflict khi extend.
- CHUA TEST:
  - Khong journey UI cho dialog "Tao lop" (live 03 tao qua tRPC, khong qua UI - seed exception PO-approved).
  - lmsOps.createClassWithUnits: teacherId khong phai giao_vien -> BAD_REQUEST (gate router.ts:142) - chi assign-teacher.test.ts test path classBatch.create, khong test path createClassWithUnits.
  - lmsOps.createClassWithUnits: startUnitId khong thuoc program cua course -> NOT_FOUND (router.ts:125) - chua test.
  - roomId khong ton tai -> NOT_FOUND (classBatch.create path chua test truc tiep).
  - Span dung bang MAX (boundary) vs MAX+1 - chi test vuot.
  - Regenerate khi KHONG con slot nao active (moi slot archived) - chi test addSlot-roi-regen.

### P2-02 (attendance) - attendance/gate.test.ts (19), window.test.ts (4), list-for-child.test.ts (4), assert-teacher-owns-class.test.ts
- DA TEST: 5 gate (session not found/cancelled - mismatch batch - reserved/withdrawn - RLS - ICT month) - upsert last-write-wins - FinalGrade recompute khi sua absent->present - markAll atomic rollback + dedupe recompute - window: teacher ngoai [start-30m, end+2h] -> BAD_REQUEST, director override, env default production - dual-gate roster cho unit-stamped session - classSession.cancel chan mark + done khong cancel duoc - confirm planned->confirmed - listForChild (PH, Guardian, excluded cancelled).
- CHUA TEST:
  - markAll > 200 entries -> BAD_REQUEST (zod max(200), chua co test - nguoc lai slots max(20) thi co test).
  - Window tai dung bien open/close instant (chi test inside/outside, khong test exactly-at-boundary).
  - listBySession tren session cancelled (read path cho phep - chua test).
  - Re-mark late/absent -> FinalGrade recompute (chi test absent->present).
  - ATTENDANCE_WINDOW_ENFORCED=0 trong production (semantics env override - chi unit test reader).
  - Khong journey UI cho man diem danh (live 03 da bu phan mark qua UI).

### P2-03 (openForStudent) - exercise/open-tier.test.ts (7), lms-ops/on-roster.test.ts (7), exercise-delivery.int.test.ts (7), bright-ig-gaps.int.test.ts (4)
- DA TEST: published-only - delivered tren non-cancelled - onRoster dual-gate (active + range cover + khong archive + khong blocked_lms) - fail-closed null stamp - off-roster an - dong exercise sau delivery -> an - no Tier A - 2 session cung exercise -> 2 open items - same-day archive boundary (unit).
- CHUA TEST:
  - Toan bo duong UI hoc vien (no-ui-path) - open list + workspace annotation khong co e2e journey/live.
  - Lifecycle withdrawn o open-tier (BLOCKED_TEACHING_LIFECYCLES gom blocked_lms + withdrawn; chi test blocked_lms).
  - saveDraft sau khi exercise closed (submit-after-close co test, saveDraft-after-close khong).

### P2-04 (exercise create/publish/close) - exercise/publish.test.ts (+ upload 6 tests), folder-router.test.ts (2)
- DA TEST: publish chi draft - close chi published - role exercise.manage - upload: non-PDF 400 - oversized 400 - no-session 401 - thieu quyen 403 - 2 homework cung folder ok - journey UI day du tao->publish->dong + upload PDF that.
- CHUA TEST:
  - exercise.update (rename/move folder) - khong journey; move-folder logic (orderInFolder + advisory lock 91006) khong test truc tiep.
  - Tao exercise vao folder archived -> BAD_REQUEST (assertFolderWritable) - chua test.
  - Re-publish mot exercise closed -> BAD_REQUEST (publish chi nhan draft - test hien dung status khac; closed->publish chua test tuong minh).
  - Journey khong phu UI cua giao_vien (exercise.view - xem nhung khong tao).

### P2-05 (saveDraft/submit) - submission/annotate-submit.test.ts (11)
- DA TEST: version++ - 1MB cap annotation - submit chi draft - double-submit chan - saveDraft sau submit chan - submit sau close chan - unique (sessionExerciseId, studentId) - 2 HS doc lap - 2 delivery doc lap (B4) - off-roster chan - Guardian FORBIDDEN - no-profile.
- CHUA TEST:
  - UI journey annotation workspace (no-ui-path).
  - answerText max 20_000 (zod) - khong test.
  - assertPasswordNotExpired tren saveDraft/submit (gate co, khong test trong file nay).
  - Race saveDraft vs submit (grade co updateMany + conflict, saveDraft/submit khong co conditional - version increment co the race; chua test).

### P2-06 (grade + sao) - submission/grade.test.ts (15), teacher-annotation.test.ts (6), list-for-child.test.ts (4)
- DA TEST: chi submitted cham duoc - score > maxScore chan - score fraction (8.5) chan (Int) - score = maxScore ok - sao cong dung 1 lan ke ca regrade (idempotent) - 2 concurrent grade -> 1 winner - regrade tuan tu ok - FinalGrade recompute - teacher ownership (listForGrading + saveTeacherAnnotation + grade) - RLS cross-facility - role gate - journey UI + readback so hoc (assertBusinessInvariant score=8, status=graded) - xuyen app PH thay "Cho cham" -> "9 diem - +5 sao".
- CHUA TEST:
  - Anti-self: khong co guard/khong test "grader khac submitter" - ve cau truc bat kha (submission gan Student row, grader la AppUser row; student khong co submission.grade), nhung chua co test chung minh voi role ket hop.
  - Score = 0 (boundary nonnegative) - chi test = maxScore va > maxScore.
  - Grade khi enrollment da withdrawn giua chung -> recomputeFinalGrade early-return - khong test.
  - Star idempotency khi da ton tai StarTransaction la (chi match dung type/refType/refId) - khong test negative.
  - listForGrading take: 100 (paginate) - khong test.
  - Live: khong co (09 chi nua redeem; chuoi grade->stars do journey local phu).

### P2-07 (assessment AI draft/confirm) - assessment/draft-confirm.test.ts (23)
- DA TEST: PII (fullName KHONG vao prompt) - egress audit T8 + hash - owner gate TRUOC LLM egress - student khong enroll -> chan truoc egress - LLM_STUB_PROD_FORBIDDEN -> PRECONDITION_FAILED - confirm chi draft - 2 concurrent confirm 1 winner - discard chi draft - listBySession ownership - listForChild chi confirmed - reportCard aggregation + attendanceRate - audit-fail khong pha draft.
- CHUA TEST:
  - Khong journey/live cho luong AI draft->sua->chot qua UI (session-assessment-roster chi chung minh roster; button "Tao nhan xet AI" va confirm UI khong e2e).
  - Draft period-only (khong classSessionId, qua assertTeacherOwnsStudentClass) - chi test session-scoped.
  - GDDT confirm -> FORBIDDEN (registry giao_vien-only) - khong test tuong minh.
  - confidence thap -> co cho GV (field co, khong behavior/UI test).
  - confirm content rong (zod min 1) - khong test.

### P2-08 (session-evidence) - session-evidence/publish.test.ts (25), photo-access.test.ts (8)
- DA TEST: internalNote KHONG BAO GIO trong LMS DTO (field-level) - anh chi khi consent active (photoConsent && revokedAt null) - revoke an ngay - chi published hien - cancelled session an - publish 0 anh -> BAD_REQUEST - khong publish 2 lan - khong sua published - khong addPhoto published - cancelled chan upsert/addPhoto/publish - GET anh can LMS bearer + canAccessSessionPhoto (enrolled + consent) - setPhotoConsent grant/revoke - journey 2 nua (GV + PH).
- CHUA TEST:
  - GET /upload/session-photo bytes endpoint e2e (chi unit-level photo-access).
  - Evidence tren session done (assertSessionActive chi chan cancelled - publish/addPhoto tren done chua test).
  - internalNote/upsert summary max 10_000 (zod) - khong test.
  - Thu tu nhieu anh (orderBy createdAt asc) - khong test.
  - Live: khong co.

### P2-09 (sequence) - lms-ops/exercise-delivery.int.test.ts (7), packages/domain-lms/exercise-sequence.test.ts (unit 5), bright-ig-gaps.int.test.ts
- DA TEST: assign freeze positions <= deliveredCount - deliver idempotent - khong sequence -> null - cancelled khong deliver - khong unit-stamp -> chan (tranh deliver-vo-hinh) - session chua ket thuc -> chan - deliverDueExercises worker (window 14 ngay) - cancel sau deliver revoke SessionExercise khi 0 submissions - gap-aware nextDeliverablePosition (unit) - sequence exhausted -> null.
- CHUA TEST:
  - Freeze sequence qua UI (picker + save) - khong journey (spec ghi RTL phu; e2e chi mo man hinh).
  - Deliver khi exercise trong sequence da bi close - deliverForSession khong re-check exercise.status tai thoi diem deliver -> tao SessionExercise nhung openForStudent an (published filter) = "delivered-then-invisible"; khong test.
  - assignExerciseSequence voi exerciseId khong published -> BAD_REQUEST (writeSequenceUpdate guard - negative chua test).
  - listExerciseSequence class khong ton tai -> NOT_FOUND - khong test.
  - >200 exerciseIds (zod) - khong test.

### Cross-cutting (session-done / sweep - ADR 0044, feed P2)
- DA TEST: class/session-done.test.ts (15) + worker/session-done-sweep.test.ts (8): 3 dieu kien (>=1 present, moi present co assessment confirmed, evidence published >=1 anh) - time gate (now >= endTime; confirm som khong gian lan) - doneAt = MAX(timestamps) dong bang - auto-cancel buoi 0 present sau endTime+24h + restamp - grace window - race-safe (updateMany conditional) - concurrency 2 sweep = 1 cancel - ad-hoc session (khong scheduleSlot) cancel - cancel -> FinalGrade recompute.
- CHUA TEST: cancel sweep khi da co submissions -> giu SessionExercise (chi test nhanh revoke-when-0-submissions; nhanh keep-when-submissions-exists khong co test).

---

## Concerns / khoang trong docs (khong phai mo coi - artifact rieng)

1. TL26 thieu spec WF-P2-09: docs/26 chi co WF-P2-01..08 (tieu de file ghi "WF-P2-01..08"). P2-09 (xep day) duoc track o journey + acceptance-report + code (ADR 0045 sec8) nhung khong co section chuan 12-muc trong TL26 va khong co row trong TL25 sec2 (matrix chi P2-01..08). -> nen append row P2-09 + section TL26 neu muon khep kin ma tran 9 luong.
2. Drift spec<->as-built tao lop: TL26 WF-P2-01 dat ten classBatch.create; UI as-built goi lmsOps.createClassWithUnits (unit-aware, ADR 0045) - ca hai deu ton tai + duoc test, nhung doc chua ghi duong UI moi.
3. TL26 WF-P2-07 khong neu assessment.confirm la giao_vien-only (GDDT co assessment.draft nhung khong confirm duoc).
4. TL26 WF-P2-02 khong neu kill-switch env ATTENDANCE_WINDOW_ENFORCED (default ON chi o production; dev/test OFF).
5. no-ui-path ton tai co chu dich (P2-03/P2-05): acceptance-report ghi ro "giu no-ui-path den journey hoc vien seed SessionExercise" - hoc vien lam/nop bai moi chi co API test, chua co e2e UI.
6. Vai tro GDKD/sale trong P2 chi co class.read (doc lop) - khong co quyen ghi nao; khong phai gap, la thiet ke.

## Ket luan

- API coverage: rat day (~180+ test API/domain cho 9 luong, du cac guard forbidden/badRequest/notFound/RLS/anti-concurrency/idempotency neu trong task).
- E2E UI coverage: 3 luong co journey that (P2-04, P2-06, P2-08), 1 luong journey-only-open (P2-09), 1 luong journey-roster-only (P2-07), 2 luong no-journey (P2-01/02, live 03 bu mot phan), 2 luong no-ui-path (P2-03/05).
- Edge case "hot" chua test (nen uu tien neu lam G-test-plan TL29): markAll >200 cap - window boundary exact - saveDraft-after-close - closed-exercise van trong sequence khi deliver ("delivered-then-invisible") - GDDT confirm FORBIDDEN - period-only assessment draft - grade score=0 - cancel-sweep keep-delivery-when-submissions.

**Status: DONE_WITH_CONCERNS**
**Summary:** Da map du 9 luong P2 (P2-01..09) voi vai tro/UI/API/test tu docs chuan (TL26 + TL25 sec2) va xac minh code + acceptance-report; liet ke day du edge cases da test vs. chua test cho tung luong.
**Concerns:** (1) P2-09 thieu spec TL26 + row TL25 sec2; (2) P2-03/P2-05 no-ui-path (chua e2e cho hoc vien lam/nop bai); (3) P2-07 journey khong cham luong AI draft/confirm that; (4) ~12 edge guard nho chua co test (chi tiet trong bang).
