---
phase: 2
title: "Env-Reconcile"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Env-Reconcile

## Overview
Khớp hợp đồng giữa `.env` (user vừa bổ sung) và các biến code THỰC SỰ đọc. Bổ sung biến
thiếu, sửa tên lệch, thêm env-check fail-closed, cập nhật `.env.example`. **Loại SSO khỏi
phạm vi test tạm thời** (giữ ENTRA_*/SSO_ENABLED trong .env nhưng không bắt buộc verify).

## Requirements
- Functional: mọi biến code đọc (trừ SSO) có mặt & đúng tên trong `.env` + `.env.example`.
- Non-functional: env-check chạy lúc boot/CI, fail-closed, KHÔNG in giá trị secret; secrets không commit.

## Architecture — bảng khớp env (đã audit code)
| Nhóm | Code đọc (chính xác) | `.env` hiện có | Hành động |
|---|---|---|---|
| DB | `DATABASE_URL`, `APP_DATABASE_URL` | ✅ cả 2 | giữ |
| Brevo | `BREVO_API_KEY`, `EMAIL_MAX_ATTEMPTS` | BREVO_API_KEY ✅ | thêm `EMAIL_MAX_ATTEMPTS` (mặc định nếu vắng) |
| Graph | `GRAPH_TENANT_ID`,`GRAPH_CLIENT_ID`,`GRAPH_CLIENT_SECRET`,`GRAPH_SENDER_EMAIL` | ENTRA_TENANT_ID, ENTRA_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_SENDER_HR/NOTIFY/PAYROLL | **lệch tên** — quyết định P3 (Graph impl hay tắt); nếu dùng: map ENTRA_*→GRAPH_* hoặc sửa code đọc ENTRA_* + chọn 1 sender |
| S3 | `S3_ENDPOINT`,`S3_BUCKET`,`S3_REGION`,`S3_ACCESS_KEY`,`S3_SECRET_KEY` | ❌ không có | **thêm 5 biến** + bucket private đã tạo |
| LLM | `LLM_API_KEY` (hiện chỉ 1) | ❌ | thêm `LLM_API_KEY`; P3 mở rộng contract `LLM_BASE_URL`,`LLM_MODEL` cho router.clawcmc |
| LMS | `LMS_SESSION_SECRET`, `LMS_TOKEN_TTL_MS` | ❌ | **thêm `LMS_SESSION_SECRET`** (bắt buộc prod, không dùng dev-default) |
| Proxy | `TRUSTED_PROXY_CIDRS` | ❌ | thêm (CIDR reverse-proxy của cmcv2-prod) |
| Storage local | `BLOB_STORAGE_DIR` | ❌ | thêm nếu chạy local-disk fallback (dev), prod dùng S3 |
| SSO (tạm off) | ENTRA_*, SSO_ENABLED, ERP_SSO_REDIRECT_URI, STAFF_EMAIL_DOMAIN | ✅ | giữ, không bắt buộc verify phase này |

## Related Code Files
- Modify: `.env` (local, không commit), `.env.example` (commit, chỉ tên+placeholder).
- Create: `scripts/env-check.sh` (hoặc bổ sung vào boot-checks) — assert biến bắt buộc theo mode.
- Đọc để chốt tên biến: `apps/api/src/worker/email-transport.ts`, `packages/storage/src/*`, `packages/llm/src/index.ts`, `apps/api/src/boot-checks.ts`, `apps/api/src/context.ts`.

## Implementation Steps
1. Chốt quyết định Graph: (a) implement thật ở P3 → cần map/thêm GRAPH_TENANT_ID/GRAPH_CLIENT_ID/GRAPH_SENDER_EMAIL; hoặc (b) chỉ dùng Brevo → chọn Brevo transport, để Graph off. Ghi decision note.
2. Bổ sung `.env` các biến thiếu: `S3_*` (5), `LLM_API_KEY`, `LMS_SESSION_SECRET` (sinh chuỗi ngẫu nhiên mạnh), `TRUSTED_PROXY_CIDRS`, `EMAIL_MAX_ATTEMPTS`, (Graph theo bước 1).
3. Cập nhật `.env.example`: thêm mọi biến trên với placeholder + comment ngắn (KHÔNG giá trị thật).
4. Viết `scripts/env-check.sh`: đọc danh sách biến bắt buộc theo `NODE_ENV`/mode; exit≠0 + liệt kê biến thiếu (chỉ TÊN, không giá trị); loại SSO khỏi tập bắt buộc khi `SSO_ENABLED` vắng/false.
5. Nối env-check vào docker entrypoint / CI pre-boot (fail-closed trước khi API start).
6. Xác nhận `git check-ignore .env` vẫn IGNORED; `.env.example` không chứa secret.

## Success Criteria
- [ ] `.env` + `.env.example` chứa mọi biến code đọc (trừ SSO tạm off), tên khớp chính xác.
- [ ] `env-check` fail-closed: thiếu biến → exit≠0, in tên biến thiếu, KHÔNG in giá trị.
- [ ] Quyết định Graph ghi rõ (impl/off) + phản ánh vào tập biến bắt buộc.
- [ ] `.env` không bị track; `.env.example` không có secret.

## Risk Assessment
- R3/R5: env lệch âm thầm → API boot với dev-default (LMS_SESSION_SECRET) hoặc rơi local-disk (S3). env-check fail-closed chặn.
- Lộ secret: chỉ log TÊN biến; review `.env.example` không dính giá trị thật.
- Graph lệch tên là nguồn lỗi runtime khó thấy (worker throw lúc gửi) → phải chốt ở bước 1, không để mơ hồ.
- Stop-condition: nếu bucket S3 chưa tạo / creds sai → dừng, báo user (không tự tạo hạ tầng ngoài repo).
