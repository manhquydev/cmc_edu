# Tài liệu 12 — Design System & Đặc tả UI (v2)

> Ngôn ngữ hình ảnh + thư viện component để build UI nhất quán. Kế thừa & chuẩn hoá bản
> `docs/design-system.md` đã có (Apple-minimal + ERP density, Astryx beta, brand `#0071E3`), bổ sung
> trạng thái component, pattern trang, semantics màu, accessibility.
> Áp cùng nguyên tắc UX (TL2) và routing (TL6).

> **Superseded for `apps/admin` (rolled out, 2026-08-06).** Admin uses the Odoo
> backend UI language — see [docs/design-system-odoo.md](./design-system-odoo.md).
> This TL12 document remains authoritative for **LMS** (student/parent) and for
> shared base tokens (`--cmc-*`, Inter, accent `#0071E3`, light-only). Do not
> apply TL12 premium shell/page chrome (`AppFrame`/`SideNav`/`premium.css`) to
> admin work.

---

## 1. Triết lý & Tầng Premium Design-Language (v2)

Apple-minimalism thích nghi cho mật độ ERP: **một xanh tương tác duy nhất** (`#0071E3`), bề mặt
phẳng, whitespace rộng nhưng bảng vẫn đọc được, typography mang phân cấp. CTA vuông (`radius=xs`
4px), thứ cấp = text link.

**Tầng Premium Design-Language (2026-07 added):** Dựa trên Apple + Notion references, `@cmc/ui` 
giờ ship một tầng design-language đơn vị cao mức trên Astryx base — **LOCKED: light mode only, 
monochrome outline icons (no emoji), one accent #0071E3, warm canvas #F7F6F3, restraint + whitespace + 
typography**. Bao gồm: typed `tokens.premium` object, shared `LineIcon` monochrome set (Feather outline), 
composites (`MetricCard`, `Panel`, `TaskRow`, `FunnelBar`), app shell (`AppFrame` + `SideNav`), 
page templates (`ListPage`, `DetailPage`, `FormPage`). Imported via single `@cmc/ui/premium.css` 
at app root (`--sh-*`, `--tpl-*` CSS classes). Admin shell + cockpit + finance cockpit migrated onto 
these components; LMS shares base tokens + icons.

## 2. Tokens (nguồn: `packages/ui/src/tokens.css`)

**Màu thương hiệu:** `--cmc-brand #0071E3` · `--cmc-brand-hover #0055C6` · `--cmc-brand-muted
#E8F1FC` · `--cmc-brand-ink #003D99`.
**Text:** `--cmc-text #1D1D1F` · `--cmc-text-2 #3C3C43` · `--cmc-text-muted #6E6E73` ·
`--cmc-text-faint #AEAEB2`.
**Typography:** header cột UPPERCASE 11px · dữ liệu 13px · heading theo thang Astryx (CSS custom properties `--cmc-text` scale).
**Bo góc:** `xs` 4px cho nút/thẻ. **Bóng:** border mảnh + `xs` shadow, không đổ bóng trang trí.

## 3. ⚠️ Semantics màu trạng thái (sửa lỗi UX audit #6)

Màu là **ngôn ngữ** — dùng sai màu = nói sai. Chuẩn v2:

| Ý nghĩa | Token | KHÔNG dùng cho |
|---|---|---|
| Tương tác / "bạn đang ở đây" | brand blue | ❌ KHÔNG dùng DANGER (đỏ) cho "stage hiện tại" |
| Thành công / đã duyệt | green | |
| Cảnh báo / chờ | amber | |
| Lỗi / từ chối / nguy hiểm | red (DANGER) | ❌ chỉ cho lỗi thật, không cho trạng thái trung tính |
| Trung tính / nháp | grey | |

→ CRM stage hiện tại: **brand blue "bạn ở đây"**, không phải đỏ báo động.

## 4. Thư viện component (primitive — kế thừa F3, mở rộng)

| Component | Vai trò | Trạng thái bắt buộc |
|---|---|---|
| `PageHeader` | Tiêu đề + hành động chính | — |
| `DataTable` | Bảng list | loading (skeleton) · empty · error · row-selected |
| `EmptyState` | Rỗng có hướng dẫn | (thay bảng trống) |
| `StatCard` | Số liệu tổng | loading · trend up/down |
| `StatusBadge` | Trạng thái | map đúng semantics §3 |
| `FilterBar` | Lọc/sort/tìm | phản ánh vào URL query (TL6) |
| `MasterDetail` | List ↔ chi tiết | intercepting route (TL6 §5) |
| `Tabs` (detail) | Tab trang chi tiết | tab = sub-route, không state ẩn |
| `ConfirmDialog` | Xác nhận hành động | dùng cho hành động nghịch được; hành động tiền cần nêu hệ quả |
| `ResultPanel` | **Hiển thị kết quả tự động hoá** | "Đã ghi danh + tạo TK + gửi email" (TL2 §2) |

**Trạng thái chung mọi component:** default · hover · active/pressed · focus (ring brand) ·
disabled · loading · error · empty. Thiếu bất kỳ trạng thái nào = component chưa xong.

## 4.5. Premium Design-Language Layer Components (`@cmc/ui` 2026-07)

Tầng mới `@cmc/ui` promote từ admin cockpit pilot. Toàn bộ DUMB (props-only, không tRPC/session), 
styled **một lần** bằng `@cmc/ui/premium.css` ở app root. Các component này LOCKED vào nguyên tắc:

**Principles:** Light mode only · Monochrome outline icons (Feather set via `LineIcon` component, 
no emoji) · One accent (`#0071E3`) · Warm canvas (`#F7F6F3`) · Notion-subtle elevation · Inter 
type scale · radius pill (12px) · blur-nav sticky · near-black numerals.

**Shared icon language:** `LineIcon` component + `IconName` union — replaced all emoji across shell 
+ content layers. Monochrome outline (no fill), pairs seamlessly with text. **Icon set now includes 
5 premium keys** (globe, clock, trophy, gift, star) added 2026-07 alongside existing Feather base. 
All icons forward `data-icon` attribute for testing/analytics.

**Composites (render props-only → CSS `.premium-` classes):**
- `MetricCard`: số liệu dạng card (metric + trend + label) — dùng trong dashboard. Hỗ trợ `Tone` 
  type (neutral/positive/warning).
- `Panel`: container căn bản với elevation + padding, thay box mặc định. Dùng khi cần surface raised.
- `TaskRow`: item list compacted (icon + title + meta + action); render React-Router `Link` (cần 
  Router ancestor).
- `FunnelBar`: horizontal bar chart một dòng (width/color/label) — cho funnel/conversion views.

**App frame (light-mode admin shell):**
- `AppFrame` + `SideNav`: bao frame toàn trang — sticky blurred topbar (pill CTA, centered breadcrumb), 
  left sidebar tree nav (active module + nav entries), main content slot.
  - Props: `activeModuleId` (current selected module), `NavModule[]` (tree structure), 
    `onNavigate` callback (router-free — caller owns push/navigate).
  - Exported: `NavModule`, `NavEntry` types; `activeModuleId()` helper.
  - Test: 40+ vitest cases encode shell invariants (frame layout, nav tree, active state, blur effect).
  
**Page templates (thin slot-based composition, Phases 3–4; 21/21 non-blocked screens now adopted):**
- `ListPage`: header + filter bar + table → standard list archetype. Props: `header` (PageHeader 
  slot), `filter` (FilterBar), `table` (DataTable slot), no data fetching.
- `DetailPage`: header (record name + actions) + optional tabs + children → detail archetype. 
  Props: `header`, `tabs`, `children`.
- `FormPage`: form container → form archetype. Caller owns validation/submit logic.
  All require `@cmc/ui/premium.css` (`.tpl-*` CSS classes).

**Adoption Status (2026-07-12):** Toàn bộ 21/21 màn admin ERP non-blocked (8 phase TDD, engaged 
via phase-00-phase-07) đã migrate từ legacy component lên premium template/composite architecture. 
Áp dụng: ListPage, DetailPage, FormPage + MetricCard, Panel, TaskRow, FunnelBar + LineIcon 
monochrome + premium token. Xem `plans/260711-1720-premium-erp-screen-buildout/plan.md`. 
12 exemplar screen cũ (cockpit, finance-receipt-*, student-*, grading, etc.) đã xây sẵn premium 
(không đổi lần này). 1 màn stub (leaderboard) chờ backend + spec; network-ip/shift-config đã shipped PR #34.

**Deployment:** Import `@cmc/ui/premium.css` once per app root (admin + lms will share). 
Classes encode paddings, gaps, shadows, blur effects — no inline styles in components.

## 5. Pattern trang (khớp routing TL6)

### Trang List (`/{area}/{resource}`)
PageHeader + FilterBar (→ URL query) + DataTable. Rỗng → EmptyState có nút tạo. Loading → skeleton.

### Trang Detail (`/{resource}/{id}` + tab sub-route)
Header (tên bản ghi + hành động) + Tabs sub-route. Tab mặc định không trắng. Trạng thái lọc trong
tab ở query.

### Form / Tạo mới
Form lớn → route riêng (`/…/new`, deep-link). Progressive disclosure: happy-path hiện, nâng cao ẩn.
Validate hiển thị inline; lỗi rõ ràng bằng ngôn ngữ người dùng.

### Hành động có hệ quả (duyệt tiền, ghi danh)
Nút hành động rõ nghĩa ("Duyệt & Kích hoạt"). Sau khi chạy → **ResultPanel nêu rõ điều đã xảy ra**
(không để tự động hoá vô hình — lỗi UX gốc TL2 §1).

## 6. Accessibility (WCAG 2.1 AA — tối thiểu)

- Tương phản văn bản ≥ 4.5:1 (token đã đảm bảo `brand-ink` trên `brand-muted`).
- Điều hướng bàn phím đầy đủ; focus ring brand rõ.
- Touch target ≥ 44×44px (quan trọng cho dùng trên tablet ở lớp).
- Nhãn form, aria cho DataTable; không truyền ý nghĩa chỉ bằng màu (kèm icon/text).

## 7. Responsive

- Admin: desktop-first (dày dữ liệu), nhưng điểm danh/chấm bài phải dùng được trên **tablet** (GV
  ở lớp) → target chạm lớn, layout co gọn.
- LMS phụ huynh: mobile-first.

## 8. Ngôn ngữ & nội dung

- Tiếng Việt, ngôn ngữ người dùng (không thuật ngữ hệ thống ra mặt tiền — TL2 §5).
- Nút = động từ việc người dùng làm ("Ghi danh", "Duyệt"), không tên kỹ thuật ("approve receipt").

> **SoT chi tiết + enforce được:** `design-system/cmc-edu/MASTER.md` §"Copy / i18n UI"
> (chuẩn đầy đủ, bảng map role code → tiếng Việt, giới hạn của lint guard) và
> `design-system/cmc-edu/PAGE-FRAMES.md` (luật điền `subtitle`). Hai dòng trên là
> nguyên tắc gốc — không viết lại ở đây khi SoT đổi.

## 9. Pattern màn đăng nhập LMS (2-tier auth)

> **product-decision 2026-07-07**: Màn đăng nhập LMS cần 2 tab song song, không phải một form đơn.

**Yêu cầu UI:**
- **Tab 1 — Phụ huynh**: nhập email → nút "Gửi mã OTP" → nhập OTP 6 số → đăng nhập. Nút "Gửi mã OTP" cần trạng thái loading + cooldown (60s). **Phải hiển thị thông báo BLOCKED-ON-COMMS** khi chạy không có email transport: "Hệ thống email đang trong quá trình cấu hình. Vui lòng liên hệ nhân viên để nhận hỗ trợ đăng nhập."
- **Tab 2 — Học sinh**: nhập SĐT phụ huynh (`84xxx`) + mật khẩu → đăng nhập. Nếu `mustChangePassword=true` → chuyển ngay sang màn đổi mật khẩu (không vào dashboard).
- Tab mặc định: Tab 1 (Phụ huynh). Deep-link `?tab=student` vào thẳng Tab 2.
- Sau đăng nhập PH: nếu 1 con → thẳng dashboard; nếu ≥2 con → `ProfilePicker` (xem WF-P1-07).
- Không lộ tồn tại tài khoản (email/SĐT sai → cùng một thông báo lỗi generic).
- Trạng thái component bắt buộc: default · loading · error (inline) · success (redirect).

> **Note:** Production email transport (BrevoEmailTransport) is now live; console transport is dev/test default only. If `EMAIL_TRANSPORT=console` in production environment, the system fails fast (console forbidden in prod). For development, display a warning badge on the email tab when console transport is active.

## 10. Cách dùng ở cổng DoR

Mỗi màn mới phải: chọn pattern (§5), liệt kê trạng thái component (§4), map màu trạng thái (§3),
đạt a11y (§6), và có ResultPanel nếu có bước tự động hoá. Màn đăng nhập LMS phải theo §9.

> Liên kết: TL2 (UX principles & lỗi gốc) · TL6 (routing/URL) · TL8 (a11y trong NFR) · repo
> `packages/ui` (nguồn token/component).
