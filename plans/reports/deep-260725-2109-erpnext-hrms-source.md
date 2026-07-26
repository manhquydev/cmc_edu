# Báo Cáo Phân Tích Sâu: ERPNext & HRMS — Mức Source Code

**Ngày:** 2026-07-25  
**Phạm vi:** Code-level deep dive — GL Entry, docstatus lifecycle, attendance pairing, salary calculation, appraisal, leave management. So sánh CMC EDU v2.

---

## 1. BẢN ĐỒ MODULE — ĐO LOC

### ERPNext (Top Modules by Python LOC)

| Module | Files | LOC | Focus |
|--------|-------|-----|-------|
| **accounts** | 768 | 124,314 | GL Entry, Journal Entry, Payment, Bank Reconciliation |
| **stock** | 416 | 93,242 | Inventory, Warehouse, Stock Entry, Valuation |
| **manufacturing** | 219 | 35,232 | BOM, Work Order, Routing, Operations |
| **selling** | 151 | 19,753 | Sales Order, Invoice, Quotation |
| **buying** | 105 | 10,449 | Purchase Order, Invoice, Supplier |
| **setup** | 129 | 10,554 | Company, Fiscal Year, Cost Center, Department |
| **assets** | 84 | 12,949 | Fixed Asset, Depreciation, Asset Category |
| **crm** | 109 | 7,060 | Lead, Opportunity, Deal, Quotation |
| **projects** | 66 | 5,105 | Project, Task, Timesheet, Costing |
| **support** | 48 | 4,350 | Issue, Communication, SLA |
| **TOTAL (partial)** | 2,095 | 322,908 | ~49% của 640 doctype |

**Kết luận:** Accounts nặng nhất (38% LOC), ngôn ngữ kinh tế chiếm ưu thế ERPNext.

### HRMS (HR + Payroll)

| Module | Files | LOC | DocType Count |
|--------|-------|-----|----------------|
| **hr** | 411 | 39,874 | 336 doctype (employee, attendance, leave, appraisal, shift, training, ...) |
| **payroll** | 149 | 20,231 | 43 doctype (salary structure, component, slip, tax, ...) |
| **TOTAL** | 560 | 60,105 | 379 doctype |

**Lưu ý:** HRMS là repo độc lập (frappe/hrms), KHÔNG ở erpnext/ nữa (đã tách v11+). Maintain khác cycle với ERPNext.

---

## 2. KẾ TOÁN LÕI — CODE LEVEL

### 2.1 GL Entry — Sinh và Quản Lý

**File:** `erpnext/accounts/general_ledger.py` (dòng 34–80)

```
make_gl_entries(gl_map, cancel=False, ...)
  ├─ Nếu NOT cancel:
  │   ├─ Validate accounting period
  │   ├─ Process GL map (merge entries, distribute by cost center)
  │   ├─ Save entries → DB insert
  │   └─ Create payment ledger entry (reconciliation)
  │
  └─ Nếu cancel=True:
      └─ make_reverse_gl_entries(gl_map)
         ├─ Lấy GL entries cũ (is_cancelled == 0)
         ├─ Swap debit ↔ credit
         └─ Tạo reverse entries (APPEND, không DELETE)
```

**Key Insight:** GL Entry NEVER deleted, luôn append-only:
- Submit: tạo GL entries vĩnh viễn
- Cancel: tạo REVERSE entries (debit bị flip thành credit, ngược lại)
- Audit trail: lịch sử ghi sổ truy vết được qua is_cancelled flag

**Support immutable ledger** (`is_immutable_ledger_enabled()`): GL entries từng khi viết thì không được sửa/xoá, thậm chí ở admin.

### 2.2 Docstatus Lifecycle — 0/1/2 State Machine

**Ở controller level** (frappe framework):

| docstatus | Tên | Behavior | GL Entry |
|-----------|-----|----------|----------|
| **0** | Draft | Có thể sửa/xoá | Chưa tạo (temp) |
| **1** | Submitted | Locked, readonly | Tạo GL entries bất biến |
| **2** | Amended | Soft-cancel + amend | Tạo reverse entries + new doc với amended_from |

**Amended chain:**
```
Doc v1 (docstatus=1) → cancel → create amended_from chain
                               ├─ Doc v1: docstatus=2 (amended marker)
                               ├─ GL reverse entries (from v1)
                               ├─ Doc v2 (docstatus=0, amended_from="v1")
                               └─ User sửa v2 → submit v2 (docstatus=1)
                                  └─ GL entries mới từ v2
```

**CMC parallel:** CMC Receipt/RefundRecord có AuditLog append-only, nhưng KHÔNG có amend chain. ERPNext: tự động audit trail via docstatus.

### 2.3 Account Tree & Cost Center (Hierarchical Dimensions)

**Account** (erpnext/accounts/doctype/account/...):
- Tree view: parent_account FK
- account_type: Asset/Liability/Equity/Income/Expense
- is_group: 1 (folder) vs 0 (leaf)
- account_currency: multi-currency support

**Cost Center** (erpnext/setup/doctype/cost_center/...):
- Tree view: cost_center_parent FK
- Orthogonal to Account (GL Entry có cả 2 dimension)
- Báo cáo drill-down: balance by Account × Cost Center

**CMC parallel:** CMC có Facility (tree), nhưng GL Entry không có cost_center_parent. KHÁC biệt: ERPNext account tree full hierarchical, CMC flat.

### 2.4 Naming Series — Auto-Increment Human-Readable

**File:** `frappe/core/doctype/naming_series/naming_series.py` (không ở erpnext/)

```
naming_series: "JE-YYYY.-"
  → JE-2026-00001, JE-2026-00002, ...
```

**Mechanism:**
- naming_series format (naming_options config)
- Auto-increment counter per series
- Ghi lock (DB-level) để chống race condition khi đồng thời

**CMC parallel:**
- CMC: UUID/hash autoname (ReceiptCodeCounter ~ manual counter)
- ERPNext: built-in naming_series, user-friendly
- LESSON: implement naming_series per Facility + prefix (e.g., "FAC-001-REC-0001")

### 2.5 Period Closing / Khoá Sổ

**DocType:** `Period Closing Voucher` (erpnext/accounts/doctype/period_closing_voucher/)

```
Period Closing Voucher (on_submit):
  ├─ Get all GL entries between start_date → end_date
  ├─ Mark fiscal_year as "closed"
  ├─ GL Entry query filter: posting_date NOT in closed periods
  └─ Prevent new GL entry after close
```

**Enforcement:** DB-level check (`validate_accounting_period()`) — đã close period không thể post GL entry.

**CMC parallel:** CMC KHÔNG có period close. RECOMMENDATION: implement semester/term close (prevent retroactive Attendance/Grade after closed).

---

## 3. HRMS — ATTENDANCE & CHECK-IN (CHỮ CHI TIẾT)

### 3.1 DocType Structure

**Employee Checkin** (hrms/hr/doctype/employee_checkin/):
```
Fields:
  - employee (FK)
  - time (datetime)
  - log_type: IN / OUT
  - shift (FK to Shift Type)
  - shift_start, shift_end, shift_actual_start, shift_actual_end
  - latitude, longitude (geolocation)
  - device_id, offshift, skip_auto_attendance
  - attendance (FK, link to Attendance record)
```

**Attendance** (hrms/hr/doctype/attendance/):
```
Fields:
  - employee, attendance_date
  - in_time, out_time (ghép từ check-in logs)
  - status: Present / Absent / On Leave / Half Day / Work From Home
  - working_hours (tính từ logs)
  - shift (FK to Shift Type)
  - late_entry, early_exit (boolean flags)
  - actual_overtime_duration
  - leave_application (FK, nếu "On Leave")
  - amended_from (amend chain)
```

### 3.2 Auto-Attendance Algorithm — Code Level

**File:** `hrms/hr/doctype/shift_type/shift_type.py:176–216` (`_process` method)

```
_process(logs):
  1. Group logs by (employee, shift_start)
     → mỗi group = 1 ngày làm việc

  2. For each group:
     a. Get attendance_date = shift_start.date()
     b. Calculate working_hours từ logs
     c. Decide status dựa vào thresholds:
        - working_hours < absent_threshold → "Absent"
        - working_hours < half_day_threshold → "Half Day"
        - else → "Present"
     d. Check late_entry & early_exit
     e. Create/update Attendance record
     f. Link Attendance ← Employee Checkin logs

  3. Mark absent cho dates KHÔNG có attendance
     (auto-absent days)
```

**Key config:**
- `enable_auto_attendance` (shift setting)
- `process_attendance_after` (từ ngày nào)
- `last_sync_of_checkin` (đến ngày nào)
- `working_hours_threshold_for_absent`, `for_half_day`
- `late_entry_grace_period`, `early_exit_grace_period`

### 3.3 Working Hours Calculation — Pairing Logic

**File:** `hrms/hr/doctype/employee_checkin/employee_checkin.py:399–456`

**Hai chế độ pairing:**

#### Mode 1: "Alternating entries as IN and OUT during the same shift"
```
Logs: [IN(08:00), OUT(09:00), IN(14:00), OUT(17:00)]
  
Calc method "First/Last":
  working_hours = time_diff(IN(08:00), OUT(17:00)) = 9h
  
Calc method "Every pair":
  working_hours = time_diff(08:00, 09:00) + time_diff(14:00, 17:00)
                = 1h + 3h = 4h (lunch break không tính)
```

#### Mode 2: "Strictly based on Log Type in Employee Checkin"
```
Logs: [IN(08:00), IN(08:05), OUT(17:00), OUT(17:15)]  # dup check-in
  
Calc method "First/Last":
  working_hours = time_diff(first_IN, last_OUT)
                = time_diff(08:00, 17:15) = 9.25h
  
Calc method "Every pair":
  - Find first IN (08:00), pair with next OUT (17:00)
  - working_hours = 9h
  - Orphan OUT (17:15) ignored
```

**Xử lý ca đêm (overnight shift):**
```
shift_end < shift_start → end_time += 1 day
  
Ví dụ: shift 22:00 → 06:00
  time_diff(22:00, 06:00_next_day) = 8h ✓
```

### 3.4 So Sánh với CMC TimePunch

| Aspect | HRMS | CMC |
|--------|------|-----|
| **Check-in storage** | EmployeeCheckin (n per day) | TimePunch (1 per in/out) |
| **Attendance status** | Calculated from logs (auto) | Status field (manual + auto?) |
| **Pairing logic** | 2 modes (alternating / strict) | Calendar day group? (cần xác nhận) |
| **Late/Early detection** | Grace period config | Shift boundary check? |
| **Overtime** | overtime_type field, tracked | CompensationPolicy logic? |
| **Absent mark** | Auto-mark absent cho no-checkin days | Manual or auto? |
| **Shift night handling** | end_time += 1 day if overnight | Working day = calendar day (xác nhận?) |

**CMC gap?**
- Không có auto-absent marking (nếu user quên ghi shift không có check-in → không auto)
- Xử lý ca đêm: CMC group by calendar day, nếu ca 22:00→06:00 sẽ bị split → PROBLEM

---

## 4. HRMS — PAYROLL (CHỮ CHI TIẾT)

### 4.1 Salary Structure & Components

**Salary Structure** (hrms/payroll/doctype/salary_structure/):
```
Fields:
  - employee (FK)
  - payroll_frequency (Monthly/Fortnightly/Bimonthly/Weekly/Daily)
  - earnings[] (table)
      ├─ salary_component (FK)
      ├─ formula (optional)
      ├─ condition (optional, e.g., "base >= 50000")
      ├─ amount_based_on_formula (flag)
      └─ amount
  - deductions[] (table, same structure)
```

**Salary Component** (hrms/payroll/doctype/salary_component/):
```
Fields:
  - component_name
  - type: Earning / Deduction / Tax / Other
  - formula (optional)
  - condition (optional)
  - is_tax_applicable (for tax components)
  - depends_on_payment_days (boolean)
  - round_to_nearest_integer (rounding option)
```

### 4.2 Salary Slip Calculation — Formula Evaluation

**File:** `hrms/payroll/doctype/salary_slip/salary_slip.py:1380–1411` (`eval_condition_and_formula`)

```python
def eval_condition_and_formula(self, struct_row, data):
    condition, formula, amount = struct_row.condition, struct_row.formula, struct_row.amount
    
    # Step 1: Evaluate condition
    if condition and not _safe_eval(condition, self.whitelisted_globals, data):
        return  # Skip this component
    
    # Step 2: Evaluate formula if amount_based_on_formula
    if struct_row.amount_based_on_formula and formula:
        amount = flt(_safe_eval(formula, self.whitelisted_globals, data), 
                     struct_row.precision)
    
    return amount
```

**Execution order** (hrms/payroll/doctype/salary_slip/salary_slip.py:919):
```
1. Calculate earnings (base + variable components)
2. Calculate deductions (before tax)
3. Calculate tax (income tax, depends on YTD earnings)
4. Calculate final net_pay = gross_pay - total_deduction
```

**Rounding:** per component `round_to_nearest_integer` (default: round nearest integer)

**Proration:** component amount × (actual_days / total_days)
- actual_days = join_date → resign_date within payroll period
- CASCADING: nếu base prorated 50%, dependent formula inherit proration

**Data context for formula** (hrms/payroll/doctype/salary_slip/salary_slip.py:1359–1367):
```
data = {
  "base": <calculated_base>,
  "total_days": <payroll_period_days>,
  "payment_days": <actual_working_days>,
  "annual_salary": <ctc>,
  "working_hours": <from_timesheet>,
  <prior_earnings_deductions>,
  ...
}
```

### 4.3 So Sánh với CMC Payslip

| Aspect | HRMS | CMC |
|--------|------|-----|
| **Structure** | Salary Structure (earning/deduction table) | Payslip + SalaryTier + CompensationPolicy |
| **Formula eval** | _safe_eval condition + formula | ? (cần xác nhận) |
| **Earning order** | Base → Variable (condition-based) | Base + KPI bonus? |
| **Deduction order** | After earnings, before tax | Include penalties? |
| **Tax calc** | Income tax slab (Indian model) | ? (CMC simplified?) |
| **Proration** | Days-based × actual_days/total_days | ? |
| **Rounding** | Per-component rounding option | ? |
| **Timesheet-based** | salary_slip_based_on_timesheet flag | ? |

**CMC design question:** Payslip order khác gì so với ERPNext? (base → tier premium → KPI bonus − penalty)?

---

## 5. HRMS — APPRAISAL & LEAVE (SUMMARY)

### 5.1 Appraisal (Rating-Based Scoring)

**DocType:** Appraisal (hrms/hr/doctype/appraisal/)
```
Fields:
  - appraisal_date, start_date, end_date
  - appraisee (FK to Employee)
  - appraisers[] (table)
  - kra[] (Key Result Area, table)
      ├─ description
      ├─ goals[] (nested)
      │   ├─ goal_name
      │   ├─ target_value
      │   ├─ achieved_value
      │   └─ rating (1–5)
      └─ rating (average of goals)
  - total_score (calculated from KRA ratings)
  - status: Draft → Submitted
```

**Key difference vs CMC KpiScore:**
- HRMS: hierarchical (KRA → Goals → ratings)
- CMC: flat KpiScore (single component level?)

### 5.2 Leave Management (Leave Type → Allocation → Carry Forward)

**DocType tree:**
```
LeaveType (name, leave_type_name, max_continuous_days_allowed)
  ↓
LeavePolicy (name, leaves[] with leave_type + count)
  ↓
LeaveAllocation (employee, start_date, end_date, leave_type, count)
  ↓
LeaveApplication (employee, leave_type, from_date → to_date, status)
  ↓
LeaveLedgerEntry (append-only audit log)
  ├─ leave_allocation_id
  ├─ leave_application_id
  ├─ opening_balance, leave_granted, leave_used
  └─ closing_balance
```

**Carry forward logic:**
```
Earned Leave Schedule (monthly_earned_days config)
  → Auto-create LeaveAllocation for next year
  → Carry forward UP TO max_carried_forward_days
```

**CMC gap:** KHÔNG có leave management (Attendance chỉ là Present/Absent/On Leave, không track leave type/balance).

---

## 6. DOCTYPE COUNT & STRUCTURE

### HRMS HR Doctype Groups

| Nhóm | Count | Examples |
|-----|-------|----------|
| **Employee lifecycle** | ~15 | Employee, Designation, Department, Grade, Skill, Training, Onboarding, Separation |
| **Attendance & Shift** | ~10 | Attendance, Employee Checkin, Shift Type, Shift Assignment, Shift Request, Shift Schedule |
| **Leave** | ~12 | Leave Type, Leave Policy, Leave Allocation, Leave Application, Leave Ledger Entry, Compensatory Leave Request, Leave Block List |
| **Appraisal** | ~8 | Appraisal, Appraisal Cycle, Appraisal Template, Appraisal KRA, Appraisal Goal, Feedback Criteria, Performance Feedback |
| **Advance & Expense** | ~4 | Employee Advance, Expense Claim, Travel Request, Employee Other Income |
| **Benefits** | ~7 | Employee Benefit Application, Benefit Ledger, Employee Incentive, Gratuity |
| **Other** | ~260+ | (Reports, Print formats, Notifications, Dashboard charts, etc.) |

### HRMS Payroll Doctype Groups

| Nhóm | Count | Examples |
|-----|-------|----------|
| **Salary Structure** | 3 | Salary Structure, Salary Structure Assignment, Bulk Salary Structure Assignment |
| **Salary Component** | 2 | Salary Component, Salary Component Account |
| **Salary Slip** | 4 | Salary Slip, Salary Detail, Salary Slip Leave, Salary Slip Timesheet |
| **Payroll Processing** | 4 | Payroll Entry, Payroll Period, Payroll Correction, Payroll Employee Detail |
| **Tax** | 8 | Income Tax Slab, Employee Tax Exemption (declaration, category, proof), Tax Withholding |
| **Benefits & Deduction** | 15 | Employee Benefit Ledger, Employee Incentive, Additional Salary, Retention Bonus, Gratuity, Arrear, etc. |
| **Other** | ~2 | Payroll Settings, Salary Withholding Cycle |

---

## 7. ĐỐI CHIẾU CMC ↔ ERPNext/HRMS

### Bảng 3 Cột — Cơ Chế, Ánh Xạ, Đánh Giá

| Cơ Chế | ERPNext/HRMS | CMC EDU v2 | Đánh Giá |
|--------|--------------|-----------|---------|
| **GL Entry (Append-only)** | make_reverse_gl_entries() swap debit/credit | RefundRecord append-only (no reverse) | CMC đơn giản hơn, không có amend chain; hợp lý cho education (ít refund) |
| **Docstatus lifecycle** | 0→1→2 (Draft→Submitted→Amended) | DocStatus enum? (cần xác nhận) | ERN: tự động audit trail via versioning; CMC: cần design amended_from support |
| **Naming series** | naming_series config + auto-increment | UUID/hash autoname | ERN: user-friendly; CMC: system-friendly (unique guarantee) |
| **Account tree** | parent_account FK (hierarchical) | Facility tree (if exists?) | ERN: deep accounting hierarchy; CMC: flat Facility model ok cho scale |
| **Cost center** | Orthogonal to Account dimension | Facility scoping? | ERN: dimensional reporting; CMC: filter by Facility ok |
| **Period close** | Period Closing Voucher → lock | Semester/Term close? (NOT implemented) | **CMC GAP:** need term close to prevent retroactive edits |
| **Check-in pairing** | 2 modes (Alternating/Strict) + 2 calc methods | Calendar day group (xác nhận?) | ERN: flexible; CMC: if overnight shift → split day BUG? |
| **Working hours calc** | Swappable method (First/Last vs Every pair) | ? | ERN: lunch break support via Every pair; CMC: check |
| **Attendance auto-mark** | Auto-absent for no-checkin days | Manual? | ERN: reduce admin work; CMC: need automation |
| **Salary Structure** | Earning/Deduction table + formula | Base + Tier premium + KPI − Penalty | ERN: formula-driven; CMC: tier-driven → different order implications |
| **Salary formula eval** | _safe_eval condition + formula recursively | ? | ERN: mature formula engine; CMC: check if formula order affects tax calc |
| **Tax calculation** | Income tax slab + exemption declaration | Simplified? | ERN: India model (complex); CMC: might not need full tax model |
| **Proration** | Days-based automatic | ? | ERN: built-in; CMC: check if mid-month join handled |
| **Timesheet-based pay** | salary_slip_based_on_timesheet | ? | ERN: project-based billing; CMC: might use for contract staff |
| **Leave allocation** | LeavePolicy → LeaveAllocation → carry forward | Not implemented | **CMC MAJOR GAP:** staff leave management missing |
| **Leave balance tracking** | LeaveLedgerEntry (append-only) | Not present | ERN: audit trail per leave type; CMC: need if adding leave support |
| **Appraisal scoring** | Hierarchical KRA → Goals → ratings | KpiScore (structure?) | ERN: goal-driven; CMC: need clarify if KpiScore is same model |
| **Appraisal cycle** | Appraisal Cycle (annual/quarterly) | ? | ERN: batch appraisal processing; CMC: check cycle support |

### Summary

**CMC Sufficient:** GL Entry (simple), Account model (flat ok), Facility scoping, Payslip (if formula order OK)

**CMC Borderline:** Naming series (uuid ok), Attendance pairing (overnight shift risk?), Salary proration

**CMC Missing (should add):**
1. Period/Term close (prevent retroactive edits)
2. Auto-absent marking (reduce admin)
3. Leave management (staff benefit)
4. Appraisal cycle support (if KpiScore is one-time)

---

## 8. TOP 5 ÝTƯỞNG ĐÁNG LẤY

### Idea 1: Docstatus Lifecycle + Amend Chain
**Vấn đề:** Receipt/Refund audit trail phải manual (AuditLog helper). Nếu user sửa Receipt, cần track sequence.

**File tham chiếu:** `erpnext/controllers/accounts_controller.py:118–135`, `erpnext/accounts/general_ledger.py:607–674`

**CONCEPT:** Khi Receipt sửa (amended):
1. Mark Receipt v1 as docstatus=2 (amended marker)
2. Create reverse GL (Receipt v1)
3. Create Receipt v2 with amended_from="Receipt v1"
4. Audit trail tự động via docstatus history

**Hình dạng Prisma:**
```prisma
model Receipt {
  id String @id
  docstatus Int // 0:Draft, 1:Submitted, 2:Amended
  amended_from String? @relation("ReceiptAmendment")
  amendments Receipt[] @relation("ReceiptAmendment")
  version Int @default(1)
  // ... other fields
}
```

**Cost:** ~2–3 days (implement docstatus state machine, amendment chain validation)

**Risk:** Backward compatibility with existing Receipt data (need migration)

---

### Idea 2: Auto-Absent Marking + Leave Integration
**Vấn đề:** CMC Attendance phải manual mark present/absent. HRMS auto-marks absent cho no-checkin days.

**File tham chiếu:** `hrms/hr/doctype/shift_type/shift_type.py:302–330` (`mark_absent_for_dates_with_no_attendance`)

**CONCEPT:**
1. Daily cron job (after `last_sync_of_checkin`)
2. Get assigned shifts for each staff
3. For each working day in period: if NO attendance record → auto-mark Absent
4. Auto-link to LeaveApplication (nếu on leave, skip auto-absent)

**Hình dạng code:**
```typescript
// API endpoint: POST /attendance/auto-mark-absent
// Cron: 23:00 mỗi ngày
async function autoMarkAbsent(shiftsToProcess: ShiftType[]) {
  for (const shift of shiftsToProcess) {
    const workingDates = getWorkingDates(shift.process_attendance_after, shift.last_sync_of_checkin);
    for (const employee of shift.getAssignedEmployees()) {
      for (const date of workingDates) {
        if (!hasAttendance(employee, date) && !onLeave(employee, date)) {
          createAttendance(employee, date, "Absent", shift);
        }
      }
    }
  }
}
```

**Cost:** ~1 day (reuse Attendance creation logic, cron setup)

**Risk:** Đúng working day detection (holidays, leave blocks)

---

### Idea 3: Salary Formula Evaluation Engine (Safe Eval)
**Vấn đề:** CMC Payslip có SalaryTier + formula, cần eval formula an toàn (không execute arbitrary code).

**File tham chiếu:** `hrms/payroll/doctype/salary_slip/salary_slip.py:1380–1411` (`eval_condition_and_formula`), `frappe/utils/safe_eval.py` (not in scope, but concept)

**CONCEPT:**
1. Define allowed variables (base, kpi_score, days_worked, etc.)
2. Whitelist allowed functions (basic math, round, flt)
3. Evaluate formula safely: `_safe_eval(formula_string, whitelisted_globals, context_data)`
4. Return amount

**Hình dạng Prisma + tRPC:**
```prisma
model CompensationPolicy {
  id String @id
  name String
  baseSalaryFormula String // "base"
  tierBonusFormula String // "base * tier_multiplier"
  kpiFormula String // "base * kpi_score / 100"
  // ...
}

// tRPC endpoint
evaluateCompensation: publicProcedure
  .input(z.object({
    policyId: z.string(),
    context: z.record(z.number())
  }))
  .query(async ({ input }) => {
    const policy = await db.compensationPolicy.findUnique({ where: { id: input.policyId } });
    return {
      base: safeEval(policy.baseSalaryFormula, whitelistedGlobals, input.context),
      tierBonus: safeEval(policy.tierBonusFormula, whitelistedGlobals, input.context),
      kpi: safeEval(policy.kpiFormula, whitelistedGlobals, input.context),
    };
  });
```

**Cost:** ~2 days (formula parser, test edge cases)

**Risk:** Formula complexity (nested conditions, recursive dependencies)

---

### Idea 4: Shift Assignment + Working Hour Calculation
**Vấn đề:** CMC ShiftRegistration/Entry exist, nhưng chưa có full shift lifecycle (assignment, actual hours, overtime).

**File tham chiếu:** `hrms/hr/doctype/shift_assignment/shift_assignment.py`, `hrms/hr/doctype/employee_checkin/employee_checkin.py:399–456` (calculate_working_hours)

**CONCEPT:**
1. ShiftAssignment: link Employee → Shift Type (with start_date/end_date)
2. ShiftAssignment fetch actual shift boundaries (shift_actual_start/end)
3. Employee Checkin: auto-fetch shift + actual boundaries
4. Calculate working_hours: compare check-in times vs actual shift
5. Flag: late_entry, early_exit, overtime

**Hình dạng Prisma:**
```prisma
model ShiftType {
  id String @id
  name String
  startTime DateTime
  endTime DateTime
  workingHours Float
  // ... (lateEntryGracePeriod, earlyExitGracePeriod, etc.)
}

model ShiftAssignment {
  id String @id
  staffId String @relation("StaffShifts")
  shiftId String @relation("ShiftType")
  startDate DateTime
  endDate DateTime?
  status String // "Active" | "Ended"
}

model TimePunch {
  id String @id
  staffId String @relation("TimePunches")
  time DateTime
  logType String // "IN" | "OUT"
  shiftId String // Populated by fetch_shift
  shiftActualStart DateTime?
  shiftActualEnd DateTime?
  // ... (latitude, longitude for geolocation)
}
```

**Cost:** ~3 days (shift boundary calc, overnight shift handling, geolocation validation)

**Risk:** Race condition (concurrent checkins at boundary times)

---

### Idea 5: Leave Ledger Entry (Append-Only Leave Balance)
**Vấn đề:** CMC không track leave balance per type (used vs available). HRMS: LeaveLedgerEntry append-only audit trail.

**File tham chiếu:** `hrms/hr/doctype/leave_ledger_entry/leave_ledger_entry.py` (not shown, but concept from leave_type + allocation)

**CONCEPT:**
1. LeaveType: define leave type (e.g., "Annual", "Sick", "Casual")
2. LeaveAllocation: allocate per employee per year (e.g., 20 days Annual)
3. LeaveApplication: submit leave request
4. LeaveLedgerEntry: append-only log
   - opening_balance (from LeaveAllocation)
   - leave_applied (-days)
   - leave_used (-days on application_start)
   - closing_balance (auto-calculated)

**Hình dạng Prisma:**
```prisma
enum LeaveType {
  ANNUAL
  SICK
  CASUAL
}

model LeaveAllocation {
  id String @id
  staffId String @relation("LeaveAllocations")
  leaveType LeaveType
  year Int
  allocatedDays Float
  // ... (carryForward, carryForwardLimit)
}

model LeaveApplication {
  id String @id
  staffId String @relation("LeaveApplications")
  leaveType LeaveType
  fromDate DateTime
  toDate DateTime
  status String // "Draft" | "Approved" | "Rejected"
  daysApplied Float
}

model LeaveBalance {
  id String @id
  staffId String @relation("LeaveBalances")
  leaveType LeaveType
  allocationId String @relation("Allocations")
  daysBefore Float
  daysApplied Float
  daysUsed Float
  daysAfter Float // auto = daysBefore - daysApplied - daysUsed
}
```

**Cost:** ~4 days (state machine, carry forward logic, integration with Attendance "On Leave")

**Risk:** Year-end carry forward logic (complex rules per organization)

---

## 9. CẢNH BÁO — COMPLEXITY KHÔNG CẦN

### Cái CMC KHÔNG nên làm theo ERPNext

#### 1. **Multi-Currency + Exchange Rate**
- ERPNext: full multi-currency (account_currency, transaction_currency, reporting_currency)
- CMC: likely single VND → KHÔNG implement

#### 2. **Dimensional Accounting (Accounting Dimensions)**
- ERPNext: custom dimension + GL Entry offsetting entries
- CMC: Facility tree sufficient → KHÔNG implement custom dimensions

#### 3. **Item Variants + SKU Management**
- ERPNext: Item + Item Variant (size/color/etc.)
- CMC: Course + ClassBatch (year/section/etc.) → simpler model ok

#### 4. **Full Tax Slab + Exemption Declaration**
- ERPNext: Indian tax model (income tax slab, exemption categories, proof submission)
- CMC: if Vietnam → different tax model → KHÔNG copy ERN tax logic

#### 5. **Advanced Payroll Features**
- ERPNext: Gratuity, Retention Bonus, Income Tax Withholding, Tax Exemption, Additional Salary
- CMC: Base + Tier + KPI − Penalty → KHÔNG need gratuity/bonus complexity

#### 6. **Training & Development Tracking**
- HRMS: Training Program, Training Event, Training Feedback, Training Result
- CMC: staff training not in scope (focus: student education) → KHÔNG implement

#### 7. **HR Onboarding/Separation Workflows**
- HRMS: Employee Onboarding Template + activities, Employee Separation Template
- CMC: if school, staff join/leave simple → KHÔNG need workflow engine

---

## 10. UNRESOLVED QUESTIONS

1. **CMC TimePunch pairing algorithm?** Hiện tại group by calendar day hay shift_start? Overnight shift (22:00→06:00) được handle thế nào?

2. **CMC Payslip formula eval order?** Base → Tier → KPI − Penalty, hay khác? Có condition field như ERN không?

3. **CMC docstatus support?** Receipt/Refund có versioning/amendment support chưa? AuditLog là unique record hay linked to Receipt?

4. **CMC Facility tree depth?** Flat (single level) hay hierarchical (HQ → Branch → Campus)? Ảnh hưởng GL Entry cost_center design.

5. **CMC leave management required?** Staff leave balance tracking có trong scope không? (Education context: maybe not immediately)

6. **CMC appraisal cycle model?** KpiScore là one-time hay cycle-based (annual/quarterly)? Nested goal structure hay flat?

7. **CMC period close enforcement?** Semester/term close needed? Prevent retroactive Attendance/Grade/Receipt edits?

8. **CMC naming series priority?** UUID ok hay must be human-readable (Facility-001-REC-0001)?

---

## 11. LICENSING NOTE

**ERPNext & HRMS: GPL-3.0**

Toàn bộ code ERPNext, HRMS là GPL-3.0 (GNU General Public License v3). Concepts (ideas 1–5 trên) là architecture patterns, không copy GPL code.

CMC EDU v2 (proprietary, no LICENSE file) có thể:
- ✅ Learn concepts (docstatus lifecycle, formula eval, etc.)
- ✅ Reference architecture (không copy code)
- ❌ Copy code trực tiếp (unless CMC relicense to GPL-3.0)

**Giải pháp:** Build CMC features từ scratch dựa trên HRMS concepts, không port HRMS code.

---

## SOURCES

- GitHub: `https://github.com/frappe/erpnext/` (v16.x branch)
- GitHub: `https://github.com/frappe/hrms/` (main branch)
- Clone local: `/tmp/claude-1000/.../scratchpad/repos/erpnext/` (2,890 files)
- Clone local: `/tmp/claude-1000/.../scratchpad/repos/hrms/` (666 files)
- License: `erpnext/license.txt`, `hrms/license.txt` (GPL-3.0)

---

**Report Generated:** 2026-07-25 21:35  
**Analyst:** Researcher (Haiku 4.5)  
**Status:** DONE
