# Phase P3 — HR: TÁCH 2 PHASE MERGE RIÊNG (v2 — validator: sizing FAIL nếu 1 pass)

Seam sạch: P3-II tiêu thụ AppUser/managerId từ P3-I. Mỗi phase: branch/PR/merge riêng.

---

## P3-I — AppUser + FK backfill + Chấm công IP (WF-P3-01/02)

### Scope
- **AppUser** (facilityId, email, fullName, position, `managerId?` self-ref — validate: cùng facility, không self, chặn A↔B (QĐ0027); employeeCode counter global `CMC####`; isActive) + `FacilityNetwork` (CIDR/single, label, isActive) · RLS + GRANT.
- **FK backfill:** `Receipt.createdById/approvedById`, `ClassBatch.teacherId/createdBy`, `Attendance.markedById` → AppUser (nullable FK; dev backfill qua seed).
- **Dev-session → AppUser (H2 fix — chiến lược bridge, KHÔNG mass-rewrite):** `buildStaffContext`/test-harness **tự find-or-create AppUser row** cho id synthetic → 157+ test cũ xanh không sửa tay; context resolve AppUser thật, reject id không tồn tại (production path).
- `user.create/list/update` (perm `user.manage` — **super_admin only**, roster pinned plan.md).
- **Chấm công (ADR 0039):** `TimePunch` (ip, method ip|manual, punchAt) + `ManualAttendanceTicket` (theo NGÀY, pending|approved|rejected|resubmitted). `checkInOut.punch`: ctx.ip → `ipMatchesCidr` (pure, `@cmc/domain-identity`) → ip/manual; **cooldown CONFLICT**. `manualPunch.create/approve/reject`: **chỉ managerId trực tiếp; không tự duyệt**.
- **Chuyển `ict-time` từ apps/api/src/class/ → package chia sẻ `packages/domain-time`** (P3-II payroll cần import — fix validate).

### Review gate: **adversarial spot trên auth-substrate** (context/AppUser binding) + spot-check còn lại.
### Harness: US-020 (AppUser+FK, verify=`vitest run src/user/app-user.test.ts`) · US-021 (chấm công, verify=`vitest run src/checkin/ip-match.test.ts`).
### Acceptance: bridge giữ toàn suite xanh · CIDR biên + cooldown + không-tự-duyệt + RLS negative có test · merge protocol.

---

## P3-II — Ca (WF-P3-03/04) + Lương/KPI (WF-P3-05/06) + teacher-scoping

### Scope
- **Ca (ADR 0040):** `ShiftGroup` (KINH_DOANH|GIAO_VIEN, `selectionMode SINGLE|MULTIPLE`) + `ShiftTemplate` + `ShiftRegistration`(+entries; draft|submitted|approved|cancelled). `resolveShiftGroup(position)` pure. `submit`: **ticket-lock 1 phiếu · fromDate tương lai ICT · SINGLE=1 ca/ngày vs MULTIPLE**. `approve/reject`: managerId → fallback nhóm (GV→GĐĐT, KD→GĐKD) · chống tự-duyệt.
- **Lương (QĐ0025/0012):** `SalaryRate` + `Payslip` (draft|finalized; **penalty = DÒNG ĐỘC LẬP** — pre-resolved plan.md: v2 không tính thuế, bất biến = không trộn vào variablePay/base/KPI) + `@cmc/domain-payroll` pure calc (**unit ≥90% + thêm coverage threshold vitest.config**). `assembleSlip` **self-healing từ punch LIVE** (500đ/phút muộn, 1000đ/sớm — so với **ca approved**; **punch không có ca approved → không phạt, gắn cờ** — pre-resolved); `finalize` khoá; `reopen` re-derive; bucket tháng ICT. **Payslip read-path: user chỉ đọc payslip của MÌNH; GĐ/super_admin đọc rộng** (fix red-team: RLS facility ≠ bí mật lương).
- **KPI (QĐ0011):** `KpiScore` draft|submitted|confirmed|approved; override theo **cây managerId** + audit; cap kpiMax.
- `compensation.upsertRate` (GĐKD+GĐĐT+super_admin — pinned).
- **Teacher-scoping (H4 fix):** siết đọc attendance/assessment/evidence của giao_vien về **lớp mình dạy** (`ClassBatch.teacherId`) — GĐĐT/super_admin đọc rộng. Test negative: GV lớp khác bị chặn.
- **e2e:** thêm 2 critical path TL29 §1 — chấm công, đăng ký→duyệt ca.

### Review gate: **adversarial bắt buộc** (lương = tiền).
### Harness: US-022 (ca, verify=`vitest run src/shift/register-approve.test.ts`) · US-023 (lương, verify=`vitest run src/payroll/penalty-posttax.test.ts`) · US-024 (KPI, verify=`vitest run src/kpi/override-tree.test.ts`).
### Acceptance: SINGLE-vs-MULTIPLE · ticket-lock · fallback · self-healing (punch duyệt muộn → reopen tính lại) · penalty độc lập · payslip privacy · KPI cây quyền + audit · teacher-scoping negative · e2e 2 flow · coverage payroll ≥90 · merge protocol.

### Pre-resolved
`hr` role vẫn deferred (ADR-D) · trusted-proxy x-forwarded-for env (siết ở PD) · penalty rate hằng trong CompensationPolicy sau.
