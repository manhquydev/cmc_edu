# Scout: đối sánh vận hành hàng ngày (cmc-lms → cmc_edu)

- Ngày: 2026-08-13
- Phạm vi: điểm danh, nhật ký buổi học + ảnh, họp PH, sao/quà, ghi danh + dãy unit, bộ đếm mã, cron/job
- NGUỒN: `/home/manhquy/Downloads/cmc-lms` freeze `031d193`
- ĐÍCH: `/home/manhquy/Downloads/cmc_edu` HEAD `af85b78`
- Cách làm: `/ak-scout` + 4 Explore song song + đọc schema/router hai bên. Chỉ đọc. Không suy đoán: thiếu thì ghi `không tìm thấy`.

Quy ước cột 4: **BẮT BUỘC** = đích thiếu năng lực nguồn đang dùng thật hàng ngày; **NÊN CÓ** = đích có nhưng lệch cửa sổ/trường/luồng so với nguồn; **BỎ ĐƯỢC** = nguồn chỉ còn bảng/spec, hoặc đích đã thay bằng hợp đồng khác có chủ ý.

## Bảng đối sánh

| Năng lực | cmc-lms (file:dòng) | cmc_edu (file:dòng hoặc THIẾU) | Mức độ + 1 câu lý do |
|---|---|---|---|
| Enum điểm danh `present/absent/late` | `packages/db/prisma/schema.prisma:88-92` | `packages/db/prisma/schema.prisma:145-149` | **BỎ ĐƯỢC** — cùng 3 trạng thái, không lệch hợp đồng. |
| Ghi điểm danh 1 HS (upsert, sửa được) | `apps/api/src/routers/attendance.ts:559-649` (`attendance.mark`, upsert `:617`) | `apps/api/src/attendance/router.ts:203-264` (`attendance.mark`, upsert `:217`) | **NÊN CÓ** — cả hai sửa bằng ghi đè; đích không có xóa (cùng ý “không unmark”). |
| Điểm danh cả roster | `apps/api/src/routers/attendance.ts:652-760` (`markAll`, `overwriteExisting` mặc định `false` `:667-673`) | `apps/api/src/attendance/router.ts:268-378` (`markAll`, client gửi từng `entries`) | **NÊN CÓ** — đích không có cờ giữ điểm đã chấm; an toàn hơn nếu UI chỉ gửi phần còn trống. |
| Ai được điểm danh | GV của buổi + admin: `attendance.ts:24-41,560-562`; role chỉ `teacher\|admin` `schema.prisma:15-18` | `giao_vien` + `giam_doc_dao_tao` ghi: `apps/api/src/attendance/router.ts:204` + ownership `assert-teacher-owns-class.ts`; director override cửa sổ `:106-110` | **NÊN CÓ** — đích tách vai ERP; không có trợ giảng ở cả hai. |
| Cửa sổ giờ điểm danh | Mở 15 phút trước giờ học → hết ngày ICT: `apps/api/src/lib/attendance-window.ts:33-64`; admin không bị cửa sổ `attendance.ts:39-40` | `[start−30m, end+2h]`: `apps/api/src/attendance/router.ts:123-138`; tắt ngoài production trừ `ATTENDANCE_WINDOW_ENFORCED` `:116-121` | **NÊN CÓ** — GV nguồn còn điểm danh tới nửa đêm; đích đóng 2 giờ sau hết buổi. |
| Trường `excused` + `note` khi điểm danh | Schema `:436-437`; input `attendance.ts:420-426`; UI GV `apps/web/src/teacher/session-attendance-page.tsx:61,123` | **THIẾU** — `Attendance` đích `:1006-1026` không có `excused`/`note`; UI `apps/admin/src/pages/teaching/attendance.tsx` không tìm thấy các trường này | **NÊN CÓ** — nguồn đang ghi nghỉ có phép và ghi chú vận hành; đích chỉ cycle present/late/absent. |
| Roster buổi theo dãy unit + ngày gỡ | `attendance.ts:51-116` (`isEntitled` + `enrollmentCoversSession` + chặn lifecycle) | Dual-gate `onRoster` khi buổi đã stamp unit: `attendance/router.ts:173-199`; enrollment phải `active` `:162-164` | **NÊN CÓ** — đích thêm cổng `Enrollment.status=active` (tiền); nguồn không dùng cột status làm cổng. |
| PH/HS xem lịch sử điểm danh | `attendance.myAttendance` / `attendanceForChild` `:766-778`; buổi chưa điểm danh vẫn hiện (`:137-138`) | `attendance.listForChild` `:426-467`; chỉ hàng đã chấm, `take: 100` `:454-461` | **NÊN CÓ** — đích không trả buổi chưa điểm danh nên PH không thấy “còn thiếu”. |
| Báo cáo chuyên cần tháng theo lớp | `attendance.monthlyReport` `:784-792`; UI `apps/web/src/admin/attendance-report-page.tsx` | **THIẾU** — không tìm thấy `monthlyReport` / `monthlyAttendance` trong `apps/` đích | **NÊN CÓ** — nguồn admin đọc chuyên cần theo tháng; đích chỉ có `recomputeFinalGrade` phụ sau khi chấm. |
| UI GV điểm danh | `apps/web/src/teacher/session-attendance-page.tsx:49-61` | `apps/admin/src/pages/teaching/attendance.tsx:27-56` + panel `panels/attendance-panel.tsx:17-33` | **BỎ ĐƯỢC** — cả hai có màn điểm danh; khác layout. |
| Nhật ký buổi (`SessionEvidence` draft/published) | Model `:449-469`; `sessionEvidence.upsertDraft` `apps/api/src/routers/session-evidence.ts:296-374` | Model `:1153-1171`; `sessionEvidence.upsert` `apps/api/src/session-evidence/router.ts:161-208` | **NÊN CÓ** — cùng draft→publish; đích **cấm sửa sau publish** `:184-186`. |
| Ảnh nhật ký (`SessionEvidencePhoto`) | Model `:471-482`; `attachPhoto`/`removePhoto` `session-evidence.ts:376-409`; tối đa 20 ảnh `:14,390` | Model `:1176-1186`; `addPhoto` `session-evidence/router.ts:261-293`; **không tìm thấy** `removePhoto` | **NÊN CÓ** — đích gắn được ảnh nhưng không tìm thấy procedure gỡ ảnh. |
| Publish nhật ký cho PH | `sessionEvidence.publish` `:411-452`; bắt buộc tóm tắt + ≥1 ảnh + ≥1 nhận xét HS `:432-434` | `sessionEvidence.publish` `:298-338`; chỉ bắt ≥1 ảnh `:324-326`; không bắt summary/comment | **NÊN CÓ** — nguồn không cho công bố nhật ký rỗng nội dung; đích cho công bố chỉ cần ảnh. |
| Gỡ publish / sửa nhật ký đã công bố | `unpublish` `:454-466`; `upsertDraft` không chặn published (sửa sống) | **THIẾU** `unpublish`. Sửa published bị từ chối `:184-186`; thêm ảnh sau publish bị từ chối `:274-276` | **BẮT BUỘC** — GV nguồn sửa/gỡ nhật ký sai sau khi PH đã thấy; đích khóa cứng. |
| Nhận xét từng HS trên nhật ký (`SessionStudentComment`) | Model `:484-500`; template `:17-21`; bắt buộc khi publish `:434` | **THIẾU** model/router `SessionStudentComment`. Đích có `QualitativeAssessment` riêng `:1124-1147` và bắt `confirmed` để đóng buổi `apps/api/src/class/session-done.ts:8-12` | **NÊN CÓ** — đích thay bằng đánh giá định tính tách khỏi nhật ký; PH nhật ký đích chỉ thấy `summary` + ảnh (`session-evidence/router.ts:52-57`). |
| PH đọc nhật ký đã publish | `listForPrincipal`/`detailForPrincipal` `:469-526`; lọc comment đúng con `:495` | `listForChild` `:349-421`; `internalNote` bị strip `:96-117` | **NÊN CÓ** — đích có đọc; thiếu nhận xét theo con trên chính nhật ký. |
| Đồng ý ảnh (`photoConsent`) | **không tìm thấy** `photoConsent`/`consentPhoto` trong schema/router/UI nguồn | `Guardian.photoConsent*` `schema.prisma:509-527`; `guardian.setPhotoConsent` `session-evidence/router.ts:428-456`; ẩn ảnh khi chưa đồng ý `:385-416`; UI `apps/lms/src/pages/parent/consent-settings.tsx:3` | **BỎ ĐƯỢC** — nguồn không có; đích đã làm chặt hơn (opt-in). Không phải lỗ hổng đích so với nguồn. |
| Họp phụ huynh — procedure thật | Model `ParentMeeting` `:312-329` + enum `:104-107`. **Không** có router: `apps/api/src/routers/index.ts:16-30`. Spec `docs/role-matrix.md:52` ghi v2 chưa build | Có CRM theo HS: `parentMeeting.list/schedule/complete/cancel` `apps/api/src/meeting/router.ts:36-150`; UI `/crm/post-sale-meeting` `apps/admin/src/pages/crm/post-sale-meeting.tsx`. Manifest đích tự ghi họp theo lớp + nhắc **chưa xây** `scripts/acceptance-report/flow-manifest.ts:856-861` | **BỎ ĐƯỢC** với họp sau bán (đích đã có). **NÊN CÓ** nếu cần họp theo lớp + PH xác nhận như spec nguồn — cả hai đều chưa có `parentMeeting.myMeetings`. |
| Cộng sao khi công bố/chấm bài | `creditHomeworkStars` `apps/api/src/services/star-ledger.ts:18-28`; gọi từ `submission.publish`; `STAR_REWARD=10` `packages/domain/src/grading-scale.ts:9-10` | `submission.grade` mint `homework_completed` `apps/api/src/submission/router.ts:414-432`; số sao lấy `exercise.starReward` | **NÊN CÓ** — cùng sổ cái; nguồn cố định +10, đích theo bài. |
| Đọc số dư sao | `rewards.myStarBalance` / `starBalanceForChild` `apps/api/src/routers/rewards.ts:18-33`; UI `apps/web/src/lms/rewards-page.tsx` | `gift.listForStudent` trả `starBalance` `apps/api/src/rewards/gift-router.ts:84-99` | **BỎ ĐƯỢC** — đích có đọc số dư (gộp catalog). |
| Catalog quà + đổi quà + duyệt/giao/hoàn | Model `Gift`/`Reward` `:740-791` + enum `RewardStatus` `:135-140`. **Không** có procedure redeem/approve. Router rewards chỉ đọc số dư `:1-4`. Role-matrix `:49` “không đổi quà” | `gift.upsert/list/listForStudent` `gift-router.ts:29-99`; `rewards.redeem/approve/deliver/reject` `reward-router.ts:41-206`; UI admin `apps/admin/src/pages/engagement/` + LMS `apps/lms/src/pages/student/gifts.tsx` | **BỎ ĐƯỢC** — nguồn chỉ giữ bảng; đích đã có luồng thật. Không phải THIẾU của đích. |
| Ghi danh không qua tiền | Admin `enrollment.addWithUnits` tạo/tái dùng `Enrollment` + `EnrollmentUnitRange` `apps/api/src/routers/enrollment.ts:254-359`. Comment `:1-3`: cột `status` không phải cổng roster. Spec: tiền xử ngoài hệ | `enrollment.enroll` chỉ tạo `reserved` `apps/api/src/enrollment/router.ts:4-8,41-73`. `active` chỉ từ `finance.receiptApprove` → `activateEnrollmentForReceipt` `activate-enrollment.ts:1-5` + `provision-from-receipt.ts:424-449`. `lmsOps.addWithUnits` `:228-247` **đòi enrollment đã `active`** | **BẮT BUỘC** — nguồn cấp quyền học bằng tay không cần phiếu thu; đích không cấp range nếu chưa có enrollment `active` (tức đã duyệt tiền). |
| Cấp bù unit quá khứ | `enrollment.previewGrantPast` + `grantPast` `enrollment.ts:587-678` | `lmsOps.grantPast` `lms-ops/router.ts:420-489` (cũng đòi `active`) | **NÊN CÓ** — cùng ý backfill; đích vẫn kẹt cổng tiền. |
| Thu hồi unit từ unit hiện tại | `enrollment.revokeFromNext` `enrollment.ts:364-411` | `lmsOps.revokeFromNext` `lms-ops/router.ts:496` | **BỎ ĐƯỢC** — đích có. |
| Gỡ / hoàn tác gỡ khỏi lớp | `enrollment.archive` / `unarchive` `enrollment.ts:428-573` | `lmsOps.archiveEnrollment` / `unarchiveEnrollment` `lms-ops/router.ts:573-626` | **BỎ ĐƯỢC** — đích có. |
| Cấp quyền unit sau duyệt phiếu | **không tìm thấy** Receipt/finance trên enrollment nguồn | `grantUnitsFromReceipt` `provision-from-receipt.ts:438-449`; default 4 unit `grant-units.ts:101-107`; idempotent `sourceReceiptId` `schema.prisma:602-603` | **BỎ ĐƯỢC** — đây là năng lực thêm của ERP đích, không có ở nguồn. |
| Mã học sinh + `StudentCodeCounter` | Model `Student.studentCode` `schema.prisma:251-253`; counter `:513-517`; format `HS-YYYY-NNNN` `apps/api/src/services/code-counter.ts:16-18,37-55`; cấp lúc `student.create` `apps/api/src/routers/student.ts:211-229` (loginCode = mã HS) | **THIẾU** — `model Student` `schema.prisma:423-448` không có `studentCode`. `student.lookup` chỉ phone/name `apps/api/src/student/router.ts:29-42`. Tạo HS lúc provision chỉ `fullName` `provision-from-receipt.ts:253-258`. Không tìm thấy `StudentCodeCounter` | **BẮT BUỘC** — nguồn định danh HS/đăng nhập bằng `HS-YYYY-NNNN`; đích không có mã HS. |
| Mã lớp + bộ đếm | `BatchCodeCounter` `:505-509`; `CMC-YY-NNNN` `code-counter.ts:12-14,21-34`; cấp lúc tạo lớp `class-batch.ts:145` | `ClassBatchCodeCounter` `:1032-1041`; `{facility}-{program}-{year}-{seq3}` ví dụ `HN-UCREA-2026-001` `apps/api/src/class/class-code.ts:1-17`; increment `lms-ops/router.ts:146-152` | **BỎ ĐƯỢC** — đích đổi format theo QĐ 0036 + cơ sở; không thiếu bộ đếm lớp. |
| Cron sinh buổi cuốn chiếu | `materializeAllRunningBatches` `apps/api/src/cron.ts:15-54`; lịch `5 0 1 * *` ICT + boot catch-up `:94-99`; gọi `ensureSessionsUntil` | **THIẾU** `apps/api/src/cron.ts` và `node-cron`. Sinh buổi lúc tạo lớp / `schedule.generateSessions` `apps/api/src/class/generate-sessions.ts:1-8` trên `[startDate,endDate]` hữu hạn | **NÊN CÓ** — nguồn lớp chạy vô hạn theo tháng; đích materialize một lần theo ngày kết thúc. Lớp kéo dài/mất generate tay sẽ thiếu buổi. |
| Job phát bài khi hết giờ buổi | `deliverDueExercisesJob` mỗi 5 phút `cron.ts:56-75,101-105` | Worker `drainOnce` gọi `deliverDueExercises` `apps/api/src/worker/index.ts:132` (poll ~30s `:46-48`) | **BỎ ĐƯỢC** — đích có tương đương, khác chu kỳ. |
| Job đóng/hủy buổi tự động | **không tìm thấy** trong `cron.ts` nguồn (chỉ 2 job) | `runDoneSweep` + `runCancelSweep` `worker/index.ts:129-130`; điều kiện done `class/session-done.ts:8-12`; hủy nếu 0 present sau 24h `session-done-sweep.ts:17-18` | **BỎ ĐƯỢC** — năng lực thêm của đích. |
| Job tài chính / email / audit | **không tìm thấy** trong cron nguồn | `reconcileOrphanedReceipts`, `relayEmailOutbox`, `sweepAuditLogRetention` `worker/index.ts:123-135` | **BỎ ĐƯỢC** — ERP đích, ngoài phạm vi nguồn LMS. |

## Năng lực nguồn không có procedure (không tính là “đích thiếu so với vận hành thật”)

| Hạng mục | Nguồn | Đích |
|---|---|---|
| Đổi quà / duyệt Reward | Chỉ schema + seed; role-matrix v2 | Đã build đủ redeem→approve→deliver/reject |
| Họp PH theo lớp + PH xác nhận giờ | Chỉ bảng `ParentMeeting` gắn `classBatchId` | Họp sau bán theo `studentId`; không FK lớp; không `remindedAt`; không API PH |
| Đồng ý ảnh | không tìm thấy | Có, mặc định tắt |

## DE XUAT

Thứ tự ưu tiên cho đích nếu mục tiêu là không tụt vận hành so với LMS đang chạy (`031d193`):

1. **Mã học sinh `HS-YYYY-NNNN` + `StudentCodeCounter`** — không có mã thì lookup/đăng nhập/bàn giao số liệu với hệ đang chạy gãy. BẮT BUỘC.
2. **Cấp ghi danh + dãy unit không qua phiếu thu** — `lmsOps.addWithUnits` phải tạo được enrollment `active` (hoặc cổng break-glass) cho học bổng / nhập liệu / lớp đang dạy. BẮT BUỘC nếu vẫn phải vận hành song song nguồn.
3. **Gỡ publish / sửa nhật ký đã công bố** — GV nguồn sửa nhầm hàng ngày; đích khóa. BẮT BUỘC.
4. **Nhận xét từng HS trên nhật ký (hoặc lộ rõ QualitativeAssessment ra PH như comment nguồn)** — hiện PH đích chỉ thấy tóm tắt lớp + ảnh. NÊN CÓ.
5. **`excused` + `note` + lịch sử PH gồm buổi chưa điểm danh + báo cáo tháng** — thiếu sẽ lệch số chuyên cần so với nguồn. NÊN CÓ.
6. **Khớp cửa sổ điểm danh** (15 phút trước → hết ngày ICT, giám đốc sửa ngoài giờ) hoặc ghi rõ quyết định giữ `[−30m, +2h]`. NÊN CÓ.
7. **Sinh buổi cuốn chiếu** nếu lớp đích không luôn có `endDate` cứng — không bắt chước `node-cron` in-process; có thể thêm job vào worker. NÊN CÓ.
8. **Họp PH theo lớp + nhắc GV + PH xác nhận** — nguồn chưa có procedure; đích đã tự đánh backlog. BỎ ĐƯỢC trước go-live trừ khi PO muốn đúng spec lớp.
9. **Đổi quà** — không port từ nguồn (nguồn chưa chạy); giữ luồng đích. BỎ ĐƯỢC.

Không đề xuất copy nguyên `cron.ts` nguồn: đích đã có worker `deliverDueExercises`. Chỉ thiếu nhánh materialize buổi.

## Câu hỏi còn mở

- PO đã chốt lớp đích luôn hữu hạn `[startDate,endDate]` hay vẫn cần lớp chạy cuốn chiếu như nguồn?
- Break-glass cấp unit không tiền: ai được phép (chỉ GĐĐT) và có bắt buộc ghi lý do/audit không?
- QualitativeAssessment có được coi là thay thế chính thức `SessionStudentComment` trên nhật ký PH không?

## Relevant Files

Nguồn: `apps/api/src/cron.ts`, `apps/api/src/routers/attendance.ts`, `session-evidence.ts`, `enrollment.ts`, `rewards.ts`, `services/code-counter.ts`, `services/star-ledger.ts`, `packages/db/prisma/schema.prisma`.

Đích: `apps/api/src/attendance/router.ts`, `session-evidence/router.ts`, `meeting/router.ts`, `rewards/*`, `lms-ops/router.ts`, `enrollment/router.ts`, `provisioning/provision-from-receipt.ts`, `worker/index.ts`, `packages/db/prisma/schema.prisma`.

Explore agents: attendance/evidence nguồn; gift/meeting nguồn; enrollment/cron nguồn; daily-ops đích — cả 4 DONE, không timeout.

Status: DONE
Summary: Nguồn đang chạy thật ở điểm danh (kèm excused/note, cửa sổ hết ngày, báo cáo tháng), nhật ký có nhận xét + gỡ publish, cấp quyền học bằng tay không tiền, và mã HS `HS-YYYY-NNNN`. Đích đã có điểm danh/nhật ký/sao/đổi quà/họp sau bán/worker phát bài, nhưng thiếu mã HS, cấp unit không qua phiếu thu, và sửa nhật ký sau khi đã công bố.
