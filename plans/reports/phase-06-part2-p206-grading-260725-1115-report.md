# Phase 6 (part 2a) — P2-06 chấm bài: XONG + de-risk P2-04/P2-08

**Plan:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/phase-06-dot-ghi-danh-van-hanh-lop.md`
**Ngày:** 2026-07-25 · **Branch:** `acceptance-journey-38-lms`

Giao **P2-06** (chấm bài) — sổ **13 → 14/38**. Còn P2-04 + P2-08-GV (đều cần file
upload — đã de-risk, xem cuối).

## P2-06: thiết kế phải đổi giữa chừng (UI thật khác giả định)

Ý ban đầu: chứng minh luật "cộng sao lần đầu" bằng banner "⭐ +1 sao" + chấm lại
= không sao. **Không chạy được qua UI** vì:
- Màn grading chỉ hiện hàng đợi ungraded (`status:'submitted'` hardcode
  `grading.tsx:259`) — chấm xong bài rời queue, KHÔNG chọn lại để chấm lại.
- Banner "⭐ +1 sao" transient: grade success → `onGraded()`→`refetch()` → bài
  rời queue → `DetailPane key={selected.id}` unmount → banner biến mất trước khi
  assert (đã đo: assertion timeout).

**Đổi sang chứng minh queue-transition ổn định:** bài CÓ trong hàng đợi → GV chấm
→ bài RỜI hàng đợi (`toHaveCount(0)`). Luật cộng-sao-lần-đầu do server-test phủ
(`attendance-grading.spec.ts`). Manifest ghi rõ phủ 2/3 procedure
(grade + listForGrading; KHÔNG saveTeacherAnnotation, KHÔNG assert sao qua UI) —
"proven" = đường chấm của GV chạy thật, không phải toàn bộ bề mặt khai.

## Điểm kỹ thuật: ownership filter

`listForGrading` lọc theo `assertTeacherOwnsStudentClass` — GV CHỈ thấy bài của
HV trong lớp mình sở hữu. Setup phải khớp:
`seedAppUser(GV)` → `seedClassBatch({teacherAppUserId})` → `seedActiveEnrollment`
(HV trong lớp đó) → `seedPublishedExercise` → `seedSubmittedSubmission`. Session
GV dùng ĐÚNG `userId` của teacher AppUser để ownership resolve. Discriminator:
`HS: <studentId 8 hex đầu>` (unique per-run, không đụng detail pane "Học sinh:").

## Falsification + kiểm chứng

- Bỏ bước chấm → bài ở lại queue → `toHaveCount(0)` đỏ (load-bearing) ✅
- 4× liên tiếp: 4/4 xanh (~20s)
- Full `ui-chromium`: **22/22 xanh** (3.5′); typecheck 27/27 · lint sạch · test
  2100 · 0 file sản phẩm bị chạm
- Code review độc lập: DONE_WITH_CONCERNS — 1 MEDIUM (note thiếu minh bạch về
  saveTeacherAnnotation + sao ngoài scope) → **đã sửa** (mở rộng note); 0
  critical/high. Xác nhận mọi phân tích thiết kế đúng với source.

## De-risk P2-04 + P2-08 (cho phiên sau)

Cả hai cần **file upload** — chưa journey e2e nào từng làm. Đã xác minh feasibility:

- `createBlobStorage()` (`packages/storage/src/index.ts:31`) mặc định
  `LocalDiskBlobStorage('.data/blobs')` khi `S3_ENDPOINT` unset → **chạy được
  trong e2e** (ghi đĩa, không cần cloud config).
- Upload: `POST /upload/exercise-pdf`, Content-Type `application/pdf`,
  `credentials:'include'` (staff cookie), body = PDF bytes. Auth: session +
  `exercise.manage` (CHỈ GĐĐT — `auth/index.ts:96`).
- Playwright: `setInputFiles` trên input ẩn (`exercises.tsx:265`) → onChange →
  `handlePdfUpload` → fetch. Cần buffer PDF nhỏ hợp lệ.

### P2-04 contract (đã map)
- GĐĐT `/teaching/exercises` → "Tạo bài tập" → dialog: Selector "Đơn vị học"
  (CurriculumUnit — synth có 2, hoặc seed unit unique để nhận diện) + Selector
  "Loại bài tập" + upload PDF → "Tạo bài tập".
- Row draft → nút publish (`exercises.tsx:148-154`); published → "Đóng"
  (`:157-163`). Cần discriminator để tìm ĐÚNG row của mình (unit title?).
- Rủi ro: nhận diện row trong list nhiều exercise; upload lần đầu.

### P2-08-GV contract (chưa map sâu)
- GV `/teaching/session-evidence` soạn + publish; nửa PH thuộc Phase 8.
- Upload ảnh (`SESSION_PHOTO_UPLOAD_PATH` `upload-route.ts:24`) — cùng cơ chế.

## Finding sản phẩm tích luỹ (bàn giao plan sửa)
1. Ô học phí từ chối số tròn (min=1 step=100000)
2. `Cmc2026@` literal lặp 4 chỗ
3. recon `self_approved` dead-path-qua-UI; mô tả `exceeds_threshold` lệch code
4. mark-lost từ màn chi tiết không refresh (thiếu invalidate opportunityGet)
5. **MỚI (nhỏ):** banner grading hardcode "⭐ +1 sao" trong khi starReward cấu
   hình được — hiển thị lệch nếu reward ≠ 1

## Câu hỏi chưa giải quyết
- P2-04 + P2-08-GV: tiếp phiên sau, upload đã de-risk, contract P2-04 đã map.
- P2-06 `saveTeacherAnnotation` (ghi chú PDF) — ứng viên mở rộng hoặc bỏ khỏi
  `expected.trpc` để manifest khớp journey (reviewer nêu; chưa quyết).
