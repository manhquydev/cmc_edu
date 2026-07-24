---
phase: 3
title: "ops-smoke.sh — vận hành thật thành lệnh"
status: done
priority: P1
dependencies: []
---

# Phase 3: ops-smoke.sh — vận hành thật thành lệnh

> **Viết lại 2026-07-23 sau red-team (C4, H3, M3).** Bản đầu (a) xin `Mail.Read`
> để tự đọc hộp thư — trên app dùng chung đó là **quyền đọc mọi hộp thư trong
> tenant** bằng chính secret worker giữ (C4); (b) đề xuất insert thẳng EmailOutbox
> bằng psql, bỏ qua RLS + validation, guard sink vô hiệu khi `STAFF_EMAIL_DOMAIN`
> rỗng — cấu hình prod hợp lệ (H3); (c) nói sai "worker không boot-check" (nó có
> đủ; chỉ thiếu `assertRequiredEnvForProd`) và bỏ qua health endpoint sẵn có (M3).

## Overview

"Tình trạng vận hành thật" hiện là văn xuôi runbook + niềm tin. Phase này viết
`scripts/ops-smoke.sh`: chạy trên host sau deploy, <5 phút, PASS/FAIL rõ từng
mục, để runbook §3.0/§8d trỏ vào lệnh. **Không tự đọc hộp thư** — bằng chứng
email là hai thứ: outbox chuyển `sent` (máy) + ảnh hộp thư nhận (người, Q1/§9).

## Requirements

**Functional** — mỗi mục in PASS/FAIL/SKIP + lý do:
1. `api` healthy (health endpoint) **và** `worker` healthy — đọc **health endpoint sẵn có của worker** (`http://localhost:3001/`, `worker/index.ts:52`) hoặc trạng thái `Health` của compose healthcheck (`docker-compose.prod.yml`), KHÔNG grep log marker (marker chỉ in một lần lúc boot, và ConsoleTransport marker không in ở prod — M3)
2. Log api + worker không có `FATAL` **trong cửa sổ boot gần nhất** — neo theo container start time (`docker inspect -f '{{.State.StartedAt}}'`), không phải toàn bộ log (tránh bẫy "FATAL lịch sử" kiểu restore-drill `sort|tail`)
3. SSO: GET route login staff trả redirect về `login.microsoftonline.com` (không đăng nhập)
4. Brevo `GET /v3/account` = 200 **từ chính host** (phân nhánh 401-key vs 401-allowlist theo nội dung — kế thừa Phase 3 đợt B)
5. **Email qua worker, khẳng định bằng trạng thái outbox — KHÔNG đọc hộp thư:** enqueue một email test tới sink cố định, poll bảng `EmailOutbox` tới khi row chuyển `sent` (worker `relay-email-outbox` cập nhật trạng thái) hoặc timeout. Bằng chứng "đến hộp thư" là **bước người** ở §9 (ảnh), không phải mục này.
6. Đếm row bảng §6 bằng role `postgres` qua `docker exec` (RLS không che — đúng thiết kế, journal bài học #4)

**Non-functional**
- Không in secret; chỉ tên biến, mã HTTP, số đếm. Cấm `set -x`.
- `--local` chạy trên stack dev/compose local (mục 4 tự SKIP; mục 5 dùng ConsoleTransport nên xác nhận enqueue+drain, không gửi thật).
- `shellcheck` sạch. Exit 0 = mọi mục PASS/SKIP-có-cờ.

## Architecture

Bash thuần, họ `env-check.sh`/`backup-db.sh`. Mỗi mục một hàm `check_<tên>`.

**Mục 5 — enqueue KHÔNG bằng psql thô (H3).** Không có procedure enqueue tổng
quát (chỉ `finance/router.ts:1106` và `lms-auth/router.ts:418` tạo outbox). Payload
outbox có kind discrimination mà `renderOutboxEmail` đọc (`email-transport.ts:59`);
literal JSON viết tay trong bash sẽ vỡ câm khi template đổi. Cách đúng: một
`tsx -e` nhỏ **import type/builder template sẵn có** để dựng payload đúng shape,
rồi ghi qua Prisma (chịu validation), sink là hằng số fail-closed. Chọn cách ghi
lúc viết; cấm literal JSON tay và cấm psql insert.

**Sink fail-closed:** địa chỉ sink là hằng số trong script; guard **từ chối chạy**
nếu sink không khớp một allowlist tường minh — KHÔNG dựa `STAFF_EMAIL_DOMAIN`
(có thể rỗng ở prod, C4/H3).

## Related Code Files

- Create: `scripts/ops-smoke.sh` (+ `scripts/ops-smoke-enqueue.ts` nếu cần builder payload qua tsx)
- Modify: `docs/runbook-uat-golive.md` — §3.0 và §8d trỏ vào script (một dòng mỗi chỗ)
- Đọc trước: `apps/api/src/worker/index.ts:45-66` (health endpoint), `:135-140` (boot checks — worker CÓ, chỉ thiếu `assertRequiredEnvForProd`), `apps/api/src/worker/relay-email-outbox.ts` (trạng thái sent), `apps/api/src/worker/email-transport.ts:59` (renderOutboxEmail kind), `docker-compose.prod.yml` (healthcheck, service names), `packages/db/prisma/schema.prisma` (EmailOutbox)
- Không sửa: worker, boot-checks, compose

## Implementation Steps

1. Đọc worker health + relay + compose healthcheck; chốt: cổng health, tên service, cột trạng thái EmailOutbox, builder payload sẵn có.
2. Viết khung + 6 hàm; `--local` qua cờ; mục 4 SKIP local.
3. Mục 5: viết `ops-smoke-enqueue.ts` dựng payload từ template types, ghi Prisma, sink hằng số fail-closed; script poll trạng thái `sent`.
4. `--local`: mục 1–3,5,6 PASS thật (5 qua ConsoleTransport), mục 4 SKIP.
5. `shellcheck` sạch; chạy thật đọc output xác nhận 0 secret.
6. Runbook §3.0 (bằng chứng bước 0 = output script), §8d (script thay lệnh curl rời).
7. Header script: yêu cầu host (SSH + `.env.prod` + Brevo allowlist), và rằng **không cần `Mail.Read`**; ảnh hộp thư là bước người §9.

## Success Criteria

- [x] `--local`: mục 1–3,5,6 PASS (mục 5 qua ConsoleTransport, outbox → sent), mục 4 SKIP, exit 0
- [x] **Không** xin `Mail.Read`; không psql insert; enqueue qua builder có validation
- [x] Sink fail-closed bằng allowlist hằng số, KHÔNG dựa `STAFF_EMAIL_DOMAIN`
- [x] Mục 1 đọc health endpoint/compose healthcheck; mục 2 neo cửa sổ boot
- [x] shellcheck sạch; 0 secret in ra
- [x] Runbook §3.0/§8d trỏ script, đọc một mạch không mâu thuẫn

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Payload outbox sai shape ⇒ worker dead-letter, mục 5 fail giả | TB | Dựng payload từ template types (tsx import), không literal tay |
| Mục 5 gửi trúng người thật | Cao nếu xảy ra | Sink hằng số + guard allowlist fail-closed, KHÔNG `STAFF_EMAIL_DOMAIN` |
| Bẫy "FATAL lịch sử" trong log | TB | Neo theo `StartedAt`, không quét toàn log |
| In secret khi debug | Cao nếu xảy ra | `-o /dev/null -w '%{http_code}'`; cấm `set -x` |
| OTP-kind payload bị scrub sweep giữa chừng | Thấp | Dùng kind không phải OTP cho email test (receipt/fallback) |
