---
phase: 2
title: "Subtitle theo luật siết"
status: pending
priority: P1
effort: "0.5d"
dependencies: [1]
---

# Phase 2: Subtitle theo luật siết

## Overview

Áp luật siết từ Phase 1 lên 34 subtitle: xoá cái diễn đạt lại title, giữ + rút gọn
cái mang thông tin không suy ra được.

> ⚠️ Lý do đã đổi sau red-team. Subtitle **được `PAGE-FRAMES.md` cấp phép** — đây
> **không phải** dọn trôi dạt, mà là áp luật điền mới siết ở Phase 1.

## Requirements

**Functional**
- Mỗi subtitle có quyết định kèm lý do, không xoá hàng loạt.
- Chỗ giữ rút gọn về đúng phần mang thông tin.

**Non-functional**
- 1 chuỗi bị unit test ràng buộc ⇒ dual-edit source + test cùng commit.
- Không đổi `title`.

## Architecture

Luật (Phase 1): subtitle hợp lệ khi mang **ràng buộc / hệ quả nghiệp vụ / danh
tính phiên** không suy ra được. Lặp lại title ⇒ bỏ.

## Related Code Files

### ⚠️ RÀNG BUỘC — quyết định: **GIỮ** (vá R3)

| Nguồn | Chuỗi | Quyết định | Test liên quan |
|-------|-------|-----------|----------------|
| `classes/index.tsx:302` | "Danh sách lớp học tại cơ sở" | **GIỮ nguyên** | `class-access-guard.test.tsx:76` — **không cần sửa** |

Đây là chuỗi subtitle **duy nhất** bị ràng buộc trong 34 nội dung. Bản đầu tuyên
bố "0/41" — sai cả số lẫn phạm vi (chỉ đo e2e, bỏ unit test).

**Vì sao GIỮ (R3 phát hiện, đã verify tận mắt):** hai nhánh của trang render
**cùng** `title="Lớp học"` và **cùng** breadcrumbs:

| | Nhánh 403 (`index.tsx:145-158`) | Nhánh có quyền (`index.tsx:299-308`) |
|---|---|---|
| title | `"Lớp học"` | `"Lớp học"` |
| breadcrumbs | `Quản trị / Lớp học` | `Quản trị / Lớp học` (y hệt) |
| subtitle | **không có** | `"Danh sách lớp học tại cơ sở"` |

⇒ Subtitle là **neo phân biệt** mà `class-access-guard.test.tsx:76` dùng để khẳng
định nhánh có quyền đã render. Xoá nó rồi đổi assert sang `getByText('Lớp học')`
sẽ khớp **cả hai nhánh** (và khớp 2 node) ⇒ test guard phân quyền thành
**phantom**, xanh cả khi trang render 403.

Ngoài ra chuỗi này **hợp lệ dưới luật siết**: "tại cơ sở" mang phạm vi facility —
không suy ra được từ title "Lớp học".

🚫 **Nếu vẫn muốn xoá** (không khuyến nghị): phải đổi assert sang neo **chỉ tồn
tại ở nhánh có quyền** — `getByRole('button', { name: /Tạo lớp/ })`
(`index.tsx:307`). **Cấm** dùng `getAllByText(...)[0]` hoặc đổi sang assert phủ
định — cả hai đều làm hỏng guard.

### GIỮ + rút gọn (mang thông tin thật)

| File | Lý do giữ |
|------|-----------|
| `students/index.tsx` | "tối đa 20 kết quả" — giới hạn thật |
| `finance/receipt-create.tsx` | "tài khoản LMS tự tạo sau khi duyệt" — hệ quả |
| `teaching/session-assessment.tsx` | điều kiện buổi tự chuyển `done` — luật nghiệp vụ |
| `admin/network-ip.tsx` | title không nói rõ cấu hình gì |
| `enrollment/class-placement.tsx` | giải nghĩa trạng thái đặt chỗ |

### XOÁ (diễn đạt lại title)

`courses/index.tsx` · `admin/users.tsx` · `finance/receipt-list.tsx` ·
`hr/payroll.tsx` (×2 — cùng nội dung) · `admin/facilities.tsx` ·
`finance/revenue-report.tsx` · `engagement/gifts.tsx` ·
`engagement/leaderboard.tsx` · `engagement/rewards.tsx` ·
`teaching/exercises.tsx` · `teaching/grading.tsx` · `finance/refund.tsx` ·
`hr/my-hr.tsx` · `hr/kpi.tsx` · `hr/salary-tiers.tsx` · `crm/aftersale.tsx` ·
`crm/post-sale-meeting.tsx` · `crm/pipeline.tsx` · `attendance/check-in-out.tsx` ·
`attendance/shifts.tsx` · `teaching/report-cards.tsx` ·
`teaching/session-evidence.tsx` · `parents/index.tsx` · `admin/audit-log.tsx`

**Phase 2 sở hữu toàn bộ chuỗi subtitle này, kể cả chỗ chứa `(Super Admin)`**
(`audit-log.tsx`, `facilities.tsx`). Bản đầu xếp chúng vào **cả** Phase 2 lẫn
Phase 3 → trùng việc. Nay: **một chuỗi, một phase sở hữu.**

### Giao với phase khác — quyết định ĐẦY ĐỦ (vá R2)

R2 chỉ ra 3 chuỗi này chỉ có *chủ sở hữu* mà **không có quyết định giữ/xoá**, và
1 chuỗi (`payroll.tsx:519`) không nằm trong danh sách nào.

| File | Chuỗi | **Quyết định** | Chuỗi khác dòng, phase khác sở hữu |
|------|-------|----------------|-----------------------------------|
| `admin/shift-config.tsx:323` | subtitle chứa `SettingsShell` | **XOÁ** (lặp title + chứa định danh) | — |
| `finance/reconciliation.tsx:228` | subtitle "agent phân tích tự động" | **XOÁ** (lặp title) | `:254` "AI agent — chỉ đọc" → **Phase 4** (coupled, dual-edit `reconciliation.test.tsx:98`) |
| `teaching/schedule.tsx:298` | subtitle `FullCalendar · Soft Ops` | **XOÁ** (lặp title + định danh) | `:212` Callout `FullCalendar · ClassSession timed` → **Phase 3** |
| `hr/payroll.tsx:519` | "Chọn nhân viên để xem / chốt lương theo tháng" | **XOÁ** (mô tả lại thao tác hiển nhiên) | — |

⚠️ **Sửa lỗi bản R1:** bảng cũ ghi `reconciliation.tsx:254` thuộc "Phase 3 sở hữu"
— **sai**, nó là chuỗi coupled của **Phase 4** và bị `reconciliation.test.tsx:98`
khoá. Executor Phase 3 mà sửa nó sẽ làm đỏ `pnpm test`.

Nếu chọn GIỮ bất kỳ chuỗi nào ở bảng này, phần chứa `SettingsShell` /
`FullCalendar` **vẫn phải biến mất** — nếu không Phase 5 sẽ kẹt khi nâng lint.

### 7 subtitle dynamic

`cockpit.tsx` · `teaching/attendance.tsx` · `classes/class-detail.tsx` ·
`crm/opportunity-detail.tsx` · `finance/receipt-detail.tsx` ·
`teaching/session-detail.tsx` · `students/student-detail.tsx`

⚠️ **Không đo được ràng buộc bằng grep chuỗi** (nội dung sinh lúc chạy). Phải đọc
code từng chỗ để xác định. `cockpit.tsx` là greeting — **hợp lệ theo luật mới**
(danh tính phiên) và `pages/cockpit.md` đánh dấu "locked" ⇒ **giữ**.

## Implementation Steps

1. Chạy lại inventory (số dòng trong plan chỉ để tham chiếu, **không** để thực thi):
   `grep -rn 'subtitle=' apps/admin/src/pages --include=*.tsx | grep -v design-lab.tsx`
2. Đối chiếu theo **nội dung chuỗi**, không theo số dòng.
3. Sửa chuỗi ràng buộc trước: `classes/index.tsx` + `class-access-guard.test.tsx`
   **cùng commit**.
4. Xoá nhóm XOÁ — xoá cả prop, không để chuỗi rỗng.
5. Rút gọn nhóm GIỮ.
6. Đọc + quyết định 7 chỗ dynamic; `cockpit.tsx` giữ.
7. Chạy `pnpm test` — bắt buộc, đây là required check.

## Tests / Validation

- `pnpm typecheck` xanh.
- `pnpm test` xanh — **đặc biệt `class-access-guard.test.tsx`**.
- `pnpm lint` exit 0 (rule đang ở `warn`).
- Kiểm mắt ≥3 trang (receipt-list, courses, payroll): header không vỡ khi thiếu subtitle.

## Success Criteria

- [ ] 34 nội dung subtitle đều có quyết định + lý do
- [ ] `classes/index.tsx` + `class-access-guard.test.tsx` sửa cùng commit
- [ ] 7 chỗ dynamic đã đọc từng cái; `cockpit.tsx` giữ nguyên
- [ ] `pnpm test` + `pnpm typecheck` xanh
- [ ] Header không vỡ layout (kiểm ≥3 trang)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Xoá mất thông tin cần | Mặc định GIỮ khi nghi ngờ; bảng GIỮ đã xác định |
| Số dòng trôi sau khi xoá | Thực thi theo nội dung chuỗi, không theo dòng |
| Quên sửa unit test kèm | Bước 3 làm trước tiên, cùng commit |
| Sửa nhầm subtitle cockpit (locked) | Bước 6 nêu đích danh: giữ |
| Trùng việc Phase 3 | Bảng giao đã liệt kê; mỗi chuỗi một phase sở hữu |
