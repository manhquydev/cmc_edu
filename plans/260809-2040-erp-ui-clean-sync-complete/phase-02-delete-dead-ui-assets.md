---
phase: 2
title: "Delete dead UI assets"
status: pending
priority: P2
effort: "2-3h"
dependencies: [1]
---

# Phase 2: Delete dead UI assets

## Overview

Xoá tài sản UI đã chết, kèm cập nhật tài liệu. Mỗi ứng viên đều có **hồ sơ quyết định** xác
nhận bị thay thế, không phải việc dở dang.

## Requirements

- Functional: xoá code + CSS + asset chết; **cập nhật file doc liên quan trong cùng PR**.
- Non-functional: không xoá thứ đang được dùng nội bộ (`ProgressSteps`, `TaskRow` là building
  block — **GIỮ**).

## Architecture

| Ứng viên | Hồ sơ quyết định | Ghi chú |
|---|---|---|
| `WeekSchedule` + `ScheduleMonth` | `plans/260804-xia-fullcalendar-soft-ops/plan.md:76` | Bị FullCalendar thay. **Cảnh báo:** `WeekSchedule` còn dùng làm loading skeleton ở `teaching/schedule.tsx:226` → phải thay skeleton trước |
| `AppFrame` + `SideNav` | `plans/260805-1920-design3-admin-rollout/plan.md:148` | ConsoleNavbar thay. `shell.test.tsx` assert chúng **không** xuất hiện |
| `ActivityTimeline` | `CONSOLE-COMPONENT-MAP.md:139` | Chatter SKIP-by-decision |
| `public/design2*` | Hướng Aetheria đã bỏ | 2.3 MB, không route/link/config nào trỏ tới, **đang serve ra production** |
| `.console-statusbar` / `-step` | CSS chết | `console-tokens.test.ts:25` assert tồn tại → sửa test kèm |

**Quy mô:** 548 dòng TSX (9 file) + ~513 dòng CSS + 2.3 MB asset.

## 🔴 Phụ thuộc chéo BẮT BUỘC — bỏ sót là build đỏ chắc chắn

`apps/admin/src/pages/design-showcase.tsx` (do **Phase 1** đưa vào) **import trực tiếp** các
component phase này xoá: `ActivityTimeline`, `FocusCard`, `InsightMetric`.

⇒ Xoá `ActivityTimeline` mà không đụng showcase ⇒ **`pnpm --filter @cmc/admin typecheck` đỏ ngay**.

**Ba lựa chọn, chọn một và ghi rõ trong commit:**
1. Xoá luôn showcase trong phase này.
2. **Gỡ 3 component khỏi showcase**, giữ phần còn lại. **Khuyến nghị — mặc định.**
3. Hoãn showcase tới sau Phase 8.

## Related Code Files

- Delete: `apps/admin/public/design2.html` + 4 PNG
- Delete: `packages/ui/src/components/{week-schedule,schedule-month,activity-timeline,app-frame,side-nav}.tsx` + test tương ứng
- Modify: `packages/ui/src/index.ts` (bỏ export), `packages/ui/src/console.css` (5 khối CSS), `packages/ui/src/console/console-tokens.test.ts:25`
- Modify: `apps/admin/src/pages/teaching/schedule.tsx:226` (thay skeleton)
- Modify: `apps/admin/src/pages/design-showcase.tsx` (gỡ 3 import theo lựa chọn 2)
- Modify (doc): `design-system/cmc-edu/{CONSOLE-COMPONENT-MAP,VIEW-GRAMMAR,A11Y-BASELINE,MASTER,PAGE-FRAMES,STRUCTURE}.md`, `packages/ui/llms.txt`, `docs/12-design-system-ui.md`, `docs/system-architecture.md` khi liên quan

## Implementation Steps

0. **Xử lý phụ thuộc showcase ở trên TRƯỚC** (mặc định: lựa chọn 2).
1. Thay skeleton `WeekSchedule` ở `teaching/schedule.tsx:226` bằng `Skeleton` thường **trước**.
2. Xoá component + test + export; xoá 5 khối CSS; sửa assertion `console-tokens.test.ts:25`.
3. Xoá `public/design2*`.
4. Cập nhật file doc liên quan — **cùng commit**, không để sau.
5. `pnpm --filter @cmc/ui typecheck && test`, `--filter @cmc/admin typecheck`, `--filter @cmc/lms typecheck`.

## Success Criteria

- [ ] `pnpm --filter @cmc/{ui,admin,lms} typecheck` xanh cả 3.
- [ ] `pnpm --filter @cmc/ui test` xanh (đã sửa assertion statusbar).
- [ ] `grep -rn "WeekSchedule\|ScheduleMonth\|ActivityTimeline\|AppFrame\|SideNav" --include='*.tsx' --include='*.ts' --include='*.md' .` → chỉ còn hit trong `plans/` lịch sử.
- [ ] Build admin không giảm chức năng; `public/` không còn design2.
- [ ] CI `typecheck-and-test` + `ui-e2e` xanh.

## Risk Assessment

- **Skeleton `WeekSchedule`** — xoá trước khi thay sẽ vỡ `teaching/schedule.tsx`. Mitigation: bước 1 làm trước.
- **`.sh-*` CSS** — nếu `AppFrame`/`SideNav` còn export công khai theo YAGNI ở nơi khác, không rõ được xoá CSS `.sh-*` không. Nếu không chắc → giữ CSS, chỉ xoá component.
- Rollback: git revert; không có thay đổi runtime/schema.
