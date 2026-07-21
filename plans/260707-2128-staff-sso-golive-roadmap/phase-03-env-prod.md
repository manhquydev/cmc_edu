---
phase: 3
title: "Env-Prod"
status: superseded
priority: P1
dependencies: []
---

> **SUPERSEDED 2026-07-08**: Execution chuyển sang plan `260707-2308-golive-sprint-land-sso-env-uat` phase-02. Phase này không chạy thực.

# Phase 3: Env-Prod

## Overview
Dựng stack production cô lập `cmcv2-prod` từ artifact đã land (docker-compose.prod.yml,
Dockerfile.*, nginx, backup/restore scripts, runbook) — task #8. Chạy được song song S1/S2.

## Requirements
- Functional: `docker compose -p cmcv2-prod up` healthy toàn bộ service (api, worker, admin, lms, nginx, postgres); `scripts/isolation-check.sh` pass (cô lập khỏi `cmcnew-prod-*`); backup off-box chạy; `scripts/restore-drill.sh` exit 0 (RT-13, host backup ≠ host deploy).
- Non-functional: env đầy đủ theo contract (env-check + assertRequiredEnvForProd pass với NODE_ENV=production); secrets qua env, không vào image/git; storage = S3 thật nếu có creds, ngược lại local-disk volume (chốt trước khi UAT).

## Architecture
Toàn bộ artifact có sẵn trên main (landed từ stack #16): `docker-compose.prod.yml`,
`infra/docker/Dockerfile.{api,worker,admin,lms}`, `infra/nginx/*`, `scripts/backup-db.sh`,
`scripts/restore-drill.sh`, `scripts/isolation-check.sh`, `docs/runbook-deploy.md`. Phase này chủ
yếu VẬN HÀNH theo runbook + vá những gì lộ ra khi chạy thật (image build lỗi, env thiếu, v.v.).

## Related Code Files
- Đọc/thực thi: `docs/runbook-deploy.md` (theo từng bước), compose + Dockerfiles + scripts trên.
- Modify (chỉ khi chạy thật lộ lỗi): compose/Dockerfile/env-check — fix-forward từng lỗi, PR riêng.
- `.env` production (trên VPS, không commit): sinh từ `.env.example`, secrets riêng môi trường (LMS_SESSION_SECRET/STAFF_SESSION_SECRET mới, KHÔNG dùng lại dev).

## Implementation Steps
1. Chốt storage: S3 creds thật (user cấp) HOẶC local-disk volume cho đợt UAT — ghi decision.
2. Chuẩn bị env prod từ `.env.example`; chạy `scripts/env-check.sh` (NODE_ENV=production) pass trước khi up.
3. Build images + `docker compose -p cmcv2-prod up -d` theo runbook; xử lý fix-forward lỗi build/boot nếu có (mỗi fix 1 PR).
4. `isolation-check.sh` pass; healthchecks xanh; boot-checks API pass (cmc_app role, FORCE-RLS, env).
5. Seed tối thiểu: facility + super_admin AppUser (email thật để SSO S2 login được).
6. Backup: chạy `backup-db.sh` → off-box; `restore-drill.sh` exit 0 trên host khác.
7. Ghi kết quả từng mục vào `docs/uat-checklist-go-live.md` phần Prerequisites.

## Success Criteria
- [ ] Stack healthy; isolation-check pass; boot-checks pass với NODE_ENV=production.
- [ ] env-check prod pass; không secret nào trong git/image.
- [ ] Backup off-box + restore-drill exit 0 (host khác).
- [ ] Seed super_admin thật sẵn sàng cho SSO login (S2/S4).

## Risk Assessment
- Thao tác VPS = ngoài repo → mỗi bước phá huỷ tiềm tàng (xoá volume, ghi đè stack cũ) cần user xác nhận; isolation-check trước mọi thao tác.
- Secrets prod phải sinh mới (không tái dùng dev) — restore-drill dùng backup thật nhưng DB đích riêng.
- Stop-conditions: VPS chưa sẵn sàng; S3 creds sai; port/domain conflict với stack cũ.
