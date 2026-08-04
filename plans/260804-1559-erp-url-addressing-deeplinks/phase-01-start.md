---
phase: 1
title: "ReturnTo Login Redirect"
status: completed
priority: P1
effort: "8h"
dependencies: []
---

# Phase 1: ReturnTo Login Redirect

## Overview

Login không được đánh mất URL đích: `RequireAuth` chuyển URL hiện tại vào `/login?returnTo=…`; login xong quay về đúng đó, kể cả khi đi qua `/change-password`. Validate returnTo chống open-redirect. Kèm hạ tầng e2e mới: seed staff user có mật khẩu thật để lái form login (hiện chưa tồn tại — mọi spec admin đều mint cookie bypass form).

## Requirements

- Functional: logout mở URL bất kỳ → login → đứng đúng URL đó (path + query; **hash ngoài phạm vi** — quyết định rõ, không phải bỏ sót); luồng `mustChangePassword` carry returnTo qua change-password **ở mức UX client**.
- Non-functional: returnTo chỉ chấp nhận path nội bộ (chuẩn OWASP Unvalidated Redirects); không phá SSO khi bật lại sau này.

## Giới hạn đã biết (ghi nhận, không thuộc phạm vi phase)

`mustChangePassword` hiện là **client-side hint**: `/auth/staff-login` phát cookie đầy quyền bất kể cờ (`apps/api/src/auth/password-routes.ts:140,196-201`), `session.me` không expose cờ (`apps/admin/src/lib/session-context.tsx:7-13`), `RequireAuth` chỉ check `me`. User sửa address bar là bỏ qua rotation — **trước cả plan này**. Phase này chỉ carry returnTo qua chuỗi đó như UX; enforcement server-side (expose cờ trên `session.me` + guard) là follow-up riêng ngoài plan, ghi ở plan.md Non-goals.

## Architecture

- Dùng **query param `?returnTo=`** thay vì router `location.state`: sống sót reload trang login, tự nhiên cho link hệ thống sinh sau này.
- **`safe-return-to.ts` là nơi tập trung MỌI policy path** (một chỗ duy nhất — guard và validator không được giữ 2 danh sách riêng lẻ):
  ```ts
  // Các path không bao giờ capture làm returnTo và không bao giờ restore về
  export const RETURN_TO_EXCLUDED = ['/', '/login', '/change-password'];
  export function shouldCaptureReturnTo(pathname: string): boolean;  // dùng bởi RequireAuth
  export function safeReturnTo(raw: string | null): string;          // dùng bởi login + change-password (+ Phase 2: go-resolver)
  ```
  `safeReturnTo` trả `raw` chỉ khi: bắt đầu bằng đúng một `/` (regex `/^\/(?![/\\])/`), decode được, không thuộc `RETURN_TO_EXCLUDED`. Mọi trường hợp khác (rỗng, `//evil.com`, `/\evil`, `https://…`, `javascript:…`) → fallback `'/'`.
- Luồng: `RequireAuth` (chưa đăng nhập, `shouldCaptureReturnTo` true) → `<Navigate to={'/login?returnTo=' + encodeURIComponent(pathname + search)} />`. Login OK → `navigate(safeReturnTo(param))`; nếu `mustChangePassword` → `/change-password?returnTo=' + encodeURIComponent(safeReturnTo(param))`; change-password OK → `navigate(safeReturnTo(param))`.
- Lưu ý: `RequireAuth` cũng bọc `/change-password` (`routes/index.tsx:35-43`) — F5/hết session giữa chừng rotation sẽ capture pathname `/change-password`, bị `shouldCaptureReturnTo` loại → returnTo lồng bên trong mất. Chấp nhận (edge hiếm, fallback `/` an toàn); ghi test 1 case chứng minh không loop.

## Hạ tầng e2e (điều kiện tiên quyết cho mọi phase sau)

Sự thật đã kiểm chứng:
- Không spec admin nào lái form login; auth duy nhất là mint cookie (`apps/e2e/tests/admin-shell.ui.spec.ts:9-33`, `apps/e2e/src/session-injection.ts:141`).
- CI ui-e2e **không chạy seed nào** (`.github/workflows/ui-e2e.yml`: migrate + build + run, hết); synthetic seed là công cụ local, không có trong CI.
- Contract API: mật khẩu do admin cấp **luôn** set `mustChangePassword=true` (`apps/api/src/user/router.ts:174,377`); chỉ `changeOwnPassword` xoá cờ (`:350`). ⇒ case login "thường" mới là case cần thêm bước; case mustChangePassword seed trivially (dừng sau resetPassword).
- Bẫy baseURL: project ui-chromium mặc định `http://localhost:4174` (**LMS**); mọi spec admin phải `test.use({ baseURL: 'http://localhost:4173' })` (xem `admin-shell.ui.spec.ts:21-25`).

Việc phải làm: helper `seedStaffWithPassword()` trong `apps/e2e/src/` — seed AppUser → set mật khẩu tạm (đường resetPassword/provision) → gọi `changeOwnPassword` qua API để xoá cờ → trả credentials cho spec. Fixture entity (opportunity/receipt) tạo in-spec qua tRPC client như các journey hiện có.

## Related Code Files

- Create: `apps/admin/src/lib/safe-return-to.ts`
- Create: `apps/admin/src/lib/safe-return-to.test.ts`
- Modify: `apps/admin/src/routes/index.tsx` — `RequireAuth` (dòng 25-30): `useLocation` + `shouldCaptureReturnTo` + build `/login?returnTo=…`
- Modify: `apps/admin/src/pages/login.tsx` — dòng 46: `useSearchParams` + `safeReturnTo`
- Modify: `apps/admin/src/pages/change-password.tsx` — dòng 21-24 (navigate nằm trong `onSuccess` của mutation): carry returnTo
- Create: `apps/e2e/src/seed-staff-password.ts` — helper `seedStaffWithPassword()`
- Create: `apps/e2e/tests/deeplink-return-to.ui.spec.ts`

## Implementation Steps

1. Viết `safe-return-to.ts` (`RETURN_TO_EXCLUDED`, `shouldCaptureReturnTo`, `safeReturnTo`) + unit test (vitest, pattern như `lib/permission-gate.test.tsx`).
2. Sửa `RequireAuth`: khi `!isLoading && !me` và `shouldCaptureReturnTo(pathname)` → redirect kèm returnTo; ngược lại redirect `/login` trần.
3. Sửa `login.tsx`: `const dest = safeReturnTo(params.get('returnTo'))` — thay `navigate('/')` bằng `navigate(dest)`; nhánh `mustChangePassword` → `/change-password?returnTo=${encodeURIComponent(dest)}`.
4. Sửa `change-password.tsx`: đọc returnTo, `onSuccess` → `navigate(safeReturnTo(param))`.
5. Xây `seedStaffWithPassword()`: seed AppUser với role/facility hợp lệ, cấp mật khẩu tạm, xoá cờ qua `changeOwnPassword` API. Thêm biến thể `seedStaffMustChangePassword()` (dừng sau bước cấp mật khẩu tạm — cờ còn nguyên).
6. E2e `deeplink-return-to.ui.spec.ts` (bắt buộc `test.use({ baseURL: 'http://localhost:4173' })`):
   - (a) tạo opportunity fixture qua tRPC → logout state → `page.goto('/crm/opportunities/<id>')` → form login → submit (user từ helper 5) → `expect(page.url()).toBe('http://localhost:4173/crm/opportunities/<id>')`.
   - (b) `page.goto('/login?returnTo=' + encodeURIComponent('//evil.com'))` → login → `expect(page.url()).toBe('http://localhost:4173/cockpit')` (assertion dương, không chỉ "origin không đổi").
   - (c) user từ `seedStaffMustChangePassword()` → goto deep-link → login → bị đưa tới `/change-password?returnTo=…` → đổi mật khẩu → expect đứng ở deep-link gốc.
7. Ghi chú comment tại `ssoUrl` (login.tsx): khi bật lại Entra SSO, server callback cần nhận returnTo (RelayState) — ngoài phạm vi.
8. <!-- Updated: Validation Session 1 --> Tạo GitHub issue "enforce mustChangePassword server-side" (`gh issue create`, mô tả: expose cờ trên `session.me` + guard ở RequireAuth/API; bằng chứng client-hint: password-routes.ts:140,196-201) — để security gap có hồ sơ theo dõi, không nằm im trong docs.

## Success Criteria

- [x] Unit `safeReturnTo`/`shouldCaptureReturnTo`: các case `//evil.com`, `https://…`, `/\evil`, rỗng, `javascript:`, `/login`, `/change-password`, query lồng (`/finance?page=2`) pass
- [x] E2e (a)(b)(c) pass trong ui-e2e với assertion URL dương
- [ ] Không regression: spec ui-e2e hiện có vẫn xanh (chạy full suite trên CI khi mở PR)
- [ ] CI `typecheck-and-test` + `ui-e2e` xanh

## Risk Assessment

- **Loop redirect**: `RETURN_TO_EXCLUDED` dùng chung cho capture lẫn restore — một nguồn, test cả hai phía.
- **Session `isLoading` race**: giữ nguyên guard `if (isLoading) return skeleton` trước khi redirect (routes/index.tsx:27) — không capture khi chưa biết trạng thái.
- **Double-encode**: encode đúng 1 lần khi build URL; `searchParams.get` tự decode — unit test case query lồng.
- **Helper seed đụng contract auth**: `seedStaffWithPassword` đi qua API thật (không insert hash thẳng DB) để không lệch contract bcrypt/policy — nếu chậm, cân nhắc insert hash trực tiếp theo mẫu `lms-auth.spec.ts` nhưng phải dùng cùng hàm hash của API.
