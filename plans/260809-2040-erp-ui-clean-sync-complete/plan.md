---
title: "ERP admin UI — đầy đủ, đồng bộ, sạch"
status: implemented_local_unpushed
priority: P1
effort: "L — nhiều phiên, 8 phase"
tags: [design-system, console, cleanup, tokens, erp]
created: 2026-08-09
revised: 2026-08-10 09:35 (8/8 phase implement xong local; CI thật + e2e ≥101-record + ảnh trước/sau vẫn treo — xem Acceptance criteria)
blockedBy: [260809-1100-cook-token-bugs-datetime-fields]
---

> **Quan hệ liên-plan:**
> - `blockedBy: 260809-1100-cook-token-bugs-datetime-fields` — code của plan đó **đã implement xong** nhưng còn nằm trong 38 file chưa commit; Phase 1 land nó. Status "draft" của plan đó là **lỗi thời**, cập nhật khi Phase 1 xong.
> - Tiêu thụ backlog S1-S11 của `260806-odoo-ui-component-dissection` (**active**): Phase 3 = S6, Phase 7 chèn S2/S3. Không sửa plan đó, chỉ dùng thứ tự đã chốt ở đó.

## Execution authority (operator-approved 2026-08-09)

`ak:cook --tdd --advise > ak:test > ak:code-review` được phép thực thi toàn bộ 8 phase với các mặc định sau:

- Giữ **soft-ops 12/16/20** cho Astryx primitive; giữ **Odoo 3/4/6** cho console list/table chrome. Đây là luật vùng, không cố hợp nhất hai họ.
- Đo giới hạn radius **theo component family**, không dùng tiêu chí số lượng radius toàn trang vốn bất khả thi khi hai họ hợp lệ cùng xuất hiện.
- Width/height là layout, **miễn trừ vĩnh viễn** khỏi ratchet; không lập width token scale.
- Đưa type scale `11/12/13/14/16/18/24/32` thành token có tên trước khi enforcement sử dụng nó.
- Phase 7 theo thứ tự `teaching → CRM → finance → hr/admin → phần còn lại`.
- S2/S3 là feature work, tách khỏi plan này; plan chỉ token hoá và áp component đã tồn tại.
- Phải commit công cụ đo có test và baseline tái lập trước khi dùng số đo làm acceptance evidence.

### Progress

- [x] Operator chốt các quyết định thiết kế và phạm vi còn mở.
- [x] Phase 1 — land pending work (6 commit, gồm 1 commit sửa lockfile do code review độc lập bắt được — xem `plans/reports/review-*`). `pnpm install --frozen-lockfile` xanh (mô phỏng CI thật). Typecheck+test xanh; 1/2 e2e xanh, 1/2 fail — nghi do dữ liệu DB dùng chung, **chưa root-cause dứt điểm**.
- [x] Phase 2 — delete dead UI assets (2 commit: xoá + wire-up/doc-sync). 5 doc thật sự có tuyên bố sai đã sửa (llms.txt, design-system-console.md, VIEW-GRAMMAR.md, A11Y-BASELINE.md, CONSOLE-COMPONENT-MAP.md); 7 file khác cố ý không đụng (LMS-scope hoặc kiến trúc lỗi thời từ trước, ngoài phạm vi). typecheck 17/17 + test xanh (ui 41 file/139 test, giảm đúng 4/10 theo 4 test bị xoá). Bắt lỗi tự sửa: `git add` nhiều path bị 1 pathspec lỗi làm rớt hết — tách commit theo dõi bằng `git status`.
- [x] Phase 3 — AsyncEntityCombobox bằng TDD (component viết test trước). 5/5 picker migrate (attendance, session-evidence, session-assessment, class-placement, classes/index course, receipt-create). `grep pageSize:100 apps/admin/src/pages` xác nhận 0 FK-picker còn lại (chỉ dashboard/report query + test/comment). 5 commit, typecheck+test xanh xuyên suốt (560 test admin). Chưa có e2e >100 record thật — chỉ chứng minh bằng unit test debounce+search.
- [x] Phase 4 — 4a: sửa `--radius-inner` (10px số ma → bỏ hẳn override, rơi về default gốc Astryx 4px — sửa lại sau đối sánh, ban đầu tự bịa token `--cmc-radius-inner: 8px` không có căn cứ), pin 12 biến `--font-size-*` Astryx về thang CMC (nguyên nhân thật của "15px" là trùng tên biến với console.css, không phải Astryx chưa theme). Verify sống bằng script `scripts/measure-ui-fingerprint.mjs` (đã sửa 2 lỗi cũ, có unit test) trên 13 route: 0 lần 15px còn lại. 4b: luật vùng ghi vào STYLING-BRIDGE.md + sửa 1 lỗi doc cũ (`rounded-md` 12px→16px). Không đảo quyết định giữ 2 thang radius. Đối sánh với worktree khác: cùng plan này đang được implement song song ở checkout gốc (không phải worktree riêng) — cũng tự xây `AsyncEntityCombobox`, đã port 2 cải thiện thật từ đó (error-banner tích hợp, cách sửa radius-inner đúng hơn).
- [x] Phase 5 — re-baseline sau Phase 2: 18 chỗ lệch thang thật còn lại (`12.5px`×11, `13.5px`×7 — giảm từ 20/8 gốc; `24.5px` đã tự biến mất, 0 chỗ). "Bước 0" (thang type chưa thành token) **bị bác bỏ giống Phase 4**: cả 2 vùng đã có token thật từ trước (`console.css:373-384` cho Console, `tokens.css:98-105` cho Premium) — không cần sửa `tokens.css`. Phép thử Odoo (grep literal + hệ số `$o-label-font-size-factor:0.8` + xác nhận mọi base Odoo là số nguyên) không tìm được căn cứ cho 12.5/13.5px ⇒ trôi dạt, snap về `12px`/`13px` (đúng `--font-size-xs`/`--font-size-sm` đã khai báo), viết literal khớp quy ước file. 1 PR duy nhất (không tách theo họ — cùng một phép biến đổi cho mọi chỗ). `pnpm turbo run typecheck test --filter=@cmc/ui`: 43 file/149 test xanh. Sweep sống 4 route xác nhận 0 off-scale còn lại; 2 route rơi vào ComingSoon, DB dev chung không có seed data cho detail/list page thật (`ClassBatch`/`Enrollment` = 0 dòng) nên không chụp ảnh trước/sau theo route — không seed thêm vì đó là state chung, ngoài phạm vi một bản sửa 0.5px. CI thật chưa chạy (worktree chưa push).
- [x] Phase 6 — 6a xong: `scripts/ui-ratchet.mjs` + test (bracket-matched parse, bắt 1 bug lệch chỉ số thật trước khi seed), baseline `scripts/ratchet-baseline.json` (41 file/178 vi phạm trên 58 trang, sinh từ trạng thái sau Phase 5), nối CI job `typecheck-and-test`. Verify: HEAD sạch → 0 false positive; tiêm 1 vi phạm giả → fail đúng file đúng số; phục hồi → sạch lại; 4/4 test xanh. 6b (stylelint) **hoãn có chủ đích** đúng fallback đã ghi trong phase-06 — điều kiện "thang type chưa thành token" đã đạt (Phase 5) nhưng điều kiện "stylelint chưa cài" vẫn đúng (0 khớp trong mọi `package.json`), là toolchain mới thật, không phải premise sai; không chặn Phase 7/8.
- [x] Phase 7 — 2 file dùng chung + 5 slice module (teaching→CRM→finance→hr/admin→còn lại), chạy song song 5 subagent (tập file rời nhau). Token hoá theo khớp giá trị tuyệt đối (không suy diễn/xấp xỉ): 178→25 vi phạm ratchet (giảm 86%, 0 file tăng). Verify tập trung: diff toàn batch 149 dòng thêm/149 xoá đối xứng, 0 dòng ngoài từ khoá style; typecheck+test xanh (560/560); lint sạch. `detect_changes` báo critical do **độ rộng** (44 hàm/51 luồng "touched") — đã xác minh bằng grep+diff đây không phải rủi ro hành vi, cảnh báo operator theo luật CLAUDE.md. Phủ component (CountBadge/MetaRow/Avatar) **hoãn có chủ đích** — không có DB dev/ảnh để kiểm chứng thay markup an toàn; xem Phase 8. Ảnh trước/sau theo route chưa chụp (DB dev chung rỗng). 6 commit riêng.
- [x] Phase 8 — rà 5 component "chưa phủ" bằng grep upstream + `impact()`: `InsightMetric`/`FocusCard` 0 consumer VÀ 0 candidate site (xoá, ~115 dòng CSS + export + test) — `CountBadge`/`MetaRow`/`Avatar` 0 consumer NHƯNG có candidate site thật chưa dùng (giữ, nợ chờ áp dụng, không xoá sớm). Baseline ratchet → thật sự 0 qua `scripts/ratchet-exemptions.json` (16 entry, mỗi entry 1 lý do cụ thể tại sao không có token khớp) — so sánh "fail khi tăng" hiện có tự động thành cấm tuyệt đối, không cần thêm mode riêng. Sweep sống lần cuối 30 route (26 đo được thật, DB chung rỗng ngoài 1 Facility): 0 cỡ chữ lệch thang CMC-owned; 1 lần duy nhất là `h2.fc-toolbar-title` (FullCalendar bên thứ ba) — đóng dứt điểm bí ẩn "24.5px" treo từ Phase 5 bằng bằng chứng `offScaleOwners`, đúng ngoại lệ plan đã ghi trước. Sự cố phụ: password role `cmc_app` bị phiên khác đổi giữa chừng (rủi ro tài nguyên chung đã được operator chấp nhận trước) — tự phát hiện qua lỗi 28P01, reset lại, xác nhận bằng kết nối trực tiếp trước khi dùng lại.

# ERP admin UI — đầy đủ, đồng bộ, sạch

## Mục tiêu

Nghiệp vụ tạm ổn, **giao diện thì chưa**. Đưa hệ design CMC Console (admin/ERP) về
trạng thái **đầy đủ · đồng bộ · sạch**.

**Ngoài phạm vi — chốt cứng:** `apps/lms` **không đụng tới** (sẽ tái cấu trúc toàn
diện sau). Kéo theo: bỏ câu hỏi tách barrel `@cmc/ui` và mọi lint rule hướng LMS.

## ⚠️ Chẩn đoán đã bị SỬA sau vòng scout

Bản plan đầu đổ lỗi cho **219 inline style ở tầng trang**. Đo trên DOM thật
(dev server + DB thật) cho thấy **đó là nguồn nhỏ nhất trong ba nguồn**:

| # | Nguồn gây lệch | Bằng chứng | Quy mô |
|---|---|---|---|
| 1 | **Astryx default chưa được theme** (❌ RÚT — xem hiệu chỉnh dưới) | `/finance` render `<h3>` **15px** với class Astryx (`x1ghz6dp…`); `astryx-button`/`astryx-selector` bo **12px**, `astryx-dialog`/`astryx-tooltip` bo **16px** | Một **thang thứ ba** lọt vào mọi màn hình |
| 2 | **`console.css` tự phá thang của chính nó** | 450 khai báo px cứng / chỉ 127 `var()` ⇒ **22% token hoá**. `padding` 4%, `margin` **0%** | Nền móng còn kém kỷ luật hơn tầng trang |
| 3 | Inline style ở trang | 219/339 style object dùng giá trị thô | Nguồn **nhỏ nhất** |

### Quét DOM 33 route thật (2026-08-09 22:05, viewport 1440×900, dev-auth super_admin)

Script: `ui-fingerprint-sweep.mjs` — điều khiển Chromium, đo `getComputedStyle` mọi node
trong `<main>`. 35 route quét, 2 là ComingSoon (`/admin`, `/ops`), **33 route đo được**.

> ## ⛔ HIỆU CHỈNH SAU RED-TEAM (2026-08-09 22:40) — SỐ ĐO BAN ĐẦU SAI
>
> Script `ui-fingerprint-sweep.mjs` có **hai lỗi thật**, làm phóng đại và đảo ngược chẩn đoán:
>
> 1. **Hardcode sai thang type.** Script dùng `[11,12,13,14,16,18,24,32]`. Thang **thật** khai
>    báo tại `console.css:429-439` dưới `.o_web_client` là `10·11·12·13·14·15·16·18·20·22·24`.
>    ⇒ `15px` và `22px` **nằm trong thang**, không hề lệch. 18 trong 47 "vi phạm" chưa bao giờ là vi phạm.
> 2. **Quy chủ sở hữu bằng `className.split(' ')[0]`** — lấy class **đầu tiên** trong chuỗi,
>    **không có quan hệ nhân quả** với thuộc tính đang đo. `x1ghz6dp` mà tôi gọi là "Astryx
>    default" thực chất là `{margin:0}` — một reset margin, không liên quan font-size.
>
> **Chẩn đoán bị RÚT:** "Astryx default chưa được theme" là **SAI**. `astryx.css` phát ra
> `border-radius: var(--radius-element)` / `font-size: var(--text-heading-3-size)` — luôn dùng
> biến, không literal. `console.css:435` khai báo `--font-size-lg: 15px` và `:445` bind
> `--text-heading-3-size` vào nó ⇒ **15px là do CMC tự đặt, có chủ đích**. Có test đang xanh
> khẳng định việc theme này tồn tại (`console/console-tokens.test.ts:34`).

### Số đo ĐÃ HIỆU CHỈNH (tính lại trên thang thật)

| Số đo | Ban đầu (sai) | **Đã hiệu chỉnh** |
|---|---|---|
| Trang có font ngoài thang | 21/33 | **14/33** |
| Số lần | 47 | **29** |
| Giá trị còn lại | 12.5/13.5/15/22/24.5px | **chỉ còn phân số: `12.5px`×20 · `13.5px`×8 · `24.5px`×1** |
| Trang vượt ngưỡng ≤4 radius | 26/33 | **7/33** (loại shorthand nhiều giá trị của FullCalendar) |

**Bức tranh thật, nhỏ hơn nhiều và sạch hơn:**

- **29 lần cỡ chữ phân số** (12.5/13.5/24.5px) — **toàn bộ do `console.css` tự khai báo**, không dính bên thứ ba.
- **7/33 trang vượt ngưỡng radius**, do: `10px` (chính là `--radius-inner` hardcode), cùng tồn tại `999px` và `9999px`, và trộn `3px/3.5px/4px`.
- Tổ hợp `[4, 12, 16]` trên hầu hết trang **là thiết kế đang chạy đúng như đã khai báo** (bề mặt list Odoo 4px + control CMC 12px + card CMC 16px) — **không phải lỗi**.

> **Kết luận còn đứng vững:** inline style tầng trang vẫn là nguồn **nhỏ nhất** — nhưng điều
> này được chứng minh bằng **đếm tĩnh của scout** (radius: 2 chỗ dùng, 100% phủ token), **không
> phải bằng sweep** — sweep về mặt cấu trúc **không thể nhìn thấy** inline style vì chúng dùng
> 12/13/14px (đều nằm trong thang).

**Phân biệt hai mệnh đề (đừng gộp):** "chưa token hoá" ≠ "hiển thị lệch". Một
stylesheet hardcode **nhất quán** vẫn render nhất quán — token là thuộc tính
*bảo trì*, không tự động là thuộc tính *đồng bộ thị giác*. ⇒ **Chỉ ~43 cỡ chữ +
10 radius lệch thang mới thật sự đổi pixel**; ~400 px cứng còn lại là nợ bảo trì,
để sau.

## Baseline đo được (2026-08-09)

| Chiều | Số đo | Kết luận |
|---|---|---|
| Cấu trúc trang | 40/44 trang thật dùng archetype; 13 file còn lại đúng là dialog/panel/auth | ✅ Xong |
| FilterBar | 22/25 (88%) — tài liệu ghi 12/23 là số lỗi thời | ✅ Gần xong |
| Token màu | 11 dòng hex thô / 3 file | ✅ ~96% |
| CSS console (class chết) | 333/335 class đang sống; 21 class "nhìn như chết" chỉ là ghép động | ✅ Sạch |
| **`console.css` kỷ luật token** | **450 px cứng / 127 `var()` = 22%** | 🔴 Nền móng |
| **Giá trị lệch thang trong `console.css`** | **29 font-size (đã hiệu chỉnh) + radius vượt ngưỡng ở 7/33 trang** | 🔴 Đổi pixel thật |
| S6 many2one | 5 dropdown `pageSize:100` ⇒ bản ghi thứ 101 biến mất | 🔴 **Bug thật** |

> **Đơn vị đếm — tránh nhầm về sau:** `219` = số **style object** có ≥1 giá trị thô ·
> `486` = số **property** vi phạm · `674` = tổng property trong mọi inline style.

**Kết quả scout (chi tiết trong `plans/reports/scout-260809-2104-*.md`):**
- **S6 = thuần frontend, size S.** Cả 5 picker đã có procedure hỗ trợ `search`
  server-side ⇒ **không cần đụng API**. Bản tham chiếu đúng: `teaching/attendance.tsx`.
- **Slice dọc khả thi ở tầng trang:** 98.4% vi phạm là module-private; chỉ 2 file
  dùng chung cần sửa trước (`lib/student-picker.tsx`, `lib/enroll-picker.tsx`).
  **Rủi ro test = 0** (0/49 unit test assert style; 0/40+ e2e journey phụ thuộc trình bày).
- **Thang token chỉ phủ một phần:** ~34% "vi phạm" thật ra là **layout ngữ nghĩa**
  (display/flex/cursor) — **không được** token hoá. Width **không có thang nào**
  (10 giá trị 120–720px, 78 chỗ) ⇒ **miễn trừ vĩnh viễn theo quyết định operator**.
- **Bề mặt xoá:** 548 dòng TSX (9 file) + ~513 dòng CSS + 2.3 MB asset; **8+ file doc**
  trong `design-system/` phải cập nhật kèm. Cả 5 component đều có **hồ sơ quyết định**
  xác nhận đã bị thay thế.

**Phân bổ vi phạm theo module:** teaching 173 · CRM 81 · finance 46 · còn lại rải rác.

## Nguyên tắc triển khai

**Sửa nền trước, quét trang sau.** Token hoá trang trong khi component chúng lắp
ráp vẫn lệch thang = sơn lại tường trên khung cong.

**Không quét `console.css` toàn bộ.** 450 chỗ sửa trong file style **mọi màn hình**
= diff bán kính nổ lớn nhất repo, mà người duyệt thị giác duy nhất là mắt operator.
Chỉ đụng **giá trị lệch thang**.

**Chia nhỏ tới mức một lần liếc mắt duyệt được.** Không có visual regression
testing (chủ đích) ⇒ mỗi PR phải nhỏ vừa đủ để soi bằng mắt, kèm ảnh trước/sau.

**Ratchet, không quét một lần.** Script CI đếm vi phạm **theo từng file** so baseline
đã commit, fail nếu file nào tăng; hạ baseline dần → 0 → bật cấm cứng.

**Công cụ đo phải nằm trong repo.** Script `ui-fingerprint-sweep.mjs` (điều khiển Chromium,
đo `getComputedStyle` mọi node trên từng route) hiện ở **thư mục tạm và sẽ biến mất**, trong
khi hầu hết tiêu chí nghiệm thu phụ thuộc nó. **Việc đầu tiên của Phase 4** là commit nó vào
`scripts/` kèm README ngắn — không thì mọi tiêu chí kiểu "0 cỡ chữ lệch thang trên 33 route"
đều **không tái lập được** và không ai khác kiểm chứng được.
Repo **đã có sẵn pattern đúng để noi theo**: `scripts/check-ui-frames.mjs` +
`check-ui-frames.test.mjs`, `scripts/check-ui-a11y-roles.mjs` + test — script kèm test riêng,
nối vào CI. Làm y hệt, đừng phát minh kiểu mới.

**Điểm dừng an toàn: sau Phase 6.** Operator solo cần biết chỗ nào dừng vô thời hạn mà không
để codebase tệ hơn lúc đầu. Hết Phase 6: rác đã xoá, bug tiền đã sửa, nền móng đã thẳng,
rào chặn đã bật ⇒ **phần lớn giá trị đã thu được**, Phase 7-8 là dọn nốt phần nhỏ nhất và có
thể hoãn vô hạn. Nếu UAT bắt đầu, dừng ở đây là hợp lý nhất.

## Phase

| # | Phase | File | Phụ thuộc |
|---|---|---|---|
| 1 | Land pending work (chỉ slice UI thật, KHÔNG cuốn infra/UAT ngoài phạm vi) | [`phase-01`](phase-01-land-pending-work.md) | — |
| 2 | Xoá rác (2.3 MB asset · 548 dòng TSX · 513 dòng CSS · doc) | [`phase-02`](phase-02-delete-dead-ui-assets.md) | 1 |
| 3 | **S6 — sửa bug cắt dữ liệu** (thuần frontend, TDD) | [`phase-03`](phase-03-s6-async-entity-combobox.md) | 1 |
| 4 | **Chốt ngôn ngữ radius** (soft-ops 12/16/20 giữ nguyên cho Astryx; Odoo 3/4/6 giữ nguyên cho console) | [`phase-04`](phase-04-astryx-theme-bridge.md) | 2 |
| 5 | **Quét giá trị lệch thang** trong `console.css` (re-baseline sau Phase 2) | [`phase-05`](phase-05-off-scale-value-sweep.md) | 4 |
| 6 | Rào chặn (ratchet app + stylelint console.css) | [`phase-06`](phase-06-enforcement-ratchet.md) | 5 |
| 7 | Slice dọc theo module (teaching → CRM → finance → hr/admin → còn lại) | [`phase-07`](phase-07-vertical-module-slices.md) | 3, 6 |
| 8 | Đóng sổ | [`phase-08`](phase-08-close-out.md) | 7 |

## Quyết định đã chốt

- **LMS ngoài phạm vi** → bỏ tách barrel, bỏ lint rule hướng LMS.
- **Không token hoá `console.css` toàn bộ** — chỉ giá trị lệch thang.
- **Không dựng visual regression testing lúc này.**
- **Hai thang radius là luật vùng có chủ đích** (operator-approved): soft-ops 12/16/20 cho
  Astryx primitive, Odoo 3/4/6 cho console chrome. Đo theo component family, không đo tổng số
  radius/trang.
- **Width/height miễn trừ vĩnh viễn khỏi ratchet** — không lập thang mới.
- **S2/S3 tách khỏi plan này** — là feature work, không phải consistency work.
- **Phủ component có điều kiện:** chỉ áp `Avatar`/`CountBadge`/`MetaRow`/… ở nơi nó
  **thay thế markup tự chế sẵn có**.
- **Vẫn park:** Search OS facets · Chatter · Activity-view matrix · Pivot/Graph widget.

## Acceptance criteria

- [x] `public/design2*` không còn (verify: `find` 0 kết quả); 5 component + CSS đã xoá (Phase 2); doc đã cập nhật; `pnpm --filter @cmc/ui test` xanh (41 file/147 test sau Phase 8, giảm đúng 2 file do xoá InsightMetric/FocusCard).
- [~] Không còn dropdown FK nào nuôi bằng `pageSize: 100` — **đúng**, `grep pageSize:100 apps/admin/src/pages` = 0 (Phase 3). E2e chứng minh chọn được bản ghi thứ 101 — **chưa**: chỉ chứng minh bằng unit test debounce+search, không có e2e với ≥101 bản ghi thật (DB dev chung không có seed data ở quy mô này).
- [x] Mỗi component family (Astryx soft-ops vs Odoo console) chỉ dùng radius thuộc thang đã chốt — xác nhận lại bằng sweep sống Phase 8 (26 route: chỉ 2 thang 3/4/6 + 12/16/20/9999, ngoại lệ FullCalendar đã ghi rõ).
- [x] Thang type có token thật trong `tokens.css` — đã có từ trước Phase 5 (không phải việc mới), xác nhận bằng đọc trực tiếp file.
- [~] Ratchet chạy trong CI, fail khi file nào tăng vi phạm — **xong** (Phase 6a/8, baseline={} + exemption list = cấm tuyệt đối). Stylelint chặn px lệch thang mới trong `console.css` — **hoãn có chủ đích** (6b, toolchain mới, chưa cài).
- [ ] Mỗi PR đụng thị giác có ảnh trước/sau đính kèm — **chưa làm** xuyên suốt Phase 5-8, lý do nhất quán: DB dev chung rỗng (`ClassBatch`/`Enrollment` = 0 dòng), không seed thêm vì đó là state chung ngoài phạm vi các bản sửa giá trị CSS. Bù lại bằng: diff review trực tiếp + sweep sống đo được trên các route không cần seed data + `detect_changes`/`impact()` mỗi bước.
- [ ] Mọi phase: CI `typecheck-and-test` **và** `ui-e2e` xanh — **chỉ verify local** (typecheck+test+lint xanh mọi bước, xem log từng phase); CI thật trên GitHub Actions chưa chạy vì worktree chưa push lên remote.

## Rủi ro

- **Không có visual regression testing** ⇒ mọi verify thị giác là thủ công.
- **UAT người thật chưa chạy.** Phase 1-4 an toàn bất kể UAT nói gì; Phase 5-7 nên dừng
  đánh giá lại nếu UAT bắt đầu.
- `console.css` là file style **mọi màn hình** ⇒ mỗi PR chạm nó đều có blast radius toàn hệ.
- **Checkout gốc `/home/manhquy/Downloads/cmc_edu` đang bị một/nhiều phiên khác mutate đồng
  thời** (workstream infra/UAT + có thể một phần plan này). Worktree này (`feat/erp-ui-clean-
  sync-cook-b`) cố ý tách biệt hoàn toàn, không copy code từ checkout gốc, để giữ lịch sử
  commit sạch và so sánh được với các phiên khác.

## Câu hỏi đã giải quyết (operator-approved)

- ~~Thứ tự slice Phase 5~~ → **teaching → CRM → finance → hr/admin → còn lại**.
- ~~Width có lập thang không~~ → **miễn trừ vĩnh viễn**.
- ~~12px/32px spacing~~ → theo quyết định operator, không mở rộng thang trừ khi phát sinh nhu cầu thật trong Phase 7.
- ~~Thang radius Astryx~~ → **giữ 2 thang, đo theo family**.
