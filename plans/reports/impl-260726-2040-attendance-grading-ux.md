# Sửa lỗi trải nghiệm — Điểm danh & Chấm bài

Ngày: 2026-07-26. Phạm vi: `apps/admin/src/pages/teaching/attendance.tsx`,
`grading.tsx`, test tương ứng, `apps/api/src/submission/router.ts` (hẹp).

## Đã sửa

### 1. Chặn — `?session=` bắt buộc, không link nào truyền (`attendance.tsx`)

Bỏ hoàn toàn cơ chế đọc `sessionId` từ `useSearchParams`. Thay bằng picker
lớp→buổi bê nguyên pattern đã chạy ở `session-assessment.tsx:45-52`:
`classBatch.list` → `Selector` chọn lớp → `classSession.list` (enabled khi có
`classBatchId`) → `Selector` chọn buổi → `attendance.listBySession` (enabled
khi có `sessionId`). File mới: `attendance.tsx:187-195` (`selectClass`/
`selectSession`), `:295-335` (2 bước Selector), toàn bộ roster/tile/save giờ
nằm trong `{sessionId && (...)}`.

### 2. Chặn — Roster hiện UUID thay vì tên (`attendance.tsx`)

Thêm `trpc.classBatch.listStudents.useQuery({classBatchId})` (đã trả
`fullName` — `class-batch-router.ts:302`), build `nameByStudentId` map giống
hệt `session-assessment.tsx:90-95`, gán vào `RosterEntry.fullName`.
`StudentRow` (`attendance.tsx:77-131`) giờ hiện `entry.fullName` thay vì
`studentId.slice(0,8)`.

### 3. Cao — Mặc định `'present'` khi bấm Lưu (`attendance.tsx`)

`localStatus` giờ CHỈ chứa entry đã có status thật (từ DB hoặc đã toggle) —
không còn `?? 'present'` fallback (so với bản cũ dòng 84, 164, 183). Thiếu key
= "Chưa điểm danh" (`UNMARKED_CONFIG`, màu xám, `attendance.tsx:36`).
`toggleStatus` (`:203-211`): click đầu từ trạng thái chưa-đánh-dấu → present,
sau đó cycle present→late→absent như cũ. `handleSave` (`:243-258`) lọc chỉ
entry có status thật gửi lên `markAll`; nếu KHÔNG entry nào được đánh dấu →
hiện `Banner status="warning"` "Chưa có học sinh nào được điểm danh..."
(`:369-373`) thay vì gửi cả lớp `present`. Thêm tile đếm "Chưa điểm danh".

### 4. Cao — `grading.tsx:116` hardcode `numScore > 10` rồi `return` im lặng

Xác minh thực nghiệm: widget `NumberInput` (Astryx) với `min={0}` **tự nó**
không bao giờ gọi `onChange` với giá trị âm hoặc không parse được (đã viết
test debug tạm thời gọi thẳng component, xóa sau khi xác nhận — xem "Việc
không làm"). Vậy validate NaN/âm phía client là dead code không thể tái hiện
qua UI thật. Sửa: bỏ hẳn trần cứng `> 10`; `handleGrade` (`grading.tsx:117-129`)
giờ chỉ có 1 guard kiểu (`score === '' || score === null`, vốn đã được
`isDisabled` chặn ở nút — không phải lỗi validate mới, chỉ type-narrowing).
Server (`submission/router.ts:318-319`, không đổi) vẫn là nguồn xác định trần
điểm thật theo `exercise.maxScore`; lỗi `BAD_REQUEST` của nó hiện qua
`grade.error` Banner có sẵn (`grading.tsx:203-207`) — không còn im lặng.
`NumberInput` bỏ `max={10}` cứng, label đổi "Điểm (0–10)" → "Điểm" (client
không biết `maxScore` thật của từng bài — DTO không có field này, xem mục
"Việc không làm"). List/Detail bỏ hiển thị `/10` cứng (`SubmissionListItem`,
`grading.tsx:84`).

### 5. Cao — Queue hiện `"HS: A1B2C3D4"` thay vì tên (`grading.tsx` + `submission/router.ts`)

Đã kiểm tra ràng buộc riêng tư ở comment `grading.tsx:72` cũ ("Never show
studentCode"): `studentCode` **không tồn tại** trong schema (`grep -rn
studentCode` toàn repo chỉ khớp đúng dòng comment đó; `Student` model —
`schema.prisma:407-429` — chỉ có `fullName`, không có field code nào khác).
`fullName` là field khác, đã được lộ an toàn ở chỗ khác cho đúng role
giáo_viên/class-scoping tương đương: `class-batch-router.ts:302`
(`listStudents`) và `session-assessment.tsx` (đã chạy production). Kết luận:
comment cảnh báo nhầm field không tồn tại, KHÔNG phải cảnh báo chống hiện
`fullName`. Thêm `studentFullName?: string` vào `SubmissionDto`
(`submission/router.ts:74-81`), join `student: { select: { fullName: true } }`
vào `listForGrading` (`:441`) — cùng permission gate `submission.grade` +
`assertTeacherOwnsStudentClass` per-item đã có sẵn (không nới quyền truy cập).
`grading.tsx:76` (list) và `:149` (detail header) dùng
`item.studentFullName ?? fallback truncated-id`.

### 6. Cao — Filter lớp giả (`grading.tsx`)

`listForGrading` không có tham số lọc theo lớp (`listForGradingInput` chỉ có
`exerciseId?`/`status?` — `submission/router.ts:51-54`) và việc thêm lọc thật
đòi sửa `apps/api/src/class/**`/`attendance/**` — ngoài phạm vi cho phép. Bỏ
hẳn `useSearchParams`/`classFilter`/dòng `Lớp: {classFilter}…` (bản cũ
`grading.tsx:248-249,288-292`) thay vì giữ UI lọc không có tác dụng thật.

## Việc không làm + lý do

- **Không thêm `exercise.maxScore` vào DTO** để hiện "/N" động hoặc set
  `max` thật cho `NumberInput`. Brief chỉ cho sửa `submission/router.ts`
  "chỉ khi cần thêm fullName" — mở rộng thêm field khác ngoài phạm vi được
  duyệt. Thay vào đó dựa hẳn vào lỗi server (`grade.error`) đã hiển thị sẵn.
- **Không giữ banner validate NaN/âm phía client** (đã viết ở bản nháp đầu,
  sau đó gỡ): viết một test debug tạm (`src/debug-numberinput.test.tsx`, đã
  xóa) gọi trực tiếp `@astryxdesign/core/NumberInput` với `min={0}` — xác
  nhận widget không bao giờ `onChange(NaN)` hay `onChange(số âm)` (kể cả gõ
  `-5`, `abc`, hay xóa trắng). Giữ code "chết" không test được vi phạm rule
  "Tests added". `handleGrade` giờ chỉ còn type-guard khớp với `isDisabled`.
- **Không sửa `apps/admin/src/pages/classes/**`**, `packages/**`,
  `apps/api/src/class/**`, `apps/api/src/attendance/**` — đúng như giới hạn
  file ownership trong brief (agent khác đang chạy song song trên
  `classes/**`).
- **Không thêm lọc lớp thật cho `listForGrading`** (chỉ bỏ cái giả) — cần sửa
  API `class`/`attendance` router, ngoài phạm vi cho phép của phase này.

## Verify thật (đã chạy)

```
$ pnpm --filter @cmc/admin exec tsc -p tsconfig.json --noEmit
src/pages/classes/index.tsx(445,16): error TS2322: ... (SelectorProps value: string|undefined vs string|null)
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command failed with exit code 2
```
Lỗi DUY NHẤT nằm ở `apps/admin/src/pages/classes/index.tsx` — file KHÔNG
thuộc phạm vi sửa của tôi (agent khác đang chạy song song, `git status`
show file này `M` từ trước khi tôi bắt đầu). Lọc output loại trừ file đó:
0 lỗi liên quan tới `attendance.tsx`/`grading.tsx`/file tôi sửa.

```
$ pnpm --filter @cmc/admin exec vitest run src/pages/teaching
 Test Files  8 passed (8)
      Tests  71 passed (71)
```
(`attendance.test.tsx` 8 test, `grading.test.tsx` 8 test — cả 2 mới/viết lại
đều pass, cộng 6 file test khác trong `src/pages/teaching` không hồi quy.)

```
$ set -a && . ./packages/db/prisma/.env && set +a && pnpm --filter @cmc/api exec vitest run src/submission
 Test Files  4 passed (4)
      Tests  36 passed (36)
```
(gồm test mới `listForGrading includes the student full name` —
`grade.test.ts`.)

```
$ pnpm --filter @cmc/api exec tsc -p tsconfig.json --noEmit
(không output — sạch)
```

```
$ pnpm lint
> eslint apps/admin apps/lms scripts
(exit 0, không warning/error)
```

## GitNexus impact/detect_changes

- `impact(AttendancePage, upstream)` / `impact(GradingPage, upstream)`: mỗi
  hàm chỉ có 1 caller trực tiếp (`routes/teaching.routes.tsx` lazy-import),
  0-3 impacted, risk **LOW**.
- `impact(toSubmissionDto, upstream)` / `impact(SubmissionDto, upstream)`:
  risk **LOW** (6-10 impacted, 0 process/module ảnh hưởng — thay đổi field
  optional, không phá contract cũ).
- `detect_changes({scope: compare, base_ref: main})` trên TOÀN working tree
  báo risk **CRITICAL** — nhưng đây là kết quả GỘP của nhiều agent chạy song
  song trên cùng checkout (thấy rõ trong danh sách: `admin/users.tsx`,
  `admin/shift-config.tsx`, `classes/class-detail.test.tsx`, CRM
  `opportunity-detail`, `finance/receipt-detail` — không file nào tôi đụng
  tới). Flow duy nhất khớp với thay đổi của tôi: `GradingPage → SerializeLayer
  — changed: DetailPane` (đúng, vì tôi sửa `DetailPane`). Không có flow lạ
  nào liên quan tới `AttendancePage`/`submission.listForGrading` xuất hiện
  ngoài dự kiến.

## File đã sửa

- `apps/admin/src/pages/teaching/attendance.tsx` (viết lại, +362/-… dòng)
- `apps/admin/src/pages/teaching/attendance.test.tsx` (viết lại theo picker
  flow mới)
- `apps/admin/src/pages/teaching/grading.tsx` (+/-47 dòng)
- `apps/admin/src/pages/teaching/grading.test.tsx` (mới, 8 test)
- `apps/api/src/submission/router.ts` (+18/-… dòng — chỉ thêm
  `studentFullName`)
- `apps/api/src/submission/grade.test.ts` (+11 dòng — 1 test mới)

Status: DONE
Summary: Sửa xong cả 6 lỗi trong phạm vi cho phép (picker lớp→buổi thay
`?session=`, tên HS thay UUID ở cả điểm danh và chấm bài, bỏ default
'present' im lặng, bỏ trần điểm 10 cứng, bỏ filter lớp giả); toàn bộ verify
(tsc admin+api, vitest admin teaching 71/71, vitest api submission 36/36,
lint) chạy sạch — trừ 1 lỗi tsc tiền tồn tại ở file ngoài phạm vi
(`classes/index.tsx`, agent khác đang sửa).
Concerns/Blockers: `tsc --noEmit` toàn repo hiện fail vì
`apps/admin/src/pages/classes/index.tsx` (không thuộc phạm vi tôi) — cần
agent phụ trách `classes/**` xử lý trước khi CI/typecheck toàn repo xanh trở
lại.
