# Khung giao diện chung CMC EDU Admin

> Mục tiêu: **một ngôn ngữ layout** cho mọi màn — chỉ khác nội dung nghiệp vụ.  
> Stack: `@cmc/ui` + Astryx · **không** shadcn/Tailwind.  
> Skills: `ak-ui-ux-pro-max` (ops density) + `ak-ui-styling` (map → tokens CMC).

---

## 1. Ba tầng chrome

```text
┌─────────────────────────────────────────────────────────┐
│ AppFrame + SideNav + Topbar          ← shell toàn app   │
├─────────────────────────────────────────────────────────┤
│ tpl-wrap (canvas ấm, padding thống nhất)                │
│   ┌─ Page template (1 trong 4 archetype) ─────────────┐ │
│   │  DashboardPage | ListPage | DetailPage | FormPage │ │
│   │  + atoms: PageHeader, Panel, MetricCard, …        │ │
│   └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

| Tầng | Component | CSS | Ghi chú |
|------|-----------|-----|---------|
| Shell | `AppFrame`, `SideNav` | `.sh-*` | Nav, brand, topbar actions |
| Page frame | 4 templates dưới | `.tpl-*` | Cùng canvas/padding |
| Atoms | MetricCard, Panel, DataTable… | `.ck-*` | Không page-local layout |

**Quy tắc:** màn mới **bắt buộc** dùng 1 trong 4 template. Cấm invent layout full-page mới.

---

## 2. Bốn archetype trang

### A. `DashboardPage` — `/cockpit` (và dashboard tương lai)

```text
[ Title + subtitle ]
[ Shortcut chips  — cùng style mọi role ]
[ Metrics grid    — 0–4 MetricCard ]
[ Primary 1.4fr | Secondary 1fr ]  ≥1040px
```

| Slot | Ý nghĩa |
|------|---------|
| `shortcuts` | Lối tắt 3–5 thao tác hay dùng theo role |
| `metrics` | KPI glanceable |
| `primary` | Hàng đợi việc (Panel + TaskRow / EmptyState) |
| `secondary` | Context: pipeline / lịch / gợi ý |

> **Luật `subtitle` (giữ slot, siết điều kiện điền — mọi archetype có subtitle):**
> `subtitle` hợp lệ khi mang thông tin **không suy ra được** từ title + nội dung
> đang hiển thị: ràng buộc (giới hạn kết quả), hệ quả nghiệp vụ, hoặc danh tính
> phiên (greeting cockpit). Diễn đạt lại title ⇒ bỏ.
> Ví dụ hợp lệ: greeting cockpit (`pages/cockpit.md:7`) — mang danh tính phiên,
> không suy ra được từ title "Tổng quan".

### B. `ListPage` — danh sách ops

```text
[ ControlBar
    PageHeader: title · subtitle · actions
    FilterBar optional
    footer?: ListPagination ]
[ DataTable | board | EmptyState ]
```

`density="ops"` → `.tpl-wrap--ops` (padding chặt hơn).  
**Grammar đầy đủ:** [VIEW-GRAMMAR.md](./VIEW-GRAMMAR.md).

> **Luật `subtitle`:** cùng luật siết ở §A trên — mang thông tin không suy ra
> được từ title; diễn đạt lại title ⇒ bỏ.

### C. `DetailPage` — chi tiết (record / settings / ops)

**Cùng frame `DetailPage`**, nhưng **độ sâu recipe theo tier** — không claim “một depth cho mọi màn”.

#### Detail tiers (authority)

| Tier | When | Required chrome | Optional | Product examples (2026-08) |
|------|------|-----------------|----------|----------------------------|
| **full** | Money / CRM entity with lifecycle | PageHeader breadcrumbs · **EntityHeader** (single h1) · **HighlightStrip** · **WorkflowStatusbar** | tabs · StatActions · timeline | `receipt-detail` · `opportunity-detail` |
| **standard** | Master-data entity | PageHeader breadcrumbs · **EntityHeader** · **HighlightStrip** | tabs · sections | `student-detail` · `class-detail` |
| **settings** | Config domains (rail) | PageHeader **title OK** · **SettingsShell** | guide rail · sections | `shift-config` · `network-ip` · `salary-tiers` |
| **thin** | Ops/self-service detail without domain avatar identity | PageHeader · DetailPage body | panels · tables | `payroll` · `my-hr` |

**Rules**

- Entity domain routes → **full** or **standard** (EntityHeader owns h1; no PageHeader `title=`).  
- Settings hybrid → **settings** (PageHeader title allowed; **no** EntityHeader required).  
- **thin** is honest residual — promote to standard/full only when product identity exists; do not fake EntityHeader.  
- Measure tiers via `pnpm check:ui-frames` (`detailTiers` in JSON).

```text
[ PageHeader — breadcrumbs; title only if settings/thin ]
[ EntityHeader? — full/standard only · single h1 ]
[ summary? — HighlightStrip · WorkflowStatusbar (tier-dependent) ]
[ SettingsShell? — settings tier ]
[ CmcTabs? | body — SectionBlock / tables ]
```

| Slot | Component | full | standard | settings | thin |
|------|-----------|:----:|:--------:|:--------:|:----:|
| header | `PageHeader` | crumbs | crumbs | title+crumbs | title+crumbs |
| entity | `EntityHeader` | ✓ | ✓ | — | — |
| highlight | `HighlightStrip` | ✓ | ✓ | — | — |
| workflow | `WorkflowStatusbar` | ✓ | — | — | — |
| settings | `SettingsShell` | — | — | ✓ | — |
| body | sections / tables | ✓ | ✓ | main pane | ✓ |

**Quy tắc đồng bộ:** keyline-x, raised family, 1 primary CTA, StatusBadge soft.  
**Map Odoo form → CMC:** [VIEW-GRAMMAR.md](./VIEW-GRAMMAR.md) §4.

### D. `FormPage` — form dài / wizard bước

```text
[ PageHeader ]
[ fields ]
[ ResultPanel optional ]
[ sticky actions bar ]
```

---

## 3. Cockpit theo role (cùng frame, khác data)

| Role | Shortcuts | Metrics | Primary queue | Secondary |
|------|-----------|---------|---------------|-----------|
| **Giáo viên** | Điểm danh, Chấm bài, Nhật ký, Chấm công | Bài chờ chấm | Chấm bài | Lịch dạy hôm nay |
| **Sale** | CRM, Xếp lớp, Chấm công, Đổi thưởng | Sẵn sàng ghi danh | Ghi danh O4 | Pipeline O1–O5 |
| **GĐKD / GĐĐT / SA** | Phiếu thu, CRM, Lớp, Nhân sự | Phiếu chờ + vượt ngưỡng (+ bài chờ nếu GĐĐT) | Duyệt phiếu | Pipeline |
| **Khác** | Chấm công, Của tôi | — | Empty generic | Lịch nếu `class.read` |

Greeting: `Xin chào · {formatRoles}` — không raw role key.

---

## 4. Nguyên tắc đồng bộ (Pro-Max + styling map)

1. **Một primary CTA** / ngữ cảnh topbar (Ghi danh); logout ghost.  
2. **Empty = title + description + action** (`EmptyState`).  
3. **Commit → toast**; irreversible → `ConfirmDialog`.  
4. Icon **LineIcon** monochrome.  
5. Metric value **near-black**; attention = chấm nhỏ.  
6. Cards flat trên canvas; shadow chỉ hover/modal.  
7. Không cài design system thứ hai.

### shadcn → CMC (nhắc lại)

| shadcn pattern | CMC |
|----------------|-----|
| Card dashboard | MetricCard / Panel |
| Button variants | Astryx Button + `.sh-cta*` |
| Empty | EmptyState |
| Layout shell | AppFrame + DashboardPage/ListPage… |

---

## 5. File code

| Surface | Path |
|---------|------|
| Dashboard frame | `packages/ui/src/components/dashboard-page.tsx` |
| Shortcut chip | `packages/ui/src/components/shortcut-chip.tsx` |
| List/Detail/Form | `list-page.tsx`, `detail-page.tsx`, `form-page.tsx` |
| Styles | `packages/ui/src/premium.css` (`.tpl-*`) |
| Cockpit roles | `apps/admin/src/pages/cockpit.tsx` |

---

## 6. Checklist màn mới

- [ ] Chọn đúng 1 archetype (Dashboard / List / Detail / Form)  
- [ ] Không thêm `<style>` layout full-page trong page  
- [ ] Header dùng `PageHeader` (list/detail/form) hoặc slot title Dashboard  
- [ ] Empty có CTA khi có next step  
- [ ] Role labels qua `formatRole`  
- [ ] Typecheck + test template nếu đổi `@cmc/ui`  

---

## 7. Lộ trình tiếp

| Phase | Việc |
|-------|------|
| Done | DashboardPage + ShortcutChip + cockpit refactor |
| Done | ListPage `density="ops"` on high-traffic admin lists; toast beyond teaching; reject/enroll confirm; attendance `?classBatch=` deep-link |
| Next | PageHeader soft-card class; session-today agenda API (optional) |
| Later | Migrate mọi list/detail còn custom padding; LMS frame riêng (mobile) |
