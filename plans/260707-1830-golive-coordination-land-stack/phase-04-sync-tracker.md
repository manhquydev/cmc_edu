---
phase: 4
title: "Sync-Tracker"
status: pending
priority: P2
dependencies: [1]
---

# Phase 4: Sync-Tracker

## Overview
Đồng bộ mọi tracker với code-reality để KHÔNG sót/trùng việc: task list, plan cũ
(golive-production-readiness → superseded), ui-implementation plan, changelog. Đây là
biện pháp chống R2 (tracker lệch code).

## Requirements
- Functional: task list + plan.md các plan liên quan + changelog phản ánh đúng cái gì đã land/đã thật/còn stub.
- Non-functional: không đặt phase-id/audit-label vào commit/code; ghi trạng thái trung thực (BLOCKED nếu cần DB/creds).

## Architecture — nguồn lệch đã phát hiện
- Task list #6 in_progress, #7/#8/#9 pending — code đã commit.
- `260707-1450-golive-production-readiness/plan.md` status=pending, phase 2-5 "In-Progress PR open" — sẽ superseded bởi plan này.
- `260707-0915-ui-implementation/plan.md` status=in-progress, 8 phase "done" nhưng nhiều phase "integration tests BLOCKED: needs DB".
- `docs/project-changelog.md` cần entry land-stack + integration thật.

## Related Code Files
- Modify: `plans/260707-1450-golive-production-readiness/plan.md` (frontmatter `status: superseded`, trỏ plan này).
- Modify: `plans/260707-0915-ui-implementation/plan.md` (ghi rõ integration-tests đã chạy được sau khi có DB/e2e xanh, hoặc vẫn BLOCKED).
- Modify: `docs/project-changelog.md` (entry mới).
- Task ops: cập nhật #6-#9 qua TaskUpdate (hoặc TodoWrite nếu Task tools lỗi).

## Implementation Steps
1. Sau P1 land: đánh dấu task #6/#7/#8 completed (code đã land); #9 (UAT) để in_progress tới khi P5 xong.
2. `260707-1450-golive-production-readiness/plan.md` → `status: superseded`, thêm note trỏ `260707-1830-golive-coordination-land-stack`.
3. `ui-implementation/plan.md` → cập nhật trạng thái integration-tests: nếu e2e xanh (DB có) thì gỡ "BLOCKED: needs DB", ngược lại giữ + ghi lý do.
4. Changelog: entry "land 4-PR stack qua #16 + FORCE-RLS migration + e2e green + gkg MCP" và (sau P3) "LLM/S3/email integration thật".
5. Cross-check: grep TODO/skip còn lại (`context.ts` SSO, `describe.skip` needs-DB) → liệt kê vào 1 mục "known-gaps" trong changelog/plan để không quên.

## Success Criteria
- [ ] Task list khớp: land-xong = completed; UAT = in_progress; không task nào "pending" cho việc đã land.
- [ ] Plan cũ status=superseded, trỏ plan mới; ui-plan trạng thái integration-tests trung thực.
- [ ] Changelog có entry land-stack (+ integration sau P3).
- [ ] Danh sách known-gaps (SSO off, skip needs-DB) ghi lại rõ ràng.

## Risk Assessment
- R2: đây chính là phase chống drift; nếu bỏ qua → người đọc tracker hiểu sai trạng thái.
- Không nhét mã phase/audit vào commit message hay code (theo review-audit rule).
- Trung thực: nếu integration nào vẫn stub sau P3 (vd Graph off) → ghi rõ known-gap, không tô hồng.
