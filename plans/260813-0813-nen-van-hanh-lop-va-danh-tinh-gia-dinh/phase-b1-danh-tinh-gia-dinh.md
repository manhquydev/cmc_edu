---
title: "B1: Một tài khoản gia đình"
status: pending
lane: B
dependencies: []
---

# B1 — Một tài khoản gia đình, SĐT + mật khẩu

**Thẩm quyền:** `plans/reports/decisions-owner-260812-cau-6-7.md` câu 6 (chốt 12/08).

## Đây là port một mô hình đã vận hành thật

`cmc-lms` **đã làm xong việc này và đang chạy thật**:

```
loginFamilyByPhone(phone, password) → phiên kind 'family' đa con
  apps/api/src/auth/sessions.ts:128-148   (repo cmc-lms)
```

Bảng `LoginOtp` bên đó **đã bị drop** (`20260807140000_drop_login_otp`). Nên B1 không phải thiết
kế lại — nó là port **luật**, còn service viết lại theo khuôn `cmc_edu` (Rào chắn 2).

## Lý do thật để làm — đã đo lại, khác plan mẹ

`phase-03` của plan mẹ dựng trên chứng cứ của `cmc-lms`, không phải của `cmc_edu`. Đính chính
đầy đủ nằm ở [plan.md](./plan.md). Phần còn đúng và là **lý do thi hành**:

```ts
// apps/api/src/lms-auth/router.ts:562-573
// loginStudent duyệt MỌI StudentAccount, khớp mật khẩu rồi break.
```

Mật khẩu mặc định lúc cấp tài khoản là chuỗi **dùng chung cho mọi tài khoản mới** ⇒ nhà hai con
chưa đổi mật khẩu thì đăng nhập vào con nào là **không xác định**. Comment trong chính mã đã
thừa nhận hành vi này.

Cộng thêm: hai vai trò khu học tập gần như trùng tính năng · `lmsAuth.resetChildPassword` cho
phụ huynh đặt mật khẩu con (**leo thang quyền** khi gộp một tài khoản) · hai guard + hai helper
sở hữu, dễ lệch.

## Cổng C0 — bỏ khỏi phase này

`phase-03` bắt đếm `ParentAccount` null mật khẩu và **cấm big-bang nếu > 0**. Chạy trên
`cmc_edu` thì **chắc chắn > 0**, vì thiết kế hiện tại lấy OTP làm chính. Cổng tự chặn chính nó,
trái chỉ đạo "không có phụ huynh thật, đổi thẳng".

⇒ C0 chuyển sang **Đợt 5**, chạy trên **dữ liệu nguồn `cmc-lms`** trước khi nhập. Ở đó nó có
nghĩa thật và rẻ (`cmc-lms` đã tự cutover với 0 tài khoản null mật khẩu).

## Phạm vi đã đo (13/08)

| Nhóm | Số | Ghi chú |
|---|---|---|
| Router API mang `kind` | 8 | `lms-auth`, `assessment`, `attendance`, `enrollment`, `rewards`×2, `session-evidence`, `submission` |
| **Router bị đếm sót** | **+3** | `guardian/router.ts:71` · `exercise/open-tier.ts:250-263` (**là router**, không phải helper như bản đầu ghi) · `exercise/upload-route.ts:77-83` |
| Guard / helper | 7 | `trpc.ts`, `context.ts`, `session-token.ts`, `assert-live-session.ts`, `approved-children.ts`, `open-tier.ts`, `photo-access.ts` |
| UI `apps/lms` | 15 | gồm cây route `/parent` vs `/student` và `kind-guard.tsx` |
| Test unit | 14 | |
| Test e2e | 8 file / **17 test** | gồm 3 helper phải viết lại |

> **Cảnh báo về cách đếm.** Bộ đếm trên dựa vào việc file có chứa chữ `kind` hay không — nên nó
> **bỏ sót** mọi file gọi thủ tục sắp gỡ mà không nhắc `kind`. Xem mục B1.5.

**Thủ tục sẽ gỡ (tên thật):** `lmsAuth.requestOtp`, `requestOtpEmail`, `verifyOtp`,
`verifyOtpEmail`, `loginStudent`, `resetChildPassword`.

**Ảnh hưởng nghiệm thu:** một flow claim trực tiếp thủ tục bị gỡ (P1-07), và một số flow mất
journey chứng minh.

> Bản đầu khẳng định **"3 flow"**. Vòng validate bác: có **ít nhất 4** journey bị chạm.
> Con số đúng phải **đo, không chép** — chạy `pnpm acceptance:report` ngay trước khi bắt đầu
> phase để lấy mốc, rồi so lại sau B1.5. Đây đúng là luật của dự án: số nghiệm thu là số **đo**,
> số trong tài liệu chỉ là ảnh chụp có ngày.
Phải sửa kèm: allowlist audit `trpc.ts:109-122,135` và whitelist namespace
`scripts/acceptance-report/verify.ts:41-43` (`lmsAuth` đang được miễn trừ).

## Ranh giới phải chốt trước dòng code đầu tiên

| # | Ranh giới | Vì sao chặn |
|---|---|---|
| 1 | Hình dạng claim token mới thay `kind: 'parent'\|'student'` | Hợp đồng công khai số 1; `verifyLmsToken` đang chặn cứng hai giá trị này |
| 2 | ~~Cơ chế làm chết phiên cũ~~ | **ĐÃ CHỐT: tăng `tokenVersion`.** Cơ chế đã có và đang chạy — `assert-live-session.ts` so claim với cột, `parentAccount.setActive` đã dùng. Migration tăng một lần cho mọi tài khoản. (Bản đầu liệt kê cả "đổi tên cookie" — **không tồn tại**, LMS gửi token qua header) |
| 3 | `family` đứng ở đâu trong registry quyền | Registry hiện có 9 vai trò nhân sự; principal gia đình chưa có chỗ |
| 4 | `ParentAccount.passwordHash` có thành NOT NULL không | Nếu có thì dữ liệu mẫu phải backfill trước |
| 5 | `StudentAccount` + `loginCode` giữ hay bỏ | `cmc-lms` giữ; `cmc_edu` chưa tuyên bố |
| 6 | Chính sách giới hạn thử mật khẩu | Bỏ OTP là bỏ luôn rate-limit tự nhiên |
| 7 | Đường quên mật khẩu gia đình đi kênh nào | Hệ chưa chắc có SMS |
| 8 | Chiến lược hạ cánh với CI | `ui-e2e` là required check; B2→B5 làm tụt journey giữa chừng ⇒ một PR lớn hay chuỗi PR |

**Ràng buộc bắt buộc từ quyết định 13/08:** dồn toàn bộ việc xác thực mật khẩu vào **một hàm
duy nhất**, để khi DB thật của hệ cũ về (Đợt 5) thì thêm nhánh bcrypt là sửa **một chỗ**.

### Hai hợp đồng khác nhau, phải chọn một cách và viết ra

Bản đầu (và `plan.md` mẹ) viết *"mọi procedure nhận `studentId` tường minh"*. **Không đúng** với
phiên học sinh: `requireLmsStudent` (`trpc.ts:298-308`) lấy `studentId` **từ token**, và
`submission.saveDraft`, `submission.submit`, `rewards.*`, `exercise.openForStudent` **không nhận**
`studentId` ở đầu vào.

| Hợp đồng | Dùng ở đâu hôm nay | Sau khi gộp gia đình |
|---|---|---|
| Nhận `studentId` tường minh + kiểm sở hữu | Đường phụ huynh xem dữ liệu con | Giữ |
| Lấy `studentId` từ phiên | Đường học sinh làm bài, đổi quà | **Đổi sang nhận tường minh** |

**ĐÃ CHỐT (13/08, sau vòng validate): một hợp đồng duy nhất — mọi thủ tục chạm dữ liệu của một
học sinh đều nhận `studentId` tường minh và kiểm sở hữu. Token gia đình không mang `studentId`.**

Đây không phải lựa chọn thẩm mỹ. Quyết định D4 nói **đổi con ở phía client, không xác thực lại**.
Nếu "con đang chọn" nằm trong token thì đổi con **bắt buộc phải cấp token mới** — tức là mâu
thuẫn với chính D4. Chỉ có bỏ `studentId` khỏi token thì đổi con mới thành thao tác thuần client.

Hệ quả phải chấp nhận: các thủ tục khu học sinh (`submission.saveDraft`, `submission.submit`,
`rewards.*`, `exercise.openForStudent`) **đổi đầu vào** — đây là thay đổi hợp đồng công khai, làm
cùng PR với phần UI gọi chúng.

### Cấm — ràng buộc bảo mật

> **Cấm** đặt mật khẩu ban đầu cho tài khoản gia đình bằng chuỗi mặc định đang dùng cho học sinh
> (`provisioning/provision-from-receipt.ts:302-312`).

Chuỗi đó **dùng chung cho mọi tài khoản mới**. Gán nó cho tài khoản gia đình nghĩa là ai biết
chuỗi đó cũng vào được **cả nhà** — không phải một học sinh. Nếu cần tạo tài khoản gia đình chưa
có mật khẩu thì để **trống** và buộc đặt qua đường quên-mật-khẩu.

## Các bước

1. **B1.1** — Gộp `kind` về một giá trị gia đình; phiên đa con; mọi procedure nhận `studentId`
   tường minh + kiểm sở hữu qua **một** helper.
2. **B1.2** — Đăng nhập SĐT + mật khẩu; giới hạn thử; quên mật khẩu.
3. **B1.3** — Gỡ OTP, `loginStudent`, `resetChildPassword`; drop `LoginOtp` ở migration riêng
   **sau khi** code đã gỡ (nhớ gỡ cả `GRANT` từ migration privilege-hardening).
4. **B1.4** — Gộp UI: một app gia đình, picker chọn con; bỏ cây route `/parent` vs `/student`.
5. **B1.5** — Viết lại test và khôi phục con số nghiệm thu.

   **Cách xác định phạm vi: đi theo *caller của thủ tục bị gỡ*, KHÔNG theo bộ đếm `kind`.**
   Bản đầu đếm 17 test bằng cách tìm chữ `kind`, và vì thế bỏ sót:

   | File bỏ sót | Vì sao sót |
   |---|---|
   | `apps/e2e/tests/enrollment.spec.ts:85-94` | Gọi OTP nhưng không nhắc `kind` |
   | `apps/e2e/tests/attendance-grading.spec.ts:108-121` | Gọi OTP rồi lấy con đầu |
   | `apps/e2e/tests/journeys/parent-link-approve-reject...` (P1-06) | Dùng helper phiên phụ huynh |
   | `apps/api/src/lms-auth/login.test.ts` | **File test OTP lớn nhất** — không chứa literal `kind` nên lọt khỏi bộ đếm 14 |

   Cùng với đó: cập nhật `flow-manifest.ts`, whitelist namespace ở
   `scripts/acceptance-report/verify.ts:41-43`, và allowlist audit ở `trpc.ts:109-122,135`.

## Kiểm chứng

- Không còn `kind` parent/student trong mã nguồn và trong token
- Nhà 2 con **cùng mật khẩu** ⇒ đăng nhập xác định, không còn "con nào khớp trước thì thắng"
- Nhà 2 con: đổi con thì mọi màn đổi theo
- Tài khoản gia đình không chạm được học sinh không thuộc mình (test âm)
- Đổi mô hình làm phiên cũ hết hiệu lực
- Journey LMS viết lại xanh; `pnpm acceptance:report` ≥ mức trước phase

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Con số nghiệm thu tụt giữa chừng | Đã đo: 3 flow. Mốc B1.5 nằm **trong** phase, không hoãn |
| Gỡ `LoginOtp` bỏ sót `GRANT` | Migration drop gỡ cả grant; boot-check phải qua |
| **Bỏ OTP mất trần thử mật khẩu** — `ParentAccount` **không có cơ chế khoá** nào; OTP vốn là rate-limit tự nhiên | Ranh giới #6 phải chốt **trước** khi gỡ OTP, không phải sau. Đăng nhập SĐT + mật khẩu không có trần là mời rà mật khẩu hàng loạt |
| Sửa hàng loạt input schema làm gãy client | Đổi UI và API trong cùng PR cho từng nhóm procedure |
| Lỗi phụ đã biết: `parseLmsToken` (`apps/lms/src/lib/lms-session.tsx:39-59`) gọi `atob()` trên toàn bộ token 3 phần ⇒ luôn trả null, localStorage luôn ghi rỗng | Không load-bearing hôm nay, nhưng **phải sửa trong phase này** — mã mới rất dễ tin vào giá trị client-side đó |
