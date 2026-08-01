# Tổng kết: rà soát toàn dự án + sửa lỗi chặn — 2026-07-26

Nối tiếp `audit-260726-2040-tong-hop-thieu-sot-toan-du-an.md`. Điều phối 4 agent rà soát +
4 agent triển khai, chạy song song theo ranh giới file rõ ràng.

## Kết quả kiểm chứng (số thật, không phải ước lượng)

| Gate | Kết quả |
|---|---|
| `pnpm typecheck` | **27/27 task xanh** |
| `pnpm test` (lần 2, log đầy đủ) | **FULL_EXIT=0** · admin 458/458 · api 1010/1010 · 23/23 task |
| `pnpm lint` | exit 0 |
| Stack production (image build lại) | 6 service healthy, https://erp.localhost 200 |
| Quy mô | 39 file, +1807 / −330 dòng |

Lần chạy `pnpm test` **đầu tiên** báo đỏ ở `@cmc/api`; chạy lại riêng API cho 1010/1010 xanh
và lần full thứ hai cũng xanh ⇒ đúng con flaky `kpi double-fire` (issue #36) khi runner chia
tải, không phải hồi quy. (Bẫy đã mắc: lần đầu pipe qua `tail` nên `$?` báo 0 trong khi test đỏ.)

## Kiểm chứng trên UI production thật (Playwright, cert tự ký)

```
LOGIN_BUTTONS      ["👁","Đăng nhập"]              ← không còn nút Dev
HAS_LOGOUT         true                             ← trước đây phải gõ /auth/logout
CREATE_FORM_FIELDS [User ID, Họ tên, Email, Vai trò, Vị trí, Quản lý trực tiếp, Mật khẩu đầu tiên]
POSITION_AUTOFILLED "Giáo viên"                     ← tự điền theo vai trò đã chọn
NEW_STAFF_ROW      CMC0005 … giao_vien Hoạt động    ← 1 bước, có vai trò ngay
NEW_STAFF_LANDS_AT /change-password                 ← đăng nhập được ngay, buộc đổi mật khẩu
ATTENDANCE         "1. CHỌN LỚP → Chọn lớp học"     ← không còn đòi gõ ?session= vào URL
```

## Đã sửa

**Đúng vấn đề user nêu**
- `user.create` nhận `roles` + `tempPassword` + `managerId` trong **một giao dịch** (trước: 3 bước
  rời tạo → phân quyền → đặt mật khẩu). Audit trail giữ nguyên: vẫn ghi `user.updateRoles` và
  `user.resetPassword` để người soát log thấy ai cấp quyền.
- Form có **dropdown Vai trò bắt buộc**; chọn vai trò tự gợi ý chức danh. Test mới chặn tạo
  tài khoản không vai trò.
- Thêm ô **Quản lý trực tiếp** — đây chính là nút thắt khiến `kpi.confirm` luôn 403.

**Lỗi chặn theo module** (chi tiết trong 4 báo cáo `impl-260726-2040-*.md`)
- Tài chính/CRM: sale không còn bị đẩy vào trang không có quyền sau khi tạo phiếu; lỗi duyệt
  phiếu hiển thị thay vì im lặng; bộ lọc danh sách phiếu sống lại; 4 mutation CRM hiện lỗi.
- Giảng dạy: form **Tạo lớp**; **gán CurriculumUnit** cho buổi (mắt xích khiến bài tập học sinh
  là code chết); thêm buổi bù; xác nhận trước khi huỷ buổi; picker lớp→buổi cho Điểm danh;
  roster hiện **tên** thay UUID; bỏ mặc định "có mặt"; bỏ giới hạn điểm 10 cứng; gỡ bộ lọc lớp giả.
- Nhân sự: `/hr` không còn ra ComingSoon; tách quyền cấu hình ca theo tab; Skeleton thay
  ComingSoon khi tải; kỳ KPI chỉ query khi đúng định dạng.
- Toàn cục: nút **Đăng xuất**; menu "Ca làm việc" chuyển từ cụm Quản trị (khoá `super_admin`)
  sang cụm Nhân sự với `shift.manage` — trước đó 2 GĐ được vào trang nhưng không thấy menu.

**Sửa tận gốc phát sinh trong lúc làm**
`resolveShiftGroup(position)` → `resolveShiftGroup(roles)`. Hàm khớp chuỗi `giao_vien` trên
ô free-text, còn form lại gợi ý gõ "Giáo viên" ⇒ gõ đúng theo hướng dẫn thì giáo viên bị xếp
nhóm KINH_DOANH và không đăng ký được ca dạy. Blast radius: 1 caller (`shift/router.ts:197`),
đã cập nhật cùng fixture test. domain-time 32/32, P3 API 222/222.

## Nguyên nhân gốc của "quá nhiều lỗi"

Cả 4 audit độc lập chỉ ra cùng một mẫu: **test xanh vì không đi qua màn hình**.
`apps/e2e/tests/finance-approval.spec.ts:50-61` gọi thẳng tRPC; `apps/e2e/src/db.ts:265` tự ghi
"/admin/users exposes no manager field… seeded directly". ⇒ "31/38 luồng proven" đo backend
chạy được, **không** đo người dùng đi được.

## Còn lại (chưa làm, cần quyết định sản phẩm)

1. **LMS bế tắc**: HS buộc đổi mật khẩu → chỉ dẫn nhờ phụ huynh → phụ huynh chỉ có email OTP
   đang là stub. Cần chọn: nối Brevo thật, hay cho phụ huynh đăng nhập bằng SĐT như học sinh.
2. **Không có đường đặt email phụ huynh** cho phụ huynh do provisioning tạo tự động.
3. Phiếu Nháp không huỷ/sửa được; không xem được lịch sử chấm công (`TimePunch` thiếu procedure đọc).
4. Không sửa/vô hiệu hoá được nhân viên (`user.update` có, 0 UI gọi) ⇒ người nghỉ việc vẫn đăng nhập.
5. Ép đổi mật khẩu staff mới chỉ chặn phía client.
6. Date-picker cho đăng ký ca — `@cmc/ui` chưa có primitive, cần quyết định trước khi thêm.
7. 2 lỗi đóng gói Docker production (`base` của admin, SPA fallback) — local-sim đã né, production còn.

## Câu hỏi tồn đọng
1. Kênh đăng nhập phụ huynh: Brevo thật hay chuyển sang SĐT + mật khẩu?
2. Có nên bắt buộc journey e2e đi qua UI để không lặp lại mẫu "CI xanh, prod gãy"?
3. Commit toàn bộ 39 file này thành một PR, hay tách theo module?
