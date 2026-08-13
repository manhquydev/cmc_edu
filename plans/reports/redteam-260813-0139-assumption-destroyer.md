# Red-team — Assumption Destroyer / Scope Auditor

Plan: `plans/260813-0120-design-system-hardening/` · Base verified: `develop@69ab8fc`
(worktree `/home/manhquy/.herdr/worktrees/cmc_edu/audit-design-system-impeccable/`, clean).
Mọi số liệu dưới đây do chạy lại đúng spec của plan trên base đó, không chép từ audit report.

---

## Finding 1: Script phase 02 chạy đúng spec sẽ đỏ 48 chỗ trên `develop` sạch, không phải 3 — CRITICAL

**Evidence:**
- Spec: `plans/260813-0120-design-system-hardening/phase-02-phantom-token-guard.md:32-36` — declared chỉ thu từ **file CSS**, consumed thu `var(...)` ở **cả `.tsx`**.
- `apps/admin/src/pages/attendance/shifts.tsx:42` `const WS_CSS = \`` — khai `--ws-teal`, `--ws-teal-dark`, `--ws-border`, `--ws-bg`, `--ws-muted`, `--ws-sheet`, `--arrow` **bên trong template literal của một file `.tsx`** (`shifts.tsx:44,45,46,…`). Vì declared chỉ đọc CSS, toàn bộ 46 lần `var(--ws-*)`/`var(--arrow)` từ `shifts.tsx:51` đến `shifts.tsx:193` rơi vào tập fail.
- `packages/ui/src/astryx-theme-cmc.css:7` — chuỗi `var(--cmc-*)` nằm **trong comment**; regex `/var\(\s*(--[a-z0-9-]+)/` bắt ra `--cmc-` → fail thêm 1.
- Tôi đã chạy đúng spec: **48 fail (no-fallback), 6 warn (fallback)**.

**Why it breaks:** Tiêu chí nghiệm thu `phase-02:49` "`pnpm check:css-vars` xanh trên `develop`" là bất khả thi với spec đã viết. Plan chỉ dự phòng bằng một câu (`phase-02:56-58`): "cho phép allowlist tối thiểu … **không** nới điều kiện fail". 46 hit từ một file không phải "allowlist tối thiểu" — agent thi hành sẽ buộc phải hoặc allowlist cả `shifts.tsx` (giết luôn tác dụng của cổng ở file có nhiều CSS thô nhất repo), hoặc nới điều kiện fail (điều plan cấm), hoặc bỏ ngang. Phase 02 phụ thuộc phase 01 nên thất bại này chặn cả chuỗi 01→02.

**Suggested fix:** Spec lại `check-css-vars.mjs` **trước khi giao**: (a) strip comment `/* */` và `//` trước mọi regex; (b) thu declared từ cả template literal trong `.ts/.tsx` (regex `["']?--x["']?\s*:` trong backtick + object key), không chỉ file `.css`; (c) bỏ qua tên kết thúc bằng `-` (interpolation, xem Finding 2). Ghi thẳng con số kỳ vọng sau khi sửa (**1 fail**) vào phần nghiệm thu để agent biết đích.

---

## Finding 2: Tiền đề "ba token ma" sai — chỉ 1 trong 3 thực sự trượt cổng do chính plan định nghĩa — HIGH

**Evidence:**
- `phase-02-phantom-token-guard.md:13-16` liệt kê 3 biến, `:36` quy định "Fail nếu `consumed \ declared ≠ ∅`, **trừ** biến có fallback `var(--x, y)`".
- `apps/admin/src/pages/attendance/shifts-detail.tsx:113` → `var(--console-border, #dee2e6)`; `:114` → `var(--console-bg-subtle, #f1f3f5)`; `:116` → cả hai, đều có fallback. ⇒ theo chính spec, hai biến này **được miễn**, chỉ in warning.
- `apps/admin/src/pages/crm/report.tsx:136` → `color: 'var(--cmc-text-supporting)'`, không fallback. Đây là hit thật duy nhất.
- Bảng ở `phase-02:14-15` gán sai dòng: `--console-border` ghi là `:113,114` (thực tế `:113,116`), `--console-bg-subtle` ghi là `:116` (thực tế `:114,116`).
- `packages/ui/src/console.css:347-348` tiêu thụ `var(--console-kanban-card-color, …)` mà biến đó chỉ được khai trong TSX (`packages/ui/src/console/console-kanban.tsx:66`) — plan không nhắc; `console-kanban.tsx:66` còn dùng `var(--console-kanban-color-${colorIndex})`, dạng nội suy mà regex của plan cắt thành `--console-kanban-color-`.

**Why it breaks:** Nghiệm thu `phase-02:51` "Ba biến trên không còn xuất hiện trong tập `consumed \ declared`" đã đúng sẵn cho 2/3 biến mà không cần làm gì — tick được nhưng không chứng minh gì. Ngược lại rủi ro thật (nội suy động ở `console-kanban.tsx:66`) không nằm trong phần "Rủi ro" của phase; plan lại cảnh báo nhầm về `shifts.tsx:42` theo hướng "script sẽ chạm tới nó, đừng sửa vội" trong khi đó chính là 46/48 lỗi.

**Suggested fix:** Sửa bảng `:13-16` theo dòng thật; nói rõ 2 biến có fallback là *cleanup tùy chọn*, không phải P0; ghi `--cmc-text-supporting` (`report.tsx:136`) là hạng mục P0 duy nhất và nêu biến thay thế đề xuất (`--cmc-text-muted`/`--cmc-text-faint`, đều có trong `packages/ui/src/tokens.css`). Thêm mục rủi ro nội suy động trỏ `console-kanban.tsx:66`.

---

## Finding 3: Cổng phase 01 vừa đỏ nhầm vừa xanh nhầm — HIGH

**Evidence — đỏ nhầm (false red):** `phase-01-token-isolation.md:49` yêu cầu `decl(console) ⊆ {--console-*} ∪ {--console-sc-*}`. Regex `/(--[a-z0-9-]+)\s*:/` của `phase-01:45` bắt luôn **tên class BEM đứng trước pseudo-element**:
- `packages/ui/src/console.css:2457` `.console-sc--planned::before {` → sinh "declaration" `--planned`
- cùng kiểu tại `console.css:2463` (`--active`), `:2471` (`--live`), `:2479` (`--done`), `:2484` (`--cancelled`), `:2490` (`--attention`)

6 tên này không thuộc allowlist ⇒ test (4) đỏ **sau khi** agent đã xóa đúng 17 tên + khối `--text-*`. Plan chỉ phòng comment ("trên dòng không phải comment", `phase-01:45`), không phòng selector.

**Evidence — xanh nhầm (false green):** Test chỉ parse 3 file (`phase-01:43`). Nhưng có **file thứ tư** khai cùng nhóm tên:
- `apps/admin/src/pages/login.css:18-19` khai `--color-text-primary`, `--color-text-secondary` (đúng API Astryx mà `phase-01:13` giao cho `astryx-theme-cmc.css`)
- `apps/admin/src/pages/login.css:23-26` khai `--cmc-brand`, `--cmc-text`, `--cmc-text-muted`, `--cmc-danger` (đúng nhóm mà `phase-01:13` giao cho `tokens.css`)
- file này thực sự chạy: `apps/admin/src/pages/login.tsx:6` `import './login.css'`

**Why it breaks:** Mục tiêu phát biểu ở `phase-01:9` — "việc một file CSS khai lại tên biến của file khác sẽ **làm đỏ CI**" — không đúng: `login.css` khai đè 6 tên của hai chủ sở hữu khác và cổng không nhìn tới. Đây chính xác là loại drift plan tuyên bố đóng. Đồng thời nếu agent mở rộng phạm vi quét cho khớp lời hứa, `login.css` đỏ ngay và plan **không có** chính sách miễn trừ cho override cục bộ có chủ đích — agent phải tự chế luật.

**Suggested fix:** (a) Trong bước trích declaration, bỏ dòng chứa `{` phía sau match hoặc yêu cầu match nằm trong block (đơn giản nhất: bỏ qua match nếu phần còn lại của dòng chứa `{` trước dấu `;`); thêm 6 tên trên vào test như case âm để chứng minh bộ lọc hoạt động. (b) Quyết định dứt khoát: hoặc `login.css:14-26` là override cục bộ hợp lệ và ghi luật "scoped override được phép, chỉ cấm khai ở phạm vi `:root`/shell", hoặc đưa nó vào phase. Không để agent tự chọn.

---

## Finding 4: Cách sửa mà phase 04 đề xuất tái tạo đúng lỗi nó định sửa, và xóa mất đường bàn phím duy nhất đang chạy — HIGH

**Evidence:**
- `phase-04-a11y-keyboard.md:14` mô tả lỗi: "`pipeline.tsx:137-238` bọc `role="button"` quanh thẻ vốn đã chứa button".
- Thực tế `apps/admin/src/pages/crm/pipeline.tsx:137-146`: wrapper **đã có** `tabIndex={0}` và `onKeyDown` xử lý Enter/Space, kèm guard `if (e.target !== e.currentTarget) return;` chống bubbling từ nút con. Đây là đường bàn phím **đang hoạt động** duy nhất của thẻ CRM.
- `phase-04:32` đề xuất phương án 1: "dùng `KanbanCard onClick` sẵn có". Nhưng `packages/ui/src/console/console-kanban.tsx:70-77`: nhánh `onClick` render `<button type="button" …>{children}</button>` — tức bọc `<Button>` advance/enroll/lost **bên trong một `<button>`**.

**Why it breaks:** Phương án 1 đổi `div[role=button]` chứa button thành `<button>` chứa button — vẫn vi phạm WCAG 4.1.2, thêm HTML không hợp lệ (browser sẽ tự tách cây), và khiến hành vi click hiện tại đổi khó lường. Agent thi hành blind được phép "chọn một" giữa hai phương án và phương án được liệt kê trước là phương án hỏng. Nếu chọn phương án đó rồi bỏ wrapper `:137-146`, kết quả ròng là **mất** keyboard support ở đúng phase tên là "A11y P0 bàn phím".

**Suggested fix:** Xóa phương án 1 khỏi `phase-04:32`. Chỉ giữ phương án card tĩnh + tiêu đề là `<a>` thật, action nằm ngoài vùng hit. Ghi rõ ràng buộc: `KanbanCard onClick` **không được dùng** khi `children`/`footer` chứa phần tử tương tác, và cân nhắc thêm invariant đó vào `console-kanban.tsx` (dev warning) để lần sau không tái phạm.

---

## Finding 5: Nhịp 2 của phase 03 chưa đủ đặc tả để thi hành — bốn điểm agent phải đoán — HIGH

**Evidence (claim gốc thì đúng):** `opportunityListInput.stage` có thật — `apps/api/src/crm/router.ts:102` (`stage: z.enum(STAGE_VALUES).optional()`) và áp dụng tại `router.ts:450` (`if (input.stage) and.push({ stage: input.stage })`); test `apps/api/src/crm/list.test.ts:58` "filters by stage" ✓; `stageCounts`/`lostCount` tại `router.ts:486-495` ✓; `list.test.ts:129` ✓. Các citation của `phase-03:37-40` **đứng vững**.

**Evidence (lỗ hổng):**
1. `phase-03-crm-kanban-truth.md:45-46` yêu cầu `stageCounts` "đếm theo cùng `where` với items". Nhưng `apps/api/src/crm/router.ts:484-486` ghi rõ counts là facility-wide, cố ý độc lập stage/search/lost — "phase 6's funnel can consume them without re-querying". Nếu scope theo `where` **và** chia 5 query per-stage (`phase-03:42`), mỗi response chỉ còn count của đúng stage đó.
2. Do đó funnel — mà `phase-03:25` bắt "**Giữ nguyên** tổng" — không còn nguồn. Plan không nói query nào nuôi funnel.
3. Table view `apps/admin/src/pages/crm/pipeline.tsx:528-555` dùng chung `items`/`total`/`totalPages` từ query phẳng. Plan không nhắc table view một lần nào ⇒ hoặc phải giữ query thứ 6, hoặc table vỡ.
4. Đã tồn tại `stageFilter` toàn board (`pipeline.tsx:251` và `:289`). Khi `stageFilter` được set, có còn bắn 5 query không? Không có câu trả lời.
5. Cache optimistic gắn cứng một key: `pipeline.tsx:287-293` + `utils.crm.opportunityList.cancel(listInput)` tại `:299`, `handleAdvance` tại `:321`. Advance chuyển thẻ giữa 2 cột ⇒ phải patch ≥2 query key + 2 count. `phase-03:72` chỉ *nêu* rủi ro, không thiết kế.

**Why it breaks:** Ước lượng 1.5–2.5 ngày cho nhịp 2 dựa trên "không cần endpoint mới" — đúng về schema, sai về khối lượng. Năm điểm trên đều là quyết định kiến trúc, không phải chi tiết thi hành; agent blind sẽ chọn khác nhau mỗi lần chạy, và `phase-03:65` cấm đóng phase khi mới xong nhịp 1.

**Suggested fix:** Trước khi giao, chốt trong phase file: funnel giữ 1 query aggregate riêng (hoặc `opportunityBoard`); table view giữ query phẳng hiện tại; `stageFilter` set ⇒ chỉ bắn 1 query; `stageCounts` **không** scope theo `where` (giữ nguyên hợp đồng F7) mà thêm trường riêng nếu cần count-theo-search; liệt kê chính xác các query key phải patch trong `onMutate`.

---

## Finding 6: Phase 04 nói "bốn trang", DataTable có 17 điểm gọi — HIGH

**Evidence:**
- `phase-04-a11y-keyboard.md:17-18` liệt kê 4 chỗ: `receipt-list.tsx:227` ✓, `classes/index.tsx:449` ✓, `users.tsx:351` ✓, `students/index.tsx:133` ✓ (đều đúng dòng).
- `phase-04:44` lại chỉ đạo: "Việc này chạm DataTable dùng chung, nên làm ở component chứ đừng vá từng trang."
- Thực tế có **17** điểm gọi `onRowClick`: thêm `apps/admin/src/pages/parents/index.tsx:428`, `finance/refund.tsx:150`, `admin/facilities.tsx:176`, `hr/payroll.tsx:565`, `hr/kpi.tsx:211`, `crm/aftersale.tsx:209`, `attendance/check-in-out.tsx:401`, `crm/pipeline.tsx:533`, `engagement/rewards.tsx:137`, `teaching/report-cards.tsx:200`, `teaching/exercises.tsx:272`, `attendance/shifts.tsx:949`, `attendance/shifts.tsx:1037`.
- `apps/admin/src/pages/admin/users.tsx:270-272` ghi rõ có wrapper `stopPropagation` để cột Actions không kích hoạt `onRowClick`.

**Why it breaks:** `plan.md:50` và `phase-04:48-52` nghiệm thu theo "bốn trang" trong khi thay đổi thực tế chạm 17 màn hình. Nghiêm trọng hơn: `stopPropagation` chỉ chặn **click**; thêm `onKeyDown` ở cấp hàng (`phase-04:42`) sẽ khiến Enter khi focus đang ở nút trong cột Actions kích hoạt cả hành động của nút *và* `onRowClick` (mở modal roles) — trừ khi có guard `e.target !== e.currentTarget` như `pipeline.tsx:141`, điều plan không nêu. `phase-04:57` có cảnh báo selector e2e nhưng vẫn đóng khung phạm vi ở "journey admin", không nêu 17 trang.

**Suggested fix:** Đổi nghiệm thu thành "mọi trang dùng DataTable" và liệt kê 17 đường dẫn; bắt buộc guard `e.target !== e.currentTarget` trong handler của DataTable; thêm case RTL cho trang có cột Actions (`users.tsx`) chứng minh Enter trên nút không mở modal hàng.

---

## Finding 7: Danh sách sửa của phase 05 bỏ sót hit khiến chính cổng của nó đỏ; token cấm lại nhập nhằng — MEDIUM

**Evidence:** Cổng cấm (`phase-05-doc-authority.md:38-44`) so với danh sách sửa (`phase-05:23-24`):
- `design-system/cmc-edu/PAGE-FRAMES.md` — plan sửa `:13-16,25-27,68,155`; hit thật còn ở **`:153`** (`Astryx Button + \`.sh-cta*\``), ngoài danh sách.
- `design-system/cmc-edu/MASTER.md` — plan sửa `:146,152-153,164-168`; hit thật ở **`:92`** (`.tpl-wrap--compact`), **`:134`** (`.sh-cta` / `.sh-cta--ghost`), **`:154`** (`.sh-cta--secondary`, lệch 1–2 dòng so với `152-153`). Chỉ `:146` và `:164` khớp.
- `docs/12-design-system-ui.md` khớp đủ (`:27,29` trong `23-30`; `:87`; `:96` trong `95-101`) ✓; `STRUCTURE.md:18,70` ✓; `packages/ui/llms.txt:79` (`premium.css`) ✓; `packages/ui/src/index.ts:166-169` ✓; `console.css:1394` ✓; `primitives.ts:35-41` ✓; `.github/workflows/ci.yml:112-113` (`check:ui-frames`) và `:118-119` (`check:ui-ratchet`) ✓.
- Nhập nhằng: bảng `phase-05:42` cấm chuỗi `.sh-*`, còn nghiệm thu `phase-05:52` dùng `rg -n '…|\.sh-\*|…'` — pattern này khớp **literal `.sh-*`**, không khớp `.sh-cta` ở `MASTER.md:134`. Hai cách đọc cho hai kết quả pass/fail khác nhau.

**Why it breaks:** Làm đúng `phase-05:23-24` xong thì `pnpm check:doc-authority` vẫn đỏ 4 chỗ (nếu hiểu ban theo prefix), hoặc xanh giả (nếu hiểu theo literal) trong khi tài liệu vẫn chỉ agent sang `.sh-cta` đã chết — `.sh-` hiện chỉ còn tồn tại trong comment của `packages/ui/src/console.css`, không còn selector nào.

**Suggested fix:** Ghi token cấm dưới dạng regex tường minh (`\.sh-[a-z]`, `\.premium-`, `\bAppFrame\b`, `tpl-wrap`, `\.ck-surface`) trong cả bảng lẫn lệnh nghiệm thu; bổ sung `PAGE-FRAMES.md:153`, `MASTER.md:92,134,154` vào danh sách sửa; thêm `packages/ui/src/console.css` vào bảng cổng vì `:1394` cũng bị sửa mà không có gì canh.

---

## Finding 8: Lập luận "không cần VRT" của phase 06 hụt ở 3 trang, và `apps/lms` không có một test unit nào — MEDIUM

**Evidence:**
- `phase-06-lms-primitives.md:53-55` dựa hoàn toàn vào 6 spec e2e. Cả 6 **tồn tại** ✓: `apps/e2e/tests/lms-login.ui.spec.ts`, `apps/e2e/tests/journeys/lms-parent-otp-login.journey.ui.spec.ts`, `…/lms-student-activation.journey.ui.spec.ts`, `…/lms-parent-evidence-consent.journey.ui.spec.ts` (chạm `/parent/consent/` tại `:134`), `…/lms-grade-parent-view.journey.ui.spec.ts` (`:94` `/parent/homework/`), `…/lms-stars-redeem-cycle.journey.ui.spec.ts`.
- Nhưng đối chiếu route với các trang phase 06 viết lại (`phase-06:43-47`): **không spec nào chạm** `/parent/report-card`, `/parent/reset-password`, `/student/exercise`.
- `apps/lms/src/pages/parent/report-card.tsx` là file nhiều inline style nhất (12/77) và nằm ở Lô 2; `student/exercise.tsx` (11) ở Lô 3 — cả hai đều là file bị sửa nặng nhất mà không có e2e.
- `apps/lms/src` **không có file test nào** (`find apps/lms/src -name '*.test.ts*'` → rỗng).

**Why it breaks:** Nghiệm thu `phase-06:62` "Mỗi lô xanh `typecheck-and-test` + `ui-e2e` trước khi sang lô kế" là cổng rỗng cho 3 trang này: `typecheck-and-test` không render gì trong `apps/lms`, `ui-e2e` không tới. Với dự án không có VRT và không có người review, đổi markup/class ở `report-card.tsx` và `exercise.tsx` sẽ merge mà **không có tín hiệu tự động nào** — đúng loại rủi ro `plan.md:19` tự đặt ra rồi không đóng.

**Suggested fix:** Trước Lô 2/3, thêm smoke e2e (hoặc RTL đầu tiên cho `apps/lms`) chạm `/parent/report-card/:id`, `/parent/reset-password/:id`, `/student/exercise/:id` — chỉ cần assert URL + 1 `getByRole` ổn định. Hoặc chuyển 3 trang này sang "ngoài scope" và nói thẳng trong `phase-06:64-66`, đừng để nằm trong lô mà tự nhận là có cổng.

---

## Đã kiểm và **đúng** (không tính là finding, ghi để khỏi kiểm lại)

- 17 tên trùng `astryx ∩ console` — **chính xác 17**, đúng nhóm và đúng dòng (`console.css:373-384`, `:402-403`, `:428-430`); `tokens ∩ astryx = ∅`, `tokens ∩ console = ∅`.
- `console.css:434-441` (`h1`–`small`) ✓; comment chứa `--font-size-lg` tại `astryx-theme-cmc.css:63-69` ✓; `--cmc-fs-title: 16px` có thật (`tokens.css:102`) và `astryx-theme-cmc.css:76` pin `--font-size-lg: 16px` (giá trị tính ra sẽ là literal `16px`, không phải `var(--cmc-fs-title)` — sửa câu chữ ở `phase-01:56`).
- Chuỗi import đúng như plan giả định: `apps/admin/src/main.tsx:16-20` (tokens → astryx-theme-cmc → console → app.css), astryx khai ở `:root, [data-astryx-theme='neutral']` (`astryx-theme-cmc.css:19-20`) ⇒ xóa khỏi `.o_web_client` thì rơi về `:root`, dự đoán 15→16 / 18→24 hợp lý.
- Test cần đảo có thật nhưng **nằm ở `packages/ui/src/console/`**, không phải `packages/ui/src/` — `console-tokens.test.ts:34-41` ✓, `console-astryx-remap.test.ts` ✓, `astryx-theme-cmc.test.ts:16-24` ✓. Plan viết tên trần, nên ghi đủ đường dẫn.
- Toàn bộ dòng CSS của phase 04: `console.css:111` `.console-app-switcher-toggle` ✓, `:205` ✓, `:330` `.console-kanban-card` ✓, `:365` ✓, `:449` `button.console-kanban-card` ✓, `:456` ✓.
- Phase 03 citations UI: `pipeline.tsx:34` (`PAGE_SIZE = 20`), `:287-293` (listInput), `:347-351` (groupBy), `:504-508` (count + empty state), `:481-488` (funnel), `pipeline.test.tsx:13-14,58-60,153-166` — tất cả đúng.
- Phase 06: `apps/lms/index.html:6` `user-scalable=no` ✓; 77 inline style ✓; `style={{width:60}}` xuất hiện 7 lần ✓; `routes/index.tsx:31` loader ✓ (block `/parent` thực tế `:46-64`, `/student` `:65-81` — lệch 1 dòng so với `phase-06:23`).

---

Status: DONE_WITH_CONCERNS
Summary: Ba claim lớn được kiểm chứng đúng (17 tên trùng, `opportunityListInput.stage`, 6 spec e2e LMS đều tồn tại), nhưng phase 02 sẽ đỏ 48 chỗ khi chạy đúng spec và tiền đề "3 token ma" chỉ đúng 1/3; phase 01 vừa đỏ nhầm vì selector BEM vừa mù trước `login.css`; phase 04 đề xuất phương án tái tạo chính lỗi nó sửa; phase 03 nhịp 2 và phase 05/06 còn lỗ đặc tả đủ lớn để agent phải đoán.
