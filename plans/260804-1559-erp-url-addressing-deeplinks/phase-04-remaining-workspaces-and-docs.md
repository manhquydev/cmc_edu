---
phase: 4
title: "Remaining Workspaces And Docs"
status: pending
priority: P2
effort: "8h"
dependencies: [2, 3]
---

# Phase 4: Remaining Workspaces And Docs

## Overview

Lặp pattern Phase 3 cho grading, payroll, session-evidence; thêm Referrer-Policy; ghi quy ước URL addressing vào docs. Tách nhỏ nhiều PR nếu diff lớn (cho phép).

## Requirements

- Functional: mỗi workspace addressable bằng URL với param định danh "tôi đang nhìn cái gì"; param không phải UUID → coi như chưa chọn (quy tắc Phase 3); draft/form state ở lại `useState`.
- Non-functional: không đổi hành vi nghiệp vụ; spec UI liên quan giữ xanh; URL chứa danh tính nhân sự không rò qua Referer.

## Architecture

Cùng pattern `useSearchParams` + lọc UUID + `CopyLinkButton` current-URL. Chi tiết từng trang (semantics đã xác minh một phần, xác nhận nốt khi cook bằng cách đọc component trước):

| Trang | File | Params | Lưu ý đã kiểm chứng |
|-------|------|--------|---------------------|
| Grading | `apps/admin/src/pages/teaching/grading.tsx` | `?selectedId=` → đặt tên theo entity thật của `selectedId` (dòng 259) — đọc component xác nhận trước khi đặt tên param | — |
| Payroll | `apps/admin/src/pages/hr/payroll.tsx` | bổ sung `?userId=`; giữ `period` hiện có | **Không phải id swap đơn thuần**: `selectedUser` là `{id, name}` (`:412-415`), `name` render breadcrumb (`:446`) + `employeeName` prop (`:464`). Hydrate = tra `userId` trong `user.pickList` sau khi load; định nghĩa rõ loading state và not-found (userId không còn trong pickList → coi như unset, không breadcrumb `undefined`). Merge param qua `new URLSearchParams(searchParams)` như chính file này đã làm `:428-433` — không clobber `period`. |
| Session evidence | `apps/admin/src/pages/teaching/session-evidence.tsx` | `?classBatchId=&sessionId=` (dòng 16-17) | Giống hệt attendance |

**Referrer-Policy** (quyết định user 2026-08-04: giữ Copy link + `?userId=` ở payroll, kèm rào chắn): thêm `add_header Referrer-Policy same-origin always;` vào cả hai config nginx cạnh các header bảo mật hiện có — `infra/nginx/nginx.conf:61-63` và `infra/nginx/nginx.local-sim.conf:72-73`.

**Docs — mục "URL addressing & deep links" trong `docs/system-architecture.md`** (≤40 dòng, trỏ `@cmc/links` làm nguồn máy-đọc):
- "State đáng share nằm trong URL": param = "tôi đang nhìn cái gì"; draft/modal/upload state không vào URL.
- Entity detail → route `:id` + builder + canonical `/go/` (id bắt buộc UUID); workspace → query params + builder, không qua `/go/`.
- returnTo: mọi guard mới dùng `safeReturnTo`/`shouldCaptureReturnTo` từ `safe-return-to.ts`, không tự chế.
- Param không phải UUID → treat as unset (không bao giờ đẩy id rác vào query API).
- **Quy tắc nhạy cảm**: URL chứa danh tính người (HR/finance) được phép để deep-link hoạt động, nhưng: Referrer-Policy same-origin là bắt buộc ở serving layer; cân nhắc trước khi thêm Copy link ở màn mới thuộc nhóm này; API/proxy log sẽ chứa các URL đó — không đưa thêm dữ liệu nhạy cảm hơn UUID vào param.
- Ghi chú audit: route `/go` thuộc nhóm `needsParam` nên nằm ngoài `screen-role-capture` audit — gate thật nằm ở PermissionGate trang đích (Phase 2).
- Giới hạn đã biết: `mustChangePassword` là client-hint (xem Phase 1) — enforcement server-side là follow-up ngoài plan.

## Related Code Files

- Modify: `apps/admin/src/pages/teaching/grading.tsx` (+ test)
- Modify: `apps/admin/src/pages/hr/payroll.tsx` (+ test)
- Modify: `apps/admin/src/pages/teaching/session-evidence.tsx` (+ test)
- Modify: `packages/links/src/index.ts` (+test) — builder 3 workspace
- Modify: `infra/nginx/nginx.conf`, `infra/nginx/nginx.local-sim.conf` — Referrer-Policy
- Modify: `docs/system-architecture.md` — mục URL addressing

## Implementation Steps

1. Mỗi workspace: đọc component → xác nhận semantics param → refactor `useSearchParams` + lọc UUID → cập nhật unit test → CopyLinkButton → builder `@cmc/links`.
2. Payroll: hydrate `selectedUser` từ `userId` + `pickList` (loading/not-found như bảng trên); test case userId stale.
3. Case id rác từng trang (mẫu Phase 3).
4. Referrer-Policy vào 2 file nginx; xác nhận header xuất hiện trong prod-sim (curl -I).
5. E2e: deep-link hydrate cho grading + session-evidence (spec deeplink chung, `test.use baseURL 4173`); payroll nếu seed đủ kỳ lương — nếu không, unit test hydrate là đủ (ghi chú trong spec).
6. Viết mục docs; đối chiếu claim với code (tên param, builder, header nginx).

## Success Criteria

- [ ] 3 workspace hydrate từ URL, e2e/unit chứng minh; payroll không render breadcrumb `undefined` với userId stale
- [ ] Spec UI liên quan xanh: `journeys/grading-submission*`, `journeys/payroll-assemble-finalize*`, `journeys/payroll-roster*` (spec UI thật — đã kiểm tồn tại)
- [ ] Header `Referrer-Policy: same-origin` có mặt trên prod-sim responses
- [ ] `docs/system-architecture.md` có mục URL addressing, claim khớp code
- [ ] Tổng: 4 entity detail + ≥4 workspace addressable (đối chiếu bảng `@cmc/links`)
- [ ] CI 2 required checks xanh (mỗi PR nếu tách)

## Scope-Cut Rule

<!-- Updated: Validation Session 1 --> Nếu grading hoá ra cần procedure API phức tạp: **được phép cắt grading khỏi phase**, đóng phase với payroll + session-evidence; grading thành follow-up. Tiêu chí "≥4 workspace" vẫn đạt (attendance + payroll + session-evidence + schedule có sẵn). Ghi rõ quyết định cắt vào Validation Log của plan khi xảy ra.

## Risk Assessment

- **Semantics `selectedId` grading đoán sai**: bước 1 bắt buộc đọc component, đặt tên param theo entity thật.
- **Payroll pickList timing**: hydrate phải chờ pickList; render trung gian không được hiện `undefined` — định nghĩa loading state tường minh, test.
- **Diff phình**: >~400 dòng/workspace → tách PR riêng.
