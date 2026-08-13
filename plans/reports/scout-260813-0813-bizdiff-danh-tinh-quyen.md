# Scout biz-diff — danh tính, quyền, thông báo

**Phạm vi:** tài khoản gia đình / phiên / StudentAccount / Guardian / lifecycle / AppUser+vai trò / Notification / chatter vs audit.

**NGUỒN** = `/home/manhquy/Downloads/cmc-lms` freeze `031d193` (`031d193 Merge pull request #34 …`).
**ĐÍCH** = `/home/manhquy/Downloads/cmc_edu` HEAD `develop` `af85b78`.

**Cách làm:** scout đọc schema + router/service thật. Không suy đoán. Không thấy procedure/ghi bảng thì ghi **không tìm thấy**.

---

## 1. Mọi thủ tục đăng nhập ở NGUỒN (I/O để đích port)

Nguồn chỉ còn **2** thủ tục mint phiên. Router nói rõ OTP / `studentLogin` / ticket chọn con **đã gỡ** (`cmc-lms/apps/api/src/routers/auth.ts:1-2`). Test khóa danh sách đã gỡ: `otpRequest`, `otpVerify`, `studentLogin`, `enterChildProfile`, `childLoginInfo`, `setChildPassword` (`cmc-lms/apps/api/src/test/auth-family-login.int.test.ts:196-208`).

Cookie chung: `httpOnly`, `sameSite=Lax`, `path=/`, `maxAge=12h` (`cmc-lms/apps/api/src/routers/auth.ts:80-88`). JWT kind: `'family' | 'teacher' | 'admin'` (`cmc-lms/apps/api/src/auth/jwt.ts:6`).

### 1.1 `auth.staffLogin` — GV/ADMIN

| | |
|---|---|
| Tên tRPC | `auth.staffLogin` |
| Hàm lõi | `loginStaff(email, password)` `cmc-lms/apps/api/src/auth/sessions.ts:57-69` |
| Ai | `AppUser` còn `isActive`, so khớp `passwordHash` |
| Input | `{ email: z.string().email(), password: z.string().min(1) }` `:93-94` |
| Output | `{ principal: { kind: 'teacher' \| 'admin', userId, displayName, email } }` qua `publicSession` `:67-69,107` |
| Token | `signSession({ sub: user.id, kind: user.role, tokenVersion })` `sessions.ts:67` |
| Thất bại | `UNAUTHORIZED` `"Sai email hoặc mật khẩu"` `auth.ts:102` |

### 1.2 `auth.familyLogin` — tài khoản gia đình (chuẩn vận hành)

| | |
|---|---|
| Tên tRPC | `auth.familyLogin` |
| Hàm lõi | `loginFamilyByPhone(phone, password)` `cmc-lms/apps/api/src/auth/sessions.ts:128-148` |
| Ai | `ParentAccount` theo SĐT chuẩn hóa, `isActive`, có `passwordHash`; phiên chỉ mint khi còn ≥1 con không thuộc `BLOCKED_LMS_LIFECYCLE` (`on_hold`/`withdrawn`/`transferred`, `:17-21,140-141`) |
| Input | `{ phone: z.string().min(1), password: z.string().min(1) }` `auth.ts:111-112` |
| Output | `{ principal: { kind: 'family', accountId, displayName, students: { id, fullName }[], studentIds: string[] } }` `:71-77,127` |
| Token | `signSession({ sub: acc.id, kind: 'family', tokenVersion })` `sessions.ts:142-146` |
| Thất bại | `UNAUTHORIZED` `"Sai số điện thoại hoặc mật khẩu"` `auth.ts:122` |
| UI | `cmc-lms/apps/web/src/login-page.tsx:66-69` gọi 1 bước, không chọn kind parent/student |

`completed` **không** chặn LMS (`sessions.ts:15-16`). Đổi con = client-side, không mint lại (`sessions.ts:6-10`).

### 1.3 Thủ tục kề đăng nhập (không mint phiên lần đầu, nhưng thuộc cùng bề mặt mật khẩu)

| Tên | Input | Output | Ghi chú |
|---|---|---|---|
| `auth.me` `auth.ts:277` | không | `publicSession` hoặc `null` | |
| `auth.logout` `auth.ts:279-282` | không | `{ ok: true }` | xóa cookie |
| `auth.setFamilyPassword` `auth.ts:135-184` | `{ currentPassword, newPassword min 12 }` | `{ ok: true }` | `familyProcedure`; bump `ParentAccount.tokenVersion` + mọi `StudentAccount.tokenVersion` con; mint lại cookie |
| `auth.familyForgotPassword` `auth.ts:191-219` | `{ phone }` | `{ ok: true, maskedEmail: string \| null }` | gửi link email |
| `auth.familyResetPasswordWithToken` `auth.ts:225-275` | `{ token, newPassword min 12 }` | `{ ok: true }` | **không** cấp session |
| `auth.forgotPassword` `auth.ts:292-315` | `{ email }` | `{ ok: true }` | staff |
| `auth.resetPasswordWithToken` `auth.ts:321-381` | `{ token, newPassword min 12 }` | `{ role: StaffRole }` | **không** cấp session |
| `auth.changePassword` `auth.ts:389-448` | `{ currentPassword, newPassword min 12 }` | `{ ok: true }` | `staffProcedure`; mint lại cookie |

### 1.4 Đích đang mint phiên thế nào (để so, không phải nguồn)

Đích **không** có `kind: 'family'`. Token LMS chỉ `'parent' | 'student'` (`cmc_edu/apps/api/src/lms-auth/session-token.ts:19-22,106`).

| Tên đích | Input | Output |
|---|---|---|
| `lmsAuth.requestOtp` `:200-276` | `{ phone }` | `{ ok: true }` (không leak tồn tại) |
| `lmsAuth.verifyOtp` `:282-334` | `{ phone, code length 6 }` | `{ sessionToken, children, needsPicker }` kind **`parent`** |
| `lmsAuth.requestOtpEmail` `:341-453` | `{ email }` | `{ ok: true }` |
| `lmsAuth.verifyOtpEmail` `:460-514` | `{ email, code }` | giống `verifyOtp`, kind **`parent`** |
| `lmsAuth.loginStudent` `:524-621` | `{ phone, password }` | `{ sessionToken, mustChangePassword, studentId }` kind **`student`** — khớp MK trên `StudentAccount` dưới SĐT PH |
| `POST /auth/staff-login` `password-routes.ts:175-204` | `{ email, password }` | `{ ok: true, mustChangePassword }` + cookie staff |
| `GET /auth/login` `sso-routes.ts:4-6` | OAuth Entra | cookie staff — **chỉ mount khi `SSO_ENABLED=true`** |

UI LMS đích chỉ tab email-OTP PH + SĐT+MK HS (`cmc_edu/apps/lms/src/pages/login.tsx:1,43-76,154-180`). `requestOtp` (SĐT) có API nhưng **không tìm thấy** trên trang login.

`ParentAccount.passwordHash` đích có cột (`schema.prisma:459`) nhưng **không tìm thấy** chỗ nào dùng để đăng nhập PH.

---

## 2. Bảng đối chiếu năng lực

| Năng lực | cmc-lms (file:dòng) | cmc_edu (file:dòng hoặc THIẾU) | Mức độ + lý do |
|---|---|---|---|
| Đăng nhập gia đình 1 bước SĐT+MK → session đa-con `kind:'family'` | `loginFamilyByPhone` `apps/api/src/auth/sessions.ts:128-148`; `auth.familyLogin` `routers/auth.ts:111-128`; `SessionKind` gồm `family` `auth/jwt.ts:6`; UI `apps/web/src/login-page.tsx:66-69` | **THIẾU** `kind:'family'` / `familyLogin` / `loginFamilyByPhone`. Token chỉ `parent\|student` `apps/api/src/lms-auth/session-token.ts:22,106`; UI tách 2 tab `apps/lms/src/pages/login.tsx:1,43-76,154-180` | **BẮT BUỘC** — đây là cửa đăng nhập PH đang chạy trên LMS freeze. |
| Resolve phiên family: mọi con còn lifecycle hợp lệ, không re-mint khi đổi con | `familySession` `sessions.ts:83-105`; `LmsSession` `:30-37`; `resolveSession` chỉ nhận `family` cho LMS `:161-164`; `familyProcedure` `trpc.ts:73-78` | **THIẾU** session đa-con. `verifyOtp*` trả `children` + `needsPicker` rồi mint **parent** `lms-auth/router.ts:320-333`; HS mint **student** riêng `:612-620`; gate `requireLmsParent` / `requireLmsStudent` `trpc.ts:317-325,300-308` | **BẮT BUỘC** — luật sở hữu "một tài khoản = mọi con" đã chốt D4 nguồn. |
| Chặn LMS theo lifecycle từng con (không đạp cả phiên nếu còn 1 con hợp lệ) | `BLOCKED_LMS_LIFECYCLE` = `on_hold\|withdrawn\|transferred` `sessions.ts:17-21,93-96` | `getApprovedChildren` loại `blocked_lms\|withdrawn` `guardian/approved-children.ts:50`; `enrollment.blockLms` ghi `blocked_lms` `enrollment/router.ts:83-112` | **NÊN CÓ** map luật. Đích có chặn nhưng **tập giá trị khác** (không có `on_hold`/`transferred`; thêm `blocked_lms`). |
| Đổi / quên / đặt lại MK gia đình | `setFamilyPassword` `auth.ts:135-184`; `familyForgotPassword` `:191-219`; `familyResetPasswordWithToken` `:225-275` | **THIẾU** 3 procedure này. PH đích không đăng nhập bằng MK. `lmsAuth.resetChildPassword` chỉ đổi MK **HS** `lms-auth/router.ts:627-666` | **BẮT BUỘC** nếu port family login; nếu giữ OTP thì **BỎ ĐƯỢC** (OTP thay MK PH). |
| Tạo HS + tìm-hoặc-tạo PH + Guardian + MK mặc định (admin intake) | `student.create` `routers/student.ts:139-275`: lock SĐT, tạo/gắn `ParentAccount` + `StudentAccount.loginCode=studentCode` + `Guardian.relation`, email PH, trả `defaultPassword` 1 lần | **THIẾU** `student.create`. Tạo HS chỉ trong `provision-from-receipt.ts:253-261` sau `finance.receiptApprove`. PH tạo `{ phone }` không MK `:150`. Guardian mặc định `relation:'guardian'` `:357-358` | **BẮT BUỘC** nếu vận hành như LMS đang chạy (admin tạo gia đình trước/không qua phiếu). Đích hiện bắt buộc tiền trước. |
| Gửi lại thông tin đăng nhập gia đình | `student.resendCredentials` `student.ts:278-312` | **THIẾU** | **NÊN CÓ** — admin nguồn gửi lại email SĐT+MK mặc định. |
| Sửa hồ sơ PH (tên/email/SĐT) + khóa PH cascade token con | `parent.update` `routers/parent.ts:54-134`; `parent.setActive` `:250-301` bump `ParentAccount.tokenVersion` + mọi `StudentAccount.tokenVersion` | `parentAccount.updateEmail` chỉ email `parentAccount/router.ts:173-216`; `parentAccount.setActive` bump `tokenVersion` PH `218-257`. **THIẾU** sửa `displayName`/SĐT và cascade `StudentAccount` (đích không có `StudentAccount.tokenVersion`) | **NÊN CÓ** sửa SĐT/tên (nguồn dùng SĐT làm chìa đăng nhập). Khóa PH đích đã có. |
| `ParentAccount.displayName` | bắt buộc `schema.prisma:552`; tạo ở `student.ts:178` | **THIẾU** cột. `ParentAccount` chỉ `phone/email/passwordHash/isActive/tokenVersion` `schema.prisma:452-469` | **NÊN CÓ** — admin nguồn xem/sửa tên PH (`parent.list/detail/update`). |
| `StudentAccount` + `loginCode` | model `schema.prisma:565-577` (`loginCode` unique, `passwordHash`, `isActive`, `tokenVersion`); tạo `loginCode=studentCode` `student.ts:223-232`; **không** còn `studentLogin` (`auth.ts:1-2`, test `:196-201`) | `StudentAccount` `schema.prisma:473-497`: `studentId`, `parentAccountId`, `passwordHash?`, `mustChangePassword`, `loginAttempts`, `loginLockedUntil`. **THIẾU** `loginCode`, `isActive`, `tokenVersion` | **BỎ ĐƯỢC** `loginCode` làm cửa login (nguồn đã gỡ). **NÊN CÓ** cột nếu migrate chuỗi cũ. `tokenVersion` HS **BỎ ĐƯỢC** nếu family session neo `ParentAccount`. |
| Đăng nhập HS trực tiếp | **không tìm thấy** procedure (đã gỡ). `StudentAccount` còn để migrate/cascade | `lmsAuth.loginStudent` `lms-auth/router.ts:524-621` input `{phone,password}` output `{sessionToken,mustChangePassword,studentId}` | Đích **không thiếu** so với nguồn hiện tại; đây là năng lực **thêm** của đích. |
| `Guardian` + `GuardianRelation` 5 giá trị | enum `father\|mother\|grandparent\|other\|guardian` `schema.prisma:142-149`; model `:579-591`; intake `student.create` nhận `relation` `student.ts:150,242-244`. **không tìm thấy** procedure sửa `relation` / gỡ Guardian / gắn PH thứ 2 vào HS đã có | enum **3** giá trị `father\|mother\|guardian` `schema.prisma:80-84`; `approveLink` `z.enum` 3 giá trị `guardian/router.ts:36-41,178-183`; provision hard-code `'guardian'` `provision-from-receipt.ts:358`. **không tìm thấy** procedure sửa `relation` | **NÊN CÓ** `grandparent`/`other` — form tạo HS nguồn đã dùng 5 giá trị. Gắn PH thêm: nguồn không có; đích làm được qua `GuardianLinkRequest`. |
| `GuardianLinkRequest` PH tự xin liên kết, admin duyệt | **Bảng có** `schema.prisma:593-610` + enum status `:151-155`. **không tìm thấy** router/service nào đọc/ghi (grep `apps/api` trống). Audit cũ: bảng reserved, hoãn v2 | **Có đủ** `guardian.requestLink` `:71-120`, `approveLink` `:125-196`, `rejectLink` `:250-276`, `listPendingLinks` `:203-248` | Đích **không thiếu**. Nguồn chỉ có schema chết. |
| `StudentLifecycle` đủ trạng thái vận hành LMS | 6 giá trị `admitted\|active\|on_hold\|transferred\|withdrawn\|completed` `schema.prisma:38-45`; default `admitted` `:262`; `student.setLifecycle` nhận cả enum `:398-482`; tạo mới ghi `active` `:219`; `student.update` **không** nhận lifecycle `:319-327` | 3 giá trị `active\|blocked_lms\|withdrawn` `schema.prisma:93-97`; default `active` `:431`; `student.setLifecycle` chỉ 3 giá trị `student/router.ts:121-158`; `enrollment.blockLms` → `blocked_lms` `enrollment/router.ts:83-98`; `finance.receiptCancel` `void:true` → `withdrawn` `finance/router.ts:454-472,582-587` | **BẮT BUỘC** port luật `on_hold`/`transferred`/`completed` (nguồn chặn LMS + tốt nghiệp vẫn xem học bạ). `admitted` **NÊN CÓ** nếu giữ bước tiếp nhận trước khi học. `blocked_lms` là thêm của đích. |
| `AppUser` + vai trò staff | `StaffRole` đúng 2: `teacher\|admin` `schema.prisma:14-18`; `AppUser.role` `:170`; guard `staffProcedure`/`adminProcedure` `trpc.ts:60-71`; `staff.create/list/setActive/update/resetPassword` `routers/staff.ts:24-276` | `Role` 9 giá trị `schema.prisma:213-223` + `packages/auth/src/index.ts:10-20`; **gán được 5** `ACTIVE_ROLES` `:27-33`; `AppUser.roles Role[]` `schema.prisma:1210`; `user.create/updateRoles` `user/router.ts:150,444`; `can()` `:185-197` | Đích **không thiếu** vai trò LMS. 9 giá trị là ERP; đừng thu về 2. Map nguồn `teacher→giao_vien`, `admin→super_admin` (hoặc GĐĐT tùy SoD). |
| Thông báo in-app (bảng `Notification`, SSE) | Model `schema.prisma:796-807` (`recipientType`, `recipientId`, `type`, `payload`, `readAt`). **không tìm thấy** `prisma.notification` / router / SSE trong `apps/api`. `role-matrix.md:39` ghi v2 chưa build. `emailNotifications` chỉ **đọc** `parent.detail` `parent.ts:184` — **không tìm thấy** setter hay chỗ đọc flag để quyết định gửi mail | **THIẾU** model `Notification`. Email PH: OTP `lms-auth/router.ts:426-433` + phiếu thu `finance/router.ts:1172-1192` / `worker/email-templates.ts:62-77` | **BỎ ĐƯỢC** cho parity vận hành — nguồn cũng chưa bắn sự kiện in-app. **NÊN CÓ** khi làm P10 (điểm/huy hiệu/lên cấp — mới là kế hoạch, không phải code chạy). |
| Chatter timeline `RecordEvent` + ghi note admin | Model + enum 6 type `schema.prisma:94-102,522-534`; ghi `logEvent` `services/record-event.ts:6-27`; đọc `record.forEntity` / ghi `record.addNote` `routers/record.ts:29-74` | **THIẾU** `RecordEvent`/`RecordFollower`. Có `AuditLog` `schema.prisma:1092-1107` + `audit.list` `audit/router.ts:19-48` — log **tên procedure**, không phải timeline field-level + note trên hồ sơ | **NÊN CÓ** bề mặt admin "ai sửa hồ sơ / ghi chú" kiểu nguồn. Đừng nhầm `AuditLog` là chatter. |
| `RecordFollower` (follow entity) | Model `schema.prisma:536-544`. **không tìm thấy** procedure/service nào đọc/ghi ngoài schema | **THIẾU** | **BỎ ĐƯỢC** — schema chết cả hai phía (đích không có). |
| Consent ảnh buổi học | **không tìm thấy** `photoConsent` trên `Guardian` nguồn | Có `Guardian.photoConsent*` `schema.prisma:521-527`; `setPhotoConsent` `session-evidence/router.ts:431-456` | Đích **không thiếu**; đây là thêm. |

---

## 3. Hệ thống báo phụ huynh — sự kiện thật

### Nguồn (`cmc-lms`)

In-app `Notification`: **không tìm thấy** chỗ tạo dòng. Không có danh sách sự kiện runtime.

Email PH **có** gọi gửi:

| Sự kiện | Chỗ gửi |
|---|---|
| Tài khoản gia đình sẵn sàng (SĐT + MK mặc định nếu vừa set) | `student.create` sau commit `student.ts:256-263` qua `accountEmailHtml` `:29-57` |
| Gửi lại cùng nội dung | `student.resendCredentials` `:299-300` |
| Link quên MK gia đình | `auth.familyForgotPassword` → `sendFamilyResetLinkEmail` `auth.ts:212` |
| MK gia đình đã đổi | `setFamilyPassword` / `familyResetPasswordWithToken` → `sendPasswordChangedEmail` `auth.ts:168,259` |
| Staff quên/đổi MK | `forgotPassword` / `resetPasswordWithToken` / `changePassword` (staff, không phải PH) |

Cờ `ParentAccount.emailNotifications` (`schema.prisma:557`): **không tìm thấy** chỗ dùng để bật/tắt gửi.

### Đích (`cmc_edu`)

Không có in-app Notification.

Email PH **có**:

| Sự kiện | Chỗ gửi |
|---|---|
| OTP đăng nhập PH | `lmsAuth.requestOtpEmail` enqueue `kind:'otp'` `lms-auth/router.ts:426-433`; render `email-templates.ts:31-51,80` |
| Phiếu thu đã duyệt | `enqueueReceiptEmail` `finance/router.ts:1172-1192`; render `:62-77` |

**không tìm thấy** email điểm / chuyên cần / nhật ký buổi / huy hiệu / lên cấp.

---

## 4. RecordEvent vs AuditLog (không tương đương)

| | Nguồn RecordEvent | Đích AuditLog |
|---|---|---|
| Mục đích | Timeline hồ sơ + note admin | Nhật ký gọi mutation / đọc dữ liệu trẻ |
| Type | `created/updated/status_changed/archived/restored/note` `schema.prisma:95-102` | `action` string (`lmsAuth.verifyOtp`, `student.setLifecycle.blocked_lms`, …) `schema.prisma:1095` |
| Đọc | `record.forEntity` `record.ts:33-49` | `audit.list` lọc actor/action/entity `audit/router.ts:19-48` |
| Ghi note tay | `record.addNote` `record.ts:56-74` | **không tìm thấy** |
| Follower | bảng chết `RecordFollower` | không có |

---

## 5. Việc đích đã có / hơn nguồn (tránh port ngược)

- OTP PH + picker con + `needsPicker` (`lms-auth/router.ts:179-184,329-333`). Nguồn đã **drop** bảng `login_otp` (`packages/db/prisma/migrations/20260807140000_drop_login_otp/migration.sql`).
- Đăng nhập HS `loginStudent` + lockout 5 lần/15 phút (`:83-87,524-621`).
- Staff reset MK HS `student.resetPassword` (`student/router.ts:70-112`) — nguồn **không tìm thấy** procedure tương đương.
- `GuardianLinkRequest` đủ request/approve/reject/list (nguồn không gắn thêm PH sau intake).
- RBAC 5 vai trò hoạt động + `PERMISSIONS` (`packages/auth/src/index.ts:27-33,77-179`).
- `AuditLog` + audit đọc dữ liệu trẻ (`approved-children.ts:72-78`).
- `photoConsent`.
- `mustChangePassword` HS (HS **không** tự đổi MK — màn hình bảo nhờ PH, `apps/lms/src/pages/student/change-password.tsx:3-7`).

---

## 6. DE XUAT (thứ tự ưu tiên)

1. **Port `kind:'family'` + `loginFamilyByPhone` / `auth.familyLogin`** (I/O mục 1.2). Gộp session parent/student. Giữ OTP đích chỉ nếu chủ hệ thống muốn kênh phụ, không thay chuẩn nguồn.
2. **Port `setFamilyPassword` + `familyForgotPassword` + `familyResetPasswordWithToken`** cùng hợp đồng I/O mục 1.3.
3. **Mở `StudentLifecycle`** thêm `on_hold`, `transferred`, `completed` (+ `admitted` nếu giữ bước tiếp nhận). Map `blocked_lms` ↔ `on_hold` hoặc giữ cả hai có chủ đích. Port cảnh báo 2 bước `student.setLifecycle` nguồn `student.ts:398-482`.
4. **Admin intake `student.create`** (tìm-hoặc-tạo PH theo SĐT, Guardian + MK mặc định 1 lần, email). Đừng bắt mọi gia đình phải qua `receiptApprove` nếu muốn parity LMS đang chạy.
5. **`GuardianRelation` thêm `grandparent`/`other`**.
6. **Chatter admin:** `RecordEvent` + `record.forEntity`/`addNote` — **không** nhét note vào `AuditLog`.
7. **`ParentAccount.displayName` + `parent.update` SĐT/tên**.
8. **`loginCode`:** chỉ thêm cột nếu migrate dữ liệu cũ; **không** khôi phục `studentLogin`.
9. **`Notification` in-app / SSE:** hoãn — nguồn cũng chưa chạy.
10. **`GuardianLinkRequest` / 9 Role / AuditLog / photoConsent:** giữ của đích; không port bản 2-role hay bảng chết nguồn.

---

## Unresolved

- Chủ hệ thống đã chốt OTP-PH (đích) hay SĐT+MK gia đình (nguồn) làm cửa **duy nhất** sau merge? Báo cáo không quyết giúp.
- `parent.ts:238-245` nguồn còn comment `kind:'parent'`/`kind:'student'` — **lệch code sống** (`kind:'family'`). Không lấy comment đó làm chuẩn.
- Không đếm được số dòng `Notification` production nguồn (cần DB sống). Schema+code: 0 writer.
- UI nguồn chỉ gắn chatter trên hồ sơ HS (`admin/student-detail-page.tsx:674-732`); API `record.forEntity` nhận 10 `entityType` nhưng các màn khác **không tìm thấy** call site.

---

Status: DONE
Summary: Nguồn vận hành 1 cửa `auth.familyLogin` (SĐT+MK → session `family` đa-con) cộng 6 lifecycle và 5 quan hệ giám hộ; đích vẫn tách `parent`/`student`, OTP PH, 3 lifecycle, 3 quan hệ, không `familyLogin`. In-app Notification và GuardianLinkRequest nguồn chỉ còn bảng chết — đích không thiếu hai năng lực đó.
