# Phase 01 — Token tím Community + Control panel một hàng

**Plan:** [plan.md](./plan.md)  
**Contract:** `design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md` §2–3

## Overview

Bỏ khóa Apple-blue bên trong `.o_web_client`. Đổi `ControlBar` từ stack header/filters/footer sang flex 3 vùng như pack 02/03/14. Cập nhật MASTER/docs-console: primary admin = purple.

## Blast radius

`ControlBar` được mọi `ListPage` dùng. `Button` Astryx dưới `.o_web_client` đổi màu. Chạy impact trên `ControlBar` / `ListPage` trước khi sửa. Risk: HIGH vì list toàn admin đổi layout.

## Requirements

- [x] `--console-brand-purple` là màu primary button, link, tab, focus trong `.o_web_client`
- [x] `#0071E3` không còn trên admin chrome (CSS pin; screenshot tay còn lại)
- [x] `ControlBar` API: `left`, `center?`, `right?` (giữ alias cũ)
- [x] List: New + title | search | pager+switcher trên **một** hàng 58px (`flex-wrap: nowrap` ≥768)
- [x] Form: class `console-btn-outline-primary` cho New outline; Form CP không search
- [x] Cập nhật `MASTER.md` (admin exception), `docs/design-system-console.md`, `console-tokens.test.ts`

## Files

- `packages/ui/src/console.css`
- `packages/ui/src/components/control-bar.tsx` + test
- `packages/ui/src/components/list-page.tsx`
- `packages/ui/src/components/page-header.tsx`
- `packages/ui/src/console/console-tokens.test.ts`
- `design-system/cmc-edu/MASTER.md`
- `docs/design-system-console.md`

## Acceptance

- [ ] Ảnh list Students CMC vs `03-sis-students-list.png`: navbar+CP cùng nhịp (cần so tay 1280)
- [x] `pnpm` typecheck + unit tests ControlBar/ListPage
- [x] Precedence test: Astryx blue không thắng `.o_web_client` button

## Risks

Stacked FilterBar pages (Parents) sẽ vỡ nếu filters không vào CENTER. Làm map trang trước khi gộp hàng.
