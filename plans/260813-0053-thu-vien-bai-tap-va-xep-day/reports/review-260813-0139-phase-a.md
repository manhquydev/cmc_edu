# SHIP WITH FIXES

Commit `0e3597b` trên `feat/token-name-isolation` (base develop@69ab8fc). 3 file, 219+/6−.
Không có rủi ro runtime ngoài 1 dòng đã biết. Vấn đề nằm ở **sức chốt của test** — nó xanh trong
đúng kịch bản hồi quy mà phase này sinh ra để chặn. Đã chứng minh bằng thực nghiệm, không suy đoán.

## F1 — Test xanh giả đúng kịch bản hồi quy nó phải chặn — CHẶN MERGE

`packages/ui/src/console/console-precedence.test.ts:100` chốt 12 bậc `--font-size-*` trong shell chỉ
bằng `.length > 0`. Chỉ 4 bậc (`lg/xl/2xl/5xl`, dòng 105-108) được pin literal. 8 bậc còn lại — trong đó
có `4xl` và `3xl` — không được pin, mà `console.css:398-400` bind
`--text-display-2-size: var(--font-size-4xl)` và `--text-display-3-size: var(--font-size-3xl)`.

`--font-size-4xl` (console 22px / CMC 32px) chính là bậc red-team đo ra +45% và là lý do phase này
đảo hướng khỏi "xóa token trùng".

Chứng minh (chạy bản copy của test với `console.css` đã bỏ dòng `--font-size-4xl: 22px;`):

```
✓ lets console.css win ...            ✓ lets CMC / Astryx win ...
✓ resolves different winners ...      Test Files 1 passed / Tests 4 passed
```

Xóa mất giá trị Odoo của `4xl` ⇒ `--text-display-2-size` nhảy 22px → 32px trên toàn admin, **test vẫn
xanh**. Vòng lặp `length > 0` không phân biệt được ai thắng vì cả hai lớp đều khai bậc đó.

Sửa: pin literal cả 12 bậc ở hai mặt (`4xs` 10/11, `3xs` 10/11, `2xs` 11/12, `xs` 12/12, `sm` 13/13,
`base` 14/14, `3xl` 20/24, `4xl` 22/32). Bậc trùng giá trị hai bên (`xs/sm/base`) vẫn nên pin literal —
pin giá trị, không cần pin "ai thắng".

## F2 — Assertion `--color-text-*` là pin chuỗi, không pin màu — CHẶN MERGE

Dòng 111-131 so sánh với `'var(--console-gray-900,#212529)'`. jsdom không resolve `var()`, nên đây là
so khớp **văn bản khai báo**, không phải màu resolve. Cùng thực nghiệm trên: đổi
`console.css:38` `--console-gray-900: #212529` → `#ff0000` ⇒ test vẫn xanh, trong khi mọi chữ chính của
admin đổi màu. `--console-gray-900` hiện không có test nào khác chốt (grep: file duy nhất nhắc tên nó
trong test là chính file này).

Sửa (chọn 1): thêm probe resolve thật (`el.style.color = 'var(--color-text-primary)'` rồi đọc
`getComputedStyle().color`), hoặc pin thẳng literal `--console-gray-900`/`--console-gray-600` trong
cùng suite.

Ghi chú kèm: pin theo chuỗi serialize của jsdom (`,` không space; family list double-quote, dòng 133-134)
là brittle — bump jsdom đổi serialize sẽ đỏ giả. Đỏ giả thì an toàn (chặn auto-merge), nên không chặn,
nhưng nên có comment nói rõ đây là artifact của jsdom chứ không phải hợp đồng CSS.

## F3 — Test không chốt cái mà header nói nó chốt — không chặn merge, nhưng phải sửa comment

Header dòng 4-8 và comment dòng 76 (`Real admin import order — do not reorder`) khẳng định test pin
thứ tự nạp và quan hệ lồng nhau. Đo thực tế, cả hai đều không được pin:

- Đảo thứ tự thành `console → tokens → astryx`: **4/4 test xanh**.
- Bỏ lồng nhau (`shell` gắn thẳng vào `body`, không nằm trong `[data-astryx-theme]`): **4/4 test xanh**.

Lý do: hai sheet không bao giờ tranh nhau trên cùng một element. `console.css` thắng trong shell vì nó
khai property **trên chính** `.o_web_client`, mà khai báo trên element luôn thắng giá trị kế thừa từ
ancestor — bất kể specificity và bất kể thứ tự file. Chuyện "lồng trong `[data-astryx-theme]`" **không
phải** nguyên nhân.

Đây là điểm cần chú ý: nhiệm vụ #1 của phase là giết một comment nói dối; bản mới thay bằng một giải
thích nhân quả sai khác. Sửa header thành đúng cơ chế ("khai trên element thắng kế thừa"), và bỏ
`do not reorder` hoặc thay bằng ghi chú "thứ tự giữ cho khớp thực tế; assertion hiện không phụ thuộc nó".

## F4 — Assert trên đúng node không ai render — không chặn merge

Mọi assertion nhắm vào chính node `.o_web_client`. Không component Astryx nào **là** node đó; chúng là
hậu duệ. jsdom có resolve kế thừa custom property (probe: con trong shell `--font-size-lg` = `15px`,
con ngoài = `16px`), nên thêm một node con vào fixture và assert trên nó là rẻ và chốt đúng thứ thật sự
nhìn thấy được. Khuyến nghị làm cùng F1.

## F5 — Mô hình import thiếu 2 sheet, nhưng vô hại — không chặn merge

`apps/admin/src/main.tsx` nạp 5 thứ: `reset.css` (dòng 11) → tokens → astryx-theme-cmc → console →
`app.css` (dòng 20). Test dựng 3. Đã kiểm: `@astryxdesign/core/reset.css` khai 0 property thuộc ba họ
này, `apps/admin/src/app.css` chỉ **tiêu thụ** `var(--cmc-font-size-column)` chứ không khai. Nên kết
luận hiện tại đúng. Header nên nói rõ "3 sheet liên quan" thay vì ngụ ý đây là thứ tự thật đầy đủ.

## F6 — Cổng upstream: có hiệu lực trên CI — không chặn merge

`.github/workflows/ci.yml:60` chạy `pnpm install --frozen-lockfile` (full, không prune) và dòng 123
chạy `pnpm test` qua turbo cho mọi package ⇒ `@cmc/ui` chạy và
`packages/ui/node_modules/@astryxdesign/theme-neutral/dist/theme.css` có mặt. Chạy thử tại chỗ:
test dòng 201 **chạy, không skip**. `@astryxdesign/theme-neutral@0.2.0` là dependency thật của
`packages/ui` (package.json:31), không phải optional. Ba assertion mapping khớp upstream hiện tại
(theme.css:105, 122, 128). Cổng đúng như thiết kế.

Điểm yếu còn lại: `it.skipIf` biến mất im lặng nếu node_modules bị prune — suite vẫn xanh và không ai
biết cổng đã tắt. Rẻ để vá: `if (process.env.CI) expect(existsSync(UPSTREAM_THEME)).toBe(true)`.

## F7 — `astryx-theme-cmc.test.ts`: không phải rubber-stamp — không chặn merge

Thân assertion không đổi (vẫn chỉ kiểm 12 bậc **có được khai**); chỉ đổi tên test + comment. Kỳ vọng cũ
vốn đã đúng, nên đây không phải "đổi lời cho khớp hành vi". Tên mới ("declares … for surfaces outside
the admin shell") mô tả đúng cái nó đo. Câu đầu của comment mới đúng cơ chế; câu cuối lặp lại giải thích
sai của F3 — sửa cùng lúc.

Kèm theo, thứ chưa được sửa: `packages/ui/src/astryx-theme-cmc.css:63-69` vẫn giữ nguyên câu nói dối gốc
— "*so Astryx text always renders on-scale regardless of console.css's own values*". Đó mới là comment
ở nguồn sự thật mà người sau sẽ đọc trước. Sửa test mà để nguyên nó thì cái bẫy vẫn còn.

## F8 — `report.tsx` đúng token, nhưng đây LÀ đổi hành vi runtime — không chặn merge

`--cmc-text-muted` có khai thật tại `packages/ui/src/tokens.css:19` (`#6e6e73`); ngữ nghĩa hợp cho
header bảng. `git grep` trên `develop`: `--cmc-text-supporting` chỉ xuất hiện đúng 1 chỗ
(`report.tsx:136`) ⇒ token ma thật, sửa đúng chỗ, không sót.

Cần nói thẳng để không tự lừa: `var()` trỏ property chưa khai là *invalid at computed-value time*, và
`color` khi đó rơi về `inherit` (chữ đậm). Sau sửa nó thành xám muted. Vậy commit **không** phải no-op
thị giác — nó đổi màu header bảng ở CRM report. Đó là đổi có chủ đích và đúng hướng, nhưng phát biểu
"không dịch một pixel nào" chỉ đúng với các file CSS, không đúng với commit. Nhánh này không có test
nào phủ `SimpleTable`; thay đổi nhỏ và tự-hiển-nhiên nên không đòi test.

Ngoài dòng đó, diff không chạm code chạy: 2 file test + 1 dòng tsx. Không có state chung, async, hay
contract nào bị đụng.

## Việc cần làm trước khi mở PR

1. F1 — pin literal cả 12 bậc `--font-size-*` ở hai mặt (bắt buộc; hiện `4xl` là lỗ hổng đúng chỗ đau).
2. F2 — chốt màu bằng giá trị resolve hoặc pin `--console-gray-*` (bắt buộc).
3. F3 + F7 — sửa comment ở `console-precedence.test.ts:4-8,76`, câu cuối comment
   `astryx-theme-cmc.test.ts`, và `astryx-theme-cmc.css:63-69` cho đúng cơ chế.
4. F4 — thêm node con vào fixture, assert trên nó (làm gộp với 1).
5. F6 — `expect(existsSync(...)).toBe(true)` khi `process.env.CI` (rẻ, đóng đường tắt im lặng).
6. Chạy lại `pnpm --filter @cmc/ui test`; nghiệm thu "chứng minh đỏ được" nên lặp cho `4xl` và
   `--console-gray-900`, không chỉ cho `lg`.

## Câu chưa trả lời

- 5 bậc font-size không pin literal (`4xs/3xs/2xs/3xl/4xl`) khác nhau giữa hai mặt — đó là chủ ý thiết
  kế (Odoo đặc hơn) hay chỉ là di sản? Nếu là chủ ý thì pin literal là ghi lại chủ ý; nếu là di sản thì
  pin xong vẫn nên có issue theo dõi riêng.
- `--font-size-3xl` console 20px vs CMC 24px chi phối `--text-display-3-size`. Có surface admin nào đang
  dùng display-3 không? Nếu có, nó nằm cùng nhóm rủi ro với `4xl`.
