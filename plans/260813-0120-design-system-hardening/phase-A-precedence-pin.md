# Phase A — Chốt precedence bằng test, diệt token ma thật

**Trạng thái:** sẵn sàng thi hành · **Công:** ~3–5h · **Branch:** `feat/token-name-isolation` (worktree đã dựng)
**Thay cho:** phase 01 + 02 (đã superseded)
**Căn cứ:** `plans/reports/redteam-adjudication-260813-0139-design-system.md`

## Đảo hướng so với plan cũ — đọc trước khi làm

Plan cũ định **xóa** 17 tên trùng + khối `--text-*` khỏi `console.css`. Red-team đo bằng jsdom probe: việc đó
đổi 8 vai trò chữ trên toàn admin, tới **+45%** (`--text-display-2-size` 22→32px), diện tiêu thụ 48 file.

**Khối `--text-*` trong `console.css` KHÔNG phải lỗi — nó là cơ chế tạo typography đặc kiểu Odoo cho admin.**
Cái sai duy nhất: nó không được ghi ra là cố ý, và không có test nào chốt giá trị resolve.

⇒ **Không xóa gì cả. Giữ nguyên precedence, chốt nó bằng test.** Bất biến trở nên testable mà **không dịch
một pixel nào**.

## Việc

### 1. Sửa assertion nói dối — `packages/ui/src/astryx-theme-cmc.test.ts:16-24`

Comment hiện khẳng định bảo đảm "bất kể giá trị của console.css" — điều bất khả thi vì `.o_web_client` lồng
**trong** `[data-astryx-theme]` nên luôn thắng. Sửa comment + assertion để nói đúng sự thật: **bên trong
shell admin, `console.css` cố ý thắng; bên ngoài shell (LMS), Astryx/CMC thắng.**

Cũng rà `console-astryx-remap.test.ts` và `console-tokens.test.ts:34-41`: giữ nguyên intent, chỉ sửa chỗ nào
mô tả sai lý do. **Không** đảo kỳ vọng — kỳ vọng hiện tại là đúng.

### 2. Test precedence resolve — file mới `packages/ui/src/console/console-precedence.test.ts`

Đây là test **đầu tiên trong repo** mở nhiều file CSS trong cùng một test. Cách làm đã được red-team chứng
minh chạy được:

- Nạp nội dung `tokens.css`, `astryx-theme-cmc.css`, `console.css` thành 3 thẻ `<style>` **đúng thứ tự import
  thật** vào jsdom
- Fixture: một node `.o_web_client` nằm **trong** `[data-astryx-theme="neutral"]`, và một node đối chứng
  **ngoài** `.o_web_client`
- Assert giá trị resolve cho các họ khai báo cục bộ: `--font-size-*`, `--color-text-*`, `--font-family-*`
  - trong shell → giá trị Odoo đặc (vd. `--font-size-lg` = 15px)
  - ngoài shell → giá trị CMC (vd. 16px)
- Thông báo fail phải in cả hai giá trị để người đọc hiểu ngay ai thắng

**Giới hạn phải ghi thẳng trong test:** jsdom **im lặng bỏ qua** `@import` tới node_modules
(`astryx-theme-cmc.css:16-17`), nên họ `--text-*` resolve ra rỗng ở đây — đó là lý do có mục (3).

### 3. Cổng chống hồi quy upstream — cùng file hoặc file kề

`--text-*` chỉ tồn tại trong `node_modules/@astryxdesign/theme-neutral/dist/theme.css`. Hiện **không cổng
nào** phát hiện một bản bump Astryx đổi remap đó — trong khi `.github/workflows/dependabot-auto-merge.yml`
**tự merge** patch/minor khi CI xanh. Đó là đường dẫn tới hồi quy thị giác không ai xem.

Thêm test `readFileSync` thẳng file upstream, assert **mapping** (không assert px):
- `--text-label-size` phải trỏ `--font-size-base`
- `--text-heading-3-weight` phải trỏ `--font-weight-bold`
- `--text-supporting-size` phải trỏ `--font-size-sm`

Bọc `it.skipIf(!existsSync(...))` để không vỡ trên máy chưa cài deps.

### 4. Token ma thật — `apps/admin/src/pages/crm/report.tsx:136`

`--cmc-text-supporting` được `var()` **không fallback** và không khai báo ở đâu ⇒ render rỗng. Đây là **token
ma thật duy nhất**; hai cái còn lại trong plan cũ (`--console-border`, `--console-bg-subtle` ở
`shifts-detail.tsx:113,114,116`) **đều có fallback literal** nên không hỏng gì — đừng đụng.

Sửa: dùng token đã khai trong `tokens.css` gần nghĩa nhất (kiểm trước, đừng đẻ token mới).

## Không làm trong phase này

Không xóa/đổi tên biến nào. Không thêm script CI mới. Không đụng `console.css` khối `:371-441`. Không đụng
`shifts-detail.tsx`. Không đụng `WS_CSS` trong `shifts.tsx:42`.

## Nghiệm thu

- [ ] `pnpm --filter @cmc/ui test` xanh (baseline trước khi sửa: 41 file / 148 test)
- [ ] Test precedence **đã được chứng minh đỏ được**: tạm đổi một giá trị trong `console.css` → đỏ, hoàn tác
- [ ] Test mapping upstream chạy (không skip) trên worktree đã `pnpm install`
- [ ] `pnpm typecheck` xanh
- [ ] `git diff` **không chứa** thay đổi giá trị CSS nào — chỉ test + 1 dòng `report.tsx`

## Rủi ro

Thấp. Không đổi giá trị CSS ⇒ không có rủi ro thị giác. Rủi ro duy nhất: test precedence viết sai thứ tự nạp
style rồi chốt nhầm kẻ thắng — chống bằng yêu cầu "chứng minh đỏ được" ở nghiệm thu.
