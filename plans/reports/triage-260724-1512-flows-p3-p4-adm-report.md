# Triage 21 luồng (P3-01..11, P4-01..05, ADM-01..05) — build map cho journey specs

Date: 2026-07-24 · Branch: `acceptance-journey-38-lms` · READ-ONLY (file này là write duy nhất).

Nguồn authority đã đọc full: `scripts/acceptance-report/flow-manifest.ts`,
`apps/admin/src/shell/nav-registry.ts`, `packages/auth/src/index.ts` (PERMISSIONS +
`can()` super_admin bypass), `apps/admin/src/routes/{hr,admin,crm,ops}.routes.tsx`,
các page dưới `apps/admin/src/pages/{hr,attendance,admin,crm,engagement}`,
`apps/lms/src/pages/student/gifts.tsx`, 5 journey mẫu + 3 helper
(`menu-nav.ts`, `find-in-list.ts`, `create-staff-via-admin-ui.ts`),
`apps/api/src/{kpi,payroll,shift,appointment,audit,facility}/router.ts`,
`apps/api/src/worker/{index.ts,session-done-sweep.ts}`, `apps/api/src/class/session-done.ts`.

## 0. Cách đọc cột

- **đợt**: business-grouping MỚI (KHÔNG phải `cluster` P1..P4/ADMIN trong manifest).
  `HR` = ca làm/chấm công/KPI/lương. `rewards-admin` = đổi thưởng/quà/họp/lịch
  test/sau bán/super-admin/cơ sở/IP/audit.
- **nav-reachability**: xác minh riêng bằng `nav-registry.ts` + `PERMISSIONS` +
  `visibleNavPathsFor` (module gate `roles` → child gate `permission`), KHÔNG suy
  từ call-site. `can()` cho super_admin bypass mọi key ⇒ mọi entry có `permission`
  đều nav-yes cho super_admin.
- **TIME**: "single-run" = chạy trọn trong 1 test run với dữ liệu tạo trong ngày
  chạy. Không đề xuất mock clock ở bất kỳ luồng nào.

Nav matrix rút từ registry (dùng lại cho toàn bảng):

| path | nav entry | permission key | roles thấy entry |
|---|---|---|---|
| /hr/checkin | Nhân sự → Chấm công | (none) | mọi vai đăng nhập |
| /hr/shifts | Nhân sự → Đăng ký ca | (none) | mọi vai |
| /hr/my | Nhân sự → Của tôi | (none) | mọi vai |
| /hr/kpi | Nhân sự → Duyệt KPI | kpi.confirm | GĐĐT, GĐKD, super_admin |
| /hr/payroll | Nhân sự → Chốt lương | payslip.assemble | GĐKD, GĐĐT, super_admin |
| /hr/salary-tiers | Nhân sự → Bậc lương | salaryTier.manage | GĐKD, GĐĐT, super_admin |
| /admin/engagement/gifts | Gắn kết → Quà tặng | gift.upsert | GĐKD, GĐĐT, super_admin |
| /admin/engagement/rewards | Gắn kết → Đổi thưởng | rewards.manage | GĐKD, GĐĐT, sale, super_admin |
| /crm | Tài chính & Điều hành → CRM | crm.opportunityList | GĐKD, sale, super_admin |
| /crm/post-sale-meeting | … → Họp sau bán | parentMeeting.manage | GĐKD, GĐĐT, sale, super_admin |
| /crm/aftersale | … → Sau bán | afterSale.manage | GĐKD, GĐĐT, sale, super_admin |
| /admin/users,/facilities,/network-ip,/shift-config,/audit-log | Quản trị → … | module `roles:['super_admin']` + key | super_admin only |
| /crm/opportunities/:id | KHÔNG có entry riêng | — | vào bằng click card trên /crm |

---

## 1. Đợt HR (12 luồng)

| ID | displayName | đợt | actor sequence | screen / step | nav-reachability | phân loại | spec đề xuất | TIME |
|---|---|---|---|---|---|---|---|---|
| P3-01 | Chấm công cặp vào/ra | HR | super_admin (tạo NV) → giao_vien punch | /admin/users → /hr/checkin | nav-yes (Nhân sự → Chấm công, không gate) | trùng-journey-hiện-có | `checkin-punch.journey.ui.spec.ts` | single-run |
| P3-02 | Duyệt phiếu offsite | HR | super_admin (ca+IP) → sale punch offsite → GĐĐT (negation) → GĐKD duyệt | /admin/shift-config, /admin/network-ip, /hr/checkin | nav-yes (Nhân sự → Chấm công; Quản trị → Ca làm việc / IP mạng cho super_admin) | trùng-journey-hiện-có (thiếu reject/resubmit) | `checkin-offsite-approval.journey.ui.spec.ts` | single-run (seed ShiftRegistration hôm nay — đã có exception) |
| P3-03 | Đăng ký ca làm | HR | super_admin (ShiftGroup/Template) → sale/giao_vien submit + xem "Đăng ký của tôi" + huỷ | /admin/shift-config → /hr/shifts tab "Đăng ký ca mới" / "Đăng ký của tôi" | nav-yes (Nhân sự → Đăng ký ca, không gate) | viết-được | `shift-register-approve-reject.journey.ui.spec.ts` (chung 03/04/07) | single-run — `fromDate` phải là NGÀY MAI (guard future), nhưng submit/duyệt xảy ra ngay |
| P3-04 | Duyệt ca | HR | (tiếp P3-03) GĐKD mở tab "Duyệt / Từ chối" → Duyệt | /hr/shifts | nav-yes (như trên; tab approve chỉ render khi `canDo('shift','approve')`) | viết-được | cùng file trên | single-run |
| P3-07 | Từ chối ca (kèm lý do) | HR | (tiếp P3-03) GĐKD → "Từ chối" + lý do ≥3 ký tự | /hr/shifts | nav-yes | viết-được | cùng file trên | single-run |
| P3-05 | Chốt lương tháng | HR | super_admin tạo NV (role Sale) → GĐ tạo bậc lương + gán bậc → GĐ assemble + finalize (+ reopen) | /admin/users → /hr/salary-tiers → /hr/payroll (+/hr/my cho payslip.my) | nav-yes (Nhân sự → Bậc lương / Chốt lương / Của tôi) | viết-được (journey hiện có chỉ phủ roster) | `payroll-assemble-finalize.journey.ui.spec.ts` | single-run — `payslip.assemble` KHÔNG có guard "hết tháng", chỉ đọc punch trong `ictMonthBounds(period)`; dùng kỳ hiện tại |
| P3-06 | Nộp & duyệt phiếu KPI | HR | super_admin tạo NV(role Sale) → GĐ gán bậc lương → sale nộp trên /hr/my → GĐKD "Xác nhận" trên /hr/kpi | /admin/users → /hr/salary-tiers → /hr/my → /hr/kpi | /hr/my nav-yes (không gate); /hr/kpi nav-yes cho GĐKD/GĐĐT/super_admin, **nav-no cho sale/giao_vien** (đúng thiết kế) | viết-được **có seed exception** | `kpi-submit-confirm-bulk-approve.journey.ui.spec.ts` (chung 06/08) | single-run KHÔNG cần time travel: đặt `period` = tháng-trước-tháng-trước (ô "Kỳ (YYYY-MM)" nhập tay) ⇒ luôn qua mốc ngày-3. Dùng kỳ hiện tại thì FAIL 100% |
| P3-08 | Tất toán KPI hàng loạt | HR | (tiếp P3-06) GĐ assemble+finalize payslip cùng kỳ → GĐ bấm "Đã trả lương kỳ X" | /hr/payroll → /hr/kpi | nav-yes (GĐ) | viết-được **có seed exception** (kế thừa của P3-06) | cùng file trên | single-run, cùng ràng buộc kỳ quá khứ như P3-06 |
| P3-09 | Tính lại điểm KPI | HR | super_admin tạo NV → GĐ gán bậc → nhân viên bấm "Tính lại" trên /hr/my | /hr/salary-tiers → /hr/my | nav-yes (Nhân sự → Của tôi, không gate) | viết-được | `kpi-refresh-my.journey.ui.spec.ts` | single-run, kỳ hiện tại (refresh KHÔNG có guard ngày-3) |
| P3-10 | Đánh giá buổi học hoàn thành | HR | `he_thong` (worker process) — không actor người | KHÔNG có route | n/a (không màn) | thiếu-đường-UI | — | **red-fixme**: cần buổi học đã qua `endTime` + 3 điều kiện done, và cần chạy sweep |
| P3-11 | Tự huỷ buổi 0 điểm danh + buổi bù | HR | `he_thong` (worker process) | KHÔNG có route | n/a | thiếu-đường-UI | — | **red-fixme**: cần `endTime + 24h` đã trôi qua |
| ADM-05 | Cấu hình ca làm | HR (xem ghi chú) | super_admin tạo ShiftGroup + ShiftTemplate + lưu chính sách phạt | /admin/shift-config | nav-yes (Quản trị → Ca làm việc, key `compensationPolicy.manage` = [] ⇒ chỉ super_admin bypass) | viết-được | `shift-config-admin.journey.ui.spec.ts` | single-run |

**Ghi chú đợt cho ADM-05**: hai từ khoá của bạn xung đột — "shift" ⇒ HR, "super-admin"
⇒ rewards-admin. Chọn **HR** vì đối tượng nghiệp vụ (ShiftGroup/ShiftTemplate/
CompensationPolicy) là input trực tiếp của P3-02/03/04/05; xếp sang rewards-admin sẽ
tách nó khỏi mọi luồng tiêu thụ nó. Đây là quyết định của tôi, đảo được nếu bạn muốn.

## 2. Đợt rewards-admin (9 luồng)

| ID | displayName | đợt | actor sequence | screen / step | nav-reachability | phân loại | spec đề xuất | TIME |
|---|---|---|---|---|---|---|---|---|
| P4-01 | Đổi quà bằng sao | rewards-admin | GĐKD tạo quà → (hoc_vien redeem — LMS) → sale duyệt → sale giao | /admin/engagement/gifts → /admin/engagement/rewards (+ /student/gifts phía LMS) | nav-yes (Gắn kết → Quà tặng cho GĐKD; Gắn kết → Đổi thưởng cho sale). `/student/gifts` KHÔNG nằm trong nav-registry (app LMS) — vào bằng nút "Đổi quà" ở /student/home | trùng-journey-hiện-có (nửa admin) | `rewards-redeem-approval.journey.ui.spec.ts`; tuỳ chọn thêm `student-redeem-gift.journey.ui.spec.ts` cho nửa LMS | single-run |
| P4-02 | Cấu hình quà đổi sao | rewards-admin | GĐKD tạo quà; sale KHÔNG thấy entry | /admin/engagement/gifts | nav-yes cho GĐKD/GĐĐT; **nav-no cho sale** (đúng thiết kế, là negation của journey) | trùng-journey-hiện-có | `gift-config-nav.journey.ui.spec.ts` | single-run |
| P4-03 | Lên lịch & nhắc họp PH | rewards-admin | sale tạo phiếu thu HV mới → GĐKD duyệt (sinh Student) → sale/GĐ đặt lịch họp → hoàn tất / huỷ | /finance/class-placement → /finance/new → /finance/:id → /crm/post-sale-meeting | nav-yes (Tài chính & Điều hành → Họp sau bán) cho GĐKD/GĐĐT/sale | viết-được | `post-sale-meeting-schedule.journey.ui.spec.ts` | single-run (`scheduledAt` tương lai vài giờ là đủ) |
| P4-04 | Đặt lịch test đầu vào | rewards-admin | sale tạo cơ hội trên /crm → "Chuyển lên" O1→O2 → "Đặt lịch test" (O2→O3) → mở detail → "Hoàn thành" (O3→O4) / "Vắng mặt" | /crm → /crm/opportunities/:id | nav-yes (Tài chính & Điều hành → CRM) cho sale; route detail không có entry riêng, vào bằng click card | viết-được | `entrance-test-appointment.journey.ui.spec.ts` | single-run |
| P4-05 | Chăm sóc sau bán | rewards-admin | (sinh Student như P4-03) → sale "Tạo case" → "Tiếp nhận" (advance) → "Xử lý" (resolve) → "Đóng"; GĐ đổi lifecycle HV | /crm/aftersale (+ /admin/students/:id cho `student.setLifecycle`) | nav-yes (Tài chính & Điều hành → Sau bán); /admin/students nav-yes (Lớp & Học sinh → Học viên, key `student.lookup`) | viết-được | `after-sale-case-lifecycle.journey.ui.spec.ts` | single-run |
| ADM-01 | Quản trị cơ sở | rewards-admin | super_admin tạo cơ sở → sửa tên | /admin/facilities | nav-yes (Quản trị → Cơ sở, key `facility.list` = [] ⇒ super_admin bypass) | viết-được | `facility-admin-crud.journey.ui.spec.ts` | single-run |
| ADM-02 | Quản trị tài khoản nhân sự | rewards-admin | super_admin tạo NV → gán roles qua MultiSelector | /admin/users | nav-yes (Quản trị → Người dùng, key `user.manage` = []) | viết-được | `user-admin-roles.journey.ui.spec.ts` | single-run |
| ADM-03 | Cấu hình mạng chấm công (IP) | rewards-admin | super_admin thêm dải → sửa nhãn → dò IP → xoá | /admin/network-ip | nav-yes (Quản trị → IP mạng, key `facilityNetwork.manage` = []) | viết-được | `network-ip-config.journey.ui.spec.ts` | single-run |
| ADM-04 | Nhật ký hệ thống | rewards-admin | super_admin làm 1 hành động ghi audit (vd tạo cơ sở/NV) → mở nhật ký, lọc theo "Người thực hiện" | /admin/facilities hoặc /admin/users → /admin/audit-log | nav-yes (Quản trị → Nhật ký hệ thống, key `audit.list` = []) | viết-được | `audit-log-view.journey.ui.spec.ts` | single-run |

---

## 3. Evidence block từng luồng (rút gọn — mọi phủ định kèm lệnh + output)

### P3-01 (trùng)
`checkin-punch.journey.ui.spec.ts` gọi `menuNav('Nhân sự','Chấm công')` → assert URL
`/hr/checkin` → click "Chấm công" trong `.sh-main` → "Đã ghi nhận". expected =
`checkInOut.punch` @ `/hr/checkin`. **H2: HỢP LỆ, 1:1.**

### P3-02 (trùng, phủ một phần)
Spec drive `checkInOut.punch` (tạo ticket qua `ensureDayTicket`), `manualPunch.list`
(2 scope), `manualPunch.approve`, + negation track GĐĐT. expected còn
`manualPunch.reject`, `manualPunch.resubmit` — **KHÔNG được drive**.
`check-in-out.tsx` CÓ wire cả hai (`rg -o "trpc\.[a-z]+\.[a-zA-Z]+" apps/admin/src/pages/attendance/check-in-out.tsx`
→ `trpc.checkInOut.punch`, `trpc.manualPunch.approve`, `trpc.manualPunch.list`,
`trpc.manualPunch.reject`, `trpc.manualPunch.resubmit`) ⇒ **UI có, journey chưa phủ**.
**H2: HỢP LỆ nhưng partial** — flag để mở rộng, không phải mismatch.

### P3-03 / P3-04 / P3-07 (viết-được, 1 spec chung)
- `/hr/shifts` = `apps/admin/src/pages/attendance/shifts.tsx`; 3 tab: "Đăng ký ca mới",
  "Đăng ký của tôi", "Duyệt / Từ chối" (tab 3 chỉ render khi `canDo('shift','approve')`).
- trpc trên màn: `shift.submit|listGroups|myRegistrations|cancel|approve|reject|pendingForApproval`
  — phủ trọn expected của cả 3 luồng.
- Guard bắt buộc biết trước khi viết:
  - `shift.submit`: `fromDate` phải là ngày ICT **tương lai** (`router.ts:204-207`) →
    dùng ngày mai.
  - `group.type` phải khớp `resolveShiftGroup(appUser.position)`
    (`packages/domain-time/src/index.ts:92-95`: chứa `giao_vien`/`teacher` ⇒ `GIAO_VIEN`,
    còn lại `KINH_DOANH`) → tạo NV position `sale` + ShiftGroup loại "Kinh doanh".
  - Ticket-lock: tối đa 1 registration `submitted` mỗi người ⇒ phải reject trước rồi mới
    submit lại (thứ tự tự nhiên cho 07 → 03 → 04).
  - `shift.pendingForApproval` lọc theo group type từ ROLE người duyệt (GĐKD⇒KINH_DOANH,
    GĐĐT⇒GIAO_VIEN) ⇒ dùng GĐKD cho track sale. Đây cũng là negation miễn phí nếu muốn.
- Chuỗi đề xuất: super_admin tạo group+template (ADM-05 UI) → sale submit → GĐKD "Từ chối"
  + lý do (P3-07) → sale submit lại → GĐKD "Duyệt" (P3-04) → sale "Hủy" ở tab
  "Đăng ký của tôi" (P3-03 `shift.cancel`).

### P3-05 (viết-được; journey hiện có chỉ phủ roster)
`payroll-roster.journey.ui.spec.ts` chỉ chứng minh `user.pickList` trả non-empty tại
`/hr/payroll`. expected còn `payslip.assemble|finalize|reopen|my|getForUser`,
`salaryTier.list|create|update`, `compensation.assignTier`, route `/hr/salary-tiers`,
`/hr/my` — **journey hiện có không chạm**. **H2: HỢP LỆ nhưng phủ rất hẹp.**
Điều kiện cứng của `assemble` (`apps/api/src/payroll/router.ts:300-325`):
1. target phải có role `sale`/`giao_vien` (GĐ bị loại: `GD_OUTSIDE_PAYROLL_MESSAGE`)
   ⇒ `createStaffViaAdminUi(..., roleLabels: ['Sale'])`.
2. phải có `SalaryRate.tierId` ⇒ đi qua `/hr/salary-tiers`: "+ Thêm bậc lương" →
   "Gán bậc" → Selector "Bậc lương" → "Lưu" (`compensation.assignTier`).
Không có guard thời gian ⇒ kỳ hiện tại chạy được, payslip = 0 công cũng hợp lệ.

### P3-06 / P3-08 (viết-được, có seed exception)
- `/hr/my` (`my-hr.tsx`): nút "Tính lại" = `kpi.refresh`, "Nộp" = `kpi.submitSlip`,
  ô "Kỳ (YYYY-MM)" nhập tay ⇒ chọn kỳ tự do.
- `/hr/kpi` (`kpi.tsx`): "Xác nhận" = `kpi.confirm`, "Ghi đè" = `kpi.override`,
  "Đã trả lương kỳ X" = `kpi.bulkApprove`, Selector "Trạng thái" + ô "Kỳ (YYYY-MM)".
- **Guard ngày-3**: `submitSlipOpensAt` (`apps/api/src/kpi/auto-score.ts:275-286`) mở lúc
  00:00 ICT **ngày 3 tháng kế tiếp**. Kỳ hiện tại ⇒ luôn BAD_REQUEST. Cách sạch, không
  mock clock: tính kỳ = tháng-trước-tháng-trước trong test (tiền lệ:
  `apps/e2e/tests/kpi-lifecycle.spec.ts:9-11` dùng kỳ quá khứ cố định `2026-05`
  "no mocked clock"). Không dùng "tháng trước" đơn thuần vì ngày 1–2 hàng tháng sẽ fail.
- **Chặn thật sự — `AppUser.managerId`**: `kpi.confirm` yêu cầu
  `scoreOwner.managerId === confirmUser.id` (`apps/api/src/kpi/router.ts:250-253`), trừ
  super_admin. Không có UI nào set managerId:
  ```
  $ rg -n "managerId" apps/admin/src
  0 matches
  ```
  (procedure `user.update` CÓ nhận `managerId` — `apps/api/src/user/router.ts:39,182-203` —
  nhưng admin app không gọi nó:
  ```
  $ rg -n "user\.update\b|user\.update\." apps/admin/src
  0 matches
  ```
  chỉ `user.create`, `user.list`, `user.updateRoles` xuất hiện trong `users.tsx`.)
  ⇒ 2 lựa chọn, xem §5.
- `kpi.list` chỉ trả row mà `AppUser.roles` (cột DB) resolve về `sale`/`giao_vien`
  (`router.ts:445-452`) ⇒ bắt buộc `roleLabels: ['Sale']` khi tạo NV.
- `kpi.bulkApprove` bỏ qua row nếu payslip kỳ đó chưa `finalized`
  (`router.ts:395-400`) ⇒ thứ tự: submit → confirm → assemble → finalize → bulkApprove.
  (`kpi.confirm` cũng từ chối khi payslip đã finalized ⇒ confirm TRƯỚC finalize.)

### P3-09 (viết-được)
`kpi.refresh` không có guard ngày-3 (`router.ts:105-143`), self-target không cần director
⇒ NV bấm "Tính lại" cho kỳ hiện tại. Vẫn cần bậc lương để `tierMissing` = false nếu muốn
assert giá trị; nếu chỉ assert "score hiển thị" thì không cần.

### P3-10 / P3-11 (thiếu-đường-UI — KHÔNG viết được journey UI)
Không có procedure, không có route (manifest E3), và không có bất kỳ call-site UI nào:
```
$ rg -n "runDoneSweep|runCancelSweep" apps/admin/src apps/lms/src
0 matches

$ rg -n "runDoneSweep|runCancelSweep" apps/api/src --glob '!*.test.ts'
apps/api/src/worker/session-done-sweep.ts:35:export async function runDoneSweep(...)
apps/api/src/worker/session-done-sweep.ts:70:export async function runCancelSweep(...)
apps/api/src/worker/index.ts:21:import { runCancelSweep, runDoneSweep } from './session-done-sweep.js';
apps/api/src/worker/index.ts:125:  await runDoneSweep(db);
apps/api/src/worker/index.ts:126:  await runCancelSweep(db);
```
```
$ rg -n "sweep" apps/api/src --glob '**/*router*.ts'
apps/api/src/kpi/router.ts:12://   gap if the sweep worker runs behind), then
apps/api/src/kpi/router.ts:170://  R3-14: sweep may run behind — inline done-evaluate ...
```
⇒ điểm vào duy nhất là tiến trình worker riêng (`apps/api/src/worker/index.ts`, vòng lặp
30s) hoặc gọi hàm trực tiếp trong test. **Trả lời thẳng: journey UI-driven cho P3-10/P3-11
là KHÔNG THỂ** — không có màn nào để một vai người bấm.
Thêm rào thời gian: `evaluateSessionDone` từ chối khi `now < endTime`
(`apps/api/src/class/session-done.ts:64`), còn cancel-sweep cần `endTime + 24h`
(`CANCEL_GRACE_MS`, `session-done-sweep.ts:28`) ⇒ dữ liệu phải nằm ở quá khứ.
**red-fixme candidate**, lý do: no UI surface at all + past-`endTime` data requirement.
(Ngoại lệ khả dĩ, cần bạn duyệt: một spec API-level không-UI seed session quá khứ rồi gọi
`runDoneSweep`/`runCancelSweep` — không phải `.journey.ui.spec.ts`.)

### ADM-05
`shift-config.tsx` gọi `shift.createGroup`, `shift.createTemplate`, `shift.listGroups`,
`compensationPolicy.get`, `compensationPolicy.upsert` — phủ trọn expected. Labels sẵn có:
"Tên nhóm ca", Selector "Loại", "Thêm nhóm ca", "Tên mẫu ca", "Bắt đầu (HH:mm)",
"Kết thúc (HH:mm)", "+ Thêm mẫu ca", "Phạt mỗi phút đi muộn (VND)", "Lưu chính sách".
Lưu ý trùng lặp: `checkin-offsite-approval.journey` đã drive 3/5 procedure này như bước
setup, nhưng ADM-05 chưa có `journey:` — spec riêng vẫn đáng viết vì nó là luồng duy nhất
chạm `compensationPolicy.upsert`.

### P4-01
Journey hiện có drive `rewards.list|approve|deliver` + route admin. expected còn
`rewards.reject` (có nút trên `rewards.tsx`), `rewards.redeem` + `rewards.listForStudent`
+ route `/student/gifts` (LMS-only). Xác nhận LMS-only:
```
$ rg -n "rewards\.redeem|gift\.listForStudent" apps/admin/src
0 matches
```
`apps/lms/src/pages/student/gifts.tsx` gọi `trpc.gift.listForStudent` + `trpc.rewards.redeem`;
vào màn bằng nút "Đổi quà" ở `apps/lms/src/pages/student/home.tsx:107`
(`navigate('/student/gifts')`). `mintStudentToken` đã có trong
`apps/e2e/src/session-injection.ts:61` ⇒ nửa LMS viết được nếu muốn.
**H2: HỢP LỆ (nửa admin), partial.**

### P4-02
Journey drive `gift.upsert` + `/admin/engagement/gifts` + negation nav cho sale. expected
còn `gift.list` (được gọi khi màn load ⇒ coi như drive gián tiếp) và `gift.listForStudent`
(LMS-only, xem grep P4-01). Route thứ hai `/admin/engagement/rewards` do P4-01 phủ.
**H2: HỢP LỆ.**

### P4-03
`post-sale-meeting.tsx` chỉ gọi `parentMeeting.list` trực tiếp, 3 mutation còn lại nằm
trong hook dùng chung:
```
$ rg -n "parentMeeting\.[a-zA-Z]+" apps/admin/src
apps/admin/src/pages/crm/use-parent-meeting-actions.ts:14: trpc.parentMeeting.schedule.useMutation(...)
apps/admin/src/pages/crm/use-parent-meeting-actions.ts:15: trpc.parentMeeting.complete.useMutation(...)
apps/admin/src/pages/crm/use-parent-meeting-actions.ts:16: trpc.parentMeeting.cancel.useMutation(...)
apps/admin/src/pages/crm/post-sale-meeting.tsx:66:  trpc.parentMeeting.list.useQuery(...)
```
⇒ expected phủ đủ, KHÔNG phải EmptyState (chú thích cũ trong manifest đã được sửa, đúng).
Tiền đề: dialog "Đặt lịch họp" chọn HV bằng `StudentPicker` (`student.lookup`)
(`schedule-parent-meeting-dialog.tsx:63`) ⇒ cần 1 Student. Đường UI THẬT đã có tiền lệ
chạy được (`enrollment-second-class.journey.ui.spec.ts:75-111`): Xếp lớp → "tạo phiếu thu mới"
→ "Họ tên học viên"/"SĐT phụ huynh"/Lớp học/Học phí → "Tạo phiếu thu" → GĐKD
"Duyệt & Kích hoạt" ⇒ Student được provision. **Không cần seed exception.**

### P4-04
```
$ rg -n "testAppointment\.[a-zA-Z]+" apps/admin/src
apps/admin/src/pages/crm/use-test-appointment-actions.ts:26: trpc.testAppointment.schedule.useMutation(...)
apps/admin/src/pages/crm/use-test-appointment-actions.ts:30: trpc.testAppointment.complete.useMutation(...)
apps/admin/src/pages/crm/use-test-appointment-actions.ts:34: trpc.testAppointment.noShow.useMutation(...)
apps/admin/src/pages/crm/opportunity-detail.tsx:88:  trpc.testAppointment.forOpportunity.useQuery(...)
```
⇒ 4/4 expected có UI. Gate stage: `schedule` chỉ nhận O2_CONTACTED hoặc O3_TEST_SCHEDULED
(`apps/api/src/appointment/router.ts:111-115`), UI mirror bằng `canScheduleTest`
(`pipeline.tsx:80-84`, `opportunity-detail.tsx:151-155`) ⇒ phải "Chuyển lên" O1→O2 trước.
Nút: "Đặt lịch test" → dialog "Đặt lịch test đầu vào" → "Đặt lịch"; trên detail:
"Hoàn thành" / "Vắng mặt". Tạo cơ hội: /crm → "Thêm cơ hội" → "Họ tên"/"Số điện thoại" →
"Tạo" (tiền lệ `crm-receipt.journey.ui.spec.ts:71-78`).

### P4-05
```
$ rg -n "afterSale\.[a-zA-Z]+" apps/admin/src   # (đã lược phần .test.tsx)
apps/admin/src/pages/crm/use-after-sale-actions.ts:14: trpc.afterSale.create.useMutation(...)
apps/admin/src/pages/crm/use-after-sale-actions.ts:15: trpc.afterSale.advance.useMutation(...)
apps/admin/src/pages/crm/use-after-sale-actions.ts:16: trpc.afterSale.resolve.useMutation(...)
apps/admin/src/pages/crm/use-after-sale-actions.ts:17: trpc.afterSale.close.useMutation(...)
apps/admin/src/pages/crm/aftersale.tsx:59:  trpc.afterSale.list.useQuery(...)
```
`student.setLifecycle` có UI riêng ở màn chi tiết HV:
`apps/admin/src/pages/students/student-detail.tsx:49` (`trpc.student.setLifecycle.useMutation`),
gate `student.setLifecycle` = GĐKD/GĐĐT ⇒ actor cuối phải là GĐ, không phải sale.
Tiền đề Student: như P4-03.

### ADM-01
`facilities.tsx`: `facility.create|list|update`, nút "Thêm cơ sở", "Tên cơ sở", "Mã cơ sở",
"Tạo", "Lưu". Cảnh báo dọn dẹp: **không có `facility.delete`**
```
$ rg -n "delete" apps/api/src/facility/router.ts
0 matches
```
và `cleanupFacility` (apps/e2e/src/db.ts:144) chỉ xoá facility của chính run đó ⇒ mỗi lần
chạy ADM-01 để lại 1 Facility rác. Cần quyết định (xem §5).

### ADM-02
`users.tsx` gọi `user.create`, `user.list`, `user.updateRoles`. expected còn `user.update`
— **không có UI**:
```
$ rg -n "user\.update\b|user\.update\." apps/admin/src
0 matches
```
(khác `user.updateRoles`, có UI). Đây là manifest/UI drift THẬT của ADM-02, không phải
lỗi journey. Journey đề xuất phủ 3/4 procedure + route; ghi drift vào header spec.
Pattern MultiSelector đã được `create-staff-via-admin-ui.ts` giải mã sẵn (trigger
`getByLabel('Roles')` → listbox → click option theo nhãn "Sale"/"Giáo viên" → Escape → "Lưu").

### ADM-03
`network-ip.tsx`: đủ 5 procedure expected (`create|update|delete|list|detectMyIp`).
Pattern dialog native `<dialog>` (2 dialog luôn mounted) đã được ghi trong
`checkin-offsite-approval.journey.ui.spec.ts:106-120` — dùng
`page.locator('dialog').filter({ hasText: 'Thêm dải mạng' })`.
**Rủi ro chéo**: dải mạng ĐANG BẬT làm `checkInOut.punch` báo offsite ⇒ ADM-03 spec
KHÔNG được bấm "Bật" (hoặc phải xoá trước khi kết thúc), nếu không sẽ làm hỏng P3-01
khi chạy song song/cùng facility.

### ADM-04
`audit-log.tsx` gọi `audit.list` (duy nhất), có filter "Người thực hiện"/"Loại việc"/
"Đối tượng"/"Từ ngày"/"Đến ngày" + "Lọc" + phân trang. `audit.list` KHÔNG scope facility
(`apps/api/src/audit/router.ts:1-4`) ⇒ lọc theo `actor` = userId của super_admin vừa hành
động là cách xác định hàng chắc chắn. Nguồn ghi audit sẵn có qua UI: `facility.create`
(`facility/router.ts:82`), `user.updateRoles` (`user/router.ts:277`),
`facilityNetwork.*` (`network-router.ts:51,79,98`).

---

## 4. Kiểm tra lại H2 cho mọi luồng đã có `journey:` (5/21)

| flow | journey trong manifest | phán quyết H2 | lý do |
|---|---|---|---|
| P3-01 | checkin-punch | ✅ hợp lệ | drive đúng `checkInOut.punch` @ `/hr/checkin`, 1:1 với expected |
| P3-02 | checkin-offsite-approval | ⚠️ hợp lệ nhưng partial | drive `manualPunch.list|approve` + punch; KHÔNG drive `reject`/`resubmit` dù UI có cả hai |
| P3-05 | payroll-roster | ⚠️ hợp lệ nhưng rất hẹp | chỉ `user.pickList` @ `/hr/payroll`; 9 procedure + 2 route còn lại của expected không được chạm |
| P4-01 | rewards-redeem-approval | ⚠️ hợp lệ nhưng partial | drive `list|approve|deliver`; thiếu `reject`, và cả `redeem`/`listForStudent` + `/student/gifts` (LMS) |
| P4-02 | gift-config-nav | ✅ hợp lệ | drive `gift.upsert` @ `/admin/engagement/gifts` + negation nav; `gift.list` gián tiếp qua page load |

Không có luồng nào bị gán SAI file (0 mismatch). Vấn đề duy nhất là **độ phủ**, đã ghi rõ.

---

## 5. CẦN USER DUYỆT (seed exception & quyết định — tôi KHÔNG tự duyệt)

1. **`AppUser.managerId` cho `kpi.confirm` (P3-06, kéo theo P3-08).**
   Bằng chứng: `rg -n "managerId" apps/admin/src` → `0 matches`; `rg -n "user\.update\b|user\.update\." apps/admin/src` → `0 matches`.
   Ba lựa chọn:
   (a) thêm seed helper `seedManagerLink()` trong `apps/e2e/src/db.ts` (ghi DB trực tiếp,
   1 cột, cùng hạng với `seedApprovedShiftRegistration`);
   (b) dùng **super_admin** làm người "Xác nhận" (bypass manager check hợp lệ trong code,
   và `/hr/kpi` nav-yes cho super_admin) — nhưng lệch `actorRoles` của P3-06;
   (c) hoãn P3-06/P3-08 sang red-fixme "thiếu UI gán quản lý trực tiếp".
   → Cần bạn chọn.

2. **P3-10 / P3-11 — không có UI nào.** Đề xuất chờ duyệt: hoặc đánh red-fixme
   (không viết gì), hoặc cho phép 1 spec **API-level không-UI** seed ClassSession quá khứ
   + gọi `runDoneSweep`/`runCancelSweep` trực tiếp (đặt ngoài `tests/journeys/`, không mang
   hậu tố `.journey.ui.spec.ts`). Không đề xuất mock clock.

3. **Kỳ KPI quá khứ cho P3-06/P3-08.** Đề xuất tính `period` = tháng-trước-tháng-trước tại
   runtime (an toàn mọi ngày trong tháng), theo tiền lệ `kpi-lifecycle.spec.ts`. Đây là dữ
   liệu, không phải mock clock — nhưng vì nó thay đổi ý nghĩa "chốt lương tháng này",
   xin xác nhận.

4. **ADM-01 để lại Facility rác** (không có `facility.delete`:
   `rg -n "delete" apps/api/src/facility/router.ts` → `0 matches`). Chọn: (a) chấp nhận rác,
   (b) mở rộng `cleanupFacility` để xoá theo tiền tố tên `E2E ADM-01 %`, (c) bỏ bước tạo,
   chỉ drive `facility.list|update` trên facility của run.

5. **ADM-03 không được bật dải IP** (tránh phá P3-01). Xác nhận rằng journey ADM-03 chỉ
   create → update → detectMyIp → delete, KHÔNG bấm "Bật".

6. **Student tiền đề cho P4-03/P4-05**: KHÔNG cần exception (đường UI thật đã có tiền lệ).
   Nếu bạn muốn spec ngắn hơn thì mới cần duyệt dùng `seedActiveEnrollment`. Mặc định tôi
   đề xuất đi đường UI thật.

---

## 6. Số spec dự kiến cho nửa này

**Đợt HR — 5 spec mới**
1. `shift-register-approve-reject.journey.ui.spec.ts` → P3-03 + P3-04 + P3-07
   (gộp vì ticket-lock "1 submitted/người" bắt buộc tuần tự, và cả 3 dùng chung setup
   ShiftGroup/Template; manifest có thể trỏ cả 3 flow vào cùng file).
2. `payroll-assemble-finalize.journey.ui.spec.ts` → P3-05 (phần assemble/finalize/tier
   mà `payroll-roster` chưa chạm).
3. `kpi-refresh-my.journey.ui.spec.ts` → P3-09.
4. `kpi-submit-confirm-bulk-approve.journey.ui.spec.ts` → P3-06 + P3-08 (chờ quyết định §5.1).
5. `shift-config-admin.journey.ui.spec.ts` → ADM-05.
Tái dùng nguyên trạng: 2 (P3-01, P3-02). Không viết được: 2 (P3-10, P3-11).

**Đợt rewards-admin — 7 spec mới (+1 tuỳ chọn)**
1. `post-sale-meeting-schedule.journey.ui.spec.ts` → P4-03
2. `entrance-test-appointment.journey.ui.spec.ts` → P4-04
3. `after-sale-case-lifecycle.journey.ui.spec.ts` → P4-05
4. `facility-admin-crud.journey.ui.spec.ts` → ADM-01
5. `user-admin-roles.journey.ui.spec.ts` → ADM-02
6. `network-ip-config.journey.ui.spec.ts` → ADM-03
7. `audit-log-view.journey.ui.spec.ts` → ADM-04
(+ tuỳ chọn) `student-redeem-gift.journey.ui.spec.ts` → nửa LMS của P4-01.
Tái dùng nguyên trạng: 2 (P4-01 admin, P4-02).

**Tổng: 12 spec mới bắt buộc + 1 tuỳ chọn; 4 spec cũ tái dùng; 2 luồng không viết được
(P3-10, P3-11).** 21/21 luồng đã được xem xét, 0 luồng "chưa nhìn tới".

---

## 7. Câu hỏi còn treo

- Manifest có cho phép nhiều flow trỏ chung 1 file `journey:` không? `verify.ts:61-69`
  chỉ kiểm tra "file tồn tại + có `test(`" nên **kỹ thuật là được**; cần bạn xác nhận về
  mặt quy ước sổ nghiệm thu trước khi gộp P3-03/04/07 và P3-06/08.
- Drift ADM-02 (`user.update` không có UI) có nên sửa manifest hay ghi vào header spec?
  Tôi không sửa manifest (read-only).

Status: DONE
Summary: Đã triage đủ 21/21 luồng với đợt, nav-reachability (đối chiếu trực tiếp
nav-registry + PERMISSIONS), phân loại, tên spec đề xuất và ràng buộc thời gian; 12 spec
mới cần viết, 4 spec cũ tái dùng, 2 luồng (P3-10/P3-11) không thể có journey UI.
Concerns/Blockers: P3-06/P3-08 bị chặn bởi `AppUser.managerId` không có đường UI (grep
0 matches) — cần bạn chọn giữa seed helper / dùng super_admin / red-fixme. P3-10/P3-11 chỉ
chạy được qua worker process, cần quyết định red-fixme hay spec API-level. Bốn `journey:`
hiện có (P3-02, P3-05, P4-01) hợp lệ nhưng phủ hẹp hơn `expected` — đã liệt kê phần thiếu.
