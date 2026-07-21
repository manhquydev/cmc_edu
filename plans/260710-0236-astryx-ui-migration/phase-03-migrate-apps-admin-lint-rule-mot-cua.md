---
phase: 3
title: "Migrate apps/admin + lint rule mot cua"
status: completed
effort: "6-10 ngày"
priority: P1
dependencies: [2]
---

# Phase 3: Migrate apps/admin + lint rule "một cửa"

## Overview

Quét các file trong `apps/admin` đang import trực tiếp `@mantine/core` (~47 file app toàn repo,
phần lớn ở admin — chốt danh sách bằng grep lúc thực thi), thay bằng component `@cmc/ui` hoặc
primitive Astryx. Thiết lập lint rule cấm app import thư viện UI trực tiếp — mọi UI qua một cửa
`@cmc/ui`. Lưu ý red-team F8: Phase 2 chỉ de-risk 10 component shared; toàn bộ file import trực
tiếp vẫn phải migrate tay ở đây — effort đã re-baseline 6–10 ngày.

## Requirements

- Functional: mọi màn admin giữ nguyên hành vi; shell/AppShell, form, modal hoạt động tương đương.
- Non-functional: sau phase này `rg "@mantine" apps/admin/src` = 0 (dependency trong package.json
  GIỮ NGUYÊN đến Phase 5 — rollback policy); lint rule chặn tái phát.

## Architecture

- **Inventory primitive thật (grep-verified, red-team F7)** — bảng quy đổi phải phủ:
  Text(22), Group(21), Stack(18), Button(14), Badge(9), Box(8), Alert(8), Title(6), TextInput(6),
  Loader(6), Skeleton(5), Modal(5), Select(4), ScrollArea(2), Grid(2), Anchor(2), và single-use:
  **AppShell**, Breadcrumbs, NavLink, MultiSelect, NumberInput, Table, SimpleGrid, Paper, Card,
  Container, Center, Divider, Textarea, Tabs.
  KHÔNG có Notification/Toast, Menu, useDisclosure, @mantine/notifications/dates/form/modals
  (0 usage — không xây adapter cho thứ không dùng). `@mantine/hooks` là phantom dep (0 import) —
  chỉ gỡ ở Phase 5, không có code để migrate.
- **Thứ tự risk-first:** `AppShell` + shell/navigation (`apps/admin/src/shell/shell.tsx`) TRƯỚC
  TIÊN — khung này chặn mọi màn admin; sau đó login/SSO screens → từng khu vực nghiệp vụ
  (sale/CRM → giáo vụ → tài chính → payroll/khác).
- **Reset flip:** khi khu vực cuối của admin xong → import `@astryxdesign/core/reset.css` vào
  `apps/admin/src/main.tsx` (theo red-team F14, reset không nằm trong @cmc/ui). Ngay sau flip:
  kiểm blocking các màn auth — focus-visible ring, disabled + pointer-events trên nút submit.
- Lint: ESLint `no-restricted-imports` cấm `@mantine/*` và `@astryxdesign/core` trong `apps/**`
  (app chỉ import `@cmc/ui`; ngoại lệ whitelist: provider/CSS ở entry `main.tsx`).
- CLI (nếu cần codemod): `pnpm --filter @cmc/admin exec astryx …` — không `npx` trần.
- Branch: tiếp tục trên `feat/astryx-migration`; rebase main theo cadence plan.md.

## Related Code Files

- Modify: `apps/admin/src/shell/shell.tsx` (AppShell — làm đầu tiên)
- Modify: `apps/admin/src/main.tsx` (reset.css flip ở cuối phase)
- Modify: toàn bộ file match `rg -l "@mantine" apps/admin/src` (chốt danh sách lúc thực thi)
- Create/Modify: cấu hình ESLint monorepo (`no-restricted-imports` cho apps/**)
- Delete: `apps/admin/src/pages/sandbox/astryx-spike.*` (hết vai trò tham chiếu)
- KHÔNG sửa: `apps/admin/package.json` deps @mantine (giữ đến Phase 5)

## Implementation Steps

1. Chốt bảng quy đổi primitive→Astryx từ inventory Architecture + spike findings, lưu vào
   `plans/260710-0236-astryx-ui-migration/reports/mantine-astryx-mapping.md` — dùng chung Phase 4.
   Đánh dấu primitive Astryx thiếu → bổ sung component vào @cmc/ui trước khi migrate khu vực dùng nó.
2. Migrate `shell.tsx` (AppShell + navigation) trước tiên; chạy UI e2e admin-shell spec — đây là
   điểm rủi ro cao nhất, fail ở đây thì dừng đánh giá lại trước khi lan ra các khu vực.
3. Migrate login/SSO screens rồi từng khu vực nghiệp vụ; mỗi khu vực 1 PR/commit cụm, sau mỗi cụm:
   `pnpm --filter @cmc/admin typecheck && pnpm --filter @cmc/admin test && pnpm --filter @cmc/admin build`
   + `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`.
4. Màn nào lộ thiếu states TL12 (skeleton, empty, error) — bổ sung luôn trong lúc migrate
   (trả nợ UX, không redesign layout).
5. Khi khu vực cuối xong: flip `reset.css` ở main.tsx + kiểm blocking màn auth (focus ring,
   disabled/pointer-events) + screenshot diff các màn chính.
6. Thêm ESLint `no-restricted-imports`; chạy lint toàn repo; fix vi phạm còn sót.
7. Visual QA từng khu vực theo checklist TL12 §10 trên desktop + tablet (điểm danh/chấm bài GV
   dùng tablet — TL12 §7).

## Success Criteria

- [x] Bảng quy đổi mantine-astryx-mapping.md phủ đủ inventory ~25 primitive thật (grep-verified 34
  file admin; không có Notification/Menu). Lưu tại `reports/mantine-astryx-mapping.md` (local).
- [x] `rg "@mantine" apps/admin/src` = 0 file có import thật (chỉ 1 match là comment trong
  main.tsx). deps package.json giữ nguyên — gỡ ở Phase 5.
- [x] Lint rule "một cửa" hoạt động: `eslint.config.js` (minimal flat config, chỉ bật
  no-restricted-imports) chặn import `@mantine/*` + `@astryxdesign/*` trong apps/admin/** (trừ
  whitelist main.tsx). Verified negative-test: cả 2 import bị chặn với message; `pnpm lint`
  exit 0 trên admin. (Scope apps/admin cho giờ; mở rộng apps/lms ở Phase 4.)
- [x] typecheck + test + build @cmc/admin xanh; UI e2e xanh sau mỗi cụm (mỗi cụm 1 commit,
  gate typecheck/build; UI e2e cuối 4/4 pass + 1 fixme đã biết). Đổi ruột qua single-door barrel
  `@cmc/ui/primitives`.
- [x] Sau reset flip: màn auth giữ focus-visible ring + disabled/pointer-events đúng (blocking
  check qua browser: body margin=0 reset áp dụng; focus ring `outline solid 1.6px #0071E3` brand;
  nút disabled = native disabled attr + not-allowed cursor + opacity .5 → inert). PASS.
- [~] Visual QA mọi màn admin đạt TL12 §10 (desktop + tablet) — login page verified sạch qua
  browser (0 console error, theme/brand/reset đúng); **QA đầy đủ mọi màn admin có auth (desktop
  + tablet, TL12 §10 checklist) chưa chạy hết** — cần API server chạy để vào các màn sâu. Các
  `TODO(astryx-review)` (màu semantic, prop cosmetic mất) đánh dấu in-code để polish. Dời phần QA
  visual sâu sang Phase 5 (full e2e QA) hoặc user tự chạy.
- [x] Sandbox spike đã xoá (apps/admin/src/pages/sandbox + dev routes gỡ khỏi routes/index.tsx).

## Completion — 2026-07-10

36 file migrate (shell/role-switcher/login/coming-soon/2 routes + 5 cụm nghiệp vụ) qua barrel
single-door mới `@cmc/ui/primitives`. Code-review (code-reviewer subagent): **Approve**, 0
Critical/0 Important — barrel/shell/reset-flip/lint-rule verified sound, 3 page spot-check faithful.
Các cụm nghiệp vụ delegate cho fullstack-developer subagent (tuần tự, mỗi cụm gate typecheck).
main.tsx: bỏ MantineProvider + mantine styles (admin 0 Mantine component) + flip reset.css — @mantine
deps giữ trong package.json đến Phase 5. eslint + typescript-eslint + eslint-formatter-compact thêm
làm devDep (repo trước đó chưa có lint nào).

## Risk Assessment

- **AppShell là single point of failure** → làm đầu tiên (step 2) khi chưa sunk cost; nếu Astryx
  không có tương đương đạt yêu cầu, dừng và báo user trước khi migrate page nào.
- **Modal focus-trap/z-index khác biệt** → Modal(5 usage) migrate qua ConfirmDialog/@cmc/ui khi
  hợp; usage đặc thù thì test keyboard-nav từng chỗ.
- **Rollback:** mỗi khu vực 1 commit cụm → revert theo cụm; restore điểm gần nhất là commit trước
  `shell.tsx`. Mantine deps còn nguyên nên page revert về Mantine chạy lại được ngay.
- **Scope creep polish** → chỉ bổ sung states TL12 còn thiếu, không redesign trong phase này.
