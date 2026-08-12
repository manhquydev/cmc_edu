# CMC EDU — Design System Master

> **LOGIC:** Page file in `pages/[name].md` overrides this Master.  
> **Authority:** Repo tokens + Astryx + `@cmc/ui` beat generic Pro-Max hex/fonts.  
> **Generated/merged:** 2026-08-02 · skills `ak-ui-ux-pro-max` + `ak-ui-styling`  
> **Stack decision:** **Do not install shadcn/Tailwind.** Map styling patterns onto `@cmc/ui` + Astryx (one-door).

---

## Product

| Field | Value |
|-------|--------|
| Product | Facility-scoped education ERP + LMS |
| App surfaces | `apps/admin` (ERP desktop), `apps/lms` (parent/student mobile-first) |
| UI stack | Vite + React · Astryx primitives · `@cmc/ui` composites · CSS tokens |
| Style intent | **Data-dense operations** + **premium flat restraint** (warm canvas) |
| Roles (active) | super_admin, giam_doc_kinh_doanh, giam_doc_dao_tao, sale, giao_vien |

---

## Global visual rules (LOCKED)

### Color — use existing tokens only

| Role | Token | Hex (source of truth) |
|------|-------|------------------------|
| Brand / primary CTA | `--cmc-brand` | `#0071E3` |
| Brand hover | `--cmc-brand-hover` | `#0055C6` |
| Brand muted | `--cmc-brand-muted` | `#E8F1FC` |
| Text | `--cmc-text` | `#1D1D1F` |
| Text muted | `--cmc-text-muted` | `#6E6E73` |
| Canvas | `--cmc-canvas` | `#F5F3EE` (warm soft paper) |
| Surface raised | `--cmc-surface-raised` | `#FFFFFF` |
| Success / warning / danger | `--cmc-success` / `--cmc-warning` / `--cmc-danger` | TL12 |

**Do not** introduce orange CTA (`#F97316`) or slate Pro-Max defaults.  
**One interactive blue.** Status = small dot / badge, not recolored metric numbers.

### Typography

- Font: **Inter** (`--cmc-font-sans`) — keep; do not switch to Fira.
- Metric numeral: `--cmc-fs-metric` (34px), weight 600, near-black.
- Body: 14px / lh 1.65; data cells 13px tabular-nums.

### Spacing & radius

| Token | Value | Use |
|-------|-------|-----|
| space 1–4 | 4 / 8 / 16 / 24 | Base scale |
| pad-card | 24px | Card padding (on-grid) |
| pad-card-x / keyline-x | 20px | Horizontal keyline (all heads/rows) |
| gap-section | 24px | Between panels (soft ops) |
| radius-control / xs | 12px | Inputs, buttons, nav items (soft, not boxy) |
| radius-md / card / raised | 16px | Cards / panels / PageHeader / table shell |
| radius-lg / dialog | 20px | Dialogs / toast / large shells |
| radius-pill | 9999px | Primary shell CTA only |
| row-h / head-h | 48px | List row + panel head strip |
| chip-h-sm / cta-h | 18 / 34 | Badges + pill CTAs |

**Nested harmony:** control 12 ≤ card 16 ≤ dialog 20. Fields use **sunken** fill + warm border; cards use **one raised recipe** (`--cmc-raised-*`). Full structure rules: [`STRUCTURE.md`](./STRUCTURE.md).

### Elevation

- Sticky chrome (PageHeader): `--cmc-shadow-xs`.
- Raised cards at rest: `--cmc-shadow-sm` + hairline.
- Hover metric / float chrome: `--cmc-shadow-md`.
- Modal / toast: `--cmc-shadow-lg`.
- Topbar: blur (`--cmc-blur-nav`), not heavy shadow.
- Rows: **never** cast shadow — sunken hover only.

### Motion

- `--cmc-transition`: 160ms ease.
- Micro 150–300ms max; honor `prefers-reduced-motion`.
- Pressed feedback: background / opacity / subtle scale — **no layout shift**.

### Icons

- `LineIcon` monochrome outline only — never emoji as structure.

---

## Density tiers (Pro-Max data-dense × CMC premium)

| Tier | Class / context | Padding row | Use |
|------|-----------------|-------------|-----|
| Comfortable | dashboard, empty panels | pad-card 24px | Cockpit, marketing empty |
| Compact | list/table/ops | row py ~8–10px | Phiếu thu, users, classes, grading queue |
| Touch | attendance, punch | min 44×44 targets | Teacher tablet flows |

Implement via CSS modifiers later: `.console-wrap--compact`, `DataTable density="compact"`.

---

## Interaction contract (Pro-Max CRITICAL)

Every commit click:

```text
pressed → pending (disable + spinner, >300ms)
       → success (toast 3–5s OR inline “Đã lưu”)
       → error (near control + recovery)
```

| Rule | CMC action |
|------|------------|
| No silent success | Add **Toast** (missing today) |
| Confirm irreversible | Use `ConfirmDialog` — extend coverage |
| Empty + action | Use `EmptyState` with `action` prop (component exists; underused) |
| 1 primary CTA / context | Topbar: Ghi danh primary; **Đăng xuất ghost/secondary** |
| Touch ≥44px | Attendance pattern is reference |
| Focus-visible | Keep Astryx theme ring |
| Destructive separate | Confirm `actionVariant=destructive`; logout not primary blue |

### Confirmation taxonomy

| Kind | Pattern |
|------|---------|
| High-frequency toggle | No confirm (attendance status) |
| Server commit | Loading + success feedback |
| Money / provision / publish | ConfirmDialog + consequences + “không hoàn tác” |
| Dirty leave | Leave-guard dialog |
| Logout | Secondary control; optional light confirm |

---

## Component map: shadcn patterns → `@cmc/ui` (ui-styling skill)

Do **not** `npx shadcn add`. Map concepts:

| shadcn / styling skill | CMC implementation |
|------------------------|--------------------|
| Button variants (default/secondary/ghost/destructive) | Astryx `Button` via `@cmc/ui` |
| AlertDialog | `ConfirmDialog` (Astryx AlertDialog) |
| Dialog | Astryx `Dialog` + `DialogHeader` |
| Toast / sonner | **TO BUILD** `ToastProvider` + `toast()` in `@cmc/ui` |
| Alert | Astryx `Banner` |
| Skeleton | Astryx `Skeleton` |
| Empty | `@cmc/ui` `EmptyState` (title, description, action, icon) |
| Card | Premium `.ck-mc` / Panel / Astryx Card |
| Table | `DataTable` |
| Badge | Astryx `Badge` + `StatusBadge` |
| Tabs | `CmcTabs` |
| Form labels | Astryx Field + `TextField` / `PasswordInput` |
| Page layout | `ConsoleNavbar` + `ListPage` / `DetailPage` / `FormPage` |
| Master-detail | `MasterDetail` |
| Filter bar | `FilterBar` |

### Missing primitives to add (styling + UX priority)

1. **Toast** — success/error/info, aria-live polite, auto-dismiss 3–5s  
2. **EmptyState** usage standard — always pass `action` when next step exists  
3. **useActionMutation** (admin) — loading + toast + optional confirm  
4. **formatRole / statusLabel** — product language  
5. Density compact for DataTable / ListPage  

---

## Layout system

```text
.o_web_client
├── ConsoleNavbar (46px)
└── main.console-main
    └── Content (canvas) — ListPage / FormPage / cockpit grid
```

- Metric strip: `repeat(auto-fit, minmax(236px, 1fr))` but **max 4 columns**; single metric **max-width ~320–360px**, not full bleed empty.
- Body cockpit: `1.4fr 1fr` ≥1040px.
- List: PageHeader + FilterBar + DataTable; sticky actions on FormPage.

---

## Copy / i18n UI

| Bad (dev) | Good |
|-----------|------|
| `giao_vien` | Giáo viên |
| `giam_doc_dao_tao` | Giám đốc đào tạo |
| `active` | Đang hoạt động |
| `Email · Required` | Email (bắt buộc) |
| Silent save | Toast “Đã lưu điểm danh” |

### Chuẩn: không lộ định danh nội bộ ra chuỗi hiển thị người dùng

Chuỗi hiển thị (`title`, `subtitle`, `description`, `label`, `message`, `hint`)
**không** được chứa: tên component/thư viện nội bộ (`SettingsShell`,
`FullCalendar`), tên transport/nhà cung cấp hạ tầng (`ConsoleEmailTransport`),
mã enum/permission kỹ thuật (`super_admin`, `\bCRUD\b`), tên hàm/API nội bộ
(`testAppointment.`, `finance.refundCreate`), hoặc thuật ngữ kỹ thuật rò rỉ
(`\bEntity\b`, `API … chưa khả dụng`). Diễn đạt lại bằng ngôn ngữ nghiệp vụ
tiếng Việt mà người dùng cuối hiểu được.

**Ngoại lệ có chủ đích:** mã quyền hiển thị trong màn 403 chẩn đoán (permission
code không bí mật — xem `permission-gate.tsx` comment) và nhãn form đã đúng
chuẩn ngành (vd `auth identity` nếu vẫn giữ sau quyết định — xem dưới).

### Giới hạn lint (đọc trước khi coi lint là thước đo hoàn thành)

Rule ESLint `no-restricted-syntax` (chuẩn hoá tại Phase 5 của
`plans/260805-1153-chuan-hoa-tu-ngu-ui-frontend/`) guard chuẩn trên, nhưng
**có 2 giới hạn** — đọc cả hai trước khi diễn giải "lint xanh" là "không còn rò rỉ":

1. **Giới hạn dạng AST** — rule chỉ phủ `Literal` bên trong `JSXAttribute`
   (`title`/`subtitle`/`description`/`label`/`message`/`hint`). Rule **không**
   phủ `JSXText` (text con giữa thẻ), template literal, hay object literal
   (vd giá trị enum, cấu hình dạng `{ label: 'X' }` không nằm trực tiếp trong
   JSXAttribute).
2. **Giới hạn danh sách token (đóng)** — pattern chỉ khớp một danh sách token
   cụ thể, không phải regex tổng quát bắt mọi định danh nội bộ. Thuật ngữ
   ngoài danh sách (vd `Net`, `SoD`, `server-side`, `O1–O5`) **không được
   guard**, kể cả khi xuất hiện đúng vị trí `JSXAttribute > Literal`. Thêm
   token mới khi phát hiện lớp rò rỉ mới — đừng coi danh sách hiện tại là đủ.
   Token `auth identity` bị **gỡ khỏi pattern có chủ đích** (Phase 4 của
   `plans/260805-1153-chuan-hoa-tu-ngu-ui-frontend/`, Open question 1 hết hạn
   không có trả lời ⇒ áp default): chỗ khớp duy nhất là nhãn form
   `admin/users.tsx:346` (`"User ID (auth identity)"`), và non-goal "không đụng
   nhãn form" của plan đó áp dụng ở đây — nhãn giữ nguyên, không sửa.

⇒ **Lint là guard chống tái phát trong phạm vi trên, KHÔNG phải thước đo hoàn
thành.** Đo hoàn thành bằng checklist theo từng chuỗi cụ thể (xem plan liên
quan), không bằng exit code của `pnpm lint`.

---

## Accessibility

**SoT:** [`A11Y-BASELINE.md`](./A11Y-BASELINE.md) — operator keyboard paths, composite role inventory, honest gaps, re-check commands.

- Status is **partial** until a human keyboard pass is logged (never “WCAG certified” from docs alone).
- Role smoke: `node scripts/check-ui-a11y-roles.mjs` (no axe CI in this baseline).
- Quick intent (detail lives in A11Y-BASELINE): focus-visible · labeled controls · toast live region · modal trap · keyboard list/bulk paths.

---

## Anti-patterns (banned)

- Silent mutation success  
- Two equal primary blues in topbar  
- Blank empty without CTA  
- Emoji nav icons  
- Recolored metric numbers for status  
- Heavy card borders/shadows at rest  
- Installing shadcn alongside Astryx “for one toast”  
- Pro-Max default palette overwriting tokens  

---

## Page overrides

| Page | File |
|------|------|
| Teacher / role cockpit | `pages/cockpit.md` |
| List ops (receipts, users…) | `pages/list-ops.md` |
| Attendance touch | `pages/attendance.md` |

---

## Implementation order

1. Toast + ghost logout + role labels  
2. EmptyState actions on cockpit / grading / empty lists  
3. Confirm matrix for publish/close/reject  
4. Compact density lists  
5. Leave-guard dirty attendance  

---

## Sources

- `packages/ui/src/tokens.css`, `console.css (admin) / apps/lms/src/app.css (LMS)`, `index.ts`  
- `ak-ui-ux-pro-max` design-system (style: data-dense) — colors/fonts **overridden** by CMC  
- `ak-ui-styling` component catalog — **mapped**, not installed  
- Prior audits: `plans/260802-research-ui-ux-product-eval/reports/*`  
