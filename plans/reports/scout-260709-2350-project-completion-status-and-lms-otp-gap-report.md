# Scout Report — Tình trạng build thật (verify code) + phát hiện gap OTP

**Date:** 2026-07-09 23:50 · **Method:** đọc trực tiếp router/procedure/test, không dựa docs
**Artifact trực quan:** https://claude.ai/code/artifact/3268f8c9-2b7a-4919-a118-aee7d59da7f3

## 1. Tóm tắt số liệu

- 31 module backend (`apps/api/src/*`), 26 có test thật (assertion thật, không stub), 5 code thật nhưng
  chưa có test riêng (`appointment`, `reconciliation`, `course`, `room`, `parentAccount`).
- 44 trang UI (34 admin + 10 LMS), 39 nối tRPC thật, 5 placeholder trung thực (hiện "chưa triển khai",
  không giả data): `network-ip.tsx`, `shift-config.tsx`, `engagement/leaderboard.tsx`,
  `engagement/rewards.tsx`, `lms/student/change-password.tsx`.
- Không có router nào 0 procedure, không có TODO/stub trong logic nghiệp vụ.
- 3 luồng lõi trace hết: Tuyển sinh+Tiền, Vận hành lớp, HR/Ca/Lương — 2/3 sạch, 1/3 có gap thật.

## 2. Module backend (bảng đầy đủ)

| Module | File router | # procedure | Test thật (assertion/file) | Verdict |
|---|---|---|---|---|
| crm | crm/router.ts | 6 | 30 / 3 | DONE |
| finance | finance/router.ts | 6 | 116 / 9 | DONE |
| enrollment | enrollment/router.ts | 3 | 27 / 2 | DONE |
| guardian | guardian/router.ts | 4 | 36 / 2 | DONE |
| attendance | attendance/router.ts | 3 | 34 / 1 | DONE |
| exercise | exercise/router.ts | 5 | 37 / 2 | DONE |
| submission | submission/router.ts | 5 | 40 / 3 | DONE |
| assessment | assessment/router.ts | 5 | 35 / 1 | DONE |
| session-evidence | session-evidence/router.ts | 5 | 45 / 2 | DONE |
| checkin | checkin/router.ts | 4 | 23 / 1 | DONE |
| shift | shift/router.ts | 5 | 14 / 1 | DONE |
| payroll | payroll/router.ts | 5 | 23 / 1 | DONE |
| kpi | kpi/router.ts | 5 | 25 / 1 | DONE |
| rewards/gift | reward-router.ts, gift-router.ts | 9 | 30 / 1 | DONE |
| meeting | meeting/router.ts | 3 | 8 / 1 | DONE |
| after-sale | after-sale/router.ts | 4 | 14 / 1 | DONE |
| facility | facility/router.ts | 2 | 11 / 1 | DONE |
| user | user/router.ts | 4 | 27 / 2 | DONE (1 `it.skip`, không phải toàn file) |
| lms-auth | lms-auth/router.ts | 6 | 48 / 3 | DONE code, nhưng xem §4 gap |
| class | batch/session/schedule-router.ts | 10 | 37 / 1 | PARTIAL (schedule-router chưa test riêng) |
| student | student/router.ts | 5 | 12 / 1 | DONE |
| session | session/router.ts | 1 | 6 / 1 | DONE |
| appointment | appointment/router.ts | 3 | 0 | PARTIAL — chưa có test |
| reconciliation | reconciliation/router.ts | 3 | 0 | PARTIAL — chưa có test |
| course | course/router.ts | 2 | 0 | PARTIAL — chưa có test |
| room | room/router.ts | 2 | 0 | PARTIAL — chưa có test |
| parentAccount | parentAccount/router.ts | 1 | 0 | PARTIAL — chưa có test |

Module không phải router (service/background job, không tính vào bảng): `security/` (RLS/privilege
test cross-cutting), `provisioning/` (helper, không phải tRPC router), `worker/` (background jobs),
`auth/` (SSO/session helpers).

## 3. Giao diện — trang nào thật, trang nào placeholder

**Admin (34 trang):** 30 thật (facilities, users, attendance×2, classes×2, cockpit, courses, crm×2,
enrollment, finance×5, hr×2, login, parents, students×2, teaching×6). 4 placeholder trung thực:
`network-ip.tsx`, `shift-config.tsx`, `engagement/leaderboard.tsx`, `engagement/rewards.tsx` (đều
`EmptyState` "chưa triển khai" — không giả vờ có data).

**LMS (10 trang):** 9 thật. 1 placeholder: `student/change-password.tsx` — comment ghi rõ
`lmsAuth.changeStudentPassword` là nợ P0, chưa có backend, màn hình chỉ redirect logout.

**Route → ComingSoon:** `/admin`, `/hr`, `/ops` index route (đúng thiết kế — sub-page thật nằm ở
`/admin/facilities` v.v.), route `*` catch-all 404.

## 4. Flow lõi 1 — Tuyển sinh & Tiền (trace từng dòng, có lỗ hổng thật)

1. **Sale tạo Opportunity** — `crm/router.ts:82-115` `opportunityCreate`, stage khởi tạo `O1_LEAD`.
   `opportunityAdvance` (L115-149) chỉ tiến tuyến tính O1→O4, **từ chối** advance thẳng lên O5 —
   comment ghi rõ "O5 chỉ qua finance.receiptApprove".
2. **Sale tạo phiếu nháp** — `finance/router.ts:610-718` `receiptCreate`, bắt buộc `classBatchId`,
   status khởi tạo `'draft'`, mã phiếu sinh atomic qua `receiptCodeCounter.upsert`.
3. **GĐKD duyệt (cổng tiền)** — `finance/router.ts:722-778` `receiptApprove`, roster quyền
   `[giam_doc_kinh_doanh, giam_doc_dao_tao]` (sale bị loại — chống tự duyệt, ADR-B). Trong
   `runMoneyTransaction` (L196-288): guard status draft, second-eye nếu vượt ngưỡng, atomic claim
   `updateMany` chống double-approve, **auto set O5_ENROLLED tại đây** (không phải ở CRM router).
4. **Provisioning — 5 bước KHÔNG bọc 1 transaction** (`provision-from-receipt.ts`, cố ý theo ADR
   0041 — comment L12-22): tạo/tìm ParentAccount → Student → Guardian → kích hoạt Enrollment
   reserved→active (`activate-enrollment.ts:56-101`) → tạo StudentAccount (mật khẩu mặc định
   `Cmc2026@`, `mustChangePassword:true`). Lỗi giữa chừng không rollback tiền; có worker
   `reconcileOrphanedReceipts` (`worker/index.ts:117`, có test) tự dò retry.
5. **Email báo duyệt phiếu** — `finance/router.ts:832` insert `EmailOutbox` (transport `brevo`), relay
   qua `worker/relay-email-outbox.ts` (polling, tách khỏi request path), gửi thật qua
   `worker/email-transport.ts:68` (`BrevoEmailTransport`, gọi `api.brevo.com/v3/smtp/email`).
6. **PH đăng nhập — GAP THẬT:** `lms-auth/router.ts` `requestOtp` (L170-217) và `requestOtpEmail`
   (L280-329) đều tạo dòng `LoginOtp` trong DB nhưng **không gọi bất kỳ transport nào** (không
   `EmailOutbox.create`, không SMS gateway). Mã chỉ lộ qua `_testSeamCode`, vô hiệu hoá cứng khi
   `NODE_ENV=production`. Grep toàn repo (`emailOutbox.create`) chỉ có **1 điểm gọi** — dòng phiếu
   duyệt ở bước 5, không phải OTP. `verifyOtp`/`verifyOtpEmail` mới thật sự lookup ParentAccount
   (no-leak: lỗi generic giống sai mã).
7. **PH xem con** — `enrollment/router.ts:129-165` `mine`, lọc qua `getApprovedChildren` (Guardian
   approved, loại `blocked_lms`, loại HS toàn bộ enrollment `withdrawn`). Trả về enrollment, **không
   trả phiếu thu** — `finance.receiptList/receiptGet` chỉ dành GĐKD/GĐĐT, PH không xem được lịch sử
   đóng tiền qua router hiện có.

**Tác động gap OTP:** đây là CỔNG DUY NHẤT để phụ huynh/học sinh vào LMS. Không sửa thì không ai đăng
nhập được bằng OTP thật ở môi trường production — toàn bộ UAT kịch bản 1 bước 7 ("PH nhận OTP email
Brevo") sẽ thất bại nếu chạy đúng nghĩa (không bật test seam). e2e xanh trước đây không lộ ra vì luôn
chạy với `TEST_OTP_SEAM=1`.

## 5. Flow lõi 2 — Vận hành lớp (sạch, không gap)

GĐĐT tạo lớp (`classBatch.create`) → hệ thống tự sinh buổi → GĐĐT publish bài PDF
(`exercise.publish`) → giáo viên điểm danh (gate active enrollment, `attendance.mark`) → học sinh làm
bài nộp (`submission.saveDraft/submit`) → giáo viên chấm+cộng sao (`submission.grade`) → AI soạn nháp
nhận xét, giáo viên chốt (`assessment.draftComment/confirm`, TL08§7 — không auto gửi). 112 assertion
thật phủ nhánh này.

## 6. Flow lõi 3 — HR/Ca/Lương (sạch, không gap)

Nhân viên chấm công IP (`checkInOut.punch`) → sai IP thì tạo phiếu thủ công
(`manualPunch.create`) → GĐKD/GĐĐT duyệt (`manualPunch.approve`, chống tự duyệt qua managerId) →
đăng ký ca (`shift.submit`) → duyệt ca+KPI (`shift.approve`, `kpi.approve`) → chốt lương
(`payslip.assemble/finalize`). 62 assertion thật phủ nhánh này.

## 7. Khuyến nghị (không tự sửa — cần user quyết trước khi đưa vào scope)

Gap OTP delivery là **go-live blocker thật**, KHÔNG chặn tiếp tục làm việc trên local. Đề xuất 2
hướng khi user sẵn sàng xử lý:
1. Wire `requestOtp`/`requestOtpEmail` insert `EmailOutbox` (payload OTP) — tái dùng
   `relayEmailOutbox` + `BrevoEmailTransport` đã có sẵn, chỉ thiếu 1 template + 2 điểm gọi.
2. Nếu kênh thật là SMS (không phải email) cho `requestOtp` (SĐT) — cần thêm SMS transport riêng,
   scope lớn hơn.
Cần user xác nhận kênh dự định (email hay SMS) trước khi lên plan sửa.

## Unresolved questions
- Kênh gửi OTP dự định: email (Brevo, giống receipt) hay SMS gateway riêng?
- 5 module chưa có test riêng (appointment/reconciliation/course/room/parentAccount) — có cần bồi
  trước M2 hay chấp nhận nợ?
