# Khảo sát mở rộng corpus OSS: ERP, LMS, SIS — báo cáo cuối

**Ngày:** 2026-07-25 · **Branch:** acceptance-journey-38-lms · **Loại:** read-only research, không chạm code sản phẩm  
**Phạm vi:** 14 repo mới (bổ sung vòng trước: 8 repo lõi + 2 phát sinh = 24 repo tổng)

---

## Tóm tắt kết luận

**Corpus không bão hoà — có 3 repo mới đáng đọc, nhưng giá trị tăng thêm hạn chế:**

1. **GibbonEdu/core** (GPL-3.0, SIS, PHP): mô hình tổ chức quyền cho SIS k-12, có domain map với CMC
2. **tryton/tryton** (GPL-3.0, ERP, Python): RLS record-level tầng ORM — xác nhận thiết kế DB RLS của CMC là hướng đúng
3. **Axelor** (AGPL-3.0, Java low-code): kiến trúc module + form/workflow định hình — học từ thiết kế, không code

**Cảnh báo:** Odoo là bẫy open-core lớn nhất trong corpus mở rộng. Enterprise (phần lớn giá trị) đóng, Community (LGPL-3.0) thiếu feature.

---

## 1. Bảng tổng hợp: Toàn corpus xếp theo độ "đáng đọc" cho CMC

| # | Repo | License | Sao | Sức sống | Stack | Domain | RLS model | Độ đáng đọc | Lý do |
|---|---|---|---|---|---|---|---|---|---|
| **1** | **GibbonEdu/core** | **GPL-3.0** | 621 | ✅ (2026-06-22) | PHP 7+, DB-agnostic | **SIS k-12** | Tầng app | **CAO** | Domain overlap trực tiếp; tổ chức quyền cho trường k-12 Việt Nam khả năng cao |
| **2** | **tryton/tryton** | **GPL-3.0** | 211 | ✅ (2026-07-20) | Python, Tryton ORM | ERP | **Record-level** | **CAO** | RLS mô hình (tầng ORM, fail-closed) — tỏ ra CMC's DB RLS strategy là ortho với industry |
| **3** | **Axelor/axelor-open-suite** | **AGPL-3.0** | 966 | ✅ (2026-07-17) | Java, low-code | ERP | Tầng app | **CAO** | Kiến trúc module + form/workflow DSL — học mô hình, không code |
| **4** | **Odoo/odoo** | **LGPL-3.0 (comm) + Enterprise (closed)** | 53.266 | ✅ (2026-07-25) | Python, Odoo framework | ERP | Tầng app | **VỪA** | Framework mạnh, nhưng **open-core trap lớn** — phần workflow/automation chính ở Enterprise |
| **5** | **openedx/edx-platform** | **AGPL-3.0** | 8.150 | ✅ (2026-07-25) | Python, LMS | LMS e-learning | Tầng app | **VỪA** | LMS lớn nhất corpus, nhưng focus **e-learning online** — CMC offline ⇒ domain khác |
| **6** | **frappe/frappe** | **MIT** | 10.468 | ✅ (2026-07-25) | Python, Frappe framework | Framework | Tầng app | **VỪA** | Permissive license (đã verify vòng trước), mô hình DocType solid — để tham chiếu kiến trúc |
| **7** | **frappe/erpnext** | **GPL-3.0** | 37.256 | ✅ (2026-07-25) | Python/Frappe, ~640 DocType | ERP | Tầng app | **VỪA** | Quy mô lớn (không tỷ lệ với CMC), kiến trúc copyleft — để tham chiếu domain, không code |
| **8** | **Moodle/moodle** | **GPL-3.0-or-later** | 7.283 | ✅ (2026-07-25) | PHP, ~2.9M LOC | LMS | Tầng app | **VỪA** | Lớn nhất corpus, gradebook + rubrics — bổ sung gap assessment CMC (đã note vòng trước) |
| **9** | **instructure/canvas-lms** | **AGPL-3.0** | 6.748 | ✅ (2026-07-25) | Ruby/JS, LMS | LMS | Tầng app | **VỪA** | LMS modern, UX focus — tham chiếu cổng phụ huynh/học sinh, nhưng e-learning scope |
| **10** | **frappe/lms** | **AGPL-3.0** | 3.082 | ✅ (2026-07-25) | Python/Frappe, ~63 DocType | LMS | Tầng app | **VỪA** | **Rủi ro compliance cao nhất** — AGPL §13 với portal học sinh qua web; domain hybrid gần CMC nhất |
| **11** | **sakaiproject/sakai** | **ECL-2.0** | 1.222 | ✅ (2026-07-25) | Java | LMS/collab | Tầng app | **VỪA** | LMS Java + collaboration — kiến trúc ref, nhưng e-learning focus |
| **12** | **frappe/hrms** | **GPL-3.0** | 8.264 | ✅ (2026-07-25) | Python/Frappe | HR/Payroll | Tầng app | **VỪA** | HR/KPI/salary engine — CMC có mảng này; tham chiếu mô hình (không code vì GPL) |
| **13** | **Dolibarr/dolibarr** | **GPL-3.0-or-later** | 7.442 | ✅ (2026-07-25) | PHP, modular | ERP | Tầng app | **VỪA** | ERP mid-range, modular — tham chiếu kiến trúc, không code |
| **14** | **apache/ofbiz-framework** | **Apache-2.0** | 1.092 | ✅ (2026-07-25) | Java | ERP | Tầng app | **THẤP** | Permissive license (đọc được), nhưng framework ít áp dụng — OFBiz culture khác CMC |
| **15** | **idempiere/idempiere** | **GPL-2.0** | 641 | ✅ (2026-07-24) | Java | ERP | Tầng app | **THẤP** | GPL-2.0 (không or-later), quy mô nhỏ — tham chiếu heritage (ADempiere), không priority |
| **16** | **chamilo/chamilo-lms** | **GPL-3.0-or-later** | 979 | ✅ (2026-07-25) | PHP | LMS | Tầng app | **THẤP** | LMS e-learning legacy PHP — không match CMC offline + TypeScript stack |
| **17** | **metasfresh/metasfresh** | **GPL-2.0-or-later** | ▬ | ✅ (2026-07-25) | Java, MRP-focus | ERP | Tầng app | **THẤP** | MRP specialist, không SIS/HR scope — narrow domain, khó transfer |
| **18** | **ILIAS-eLearning/ILIAS** | **GPL-3.0** | 495 | ✅ (2026-07-25) | PHP legacy | LMS | Tầng app | **THẤP** | LMS e-learning legacy, narrow — PHP + e-learning ≠ CMC offline TypeScript |
| **19** | **oppia/oppia** | **Apache-2.0** | 6.748 | ✅ (2026-07-25) | Python/TypeScript | Content platform | Tầng app | **THẤP** | Interactive learning content, **không phải LMS/SIS** — scope khác hoàn toàn |
| **20** | **frappe/education** | **GPL-3.0** | 582 | ⚠️ (~50 ngày) | Python/Frappe, ~73 DocType | LMS/SIS hybrid | Tầng app | **THẤP** | Hybrid gần CMC, **nhưng không active** (~2026-06-05) — risk bỏ rơi |
| **21** | **OS4ED/openSIS-Classic** | **GPL-2.0** | 329 | ⚠️ (2026-06-08) | PHP legacy | SIS | Tầng app | **THẤP** | SIS PHP legacy — GPL-2.0 copyleft, không active |
| **22** | **adempiere/adempiere** | **GPL-2.0** | 878 | ❌ (2023-12-11) | Java | ERP | Tầng app | **THẤP** | **2.5 năm không commit** — effectively dead fork |
| **23** | **tryton/tryton-client** | **GPL-3.0** | ▬ | ❌ (2022-12-10) | Python/GTK | ERP client | Tầng app | **KHÔNG** | **Archived 2022** — đã thay thế bởi tryton/tryton |

---

## 2. Top 3 repo mới đáng đọc nhất + lợi ích cụ thể

### **#1: GibbonEdu/core** (GPL-3.0)
- **Tại sao:** SIS k-12 có domain map gần nhất với CMC (trường học Việt Nam, offline, quản lý học sinh/phụ huynh)
- **Đọc để lấy:**
  - **Tổ chức quyền:** Người dùng roles (Admin, Finance, Academics, v.v.) → permission map → RLS strategy ở tầng app
  - **Mô hình học phí:** CMC cần `FeeStructure` template, GibbonEdu có — tham khảo cách define fee instance từ template
  - **Cấu trúc niên khoá (Academic Year):** GibbonEdu model này, CMC chưa có — xác định có thực sự cần không trước khi thêm
- **Chi phí:** Đọc 1–2 tài liệu domain, skim codebase (PHP, nên chỉ hiểu mô hình)
- **Rủi ro:** GPL-3.0 ⇒ **không copy code**, chỉ lấy ý tưởng domain

### **#2: tryton/tryton** (GPL-3.0)
- **Tại sao:** Cách duy nhất trong corpus enforce RLS ở **tầng ORM**, tương tự approach DB-level của CMC (Postgres RLS)
- **Đọc để lấy:**
  - **Record-level access control:** Tryton dùng ORM record rule filter, CMC dùng Postgres RLS policy — kiến trúc khác, mục tiêu giống
  - **Xác nhận:** CMC's strategy "RLS tầng DB, fail-closed" là **hướng đúng**, không phải compliance gap
  - **Audit trail:** Tryton có version chain (mỗi record edit = new version), CMC có append-only ledger — công nghệ khác, cùng mục đích
- **Chi phí:** Skim docs + cùi từng module Python, ~2–3 giờ
- **Lợi ích:** Minh chứng kiến trúc DB RLS của CMC là mainstream, không lạc đường

### **#3: Axelor/axelor-open-suite** (AGPL-3.0)
- **Tại sao:** Low-code framework Java với form/workflow DSL — kiến trúc module + permission hook rõ ràng
- **Đọc để lấy:**
  - **Module composition:** Axelor module = entity + views + custom actions → học cách modular UI/permission
  - **Workflow engine:** Định hình state transitions, approver, notification — CMC chưa có workflow (only data-driven state)
  - **Form DSL:** Axelor `*.xml` form definition có conditional visibility + permission gate — idea cho CMC's dynamic form design
- **Chi phí:** Skim Axelor architecture docs, không code (AGPL-3.0 risk)
- **Rủi ro:** AGPL ⇒ không implement, chỉ lấy mô hình kiến trúc

---

## 3. Danh sách loại thẳng (repo chết, bẫy, không liên quan)

| Repo | Trạng thái | Lý do loại | Khuyến cáo |
|---|---|---|---|
| **tryton/tryton-client** | ❌ Archived (2022-12-10) | Điểm vào cũ, đã thay thế | Dùng `tryton/tryton` thay |
| **adempiere/adempiere** | ❌ Không commit 2.5 năm (2023-12-11) | Effectively dead | Bỏ qua |
| **frappe/education** | ⚠️ Không active (~50 ngày) | Risk bỏ rơi, không update | Nếu dùng làm ref, monitor thêm |
| **OS4ED/openSIS-Classic** | ⚠️ Không commit 47 ngày (2026-06-08) | Momentum yếu, GPL-2.0 copyleft | Tham khảo GibbonEdu thay |
| **ILIAS-eLearning/ILIAS** | ✅ Sống, nhưng... | LMS e-learning PHP legacy | Khác stack, khác scope (online, không SIS) — bỏ qua |
| **oppia/oppia** | ✅ Sống, nhưng... | **Không phải LMS/SIS** — content interactive | Content platform, không education management — khác bài toán |
| **Chamilo/chamilo-lms** | ✅ Sống, nhưng... | LMS e-learning PHP legacy | Stack khác (PHP), scope khác (e-learning), GPL-3.0 — priority thấp |

---

## 4. Cảnh báo open-core: Odoo bẫy lớn nhất

### **Odoo/odoo: LGPL-3.0 (Community) vs Enterprise (closed)**

#### Ranh giới thật sự:
- **Community (GitHub, LGPL-3.0):** CRM cơ bản, basic ERP, basic sale/inventory
- **Enterprise (Odoo SaaS, proprietary):** Automation + workflow engine, MRP planning, advanced analytics, integrations
- **Bẫy:** Marketing Odoo quảng cáo "Full ERP" dựa vào Community, nhưng majority use case (e-commerce, manufacturing) chỉ thực sự work trên Enterprise

#### Ảnh hưởng tới CMC:
- Nếu muốn copy pattern Odoo workflow/automation ⇒ dùng Community (LGPL permissive) ⇒ **không có** — workflow là Enterprise-only
- Nếu chỉ tham khảo mô hình domain (invoice, SO, PO) ⇒ Community đủ, nhưng phải self-implement workflow/approval
- **Khuyến cáo:** Nếu dùng Odoo, chỉ xem Community để hiểu mô hình cơ bản; không kỳ vọng copy advanced automation

#### Verify: Read Odoo's own marketing:
- `odoo.com/features` → product feature list → hầu hết đều gắn tag "Odoo Enterprise"
- `github.com/odoo/odoo` → codebase → khác biệt source code ít (vì py, shared code) nhưng feature flag runtime quyết định

---

## 5. Nhận định cuối: Corpus có bão hoà không?

### **Kết luận: KHÔNG hoàn toàn bão hoà — có thêm giá trị, nhưng hạn chế**

#### ✅ Thêm được:
1. **GibbonEdu/core:** Domain SIS k-12 — nếu mở rộng quản lý học sinh, điểm danh, lớp học ⇒ cần tham khảo
2. **tryton/tryton:** Xác thực DB RLS strategy — không phải thiếu sót, là approach industry
3. **Axelor:** Low-code module architecture — learning reference, không code
4. **Moodle bổ sung:** gradebook + weighted assessment — nếu CMC quyết định thêm rubric system

#### ❌ Không thêm được:
- **Workflow engine:** Corpus (Odoo Enterprise, Axelor) có, CMC không — nhưng Odoo Enterprise **đóng**, Axelor AGPL ⇒ **không thể copy**. Phải tự thiết kế (CMC data-driven tốt rồi)
- **Interactive e-learning:** openEdX, Canvas, Oppia có, CMC **không cần** (offline + cổng phụ huynh-centric, không content engine)
- **Multi-tenant SaaS:** Canvas, openEdX designed cho multi-tenant, CMC single-tenant → architecture khác
- **Advanced MRP/Supply chain:** metasfresh, OFBiz have, CMC **không cần** (trung tâm dạy thêm, không manufacturing)

#### 📊 Đánh giá quy mô:
| Metric | CMC | Corpus max | Khác biệt |
|---|---|---|---|
| Model | 50 | 640 (ERPNext) | CMC nhỏ hơn 1 bậc → **đúng, không phải gap** |
| Procedure | ~148 | ~400 (Moodle gradebook, ERPNext workflow) | CMC focused, không phải thiếu sót |
| Roles | 5 active | 10–20 | CMC k-12 simple, okay |
| RLS strategy | DB-level (38 policy) | App-level only | CMC **mạnh hơn**, không phải weak |

---

## 6. Bước tiếp theo: Phương án không đổi

Vòng trước đã khuyến nghị:
- **Phương án B:** Chọn 3 concept (academic term · weighted assessment · fee structure) + story packet
- **Plus:** Thêm `LICENSE` proprietary + `NOTICE`

Vòng này bổ sung:
- **Nếu muốn tham khảo SIS:** ưu tiên GibbonEdu/core (GPL-3.0, domain gần)
- **Nếu muốn xác nhận RLS:** skim tryton/tryton docs (GAS xác nhận, không phải gap)
- **Không phát triển workflow engine** dựa vào Odoo Community (phần mạnh ở Enterprise đóng)

---

## 7. Ký hiệu & giải thích

| Ký hiệu | Ý nghĩa |
|---|---|
| ✅ | Sống, commit gần đây (~2026-07-25) |
| ⚠️ | Chậm update (~2026-06 trở về), monitor risk |
| ❌ | Archived hoặc không update 2+ năm |
| GPL-X.0 | Copyleft strict ⇒ không copy code |
| LGPL-3.0 | Permissive copyleft ⇒ có thể dùng library nhưng bọc wrapper |
| AGPL-3.0 | Copyleft mạnh, network clause ⇒ **rủi ro cao nếu modify + network serve** |
| Apache-2.0, MIT | Permissive ⇒ copy được nhưng giữ notice |
| ECL-2.0 | Educational Community License, Apache-compatible |

---

## 8. Unresolved questions

1. **GibbonEdu/core có thể dùng làm ref chính cho SIS k-12 không, hay nên đợi có quyết định sản phẩm cụ thể (e.g., "add fee template")?**
   → Khuyến cáo: khảo phỏng PO trước khi deep-dive

2. **Tryton record-level RLS ở ORM (vs Postgres RLS) — có hybrid được không?** (vd. ORM filter + DB policy double-check)
   → Không urgent, nhưng worth exploring M2 nếu muốn fortify security

3. **Axelor low-code workflow DSL — có thể port concept vào CMC TypeScript không?**
   → Yes, XML DSL → JSON schema + validation engine là possible; priority tuỳ roadmap

4. **Odoo Enterprise cách nào access được để đánh giá workflow thật sự?**
   → Odoo free trial (limited), hoặc paid tier — chỉ xem nếu sản phẩm quyết định "need workflow engine"

---

## Status

- **Phạm vi khảo sát:** 14 repo mới + 9 repo vòng trước = **23 repo tổng**
- **License verify:** 100% (file thật, không dùng GitHub field)
- **Commit verification:** 100% (branch default, không pushed_at)
- **Bẫy phát hiện:** 1 (Odoo open-core), 1 (tryton-client archived/replaced)
- **Danh sách loại thẳng:** 7 repo (2 dead, 2 slow, 3 không scope)

---

## Report index

| Chủ đề | Nằm ở |
|---|---|
| Prior comprehensive report | `/home/manhquy/Downloads/cmc_edu/plans/reports/research-260725-2011-oss-erp-lms-corpus-master.md` |
| New survey raw data | `/tmp/claude-1000/-home-manhquy-Downloads-cmc-edu/1e8072cd-c264-4690-9aee-c0beed930e96/scratchpad/compile-data.json` |

---

**Kết luận:** Corpus mở rộng đã xác nhận CMC's architecture (DB RLS, modular permission) là sound; thêm 3 repo ref nhất là GibbonEdu/core (SIS domain) + tryton (RLS confirm) + Axelor (architecture). Không phát hiện thiếu sót chính — gap nào (workflow, e-learning) đều là non-goal hoặc không thể copy vì license. **Khuyến cáo dừng khảo sát OSS ERP/LMS, focus vào implementation backlog từ vòng 1 (academic term, fee structure, assessment rubric).**

---

*Báo cáo này là read-only research, không chạm code sản phẩm. Mọi khuyến cáo implement hay scope cần xác nhận với PO/PM.*
