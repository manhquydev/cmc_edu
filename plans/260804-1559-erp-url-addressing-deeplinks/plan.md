---
title: "ERP URL Addressing Deeplinks"
description: "Hệ thống URL addressing cho ERP admin: returnTo qua login, contract entity→URL dùng chung (@cmc/links), resolver canonical /go, URL-hoá state workspace"
status: in-progress
priority: P1
effort: "4 PR, ~3-4 ngày"
tags: [admin, routing, auth, deeplink]
created: 2026-08-04
---

# ERP URL Addressing Deeplinks

## Overview

Nhân sự gửi case cho nhau chỉ bằng 1 URL: người nhận click → (login nếu cần) → đứng đúng trang/ngữ cảnh. Hiện tại login đánh mất URL đích (`RequireAuth` → `/login` không lưu gì, `login.tsx:46` hardcode `navigate('/')`), và các workspace chính giữ lựa chọn trong `useState` nên không share được.

Phạm vi: **chỉ ERP admin** (`apps/admin`). LMS ngoài phạm vi (quyết định của user).

Nguồn: advice session 2026-08-04 (interview đã chốt 4 quyết định):
1. Độ bền: phủ đều màn hình **và** lớp canonical `/go/` để link phát hành sống sót tái cấu trúc route.
2. Link do cả người dùng copy **và** hệ thống tự sinh (email/thông báo tương lai) → bảng entity→URL là package dùng chung; phase 2 chưa thêm dependency vào `apps/api` (chưa có consumer thật — điểm neo tương lai: `getAdminOrigin` trong `apps/api/src/server.ts`).
3. Thiếu quyền RBAC → trang 403 rõ ràng. **Red-team phát hiện tiền đề "trang đích đã có gate" là SAI** → Phase 2 gắn `PermissionGate` cho 4 route chi tiết.
4. ID trong URL: **UUID sẵn có**; `/go` từ chối mọi id không phải UUID.

Quyết định bổ sung sau red-team (user chốt 2026-08-04): payroll giữ Copy link + `?userId=`, kèm quy tắc nhạy cảm trong docs + `Referrer-Policy: same-origin` ở nginx.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Logout mở URL admin bất kỳ → login → vào đúng URL đó (returnTo chống open-redirect; chuỗi change-password carry ở mức UX client) | P1 |
| 2 | `@cmc/links` + `/go/:entity/:id` an toàn + PermissionGate 4 route chi tiết + student-detail fetch-by-id + Copy link | P1 |
| 3 | Attendance addressable bằng URL (`?classBatchId=&sessionId=`, lọc UUID tại boundary) | P2 |
| 4 | Grading, payroll, session-evidence addressable + Referrer-Policy + docs | P2 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: ReturnTo Login Redirect](./phase-01-start.md) | Completed |
| 2 | [Phase 2: Links Contract And Go Resolver](./phase-02-links-contract-and-go-resolver.md) | Pending |
| 3 | [Phase 3: Attendance Workspace URL State](./phase-03-attendance-workspace-url-state.md) | Pending |
| 4 | [Phase 4: Remaining Workspaces And Docs](./phase-04-remaining-workspaces-and-docs.md) | Pending |

Phase 1 độc lập, ship trước (kèm hạ tầng e2e seed-staff-password mà mọi phase sau dùng). **Phase 2 = 2 PR bắt buộc tuần tự** (2a: PermissionGate + student fetch-by-id; 2b: links + `/go` + Copy link — quyết định validate). Phase 3 phụ thuộc 1+2; Phase 4 phụ thuộc 2+3 (được phép tách nhỏ, có scope-cut rule cho grading). Mỗi PR xanh cả `typecheck-and-test` và `ui-e2e`.

## Success Criteria

- [ ] E2e (`*.ui.spec.ts`, `test.use baseURL http://localhost:4173`): logout → mở `/crm/opportunities/:id` → login form (user seed có mật khẩu thật) → `expect(page.url()).toBe('…4173/crm/opportunities/:id')` — assertion dương
- [ ] E2e: `returnTo=//evil.com` và biến thể độc hại → sau login `expect(page.url()).toBe('…4173/cockpit')`
- [ ] E2e: luồng `mustChangePassword` carry returnTo qua change-password về đúng đích (client UX; enforcement server là follow-up ngoài plan)
- [ ] E2e: `/go/opportunity/:uuid` khi logout → login → đúng trang; entity lạ / id không phải UUID → EmptyState 404
- [ ] E2e **cold navigation** cả 4 entity: goto thẳng URL chi tiết → dữ liệu thật render (student-detail không còn phụ thuộc `location.state`)
- [ ] E2e 403: user thiếu quyền mở link → màn "Không có quyền truy cập" (PermissionGate — Phase 2 gắn mới cho 4 route)
- [ ] E2e: attendance deep-link hydrate; `session-assessment-roster.journey.ui.spec.ts` xanh (lưới regression UI thật)
- [ ] Unit: `safeReturnTo`/`shouldCaptureReturnTo` ≥8 case; `resolveGo` chặn prototype-key + non-UUID
- [ ] 4 entity detail + ≥4 workspace addressable bằng URL (workspace refactor có builder trong `@cmc/links`; schedule đã addressable sẵn — được tính khi grading bị cắt theo Scope-Cut Rule); 7 call-site hardcode đã thay builder
- [ ] `Referrer-Policy: same-origin` trên cả 2 nginx config
- [ ] `docs/system-architecture.md` mục URL addressing khớp code

## Non-goals

- LMS (`apps/lms`) — quyết định user; trade-off đã ghi trong advice.
- Enforcement server-side cho `mustChangePassword` (expose cờ trên `session.me` + guard) — follow-up riêng, hiện là client-hint từ trước plan này.
- Short-link service / bảng link DB / analytics link.
- Mã nghiệp vụ ngắn trong URL (OPP-123).
- Luồng "xin quyền truy cập" khi 403.
- SSO Entra returnTo (SSO tắt; ghi chú kỹ thuật ở Phase 1).
- Dependency `@cmc/links` trong `apps/api` (chưa có consumer server thật).

## Red Team Review

### Session — 2026-08-04
**Findings:** 13 sau dedupe từ 3 reviewer (Security Adversary, Assumption Destroyer, Failure Mode Analyst) — 13 accepted (2 dạng modified), 0 rejected. Tất cả có bằng chứng file:line.
**Severity breakdown:** 2 Critical, 6 High, 5 Medium.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | 4 route đích không có PermissionGate; tiêu chí 403 mồ côi | Critical | Accept | Phase 2 |
| 2 | student-detail render từ location.state, không fetch theo id | Critical | Accept | Phase 2 |
| 3 | Hạ tầng e2e login-form + seed staff password không tồn tại; contract mustChangePassword đảo giả định | High | Accept | Phase 1 |
| 4 | resolveGo dùng `in` → prototype-chain (`/go/toString/x`) | High | Accept | Phase 2 |
| 5 | `/go` là redirect sink chưa validate id (traversal, route tĩnh anh em) | High | Accept | Phase 2 |
| 6 | mustChangePassword là client-hint, plan hứa gate không tồn tại | High | Accept (modified: ghi giới hạn, enforcement = follow-up) | Phase 1, Non-goals |
| 7 | baseURL ui-chromium mặc định LMS :4174 | High | Accept | Phase 1-4 specs |
| 8 | Lưới regression Phase 3 nêu 3 spec API (không đụng UI) | High | Accept | Phase 3 |
| 9 | Sai path student-detail/class-detail (`pages/admin/` → `pages/students|classes/`) | Medium | Accept | Phase 2 |
| 10 | Id rác → BAD_REQUEST banner thô, không phải empty-state | Medium | Accept | Phase 3, 4 |
| 11 | routes/index.tsx cấm thêm route trực tiếp → module go.routes.tsx | Medium | Accept | Phase 2 |
| 12 | navigator.clipboard undefined trên HTTP LAN | Medium | Accept | Phase 2 |
| 13 | Payroll ?userId nhạy cảm + selectedUser là {id,name} cần pickList lookup | Medium | Accept (modified: user giữ Copy link + docs rule + Referrer-Policy) | Phase 4 |

Ghi chú giữ nguyên hướng: reviewer chất vấn YAGNI package `@cmc/links` (API chưa consume) — giữ theo quyết định interview của user; điều kiện kích hoạt consumer đầu ghi ở Overview #2.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01-start.md, phase-02-links-contract-and-go-resolver.md, phase-03-attendance-workspace-url-state.md, phase-04-remaining-workspaces-and-docs.md
- Decision deltas checked: 13
- Reconciled stale references: 1 (`UUID_RE` phải export từ `@cmc/links` — Phase 3/4 import; sketch Phase 2 đã sửa)
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-08-04
Verification pass: skip theo guard (Red Team Review đã chứa 82 claim verified bởi 3 reviewer; không còn tag `[UNVERIFIED]`). Câu hỏi: 3 (cấu hình 3-8; chỉ hỏi decision-point thật).

| # | Câu hỏi | Quyết định | Áp vào |
|---|---------|-----------|--------|
| 1 | Phase 2: 1 PR lớn hay tách? | **Tách 2 PR tuần tự** — 2a (PermissionGate + student fetch-by-id), 2b (@cmc/links + /go + Copy link) | Phase 2, Phases note |
| 2 | Gap `mustChangePassword` client-hint | **Tạo GitHub issue** khi cook Phase 1 (enforce server-side là follow-up có hồ sơ) | Phase 1 step 8 |
| 3 | Grading phức tạp hơn dự kiến? | **Cho phép cắt** grading khỏi Phase 4, ship payroll + session-evidence; grading thành follow-up | Phase 4 Scope-Cut Rule |

### Whole-Plan Consistency Sweep (Session 1)
- Files reread: plan.md + 4 phase files (sau propagation)
- Decision deltas checked: 3
- Reconciled stale references: 2 (success criteria Phase 2 tách theo PR 2a/2b, bỏ trùng lặp tiêu chí 403/cold-nav giữa 2 nhóm; Phases note đồng bộ "mỗi phase = 1 PR" → "Phase 2 = 2 PR")
- Unresolved contradictions: 0

<!-- slug: erp-url-addressing-deeplinks -->
