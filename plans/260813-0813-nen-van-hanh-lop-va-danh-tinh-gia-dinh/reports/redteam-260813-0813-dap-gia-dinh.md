---
title: "Red-team đáp gia đình — nền vận hành lớp + danh tính gia đình"
date: 2026-08-13
lens: fact-check
plan: plans/260813-0813-nen-van-hanh-lop-va-danh-tinh-gia-dinh/
sources:
  - /home/manhquy/Downloads/cmc_edu
  - /home/manhquy/Downloads/cmc-lms @ 031d193
---

# Red-team đáp gia đình

Góc nhìn: **kiểm từng khẳng định sự thật** trong `plan.md` + `phase-a1` + `phase-a2` + `phase-a3` + `phase-b1`. Chỉ ghi lỗi có (1) câu kế hoạch, (2) file:dòng code, (3) hậu quả nếu thi hành nguyên văn, (4) mức. Không bịa.

Đo trên `cmc_edu` HEAD hiện tại và `cmc-lms` freeze `031d193`. Chỉ đọc code; file này là artifact duy nhất được ghi.

---

## Kết luận ngắn

12 mục bắt buộc: **8 DUNG · 3 SAI (một phần) · 1 DUNG có điều kiện**.
Ngoài danh sách: thêm **4 khẳng định sai** làm đổi cách thi hành (QualitativeAssessment đã theo buổi; không có API gỡ khung lẫn đóng lớp; hai làn đụng `schema.prisma`; B1.5 thiếu spec OTP ngoài 8 file).

Không tìm thấy lỗi sự thật ở các mục đánh **DUNG** bên dưới — không cố bịa thêm.

---

## 12 mục bắt buộc

| # | Khẳng định | Kết luận | File:dòng neo |
|---|---|---|---|
| 1 | `cmc_edu` không có đường mở lại lớp | **DUNG** | `apps/api/src/class/class-batch-router.ts:139-372` (chỉ `create/list/listStudents/get/assignTeacher`); `rg reopen\|reactivate` trong `class/` + `lms-ops/` = 0. Nguồn có `cmc-lms/apps/api/src/routers/class-batch.ts:771-811` |
| 2 | Không hủy buổi khi gỡ khung lịch | **DUNG** (và chặt hơn: **không có API gỡ khung**) | `apps/api/src/class/schedule-router.ts:31-93` chỉ `generateSessions` + `createMany skipDuplicates`. `rg slot_removed\|removeSlot` trong `apps/api/src/class/` = 0. UI `removeSlot` (`apps/admin/src/pages/classes/index.tsx:355`) chỉ là state form tạo lớp. Nguồn hủy tại `class-batch.ts:978-981` và `:1162-1164` |
| 3 | Không có `SessionCancelReason` | **DUNG** | `packages/db/prisma/schema.prisma:731-771` — `ClassSession` không cột `cancelReason`. `cancelSessionWithRestamp` (`apps/api/src/lms-ops/cancel-session.ts:30-38,66`) chỉ nhận `facilityId/sessionId/actorUserId/auditAction`, ghi `{ status: 'cancelled' }`. Nguồn enum `:63-73`, cột `:376-377` |
| 4 | API không có sink `studentIds[0]` nào | **DUNG** | `rg studentIds\[0\]` trong `apps/api` + `apps/lms` + `packages/` = 0 (chỉ `plans/`). Các `studentIds: [input.studentId]` là payload audit, không chọn con đầu |
| 5 | Chỉ 1 chỗ UI `apps/lms/src/pages/parent/home.tsx:126` | **DUNG** | `home.tsx:125-127`: `children.length === 1 ? children[0]!.studentId : null`. `rg children\[0\]` trong `apps/lms` chỉ ra đúng dòng này. E2E dùng `children[0]` không phải UI sản phẩm |
| 6 | `loginStudent` duyệt mọi `StudentAccount` rồi `break` tại `:562-573`; mật khẩu mặc định dùng chung | **DUNG** | `apps/api/src/lms-auth/router.ts:546-573` (`findMany` mọi account có hash, khớp rồi `break`). Comment `:543-545` thừa nhận nhiều account cùng mật khẩu. Default `'Cmc2026@'`: `provision-from-receipt.ts:302-312`, `student/router.ts:94` |
| 7 | 8 router + 7 guard + 15 UI + 14 unit + 8 file / 17 e2e | **DUNG có điều kiện** — số khớp **tập đã chọn**; tập đó **thiếu bề mặt B1 phải sửa**. Xem F-07 | Đúng 8 file liệt kê; đúng 7 helper; 15 file UI có discriminator `kind`; 14 file `*.test.ts` có literal `kind:'parent'\|'student'`; 8 file LMS = 17 `test(` |
| 8 | 1 flow claim thủ tục bị gỡ (P1-07); 2 flow mất journey (P1-07, P1-04) | **DUNG** (trên `flow-manifest`) | P1-07 claim `lmsAuth.requestOtpEmail` + `verifyOtpEmail` (`scripts/acceptance-report/flow-manifest.ts:190-205`). P1-04 journey `lms-student-activation.journey.ui.spec.ts` gọi `loginStudent` + `resetChildPassword`. Chỉ P1-07 claim procedure sẽ gỡ |
| 9 | Importer vứt bỏ 4 cột nội dung bài học | **SAI** | Importer **giữ `chu_de`** (join vào `title`) `packages/db/prisma/import-curriculum-units.mjs:168-180,256-262`. Chỉ **vứt `bai_hoc`, `tu_duy_khai_niem_dat_duoc`, `ghi_chu`**. 240→96, 36/18/42, 1/2/4 bài/unit: **DUNG** |
| 10 | `cmc_edu` không lưu thời lượng buổi ở đâu | **SAI nếu hiểu tuyệt đối**; **DUNG cho catalog 90/110** | `CurriculumUnit` (`schema.prisma:782-804`) không có `sessionMinutes`. CSV `thoi_luong_buoi_phut` không được nhập. **Nhưng** `ScheduleSlot.startTime/endTime` (`:713-715`) và `ClassSession.startTime/endTime` (`:740-741`) đã lưu thời lượng lịch thực tế. Comment nguồn `sessionMinutes` ghi 120 (`cmc-lms/packages/db/prisma/schema.prisma:214-215`) mâu thuẫn CSV 110: **DUNG** |
| 11 | `parseLmsToken` `atob` toàn bộ token 3 phần ⇒ luôn `null` (`lms-session.tsx:39-59`) | **DUNG** cho hàm; **SAI** phần “localStorage luôn ghi rỗng” | Token thật `header.payload.sig` (`session-token.ts:7-11,72`). `atob` trên chuỗi có `.` ném `InvalidCharacterError` → `null`. Login vẫn ghi `sessionToken` + `kind` + `children`/`studentId` (`login.tsx:63-69,163-169`); chỉ `parentAccountId` rỗng (`parsed?.parentAccountId ?? ''`) |
| 12 | `cmc_edu` chưa production, không dữ liệu thật | **DUNG** cho “chưa production-ready / chưa UAT người thật”; **KHÔNG KIỂM ĐƯỢC** từ repo rằng không có instance deploy nào chứa dữ liệu | `README.md:3`, `docs/system-architecture.md:11`, `AGENTS.md` (UAT người thật chưa chạy). Plan đã tự gắn giả định này (`plan.md:142-143`). Không có bằng chứng runtime về DB production của `cmc_edu` |

---

## Phát hiện làm đổi cách thi hành

### F-01 — A3.2 nói `QualitativeAssessment` “chỉ định kỳ” là sai

**Mức: HIGH**

(1) Kế hoạch:

> `cmc_edu` có `QualitativeAssessment` nhưng **khác ngữ nghĩa**: đó là đánh giá **định kỳ** (theo kỳ học), không phải nhận xét **theo từng buổi**. Nhét nhận xét buổi vào đó sẽ làm hỏng cả hai.
>
> — `phase-a3-bai-hoc-va-nhan-xet.md` (mục “Vì sao không dùng QualitativeAssessment sẵn có”)

(2) Code:

```1120:1130:packages/db/prisma/schema.prisma
/// One assessment can be session-scoped (`classSessionId`) OR period-scoped
/// (`period = 'YYYY-MM'`) for monthly report cards — at least one must be set
/// (enforced at the application layer, not the DB).
model QualitativeAssessment {
  ...
  classSessionId String?
  period         String?
```

`assessment.draftComment` nhận `classSessionId` **hoặc** `period` (`apps/api/src/assessment/router.ts:150-154,253-258`). Cổng `done` của buổi **bắt** mỗi HS `present` có `QualitativeAssessment` `confirmed` theo `classSessionId` (`apps/api/src/class/session-done.ts:10-12`; đọc tại `class-session-router.ts:205-207`). Phụ huynh đã xem bản confirmed qua `assessment.listForChild` (`assessment/router.ts:403-457`; UI `apps/lms/src/pages/parent/home.tsx:79`).

(3) Hậu quả nếu thi hành nguyên văn: A3 thêm `SessionStudentComment` như chỗ chứa **duy nhất** cho nhận xét buổi, song song với hệ nhận xét buổi đã chạy và là điều kiện đóng buổi. Giáo viên sẽ có hai ô; phụ huynh có hai nguồn; `done` vẫn đòi `QualitativeAssessment`, không đòi comment mới.

(4) Đổi thi hành: A3.2 phải viết luật ánh xạ với `QualitativeAssessment` (mở rộng 4 trường? hay comment nguồn = lớp dữ liệu khác, và nói rõ vì sao không gộp). Không được coi bảng cũ là “chỉ định kỳ”.

---

### F-02 — A1 giả định có đường gỡ khung / đóng lớp để “móc” lý do hủy

**Mức: HIGH**

(1) Kế hoạch:

> Gỡ khung lịch ⇒ hủy buổi tương lai | **Không có**
> Mở lại lớp ⇒ hồi sinh buổi `class_closed` | **Không có đường mở lại lớp**
>
> Bước 3: sửa/xóa `ScheduleSlot` thì buổi tương lai hủy với `slot_removed`.
> Bước 5: thêm đường mở lại lớp đã đóng.
>
> — `phase-a1-ly-do-huy-va-hoi-sinh-buoi.md:22-24,58-64`

(2) Code: không có mutation xóa/sửa `ScheduleSlot` sau tạo (`schedule-router.ts:31-93`; slot chỉ `create` lúc `classBatch.create` `:212-221` và `lmsOps.createClassWithUnits` `:176`). `ClassBatch.status` là string default `"active"`, comment tự ghi *“Not exercised by any P2-Foundation procedure yet”* (`schema.prisma:662-665`). Không `classBatch.close`, không ghi `status: 'closed'`.

(3) Hậu quả: bước 3/5 đọc như “sửa hook có sẵn”. Thi hành đúng chữ sẽ tìm không ra chỗ móc, hoặc chỉ thêm enum/cột rồi không có caller ghi `slot_removed` / `class_closed`. Hồi sinh khi mở lại lớp cũng vô nghĩa nếu không ai đóng lớp được.

(4) Đổi thi hành: A1 phải **thêm** `removeSlot`/`editSlot` và `close` *trước hoặc cùng* lý do hủy + reopen. Không phải chỉ mở rộng `cancelSessionWithRestamp`.

---

### F-03 — “Hai làn không đụng file chung” sai

**Mức: HIGH**

(1) Kế hoạch:

> Hai làn **không đụng file chung** | A ở `class/`, `lms-ops/`, `curriculum`; B ở `lms-auth/`, `guardian/`, `apps/lms`
>
> A và B đụng bảng khác hẳn nhau; B chỉ có một migration (drop `LoginOtp`) và để cuối
>
> — `plan.md:25,136`

(2) Code: cả hai làn phải sửa `packages/db/prisma/schema.prisma` (A1 enum/cột buổi, A2 `StudentLifecycle`, A3 `CurriculumLesson` + nhận xét; B1 `LoginOtp` + `ParentAccount`/`StudentAccount`). Lịch sử migration Prisma là một chuỗi tuyến tính. A3 ràng buộc “đi qua đúng helper sở hữu đang dùng cho nhật ký buổi” (`phase-a3:91`) — helper đó là `getApprovedChildren` (`guardian/approved-children.ts:39-57`), cùng file B1 tuyên bố gộp thành một helper (`phase-b1:86-87`).

(3) Hậu quả: hai nhánh song song chắc chắn xung đột `schema.prisma` + thứ tự migration. R1 (“trộn nhánh gãy”) không được giảm thiểu bởi “bảng khác”. A3 và B1 có thể viết hai helper sở hữu lệch nhau.

(4) Đổi thi hành: chốt owner `schema.prisma` / thứ tự migration (một nhánh rebase trước khi merge); A3 dùng helper B1 sẽ đổi, hoặc khóa contract helper trước khi hai làn viết.

---

### F-04 — B1.5 “17 e2e + 14 unit” thiếu file sẽ gãy khi gỡ OTP

**Mức: HIGH**

(1) Kế hoạch:

> Test unit | 14
> Test e2e | 8 file / **17 test**
> B1.5 — **Viết lại 17 test e2e + 3 helper**
>
> — `phase-b1-danh-tinh-gia-dinh.md:58-59,92-93`

(2) Code — 8×17 đúng trên đúng 8 file LMS đã chọn. **Ngoài tập đó**, vẫn gọi procedure B1 sẽ gỡ:

- `apps/e2e/tests/enrollment.spec.ts:85-94` — `lmsAuth.requestOtp` + `verifyOtp`
- `apps/e2e/tests/attendance-grading.spec.ts:108-121` — cùng cặp OTP, rồi lấy `children[0]`
- `apps/e2e/tests/journeys/parent-link-approve-reject.journey.ui.spec.ts` (P1-06) — `createLmsClient` kind parent
- `apps/api/src/lms-auth/login.test.ts` — file unit lớn nhất của OTP/`verifyOtp` (**không** nằm trong 14 vì không có literal `kind:'parent'|'student'`)

Ba helper plan ám chỉ (`mint-lms-session.ts`, `session-injection.ts`, `trpc-client.ts`) có thật.

(3) Hậu quả: B1.5 đánh dấu xong sau 17 test, CI vẫn đỏ trên `enrollment.spec.ts` / `attendance-grading.spec.ts` / `login.test.ts`. P1-06 có thể gãy nếu helper kind không được viết lại đủ.

(4) Đổi thi hành: B1.5 phải gồm mọi caller `requestOtp*` / `verifyOtp*` / `loginStudent` / `resetChildPassword` / `kind:'parent'|'student'`, không chỉ 8 file đã đếm.

---

### F-05 — Importer không “vứt bốn cột”; A3 phải nhập 3 cột còn lại + hàng bài

**Mức: MEDIUM**

(1) `phase-a3:26`: “Importer hiện gom 240 dòng thành 96 unit và **vứt toàn bộ bốn cột nội dung đó**.”

(2) `import-curriculum-units.mjs:168-180` đẩy `chu_de` vào `title` (`UCREA — …`). `bai_hoc` / `tu_duy_khai_niem_dat_duoc` / `ghi_chu` không vào payload upsert (`:256-262`). CSV: `chu_de`/`bai_hoc`/`tu_duy` = 0 dòng trống; **`ghi_chu` trống 210/240**.

(3) Hậu quả: người thi hành tưởng `title` không có chủ đề và “khôi phục 4 cột” như dữ liệu mất hết. `ghi_chu` không được bắt buộc (fail-closed sẽ vỡ 210 dòng).

(4) Đổi thi hành: persist `CurriculumLesson` từ 3 cột còn lại (+ `chu_de` ở cấp bài nếu cần granularity 2/4 bài/unit). `note` nullable.

---

### F-06 — `parseLmsToken` luôn null, nhưng session client **không** rỗng

**Mức: MEDIUM**

(1) `phase-b1:112`: “gọi `atob()` trên toàn bộ token 3 phần ⇒ luôn trả null, **localStorage luôn ghi rỗng**”

(2) `lms-session.tsx:39-58` + `login.tsx:63-69,163-169` + `trpc.ts:49-69`. Bearer đi `sessionToken` do API trả; server `verifyLmsToken`. `parentAccountId` client = `''`.

(3) Hậu quả: B1 có thể tưởng “sửa parse cho có”, rồi mã mới đọc `session.parentAccountId` phía client (rỗng) hoặc tin comment `lms-client.ts:18` (“base64url JSON blob” — **lỗi thời** so với HMAC).

(4) Đổi thi hành: decode đúng phần payload (split `.`[1]), hoặc bỏ parse phía client và lấy identity từ API/`verify`. Đừng giả định localStorage trống.

---

### F-07 — Đếm 8 router bỏ `guardian` và nhầm `open-tier` chỉ là helper

**Mức: MEDIUM**

(1) `phase-b1:55`: “Router API mang `kind` | 8 | `lms-auth`, `assessment`, `attendance`, `enrollment`, `rewards`×2, `session-evidence`, `submission`”

(2) `apps/api/src/guardian/router.ts:71` — `guardian.requestLink` là `lmsProcedure` (đọc `ctx.lmsSubject`). `apps/api/src/exercise/open-tier.ts:250-263` — `exercise.openForStudent` / `listForStudent` là **router** `requireLmsStudent`, không chỉ helper. `exercise/upload-route.ts:77-83` cũng đọc `lmsSubject`.

(3) Hậu quả: B1.1 gộp `kind` mà sót `guardian.requestLink` và bài tập mở — HS/PH mới không lấy được bài hoặc gửi link.

(4) Đổi thi hành: thêm hai router (+ upload route) vào checklist B1.1, không tin con số 8.

---

### F-08 — A2 bảng “tập chặn hiện tại = chỉ `blocked_lms`” thiếu `withdrawn`; `loginStudent` không chặn lifecycle

**Mức: MEDIUM**

(1) `phase-a2:33-35`: “`cmc_edu` hiện tại | `blocked_lms`”

(2) `getApprovedChildren` loại `blocked_lms` **và** `withdrawn` (`guardian/approved-children.ts:50`). `loginStudent` (`lms-auth/router.ts:524-621`) **không** đọc `Student.lifecycle`.

(3) Hậu quả: bước “sửa mọi cổng đang so `blocked_lms` sang tập mới” có thể (a) quên `withdrawn` đã có, hoặc (b) tưởng `loginStudent` đã chặn rồi nên không gắn cổng vòng đời lên đường đăng nhập mới.

(4) Đổi thi hành: tập hiện tại = `{blocked_lms, withdrawn}` ở cổng đọc PH. Đường login HS/gia đình phải được nêu riêng — hôm nay không chặn.

---

### F-09 — “Mọi procedure nhận `studentId` tường minh” không đúng với session học sinh

**Mức: MEDIUM**

(1) `plan.md:76`: “mọi procedure nhận `studentId` tường minh rồi kiểm sở hữu”

(2) `requireLmsStudent` lấy `studentId` từ token (`trpc.ts:298-308`). `submission.saveDraft/submit`, `rewards.*`, `exercise.openForStudent` không nhận `studentId` input.

(3) Hậu quả: B1.1 “mọi procedure nhận `studentId` tường minh” nếu áp nguyên lên đường HS sẽ phá contract hiện tại; nếu không đụng đường đó thì checklist “mọi procedure” là sai.

(4) Đổi thi hành: tách hai contract — list PH = `studentId` input + ownership; tác vụ “con đang chọn” = session. Gộp family phải chọn một, viết rõ.

---

## Các khẳng định khác — DUNG

Không tìm thấy sai sự thật ở các điểm sau:

| Khẳng định | Neo |
|---|---|
| `StudentLifecycle` đích 3 giá trị tại `schema.prisma:93-97` | `active / blocked_lms / withdrawn` |
| Nguồn 6 giá trị tại `cmc-lms/schema.prisma:38-45` | `admitted / active / on_hold / transferred / withdrawn / completed` |
| Nguồn `completed` **không** chặn LMS | `cmc-lms/apps/api/src/auth/sessions.ts:15-21` |
| Nguồn `CurriculumLesson` `:228-247`, `SessionStudentComment` `:484-501` | khớp |
| Nguồn `loginFamilyByPhone` `:128-148` | khớp |
| `cmc-lms` không có `SessionStatus.done`; `cmc_edu` có | đích `:137-142`; nguồn `:57-61` |
| CSV 240 dòng; 36/36/168; unit 36/18/42; bài/unit 1/2/4; UCREA 90, còn lại 110 | đo trực tiếp CSV |
| `SessionEvidence` đã có ở đích | `schema.prisma:1153+`, router `session-evidence/router.ts` |
| Ngưỡng 20_000_000 hard-code hai nơi | `finance/router.ts:40`, `reconcile-finance-flags.ts:20-21` |
| Thiếu `PermissionGate` trên `/finance/new` và `/finance/refund` | `finance.routes.tsx:27-33,60-66` |
| Allowlist audit `trpc.ts:109-122` + whitelist `lmsAuth` `verify.ts:41-43` | khớp dòng (allowlist còn kéo tới `:135`) |
| Nguồn đã drop `LoginOtp` (`20260807140000_drop_login_otp`) | plan nguồn phase-06 |

---

## Không kiểm được

| Khẳng định | Lý do |
|---|---|
| `cmc-lms` cutover “0 tài khoản null mật khẩu” trên dữ liệu vận hành | Chỉ thấy trong plan nguồn; không có dump production trong repo freeze |
| “Không có instance `cmc_edu` nào đang chứa dữ liệu người” | Repo + tài liệu nói chưa UAT / chưa production-ready. Không đọc được DB deploy từ đây. Plan đã tự gắn giả định (`plan.md:142-143`) |

---

## Việc không làm

Không sửa code. Không đổi kế hoạch. Báo cáo này chỉ đáp gia đình.

Status: DONE
Summary: 8/12 mục bắt buộc đúng nguyên văn; 3 sai một phần (importer `chu_de`, thời lượng buổi, localStorage rỗng) và 1 đúng trên tập đếm hẹp. Phát hiện nặng nhất: QualitativeAssessment đã là nhận xét theo buổi; A1 không có API gỡ khung/đóng lớp; hai làn đụng schema; B1.5 thiếu spec OTP ngoài 17 test.
