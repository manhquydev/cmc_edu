# Rà soát trải nghiệm thật — P3 Nhân sự / Chấm công / KPI / Lương

Ngày: 2026-07-26 · Nhánh: `main` (f354e20) · Phạm vi: chỉ đọc, không sửa code.

Đọc: `apps/admin/src/pages/hr/**`, `apps/admin/src/pages/attendance/**`,
`apps/admin/src/routes/hr.routes.tsx`, `apps/admin/src/shell/{nav-registry.ts,shell.tsx}`,
`apps/api/src/{checkin,shift,kpi,payroll}/router.ts`, `apps/api/src/kpi/auto-score.ts`,
`apps/api/src/attendance/resolve-day-credit.ts`, `packages/domain-payroll/src/**`,
`packages/auth/src/index.ts`, `docs/decisions/0043-*`, `docs/20 §2–§4`, `docs/22 ADR 0044`.

> ADR 0044 **không** nằm trong `docs/decisions/` — nó là mục trong `docs/22-adr-rule-chi-code-0038-0041.md:110`.
> Công thức lương của nó (`base + %côngca×%chỉsố×đơngiá − phạt`, phạt là dòng độc lập, clamp ≥ 0)
> **được thực thi đúng** ở `packages/domain-payroll/src/assemble-slip.ts:68-98`. Các phát hiện dưới đây
> là về đường đi của người dùng, không phải số học.

## Findings

| # | Mức | Vấn đề | file:line | Đề xuất sửa |
|---|-----|--------|-----------|-------------|
| 1 | Chặn | `kpi.confirm` đòi `scoreOwner.managerId === confirmUser.id`, nhưng **không màn nào gửi `managerId`** (grep `managerId` trong `apps/admin/src` = 0 hit) → 2 GĐ mở "Duyệt KPI", bấm Xác nhận và luôn ăn 403; chỉ super_admin duyệt được | `apps/api/src/kpi/router.ts:256` · `apps/e2e/src/db.ts:265-270` (comment tự xác nhận) | Thêm ô "Quản lý trực tiếp" vào form `/admin/users` (procedure `user.update` đã nhận `managerId`), hoặc đổi gate `kpi.confirm` sang track-role như ADR 0043 đã làm cho phiếu chấm công |
| 2 | Chặn | Bấm hàng menu "Nhân sự" điều hướng `/hr` → index route render `ComingSoon` ("🚧 Đang phát triển") | `apps/admin/src/routes/hr.routes.tsx:17` · `apps/admin/src/shell/nav-registry.ts:115` · `apps/admin/src/shell/shell.tsx:34` | Đổi `path` của module `hr` sang `/hr/checkin` (màn mọi vai trò đều dùng được), như module `engagement` đã làm |
| 3 | Chặn | `shift.manage` cấp cho 2 GĐ (`packages/auth/src/index.ts:119`) nhưng màn duy nhất tạo Nhóm ca/Mẫu ca chặn cả trang bằng `compensationPolicy.manage` (role list rỗng = chỉ super_admin), lại nằm trong module nav `roles:['super_admin']` → GĐ không có đường tạo ca, nhân viên không đăng ký được ca nào | `apps/admin/src/pages/admin/shift-config.tsx:279` · `apps/admin/src/shell/nav-registry.ts:130,138` | Tách tab "Nhóm ca & mẫu ca" (gate `shift.manage`) khỏi tab "Chính sách phạt" (gate `compensationPolicy.manage`), đặt entry nav dưới module Nhân sự |
| 4 | Chặn | **Không có procedure nào đọc `TimePunch` cho người dùng** — `TimePunch` chỉ được đọc bên trong `payslip.assemble`, `collectActualShifts`, `ensureDayTicket`. Nhân viên không xem được mình đã chấm công hôm nay chưa, không đối chiếu được "Vắng N ngày" trên phiếu lương; GĐ không soi được lịch sử ai cả | `apps/api/src/checkin/router.ts:165` (router chỉ có `punch`) · `apps/api/src/payroll/router.ts:340` | Thêm `checkInOut.myDays({period})` trả bảng ngày × (giờ vào/ra, ca đăng ký, có công/vắng, muộn/sớm) + hiển thị ở tab "Của tôi" và dưới phiếu lương |
| 5 | Cao | Suspense fallback của **mọi** trang HR là `ComingSoon`, nên trong lúc tải chunk (mạng chậm) người dùng đọc đúng chữ "Tính năng này sẽ ra mắt trong phiên bản tiếp theo" rồi bỏ đi | `apps/admin/src/routes/hr.routes.tsx:12-14,21,29,37,45,53,61` | Dùng `Skeleton` như `teaching.routes.tsx:13-15` |
| 6 | Cao | Trang chấm công không hề nói hôm nay **có ca đã duyệt hay không**. Không có ca → punch offsite không sinh phiếu (E2) và ngày đó không có công; người dùng vẫn thấy banner xanh "Đã ghi nhận" | `apps/admin/src/pages/attendance/check-in-out.tsx:490-496,534-546` · `apps/api/src/checkin/router.ts:82` | Hiển thị ca hôm nay + trạng thái cặp vào/ra ngay trên nút; nếu chưa có ca đã duyệt thì cảnh báo vàng kèm link `/hr/shifts` |
| 7 | Cao | Chấm công 1 lần/ngày = **0 công cả ngày** (cần ≥2 mốc), nhưng không có nhắc "chưa checkout". Follow-up của ADR 0043 ghi rõ chưa làm | `packages/domain-payroll/src/day-attendance.ts:55-60` · `docs/decisions/0043-...md` (mục Follow-Up) | Badge "Chưa chấm giờ ra" trên trang chấm công + nhắc cuối ca |
| 8 | Cao | `payslip.assemble` chỉ lấy KPI ở trạng thái `confirmed\|approved`; assemble/chốt trước khi KPI được xác nhận → `kpiBonus = 0` **âm thầm**, sau đó `kpi.confirm` bị chặn vì payslip đã finalized → phải reopen. UI không hề nêu thứ tự đúng | `apps/api/src/payroll/router.ts:435-442` · `apps/api/src/kpi/router.ts:264-266` · `apps/admin/src/pages/hr/payroll.tsx:176-207` | Assemble trả cảnh báo `KPI_NOT_CONFIRMED`; nút "Chốt bảng lương" hiện confirm-dialog nêu rõ KPI kỳ này đang ở trạng thái gì |
| 9 | Cao | "Vắng N ngày" nằm **trong khối đỏ "Phạt khấu trừ"** nhưng `unpunchedDays` không góp đồng nào vào `penaltyAmount` (docs/20 §3: "không công, không phạt phút"). Nhân viên đọc phiếu sẽ tưởng bị trừ tiền vì vắng | `apps/admin/src/pages/hr/payroll.tsx:266-271,357` · `packages/domain-payroll/src/assemble-slip.ts:76-79` | Tách "Vắng N ngày" ra dòng thông tin riêng ngoài khối phạt, ghi chú "ảnh hưởng qua %công ca của phần KPI" |
| 10 | Cao | `manualPunch.approve` trả `warnings: ['PAYSLIP_FINALIZED','SINGLE_PUNCH_NO_CREDIT']` nhưng UI vứt bỏ, chỉ hiện "Đã duyệt yêu cầu chấm công." → GĐ duyệt xong tưởng ngày đó đã có công / lương đã được cập nhật | `apps/api/src/checkin/router.ts:312,319` · `apps/admin/src/pages/attendance/check-in-out.tsx:330-333` | Render warnings thành banner: "Phiếu chỉ có 1 mốc — ngày này vẫn không có công" / "Bảng lương kỳ này đã chốt, cần Mở lại + Tính lương lại" |
| 11 | Cao | Tab "Gán bậc" **không có cột bậc hiện tại** (`user.pickList` không select `salaryRate`) → GĐ gán mù, không biết ai đang thiếu bậc, trong khi thiếu bậc chặn cả `kpi.submitSlip` lẫn `payslip.assemble` | `apps/admin/src/pages/hr/salary-tiers.tsx:324-332` · `apps/api/src/user/router.ts:237` | Thêm cột "Bậc hiện tại" + bộ lọc "Chưa gán bậc"; cho gán hàng loạt |
| 12 | Cao | Bảng lương chỉ liệt kê Mã NV/Họ tên/Chức vụ — không có trạng thái phiếu lương, không assemble/finalize hàng loạt. Cơ sở 30 người = 30 lần vào-ra + 60 cú bấm mỗi kỳ, và không cách nào biết còn sót ai | `apps/admin/src/pages/hr/payroll.tsx:76-80,490-499` | Thêm cột trạng thái + tổng thực lĩnh cho kỳ đang chọn, và nút "Tính lương cả kỳ" / "Chốt các phiếu nháp" |
| 13 | Cao | `shift.cancel` cho **bất kỳ** GĐ hủy đăng ký của **bất kỳ ai**, không giới hạn track (khác hẳn `approve`/`reject`), không lý do, không thông báo cho chủ phiếu — mà hủy ca đã duyệt là xóa công của người ta | `apps/api/src/shift/router.ts:444-451` · `apps/admin/src/pages/attendance/shifts.tsx:348` | Chặn theo track như `assertCanReview`, bắt buộc lý do, lưu và hiển thị lại ở "Đăng ký của tôi" |
| 14 | Cao | Đăng ký ca nhập ngày bằng **TextInput free-text "YYYY-MM-DD"**, mỗi ngày một dòng thêm tay. Đăng ký 1 tháng = bấm "+ Thêm ngày" 22 lần và gõ 22 chuỗi ngày | `apps/admin/src/pages/attendance/shifts.tsx:198-205,228-234,258-264` | Dùng date-picker; thêm "Chọn nhanh: T2–T6 trong khoảng" sinh sẵn các dòng |
| 15 | TB | Dropdown "Nhóm ca" liệt kê cả nhóm Giáo viên lẫn Kinh doanh; chọn sai chỉ vỡ ở server với thông báo tiếng Anh `This shift group is for GIAO_VIEN staff; your position resolves to KINH_DOANH.` | `apps/admin/src/pages/attendance/shifts.tsx:98-101` · `apps/api/src/shift/router.ts:197-202` | `shift.listGroups` lọc theo `resolveShiftGroup(appUser.position)`, hoặc client ẩn nhóm không khớp |
| 16 | TB | Client chỉ kiểm regex ngày; **không** kiểm ngày dòng nằm trong `[fromDate,toDate]`, và **không nơi nào** (kể cả Zod server) kiểm `toDate >= fromDate` → gõ xong 20 dòng mới nhận lỗi tiếng Anh | `apps/admin/src/pages/attendance/shifts.tsx:123-128` · `apps/api/src/shift/router.ts:64-77,213-219` | Validate tại chỗ từng dòng; thêm `.refine(toDate >= fromDate)` vào `submitInput` |
| 17 | TB | Kỳ lương/KPI là TextInput free-text `YYYY-MM` ở 4 màn; mỗi phím gõ bắn 1 query, chuỗi dở dang → banner lỗi Zod tiếng Anh `Expected YYYY-MM` | `apps/admin/src/pages/hr/kpi.tsx:242` · `payroll.tsx:452,481` · `my-hr.tsx:306` | Dùng month-picker (hoặc 2 Selector năm/tháng); chỉ query khi khớp regex |
| 18 | TB | Thông báo lỗi nghiệp vụ trả nguyên văn tiếng Anh cho người dùng cuối và không nói cách khắc phục: `Staff profile not found in this facility.`, `Ticket is not pending.`, `Only the direct manager can confirm this KPI score.` | `apps/api/src/checkin/router.ts:175,299` · `apps/api/src/shift/router.ts:188,392` · `apps/api/src/kpi/router.ts:119,257,469` · `apps/api/src/payroll/router.ts:622` | Chuyển sang tiếng Việt + `appCode` để UI gợi ý hành động ("Tài khoản chưa gắn hồ sơ nhân sự ở cơ sở này — liên hệ Quản trị viên") |
| 19 | TB | Danh sách nhân viên ở Bảng lương không lọc vai trò → GĐ/super_admin cũng nằm trong bảng; bấm vào rồi bấm Tính lương mới nhận `Lương giám đốc/super_admin ngoài hệ thống`. Màn "Gán bậc" đã lọc đúng, màn này thì không | `apps/admin/src/pages/hr/payroll.tsx:417-424` vs `salary-tiers.tsx:312-314` | Lọc `sale\|giao_vien` như tab Gán bậc |
| 20 | TB | Nhân viên xem được phiếu lương khi còn `draft` (badge "Nháp") vì `payslip.my` không lọc trạng thái → tranh cãi về con số chưa chốt; đồng thời `kpi.refresh({appUserId})` (GĐ tính lại hộ) không có UI nào gọi, nên phiếu KPI draft kẹt của nhân viên không ai gỡ hộ được | `apps/api/src/payroll/router.ts:623-625` · `apps/admin/src/pages/hr/my-hr.tsx:226` · `apps/api/src/kpi/router.ts:121-127` vs `my-hr.tsx:83` | Ẩn phiếu `draft` khỏi `payslip.my` (hoặc ghi rõ "Số tạm tính, chưa chốt"); thêm nút "Tính lại" cho GĐ ngay trong bảng Duyệt KPI |

## Đối chiếu quy tắc ADR

**ADR 0043 (ghép ca theo ngày, offsite cần lý do + duyệt tay)** — lõi tính toán thực thi đúng:
`resolve-day-credit.ts:43-64` chỉ pair theo punch live khi **toàn bộ** punch trong mạng, ngược lại
bắt buộc phiếu `approved` với giờ đã đóng băng; `ensureDayTicket` cập nhật có điều kiện
`WHERE status IN (pending,resubmitted)` (`checkin/router.ts:118-121`) nên phiếu đã duyệt không bị
punch sau ghi đè; gate duyệt theo track (`checkin/router.ts:147-163`). Khoảng trống nằm ở phần
người dùng nhìn thấy: #4, #6, #7, #10.

**ADR 0044 (lương = cơ bản + phần KPI − phạt)** — số học đúng, phạt là dòng độc lập và bị cap tại
`baseSalary+kpiPartAmount` (`assemble-slip.ts:87-89`), UI cũng tách dòng phạt (`payroll.tsx:266`).
Khoảng trống: vòng đời không đi trọn được vì #1, và trình tự KPI→lương không được UI dẫn (#8).

**Procedure không có UI gọi** — không procedure P3 nào bằng 0 call-site; nhưng có 3 **năng lực** chết:
- `kpi.refresh({appUserId})` — nhánh "GĐ tính lại hộ nhân viên" (`kpi/router.ts:121-127`), UI chỉ gọi `{period}`.
- `manualPunch.list({status})` — inbox không có bộ lọc trạng thái, GĐ không xem lại được phiếu đã duyệt/từ chối.
- `shift.createGroup` / `shift.createTemplate` — 2 GĐ có quyền nhưng bị màn chặn (#3).

Lệnh kiểm chứng:
```
for p in checkInOut.punch manualPunch.* shift.* kpi.* payslip.* salaryTier.* compensation*; do
  grep -rn "trpc\.$p\b" apps/admin/src --include=*.tsx --include=*.ts | grep -v '\.test\.' | wc -l
done   # → mọi procedure ≥ 1; manualPunch.list, salaryTier.list, shift.listGroups = 2
grep -rn "managerId" apps/admin/src   # → 0 hit
```

## 3 việc nên làm trước nhất

1. **Gỡ nút thắt `managerId` (#1).** Đây là điểm chết duy nhất chặn cả chuỗi KPI → lương: không
   confirm được thì `payslip.assemble` luôn cho `kpiBonus = 0`. Chọn 1 trong 2: thêm ô "Quản lý trực
   tiếp" vào `/admin/users`, hoặc đổi `kpi.confirm` sang gate track-role cho đồng bộ với ADR 0043 —
   quyết định này thuộc chủ sản phẩm vì nó đổi mô hình ủy quyền, docs/20 §4 đang ghi "direct manager".
2. **Trả lại cho nhân viên cái nhìn về công của chính mình (#4, #6, #7).** Một procedure
   `checkInOut.myDays` + hiển thị "hôm nay: ca X, vào 08:05, chưa có giờ ra" xử lý cùng lúc: không
   biết đã chấm chưa, quên checkout mất trắng ngày công, và không đối chiếu được "Vắng N ngày".
3. **Dọn 3 ngõ cụt điều hướng (#2, #3, #5).** Đổi `path` module Nhân sự sang `/hr/checkin`, đổi
   Suspense fallback sang `Skeleton`, tách gate màn cấu hình ca. Ba sửa nhỏ, đều nằm ở file cấu
   hình/route, và cùng loại bỏ ấn tượng "hệ thống chưa xây xong" ngay phút đầu người dùng bấm menu.

## Câu hỏi còn treo

- `kpi.confirm` theo `managerId` là ý định sản phẩm còn hiệu lực, hay là tàn dư mà ADR 0043 đã bỏ
  cho phiếu chấm công nhưng chưa quét sang KPI?
- Nhân viên có được phép xem phiếu lương khi còn `draft` không (#20)?
- `unpunchedDays` có nên phát sinh khoản trừ riêng, hay đúng như docs/20 là chỉ tác động gián tiếp
  qua %công ca (#9)?
