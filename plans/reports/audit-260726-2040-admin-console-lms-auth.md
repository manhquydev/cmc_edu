# Rà soát trải nghiệm thật — Quản trị + LMS PH/HS + Xác thực

Ngày: 2026-07-26 · Nhánh: `main` · Phạm vi đọc: `apps/admin/src/pages/admin/**`,
`apps/admin/src/pages/{login,change-password}.tsx`, `apps/admin/src/{routes,shell,lib}/**`,
`apps/lms/src/**`, `apps/api/src/{user,auth,lms-auth,facility,shift,guardian,session}/**`,
`packages/auth/src/index.ts`, `packages/db/prisma/schema.prisma`.
Chỉ đọc — không sửa file nào ngoài báo cáo này.

## Findings

| # | Mức | Vấn đề | file:line | Đề xuất sửa |
|---|-----|--------|-----------|-------------|
| 1 | Chặn | Vòng lặp chết LMS: HS dùng mật khẩu mặc định bị buộc đổi → trang hướng dẫn "nhờ phụ huynh đăng nhập đặt lại" → PH chỉ có đường email OTP đang là stub → không ai vào được | `apps/lms/src/pages/student/change-password.tsx:56` + `apps/lms/src/pages/login.tsx:83` | Cho staff đặt lại mật khẩu HS từ admin (`studentAccount.resetPassword` đã có quyền) và hiện đường dẫn đó trên màn hình HS |
| 2 | Chặn | Không có đường đặt email cho PH tạo tự động: chỉ modal trong hàng đợi `GuardianLinkRequest`, mà provisioning tạo thẳng `Guardian` nên PH đó không bao giờ xuất hiện trong danh sách; `/admin/parents` cũng không có trong menu | `apps/admin/src/pages/parents/index.tsx:76`, `apps/api/src/provisioning/provision-from-receipt.ts:352`, `apps/admin/src/shell/nav-registry.ts:127` | Thêm màn "Phụ huynh" liệt kê mọi `ParentAccount` + cột email, đưa vào menu Quản trị |
| 3 | Chặn | `position` là free-text nhưng đang gánh nghiệp vụ: `resolveShiftGroup` chỉ khớp `giao_vien`/`teacher`, còn form lại gợi ý gõ "Giáo viên" → GV bị xếp KINH_DOANH, đăng ký ca dạy báo lỗi | `packages/domain-time/src/index.ts:92`, `apps/admin/src/pages/admin/users.tsx:276`, `apps/api/src/shift/router.ts:197` | Đổi "Vị trí" thành dropdown enum (GV / Sale / GĐĐT / GĐKD / khác) và cho `resolveShiftGroup` đọc enum đó |
| 4 | Chặn | Không có UI sửa / vô hiệu hoá nhân viên: `user.update` tồn tại nhưng admin không gọi ở đâu → NV nghỉ việc vẫn đăng nhập được, gõ sai tên là vĩnh viễn, không đặt được quản lý trực tiếp | `apps/api/src/user/router.ts:218`, `apps/admin/src/pages/admin/users.tsx:127` | Thêm modal "Sửa nhân viên" gọi `user.update` (họ tên, email, vị trí, quản lý, bật/tắt) |
| 5 | Chặn | Admin app không có nút Đăng xuất ở bất kỳ đâu, dù `GET /auth/logout` đã mount sẵn — máy dùng chung ở trung tâm không thoát được phiên | `apps/admin/src/shell/shell.tsx:48`, `apps/api/src/server.ts:72` | Thêm menu người dùng ở topbar: tên + Đổi mật khẩu + Đăng xuất → `/auth/logout` |
| 6 | Cao | Ép đổi mật khẩu tạm chỉ là điều hướng client: `session.me` không trả `mustChangePassword`, route `/` không chặn → gõ thẳng `/cockpit` là bỏ qua vĩnh viễn | `apps/api/src/session/router.ts:26`, `apps/admin/src/routes/index.tsx:44` | Trả `mustChangePassword` trong `session.me` và chặn ở `RequireAuth` (kèm guard server cho mutation) |
| 7 | Cao | Đăng nhập nhầm con: `loginStudent` dò khớp mật khẩu trên mọi `StudentAccount` của cùng SĐT và lấy khớp đầu tiên; mật khẩu mặc định lại in công khai trên màn đăng nhập → 2 anh em cùng mặc định thì vào nhầm hồ sơ | `apps/api/src/lms-auth/router.ts:554`, `apps/lms/src/pages/login.tsx:209` | Bắt chọn tên học sinh khi 1 SĐT có ≥2 tài khoản, hoặc dùng mã HS làm định danh thay vì dò mật khẩu |
| 8 | Cao | Nút Bật/Tắt dải IP không có xác nhận — một click bật là mọi lần chấm công ngoài dải phải xin duyệt; trong khi Xoá lại có `ConfirmDialog` | `apps/admin/src/pages/admin/network-ip.tsx:107` | Bọc hành động Bật bằng `ConfirmDialog` nêu rõ hệ quả |
| 9 | Cao | Danh sách con của PH chỉ lấy từ response đăng nhập và cache localStorage → duyệt liên kết con mới không hiện cho đến khi đăng nhập lại (mà đăng nhập lại đang gãy — #1) | `apps/lms/src/pages/parent/home.tsx:124`, `apps/lms/src/lib/session-context.tsx:34` | Thêm query `guardian.listMyChildren` gọi mỗi lần vào trang chủ PH |
| 10 | Cao | Lỗi tiếng Anh thô hiển thị thẳng cho người dùng Việt, và khoá 5-lần-15-phút không được báo → user gõ lại mãi không hiểu vì sao sai | `apps/api/src/auth/password-routes.ts:39`, `apps/admin/src/pages/login.tsx:53`, `apps/lms/src/pages/parent/report-card.tsx:80` | Map mã lỗi sang chuỗi tiếng Việt ở client; thêm thông báo "tài khoản tạm khoá, thử lại sau N phút" |
| 11 | Cao | Token LMS hết hạn sau 7 ngày nhưng client không xử lý 401 → mọi màn hình PH/HS hiện banner lỗi tiếng Anh, không tự quay về `/login` | `apps/api/src/lms-auth/session-token.ts:37`, `apps/lms/src/lib/trpc.ts:57` | Thêm link `onError` bắt UNAUTHORIZED → `clearSession()` + điều hướng `/login` |
| 12 | Cao | Nhóm ca / mẫu ca chỉ tạo được — API không có update/delete → một mẫu ca gõ sai tồn tại vĩnh viễn trong form đăng ký ca của toàn bộ nhân viên | `apps/api/src/shift/router.ts:136`, `apps/admin/src/pages/admin/shift-config.tsx:192` | Bổ sung `shift.updateTemplate` + cờ `isActive` cho nhóm/mẫu ca, thêm nút Sửa/Ẩn |
| 13 | TB | `<ComingSoon/>` bị dùng làm Suspense fallback cho mọi trang admin, làm cả trang 404 (`path:'*'`), và làm trang đích của menu "Quản trị" → mạng chậm hoặc gõ sai URL đều hiện "🚧 Đang phát triển" | `apps/admin/src/routes/admin.routes.tsx:42`, `apps/admin/src/routes/index.tsx:63`, `apps/admin/src/routes/admin.routes.tsx:51` | Fallback dùng `Skeleton`; `*` dùng trang 404 thật; `/admin` redirect sang `/admin/users` |
| 14 | TB | Mở modal phân quyền là các vai dormant (`ke_toan`, `cskh`, `ctv_mkt`, `hr`) bị loại âm thầm; badge vẫn hiện vai cũ cho đến khi bấm Lưu → admin vô tình xoá quyền | `apps/admin/src/pages/admin/users.tsx:159` | Hiện cảnh báo "sẽ gỡ N vai không còn hiệu lực" trước khi Lưu |
| 15 | TB | Bảng nhân viên in slug thô `giam_doc_kinh_doanh` trong khi modal đã có nhãn tiếng Việt; topbar chỉ hiện `roles[0]` thô cho người nhiều vai | `apps/admin/src/pages/admin/users.tsx:69`, `apps/admin/src/shell/shell.tsx:55` | Dùng chung `ROLE_LABELS` cho cả bảng và topbar; hiện đủ vai |
| 16 | TB | Nhật ký hệ thống khó dùng: "Người thực hiện" là `userId` thô, hai bộ lọc đòi gõ đúng mã nội bộ (`facility.update`, `Facility`), và cột `data` (before/after khi đổi quyền) được fetch nhưng không hiển thị ở đâu | `apps/admin/src/pages/admin/audit-log.tsx:47`, `:105`, `:24` | Join tên NV cho actor, đổi 2 ô lọc thành dropdown, thêm hàng mở rộng xem `data` |
| 17 | TB | Bộ lọc ngày nuốt lỗi im lặng: parse hỏng thì trả `undefined` → gõ "26/07/2026" là bộ lọc bị bỏ qua, bảng vẫn ra đủ bản ghi mà không báo gì | `apps/admin/src/pages/admin/audit-log.tsx:55` | Dùng date picker, hoặc báo lỗi khi chuỗi không parse được |
| 18 | TB | Form mẫu ca nhập giờ bằng text tự do; sai định dạng thì nút chỉ mờ đi, không câu nào giải thích | `apps/admin/src/pages/admin/shift-config.tsx:121` | Dùng input `type="time"` hoặc hiện lỗi "Định dạng HH:mm" ngay dưới ô |
| 19 | TB | Form tạo NV bắt admin tự nghĩ ra "User ID (auth identity)" trong khi NV thật lại đăng nhập bằng email; đồng thời form thiếu ô "Quản lý trực tiếp" dù API đã nhận `managerId` | `apps/admin/src/pages/admin/users.tsx:254`, `apps/api/src/user/router.ts:30` | Khi SSO tắt thì tự lấy `userId = email` (ẩn ô); thêm `Selector` quản lý trực tiếp từ `user.pickList` |
| 20 | Thấp | `parseLmsToken` giải mã cả chuỗi `header.payload.sig` bằng `atob` → luôn trả `null` với token đã ký, nên `parentAccountId` lưu trong localStorage luôn là chuỗi rỗng (đã kiểm chứng bằng token ký thật) | `apps/lms/src/lib/lms-session.tsx:41`, `apps/lms/src/pages/login.tsx:66` | Tách theo `.` và chỉ base64url-decode phần payload |

## Trả lời trực tiếp các câu hỏi

**1 — Luồng nhiều bước lẽ ra gộp.** Tạo một nhân viên thật hiện là 4 màn ở 2 nhóm menu, và
một bước không có giao diện:

1. Quản trị → Người dùng → "Thêm nhân viên" (`user.create`, không có ô vai trò, không có mật khẩu)
2. Click lại đúng dòng đó → modal Phân quyền (`user.updateRoles`)
3. Nút "Đặt lại mật khẩu" trên cùng dòng (`user.resetPassword`)
4. Nhân sự → Bậc lương → "Gán bậc" (`compensation.assignTier`, `apps/admin/src/pages/hr/salary-tiers.tsx:304`)
5. Quản lý trực tiếp: **không có UI nào** dù `user.create`/`user.update` đều nhận `managerId`

Giữa bước 1 và 3, tài khoản tồn tại nhưng `roles=[]` và `passwordHash=null` — đăng nhập được
sau bước 3 nhưng vào là một app rỗng. Gộp thành một modal có tab (thông tin → vai trò →
mật khẩu tạm) là thay đổi nhỏ nhất có tác dụng lớn nhất.

Các chỗ nhiều bước tương tự: bật dải IP (tạo → tìm lại dòng → bấm Bật, #8), và đặt email PH
(duyệt liên kết → mở modal riêng, #2).

**2 — Trường thông tin nhân viên.**

Model `AppUser` có mà form **không** có (`packages/db/prisma/schema.prisma:1079`):
`managerId` (quản lý trực tiếp — API nhận, form bỏ), `roles` (phải sang modal khác),
`isActive` (chỉ hiển thị badge, không sửa được ở đâu — #4).
`employeeCode` sinh tự động nên không cần ô nhập.

Nghiệp vụ cần mà **model cũng không có**: số điện thoại NV, ngày vào làm, ngày sinh, CCCD,
số tài khoản ngân hàng. Cụ thể: chấm công/phạt muộn (`CompensationPolicy`) và bảng lương
(`Payslip`) chạy được không cần ngày vào làm, nhưng chốt lương tháng đầu theo tỷ lệ ngày công
thì không có dữ liệu; và không có SĐT thì HR không liên lạc được NV vắng ca ngay trong app.
Bậc lương nằm ở model riêng (`SalaryRate.tierId` → `SalaryTier`), gán ở màn khác — xem mục 1.

**3 — Free-text lẽ ra là dropdown.** Ưu tiên theo mức thiệt hại:
`Vị trí` (#3, đang gánh logic chia nhóm ca), `Loại việc`/`Đối tượng` trong nhật ký (#16),
giờ bắt đầu/kết thúc mẫu ca (#18), ngày trong bộ lọc nhật ký (#17). CIDR thì free-text là hợp lý
vì server đã validate bằng `isValidCidr` và UI đã có nút tự dò IP.

**4 — LMS.** Phụ huynh: **không dùng được với người thật.** UI chỉ có tab email OTP, transport
là `ConsoleEmailTransport` ở non-prod và Brevo chưa có credential; thêm nữa email chỉ được gửi
khi `ParentAccount.email` đã có (`apps/api/src/lms-auth/router.ts:416`), mà đường đặt email lại
không tới được (#2). Đáng chú ý: backend đã có `lmsAuth.requestOtp` theo SĐT nhưng UI không
expose tab nào cho nó — nếu có kênh SMS thì đó là lối ra nhanh nhất. Ngoài ra khi bấm "Gửi mã OTP",
API luôn trả `{ok:true}` (chủ ý chống dò tài khoản) nên UI luôn nhảy sang bước nhập mã kể cả khi
không có email nào được gửi — PH ngồi chờ một mã không tồn tại.

Học sinh: luồng **không rõ ràng**. Ô nhập ghi "Số điện thoại phụ huynh" (HS phải biết SĐT bố mẹ),
mật khẩu mặc định in ngay trên màn đăng nhập, danh tính con được suy ra bằng cách dò mật khẩu (#7),
và bước đổi mật khẩu bắt buộc lại dẫn vào ngõ cụt (#1).

**5 — Ngõ cụt & ComingSoon.** Xem #1, #2, #5, #11, #13. `ComingSoon` xuất hiện ở 3 vị trí,
trong đó 2 vị trí là sai ngữ nghĩa (đang tải, và 404).

**6 — Vai trò.** Registry khai báo 9 vai (`packages/auth/src/index.ts:10`), 5 vai active
(`:27`), UI cho chọn đúng 5 vai và có nhãn tiếng Việt cho cả 5 (`apps/admin/src/pages/admin/users.tsx:23`).
**Không lệch số** ở bộ chọn. Lệch nằm ở chỗ khác: DB enum vẫn giữ 9 giá trị nên tài khoản mang
vai dormant sẽ bị gỡ âm thầm khi admin mở modal (#14), và bảng hiển thị slug thô thay vì nhãn (#15).

## 3 việc nên làm trước nhất

1. **Gỡ vòng lặp chết đăng nhập LMS (#1 + #2).** Mở một đường đặt lại mật khẩu HS từ phía admin
   và một màn "Phụ huynh" đầy đủ có cột email trong menu Quản trị. Không có hai thứ này thì mọi
   luồng LMS đã dựng đều chưa có người thật dùng được.
2. **Thêm sửa/vô hiệu hoá nhân viên + nút Đăng xuất (#4 + #5).** Đây là hai thao tác quản trị
   cơ bản nhất, một cái làm NV nghỉ việc vẫn còn quyền, một cái làm máy dùng chung không thoát
   được phiên. `user.update` đã sẵn sàng, `/auth/logout` đã mount — chỉ thiếu giao diện.
3. **Đổi "Vị trí" thành dropdown enum và cho `resolveShiftGroup` đọc enum đó (#3).** Đây là
   khiếm khuyết duy nhất trong danh sách mà form đang chủ động hướng dẫn người dùng nhập sai:
   gõ đúng theo placeholder "Giáo viên" là giáo viên đó không đăng ký được ca dạy.

## Ghi chú kiểm chứng

- #20 kiểm chứng bằng cách ký một token thật theo đúng `signLmsToken` rồi chạy `parseLmsToken`
  → trả `null`. Hiện chưa gây lỗi nhìn thấy vì server đọc bearer token, không đọc
  `parentAccountId` từ localStorage; nhưng bất kỳ màn hình nào sau này dùng
  `session.parentAccountId` sẽ nhận chuỗi rỗng.
- #2 kiểm chứng bằng: `guardian.listPendingLinks` đọc bảng `GuardianLinkRequest`
  (`apps/api/src/guardian/router.ts:203`), còn provisioning tạo thẳng `Guardian`
  (`apps/api/src/provisioning/provision-from-receipt.ts:352`) — hai bảng khác nhau.
- Không tính lại các mục đã biết: nút "Đăng nhập (Dev)" gây redirect loop, và
  `AppUser.userId` rỗng của super admin.

## Câu hỏi còn treo

- Có kênh SMS nào khả dụng không? Nếu có, bật tab OTP theo SĐT (`lmsAuth.requestOtp` đã có sẵn
  và đầy đủ cooldown/rate-limit) là lối ra nhanh hơn nhiều so với chờ Brevo.
- Ngày vào làm / SĐT nhân viên: có thuộc phạm vi bản này không, hay HR vẫn quản ngoài hệ thống?
  Việc thêm cột vào `AppUser` cần một quyết định sản phẩm chứ không nên tự thêm.
- `ParentAccount.passwordHash` tồn tại trong schema nhưng không có luồng nào dùng — bỏ hay là
  kế hoạch cho đăng nhập PH bằng mật khẩu (sẽ giải quyết luôn #1)?
