# Nghiên cứu: Pattern UX/UI của Odoo bản mới nhất (19.0) áp cho `cmc_edu`

**Ngày:** 2026-08-13 · **Loại:** research · **Đối tượng:** CMC EDU v2 (React + TS + tRPC + Prisma)
**Phạm vi:** Odoo 19.0 là chuẩn tham chiếu; đối chiếu 18.0 / 17.0 / 16.0 để biết cái gì thật sự MỚI.

## Nhãn bằng chứng

| Nhãn | Nghĩa |
|---|---|
| **[CODE]** | Đọc trực tiếp mã nguồn Odoo (đường dẫn + dòng ghi kèm) |
| **[DOC]** | Tài liệu chính thức odoo.com / repo `odoo/documentation` |
| **[SUY LUẬN]** | Kết luận của tôi từ bằng chứng, không phải phát biểu của Odoo |
| **[KHÔNG NGUỒN]** | Không xác minh được — nêu ra để không giả vờ đã biết |

## Nguồn sơ cấp đã đọc (kiểm lại được)

Clone thưa (`--depth 1 --filter=blob:none --sparse`) `github.com/odoo/odoo`, sparse `addons/web addons/mail addons/crm`:

| Nhánh | SHA tip khi đọc | Ngày commit |
|---|---|---|
| `19.0` | `fb32dbbbaa29e762f6b75e1eb113b08fa6e0c478` | 2026-06-25 |
| `18.0` | `ae67c0bf578446c41113b1e6f7f00b4ddf6bdf24` | 2026-06-26 |
| `17.0` | `96359b03bae9dda0bb3732ed0e2a2d567142649f` | 2026-08-12 |
| `16.0` | `300925a48debae7c86cb15c17d1b2a6c6f82db8d` | 2026-06-08 |

Tài liệu: `odoo.com/page/release-notes`, `odoo.com/documentation/19.0/...`, repo `odoo/documentation@19.0`
(`content/contributing/documentation/content_guidelines.rst`, `content/contributing/development/coding_guidelines.rst`).

---

## TL;DR — 8 dòng

1. **Bản mới nhất = Odoo 19.0**, phát hành **18/09/2025**; 19.1→19.4 là bản Online trung gian (19.4 ra 07/2026); **Odoo 20 chưa ra** (dự kiến Experience 09-10/2026). **[DOC]**
2. **Chatter sang phải KHÔNG phải cái mới** — đã có từ **≥16.0**, ngưỡng **XXL = ≥1400px**. Cái mới ở 18/19 là ma trận layout 5 trạng thái + chatter thành thẻ XML `<chatter>`. **[CODE]**
3. **Cái mới quan trọng nhất của 19 cho mobile: `BottomSheet`** — mọi dropdown/select trên thiết bị nhỏ + cảm ứng biến thành sheet trượt từ đáy. Đây là thứ đáng chép nhất cho điểm đau #3. **[CODE]**
4. **Cái mới quan trọng nhất của 19 cho "biết làm gì tiếp": `rotting`** — bản ghi mắc kẹt quá `rotting_threshold_days` của giai đoạn thì hiện badge "12d". Áp thẳng được cho phễu O1→O5. **[CODE]**
5. **Odoo KHÔNG có style guide UI copy công khai.** Quy tắc viết chữ phải suy ra từ code. Tôi đã rút ra 9 quy tắc đo được (§4). **[DOC] + [SUY LUẬN]**
6. **Responsive Odoo = thu gọn, không đổi hình.** List trên mobile vẫn là bảng cuộn ngang — Odoo làm KÉM chỗ này, **đừng chép** (§3.4, §8).
7. **Đợt làm mới 17** ở mức token: cỡ chữ nền 13px → **14px** (và 16px trên cảm ứng), bo góc 4px. Bảng màu/brand **không đổi** 16→19. Phần "làm mới" thật nằm ở layout/chrome, không ở token. **[CODE]**
8. **Bảng hành động ở §9**: 6 việc "làm ngay", 5 việc "làm sau", 4 việc "bỏ".

---

## 0. Xác minh phiên bản (làm trước, không giả định)

`odoo.com/page/release-notes` (đọc 2026-08-13) liệt kê: **Version 19 — Released September 2025**, rồi 19.1 (01/2026), 19.2 (03/2026), 19.3 (05/2026), **19.4 (07/2026)**. Version 18 — 10/2024. Version 17 — 11/2023. **[DOC]**

`api.github.com/repos/odoo/odoo/branches`: nhánh major cao nhất là **`19.0`**; có `master` + `saas-19.1…saas-19.4`. **Không có nhánh `20.0`** ⇒ Odoo 20 chưa cắt nhánh phát hành tính đến 2026-08-13. **[CODE]**

> **Chốt:** nghiên cứu này lấy **19.0** làm chuẩn. `saas-19.x` chỉ dành cho Odoo Online, `master` là nơi đang gom cho 20 — tôi có thấy PR đang mở trên master đại tu toàn bộ text input cho cảm ứng+desktop (odoo/odoo#250051), tức là **20 sẽ còn động vào input/form nữa**; đừng đóng băng thiết kế input theo 19 một cách cứng nhắc. **[SUY LUẬN]**

---

## 1. Cái gì MỚI về UI/UX: 17 → 18 → 19

### 1.1 Token thiết kế: gần như KHÔNG đổi từ 17 đến 19 **[CODE]**

`addons/web/static/src/scss/primary_variables.scss`, so 4 nhánh:

| Token | 16.0 | 17.0 | 18.0 | 19.0 |
|---|---|---|---|---|
| `$o-font-size-base` | **13px** | **14px** | 14px | 14px |
| `$o-font-size-base-touch` | (không có) | **16px** | 16px | 16px |
| `$o-font-size-base-small` / `-smaller` | — | 13px / 12px | 13/12 | 13/12 |
| `$o-border-radius` | `.25rem` | **4px** (`o-to-rem`) | 4px | 4px |
| `$o-community-color` | `#71639e` | `#71639e` | `#71639e` | `#71639e` |
| `$o-enterprise-color` | `#714B67` | `#714B67` | `#714B67` | `#714B67` |
| `$o-headings-font-family` | SF Pro Display + system | như 16 | như 16 | như 16 |
| Thang xám | Bootstrap `#f8f9fa…#212529` | như 16 | như 16 | như 16 |

**Kết luận thẳng:** cái gọi là "đợt làm mới giao diện lớn của Odoo 17" **không phải một cuộc thay bảng màu**. Ở tầng token, 17 chỉ làm hai việc đo được: **tăng cỡ chữ nền 13→14px** và **tách riêng cỡ chữ 16px cho thiết bị cảm ứng**, cộng chuyển đơn vị bo góc sang hàm `o-to-rem()`. Phần còn lại của "làm mới" nằm ở **cấu trúc layout và chrome** (control panel, breadcrumb, kanban card, nút) chứ không ở biến thiết kế. **[CODE] + [SUY LUẬN]**

> Bài học cho `cmc_edu` điểm đau #1: **nhất quán không đến từ việc đổi màu**. Odoo giữ nguyên bảng màu suốt 4 phiên bản và vẫn được coi là "mới" vì họ chuẩn hoá *thang cỡ chữ* (4 bậc: 14/13/12 + 16 cảm ứng), *một bán kính bo góc* (4px, với sm 3px / lg 6px) và *một thang khoảng cách Bootstrap*. Đó là toàn bộ bí quyết. **[SUY LUẬN]**

### 1.2 Odoo 18 đổi gì (so 17) **[CODE]**

- **Cú pháp kanban card mới.** 17.0: `<t t-name="kanban-box">` + `<div class="oe_kanban_global_click oe_kanban_card d-flex flex-column">` tự dựng. 18.0: `<t t-name="card">` + `<footer>` ngữ nghĩa, khung do framework lo.
  (`addons/crm/views/crm_lead_views.xml` — 17.0 dòng 404/568 vs 18.0 dòng 393/535.)
- **Chatter thành thẻ XML riêng.** 17.0 khai báo bằng `div.oe_chatter` (`form_compilers` selector `"div.oe_chatter"`); 18.0/19.0 dùng thẻ `<chatter>` (selector `"chatter"`), và code chatter chuyển hẳn sang thư mục mới `addons/mail/static/src/chatter/` (17.0: `core/web/chatter.js` + `views/web/form/`).
- **Breadcrumbs tách thành component riêng**: `search/breadcrumbs/breadcrumbs.{js,xml}` được thêm mới trong 18.0.
- **`status_bar_dropdown_items`, `form_cog_menu`, `list_cog_menu`** thêm mới ⇒ 18 bắt đầu hệ thống hoá việc **gom hành động phụ vào cog/dropdown**.
- **`column_width_hook.js`** (list) thêm mới ⇒ thuật toán chia độ rộng cột.

### 1.3 Odoo 19 đổi gì (so 18) — danh sách file thêm/xoá trong `addons/web/static/src` **[CODE]**

Đáng chú ý (đã lọc bỏ nhiễu calendar/tree_editor):

| Thêm mới ở 19.0 | Ý nghĩa UX |
|---|---|
| `core/bottom_sheet/` (5 file: js, service, xml, scss, variables) | **Bottom sheet cho mobile** — xem §3.1 |
| `search/control_panel/control_panel_mobile.css` | Control panel có file CSS riêng cho mobile |
| `views/action_helper.{js,xml}` | Refactor "no content helper" thành component chuẩn |
| `views/view_components/selection_box.{js,xml,scss}` + `multi_selection_buttons.{js,xml}` | **Thanh hành động hàng loạt** kiểu "N selected + …" |
| `views/view_components/group_config_menu.*` | Menu cấu hình cột kanban/nhóm list gom một chỗ |
| `views/view_components/multi_create_popover.*`, `multi_currency_popover.*` | Tạo nhiều bản ghi / popover đa tiền tệ |
| `views/fields/many2one/many2one.{js,xml}` | Viết lại Many2One |
| `views/fields/badge_selection/list_badge_selection_field.*` | Badge selection dùng được trong list |
| `core/time_picker/`, `core/color_picker/` (thay `colorpicker`) | Picker mới |
| `core/network/rpc_cache.js`, `core/utils/indexed_db.js` | Cache RPC (cảm giác "nhanh") |
| `views/fields/contact_image/`, `contact_statistics/` | Field hiển thị liên hệ |
| `mail/js/rotting_mixin/` (13 file) + `crm` rotting | **Rotting** — xem §5.2 |
| `mail/chatter/web/scheduled_message*` (đã có từ 18) | Tin nhắn hẹn giờ trong chatter |

Bị xoá ở 19: `kanban_color_picker_legacy.*`, `kanban_record_legacy.scss`, `kanban_dashboard.scss`, `legacy/scss/{dropdown,fields,ui}.scss`, `pivot_header.*`, `status_bar_dropdown_items.*` ⇒ **19 là bản dọn nợ legacy của web client**. **[CODE] + [SUY LUẬN]**

---

## 2. Chatter đặt ở đâu ở bản mới — và từ bao giờ

### 2.1 Cơ chế chính xác ở 19.0 **[CODE]**

`addons/mail/static/src/chatter/web/form_renderer.js` (19.0), hàm `mailLayout(hasAttachmentContainer)`:

```js
mailLayout(hasAttachmentContainer) {
    const xxl = this.uiService.size >= SIZES.XXL;
    const hasFile = this.hasFile();
    const hasChatter = !!this.mailStore;
    const hasExternalWindow = !!this.mailPopoutService.externalWindow;
    if (hasExternalWindow && hasFile && hasAttachmentContainer) {
        if (xxl) return "EXTERNAL_COMBO_XXL";  // chatter bên phải, đính kèm ở tab riêng
        return "EXTERNAL_COMBO";               // chatter dưới đáy, đính kèm ở tab riêng
    }
    if (hasChatter) {
        if (xxl) {
            if (hasAttachmentContainer && hasFile) return "COMBO"; // chatter dưới đáy, đính kèm bên phải
            return "SIDE_CHATTER";                                  // chatter bên phải
        }
        return "BOTTOM_CHATTER";                                    // chatter dưới đáy
    }
    return "NONE";
}
```

Năm trạng thái, quyết định bởi **đúng ba biến**: bề rộng ≥ XXL, có tệp đính kèm để xem trước, có cửa sổ pop-out.

**Breakpoint:** `addons/web/static/src/core/ui/ui_service.js`
`SIZES = { XS:0, SM:1, MD:2, LG:3, XL:4, XXL:5 }` và
`MEDIAS_BREAKPOINTS = [≤575, 576–767, 768–991, 992–1199, 1200–1399, **≥1400**]`.
⇒ **Chatter chỉ sang phải khi viewport ≥ 1400px.** Từ 1399px trở xuống nó xuống đáy. **[CODE]**

Class kết quả (`form_compiler.js` dòng 111): `o-aside w-print-100` khi SIDE/EXTERNAL_COMBO_XXL, ngược lại `mt-4 mt-md-0`.
Độ rộng cột phải: `form_renderer.scss` — `width: calc(#{$o-mail-Chatter-minWidth} + var(--Chatter-asideExtraWidth))`, `flex-shrink: 0`.

**Không có tab, không có toggle mở/đóng theo breakpoint.** Chatter chỉ đổi *vị trí*, người dùng không bấm gì cả. Có `--Chatter-asideExtraWidth` chú thích "to take into account more items, e.g. close chatter feature" ⇒ tính năng đóng chatter tồn tại ở tầng khác (nhiều khả năng Enterprise `web_enterprise`, **không có trong repo community**). **[CODE] + [KHÔNG NGUỒN]** cho phần Enterprise.

Chatter **bị ẩn hoàn toàn trong dialog**: `form_compiler.js` dòng 28 — `t-if="!__comp__.env.inDialog"`. **[CODE]**

### 2.2 "Odoo đã chuyển chatter sang phải" — sai về mốc thời gian **[CODE]**

| Nhánh | Có chatter bên phải? | Bằng chứng |
|---|---|---|
| 16.0 | **Có** | `addons/mail/static/src/views/form/form_compiler.js:86-87` — `t-if="!hasAttachmentViewer() and uiService.size >= SIZES.XXL"`, `t-attf-class="o-aside"` |
| 17.0 | Có | `views/web/form/form_compiler.js` — `isChatterAside: uiService.size >= SIZES.XXL` |
| 18.0 | Có, qua `mailLayout()` | `chatter/web/form_renderer.js` — **giống hệt 19.0 từng ký tự** |
| 19.0 | Có | như trên |

⇒ Bố cục chatter-bên-phải-khi-màn-rộng **đã có ít nhất từ Odoo 16.0 (10/2022)**. 18.0 tổng quát hoá thành máy trạng thái 5 nhánh (thêm pop-out ở nhánh EXTERNAL_*). **19.0 không đổi gì về vị trí chatter so với 18.0.**

> **Vì sao họ đổi:** không tìm được phát biểu chính thức. **[KHÔNG NGUỒN]** — đừng trích dẫn lý do; chỉ chép cơ chế.

### 2.3 Khuyến nghị cho `cmc_edu` **[SUY LUẬN]**

Làm đúng 2 nhánh, bỏ 3 nhánh còn lại (`COMBO`/`EXTERNAL_*` phụ thuộc trình xem đính kèm và cửa sổ pop-out — YAGNI):

```
viewport ≥ 1400px  → chatter cột phải, chiều rộng cố định (~380–420px), flex-shrink: 0
viewport < 1400px  → chatter dưới đáy form, full width
trong modal/dialog → không render chatter
```

**Chi phí: THẤP.** Một container flex + một media query. Không cần state, không cần toggle. Đúng KISS.

---

## 3. Mobile / Responsive — đào sâu (điểm đau #3)

### Triết lý của Odoo, nói thẳng

**Odoo KHÔNG thiết kế lại giao diện cho mobile. Odoo THU GỌN giao diện desktop.** Không có "mobile view" riêng cho list/form. Toàn bộ mobile behaviour đi qua đúng một cờ `env.isSmall` (= `ui.size <= SIZES.SM` = **≤767px**) và quy tắc chung là: *cái gì không đủ chỗ thì nhét vào dropdown "⋮"*. **[CODE] + [SUY LUẬN]**

### 3.1 `BottomSheet` — cái mới nhất và đáng chép nhất của 19 **[CODE]**

`addons/web/static/src/core/bottom_sheet/bottom_sheet_service.js` — service `bottom_sheet` dựng trên `overlay`, đặt class `bottom-sheet-open` (và `bottom-sheet-open-multiple` khi chồng ≥2) lên `document.body`, đếm số sheet đang mở.

Điều kiện kích hoạt — **giống nhau ở cả 3 nơi**:

```js
// core/dropdown/dropdown.js:198
get isBottomSheet() { return utils.isSmall() && hasTouch() && this.props.bottomSheet; }
// core/select_menu/select_menu.js:200  và  views/fields/selection/selection_field.js:40
get isBottomSheet() { return this.env.isSmall && hasTouch(); }
```

`hasTouch()` (`core/browser/feature_detection.js:73`):
```js
return browser.ontouchstart !== undefined || browser.matchMedia("(pointer:coarse)").matches;
```

⇒ **Quy tắc: nhỏ (≤767px) VÀ cảm ứng ⇒ dropdown biến thành bottom sheet.** Màn hình nhỏ nhưng dùng chuột (cửa sổ desktop hẹp) vẫn giữ dropdown thường. Đây là chi tiết tinh tế và đúng — đừng chỉ nhìn bề rộng.

Ai dùng: `Dropdown` (toàn hệ thống), `SelectMenu`, `selection_field`, switch view của control panel (`o_custom_bottom_sheet`), search panel, message actions của mail, `button_box` của form. Tức là **một cơ chế, phủ gần hết tương tác chọn lựa**. **[CODE]**

Trên `SelectMenu` ở chế độ bottom sheet còn có thêm nút **"Clear"** và ô tìm kiếm được đưa vào trong sheet thay vì trong toggler (`select_menu.js:197`, `select_menu.xml:62`).

> **Khuyến nghị `cmc_edu`: LÀM NGAY.** Một component `<BottomSheet>` + hook `useIsBottomSheet()` (`isSmall && hasTouch`), rồi cho tất cả select/dropdown đi qua nó. Đây là đòn đơn lẻ có tác động lớn nhất lên điểm đau #3. Chi phí **THẤP–VỪA** (Radix/Vaul có sẵn drawer; hoặc tự viết ~150 dòng).

### 3.2 Điều hướng trên mobile **[CODE]**

`addons/web/static/src/webclient/navbar/navbar.xml`:
- `isSmall` ⇒ nút hamburger `<i class="fa fa-bars">` thay cho menu Apps dạng dropdown; tên app (`o_menu_brand`) **bị ẩn**; danh sách section của app **bị ẩn** khỏi thanh trên.
- Bấm hamburger mở **sidebar trái toàn chiều cao** (`o_app_menu_sidebar position-fixed top-0 bottom-0 end-100`), portal vào `body`, kèm `modal-backdrop`, có `Transition` 200ms.
- Sidebar có 2 chế độ: **section của app hiện tại** (mặc định) và **tất cả app** (nút "All Apps"). Không phải hai màn hình khác nhau, chỉ một cờ `state.isAllAppsMenuOpened`.
- **Vuốt để đóng**: `t-on-touchstart`/`t-on-touchend` → `_onSwipeStart`/`_onSwipeEnd`, ngưỡng `SWIPE_ACTIVATION_THRESHOLD = 100` px (`webclient/burger_menu/burger_menu.js`).

**Không có thanh tab dưới đáy (bottom navigation).** Odoo web client dùng hamburger + sidebar, chấm hết. **[CODE]**

### 3.3 Control panel / breadcrumb / pager trên mobile **[CODE]**

`search/control_panel/control_panel.xml`:
- Các nút chính (New, layout buttons, always-buttons) khi `isSmall` được **nhân bản vào một Dropdown "⋮"** (`oi-ellipsis-v`, `title="More"`, class `o-control-panel-adaptive-dropdown`).
- Breadcrumb khi `isSmall` được **`t-portal`** lên navbar (`.o_navbar_breadcrumbs`), có fallback `.o_fallback_breadcrumbs`. Code có comment thật của Odoo: *"Here be dragons... REFACTORME: this `t-portal` introduces an implicit dependency between the ControlPanel and the NavBar"* ⇒ **Odoo tự thừa nhận chỗ này là nợ kỹ thuật.** Đừng chép kiến trúc portal này; chỉ chép kết quả thị giác.
- `embedded_actions` ẩn khi `isSmall` (chuyển vào dropdown).

`search/breadcrumbs/breadcrumbs.xml` khi `isSmall`:
```xml
<button class="o_back_button btn btn-link px-1 py-0" t-on-click="previousBreadcrumb.onSelected">
  <i class="oi oi-fw oi-arrow-left"/>
</button>
```
⇒ **toàn bộ chuỗi breadcrumb rút thành một mũi tên "quay lại"** + tên bản ghi hiện tại (`text-truncate`). Trên desktop mới hiện `ol.breadcrumb` với 3 mức cuối + dropdown "…" cho phần bị gập (`slice(-3,-1)`, `slice(0,-3).reverse()`).

`core/pager/pager.xml`: khi `isSmall`, **bỏ hẳn phần "80 / 1234"**, chỉ còn hai nút `‹ ›`. Trên desktop, số trang bấm được để nhập tay; nếu tổng chưa chắc chắn thì hiện `1234+` bấm để đếm chính xác (`o_pager_limit_fetch`). **[CODE]**

`search/search_bar/search_bar_toggler.xml`: mobile ẩn ô tìm kiếm sau **một nút kính lúp** bật/tắt.
`search/search_panel/search_panel.xml`: mobile dùng template riêng `web.SearchPanel.Small`; desktop có 2 trạng thái **Regular / Sidebar (thu gọn)** với nút `oi-panel-right` — trạng thái thu gọn này đã có từ 18.0. **[CODE]**

### 3.4 List view trên mobile — **Odoo làm KÉM, đừng chép** **[CODE]**

Sự thật kiểm chứng được:

- List **vẫn là `<table>`**. `list_renderer.xml:7` — `class="o_list_renderer o_renderer table-responsive"` ⇒ **cuộn ngang**. Không có biến hình sang thẻ (card).
- Sticky header **chỉ có từ `md` trở lên**: `list_renderer.scss` — `@include media-breakpoint-up(md) { .o_list_table thead { position: sticky } }` ⇒ **trên điện thoại, cuộn xuống là mất luôn tên cột**.
- Cột checkbox chọn dòng **bị ẩn trên thiết bị cảm ứng**: `list_renderer.scss:552` — `.o_web_client.o_touch_device .o_content table.o_list_table.table tr > .o_list_record_selector:first-child { display: none }`. Và `list_renderer.js:339` — `get hasSelectors() { return this.props.allowSelectors && !this.env.isSmall; }`.
- Thay vào đó là **"chế độ chọn"**: khi đã có ít nhất 1 dòng được chọn, mọi click vào dòng chuyển thành toggle chọn thay vì mở bản ghi (`list_renderer.js:2289-2309` `ignoreEventInSelectionMode` / `onClickCapture`). **Nhưng cách chọn dòng ĐẦU TIÊN trên mobile thì tôi không tìm thấy trong `addons/web`** — không có long-press handler nào cho list row. **[KHÔNG NGUỒN]** — nghi là thuộc Enterprise hoặc phải xoay ngang máy để thấy checkbox.
- Nút header khi `isSmall` bị đẩy vào CogMenu (`list_controller.xml:44`), và trong `control-panel-selection-actions` các nút hàng loạt bị ẩn (`t-if="!env.isSmall"`, dòng 66).

> **Phán quyết:** trải nghiệm list mobile của Odoo là *bảng desktop bị nhét vào màn hình hẹp*. Nó cuộn ngang, mất header, và mất đường vào thao tác hàng loạt. **`cmc_edu` nên làm KHÁC: đổi list → danh sách thẻ trên `<md`.** Đây là chỗ hiếm hoi nên đi trước Odoo chứ không theo. **[SUY LUẬN]**

### 3.5 Kanban trên mobile — chỗ Odoo làm TỐT **[CODE]**

`views/kanban/kanban_controller.scss`:
```scss
&.o_kanban_grouped {
    @include media-breakpoint-down(md) {
        --KanbanGroup-width: 90%;   // "don't take full width to give a hint of next/previous column"
        overflow: scroll hidden !important;
        scroll-snap-type: x mandatory;
    }
}
@include media-breakpoint-down(md) {
    .o_kanban_group, .o_column_quick_create { scroll-snap-align: center; overflow-y: scroll; }
}
```

⇒ **Cột rộng 90% viewport + scroll-snap ngang bắt buộc.** Không phải "vuốt để chuyển cột" bằng JS — đây là **CSS thuần**, để lộ 10% cột kế bên làm gợi ý là còn cột nữa. Cực rẻ, cực hiệu quả.

Các khác biệt mobile khác của kanban:
- **Tắt kéo-thả**: `kanban_renderer.js:290` — `get canUseSortable() { return !this.env.isSmall; }`
- **Tắt gập cột**: `kanban_renderer.js:399` — chỉ thêm class `o_column_folded` khi `!isSmall`; scss ghi rõ *"don't visually fold on smaller screens (aka. mobile)"*; mục "Fold" trong menu cột bị ẩn (`kanban_header.js:74` — `isVisible: () => !utils.isSmall()`).
- **Nút "Load more… (N remaining)"** riêng cho mobile (`kanban_renderer.xml:64-68`).
- Lưu/khôi phục `scrollLeft` + `scrollTop` từng cột khi rời/quay lại view (`kanban_controller.js:151-186`) — chi tiết nhỏ nhưng là thứ khiến người dùng không "lạc".

**Header cột luôn sticky:** `kanban_header.xml:5` — `class="o_kanban_header position-sticky top-0 z-1"`.

> **`cmc_edu` LÀM NGAY:** cột 90% + `scroll-snap-type: x mandatory` + `scroll-snap-align: center` + tắt drag trên mobile. Chi phí **RẤT THẤP** (4 dòng CSS + 1 điều kiện).

### 3.6 Form trên mobile **[CODE]**

- **Statusbar → một dropdown duy nhất.** `views/fields/statusbar/statusbar_field.js:228`:
  ```js
  if (this.env.isSmall && this.items.inline.length) {
      show(this.dropdownRef.el);           // chỉ 1 dropdown
      hide(this.beforeRef.el, this.afterRef.el, ...itemEls);
      return;
  }
  ```
  Nút mang class `o_arrow_button` khi `isSmall` (`statusbar_field.xml:74`). Trên desktop nó chạy vòng `while (this.areItemsWrapping())` để tự gập bớt các bước cho vừa một dòng — **thuật toán "gập cho vừa", không phải breakpoint cứng**.
- **Nút header → nút đầu tiên + "⋮".** `views/form/status_bar_buttons/status_bar_buttons.xml`:
  ```xml
  <t t-if="env.isSmall">
    <t t-set="firstSlot" t-value="visibleSlotNames[0]"/>
    <t t-if="firstSlot" t-slot="{{ firstSlot }}"/>
    <Dropdown t-if="otherSlots.length"> <button class="btn btn-secondary" title="More"><i class="oi oi-fw oi-ellipsis-v"/></button> … </Dropdown>
  </t>
  ```
  ⇒ **Chỉ hành động chính giữ nguyên là nút thật; phần còn lại vào "⋮".** Quy tắc rõ ràng, chép được ngay.
- Chatter xuống đáy (§2).
- Save/discard: `form_status_indicator.xml` — hai nút icon `fa-cloud-upload` / `fa-times`, container `d-md-flex` (tức trên mobile là `d-flex` mặc định của thẻ). Có `data-hotkey="s"` / `"j"`.

### 3.7 Quy ước CSS responsive mà Odoo dùng **[CODE]**

Odoo **không có hệ tiện ích riêng** — họ dùng thẳng **Bootstrap 5**: `d-none/d-md-block`, `flex-column flex-md-row`, `order-0/order-1/order-2 + order-lg-*`, `w-100 w-lg-auto`, `gap-2 gap-lg-3`, `mt-4 mt-md-0`, `text-truncate`, `min-w-0`, `table-responsive`, `d-print-none`, mixin `media-breakpoint-up/down`.

Điểm cần lưu ý: **có hai hệ breakpoint song song và chúng LỆCH NHAU**.
- SCSS: Bootstrap mặc định (`sm 576 / md 768 / lg 992 / xl 1200 / xxl 1400`).
- JS: `MEDIAS_BREAKPOINTS` với `isSmall = size <= SM` tức **≤767px** — tương ứng `media-breakpoint-down(md)` của Bootstrap, **không phải** `down(sm)`.

⇒ Khi đọc code Odoo, `env.isSmall` (JS) ≡ `@include media-breakpoint-down(md)` (SCSS). Chép nhầm chỗ này là lệch 192px. **[CODE]**

---

## 4. Odoo chống "chữ nhiều, lan man" bằng cách nào (điểm đau #2)

### 4.1 Có style guide chính thức không? — **KHÔNG** **[DOC]**

Đã kiểm:
- `odoo/documentation@19.0/content/contributing/documentation/content_guidelines.rst` — **là guide viết TÀI LIỆU**, không phải UI copy.
- `odoo/documentation@19.0/content/contributing/development/coding_guidelines.rst` — mục lục chỉ có: cấu trúc module, đặt tên file, XML ID, kế thừa XML, Python PEP8, quy ước SCSS/CSS (BEM `--[root]__[element]-[property]--[modifier]`). **Không có mục nào về wording/UI copy.**
- `content/contributing/development/` chỉ chứa đúng 2 file: `coding_guidelines.rst`, `git_guidelines.rst`.

**Kết luận: Odoo không công bố style guide cho chữ trên giao diện.** Ai nói ngược lại thì hỏi họ URL. **[DOC]**

Hai mảnh gần nhất, dùng được:
- **`content_guidelines.rst` §Writing style** (dành cho docs, nhưng tinh thần áp được):
  > *"Readers are more likely to skim through content… the documentation is a place to **inform and describe**, not to convince and promote."*
  > *"Avoid using *you* as much as possible by opting for the **imperative mood**."* — Tốt: "Select the appropriate option from the dropdown menu." / Xấu: "You can select the appropriate option…"
  > Tiêu đề: **"Be concise: avoid sentences, questions, and titles starting with 'how to'"**; dùng **sentence case**; không dùng đại từ ngôi 2 trong tiêu đề.
  > Danh sách: *"Only use a period at the end of the list item if it forms a complete sentence."*
- **Studio docs** (`applications/studio/views.html`) — ngữ nghĩa nút, phát biểu chính thức:
  > *"Primary buttons represent the main action(s) the user can take in a specific view… and are more visually prominent. Secondary buttons offer alternative or less common actions… By default, a new button is styled as a secondary button."* **[DOC]**
  ⇒ **Mặc định là secondary. Muốn primary phải chứng minh nó là hành động chính.** Đây là quy tắc chống "màn hình đầy nút xanh".

### 4.2 Empty state — đo thật từ code CRM 19.0 **[CODE]**

Cấu trúc bất biến: `<p class="o_view_nocontent_smiling_face">` (dòng 1, hành động) + `<p>` (dòng 2, giải thích).

| Nơi | Dòng 1 | Dòng 2 |
|---|---|---|
| `crm_lead_views.xml:1079` | "Create a Lead" | "Leads are the qualification step before the creation of an opportunity." |
| `crm_lead_views.xml:1140` | "Looks like nothing is planned." | "Schedule activities to keep track of everything you have to do." |
| `crm_lead_views.xml:1264` | "No opportunity to display!" | "Easily set expected closing dates and overview your revenue streams." |
| `crm_helper_templates.xml:12` | "Create an opportunity to start playing with your pipeline." | (không có) |

**Đo được:** dòng 1 ≈ **3–8 từ**; dòng 2 ≈ **8–16 từ, đúng MỘT câu**; tổng **≤ 2 đoạn**, không bao giờ 3.
Mặc định của framework khi view không khai báo gì (`views/action_helper.xml`): *"No data to display"* + *"Try to add some records, or make sure that there is no active filter in the search bar."* — cùng khuôn 2 dòng.

### 4.3 Placeholder — thay thế label giải thích **[CODE]**

Từ `crm_lead_views.xml`: `placeholder="No closing estimate"` (date_deadline), `placeholder="Not specified"` (lost_reason_id), `placeholder="Add a description..."` (description), `placeholder="Visible to all"` (company_id).
Từ `crm_stage_views.xml:60`: `placeholder="Give your team the requirements to move an opportunity to this stage."`

**Quy tắc rút ra:** placeholder mang **ngữ nghĩa của trạng thái rỗng** ("No closing estimate", "Visible to all"), không lặp lại tên trường. Đây là cách Odoo giết chữ giải thích: chuyển giải thích vào ô nhập. **[SUY LUẬN]**

### 4.4 Tooltip 2 tầng — tách người dùng khỏi lập trình viên **[CODE]**

`views/fields/field.js:476`:
```js
if (Boolean(odoo.debug) || (tooltip && JSON.parse(tooltip).field.help)) { … }
```
`views/fields/field_tooltip.xml`:
- `<p t-if="field.help" class="o-tooltip--help">` — **luôn hiện nếu trường có `help`**.
- `<ul class="o-tooltip--technical" t-if="debug">` — Label / Field / Model / Type / Widget / Context / Domain / Invisible / Required / Readonly / Default / Relation / Selection. **Chỉ hiện trong developer mode.**

⇒ Người dùng thường **không bao giờ** thấy tooltip kỹ thuật. Trường không có `help` thì **không có tooltip nào cả** — im lặng là mặc định. **[CODE]**

### 4.5 Dialog xác nhận **[CODE]**

`core/confirmation_dialog/confirmation_dialog.xml`: khung tối giản — `<p t-out="props.body" class="text-prewrap"/>` + 2 nút với nhãn truyền vào (`confirmLabel` / `cancelLabel`), có hotkey `q` (xác nhận) / `x` (huỷ). `AlertDialog` là bản `size="'sm'"`.
`views/form/form_error_dialog/form_error_dialog.xml`: tiêu đề **"Oh snap!"**, thân là message, 3 nút: **"Stay here"** / (action tuỳ chọn) / **"Discard changes"**.

**Quan sát:** nhãn nút là **động từ hoặc cụm động từ 1–3 từ** ("Update", "Cancel", "Stay here", "Discard changes"). Không có nút nào là câu.

`views/list/list_confirmation_dialog.xml` (multi-edit) là ngoại lệ có chủ đích: nó hiện **bảng "Field / Update to:"** liệt kê chính xác cái gì sẽ đổi, + alert `fa-lightbulb-o` dạy toán tử `+= -= *= /=`. Tức là: **khi hành động rủi ro cao, Odoo cho thêm chữ — nhưng dưới dạng bảng dữ liệu, không phải đoạn văn.** **[CODE] + [SUY LUẬN]**

### 4.6 Chín quy tắc viết chữ cho `cmc_edu` (rút từ trên)

1. **Màn hình rỗng = 2 dòng.** Dòng 1: hành động (≤8 từ). Dòng 2: một câu tại sao (≤16 từ). Không có dòng 3.
2. **Mệnh lệnh thức, bỏ "bạn".** "Chọn nguồn lead" — không phải "Bạn có thể chọn nguồn lead".
3. **Nhãn nút = động từ 1–3 từ.** "Duyệt", "Ghi nhận thu", "Huỷ". Cấm nút là câu.
4. **Mặc định `btn-secondary`.** Một màn hình có **tối đa một** nút primary. **[DOC]**
5. **Placeholder mô tả trạng thái rỗng**, không lặp label: "Chưa hẹn ngày test", "Không giới hạn".
6. **Trường không có `help` thì không có tooltip.** Đừng nhồi tooltip cho đủ bộ.
7. **Chữ kỹ thuật (mã bản ghi, tên trường, id) chỉ hiện ở chế độ dev.**
8. **Xác nhận hành động rủi ro bằng BẢNG dữ liệu**, không bằng đoạn văn cảnh báo.
9. **Sentence case ở mọi tiêu đề**, không Title Case, không CHỮ HOA. **[DOC]**

---

## 5. Chống "mơ hồ, sợ dùng" (điểm đau #4)

### 5.1 Command palette (Ctrl+K) **[CODE]**

- Đăng ký: `core/commands/command_service.js:67` — `hotkeyService.add("control+k", openMainPalette, …)`.
- **Namespace** (ký tự đầu đổi nguồn dữ liệu), registry `command_setup`:
  | Ký tự | Nguồn | File |
  |---|---|---|
  | *(rỗng)* | lệnh của màn hình hiện tại — `placeholder: "Search for a command..."`, rỗng thì `"No command found"` | `core/commands/default_providers.js:12` |
  | `/` | menu / ứng dụng | `webclient/menus/menu_providers.js:23` |
  | `@` | người dùng (Discuss) | `mail/discuss/core/public_web/discuss_command_palette.js:111` |
- **Provider `data-hotkeys` tự động quét DOM**: mọi phần tử `[data-hotkey]:not(:disabled)` đang **nhìn thấy được** đều thành một lệnh. Mô tả lấy theo thứ tự `el.title → data-bs-original-title → data-tooltip → placeholder → innerText (cắt 50 ký tự)`, cuối cùng fallback `"no description provided"`. Danh mục lấy từ tổ tiên gần nhất có `[data-command-category]`; giá trị `"disabled"` thì loại trừ (navbar tự đánh dấu `data-command-category="disabled"`).

⇒ **Command palette của Odoo không có danh sách lệnh viết tay.** Nó **sinh ra từ chính các nút đang hiển thị**. Đây là ý tưởng kiến trúc đắt giá: palette không bao giờ lệch với UI.

- Phím tắt: overlay modifier (mặc định `alt`) + `data-hotkey`. Ví dụ đo được: `h` = Home/Apps, `b` = breadcrumb quay lại, `p`/`n` = trang trước/sau, `s` = save, `j` = discard, `q`/`x` = xác nhận/huỷ dialog, `1..9,0` = 10 section đầu của app. Trên macOS, `HotkeyCommandItem.getKeysToPress()` dịch `control→command`, `alt→control`. **[CODE]**

### 5.2 `rotting` — **tính năng mới của Odoo 19**, trả lời đúng câu "giờ làm gì tiếp" **[CODE]**

Xác nhận là mới: `git show origin/18.0:addons/crm/views/crm_lead_views.xml | grep -c rotting` → **0**. Ở 19.0 có đủ `addons/mail/static/src/js/rotting_mixin/` (13 file) + `addons/crm/static/src/views/crm_kanban/`.

Mô hình: `addons/mail/models/mail_tracking_duration_mixin.py`
```python
class MailTrackingDurationMixin(models.AbstractModel):
    _name = 'mail.tracking.duration.mixin'
    rotting_days = fields.Integer('Days Rotting', compute='_compute_rotting')
    is_rotting  = fields.Boolean('Rotting', compute='_compute_rotting', search='_search_is_rotting')
```
Cấu hình **theo từng giai đoạn**: `crm.stage.rotting_threshold_days` (form giai đoạn, ẩn khi `is_won`; trong list là cột `optional="hide"`).

Hiển thị (`mail/static/src/js/rotting_mixin/rotting_widget.{js,xml}`):
- Kanban: `<div class="badge rounded-pill o_mail_resource_rotting_bg">12d</div>`, tooltip *"This lead has been stuck in this stage for 12 days."* (chuỗi riêng cho `crm.lead` / `hr.applicant` / `project.task`, còn lại dùng "This record…").
- List: `list.badge_rotting` — badge gắn cạnh giá trị Many2One.
- Còn có `rotting_statusbar`, `rotting_column_progress`, `rotting_kanban_header` ⇒ trạng thái "mục rữa" **lan lên cả statusbar và thanh tiến độ đầu cột**.

Trong arch CRM 19: `<field name="rotting_days" class="d-flex" widget="rotting"/>` đặt ở `<footer>` của card.

> **`cmc_edu` LÀM NGAY.** Phễu O1→O5 có đúng bệnh này: lead nằm chết ở `O2_CONTACTED`. Thêm `rottingThresholdDays` cho từng stage + badge "12d" + bộ lọc "Đang mục rữa". Chi phí **THẤP** (một cột int trên bảng stage, một computed field, một badge). Giá trị **RẤT CAO**: nó biến "tôi không biết làm gì tiếp" thành một danh sách việc.

### 5.3 Ribbon trạng thái bất thường **[CODE]**

```xml
<widget name="web_ribbon" id="lost_ribbon"     title="Lost"     bg_color="text-bg-danger" invisible="won_status != 'lost'"/>
<widget name="web_ribbon" id="archived_ribbon" title="Archived" bg_color="text-bg-danger" invisible="active or won_status in ['lost','won']"/>
<widget name="web_ribbon" id="won_ribbon"      title="Won"      bg_color="text-bg-success" invisible="won_status != 'won'"/>
```
Dải chéo góc card/form. **Chỉ dùng cho trạng thái cuối / bất thường** (Lost, Won, Archived) — không dùng cho trạng thái đang chạy.

### 5.4 Thanh chọn hàng loạt (mới ở 19) **[CODE]**

`views/view_components/selection_box.xml`:
- "**N** selected" + nút `×` (Unselect All).
- Khi đã chọn hết trang: nút **"→ Select all 1234+"** (`title="Select all records matching the search"`) — desktop. Trên mobile thu thành nút **"All"**.
- Khi đã chọn theo domain: "All **1234+** selected".
- `multi_selection_buttons.xml`: bản floating `position-absolute` với "N selected" + "Add" + thùng rác đỏ.

**Cái hay:** phân biệt rành mạch *"đã chọn 80 dòng trên trang này"* với *"đã chọn toàn bộ 1234 kết quả khớp bộ lọc"*. Đây là nguồn gây sai lầm chết người trong thao tác hàng loạt, và Odoo giải quyết bằng một nút + một câu.

### 5.5 Chỉ báo lưu / lỗi **[CODE]**

`views/form/form_status_indicator.xml`: 2 nút icon (cloud-upload / times) chỉ hiện khi `isNew or displayButtons`; khi không lưu được thì thêm `<span class="text-danger">` với `data-tooltip="Unable to save. Correct the issue or discard all changes"`.
Trường sai được đánh `o_field_invalid` **trên cả field lẫn label** (`views/fields/field.js:378`, `views/form/form_label.js:28`) ⇒ nhãn đỏ theo, người dùng thấy ngay ô nào.
Rời form khi còn thay đổi ⇒ `FormErrorDialog` "Oh snap!" + Stay here / Discard changes.

### 5.6 Onboarding **[CODE]**

Module `addons/onboarding` **vẫn tồn tại ở cả 17.0, 18.0, 19.0**. Nhưng **không có tham chiếu onboarding nào trong `addons/crm`** và không có component onboarding trong `addons/web/static/src`. ⇒ Onboarding panel là cơ chế **opt-in theo từng app** (Accounting, Sales…), không phải chrome mặc định. **Không nên là ưu tiên của `cmc_edu`.** **[CODE] + [SUY LUẬN]**

---

## 6. Kanban bản mới

**Arch parser** (`views/kanban/kanban_arch_parser.js`) — các thuộc tính có thật ở 19.0:

| Thuộc tính | Mặc định | Ghi chú |
|---|---|---|
| `records_draggable` | `true` | dòng 19 |
| `groups_draggable` | `true` | dòng 20 |
| `quick_create` | `true` (nếu có quyền create) | dòng 27 |
| `default_group_by` | — | tách theo dấu phẩy (nhiều mức!), dòng 28 |
| `on_create` | — | `"quick_create"` để bắt form nhanh, dòng 31 |
| `quick_create_view` | — | trỏ tới một form rút gọn, dòng 32 |
| `<progressbar field colors sum_field help>` | — | dòng 179–183 |

**Progress bar đầu cột** (CRM 19.0 thực tế):
```xml
<progressbar field="activity_state"
             colors='{"planned": "success", "today": "warning", "overdue": "danger"}'
             sum_field="expected_revenue"
             help="This bar allows to filter the opportunities based on scheduled activities."/>
```
⇒ Thanh **không** gom theo giai đoạn; nó gom theo **tình trạng hoạt động** (đã hẹn / hôm nay / quá hạn) và hiện **tổng tiền** của cột. Bấm vào một dải để lọc cột theo dải đó (`onBarClicked`). Đây là "đèn giao thông" cho cả cột. **[CODE]**

**Đếm bản ghi:** `kanban_header.xml:10,17` — `(N)` cạnh tên cột, ẩn khi `useSampleModel`.
**Quick create trong cột:** nút `+` `o_kanban_quick_add` ở header (`kanban_header.xml:21`), chỉ hiện khi `env.isSmall or !group.isFolded`.
**Header sticky:** `position-sticky top-0 z-1`.
**Chặn kéo-thả theo điều kiện:** có — `canMoveRecords` kiểm tra `groupByField`, cộng `canUseSortable` (tắt trên mobile). **Không có cơ chế "chặn theo domain nghiệp vụ" ở tầng arch**; nếu muốn chặn O2→O5 phải làm ở server. **[CODE]**
**`group_expand`:** **không** nằm trong arch kanban — đây là thuộc tính **của trường Python** (`fields.Many2one(..., group_expand='_read_group_stage_ids')`) khiến các stage rỗng vẫn trả về trong `read_group`. **[SUY LUẬN từ CODE]** — tôi không đọc file field Python để khẳng định 100%, xem §10.

**Đáng làm cho `cmc_edu` / bỏ:**

| Pattern | Phán quyết |
|---|---|
| Cột 90% + scroll-snap trên mobile | **LÀM NGAY**, chi phí ~4 dòng CSS |
| Header cột sticky + đếm `(N)` | **LÀM NGAY** |
| Progress bar theo tình trạng hoạt động + tổng tiền, bấm để lọc | **LÀM NGAY** cho pipeline O1→O5 (dùng activity/rotting state) |
| Quick create trong cột (`+` ở header) | **LÀM SAU** — cần một form rút gọn riêng |
| Gập cột (desktop) | **BỎ** — 5 cột O1–O5 không cần gập |
| Kéo-thả sắp xếp thứ tự trong cột (`sequence`) | **BỎ** — thứ tự thẻ trong stage không mang nghĩa nghiệp vụ ở `cmc_edu` |
| Kéo-thả đổi stage | **LÀM SAU** + phải chặn ở server theo quy tắc phễu |

---

## 7. List view bản mới

**Có thật trong `crm` 19.0** (`crm_lead_views.xml:344, 753`): `<list string="Leads" sample="1" multi_edit="1">`.

| Tính năng | Bằng chứng | Đánh giá cho `cmc_edu` |
|---|---|---|
| **Sửa inline** | `props.editable` xuyên `list_renderer.js` | **LÀM SAU** — đắt trong React (quản lý dirty state per-cell) |
| **Sửa nhiều dòng (multi_edit)** | `multi_edit="1"` + `ListConfirmationDialog` hiện bảng "Field / Update to:" | **LÀM SAU**; nếu làm thì **bắt buộc** kèm dialog liệt kê thay đổi |
| **Dòng tổng chân cột** | `list_renderer.xml:94-127` `<tfoot class="o_list_footer">`, `aggregates[column.name]` + `data-tooltip` = `aggregates[...].help`, có popover đa tiền tệ | **LÀM NGAY** — rẻ, và là thứ tạo cảm giác "hệ thống biết đếm" |
| **Cột tuỳ chọn ẩn/hiện** | `list_renderer.xml:49-61` dropdown `oi-settings-adjust`, nhóm `optionalFieldGroups` | **LÀM NGAY** — đây là vũ khí chống "bảng quá nhiều cột" |
| **Nhóm gập/mở** | `o_group_header ... o_group_open`, mỗi nhóm có pager riêng (`groupPagerColspan`) | **LÀM SAU** |
| **Ghim cột (freeze)** | **KHÔNG TÌM THẤY** trong `addons/web`. Chỉ có sticky **header** (≥md) | Odoo **không có** freeze cột — đừng viện dẫn Odoo để biện minh |
| **Phân trang `80/1234`** | `core/pager/pager.xml` — số bấm được để nhập tay; `1234+` bấm để đếm chính xác; ẩn số trên mobile | **LÀM NGAY** (kể cả mẹo `+` khi chưa đếm hết) |
| **Độ rộng cột tự động** | `useMagicColumnWidths` (`column_width_hook.js`, mới ở 18) | **BỎ** — dùng `table-layout` + `min-width` là đủ |
| **Sample data** | `sample="1"` → bảng giả mờ khi rỗng (`o_view_sample_data`, mixin `o-sample-data-disabled`) | **LÀM SAU** — đẹp nhưng không giải quyết điểm đau nào |

**Cái tạo cảm giác "nhanh" mà `cmc_edu` đang thiếu, xếp theo giá/chi phí:** (1) dòng tổng ở chân cột, (2) cột tuỳ chọn, (3) pager kiểu `80/1234` với mũi tên, (4) `rpc_cache` (19 thêm `core/network/rpc_cache.js` + `utils/indexed_db.js` — tương đương TanStack Query bạn đã có sẵn nếu dùng tRPC + React Query). **[SUY LUẬN]**

---

## 8. Phê phán — cái KHÔNG nên bắt chước

Nói trước cho sòng phẳng: **tôi không tìm được thread Reddit r/Odoo hay bài HN nào ở dạng nguồn sơ cấp trích dẫn được** trong ngân sách tìm kiếm. Web search trả về phần lớn blog partner (nội dung tiếp thị) và PR GitHub. Vì vậy phần này chia làm 2: **phê phán có bằng chứng** và **phê phán nghe được nhưng chưa xác minh**.

### 8.1 Có bằng chứng — Odoo tự thừa nhận **[CODE]**

- **`t-portal` breadcrumb là nợ kỹ thuật.** Comment nguyên văn trong `control_panel.xml`:
  > *"Here be dragons... REFACTORME: this `t-portal` introduces an implicit dependency between the ControlPanel and the NavBar, which the impact is only mitigated by the fallback below. This is a call to refactor the breadcrumbs management…"*
  ⇒ **Đừng chép cơ chế portal breadcrumb.** Ở React thì đặt breadcrumb trong layout shell ngay từ đầu.
- **Đợt đại tu input trên `master` (hướng tới Odoo 20) gây regression hàng loạt.** Trong odoo/odoo#250051, chính reviewer nội bộ dán loạt ảnh so sánh 19.2 vs master và developer trả lời:
  > *"Of course it was impossible to do such task without creating bugs, issues, etc… Some layouts had intentionally be changed, because how they were designed just don't make sense or look terrible on small screen."*
  ⇒ Hai điều: (a) Odoo **vẫn đang sửa** layout form cho màn nhỏ tính đến 2026 — nghĩa là **họ chưa xong**, đừng coi 19 là đích; (b) họ thay đổi layout mà **PO nghiệp vụ chưa duyệt** (reviewer nêu thẳng: *"it appears some layout changes are things that should've been approved by a logistics PO"*).
- **`o-tooltip--technical` 13 dòng thông tin** — nếu lỡ để lộ ra ngoài dev mode thì là thảm hoạ. Đừng làm tooltip đa dụng.
- **List mobile** (§3.4): bảng cuộn ngang, mất sticky header dưới `md`, mất checkbox trên cảm ứng mà không có đường vào chọn dòng rõ ràng. **Đây là lỗ hổng thật, có thể kiểm chứng trong code.**
- **Hai hệ breakpoint lệch nhau** (JS `isSmall` ≤767 vs SCSS `sm` 576). Nguồn gây bug âm thầm.

### 8.2 Nghe được nhưng CHƯA xác minh **[KHÔNG NGUỒN]**

- "Odoo 17 giảm mật độ thông tin, nhiều khoảng trắng quá" — web search có tổng hợp ý này nhưng **không dẫn được về một thread người dùng cụ thể**. Bằng chứng gián tiếp duy nhất tôi có: cỡ chữ nền 13→14px giữa 16 và 17 (§1.1). Đó là +7,7% chiều cao dòng, không phải "nhiều khoảng trắng quá".
- "Odoo 19 ra mắt đầy bug, nên ở lại 18" — có một bài LinkedIn (Arsalan Yasin, ~11/2025) tuyên bố 40+ bug trên cài đặt sạch, tập trung ở **Website builder / trình soạn thảo text**. Đây là **ý kiến cá nhân, không kiểm chứng được**, và phần bị phàn nàn (website builder) **không liên quan** tới các pattern backend mà `cmc_edu` định chép.
- Odoo 19 "OWL frontend refresh làm list/kanban/form nhanh hơn, mobile parity tốt hơn" — chỉ thấy trên blog partner, **không có benchmark**. Đối chiếu code: 19 có thêm `rpc_cache` + `indexed_db` (có cơ sở tin là nhanh hơn thật) nhưng "mobile parity" thì bằng chứng code chỉ có `bottom_sheet` + `control_panel_mobile.css`.

### 8.3 Cái KHÔNG nên bắt chước — danh sách chốt

| Không chép | Lý do |
|---|---|
| List mobile = bảng cuộn ngang | Kém thật, có bằng chứng code (§3.4) |
| `t-portal` breadcrumb lên navbar | Odoo tự gọi là "here be dragons" |
| Statusbar "gập cho vừa" bằng vòng `while (areItemsWrapping())` đo DOM | Đo layout trong render = jank ở React; dùng breakpoint |
| `useMagicColumnWidths` | Phức tạp, lợi ích nhỏ |
| Onboarding panel theo app | Cơ chế nặng, Odoo cũng không dùng cho CRM |
| Ba nhánh layout chatter `COMBO`/`EXTERNAL_*` | Phụ thuộc trình xem đính kèm + pop-out window mà `cmc_edu` không có |
| `sample="1"` (dữ liệu giả) | Rủi ro người dùng tưởng là dữ liệu thật; giá trị thấp |

---

## 9. Kết luận hành động cho `cmc_edu`

Thang chi phí: **THẤP** = <1 ngày; **VỪA** = 1–3 ngày; **CAO** = >3 ngày hoặc chạm kiến trúc.

### 9.1 LÀM NGAY (tỷ lệ giá trị/chi phí cao nhất)

| # | Pattern | Điểm đau | Chi phí | Ghi chú thực thi |
|---|---|---|---|---|
| 1 | **Chuẩn hoá token**: thang cỡ chữ 4 bậc (14 / 13 / 12 desktop, **16 trên cảm ứng**), một bán kính 4px (sm 3 / lg 6), một thang spacing | #1 | THẤP | Đây là toàn bộ "bí quyết nhất quán" của Odoo (§1.1). Làm trước mọi thứ khác. |
| 2 | **Kanban mobile**: cột `width: 90%` + `scroll-snap-type: x mandatory` + `scroll-snap-align: center`, tắt drag khi `isSmall` | #3 | THẤP | 4 dòng CSS + 1 điều kiện (§3.5) |
| 3 | **Quy tắc "hành động chính + ⋮"**: trên `<md`, chỉ nút primary là nút thật, phần còn lại vào dropdown ellipsis. Áp cho header form, control panel, statusbar (statusbar → 1 dropdown) | #3, #4 | THẤP | Copy nguyên `status_bar_buttons.xml` (§3.6) |
| 4 | **Rotting**: `rottingThresholdDays` per stage O1–O5 + badge "12d" + filter "Đang mục rữa" | #4 | THẤP | Tính năng mới nhất của Odoo 19, khớp phễu `cmc_edu` như đo ni (§5.2) |
| 5 | **9 quy tắc viết chữ** (§4.6) + rà lại toàn bộ empty state về khuôn 2 dòng | #2 | THẤP | Rẻ nhất, tác động rộng nhất lên #2 |
| 6 | **BottomSheet** cho mọi select/dropdown khi `isSmall && hasTouch()` | #3 | VỪA | Đòn đơn lẻ mạnh nhất cho mobile (§3.1). Dùng Vaul/Radix Drawer, đừng tự viết. |

### 9.2 LÀM SAU

| # | Pattern | Điểm đau | Chi phí | Điều kiện |
|---|---|---|---|---|
| 7 | **Chatter**: ≥1400px sang phải (rộng cố định), <1400px xuống đáy, ẩn trong dialog | #1, #3 | VỪA | Làm khi bắt đầu chatter — làm đúng ngay lần đầu |
| 8 | **Breadcrumb responsive**: desktop 3 mức cuối + "…" dropdown; mobile chỉ mũi tên ← + tên bản ghi | #3, #4 | THẤP | Nhưng **đừng** dùng portal |
| 9 | **Dòng tổng chân bảng + cột tuỳ chọn ẩn/hiện + pager `80/1234`** | #1, #4 | VỪA | §7 |
| 10 | **Thanh chọn hàng loạt**: "N đã chọn" + "Chọn tất cả 1234 kết quả" tách bạch | #4 | VỪA | Chỉ khi có thao tác hàng loạt thật |
| 11 | **List → thẻ trên `<md`** (đi TRƯỚC Odoo) | #3 | VỪA–CAO | Cần định nghĩa "3 trường quan trọng nhất" cho mỗi loại bản ghi |

### 9.3 BỎ (ít nhất trong 6 tháng tới)

| Pattern | Lý do bỏ |
|---|---|
| **Command palette Ctrl+K** | Giá trị thật đến từ provider tự quét `[data-hotkey]` — mà `cmc_edu` chưa có hệ hotkey. Xây từ đầu = CAO. Trung tâm giáo dục dùng chuột, không phải power user bàn phím. **YAGNI.** |
| **Inline edit / multi-edit trong list** | Chi phí CAO trong React (dirty state từng ô, validate, rollback). Nghiệp vụ `cmc_edu` có duyệt phiếu thu — sửa hàng loạt là rủi ro chứ không phải tiện ích. |
| **Onboarding banner theo app** | Nặng, Odoo cũng không dùng cho CRM |
| **Sample data (`sample="1"`)**, ghim cột, `useMagicColumnWidths`, gập cột kanban, sequence trong cột | Giá trị thấp / Odoo cũng không có |

### 9.4 Pattern phụ thuộc CHẶT vào kiến trúc Odoo — chép sẽ đắt hoặc sai **[SUY LUẬN]**

| Pattern Odoo | Phụ thuộc | Hệ quả cho `cmc_edu` |
|---|---|---|
| `invisible="state != 'draft'"` trên nút | **Trình biên dịch view XML** đánh giá biểu thức Python trên record đang mở | Ở React chép được *kết quả* (điều kiện hiển thị nút) rất rẻ — nhưng đừng xây một "ngôn ngữ biểu thức" để bắt chước cơ chế. Viết TS thẳng. |
| `optional="show"/"hide"` | Lưu lựa chọn của user vào **`ir.ui.view` / local storage per view id** | Cần một khoá lưu trạng thái cột theo (user, view). Chi phí VỪA, không CAO — nhưng phải quyết chỗ lưu ngay. |
| `groups="base.group_user"` trên từng field | **Hệ nhóm quyền + record rules của Odoo**, đánh giá server-side khi trả arch | `cmc_edu` phải tự lọc field theo role ở tầng tRPC. **Đừng** làm ẩn hiện chỉ ở client. |
| Chatter + `tracking=True` | **ORM `mail.thread`** tự ghi `mail.tracking.value` mỗi lần write | Ở Prisma phải viết middleware/extension ghi audit log. Chi phí VỪA–CAO. Đây là chỗ đắt nhất trong danh sách. |
| `rotting` | Mixin đọc `mail.tracking.value` để biết lần đổi stage cuối | **Rẻ hơn nhiều nếu bạn chỉ lưu `stageEnteredAt: DateTime` trên bản ghi cơ hội.** Không cần dựng cả hệ tracking để có rotting. ← khuyến nghị |
| `<progressbar sum_field=…>` | `read_group` của ORM gom nhóm + tổng ở server | tRPC procedure trả `{stage, countByActivityState, sumRevenue}`. Chi phí THẤP nếu thiết kế endpoint từ đầu. |
| Command palette provider quét `[data-hotkey]` | Toàn bộ UI đã gắn `data-hotkey` sẵn | Chép được về mặt ý tưởng, nhưng phải gắn hotkey khắp nơi trước. Đây là lý do #9.3 xếp nó vào BỎ. |
| Statusbar "gập cho vừa" | Đo DOM đồng bộ trong render | Ở React sẽ jank. Dùng breakpoint cứng. |

---

## 10. Những gì tôi KHÔNG xác minh được

1. **Lý do Odoo đặt chatter sang phải.** Không có tuyên bố chính thức. Chỉ có cơ chế. **[KHÔNG NGUỒN]**
2. **Cách chọn dòng ĐẦU TIÊN trên list mobile.** Checkbox bị `display:none` trên touch, chế độ chọn chỉ kích hoạt khi `selection.length > 0`. Không tìm thấy long-press handler nào trong `addons/web`. Có thể nằm ở `web_enterprise` (không có trong repo community) hoặc là bug thật. **[KHÔNG NGUỒN]**
3. **Tính năng đóng/mở chatter.** Biến `--Chatter-asideExtraWidth` có comment nhắc tới "close chatter feature" nhưng không có code trong community. Nghi là Enterprise. **[KHÔNG NGUỒN]**
4. **`group_expand`.** Tôi suy ra là thuộc tính field Python (không có trong `kanban_arch_parser.js`), nhưng chưa đọc file `crm_lead.py` / `crm_stage.py` để xác nhận. **[SUY LUẬN]**
5. **Phê phán từ cộng đồng.** Không tiếp cận được thread Reddit/HN gốc trong ngân sách 5 truy vấn web (đã dùng 4). Phần §8.2 là ý kiến chưa kiểm chứng, **không dùng làm căn cứ ra quyết định.**
6. **Odoo 19 có nhanh hơn 18 thật không.** Không có benchmark nào. Bằng chứng gián tiếp: 19 thêm `rpc_cache.js` + `indexed_db.js`.
7. **Nội dung release note chi tiết của v19/v19.4.** Trang `odoo.com/page/release-notes` chỉ là index; các trang "View more" chưa fetch. Nếu cần danh mục tính năng theo marketing thì đọc thêm, nhưng tôi tin **danh sách file thêm/xoá ở §1.3 chính xác hơn** bất kỳ release note nào.
8. **`web_enterprise`** không tồn tại trong repo `odoo/odoo` (chỉ community). Mọi kết luận ở đây là về **Odoo Community 19.0**.

## 11. Câu hỏi cần chủ dự án quyết

1. **`cmc_edu` có bao nhiêu % lượt dùng trên mobile thật?** Nếu <10%, hạng mục #6 (BottomSheet) nên tụt xuống "làm sau" và #11 (list→thẻ) nên bỏ. Nếu >30%, cả hai lên đầu bảng.
2. **Có làm audit log/tracking trường không?** Đây là điều kiện tiên quyết của chatter kiểu Odoo. Nếu chưa quyết, **hãy làm `stageEnteredAt` trước để có rotting** — được 80% giá trị với 10% chi phí.
3. **`optional` cột lưu ở đâu** — localStorage (rẻ, mất khi đổi máy) hay bảng `user_view_preference` (đúng, thêm 1 bảng)? Quyết trước khi code hạng mục #9.
4. **Ngưỡng 1400px cho chatter bên phải có hợp với màn hình thật của nhân viên trung tâm không?** Laptop 1366×768 rất phổ biến ở VN ⇒ **sẽ KHÔNG BAO GIỜ thấy chatter bên phải**. Cân nhắc hạ ngưỡng xuống 1200px (XL) thay vì bê nguyên 1400 của Odoo.
