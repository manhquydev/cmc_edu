# Tổng hợp rà soát toàn dự án — 2026-07-26

Gộp 4 audit module (CRM+Tài chính · Giảng dạy · Nhân sự · Quản trị+LMS+Auth).
**80 findings**, mỗi finding có `file:line` đã đọc thật. Chi tiết trong 4 báo cáo cùng ngày:
`audit-260726-2040-{crm-finance,teaching-class-ops,hr-payroll-kpi,admin-console-lms-auth}.md`.

## Kết luận chung: vì sao "chạy được" mà vẫn nhiều lỗi

Cả 4 audit độc lập chỉ ra **cùng một mẫu**: test xanh vì gọi thẳng tRPC/seed thẳng DB,
không đi qua màn hình.

| Bằng chứng | Hệ quả |
|---|---|
| `apps/e2e/tests/finance-approval.spec.ts:50-61` gọi tRPC trực tiếp | 5 lỗi chặn trên đường đi UI của sale không thể bị bắt |
| `apps/e2e/src/db.ts:265-270` tự thừa nhận "/admin/users exposes no manager field… seeded directly" | Chuỗi KPI→lương xanh trên CI, **gãy thật** trên sản phẩm |
| Journey `crm-receipt` dùng học phí `5.000.001` | Che lỗi `step={100000}` chặn mọi số tròn |

⇒ Con số "31/38 luồng proven" đo **backend chạy được**, không đo **người dùng đi được**.

## 15 lỗi mức CHẶN (người dùng thật không đi tiếp được)

| # | Module | Vấn đề | file:line |
|---|---|---|---|
| 1 | Tài chính | Sale tạo phiếu xong bị đẩy sang `/finance/{id}` mà `sale` không có quyền xem ⇒ thành công nhưng hiện lỗi quyền | `finance/receipt-create.tsx:117`, `packages/auth/src/index.ts:74` |
| 2 | Tài chính | Duyệt phiếu thất bại **im lặng** (`onError` chỉ đóng dialog) | `finance/receipt-detail.tsx:146-149` |
| 3 | Tài chính | Bộ lọc + tìm kiếm danh sách phiếu **chết hoàn toàn** | `finance/receipt-list.tsx:139` + `packages/ui/.../filter-bar.tsx:37-47` |
| 4 | Tài chính | Phiếu Nháp không huỷ được, không sửa được ⇒ kẹt vĩnh viễn trong hàng đợi duyệt | `api/finance/router.ts:480-482` |
| 5 | Giảng dạy | `/teaching/attendance` đòi `?session=` nhưng 0 link in-app truyền ⇒ phải gõ UUID | `teaching/attendance.tsx:139` |
| 6 | Giảng dạy | `classSession.assignUnit` (writer duy nhất của `curriculumUnitId`) không UI ⇒ **học sinh không bao giờ mở được bài tập** | `class-session-router.ts:245`; `exercise/open-tier.ts:100` |
| 7 | Giảng dạy | `classBatch.create` không UI ⇒ **không tạo được lớp trong app** | `class-batch-router.ts:142` |
| 8 | Giảng dạy | Roster điểm danh hiện UUID thay vì tên học sinh | `teaching/attendance.tsx:102` |
| 9 | Nhân sự | `kpi.confirm` đòi `managerId`, không màn nào set ⇒ 2 GĐ **luôn 403** khi xác nhận KPI | `api/kpi/router.ts:256` |
| 10 | Nhân sự | Menu "Nhân sự" → `/hr` → ComingSoon | `routes/hr.routes.tsx:17` |
| 11 | Nhân sự | Màn cấu hình ca chặn cả trang bằng sai quyền (`compensationPolicy.manage` thay vì `shift.manage`) | `admin/shift-config.tsx:279` |
| 12 | Nhân sự | Không procedure nào đọc `TimePunch` cho người dùng ⇒ không ai xem được lịch sử chấm công | `api/checkin/router.ts:165` |
| 13 | LMS | Vòng lặp chết: HS buộc đổi mật khẩu → bảo nhờ phụ huynh → phụ huynh chỉ có email OTP đang là stub | `lms/pages/student/change-password.tsx:56` |
| 14 | LMS | Không có đường đặt email phụ huynh: modal chỉ nằm trên hàng đợi `GuardianLinkRequest`, còn provisioning tạo thẳng `Guardian` | `admin/parents/index.tsx:76`; `provision-from-receipt.ts:352` |
| 15 | Quản trị | `position` free-text điều khiển nghiệp vụ: `resolveShiftGroup` khớp `giao_vien`, form gợi ý gõ "Giáo viên" ⇒ giáo viên bị xếp nhầm nhóm, không đăng ký được ca dạy | `domain-time/src/index.ts:92` vs `admin/users.tsx:276` |

Ngoài ra 3 mục Chặn khác: không sửa/vô hiệu hoá được nhân viên (`user.update` có, 0 UI gọi);
admin app **không có nút Đăng xuất**; ép đổi mật khẩu staff chỉ là điều hướng client (gõ
thẳng `/cockpit` là bỏ qua).

## Đã sửa trong phiên này

| Vấn đề | Cách sửa | Kiểm chứng |
|---|---|---|
| #15 `position` free-text lái nghiệp vụ | `resolveShiftGroup(roles)` — lấy nhóm ca từ vai trò, không từ chức danh | domain-time 32/32; P3 API 222/222 |
| Tạo user 3 bước rời (tạo → phân quyền → đặt mật khẩu) | `user.create` nhận `roles` + `tempPassword` + `managerId` trong 1 giao dịch, giữ nguyên audit trail | admin users 8/8, API user 38/38 |
| Vai trò nhập tay | Form có dropdown Vai trò (bắt buộc), tự gợi ý chức danh theo vai trò | test mới chặn tạo user không vai trò |
| #9 nút thắt `managerId` | Thêm ô "Quản lý trực tiếp" vào form tạo | typecheck + test xanh |
| Học phí chặn số tròn im lặng | Bỏ `step` khỏi NumberInput | — |
| Nút "Đăng nhập (Dev)" gây loop | Gỡ hẳn nút + auto-redirect | — |

Đang sửa (4 agent song song): #1–#3 tài chính/CRM · #5,#6,#7,#8 giảng dạy · #10,#11 nhân sự.

## Còn lại — đề xuất thứ tự

1. **#13 + #14 LMS**: phụ huynh/học sinh hiện không có đường vào ổn định. Cần quyết định
   sản phẩm về kênh email (Brevo thật hay bỏ OTP email, dùng SĐT).
2. **#4 + #12**: phiếu nháp kẹt và không xem được lịch sử chấm công — cả hai thiếu procedure,
   không chỉ thiếu UI.
3. **Nút Đăng xuất + sửa/vô hiệu hoá nhân viên**: rẻ, ảnh hưởng lớn tới cảm nhận "sản phẩm thật".
4. **Ép đổi mật khẩu ở server** (hiện chỉ chặn phía client).

## Câu hỏi tồn đọng
1. Kênh đăng nhập phụ huynh: nối Brevo thật, hay chuyển sang SĐT + mật khẩu như học sinh?
2. `assignUnit` thủ công từng buổi, hay `generate-sessions` tự rải theo `monthIndex`?
3. `kpi.confirm` giữ mô hình "quản lý trực tiếp" (đã có ô managerId) hay đổi sang theo track?
4. E2E: có nên bắt buộc journey đi qua UI thay vì gọi tRPC, để không lặp lại mẫu "CI xanh, prod gãy"?
