---
phase: 2
title: "Nhip A - chan duong vao UI"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Chặn đường vào UI

## Overview

Phase 1 mở quyền đọc lớp cho 4 vai. Nếu dừng ở đó, `sale` và `giao_vien` **vào được surface quản trị lớp** — vì `/admin/classes` hiện không có gate nào, chặn duy nhất là 403 từ `classBatch.list` mà Phase 1 vừa gỡ.

**Cập nhật sau Q3′:** đường rò PII chính (`listStudents`) đã được đóng ở **tầng API** bằng `classRoster.read` trong Phase 1. Phase này giờ chỉ còn nhiệm vụ **giảm bề mặt UI** — đúng phạm vi thật của nó.

⚠️ **Vẫn KHÔNG được ghi Phase này là "mitigation PII" — lý do bên dưới giữ nguyên giá trị cảnh báo:**
Nav gate và `canDo()` page guard đều là **lớp client trong SPA Vite**, không phải access control. Sau Phase 1, `classBatch.listStudents` gate bằng `class.read` (quyền `sale`/GV vừa được cấp) và trả `fullName` của trẻ (`class-batch-router.ts:254-278`). Một session `sale` gọi thẳng `/trpc/classBatch.list` rồi `classBatch.listStudents` từ devtools sẽ **dump tên mọi trẻ trong cơ sở**, và đường đọc đó **không có audit log**.
→ Phase này chỉ **giảm bề mặt UI**. Phơi nhiễm tầng API là **residual chưa giảm** của Q3. Nếu muốn giảm thật thì phải giữ `listStudents` ở một key hẹp hơn `class.read` — nhưng đó là mở lại Q3, cần PO.

## Requirements

**Functional**
- `/admin/classes` chỉ hiện và chỉ vào được với vai được phép quản trị lớp.
- Rà **toàn bộ 8 nav entry không có `permission:`** — xác định mỗi cái là cố ý hay bỏ sót.

**Non-functional**
- Không phá nav của vai đang dùng hợp lệ (GĐĐT).

## Architecture

`nav-registry.ts:36`:
```ts
{ id: 'classes', label: 'Lớp học', path: '/admin/classes', icon: 'layers' },
```
Không có `permission:` ⇒ hiện cho **mọi** vai. Không có route-level guard trong `apps/admin/src/routes/*.tsx`, nhưng **5 màn admin tự guard ở cấp page** (mẫu `users.tsx:307`) — `classes/index.tsx` thì **không có gì**. Nên với riêng màn này, nav đúng là lớp chặn client duy nhất.

Phân bố hiện tại: **19/27** nav entry lá có gate, **8** không có. *(32 `path: '/` tổng cộng — 5 cái là group cha, không phải màn.)*

**Danh sách 8 entry không gate, kèm phán đoán ban đầu — bước 1 phải xác nhận hoặc bác từng cái:**

| Entry | Phán đoán | Vì sao |
|---|---|---|
| `/cockpit` | cố ý | Dashboard, widget đã render có điều kiện theo quyền (`cockpit.tsx` — đã kiểm, không phải lỗi) |
| `/hr/checkin` | cố ý | Mọi nhân viên đều chấm công |
| `/hr/shifts` | cố ý | Mọi nhân viên đăng ký ca |
| `/hr/my` | cố ý | Màn cá nhân |
| **`/admin/classes`** | **bỏ sót** | Surface quản trị lớp — trọng tâm phase này |
| `/teaching/schedule` | **nghi ngờ** | Red-team vòng trước xếp cùng nhóm hỏng kiểu F2 |
| `/teaching/session-evidence` | **nghi ngờ** | Như trên |
| `/ops/revenue` | **nghi ngờ** | Màn doanh thu — dữ liệu tài chính, chưa rõ ai được xem |

**Ngoài 8 entry trên, còn một màn nguy hiểm hơn vì KHÔNG có nav entry nào cả:**

| Route | Kết luận (Q4′ — đã quyết) |
|---|---|
| `/finance/class-placement` (`finance.routes.tsx:38` → `pages/enrollment/class-placement.tsx`) | **KHÔNG cần page-level guard.** Gọi `classBatch.list` + `student.lookup` + `enrollment.enroll` — actor tự nhiên là sale/GĐKD/GĐĐT, đúng nhóm được cấp `class.read`. Hành động ghi đã bị `enrollment.enroll` chặn ở API; GV vào được nhưng không enroll được. **Không gọi `listStudents`** ⇒ không nằm trên đường rò PII.<br>**Việc thật cần làm:** màn này **không có nav entry** nên không ai tìm thấy qua menu — xác nhận nó được vào từ đâu (nhiều khả năng từ màn phiếu thu) hoặc thêm nav entry. Đây là vấn đề khám phá, không phải bảo mật. |

Không phải cả 8 đều sai. Phase này **phân loại từng cái**, không gate mù.

**Đã quyết:** nav gate là lớp client, không phải lớp bảo mật. Với `/admin/classes`, ẩn menu **không đủ** — cần thêm page-level guard (bước 4) vì gõ URL vẫn vào được và từ đó đi tiếp tới `listStudents`. Các procedure **ghi** vẫn do `class.create` chặn ở API nên không cần gate API mới.

## Related Code Files

- Modify: `apps/admin/src/shell/nav-registry.ts` — thêm `permission:` cho `/admin/classes`, và cho các entry khác nếu rà thấy thiếu
- Modify: `apps/admin/src/pages/classes/index.tsx` + `classes/class-detail.tsx` — ẩn hành động ghi với vai chỉ có `class.read`. *(Bản đầu ghi `pages/admin/classes/*` — **đường dẫn đó không tồn tại**; màn lớp nằm ở `pages/classes/`.)*
- Read-only: `apps/admin/src/routes/*.tsx` (xác nhận không có route guard)

## Implementation Steps

1. Liệt kê 8 nav entry không có `permission:`; với mỗi cái ghi 1 dòng: cố ý (mọi vai dùng được) hay bỏ sót.
2. Thêm `permission: { module: 'class', action: 'create' }` cho `/admin/classes` — quản trị lớp là việc của GĐĐT, còn `class.read` chỉ để **chọn lớp** ở màn khác.
3. Với các entry bỏ sót khác: thêm gate tương ứng, mỗi cái kèm lý do.
4. **Thêm page-level guard cho `classes/index.tsx`** — nav gate chỉ ẩn menu, **không** chặn gõ URL. Repo đã có mẫu: `apps/admin/src/pages/admin/users.tsx:307` (dùng ở 5 màn admin). `classes/index.tsx` hiện **không có `canDo` nào**. Không thêm bước này thì tiêu chí "gõ URL không vào được" **không có bước nào thực hiện**, và `sale` vẫn đi tiếp được tới `/admin/classes/:id` → `listStudents` → tên trẻ em.
5. Rà `apps/admin/src/pages/classes/index.tsx` và `classes/class-detail.tsx` (**không phải** `pages/admin/classes/*` — đường dẫn đó không tồn tại): vai chỉ có `class.read` không được thấy nút ghi (create/assignTeacher). API vẫn chặn, nhưng UI không nên mời gọi thao tác sẽ 403. Lưu ý `class-detail.tsx:30-31` đang render `TeacherPicker` + mutation `assignTeacher` vô điều kiện.
6. Kiểm tay: đăng nhập `sale` → không thấy menu "Lớp học"; gõ thẳng `/admin/classes` → guard chặn; gõ `/admin/classes/:id` → cũng chặn.

## Test / Validation

- ⚠️ **Cạm bẫy: test snapshot trên `visibleModulesFor` là test giả.** Hàm đó chỉ lọc **module cấp trên**; gating mục con nằm ở `apps/admin/src/shell/shell.tsx:35 isChildVisible` (chính `nav-registry.test.ts:55-57` nói vậy). Snapshot qua `visibleModulesFor` sẽ báo `/admin/classes` "visible" cho `sale` **trước và sau** khi sửa ⇒ ghi nhận "đã verify" trong khi lỗ hổng còn nguyên.
- Test phải đi qua `isChildVisible` (hoặc render shell thật) mới kiểm được thứ phase này đổi.
- Test riêng cho page-level guard: render `classes/index.tsx` với session `sale` → không render surface quản trị.
- UAT trình duyệt: `sale`, `giao_vien`, `giam_doc_dao_tao` × `/admin/classes`.
- `pnpm --filter @cmc/admin test` xanh.

## Success Criteria

- [ ] 8 nav entry không gate đã được phân loại, mỗi cái có kết luận ghi lại
- [ ] `/admin/classes` có `permission:` **và** `classes/index.tsx` có page-level guard; `sale` bị chặn cả qua menu lẫn gõ URL (gồm `/admin/classes/:id`)
- [ ] Test đi qua `isChildVisible`, không phải `visibleModulesFor` (tránh test giả)
- [ ] Vai chỉ có `class.read` không thấy nút ghi trên màn lớp
- [ ] Test nav-registry phủ mọi `ACTIVE_ROLES`
- [ ] GĐĐT vẫn dùng được đầy đủ màn quản trị lớp (không chặn nhầm)

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Gate nhầm làm GĐĐT mất màn quản trị lớp | Cao | Test snapshot theo vai; UAT GĐĐT trước khi đóng phase |
| Gate mù cả 8 entry → chặn nhầm màn vốn dành cho mọi vai | Trung bình | Bước 1 phân loại từng cái, có lý do; không gate hàng loạt |
| Hiểu nhầm nav gate là lớp bảo mật | Trung bình | Ghi rõ trong Architecture: API mới là lớp chặn thật; nav chỉ giảm bề mặt |
