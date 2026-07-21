# Phase 02 — Nền UI (foundation)

## Context links
- `docs/06` (routing, §7 route config react-router v7), `docs/12` (design system, 10 component + 8 trạng thái + semantics màu), `docs/18` (tech stack), `docs/14` (RBAC).
- Hiện trạng: `apps/admin/src` = 4 file (main/app/app.css/vite-env); `packages/ui/src` = tokens.css + index.ts (chỉ token object). react-router-dom@7 đã cài, chưa dùng. Mantine CHƯA cài.

## Overview
- Ngày: 2026-07-07 · Priority: P1 · Status: completed · Review gate: **reviewer 1 vòng** (nền, không chạm tiền/trẻ).
- Cổng chặn mọi màn ERP (03-06). Dựng: theme, tRPC client, route tree, thư viện component, shell, login, template List + Record Detail.

## Key insights
- `packages/ui/src/index.ts` xuất `tokens` object map sang CSS var. Mantine theme phải **đọc token này** (một nguồn màu duy nhất, DRY) — không hardcode `#0071E3` lần 2.
- Dev-auth = header `x-dev-user` JSON `{userId, roles, facilityId}` (`apps/api/src/context.ts:22`). tRPC client phải gắn header này. Prod fail-closed tới khi có Entra SSO (P0-debt) — login page thiết kế có **seam SSO** (nút "Đăng nhập Entra" disabled/stub) nhưng chạy dev-header now.
- **`session.me` KHÔNG "server-authoritative" dưới dev-header** (M5): danh tính staff hiện do client tự khẳng định qua `x-dev-user` (`context.ts:68-76`); `session.me` chỉ echo lại + config. Là **client-side mirror**, trở thành authoritative **sau Entra SSO**. "Login page" hiện thực chất là impersonation switcher, không phải xác thực. **Server `can()` vẫn là gate bảo mật thật.**
- `can()`/`PERMISSIONS` **chỉ chạy server** (`packages/auth/src/index.ts`); FE import `can`/`PERMISSIONS` (package framework-light) làm **mirror UX** với roles từ `session.me` — chỉ để ẩn/hiện, không phải bảo mật.
- `AppRouter` type xuất từ `apps/api/src/router.ts:98` → tRPC client import type an toàn end-to-end.

## Requirements
1. **Mantine v7** cài `apps/admin` + `@cmc/ui` (peer). Theme sinh từ `tokens`: brand primary `#0071E3`, radius xs 4px, font SF Pro, semantics màu §3.
2. **tRPC + React Query client**: package/module `apps/admin/src/lib/trpc.ts` (`createTRPCReact<AppRouter>`), httpLink gắn `x-dev-user` (dev role switcher lưu localStorage), QueryClientProvider. Import `AppRouter` type từ `@cmc/api` (thêm dep workspace).
3. **Route tree + nav registry** theo `docs/06` §3 (đủ ~30 route) — layout lồng, `:id` param, tab sub-route, index redirect. Route gate bằng client `can()` mirror (roles từ `session.me`). **M2 — chống xung đột merge song song**: KHÔNG để 03/04/05/06 cùng sửa 1 file `routes/index.tsx`. Thiết kế **route config per-module** (mỗi module 1 file `routes/{module}.routes.tsx` export mảng route) + `routes/index.tsx` chỉ import-và-nối; **khai báo TRƯỚC toàn bộ nav entries** (5 module + resource) trong 1 nav registry ở phase-02 (placeholder cho route chưa build). Phase 03-06 chỉ điền page vào file module của mình, KHÔNG chạm index/nav chung.
4. **`@cmc/ui` 10 component**: `PageHeader`, `DataTable`, `EmptyState`, `StatCard`, `StatusBadge`, `FilterBar`, `MasterDetail`, `Tabs`, `ConfirmDialog`, `ResultPanel`. Mỗi component đủ 8 trạng thái (default/hover/active/focus/disabled/loading/error/empty). `DataTable` skeleton/empty/error; `StatusBadge` map semantics §3; `FilterBar` phản ánh URL query (`useSearchParams`).
5. **ERP shell**: sidebar tối `#1A1A1E` 252px (5 module, nav gate RBAC), topbar frosted sticky (sub-tab + search + bell + pill "Ghi danh" + hiển thị role, dev role switcher). Breadcrumb drill-down.
6. **Login page**: dev-header auth (chọn user/role/facility từ seed), seam SSO stub. Route `/login`.
7. **Template dùng lại**: `Danh sách` generic (FilterBar+DataTable, flat/grouped) + `Record Detail` hub (Odoo-form: smart button + field grid + related-list + right-rail chatter). Là base cho phase 06.

## Architecture notes
- Cấu trúc: `apps/admin/src/{lib,routes,components,pages,shell}`. `@cmc/ui` chứa primitive DUMB (không gọi tRPC); page trong `apps/admin` nối data. Giữ file gần 200 dòng, tách theo trách nhiệm.
- Mantine theme wrap: `MantineProvider theme={cmcTheme}` bọc `RouterProvider`. `@cmc/ui` component build trên Mantine primitive nhưng chỉ nhận props (state-driven), không data-fetch.
- `session.me` (built phase-01a): FE gọi khi khởi động → cache trong context/RQ → dùng cho nav gate + hiển thị role. Client `can()` mirror import `PERMISSIONS`/`can` từ `@cmc/auth` (package framework-light, an toàn dùng ở FE) + roles từ `session.me`.
- react-router: đổi `createBrowserRouter` ở `main.tsx` từ 1 route → cây đầy đủ.

## Related code files
- Sửa: `apps/admin/src/main.tsx`, `app.tsx`, `package.json` (thêm mantine, @tanstack/react-query, @trpc/client, @trpc/react-query, @cmc/api workspace dep).
- Thêm: `apps/admin/src/lib/trpc.ts`, `apps/admin/src/lib/theme.ts`, `apps/admin/src/routes/index.tsx` (chỉ nối) + `routes/{module}.routes.tsx` per-module stub, `apps/admin/src/shell/nav-registry.ts` (khai báo trước toàn nav), `apps/admin/src/shell/*`, `apps/admin/src/pages/login.tsx`, template `generic-list.tsx` + `record-detail.tsx`.
- Thêm: `packages/ui/src/components/*` (10 component) + cập nhật `packages/ui/src/index.ts` export; `packages/ui/package.json` thêm mantine peer.
- Đọc (đã build phase-01a): `apps/api/src/session/router.ts` (`session.me`) — FE tiêu thụ, không sửa backend ở phase này.

## Implementation steps
1. Cài Mantine + tRPC + RQ vào `apps/admin`; wire `@cmc/api` workspace dep (chỉ type).
2. `theme.ts` từ tokens; MantineProvider.
3. `trpc.ts` client + httpLink header + QueryClient.
4. Wire `session.me` (phase-01a) vào FE context + client `can()` mirror.
5. Build 10 component `@cmc/ui` với đủ trạng thái + story/demo tối thiểu.
6. Route tree đầy đủ (placeholder page cho route chưa build → "đang phát triển" chứ không trắng).
7. ERP shell + nav RBAC gate + role switcher dev.
8. Login page + seam SSO.
9. Template generic-list + record-detail.
10. Verify typecheck/build/lint; smoke render shell + 1 route thật (vd `/students` gọi `student.lookup` hoặc list).

## Todo list
- [x] Mantine + theme từ tokens
- [x] tRPC/RQ client + dev header
- [x] Wire session.me + client can() mirror
- [x] 10 component @cmc/ui đủ 8 trạng thái
- [x] Route tree ~30 route
- [x] ERP shell + RBAC nav + role switcher
- [x] Login + SSO seam
- [x] Template List + Record Detail (finance list page as real tRPC template; receipt-detail as placeholder)
- [x] typecheck/build xanh + smoke 1 route

## Success criteria
- `pnpm -F @cmc/admin build` + `typecheck` xanh; `@cmc/ui` typecheck xanh.
- Shell render, nav ẩn/hiện đúng theo role (đổi role switcher → nav đổi).
- 1 route thật fetch dữ liệu tRPC qua dev-header (vd list students/classes).
- Mọi component có demo đủ 8 trạng thái (loading skeleton/empty/error nhìn thấy được).
- Deep-link cold-start: dán URL tab con → ra đúng trạng thái (F5 an toàn).
- **Review**: reviewer 1 vòng — kiểm token single-source, RBAC gate, 8-trạng-thái, URL-query binding.

## Risk assessment
| Rủi ro | K×I | Giảm thiểu |
|---|---|---|
| Hardcode màu lần 2 (drift khỏi token) | TB×TB | theme đọc `tokens`; review chặn |
| `can()` client mirror lệch server | TB×Cao | dùng `session.me` làm nguồn; server vẫn là gate thật (defense-in-depth) |
| Component thiếu trạng thái (nợ ngầm) | Cao×TB | checklist 8 trạng thái trong DoD; demo bắt buộc |
| Bundle Mantine phình | Thấp×Thấp | tree-shake, import theo path |
| SSO seam bị hiểu nhầm là chạy | Thấp×TB | nút Entra disabled + nhãn "sắp có" |

## Security considerations
- Dev role switcher chỉ hoạt động khi `DEV_AUTH_ENABLED` (fail-closed prod) — không để lộ đường impersonate ở prod build.
- `session.me` không trả dữ liệu nhạy cảm ngoài userId/roles/facility.
- Client gate là UX; **server `can()` là gate bảo mật thật** — không bỏ server check.

## Next steps
→ 03/04/05/06 build màn thật trên template + component này (file ownership tách theo phase).

## Ghi chú
- Quyết định đã chốt: `session.me` được build ở phase-01a, phase này chỉ tiêu thụ.
