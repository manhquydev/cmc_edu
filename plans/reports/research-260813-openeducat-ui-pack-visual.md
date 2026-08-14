# Phân tích giao diện OpenEduCat từ screenshot pack

**Ngày:** 2026-08-13  
**Nguồn:** `/home/manhquy/Downloads/openeducat-ui-pack` — 36 PNG, 1280×800, Odoo 18 Community + OpenEduCat 18, `127.0.0.1:8069`  
**Đối tượng:** CMC EDU v2 admin (`apps/admin` + `@cmc/ui` console)  
**Mục tiêu chủ hệ thống:** giao diện y hệt về design và bố cục.

Agent song song: chrome ([chrome](bdc3723f-bfa7-46a1-b0dd-ca99a7d81eef)) · list/kanban/form ([forms](d679d8a8-c921-4ef0-8c15-a48e653f148b)) · inventory CMC ([inventory](e2de23d2-e066-4291-9277-ebeb505208fe)). Hex đo pixel trên PNG (sai số nén ±2–4).

Hợp đồng visual: [`design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md`](../../design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md)  
Kế hoạch clone: [`plans/260813-2038-openeducat-visual-clone/plan.md`](../260813-2038-openeducat-visual-clone/plan.md)

---

## 1. Kết luận ngắn

OpenEduCat không phải một “theme giáo dục”. Nó là **Odoo web client**: navbar tím 46px + control panel một hàng + workspace. Mọi module SIS / Admissions / Attendance / Exams dùng **cùng chrome**; chỉ đổi menu ngang và field nghiệp vụ.

CMC đã có **bộ xương** (`.o_web_client`, `ConsoleNavbar`, 4 page frame, statusbar chevron) nhưng **không y hệt** vì bốn lệch có thể đo:

1. **Control panel:** Odoo = một hàng 3 vùng (New+title | search | pager+view). CMC `ControlBar` = xếp chồng header / filters / footer.
2. **CTA:** Odoo tô tím `#71639E`. CMC vẫn khóa Apple-blue `#0071E3` cho nút tương tác (navbar tím chỉ “decorative”).
3. **Kanban SIS:** thẻ ngang ảnh+tên+city+email, 3 cột, gutter 16px. CMC kanban là cột pipeline + color bar.
4. **Chatter:** trên pack 1280px nằm **dưới form**. CMC SKIP, chưa có UI.

Pack này là **Community** (`$o-community-color` `#71639E`). README pack ghi `#714B67` (Enterprise) — **sai so với ảnh**. Pixel navbar: `#70619D` / `#6D639F`. Canonical token: `#71639E`.

---

## 2. Bố cục chung (product OS)

Mọi màn backend (01–30, 34–36) cùng một khung. Website (31–33) là frontend builder — **không** dùng làm admin.

```
┌──────────────────────────────────────────────────────────────┐
│ NAVBAR          46px   nền #71639E   chữ/icon trắng          │
├──────────────────────────────────────────────────────────────┤
│ CONTROL PANEL   ~58px  nền #FFFFFF   hairline đáy #E0E0E0    │
│  LEFT: New + title/breadcrumb + gear                         │
│  CENTER: SearchBar 35×~411px                                 │
│  RIGHT: pager + view switcher                                │
├──────────────────────────────────────────────────────────────┤
│ WORKSPACE  (cuộn)                                            │
│  list: bảng full-bleed                                       │
│  kanban: canvas #F8F9FA + lưới 3 cột                         │
│  form: canvas + sheet trắng inset 16px + chatter dưới        │
│  calendar: lưới tuần + mini-calendar phải                    │
│  settings: sidebar module + khối section                     │
└──────────────────────────────────────────────────────────────┘
```

Không sidebar app-level. App switcher là dropdown text-only từ 9-dot. Discuss mới có rail kênh riêng.

### Navbar (46px)

Trái → phải:

| Slot | Spec |
|------|------|
| 9-dot | App switcher, glyph ~16px, hit ~46×46 |
| Tên app | 14px/600 trắng — tên **module đang mở** (`SIS`, `Admissions`, `eLearning`), không phải logo |
| Menu ngang | 13–14px/400, gap ~20–24px, không chevron. Hover: overlay tối `rgba(0,0,0,.08)` |
| Spacer | flex grow |
| Chat | outline + badge tròn xanh `#28A745` số trắng |
| Activities | đồng hồ + badge |
| Tên DB | `OpenEduCat` 13–14px/400 |
| Avatar | ~24px **vuông** bo 3–4px |

Hairline đáy navbar `#5C4D87`. Không blur, không shadow, không search trên navbar.

### App switcher (01, overlay trên 35)

List chữ, **không icon**, rộng ~172px, flush dưới 9-dot, item ~28–32px, hover `#EBEBEB`, scrollbar thumb `#8A8A8A`. Không scrim. Không home-menu lưới (Enterprise).

### Module menu (08, 20)

Dropdown neo dưới item navbar. Section header xám 11–12px (Program Management…) hoặc list phẳng 3 item (Attendance). Hover xám. Không mega-menu, không icon.

### Control panel — ba vùng một hàng

Đây là **chữ ký bố cục** Odoo. Cao ~58px.

| Màn | New/Save | Title | Search | Pager | View switcher |
|-----|----------|-------|--------|-------|---------------|
| List / kanban | New solid tím | Model 18px/700 | Có | `1-25 / 25` | Kanban · List · Activity/Graph |
| Form | New **outline** tím | `Model / Record` 2 cấp | **Không** | `1 / 16` | **Không** |
| Settings | Save + Discard | Settings | Có (lọc setting) | Không | Không |
| Discuss | Không | Inbox | Icon kính lúp | Không | Không |
| Apps | Không | Apps | Có + facet | `1-68 / 68` | Kanban + List |

Search: cao 35px, radius **3–4px** (không pill), kính lúp trái, caret phải (Filters / Group By / Favorites — panel **không chụp** trong pack). Facet chip (21, 36): nền `#EAEBF0`, nút x, **không** tô tím. Funnel tím chỉ hiện khi đang có filter.

View switcher active = nền xám `#EDEEF1`, **không** tô primary.

---

## 3. Thành phần chung

### 3.1 List

Header xám `#F8F9FA`, hàng 40px, **không kẻ dọc**, hover `#F2F2F2`, checkbox cột 1, column configurator mép phải header. Ô trống = trắng, không “—”.

Status pill (15): Draft xám; Confirmed/Done xanh `#28A745` chữ trắng. Tag many2many (09): pill xám, stack dọc trong ô, **không x** trên list.

### 3.2 Kanban SIS (02, 05)

3 cột @1280, gutter 16px, card ~384×110px. Ảnh flush trái full-height. Tên đậm / city+email xám / clock góc phải dưới. Viền 1px, radius 4px, **không shadow**.

Khác CRM pipeline: đây là **grid thẻ người**, không cột giai đoạn.

### 3.3 Kanban eLearning (29)

Card cao ~220px. Ribbon chéo **PUBLISHED** xanh góc phải. Tag pastel. Nút View course tím. Footer 4 metric (Invited / Ongoing / Finished / Total).

### 3.4 Form

Sheet trắng trên canvas `#F8F9FA`, inset 16px, radius 4px, pad 24–32px. Hai cột label xám / value đen. Many2one = link tím. Read mode trên mọi form pack (không ô input).

Notebook: gạch chân tím 2px **hoặc** tab hộp chữ U (`10` Subjects).  
Smart buttons: cụm phải, icon+label+số, trước pager.  
Statusbar chevron: căn phải, bước hiện tại lavender `#E0D9F1` + mũi tím — **không** tô đặc 100% tím.  
New trên form = outline, không solid.

`04-sis-student-form.png` **là Settings** (overlay switcher), không phải form Emma. Form student SIS **thiếu trong pack** — đừng bịa smart button Invoiced/Assignment.

### 3.5 Chatter (dưới form, 1280px)

Send message (tím) · Log note (xám) · Activities. Phải: search · clip · followers · Follow. Timeline ngày giữa kẻ ngang. Bot: avatar vuông + “{Model} created”. User (30): bubble cyan nhạt.

Odoo 19 đặt chatter **cột phải ≥1400px**. Pack 1280 = dưới form. Clone theo pack cho desktop hẹp; ≥1400 có thể tách cột (quyết định owner CRM: 1200px).

### 3.6 Calendar (17)

CP + toolbar tuần (‹ › Week Today) + lưới 06:00–20:00 + ngày hiện tại khoanh đỏ + now-line đỏ + mini-calendar phải. View switcher: Calendar · Kanban · List · Pivot.

### 3.7 Settings (34)

Save/Discard trên CP. Sidebar trái icon+tên module. Section Users / Languages / Companies. Invite solid tím.

### 3.8 Website (31–33) — ngoài admin OS

Navbar vẫn tím nhưng thêm Edit teal, Published xanh, preview mobile. Đây là website builder, không phải console SIS. LMS CMC giữ `lms-*` riêng.

---

## 4. Token đo được vs CMC

| Token | OpenEduCat (đo / canonical) | CMC `console.css` | CMC `tokens.css` |
|-------|-----------------------------|-------------------|------------------|
| Navbar | `#71639E` | `#71639e` ✓ | không dùng |
| CTA / New / Send | cùng tím navbar | **Apple-blue `#0071E3`** (policy) | `#0071E3` LOCKED |
| Canvas | `#F8F9FA` | `#f8f9fa` ✓ | `#F5F3EE` ấm |
| Radius control | **4px** | 4px ✓ | **12 / 16 / 20** |
| Body | 14px | 14px ✓ | 14px Inter |
| Navbar height | 46px | 46px ✓ | — |
| Row list | 40px | cell pad Odoo-like | `--cmc-row-h: 48px` |
| Badge | `#28A745` | `--console-success` ✓ | `#2e7d32` |
| Shadow | **không** | phẳng trong `.o_web_client` | whisper elevation |
| Blur navbar | **không** | không | `--cmc-blur-nav` |

Kết luận: **token chrome đã gần**. Lệch chính là **CTA blue**, **ControlBar xếp chồng**, **kanban không cùng grammar SIS**, **chatter thiếu**.

---

## 5. Ma trận gap (ưu tiên clone)

| # | Bề mặt | Pack | CMC | Việc |
|---|--------|------|-----|------|
| P0 | Control panel 1 hàng 3 vùng | Có | Stack 3 hàng | Đổi `ControlBar` slot LEFT/CENTER/RIGHT |
| P0 | Primary = tím Community | Có | Blue CTA | Bỏ khóa Apple-blue **trong** `.o_web_client` |
| P0 | List 40px / không kẻ dọc / pill | Có | DataTable gần | Densify + status pill + configurator |
| P1 | Kanban SIS grid thẻ | 02, 05 | Pipeline columns | Thêm `KanbanRecordGrid` |
| P1 | Form sheet + New outline + tabs | Có | Detail/Form sheet | New outline, smart btn trước pager |
| P1 | Statusbar lavender current | Có | Chevron 38px | Khớp 33px + màu current |
| P1 | View switcher dùng chung | Có | Chỉ CRM `?view=` | Extract component |
| P1 | Search facet + caret menu | 21, 36 | FilterBar lite | SearchChrome |
| P2 | Chatter dưới form | Có | SKIP | Làm theo chương trình CRM |
| P2 | Systray chat/activities | Có | ⌘K + role + logout | Badge + avatar menu |
| P2 | Calendar tuần + mini | 17 | FullCalendar SoftOps | Skin Odoo |
| — | Website builder | 31–33 | LMS riêng | **Không clone vào admin** |
| — | Form student SIS | Catalog ghi 04 | — | **Thiếu ảnh — không bịa** |

---

## 6. Cấm khi clone (dấu hiệu “SaaS hiện đại”)

Glass / blur navbar · gradient tím · radius 12–24 · pill search · shadow 8–24px · sidebar primary nav · icon trong app switcher Community · view switcher tô primary · avatar tròn lớn · Inter tracking âm · CP cao >72px · New cao 40px.

Density: CP 58px chứa New + title + search 411px + pager + 3–4 icon. Clone sai = “thở” quá.

---

## 7. Việc không có trong pack (đừng bịa)

Login · CRM pipeline · panel Filters/Group By/Favorites sau caret · user menu · company switcher · hover/focus ring động · responsive <1280 · dark mode · chatter cột phải ≥1400 · form student SIS thật.

Website homepage còn placeholder “Welcome to your Homepage!”.
