---
phase: 5
title: "UAT-GoNoGo"
status: pending
priority: P1
dependencies: [2, 3]
---

# Phase 5: UAT-GoNoGo

## Overview
Dựng stack prod cô lập `cmcv2-prod`, chạy restore-drill, e2e critical 2 lần xanh liên tiếp,
UAT người-thật theo docs/29, ký biên bản go/no-go. Đây là cổng cuối trước vận hành thật.

## Requirements
- Functional: stack cmcv2-prod healthy; restore-drill exit 0 (host backup ≠ host deploy); e2e critical 2/2 xanh; các flow UAT trong `docs/uat-checklist-go-live.md` tick đủ.
- Non-functional: chạy trên DB staging/prod-config (KHÔNG chạy e2e phá dữ liệu prod thật); secrets qua env; SSO tạm off (verify tay hoặc hoãn tới khi bật).

## Architecture
Dùng artifact đã có trên stack: `docker-compose.prod.yml`, `infra/docker/Dockerfile.*`,
`infra/nginx/*`, `scripts/backup-db.sh`, `scripts/restore-drill.sh`, `scripts/isolation-check.sh`,
`docs/runbook-deploy.md`, `docs/uat-checklist-go-live.md`. Mode B session-injection
(`apps/e2e/src/session-injection.ts`) cho e2e không cần dev-header.

## Related Code Files
- Modify: `docs/uat-checklist-go-live.md` (điền Run 1/Run 2, tick flow, biên bản go/no-go).
- Không sửa code nguồn (trừ khi UAT lộ bug → fix-forward theo protocol).
- Đọc: runbook-deploy.md, docker-compose.prod.yml (env phải khớp P2).

## Implementation Steps
1. Dựng `cmcv2-prod` theo runbook: `docker compose -p cmcv2-prod up`; env đầy đủ (P2); `isolation-check.sh` xác nhận cô lập khỏi `cmcnew-prod-*`.
2. `restore-drill.sh` → exit 0; xác nhận host backup ≠ host deploy (RT-13).
3. e2e critical Mode B trên stack prod-config: `pnpm --filter @cmc/e2e test` (TEST_OTP_SEAM nếu cần) — **2 lần liên tiếp xanh**; ghi Run 1/Run 2 vào checklist.
4. UAT người-thật theo docs/29 + checklist: receipt create→approve (over-threshold role-elevation), attendance+lifecycle, exercise PDF qua S3 thật + grade, star/gift, check-in IP (trusted-proxy), AI draft (LLM thật) + edit + confirm, PII-guard reject.
5. **[RT-CRITICAL] Cổng SSO cho staff:** trong production `x-dev-user` bị tắt (DEV_AUTH_ENABLED=false) và Entra SSO chưa implement → staff KHÔNG đăng nhập được, mọi `protectedProcedure` từ chối. Do đó:
   - Nếu go-live scope = **staff ERP** → SSO PHẢI xong trước (track SSO thêm ở P3); UAT staff chỉ chạy khi SSO hoạt động. Thiếu SSO ⇒ **NO-GO phía staff**.
   - Nếu go-live scope = **LMS-first** → P5 thu hẹp về LMS parent/student (bearer token, chạy được); staff ERP hoãn tới đợt SSO. Ghi rõ trong biên bản.
6. Ký biên bản go/no-go trong checklist (GO nếu mọi mục pass trong scope đã chốt; NO-GO + lý do nếu không). Ghi known-gaps (SSO nếu LMS-first, Graph nếu Brevo-only).

## Success Criteria
- [ ] `cmcv2-prod` healthy; `isolation-check.sh` pass (cô lập khỏi stack cũ).
- [ ] `restore-drill.sh` exit 0; backup off-box (host khác).
- [ ] e2e critical 2 lần liên tiếp xanh; Run 1/Run 2 điền vào checklist.
- [ ] Mọi flow UAT critical tick pass (receipt/attendance/exercise-S3/star/IP/AI-draft/PII).
- [ ] Biên bản go/no-go ký; known-gaps (SSO) ghi rõ.

## Risk Assessment
- R3: đây là nơi chứng minh "done thật" — nếu integration P3 chưa xong, UAT sẽ phơi ra.
- Chạy e2e nhầm DB prod thật → mất dữ liệu: BẮT BUỘC trỏ APP_DATABASE_URL/DATABASE_URL vào staging/prod-config, KHÔNG prod live (stop-condition).
- SSO (RT-CRITICAL): production KHÔNG có staff-login nào ngoài SSO (x-dev-user tắt ở prod). Không có "đường thay thế" — hoặc SSO xong, hoặc go-live LMS-first. Đây là quyết định sản phẩm (open question #1), không phải tuỳ chọn kỹ thuật.
- Flake e2e: rerun 1 lần; tái diễn → sửa isolation, không nới test.
- Thao tác phá huỷ ngoài repo (deploy VPS): cần user xác nhận trước.
