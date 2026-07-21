---
phase: 4
title: "ENV — Stack prod Docker Compose cô lập + backup"
status: pending
priority: P1
dependencies: [2, 3]
effort: "3-4 ngày"
---

# Phase 4: ENV — Stack prod Docker Compose cô lập + backup

## Overview
Dựng stack Docker Compose production MỚI, cô lập hoàn toàn khỏi `cmcnew-prod-*` (quyết định user 2026-07-07): project name, network, volume, port đều riêng. Kèm backup off-box + test restore, seed production, runbook.

## Requirements
- Functional: stack gồm nginx (TLS + rate-limit + **strip `x-dev-user`/`x-dev-lms-user`** — RT-2) · api · admin · lms · worker (container riêng) · postgres (`cmc_app` non-privileged) · MinIO (nếu self-host) — tất cả healthy; backup DB tự động **lên máy/provider KHÁC** (RT-13); restore đã test thành công; seed facility đầu + super_admin bootstrap.
- Non-functional: KHÔNG đụng bất kỳ resource nào của `cmcnew-*`; secrets qua env file ngoài repo; runbook trong `docs/`. **`ALLOW_DEV_AUTH` KHÔNG set trong env prod; `NODE_ENV=production` (RT-2).**

> **[RT-2 entry gate]** Env file prod KHÔNG chứa `ALLOW_DEV_AUTH=1`; boot-check (từ PD-1) refuse start nếu có. nginx config strip header `x-dev-*` trước khi forward. Staging (nếu cần dev-auth cho e2e) là deployment RIÊNG với env riêng, KHÔNG phải image prod.
> **[RT-13 entry gate]** Backup phải nằm trên **hardware/provider khác** stack (external S3, hoặc máy thứ 2) — MinIO self-host CÙNG compose KHÔNG tính là off-box. Restore drill assert `backup endpoint host ≠ deploy host`.
> **[V1 — port RESOLVED] VPS RIÊNG cho cmcv2** (khác máy `cmcnew-*`). Vì máy riêng nên `443/80` sạch — nginx dùng chuẩn 443/80, không phải né dải cmcnew. Backup đẩy sang máy/provider khác (dễ vì đã tách máy). VPS cụ thể (IP/domain/TLS) là unresolved còn lại, chốt khi có địa chỉ.

## Architecture
- Compose project `cmcv2-prod` trên **VPS riêng** (V1) — network `cmcv2-prod-net`, volumes prefix `cmcv2-prod-*`, nginx public 443/80 chuẩn (máy riêng nên không đụng cmcnew-*). Isolation check vẫn chạy để chắc chắn.
- Migrations: Prisma migrate deploy (hand-written migrations) chạy như bước init có kiểm soát.
- Backup: `pg_dump` schedule (cron container/host) → đẩy lên đích off-box KHÁC hardware (RT-13); giữ N bản; restore drill vào DB tạm + smoke query.
- Seed: script seed facility đầu tiên có kiểm soát; super_admin bootstrap (đã có bypass registry).

## Related Code Files
- Create: `docker-compose.prod.yml` (+ `.env.prod.example` — KHÔNG chứa giá trị thật), `scripts/backup-db.sh`, `scripts/restore-drill.sh`, Dockerfile cho api/admin/lms/worker nếu chưa có
- Create: `docs/runbook-deploy.md` (deploy, rollback, backup/restore, healthcheck, sự cố thường gặp)
- Modify: `docs/system-architecture.md` (topology prod)

## Tests first (TDD — ở mức hạ tầng = verify script + drill)
1. **Restore drill bắt buộc (RT-13):** backup → restore vào DB tạm → smoke query (đếm bảng, 1 query RLS qua `cmc_app`); **assert backup endpoint host ≠ deploy host**; script hoá, lặp lại được, PASS trước khi nhận dữ liệu thật.
2. **Boot-checks làm gate (RT-9):** CẢ api VÀ worker container start phải pass toàn bộ boot-checks (RLS/cmc_app/env/`ALLOW_DEV_AUTH`-unset từ PD-1/PD-2) — start fail = deploy fail.
3. **Isolation check script:** assert không container/network/volume/port nào của stack mới trùng `cmcnew-*`.
4. **Header-strip probe (RT-2):** gửi `x-dev-user: {...super_admin...}` qua nginx public → phải bị strip, request ẩn danh/401. KHÔNG dùng dev-header để "login" trên stack prod.
5. **e2e smoke** (xem RT-3 Phase 5): chạy trên staging deployment RIÊNG hoặc local prod-config, KHÔNG bật dev-auth trên stack prod.

## Implementation Steps
1. Branch `feat/env-prod-stack`; harness story per mục (compose, backup, seed, runbook).
2. Viết Dockerfile + compose; lên stack ở chế độ staging trên máy đích; boot-checks pass.
3. Backup script + lịch; chạy restore drill tới khi PASS.
4. Seed production có kiểm soát (facility đầu, super_admin) — CHỈ chạy sau restore drill pass.
5. Runbook + cập nhật docs kiến trúc; reviewer 1 vòng → PR → merge → changelog.

## Success Criteria
- [ ] `docker compose -p cmcv2-prod ps` — tất cả service healthy; isolation check (name/network/volume/port) pass
- [ ] Boot-checks pass trong CẢ api + worker container (cmc_app + RLS + env + ALLOW_DEV_AUTH unset) (RT-9/RT-2)
- [ ] nginx strip `x-dev-*`; header-strip probe → 401 (RT-2)
- [ ] Restore drill PASS ≥1 lần, backup host ≠ deploy host (RT-13), script lặp lại được
- [ ] Seed facility đầu + super_admin login được (qua Entra, không dev-header)
- [ ] `docs/runbook-deploy.md` tồn tại (gồm mục xử lý row outbox kẹt `sending` — RT-8), người khác làm theo được

## Risk Assessment
- Port/VPS: giải quyết ở entry gate RT-13, không giữa phase (unresolved: VPS cụ thể).
- Backup chưa test hoặc on-box = không có backup thật → restore drill + assert host khác là gate cứng trước UAT (RT-13).
- Migration lần đầu trên prod → chạy trên DB rỗng (stack cũ không dùng chung), rủi ro thấp.
