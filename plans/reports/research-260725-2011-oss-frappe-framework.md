# Nghiên cứu sâu: Frappe Framework

**Phạm vi**: Phân tích kiến trúc, legal status, và learnings cho CMC EDU v2  
**Ngày**: 2026-07-25  
**Commit khảo sát**: `c9dbea7` (develop branch, 2026-07-25)  
**Phương pháp**: Clone shallow `frappe/frappe`, verify files trực tiếp, GitHub API

---

## 1. LEGAL / LICENSE

| Tiêu chí | Kết luận |
|---------|---------|
| **License file** | MIT License (1118 bytes, dòng 1-21) |
| **Tác quyền** | "Copyright (c) 2016-2021 Frappe Technologies Pvt. Ltd." |
| **SPDX ID** | `MIT` (xác nhận từ GitHub API) |
| **Metadata** | pyproject.toml không ghi spdx; package.json: `"license": "MIT"` |
| **Trademark** | Tên "Frappe" KHÔNG được ghi rõ là trademark trong LICENSE. Frappe Technologies Pvt Ltd nắm quyền nhưng license không giới hạn use of name riêng biệt. |

**Verify**:
- Đọc file: `/tmp/.../frappe-repo/LICENSE` ✓
- Metadata: `pyproject.toml` line 1-9, `package.json` line 14 ✓
- GitHub license field: `{"spdx_id": "MIT"}` ✓

**Kết quả**: MIT License, code có thể tái sử dụng. Tuy nhiên, **Tên "Frappe" có thể là trademark của Frappe Technologies** — nếu CMC muốn sử dụng code, cần tránh dùng tên "Frappe" cho sản phẩm mà không rõ quyền. **Đây là đọc-hiểu license, không phải tư vấn pháp lý.**

---

## 2. TRẠNG THÁI REPO & QUID MO

| Attribute | Value |
|-----------|-------|
| **Default branch** | `develop` |
| **Current dev version** | 17.0.0-dev (frappe/__init__.py) |
| **Active maintained versions** | v15, v16 (latest: v16.28.0 on 2026-07-21) |
| **Stars** | 10.5K |
| **Forks** | 5.1K |
| **Code size** | ~775 MB (GitHub field) |
| **Python files** | ~1569 |
| **JS/TS files** | ~638 |
| **JSON files** | ~399 |
| **Recent push** | 2026-07-25 11:34:35Z |

**GitHub Repo**: https://github.com/frappe/frappe  
**URL xác nhận**: https://api.github.com/repos/frappe/frappe (đọc 2026-07-25)

---

## 3. KIẾN TRÚC LÕI: METADATA-DRIVEN SYSTEM

### 3.1 DocType — Metadata Schema

**Khái niệm**: DocType là bản thiết kế của một bảng/form. Metadata lưu JSON, được load runtime và sync xuống DB.

**Ví dụ cấu trúc DocType**:
```json
{
  "doctype": "DocType",
  "name": "User",
  "autoname": "Prompt",
  "is_submittable": 0,
  "istable": 0,
  "issingle": 0,
  "module": "Core",
  "fields": [
    {"fieldname": "email", "fieldtype": "Data", "reqd": 1},
    {"fieldname": "roles", "fieldtype": "Table", "options": "Has Role"}
  ],
  "permissions": [
    {"role": "Administrator", "read": 1, "write": 1, "create": 1}
  ]
}
```

**Verify**: `frappe/core/doctype/doctype/doctype.json` (read 100 lines) ✓

### 3.2 Mapping DocType → Database

| Khái niệm | Cơ chế |
|-----------|--------|
| **Tên bảng** | `tab` + DocType name (e.g., `tabUser`, `tabEmployee`) |
| **Primary Key** | `name` (VARCHAR) |
| **Bảng con (child table)** | DocType với `istable: 1` → tạo bảng riêng, FK để parent |
| **Field mapping** | fieldtype JSON → SQL type (Data→VARCHAR, Int→INT, Link→VARCHAR) |
| **Custom field** | Lưu trong `tabCustomField`, apply runtime hoặc via `bench migrate` |
| **Property Setter** | Override field properties sau khi DocType được define |

**Verify**: 
- `frappe/model/meta.py` (dòng 1-80): load metadata, `get_meta()` function ✓
- `frappe/model/sync.py`: schema migration logic, line 1-46 ✓

### 3.3 Schema Migration: bench migrate & Patches

```
Luồng:
1. DocType JSON → frappe/model/sync.py::sync_all()
2. Tạo/alter bảng qua frappe/database/
3. frappe/patches/: Run theo version, patch_handler.py
4. Custom fields applied after sync
```

**Verify**: `frappe/model/sync.py` IMPORTABLE_DOCTYPES list ✓

### 3.4 Mô hình Dữ liệu

```
DocType (metadata)
  ├─ Field (fieldname, fieldtype, reqd, default, ...)
  ├─ Permission (role, permlevel, read, write, submit, ...)
  ├─ Custom Field (field added via UI, stored as DocType metadata)
  └─ Property Setter (override field properties)

Document (instance)
  ├─ Khớp với DocType → lưu DB row
  └─ Child Table (rows: tabItemInInvoice, etc.)
```

---

## 4. HỆ THỐNG HOOK (Extension Points)

### 4.1 Hook Points Chính

| Hook | Loại | Ví dụ | Cơ chế |
|------|------|-------|--------|
| `doc_events` | Dict[DocType, Dict[event, List[method]]] | `{"*": {"on_update": ["path.to.method"]}}` | Gọi method sau save/delete |
| `scheduler_events` | Dict[freq, List[method]] | `{"cron": {"0/5 * * * *": [...]}}` | Cron job, RQ queue |
| `permission_query_conditions` | Dict[DocType, method] | `{"Report": "path.to.method"}` | Filter list/report by user perms |
| `has_permission` | Dict[DocType, method] | `{"Report": "path.to.method"}` | Custom permission check |
| `on_session_creation`, `on_login` | method name | `"frappe.core.doctype.activity_log.feed.login_feed"` | Session lifecycle |
| `override_whitelisted_methods` | method name | Intercept RPC call before execution |
| `override_doctype_class` | method | Return custom Document subclass |
| `notification_config` | method | Return notification definition |
| `jinja` | Dict[category, path/list] | `{"methods": "path"}`, `{"filters": [...]}` | Template extensions |

**Verify**: `frappe/hooks.py` dòng 1-300 ✓, `hooks.md` ✓

### 4.2 Loader Mechanism

```python
# frappe/hooks.py
doc_events = {
    "*": {"on_update": [...]},  # Wildcard: apply to ALL doctypes
    "Invoice": {"before_save": [...]}  # Specific doctype
}

# Loading: frappe/model/document.py
# Khi document.save(), tìm hook trong frappe.get_hooks("doc_events")
# Đăng ký từ tất cả app (frappe/get_installed_apps())
```

**Ưu điểm**: Loose coupling, app không cần patch core  
**Nhược điểm**: Hook chain execution order implicit, có thể có bug cascade

---

## 5. PERMISSION MODEL

### 5.1 Khái niệm Cấp Bậc

| Tầng | Cơ chế | Enforce Tại |
|-----|--------|------------|
| **Role** | User → Role (many-to-many: `tabUserRole`) | App layer |
| **DocType Perm** | Role → DocType permission (read/write/create/delete/submit/cancel/amend/print/email/export/import/share) | App layer |
| **Permission Level (permlevel)** | Field-level: read/write/create per permlevel (0, 1, 2, ...) — role có level N có access level 0..N | App layer |
| **User Permission** | Row-level: User có permission doc "A" không? → FilteredQuery (e.g., Employee WHERE `employee` = current_user) | App layer + Query building |
| **Share** | Document-level: Explicit grant to individual user | App layer (tabDocShare) |
| **SQL Injection via permission_query_conditions** | Còn phụ thuộc app → Query builder safe | App layer |

### 5.2 Permission Checking Flow

```python
# frappe/permissions.py::has_permission()
def has_permission(doctype, ptype="read", doc=None, user=None, ...):
    # 1. Check Administrator → always True
    if user == "Administrator": return True
    
    # 2. Get role permissions từ DocPerm
    role_permissions = get_role_permissions(meta, user)
    perm = role_permissions.get(ptype)
    
    # 3. If doc provided, check user_permission + share
    if doc:
        doc_perm = get_doc_permissions(doc, user, ptype)
        perm = doc_perm.get(ptype)
    
    # 4. Apply permission_query_conditions hook
    if permission_query_conditions hook defined:
        conditions = hook(user, ...)
        # Lọc list/report query
    
    return perm  # Boolean
```

**Verify**: `frappe/permissions.py` dòng 1-200 ✓

### 5.3 **Enforce ở Tầng Nào?**

| Layer | Enforce? |
|-------|----------|
| **Application (Python)** | ✅ YES — check_permission() gọi khi read/write/delete, API endpoints |
| **Database (SQL)** | ❌ NO — Frappe dùng app-layer enforcement, KHÔNG có RLS/Postgres policy |

**Bằng chứng**:
- `frappe/model/document.py` dòng 650-668: `check_permission()` raise PermissionError nếu `has_permission()` return False
- `frappe/api/v2.py` dòng 82-93: `read_doc()` gọi `doc.check_permission("read")`
- `frappe/permissions.py`: không có code gọi SET ROLE, GRANT, hoặc Postgres RLS policy

**So sánh CMC EDU v2**: CMC dùng **Postgres RLS thật ở DB**, Frappe dùng **application-layer validation**. Khác nhau về security posture: RLS ở DB stronger, app-layer dễ có bug lỗi validate.

---

## 6. API SURFACE

### 6.1 REST Endpoints

| Endpoint | HTTP | Ý nghĩa | Auth |
|----------|------|--------|------|
| `/api/v2/document/<doctype>` | GET | Fetch documents (with filters, pagination) | Session + Permission check |
| `/api/v2/document/<doctype>/<name>` | GET | Fetch single document | Session + Permission check |
| `/api/v2/document/<doctype>` | POST | Create document | Session + write perm |
| `/api/v2/document/<doctype>/<name>` | PUT | Update document | Session + write perm |
| `/api/v2/document/<doctype>/<name>` | DELETE | Delete document | Session + delete perm |
| `/api/v2/call/<method>` | POST | RPC — gọi @frappe.whitelist() method | @frappe.whitelist() decorator |
| `/api/v2/method/<method>` | POST | Shorthand for RPC | @frappe.whitelist() |

**Verify**: `frappe/api/v2.py` dòng 1-100 ✓

### 6.2 Authentication

| Scheme | Cơ chế | Dùng khi |
|--------|--------|---------|
| **Session Cookie** | `sid` (server-side session) | Browser login |
| **API Key + Secret** | HTTP Basic (key=user, secret=password) | Programmatic access |
| **OAuth2** | frappe.oauth — support Google, GitHub | WebApp federation |

**Verify**: `frappe/auth.py` dòng 34-100 ✓

### 6.3 Whitelist Mechanism

```python
@frappe.whitelist()  # Exposed via /api/v2/call/<method>
def my_method(param1):
    return result

# Frappe checks:
# 1. Method has @frappe.whitelist() decorator
# 2. Caller is authenticated (has session or API key)
# 3. Method is not blacklisted (e.g., rm -rf /)
```

**Verify**: `frappe/api/v2.py` dòng 46-70, `frappe/client.py` dòng 25-75 ✓

---

## 7. RUNTIME ARCHITECTURE

### 7.1 Multi-Site/Multi-Tenant

```
Thư mục cấu trúc:
sites/
  ├─ site1.example.com/
  │  ├─ site_config.json  (db_host, db_name, db_user, db_password, ...)
  │  └─ (DB data — separate DB per site)
  ├─ site2.example.com/
  │  └─ site_config.json
  └─ common_site_config.json (shared Redis, email, ...)

Cơ chế:
- Frappe app nhận request → parse hostname → init site context
- Load site_config.json → kết nối DB
- frappe.local.site, frappe.local.db (per-thread/request)
```

**Verify**: `frappe/config.py` dòng 14-50 (get_site_config) ✓

### 7.2 Background Jobs & Scheduler

| Thành phần | Stack | Cơ chế |
|-----------|-------|--------|
| **Job Queue** | RQ + Redis | `frappe.enqueue()` → Redis queue → workers consume |
| **Scheduler** | APScheduler hoặc cron | `scheduler_events` hook → execute theo frequency |
| **Realtime** | Socket.IO (python-socketio v5.16.2) | WebSocket push để clients |

**Verify**: `pyproject.toml` line 73 (`rq==2.6.1`), line 96-97 (socket.io) ✓, `frappe/hooks.py` dòng 214-289 (scheduler_events) ✓

### 7.3 Caching & Performance

| Cache | Backend | TTL | Mục đích |
|-------|---------|-----|---------|
| **User** | Redis | Session duration | User data, roles, permissions |
| **DocType Meta** | Redis + Memory | Until DocType update | Schema metadata |
| **Query** | Redis | Configurable | Report, get_list results |
| **HTTP** | Browser/CDN | Via Cache-Control headers | Static assets |

---

## 8. FRONTEND

### 8.1 Tech Stack

```
JavaScript/TypeScript:
  ├─ Vue 3 (^3.3.0) — Desk UI
  ├─ Bootstrap 4.6.2 — Layout
  ├─ Pinia (^2.0.23) — State management
  ├─ Socket.IO client (^4.7.1) — Realtime
  ├─ Quill (2.0.3) — Rich text editor
  └─ FullCalendar (^6.1.11) — Calendar widget
```

**Verify**: `package.json` dòng 80, 39, 66, 78, 70, 24 ✓

### 8.2 Desk UI Architecture

```
Desk (app/home):
  ├─ Frappe UI (Vue components)
  │  ├─ Form (single document)
  │  ├─ List (document list)
  │  ├─ Report (custom queries)
  │  └─ Dashboard (metrics, charts)
  │
  ├─ Form Scripts (client-side):
  │  ├─ frappe.ui.form.FormLayout
  │  ├─ doc.save() → API POST
  │  └─ Hook: frm.on_load, frm.on_change, frm.after_save
  │
  └─ Server Script Extension:
    ├─ Custom endpoint
    ├─ Automation
    └─ Scheduled job
```

**Verify**: `frappe/public/js/frappe/form/` directory ✓, `frappe/core/doctype/server_script/` ✓

### 8.3 Form Script Lifecycle

```javascript
// Client-side (frappe/ui/form)
cur_frm.on_load = function(frm) { ... }
cur_frm.refresh = function(frm) { ... }
frm.set_value("field", value)
frm.save()  // → POST /api/v2/call/frappe.client.set_value

// Server-side (Python hook or Server Script)
frappe.db.set_value("DocType", "name", "field", value)
```

---

## 9. LEARNINGS CHO CMC EDU v2

### 9.1 Metadata-Driven Schema

| Frappe | CMC EDU v2 (Prisma) | Điểm học |
|--------|-------------------|----------|
| DocType = runtime JSON schema | Prisma schema = compile-time type def | Frappe linh động (add field qua UI), CMC type-safe |
| Migrations: patches + sync | Migrations: SQL migrations | Frappe implicit (auto-sync), CMC explicit (git history) |
| Custom field support (via UI) | Không có (schema cố định) | Nếu CMC cần user-defined schema, cần architecture khác |

**Học được**: 
- ✅ Metadata-driven cho phép low-code customization → tốt cho SaaS multi-tenant
- ❌ Điều kiện: cần transaction isolation, version control of schema
- CMC design là **schema-first** (good for monolith), Frappe là **data-first** (good for extensibility)

### 9.2 Hook System vs Middleware/tRPC

| Frappe | CMC (tRPC) | Điểm học |
|--------|-----------|----------|
| `doc_events` hook + DocType | tRPC middleware + Prisma model | Cả hai decouple concerns |
| Hook chain (implicit order) | Middleware chain (explicit pipe) | CMC's explicit order safer |
| `permission_query_conditions` hook | RLS policy + permission check | Frappe app-layer, CMC DB-layer |

**Học được**:
- ✅ Hook system cho phép app ecosystem (third-party extend)
- ⚠️ Ngầm implicit: CMC's explicit middleware chain dễ debug hơn
- Frappe: hệ sinh thái app, CMC: tập trung (monolith)

### 9.3 Permission Model: App vs DB Layer

| Frappe | CMC (Postgres RLS) | Trade-off |
|--------|------------------|-----------|
| **App-layer** `has_permission()` | **DB-layer** `SET ROLE user_rls`, RLS policy | |
| ✅ Flexible: permission logic in code | ✅ Secure: DB enforces even if app bypassed |
| ❌ Performance: check per request | ❌ Rigid: SQL policy hard to update |
| ❌ Bug: developer can ignore check | ✅ Defense-in-depth |

**Học được**:
- ❌ Frappe app-layer risky nếu developer quên `check_permission()`
- ✅ CMC RLS at DB: stronger guarantee
- **Khuyến nghị**: Nếu CMC muốn app-layer flexibility, cần strict code review + automated permission tests
- Frappe dùng Middleware + Hook để decouple, CMC dùng tRPC middleware — cả hai OK, Frappe ecosystem rộng hơn

### 9.4 Whitelist vs Type Safety

| Frappe | CMC (TypeScript) | Trade-off |
|--------|-----------------|-----------|
| `@frappe.whitelist()` decorator | tRPC procedure = autogenerated client | |
| ✅ Simple: mark method public | ✅ Type-safe: client auto-infer types |
| ❌ Runtime string validation | ✅ Compile-time check |
| ❌ No schema validation | ⚠️ Zod/Joi validation |

**Học được**:
- CMC's **type-safe RPC** (tRPC) stronger than Frappe's **decorator-based** (runtime only)
- Frappe whitelist: like Express routes, CMC: like GraphQL typed schema

### 9.5 Multi-Tenant Model

| Frappe | CMC (proprietary) | Điểm học |
|--------|-----------------|----------|
| `sites/` directory per-tenant | Single DB, tenant_id column | |
| Separate DB per site | Shared DB, RLS per tenant | |
| DB credentials in site_config.json | DB credentials centralized | |

**Học được**:
- Frappe: **full isolation** (own DB) → simpler but ops-heavy
- CMC: **logical isolation** (RLS) → efficient but RLS complexity
- **Hybrid possible**: sites/ directory + shared RLS DB

### 9.6 Realtime & Performance

| Frappe | CMC | Điểm học |
|--------|-----|----------|
| Socket.IO (python-socketio v5.16) | Không có (HTTP polling?) | |
| Redis sub/pub for broadcast | ? | |

**Học được**:
- Frappe Socket.IO → biết nên add WebSocket cho CMC
- Hệ sinh thái WebSocket ở Frappe mature (gevent + gunicorn)

---

## 10. NHƯỢC ĐIỂM / RỦI RO

### 10.1 Architectural

| Vấn đề | Ảnh hưởng | Độ nghiêm trọng |
|--------|----------|----------------|
| **App-layer permission** | Nếu developer quên check_permission(), data leak | CRITICAL |
| **Implicit hook order** | Hard to debug cascade hooks | HIGH |
| **DocType JSON sync** | Schema evolution complex, no version control of intermediate states | MEDIUM |
| **Tight coupling** | app/hooks.py + frappe.io framework lock-in | MEDIUM |

### 10.2 Operational

| Vấn đề | Ảnh hưởng | Độ nghiêm trọng |
|--------|----------|----------------|
| **Per-site DB per site** | Backup/restore x N sites, data migration complex | HIGH |
| **RQ + Redis single point of failure** | Job loss nếu Redis down | HIGH |
| **No built-in DB clustering** | HA require external tools | MEDIUM |

### 10.3 Ecosystem

| Vấn đề | Ảnh hưởng | Độ nghiêm trọng |
|--------|----------|----------------|
| **Version pinning strict** | `rq==2.6.1` exact, không flexible → dependency hell | MEDIUM |
| **Custom field UI** | Good for end-users, bad for source control (stored in DB) | LOW |

---

## 11. CLAIM CỦA USER: ĐÚ / SAI / ĐIỀU CHỈNH

> "Frappe là low-code framework"

**KẾT LUẬN**: ✅ ĐÚNG — DocType + UI + hooks = low-code (code-optional cho base CRUD)

---

> "Frappe dùng MIT License nên có thể copy code vào CMC"

**KẾT LUẬN**: ⚠️ ĐIỀU CHỈNH — MIT cho phép reuse code, **nhưng trademark "Frappe" có thể không được phép dùng riêng rẽ**. Verify với legal nếu CMC muốn reuse architecture + tên.

---

> "Frappe enforce permission ở tầng DB (Row-Level Security)"

**KẾT LUẬN**: ❌ SAI — Frappe enforce **ở tầng application** (Python code). Không có Postgres RLS policy. CMC EDU dùng RLS thật ở Postgres, khác biệt quan trọng về security model.

---

> "Frappe hooks giúp mở rộng mà không sửa core"

**KẾT LUẬN**: ✅ ĐÚNG + ĐIỀU CHỈNH — Hooks giúp decouple, nhưng **hook chain order là implicit** (khó debug). CMC's tRPC middleware chain explicit + type-safe, ưu hơn.

---

## 12. RECOMMENDATIONS

### Nên Học

1. **Metadata-driven schema pattern** (DocType)
   - Tốt cho: multi-tenant, low-code UI, user-defined fields
   - Cách làm: Nếu CMC cần "custom field" → xem DocType pattern
   
2. **Hook system architecture** (decoupled extension)
   - Tốt cho: app ecosystem, third-party extension
   - Cách làm: CMC's tRPC middleware tương tự, chỉ cần thêm hook registry

3. **Socket.IO realtime pattern**
   - Tốt cho: live updates (dashboard, form collaboration)
   - Cách làm: Add Socket.IO layer ở CMC backend

### Không Nên Copy

1. **App-layer permission model** 
   - Frappe: vulnerable if check_permission() forgotten
   - CMC: dùng DB-layer RLS, more secure
   
2. **Per-site separate DB**
   - Frappe: operationally complex (N × backup/restore)
   - CMC: logical isolation (RLS), simpler ops

3. **DocType JSON in DB** 
   - Frappe: hard to version control schema
   - CMC: Prisma schema in code, good for git history

---

## 13. CHƯA VERIFY / CÂU HỎI MỞ

| Vấn đề | Lý do chưa verify | Tiếp theo |
|--------|-----------------|-----------|
| **Custom script validation** | Frappe cho user write Python server script — isolation như nào? | Cần audit frappe/core/doctype/server_script/ |
| **Rate limiting strategy** | Có rate limit per user / IP không? | Xem frappe/rate_limiter.py |
| **Realtime sync conflict resolution** | Multi-user edit cùng doc → conflict thế nào? | Cần trace socket.io handlers |
| **Full-text search indexing** | Frappe uses Whoosh (line 32 pyproject.toml) — update index khi nào? | Xem frappe/search/ module |
| **File storage / CDN integration** | File upload flow, S3 support? | Xem frappe/core/doctype/file/ |
| **Horizontal scaling** | Load balance N app servers + shared Redis? Làm sao? | Cần test bench setup |

---

## Phụ lục: File Verify

| File | URL | Branch | Commit |
|------|-----|--------|--------|
| LICENSE | https://raw.githubusercontent.com/frappe/frappe/develop/LICENSE | develop | c9dbea7 |
| pyproject.toml | https://raw.githubusercontent.com/frappe/frappe/develop/pyproject.toml | develop | c9dbea7 |
| package.json | https://raw.githubusercontent.com/frappe/frappe/develop/package.json | develop | c9dbea7 |
| frappe/hooks.py | https://raw.githubusercontent.com/frappe/frappe/develop/frappe/hooks.py | develop | c9dbea7 |
| frappe/permissions.py | https://raw.githubusercontent.com/frappe/frappe/develop/frappe/permissions.py | develop | c9dbea7 |
| frappe/model/meta.py | https://raw.githubusercontent.com/frappe/frappe/develop/frappe/model/meta.py | develop | c9dbea7 |
| frappe/api/v2.py | https://raw.githubusercontent.com/frappe/frappe/develop/frappe/api/v2.py | develop | c9dbea7 |

**GitHub API**: https://api.github.com/repos/frappe/frappe (đọc 2026-07-25)

---

**Status**: DONE  
**Summary**: Frappe là low-code metadata-driven framework với MIT license. Kiến trúc khác CMC ở permission layer (app vs DB), schema management (JSON vs Prisma), architecture (extensible ecosystem vs monolith). Có learnings về hook system, realtime, multi-tenant — nhưng không nên copy code vì architectural mismatch.
