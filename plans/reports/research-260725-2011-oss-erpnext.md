# Báo Cáo Phân Tích Sâu: `frappe/erpnext` và `frappe/erpnext-14`

**Ngày:** 2026-07-25  
**Phạm vi:** Kiểm chứng license, cấu trúc module, kế toán lõi, so sánh với CMC EDU v2

---

## 1. KIỂM CHỨNG REPO `frappe/erpnext-14`

### Kết Luận Dứt Khoát

**`frappe/erpnext-14` là một FORK không phải repo chính thức của Frappe.**

| Tiêu Chí | Kết Quả |
|---------|--------|
| HTTP Status | 200 (tồn tại) |
| Loại Repo | Fork (parent: `frappe/erpnext`) |
| Trạng Thái Archive | false (còn hoạt động) |
| License | GPL-3.0 |
| Mục Đích Thực | Có thể là fork phát triển thử nghiệm hoặc hotfix cho v14 |

### Cách Đúng Để Pin ERPNext v14

Thay vì sử dụng `frappe/erpnext-14`:

```bash
# Cách 1: Dùng branch version-14 trong repo chính
git clone --branch version-14 https://github.com/frappe/erpnext.git

# Cách 2: Dùng tag release cụ thể (ví dụ v14.51.1)
git clone --branch v14.51.1 https://github.com/frappe/erpnext.git

# Cách 3: Dùng Bench dependency (recommended)
# bench get-app erpnext --branch version-14
```

**Lý do:** repo fork không được maintain bởi Frappe Technologies, rủi ro tụt lại version, missing security patch.

---

## 2. VERIFY LICENSE

### Dòng Xác Nhận

**File:** `license.txt` (dòng 1–3)
```
GNU GENERAL PUBLIC LICENSE
   Version 3, 29 June 2007
```

**File:** `package.json`
```json
"license": "GPL-3.0"
```

**File:** `erpnext/hooks.py` (dòng 8)
```python
app_license = "GNU General Public License (v3)"
```

### Kết Luận

- ✅ License: **GPL-3.0** (GNU GPL version 3 only, not "or later")
- ✅ Copyleft: cần công khai source code nếu distribute hoặc sửa code
- ⚠️ **CMC EDU v2 (proprietary, no LICENSE file)**: KHÔNG thể dùng lại ERPNext code trực tiếp mà không đổi license thành GPL-3.0 hoặc tìm alternative license từ Frappe

---

## 3. BẢN ĐỒ MODULE × DOCTYPE

### Danh Sách Top-Level Module

| Module | Số DocType | Vai Trò Chính |
|--------|-----------|--------------|
| **accounts** | 288 | Kế toán, GL Entry, Journal Entry, Payment Entry, Bank Reconciliation, Account tree |
| **stock** | 81 | Inventory: Item, Warehouse, Stock Entry, Stock Reconciliation, Bin |
| **manufacturing** | 49 | Sản xuất: Bill of Materials, Work Order, Operations, Routing |
| **buying** | 20 | Mua hàng: Purchase Order, Purchase Invoice, Supplier |
| **selling** | 22 | Bán hàng: Sales Order, Sales Invoice, Customer |
| **setup** | 43 | Cấu hình hệ thống: Company, Fiscal Year, Cost Center, Department |
| **crm** | 28 | CRM: Lead, Opportunity, Quotation, Deal |
| **projects** | 15 | Quản lý dự án: Project, Task, Timesheet, Project Costing |
| **assets** | 26 | Tài sản cố định: Asset, Asset Category, Depreciation Schedule |
| **support** | 11 | Hỗ trợ khách hàng: Issue, Communication, Service Level Agreement |
| **quality_management** | ? | Quản lý chất lượng |
| **edi** | ? | Electronic Data Interchange |
| **bulk_transaction** | ? | Xử lý hàng loạt |
| **regional** | ? | Localization (khu vực) |

**Tổng:** ~640 DocType

**Lưu ý:** HR/Payroll không ở đây → xem phần 4.

---

## 4. HR/PAYROLL — KIỂM CHỨNG VỊ TRÍ

### Kết Luận

**HR/Payroll đã tách sang repo `frappe/hrms` (separate FOSS repo)**

| Tiêu Chí | Kết Quả |
|---------|--------|
| Repo | https://github.com/frappe/hrms |
| Description | Open Source HR and Payroll Software |
| Fork | false (independent repo) |
| License | GPL-3.0 (implied, same as erpnext) |
| Status | Active (not archived) |

### Lý Do Tách

- HR/Payroll là domain độc lập, có cycle release riêng
- Độc lập hoá cho phép:
  - Maintain version compatibility với ERPNext versions khác
  - Allow custom HR implementations không cần modify erpnext
  - Community contributions tập trung vào HR logic

### Kế Quả Cho CMC EDU v2

**CMC có:** ParentAccount, StudentAccount, Guardian, Payslip, KpiScore, SalaryRate, SalaryTier, CompensationPolicy, ShiftGroup, ShiftTemplate, ShiftRegistration, ManualAttendanceTicket, TimePunch, Attendance, LoginOtp → **CMC đang build riêng HR/Payroll module**, không dùng HRMS.

**Học từ HRMS:**
- Cấu trúc nested salary tier (salary brackets, pay scale assignment)
- Attendance + Leave integration
- Salary slip generation logic
- Shift rotation management

---

## 5. BỘNG KẾ TOÁN (ACCOUNTING) — CẤU TRÚC LÕI

### Khái Niệm Chính

#### 5.1 GL Entry (Ledger Entry)

**Định nghĩa:** Record bất biến mỗi ghi sổ (debit/credit) vào account.

```
Journal Entry (1) → Chart of GL Entries (n)
   voucher_no (FK)
   voucher_type (Journal Entry / Payment Entry / Sales Invoice / ...)
   account (FK to Account)
   debit / credit (multi-currency: *, _in_account_currency, _in_transaction_currency, _in_reporting_currency)
   cost_center (optional)
   project (optional)
   posting_date, transaction_date, fiscal_year
   is_cancelled (tạo audit trail submit/cancel/amend)
```

**Chủ Yếu Submittable:** GL Entry không submit riêng, chỉ create khi parent (Journal Entry/Payment Entry) submit.

#### 5.2 Docstatus Lifecycle (Critical for CMC)

ERPNext dùng **docstatus** field (0/1/2) để track trạng thái submit/cancel/amend:

| docstatus | Tên | Ý Nghĩa | Hành Động |
|-----------|-----|--------|---------|
| 0 | Draft | Soạn nháp, có thể sửa | Create GL Entry tạm, chưa ghi sổ |
| 1 | Submitted | Ghi sổ bất biến | Create GL Entry vĩnh viễn, audit trail lock |
| 2 | Amended | Sửa lại (create amended_from) | Mark old doc as cancelled, create new submitted doc |

**Tại sao quan trọng:**
- GL Entry không xoá được (append-only ledger)
- Cancel = bộn document thành docstatus=2, create new doc với docstatus=1 (giữ trail)
- Amend = tương tự cancel + copy data, user sửa, submit lại

#### 5.3 Account Tree (Hierarchical Chart of Accounts)

```
Account (treeview, parent_account FK)
├── Asset (1000 series)
│   ├── Fixed Asset
│   └── Current Asset
├── Liability (2000 series)
│   ├── Current Liability
│   └── Long-term Liability
├── Equity (3000 series)
├── Income (4000 series)
└── Expense (5000 series)
    ├── Cost of Goods Sold
    └── Operating Expense
```

Mỗi Account có:
- `account_name`, `account_number`
- `account_type` (Asset/Liability/Equity/Income/Expense)
- `parent_account` (tạo tree)
- `company` (scoped)
- `account_currency` (multi-currency)
- `is_group` (0 = leaf account, 1 = folder, dùng cho grouping report)

#### 5.4 Cost Center (Dimensional Accounting)

```
Cost Center (treeview, cost_center_parent FK)
├── Head Office
├── Sales Department
├── Manufacturing Unit
    ├── Line A
    └── Line B
└── Support
```

**Mục đích:** Track chi phí theo department/location/project, tách biệt GL Entry từ Account.

**Ví dụ:** GL Entry có thể log:
- Account: Operating Expense → Salary
- Cost Center: Manufacturing Unit → Line A
→ Báo cáo "Salary cost by Line A" vs "Salary cost by Line B"

#### 5.5 Payment Entry (Multi-Purpose Payment Reconciliation)

**Liên kết:**
```
Payment Entry (1) → GL Entry (multiple)
   party_type (Customer/Supplier/Employee/...)
   party (FK to party)
   payment_type (Pay / Receive)
   mode_of_payment (Check / Bank Transfer / Cash / ...)
   posting_date, reference_date
   received_in_account, paid_from_account (Account FK)

Against: Allocate against outstanding (AR/AP)
   ├── against_doctype (Sales Invoice / Purchase Invoice / Expense Claim)
   ├── against_name (docname)
   └── amount_allocated

→ Create GL Entry:
   - Debit Received In Account (if Pay mode)
   - Credit Paid From Account
   - Credit/Debit party AR/AP account
```

**Reconciliation:** Payment Entry auto-match với Invoice, mark as "Fully Paid".

---

## 6. REPORT FRAMEWORK

### Loại Report Trong ERPNext

#### 6.1 Script Report (Python)

**Path:** `erpnext/*/report/report_name/report_name.py`

```python
def execute(filters=None):
    columns = [
        {"fieldname": "account", "label": "Account", "fieldtype": "Link", "options": "Account"},
        {"fieldname": "debit", "label": "Debit", "fieldtype": "Currency"},
        {"fieldname": "credit", "label": "Credit", "fieldtype": "Currency"},
    ]
    data = frappe.db.get_list(
        "GL Entry",
        filters={"fiscal_year": filters.fiscal_year},
        fields=["account", "sum(debit)", "sum(credit)"],
        group_by="account"
    )
    return columns, data
```

#### 6.2 Query Report (JSON config + Python)

**Path:** `erpnext/*/report/report_name/report_name.json`

```json
{
  "doctype": "Report",
  "name": "Balance Sheet",
  "report_type": "Script Report",
  "module": "Accounts",
  "query_report": true,
  "filters": [
    {"fieldname": "company", "label": "Company", "fieldtype": "Link", "options": "Company"},
    {"fieldname": "fiscal_year", "label": "Fiscal Year", "fieldtype": "Link"}
  ]
}
```

#### 6.3 Report Builder (Drag-n-Drop UI, No Code)

- Frappe built-in query builder
- Filter + select field + group by
- Auto export to CSV/PDF/Excel

#### 6.4 Standard Financial Reports

| Report | Loại | Dùng Cho |
|--------|------|---------|
| General Ledger | Script | Chi tiết GL Entry by account |
| Trial Balance | Script | Sum debit/credit by account |
| Balance Sheet | Script | Asset/Liability/Equity snapshot |
| Profit & Loss | Script | Income/Expense summary |
| Cash Flow | Script | Cash movement |
| Accounts Receivable | Query | Outstanding AR aging |
| Accounts Payable | Query | Outstanding AP aging |

---

## 7. HOOKS.PY — INTEGRATION POINTS

### Key Hooks Đăng Ký

```python
# erpnext/hooks.py (dòng 1–100)

app_name = "erpnext"
app_license = "GNU General Public License (v3)"
develop_version = "17.x.x-develop"  # = branch develop / edge version

treeviews = [
    "Account",
    "Cost Center",
    "Warehouse",
    "Item Group",
    "Customer Group",
    "Supplier Group",
    "Sales Person",
    "Territory",
    "Department",
]

on_session_creation = "erpnext.portal.utils.create_customer_or_supplier"
# → Auto-create Customer/Supplier when Portal User login

doc_events = {
    "Sales Order": {
        "validate": "erpnext.selling.sales_order.validate_sales_order",
        "on_submit": "erpnext.selling.sales_order.create_purchase_request",
        "on_cancel": "erpnext.selling.sales_order.cancel_purchase_request",
    },
}

# → Hook methods run khi Document event fire (validate/submit/cancel)
```

### Cơ Chế Extend

- `extend_doctype_class`: Override doctype behavior
- `doc_events`: Hook vào lifecycle events
- `page_js`: Custom JS cho page
- `doctype_js`: Custom JS cho specific doctype
- `override_whitelisted_methods`: Replace RPC method

---

## 8. QGNU & SỨC KHOẺ DỰ ÁN

| Tiêu Chí | Giá Trị |
|---------|--------|
| **Python LOC** | ~382,510 |
| **Python Files** | 2,886 |
| **DocType Total** | ~640 |
| **GitHub Stars** | 37,256 |
| **GitHub Forks** | 12,197 |
| **Open Issues** | 1,910 |
| **Version Hiện Hành** | v16.29.0 (2026-07-22) |
| **Version Còn Hỗ Trợ** | v16.x, v15.x (ít nhất 2 version active) |
| **Develop Version** | 17.x.x-develop |
| **Framework Dependency** | frappe >=17.0.0-dev,<18.0.0 |
| **Python Require** | >=3.14 |
| **Bộ Lõi Contributor** | Frappe Technologies Pvt Ltd |
| **Release Cadence** | Weekly (v15/v16), bi-weekly (develop) |

---

## 9. ĐỐI CHIẾU CMC EDU v2 ↔ ERPNEXT

### Bảng Mapping Domain

| Khía Cạnh | ERPNext | CMC EDU v2 | Khác Biệt |
|-----------|---------|-----------|----------|
| **Kế Toán Lõi** | GL Entry (docstatus 0/1/2), Account tree, Cost Center, Journal Entry submit/amend | Receipt, RefundRecord, AuditLog (append-only, no docstatus lifecycle) | CMC: simple append log; ERN: complex amend chain |
| **Multi-Currency** | Built-in: account_currency, transaction_currency, reporting_currency | CMC: single currency per Enrollment? | ERN: full multi-currency routing |
| **Naming Series** | naming_series: Auto-increment (naming_options config) | CMC: UUID/hash autoname? | ERN: human-readable series (JE-2026-00001) |
| **Accounting Dimension** | Cost Center, Projects, Accounting Dimension (custom) | CMC: Facility, Contact, Network scoping | ERN: dimensional drill-down (balance by cost center + project) |
| **AR/AP Reconciliation** | Payment Entry auto-match + allocation | CMC: manual StudentAccount debit/credit? | ERN: auto bank reconciliation, payment matching |
| **Submission Workflow** | docstatus=1 lock, docstatus=2 amend chain audit trail | CMC: once written, read-only? | ERN: full audit trail via docstatus history |
| **Payroll** | Separate frappe/hrms repo (Payslip, Salary Structure, Attendance) | CMC built-in: Payslip, SalaryRate, KpiScore, Attendance | ERN: domain separation; CMC: integrated |
| **Item/Inventory** | Item + Item Variant, Price List, Stock by Warehouse/Bin | CMC: Course (analog item), Room capacity? | ERN: full inventory management; CMC: limited |
| **Report** | Script/Query/Builder reports; standard GL/AP/AR/P&L | CMC: custom query reports in codebase? | ERN: mature report framework; CMC: bespoke |
| **Customer Hierarchy** | Customer + Shipping Address + Contact Link | CMC: Contact + guardian link, no address? | ERN: richer contact data model |

### 10 Ý Tưởng Domain CMC Có Thể Học

#### 1. **Docstatus Lifecycle & Amend Chain**
   - **Concept:** Thay vì xoá document, docstatus=1 (submitted) lock, docstatus=2 (amended) create new doc có amended_from field trail
   - **Lợi ích CMC:** Receipt/Refund audit trail tự động, không cần thêm AuditLog helper
   - **Nguy hiểm:** Phức tạp hơn simple append log, cần validation tất cả amendment

#### 2. **Naming Series (Human-Readable Auto-Increment)**
   - **Concept:** `naming_series: "JE-YYYY-"` → naming_options config tạo JE-2026-00001, JE-2026-00002
   - **Lợi ích CMC:** Enrollment code, Receipt code user-friendly, easy audit trail (không UUID)
   - **Học:** Implement naming_series prefix per Facility, per ClassBatch

#### 3. **Account Tree + Cost Center (Dimensional Accounting)**
   - **Concept:** GL Entry có 2 dimension: Account (what) + Cost Center (where), drill-down report by both
   - **Lợi ích CMC:** Receipt liên kết Facility (tree), Student (party), Course (cost center analog) → balance sheet per Facility
   - **Học:** Add hierarchical Facility cost center concept (HQ → Branch A → Campus 1)

#### 4. **Payment Entry + Auto-Reconciliation**
   - **Concept:** Payment Entry allocate vs Invoice amount, auto-match by reference, mark "Fully Paid" + GL Entry
   - **Lợi ích CMC:** StudentAccount.tuition_owed auto-deduct on Receipt submit, auto-zero when paid
   - **Học:** Implement Payment Entry pattern for Receipt ← bank statement line

#### 5. **Fiscal Year + Period Lock**
   - **Concept:** All GL Entry bound to fiscal_year, period cannot be reopened after close (audit lock)
   - **Lợi ích CMC:** Enrollment academic_year auto-locked after graduation, prevent retroactive edits
   - **Học:** Add semester/term close logic, prevent Attendance/Grade retroactive amendment after closed

#### 6. **Price List + Tiered Pricing**
   - **Concept:** ERN Item → Price List (multiple per Item, effective_date, batch quantity pricing)
   - **Lợi ích CMC:** Course → Tuition Price List (per Facility, per year, per class level), bulk enrollment discount
   - **Học:** Implement Course price book, auto-select based on Facility + year + class_size

#### 7. **Item Variant + Attribute-Based SKU**
   - **Concept:** Item (template) + Variant (size/color), auto-SKU generation
   - **Lợi ích CMC:** Course (template) + ClassBatch (variant by year/time), Room (template) + Classroom variant
   - **Học:** Decouple generic resource from specific instance

#### 8. **Attendance + Leave Integration**
   - **Concept:** Attendance (daily) + Leave (block), Payslip auto-deduct salary for leave_type
   - **Lợi ích CMC:** Attendance (student/staff), automatic roster status → Attendance + Leave → KpiScore deduct
   - **Học:** Link Attendance → StudentAccount (demerit marks), Attendance → Payslip

#### 9. **Custom Doctype Field (Accounting Dimension)**
   - **Concept:** Plug custom dimension (e.g., Region) into GL Entry, report drill-down
   - **Lợi ích CMC:** GL Entry → Facility (custom dim), auto-drilldown report by Facility
   - **Học:** Design extensible GL Entry for CMC multi-facility accounting

#### 10. **Sequential Document Amendment Validation**
   - **Concept:** Cannot skip version in amend chain (v1→v2→v3 required, no v1→v3 jump)
   - **Lợi ích CMC:** Audit trail integrity, no orphaned references
   - **Học:** Implement amendment chain for Enrollment status (Pending→Active→Paused→Graduated, no jumps)

---

## 10. CLAIM GỐC CỦA USER — ĐÍNH CHÍNH

| Claim | Kết Luận | Ghi Chú |
|-------|----------|--------|
| "dùng `frappe/erpnext-14`" | ❌ Sai | Repo này là fork, cách đúng: branch version-14 hoặc tag v14.x.x |
| "ERPNext GPL-3.0" | ✅ Đúng | Verified file license.txt, package.json, hooks.py |
| "HR/Payroll ở ERPNext" | ❌ Sai | Đã tách sang frappe/hrms (separate repo), không ở erpnext/ nữa |
| "ERPNext có kế toán phức tạp" | ✅ Đúng | Account tree, Cost Center, GL Entry docstatus lifecycle, multi-currency |
| "ERPNext có report framework" | ✅ Đúng | Script report, Query report, Report Builder |

---

## Risks & Limitations

### Risk: GPL-3.0 Copyleft

- CMC EDU v2 (proprietary, no license file) không thể nhập code từ erpnext mà không:
  - Công khai source hoặc
  - Đổi license CMC thành GPL-3.0 hoặc tương thích
- **Giải pháp:** Learn concept (architecture pattern) không copy code; hoặc dùng ERPNext via API (không tính copy)

### Risk: `frappe/erpnext-14` Fork Abandonment

- Fork có thể không update security patch
- 12,197 forks on GitHub nhưng chỉ ~5% được maintain tích cực
- **Giải pháp:** Pin version bằng tag release (v14.51.1) không fork

### Risk: HR/Payroll Separate

- CMC có Payslip, KpiScore, SalaryRate tương tự HRMS nhưng built-in
- HRMS là separate FOSS repo, maintain khác cycle
- **Giải pháp:** Nếu phải tích hợp, cần:
  - Tìm Frappe-endorsed adapter, hoặc
  - Rebuild Payslip logic học từ HRMS, không copy

---

## Unresolved Questions

1. **CMC có plan tích hợp ERPNext hay HRMS không?** → Cần product decision
2. **CMC Facility multi-currency support?** → Ảnh hưởng design receipt/refund architecture
3. **CMC docstatus workflow priority?** → Nếu cao, consider amend chain; nếu thấp, append-only ok
4. **CMC naming series requirement?** → Human-readable hay UUID ok? → Ảnh hưởng autoname design

---

## Nguồn

- GitHub API: `https://api.github.com/repos/frappe/erpnext`
- Shallow clone v14: `https://github.com/frappe/erpnext.git` (branch version-14)
- HRMS repo: `https://api.github.com/repos/frappe/hrms`
- License: `license.txt` (GPL-3.0 full text)
- Hooks: `erpnext/hooks.py` (source)

---

**Report Generated:** 2026-07-25 20:15  
**Analyst:** Researcher (Haiku 4.5)
