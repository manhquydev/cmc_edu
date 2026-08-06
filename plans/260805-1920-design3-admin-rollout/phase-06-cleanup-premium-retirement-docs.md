---
title: "Phase 6: Cleanup, Premium Retirement, Docs"
status: in-progress
priority: P2
effort: "2-3w"
dependencies: [5]
---

# Phase 6: Cleanup, Premium Retirement, Docs

## Overview

Ba việc, ba PR riêng: (A) census + port nốt premium classes rồi gỡ import khỏi
admin (user chốt: **port đủ rồi mới gỡ** — đây KHÔNG phải cleanup 1 tuần:
premium.css 2.274 dòng nuôi ~34 component `@cmc/ui`, admin dùng trực tiếp 202
class `ck-*`); (B) xoá design-lab pages; (C) chốt docs + so baseline acceptance.

## Requirements

- Functional: admin không import `premium.css` và KHÔNG mất style nào; LMS giữ
  `premium.css` nguyên trạng — **CẤM mutate file premium.css** (LMS import nó:
  `apps/lms/src/main.tsx:20`); port = copy rule sang `odoo.css` scope
  `.o_web_client`, không move.
- Non-functional: negative claim phải kèm scope check đúng chỗ — consumer của
  premium class nằm trong `packages/ui/src/components/` (49 file tham chiếu
  `ck-`), KHÔNG chỉ trong `apps/admin/src`.

## PR A — Premium retirement (port-then-remove)

**Audit đúng (thay cho grep sai ở bản v1):**
```
grep -rn "ck-\|tpl-\|sh-" packages/ui/src/components apps/admin/src
```
1. Census: liệt kê từng class còn được emit bởi component mà admin render
   (sau Phase 3/5, 10 component chính đã port — còn lại: MetricCard, Panel,
   CommandPalette, BulkActionBar, Callout, KeyValueList, SectionBlock,
   HighlightStrip, Avatar, ActivityTimeline, ListPagination, WeekSchedule,
   FocusCard, TaskRow, FunnelBar, session-card, các `sh-cta`… + 202 class
   `ck-*` viết thẳng trong markup admin).
2. Port từng nhóm sang `odoo.css` (component nào LMS cũng dùng qua primitives
   thì chỉ port bản scoped `.o_web_client`, KHÔNG đụng rule gốc).
3. **Gate gỡ import:** chỉ khi census = 0 class unreachable-unported. Gỡ
   `import '@cmc/ui/premium.css'` khỏi `apps/admin/src/main.tsx:20`.
4. Duyệt mắt smoke TOÀN admin (mọi module ≥1 trang) — ui-e2e không bắt được
   vỡ style (selectors role/text; "CI green, prod broken" là pattern đã ghi
   nhận của repo này).

## PR B — Xoá design-lab

**Inventory đúng (18 file, không phải 13; chỉ 3 route):**
- Xoá 16 file `design-lab*` (trừ cặp `design-lab-3.*`): `design-lab.tsx/.css`,
  `design-lab-2.*`, `design-lab-styles.*`, `design-lab-upgrade.*`,
  `design-lab-wireframes.*`, `design-lab-xia.*`, `design-lab-redteam.*`,
  `design-lab-layout-knowledge.*` — lưu ý 6 file là PANEL import bởi
  `design-lab.tsx:67-72`, xoá theo cụm để không gãy typecheck.
- `apps/admin/src/routes/index.tsx`: xoá route `/design`, `/design2` VÀ **xoá
  nhánh allow-list trong RequireAuth (`:35-38`) trong CÙNG commit** — nếu để
  sót, path rơi vào `*`→ComingSoon bên trong Shell với auth-bypass còn nguyên.
  Success criterion: RequireAuth không còn pathname allow-list nào.
- `apps/admin/src/shell/shell.tsx`: xoá 3 palette entries `/design*`
  (`:63-81,152-168` bản cũ — vị trí mới xác nhận sau Phase 2).
- `scripts/check-ui-frames.mjs` (round-2): dọn `EXEMPT` set (8 tên design-lab
  hardcode `:17-28` sẽ trỏ file không tồn tại; `design-lab-2/3.tsx` hiện NẰM
  TRONG corpus quét — xoá chúng đổi counts). Chạy `pnpm check:ui-frames --json`
  TRƯỚC và SAU xoá, dán delta vào PR description.
- `design-lab-3.*` + route `/design3` (DEV-gated từ Phase 1): **XOÁ HẲN**
  (validation decision 9). Điều kiện tiên quyết trong PR C: docs đã lưu đủ
  thiết kế để tái triển khai (xem PR C).
  <!-- Updated: Validation Session 1 - xoá /design3 -->

## PR C — Docs + acceptance close-out

- `docs/design-system-odoo.md`: trạng thái "rollout in progress" → "rolled
  out for admin"; ghi rõ phần CHƯA build (pivot indent, calendar grid-shell,
  dropdown↔bottom-sheet responsive) là "not implemented". **Vì `/design3` bị
  xoá (decision 9), doc này là nguồn tái-triển-khai duy nhất — phải đủ:**
  bảng tokens đầy đủ, spec từng component (props + hành vi + class `o-*`),
  patterns (shell/list/kanban/statusbar), tham chiếu file component trong
  `packages/ui/src/odoo*`. PR B chỉ được merge SAU khi PR C phần doc này xong
  (đảo thứ tự C-doc trước B-delete, hoặc gộp điều kiện vào cùng PR).
- `docs/12-design-system-ui.md`: banner chốt superseded-for-admin;
  xoá `docs/design-system-odoo-candidate.md` (đã promote từ Phase 1).
- `docs/system-architecture.md` (shell section) + `docs/codebase-summary.md`.
- Chạy `pnpm acceptance:report`, so **per-flow-id** với baseline Phase 1: mọi
  flow baseline vẫn pass; flow mới (geofence…) đánh giá riêng; ghi số + ngày.

## Success Criteria

- [ ] Census class = 0 unported trước khi gỡ import; admin không import
      premium.css; `packages/ui/src/premium.css` không đổi 1 dòng (LMS)
- [ ] `grep -rn "AppFrame\|SideNav" apps/admin/src` = 0 (gate repo-wide, giờ
      mới khả thi vì design-lab đã xoá)
- [ ] RequireAuth không còn pathname allow-list; typecheck xanh sau xoá cụm
- [ ] Docs promote chốt; link nội bộ không gãy; acceptance per-flow ≥ baseline
- [ ] Duyệt mắt smoke toàn admin sau khi gỡ premium

## Risk Assessment

- **Gỡ import khi census chưa 0:** gate cứng ở PR A bước 3; reviewer (chính
  mình, ngày khác) đối chiếu census trong PR description.
- **Đụng nhầm premium.css gốc:** cấm mutate — chỉ thêm vào odoo.css; diff PR
  không được chứa premium.css.
- **Xoá design-lab gãy typecheck:** xoá theo cụm (page + panels + route +
  palette entry) trong 1 commit.
- Rollback: PR A revert được (import quay lại); PR B/C revert độc lập.
