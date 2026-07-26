# Phase 4 — Env mặc định, docs, validation toàn cục

## Context

- `.env.prod.example:26-56` — `SSO_ENABLED=true` + khối ENTRA_*/GRAPH_*;
  `:77` `VITE_SSO_ENABLED=true`.
- `docker-compose.prod.yml:129-132`, `infra/docker/Dockerfile.admin:42-45` —
  build-arg VITE_SSO_ENABLED (default false: giữ).
- `docs/system-architecture.md` — mô tả auth staff = Entra SSO; cần ghi trạng
  thái M365 tạm tắt.
- Email: KHÔNG sửa code (Brevo đã 100%); chỉ docs/env phản ánh Graph tạm tắt.

## Requirements

1. `.env.prod.example`: `SSO_ENABLED=false`; `VITE_SSO_ENABLED=false`; chuyển
   toàn khối `ENTRA_*`/`GRAPH_*` thành comment "tạm tắt — bật lại khi có quyền
   M365, xem docs". `.env.example`: cập nhật comment tương ứng.
2. `docs/system-architecture.md` (mục auth + email): ghi (a) staff auth =
   email/password (PBKDF2, lockout, mustChangePassword), (b) Entra SSO tạm tắt
   bằng `SSO_ENABLED`, đường bật lại, (c) email 100% Brevo, GraphEmailTransport
   giữ nguyên ở trạng thái không cấu hình.
3. `docs/runbook-deploy.md`: bước cấp mật khẩu ban đầu (SUPER_ADMIN_PASSWORD ở
   seed; admin đặt cho staff qua trang Users).

## Validation (toàn cục — HARD-GATE-NO-SIDE-EFFECTS)

1. `pnpm typecheck` + `pnpm test` toàn repo (API + admin + packages) xanh.
2. Boot thử API `NODE_ENV=production SSO_ENABLED=false` KHÔNG có biến M365 ⇒
   boot-checks pass (bằng test boot-checks hiện có + chạy thật nếu tiện).
3. e2e suite hiện tại không sửa file nào — chạy smoke `pnpm --filter @cmc/e2e
   test` (project API) xác nhận không regression.
4. GitNexus `detect_changes()` trước commit: chỉ symbol dự kiến thay đổi.
5. Spawn `code-reviewer` subagent (bắt buộc theo workflow) với acceptance
   criteria của plan.md.

## Risk / Rollback

- Docs/env thuần khai báo. Rollback: revert file. Không đụng dữ liệu.
