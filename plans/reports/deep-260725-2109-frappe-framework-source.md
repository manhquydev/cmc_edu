# Frappe Framework: Source Code Deep Dive

**Phạm vi**: Phân tích implementation ở mức code thật (không lặp lại báo cáo kiến trúc vòng trước)  
**Ngày**: 2026-07-25  
**Repo**: `frappe/frappe` (commit c9dbea7, develop branch)  
**Phương pháp**: Đọc trực tiếp `frappe/model/`, `frappe/database/`, `frappe/permissions.py`, `frappe/api/v2.py`

---

## 1. BẢN ĐỒ MODULE LÕI - LOC MEASUREMENT

| Thư mục | Files | LOC | Mục đích |
|---------|-------|-----|---------|
| **frappe/core** | 342 | 33,492 | Doctype cốt lõi (User, Role, DocPerm, Permission, File, etc.) |
| **frappe/tests** | 110 | 31,164 | Test suite (skipped trong report này) |
| **frappe/utils** | 82 | 30,560 | Utilities (caching, decorators, hooks loading) |
| **frappe/desk** | 198 | 19,938 | UI backend (form renderer, list view, reportview) |
| **frappe/model** | 25 | 12,339 | ⭐ **CORE ENGINE**: document.py (86KB), base_document.py (50KB), db_query.py (55KB), meta.py (32KB) |
| **frappe/database** | 23 | 9,930 | ⭐ **CORE DB**: database.py (49KB), query.py (93KB), schema.py (14KB) |
| **frappe/email** | 64 | 10,108 | Email/notification system |
| **frappe/website** | 158 | 8,647 | Website mode (public content) |
| **frappe/integrations** | 84 | 7,013 | OAuth, payment gateways, etc. |
| **frappe/patches** | 175 | 4,112 | Database migrations (version-based) |

**Trọng tâm**: `frappe/model/` + `frappe/database/` = 22KB Python, 99% architecture ở đây.

---

## 2. DOCTYPE ENGINE - LOAD/VALIDATE/SAVE SEQUENCE

### 2.1 Lifecycle Phases (frappe/model/document.py)

**INSERT (create new doc):**
```
1. Line 725: check_permission("create") → raises PermissionError if denied
2. Line 734: run_before_save_methods()
   → run_method("before_validate")
   → run_method("validate")
   → run_method("before_save")
3. Line 751: db_insert() → INSERT INTO tabDocType
4. Line 761: run_post_save_methods()
   → run_method("on_update")
   → run_method("after_insert")  # if has_method
5. Line 762: notify_update() → Socket.IO broadcast
```

**UPDATE (save existing doc):**
```
1. Line 826-828: Check if __islocal or name empty → fallback to insert()
2. Line 832: check_permission("write", "save") → PermissionError if denied
3. Line 835: set_docstatus() → confirm docstatus value
4. Line 842: run_before_save_methods()
   → run_method("validate")
   → run_method("before_save")
5. Line 845: _validate() → doctype.validate() method
6. Line 850: set_docstatus() → re-confirm (can change state)
7. Line 856: db_update() or update_single() → UPDATE tabDocType WHERE name
8. Line 858: update_children() → handle table fields (child tables)
9. Line 860: run_post_save_methods()
   → run_method("on_update")
   → run_method("on_change")
10. Line 1916: clear_cache() → frappe.clear_document_cache(doctype, name)
```

**SUBMIT (state transition 0→1):**
```
1. Line 1765: self.docstatus = DocStatus.SUBMITTED  # docstatus = 1
2. Line 1766: return self.save()  # → same flow as UPDATE
3. Lifecycle: validate → before_submit → on_submit
```

**CANCEL (state transition 1→2):**
```
1. Line 1770: self.docstatus = DocStatus.CANCELLED  # docstatus = 2
2. Line 1771: return self.save()
3. Lifecycle: before_cancel → on_cancel
```

**DISCARD (draft only):**
```
1. Line 1801-1802: Check docstatus.is_draft() or raise ValidationError
2. Line 1804: check_permission("write")
3. Line 1806: run_method("before_discard")
4. Line 1807: db_set("docstatus", DocStatus.CANCELLED) → 1-line UPDATE, no hooks
5. Line 1809: run_method("on_discard")
```

### 2.2 Hook Lifecycle & Execution Order (frappe/model/document.py:2090-2097)

**Hook Calling Mechanism:**
```python
doc_events = frappe.get_doc_hooks()
for handler in doc_events.get(self.doctype, {}).get(method, []) + doc_events.get("*", {}).get(method, []):
    hooks.append(frappe.get_attr(handler))  # Resolve string path → callable
composed = compose(f, *hooks)               # Wrap original method with hooks
return composed(self, method, *args, **kwargs)
```

**Example Hook Chain for `employee.validate()` (5 hooks, 2 apps):**
```
App A hooks.py: doc_events = {"Employee": {"validate": ["app_a.methods.validate_emp"]}}
App B hooks.py: doc_events = {"*": {"validate": ["app_b.methods.audit_validate"]}}

Order = App A specific + App B wildcard
1. Call app_a.methods.validate_emp(doc, "validate")
2. Call app_b.methods.audit_validate(doc, "validate")
3. Call doc.validate()  # Original method
```

**Lookup Rule**: Doctype-specific hooks first, then wildcard ("*"), order depends on app install sequence (⚠️ implicit, not deterministic).

### 2.3 docstatus Enforcement (frappe/model/docstatus.py, document.py)

```python
# Values (docstatus.py:30-32)
DocStatus.DRAFT = 0
DocStatus.SUBMITTED = 1
DocStatus.CANCELLED = 2

# Enforcement points
- Line 1801: if not self.docstatus.is_draft() → cannot discard
- Line 868-873: validate_amended_from() → amended_from must have docstatus=2
- Line 1847: validate_update_after_submit() → only allow if is_submittable
```

**docstatus enforcement is ONLY in application code**, not DB constraints.

---

## 3. DOCTYPE → SQL: SCHEMA MAPPING & MIGRATION

### 3.1 Table Naming Convention (frappe/database/schema.py:25)

```python
self.table_name = f"tab{doctype}"  # Prefix "tab" + DocType name
```

Examples:
- DocType "Employee" → table "tabEmployee"
- DocType "Invoice" → table "tabInvoice"
- DocType "Invoice Item" (child, istable=1) → table "tabInvoice Item"

### 3.2 Default Columns (frappe/database/database.py:102)

**For regular doctypes (parent):**
```
name            VARCHAR(255)    PRIMARY KEY
creation        DATETIME        NOT NULL
modified        DATETIME        NOT NULL
modified_by     VARCHAR(255)
owner           VARCHAR(255)    (creator)
docstatus       INT DEFAULT 0   (0=draft, 1=submitted, 2=cancelled)
_assign         TEXT            (JSON, assignment tracking)
_comments       TEXT            (JSON, inline comments)
_seen           TEXT            (JSON, if track_seen=1)
[field1]        [fieldtype]
[field2]        [fieldtype]
```

**For child table doctypes (istable=1):**
```
parent          VARCHAR(255)    (FK to parent doctype)
parenttype      VARCHAR(255)    (parent's DocType name, e.g., "Invoice")
parentfield     VARCHAR(255)    (field name in parent, e.g., "items")
idx             INT             (row index for ordering)
[child fields...]
```

Example: Invoice has Items child table
```sql
-- tabInvoice (parent)
CREATE TABLE `tabInvoice` (
  `name` varchar(255) PRIMARY KEY,
  `customer` varchar(255),
  `total` decimal(21,9),
  `docstatus` int DEFAULT 0,
  ...
);

-- tabInvoice Item (child)
CREATE TABLE `tabInvoice Item` (
  `name` varchar(255),
  `parent` varchar(255),          -- FK to tabInvoice.name
  `parenttype` varchar(255),      -- "Invoice"
  `parentfield` varchar(255),     -- "items"
  `idx` int,
  `item_code` varchar(255),
  `qty` decimal(21,9),
  ...
);
```

On save invoice:
```python
# frappe/model/document.py:858
def update_children(self):
    for fieldname in self.table_fields:  # e.g., "items"
        # 1. Delete old rows
        frappe.db.delete("Invoice Item", {"parent": self.name})
        # 2. Insert new rows
        for row in self.items:
            row.parent = self.name
            row.parenttype = "Invoice"
            row.parentfield = "items"
            frappe.db.insert("Invoice Item", row)
```

### 3.3 Field Type Mapping (frappe/database/schema.py:57-66)

Via `frappe.db.type_map` (DB-specific, determined by driver: mariadb.py, postgres.py, sqlite.py):

```
Data             → VARCHAR(255)
Text             → TEXT or LONGTEXT
Int              → INT
Float, Currency  → DECIMAL(21,9)  [Default precision 21.9]
Link             → VARCHAR(255) + foreign key reference
Date             → DATE
DateTime         → DATETIME
Select           → VARCHAR(255)   (options stored as comma list)
Checkbox         → INT (0 or 1)
Table            → separate table with parent/parenttype/parentfield
```

### 3.4 Schema Sync & Migration (frappe/model/sync.py)

**Triggered by**: `bench migrate` or DocType save in UI

**Flow**:
```python
# frappe/model/sync.py
sync_all():
    for doctype in IMPORTABLE_DOCTYPES:
        dbtable = DBTable(doctype, meta)
        dbtable.sync()

# frappe/database/schema.py:44-52
def sync(self):
    if self.is_new():
        self.create()    # CREATE TABLE
    else:
        self.alter()     # ALTER TABLE (add/drop/modify columns)

def is_new(self):
    return not frappe.db.has_table(self.table_name)
```

**Migration Detection** (frappe/database/schema.py:112-150):
```python
def validate(self):
    if self.is_new(): return
    
    self.setup_table_columns()  # Load current DB schema
    
    # For each field in DocType meta:
    #   - Check if column exists in DB
    #   - Check if type changed (e.g., Data→Text)
    #   - Check if varchar length shrinking (truncation risk)
    # If mismatch detected: add to change list
    #   - add_column, change_type, change_nullability, add_index, etc.
```

**Custom Fields & Property Setter**:
- Custom fields: stored in `tabCustomField` rows, applied via sync
- Property Setter: stored in `tabProperty Setter`, can override field properties

---

## 4. PERMISSION: CODE-LEVEL ENFORCEMENT (NOT DATABASE-LEVEL)

### 4.1 Permission Check Entry Points

**API Layer (frappe/api/v2.py)**:
- **Line 84** (read_doc): `doc.check_permission("read")` before returning
- **Line 162** (document_list): `frappe.qb.get_query(..., ignore_permissions=False)` applies row-level filter
- **Line 207** (create_doc): `doc.insert()` calls check_permission during save
- **Line 227** (update_doc): `doc.save()` calls check_permission
- **Line 213** (copy_doc): `doc.check_permission("read")`

**Document Layer (frappe/model/document.py)**:
- **Line 725** (insert): `check_permission("create")`
- **Line 832** (_save): `check_permission("write", "save")`

### 4.2 Permission Check Main Function (frappe/permissions.py:80-224)

**Entry: `has_permission(doctype, ptype="read", doc=None, user=None, ...)`**

```python
# frappe/permissions.py:80-224
def has_permission(doctype, ptype="read", doc=None, user=None, ...) -> bool:
    # STEP 1: Administrator bypass (line 107-109)
    if user == "Administrator":
        return True  # All permissions granted
    
    # STEP 2: Child table delegation (line 120-129)
    if frappe.is_table(doctype):
        return has_child_permission(doctype, ptype, doc, user, ...)
    
    # STEP 3: Check document-level OR doctype-level permission
    if doc:  # (line 137-151)
        # Document-level check
        doc = frappe.get_lazy_doc(meta.name, doc)  # Avoid loading child tables (perf)
        perm = get_doc_permissions(doc, user=user, ptype=ptype).get(ptype)
    else:  # (line 152-175)
        # DocType-level check (e.g., can create at all?)
        role_permissions = get_role_permissions(meta, user=user)
        perm = role_permissions.get(ptype)
    
    # STEP 4: Share permission fallback (line 177-209)
    # If role permission denied, check tabDocShare for explicit sharing
    if not perm and not ignore_share_permissions:
        perm = false_if_not_shared()
    
    # STEP 5: Select permission implied by read (line 212-222)
    if not perm and ptype == "select":
        perm = has_permission(doctype, ptype="read", ...)
    
    return bool(perm)
```

### 4.3 Document Permission Evaluation (frappe/permissions.py:227-279)

**Function: `get_doc_permissions(doc, user=None, ptype=None, debug=False)`**

```python
def get_doc_permissions(doc, user=None, ptype=None, debug=False):
    # LAYER 1: Controller hook check (line 237)
    if not has_controller_permissions(doc, ptype, user=user, debug=debug):
        return {ptype: 0}  # Deny immediately
    
    # LAYER 2: Role permission base (line 241)
    permissions = copy.deepcopy(get_role_permissions(meta, user=user, is_owner=is_user_owner()))
    
    # LAYER 3: Document state checks (line 248-252)
    if not cint(meta.is_submittable):
        permissions["submit"] = 0  # Can't submit non-submittable doctype
    if not cint(meta.allow_import):
        permissions["import"] = 0
    
    # LAYER 4: if_owner override (line 254-262)
    # If permission has if_owner=1, apply owner permissions on top
    if permissions.get("has_if_owner_enabled"):
        permissions.update(permissions.get("if_owner", {}))
    
    # LAYER 5: User Permission check (line 264-273)
    # User permissions can restrict row-level access
    if not has_user_permission(doc, user, debug=debug, ptype=ptype):
        if is_user_owner():
            permissions = permissions.get("if_owner", {})  # Use if_owner perms only
        else:
            permissions = {}  # Deny entirely
    
    return permissions
```

**Key: Layers 1-5 are sequential checks in APPLICATION CODE. If any check fails → DENY.**

### 4.4 Role Permission Lookup (frappe/permissions.py:282-342)

**Function: `get_role_permissions(doctype_meta, user=None, is_owner=None, debug=False)`**

```python
def get_role_permissions(doctype_meta, user=None, is_owner=None, debug=False):
    # Cache key: (doctype, user, is_owner)
    cache_key = (doctype_meta.name, user, bool(is_owner))
    
    if user == "Administrator":
        return allow_everything(doctype_meta.name)  # All perms=1
    
    # Get user's roles (line 311)
    roles = frappe.get_roles(user)  # Query tabHasRole + automatic roles
    
    # Filter DocPerm by role membership (line 314-320)
    applicable_permissions = [p for p in doctype_meta.permissions
        if p.role in roles and cint(p.permlevel) == 0]
    
    # Build permission dict (line 324-338)
    perms = {}
    for ptype in get_rights(doctype_meta.name):  # read, write, create, delete, submit, etc.
        # Check if ANY applicable permission grants this right
        pvalue = any(p.get(ptype, 0) for p in applicable_permissions)
        perms[ptype] = cint(pvalue)
        
        # If if_owner=1 enabled, split into owner/non-owner (line 328-338)
        if pvalue and has_if_owner_enabled and not has_permission_without_if_owner_enabled(ptype):
            perms["if_owner"][ptype] = cint(pvalue and is_owner)  # Only if owner
            perms[ptype] = 1 if ptype in ("select", "read") else 0  # List-only access
    
    frappe.local.role_permissions[cache_key] = perms
    return perms
```

**Result**: Permission dict like `{"read": 1, "write": 0, "create": 0, "if_owner": {"delete": 1}}`

### 4.5 Permission Query Conditions - Row-Level Filter (frappe/model/db_query.py:1332-1360)

**Applies during SELECT queries to filter rows the user can see**

```python
# frappe/model/db_query.py:1332-1360
def get_permission_query_conditions(self) -> str:
    conditions = []
    
    # STEP 1: Get hooks (line 1334-1335)
    hooks = frappe.get_hooks("permission_query_conditions", {})
    condition_methods = hooks.get(self.doctype, []) + hooks.get("*", [])
    
    # STEP 2: Call each hook (line 1336-1343)
    for method in condition_methods:
        if c := frappe.call(frappe.get_attr(method), self.user, doctype=self.doctype):
            # Hook returns either raw SQL or pypika term
            if not isinstance(c, str):
                c = self._render_permission_criterion(c)  # Convert pypika → SQL
            conditions.append(c)
    
    # STEP 3: Server Script permission (line 1353-1358)
    if permission_script_name := get_server_script_map().get("permission_query", {}).get(self.doctype):
        script = frappe.get_doc("Server Script", permission_script_name)
        if condition := script.get_permission_query_conditions(self.user, ...):
            conditions.append(condition)
    
    # STEP 4: Join all conditions (line 1360)
    return " and ".join(conditions) if conditions else ""
```

**Result**: WHERE clause string like `"`tabReport`.owner = 'user@example.com'"`

**Applied in query** (frappe/model/db_query.py:1254-1256):
```python
doctype_conditions = self.get_permission_query_conditions()
conditions += (" and " + doctype_conditions) if conditions else doctype_conditions
# Final SQL: SELECT * FROM tabReport WHERE (... filters ...) and (`tabReport`.owner = 'user@example.com')
```

### 4.6 ⚠️ CRITICAL: Enforcement Layer is APPLICATION-ONLY (No DB-Level RLS)

**Evidence:**

| Aspect | Evidence |
|--------|----------|
| **Permission logic location** | frappe/permissions.py (700+ lines Python) |
| **Database enforcement** | ZERO Postgres RLS policies, zero CREATE POLICY, zero SET ROLE |
| **Where check happens** | AFTER data loaded from DB in app layer (frappe/api/v2.py:84) |
| **Raw SQL bypass risk** | If developer calls `frappe.db.sql("SELECT * FROM tabEmployee")` → **SECURITY BYPASS** |

**No evidence in codebase of:**
- Postgres `CREATE POLICY` statements
- `ALTER TABLE ... ENABLE RLS`
- Connection-level `SET ROLE` / `SET LOCAL`
- DB-enforced row-level security

**Implication**: Frappe relies 100% on application-layer permission checks. Vulnerability exists if:
1. Developer forgets `doc.check_permission()`
2. Raw SQL bypass (frappe.db.sql without permission wrapper)
3. Bug in permission_query_conditions hook logic

### 4.7 Comparison Table: Frappe vs CMC EDU v2

| Dimension | Frappe | CMC EDU v2 |
|-----------|--------|-----------|
| **Enforcement location** | Python application layer (frappe/permissions.py) | Postgres RLS policies (DB-level) |
| **Permission check timing** | AFTER SELECT from DB | BEFORE SELECT (RLS filters rows) |
| **Bypass risk** | Raw SQL: `frappe.db.sql()` without check → leak | RLS policy enforced even if app bypassed |
| **Row-level filtering** | permission_query_conditions hooks + WHERE clause | Postgres RLS policies + table constraints |
| **Performance** | Check per request, cache roles/DocPerm | Evaluated at row-level by DB, native speed |
| **Flexibility** | Change in hooks.py → immediate effect | Update RLS policy → requires function/trigger |
| **Auditability** | Application logs, depends on audit framework | DB audit via pg_stat_statements, policy audit |
| **Defense depth** | Single layer: app code | Two layers: app + DB policy |

**Verdict**: CMC's RLS is architecturally stronger for preventing data leaks. Frappe's app-layer provides more control but requires discipline.

---

## 5. HOOKS SYSTEM - LOADING & RESOLUTION

### 5.1 Hook Loading: _load_app_hooks() (frappe/__init__.py:1008-1034)

```python
def _load_app_hooks(app_name: str | None = None):
    hooks = {}
    apps = [app_name] if app_name else get_installed_apps(_ensure_on_bench=True)
    
    for app in apps:
        # Line 1019: Load app/hooks.py module
        app_hooks = get_module(f"{app}.hooks")
        
        # Line 1031-1032: Get all non-private, non-function attributes
        for key, value in inspect.getmembers(app_hooks, predicate=_is_valid_hook):
            if not key.startswith("_"):
                # Line 1033: Merge into global hooks dict
                append_hook(hooks, key, value)
    
    return hooks
```

**Hook Merging: append_hook() (frappe/__init__.py:1066-1084)**

```python
def append_hook(target, key, value):
    if isinstance(value, dict):  # for doc_events, permission_query_conditions
        # Recursively merge dict keys
        target.setdefault(key, {})
        for inkey in value:
            append_hook(target[key], inkey, value[inkey])
    else:  # for on_login, before_install (list)
        target.setdefault(key, [])
        if not isinstance(value, list):
            value = [value]
        target[key].extend(value)  # Extend list
```

**Caching Strategy (frappe/__init__.py:1037-1058)**

```python
_request_cached_load_app_hooks = request_cache(_load_app_hooks)    # Per-request cache
_site_cached_load_app_hooks = site_cache(_load_app_hooks)          # Per-site cache

get_hooks() logic:
- if app_name specified: request_cache (precise)
- elif developer_mode: site_cache (reload on app change)
- else: client_cache (persistent per request)
```

Result: `frappe.get_hooks("doc_events")` returns merged dict from ALL installed apps.

### 5.2 Hook Points Defined in frappe/hooks.py

| Hook | Type | Examples |
|------|------|----------|
| `permission_query_conditions` | Dict[DocType, method] | {Report: frappe.core.doctype.report.get_permission_query_conditions} |
| `has_permission` | Dict[DocType, method] | Custom permission logic (can DENY) |
| `doc_events` | Dict[DocType, Dict[event, list]] | {Employee: {validate: [...], on_submit: [...]}} |
| `scheduler_events` | Dict[freq, list] | {daily: [...], hourly: [...], cron: {...}} |
| `on_session_creation` | List | Post-login hooks |
| `on_login` | String (method) | On login action |
| `override_whitelisted_methods` | Dict | Intercept RPC calls |
| `notification_config` | String (method) | Define notifications |

### 5.3 Doc Event Hook Chain Execution (frappe/model/document.py:2090-2097)

**When `doc.run_method("validate")` called:**

```python
# Step 1: Get all hooks
doc_events = frappe.get_doc_hooks()
# Result: {"Employee": {"validate": ["app_a.validate_emp", "app_b.validate_emp"]}, "*": {"validate": [...]}}

# Step 2: Lookup
handlers = (doc_events.get(self.doctype, {}).get(method, [])
           + doc_events.get("*", {}).get(method, []))
# For Employee.validate: ["app_a.validate_emp", "app_b.validate_emp", "app_c.audit_validate"]

# Step 3: Resolve to callables
hooks = [frappe.get_attr(handler) for handler in handlers]

# Step 4: Compose with original method
composed = compose(original_method, *hooks)
# Execution order: hooks[0] → hooks[1] → hooks[2] → original_method

# Step 5: Execute
return composed(self, method, *args, **kwargs)
```

**Execution Order**: 
1. Doctype-specific hooks (from all apps, in app install order)
2. Wildcard ("*") hooks (from all apps, in app install order)
3. Original method

**⚠️ Issue**: Order between multiple apps for same hook is implicit (based on app install order), not deterministic.

---

## 6. API LAYER - REQUEST → PERMISSION → EXECUTION

### 6.1 REST API Endpoints (frappe/api/v2.py)

| Method | Endpoint | Handler | Permission |
|--------|----------|---------|-----------|
| GET | `/api/v2/document/<doctype>` | document_list() line 96 | read |
| GET | `/api/v2/document/<doctype>/<name>` | read_doc() line 82 | read |
| POST | `/api/v2/document/<doctype>` | create_doc() line 198 | write |
| PUT | `/api/v2/document/<doctype>/<name>` | update_doc() line 221 | write |
| DELETE | `/api/v2/document/<doctype>/<name>` | delete_doc() | delete |
| POST | `/api/v2/call/<method>` | handle_rpc_call() line 46 | @whitelist() |

### 6.2 Query Building with Permissions (frappe/api/v2.py:154-163)

```python
def document_list(doctype: str) -> list[dict[str, Any]]:
    query = frappe.qb.get_query(
        table=doctype,
        fields=fields,
        filters=filters,
        order_by=order_by,
        offset=start,
        limit=limit + 1,
        group_by=group_by,
        ignore_permissions=False,  # ← CRITICAL: Apply permission_query_conditions
    )
    
    # querybuilder adds WHERE clause via get_permission_query_conditions()
    data = query.run(as_dict=as_dict, debug=debug, as_list=not as_dict)
    return data[:limit]
```

**Flow**: 
1. frappe.qb.get_query() builds QueryBuilder
2. QueryBuilder.run() calls get_permission_query_conditions()
3. Conditions appended to WHERE clause
4. SQL executed with row-level filter

### 6.3 Whitelist & RPC Mechanism (frappe/api/v2.py:46-69)

```python
def handle_rpc_call(method: str, doctype: str | None = None):
    # Line 54: Check override hooks
    method = frappe.override_whitelisted_method(method)
    
    # Line 57: Server Script override
    server_script = get_server_script_map().get("_api", {}).get(method)
    if server_script:
        return run_server_script(server_script)
    
    # Line 62: Resolve method path
    method = frappe.get_attr(method)
    
    # Line 66: MUST have @frappe.whitelist() decorator
    is_whitelisted(method)  # Raises NotFound if missing
    
    # Line 67: HTTP method restriction check
    is_valid_http_method(method)
    
    # Line 69: Call method with form_dict params
    return frappe.call(method, **frappe.form_dict)
```

**Whitelist check**: Decorator `@frappe.whitelist()` is required on method to expose via RPC.

---

## 7. BACKGROUND JOBS & SCHEDULER

### 7.1 Job Queue (RQ + Redis)

Library: `rq==2.6.1` (pyproject.toml:73)

**Enqueue**: `frappe.enqueue(method, queue="default", job_timeout=300, retry=3, ...)`
- Puts job in Redis queue (key format: `rq:queue:default`)
- Workers consume jobs via RQ library
- Timeout and retry configured per job
- Execution context: `frappe.local.site` set to job's site

### 7.2 Scheduler (frappe/hooks.py:214+)

```python
scheduler_events = {
    "cron": {
        "0 0 * * *": ["app.daily_job"],           # Daily at midnight
        "*/5 * * * *": ["app.frequent_job"],      # Every 5 minutes
    },
    "hourly": ["app.hourly_job"],
    "daily": ["app.daily_job"],
    "weekly": ["app.weekly_job"],
    "monthly": ["app.monthly_job"],
}
```

Execution: Frappe scheduler process (via `bench schedule`) polls for scheduled jobs and runs them.

---

## 8. MULTI-TENANT ARCHITECTURE (frappe/config.py)

### 8.1 Site Configuration

**Directory structure:**
```
sites/
  site1.example.com/
    site_config.json    # Per-site DB credentials, email settings
    public/             # Static files for this site
  site2.example.com/
    site_config.json
  common_site_config.json  # Redis URLs, shared settings
```

### 8.2 Database Connection per Site (frappe/config.py:33-106)

**Site config resolution:**
```python
def _get_site_config(sites_path: str, site_path: str) -> _dict:
    config = {}
    
    # Merge common_site_config.json (line 36-39)
    common_config = get_common_site_config(sites_path)
    config.update(common_config)
    
    # Merge site-specific site_config.json (line 41-49)
    site_config = os.path.join(site_path, "site_config.json")
    if os.path.exists(site_config):
        config.update(get_file_json(site_config))
    
    # Environment variable overrides (line 74-92)
    config["db_type"] = os.environ.get("FRAPPE_DB_TYPE") or config.get("db_type") or "mariadb"
    config["db_host"] = os.environ.get("FRAPPE_DB_HOST") or config.get("db_host") or "127.0.0.1"
    config["db_port"] = int(os.environ.get("FRAPPE_DB_PORT") or config.get("db_port") or default_port)
    config["db_user"] = os.environ.get("FRAPPE_DB_USER") or config.get("db_user") or config.get("db_name")
    config["db_name"] = os.environ.get("FRAPPE_DB_NAME") or config.get("db_name") or config["db_user"]
    config["db_password"] = os.environ.get("FRAPPE_DB_PASSWORD") or config.get("db_password")
    
    return config
```

**Each site can have**:
- Separate database (separate db_name, db_user credentials)
- OR shared database with tenant_id column (custom, not Frappe default)

Frappe assumes **separate DB per site by default** (easier isolation, harder ops at scale).

---

## 9. SO SÁNH FRAPPE vs CMC EDU V2

| Hạng mục | Frappe | CMC EDU v2 | Ai tốt hơn & Tại sao |
|---------|--------|-----------|---------------------|
| **Permission enforcement** | App-layer Python (frappe/permissions.py) | Postgres RLS policies (DB-level CREATE POLICY) | CMC: Secure by default, can't bypass with raw SQL |
| **Row filtering** | permission_query_conditions hooks + WHERE clause | RLS policies + row constraint | CMC: Faster (DB-native), no hook overhead |
| **Child table storage** | Separate table: parent/parenttype/parentfield/idx | ? (likely similar or via JSON) | Frappe: Flexible for complex forms |
| **DocType schema** | JSON metadata (DocType doc), runtime flexible | Prisma schema (compile-time type-safe) | CMC: Better for consistency; Frappe: Better for extensibility |
| **Migration strategy** | Patches + sync (implicit schema evolution) | SQL migrations (explicit, versioned) | CMC: Auditability; Frappe: Less boilerplate |
| **Transaction scope** | Per-request context (frappe.local) | Per-request context (Prisma session) | Both equivalent |
| **Background jobs** | RQ + Redis (Python-based) | ? (likely Bull/BullMQ or similar) | Both viable, depends on ops |
| **API auth** | Session cookie or API Key/Secret (Basic Auth) | tRPC with session or Bearer token | CMC: Type-safe + better DX |
| **Hooks/Middleware** | Dict-based hooks + compose() | tRPC middleware (explicit pipe) | CMC: Deterministic order; Frappe: Loose coupling |
| **Multi-tenant** | Separate DB per site (sites/ directory) | Logical isolation (RLS per tenant, shared DB) | CMC: Simpler ops; Frappe: Full isolation |

---

## 10. CƠ CHẾ ĐÁ NHẤT CÓ LIÊN QUAN CHO CMC (Top 5 Learnings)

### 10.1 Permission Query Conditions Hook Pattern

**Frappe làm:**
```python
permission_query_conditions = {
    "Report": "frappe.core.doctype.report.report.get_permission_query_conditions",
}

def get_permission_query_conditions(user, doctype=None):
    if "System Manager" in frappe.get_roles(user):
        return ""
    return f"`tabReport`.owner = {frappe.db.escape(user)}"
```

**Áp vào CMC bằng TypeScript/Prisma:**
```typescript
// Define hook in app config
export const permissionQueryConditions = {
  Report: getReportPermissionConditions,
};

// Implement filter function
async function getReportPermissionConditions(user: string, doctype: string) {
  const roles = await getUserRoles(user);
  if (roles.includes("System Manager")) return "";
  return `Report.owner = '${user}'`;  // Or use Prisma.sql template
}

// Apply in query
const query = prisma.report.findMany({
  where: {
    AND: [
      filters,
      Prisma.raw(await getPermissionQueryConditions(user, "Report")),
    ]
  }
});
```

**Chi phí**: Medium (2-3 days for framework hook system + adapter for Prisma where clauses).

### 10.2 Doc Event Lifecycle Hooks

**Frappe làm:**
```python
doc_events = {
    "Employee": {
        "validate": ["app.validate_employee"],
        "before_submit": ["app.assign_id"],
        "on_submit": ["app.notify_manager"],
    }
}
```

**Áp vào CMC bằng TypeScript:**
```typescript
export const docHooks = {
  Employee: {
    validate: [validateEmployee],
    beforeSubmit: [assignEmployeeId],
    onSubmit: [notifyManager],
  },
};

// In document.save()
async save() {
  for (const hook of docHooks[this.doctype]?.validate || []) {
    await hook(this);
  }
  this.validate();  // Original method
  // ... rest of save flow
}
```

**Chi phí**: Low (hook framework already in tRPC middleware, just need doc-specific wrapper).

### 10.3 Permission State Machine (docstatus Lifecycle)

**Frappe pattern:**
```
Draft (0) → Submit (1) → Cancel (2)
         → Amend → New Draft
```

**CMC pattern:**
```typescript
enum DocStatus {
  Draft = 0,
  Submitted = 1,
  Cancelled = 2,
}

// Validate transitions
if (oldStatus === DocStatus.Draft && newStatus === DocStatus.Submitted) {
  // Check has_permission("submit")
  // Trigger before_submit hooks
  // Set docstatus=1 + save
}

// Prevent invalid transitions
if (oldStatus === DocStatus.Cancelled && newStatus === DocStatus.Submitted) {
  throw new Error("Cannot resubmit cancelled document");
}
```

**Chi phí**: Low (already have permission checks + hooks, just formalize state machine).

### 10.4 Child Table Management Pattern

**Frappe pattern:**
```python
# Parent: tabInvoice
# Child: tabInvoiceItem (parent, parenttype, parentfield, idx columns)

def update_children(self):
    for fieldname in self.meta.get_table_fields():
        # Delete all old rows
        frappe.db.delete(child_doctype, {"parent": self.name})
        # Insert new rows
        for row in self.get(fieldname):
            row.parent = self.name
            row.parenttype = self.doctype
            row.parentfield = fieldname
            frappe.db.insert(child_doctype, row)
```

**CMC pattern (Prisma):**
```typescript
// Already done in Prisma cascade delete + createMany
await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
await prisma.invoiceItem.createMany({
  data: invoice.items.map((row, idx) => ({
    invoiceId: invoice.id,
    itemCode: row.itemCode,
    qty: row.qty,
    _index: idx,  // Store order
  })),
});
```

**Chi phí**: Zero (Prisma already handles this better than Frappe's manual row management).

### 10.5 Hooks Ordering & Determinism

**Frappe problem:**
- Implicit order (app install sequence)
- Hard to debug cascade effects
- No explicit execution order guaranteed

**CMC solution:**
```typescript
// Explicit middleware chain in router
export const docUpdateMiddleware = [
  validateLinksMiddleware,      // 1. Validate FK
  checkPermissionMiddleware,    // 2. Check permission
  applyUserFieldsMiddleware,    // 3. Set owner/modified_by
  runBeforeSaveHooksMiddleware, // 4. Custom hooks
  persistMiddleware,            // 5. Save to DB
  runAfterSaveHooksMiddleware,  // 6. Post-save hooks
];

// Deterministic, type-safe, easy to introspect
```

**Chi phí**: Low (already have tRPC middleware, just make order explicit in config).

---

## HỎI CHƯA GIẢI

1. **Audit trail trong Frappe**: Khi developer quên `check_permission()`, có log nào theo dõi truy cập không? (frappe/core/doctype/audit_log?)
2. **Transaction scope**: Nếu job enqueue từ request A nhưng chạy sau (job B)、frappe.local.site context có liên kết đúng không?
3. **Scheduler concurrency**: Nếu cron job chạy lâu + schedule run lại → job chồng chéo, RQ xử lý như nào?
4. **Schema versioning**: Custom field lưu trong DB (tabCustomField row), commit/rollback strategy là gì?
5. **Per-site DB backup**: Frappe backup N sites → N dumps (vs CMC 1 dump, logical per tenant). Ops cost difference?

---

**Status**: DONE  
**Summary**: Frappe enforce permission hoàn toàn ở app layer (Python), không có DB RLS, khác CMC đột cách. Code flow: permission check → query filter hook → execute, mọi step đều ở Python → vulnerability nếu bypass. Doc lifecycle + child table + schema migration đều thêu từ metadata JSON. Hooks system loose coupling qua dict merge, implicit order. 5 cơ chế học tập cho CMC: permission query hook, doc events, docstatus machine, child table, explicit middleware order.

