# Tự chạy & tự test toàn hệ CMC theo dòng thời gian — 2026-07-26

Kịch bản diễn trên UI thật (:5173/:5174) + dev DB `cmc-dev-pg`. Dữ liệu **giữ nguyên**
cho user khám phá. Không sửa code sản phẩm.

## 1. Dòng thời gian đã diễn (bằng chứng: Nhật ký hệ thống, 24 bản ghi)

Bảng dưới chép từ `/admin/audit-log` — hệ thống tự ghi, không phải tôi thuật lại.

| Giờ | Vai | Việc | Kết quả |
|---|---|---|---|
| 19:13–19:16 | **super_admin** | `user.create` ×4 + `user.updateRoles` ×4 | CMC0001 GĐKD · CMC0002 GĐĐT · CMC0003 Sale · CMC0004 Giáo viên |
| 19:16:56 | **sale** | `crm.opportunityCreate` | Cơ hội "Chị Hoa (PH bé Minh Anh)" 0912345678 |
| 19:17:12–15 | **sale** | `crm.opportunityAdvance` ×3 | O1→O2→O3→O4_TESTED (pipeline UI cập nhật đúng từng bước) |
| 19:21:47 | **GĐĐT** | `course.create` + `classBatch.create` | Khoá UCREA + lớp `CMCDEVEL-UCREA-2026-001`, **auto sinh 24 buổi** (T2/T5 18:00–19:30, 28/7→20/10) |
| 19:22:36 | **GĐĐT** | `classBatch.assignTeacher` | Gán CMC0004 |
| 19:29:18 | **sale** | `finance.receiptCreate` | Phiếu SO00001, 25.000.001đ, gắn cơ hội + lớp |
| 19:30:00 | **GĐĐT** | `finance.receiptApprove` | Duyệt vượt ngưỡng 20M |
| 19:30:01 | **system** | `provisioning.completed` | Tự động: Student + ParentAccount + Enrollment `active` + Opp `O5_ENROLLED` + EmailOutbox |
| 19:31:26 | **học sinh (LMS)** | `lmsAuth.loginStudent` | Đăng nhập :5174 bằng mật khẩu mặc định → chặn ở màn buộc đổi |
| 19:34:27 | **giáo viên** | `checkInOut.punch` | Chấm công thành công |

Kiểm chứng DB sau khi duyệt: `receipt:approved · student:1 · parent:84912345678 ·
enrollment:active · opp:O5_ENROLLED · email:brevo/pending · audit:22 rows`.

## 2. Kiểm chứng phân quyền (RBAC/RLS) — đạt

- **sale** mở phiếu thu của chính mình → `Missing permission finance.receiptGet` (chặn đúng).
- **GĐĐT** mở cùng phiếu → thấy banner *"Phiếu vượt ngưỡng 20.000.000đ — chỉ GĐĐT hoặc
  super_admin được duyệt"* + ghi rõ SoD *"người tạo ≠ người duyệt"*.
- **giáo viên** vào `/hr/kpi` (Duyệt KPI) → ComingSoon; **GĐĐT** vào cùng route → màn thật
  (bộ lọc kỳ + "Đã trả lương kỳ 2026-07").
- Nav sidebar khác nhau theo vai (sale không có mục Nhân sự/Quản trị).

## 3. Suite tự động — 100% xanh

| Suite | Kết quả |
|---|---|
| `pnpm --filter @cmc/api exec vitest run` | **106 files / 1009 tests passed**, exit 0 |
| `pnpm test` (turbo, trừ e2e) | 22/23 task xanh; lần đầu 2 test đỏ = flaky `kpi double-fire` (#36), chạy lại đơn lẻ 29/29 pass và full suite pass |
| `PLAYWRIGHT_UI=1 --project=ui-chromium` | **40 passed (5.8m)**, exit 0 |
| `pnpm acceptance:report` | **31 proven / 7 not-yet** — đúng trần journey |

## 4. Phát hiện trong lúc tự test

### BUG (chặn nghiệp vụ thật): ô Học phí từ chối mọi số tròn, im lặng
`apps/admin/src/pages/finance/receipt-create.tsx:311-322` — `NumberInput min={1} step={100000}`.
HTML constraint validation ⇒ chỉ chấp nhận số ≡ 1 (mod 100.000). Nút là `type="submit"`,
nên **25.000.000 / 5.000.000 / 12.000.000 đều bị chặn ở tầng browser, không request nào bay
đi, không thông báo lỗi nào hiện ra** — người dùng bấm và không có gì xảy ra.
Bằng chứng: `form.checkValidity()=false`, `validationMessage: "The two nearest valid values
are 24900001 and 25000001"`; DB 0 phiếu sau 3 lần bấm.
Journey `crm-receipt` xanh vì dùng `5000001` — vô tình hợp step ⇒ test **che** bug này.
Sửa: bỏ `step` (hoặc `step="any"`), giữ `isIntegerOnly` cho ràng buộc số nguyên.
Demo phải dùng 25.000.001đ để đi tiếp.

### Còn tồn (từ phiên trước, chưa sửa theo yêu cầu)
Nút "Đăng nhập (Dev)" gây loop `/`↔`/login` — xem
`plans/reports/debug-260726-1822-admin-dev-login-redirect-loop.md`.

### Không phải bug
`Staff profile not found in this facility` khi chấm công là do tôi impersonate sai khoá
(`AppUser.id` thay vì `AppUser.userId`). Dùng đúng `gv@cmcvn.edu.vn` thì chấm công chạy.
Lưu ý: **SA-001 có `userId` rỗng** trong DB nên không impersonate qua header dev được.

### Màn ComingSoon (chưa xây, không phải lỗi)
`/admin` (index), `/hr` (index), `/hr/me`, `/teaching/sessions`, `/admin/audit` (đường đúng
là `/admin/audit-log`).

## 5. Trạng thái để user vào xem ngay

| URL | Nội dung |
|---|---|
| http://localhost:5173 | Admin ERP — dữ liệu demo đầy đủ |
| http://localhost:5174 | LMS — học sinh login `0912345678` / mật khẩu mặc định sản phẩm |
| http://localhost:3002 · :3000 | API dev · prod-sim |

Đăng nhập ERP: `admin@cmcvn.edu.vn` + `SUPER_ADMIN_PASSWORD` trong `.env` (buộc đổi lần đầu).
**Đừng bấm "Đăng nhập (Dev)"** cho tới khi bug loop được sửa.

## Câu hỏi tồn đọng
1. Sửa bug `step={100000}` ngay? (khuyến nghị: có — chặn nghiệp vụ thật)
2. Sửa/bỏ nút "Đăng nhập (Dev)"? (khuyến nghị: bỏ)
3. Journey `crm-receipt` nên đổi `5000001` → số tròn để không che lại bug tương tự?
