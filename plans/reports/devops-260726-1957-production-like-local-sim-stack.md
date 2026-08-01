# Môi trường test giống production — 2026-07-26

Thay chế độ dev (Vite + `x-dev-user`) bằng **stack production đầy đủ**: nginx + TLS +
bundle production + API `NODE_ENV=production` + worker + postgres. Không còn phần tử dev
nào trên UI; đăng nhập bằng tài khoản/mật khẩu thật.

## Truy cập

| URL | Nội dung |
|---|---|
| **https://erp.localhost** | ERP nhân viên (5 tài khoản thật) |
| **https://hoc.localhost** | LMS phụ huynh/học sinh |
| http://… | tự chuyển 301 sang https |

Lần đầu trình duyệt cảnh báo cert tự ký → *Nâng cao → Tiếp tục*. Đây là hệ quả tất yếu của
việc chạy thật: production đặt cookie phiên cờ `Secure`, nên http không giữ được đăng nhập.

Mật khẩu: `.env.local-sim-accounts` (gitignored, sinh bởi script, không in ra chat).
Học sinh LMS: SĐT `0912345678` + mật khẩu mặc định của sản phẩm.

## Khác biệt so với chế độ dev cũ (nguồn của phần lớn "lỗi" đã gặp)

| | Dev cũ (:5173) | Local-sim mới |
|---|---|---|
| Nút "Đăng nhập (Dev)" | có → gây loop `/`↔`/login` | **không có trong bundle** (0 match) |
| Dropdown "Dev role" | có | **không có** (0 match) |
| Ô dev header LMS | có | **không có** |
| `x-dev-user` | API chấp nhận | **401** cả qua nginx lẫn API trực tiếp; nginx còn xoá header |
| Cookie | không `Secure` | `Secure` + HttpOnly + SameSite=Lax |
| Nguồn `/trpc` | proxy Vite | same-origin qua nginx, có rate-limit |

## Đã tạo (đều là file mới, không sửa code sản phẩm)

- `infra/nginx/nginx.local-sim.conf` — 2 vhost (erp/hoc), khác production đúng 4 điểm có
  chú thích: tách vhost, rewrite vào thư mục con của container, bỏ HSTS (tránh ép https cho
  mọi app localhost khác), auth 5r/m→30r/m (đăng nhập nhiều vai liên tiếp là thao tác test
  bình thường).
- `infra/nginx/local-sim-api-locations.conf` — khối proxy API dùng chung 2 vhost.
- `infra/nginx/spa-fallback-{admin,lms}.conf` — vá fallback SPA (xem bug #2).
- `infra/compose.local-sim.yml` — nay dựng cả stack, kèm lệnh sinh cert.
- `scripts/seed-local-sim-demo.ts` — tạo tài khoản + dữ liệu **qua đúng HTTP như trình duyệt**
  (login → cookie → tRPC). Chạy xanh nghĩa là đường auth thật hoạt động, không nhờ backdoor.

Lệnh dựng lại: xem header `infra/compose.local-sim.yml`; seed lại:
`LOCAL_SIM_SEED_ALLOW=1 pnpm exec tsx scripts/seed-local-sim-demo.ts`.

## 2 bug production phát hiện khi dựng (đóng gói Docker, chưa từng được test)

Journey/e2e chỉ chạy qua `vite preview`, nên nhánh đóng gói này chưa bao giờ được chạy thử.

1. **Asset admin không tải được dưới prefix `/admin/`.** Image build không có `base`, HTML
   trỏ `/assets/...` (gốc origin) trong khi `nginx.conf` route `/assets/*` sang container LMS
   → trả `index.html` với `content-type: text/html`, trình duyệt từ chối thực thi. Với layout
   1 vhost của `nginx.conf`, admin **không thể chạy**. Local-sim đi đường 2 vhost nên tránh được.
2. **Deep-link/F5 rơi ra trang mặc định nginx.** `spa-fallback.conf` fallback `/index.html` ở
   root, trong khi bundle nằm ở `/usr/share/nginx/html/{admin,lms}` → nginx trả trang
   "Welcome to nginx!". Ảnh hưởng mọi route trừ trang chủ. Đã vá bằng 2 file fallback riêng.

Cả hai nằm ở `infra/`, không phải code ứng dụng, và chỉ lộ ra khi chạy image thật.

## Kiểm chứng (Playwright, cert bỏ qua)

- Trang login chỉ còn 2 nút: 👁 và "Đăng nhập" — **không còn nút Dev**.
- Đăng nhập thật 4 vai đều vào `/cockpit`; sidebar khác nhau đúng quyền: giáo viên thiếu
  "Tài chính & Điều hành"/"Gắn kết", chỉ super_admin có "Quản trị".
- Danh sách nhân viên hiện đủ 5 tài khoản; màn Phiếu thu render dữ liệu thật.
- Deep-link `/finance`, `/crm`, `/student/home` đều trả SPA sau khi vá.
- LMS: học sinh đăng nhập bằng mật khẩu mặc định → buộc đổi mật khẩu; **hộp dev header biến mất**.
- `pnpm lint` sạch.

## Dữ liệu seed sẵn

5 nhân viên (SA + GĐKD + GĐĐT + Sale + GV) · khoá UCREA + lớp `CMCDEVEL-UCREA-2026-001`
(24 buổi) · cơ hội CRM đã lên O4 · phiếu thu **SO00001 25.000.000đ đã duyệt** → học sinh,
phụ huynh, ghi danh `active`, cơ hội `O5_ENROLLED`.

Đáng chú ý: API nhận **đúng 25.000.000** qua HTTP. Xác nhận bug `step={100000}` (báo cáo
`devops-260726-1903`) thuần tầng UI — chỉ chặn khi nhập trên trình duyệt.

## Câu hỏi tồn đọng
1. Sửa 2 bug đóng gói ở `infra/` cho production (`base: '/admin/'` + fallback đúng thư mục)?
2. Sửa bug `step={100000}` ở ô Học phí?
3. Commit nhóm file local-sim này chứ?
