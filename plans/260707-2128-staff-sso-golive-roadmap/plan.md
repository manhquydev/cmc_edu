---
title: "Staff SSO go-live: role substrate, Entra SSO, prod env, UAT"
description: "Đóng blocker RT-CRITICAL (staff không login được ở production): enum Role + AppUser.roles, Entra SSO msal-node + signed cookie, dựng cmcv2-prod, UAT go/no-go. Quyết định Q1-Q3 đã chốt 2026-07-07."
status: completed
priority: P1
branch: "main"
tags: [sso, entra, rbac, staff-auth, go-live, uat]
blockedBy: []
blocks: []
supersedes-partial: "project:260707-1830-golive-coordination-land-stack (phần P3-SSO + P5-UAT chuyển sang plan này)"
created: "2026-07-07T14:35:02.915Z"
createdBy: "ck:plan"
source: skill
sourceReport: "plans/260707-1830-golive-coordination-land-stack/reports/brainstorm-260707-2128-staff-sso-roadmap-three-questions-report.md"
---

# Staff SSO go-live: role substrate, Entra SSO, prod env, UAT

## Overview

Kế thừa plan `260707-1830` (P1 land-stack, P2 env, P3 LLM/email/RT-3 ĐÃ XONG — PR #16–#23).
Hạng mục còn lại để go-live: **Entra SSO** (blocker RT-CRITICAL: production tắt dev-header, staff
không có đường đăng nhập) + môi trường prod + UAT.

**Quyết định đã chốt (user 2026-07-07, xem sourceReport):**
- Q1: `enum Role` (9 giá trị, đúng docs/14) trong Prisma + `AppUser.roles Role[]`; super_admin gán qua admin UI; multi-role.
- Q2: staff-session = **HttpOnly signed cookie** (HMAC, tái dùng kỹ thuật ký LMS token); context.ts đọc cookie; dev-header giữ non-prod.
- Q3: Entra creds đã có trong `.env`; verify live trong S2.
- Email cả-hai (Brevo+Graph) đã implement; LLM live-verified; S3 code sẵn chờ creds.

**Bất biến:** RLS `withFacility`+`cmc_app` · `can()` registry 9-role (KHÔNG thêm role — ADR-D) ·
zod + 5 mã lỗi · không commit secrets · timestamptz/ICT · dev-header chỉ non-prod.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Role-Substrate](./phase-01-role-substrate.md) | Completed |
| 2 | [Entra-SSO](./phase-02-entra-sso.md) | Completed |
| 3 | [Env-Prod](./phase-03-env-prod.md) | Completed |
| 4 | [UAT-GoNoGo](./phase-04-uat-gonogo.md) | Completed |

Phụ thuộc: S1→S2 (SSO cần role+email trên AppUser). S3 song song S1/S2. S4 sau S2+S3.

## Dependencies
- Kế thừa `project:260707-1830-golive-coordination-land-stack` — phase P3-SSO và P5-UAT của plan đó chuyển vào đây (plan đó ghi chú trỏ sang).
- Ngoài repo: Azure app registration (redirect URI khớp `ERP_SSO_REDIRECT_URI`); S3 creds hoặc chốt local-disk (S3); VPS + lịch UAT người-thật (S4).

## Acceptance (toàn plan)
- Staff login production qua Microsoft Entra → cookie ký → `session.me` trả roles thật từ DB; dev-header vẫn hoạt động non-prod; e2e cũ xanh.
- Role gán được qua admin UI bởi super_admin; docs/14 sync (enum đã vào schema).
- cmcv2-prod healthy + isolation-check + restore-drill pass; env-check prod pass.
- UAT: e2e critical 2 lần xanh liên tiếp + email live send + biên bản go/no-go ký.

## Execution protocol (kế thừa)
Branch `feat/<phase>` từ main · gates xanh (typecheck/test/build) trước PR · adversarial review cho S1/S2 (auth) · merge → xoá branch → changelog · cap review-fix 2 vòng · stop-conditions: creds sai, migration mất dữ liệu, thao tác phá huỷ ngoài repo.

## Red-team findings (inline 2026-07-07, verify bằng code)

- **RT-α (CONFIRMED) — Cookie làm gãy facility-switching của super_admin.** Hiện `ctx.facilityId`
  đến từ `x-dev-user` header (FE đổi facility = đổi header). Cookie snapshot `AppUser.facilityId`
  cố định → super_admin không switch được cơ sở. **Fix (áp S2):** cho phép request header
  `x-facility-id` override — server validate: non-super_admin PHẢI khớp `AppUser.facilityId`
  (mismatch → FORBIDDEN); super_admin được set facility bất kỳ tồn tại. RLS/`scoped()` giữ nguyên.
- **RT-β (CONFIRMED) — e2e staff flows chết trên stack prod-config.** UAT chạy production-config →
  `x-dev-user` tắt → mọi `createStaffClient` (receipt/attendance e2e) 401. **Fix (áp S2+S4):**
  **staff Mode-B session-injection** — e2e mint cookie ký bằng `STAFF_SESSION_SECRET` (đồng bộ
  stack), mirror đúng cơ chế LMS mode-B sẵn có. S2 export util mint; S4 e2e dùng nó.
- **RT-γ (verified) — `user.manage` roster rỗng `[]`** trong registry → chỉ super_admin (bypass)
  có quyền. Đúng ý định gán role; S1 dùng gate này, không thêm role vào roster.
- **RT-δ — Tên `Role` va chạm import** giữa Prisma client (`@cmc/db`) và `@cmc/auth` (TS type Role)
  ở file import cả hai → alias khi import (`Role as DbRole`); drift-assertion test bắt lệch giá trị.
- **RT-ε — Roles trong cookie là snapshot lúc login** — đổi role/deactivate có hiệu lực ở login sau
  (maxAge ~8h). Chấp nhận (stateless); ghi rõ trong S2; không xây revocation store (YAGNI).

## Validation (critical questions — inline)
1. Azure Portal (redirect URI, quyền app) do user thao tác — stop-condition nếu chưa cấu hình.
2. Multi-facility staff: v2 mỗi AppUser 1 facility (schema); super_admin cross-facility qua RT-α override — đủ, không cần UserFacility bảng mới (YAGNI, docs/10 để dành).
3. e2e prod-config staff auth: giải bằng RT-β (staff mode-B) — không nới NODE_ENV.
4. Graph live send cần mailbox sender licensed — external; S4 stop-condition nếu thiếu.

## Whole-plan consistency
- `session.me` "roles thật từ DB" = roles snapshot từ DB tại thời điểm login (RT-ε) — wording phase 02 đã chỉnh khớp.
- Plan 260707-1830: P3-SSO + P5-UAT chuyển sang plan này (frontmatter supersedes-partial); không chạy song song.
