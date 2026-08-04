---
phase: 2
title: "Links Contract And Go Resolver"
status: in-progress
priority: P1
effort: "10h"
dependencies: [1]
---

# Phase 2: Links Contract And Go Resolver

<!-- Updated: Validation Session 1 - tách 2 PR bắt buộc: 2a (gates + student fetch-by-id) ship trước, 2b (links + /go + copy) sau -->

## Overview

Tạo package `@cmc/links` — nguồn sự thật entity→URL cho client và (tương lai) server. Thêm route canonical `/go/:entity/:id`, gắn `PermissionGate` cho 4 route chi tiết (hiện **chưa có** — red-team đã kiểm chứng), sửa `student-detail` fetch được theo id (hiện render 100% từ `location.state`), và nút Copy link.

**Giao hàng thành 2 PR bắt buộc, tuần tự (quyết định validate 2026-08-04):**
- **PR 2a — trả nợ hiện trạng:** PermissionGate 4 route chi tiết + render FORBIDDEN riêng ở opportunity-detail + student-detail fetch-by-id (kèm procedure API nếu thiếu). Giá trị độc lập: sửa lỗ hổng đang có, chưa cần package mới. Steps 4-5 + e2e 403/cold-navigation.
- **PR 2b — tính năng mới:** `@cmc/links` + `go.routes.tsx`/resolver + CopyLinkButton + thay 7 call-site. Steps 1-3, 6-8 (phần e2e còn lại).

## Requirements

- Functional: builder cho 4 entity; `/go/:entity/:id` redirect an toàn về route thật; entity lạ/id sai dạng → màn 404 rõ ràng; **cold navigation** (mở URL trực tiếp, không click-through) render đủ dữ liệu trên cả 4 trang chi tiết; thiếu quyền → màn "Không có quyền truy cập"; Copy link copy dạng `/go/…`.
- Non-functional: package TS thuần, không dependency runtime, import được từ cả `apps/api` (Node) lẫn `apps/admin` (Vite) — pattern exports dev/dist đã chứng minh qua `@cmc/ui`/`@cmc/auth` (admin đang consume).

## Architecture

```
packages/links/            # @cmc/links — mô phỏng packages/domain-time
  src/index.ts
  src/index.test.ts
  package.json, tsconfig.json
```

```ts
// src/index.ts (phác thảo — đã vá 2 lỗ red-team tìm ra)
// export: Phase 3-4 dùng lại để lọc query param tại boundary trang
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const links = {
  opportunity: (id: string) => `/crm/opportunities/${id}`,
  receipt:     (id: string) => `/finance/${id}`,
  student:     (id: string) => `/admin/students/${id}`,
  classBatch:  (id: string) => `/admin/classes/${id}`,
} as const;

export type LinkEntity = keyof typeof links;
export const goPath = (e: LinkEntity, id: string) => `/go/${e}/${id}`;

export function resolveGo(entity: string, id: string): string | null {
  // Object.hasOwn — KHÔNG dùng `in` (prototype chain: 'toString' in links === true)
  if (!Object.hasOwn(links, entity)) return null;
  // id phải là UUID (quyết định #4): chặn traversal ..%2F.. và va vào route tĩnh
  // anh em (/go/receipt/refund → /finance/refund).
  if (!UUID_RE.test(id)) return null;
  return links[entity as LinkEntity](id);
}
```

- **`/go` route**: file mới `apps/admin/src/routes/go.routes.tsx` (module route array như finance/crm/… — tôn trọng contract header của `routes/index.tsx:1-3` "chỉ assemble module arrays"); `index.tsx` chỉ thêm 1 dòng import + spread, đặt **trước** wildcard `*` (dòng 63). `GoResolverPage` nằm trong Shell children (chấp nhận Shell chrome hiện thoáng qua khi redirect — đơn giản, nhất quán; đã cân nhắc sibling-of-Shell và từ chối vì thêm nhánh layout riêng cho 1 trang transient). Component: `const target = resolveGo(entity, id)` → target null → `EmptyState` "Liên kết không tồn tại"; ngược lại **phòng thủ theo chiều sâu**: `<Navigate to={safeReturnTo(target)} replace />` (safeReturnTo từ Phase 1 — resolver là redirect sink thứ hai, phải qua cùng một guard).
- **PermissionGate cho 4 route đích** (red-team: hiện KHÔNG route nào trong 4 route có gate; `PermissionGate` chỉ dùng ở class-placement/courses/gifts/rewards): bọc 4 route trong `crm.routes.tsx:26-33`, `finance.routes.tsx:70-77`, `admin.routes.tsx:54-55,61-62` bằng `PermissionGate` với module/action tra từ registry quyền trong `packages/auth` (xác định cặp chính xác khi cook — grep cách class-placement khai báo tại `finance.routes.tsx:50`).
- **student-detail fetch-by-id**: thêm query lookup theo `:id` (kiểm router student trong `apps/api` xem đã có procedure get-by-id chưa; nếu chưa → thêm procedure, RLS/permission như list). `location.state.student` giữ làm optimistic seed (render ngay khi click từ list), query làm nguồn chính cho cold navigation; not-found → EmptyState.
- **CopyLinkButton** trong `apps/admin/src/lib/copy-link-button.tsx` (không vào `@cmc/ui` — YAGNI, chỉ admin dùng). Copy `window.location.origin + goPath(entity, id)`. **Secure-context fallback bắt buộc**: `navigator.clipboard` là `undefined` trên HTTP LAN (prod-sim serve HTTP) → fallback textarea ẩn + `document.execCommand('copy')`; feedback "Đã copy" 2s.
- Ghi chú consumer server tương lai: API đã có helper origin admin (`getAdminOrigin`, `apps/api/src/server.ts`) — khi làm email link, dùng nó + `@cmc/links`; phase này KHÔNG thêm dependency vào `apps/api` (chưa có consumer thật).

## Related Code Files

- Create: `packages/links/package.json`, `tsconfig.json`, `src/index.ts`, `src/index.test.ts` (mô phỏng `packages/domain-time`)
- Create: `apps/admin/src/routes/go.routes.tsx`
- Create: `apps/admin/src/pages/go-resolver.tsx` (+ test)
- Create: `apps/admin/src/lib/copy-link-button.tsx` (+ test)
- Modify: `apps/admin/src/routes/index.tsx` — import go.routes (1 dòng, trước wildcard)
- Modify: `apps/admin/src/routes/crm.routes.tsx`, `finance.routes.tsx`, `admin.routes.tsx` — PermissionGate 4 route chi tiết
- Modify: `apps/admin/package.json` — `"@cmc/links": "workspace:*"`
- Modify: `apps/admin/src/pages/crm/opportunity-detail.tsx` — CopyLinkButton + render 403 FORBIDDEN riêng (hiện banner lỗi thô `:127-130`)
- Modify: `apps/admin/src/pages/finance/receipt-detail.tsx` — CopyLinkButton
- Modify: `apps/admin/src/pages/students/student-detail.tsx` — fetch-by-id + CopyLinkButton (LƯU Ý path: `pages/students/`, KHÔNG phải `pages/admin/`)
- Modify: `apps/admin/src/pages/classes/class-detail.tsx` — CopyLinkButton (path: `pages/classes/`)
- Modify (nếu cần): router student trong `apps/api` — procedure get-by-id
- Modify — thay hardcode bằng builder tại **đúng 7 call-site đã enumerate** (red-team Contract Verifier):
  - opportunity: `pages/finance/receipt-create.tsx:210`, `pages/crm/pipeline.tsx:94`
  - receipt: `pages/finance/receipt-list.tsx:154`, `pages/finance/receipt-create.tsx:132`
  - student: `pages/students/index.tsx:84` — **giữ nguyên `{ state: { student: row } }`** khi thay
  - classBatch: `pages/classes/index.tsx:296`, `:332`
  - KHÔNG đụng 3 false-positive `/finance/new?...`: `lib/enroll-picker.tsx:41`, `pages/crm/opportunity-detail.tsx:222`, `pages/crm/pipeline.tsx:154`

## Implementation Steps

1. Scaffold `packages/links` (pnpm-workspace đã glob `packages/*` — verified; turbo.json dùng task chung, không cần khai báo package).
2. Viết `links`/`goPath`/`resolveGo` + unit test: 4 builder đúng path; `resolveGo('unknown', uuid)` → null; **`resolveGo('toString', uuid)` / `('constructor', uuid)` → null**; **id không phải UUID (`refund`, `..%2F..%2Fadmin%2Fusers`, rỗng) → null**.
3. `go.routes.tsx` + `GoResolverPage` (lazy + Suspense như các page khác) + test: entity+uuid hợp lệ → redirect; entity lạ/id sai dạng → EmptyState; target đi qua `safeReturnTo`.
4. Gắn `PermissionGate` cho 4 route chi tiết (module/action từ registry `packages/auth`); opportunity-detail thêm nhánh render FORBIDDEN → EmptyState "Không có quyền" thay banner lỗi thô.
5. student-detail: thêm query lookup by id (thêm procedure API nếu chưa có), state làm seed, not-found EmptyState.
6. `CopyLinkButton` (kèm fallback insecure-context) + gắn 4 trang chi tiết.
7. Thay hardcode tại 7 call-site enumerate ở trên (không grep mù — danh sách là chính xác, đã kiểm).
8. E2e mở rộng `deeplink-return-to.ui.spec.ts` (nhớ `test.use({ baseURL: 'http://localhost:4173' })`):
   - **Cold navigation cả 4 entity**: tạo fixture qua tRPC → `page.goto` thẳng URL chi tiết (không click-through) → expect dữ liệu thật render (tên, không phải `ID: <uuid>`).
   - `/go/opportunity/<uuid>` khi logout → login → đứng ở `/crm/opportunities/<uuid>`.
   - `/go/unknown/x` và `/go/opportunity/not-a-uuid` (đã login) → EmptyState.
   - 403: user role không có quyền CRM mở link opportunity → thấy "Không có quyền truy cập".
   - Clipboard: click Copy → assert nội dung (cấp `clipboard-read/write` cho origin 4173); nếu flaky, hạ xuống component test + e2e chỉ assert button render (ghi chú trong spec).

## Success Criteria

PR 2a:
- [x] 4 route chi tiết có PermissionGate; e2e 403 chứng minh
- [x] E2e cold-navigation: student-detail render dữ liệu thật từ id (không còn phụ thuộc `location.state`) — `student.get` đã có trên develop; bổ sung EmptyState not-found
- [ ] CI 2 required checks xanh

PR 2b:
- [ ] Unit `@cmc/links` pass (gồm case prototype + non-UUID); `pnpm typecheck` toàn repo xanh
- [ ] E2e cold-navigation 4 entity pass
- [ ] E2e `/go` qua login + entity lạ + id sai dạng pass
- [ ] 7 call-site dùng builder; 3 false-positive không bị đụng
- [ ] CI 2 required checks xanh

## Risk Assessment

- **Procedure student get-by-id có thể chưa tồn tại** → bước 5 gồm cả API; nếu diff phình quá, tách PR "student-detail fetch-by-id" ra trước phần còn lại của phase.
- **Permission module/action đặt sai** → tra registry `packages/auth` + đối chiếu cách API router require ở từng entity (nguồn sự thật là `requirePermission` phía API), không đoán.
- **`/go` nằm ngoài audit `screen-role-capture`** (route `needsParam` bị skip tại `apps/e2e/tests/screen-role-capture.ui.spec.ts:136-138`): chấp nhận — resolver không render dữ liệu, gate nằm ở trang đích (giờ đã có PermissionGate thật); ghi chú trong docs Phase 4.
- **Vite/Node dual-consumption**: exports map giống `@cmc/ui`/`@cmc/auth` đang được admin dùng — rủi ro thấp.
