---
phase: 2
title: "API thư mục, soạn bài, bỏ fallback"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2 — API

> **Vào cùng Phase 1.**

## Việc

1. **Router thư mục:** `create` · `update` (đổi tên/mô tả) · `archive` · `list`.
   Gate `requirePermission('exercise','manage')` như router bài tập.
2. **Sửa router bài tập:** `create`/`update` nhận `folderId` + `title` thay `curriculumUnitId`;
   `list` lọc theo thư mục thay vì unit. Giữ nguyên `publish`/`close`/`get`.
3. **Bỏ fallback phát bài theo unit** trong `deliverForSession` — nhánh `sequence.length === 0`
   nay trả `null` thẳng. **Viết lại** test đang khoá hành vi cũ để khẳng định hành vi mới,
   không xoá suông.
4. **Sửa `cleanupCurriculumUnits`** trong `apps/api/src/test/db.ts` — đang xoá bài theo
   `curriculumUnitId`; sau khi bỏ cột sẽ vỡ, và nếu chỉ xoá unit thì bài test **ở lại** danh mục
   global làm test sau nhìn thấy bài "ma".
5. **Cập nhật `scripts/acceptance-report/flow-manifest.ts`** — luồng P2-04 khai
   `curriculumUnit.list`; màn soạn bài nay chọn thư mục. Đổi sang API thư mục.
   **Chạy `acceptance:report` để chứng minh không tụt luồng nào.**

## Success Criteria

- [ ] `apps/api` typecheck 0 lỗi, toàn bộ test xanh
- [ ] Test khẳng định: lớp **không có dãy** ⇒ **không** phát bài
- [ ] `acceptance:report` — P2-04 vẫn `built`, không luồng nào tụt
