---
title: "Phase 1: Odoo UI Layer in @cmc/ui"
status: completed
priority: P1
effort: "2w"
dependencies: []
---

# Phase 1: Odoo UI Layer in @cmc/ui

## Overview

Dựng lớp odoo trong `packages/ui/`: port tokens từ `design-lab-3.css`, tạo MỚI
chỉ 2 component chưa tồn tại (`OdooNavbar`, `KanbanBoard`), chuẩn bị restyle
tại chỗ cho `ControlBar`/`ProgressSteps` (đã có từ plan 260803-2043 — KHÔNG xây
trùng). Kèm 3 việc nền tảng phải chốt sớm: DEV-gate `/design3`, remap Astryx
theme vars (proof), promote docs (contract Phase 0).

## Requirements

- Functional: `import { OdooNavbar, KanbanBoard } from '@cmc/ui'`; tokens
  `--odoo-*` hoạt động dưới scope `.o_web_client`.
- Non-functional: LGPL-3 attribution giữ nguyên; không rule nào ở `:root`
  (nguồn `design-lab-3.css` đã scope `.odoo-lab-root`, không có `:root` — giữ
  tính chất đó); light-only; Inter; accent `#0071E3`.
- **Security:** `OdooNavbar` nhận gate permission **bắt buộc**
  `isChildVisible: (child) => boolean` — không optional, không default
  fail-open (SideNav hiện tại fail-open qua callback optional:
  `side-nav.tsx:19-20,35` — không lặp lại lỗi này).
- **Security:** `/design3` DEV-only (`import.meta.env.DEV`) + fixture-data-only.

## Architecture

- **CSS:** `packages/ui/src/odoo.css` — port từ `design-lab-3.css` (535 dòng),
  prefix `.odoo-lab-*` → `.o-*`, scope toàn bộ dưới `.o_web_client`. Thêm
  export `"./odoo.css"` vào `packages/ui/package.json` (cả `exports` VÀ mảng
  `files` — soi cách `premium.css` làm).
- **Import point (chỉ định rõ):** `apps/admin/src/main.tsx`, NGAY SAU
  `premium.css` (thứ tự: reset → tokens → astryx-theme → premium → **odoo** →
  app.css) để odoo override premium trong scope khi Phase 3 cần.
- **Astryx theme remap (load-bearing cho Phase 3; round-2 corrected):** phải
  remap **CẢ HAI họ biến** dưới `.o_web_client` — `--font-size-*` (nguồn:
  theme định nghĩa `--text-heading-N-size: var(--font-size-*)` bằng indirection
  TẠI provider, nên override một họ không lan sang họ kia) VÀ `--text-*-size` /
  `--text-*-weight` / `--text-*-leading`, cùng `--color-text-*`, font-family
  Inter. Lý do: `@layer reset` style thẳng thẻ raw (`h1-h6/p/small` — admin có
  106+ thẻ raw) từ `--font-size-*`; astryx.css còn 21 chỗ `var(--font-size-*)`
  trong ruột Badge/Button/Table. **Proof bắt buộc:** trang thử phải chứa
  `Text`/`Heading` + thẻ raw `h1-h6/p/small` + Badge + Button + DataTable;
  điều kiện đạt = **assertion computed-style đo được** (14/13/12px), không
  phải screenshot. Fail → dừng, cập nhật plan trước Phase 2 (Phase 3 sụp nếu
  giả định này sai).
- **Components mới (`packages/ui/src/odoo/`):**
  - `odoo-navbar.tsx` — navbar 46px purple + app-switcher dropdown (text-list)
    + systray slot. Props: `{ apps: NavModule[]; activeAppId: string | null;
    isChildVisible: (child) => boolean; systray?: ReactNode }`.
  - `odoo-kanban.tsx` — `KanbanBoard/KanbanColumn/KanbanCard`, left-bar accent
    `--odoo-kanban-color-1..6`. (Chưa tồn tại — plan 260803-2043 ghi non-goal,
    nay user phê duyệt xây cho pilot CRM.)
- **KHÔNG tạo mới (restyle tại chỗ, CSS ở Phase 3):** `ControlBar` (ListPage
  compose sẵn), `WorkflowStatusbar`/`ProgressSteps` (chevron clip-path áp qua
  class `.o-steps` lên ProgressSteps), `DataTable` (`.o-list`).
- **`/design3`:** DEV-gate route + repoint page sang component mới. Page tự
  wrap root bằng `.o_web_client` (đây là carrier của scope trước khi Phase 2
  gắn class vào shell). Ràng buộc fixture-only: test cấm `design-lab-3.tsx`
  import `nav-registry` / session context / tRPC.

## Related Code Files

- Create: `packages/ui/src/odoo.css`, `packages/ui/src/odoo/odoo-navbar.tsx`
  (+`.test.tsx`), `odoo-kanban.tsx` (+`.test.tsx`),
  `packages/ui/src/odoo/odoo-tokens.test.ts`
- Modify: `packages/ui/package.json` (exports + files),
  `packages/ui/src/index.ts`, `apps/admin/src/main.tsx` (import odoo.css),
  `apps/admin/src/routes/index.tsx` (DEV-gate `/design3`),
  `apps/admin/src/pages/design-lab-3.tsx` (repoint + wrap `.o_web_client`),
  `apps/admin/src/pages/design-lab-3.css` (rút còn demo-only),
  `docs/12-design-system-ui.md` (banner superseded-for-admin, rollout in
  progress), tạo `docs/design-system-odoo.md` (promote candidate, trạng thái
  "rollout in progress")
- Delete: none (dọn ở Phase 6)

## Implementation Steps

1. Baseline: chạy `pnpm acceptance:report`, lưu **danh sách per-flow-id** vào
   PR description (không phải 1 tỷ số).
2. DEV-gate `/design3` trong `routes/index.tsx` + test guard fixture-only.
3. Port CSS → `odoo.css` (prefix `.o-*`, scope `.o_web_client`, giữ attribution
   + commit Odoo 19.0). Grep kiểm: `:root` trong odoo.css = 0 hit.
4. Astryx theme remap + **proof screenshot** (điều kiện đi tiếp).
5. Tách `OdooNavbar` + `KanbanBoard` từ JSX lab, props hoá data hardcode.
   Unit test OdooNavbar: render module có child bị gate → assert VẮNG MẶT.
6. Exports + build; repoint `/design3`; so mắt trước/sau.
7. Docs: banner TL12 + promote candidate doc (trạng thái in-progress).
8. Ghi chú quyết định gate `check-ui-frames`: các PR sau re-point assertion
   trong cùng PR đổi surface (quy tắc ở plan.md).
9. PR: `feat(ui): extract design3 odoo layer into @cmc/ui`.

## Success Criteria

- [x] OdooNavbar + KanbanBoard import được; test gate-child-absent xanh
- [x] Proof Astryx remap đạt: computed-style assertions trên trang thử gồm cả
      thẻ raw + Badge/Button/DataTable stand-ins (font-size cascade proof)
- [x] `/design3` không truy cập được ở prod build; test fixture-only xanh
- [x] `grep ":root" packages/ui/src/odoo.css` = 0; LMS build + render không đổi
- [x] Docs promote xong (in-progress status); baseline per-flow đã lưu
- [x] Unit/typecheck xanh local (`@cmc/ui` 113 tests; admin fixture tests)

## Risk Assessment

- **Astryx remap không phủ hết:** phát hiện ngay ở proof step 4 (trước mọi
  cam kết Phase 3) — nếu fail, phương án là restyle qua `xstyle` prop/theme
  provider của Astryx, cập nhật plan.
- **Scope leak → LMS:** mọi rule dưới `.o_web_client`; LMS không có class đó.
- **Parity drift khi props-hoá:** giữ markup 1-1; diff mắt trên `/design3`.
- Rollback: revert PR — chưa surface production nào tiêu thụ lớp odoo.
