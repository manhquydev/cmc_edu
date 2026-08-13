---
phase: 2
title: "Teaching loop — Phát bài và cấp unit"
status: in-progress
priority: P1
effort: "2–3d"
dependencies: [1]
---

# Phase 2: Teaching loop — Phát bài và cấp unit

## Overview

Happy-path: worker `drainOnce` → `deliverDueExercises` sau `endTime`. Sequence + `assignUnit` đã có. Phase này **không** tắt worker.

Còn thiếu: break-glass GĐĐT (nút + e2e không seed); grant **read+write** đúng quyền (tab lớp trên student-detail đang stub, không có `enrollmentId`).

## Requirements

- Functional: nút **Phát bài** trên **EntityHeader** (mọi tab — inbound mặc định `?tab=attendance`). Chỉ khi `canDo('exercise','manage')`. `giao_vien`/`sale` không thấy nút.
- Functional: disable trừ khi: not cancelled, sequence non-empty, next position exists, `endTime <= now`, `curriculumUnitId` set, chưa có delivery. Cần query sequence + delivery ( `classSession.get` hiện **không** có `deliveredExercise`).
- Functional: HTTP `{ delivered: false, reason: 'no_sequence_or_exhausted' }` = Banner lỗi, không `onSuccess` xanh.
- Functional: **Không** nới `deliverForSession` guards. **Không** nới `exercise.manage`.
- Functional: grant UI: query `lmsOps.listEnrollmentsForStudent` (hoặc tương đương, `enrollment.grantUnits`) trả `enrollmentId` + ranges + class current unit. Rồi `listUnitRanges` nếu tách. Cấm `student.get`.
- Functional: cắt **range** = `revokeFromNext`, không `archiveEnrollment` (cái đó ẩn student khỏi roster).
- Functional: `addWithUnits` khi from ≥ current; `grantPast` khi from < current. ConfirmDialog. Reserved → 400.
- Functional: P2-05 **không** dùng `grantPast` để “chứng minh homework”. Happy-path range = receipt provision (seed receipt-approve hoặc `grantUnitsFromReceipt` trong harness). `grantPast` = spec backfill riêng nếu làm.
- Functional: journey split: (a) GĐĐT trên session **đã ended + unit + sequence** → click Phát bài; (b) student thấy row / submit — timeout Playwright tăng; không kỳ vọng `--strict` (tên P2-05 không nằm keyword tiền).
- Functional: `journey:` trên manifest và file `test(` **cùng commit**. Không `test.fixme`.
- Non-functional: giữ `deliverDueExercises`. Giữ `open-tier.ts`.

## Architecture

```
Worker (prod happy path, ~30s)
  drainOnce → deliverDueExercises → deliverForSession

Break-glass + e2e (GĐĐT)
  EntityHeader mọi tab
  → canDo('exercise','manage')
  → deliverSessionExercise
  → cùng guards; {delivered:false} = error

Grant (GĐĐT)
  listEnrollmentsForStudent({ studentId })  // enrollment.grantUnits
  → addWithUnits | grantPast | revokeFromNext
  archiveEnrollment KHÔNG phải “xóa range”
```

## Related Code Files

- Modify: `apps/admin/src/pages/teaching/session-detail.tsx` EntityHeader + tests
- Modify: `apps/api` — query delivery/sequence cho hub nếu DTO `classSession.get` thiếu
- Modify: `apps/admin/src/pages/students/student-detail.tsx` tab lớp (đang EmptyState stub `:209-219`)
- Create: `lmsOps.listEnrollmentsForStudent` (+ optional `listUnitRanges`) + FORBIDDEN sale
- Modify: `flow-manifest.ts` P2-05/P2-09 `journey:` **cùng** spec file; thêm `deliverSessionExercise` vào `expected.trpc` P2-05 khi nút sống; **không** xóa P2-03 `no-ui-path` đến khi (a)+(b) xanh
- Create: `exercise-deliver.journey.ui.spec.ts` (admin, ended fixture); optional student-open spec riêng
- Create: `exercise-sequence.journey.ui.spec.ts` (P2-09)
- Do not: widen auth keys; `deliverDueExercises`; `packages/ui`; parent link; seed `SessionExercise` trong P2-05

## Implementation Steps

1. EntityHeader Phát bài + `canDo` + guards (ended, unit, sequence, not cancelled). Query thiếu thì thêm, đừng đoán.
2. RTL: `giao_vien` không nút; default `?tab=attendance` vẫn thấy nút (header).
3. Banner nhánh `{ delivered: false }`.
4. `listEnrollmentsForStudent` + bind tab lớp. `revokeFromNext` cho cắt range.
5. API: reserved 400; sale FORBIDDEN; `addWithUnits` past → 400 (giữ).
6. Journey (a) seed **time** (endTime past) + sequence + unit + **receipt range**, không seed SessionExercise. Journey (b) student sau (a) hoặc sau `deliverDueExercises` trong harness kiểu `relayEmailOutbox`. Timeout > 30s nếu cross-app.
7. Cùng commit: spec có `test(` + manifest `journey:`.
8. Gỡ GAPS `deliverSessionExercise` **sau** khi đã claim trên P2-05 `expected.trpc`. `revokeFromNext` chỉ gỡ khi form gọi. `unarchiveEnrollment` giữ GAPS.

## Success Criteria

- [x] RTL: `giao_vien` không thấy Phát bài trên mọi tab; `sale` không thấy grant
- [x] Nút visible khi land `?tab=attendance`
- [x] `{ delivered: false }` không hiện success Banner
- [x] `drainOnce` vẫn `deliverDueExercises`
- [ ] P2-05 spec trong artifact; không seed `SessionExercise`; grant path = receipt không `grantPast` — **deferred** (vẫn `no-ui-path`)
- [x] P2-09 spec + `test(` cùng commit với `journey:`
- [x] `student.get` không thêm ranges
- [x] `archiveEnrollment` không dùng làm “xóa range”

## Risk Assessment

Hai writer (worker + nút): idempotent `deliverForSession` đã handle existing row. Journey flake endTime: fixture thời gian bắt buộc. Orphan nếu gỡ GAPS trước claim. EmptyState CSS phase 03 sẽ đụng stub tab lớp — chấp nhận overlap CSS, không overlap TSX ownership.
