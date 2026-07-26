---
phase: 7
title: "Đợt HR/payroll + rewards/admin"
status: done
completed: "2026-07-26 — ĐÓNG ĐỢT. Toàn bộ luồng của Phase 7 xanh 4×: ADM-01/02/03/04/05, P3-09, P3-03/04/07(shift), P3-05(payroll), P4-03, P4-05, P4-04, P3-06/P3-08(KPI), P1-06(liên kết PH). **Sổ 31/38 do CI chứng** (commit eeba671) = TRẦN của journey: 7 luồng còn lại đều no-ui-path có hồ sơ, 0 luồng chưa phân loại ⇒ 38/38 đều có trạng thái máy-chứng."
remaining: 'KHÔNG CÒN GÌ trong Phase 7. 7 luồng no-ui-path (P1-08, P2-01/02/03/05, P3-10/11) không thể phủ bằng journey — muốn phủ phải XÂY UI trước, việc đó thuộc plan sửa, không thuộc plan đo này.'
report: 'plans/reports/phase-07-part1-admin-260725-1920-report.md'
priority: P2
effort: "3-4d"
dependencies: [6]
---

# Phase 7: Đợt HR/payroll + rewards/admin

## Overview
Đợt cuối ERP theo D4: flow thuộc cột `đợt`="HR" + "rewards-admin" trong triage Phase 2 (shift, punch/check-in offsite, KPI, payroll, rewards, meeting, appointment, after-sale, super-admin, facility, audit log) chưa có journey. Sau đợt này, 38/38 flow ERP có trạng thái máy-chứng.

## Requirements
- Functional: như Phase 5; payroll chú ý khuôn 2 ngoại lệ đã có tiền lệ trong journey F4 hiện hành (nhân sự tạo qua UI `create-staff-via-admin-ui`, KHÔNG seedAppUser — bài học instance 2a fabricated-approvals).
- Non-functional: khuôn TDD/negative giữ nguyên; flow admin cần vai `super_admin` — dùng bootstrap super_admin sẵn có (seed tối thiểu hợp lệ theo Q5).

## Architecture
Như Phase 5/6. Flow KPI/payroll phụ thuộc dữ liệu thời gian (punch theo ngày) → dùng đồng hồ dữ liệu trong-ngày-test, không mock thời gian hệ thống (giữ hành vi thật; nếu flow cần "qua tháng" thì đó là ứng viên statusReason `red-fixme` với lý do "cần time-travel — quyết ở plan sửa", không hack).

## Related Code Files
- Create: `apps/e2e/tests/journeys/<flow>.journey.ui.spec.ts` theo triage; helper mới nếu đạt ngưỡng
- Modify: `scripts/acceptance-report/flow-manifest.ts`

## Implementation Steps
1. Lặp khuôn Phase 5 bước 1–4 cho từng flow đợt này.
2. Flow phụ thuộc thời gian: ghi rõ trong spec dữ liệu ngày nào được tạo và assertion đọc theo ngày đó; nếu bất khả trong 1 phiên chạy → statusReason nghi thức.
3. Kết đợt (nghi thức RT-9): 4× spec-của-đợt + 1× full suite (full-suite 4× liên tiếp dồn về Phase 8); regen report — thời điểm này 38/38 ERP có trạng thái.

## Success Criteria
- [x] 38/38 flow ERP có trạng thái máy-chứng trong sổ (proven/đỏ-fixme/no-ui-path — 0 not-written trừ khi triage xếp "trùng")
- [x] 4× spec-của-đợt xanh liên tiếp + 1× full suite xanh
- [x] Không có `seedAppUser` mới nào cho nhân sự (đường UI đã chứng minh tồn tại)

## Công thức P3-06/P3-08 (đã dò từ source 2026-07-26 — vào việc là chạy, không phải dò lại)

Một journey phủ cả 2 luồng. Kỳ dùng **`2026-06`** (kỳ quá khứ): `submitSlipOpensAt` = ngày 3 tháng kế
tiếp ICT (`apps/api/src/kpi/auto-score.ts:275`) ⇒ mở từ `2026-07-03`, hôm nay đã qua ⇒ **không cần mock
đồng hồ**.

Thứ tự bắt buộc (mỗi bước là điều kiện của bước sau):

1. **Tạo NV `sale` qua UI** — `createStaffViaAdminUi(..., roleLabels: ['Sale'])`. Cần role DB thật vì màn
   "Gán bậc" lọc theo `roles.includes('sale')`.
2. **Tạo GĐKD như một AppUser** — `kpi.confirm` tra `confirmUser` theo `ctx.subject.userId`; nếu GĐKD
   không có hàng AppUser thì guard **fail-closed**.
3. **Gán `managerId`: sale.managerId = GĐKD.id** — `kpi.confirm` đòi `scoreOwner.managerId === confirmUser.id`
   (`kpi/router.ts`, chỉ `super_admin` được bỏ qua). **KHÔNG có UI gán quản lý** (`/admin/users` không có
   trường này, đã kiểm) ⇒ seed thẳng DB, cùng lý lẽ với `seedStudent`. `user.create/update` có nhận
   `managerId` nhưng màn hình không phơi ra.
4. **Tạo bậc lương + gán cho sale qua UI** — `submitSlip` chặn với "Chưa gán bậc lương…" nếu thiếu.
   Khuôn có sẵn: `payroll-assemble-finalize.journey.ui.spec.ts`.
5. **Sale: `/hr/my`, kỳ 2026-06 → "Tính lại" → "Nộp"** — `refresh` tạo hàng KpiScore `draft`;
   `submitSlip` mới có cái để chuyển sang `submitted`. (P3-06 vế nộp)
6. **GĐKD: `/hr/payroll` kỳ 2026-06 → "Tính lương" → "Chốt bảng lương"** — **bắt buộc**: `bulkApprove`
   bỏ qua mọi phiếu KPI mà Payslip cùng kỳ chưa `finalized` (`skippedUnfinalized`), nên thiếu bước này
   thì bước 8 chạy nhưng **không đổi gì** — đúng loại xanh-giả cần tránh.
7. **GĐKD: `/hr/kpi` kỳ 2026-06 → "Xác nhận"** trên hàng của sale → `confirmed`. (P3-06 vế duyệt)
8. **GĐKD: nút "Đã trả lương kỳ 2026-06"** → `bulkApprove` → `approved`. (P3-08)

Nhãn trạng thái để assert: `draft`=Nháp · `submitted`=Chờ xác nhận · `confirmed`=Đã xác nhận ·
`approved`=Đã duyệt.

**Bẫy đã biết (rút từ P4-04):** nhãn trạng thái có thể trùng label nút ⇒ assert phải neo vào sự hiện diện
trước khi khẳng định vắng mặt; và nếu journey nhập ngày/giờ thì ghim `timezoneId: 'Asia/Ho_Chi_Minh'` cho
browser context, nếu không sẽ xanh ở máy ICT và đỏ trên runner UTC.

## Công thức P1-06 (đã dò 2026-07-26 — luồng cuối để chạm trần 31/38)

**Phát hiện quyết định: `guardian.requestLink` KHÔNG có UI ở bất kỳ đâu.** Đã quét rộng `apps/lms/src`
(`requestLink|liên kết|guardian|linkRequest|studentRef`): chỉ có `setPhotoConsent` và `parent/home.tsx`.
Chính màn parent nói thẳng: *"Liên hệ nhân viên để yêu cầu duyệt liên kết"* (`parent/home.tsx:149`) —
tức phụ huynh **không tự yêu cầu được** qua giao diện; đây là quy trình ngoài luồng.

⇒ P1-06 là **no-ui-path MỘT PHẦN**: vế kích hoạt (`requestLink`) không có UI, nhưng vế quản trị
(`listPendingLinks` / `approveLink` / `rejectLink` / `parentAccount.updateEmail`) có UI thật ở
`/admin/parents`.

**Cách làm đúng provenance (KHÔNG seed thẳng DB cho request):** gọi `guardian.requestLink` bằng
**API thật với phiên phụ huynh thật** — `createLmsClient` / `createSignedLmsClient`
(`apps/e2e/src/trpc-client.ts`), `DevLmsIdentity = { parentAccountId }`. Đây là chạy đúng procedure mà
luồng khai, chỉ thiếu *màn hình*, nên không phải seed.

Trình tự:

1. `seedClassBatch` → `provisionStudentViaReceipt` (chuỗi phiếu thu thật) — tạo **ParentAccount** (find-or-create
   theo phone) + học sinh A + Guardian đã duyệt. Đây là đường DUY NHẤT sinh ParentAccount; chưa có helper nhẹ hơn.
2. `seedStudent` → học sinh **B** và **C** (chưa liên kết).
3. Tra `parentAccountId` theo phone (đã có tiền lệ tra theo phone trong `db.ts`), dựng LMS client.
4. Parent gọi `guardian.requestLink({ studentRef: B })` → `{ status: 'created' }` → sinh yêu cầu `pending`.
   Lặp cho **C**.
5. Admin mở `/admin/parents` → hàng của B bấm **"Duyệt"** (`approveLink`); hàng của C bấm **"Từ chối"**
   (`rejectLink`). Bộ lọc "Lọc theo trạng thái" có `Từ chối` ⇒ dùng **bằng chứng dương** (chuyển bộ lọc và
   thấy hàng ở trạng thái mới), đừng chỉ assert biến mất — bài học từ P3-06.
6. Tuỳ chọn phủ nốt `parentAccount.updateEmail` bằng nút **"Cập nhật email"** trên cùng màn.

**Rủi ro cần canh:** `requestLink` trả `already_linked` nếu phụ huynh đã liên kết học sinh đó — nên B và C
phải là học sinh KHÁC với A do provisioning tạo.

## Risk Assessment
- Payroll "qua kỳ lương" có thể không tái hiện trong 1 run → chấp nhận red-fixme trung thực thay vì mock đồng hồ (đổi hành vi test ≠ đổi hành vi app; mock time là quyết định thuộc plan sửa).
- Mệt mỏi cuối chặng → mỗi flow vẫn bắt buộc đủ ô bằng-chứng như Phase 2 đã lập.
