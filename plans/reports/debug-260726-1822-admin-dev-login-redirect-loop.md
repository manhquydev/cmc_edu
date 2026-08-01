# Debug: admin :5173 "giật liên tục" + "Invalid credentials." — 2026-07-26

2 triệu chứng, 2 root cause độc lập. Cả hai đã chứng minh bằng tái hiện thực nghiệm
(Playwright) + trace source. KHÔNG phải lỗi backend/DB/proxy — cả chuỗi đó đã verify xanh.

## Triệu chứng 1: UI giật liên tục sau khi bấm "Đăng nhập (Dev)"

**Root cause: vòng lặp redirect vô hạn `/` ↔ `/login` do nút Dev ghi dev-user hỏng.**

Chuỗi nhân quả (đã chứng minh từng mắt xích):
1. `loginAsDev()` ghi `localStorage.cmc_dev_user = {userId:'u-dev-1', facilityId:'PLACEHOLDER'}`
   — `apps/admin/src/pages/login.tsx:28-36`.
2. tRPC client gửi giá trị này làm header `x-dev-user` — `apps/admin/src/lib/trpc.ts:21`
   (API dev chấp nhận header ở non-prod — `apps/api/src/context.ts:214`).
3. `requireValidFacility` (K7, `apps/api/src/trpc.ts`) từ chối vì facility `PLACEHOLDER`
   không tồn tại → `session.me` 401 → `me = null`.
4. `RequireAuth`: `!me` → `<Navigate to="/login">` — `apps/admin/src/routes/index.tsx:28`.
5. `LoginPage` useEffect: thấy `cmc_dev_user` TỒN TẠI (không validate) → `navigate('/')`
   — `login.tsx:19-26`. → quay lại bước 3. Lặp vô hạn.

Bằng chứng tái hiện: bấm nút Dev → console 3→50+ errors trong 8s, URL nhảy `/`↔`/login`
liên tục, React "Maximum update depth exceeded" spam (log Playwright 565 dòng).
Phản chứng: `localStorage.removeItem('cmc_dev_user')` → log đứng yên ngay, trang ổn định
tại `/login`. Điều kiện cần & đủ xác nhận.

Bản chất: nút "Đăng nhập (Dev)" là artifact cũ từ trước remediation K7
(requireValidFacility) + trước khi có staff password login — với PLACEHOLDER hardcode,
nó không bao giờ đăng nhập thành công được nữa, chỉ tạo loop.

## Triệu chứng 2: đăng nhập admin báo "Invalid credentials."

**Root cause: password drift — mật khẩu gõ vào không phải `SUPER_ADMIN_PASSWORD` hiện tại
trong `.env`.** Không phải bug.

Loại trừ có bằng chứng:
- `POST /auth/staff-login` với thông tin từ `.env` qua ĐÚNG đường UI đi (proxy :5173) → HTTP 200
  `{"ok":true,"mustChangePassword":true}` (lặp lại 2 lần, cả sau khi restart API).
- Lockout sạch: `loginAttempts=0`, `loginLockedUntil=NULL`.
- "Invalid credentials." = `GENERIC_STAFF_LOGIN_FAILURE` (`apps/api/src/auth/password-routes.ts:39`)
  — chỉ trả khi email/password sai thật (message gộp chống enumeration).

Nguồn drift: 3 mật khẩu tồn tại quanh phiên rebuild — (a) file `env` cũ (đã xóa,
`SEED_SUPERADMIN_PASSWORD`), (b) `.env.prod` (prod-sim :3000), (c) `.env` (dev :3002,
**đúng cho :5173**). Báo cáo 1739 (trước rebuild) trỏ vào (a) → làm theo hướng dẫn cũ
là sai password. Nguồn đúng duy nhất: `grep SUPER_ADMIN_PASSWORD .env`.

## Phát hiện phụ (đã xử lý)

Process API :3002 chạy từ 18:08 là ORPHAN: `pkill -f 'tsx watch src/server.ts'` chỉ giết
watcher cha, con giữ port sống → instance quản lý sau đó crash `EADDRINUSE`. Đã kill theo
PID từ `ss -tlnp` và restart có quản lý; health + login re-verify OK.

## Cách unblock ngay (phía user, browser đang giật)

1. DevTools Console tại :5173 → `localStorage.removeItem('cmc_dev_user')` → F5.
2. KHÔNG dùng nút "Đăng nhập (Dev)". Đăng nhập bằng email `admin@cmcvn.edu.vn` +
   password = giá trị `SUPER_ADMIN_PASSWORD` trong `.env` (không ghi ra đây).
3. Lần đầu login sẽ bị buộc đổi mật khẩu (`mustChangePassword` by design).

## Đề xuất fix code (chưa áp — chờ chốt, dành cho /ak:fix)

- **Khuyến nghị (nhỏ nhất, đúng nguyên nhân):** bỏ nút "Đăng nhập (Dev)" + useEffect
  auto-redirect trong `login.tsx` (staff password login đã thay thế nhu cầu này;
  role-switcher/e2e mode-A tự set dev-user hợp lệ, không đi qua nút này).
- Thay thế: giữ nút nhưng resolve facility thật (cần endpoint public — không có, YAGNI);
  hoặc clear `cmc_dev_user` khi `session.me` fail (chữa loop nhưng giữ nút chết).

## Unresolved

1. Chốt hướng fix nút Dev (khuyến nghị: xóa) — cần user quyết vì là thay đổi UX dev-tool.
