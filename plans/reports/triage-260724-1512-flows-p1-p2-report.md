# Triage 17 luồng P1-01..P1-09 + P2-01..P2-08 — build map cho Playwright journey

Ngày: 2026-07-24 · Branch: `acceptance-journey-38-lms` · Read-only (file này là write duy nhất).

Nguồn đối chiếu:
- `scripts/acceptance-report/flow-manifest.ts` (expected.trpc / uiRoutes / models / actorRoles / journey)
- `apps/admin/src/shell/nav-registry.ts` (AUTHORITY cho nav) + `packages/auth/src/index.ts` (`PERMISSIONS`)
- `apps/admin/src/routes/*.tsx`, `apps/lms/src/routes/index.tsx` (route tồn tại hay không)
- 10 journey hiện có trong `apps/e2e/tests/journeys/`, helper `apps/e2e/src/journey/*`, seed `apps/e2e/src/db.ts`

---

## 0. Bảng nav-reachability nền (dẫn xuất từ nav-registry.ts + PERMISSIONS)

`visibleNavPathsFor` = module gate (`roles`) → child gate (`permission` qua `can()`). super_admin bypass mọi key.

| nav entry (label) | path | permission key | vai THẤY entry |
|---|---|---|---|
| Giảng dạy → Lịch dạy | `/teaching/schedule` | `class.read` | GĐKD, GĐĐT, sale, GV |
| Giảng dạy → Điểm danh | `/teaching/attendance` | `attendance.mark` | GV, GĐĐT |
| Giảng dạy → Chấm bài | `/teaching/grading` | `submission.grade` | GV, GĐĐT |
| Giảng dạy → Nhật ký buổi học | `/teaching/session-evidence` | `sessionEvidence.upsert` | GV |
| Giảng dạy → Nhận xét buổi học | `/teaching/session-assessment` | `assessment.draft` | GV, GĐĐT |
| Giảng dạy → Bài tập | `/teaching/exercises` | `exercise.manage` | GĐĐT |
| Lớp & Học sinh → Học viên | `/admin/students` | `student.lookup` | GĐKD, GĐĐT, sale, GV |
| Lớp & Học sinh → Lớp học | `/admin/classes` | `class.create` | GĐĐT |
| Lớp & Học sinh → Khoá học | `/admin/courses` | `course.manage` | GĐĐT |
| Tài chính & Điều hành → Phiếu thu | `/finance` | `finance.receiptList` | GĐKD, GĐĐT |
| Tài chính & Điều hành → CRM | `/crm` | `crm.opportunityList` | GĐKD, sale |
| Tài chính & Điều hành → Doanh thu | `/ops/revenue` | `finance.receiptList` | GĐKD, GĐĐT |
| Tài chính & Điều hành → Đối soát | `/ops/recon` | `reconciliation.review` | GĐĐT, GĐKD |
| Tài chính & Điều hành → Họp sau bán | `/crm/post-sale-meeting` | `parentMeeting.manage` | GĐKD, GĐĐT, sale |
| Tài chính & Điều hành → Sau bán | `/crm/aftersale` | `afterSale.manage` | GĐKD, GĐĐT, sale |
| Tài chính & Điều hành → Xếp lớp | `/finance/class-placement` | `enrollment.enroll` | GĐKD, GĐĐT, sale |
| Gắn kết → Quà tặng | `/admin/engagement/gifts` | `gift.upsert` | GĐKD, GĐĐT |
| Gắn kết → Đổi thưởng | `/admin/engagement/rewards` | `rewards.manage` | GĐKD, GĐĐT, sale |
| Nhân sự → Chấm công/Đăng ký ca/Của tôi | `/hr/checkin`,`/hr/shifts`,`/hr/my` | (không gate) | mọi vai |
| Quản trị → * | `/admin/users` … | module `roles:['super_admin']` | super_admin |

**Route CÓ trong router nhưng KHÔNG có entry nav (URL-only)** — grep chứng minh:

```
$ rg -n "parents|report-cards|/finance/new|/finance/refund|opportunities|leaderboard" apps/admin/src/shell/nav-registry.ts
68:      // `/finance/refund` hiện là EmptyState "Tính năng chưa áp dụng", và sổ
100:      // Bảng xếp hạng (`/admin/engagement/leaderboard`) is deliberately absent:
```
→ hai dòng duy nhất khớp đều là COMMENT, không phải entry. Vậy URL-only:
`/admin/parents`, `/admin/report-cards`, `/finance/new`, `/finance/:id`, `/finance/refund`,
`/crm/opportunities/:id`, `/admin/students/:id`, `/admin/classes/:id`, `/admin/engagement/leaderboard`.

Trong số đó chỉ 3 route có **liên kết in-app thật** (click được, không cần gõ URL):
- `/finance/:id` ← row trên `/finance` (receipt-list)
- `/crm/opportunities/:id` ← `pipeline.tsx:94 onClick={() => void navigate(`/crm/opportunities/${opp.id}`)}`
- `/finance/new` ← nút "Ghi danh" trên card O4_TESTED (`/crm`) và link trên `/finance/class-placement`

`/admin/parents`, `/admin/report-cards`, `/finance/refund` **không có link nào** → chỉ gõ URL.

---

## 1. Bảng triage 17 luồng

Cột `đợt`: `tiền` | `ghi-danh` | `vận-hành-lớp` | `LMS` (KHÔNG dùng `cluster` của manifest).

| # | Flow | Chuỗi actor (thứ tự) | Màn từng bước | đợt | nav-reachability | Phân loại | Spec đề xuất |
|---|---|---|---|---|---|---|---|
| 1 | **P1-01** Quản lý phễu tuyển sinh (O1→O5) | sale (tạo lead → advance → assign/mark-lost) | `/crm` → `/crm/opportunities/:id` | ghi-danh | `/crm`: **nav-yes** (Tài chính & Điều hành → CRM, sale ✓). `/crm/opportunities/:id`: **nav-no (URL-only)** nhưng click được từ card `/crm` | viết-được | `crm-funnel-assign-lost.journey.ui.spec.ts` |
| 2 | **P1-02** Tạo phiếu học phí từ cơ hội | sale | `/crm` → `/finance/new` | tiền | `/finance/new`: **nav-no (URL-only)**, vào bằng nút "Ghi danh" trên card O4_TESTED | trùng-journey-hiện-có | — (`crm-receipt.journey.ui.spec.ts`) |
| 3 | **P1-03** Duyệt phiếu kích hoạt học viên | sale (tạo) → GĐKD/GĐĐT (duyệt) | `/finance/new` → `/finance` → `/finance/:id` | tiền | `/finance`: **nav-yes** (Phiếu thu; GĐKD/GĐĐT ✓, sale ✗ đúng ADR-B). `/finance/:id`: **nav-no (URL-only)**, click từ row | trùng-journey-hiện-có | — (`receipt-approve-negation.journey.ui.spec.ts`) |
| 4 | **P1-04** Sinh tài khoản khi thu tiền | sale (tạo phiếu) → GĐKD (duyệt) → **hệ thống** (provision) → học sinh (đăng nhập LMS chứng minh) | `/finance/new` → `/finance/:id` → LMS `/login` (tab Học sinh) → `/student/change-password` | LMS | không có màn riêng (side-effect). Bằng chứng quan sát: `/admin/students` **nav-yes** + LMS `/login` (public) | viết-được | `provisioning-student-account.journey.ui.spec.ts` |
| 5 | **P1-05** Kích hoạt ghi danh khi đóng phí | sale (tạo) → GĐKD (duyệt) → sale (xếp lớp 2) | `/finance/new` → `/finance/:id` → `/finance/class-placement` → `/admin/students` | ghi-danh | `/finance/class-placement`, `/admin/students`: **nav-yes**. `/admin/students/:id`: **nav-no (URL-only)**, click từ row | trùng-journey-hiện-có | — (`enrollment-second-class.journey.ui.spec.ts`) |
| 6 | **P1-06** Liên kết phụ huynh–con | phụ huynh (gửi yêu cầu — **KHÔNG có UI**) → GĐKD/GĐĐT/sale/GV (duyệt) → sale/GĐKD (điền email) | LMS: *không tồn tại màn* → ERP `/admin/parents` | LMS | `/admin/parents`: **nav-no (URL-only)** — không entry, không link in-app | thiếu-đường-UI | *(chỉ viết được nếu duyệt seed)* `guardian-link-approve.journey.ui.spec.ts` |
| 7 | **P1-07** Đăng nhập xem con | phụ huynh | LMS `/login` (tab Phụ huynh) → `/parent/home` | LMS | LMS không có side-nav; `/login` public, `/parent/home` sau `ParentOnly` — **nav-n/a (LMS, không có nav registry)** | thiếu-đường-UI (blocked-on-comms + không đọc được OTP email) | *(nếu duyệt seam)* `parent-email-otp-login.journey.ui.spec.ts` |
| 8 | **P1-08** Huỷ phiếu / hoàn tiền | GĐKD | `/finance/:id` (huỷ) + `/finance/refund` (hoàn) | tiền | `/finance/refund`: **nav-no (URL-only)** — entry đã bị gỡ có chủ ý (nav-registry.ts:67-71) | thiếu-đường-UI | — (không viết được) |
| 9 | **P1-09** Giám sát bất thường tài chính | GĐKD (tạo + tự duyệt phiếu → sinh cờ) → **worker** → GĐĐT/GĐKD (xử lý cờ) | `/finance/new` → `/finance/:id` → `/ops/recon` | tiền | `/ops/recon`: **nav-yes** (Tài chính & Điều hành → Đối soát; GĐĐT/GĐKD ✓) | viết-được (cần gọi worker) | `recon-flag-selfapprove.journey.ui.spec.ts` |
| 10 | **P2-01** Tạo lớp tự sinh lịch buổi | GĐĐT | `/admin/classes` → `/admin/classes/:id` | vận-hành-lớp | `/admin/classes`: **nav-yes** (Lớp & Học sinh → Lớp học; GĐĐT ✓). `/admin/classes/:id`: **nav-no (URL-only)**, click từ row | thiếu-đường-UI (không màn nào tạo lớp/sinh lịch) | *(phần còn lại)* `class-detail-teacher-session.journey.ui.spec.ts` |
| 11 | **P2-02** Điểm danh buổi học | GV | `/teaching/attendance?session=<id>` | vận-hành-lớp | **nav-yes** (Giảng dạy → Điểm danh; GV/GĐĐT ✓) — nhưng vào từ menu thì **không có `?session`** → màn báo "Vui lòng cung cấp tham số ?session=" | thiếu-đường-UI (không có session-picker / không link nào mang session id) | *(nếu duyệt seam URL)* `attendance-mark-session.journey.ui.spec.ts` |
| 12 | **P2-03** Mở bài tập theo tiến độ học | GĐĐT (ra đề) → **hệ thống** (open-tier) → học viên | ERP `/teaching/exercises` → LMS `/student/home` → `/student/exercise/:id` | vận-hành-lớp | ERP **nav-yes** (Giảng dạy → Bài tập; GĐĐT). LMS **nav-n/a**, `/student/exercise/:id` click được từ `/student/home` | thiếu-đường-UI (`classSession.assignUnit` không có UI → không mở được tier) | *(nếu duyệt seed)* `student-open-exercise.journey.ui.spec.ts` |
| 13 | **P2-04** Cung cấp bài tập PDF | GĐĐT | `/teaching/exercises` | vận-hành-lớp | **nav-yes** (Giảng dạy → Bài tập; chỉ GĐĐT — GV không thấy) | viết-được (cần seed CurriculumUnit) | `exercise-publish-close.journey.ui.spec.ts` |
| 14 | **P2-05** Làm bài trên PDF & nộp | học viên | LMS `/student/home` → `/student/exercise/:id` | vận-hành-lớp | **nav-n/a (LMS)**; link thật từ `/student/home` (`home.tsx:70`) | thiếu-đường-UI (cùng chặn open-tier như P2-03) | *(nếu duyệt seed)* gộp vào `student-open-exercise.journey.ui.spec.ts` |
| 15 | **P2-06** Chấm bài & cộng sao | học viên (nộp) → GV (chấm) | LMS `/student/exercise/:id` → ERP `/teaching/grading` | vận-hành-lớp | **nav-yes** (Giảng dạy → Chấm bài; GV/GĐĐT ✓); màn không đòi query param | viết-được (cần seed Submission) | `grading-star-award.journey.ui.spec.ts` |
| 16 | **P2-07** Nhận xét (AI nháp, GV chốt) | agent (nháp) → GV (chốt) → PH (xem) | `/teaching/session-assessment` → `/admin/report-cards` → LMS `/parent/report-card/:id` | vận-hành-lớp | `/teaching/session-assessment`: **nav-yes** (Giảng dạy → Nhận xét buổi học). `/admin/report-cards`: **nav-no (URL-only)** — không entry, không link | trùng-journey-hiện-có (một phần) | *(mở rộng)* `assessment-draft-confirm.journey.ui.spec.ts` |
| 17 | **P2-08** Gửi ảnh & tóm tắt buổi cho PH | GV (soạn + publish) → PH (xem) | `/teaching/session-evidence` → LMS `/parent/evidence/:studentId` | vận-hành-lớp | `/teaching/session-evidence`: **nav-yes** (Giảng dạy → Nhật ký buổi học; CHỈ GV). LMS: **nav-n/a**, link thật từ `/parent/home` (`home.tsx:48`) | thiếu-đường-UI (nửa PH cần phiên phụ huynh — xem P1-07) | *(nửa GV viết được)* `session-evidence-publish.journey.ui.spec.ts` |

---

## 2. Evidence block từng luồng

### P1-01 — Quản lý phễu tuyển sinh
Mọi procedure có consumer UI thật:
```
$ rg -n "trpc\.crm\.(opportunityCreate|opportunityAdvance|opportunityMarkLost|opportunityLookup|opportunityGet|opportunityList|assignableStaff|opportunityAssign)\b" apps/admin/src apps/lms/src
apps/admin/src/pages/crm/use-opportunity-actions.ts:20:  trpc.crm.opportunityCreate.useMutation
apps/admin/src/pages/crm/pipeline.tsx:225 / opportunity-detail.tsx:94: trpc.crm.opportunityAdvance
apps/admin/src/pages/crm/use-opportunity-actions.ts:27: trpc.crm.opportunityMarkLost
apps/admin/src/pages/crm/create-lead-dialog.tsx:45 + finance/receipt-create.tsx:103: trpc.crm.opportunityLookup
apps/admin/src/pages/crm/opportunity-detail.tsx:80 + finance/receipt-create.tsx:85: trpc.crm.opportunityGet
apps/admin/src/pages/crm/pipeline.tsx:223 (+cockpit, enroll-picker): trpc.crm.opportunityList
apps/admin/src/pages/crm/opportunity-detail.tsx:108: trpc.crm.assignableStaff
apps/admin/src/pages/crm/use-opportunity-actions.ts:35: trpc.crm.opportunityAssign
```
Khác biệt với journey P1-02 hiện có: `crm-receipt` chỉ chạy `opportunityCreate` + 3× `opportunityAdvance` rồi rời `/crm`. `markLost`, `assignableStaff`, `opportunityAssign`, `opportunityGet` ở `/crm/opportunities/:id` **chưa** journey nào chạm → P1-01 là spec riêng, không trùng.

### P1-02 — H2 re-verify: **HỢP LỆ**
`journey: crm-receipt.journey.ui.spec.ts`. Spec drive đúng `finance.receiptCreate` tại `/finance/new` (dòng 102 `toHaveURL(/\/finance\/new\?opportunityId=/)`, dòng 122 click "Tạo phiếu thu", dòng 127 assert URL `/finance/<uuid>`). Vào bằng nút thật trên card CRM, không `page.goto`. Không mismatch.

### P1-03 — H2 re-verify: **HỢP LỆ**
`journey: receipt-approve-negation.journey.ui.spec.ts`. Drive `finance.receiptList` (`/finance` qua menuNav), `finance.receiptGet` + `finance.receiptApprove` (`/finance/:id`), cộng negation `sale` gặp banner "Không tìm thấy phiếu thu". Khớp cả 3 procedure + cả 2 route trong `expected`.

### P1-04 — Sinh tài khoản khi thu tiền
`expected.trpc` rỗng (side-effect). Không claim negative nào cần grep.
Đường quan sát thật: `provisionFromReceipt` tạo ParentAccount + Student + **Guardian trực tiếp** (không cần approveLink):
```
$ rg -n "guardianLinkRequest|parentAccount|Guardian" apps/api/src/provisioning/provision-from-receipt.ts
101:   /** K1 remediation: the Guardian row linking the paying parent to the
103:    * without waiting on a separate `guardian.requestLink`/`approveLink` round
145:      account = await db.parentAccount.create({ data: { phone } });
255:      await findOrCreateGuardian(tx, receipt.facilityId, parentAccountId, created.id);
```
Bằng chứng UI: sau duyệt phiếu, học viên đăng nhập LMS `/login` tab "Học sinh" bằng SĐT phụ huynh + `Cmc2026@` → redirect `/student/change-password`. Pattern có sẵn ở `apps/e2e/tests/lms-login.ui.spec.ts:168-175` (nhưng file đó seed bằng tRPC client, không phải UI) → journey mới nên seed bằng UI thật (CRM → `/finance/new` → duyệt) rồi đăng nhập.
⚠️ Known bug đã ghi ở `lms-login.ui.spec.ts:157-167`: `/student/change-password` có thể bật ngược về `/student/home`. Journey P1-04 nên dừng ở assert URL `/student/change-password` (đúng như spec cũ), đừng đi tiếp.

### P1-05 — H2 re-verify: **HỢP LỆ (một phần, đã tự khai báo)**
`journey: enrollment-second-class.journey.ui.spec.ts` drive `enrollment.enroll` + `finance.receiptApprove` + `student.lookup` + `/admin/students` + `/admin/students/:id`.
4 procedure còn lại trong `expected` **không có consumer UI** — grep tự chạy lại xác nhận:
```
$ rg -n "trpc\.enrollment\.blockLms\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.student\.get\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.student\.getManyByIds\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.student\.resetPassword\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.[a-zA-Z]+\.[a-zA-Z]+" -o apps/admin/src/pages/students/student-detail.tsx
49:trpc.student.setLifecycle
```
→ drift manifest/UI có thật, journey đã ghi nhận trong header. Không cần sửa mapping.

### P1-06 — Liên kết phụ huynh–con · **thiếu-đường-UI**
```
$ rg -n "trpc\.guardian\.requestLink\b" apps/admin/src apps/lms/src
0 matches
```
→ Không màn nào (ERP lẫn LMS) gửi yêu cầu liên kết. `guardian.requestLink` là `lmsProcedure` (`apps/api/src/guardian/router.ts:71`), chỉ gọi được từ phiên phụ huynh.
Queue duyệt đọc bảng `GuardianLinkRequest`:
```
$ rg -n -A 12 "listPendingLinks:" apps/api/src/guardian/router.ts
203:  listPendingLinks: requirePermission('guardian','listPendingLinks')
214:        const where = { facilityId, status: input.status };
```
Kết hợp với P1-04 evidence (provisioning tạo thẳng `Guardian`, **không** tạo `GuardianLinkRequest`) → phụ huynh đã đóng tiền **không bao giờ** xuất hiện trong queue `/admin/parents`. Hệ quả kéo theo: modal "Cập nhật email" (`parentAccount.updateEmail`) nằm trên row của link-request (`parents/index.tsx:160-170`), nên **cũng không tới được** khi queue rỗng.
Nav: `/admin/parents` **nav-no (URL-only)** — grep nav-registry ở §0 cho 0 entry, và:
```
$ rg -n "admin/parents" apps/admin/src --glob '!*.test.tsx'
(chỉ apps/admin/src/routes/admin.routes.tsx:61 — định nghĩa route, không phải link)
```

### P1-07 — Đăng nhập xem con · **thiếu-đường-UI (2 lý do)**
(a) Manifest claim sai tên procedure:
```
$ rg -n "trpc\.lmsAuth\.requestOtp\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.lmsAuth\.verifyOtp\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "lmsAuth\." apps/lms/src/pages/login.tsx
51:  const requestMut = trpc.lmsAuth.requestOtpEmail.useMutation({
61:  const verifyMut = trpc.lmsAuth.verifyOtpEmail.useMutation({
159:  const loginMut = trpc.lmsAuth.loginStudent.useMutation({
```
→ UI dùng **`requestOtpEmail` / `verifyOtpEmail`**, không phải `requestOtp`/`verifyOtp`. Cả 4 đều tồn tại ở API (`apps/api/src/lms-auth/router.ts:192,274,333,452`) — đây là drift manifest, cần sửa manifest (ngoài phạm vi read-only này).
(b) `enrollment.mine` không có consumer LMS:
```
$ rg -n "enrollment\.mine|enrollmentMine" apps/lms/src apps/admin/src
0 matches
```
`parent/home.tsx:3-5` tự ghi: "Children come from the stored session … There is no guardian.getApprovedChildren tRPC procedure".
(c) Chặn thực thi: `login.tsx:80-84` render banner **"[DEV ONLY — blocked-on-comms]"** — OTP email đi qua `ConsoleEmailTransport` (stub), mã chỉ in ra console server. Helper e2e duy nhất đọc OTP là `readOtpCode(phone)` (`apps/e2e/src/db.ts:80`) — **tra theo `phone`**, trong khi row OTP email set `phone=null`:
```
$ rg -n -A 8 "^model LoginOtp" packages/db/prisma/schema.prisma
933:  phone     String?   /// email-OTP rows set phone=null; phone-OTP rows set email=null
935:  email     String?
```
→ cần helper mới `readOtpCodeByEmail(email)` (test seam, không phải seed dữ liệu). `DevHeaderWriter` trong `login.tsx:326` bị gate `import.meta.env.DEV` — e2e chạy `vite preview` trên build production (`playwright.config.ts:40,47`), nên **không dùng được**.

### P1-08 — Huỷ phiếu / hoàn tiền · **thiếu-đường-UI (toàn bộ)**
```
$ rg -n "trpc\.finance\.receiptCancel\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.finance\.refundCreate\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.[a-zA-Z]+\.[a-zA-Z]+" -o apps/admin/src/pages/finance/refund.tsx
(không dòng nào — file không gọi tRPC)
$ rg -n "trpc\.[a-zA-Z]+\.[a-zA-Z]+" -o apps/admin/src/pages/finance/receipt-detail.tsx
140:trpc.finance.receiptApprove
135:trpc.finance.receiptGet
```
`/finance/refund` là EmptyState, entry nav đã bị gỡ có chủ ý (`nav-registry.ts:67-71`). Không viết journey được — không có gì để click.

### P1-09 — Giám sát bất thường tài chính · **viết-được**
Cả 3 procedure có UI:
```
$ rg -n "trpc\.reconciliation\.(listFlags|action|dismiss)\b" apps/admin/src
apps/admin/src/pages/finance/reconciliation.tsx:181  trpc.reconciliation.listFlags
apps/admin/src/pages/finance/reconciliation.tsx:190  trpc.reconciliation.action
apps/admin/src/pages/finance/reconciliation.tsx:189  trpc.reconciliation.dismiss
```
Cách sinh cờ **hoàn toàn qua UI thật**: `reconcile-finance-flags.ts:1-16` liệt kê 4 rule; rule 1 `self_approved` = "receipt approved by its own drafter". `finance.receiptCreate` = `[GĐKD, sale]`, `finance.receiptApprove` = `[GĐKD, GĐĐT]` → **một GĐKD tự tạo rồi tự duyệt phiếu của mình** là hành vi UI hợp lệ, sinh cờ. (Rule 2 `exceeds_threshold` >20.000.000đ là phương án dự phòng, cũng thuần UI.)
Điểm cần thêm: worker phải chạy một lần — `export async function runReconcileFinanceFlags` (`reconcile-finance-flags.ts:237`). Cần helper e2e gọi nó, cùng kiểu `drainEmailOutboxOnce()` đã có (`apps/e2e/src/db.ts:873`). Đây là **gọi worker**, không phải seed dữ liệu giả.

### P2-01 — Tạo lớp tự sinh lịch buổi · **thiếu-đường-UI**
```
$ rg -n "trpc\.classBatch\.create\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.schedule\.generateSessions\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.classSession\.addMakeup\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.classSession\.assignUnit\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.course\.create\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.room\.create\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.room\.list\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "useMutation" apps/admin/src/pages/classes/index.tsx
(0 dòng — màn danh sách thuần đọc)
```
→ 7/14 procedure của luồng không có UI, gồm cả `classBatch.create` + `schedule.generateSessions` tức **chính tên luồng**. Đã trùng khớp header `apps/e2e/src/db.ts:620-624` (ngoại lệ seed được PO duyệt trước đó).
Phần CÓ UI (`/admin/classes/:id`): `classBatch.get`(class-detail.tsx:260), `listStudents`(:74), `assignTeacher`(:33), `classSession.list`(:131), `confirm`(:132), `cancel`(:135), `course.list`(courses/index.tsx:25), `classBatch.list`(classes/index.tsx:68) → đủ cho một spec bộ phận.

### P2-02 — Điểm danh buổi học · **thiếu-đường-UI**
```
$ rg -n "trpc\.attendance\.mark\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "attendance\.mark|markMutation" apps/admin/src/pages/teaching/attendance.tsx
155:  const markAll = trpc.attendance.markAll.useMutation({
$ rg -n "/teaching/attendance" apps/admin/src
apps/admin/src/shell/nav-registry.ts:20   (nav entry, KHÔNG kèm ?session)
apps/admin/src/routes/teaching.routes.tsx:7 (import lazy)
apps/admin/src/pages/teaching/attendance.test.tsx:76,81,88,94,108,125 (unit test)
$ rg -n "trpc\.attendance\.listForChild\b" apps/admin/src apps/lms/src
apps/lms/src/pages/parent/session-evidence.tsx:54
```
→ `attendance.mark` (số ít) **không có consumer UI**; màn chỉ dùng `markAll`. Và **không link in-app nào** mang `?session=<id>`; `attendance.tsx:204-217` render EmptyState "Vui lòng cung cấp tham số `?session=<sessionId>`" khi thiếu param. Nav-yes nhưng vào từ menu thì màn vô dụng.

### P2-03 — Mở bài tập theo tiến độ học · **thiếu-đường-UI**
```
$ rg -n "trpc\.exercise\.openForStudent\b" apps/admin/src apps/lms/src
apps/lms/src/pages/student/exercise.tsx:34
apps/lms/src/pages/student/home.tsx:42
$ rg -n "trpc\.exercise\.listForStudent\b" apps/admin/src apps/lms/src
0 matches
```
Chặn thật nằm ở open-tier: `apps/api/src/exercise/open-tier.ts:5-16` — Tier A cần một `ClassSession` **đã gán `curriculumUnitId`** và đã kết thúc; Tier B cần một buổi bù có `Attendance` present/late. Gán unit cho session = `classSession.assignUnit` → **0 matches UI** (xem P2-01). Điểm danh = **0 đường UI** (xem P2-02). Vậy không cách nào mở bài tập bằng UI thuần.
Link LMS có thật: `apps/lms/src/pages/student/home.tsx:70 onClick={() => navigate(`/student/exercise/${exercise.id}`)}`.

### P2-04 — Cung cấp bài tập PDF · **viết-được**
```
$ rg -n "trpc\.(exercise\.(create|publish|close|list)|curriculumUnit\.list)\b" apps/admin/src
apps/admin/src/pages/teaching/exercises.tsx:61  trpc.exercise.create
apps/admin/src/pages/teaching/exercises.tsx:68  trpc.exercise.publish
apps/admin/src/pages/teaching/exercises.tsx:71  trpc.exercise.close
apps/admin/src/pages/teaching/exercises.tsx:59  trpc.exercise.list
apps/admin/src/pages/teaching/exercises.tsx:58  trpc.curriculumUnit.list
```
5/5 procedure có UI thật. Upload PDF là POST thật `${API_URL}/upload/exercise-pdf` (`exercises.tsx:88-105`) → dùng `page.setInputFiles` trên `fileRef`.
Thiếu: không màn nào TẠO `CurriculumUnit`:
```
$ rg -n "curriculumUnit\." apps/admin/src apps/lms/src
apps/admin/src/pages/teaching/exercises.tsx:58  trpc.curriculumUnit.list
apps/admin/src/pages/teaching/exercises.test.tsx:50,90,143 (unit test)
```
→ chỉ `.list`. Cần seed 1 CurriculumUnit (helper `seedPublishedExercise` ở `apps/e2e/src/db.ts:505` đã tạo unit; cần tách phần unit ra, hoặc thêm `seedCurriculumUnit`).
Nav negation đáng viết kèm: `exercise.manage = ['giam_doc_dao_tao']` → **giáo viên KHÔNG thấy** entry "Bài tập" (`menuNav.assertEntryAbsent(page,'Giảng dạy','Bài tập',{role:'giao_vien'})`), khớp đúng ghi chú PO trong manifest.

### P2-05 — Làm bài trên PDF & nộp · **thiếu-đường-UI (dây chuyền từ P2-03)**
```
$ rg -n "trpc\.submission\.(saveDraft|submit|listForChild)\b" apps/admin/src apps/lms/src
apps/lms/src/pages/student/exercise.tsx:37  trpc.submission.saveDraft
apps/lms/src/pages/student/exercise.tsx:46  trpc.submission.submit
apps/lms/src/pages/parent/homework-results.tsx:20  trpc.submission.listForChild
```
Cả 3 có UI. Chặn duy nhất là open-tier ở P2-03 (không có bài nào "mở" cho học viên nếu không seed). Sau khi có bài mở, học viên đăng nhập được bằng SĐT phụ huynh + `Cmc2026@` (đường UI thật, P1-04) → viết được cùng một spec với P2-03.

### P2-06 — Chấm bài & cộng sao · **viết-được**
```
$ rg -n "trpc\.submission\.(grade|saveTeacherAnnotation|listForGrading)\b" apps/admin/src
apps/admin/src/pages/teaching/grading.tsx:107   trpc.submission.grade
apps/admin/src/pages/teaching/pdf-annotator.tsx:86  trpc.submission.saveTeacherAnnotation
apps/admin/src/pages/teaching/grading.tsx:258   trpc.submission.listForGrading  (+ cockpit.tsx:55,131)
$ rg -n "pdf-annotator|PdfAnnotator" apps/admin/src --glob '!*.test.tsx'
apps/admin/src/pages/teaching/grading.tsx:6   import { PdfAnnotator } from './pdf-annotator.js';
apps/admin/src/pages/teaching/grading.tsx:232 <PdfAnnotator
```
→ cả 3 procedure nằm trên cùng màn `/teaching/grading` (annotator là component con). Màn KHÔNG đòi query param bắt buộc (`grading.tsx:248-249`: `class` là filter hiển thị tuỳ chọn) → menuNav vào là dùng được.
Cần đầu vào: một `Submission` trạng thái `submitted`. Do P2-05 bị chặn, dùng `seedSubmittedSubmission` (`apps/e2e/src/db.ts:536`) + `seedPublishedExercise` (:505) — đây là seed exception cần duyệt.

### P2-07 — Nhận xét (AI nháp, GV chốt) · H2 re-verify: **HỢP LỆ NHƯNG CHỈ MỘT PHẦN — đã tự khai báo**
`journey: session-assessment-roster.journey.ui.spec.ts`. Journey chạm đúng route `/teaching/session-assessment` (độc quyền của luồng này), nhưng procedure nó drive thật là `attendance.listBySession` (roster), **không phải** `assessment.*` — chính header journey ghi rõ và manifest đã ghi nhận là drift. Xác nhận lại:
```
$ rg -n "trpc\.assessment\.(draftComment|confirm|discard|listBySession|listForChild)\b" apps/admin/src apps/lms/src
apps/admin/src/pages/teaching/session-assessment.tsx:74  trpc.assessment.draftComment
apps/admin/src/pages/teaching/report-cards.tsx:58        trpc.assessment.draftComment
apps/admin/src/pages/teaching/session-assessment.tsx:77  trpc.assessment.confirm
apps/admin/src/pages/teaching/report-cards.tsx:67        trpc.assessment.confirm
apps/admin/src/pages/teaching/session-assessment.tsx:65  trpc.assessment.listBySession
apps/lms/src/pages/parent/home.tsx:79                    trpc.assessment.listForChild
$ rg -n "trpc\.assessment\.discard\b" apps/admin/src apps/lms/src
0 matches
$ rg -n "trpc\.reportCard\.getForChild\b" apps/admin/src apps/lms/src
apps/lms/src/pages/parent/report-card.tsx:53
```
→ **`assessment.discard` không có UI** (0 matches). `draftComment` + `confirm` CÓ UI nhưng chưa journey nào chạy → còn dư địa cho spec mở rộng (nháp AI + GV chốt trên cùng màn session-assessment). Điều kiện đầu vào giống P2-07 hiện tại (roster present → seed attendance).
Nav: `/admin/report-cards` **nav-no (URL-only)** —
```
$ rg -n "report-cards" apps/admin/src --glob '!*.test.tsx'
apps/admin/src/routes/admin.routes.tsx:6,8,40,112,113  (comment + định nghĩa route)
```
0 entry nav, 0 link in-app.

### P2-08 — Gửi ảnh & tóm tắt buổi cho PH · **thiếu-đường-UI (nửa phụ huynh)**
```
$ rg -n "trpc\.sessionEvidence\.(publish|addPhoto|upsert|getBySession|listForChild)\b" apps/admin/src apps/lms/src
apps/admin/src/pages/teaching/session-evidence.tsx:39  trpc.sessionEvidence.publish
apps/admin/src/pages/teaching/session-evidence.tsx:38  trpc.sessionEvidence.addPhoto
apps/admin/src/pages/teaching/session-evidence.tsx:37  trpc.sessionEvidence.upsert
apps/admin/src/pages/teaching/session-assessment.tsx:69 trpc.sessionEvidence.getBySession
apps/lms/src/pages/parent/session-evidence.tsx:46      trpc.sessionEvidence.listForChild
$ rg -n "trpc\.guardian\.setPhotoConsent\b" apps/admin/src apps/lms/src
apps/lms/src/pages/parent/consent-settings.tsx:30
```
6/6 có UI. Nửa GV (`/teaching/session-evidence`, nav-yes CHỈ cho `giao_vien` vì `sessionEvidence.upsert = ['giao_vien']`) viết được ngay — màn tự chọn lớp rồi buổi (`classBatch.list` :26 → `classSession.list` :31), **không cần query param**, chỉ cần seed ClassBatch.
Nửa PH (`/parent/evidence/:studentId`, `guardian.setPhotoConsent`) cần phiên phụ huynh → chặn giống P1-07. Link thật đã có: `apps/lms/src/pages/parent/home.tsx:48` và `consent-settings.tsx:91`.

---

## 3. CẦN USER DUYỆT — đề nghị seed exception / test seam (CHƯA ai duyệt)

Mọi mục dưới đây là **đề nghị mở**, không phải quyết định. Không mục nào đã được PO hay bất kỳ ai chấp thuận trong session này.

| # | Luồng cần | Đề nghị | Lý do (đã chứng minh bằng grep ở §2) | Rủi ro nếu duyệt |
|---|---|---|---|---|
| S1 | P2-01, P2-03, P2-04, P2-06, P2-07, P2-08 | Tái dùng `seedClassBatch` (đã tồn tại, `db.ts:677`) | `trpc.classBatch.create` / `course.create` / `schedule.generateSessions` = 0 matches UI | Thấp — ngoại lệ này đã được ghi trong `db.ts:620-624` từ phase trước; đề nghị chỉ là mở rộng phạm vi dùng |
| S2 | P2-02 (điểm danh), P2-07 mở rộng | Cho phép journey điều hướng `page.goto('/teaching/attendance?session=<id>')` với session id lấy từ `seedClassBatch().sessionIds` | Không link in-app nào mang `?session` (grep §2 P2-02) | Trung bình — phá nguyên tắc "không `page.goto`" của bộ journey. Thay thế: giữ `seedPresentAttendance` (đã có) và bỏ hẳn P2-02 khỏi phạm vi journey |
| S3 | P2-03, P2-04, P2-05 | Thêm `seedCurriculumUnit()` + set `ClassSession.curriculumUnitId` trực tiếp | `curriculumUnit.*` chỉ có `.list`; `classSession.assignUnit` = 0 matches | Trung bình — đụng vào chính cơ chế open-tier mà P2-03 muốn chứng minh. Cần chốt: seed unit-gán-session có làm rỗng nghĩa của P2-03 không |
| S4 | P2-06 | Tái dùng `seedSubmittedSubmission` (`db.ts:536`) | Chuỗi UI tạo Submission bị chặn ở S3 | Thấp — regression cần bắt là `submission.grade`, không phải cơ chế nộp bài |
| S5 | P1-06 | Seed 1 `GuardianLinkRequest` (pending) để queue `/admin/parents` có row | `guardian.requestLink` = 0 matches UI; provisioning tạo thẳng `Guardian`, không tạo request | Cao — seed đúng cái mà luồng tồn tại để chứng minh (phụ huynh gửi yêu cầu). Cân nhắc: đánh dấu P1-06 là **không nghiệm thu được bằng journey** thay vì seed |
| S6 | P1-07, P2-08 (nửa PH) | Thêm test seam `readOtpCodeByEmail(email)` trong `apps/e2e/src/db.ts` | `readOtpCode` tra theo `phone`; row OTP email set `phone=null` (schema.prisma:933) | Thấp về kỹ thuật, nhưng luồng vẫn mang nhãn **"[DEV ONLY — blocked-on-comms]"** trong chính UI → cần PO xác nhận có nghiệm thu một luồng tự khai là chưa chạy production hay không |
| S7 | P1-07 (đặt email cho ParentAccount) | Cách đặt email phụ huynh khi queue link-request rỗng | Modal "Cập nhật email" chỉ render trên row của link-request (`parents/index.tsx:160-170`) | Cao — phụ thuộc S5. Nếu S5 bị từ chối thì email OTP phụ huynh **không có đường UI nào** |
| S8 | P1-09 | Thêm helper e2e gọi `runReconcileFinanceFlags` (`reconcile-finance-flags.ts:237`) một lần, kiểu `drainEmailOutboxOnce` | Cờ do worker sinh, không do procedure | Rất thấp — không seed dữ liệu, chỉ chạy worker thật. Dữ liệu đầu vào (phiếu self-approved) hoàn toàn từ UI |

---

## 4. Số spec dự kiến cho nửa này, theo `đợt`

| đợt | Luồng trong nửa này | Đã có journey | Spec MỚI viết được ngay | Spec MỚI phụ thuộc duyệt | Không viết được |
|---|---|---|---|---|---|
| **tiền** | P1-02, P1-03, P1-08, P1-09 | 2 (P1-02, P1-03) | **1** — `recon-flag-selfapprove` (P1-09; cần S8, rủi ro rất thấp) | 0 | 1 (P1-08) |
| **ghi-danh** | P1-01, P1-05 | 1 (P1-05) | **1** — `crm-funnel-assign-lost` (P1-01) | 0 | 0 |
| **vận-hành-lớp** | P2-01…P2-08 | 1 (P2-07 roster) | **3** — `exercise-publish-close` (P2-04, S1+S3), `grading-star-award` (P2-06, S1+S4), `session-evidence-publish` (P2-08 nửa GV, S1) | **3** — `class-detail-teacher-session` (P2-01, S1), `student-open-exercise` (P2-03+P2-05 gộp, S3), `assessment-draft-confirm` (P2-07 mở rộng, S1+S2) | 1 (P2-02 nếu S2 bị từ chối) |
| **LMS** | P1-04, P1-06, P1-07 | 0 | **1** — `provisioning-student-account` (P1-04, không cần seed exception) | **1** — `parent-email-otp-login` (P1-07, cần S6+S7) | 1 (P1-06 nếu S5 bị từ chối) |

**Tổng: 6 spec viết được ngay (rủi ro seed thấp), 4 spec chờ duyệt S2/S3/S5/S6/S7, 3 luồng hiện không có đường journey (P1-08, P2-02, P1-06).**

Gộp file gợi ý: P2-03 + P2-05 nên là **một** spec (cùng một phiên học viên, cùng một bài tập); P1-04 có thể gộp vào `parent-email-otp-login` nếu S6/S7 được duyệt, giảm 2 → 1 file cho đợt LMS.

---

## 5. Tổng kết H2 re-verify (5 flow có `journey:` trong nửa này)

| Flow | journey khai báo | Kết luận | Lý do |
|---|---|---|---|
| P1-02 | `crm-receipt.journey.ui.spec.ts` | ✅ hợp lệ | drive `finance.receiptCreate` @ `/finance/new` qua đường CRM thật |
| P1-03 | `receipt-approve-negation.journey.ui.spec.ts` | ✅ hợp lệ | drive đủ `receiptApprove/Get/List` @ `/finance` + `/finance/:id` |
| P1-05 | `enrollment-second-class.journey.ui.spec.ts` | ✅ hợp lệ (một phần, đã khai) | 3/7 procedure + 2/2 route; 4 procedure còn lại xác nhận 0 consumer UI |
| P2-07 | `session-assessment-roster.journey.ui.spec.ts` | ⚠️ hợp lệ về route, **lệch về procedure** | drive `attendance.listBySession`, không drive `assessment.*` nào. Drift đã ghi trong cả manifest lẫn header journey → không phải gán nhầm luồng, nhưng `expected.trpc` của P2-07 hiện **chưa được journey nào chứng minh** |
| (P1-01, P1-04, P1-06..P1-09, P2-01..P2-06, P2-08) | không khai `journey:` | — | khớp với triage ở §1 |

Ngoài phạm vi nhưng ghi nhận: `assessment.discard` (P2-07) và `exercise.listForStudent` (P2-03) là 2 procedure trong `expected` **không có consumer UI nào** — cùng loại drift với 4 procedure của P1-05.

---

Status: DONE_WITH_CONCERNS
Summary: 17/17 luồng đã triage với `đợt` + `nav-reachability` xác minh riêng theo nav-registry.ts; 6 spec viết được ngay, 4 chờ duyệt seed exception, 3 luồng (P1-06, P1-08, P2-02) hiện không có đường journey.
Concerns/Blockers:
1. 3 drift manifest/UI mới phát hiện, chưa sửa (read-only): P1-07 khai `lmsAuth.requestOtp/verifyOtp` nhưng UI gọi `requestOtpEmail/verifyOtpEmail`; `enrollment.mine` không có consumer LMS; `assessment.discard` + `exercise.listForStudent` = 0 matches UI.
2. P1-06 bế tắc kép chưa từng ghi nhận: provisioning tạo thẳng `Guardian` mà KHÔNG tạo `GuardianLinkRequest`, nên queue `/admin/parents` (vốn đã là URL-only, không entry nav) luôn rỗng — kéo theo `parentAccount.updateEmail` cũng không tới được, khiến P1-07 (email OTP) mất luôn bước đặt email.
3. 8 đề nghị seed/seam (S1–S8) ở §3 đều là YÊU CẦU MỞ, không mục nào đã được duyệt. S2/S3/S5 có rủi ro làm rỗng nghĩa của chính luồng cần nghiệm thu — cần user quyết trước khi viết spec.
