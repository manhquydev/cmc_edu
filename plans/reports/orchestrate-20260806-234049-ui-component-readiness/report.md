# UI component readiness — coverage · sync · design-for-reuse

**Run:** orchestrate-20260806-234049-ui-component-readiness  
**Tools:** GitNexus query · `check-ui-frames` · static census · explore agents (package readiness + admin adoption)  
**Date:** 2026-08-06  
**Scope:** ERP **admin** design3 (Odoo language); LMS intentionally out of Odoo chrome

---

## 1. Executive snapshot (thực tế)

| Trục | Trạng thái | Số đo |
|------|------------|------:|
| **Shell admin** | Sẵn sàng áp dụng toàn admin | 100% post-login OdooNavbar + `odoo.css` |
| **Page frames (module screens)** | Phủ cao | ~**100%** màn module dùng ≥1 frame; **41/55** page TSX (~75%) nếu tính dialogs/panels/auth |
| **List chrome (FilterBar)** | Trung bình–cao | **12/23** ListPage (~**52%**) |
| **EntityHeader / Statusbar** | Có chuẩn, phủ chọn lọc | EH **4** detail; WS **2** (receipt + opp) |
| **Component package sẵn sàng reuse** | Frames READY; Search OS PARTIAL | Xem §3 |
| **Đồng bộ class language** | Dual path | ~46 composite `ck-*` vs core frames `o-*` |
| **CI proof design3** | Chưa đóng | unit/static ✓ · ui-e2e / acceptance re-measure open |

**Kết luận một dòng:**  
Có **hệ khung dùng chung đủ** để áp toàn ERP admin (List/Detail/Form/Dashboard/Settings + shell). **Đồng bộ sâu** (FilterBar, EntityHeader, class `ck→o`, Search OS) và **cổng CI** chưa đủ để claim “production design parity”.

---

## 2. Phủ giao diện (coverage)

### 2.1 Shell & CSS

| App | CSS | Shell |
|-----|-----|-------|
| `apps/admin` | `@cmc/ui/odoo.css` only | `.o_web_client` + **OdooNavbar** |
| `apps/lms` | `@cmc/ui/premium.css` | **không** Odoo chrome / frames ERP |

### 2.2 Frame adoption (live census)

| Frame | # page files (admin) |
|-------|---------------------:|
| ListPage | 23 |
| DetailPage | 10 (+ mixed) |
| FormPage | ~6–11 usages |
| DashboardPage | 2 (cockpit, revenue) |
| SettingsShell | 3 (network-ip, shift-config, salary-tiers) |
| PageHeader | 41 |
| DataTable | 24 |
| FilterBar | 19 files / **12** on ListPage |

**Gate:** `pnpm check:ui-frames --strict` → **bulkListsOk ≥5: true**; detail tiers classified full/standard/settings/thin.

### 2.3 ListPage × FilterBar

| HAS FilterBar | NO FilterBar (API bare / hybrid / stub) |
|---------------|----------------------------------------|
| audit-log, pipeline, aftersale, post-sale-meeting, gifts, rewards, receipt-list, reconciliation, kpi, parents, students, schedule | facilities, users, classes, courses, leaderboard, class-placement, refund, payroll, attendance, exercises, grading |

FilterBar **không** thiếu vì quên frame — nhiều list **API chỉ page/pageSize** (D13).

### 2.4 Detail grammar

| Pattern | Surfaces |
|---------|----------|
| EntityHeader + WorkflowStatusbar (**full**) | opportunity-detail, receipt-detail |
| EntityHeader only (**standard**) | student-detail, class-detail |
| Settings / thin | network-ip, shift-config, salary-tiers, my-hr, payroll, session-detail |

---

## 3. Thành phần chung — design readiness (package)

| Layer | Components | Status |
|-------|------------|--------|
| **Shell** | OdooNavbar | **READY** |
| **Page frames** | ListPage, DetailPage, FormPage, DashboardPage, SettingsShell | **READY** (Form dirty caveat) |
| **Control panel** | ControlBar, PageHeader, FilterBar, DateField, ListPagination, BulkActionBar | CP **READY**; FilterBar **PARTIAL** (lite, not Search OS) |
| **Record chrome** | EntityHeader, WorkflowStatusbar, SectionBlock, KeyValueList… | **READY** / **READY_WITH_CAVEAT** (ck-*) |
| **Kanban** | KanbanBoard/Column/Card | **READY** |
| **Float** | Toast, CommandPalette, ConfirmDialog | **READY_WITH_CAVEAT** (unscoped ck float) |
| **LMS shell** | AppFrame, SideNav | **LMS_ONLY** |
| **Search OS** | facets, GroupBy, Favorites, SearchChrome | **MISSING / parked** |
| **Astryx primitives** | barrel `@cmc/ui` | **READY** field layer |

**An toàn áp project-wide admin ngay:**  
frames + OdooNavbar + ControlBar/FilterBar(lite) + DataTable + EntityHeader/Statusbar + Kanban + toast/cmd.

**Cần API/product trước:**  
SearchChrome, shared ViewSwitcher, m2o async, x2many lines, FilterBar trên users/facilities/courses/classes (cần search params API).

---

## 4. Đồng bộ thành phần (sync)

| Rủi ro | Hiện trạng | Ảnh hưởng |
|--------|------------|-----------|
| **Dual CSS `ck-*` mirror vs `o-*`** | Frames `o-*`; ~46 file composite còn `ck-*`; admin mirror trong `odoo.css` | Drift nếu sửa premium-only |
| **FilterBar hasClear** | Default clear=all; domain mặc định cần `hasClear:false` (pipeline done) | Clear “gãy” domain |
| **Sheet dual-layer** | Detail/Form own sheet; sticky statusbar md+ | Double-card EntityHeader cấm |
| **Dialog-first CRUD** | users, facilities, courses, CRM actions | Không FormPage — OK product nhưng không đồng nhất “form grammar” |
| **View switcher** | page-local CRM/teaching | Chưa component dùng chung |
| **Barrel CALLS graph** | GitNexus under-counts React consumers | Census file > impact() |

**Đồng bộ đã cải thiện phiên gần đây:** D1 Parents ControlBar · D2 gifts · D3 pipeline · D4 audit date range.

---

## 5. Ma trận “áp vị trí tương ứng”

| Vị trí ERP | Component chuẩn | Áp dụng |
|------------|-----------------|---------|
| Shell staff | OdooNavbar + o_web_client | Toàn admin |
| Danh sách | ListPage → ControlBar → FilterBar? → DataTable → footer | Hầu hết; FilterBar khi có domain |
| Chi tiết entity | DetailPage + sheet + EntityHeader ± Statusbar | receipt/opp/student/class; session gap EH |
| Form wizard | FormPage sticky actions | teaching + receipt-create + attendance |
| Settings | SettingsShell | 3 màn |
| Dashboard | DashboardPage | cockpit + revenue |
| Pipeline board | ListPage body + KanbanBoard | CRM (+ schedule) |
| LMS | primitives + premium | **Không** map Odoo frames |

---

## 6. Validation / proof

| Gate | Status |
|------|--------|
| Unit odoo layer + shell tests | Proven |
| `check:ui-frames --strict` | Pass thresholds |
| Full ui-e2e design3 | **OPEN** |
| acceptance:report 38 flows post-shell | **OPEN** |
| Human visual smoke | **OPEN** |

---

## 7. Hành động ưu tiên (design readiness)

1. **Đóng CI proof** design3 (ui-e2e + acceptance) — không thêm component mới.  
2. **FilterBar** chỉ khi API có filter; không bịa client filter (D13).  
3. **Dual-CSS discipline** / rename dần high-traffic `ck-*`.  
4. **session-detail** EntityHeader nếu muốn chuẩn standard tier.  
5. **Park SearchChrome** đến khi multi-module demand + URL contract.

---

## 8. Agent artifacts

| Agent | Role |
|-------|------|
| explore `019fd7f3-47e5-…fff8e` | Package design readiness catalog |
| explore `019fd7f3-47e5-…5edc2` | Admin module adoption census |
| GitNexus | query frames; impact under-count noted |
| Static | check-ui-frames, rg census |

---

**Arbiter (coordinator):**  
**PASS** for “có hệ component chung sẵn sàng áp ERP admin”.  
**FAIL** for “đồng bộ 100% + Odoo Search OS + CI-proven production design”.

