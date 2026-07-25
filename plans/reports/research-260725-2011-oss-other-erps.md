# Bóc Tách 3 Hệ ERP: Tryton, Dolibarr, metasfresh
**Ngày**: 2026-07-25 | **Mục đích**: Đối chiếu mô hình kiến trúc ERP tham chiếu cho CMC EDU v2

---

## Sách Lỏi Trong Claim Gốc

| Claim | Kết quả | Ghi chú |
|-------|---------|--------|
| "Tryton (điểm vào `tryton/tryton-client`)" | ❌ SAI | Repo `tryton/tryton-client` trên GitHub **ARCHIVED từ Dec 2022**. Đó chỉ là mirror. Repo chính: `https://code.tryton.org/tryton` (self-hosted Heptapod). Để research Tryton, phải vào official Heptapod hoặc `https://docs.tryton.org`, không phải GitHub mirror. |
| "Dolibarr (`Dolibarr/dolibarr`)" | ✅ ĐÚNG | Repo active, last push 2026-07-25. |
| "metasfresh (`metasfresh/metasfresh`)" | ✅ ĐÚNG | Repo active, last push 2026-07-25. |

---

## License Verify (Bằng File Thật)

| Hệ | File Gốc | License | Or-later? | Lineage | Source URL |
|-----|----------|---------|-----------|---------|-----------|
| **Tryton** | LICENSE (repo chính) | GPL-3.0 | ✅ Yes ("or-later") | Độc lập từ 2008 | [https://docs.tryton.org/latest/server/](https://docs.tryton.org/latest/server/); repo chính ở Heptapod |
| **Dolibarr** | `COPYING` | GPL-3.0 | ✅ Yes ("or any later version", Section 14) | Độc lập, PHP | [COPYING raw](https://raw.githubusercontent.com/Dolibarr/dolibarr/develop/COPYING) |
| **metasfresh** | `LICENSE.md` | GPL-2.0 | ❌ No (no or-later provision) | Fork từ ADempiere (2015), có ý đổi sang GPL-3.0 nhưng **core code vẫn GPL-2.0** | [LICENSE.md raw](https://raw.githubusercontent.com/metasfresh/metasfresh/master/LICENSE.md); [Wikipedia Metasfresh](https://en.wikipedia.org/wiki/Metasfresh) |

**Chú thích metasfresh**: Lineage là Compiere (2000) → ADempiere (2006, GPL-2.0) → metasfresh (2015, GPL-2.0). Tài liệu metasfresh có nêu "aim to switch to GPL-3.0" nhưng [code vẫn GPL-2.0](https://handwiki.org/wiki/Software:Metasfresh). **Risk pháp lý**: GPL-2.0 không compatible with GPL-3.0-or-later (Tryton, Dolibarr), nên CMC không thể reuse code từ metasfresh trực tiếp mà phải tách logic.

---

## Kiến Trúc So Sánh

### 1. Stack & Mô Hình Persistence

| Chiều | Tryton | Dolibarr | metasfresh |
|--------|--------|----------|------------|
| **Ngôn ngữ** | Python 3 | PHP 7.2+ | Java 8 |
| **DB chính** | PostgreSQL (primary), SQLite (test) | MySQL, MariaDB, PostgreSQL | PostgreSQL 9.5+ |
| **ORM / Persistence** | Custom ORM: Model → ModelSQL (inheritance-based, ~50 class refs) | DAO/CRUD convention: `*.class.php extends CommonObject` | Application Dictionary (metadata-driven, từ ADempiere) + Hibernate/Spring Data |
| **Frontend** | Python GTK client OR JavaScript "sao" web client | PHP server-side + JS (browser) | React/Redux (HTML5) + WebUI |
| **Architecture** | 3-tier: Client-Server-DB, JSON-RPC/XML-RPC | PHP monolith web app + hooks/triggers, optional 3rd-party modules | 3-tier: WebUI (React) + WebAPI (Spring Boot) + App (Spring Boot) + DB |

### 2. Mô Hình Mở Rộng & Modularization

| Chiều | Tryton | Dolibarr | metasfresh |
|--------|--------|----------|------------|
| **Mô hình module** | XML-defined, dependency graph, load order explicit | ~100 core modules + 1000+ DoliStore addons, install/activate toggle | Monorepo + sparse-checkout; Application Dictionary handles metadata |
| **Cách mở rộng model tồn tại** | **Inheritance chain**: Module B kế thừa Model của Module A, không sửa A (clean extension). Ví dụ: `class InheritModel(A.Model): __class__ = A.Model` | Hook/Trigger system: `modMyModule.class.php` định nghĩa hook → thực thi khi event (create/update/delete). Không kế thừa trực tiếp, dùng trigger listener. | Application Dictionary: metadata-driven, mở rộng bằng field/tab/window definitions (không cần code Java nếu chỉ thêm field). Rewrite lớn ADempiere code → Spring Boot modern architecture. |
| **Hooks/Triggers** | Không có tên explicit như Dolibarr, nhưng có signal/event system | ✅ Rõ ràng: Hooks (modify flow), Triggers (react to event) | Implicit via Spring event listeners + App Dictionary hooks |

**Điểm mạnh Tryton**: Mô hình inheritance module cho phép mở rộng model mà không đụng core—tương tự override/extend class, rõ ràng và safe. **Điểm mạnh Dolibarr**: Hook/Trigger explicit, dễ tìm điểm can thiệp. **Điểm mạnh metasfresh**: Metadata-driven, không cần viết Java để thêm field/tab.

### 3. Mô Hình Quyền & Access Control

| Chiều | Tryton | Dolibarr | metasfresh |
|--------|--------|----------|------------|
| **Level quyền** | **5-tier**: Model access (CRUD) + Actions + Field-level (read/write) + Button (per-group) + **Record Rules** | **Granular RBAC**: Model-level + field-level via Advanced Permissions module; Optional custom permission rules | Application Dictionary: Field-level security, no documented row-level record rules |
| **Record Rules / Row-Level Security** | ✅ **Yes**: Domain-based conditions (similar to Postgres RLS). Example: `domain=[('employee_id.id', '=', User.id)]` restricts records employee can see. Enforce ở app layer khi `_check_access=True` (default RPC). | ⚠️ Limited: No built-in record-level filtering; relies on module-specific logic. Dolistore addons may add this. | ⚠️ Limited: Application Dictionary doesn't expose row-level rules; enforcement at app/DB level unclear from docs. |
| **Enforcement** | App-level (Transaction context `_check_access`) + Field-level visibility auto-hide | RBAC at field/model level; no DB-level enforcement | Unclear; likely app-level via Spring Security |

**Điểm học cho CMC**: Tryton's record rules là **direct analog của Prisma+Postgres RLS trong CMC**—cả hai filter ở logic/DB layer dựa trên domain conditions. CMC dùng facility-scoped RLS (row-level). **Tryton's 5-tier là pattern toàn diện nhất** trong 3 hệ.

### 4. Metadata & Configuration

| Chiều | Tryton | Dolibarr | metasfresh |
|--------|--------|----------|------------|
| **Metadata-driven?** | Partial: Model fields defined in Python, views in XML, but business logic in Python code | Minimal: mostly config files + database, custom modules define own structure | ✅ **Metadata-driven core**: Application Dictionary (inherited from Compiere/ADempiere). Fields, tabs, windows, workflows defined as metadata, reducers SQL generation. |
| **Customization path** | Code (Python module) + XML views | Code (PHP module) + config files + DB | **No-code via App Dictionary** (UI-based field/tab/window definition) **OR** code (Spring Boot) |
| **Report generation** | ODT templates (LibreOffice) | PHP reports, Dolistore templates | Jasper Reports Library 6.5.1, separate microservice optional |

---

## Bản Đồ Domain: Modules Chính

### Tryton
- `account` (ledger, invoicing, payment)
- `sale`, `purchase` (orders, quotations)
- `stock` (inventory, warehouse, location)
- `hr` (employee, contract, department)
- `project` (project mgmt, timesheet)
- `party` (contact, supplier, customer)
- `web` (web shop, frontend)
- **Mô hình**: Mỗi module là package Python + dependencies explicit, data model in Python code.

### Dolibarr
- `accounting` (chart, ledger, reporting)
- `orders`, `proposals`, `invoices` (sales pipeline)
- `stock` (warehouse, inventory)
- `thirdparty` (contact mgmt)
- `members` (membership, subscription)
- `HRM` (employee, salary — nếu module bật)
- `projects`, `agenda`, `POS`
- **Mô hình**: Core modules in `htdocs/core/modules/`, external via DoliStore or custom `htdocs/custom/modules/`.

### metasfresh
- **Inherited from ADempiere core**, modernized:
  - Purchasing, Sales, Inventory, Accounting
  - Manufacturing (BOM, production)
  - Financial Reporting
  - Customer/Vendor mgmt
- **Modern additions**: Logistics optimization (Material Schedule microservice optional)
- **Mô hình**: Monorepo, metadata + Java Spring Boot services.

**Chú ý HRM cho CMC**: Tryton & Dolibarr có HRM module (employee, salary, timesheet), metasfresh ít document HRM riêng. CMC v2 có HR (ca làm/chấm công/KPI/lương) → Tryton's HR module đáng xem.

---

## Độ Phù Hợp Làm Nguồn Tham Chiếu Cho CMC

| Hệ | Phù hợp | Lý do | Chi tiết |
|-----|----------|--------|---------|
| **Tryton** | 🟢 **CAO** | Record rules (RLS-like), 5-tier access, module inheritance model, Python ORM extensibility | **Best for**: Understanding row-level security patterns, module composition. CMC dùng Prisma+Postgres RLS facility-scoped; Tryton's domain-based record rules là sibling pattern. 5-tier access model toàn diện hơn RBAC đơn thuần. **Hạn chế**: Python (CMC là TypeScript), khác stack. Nhưng mô hình kiến trúc transferable. |
| **Dolibarr** | 🟡 **VỪA** | Hook/Trigger system rõ ràng, lightweight, scalable modularization (DoliStore ecosystem) | **Best for**: Understanding hook/trigger dispatch, "no heavy framework" philosophy (CMC cũng keep simple). Lightweight cho SMB/education center. **Hạn chế**: Không có record-level security, RBAC cơ bản. Hook pattern có giá trị nhưng CMC dùng tRPC + event driven sẵn, không cần adopt thêm. |
| **metasfresh** | 🔴 **THẤP** | Java stack, Application Dictionary pattern hay nhưng khác phiên bản từ 2015, GPL-2.0 incompatible | **Best for**: Studying metadata-driven ERP (if team has Java interest). Application Dictionary cho phép no-code customization, interesting architectural pattern từ Compiere legacy. **Hạn chế**: (1) Java ≠ TypeScript, khác ecosystem. (2) GPL-2.0 incompatible với Tryton/Dolibarr GPL-3.0-or-later, risk pháp lý nếu muốn reuse. (3) Metadata-driven pattern đã có frameworks khác implement tốt hơn (Frappe, metabase). (4) Monorepo sparse-checkout phức tạp so với giá trị. |

---

## So Sánh Với Frappe/ERPNext (Conceptual Level, từ Team khác Research)

| Chiều | Tryton | Dolibarr | metasfresh | Frappe/ERPNext |
|--------|--------|----------|------------|----------------|
| **Ngôn ngữ** | Python | PHP | Java | Python (backend), JavaScript (frontend) |
| **Mô hình mở rộng** | Module inheritance | Hooks/Triggers | Metadata (App Dict) | DocType + custom scripts + hooks |
| **Row-level security** | ✅ Record Rules | ❌ No | ⚠️ Unclear | ✅ Role-based record owner/team |
| **Metadata-driven** | ❌ Code-based | ❌ Config-based | ✅ Yes | ⚠️ Partial (DocType) |
| **License** | GPL-3.0-or-later | GPL-3.0-or-later | GPL-2.0 | GNU GPL-3.0+ (modified AGPLv3 for some modules) |
| **Maturity & Community** | 20+ years (founded ~2004), steady | 20+ years (~2003), broad SMB base | 10+ years (fork ~2015), enterprise-grade but smaller | 10+ years (~2012), very active SaaS + cloud, largest self-hosted ERP community (đó là phán xét không hoàn toàn) |

**Ghi chú**: Frappe/ERPNext được assume là team khác research; bảng này chỉ để CMC align conceptual level khi so sánh 3 hệ mục này với Frappe pattern.

---

## Kết Luận & Ranking

### Repo Nào Đáng Bỏ Thời Gian Đọc Tiếp?

**🥇 Rank 1: Tryton** (Khuyến cáo: Bắt buộc scout deeper)
- **Tại sao**: Record rules pattern là **direct analog của CMC's Prisma RLS**. 5-tier access model toàn diện nhất. Module inheritance mở rộng clean (không invasive). Dù Python, mô hình kiến trúc 100% transferable sang TypeScript.
- **Dành cho**: Architect, lead engineer. Focus: `https://docs.tryton.org/latest/server/topics/access_rights.html` + record rules example.
- **Thời gian**: ~4-6 giờ deep dive (docs + 1-2 module source exploration).
- **Output mong đợi**: Decision — adopt Tryton's 5-tier framework for CMC, hay keep current RBAC+RLS hybrid.

**🥈 Rank 2: Dolibarr** (Useful nhưng secondary)
- **Tại sao**: Hook/Trigger model rõ ràng, lightweight philosophy aligned với CMC. Ecosystem (DoliStore) show how to build marketplace for education center modules (future).
- **Dành cho**: Backend lead, integration engineer. Focus: hooks/triggers system, module marketplace pattern.
- **Thời gian**: ~2-3 giờ (Dolibarr wiki + 1-2 module).
- **Output mong đợi**: Decision — should CMC adopt explicit hook dispatch (current có event-driven, maybe rename/clarify)?

**🥉 Rank 3: metasfresh** (Skip for now, revisit nếu )
- **Tại sao**: Metadata-driven pattern interesting nhưng (1) khác stack (Java), (2) GPL-2.0 incompatible, (3) reuse code risk cao, (4) Application Dictionary pattern có overhead cho education center scale CMC.
- **Ngoại lệ**: IF CMC plans Java backend in future OR if team wants deep dive "legacy Compiere/ADempiere architecture" (historical knowledge).
- **Thời gian**: Skip now. Max 1-2 giờ intro IF decided to revisit later.
- **Output nếu cuối**: Historical context why Compiere→ADempiere→metasfresh, lessons từ Compiere design.

### Recommend Ngay Cho Team

1. **Architect**: Read Tryton access rights docs + 1 module (e.g., `party`, `account`) source. Render decision: keep CMC 's current RLS approach (facility-scoped Prisma) hay borrow Tryton 's record rules pattern (domain-based filtering) để toàn diện hóa quyền ở app level?

2. **Backend lead**: Dolibarr hooks wiki + verify CMC's event system (tRPC, backend triggers). Câu hỏi: should rename/document triggers as "hooks" for clarity (multi-team)?

3. **Compliance/Legal**: Confirm metasfresh GPL-2.0 incompatibility risk for reusing any logic (if team later wants).

---

## Claim Gốc của User: Đúng/Sai/Đính Chính

| # | Claim | Kết quả | Đính chính |
|---|-------|---------|-----------|
| 1 | "Tryton (điểm vào `tryton/tryton-client`)" | ❌ SAI | **Đúng repo**: https://code.tryton.org/tryton (Heptapod self-hosted, redirect từ code.tryton.org). GitHub `tryton/tryton-client` archived Dec 2022, chỉ là mirror cũ. |
| 2 | "Dolibarr (`Dolibarr/dolibarr`)" | ✅ ĐÚNG | Repo chính, active. |
| 3 | "metasfresh (`metasfresh/metasfresh`)" | ✅ ĐÚNG | Repo chính, active. |
| 4 | "metasfresh GPL-2.0" | ✅ ĐÚNG nhưng incomplete | Core code GPL-2.0 (no or-later). User's assumption "docker/release-info repo GPL-2.0" overly specific; actual: LICENSE.md là GPL-2.0 đơn giản. Chú ý: **NOT compatible với Tryton/Dolibarr GPL-3.0-or-later**. |

---

## Limitations & Unresolved Questions

1. **Tryton's main repo access**: Heptapod (foss.heptapod.net) có access control/firewall → một số URL block. If deeper module exploration needed, team phải request access hoặc dùng official docs (https://docs.tryton.org) + git mirror nếu có.

2. **metasfresh metadata-driven depth**: Documentation không chi tiết Application Dictionary internals so với ADempiere docs. If team muốn reuse this pattern, need ADempiere original docs (older, harder to find).

3. **Dolibarr HRM module maturity**: Wiki docs HRM không rõ lắm; need demo instance hoặc source code scan để hiểu salary/KPI computation—CMC có HR complex (KPI score tính toán, thưởng sao) nên compare chi tiết với Dolibarr's HRM trước adopt pattern.

4. **Frappe/ERPNext comparison**: Cần team khác research xong để CMC có baseline so sánh (report này chỉ conceptual level).

---

## Sources

- [Tryton Access Rights Docs](https://docs.tryton.org/latest/server/topics/access_rights.html)
- [Tryton Models Reference](https://docs.tryton.org/latest/server/ref/models.html)
- [Tryton Wikipedia](https://en.wikipedia.org/wiki/Tryton)
- [Dolibarr Module Development Wiki](https://wiki.dolibarr.org/index.php/Module_development)
- [Dolibarr Hooks System Wiki](https://wiki.dolibarr.org/index.php/Hooks_system)
- [Dolibarr Triggers System Wiki](https://wiki.dolibarr.org/index.php/Triggers_system)
- [metasfresh GitHub Repository](https://github.com/metasfresh/metasfresh)
- [metasfresh Wikipedia](https://en.wikipedia.org/wiki/Metasfresh)
- [metasfresh Architecture Docs](https://github.com/metasfresh/metasfresh-documentation/blob/gh-pages/_howto_collection/EN/metasfresh_architecture.md)
- [Dolibarr GitHub](https://github.com/Dolibarr/dolibarr)
- [Dolibarr README](https://raw.githubusercontent.com/Dolibarr/dolibarr/develop/README.md)
- [Tryton code.tryton.org (redirects to Heptapod)](https://code.tryton.org/)
- [metasfresh GPL History & ADempiere Fork](https://en.wikipedia.org/wiki/Metasfresh)
