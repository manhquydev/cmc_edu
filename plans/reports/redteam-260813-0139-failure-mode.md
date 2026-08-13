# Red team — Failure Mode Analyst / Flow Tracer

**Plan:** `plans/260813-0120-design-system-hardening/` · **Base verified:** worktree `audit/design-system-impeccable` @ `develop 69ab8fc`
**Method:** flow tracing + empirical simulation (jsdom probe of pre/post phase-01 cascade; reimplementation of the phase-02 gate spec and run against HEAD).

---

## Finding 1: Phase 03 nhịp 2 mâu thuẫn với chính nhịp 1 — và làm hỏng một trang thứ hai không có trong plan — CRITICAL

**Evidence:**
- `apps/api/src/crm/router.ts:487-491` — `groupBy` cố ý dùng `where: { AND: [{ facilityId }, NOT_LOST_WHERE] }`, **không** dùng `where` của items.
- `apps/api/src/crm/router.ts:449` — `where` của items chứa `if (input.stage) and.push({ stage: input.stage })`.
- Phase 03 nhịp 2 ra lệnh: *"Board có lọc thì count phải đếm theo cùng `where` với items"*.
- Phase 03 nhịp 1 ra lệnh: `pipeline.tsx:481-488` funnel — *"**Giữ nguyên** tổng — đây là con số để ra quyết định"*.
- `apps/admin/src/pages/crm/pipeline.tsx:486` funnel đọc `stageCounts[stage.key]`; `:504` badge cột cũng đọc `stageCounts[stage.key]`.
- **Consumer thứ hai không nằm trong plan:** `apps/admin/src/pages/cockpit.tsx:250-256` gọi cùng procedure `trpc.crm.opportunityList.useQuery({ pageSize: 100, lost: 'exclude' })` rồi đọc `data?.stageCounts` để vẽ `StageFunnel` trên dashboard.
- Đường dẫn tới bug có thật, không giả định: `cockpit.tsx:270` render `href: '/crm?stage=${s.key}'` → pipeline set `stageFilter` → `listInput.stage` (`pipeline.tsx:289`) → `where` có `stage`.

**Why it breaks:** Nếu nhịp 2 làm đúng điều nó tự ra lệnh (`stageCounts` theo cùng `where` với items), thì với 5 query per-stage mỗi query trả `stageCounts` chỉ có **một** khoá. Funnel `pipeline.tsx:481-488` — thứ nhịp 1 vừa tuyên bố "giữ nguyên tổng" — sẽ vẽ 4 thanh bằng 0. Sale click "Đã kiểm tra" trên cockpit rồi rơi vào một funnel rỗng. Đây chính xác là lớp bug mà phase 03 tồn tại để diệt, chỉ đổi hướng. Plan không nêu quy tắc nào để tách "count cho funnel" (facility-wide) khỏi "count cho badge cột" (theo filter) — nó gộp cả hai vào một trường `stageCounts` và ra hai lệnh loại trừ nhau. Thêm nữa, đổi semantic của `stageCounts` là **breaking change trên API contract**, và consumer thứ hai (`cockpit.tsx`) không xuất hiện ở bất kỳ dòng nào trong plan, không có trong danh sách test của phase 03, và không có journey nào assert số của nó.

**Suggested fix:** Chốt trước khi code: `stageCounts` giữ nguyên semantic facility-wide (contract đang bị `apps/api/src/crm/list.test.ts:129-146` và `cockpit.tsx:255` khoá), và thêm **trường mới** `filteredStageCounts` (hoặc `total` per-query đã có sẵn) cho badge cột. Ghi rõ trong phase: funnel đọc `stageCounts`, badge đọc trường mới. Bắt buộc thêm một RTL case cho `cockpit.tsx` PipelinePanel vào danh sách test nhịp 2.

---

## Finding 2: Cổng CI phase 02 không thể xanh trên `develop` theo đúng đặc tả của chính nó — CRITICAL

**Evidence:** Tôi đã cài đúng spec ở `phase-02-phantom-token-guard.md` §2 (declared = `/(--[a-z0-9-]+)\s*:/` **chỉ trong file CSS**; consumed = `/var\(\s*(--[a-z0-9-]+)/` **mọi nơi** trong `packages/ui/src/**/*.css` + `apps/*/src/**/*.{css,tsx}`; miễn trừ khi có fallback) và chạy trên `69ab8fc`. Kết quả: **9 biến fail**, không phải 3.

| Biến fail | Tiêu thụ tại | Bản chất |
|---|---|---|
| `--cmc-` | `packages/ui/src/astryx-theme-cmc.css:7` | **False positive**: nằm trong comment `reference var(--cmc-*) only` |
| `--ws-sheet` `--ws-border` `--ws-muted` `--ws-bg` `--ws-teal` `--ws-teal-dark` | `apps/admin/src/pages/attendance/shifts.tsx:51,52,58,61,63,71,75,76,80,135,140,164…` | **False positive**: đã khai báo tại `shifts.tsx:44-49` bên trong template literal `WS_CSS` — spec chỉ thu `declared` từ file `.css` nên không thấy |
| `--arrow` | `apps/admin/src/pages/attendance/shifts.tsx:88,92…` | như trên |
| `--cmc-text-supporting` | `apps/admin/src/pages/crm/report.tsx:136` | **thật** |

Phase 02 tự ra hai lệnh loại trừ nhau: *"`WS_CSS` … nằm ngoài phase này … ghi nhận đừng sửa vội"* và *"**không** nới điều kiện fail"*, trong khi tiêu chí nghiệm thu là *"`pnpm check:css-vars` xanh trên `develop`"*. Ba mệnh đề này không thể cùng đúng.

**Ba lỗ mù nữa, đều verify được:**
1. **`packages/ui/src/**/*.tsx` không được quét.** 4 file tiêu thụ `var()` ở đó: `packages/ui/src/components/stat-card.tsx`, `packages/ui/src/components/master-detail.tsx`, `packages/ui/src/console/console-kanban.tsx`, `console-kanban.test.tsx`. Cổng chống token ma bỏ qua đúng package chứa design system.
2. **`dist/` không được quét** dù `packages/ui/package.json` khai `"main": "./dist/index.js"` và `"files": ["dist", …]` — chính là artifact ship ra. Phase 02 §Vấn đề còn nhấn mạnh `--cmc-text-supporting` "đã nằm trong `dist`", rồi thiết kế cổng không nhìn `dist`.
3. **Tên biến ghép động là có thật và sẽ fail giả:** `packages/ui/src/console/console-kanban.tsx:66` → `` `var(--console-kanban-color-${colorIndex})` ``. Regex consumed bắt ra token `--console-kanban-color-` (dấu `-` nằm trong lớp ký tự), biến này không tồn tại ở đâu, không có fallback ⇒ nếu mở rộng scan sang `packages/ui/src/**/*.tsx` thì cổng đỏ ngay trên code đúng.
4. **Pattern hợp lệ bị cổng giết:** cùng dòng `console-kanban.tsx:66` **khai báo** `'--console-kanban-card-color'` qua `style={{}}`. Tập `declared` chỉ đọc file CSS ⇒ không bao giờ thấy. Nó chỉ sống sót vì `packages/ui/src/console.css:347-348` tình cờ dùng fallback `var(--console-kanban-card-color, …)`. Bất kỳ ai sau này set CSS var từ JS mà **không** kèm fallback sẽ bị CI chặn dù code đúng — đây là pattern React chuẩn, không phải drift.

**Why it breaks:** Cổng ra đời để bắt token ma, nhưng thực tế nó (a) không thể xanh trên base, (b) mù ở `packages/ui/src/*.tsx` và `dist/` — đúng hai nơi phase 02 viện dẫn làm lý do tồn tại, (c) đỏ giả trên comment, template literal, và var ghép động. Với mô hình "CI là đội review", một required check đỏ giả là check sẽ bị người vận hành `continue-on-error` hoặc xoá trong vòng một tuần — mất luôn cả tín hiệu thật.

**Suggested fix:** Trước khi wire vào `ci.yml`: (1) strip comment CSS/TS trước khi quét cả hai tập; (2) thu `declared` từ **mọi** file được quét, kể cả template literal trong `.tsx`, và từ key `'--x':` trong object style; (3) bỏ qua mọi `var(` mà ngay sau tên có `${` (ghép động) và ghi warning thay vì fail; (4) mở rộng glob sang `packages/ui/src/**/*.tsx`; (5) chỉ khi 4 bước trên làm cổng xanh trên `69ab8fc` mới coi là đạt. Sửa `--cmc-text-supporting` là việc độc lập, không đợi cổng.

---

## Finding 3: Phase 03 nhịp 2 nhân query lên 5× ở tầng client nhưng 25× ở tầng DB, và bỏ ngỏ optimistic update đang hỏng — HIGH

**Evidence:**
- `apps/api/src/crm/router.ts:473-492` — **một** lần gọi `opportunityList` chạy `Promise.all` gồm 4 truy vấn (`findMany`, `count`, `groupBy`, `count`) + `apps/api/src/crm/router.ts:503-505` một `appUser.findMany` nữa = 5 truy vấn.
- `packages/db/src/index.ts:127-141` — toàn bộ nằm trong `db.$transaction` với một `$executeRaw set_config` mở đầu (`:129`) và `timeout: 15_000` (`:140`).
- `apps/api/src/crm/router.ts:487-491` — `groupBy` là **facility-wide, độc lập filter** ⇒ 5 query per-stage sẽ tính lại **cùng một** aggregate 5 lần.
- Phase 03 chỉ viết: *"Chỉ mở endpoint `opportunityBoard` nếu đo được **5 round-trip** là chậm thật"*.
- `apps/admin/src/pages/crm/pipeline.tsx:297-318` — `onMutate` `cancel(listInput)` / `getData(listInput)` / `setData(listInput, …)` bám vào **một** object key duy nhất, và patch bằng `items.map(item => item.id === opportunityId ? {…item, stage: toStage} : item)` (`:304-306`) — tức là đổi field `stage` **tại chỗ**, không chuyển item sang tập khác.
- Danh sách test nhịp 2 của phase 03: *"gọi đủ 5 lần với `{stage:…}`; pager cột O1 không làm đổi page cột O2"* — **không có** case nào cho advance/optimistic.

**Why it breaks:** "5 round-trip" thực tế là **5 transaction đồng thời × 6 statement = 30 statement** mỗi lần render board, giữ 5 connection pool cùng lúc cho một người dùng, trong đó 10 statement (`groupBy` + `lostCount` ×5) là bản sao y hệt nhau. Với `search` debounce, mỗi cụm gõ phím bắn 5 transaction. Plan under-count 5 lần và vì thế đặt ngưỡng "đo rồi mới tối ưu" trên một con số sai.

Nghiêm trọng hơn là optimistic update: trong thế giới per-stage, `handleAdvance` phải **xoá** item khỏi cache key của cột nguồn, **chèn** vào cache key cột đích, và chỉnh `total` của cả hai. Code hiện tại chỉ đổi `item.stage` — mà mỗi `KanbanColumn` render từ query của riêng nó, không từ `item.stage` nữa. Hệ quả cụ thể: bấm "Chuyển giai đoạn" → thẻ **đứng yên tại cột cũ** (đã bị đánh dấu stage mới), badge cột cũ chưa giảm, badge cột đích chưa tăng, rồi sau khi `invalidate()` (`:317`) resolve thì thẻ **nhảy** sang cột khác. Sale mất niềm tin vào chính con số phase 03 đang đi sửa. Plan liệt kê đúng nguy cơ này ở bảng Rủi ro nhưng **không kê đơn và không có test** — nghĩa là nó sẽ ship.

**Suggested fix:** Bổ sung vào nhịp 2 một mục "Việc" bắt buộc: viết lại `onMutate` thành cancel/patch **hai** key (nguồn + đích) với remove/insert + chỉnh `total`, và `onError` rollback cả hai; thêm RTL case: advance O1→O2 khi chưa settle thì cột O1 mất thẻ và cột O2 có thẻ. Đồng thời tách `stageCounts`/`lostCount` (facility-wide, bất biến theo cột) sang một query riêng duy nhất — bỏ chúng khỏi 5 query per-stage — trước khi bàn đến `opportunityBoard`.

---

## Finding 4: Phase 01 khai báo sai bán kính nổ của chính nó — tầng "role" đổi, không chỉ tầng "step" — HIGH

**Evidence:** Cảnh báo của phase 01 chỉ nêu hai con số: *"`--font-size-lg` 15→16px, `--font-size-2xl` 18→24px"*. Nhưng khối `--text-*` bị xoá (`packages/ui/src/console.css:387-426`) không phải alias của `--font-size-*` — nó **remap vai trò → bậc**, và upstream remap **khác**.

| Biến | console.css hiện tại | Upstream sau khi xoá | Thực đo |
|---|---|---|---|
| `--text-label-size` | `console.css:395` `var(--font-size-sm)` = 13px | `theme-neutral/dist/theme.css:122` `var(--font-size-base)` | **13 → 14px** |
| `--text-supporting-size` | `console.css:397` `var(--font-size-xs)` = 12px | `theme.css:128` `var(--font-size-sm)` | **12 → 13px** |
| `--text-code-size` | `console.css:396` `var(--font-size-sm)` = 13px | `theme.css:125` `var(--font-size-base)` | **13 → 14px** |
| `--text-heading-3-weight` | `console.css:407` `600` | `theme.css:105` `var(--font-weight-bold)` (`astryx.css:59` = 700) | **600 → 700** |
| `--text-heading-2-size` | `console.css:388` → `--font-size-xl` = 16px | `theme.css` → `--font-size-xl` = `astryx-theme-cmc.css:77` 18px | **16 → 18px** |
| `--text-display-2-size` | `console.css:399` → `--font-size-4xl` = 22px | → `astryx-theme-cmc.css:80` 32px | **22 → 32px (+45%)** |
| `--text-display-1-size` | `console.css:398` → `--font-size-5xl` = 24px | → `astryx-theme-cmc.css:81` 32px | **24 → 32px** |
| `--text-supporting-leading` | `console.css:426` `1.5` | `theme.css:130` `1.6667` | 1.5 → 1.6667 |

Diện tiêu thụ: **48 file** trong `apps/admin/src` render `<Heading>` / `<Text>` (barrel `packages/ui/src/primitives.ts:14`), ví dụ `apps/admin/src/pages/change-password.tsx:54,57`, `apps/admin/src/pages/enrollment/class-placement.tsx:186,261,266,273,292`. `<Heading level={2}>` không truyền `size` sẽ ăn `--text-heading-2-size`.

Xác nhận bằng probe jsdom (nạp `tokens.css` + `astryx-theme-cmc.css` + `console.css` đã cắt 373-384/387-426/428-430, fixture `.o_web_client` trong `[data-astryx-theme=neutral]`): `--font-size-lg` 15px→**16px**, `--font-size-2xl` 18px→**24px**, `--color-text-primary` `var(--console-gray-900,#212529)`→`var(--cmc-text)`, `--font-family-body`→`var(--cmc-font-sans)`, `h1` giữ `var(--font-size-2xl)` (⇒ 18→24px).

**Why it breaks:** Nghiệm thu của phase 01 là *"Soi mắt **đúng 3 màn**: một list, một detail, một dashboard — kiểm h1 và Astryx Button"*. Ba màn đó không chứa hết diện thay đổi: `display-*` chỉ xuất hiện ở KPI/metric (dashboard), `label` ở form (detail), `supporting` ở meta khắp nơi, `heading-3-weight` ở panel header. Người soi mắt được dặn tìm "h1 to hơn navbar" sẽ **không** đi tìm label form +1px hay metric +45%. Không có VRT, không có e2e assert CSS ⇒ những đổi này ship im lặng và chỉ lộ ra khi người dùng thật kêu.

**Suggested fix:** Thay bảng "17 tên trùng" bằng bảng before/after **giá trị đo được** cho cả `--font-size-*` và `--text-*` (dùng đúng bảng trên). Đổi checklist soi mắt thành: một form nhiều label, một dashboard có metric lớn, một list có meta/supporting, một panel có heading cấp 3. Nếu không chấp nhận `display` +45%, giữ lại **riêng** ba dòng `--text-display-*-size` trong `astryx-theme-cmc.css` (đúng chủ sở hữu theo luật phase 01) thay vì để rơi về upstream.

---

## Finding 5: Cổng allowlist (4) của phase 01 sẽ đỏ trên code đúng — và cùng regex đó đầu độc phase 02 — HIGH

**Evidence:** Phase 01 §Test mới (4): *"`decl(console) ⊆ {--console-*} ∪ {--console-sc-*}`"*, dùng regex `/(--[a-z0-9-]+)\s*:/` từ mục (1). Chạy đúng regex đó trên `console.css` sau khi cắt, tập `decl(console)` chứa 6 tên **không** phải `--console-*`:

```
--planned    @ packages/ui/src/console.css:2457   .o_web_client .console-sc--planned::before   { … }
--active     @ packages/ui/src/console.css:2463   .o_web_client .console-sc--active::before    { … }
--live       @ packages/ui/src/console.css:2471   .o_web_client .console-sc--live::before      { … }
--done       @ packages/ui/src/console.css:2479   .o_web_client .console-sc--done::before      { … }
--cancelled  @ packages/ui/src/console.css:2484   .o_web_client .console-sc--cancelled::before { … }
--attention  @ packages/ui/src/console.css:2490   .o_web_client .console-sc--attention::before { … }
```

Đây là selector BEM modifier `--planned` đứng ngay trước pseudo-element `::before`; regex khớp `--planned` + `:`. Allowlist của plan dự phòng `--console-sc-*` (tiền tố class) chứ không dự phòng `--<modifier>` (hậu tố modifier) — nên nó **không** che được.

**Why it breaks:** Hai hậu quả ngược chiều nhau. (a) Phase 01: gate (4) đỏ ngay lần chạy đầu trên implementation đúng; người thực thi sẽ hoặc nới allowlist bừa (giết luôn tác dụng chặn `--text-*` sống sót), hoặc kết luận việc xoá chưa xong. (b) Phase 02 tái dùng **cùng regex** cho tập `declared` ⇒ `--planned`, `--active`, … được coi là "đã khai báo". Nếu về sau có ai `var(--active)` thật (một token ma), cổng sẽ **xanh**. Cổng chống token ma tự tạo ra vùng mù cho chính mình, sinh ra bởi lỗi parse mà phase 01 đã cảnh giác đúng một nửa (nó chỉ loại comment).

**Suggested fix:** Chỉ nhận declaration khi dòng nằm **trong** thân block (giữa `{` và `}`) — hoặc tối thiểu loại mọi match mà ký tự ngay sau `:` là chữ cái của pseudo (`:before/:after/:hover/:focus/:not/:is/:has/:nth`) hoặc match nằm trong phần selector trước `{`. Viết một unit case cố định dùng `.console-sc--planned::before` làm fixture âm, cho cả test phase 01 lẫn script phase 02.

---

## Finding 6: Phase 01 xoá vĩnh viễn lớp phủ test của `--text-*` và không có gì thay thế được trong jsdom — HIGH

**Evidence:**
- `packages/ui/src/console/console-astryx-remap.test.ts:16` nạp **chỉ** `src/console.css` (`readFileSync`), và assert tại `:58-65`: `--text-body-size`, `--text-heading-5-size`, `--text-heading-6-size`, `--text-label-size`, `--text-supporting-size`, `--text-body-weight === '400'`, `--text-body-leading === '1.43'`; `:99-100,121-122` assert `.proof-text-body` / `.proof-heading` qua `--text-*-size`.
- Nguồn duy nhất của `--text-*` sau khi xoá nằm ở **node_modules**: `@astryxdesign/core/dist/astryx.css:59` (`:root, .x1etlgq0{--text-heading-1-size:…}`) và `@astryxdesign/theme-neutral/dist/theme.css:98-139` (trong `@scope ([data-astryx-theme="neutral"]) to ([data-astryx-theme])`).
- `packages/ui/src/astryx-theme-cmc.css:16-17` đưa hai file đó vào bằng `@import`. Probe jsdom thực tế: `Could not parse CSS @import URL "@astryxdesign/core/astryx.css" relative to base URL "about:blank"` — jsdom **im lặng bỏ** cả hai @import (sheet chỉ còn 10 rule).
- Kết quả probe sau khi mô phỏng cắt phase 01, trên fixture `.o_web_client` trong `[data-astryx-theme=neutral]`: `--text-body-size => ""`, `--text-label-size => ""`, `--text-supporting-size => ""`, `--text-heading-1-size => ""`, `--text-display-1-size => ""` (rỗng hoàn toàn).
- `packages/ui/src/astryx-theme-cmc.css:19-20` khai `--font-size-*` và `--color-text-*` trực tiếp ⇒ hai họ này **vẫn** assert được (probe trả 16px/24px). Chỉ họ `--text-*` là mất nguồn.

**Why it breaks:** Phase 01 §"Test phải đảo" chỉ nói viết lại assertion `--font-size-lg` = 16px. Nó không nhận ra rằng **một nửa còn lại** của `console-astryx-remap.test.ts` (7 assertion về `--text-*` + 2 proof element) không thể viết lại: giá trị chỉ tồn tại trong node_modules mà jsdom không nạp được, và `@scope` cũng ngoài tầm jsdom. Người thực thi đứng trước hai lựa chọn tệ: xoá các assertion đó (mất cổng), hoặc hardcode giá trị upstream vào test (test nói dối khi Astryx bump version). Sau phase 01, **không còn cổng tự động nào** phát hiện việc nâng `@astryxdesign/theme-neutral` đổi `--text-label-size`/`--text-heading-3-weight` dưới admin shell — trong khi `dependabot-auto-merge.yml` tự merge patch/minor khi CI xanh. Đó là một đường dẫn đến hồi quy thị giác **tự động merge**, không người xem.

**Suggested fix:** Trước khi xoá, chuyển phần `--text-*` của `console-astryx-remap.test.ts` thành một test nạp trực tiếp `node_modules/@astryxdesign/theme-neutral/dist/theme.css` bằng `readFileSync` + regex (assert *mapping*: `--text-label-size` phải trỏ tới `--font-size-base`, `--text-heading-3-weight` phải trỏ tới `--font-weight-bold`), có `it.skipIf(!existsSync(...))`. Test này đỏ khi upstream đổi remap — đúng thứ cần. Ghi rõ trong phase 01 là hạng mục bắt buộc, không phải "sửa test cũ".

---

## Finding 7: Thứ tự phase sai — 01, 04, 05 cùng sửa `console.css`; 02 và 05 cùng sửa `ci.yml` — HIGH

**Evidence:**
- `plan.md` bảng Phases: 04 và 05 cột "Phụ thuộc" = `—`, và *"Phase 03, 04, 05 độc lập nhau, chạy song song được"*. Cả bốn phase 01/03/04/05 đều ghi *"từ `develop`"*.
- Phase 01 xoá `packages/ui/src/console.css:371-441` (~57 dòng, gồm cả block `:387-426`).
- Phase 04 §1 sửa `console.css:111-205`, `:330-365`, **`:449-456`**. Verify: `console.css:443-447` = block `.console-menu-item`, `console.css:449-456` = block `button.console-kanban-card`. **Cách vùng xoá của phase 01 đúng 2 dòng** (`:442` là comment `/* Button resets when ConsoleNavbar/KanbanCard use native <button> */`).
- Phase 05 §5 sửa `console.css:1394` — nằm sau vùng xoá, **sẽ dịch khoảng −57 dòng** khi 01 land.
- Phase 02 §2: *"wire vào `.github/workflows/ci.yml` ngay sau các check UI hiện có (`ui-ratchet`, `check-ui-frames`)"*. Verify: `.github/workflows/ci.yml:112-113` = `UI frame adoption`, `:118-119` = `UI inline-style ratchet`, `:121-122` = `Test`. Phase 05 §Cổng: *"Wire vào `typecheck-and-test`"* — cùng job, cùng vùng ~10 dòng, cộng thêm cùng file `package.json` mục `scripts`.

**Why it breaks:** Git dùng context 3 dòng cho hunk. Hunk xoá của phase 01 kết thúc ở `:441` sẽ mang context `:442-444`; hunk thêm `:focus-visible` của phase 04 vào `button.console-kanban-card` (`:449`) và `.console-menu-item` (`:443`) mang context `:440-446`. Hai hunk chồng context ⇒ **PR thứ hai merge sẽ conflict**, chắc chắn, không phải "có thể". Với người vận hành một mình, conflict trên một file CSS 2498 dòng vừa bị xoá 57 dòng là nơi rất dễ resolve sai theo hướng "giữ cả hai" — tức là hồi sinh đúng 17 tên mà phase 01 vừa xoá, và **cổng phase 01 sẽ bắt được** (may) nhưng chỉ nếu PR phase 04 chạy lại test `@cmc/ui`. Cùng câu chuyện cho `ci.yml` giữa 02 và 05.

Hệ quả thứ hai — **bisect**: sau khi 01 land, mọi trích dẫn dòng trong phase 04 và 05 lệch ~57. Phase 05 trỏ `console.css:1394` để sửa comment chết; dòng đó lúc thi hành sẽ là ~1337. Người/agent thực thi theo số dòng sẽ sửa nhầm chỗ.

**Suggested fix:** Sửa `plan.md`: khai 04 và 05 **phụ thuộc 01** (không phải vì logic mà vì đụng file), hoặc yêu cầu 04/05 rebase lên `develop` sau khi 01 merge trước khi mở PR. Thay mọi trích dẫn `file:NNN` trong phase 04/05 bằng trích dẫn theo **selector/chuỗi neo** (`button.console-kanban-card {`, `.console-app-switcher-toggle {`) — bất biến qua dịch dòng. Tách việc wire CI của 02 và 05 thành một PR "wire cả hai script" duy nhất, hoặc quy định 05 land sau 02.

---

## Finding 8: Hai đơn thuốc của phase 04 đều hỏng như đã viết; và "revert một PR" sai ở ba chỗ — MEDIUM

**Evidence — phase 04:**
- Phase 04 §2 cho hai lựa chọn, lựa chọn 1 là *"dùng `KanbanCard onClick` sẵn có"*. Verify `packages/ui/src/console/console-kanban.tsx:71-79`: khi có `onClick`, `KanbanCard` render `<button type="button" className={cls}>` **bọc quanh** `children`. Mà `apps/admin/src/pages/crm/pipeline.tsx:137-238` truyền vào các `<Button>` advance / enroll / lost. ⇒ lựa chọn 1 biến "button lồng button" từ `role="button"` (chỉ sai với screen reader) thành `<button>` lồng `<button>` **thật** — HTML parser sẽ tách phần tử con ra khỏi button cha, vỡ cả layout lẫn handler. Đây là lựa chọn tệ hơn hiện trạng, được plan đặt ngang hàng với lựa chọn đúng.
- Phase 04 §2 bảo *"Bỏ wrapper `role="button"` (`pipeline.tsx:137-238`)"*. Verify `pipeline.tsx:141-149`: wrapper đó **đang là đường bàn phím duy nhất** để mở thẻ, kèm guard `if (e.target !== e.currentTarget) return;` chống bubble từ nút con. Bỏ nó mà chọn nhầm nhánh = xoá tính năng bàn phím trong một phase tên là "A11y P0: bàn phím".
- Phase 04 §4 bảo *"Hàng `tabIndex={0}` … làm ở component"*. Verify `packages/ui/src/components/data-table.tsx:143-162`: `onRowClick` **không** gắn vào hàng — nó bọc **từng ô** trong một `<div onClick>`; hàng `<tr>` do `<Table>` của Astryx render (`:169-177`) và `DataTable` không truyền prop hàng nào. ⇒ đặt `tabIndex` ở chỗ duy nhất `DataTable` với tới được sẽ tạo **cột × hàng** điểm dừng Tab (receipt-list ~7 cột × 20 hàng ≈ 140), không phải 20. Bảng Rủi ro của phase 04 nói *"số điểm dừng Tab tăng mạnh"* nhưng không biết là nhân với số cột.
- Trích dẫn sai: phase 04 ghi `users.tsx:351`; đường dẫn thật là `apps/admin/src/pages/admin/users.tsx` (không tồn tại `apps/admin/src/pages/users.tsx`).

**Evidence — rollback:**
- `plan.md` §Rủi ro: *"PR nhỏ, dễ revert"*; phase 01 §Rollback: *"revert một PR. Không có migration, không có state."*
- **Sai chỗ 1 — phase 06.** `phase-06-lms-primitives.md` §Lô PR: lô 1 tạo `LmsTopbar`/`LmsPage`; lô 2 gắn 5 trang parent; lô 3 gắn 3 trang student; lô 4 gắn `login.tsx`, `change-password.tsx`, `routes/index.tsx:31`. Revert lô 1 sau khi lô 2 land sẽ xoá component mà 8 trang đang import ⇒ typecheck đỏ, app trắng. Rollback thật là revert **4 PR theo thứ tự ngược**, không phải một.
- **Sai chỗ 2 — phase 03.** File `phase-03-crm-kanban-truth.md` **không có mục Rollback nào**, trong khi nó là phase duy nhất đổi **server contract** (`stageCounts` where-clause tại `apps/api/src/crm/router.ts:487-491`) và trải trên **hai branch** (`fix/crm-kanban-count-truth`, `feat/crm-kanban-per-stage`). Revert PR admin mà không revert PR API để `cockpit.tsx:255` đọc semantic đã đổi.
- **Sai chỗ 3 — phase 03 tự vi phạm lệnh cấm của mình.** §Cấm: *"Nâng `PAGE_SIZE` lên 100 … Vỡ ở bản ghi thứ 101"*. Verify `apps/admin/src/pages/cockpit.tsx:250-259`: dashboard **đã** gọi `{ pageSize: 100 }` và có nhánh dự phòng đếm thủ công `for (const opp of data?.items ?? [])` — đúng bug bị cấm, đang chạy production, không phase nào đụng tới.

**Suggested fix:** Phase 04: xoá lựa chọn "dùng `KanbanCard onClick`" (dẫn chứng `console-kanban.tsx:71-79`) và chốt phương án link-tiêu-đề; đổi §4 thành "thêm cột 'Mở' là `<a>` thật trong `DataTable`" và ghi rõ lý do (`data-table.tsx:143-162` không có hook mức hàng), bỏ hẳn phương án `tabIndex` trên hàng; sửa đường dẫn thành `apps/admin/src/pages/admin/users.tsx`. Plan: thay "revert một PR" bằng bảng rollback thật cho từng phase, ghi rõ thứ tự revert của phase 06 và cặp API/admin của phase 03. Thêm `cockpit.tsx:250-259` vào scope phase 03 nhịp 2 (nó dùng chung procedure vừa bị đổi).

---

### Không đủ bằng chứng để xếp hạng (ghi nhận, chưa tính là finding)
- Worktree `feat/token-name-isolation` @ `69ab8fc` đã tồn tại (`git worktree list`), nhưng phase 01 khai branch `fix/token-name-isolation`. Hai tên khác nhau cho cùng một việc — rủi ro hai nhánh song song. Chưa có commit nào nên chưa gây hại.
- `apps/lms/index.html:6` đúng như phase 06 mô tả (`maximum-scale=1.0, user-scalable=no`) — không tìm thấy lỗi ở lô 0.

Status: DONE_WITH_CONCERNS
Summary: Plan có 2 lỗi CRITICAL và 5 HIGH đã verify bằng chứng thực thi, không phải suy đoán: phase 03 nhịp 2 tự mâu thuẫn và làm hỏng `cockpit.tsx` (consumer thứ hai không có trong plan), và cổng CI phase 02 fail 9 biến chứ không phải 3 nên không thể xanh trên `develop` theo đúng đặc tả của nó. Không nên thi hành phase 01–04 trước khi sửa `plan.md` và các file phase.
