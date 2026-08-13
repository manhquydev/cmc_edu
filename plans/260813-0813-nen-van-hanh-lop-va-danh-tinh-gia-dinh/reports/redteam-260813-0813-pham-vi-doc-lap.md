# Red-team — Phạm vi và tính độc lập

Kế hoạch: `plans/260813-0813-nen-van-hanh-lop-va-danh-tinh-gia-dinh/`
Đối chiếu: `cmc_edu` (cwd) và `cmc-lms` freeze `031d193`.
Góc: hai làn có thật sự độc lập không, PR có review nổi không, việc thừa/thiếu so với gỡ chặn Đợt 5, cổng nghiệm thu có đo được không.
Chỉ đọc code. Không bịa phát hiện.

**Kết luận trước:** Hai làn **không độc lập**. Câu “không đụng file chung” sai trên đúng những file hub kế hoạch bảo người thi hành tin. Nếu thi hành nguyên văn (hai nhánh song song, ba PR A + một PR B), merge sẽ gãy trên `schema.prisma` / `trpc.ts` / `approved-children.ts` / `flow-manifest.ts` / hai file `db.ts`, và `pnpm acceptance:report` sẽ tụt nhiều hơn “3 flow” mà kế hoạch đã đo.

---

## (a) Hai làn A và B có thật sự không dùng file chung?

### Câu bị sai

`plan.md:25`:

> Hai làn **không đụng file chung** | A ở `class/`, `lms-ops/`, `curriculum`; B ở `lms-auth/`, `guardian/`, `apps/lms`

`plan.md:135` (R1):

> A và B đụng bảng khác hẳn nhau; B chỉ có một migration (drop `LoginOtp`) và để cuối

Phân vùng thư mục đó đã sai trước khi đếm file: A2 **bắt buộc** sửa `guardian/` (cổng đọc LMS); A3 **bắt buộc** sửa `apps/lms` nếu làm “phụ huynh xem nhận xét”; B1 **bắt buộc** sửa `trpc.ts` / `flow-manifest.ts` / hai file `db.ts` — cùng chỗ A cũng phải sửa.

### File cả hai làn đều phải sửa

| File | A sửa vì | B sửa vì | Xung đột |
|---|---|---|---|
| `packages/db/prisma/schema.prisma` | A1 enum + cột `cancelReason`; A2 `StudentLifecycle`; A3 `CurriculumLesson` + `sessionMinutes` + `SessionStudentComment` + FK bài trên buổi | B1 drop `LoginOtp` / `LoginOtpStatus`; có thể NOT NULL `ParentAccount.passwordHash` (ranh giới B1 #4) | **Cùng một file.** Hai nhánh Prisma song song = conflict chắc + lịch sử migration chồng |
| `packages/db/prisma/migrations/` | Mỗi phase A một (hoặc vài) migration, gồm GRANT/RLS bảng mới | Một migration drop `LoginOtp` + gỡ GRANT | Không cùng dòng, nhưng **cùng dãy**. Merge hai nhánh Prisma là việc có thủ tục, không phải “để cuối là xong” |
| `apps/api/src/trpc.ts` | A1 thêm đường mở lại/gỡ khung vào `AUDIT_EXCLUDED_PATHS` nếu tự ghi audit; A2 đụng `enrollment.blockLms` (`:104`) và `student.setLifecycle` (`:136`) | Đổi `LmsSubject.kind` (`:28-34`); viết lại `requireLmsStudent` / `requireLmsParent` (`:298-325`); gỡ/thay 6 path `lmsAuth.*` trong allowlist (`:109-122`) | **Cùng hàm, cùng Set.** Conflict merge + lệch ngữ nghĩa `kind` |
| `scripts/acceptance-report/flow-manifest.ts` | A2: P1-05 còn claim `enrollment.blockLms` (`:126`); P4-05 claim `student.setLifecycle` (`:927`). A3: P2-08 cùng bề mặt nhật ký buổi (`:513-522`) | B1: P1-07 OTP + `LoginOtp` + `/parent/home` (`:201-203`); P1-04 journey kích hoạt HS (`:109`); P2-08 `/parent/evidence` (`:521`); P4-01 `/student/gifts` (`:816`); quy ước E2 `/parent/*` vs `/student/*` (`:10`) | **Cùng mảng `flows`.** Thiếu cập nhật = claim trỏ thủ tục/route đã gỡ |
| `apps/e2e/src/db.ts` | A1 đổi `planClassSessions` / `seedClassBatch` (`:34`, `:1093`) khi buổi mang `cancelReason`; A3 phải xóa `SessionStudentComment` trước `sessionEvidence` (`:368-369`) | Cả file OTP: `readOtpCode` (`:102`), `readOtpCodeByEmail` (`:124`), `loginOtp.deleteMany` (`:187-190`, `:1022`) | File lớn, hai làn sửa hai vùng — merge được nếu kỷ luật; **lệch thứ tự xóa** thì teardown e2e đỏ |
| `apps/api/src/test/db.ts` | A3 thêm `sessionStudentComment.deleteMany` trước `sessionEvidence` (`:161-163`) | `cleanupLoginOtpsByPhone` (`:224-228`) chết khi drop bảng; thứ tự xóa `studentAccount` / `parentAccount` đổi nếu gộp tài khoản | Cùng hàm teardown. Thiếu 1 dòng xóa bảng mới = FK choke cả hai làn |
| `apps/api/src/guardian/approved-children.ts` | A2 đổi `notIn: ['blocked_lms', 'withdrawn']` (`:50`) sang tập chặn 6 giá trị | B1 gộp helper sở hữu; `actorKind?: 'parent' \| 'student'` (`:68`) hết nghĩa | **Cùng hàm `getApprovedChildren`.** Đây là cổng đọc LMS duy nhất |
| `apps/api/src/exercise/open-tier.ts` | A2 đổi `lifecycle === 'blocked_lms'` (`:79`, `:164`) và luật “`completed` xem được / không nhận bài mới” | `loadLmsStudent` đi qua `getApprovedChildren` (`:52`); procedure dùng `requireLmsStudent` (kind) | Cùng file, hai lý do khác nhau |
| `apps/api/src/session-evidence/router.ts` | A3 gắn nhận xét vào nhật ký buổi, dùng đúng helper sở hữu (`:363`, `:435`) | B1 đổi `ctx.lmsSubject.kind` (`:372`) và gộp ownership | A viết API trên hợp đồng kind mà B xóa |
| `apps/lms/src/pages/parent/session-evidence.tsx` | A3 bước 5: phụ huynh xem nhận xét | B1.4 gỡ cây `/parent` vs `/student`; trang này chặn `session.kind !== 'parent'` (`:44`) | Cùng file UI |
| `apps/api/src/router.ts` | A đăng ký reopen / comment / lesson | B gỡ/thay `lmsAuth` | Cùng object router — thường merge được |
| `packages/auth/src/index.ts` | A1/A2 thêm quyền đóng/mở lớp, đổi vòng đời | B1 ranh giới #3: `family` đứng đâu trong registry 9 vai (`:10-20`) | Cùng registry. Comment `:9` cấm thêm vai không có ADR |
| `apps/api/src/lms-auth/login.test.ts` | A2: fixture `lifecycle: 'blocked_lms'` (`:236`) | B1 viết lại toàn bộ login | B nuốt hết test A đang dựa vào |
| `apps/api/src/enrollment/router.ts` | A2: `blockLms` ghi `blocked_lms` (`:98`) | B1: `mine` gọi `requireLmsParent` (`:129`) | Cùng file, hai procedure |
| `apps/api/src/provisioning/provision-from-receipt.ts` | A2 có thể mặc định HS mới = `admitted` (`student.create` `:253-258`) | B1: comment OTP email (`:73-75`); mật khẩu mặc định `StudentAccount` (`:302-312`) — đúng bug nhà nhiều con | Cùng đường sinh tài khoản lúc thu tiền |
| `apps/api/src/audit/audit-helpers.ts` | A mutation mới đi auto-audit | B đổi `kind === 'student'` → prefix actor (`resolveAuditActor`) | Semantic cùng hàm |
| `apps/api/src/session-evidence/photo-access.ts` | A2 đổi tập `getApprovedChildren` (ai còn thấy ảnh) | B1: `lmsSubject.kind === 'student'` (`:50-58`) | Semantic |
| `scripts/acceptance-report/verify.ts` | A1/A3 procedure mới vào orphan / `DOCUMENTED_GAPS` | B1 sửa `INFRA_NAMESPACE_WHITELIST` `lmsAuth` (`:43`) | Cùng file; orphan **fail exit 1** (`:405-412`) |

### Năm file được chỉ định — kết luận từng cái

| File được hỏi | Chung? | Bằng chứng |
|---|---|---|
| `apps/api/src/trpc.ts` | **Có — bắt buộc** | Allowlist chứa **cả hai làn** trong một `Set`: A=`enrollment.blockLms` `:104`, `classSession.cancel` `:107`, `student.setLifecycle` `:136`; B=`lmsAuth.requestOtp`…`verifyOtpEmail` `:109-122`. `LmsSubject.kind` `:31` và `requireLmsStudent` `:302` là hợp đồng B phải phá. |
| `apps/api/src/context.ts` | **Không** — chỉ B | `devLmsUserHeaderSchema.kind` `:43` là `'parent' \| 'student'`. A không parse token. Không cần A sửa file này. |
| `scripts/acceptance-report/flow-manifest.ts` | **Có — bắt buộc** | Xem bảng trên. Không phải “chỉ B1.5”. |
| `apps/e2e/src/db.ts` | **Có — bắt buộc** | OTP (B) và teardown `SessionEvidence` / `seedClassBatch` (A) nằm cùng file. |
| `apps/api/src/test/db.ts` | **Có — bắt buộc** | Thứ tự xóa FK (`:161-163`) + `cleanupLoginOtpsByPhone` (`:224-228`). |

`context.ts` là file **duy nhất** trong danh sách được hỏi mà hai làn không cùng phải sửa.

### Hậu quả nếu thi hành nguyên văn

Hai nhánh `feat/lms-class-lifecycle-depth` ‖ `feat/lms-family-identity` sẽ conflict trên `schema.prisma` và `trpc.ts`. Dù giải conflict chữ, A2 và B1 vẫn đua nhau viết `getApprovedChildren`: một bên đổi tập chặn, một bên đổi `actorKind`. Nhánh nào merge sau thắng thầm — HS `completed` bị giấu, hoặc nhà hai con lại lọt cổng sở hữu.

Mức: **CRITICAL**

---

## (b) Mỗi phase có ra được một PR review nổi không?

Ước lượng file **phải đụng** (schema + API + UI + test + script). Không đếm `node_modules`. Số là cận dưới từ chỗ đã thấy trong repo, không phải đoán từ mô tả phase.

### A1 — Lý do hủy + hồi sinh + mở lại lớp

Kế hoạch viết như “thêm enum + truyền `reason`”. Code thật: **ba hành vi chưa có**, và hai trong số đó chưa có cả đường vào.

- `cancelSessionWithRestamp` không nhận lý do (`apps/api/src/lms-ops/cancel-session.ts:30-38`). Caller đúng 2: `class-session-router.ts:298`, `lms-ops/router.ts:406`.
- `schedule-router.ts` chỉ có `generateSessions` — **không có** add/remove `ScheduleSlot` (`rg addSlot|removeSlot|scheduleSlot.delete` trong `apps/api/src` = 0, trừ teardown test).
- `class-batch-router.ts` không có close/reopen. `status: 'closed'` trong `apps/api/src` chỉ xuất hiện ở after-sale và exercise, **không** ở lớp.
- `ClassBatch.status` là `String` mặc định `"active"` (`schema.prisma:662-665`), chưa có procedure nào đổi.

| Nhóm | File (cận dưới) |
|---|---|
| Schema + migration + GRANT | 2–3 |
| API: cancel, generate-sessions, schedule (viết mới add/remove slot), class-batch (viết mới close+reopen), stamp, auth registry, `trpc.ts` | 8–10 |
| Test API | 5–8 |
| `apps/e2e/src/db.ts` nếu seed buổi cancelled | 1 |
| UI admin (kế hoạch không bắt, nhưng mở lại lớp không có màn thì cổng A1 không đi hết UI) | 0 hoặc 3–5 |

Caller hủy buổi **đã có** mà A1 phải sửa chữ ký (`reason` bắt buộc, không mặc định — `phase-a1:56-57`): `class-session-router`, `lms-ops/router`, **và** `worker/session-done-sweep.ts` (hủy không lý do). Test đã gọi cancel: `lms-ops.int.test.ts`, `bright-ig-gaps.int.test.ts`, `exercise-delivery.int.test.ts`, `generate-sessions.test.ts`, `list-in-range.test.ts`, `attendance/gate.test.ts`, `session-done-sweep.test.ts`, 2 test UI admin.

**Tổng ship-safe: ~30–37 file** nếu làm đủ UI + mọi caller. API+test không UI: ~25. Một PR **không review nổi** nếu nhồi ba máy trạng thái (hủy có lý do / slot / đóng-mở lớp).

Thiếu bước **đóng lớp** trong `phase-a1:53-66` làm PR A1 hoặc không review nổi (phải bịa close) hoặc cổng “mở lại lớp” không chạy được. Tách: A1a enum+reason mọi writer; A1b slot remove/add + hồi; A1c close+reopen.

### A2 — Vòng đời 3 → 6

`blocked_lms` đang sống ở **ít nhất 16 file** (schema, 2 router ghi, `approved-children`, `open-tier`, `on-roster`, `assert-student-active`, finance comment, 2 trang admin, 6+ file test, `flow-manifest`).

**Tổng: ~22–30 file.** Một PR **review nổi** nếu chỉ enum + cổng + test. Không nhồi UI mới.

Cảnh báo thi hành: `onRoster` (`apps/api/src/lms-ops/on-roster.ts:10-34`) **đã là** hàm thuần hợp thành vòng đời × dải unit. A2 bước 3 (“viết một hàm thuần dùng chung”) nếu viết hàm thứ ba thì PR vừa to vừa lệch — xem (c).

### A3 — Bài học + nhận xét

Hai bề mặt không chung caller:

- Catalog: `import-curriculum-units.mjs`, `ensure-curriculum-units.ts`, `CurriculumUnit`, đóng dấu buổi.
- Nghiệp vụ HS: `SessionEvidence` + RLS + `apps/lms` + `apps/admin`.

**Tổng: ~18–28 file.** Một PR **quá to** — hai lý do review, hai dãy test, một file schema. Nên hai PR trên cùng nhánh A (bài học rồi nhận xét).

### B1 — Một tài khoản gia đình

Số kế hoạch tự đo (`phase-b1:53-59`): 8 router + 7 guard + 15 UI + 14 test unit + 8 file e2e. Cộng thêm file kế hoạch không tính vào “phạm vi đã đo”:

- `schema.prisma` + migration drop
- `flow-manifest.ts` + `verify.ts`
- `apps/e2e/src/db.ts`, `session-injection.ts`, `mint-lms-session.ts`, `trpc-client.ts`
- `apps/api/src/router.ts`, `packages/auth/src/index.ts`
- provisioning / receipt (OTP email trên phiếu thu — `provision-from-receipt.ts:75`)

**Tổng: ~60–80 file.** Một PR **không review nổi**. `phase-b1:79` ranh giới #8 tự hỏi “một PR lớn hay chuỗi PR” rồi **không trả lời**, trong khi `plan.md:107` đóng B thành một nhánh / một phase.

Thi hành: tách tối thiểu 3 PR trên nhánh B (token+API → gỡ OTP → UI+journey). Đừng gộp B1.1–B1.5 một diff.

Mức: **HIGH** (B1 một PR; A3 hai tính năng; A1 thiếu close/slot)

---

## (c) Việc thừa — không phục vụ gỡ chặn Đợt 5

Mục tiêu A tự khai (`plan.md:23`): chỗ chứa để nhập dữ liệu thật **không mất**. Đợt 5 (`phase-05`) cần bảng + ánh xạ + đối soát, không cần màn hình đẹp.

### Cắt được

| Việc | Chỗ kế hoạch | Vì sao thừa cho Dot 5 | Đề xuất |
|---|---|---|---|
| Gộp hằng số 20 triệu + `PermissionGate` `/finance/new` `/finance/refund` | `plan.md:62-65` (QĐ thi hành #3–#4) | Không nằm phase nào. Không phải chỗ chứa import. Đụng `finance/router.ts:40` và `reconcile-finance-flags.ts:20` — file **không** thuộc A hay B | **Cắt khỏi plan này.** Mở issue/plan tài chính riêng |
| Toàn bộ Làn B như “gỡ chặn Dot 5” | `plan.md:19-25`, B1 | Dot 5 E1 ánh xạ danh tính **theo SĐT** trên mô hình hiện có (`ParentAccount.phone` unique, `schema.prisma:450-454`). Nguồn đã drop `LoginOtp`. Import không cần gộp family trước | Giữ B chỉ nếu chủ hệ thống muốn cắt chuyển vào mô hình mới. **Đừng chặn Dot 5 chờ B1** |
| A3 bước 4–5 UI GV/PH | `phase-a3:100-104` | Plan mẹ đã chuyển giao diện sang Đợt 4 (`plan` mẹ `:195`). Dot 5 cần bảng + API ghi. CSV 240 bài đo được bằng importer, không cần màn | Cắt UI khỏi A3; để Đợt 4. A3 giữ schema + importer + procedure |
| B1.2 quên mật khẩu + kênh SMS | `phase-b1:76-77`, bước B1.2 | Không phải chỗ chứa import. Hệ chưa chắc có SMS — ranh giới mở | Cắt khỏi B1. Làm sau cutover |
| Sửa `parseLmsToken` `atob()` | `phase-b1:112` | Lỗi phụ, “không load-bearing”. Không chặn import | Issue riêng, đừng nhồi PR 60 file |
| A2 “viết một hàm thuần dùng chung” nếu hiểu là hàm mới | `phase-a2:59` | `onRoster` đã hợp thành lifecycle × dải (`on-roster.ts:10-34`). Đọc LMS đã đi `getApprovedChildren`. Luật A2 (`xem lại` ≠ `nhận bài mới`) **đúng là hai hàm này** | Không viết hàm thứ ba. Sửa hai hàm sẵn có |

### Không cắt

A1 hành vi hồi sinh / A2 tập chặn / A3 bảng bài + nhận xét: đây là chỗ chứa và luật để dữ liệu nhập vào **còn đúng nghĩa** sau cắt chuyển. Không phải trang trí.

Mức: **HIGH** (finance + nhồi B vào cổng Dot 5); **MEDIUM** (UI A3, quên mật khẩu, hàm hợp thành trùng)

---

## (d) Việc thiếu mà Đợt 5 sẽ cần

Đối chiếu `phase-05-dot-e-import-va-cutover.md`. E1 cần: `facilityId`, ánh xạ lifecycle (Đợt D = A2), ánh xạ trạng thái lớp/buổi, ánh xạ danh tính theo SĐT. Checklist E-1…E-12 là sự cố thật của `cmc-lms`.

### Thiếu — làm thay đổi cách thi hành

**1. Không có cột giáo viên trên buổi — E-3 sẽ không có chỗ gắn**

- Câu kế hoạch: A chỉ xây “lý do hủy + hồi sinh · nhận xét · bài học” (`plan.md:53`). Không nhắc `teacherId` buổi.
- Code: `cmc-lms` `ClassSession.teacherId` (`schema.prisma:373-374`). `cmc_edu` `ClassSession` (`:731-771`) **không có** `teacherId`; giáo viên chỉ trên `ClassBatch.teacherId` (`:661`).
- E-3 (`phase-05:34`): lớp migrate 48/48 buổi `teacher_id=NULL` ⇒ không mở được nhật ký.
- Hậu quả: Dot 5 hoặc gán mọi buổi = GV của lớp (mất lệch từng buổi) hoặc bịa placeholder (cấm bởi E-6).
- Mức: **HIGH**
- Thi hành: thêm cột buổi + backfill từ lớp trong A1 (cùng vùng schema lớp/buổi), hoặc ghi rõ Dot 5 chấp nhận “GV theo lớp”. Đừng im.

**2. Không có chỗ chứa hồ sơ HS nguồn**

- `cmc-lms` `Student`: `studentCode`, `gender`, `dateOfBirth`, `note` (`schema.prisma:251-258`).
- `cmc_edu` `Student` (`:423-431`): `id`, `facilityId`, `fullName`, `createdByReceiptId`, `lifecycle`. `rg studentCode|dateOfBirth|gender` trên schema `cmc_edu` = **0**.
- Hậu quả: import 11 HS thật mất mã, ngày sinh, ghi chú sức khỏe. Quy mô nhỏ nhưng đây đúng bài “đủ”, không phải bài khối lượng (`phase-05:23-24`).
- Mức: **HIGH**
- Thi hành: hoặc thêm cột trong A2 (cùng migration lifecycle), hoặc Dot 5 ghi sổ “cố ý bỏ” từng trường. Kế hoạch hiện không chọn.

**3. Không có hợp đồng ánh xạ trạng thái lớp — đúng cái E-2 đã gãy thật**

- E-2 (`phase-05:33`): copy `status='open'` vào hệ chỉ hiểu `running` ⇒ admin không sửa unit.
- `cmc-lms` `ClassStatus`: `planned|open|running|closed|cancelled` (`:49-55`).
- `cmc_edu`: `ClassBatch.status String @default("active")` (`:662-665`). A1 nói “mở lại lớp đã đóng” nhưng **không có đường đóng** và không bảng ánh xạ `open/running → active`.
- Hậu quả: Dot 5 lặp đúng sự cố E-2 trên tên khác (`active` vs `running` vs `open`).
- Mức: **HIGH**
- Thi hành: A1 phải có bảng ánh xạ 5→2 (hoặc đổi enum cho khớp) **trước** khi viết reopen. Đây là hợp đồng E1, không phải việc của script import tự bịa.

**4. A3 nhập bài từ CSV, Dot 5 nhập buổi sống theo `curriculumLessonId` — không khóa ổn định**

- `phase-a3:14-28` lấy lại 240 dòng CSV. Đúng cho catalog `cmc_edu`.
- Nguồn sống: `CurriculumLesson.lessonCode` unique + `classSessions` (`cmc-lms` `:228-247`, `:380-381`).
- A3 không bắt buộc giữ `lessonCode` làm khóa idempotent xuyên hệ.
- Hậu quả: A3 xong, catalog 240 bài id mới; Dot 5 không gắn được buổi thật vào bài; stamp bài mất hoặc bịa.
- Mức: **HIGH**
- Thi hành: A3 upsert theo `lessonCode` (hoặc `(program, orderGlobal, seqInUnit)` công bố là khóa Dot 5). Viết một dòng mapping trong phase, đừng để import tự đoán.

**5. Dải unit nguồn không có phiếu thu — `sourceReceiptId` chặn import**

- E1/plan mẹ dồn “bù dải” sang Đợt 5. Edu `EnrollmentUnitRange.sourceReceiptId String? @unique` (`schema.prisma:602-603`). Nguồn `EnrollmentUnitRange` không có receipt (`cmc-lms` khoảng `:416-426`, chỉ `createdById`).
- HS edu bắt `createdByReceiptId` là provenance phiếu (`:428-430`).
- Hậu quả: 11 HS + dải unit live **không nhập được** nếu không phiếu giả (cấm E-6) hoặc nới schema. Đây là chặn schema, không phải việc script.
- Mức: **HIGH**
- Thi hành: A2 (cùng vùng Student/Enrollment) phải tuyên bố ngoại lệ import — `sourceReceiptId`/`createdByReceiptId` nullable có kiểm — hoặc Dot 5 được phép tạo phiếu kỹ thuật có dấu. Im lặng = Dot 5 kẹt.

**6. `ScheduleSlot` thiếu GV + hiệu lực — đúng E-1/E-3**

- Nguồn: `teacherId`, `effectiveFrom`, `archivedAt` (`cmc-lms` `:333-347`). Buổi có `teacherId` riêng (`:373`).
- Edu slot (`:706-723`): thứ + giờ. Không GV, không ngày hiệu lực, không archive. A1 gỡ/thêm khung nhưng **không thêm cột**.
- Hậu quả: import tạo được slot vẫn mất “ai dạy thứ này” và “khung thêm giữa kỳ không đẻ buổi quá khứ ma”. E-1 chết im.
- Mức: **HIGH**
- Thi hành: A1 cùng migration lớp/buổi thêm ba cột slot + `ClassSession.teacherId`, hoặc Dot 5 ghi “cố ý gộp GV theo lớp”.

**8. A1 có giá trị `ceiling` nhưng không có chỗ sinh ra**

- `phase-a1:39`: `ceiling` = chạm trần unit, không tự hồi.
- `rg ceiling` trong `apps/api/src` không có cancel-reason (chỉ OTP ceiling). Writer hủy thứ ba: `session-done-sweep.ts` cũng không truyền lý do.
- Hậu quả: import ghi được `ceiling`, sau cutover chỉnh unit sẽ hủy buổi **không** gắn `ceiling` ⇒ hồi sinh nhầm, đúng cái A1 bảo là lý do tồn tại của enum.
- Mức: **MEDIUM**
- Thi hành: A1 phải chỉ ra caller sinh `ceiling` (cùng đường restamp / sweep) hoặc tuyên bố “chỉ nhận giá trị lúc import, live chưa sinh” — đừng để 4 giá trị trên giấy, 3 giá trị trong code.

**9. Lớp nguồn không có `endDate`; đích bắt buộc có**

- `cmc-lms` `ClassBatch` không ngày kết (`:286-300`), status enum 5 giá trị.
- Edu `endDate` required (`:658`). A1 không đưa `ClassStatus` và không nói lấy `endDate` từ đâu.
- Hậu quả: import phải bịa ngày kết — lệch E-6 — hoặc lớp cuốn chiếu không biểu diễn được.
- Mức: **MEDIUM** — ghi hợp đồng “suy `endDate` từ buổi cuối” trong A1/E1, đừng để script tự bịa.

### Đã có / không thiếu trong plan này

- Cột `cancelReason`, 6 lifecycle, bảng bài, bảng nhận xét, `sessionMinutes`: A xây. Đủ chỗ chứa cho đúng những khái niệm plan liệt kê.
- `ScheduleSlot`: đã có. E-1 không cần plan này tạo bảng.
- C0 null-password: chuyển Dot 5 trên dữ liệu nguồn — đúng chỗ (`phase-b1:42-49`).
- Hash bcrypt: hoãn Dot 5, B1 dồn một hàm — đủ nếu B1 thật sự chạy trước import credential (`plan.md:55`).
- Huy hiệu / `LevelProgress`: plan bảo không xây (`plan.md:54`). Dot 5 phải **skip tường minh** — chưa viết trong E1. Ghi một dòng “bỏ, không bịa” là đủ; không cần phase mới.

Mức tổng (d): **HIGH**

---

## (e) Cổng nghiệm thu đo được không?

`pnpm acceptance:report` đếm hai số khác nhau (`verify.ts:314-331`): **built** = mọi claim `trpc`/`uiRoutes`/`models` còn tồn tại; **proven** = journey của đúng flow đó xanh trên HEAD. Cổng không gắn journey thì **không vào số ⬤**.

Tool **fail cứng** (`process.exitCode = 1`, `verify.ts:405-412`) khi:

- orphan procedure **chưa** nằm trong `DOCUMENTED_GAPS`
- whitelist/DOCUMENTED_GAPS trỏ procedure/namespace đã mất (`:239-260`)
- journey khai mà file không có

A1 thêm `classBatch.close`/`reopen` hoặc A3 thêm upsert nhận xét **mà không claim / không ghi gap** ⇒ lệnh đỏ dù không flow nào tụt ⬤. Kế hoạch không nói điều này.

| Cổng | Chỗ | Đo được? | Cách đo thật |
|---|---|---|---|
| A1 gỡ khung ⇒ `slot_removed`; thêm lại ⇒ hồi; `manual` không hồi; mở lại ⇒ `class_closed` hồi | `plan.md:119`, `phase-a1:70-75` | **Không** bằng `acceptance:report`. P2-01 (đúng bề mặt tạo lớp/sinh buổi) đang `no-ui-path` (`flow-manifest.ts:343-346`). Không có add/remove slot, không có close/reopen | Integration test API trên `cancelSessionWithRestamp` + generate + close/reopen. Grep type: mọi caller truyền `reason`. **Đừng** ghi cổng A1 vào số ⬤ |
| A1 “dấu unit khớp tính lại từ neo” | `phase-a1:74` | Đo được bằng test so dãy với `restampBatchSessions` | Viết test đó. Không có thì cổng là câu chữ |
| A2 6 giá trị; `completed` không chặn; 4 tổ hợp | `plan.md:120`, `phase-a2:65-70` | Đo được bằng unit/integration. **Không** bằng ledger: không journey nào drive `completed` (giá trị chưa tồn tại). P4-05 claim `setLifecycle` nhưng journey aftersale **không bấm** (`flow-manifest.ts:936-937`) | Test `getApprovedChildren` + `onRoster` + `open-tier` cho đủ 6 giá trị. Grep `blocked_lms` = 0 sau migration |
| A2 “không router nào tự so vòng đời” | `phase-a2:70` | Grep trong CI đo được | Test snapshot `rg "lifecycle ===" apps/api/src` trừ hàm được phép |
| A3 “nhập được bài học **và nhận xét từ cmc-lms** không mất dữ liệu” | `plan.md:121` | **Nửa đo được, nửa không.** Bài: chạy lại `ensure-curriculum-units` hai lần → 96 unit / 240 bài. Nhận xét từ `cmc-lms`: `phase-05:16` **script import không tồn tại** (`scripts/lms-v2/` không có) | Tách cổng: A3 = CSV idempotent. “Nhận xét từ live” = cổng E2/E3, không phải A3 |
| A3 phụ huynh không đọc nhận xét nhà khác; theo quy tắc công khai nhật ký | `phase-a3:110-111` | Đo được bằng test âm API trên helper `listForChild`. Chưa có journey | Test âm bắt buộc. Đừng hứa ⬤ |
| B1 hết `kind` parent/student | `plan.md:122`, `phase-b1:97` | Grep đo được | `rg "kind: 'parent'\|'student'"` trên `apps/` + token fixture |
| B1 nhà 2 con cùng mật khẩu xác định | `plan.md:122` | Đo được bằng test thay `login.test.ts:562-573` (hành vi hiện tại) | Test unit, không cần journey |
| B1 “journey LMS viết lại xong, số ≥ trước” | `plan.md:122`, `phase-b1:102` | **Đo được** — đây là cổng duy nhất của plan đi vào `acceptance:report` | Chạy `pnpm acceptance:report` sau B1.5, so `proven/total` |

Mức: **HIGH** (cổng A3 “nhập nhận xét từ cmc-lms”; cổng A1 gắn nhầm ledger)

---

## (f) Kế hoạch có làm tụt `pnpm acceptance:report` không, đã tính đủ chưa?

### Câu bị sai / thiếu

`plan.md:79`:

> Rủi ro R2 “tụt con số nghiệm thu” — Thổi phồng. **1 flow** claim thủ tục bị gỡ (P1-07); **2 flow** mất journey (P1-07, P1-04)

`plan.md:136` R2 và `phase-b1:64`: lặp “3 flow”.

### Số thật từ manifest + journey

Journey **đang gắn** mà B1 phá hợp đồng `kind` / OTP / cây route:

| Flow | Journey | Vì sao đỏ |
|---|---|---|
| P1-07 | `lms-parent-otp-login` (`:205`) | Claim `lmsAuth.requestOtpEmail` / `verifyOtpEmail` / model `LoginOtp` / `/parent/home` (`:201-203`) |
| P1-04 | `lms-student-activation` (`:109`) | `resetChildPassword` + `loginStudent` + `mintLmsSession({ kind: 'parent' })` |
| P2-08 | `lms-parent-evidence-consent` (`:543`) | `mintLmsSession({ kind: 'parent' })`; claim `/parent/evidence/:studentId` (`:521`) |
| P4-01 | `lms-stars-redeem-cycle` (`:833`) | `mintLmsSession({ kind: 'student' })`; claim `/student/gifts` (`:816`) |

Đó là **4 flow proven**, không phải 2. P1-06 (`parent-link-approve-reject`, `createLmsClient` không kind tường minh — default parent, `trpc-client.ts:128`) có thể sống nếu còn `parentAccountId`, nhưng claim không đổi route thì ổn hơn.

P2-03 / P2-05 claim `/student/*` nhưng đang `no-ui-path` — **không tụt ⬤**, chỉ thành `partial/missing` nếu xóa route mà quên sửa claim.

`lms-grade-parent-view.journey.ui.spec.ts` cũng `mintLmsSession` kind parent — **không** gắn manifest, không vào số ⬤, nhưng làm `ui-e2e` đỏ (required check).

### A có tụt số không?

- A1: P2-01 đã `no-ui-path`. Không tụt ⬤ nếu không phá journey khác. `seedClassBatch` đổi shape buổi thì e2e lớp/điểm danh có thể đỏ — đó là CI, không phải số ledger.
- A2: đổi `enrollment.blockLms` / `student.setLifecycle` mà không sửa claim → P1-05 / P4-05 thành `partial`. Journey của chúng **không drive** hai procedure đó nên ⬤ có thể giữ nếu procedure còn tên.
- A3: đổi `sessionEvidence.*` hoặc `/parent/evidence` → P2-08 đỏ. **A3 UI đụng đúng journey B cũng phá.**

### Chưa tính: `acceptance:report` fail cứng giữa chừng B1

`verify.ts:239-243`: nếu B1.3 gỡ namespace `lmsAuth` **trước** B1.5 sửa `INFRA_NAMESPACE_WHITELIST` (`verify.ts:43` đang miễn trừ `lmsAuth`), lệnh ném:

```text
INFRA_NAMESPACE_WHITELIST entry "lmsAuth" does not match any scanned appRouter key
```

Đó không phải “tụt 2 flow”. Đó là tool gãy. P1-07 còn claim model `LoginOtp` (`:203`) sau khi drop bảng → flow `partial` dù journey đã viết lại.

Kế hoạch có B1.5 trong phase — đúng hướng — nhưng **đếm thiếu 2 flow proven** và **không khóa thứ tự** B1.3 trước B1.5.

Mức: **HIGH**

---

## Bảng phát hiện (chỉ lỗi làm đổi cách thi hành)

| # | Mức | Phát hiện | Đổi cách thi hành |
|---|---|---|---|
| 1 | CRITICAL | “Không đụng file chung” sai | Không merge tự do A ‖ B. Chốt owner cho từng file hub: `schema.prisma`, `trpc.ts`, `approved-children.ts`, `flow-manifest.ts`, hai `db.ts`. Hoặc serialize A2 rồi B1 trên cổng đọc, hoặc một nhánh schema chung |
| 2 | HIGH | B1 một PR ~60–80 file | Tách ≥3 PR. Đừng để ranh giới #8 treo |
| 3 | HIGH | Đếm nghiệm thu 2 journey / 3 flow — thật 4 proven + tool fail cứng | Cộng P2-08, P4-01 vào B1.5. Sửa whitelist **cùng commit** với gỡ `lmsAuth` |
| 4 | HIGH | Thiếu chỗ GV-trên-buổi, hồ sơ HS, ánh xạ `ClassStatus` | Quyết trong A1/A2 trước Dot 5, hoặc ghi “cố ý bỏ” |
| 5 | HIGH | A3 cổng “nhập nhận xét từ cmc-lms” không chạy được trong A3 | Tách cổng. A3 = CSV + API. Import live = Dot 5 |
| 5b | HIGH | Procedure mới không claim/`DOCUMENTED_GAPS` ⇒ `acceptance:report` exit 1 (`verify.ts:405-412`) | Mỗi procedure A1/A3 thêm vào gap hoặc flow **trong cùng PR** |
| 6 | HIGH | QĐ finance #3–#4 nằm plan nhưng không thuộc A/B | Cắt |
| 6b | HIGH | `sourceReceiptId` / `createdByReceiptId` chặn import dải unit live | Chốt ngoại lệ schema trước khi gọi A là “gỡ chặn xong” |
| 7 | MEDIUM | A1 không có close lớp / không có slot CRUD / không sinh `ceiling` / thiếu `endDate` nguồn | Thêm bước hoặc thu hẹp cổng |
| 8 | MEDIUM | A3 một PR hai tính năng; UI A3 trùng Đợt 4 và trùng file B | Tách PR; cắt UI khỏi A3 |
| 9 | MEDIUM | A3 không khóa `lessonCode` cho Dot 5 | Upsert theo khóa nguồn |
| 10 | LOW | A2 “hàm hợp thành mới” trùng `onRoster` + `getApprovedChildren` | Sửa hai hàm sẵn có |

---

## Mục không tìm thấy

- **Không tìm thấy** file trong danh sách năm file được hỏi mà kế hoạch giấu hoàn toàn — `context.ts` thật sự chỉ B, không phải chỗ kế hoạch nói dối.
- **Không tìm thấy** bằng chứng A1/A2 tự làm tụt số ⬤ nếu giữ tên procedure và không phá journey sẵn. Rủi ro tụt số nằm ở B1 (thiếu đếm) và A3 nếu sửa P2-08.
- **Không tìm thấy** chỗ plan này phải viết script `scripts/lms-v2/` — đó đúng là việc Đợt 5. Thiếu ở đây là **chỗ chứa + khóa ánh xạ**, không phải script import.

---

## Việc làm ngay nếu vẫn thi hành hai làn

1. Xóa hoặc viết lại câu `plan.md:25`. Thay bằng bảng file chung ở mục (a).
2. Owner `schema.prisma`: một người rebase migration A rồi B, không hai nhánh cùng `prisma migrate`.
3. A2 merge vào `develop` **trước** khi B1 đụng `getApprovedChildren` — hoặc B1 rebase bắt buộc sau A2.
4. Cắt QĐ finance khỏi plan.
5. B1.5 đếm lại 4 flow proven; whitelist và claim `LoginOtp` đi cùng commit gỡ OTP.
6. A3 bỏ nửa cổng “nhập nhận xét live”; thêm `lessonCode` làm khóa Dot 5.
7. Quyết `ClassSession.teacherId` và cột hồ sơ HS trước khi coi A là “gỡ chặn xong”.
