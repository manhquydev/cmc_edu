# LANE L2 — Components & States Audit

**Date:** 2026-08-13  
**Branch / cwd:** `audit/design-system-impeccable` · `/home/manhquy/.herdr/worktrees/cmc_edu/audit-design-system-impeccable`  
**Scope:** `packages/ui/src/console/console-navbar.tsx`, `packages/ui/src/console/console-kanban.tsx` (+ `packages/ui/src/console.css` mà hai primitive này yêu cầu) và `apps/admin/src/pages/**`  
**Mode:** Impeccable **audit + critique** (Operate — admin ERP+LMS). Chỉ đọc. Không sửa code. Không `pnpm install`/`build`.  
**Method:** dual-agent (A: `019ff720-96a1-77a0-a859-39da44357b2e` ui-ux-designer · B: `019ff720-96a2-71d2-be13-25e3992faf57` explore) + scout `explore` `019ff721-35b0-7d80-b314-189a05539299`. Namespaced `ak-engineer:Explore` bị harness reject (case-fold); scout chạy `explore` + đọc trực tiếp. Detector CLI chạy ở parent (B không có shell). Browser visualization **bỏ** — lane cấm build, không có app đang chạy.

> ⚠️ Browser overlays không có. Contrast/computed-style là đọc CSS, không đo runtime.

---

## Scores (hệ quy chiếu Impeccable)

### Critique — Nielsen (Operate)

| # | Heuristic | Score | Key issue |
|---|-----------|------:|-----------|
| 1 | Visibility of System Status | 2 | Kanban `count` ≠ số thẻ đang hiện; navbar không đánh dấu section hiện tại |
| 2 | Match System / Real World | 2 | Nhiều nhãn VN tốt, vẫn còn O1–O5 / Lost / Roles / User ID (auth identity) |
| 3 | User Control and Freedom | 2 | Dialog có Hủy; `/change-password` tắt chrome; không undo “Chuyển lên” |
| 4 | Consistency and Standards | 2 | ListPage/FormPage/Dialog lặp tốt; validation và row-click lệch nghĩa |
| 5 | Error Prevention | 2 | Receipt-create vững; modal form chỉ disable nút; ngày lớp là free-text |
| 6 | Recognition Rather Than Recall | 2 | Icon-only view switcher; row-click = phân quyền không nói trước |
| 7 | Flexibility and Efficiency | 2 | ⌘K (shell) có; bảng/kanban gần như mouse-only |
| 8 | Aesthetic and Minimalist Design | 2 | Thẻ CRM chồng 3–4 CTA; funnel + board + pager cùng một màn |
| 9 | Error Recovery | 2 | DataTable Banner tốt; nhiều mutation error là `<span>` không gắn field |
| 10 | Help and Documentation | 1 | Gần như không có empty dạy việc; login/receipt là ngoại lệ |
| **Total** | | **19/40** | **Poor** (sát ngưỡng Acceptable) |

### Audit — technical

| # | Dimension | Score | Key finding |
|---|-----------|------:|-------------|
| 1 | Accessibility | 2 | Navbar/kanban không `:focus-visible`; `role="menu"` thiếu arrow/trap; row click mouse-only; `aria-invalid` = 0 trên pages |
| 2 | Performance | 3 | Detector: `transition: width` ở `revenue-report.tsx:125` |
| 3 | Responsive | 2 | View switcher 30×30; navbar section `overflow-x` mobile; kanban scroll kép |
| 4 | Theming | 3 | Token console dùng đều; hex cứng ở attendance unmarked / login / shifts |
| 5 | Implementation Integrity | 3 | Odoo-analogue có chủ đích; detector 2 warning (side-tab, layout-transition) |
| **Total** | | **13/20** | **Acceptable** |

### Cognitive load checklist (8)

Fail: single focus · chunking · visual hierarchy · one thing at a time · minimal choices · working memory.  
Partial: progressive disclosure · grouping (ListPage grammar giữ được).  
**6 fail → high cognitive load.**

### Design specificity

Odoo-generic Operate chrome, chưa phải ngôn ngữ “ghi danh một học sinh” của CMC. Navbar/kanban là analogue có chủ đích; sale vẫn vận hành pipeline O1–O5.

### Detector (OBSERVED, parent CLI)

```text
node …/detect.mjs --json apps/admin/src/pages packages/ui/src/console
exit 0
```

| Rule | File:line | Note |
|------|-----------|------|
| `side-tab` | `apps/admin/src/pages/attendance/shifts.tsx:160` | `border-left:3px solid var(--ws-teal)` — callout Odoo, matcher đúng |
| `layout-transition` | `apps/admin/src/pages/finance/revenue-report.tsx:125` | `transition: width` trên bar |

`console-navbar.tsx` và `console-kanban.tsx` **sạch** theo regex engine. Kanban color-rail sống trong CSS `::after`, detector TSX không thấy.

---

## Trả lời 5 câu hỏi

### 1. Visual hierarchy — hành động chính có hiện ngay không?

**Form tiền (receipt-create, check-in punch) thì có. List/kanban/detail thì hay cạnh tranh.**

| Bề mặt | CTA chính? | Cạnh tranh sai thứ bậc |
|--------|------------|------------------------|
| Navbar | Không có “việc hôm nay”. Toggle lưới là chrome, không phải job. | Brand + section + systray icon cùng một dải 46px (`console-navbar.tsx:72–104`, `console.css:94–109`). Section **không** `aria-current` / `.is-active` (`console-navbar.tsx:87–101`). |
| Pipeline | Header: “Thêm cơ hội” primary (`pipeline.tsx:445–450`). | View switcher icon cạnh primary (`421–444`). Trên thẻ O4: “Ghi danh” primary nhỏ cạnh “Chuyển lên” / “Đặt lịch test” / “Đánh dấu mất” (`191–238`). Panel “Pipeline O1 → O5” (`470`) kéo mắt khỏi việc. |
| Receipt list | “+ Tạo phiếu thu” primary, “+ Ghi danh” secondary (`receipt-list.tsx:169–181`). | Hai cửa tạo — cùng một job ghi danh. |
| Users | “Thêm nhân viên” rõ. | Job hàng ngày “Phân quyền” **ẩn trong row-click** (`users.tsx:351`). Cột thao tác chỉ “Đặt lại mật khẩu”. |
| Students | **Không** có primary (`students/index.tsx:77–81`). | Search là cả trang. |
| Schedule | View switcher là **hành động header duy nhất** (`schedule.tsx:291–307`). | 4 icon bằng nhau, không “tạo buổi”. |
| Opportunity detail | “Tạo phiếu thu” primary chỉ ở O4 (`opportunity-detail.tsx:295–301`). | 4–5 nút `sm` ngang hàng + “← Pipeline” (`258–309`); StatActions lặp lại verb (`373–386`). |
| Session detail | “Điểm danh” primary **hai lần** (`session-detail.tsx:222–228` và `345–350`). | Cụm body: Điểm danh + Nhận xét + Nhật ký + Lớp học + Hủy (`222–265`). |
| Check-in | Một CTA lớn “Chấm công” (`check-in-out.tsx:521–549`, `minHeight: 52`). | Đúng thứ bậc Operate. |
| Receipt create | “Tạo phiếu thu” sticky (`receipt-create.tsx:256–265`). “← Quay lại” secondary (`243–249`). | Sau `needsConfirmation` thêm 1 primary + N secondary phía trên form (`276–297`). |

### 2. Độ phủ trạng thái

| Component | hover | focus-visible | active | disabled | loading | empty | error |
|-----------|:-----:|:-------------:|:------:|:--------:|:-------:|:-----:|:-----:|
| `ConsoleNavbar` toggle | CSS `:hover` `console.css:123–125` | **thiếu** | thiếu | n/a (ẩn bằng gate) | n/a | n/a | n/a |
| Section `.console-menu-item` | `150–152` | **thiếu** | thiếu / không current | n/a | n/a | `ul` rỗng nếu gate reject hết | n/a |
| App-switcher tile | `203–205` | **thiếu** | thiếu | n/a | n/a | menu rỗng nếu `apps=[]` | n/a |
| `KanbanBoard` / `Column` | n/a | n/a | n/a | n/a | **không API** | **primitive không render** | không |
| `KanbanCard` | **không** (`330–338`) | **không** (`449–456` chỉ reset button) | không | không | không | n/a | không |
| `.console-view-switcher` | không hover | không | `.is-active` `237–240` | n/a | n/a | n/a | n/a |
| DataTable (pages dùng) | `hasHover` khi `onRowClick` | không trên hàng | n/a | n/a | skeleton 5 hàng | EmptyState **chỉ title** | Banner |
| Login | input/submit có | toggle/submit có (`login.css:150–200`) | submit `187–189` | submit `191–195` | spinner `225–232` | n/a | span, **không** `role="alert"` |
| Check-in punch | Button Astryx | Astryx | — | khi `recorded` `542` | `isLoading` `541` | ticket empty có | Banner `507–508` |

Trang thường cover loading/empty/error qua DataTable/Banner. **Hai primitive L2 chỉ có hover.** Pipeline table (`pipeline.tsx:529–534`) **không** truyền `loading`/`error` — board đợi `ready`, bảng thì đổ `items`.

### 3. Accessibility thật

**Bàn phím**

- Navbar: Escape đóng + trả focus (`console-navbar.tsx:47–52`, test `console-navbar.test.tsx:82–97`) — tốt. **Không** Arrow/Home/End, **không** chuyển focus vào menu khi mở, **không** trap. Tab order khi menu mở: toggle → toàn bộ section → systray → **mới** tới `menuitem` (`71–130`).
- `role="menu"` / `menuitem` (`106–118`) mà không phải menu pattern (không `aria-activedescendant`, không roving tabindex).
- CRM card: `role="button"` + `tabIndex={0}` + Enter/Space (`pipeline.tsx:137–148`) **bọc** `<Button>` thật (`191–238`). Interactive lồng nhau.
- DataTable `onRowClick` chỉ `onClick` (`packages/ui/src/components/data-table.tsx:147–163`) — pages dùng: pipeline, receipts, classes, students, parents, users, aftersale, kpi, payroll, refund, exercises, rewards, shifts, check-in inbox. **Keyboard không mở được dòng.**
- SessionCard trong schedule kanban là `Link` — bàn phím được (ngoài primitive).

**ARIA**

- Navbar: `aria-label="Ứng dụng"`, toggle `aria-expanded`/`aria-controls`/`aria-label` (`72–80`). Tile `aria-current="page"` (`119`) — sai token (nên `true`; `"page"` dành cho liên kết trang).
- Section items không `aria-current`.
- View switcher: `role="group"`/`toolbar` + `aria-pressed` (`pipeline.tsx:421–438`, `schedule.tsx:292–299`).
- Kanban board/column/header là `<div>`/`<span>` không landmark, count không `aria-label` (`console-kanban.tsx:15, 32–37`).
- Pages: `aria-invalid` = 0, `aria-describedby` = 0, `htmlFor` chỉ login (`login.tsx:115, 131`). `role="alert"` gần như chỉ `pipeline.tsx:476`.

**Focus trap overlay**

- App-switcher: **không trap** (overlay `position:absolute`, không `aria-modal`).
- Dialog trang: comment tin Astryx native `<dialog>` (`users.tsx:357–362`, `parents/index.tsx:259–264`, `exercises.tsx:278`). **Không chứng minh được trong lane này** (không browser).
- `window.confirm` hủy buổi (`session-detail.tsx:255–261`) — trap native, lệch ConfirmDialog.

**Target size**

| Control | Size | Pass 24px (2.5.8) | Pass 44px (TL / AAA) |
|---------|------|:-----------------:|:--------------------:|
| App-switcher toggle | 46×46 `console.css:111–116` | yes | yes |
| Section item | height 46, pad-x 10 `141–143` | yes | dọc yes |
| Systray badge | 34×34 `158–165` | yes | **no** |
| View switcher | 30×30 `223–229` | yes | **no** |
| Login eye toggle | 30×30 `login.css:130–137` | yes | **no** |
| Check-in punch | min 52 `check-in-out.tsx:544–547` | yes | yes |
| Attendance roster toggle | `TOUCH_MIN_HEIGHT = 44` `attendance.tsx:59, 118, 139` | yes | yes |

### 4. Cognitive load & mật độ bảng / list / kanban

**Bảng:** padding ô `--console-list-cell-padding-x/y: 0.3rem / 0.5rem` (`console.css:61–62`) — mật độ Odoo, scan được nếu 5–6 cột (receipts, payroll staff). Users cột Roles nổ badge (`users.tsx:54–70`). Shift matrix (`shifts.tsx` ~764–795) là bảng dày nhất (checkbox 15×15 + hours). Students chỉ 2 cột (`students/index.tsx:27–35`) — loãng, không phải roster.

**List:** ListPage + FilterBar `role="search"` là grammar tốt. Students không phải list — lookup ≥2 ký tự (`60–62, 120–125`). Receipt `q` lọc **client trên trang 50** (`receipt-list.tsx:123–136`) — search giả.

**Kanban:** 320px card, cột `max-height: min(70vh, 640px)` + board `overflow-x` + body `overflow-y` (`console.css:259–302`) — scroll lồng. Pipeline: FunnelBar + 5 cột + count server + “Chưa có” + pager 20 item phẳng (`pipeline.tsx:34, 287–293, 342–351, 500–558`). Count cột ≠ số thẻ. Schedule kanban trung thực hơn (count = children, `schedule.tsx:241`) nhưng thẻ là `SessionCard`, không `KanbanCard` (`245`) — hai ngôn ngữ trên một board.

### 5. Form UX

| Form | Nhãn | Validation | Lỗi | Submit |
|------|------|------------|-----|--------|
| Login `login.tsx:107–158` | `htmlFor` + required | HTML + `canSubmit` | span generic, không gắn field, không live region | `type="submit"`, disabled, spinner |
| Change-password `15–93` | PasswordInput `isRequired` | min 8 + khớp | span gộp `82–86` | **không `<form>`**, `onClick` — Enter có thể không gửi |
| Receipt-create `37–56, 232–385` | VN, required, description LMS | `validate()` + live sau lần submit | `status: { type: 'error' }` + Banner | `type="submit"` + `isLoading` + disable sau success |
| Create-lead `87–136` | required name/phone | chỉ non-empty `69` | mutation `<span>` `121–126` | disable khi `!isValid` — không nói vì sao |
| Mark-lost `74–97` | Selector required | empty → disable | span `82–87` | loading |
| Schedule-test `59–75` | DateTimeField **không** `isRequired` | empty → disable | span | loading |
| Users create `378–448` | “User ID (auth identity)” EN | conjunction `250–256` | span `428–433` | disable chết cho đến đủ 5 field |
| Users roles `473–474` | **“Roles”** EN | không chặn roles rỗng | span | loading |
| Class create `493–656` | combobox/selector tốt | `validateCreateForm` `130–158` | field `status` + slots dump 1 dòng `605–608` | `isDisabled={!isFormValid}` **trước** submit — lỗi ngày/slot chưa hiện |
| Session-assessment `167–195` | heading số + `isLabelHidden` | — | Banner confirm-all `159` | “Xác nhận tất cả” disable khi không draft |
| Check-in offsite dialog | TextArea lý do | — | Banner | loading + Dialog |

**Pattern:** form tiền và login gần production. Modal CRM/admin là “tắt nút và hy vọng”. `aria-invalid` không xuất hiện trên pages.

---

## Findings theo mức

### P0 — chặn việc hoặc nói dối trạng thái

#### P0-1. Kanban CRM là list phân trang đội lốt cột

- **Where:** `apps/admin/src/pages/crm/pipeline.tsx:34`, `:287–293`, `:342–351`, `:353–354`, `:506–508`, `:537–558`
- **Impact:** `count` cột = tổng server; thẻ = trang phẳng 20. Sale thấy “Đã kiểm tra 8” và “Chưa có”. Heuristic 1 + 6. Không tin được board.
- **Fix:** fetch theo stage (hoặc endpoint board), hoặc bỏ kanban cho đến khi query khớp cột. Empty chỉ khi `stageCounts[stage] === 0`, không khi trang hiện tại không có hàng. Pager per-column hoặc infinite trong cột.
- **Command:** `/impeccable shape` (board query) rồi `/impeccable harden`

#### P0-2. Tương tác lồng + không focus-visible trên primitive L2 + mở dòng chỉ bằng chuột

- **Where:**
  - `packages/ui/src/console/console-navbar.tsx:73–129` + `packages/ui/src/console.css:111–205` (không `:focus-visible`)
  - `packages/ui/src/console/console-kanban.tsx:70–88` + `console.css:330–365, 449–456`
  - `apps/admin/src/pages/crm/pipeline.tsx:137–238`
  - pages `onRowClick` (vd. `receipt-list.tsx:227`, `classes/index.tsx:449`, `users.tsx:351`, `students/index.tsx:133`)
- **Impact:** WCAG 2.1.1 / 2.4.7 / 4.1.2. Sam không hoàn tất mở opportunity / phiếu / lớp / user bằng bàn phím. SR đọc cả thẻ CRM như một button chứa button.
- **Fix:**
  1. Thêm `:focus-visible { outline: 2px solid …; outline-offset: 2px }` cho `.console-app-switcher-toggle`, `.console-menu-item`, `.console-app-switcher-tile`, `.console-systray-badge`, `button.console-kanban-card`, `.console-view-switcher button`.
  2. Pipeline: bỏ wrapper `role="button"`. Dùng `KanbanCard onClick` **hoặc** card tĩnh + vùng title là link; action giữ `<Button>` bên ngoài hit-area mở.
  3. Navbar: `aria-haspopup="menu"`; khi mở, focus item đầu; Arrow/Home/End; Tab cycle trong menu hoặc đóng khi Tab ra; `aria-current="true"` trên tile.
  4. DataTable (ngoài scope file nhưng pages phụ thuộc): hàng `tabIndex={0}` + Enter/Space gọi `onRowClick`, hoặc cột “Mở” luôn hiện.
- **Command:** `/impeccable harden` rồi `/impeccable audit`

### P1 — khó dùng / lệch WCAG AA / sai job

#### P1-1. Navbar không nói “bạn đang ở section nào”

- **Where:** `console-navbar.tsx:87–101` — không so sánh path; không class current. Chỉ tile app có `aria-current` (`119`).
- **Impact:** Visibility of status. Phiếu thu và Đối soát trông giống nhau khi đang đứng trên một trong hai.
- **Fix:** truyền `activePath` (hoặc `activeChildId`) từ shell; `aria-current="page"` + class current (nền hover đậm hơn, `font-weight: 600`).

#### P1-2. Hai cửa ghi danh + verb pipeline che job

- **Where:** `receipt-list.tsx:169–181`; `pipeline.tsx:191–215, 445–450`; `opportunity-detail.tsx:258–309`; `session-detail.tsx:222–256, 345–350`
- **Impact:** Jordan không biết bấm cửa nào. Session detail hai primary “Điểm danh”.
- **Fix:** một primary/header. Receipt list: chỉ “+ Ghi danh” (picker quyết định tạo phiếu). Pipeline header giữ “Thêm cơ hội”; trên thẻ chỉ **một** verb đúng stage. Session: EntityHeader giữ Điểm danh; cụm body đổi tab, không lặp primary.

#### P1-3. Modal form disable-không-nói-lý-do; lỗi không gắn field

- **Where:** `create-lead-dialog.tsx:69, 130–136`; `users.tsx:250–256, 442–448`; `mark-lost-dialog.tsx:91–97`; `schedule-test-dialog.tsx:59, 70–75`; `change-password.tsx:50–93`; `login.tsx:154`
- **Impact:** Nút chết = app hỏng. Không `aria-invalid`. Login/change-password error không live region.
- **Fix:** Giống receipt-create: submit được, `validate()`, `status` trên field, `role="alert"` / `aria-describedby`. Change-password bọc `<form onSubmit>`. Schedule-test đánh `isRequired` trên DateTimeField. Login: `aria-invalid` + `aria-describedby="login-error"` + `role="alert"` trên `.login-page__error`.

#### P1-4. Users: row-click = phân quyền; nhãn EN

- **Where:** `users.tsx:351` (`onRowClick` → `openRolesModal`); `55, 379–380, 474` (“Roles”, “User ID (auth identity)”)
- **Impact:** Recognition. Click hàng không đi tới hồ sơ.
- **Fix:** Cột “Phân quyền” visible. Row-click → trang/chi tiết NV nếu có, không mở modal. Đổi nhãn: “Vai trò”, “Mã đăng nhập (email)”.

#### P1-5. Search phiếu thu chỉ lọc trang hiện tại

- **Where:** `receipt-list.tsx:123–136` — query `status/page/pageSize: 50`; `q` `.filter` client.
- **Impact:** Gõ mã phiếu trang 2 → “không có”.
- **Fix:** đưa `search` vào `finance.receiptList` (như pipeline `debouncedSearch`).

#### P1-6. Class create: ngày/giờ free-text; slot error không gắn field

- **Where:** `classes/index.tsx:134–155, 543–608, 655`
- **Impact:** YYYY-MM-DD / HH:mm; `isFormValid` disable trước khi user thấy lỗi slot.
- **Fix:** `DateField`/`TimeField` (đã có trong `@cmc/ui`). `isRequired` trên slot. `status` per-slot, không một dòng dưới stack. Cho bấm “Tạo lớp” lần đầu để hiện lỗi.

#### P1-7. Empty không dạy việc

- **Where:** DataTable `empty=` title-only (vd. `pipeline.tsx:532`, `classes/index.tsx:448`, `students/index.tsx:120–125` text thường). Kanban “Chưa có” / “Không có lớp” (`pipeline.tsx:508`, `schedule.tsx:243`, CSS `317–328`).
- **Fix:** EmptyState `description` + action (“Thêm cơ hội”, “Tạo lớp”). Kanban empty: “Chưa có lead ở bước này” + CTA nếu O1.

#### P1-8. `window.confirm` hủy buổi

- **Where:** `session-detail.tsx:255–261`
- **Fix:** `ConfirmDialog` như parents reject (`parents/index.tsx:319–331`).

### P2 — khó chịu, có đường vòng

#### P2-1. Hit target 30×30 / 34×34

- **Where:** `console.css:223–229`, `:158–165`; `pipeline.tsx:426–443`; `schedule.tsx:292–306`; `login.css:130–137`
- **Fix:** min 44×44 (pad hit-area, giữ glyph 16). Schedule: text+icon hoặc menu “Chế độ xem”.

#### P2-2. Kanban color-5 xanh cho O4 “đã test chưa ghi danh”

- **Where:** `pipeline.tsx:69–74`; `console.css` `--console-kanban-color-5`
- **Fix:** O4 dùng warning/brand, xanh chỉ O5.

#### P2-3. Hai ngôn ngữ thẻ trên một board

- **Where:** `schedule.tsx:237–246` SessionCard trong `KanbanColumn`; pipeline dùng `KanbanCard`.
- **Fix:** một recipe: SessionCard **hoặc** KanbanCard, không mix.

#### P2-4. Detector slop / motion

- `shifts.tsx:160` side-tab — đổi sang Callout/`border` đều hoặc token info, bỏ 3px rail.
- `revenue-report.tsx:125` `transition: width` → `transform: scaleX(...)`.

#### P2-5. Students StatusBadge không `label`

- **Where:** `students/index.tsx:33`
- **Fix:** map lifecycle → nhãn VN như parents `STATUS_LABELS`.

#### P2-6. Hidden file input không `htmlFor`

- **Where:** `session-evidence.tsx:293–307`, `exercises.tsx:336–350`
- **Fix:** `<label htmlFor>` bọc nút chọn file.

#### P2-7. Change-password tắt chrome, không lối ra khi vào nhầm

- **Where:** shell suppress (ngoài pages) + `change-password.tsx` không Cancel.
- **Fix:** nếu không forced-rotation, hiện “Để sau” / link về cockpit.

---

## Patterns (hệ thống, không one-off)

1. **Primitive console = skin hover-only.** State nằm ở page/Astryx, không ở navbar/kanban.
2. **Modal form = disable primary.** Receipt-create là chuẩn nội bộ — chưa lan.
3. **Row-click nghĩa không ổn định:** mở detail / mở modal quyền / chuyển tab.
4. **Empty = một câu, không action.**
5. **Dialog trap / Escape ủy quyền Astryx** — comment nhiều, chưa có chứng minh keyboard pass trên pages.
6. **Odoo density có chủ đích** (0.3rem cell, 46px bar). Thiếu focus ring và current-section nên mật độ trở thành nhiễu.

---

## Positive (giữ và nhân bản)

- Receipt-create: nhãn VN, required, `validate()`, inline `status`, Banner dedup/confirm, submit loading, success theo role (`receipt-create.tsx:37–56, 209–385`).
- Check-in: một CTA lớn, loading “Đang lấy vị trí…”, disable “Đã chấm công”, Banner cooldown/offsite (`check-in-out.tsx:511–549`).
- Login: `htmlFor`, autocomplete, toggle có `aria-label`, submit disabled+spinner, message không leak (`login.tsx:115–158`).
- Navbar Escape + focus restore, permission gate bắt buộc (`console-navbar.tsx:15–16, 38, 47–52`).
- FilterBar `role="search"`; ListPage loading/error/empty contract qua DataTable.
- Attendance roster `minHeight: 44` — đúng bar cảm ứng.
- Opportunity-detail: Spinner / 403 EmptyState / 404 Banner (`158–228`).
- Parents: ConfirmDialog trước reject; email thiếu = badge cảnh báo (`parents/index.tsx:319–331, 380`).

---

## Recommended next commands (Impeccable)

1. **[P0] `/impeccable harden`** — focus-visible navbar/kanban/view-switcher; gỡ nested `role="button"` trên pipeline; menu Arrow + focus move; form modal `aria-invalid` + alert.
2. **[P0] `/impeccable shape`** — kanban CRM per-stage (hoặc bỏ board).
3. **[P1] `/impeccable layout`** — một primary/header; session-detail không lặp CTA; section current.
4. **[P1] `/impeccable clarify`** — Lost/Roles/User ID; empty dạy việc; search phiếu server-side.
5. **[P1] `/impeccable onboard`** — empty kanban/list + students idle.
6. **[P2] `/impeccable adapt`** — 44px view-switcher/systray.
7. **[cuối] `/impeccable polish`** rồi re-run `/impeccable audit`.

---

## Caveats

- Không chạy UI sống. Focus trap Astryx Dialog = **ASSUMED** từ comment, không OBSERVED.
- Contrast navbar `rgba(255,255,255,0.9)` trên `--console-brand-purple` ~AA; chưa đo máy.
- `enroll-picker` (shell, ngoài `pages/**`) cùng kiểu hàng mouse-only — ghi nhận kề, không tính finding L2.
- Detector không đọc `console.css`; rail kanban cố ý sẽ không thành finding slop trừ khi viết inline.

**Weakest link:** P0-1 (board nói dối số) và P0-2 (bàn phím) chưa được xác minh trên browser — chỉ đọc source + test Escape navbar.
