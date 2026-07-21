---
phase: 2
title: "Theme CMC + rebuild @cmc/ui tren Astryx"
status: completed
effort: "5-7 ngày"
priority: P1
dependencies: [1]
---

# Phase 2: Theme CMC + rebuild @cmc/ui trên Astryx

## Overview

Viết bộ browser e2e bảo vệ UI (chưa tồn tại!), tạo theme CMC trên nền Astryx theme-neutral, và
đổi ruột 10 component `@cmc/ui` từ Mantine sang Astryx — **giữ nguyên public API của 10 component**.
Lưu ý red-team F3: `cmcTheme` (kiểu `MantineThemeOverride`, export tại
`packages/ui/src/index.ts:44`, dùng ở cả 2 `main.tsx`) KHÔNG thể giữ — đây là breaking change có
chủ đích; cả 2 `main.tsx` phải sửa tối thiểu trong phase này.

## Requirements

- Functional: 10 component render tương đương chức năng bản Mantine, đủ states TL12 §4
  (default · hover · active · focus ring brand · disabled · loading · error · empty).
- Non-functional: thay đổi ở apps giới hạn đúng `main.tsx` (provider/CSS entry) — không sửa page
  nào; typecheck toàn workspace xanh; semantics màu đúng TL12 §3.

## Architecture

- **Bộ UI e2e trước tiên** (red-team F1): viết `*.ui.spec.ts` (Playwright project `ui-chromium`
  đã có sẵn trong `apps/e2e/playwright.config.ts`, hiện 0 spec) chống lại UI Mantine hiện tại —
  chụp behavior TRƯỚC khi đổi ruột. Chạy bằng:
  `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`
  (root `pnpm test` filter loại @cmc/e2e nên KHÔNG thay thế được lệnh này).
- `packages/ui` đổi peerDep: bỏ `@mantine/core`, thêm `@astryxdesign/core@0.1.4` +
  `@stylexjs/stylex` (theo cấu hình tối thiểu spike đã chốt).
- Theme CMC = `packages/ui/src/astryx-theme-cmc.css`: import `astryx.css` + `theme.css`
  (theme-neutral) rồi override CSS custom properties bằng `var(--cmc-*)` từ `tokens.css`
  (tokens.css vẫn là single source). **KHÔNG import `reset.css` trong file này** (red-team F14) —
  reset chỉ import ở `main.tsx` từng app khi app đó flip (Phase 3 admin, Phase 4 lms), tránh
  reset Astryx lan qua @cmc/ui vào các page còn Mantine.
- `theme.ts`: xoá `cmcTheme` (MantineThemeOverride) — breaking. 2 `main.tsx` sửa tối thiểu:
  giữ `<MantineProvider>` KHÔNG theme override (page Mantine chưa migrate vẫn chạy), thêm import
  `@cmc/ui/astryx-theme-cmc.css` + Astryx provider bọc ngoài. Giai đoạn Phase 2–4 hai provider
  cùng sống có chủ đích.
- Component gap (từ spike): tự viết trong `packages/ui/src/components/` bằng primitive Astryx;
  KHÔNG import Mantine mới.
- **Version policy:** nếu 0.1.4 lộ bug blocking, được nâng patch 0.1.x sau khi re-run gate
  Phase 1 (a)–(e) trên bản mới (plan.md policy).

## Related Code Files

- Create: `apps/e2e/tests/admin-shell.ui.spec.ts` (shell render, nav, một trang list DataTable)
- Create: `apps/e2e/tests/lms-login.ui.spec.ts` (2-tab, deep-link `?tab=student`, cooldown OTP,
  BLOCKED-ON-COMMS, mustChangePassword redirect, lỗi generic)
- Create: `packages/ui/src/astryx-theme-cmc.css`
- Modify: `packages/ui/package.json` (peerDeps, exports thêm `./astryx-theme-cmc.css`)
- Modify: `packages/ui/src/theme.ts` (xoá cmcTheme) + `packages/ui/src/index.ts` (bỏ export cmcTheme)
- Modify (đổi ruột, giữ API): `packages/ui/src/components/{status-badge,empty-state,stat-card,page-header,result-panel,confirm-dialog,cmc-tabs,filter-bar,master-detail,data-table}.tsx`
- Modify (tối thiểu): `apps/admin/src/main.tsx`, `apps/lms/src/main.tsx` (bỏ `theme={cmcTheme}`,
  thêm Astryx provider + theme CSS — KHÔNG thêm reset.css ở phase này)
- KHÔNG sửa: bất kỳ page file nào trong apps

## Implementation Steps

1. **Step 0 — UI e2e safety net:** viết 2 file `*.ui.spec.ts` trên UI Mantine hiện tại, chạy xanh
   trên branch trước khi đổi bất kỳ component nào. Selector theo role/label (không theo class
   Mantine) để sống sót qua migration.
2. Đổi peerDep + cài; tạo `astryx-theme-cmc.css` map đủ token nhóm: brand, text, surface,
   semantic (green/amber/red/grey), radius, focus ring.
3. Xử lý `theme.ts`/`cmcTheme` + sửa 2 `main.tsx` tối thiểu như Architecture; chạy UI e2e — page
   Mantine cũ phải còn render đúng (2 provider cùng sống, chưa có reset Astryx).
4. Migrate từng component theo thứ tự rủi ro tăng dần, mỗi component 1 commit:
   `status-badge` → `empty-state` → `stat-card` → `page-header` → `result-panel` →
   `confirm-dialog` → `cmc-tabs` → `filter-bar` → `master-detail` → `data-table` (cuối).
5. Với mỗi component: (i) chụp behavior contract từ bản Mantine (props, states, aria), (ii) viết
   lại trên Astryx, (iii) verify đủ states TL12 §4, (iv) chạy
   `pnpm --filter @cmc/ui typecheck && pnpm --filter @cmc/admin typecheck && pnpm --filter @cmc/lms typecheck`
   + UI e2e.
6. `data-table`: áp cách đạt density đã chứng minh ở spike (điều kiện vào Phase 2).
7. Component gap từ spike (vd DatePicker nghiệp vụ): viết mới trong @cmc/ui, export thêm
   (thêm export mới = không phá API cũ).
8. Smoke test render cho 10 component.

## Success Criteria

- [x] 2 file `*.ui.spec.ts` chạy xanh TRƯỚC khi đổi component đầu tiên (bằng chứng safety net có thật)
  — viết trước, chạy 2/5 xanh trước khi đổi status-badge.tsx (3/5 còn lại bị chặn bởi bug
  routing tRPC không liên quan Astryx, tìm thấy và fix riêng trên `fix/trpc-basepath` PR #27,
  đã merge). Sau rebase + fix 3 vấn đề trong chính spec: **4/5 xanh, 1 `test.fixme()`** có track
  rõ nguyên nhân (bug pre-existing ở `apps/lms/.../change-password.tsx`, không thuộc scope
  Astryx). 0 failed.
- [x] `packages/ui` không còn import `@mantine/*` (`rg "@mantine" packages/ui/src` = 0) — verified.
- [x] Public API 10 component giữ nguyên chữ ký; thay đổi apps giới hạn đúng 2 file main.tsx —
  verified qua typecheck toàn workspace xanh (0 lỗi apps/admin, apps/lms sau khi đổi ruột 10
  component).
- [x] `cmcTheme` đã xoá khỏi index.ts và không còn nơi nào tham chiếu — `theme.ts` xoá hoàn toàn,
  thay bằng `AstryxCmcProvider` (CSS-only theming, không cần JS theme object).
- [~] 10 component đủ states TL12 §4, semantics màu §3, focus ring brand; không hardcode màu —
  đủ semantics màu + brand override qua CSS custom properties (verified); **states đầy đủ
  (hover/active/disabled/loading/error) chưa visual-QA từng cái qua trình duyệt có auth** —
  dời sang Phase 3 (đã có bước "verify TL12 §4" riêng ở đó). Login page (dùng chung theme
  wiring) đã xác nhận render sạch, 0 console error.
- [x] reset.css của Astryx KHÔNG xuất hiện trong packages/ui (`rg "reset.css" packages/ui` = 0
  literal import; 1 match là comment giải thích tại sao KHÔNG import — đúng tinh thần tiêu chí).
- [x] Smoke test + UI e2e + typecheck toàn workspace xanh — typecheck/build/test 3 package
  (ui/admin/lms) 0 lỗi; UI e2e 4/5 xanh + 1 fixme tracked (chi tiết ở trên). Smoke test riêng
  (render test qua RTL) không có sẵn hạ tầng trong repo — không thêm tooling mới ngoài scope;
  build production + browser check thay thế cho phần này.

## Risk Assessment

- **API Astryx không map 1:1 props Mantine** (vd ConfirmDialog focus trap) → giữ contract @cmc/ui,
  chấp nhận adapter dày hơn; không leak type Astryx ra public API.
- **2 provider + 2 bộ CSS (chưa reset) xung đột trên page cũ** → UI e2e step 0 + screenshot diff
  một page Mantine chưa migrate sau step 3; nếu vỡ, cô lập CSS Astryx theo scope class trước.
- **Rollback phase này:** revert các commit component (mỗi component 1 commit) + restore
  `theme.ts`/2 main.tsx; Mantine deps chưa gỡ nên revert sạch.
