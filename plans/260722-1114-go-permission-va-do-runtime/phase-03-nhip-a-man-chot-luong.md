---
phase: 3
title: "Nhip A - man chot luong"
status: pending
priority: P1
dependencies: [2]
---

# Phase 3: Màn chốt lương

## Overview

`/hr/payroll` mở cho GĐKD/GĐĐT qua nav gate `payslip.assemble`, nhưng trang gọi `trpc.user.list` **vô điều kiện** — mà `user.list` đòi `user.manage: []` (mảng rỗng = chỉ `super_admin` qua bypass). Kết quả: hai giám đốc mở màn chốt lương nhưng **không lấy được danh sách nhân viên để chọn người**.

## ⚠️ F4 có **4 consumer**, không phải 1 (red-team vòng 3, đã đo)

`grep trpc.user.list.` trong `apps/admin/src/pages` (loại test) trả **4 file**:

| File | Vai được nav mở | Tình trạng |
|---|---|---|
| `admin/users.tsx` | super_admin | **Đúng** — ADM-02 vốn là màn super_admin, không đụng |
| `hr/payroll.tsx:414` | GĐKD, GĐĐT (`payslip.assemble`) | **Hỏng** — bản đầu chỉ sửa cái này |
| `hr/salary-tiers.tsx:299` | GĐKD, GĐĐT (`salaryTier.manage`) | **Hỏng — cùng lỗi, chưa ai nêu.** Role set **giống hệt** `payslip.assemble` |
| `classes/class-detail.tsx:24` (`TeacherPicker`) | GĐĐT (`class.create`) | **Hỏng** — GĐĐT không có `user.manage` ⇒ dropdown giáo viên rỗng ⇒ **`classBatch.assignTeacher` không dùng được** (luồng P2-01) |

**Vì sao phải sửa cả 3, không chỉ payroll:** `salaryTier.manage` là **nguồn `baseSalary` duy nhất**. Sửa payroll mà bỏ salary-tiers thì chốt được lương cho nhân viên **chưa gán bậc** — fix trở thành vô nghĩa về nghiệp vụ.

Phase này land **cùng commit** với Phase 1–2 (xem Rollback trong `plan.md`) — bản đầu ghi "chạy song song", mâu thuẫn với yêu cầu revert-1-commit.

## Requirements

**Functional**
- GĐKD và GĐĐT lấy được danh sách nhân viên ở **cả 3 màn**: `/hr/payroll`, `/hr/salary-tiers`, và `TeacherPicker` trong `/admin/classes/:id`.
- ⚠️ **KHÔNG gate bằng union `payslip.assemble | salaryTier.manage | class.create`.** Union hôm nay vô hại (cả ba cùng roster [GĐKD, GĐĐT] hoặc con của nó), nhưng nó tạo **chiều phụ thuộc sai**: màn quản trị lớp sẽ phụ thuộc một quyền có roster **cố ý trùng** `payslip.finalize`/`finance.receiptApprove` — chính gate separation-of-duties của ADR-B (`packages/auth/src/index.ts:65-67,72-74`).
  **Kịch bản:** sau này `class.create` được cấp cho một vai điều phối học vụ ⇒ TeacherPicker 403 không rõ lý do ⇒ cách sửa rẻ nhất *trông như* thêm vai đó vào `payslip.assemble` ⇒ âm thầm trao quyền lắp bảng lương. **Đúng hình dạng lỗi F1** — thứ plan này tồn tại để chống.
  → Cấp **key riêng** (ví dụ `staff.pickList`) với roster viết tường minh, để mở rộng quản trị lớp không bao giờ chạm quyền tiền.

**Non-functional**
- **Không** cấp `user.read` rộng. `user.list` trả hồ sơ nhân sự đầy đủ; màn chốt lương không cần chừng đó.
- Least-privilege: procedure mới trả đúng những field trang dùng.

## Architecture

`payroll.tsx:414` gọi `trpc.user.list.useQuery()` trong `PayrollPage()` — không `enabled:`, không nằm trong component con có gate (đã đọc `:401-418` xác nhận). `user/router.ts:129`: `list: requirePermission('user','manage')`. `packages/auth/src/index.ts:96`: `'user.manage': []`.

Trang chỉ dùng **4 field** (`payroll.tsx:416-420`):
```ts
{ id, fullName, employeeCode, position }
```

**Hai hướng, chọn (b):**
- (a) Thêm `user.read` cho GĐKD/GĐĐT → nhanh, nhưng mở toàn bộ hồ sơ nhân sự cho 2 vai.
- **(b) Procedure hẹp** trong payroll router, trả đúng 4 field trên, gate bằng `payslip.assemble` (quyền vốn đã mở màn này) → phạm vi khớp mục đích.

(b) tốn hơn một chút nhưng không mở rộng bề mặt PII nhân sự, và gate tự nhiên trùng với gate nav — không phát sinh khái niệm quyền mới.

## Related Code Files

- Modify: `apps/api/src/payroll/router.ts` — thêm procedure hẹp (ví dụ `payslip.assignableStaff`), gate `payslip.assemble`
- Modify: `apps/admin/src/pages/hr/payroll.tsx:414` — đổi sang procedure mới
- **Modify: `apps/admin/src/pages/hr/salary-tiers.tsx:299`** (`AssignTab`) — cùng lỗi
- **Modify: `apps/admin/src/pages/classes/class-detail.tsx:24`** (`TeacherPicker`) — cùng lỗi, chặn `assignTeacher`
- Modify: mock trong `hr/salary-tiers.test.tsx`, `classes/class-detail.test.tsx`
- Modify: `apps/admin/src/pages/hr/payroll.test.tsx` — cập nhật mock binding
- **Modify: `scripts/acceptance-report/flow-manifest.ts`** — khai procedure mới vào P3-05 (bắt buộc, xem bước 6)
- Read-only: `apps/api/src/user/router.ts:129` (không đụng `user.list`)

## Implementation Steps

**TDD.**

1. Viết test trước: procedure mới gọi được bởi `giam_doc_kinh_doanh` và `giam_doc_dao_tao`; **FORBIDDEN** với `sale` và `giao_vien`. Chạy → đỏ (procedure chưa tồn tại).
2. Thêm procedure hẹp vào `payroll/router.ts`, gate `requirePermission('payslip','assemble')`, `select` đúng 4 field, facility-scoped qua `scoped(ctx)` + `withFacility` như các procedure khác trong file.
3. Chạy lại test → xanh.
4. Đổi `payroll.tsx:414` sang procedure mới; cập nhật mock trong `payroll.test.tsx`.
5. **Không** đụng `user.list` / `user.manage` — ADM-02 giữ nguyên là màn super_admin.
6. ⚠️ **Khai procedure mới vào `scripts/acceptance-report/flow-manifest.ts`** (luồng P3-05). Không khai thì nó thành **orphan chưa phân loại**, và Phase 6 biến đúng đường đó thành exit non-zero ⇒ gate mới đỏ ngay ngày đầu vì chính công việc của plan này. Baseline đo được: 38 luồng, **1 orphan, 0 chưa phân loại, exit 0** — repo đang ở đúng ngưỡng.
7. 🔴 **Vá lỗ kiểm tra vai ở `classBatch.assignTeacher` — Phase 3 kích hoạt nó.**
   Procedure đó resolve người được gán bằng `tx.appUser.findFirst({ where: { id, facilityId } })` — **không** assert AppUser có vai `giao_vien`. Hiện chưa chạm tới được vì picker rỗng (403). Phase 3 làm picker chạy được **và** feed nó danh sách **toàn bộ** nhân sự.
   **Hậu quả nếu bỏ qua:** GĐĐT gán một `sale` làm giáo viên; `ClassBatch.teacherAppUserId` là nguồn credit **giờ dạy vào payroll và KPI** ⇒ giờ dạy cộng cho người không dạy, công thức payslip tiêu thụ số sai.
   Việc phải làm: (a) procedure picker **lọc về AppUser có vai giáo viên**, (b) thêm assertion vai **phía server** trong `assignTeacher`, (c) negative test.
8. Chạy `pnpm acceptance:report` → vẫn `0 chưa phân loại`.

## Test / Validation

- `pnpm --filter @cmc/api test` — test mới xanh, `payslip-my.test.ts` / `policy-*.test.ts` không hồi quy.
- `pnpm --filter @cmc/admin test` — `payroll.test.tsx` xanh.
- Probe live: GĐKD gọi procedure mới → OK; `sale` → FORBIDDEN.
- UAT: GĐKD mở `/hr/payroll` → thấy danh sách nhân viên.

## Success Criteria

- [ ] Test viết trước, phủ cả positive (GĐKD/GĐĐT) lẫn negative (`sale`, `giao_vien`)
- [ ] GĐKD thấy danh sách nhân viên ở **cả 3 màn**: `/hr/payroll`, `/hr/salary-tiers`, và `TeacherPicker` ở `/admin/classes/:id`
- [ ] GĐĐT gán được giáo viên cho lớp (`classBatch.assignTeacher` dùng được — luồng P2-01)
- [ ] 🔴 **`assignTeacher` assert vai `giao_vien` phía server** + negative test: gán một `sale` làm giáo viên → FORBIDDEN
- [ ] `user.list` và `user.manage` **không đổi** — ADM-02 vẫn là màn super_admin
- [ ] Procedure mới trả đúng 4 field, facility-scoped
- [ ] Procedure mới đã khai trong `flow-manifest.ts`; `pnpm acceptance:report` vẫn `0 orphan chưa phân loại`
- [ ] `pnpm test` xanh

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Procedure mới rò field ngoài 4 field cần | Trung bình | `select` tường minh, không `include`; test assert đúng shape |
| Quên facility scope → cross-facility leak | **Cao** | Theo đúng mẫu `scoped(ctx)` + `withFacility` của các procedure khác trong `payroll/router.ts`; thêm test negative cross-facility |
| Trùng lặp với `user.list` (DRY) | Thấp | Chấp nhận: hai mục đích khác nhau, phạm vi field khác nhau; ghi comment 1 dòng nêu lý do tồn tại riêng |
