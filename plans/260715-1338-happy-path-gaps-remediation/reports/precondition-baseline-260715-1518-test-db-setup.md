# Precondition — Baseline & Test DB Setup

**Ngày:** 2026-07-15

## Vấn đề hạ tầng phát hiện
Root `.env`'s `DATABASE_URL` trỏ `localhost:5432/cmc_edu` nhưng **không có gì lắng nghe ở cổng 5432** trên host — Postgres của Docker stack `cmcv2-prod-*` chủ động không mở cổng ra host (xác nhận qua `docs/runbook-deploy.md`: "postgres has no host port mapping — intentional"). Chạy test với DATABASE_URL rỗng sẽ treo/lỗi, cho tín hiệu "baseline đỏ" giả — không phản ánh code.

## Giải pháp áp dụng (không đụng dữ liệu `cmc_prod`)
Tạo **database test riêng `cmc_edu`** bên trong CHÍNH Postgres đang chạy (`cmcv2-prod-postgres-1`), truy cập qua socat forward sẵn có ở `localhost:15432`:
```bash
docker exec cmcv2-prod-postgres-1 psql -U postgres -c "CREATE DATABASE cmc_edu OWNER postgres;"
```
Áp toàn bộ 31 migration: `prisma migrate deploy` (không phải `migrate dev` — tránh prompt tương tác) với `DATABASE_URL`/`APP_DATABASE_URL` trỏ `localhost:15432/cmc_edu`.

## Biến môi trường CHUẨN cho mọi lệnh test từ giờ trong plan này
```bash
export DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD từ .env.prod>@localhost:15432/cmc_edu?schema=public"
export APP_DATABASE_URL="postgresql://cmc_app:<cmc_app password từ .env.prod>@localhost:15432/cmc_edu?schema=public"
```
(Giá trị mật khẩu lấy từ `.env.prod` tại repo root — không chép lại ở đây, xem file gốc khi cần.)

Role `cmc_app` là role cấp cluster (dùng chung `cmc_prod`) — không cần tạo lại, migration tự GRANT quyền đúng phạm vi `cmc_edu`.

## Baseline xác nhận (2026-07-15 15:16–15:18)
- `pnpm --filter @cmc/api test` (với env trên): **759/759 test pass, 87/87 file pass**, 126s. (Cao hơn 532 test trong docs cũ — code đã phát triển thêm từ lúc doc viết; không phải sai lệch.)
- `pnpm typecheck`: đang chạy / xem kết quả tại thời điểm phase kế tiếp.

## An toàn dữ liệu
- `cmc_edu` là database TÁCH BIỆT hoàn toàn với `cmc_prod` trong cùng Postgres server — cùng hạ tầng, khác dữ liệu, không đụng nhau.
- Đã xin phép người dùng trước khi: (a) dùng chung Docker đang chạy, (b) đọc `.env.prod` lấy thông tin đăng nhập.
- Không xoá/sửa gì trong `cmc_prod`.

## Ghi chú cho phiên làm việc sau
Nếu Docker bị restart, database `cmc_edu` vẫn tồn tại (named volume của Postgres), không cần tạo lại — chỉ cần export lại 2 biến env trên trước khi chạy test.
