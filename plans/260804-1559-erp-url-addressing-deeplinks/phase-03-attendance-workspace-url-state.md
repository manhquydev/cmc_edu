---
phase: 3
title: "Attendance Workspace URL State"
status: pending
priority: P2
effort: "3h"
dependencies: [1, 2]
---

# Phase 3: Attendance Workspace URL State

## Overview

Chuyển lựa chọn lớp/buổi của trang điểm danh từ `useState` sang URL query params theo pattern `schedule.tsx`, để "gửi link điểm danh lớp X buổi Y" hoạt động. Workspace mẫu cho Phase 4.

## Requirements

- Functional: URL `/teaching/attendance?classBatchId=<uuid>&sessionId=<uuid>` hydrate đúng selects; đổi lựa chọn cập nhật URL (`replace: true`); **param không phải UUID → coi như chưa chọn** (bỏ khỏi state, không đẩy vào query — UX đã chốt, không improvise lúc viết test).
- Non-functional: không đổi hành vi nghiệp vụ điểm danh (localStatus, markAll giữ nguyên).

## Architecture

- `attendance.tsx:138-139`: thay `useState` cho `classBatchId`/`sessionId` bằng `useSearchParams` — đọc qua bước lọc UUID, ghi qua `setSearchParams(..., { replace: true })` trong `selectClass`/`selectSession` (pattern `schedule.tsx:225-241`).
- **Lọc id rác tại boundary trang** (red-team: `classSession.list` input là `z.string().uuid()` — id rác present-but-invalid sẽ bắn BAD_REQUEST; lỗi query này hiện bị nuốt im lặng, còn `attendance.listBySession` render `listError.message` thô ra Banner `:359-362`). Quy tắc: dùng chung `UUID_RE` export từ `@cmc/links`; param fail regex → treat as unset → `enabled` guard giữ nguyên semantics hiện tại, không query nào nhận id rác.
- Chọn lớp mới → xoá `sessionId` khỏi params (giữ logic reset của `selectClass`).
- State phụ (`localStatus`, `saved`, `saveValidationError`) ở lại `useState`.
- Builder `attendance: (q: {classBatchId?: string; sessionId?: string}) => string` vào `@cmc/links` (workspace không đi qua `/go` — query params độc lập cấu trúc path; ghi vào docs Phase 4).
- `CopyLinkButton` mode "current URL" (`location.pathname + location.search`).

## Related Code Files

- Modify: `apps/admin/src/pages/teaching/attendance.tsx`
- Modify: `apps/admin/src/pages/teaching/attendance.test.tsx` — MemoryRouter initialEntries kèm params
- Modify: `packages/links/src/index.ts` (+test) — builder `attendance`, export `UUID_RE`
- Modify: `apps/admin/src/lib/copy-link-button.tsx` — mode current-URL
- Create: `apps/e2e/tests/attendance-deeplink.ui.spec.ts` (nhớ `test.use({ baseURL: 'http://localhost:4173' })` — mặc định là LMS :4174)

## Implementation Steps

1. Refactor `attendance.tsx` sang `useSearchParams` + lọc UUID tại boundary; giữ nguyên toàn bộ query/mutation logic.
2. Unit test: hydrate từ `initialEntries=['/teaching/attendance?classBatchId=<uuid>&sessionId=<uuid>']`; case id rác (`?classBatchId=abc`) → cả hai query không fire, selects placeholder.
3. Builder `attendance` + `UUID_RE` export trong `@cmc/links` + test.
4. Gắn `CopyLinkButton` (current-URL) vào PageHeader attendance.
5. E2e: seed lớp/buổi qua tRPC (hạ tầng Phase 1) → login → goto URL kèm 2 params → expect tên lớp/buổi hiển thị đúng; thêm case logout → deep-link → login → hydrate.
6. Chạy lại spec UI thật của màn này trước khi mở PR: `apps/e2e/tests/journeys/session-assessment-roster.journey.ui.spec.ts` (spec này lái selects attendance qua DOM tại `:216-225`).

## Success Criteria

- [ ] E2e attendance deep-link hydrate pass trong ui-e2e
- [ ] **`session-assessment-roster.journey.ui.spec.ts` xanh** (lưới regression UI thật; 3 spec `attendance*.spec.ts` là spec API-project — không chứng minh gì cho refactor UI này, chỉ là footnote)
- [ ] Unit test id-rác pass: không query nào fire với id không phải UUID
- [ ] CI 2 required checks xanh

## Risk Assessment

- **Regression select hydration/re-render timing**: `setSearchParams` trigger render trước khi class query settle có thể reset session options — lưới bắt là journey spec ở tiêu chí 2, không phải 3 spec API.
- **Vòng lặp useEffect `:176-185`** (reset localStatus theo `data`): refactor không đổi identity của `data` flow, nhưng xác nhận bằng unit test hydrate.
- **History spam**: `replace: true` cho mọi thay đổi lựa chọn — back về trang trước, không bước qua từng selection (nhất quán schedule.tsx).
