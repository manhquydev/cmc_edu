---
title: "Phase 1: Phản hồi tức thì + statusbar bấm một bước"
status: todo
priority: P1
effort: "2d"
dependencies: []
---

# Phase 1: Phản hồi tức thì + statusbar bấm một bước

## Overview

Chữa thẳng cảm giác "bấm mà không biết có ăn không" (Đ4): sửa lớp lỗi làm-mới đã đo được (ở **cả
hai** hook của trang chi tiết), cho statusbar tiến đúng một bước như thói quen Odoo CRM, và gỡ
`page.reload()` đang che bug trong journey để cổng "test fail nếu revert" là thật.

## Sự thật đo được (13/08, đã red-team xác minh)

**Lỗi cần chữa — hai hook cùng lớp bug:**
- `use-opportunity-actions.ts:27-37`: `markLostMutation` + `assignMutation` chỉ gọi
  `invalidateList` ⇒ trang chi tiết (đọc `opportunityGet`) đứng im. Ngay dưới,
  `setNextAction`/`clearNextAction` (`:42-56`) làm mới đủ ba query ⇒ sót, không phải thiết kế.
- `use-test-appointment-actions.ts:21-24`: `schedule` (đẩy O2→O3 server-side qua appointment
  router) và `complete` (O3→O4) chỉ invalidate `opportunityList` + `testAppointment.forOpportunity`
  — **không** `opportunityGet` ⇒ đặt lịch/hoàn thành test từ trang chi tiết
  (`opportunity-detail.tsx:140`) cũng đứng im.
- Hook `useOpportunityActions` có 3 caller thật: `create-lead-dialog.tsx:43`,
  `opportunity-detail.tsx:139`, `mark-lost-dialog.tsx:45` (docstring `:5-8` ghi "pipeline" nhưng
  `pipeline.tsx` chỉ render hai dialog, không import hook — sửa docstring luôn).

**Bằng chứng đang bị che:** journey `crm-opportunity-lost.journey.ui.spec.ts:79-86` có
`page.reload()` kèm comment thừa nhận bug stale-detail; unit test `opportunity-detail.test.tsx:94`
mock toàn bộ trpc nên chỉ assert "hàm được gọi", không chứng minh màn hình đổi. Tầng duy nhất
falsify được bản sửa là journey — phải gỡ reload.

**Thói quen cần khớp — nhưng component hiện KHÔNG làm được:** Odoo 11 đặt `clickable="True"`
trên statusbar `crm.lead` (nguồn ngoài repo, chưa kiểm). `WorkflowStatusbar` nhận `onStepClick`
nhưng `ProgressSteps` bên dưới hardcode `clickable = i <= activeIndex` và `disabled={!clickable}`
(`progress-steps.tsx:25-32`, test gim tại `progress-steps.test.tsx:6`) — tức chỉ bấm được bước
**đã qua**, bước kế tiếp bị disabled cứng. Truyền `onStepClick` mộc như bản plan cũ sẽ tạo đúng
anti-pattern "bấm rồi báo lỗi" (bước lùi bấm được → server `badRequest`). **Việc thật là đổi API
`ProgressSteps`** (per-step clickable), có 11 call site `WorkflowStatusbar`/`ProgressSteps` toàn
app + `design-showcase.tsx:127` đang dựa vào ngữ nghĩa bấm-lùi — API mới phải mặc định giữ hành
vi cũ để 10 caller còn lại không đổi.

**Ràng buộc backend chặt hơn Odoo — không bê nguyên:**
- `crm/router.ts:193` — cấm đặt tay `O5_ENROLLED` (chỉ `finance.receiptApprove`)
- `advance-opportunity.ts:33-50` — chỉ nhận bước **liền kề**, có khoá `FOR UPDATE` (an toàn race
  phía server), nhưng message lỗi là **tiếng Anh thô** ("Invalid stage transition…")
- `crm/router.ts:204-220` — sale chỉ tiến được cơ hội chưa có chủ hoặc của mình (FORBIDDEN kèm
  message tiếng Việt)

**Đã đúng, đừng đụng:** nút ẩn/hiện theo giai đoạn (`canMarkLost:238`, `canScheduleTest:242-243`,
`stage === 'O4_TESTED':295`).

## Requirements

- [x] Mọi mutation trong `useOpportunityActions` **và** `useTestAppointmentActions` làm mới cả
      `opportunityList` + `opportunityGet`; các mutation đổi tư cách thành viên của due-list
      (`markLost`, `assign`, `setNextAction`, `clearNextAction` — due-list lọc theo
      `assignedToId` + `closedAt`, `router.ts:594-601`) thêm `DueFollowUps`
- [x] `ProgressSteps` nhận cơ chế per-step clickable (prop mới, ví dụ `canStepClick?: (i) => bool`),
      **mặc định giữ ngữ nghĩa hiện tại** (`i <= activeIndex`) để 10 caller ngoài CRM không đổi;
      cập nhật `progress-steps.test.tsx`
- [x] Trang cơ hội: chỉ bước **liền kề kế tiếp** bấm được; `O5_ENROLLED`, bước lùi, bước xa
      không render như nút bấm được (không con trỏ bàn tay, không sự kiện); khi mutation đang
      pending thì statusbar disable toàn bộ (chống double-click với cache cũ)
- [x] Check quyền phía client là **UX-only** — server vẫn là điểm enforcement duy nhất. Phép so
      sánh client: `opp.assignedTo?.userId === me.userId` hoặc role quản lý (lưu ý mapping: server
      so `AppUser.id`, client chỉ có `userId` — `router.ts:204-220` vs `:422-427`,
      `apps/admin/src/lib/session-context.tsx:8,35`); ghi chú trong code rằng đây là bản sao UX
      của luật server
- [x] Đường lỗi statusbar: `onError` → invalidate `opportunityGet` (đồng bộ lại màn hình) + thông
      báo **tiếng Việt** (race hai người cùng tiến, manager giao cho người khác giữa chừng)
- [x] Journey `crm-opportunity-lost`: gỡ `page.reload()` + comment workaround, assert dữ liệu đổi
      **không cần reload** — đây là test "fail nếu revert" thật
- [x] Mỗi giai đoạn có đúng một hành động chính nổi bật trên header

## Related Code Files

- Modify: `apps/admin/src/pages/crm/use-opportunity-actions.ts` (+ sửa docstring caller)
- Modify: `apps/admin/src/pages/crm/use-test-appointment-actions.ts`
- Modify: `apps/admin/src/pages/crm/opportunity-detail.tsx`
- Modify: `apps/admin/src/pages/crm/opportunity-detail.test.tsx`
- Modify: `packages/ui/src/components/progress-steps.tsx`
- Modify: `packages/ui/src/components/workflow-statusbar.tsx`
- Modify: `packages/ui/src/components/progress-steps.test.tsx`
- Modify: `apps/e2e/tests/journeys/crm-opportunity-lost.journey.ui.spec.ts`

## Implementation Steps

1. `impact` cho `useOpportunityActions`, `useTestAppointmentActions` **và `ProgressSteps`** — báo
   bán kính (11 call site statusbar; `design-showcase.tsx:127` dựa vào bấm-lùi).
2. Gom một hàm làm mới dùng chung cho cả hai hook, chuẩn hoá theo cái đã đúng (`setNextAction`),
   không tạo chuẩn thứ ba.
3. Rà `opportunityAdvance` (cố ý ngoài hook — pipeline tự cập nhật lạc quan): bảo đảm gọi từ
   trang chi tiết làm mới `opportunityGet`; ghi lý do vào docstring.
4. Thiết kế prop per-step clickable cho `ProgressSteps` (default = hành vi cũ), nối qua
   `WorkflowStatusbar`, wire ở trang chi tiết với luật một-bước-liền-kề + check UX + pending
   disable + `onError` như Requirements.
5. Rà bảng giai đoạn × nút, đưa vào mô tả PR để người review đối chiếu.
6. Test: (unit) hai hook invalidate đủ query; statusbar render đúng ba trạng thái
   (bấm được / disabled / pending); (journey) gỡ reload, đánh mất + mở lại từ trang chi tiết đổi
   dữ liệu ngay; đặt lịch test từ trang chi tiết đổi statusbar ngay.
7. `detect_changes()` trước khi commit.

## Todo

- [x] Impact 3 symbol + báo bán kính
- [x] Sửa invalidation hai hook
- [x] API per-step clickable + statusbar một bước + pending/onError
- [x] Gỡ reload trong journey, siết assert
- [x] Bảng giai đoạn × nút trong PR
- [x] `detect_changes()` + PR

## Success Criteria

- Ở trang chi tiết: đánh mất / mở lại / giao việc / đặt việc-cần-làm / **đặt lịch test / hoàn
  thành test** đổi màn hình ngay, không reload
- Statusbar: bấm bước kế tiến giai đoạn; bước không hợp lệ nhìn là biết không bấm được; đang
  pending không bấm tiếp được; server từ chối thì màn hình tự đồng bộ + thông báo tiếng Việt
- Journey `crm-opportunity-lost` xanh mà **không còn** `page.reload()`
- 10 caller `WorkflowStatusbar` ngoài CRM không đổi hành vi
- `typecheck-and-test` + `ui-e2e` xanh

## Risk Assessment

`ProgressSteps` là component nền 11 chỗ dùng — prop mới phải opt-in, default giữ nguyên; impact
bước 1 liệt kê đủ caller trước khi sửa. Unit test của trang mock trpc nên không tự chứng minh
được bản sửa — journey (đã gỡ reload) là lưới thật. Kéo-thả và cập nhật lạc quan của pipeline
**không thuộc phase này** (Con B).
