# Scout Report: Luồng đăng ký công ca (shift registration) — ground truth từ code

Nguồn: đọc trực tiếp code (backend router, domain logic, schema/migrations, frontend, integration KPI/payroll/e2e). Không đọc `docs/`.

## 1. Bản đồ tổng thể

```
apps/admin/src/pages/attendance/shifts.tsx  ──trpc──▶  apps/api/src/shift/router.ts  ──▶  ShiftRegistration/Entry (Postgres)
apps/admin/src/pages/admin/shift-config.tsx ──trpc──▶  shift.createGroup/createTemplate, compensationPolicy.upsert
apps/admin/src/pages/attendance/check-in-out.tsx ──▶  checkInOut.punch, manualPunch.create/list

ShiftRegistration(approved) ──┬──▶ apps/api/src/kpi/auto-score.ts (collectActualShifts) ──▶ KpiScore.value (nhân với %ca)
                               └──▶ apps/api/src/payroll/router.ts (payslip.assemble) ──▶ penaltyAmount, totalNet

Cả hai router trên đều gọi chung packages/domain-payroll/src/shift-attendance.ts::assignPunchesToShifts
(nguồn xử lý ghép punch↔ca duy nhất), nhưng mỗi router tự viết lại phần query/group theo ngày (trùng lặp code).
```

## 2. tRPC procedures (`apps/api/src/shift/router.ts`)

| Procedure | Loại | Quyền | Ghi chú |
|---|---|---|---|
| `createGroup` | mutation | `shift.manage` | tạo `ShiftGroup` |
| `createTemplate` | mutation | `shift.manage` | tạo `ShiftTemplate`, check group cùng facility |
| `submit` | mutation | `shift.submit` | tạo trực tiếp status `submitted` (không qua `draft`) |
| `approve` | mutation | `shift.approve` + `assertCanReview` | chỉ từ `submitted` → `approved` |
| `reject` | mutation | `shift.approve` + `assertCanReview` | chỉ từ `submitted` → `rejected`, ghi `rejectReason` |
| `cancel` | mutation | owner hoặc director role | mọi status trừ `cancelled` → `cancelled` (kể cả `rejected` — không có test) |
| `listGroups` | query | mọi user đã login | group + template theo facility |
| `myRegistrations` | query | mọi user đã login | đăng ký của chính mình |
| `pendingForApproval` | query | `shift.approve` | lọc theo group-type khớp role director của người duyệt |

**Role permission map** (`packages/auth/src/index.ts`):
- `shift.manage`: `giam_doc_dao_tao`, `giam_doc_kinh_doanh`
- `shift.submit`: `giam_doc_dao_tao`, `giam_doc_kinh_doanh`, `giao_vien`, `sale`
- `shift.approve`: `giam_doc_dao_tao`, `giam_doc_kinh_doanh` (gate cả approve lẫn reject)
- `super_admin` bypass toàn bộ `can()`.

**`assertCanReview`** thêm 2 lớp nữa: (1) không được tự duyệt/từ chối đăng ký của chính mình; (2) role director phải khớp đúng loại group (`GIAO_VIEN`→`giam_doc_dao_tao`, `KINH_DOANH`→`giam_doc_kinh_doanh`) — có quyền `shift.approve` chung không đủ.

## 3. State machine thực tế

Schema: `ShiftRegistration.status` là **`String` thô** (không phải Prisma enum), default `"draft"`, chỉ ràng buộc bằng Postgres CHECK: `IN ('draft','submitted','approved','cancelled','rejected')` (đã thêm `rejected` ở migration `20260712000000`, cùng cột `rejectReason`).

Transitions thực tế trong code:
- `draft` — **dead status**: không procedure nào tạo/đọc nó trong luồng thật; `submit` luôn tạo thẳng `submitted`. Chỉ `status-check.test.ts` chèn `draft` qua raw DB bypass để test CHECK constraint (tên file gây hiểu lầm — không phải test 1 procedure "status-check").
- `submitted` → `approved` (approve) hoặc `rejected` (reject), chỉ khi đang `submitted`.
- Bất kỳ status nào (trừ `cancelled`) → `cancelled` (cancel).
- **Không có resubmit/re-review path**: `rejected` là ngõ cụt, muốn thử lại phải tạo đăng ký mới hoàn toàn (khác với `ManualAttendanceTicket` có chu trình `pending → approved|rejected → resubmitted`).
- Không có DELETE grant trên 4 bảng shift trong RLS — không thể xóa cứng registration.

**Ticket-lock**: unique partial index `WHERE status='submitted'` → mỗi user chỉ có 1 đăng ký `submitted` tại một thời điểm; chuyển sang `rejected`/`cancelled`/`approved` giải phóng lock ngay.

## 4. Business rules trong `shift.submit`

1. Position→group-type phải khớp (`resolveShiftGroup(position)` từ `@cmc/domain-time`).
2. `fromDate` phải là ngày tương lai (ICT).
3. Mọi `entry.date` phải nằm trong `[fromDate, toDate]`.
4. Ticket-lock (app-layer, trùng với DB index).
5. **Overlap guard toàn cục**: không được có đăng ký `submitted`/`approved` khác trùng khoảng ngày — bất kể group nào ("one active date range per person"), loại trừ `cancelled`/`rejected`.
6. Template phải thuộc đúng `shiftGroupId`.
7. `SINGLE` mode: tối đa 1 entry/ngày.
8. `MULTIPLE` mode: không trùng `(date, templateId)`.

**Không có**: time-window/giờ cắt, enforce quota số lượng ca, auto-reschedule, auto-done cho `ShiftRegistration`. ("Session-done engine" 24h/48h trong migration `20260712000000` là cho `ClassSession` (buổi học) — **hoàn toàn khác** đối tượng, không áp dụng cho shift registration.)

## 5. Ghép punch↔ca (`assignPunchesToShifts`, domain-payroll)

Hàm thuần, dùng chung bởi cả KPI và payroll:
- Mỗi ngày, các ca sắp theo `start` tăng dần, ghép với pool punch chung.
- in-punch = punch chưa dùng sớm nhất trong `[start-2h, midpoint)`; out-punch = punch chưa dùng muộn nhất trong `[midpoint, end+2h]`.
- Thiếu 1 trong 2 nửa → `present:false` (vắng), không lương/phạt.
- `shortSpan:true` khi có mặt nhưng span < 50% thời lượng ca danh nghĩa (cờ chống gian lận) — chỉ KPI dùng để hiển thị cho director xem, **không lưu DB** (mất khi refresh lại lần sau, không có audit trail).
- Clamp tại điểm giữa khoảng cách giữa 2 ca liền kề, tránh 2 ca back-to-back cướp punch của nhau.

## 6. Tích hợp KPI (`apps/api/src/kpi/auto-score.ts`)

- Chỉ tính `ShiftRegistration.status='approved'`, gộp distinct `(date, templateId)`.
- Có `ManualAttendanceTicket` approved cho ngày đó → tính đủ công không cần punch.
- Ngược lại ghép punch qua `assignPunchesToShifts`; đăng ký nhưng không chấm công → 0 điểm ca đó.
- `shiftPct = min(1, shiftActual/shiftRequired)` (từ `SalaryTier.requiredShifts`) là **hệ số nhân cứng** lên giá trị tiền KPI — 0% ca chấm công thì KPI = 0 bất kể chỉ số bán hàng/giảng dạy.
- Chỉ áp dụng role `sale`/`giao_vien`; không ghi đè `KpiScore` không phải `draft`.

## 7. Tích hợp Payroll (`apps/api/src/payroll/router.ts` — `payslip.assemble`)

- Đọc `approved` ShiftRegistration + entries, sort theo `ShiftTemplate.startTime`.
- `ManualAttendanceTicket` approved cho ngày đó → miễn hoàn toàn (không tính unpunched/penalty).
- Ngày không exempt: dùng `assignPunchesToShifts`; vắng → `unpunchedDays++` (không phạt phút); có mặt → cộng dồn `lateMinutes`/`earlyMinutes`.
- Punch vào ngày **không có đăng ký ca** → `flaggedPunches`, **không phạt** — nhưng field này không có UI/procedure nào để xem/xử lý (dead-end data).
- Penalty rate: `CompensationPolicy` theo facility, fallback 500đ/phút trễ, 1000đ/phút sớm.
- `kpiBonus` chỉ cộng khi `KpiScore.status IN ('confirmed','approved')`.
- Ticket approved sau khi payslip đã finalize **không** hồi tố — chỉ trả `warning: 'PAYSLIP_FINALIZED'`.
- Ghi payslip có TOCTOU guard (`WHERE status='draft'`, bắt P2025 khi có race).

## 8. E2E thực tế chạy (`apps/e2e/tests/shift-lifecycle.spec.ts`)

Test API-driven (không browser), 161 dòng, đúng các bước:
1. Seed 2 group (KINH_DOANH, GIAO_VIEN) + 1 template.
2. Gate loại group: `sale` submit vào group `GIAO_VIEN` → `BAD_REQUEST`.
3. Gate tự duyệt: actor có cả role `sale` + `giam_doc_kinh_doanh` không thể reject đăng ký của chính mình → `FORBIDDEN`.
4. Flow chính: submit → reject (có reason) → verify trên `myRegistrations` → **submit lại cùng khoảng ngày thành công** (chứng minh reject giải phóng ticket-lock và overlap-guard) → approve → verify.

Không test punch/KPI/payroll trong file này (tách riêng ở `kpi-lifecycle.spec.ts`, dùng helper seed trực tiếp DB bỏ qua guard ngày tương lai).

## 9. Frontend — màn hình & luồng UX

| Màn hình | Route | Gate nav | Gọi API |
|---|---|---|---|
| Đăng ký ca | `/hr/shifts` | không gate (mọi role active thấy) | `shift.listGroups/submit/myRegistrations/cancel`; tab Duyệt chỉ hiện nếu `canDo('shift','approve')` → `shift.pendingForApproval/approve/reject` |
| Chấm công | `/hr/checkin` | không gate | `checkInOut.punch`, `manualPunch.create/list` |
| Của tôi (KPI) | `/hr/my` | không gate | chỉ đọc `shiftActual/shiftRequired` qua `kpi.myScore`, không gọi `shift.*` trực tiếp, không có link ngược về `/hr/shifts` |
| Cấu hình ca | `/admin/shift-config` | gate `compensationPolicy.manage` (thực chất = super_admin only) | `shift.createGroup/createTemplate`, `compensationPolicy.get/upsert` |

**Luồng đăng ký (SubmitTab)**: chọn group → chọn template → nhập `fromDate`/`toDate` dạng text `YYYY-MM-DD` (không date-picker) → thêm nhiều dòng ngày+ca → validate client chỉ check format + fromDate tương lai, **không check `toDate >= fromDate` hay entry nằm trong range** (để server xử lý, theo comment trong code) → submit → banner + reset form. Không có pre-check ticket-lock phía client, lỗi chỉ hiện sau khi submit fail.

**Duyệt/Từ chối**: cả 2 đều bắt buộc qua `ConfirmDialog`/`Dialog` xác nhận (click nút trigger không tự gọi mutation — có test khẳng định); reject bắt buộc nhập lý do ≥3 ký tự.

**Cấu hình ca (`shift-config.tsx`)**: chỉ có form **tạo mới** group/template — không có sửa/xóa/deactivate.

## 10. Điểm không nhất quán / chưa hoàn thiện — phát hiện thuần từ code

1. **`draft` là dead status**: tồn tại trong CHECK constraint + default, không có đường dẫn thật nào tạo hay đọc nó qua router.
2. **Comment trong schema.prisma tự mâu thuẫn**: dòng 1203-1204 nói transition chỉ có `draft→submitted→approved|cancelled`, nhưng comment field `status` 2 dòng dưới lại liệt kê đủ 5 trạng thái gồm `rejected`. File header docstring của `router.ts` cũng không nhắc tới overlap-guard/template-ownership/MULTIPLE-duplicate-check dù code có enforce đủ.
3. **`status` là String thô, không phải Prisma enum** — an toàn kiểu dữ liệu phụ thuộc hoàn toàn vào CHECK constraint + kỷ luật code.
4. **`rejected` là ngõ cụt**, không có resubmit flow như `ManualAttendanceTicket`.
5. **`cancel` trên `rejected` được code cho phép** (chỉ loại trừ `cancelled`) nhưng không có test — chưa rõ là chủ đích hay sót.
6. **Logic query/group theo ngày bị lặp 3 nơi**: `resolveKpiTargetRole` (kpi/auto-score.ts) và `resolvePayrollTargetRole` (payroll/router.ts) gần giống hệt nhau nhưng không tách chung (có comment tự nhận là "để lại cho phase sau"); cả 2 router cũng tự viết lại phần group ShiftRegistration theo ngày dù đã dùng chung `assignPunchesToShifts`.
7. **`shortSpanShifts` chỉ tồn tại tại thời điểm refresh, không lưu DB** — director duyệt xong nếu refresh lại lần sau mà không còn short-span thì mất dấu vết.
8. **`flaggedPunches`** (punch vào ngày không đăng ký ca) được tính trong payroll nhưng không có nơi nào hiển thị/xử lý.
9. **Frontend không validate range ngày**, dùng text input thay vì date-picker cho mọi form ngày tháng trong module này.
10. **2 TODO(astryx-review) treo** trong `my-hr.tsx` và `check-in-out.tsx` — workaround màu sắc/UI component do design-system thiếu slot, chưa fix ở tầng component library.
11. **Test cancel-confirm-dialog không thực sự assert luồng xác nhận** (chỉ assert nút Hủy không hiện cho hàng rejected) — code có gate đúng nhưng coverage không chứng minh.
12. **`shift-config.tsx`** chỉ tạo mới, không sửa/xóa/deactivate group hoặc template.

## Câu hỏi chưa giải quyết
- `apps/e2e/tests/shift-lifecycle.spec.ts` được nhắc tới nhưng agent backend không đọc trực tiếp (đã đọc ở agent integration) — đã cross-check, khớp.
- Chưa xác nhận liệu `cancel` trên registration `rejected` có phải hành vi mong muốn (không có business context nào trong code xác nhận/phủ nhận).
- Chưa rõ có màn hình nào khác ngoài `apps/admin` (vd. mobile/app riêng) cũng gọi `shift.*` hay không — phạm vi scout giới hạn ở `apps/admin`.
