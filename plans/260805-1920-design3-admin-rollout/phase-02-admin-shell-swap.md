---
title: "Phase 2: Admin Shell Swap"
status: in-progress
priority: P1
effort: "2w"
dependencies: [1]
---

# Phase 2: Admin Shell Swap

## Overview

Thay AppFrame + SideNav bằng Odoo shell cho mọi route sau đăng nhập. PR
blast-radius lớn nhất plan. **Tiền đề cứng: geofence plan đã merge** (cùng sửa
`checkin-offsite-approval` spec). E2E coupling thật (red-team verified): 30
specs qua `menuNav`, 7 specs bind thẳng `.sh-main`/`.sh-content`, 1 spec pin
chrome (`admin-shell.ui.spec.ts`) — tất cả xử lý trong CÙNG PR.

## Requirements

- Functional: điều hướng đủ mọi route như hiện tại; permission filtering giữ
  hành vi (cả navbar LẪN CommandPalette); role-switcher/user-menu/logout trong
  systray; ⌘K palette + nút "Tìm" còn hoạt động.
- Non-functional: root shell gắn `.o_web_client`; `/login` không đổi.
  **`change-password` vào Shell ở CHẾ ĐỘ ẨN CHROME** (decision 10 + 10b):
  route chuyển vào children của Shell, nhưng khi `me.mustChangePassword` true
  shell render KHÔNG navbar/app-switcher/⌘K/systray (lý do trang này vốn ngoài
  Shell: forced rotation phải xong mới được vào app — `routes/index.tsx:26-28`;
  server KHÔNG enforce cho staff: `login.tsx:51-52` "client hint",
  `assertPasswordNotExpired` student-only 0 caller). Test bắt buộc: jsdom
  render shell với `mustChangePassword=true` → 0 nav affordance; e2e smoke:
  user bị ép đổi không điều hướng đi đâu được ngoài trang đổi mật khẩu.
  <!-- Updated: Validation S1 + Red-team R2 - chrome-suppressed mode -->
- Security: guard `me ?` giữ nguyên (Shell render cho anonymous qua allow-list
  `/design`,`/design2` trong RequireAuth); RoleSwitcher giữ guard
  `import.meta.env.PROD → null`.

## Architecture

**Cấu trúc auth thật (sửa từ bản v1):** `RequireAuth` KHÔNG nằm trong
`shell.tsx` — nó ở `apps/admin/src/routes/index.tsx:31`, wrap `<Shell/>` từ
ngoài (`:77`), và allow-list `/design`,`/design2` TRƯỚC check `!me` (`:35-38`).
`shell.tsx` giữ guard load-bearing `const modules = me ? visibleModulesFor(...)
: []` (`shell.tsx:34`) — shell mới PHẢI giữ nhánh anonymous này.

**Mapping nav-registry → Odoo shell:**
- Top-level NAV_MODULES = app trong app-switcher. **Rule cho module không có
  `children`** (cockpit: chỉ `path`): chọn app = navigate thẳng `mod.path`,
  không render section menu (khớp `visibleNavPathsFor` fallback
  `nav-registry.ts:176-182`).
- Module có children: chọn app → navigate `mod.path`; children đã qua
  `isChildVisible` render thành menu ngang navbar.
- Active app: dùng `activeModuleId` từ `packages/ui/src/lib/active-module.ts`
  (đây mới là logic resolve — `nav-route-resolution.test.ts` chỉ assert path
  có trong router, không phải resolve).
- **Permission:** navbar nhận `isChildVisible={(c) => isNavChildVisible(c, canDo)}`
  (bắt buộc per Phase 1); **CommandPalette** (`shell.tsx:40-94`) — bề mặt
  permission-filtered thứ hai — giữ nguyên nguồn items đã filter, cấm derive từ
  raw NAV_MODULES.
- Systray: RoleSwitcher (restyle tối thiểu, GIỮ guard PROD `role-switcher.tsx:21`
  + unit test stub PROD=true → render null, không wrapper thừa), user menu,
  logout, nút "Tìm" ⌘K, CTA thu-học-phí gated `canDo('finance','receiptCreate')`
  (`shell.tsx:175-179`) — quyết vị trí mới cho CTA này (systray hoặc control
  panel trang finance; không được rơi mất).
- Breadcrumb/control panel theo trang: Phase 3. Phase 2 chỉ navbar + bỏ side rail.

**E2E đồng bộ trong CÙNG PR (inventory đã sửa):**
1. `menu-nav.ts` — redesign SEMANTICS, không chỉ selector: mô hình cũ 2-click
   expand-tại-chỗ → mô hình mới navigate-then-select. Giữ chữ ký
   `menuNav(page, module, child)` nhưng viết lại ruột; thêm rule module không
   children.
2. **`assertEntryAbsent` redesign (không phá điều hướng):** absence phải chứng
   minh SAU khi mở switcher/section menu, không dựa `count()===0` (dưới
   dropdown mọi thứ count=0 → test ma). Settle signal mới: switcher panel mở +
   app "Tổng quan" hiện. **Canary bắt buộc trước merge:** tạm cấp quyền gift
   cho `sale` local → `gift-config-nav` PHẢI đỏ → revert.
3. Thêm landmark ổn định cho vùng content (`<main>` role hoặc data-testid) rồi
   sửa 7 specs bind `.sh-main`/`.sh-content` một lượt: `crm-receipt`,
   `shift-register-approve-reject`, `checkin-punch`, `checkin-offsite-approval`,
   `grading-submission`, `lms-grade-parent-view`, `lms-stars-redeem-cycle`.
4. `admin-shell.ui.spec.ts` — viết lại theo chrome mới, quyết từng assertion:
   brand text (1 dòng thay vì "CMC EDU"+"Admin"), role badge, "Tổng quan" chỉ
   visible sau khi mở switcher, nav click qua switcher thay vì text trực tiếp.
5. Regenerate `apps/e2e/screen-role-matrix.json` (`scan-nav-entries.ts` parse
   nav-registry) nếu nav-registry đổi shape — commit trong cùng PR.

## Related Code Files

- Modify: `apps/admin/src/shell/shell.tsx` (navbar + palette + systray + guard
  anonymous), `apps/admin/src/routes/index.tsx` (nếu cần wiring),
  `apps/admin/src/shell/role-switcher.tsx` (+test PROD guard),
  `apps/admin/src/shell/nav-registry.ts` (tránh đổi shape nếu được),
  `apps/e2e/src/journey/menu-nav.ts`, 7 journey specs trên,
  `apps/e2e/tests/admin-shell.ui.spec.ts`, `apps/e2e/screen-role-matrix.json`
  (nếu regen).
- Keep green (đúng bản chất): `nav-registry.test.ts`,
  `nav-route-resolution.test.ts`, `active-module.test.ts` — đều pure-function,
  KHÔNG chứng minh render → thêm **jsdom render test cho shell mới**: (a)
  `me=null` không throw, 0 apps; (b) child bị gate không render; (c) systray
  không lộ RoleSwitcher khi PROD.

## Implementation Steps

1. Verify geofence trên main (`git log main --grep=geofence` — đã merge tại
   `f7bf662`, PR #64; spec checkin-geofence KHÔNG tồn tại, đã bỏ ở `83b59b0`);
   rebase.
2. Đọc `shell.tsx` + `routes/index.tsx` + `active-module.ts` chốt contract.
3. Dựng shell mới `.o_web_client` → OdooNavbar → `<main>` landmark → outlet.
4. Render tests jsdom (3 case trên).
5. Redesign `menu-nav.ts` + `assertEntryAbsent`; sửa 7 specs + admin-shell spec.
6. Chạy ui-e2e local (PLAYWRIGHT_UI recipe) tới xanh; chạy canary permission.
7. Kiểm tay: mỗi module mở ≥1 trang; deep-link (TL6) giữ; refresh giữ active
   app; đếm entry switcher = đếm từ nav-registry (test tự động).
8. PR: `feat(admin): replace side-nav shell with odoo navbar + app-switcher`.

## Success Criteria

- [x] Mọi route sau login dưới `.o_web_client` + OdooNavbar (code + jsdom)
- [x] `grep -rn "AppFrame\|SideNav" apps/admin/src/shell/shell.tsx` = 0
      (repo-wide design-lab prose deferred to Phase 6)
- [ ] ui-e2e: không journey tụt so main; canary `gift-config-nav` chứng minh đỏ
      được rồi xanh lại  **← merge gate still open**
- [ ] CommandPalette permission-filtered jsdom test (code yes; dedicated test TBD)
- [x] Login bit-identical; `change-password` trong shell ẩn-chrome theo path
      (jsdom); e2e smoke forced-rotation still open; anonymous `/design` me=null ok
- [ ] RoleSwitcher PROD-guard unit test (code yes; dedicated test TBD); matrix
      regen N/A (nav-registry shape unchanged)

## Risk Assessment

- **E2E vỡ ngoài inventory:** inventory đã grep-derive (30+7+1); nếu phát sinh
  ngoài danh sách → dừng, grep lại, cập nhật phase trước khi sửa tiếp.
- **Nới assertion để cho qua:** cấm — canary + jsdom render tests là chốt chặn.
- **CTA thu-học-phí rơi mất:** nằm trong checklist systray, có success criterion
  qua kiểm tay bước 7.
- Rollback: revert PR duy nhất; shell cũ nguyên trạng.
