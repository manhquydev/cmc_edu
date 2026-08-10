---
phase: 1
title: "Land pending work"
status: pending
priority: P1
effort: "3-4h"
dependencies: []
---

# Phase 1: Land pending work

## Overview

Đưa vào worktree này phần đã verify của một cook slice trước đó (token bugs + S1 date/time
fields + statusbar CSS redesign) và trang `/design` showcase, theo cùng nội dung đã chạy
typecheck/test xanh trong phiên trước. **Không cuốn theo bất kỳ thay đổi infra/UAT/docker/nginx
nào** — chúng thuộc một workstream hoàn toàn khác, ngoài phạm vi plan này.

## Requirements

- Functional: mọi thay đổi đã verify được đưa lên nhánh này qua các commit tách biệt theo chủ đề.
- Non-functional: mỗi commit **một chủ đề**, rollback được độc lập. Không mega-commit.
- **Loại trừ tuyệt đối:** không đụng `docker-compose.prod.yml`, `infra/docker/*`, `infra/nginx/*`,
  `plans/260809-1145-self-host-uat-deploy/`, mọi file liên quan VPS/UAT/incident — không phải
  scope của plan UI này.

## Architecture

4 commit tuần tự trên nhánh `feat/erp-ui-clean-sync-cook-b` — không mở PR thật (nhánh này là
bản chạy so sánh trong worktree riêng, PR thật mở khi operator quyết định nhánh nào land).

| # | Nội dung | Rủi ro |
|---|---|---|
| 1 | `packages/ui/src/console.css` hunk WorkflowStatusbar (seam fix + layout chevron 38px/16px) | Thị giác, đã verify |
| 2 | Cook slice S1: `time-field.tsx` + `datetime-field.tsx` (+test), barrel export, 4 consumer migration, 3 token bug fix | Chạm 4 màn hình thật |
| 3 | `design-showcase.tsx` + `design.routes.tsx` + splice `routes/index.tsx` | Lab, xoá được sau |
| 4 | Cập nhật `plans/260809-1100-cook-token-bugs-datetime-fields/plan.md` status → completed | Doc-only |

## Related Code Files

- Modify: `packages/ui/src/console.css` (hunk statusbar; hunk `.console-date-field-input:focus`)
- Create: `packages/ui/src/components/{time,datetime}-field.tsx` + `.test.tsx`
- Modify: `packages/ui/src/index.ts`, `apps/admin/src/pages/{classes/class-detail,admin/shift-config,crm/schedule-test-dialog,crm/schedule-parent-meeting-dialog}.tsx`
- Modify: `apps/admin/src/pages/teaching/{attendance,panels/attendance-panel}.tsx` (hex thô còn sót: `UNMARKED_CONFIG` + 4 `CountTile color=`)
- Modify: `apps/admin/src/pages/crm/opportunity-detail.tsx:337` (`#fff` → token)
- Modify: `apps/admin/src/pages/teaching/grading.tsx:109-110` (`--cmc-accent`/`--cmc-accent-subtle` → `--cmc-brand`/`--cmc-brand-muted`)
- Create: `apps/admin/src/pages/design-showcase.tsx`, `apps/admin/src/routes/design.routes.tsx`
- Modify: `apps/admin/src/routes/index.tsx` (+3 dòng splice)
- Modify: `apps/lms/package.json`, `packages/ui/package.json` (peerDeps `@astryxdesign/theme-neutral`)

## Implementation Steps

1. Commit 1: hunk statusbar CSS. Gộp 2 follow-up a11y đã ghi nhận trước: `title={step.label}`
   trong `progress-steps.tsx` (fallback khi label bị ellipsis) + text screen-reader cho trạng
   thái done (hiện chỉ có `✓` `aria-hidden`).
2. Commit 2: cook slice S1 (token bugs + field components + 4 migration). **Trước khi commit**:
   chạy 2 e2e journey `entrance-test-appointment.journey.ui.spec.ts` +
   `parent-meeting-schedule-complete.journey.ui.spec.ts` cục bộ (phụ thuộc label
   `"Thời gian test"` / `"Thời gian họp"` byte-identical).
3. Commit 3: showcase route.
4. Commit 4: cập nhật status plan cook-token-bugs.

## Success Criteria

- [ ] `git status --short` sạch trên nhánh này sau 4 commit.
- [ ] `pnpm --filter @cmc/ui typecheck && test` xanh.
- [ ] `pnpm --filter @cmc/admin typecheck` xanh.
- [ ] 2 e2e journey CRM chạy xanh **cục bộ** trước commit 2.
- [ ] `grep -rn -- "--cmc-accent\b\|--cmc-accent-subtle" apps/admin/src packages/ui/src` → 0 kết quả.
- [ ] Hex thô ngoài `design-showcase.tsx` → 0 dòng.
- [ ] Không có file nào ngoài danh sách "Related Code Files" bị đụng (đặc biệt: không đụng infra/docker/nginx/UAT).

## Risk Assessment

- **Nhầm lẫn với workstream infra/UAT đang chạy song song ở checkout khác.** Mitigation: chỉ
  tạo file mới bằng nội dung tôi tự viết/verify trong phiên trước, không copy bất kỳ gì từ
  checkout gốc đang biến động.
- **Label e2e**: đổi nhầm chuỗi label làm vỡ 3 unit test + 2 journey. Mitigation: giữ
  byte-identical.
- Rollback: mỗi commit revert độc lập.
