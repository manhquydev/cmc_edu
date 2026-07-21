---
phase: 4
title: "Migrate apps/lms"
status: completed
effort: "3-5 ngày"
priority: P1
dependencies: [2, 3]
---

# Phase 4: Migrate apps/lms

## Overview

Migrate cổng LMS (phụ huynh + học sinh) sang Astryx, dùng lại bảng quy đổi + adapter Phase 3.
LMS mobile-first, ít màn hơn admin nhưng có màn nhạy cảm nhất về đặc tả VÀ bảo mật: **login 2-tab
TL12 §9** — phải giữ đúng behavior lẫn **hardening attributes của form auth** (red-team F11).

## Requirements

- Functional: mọi flow LMS giữ nguyên — login 2-tab, ProfilePicker ≥2 con, dashboard PH/HS,
  homework results, attendance, change-password, consent settings, exercise, gifts.
- Non-functional: `rg "@mantine" apps/lms/src` = 0 (deps package.json giữ đến Phase 5);
  mobile-first đạt TL12 §7; touch target ≥44px.

## Architecture

- Thứ tự: `main.tsx` → `pages/login.tsx` (rủi ro đặc tả + bảo mật cao nhất, làm sớm) →
  parent pages → student pages. Reset flip ở cuối phase (như Phase 3).
- Login 2-tab: behavior + security contract chép thành case list TRƯỚC khi migrate (steps).

## Related Code Files

- Modify: `apps/lms/src/main.tsx` (reset.css flip cuối phase)
- Modify: `apps/lms/src/pages/login.tsx` (đặc tả TL12 §9 + hardening attrs tại login.tsx:113-115,185)
- Modify: `apps/lms/src/pages/parent/*.tsx`, `apps/lms/src/pages/student/*.tsx`,
  `apps/lms/src/routes/index.tsx` (danh sách chốt bằng `rg -l "@mantine" apps/lms/src` lúc thực thi)
- KHÔNG sửa: `apps/lms/package.json` deps @mantine (giữ đến Phase 5)

## Implementation Steps

1. Chốt case list login 2-tab TRƯỚC khi đụng code — behavior (TL12 §9): tab mặc định PH; deep-link
   `?tab=student`; OTP loading + cooldown 60s; BLOCKED-ON-COMMS khi `EMAIL_TRANSPORT=console`;
   mustChangePassword redirect; lỗi generic không lộ tồn tại tài khoản; 1 con → dashboard, ≥2 con
   → ProfilePicker. **Auth-parity (red-team F11):** giữ nguyên `autoComplete="one-time-code"`,
   `inputMode="numeric"`, `maxLength={6}` (OTP field — hiện tại login.tsx:113-115),
   `autoComplete="current-password"` (login.tsx:185); OTP không echo ra DOM/console/network ngoài
   submit; text + timing lỗi generic đồng nhất giữa 2 tab. Đối chiếu case list với
   `lms-login.ui.spec.ts` (Phase 2) — bổ sung case thiếu vào spec.
2. Migrate `login.tsx`; chạy đủ case list (e2e UI spec + manual) trước khi đi tiếp.
3. Migrate parent pages → student pages, mỗi cụm chạy
   `pnpm --filter @cmc/lms typecheck && pnpm --filter @cmc/lms build` + UI e2e.
4. Flip `reset.css` ở main.tsx khi trang cuối xong + blocking check màn login (focus-visible ring,
   disabled/pointer-events nút "Gửi mã OTP" và nút đăng nhập).
5. Visual QA mobile-first: viewport 360px + 768px; touch target ≥44px; typography đọc được.
6. Chạy toàn bộ e2e LMS: API specs + `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`.

## Success Criteria

- [x] `rg "@mantine" apps/lms/src` = 0 import thật (chỉ main.tsx có comment). deps giữ đến Phase 5.
- [x] Case list login 2-tab pass đủ + auth-parity attrs — **e2e-verified landing trên DOM thật**
      (test mới "auth-field hardening attrs survive" trong lms-login.ui.spec.ts: OTP
      one-time-code+inputMode numeric+maxLength 6, password current-password, phone tel, email;
      grep login.tsx = 6 match). OTP không leak (review confirm: `code` chỉ vào mutate, 0 console/DOM/URL).
      Fix cần thiết: xây @cmc/ui `TextField` (type+forward inputMode/maxLength/autoComplete qua
      Astryx TextInput ...rest passthrough đã verify) + `PasswordInput` (Astryx thiếu — spike gap).
- [x] typecheck + build @cmc/lms xanh; API e2e (17 pass) + UI e2e (5 pass + 1 fixme đã biết) xanh.
- [~] Sau reset flip: reset áp dụng (body margin 0), disabled nút inert (not-allowed/opacity .5).
      **Focus ring**: Astryx TextInput wrapper focus box-shadow render transparent dưới theme CMC
      (input keyboard-focus match :focus-visible nhưng không hiện ring) → thêm rule `:focus-visible`
      outline brand vào astryx-theme-cmc.css (verified present trong built CSS; xác nhận visual trên
      thiết bị thật thuộc deep QA dời sau — automation không trigger được real keyboard focus).
- [~] Visual QA mobile 360px TL12 §7 — Astryx default control ~32px < 44px touch target → thêm
      `@media (max-width:768px) min-height:44px` cho text input + button (verified present trong CSS;
      xác nhận visual mobile thật thuộc deep QA dời sau — automation không cho viewport mobile thật).

## Completion — 2026-07-10

13 file lms migrate (login + 10 parent/student + routes + main.tsx reset flip). Login (nhạy cảm
bảo mật nhất) làm tay, không delegate; parent/student delegate fullstack-developer subagent.
**@cmc/ui thêm 2 composite lấp gap Astryx**: `TextField` (input attrs cho auth) + `PasswordInput`
(Astryx thiếu) + `ProgressBar` re-export. Code-review (code-reviewer subagent): **Approve**, 0
Critical, 1 Important (fragility: hardening dựa vào Astryx ...rest passthrough undocumented → mitig:
pin exact 0.1.4 ✓ + e2e attr test non-skippable ✓), 2 suggestion (1 đã áp: scope touch rule).
Lint one-door mở rộng apps/lms. main.tsx bỏ MantineProvider + thêm @astryxdesign/core devDep cho
reset import.

**Flag đáng chú ý (documented)**: Astryx TabList render tab = plain button (không role=tab/
aria-selected) → a11y regression vs Mantine, beta-Astryx limit, ghi trong spec; focus-ring +
touch-target Astryx default không đạt → fix mức theme CSS (không fork component).

## Risk Assessment

- **Regression đặc tả/bảo mật login** → case list + auth-parity ở step 1 là bắt buộc; không
  migrate login trước khi có case list. Security review sign-off cho form login mới.
- **LMS parent là mặt tiền thương hiệu** → nếu theme CMC trên Astryx trông "lạ" so admin, xử lý ở
  mức token (spacing/typography scale), không fork component riêng cho LMS.
- **Rollback:** mỗi cụm 1 commit; Mantine deps còn nguyên → revert cụm nào cũng chạy lại được.
