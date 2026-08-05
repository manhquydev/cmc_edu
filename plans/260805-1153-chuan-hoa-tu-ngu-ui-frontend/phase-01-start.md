---
phase: 1
title: "Chuẩn copy + config audit sinh worklist (TDD)"
status: pending
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1: Chuẩn copy + config audit sinh worklist (TDD)

## Overview

Siết luật điền subtitle trong frame spec, mở rộng chuẩn copy ở SoT, và dựng config
audit riêng để sinh worklist mà **không** đụng gate nào.

## Requirements

**Functional**
- Luật subtitle nằm ở `PAGE-FRAMES.md` (nơi cấp phát slot), không phải nơi khác.
- Chuẩn copy mở rộng ở `MASTER.md` §"Copy / i18n UI" (Global SoT).
- Lint rule bắt định danh nội bộ trong `JSXAttribute` literal, **không FP email**.

**Non-functional**
- Rule **KHÔNG** vào `eslint.config.js` ở phase này. `pnpm lint` phải **vẫn xanh** và `git commit` **không bị chặn**.
- Không bật thêm ruleset. Đọc comment đầu `eslint.config.js` trước khi sửa.

## Architecture

### Nơi ghi luật — đã resolve authority sau red-team

```text
design-system/cmc-edu/
  README.md        ← index; xếp pages/<name>.md TRÊN MASTER
  MASTER.md        ← Global SoT; §"Copy / i18n UI" (bảng 5 dòng, cần mở rộng)
  PAGE-FRAMES.md   ← CẤP PHÁT SLOT frame — :38 Dashboard, :55 ListPage đều có subtitle
  VIEW-GRAMMAR.md  ← ngữ pháp tương tác (không nhắc subtitle)
  pages/cockpit.md ← "Frame (locked)" + subtitle greeting
```

**Luật subtitle mới (giữ slot, siết điều kiện điền):**

> `subtitle` hợp lệ khi mang thông tin **không suy ra được** từ title + nội dung
> đang hiển thị: ràng buộc (giới hạn kết quả), hệ quả nghiệp vụ, hoặc danh tính
> phiên (greeting cockpit). Diễn đạt lại title ⇒ bỏ.

Ghi vào `PAGE-FRAMES.md` cạnh :38 và :55. `pages/cockpit.md:7` **vẫn hợp lệ** dưới
luật này (greeting mang danh tính) — không sửa.

### Lint rule — KHÔNG vào `eslint.config.js` ở phase này (vá R2)

**R2 bác bỏ cách `warn`:** `.husky/pre-commit` chạy lint-staged với
`eslint --no-warn-ignored --max-warnings=0` ⇒ `warn` **cũng chặn commit**. Đưa
rule vào config chính ở Phase 1 sẽ làm Phase 2 không commit nổi file đầu tiên
chứa vi phạm thuộc phase khác.

**Cách dùng (đã chạy thật, sinh ra worklist 16 vị trí):** config audit **riêng**,
không được `pnpm lint` hay lint-staged tham chiếu.

```js
// eslint.copy-audit.config.js — CHỈ để sinh worklist, KHÔNG phải config chính
import tseslint from 'typescript-eslint';
export default [{
  files: ['apps/admin/**/*.{ts,tsx}', 'apps/lms/**/*.{ts,tsx}'],
  ignores: ['apps/admin/src/pages/design-lab.tsx',
            'apps/admin/src/pages/design-lab-wireframes.tsx'],
  languageOptions: { parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
  plugins: { '@typescript-eslint': tseslint.plugin },       // ⚠️ bắt buộc (1)
  linterOptions: { reportUnusedDisableDirectives: 'off' },  // ⚠️ bắt buộc (2)
  rules: { 'no-restricted-syntax': ['error', {
    selector: 'JSXAttribute[name.name=/^(title|subtitle|description|label|message|hint)$/]'
            + ' > Literal[value=/<PATTERN>/]',
    message: 'internal-identifier-in-user-facing-string',
  }]},
}];
```

Chạy: `npx eslint --config eslint.copy-audit.config.js apps/admin apps/lms -f json`

⚠️ **(1) `plugins`** — thiếu thì các directive `eslint-disable` sẵn có gây hàng
loạt lỗi "Definition for rule not found" (đã gặp khi sinh worklist).
⚠️ **(2) `linterOptions`** — thiếu thì ra **30 problem** (16 thật + 14 "Unused
eslint-disable directive"), tiêu chí "0 vi phạm" không đọc được. `eslint.config.js:47`
đã có dòng này kèm comment giải thích — copy sang.

**Token pattern (12, nhắm đích danh — không dùng regex tổng quát):**
`SettingsShell` · `FullCalendar` · `ConsoleEmailTransport` · `auth identity` ·
`super_admin` · `AI agent` · `ai:recon` · `\bCRUD\b` · `testAppointment\.` ·
`finance\.refundCreate` · `\bEntity\b` · `API .{0,40}chưa khả dụng`

**Thay đổi so với bản đầu (do red-team):**
- Bỏ `placeholder` khỏi attribute — nguồn FP email chính.
- Bỏ regex tổng quát `\w+\.\w+` — permission code đã ra khỏi phạm vi (non-goal).
- **Thêm** `\bEntity\b` và `API … chưa khả dụng` — R2 chỉ ra 5 dòng bị gắn nhãn
  "✅lint" sai vì thiếu 2 token này.

**Giới hạn — `MASTER.md` phải ghi ĐỦ CẢ HAI (vá R3):**

1. **Giới hạn dạng AST** — chỉ phủ `Literal` trong `JSXAttribute`. Không phủ
   JSXText, template literal, object literal ⇒ 9 vị trí lint mù (artifact mục B).
2. **Giới hạn danh sách token (đóng)** — pattern chỉ có 12 token. Những thứ chính
   đợt này đang dọn mà **không** nằm trong pattern: `Net`, `SoD`, `server-side`,
   `O1–O5`. Sau Phase 5 chúng **không được guard** kể cả khi tái xuất hiện ở đúng
   `JSXAttribute > Literal`.

Kèm câu: *"thêm token mới khi phát hiện lớp rò rỉ mới"* — nếu chỉ ghi giới hạn (1),
tài liệu chuẩn sẽ **nói quá** về mức bảo vệ thực tế.

Lint = **guard chống tái phát trong phạm vi 12 token**, KHÔNG phải thước đo hoàn thành.

### 🔒 Ràng buộc token ↔ Open question 1

Token `auth identity` chỉ khớp `users.tsx:346` (đang chờ OQ1). Nếu OQ1 = "giữ
nhãn form" ⇒ **cùng lúc gỡ token đó khỏi pattern** trước khi Phase 5 gộp rule.
Không để nhánh này treo.

## Related Code Files

- Modify: `design-system/cmc-edu/PAGE-FRAMES.md` (luật siết cạnh :38, :55)
- Modify: `design-system/cmc-edu/MASTER.md` (§"Copy / i18n UI" + mục giới hạn lint)
- Create: `eslint.copy-audit.config.js` (config audit riêng — **không** đụng `eslint.config.js`)
- Read trước khi ghi: `PAGE-FRAMES.md`, `pages/*.md`, `MASTER.md`, `VIEW-GRAMMAR.md`, `README.md`
- **KHÔNG modify:** `eslint.config.js` (để Phase 5), `package.json` lint-staged

## Implementation Steps

1. **Tiên quyết:** commit fix bảo mật `login.tsx` → PR → merge. **Cấm stash.**
   Rồi cắt `feat/ui-copy-standard`.
   ⚠️ Xem `plan.md` §Git hygiene: fix đó **không** khắc phục được lỗ hổng (repo
   PUBLIC, giá trị đã trong lịch sử git) — việc đổi cơ chế mật khẩu backend là
   task riêng, không thuộc plan này.
2. Đọc **đủ 5 file** design-system. Bản đầu bỏ sót `PAGE-FRAMES.md` và `pages/` —
   gốc của sai lầm lớn nhất R1.
3. Ghi luật subtitle vào `PAGE-FRAMES.md` (cạnh :38 và :55), chuẩn copy vào
   `MASTER.md`, kèm mục "Giới hạn lint" nêu 3 dạng AST không phủ.
4. **TDD — fixture trước:** fixture phải dùng attribute **nằm trong selector**
   (không phải `placeholder`, vì `placeholder` đã bị loại ⇒ test sẽ luôn xanh một
   cách vô nghĩa — R2 gọi đúng đây là "phantom test").
   Ca dương: `description="… finance.refundCreate …"`.
   Ca âm chống FP: `description="Gửi mail tới parent@example.com"`,
   `description="VD: facility.update"`, 1 câu tiếng Việt có dấu chấm giữa 2 từ.
5. Chạy fixture với config audit → đỏ đúng ca dương, **xanh cả 3 ca âm**.
6. Tạo `eslint.copy-audit.config.js` (có `plugins` đăng ký — bắt buộc).
7. Sinh worklist:
   `npx eslint --config eslint.copy-audit.config.js apps/admin apps/lms -f json`
   → đối chiếu với artifact đã có
   (`plans/reports/…-d2-worklist-machine-generated.md`, 16 vị trí). Lệch ⇒ điều
   tra, **không** chỉnh regex cho khớp số.
8. Xác nhận `pnpm lint` (config chính) **vẫn exit 0** và `git commit` được — tức
   config audit không rò rỉ vào gate nào.

## Tests / Validation

- Fixture: đỏ ca dương, xanh 3 ca âm — dùng attribute thật trong selector.
- Worklist sinh ra khớp artifact 16 vị trí.
- `pnpm lint` exit 0 (config chính **chưa** có rule mới).
- `git commit` một file bất kỳ trong `apps/admin` **không bị lint-staged chặn**.
- `pnpm typecheck` + `pnpm test` xanh (phase này không đụng code app).

## Success Criteria

- [ ] Đã đọc `PAGE-FRAMES.md` + `pages/*.md` trước khi ghi luật
- [ ] `PAGE-FRAMES.md` có luật siết subtitle; slot **vẫn còn**; cockpit vẫn hợp lệ
- [ ] `MASTER.md` §Copy mở rộng + mục "Giới hạn lint" (3 dạng AST)
- [ ] `eslint.copy-audit.config.js` tồn tại, có `plugins` đăng ký
- [ ] **`eslint.config.js` KHÔNG bị sửa** (kiểm `git diff --stat origin/main...HEAD -- eslint.config.js` rỗng)
- [ ] `pnpm lint` exit 0 và commit không bị chặn
- [ ] Fixture dùng attribute trong selector (không phải `placeholder`)
- [ ] Worklist khớp artifact 16 vị trí
- [ ] Branch tách sạch, fix bảo mật đã merge trước

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Lại bỏ sót file authority | Bước 2 liệt kê đích danh 5 file bắt buộc đọc |
| Rule vào config chính → lint-staged chặn commit | Cấm sửa `eslint.config.js`; success criteria kiểm `git diff` rỗng |
| Fixture phantom (luôn xanh) | Bước 4 bắt buộc dùng attribute trong selector |
| Thiếu `plugins` → nổ "rule not found" | Bước 6 nêu rõ; đã gặp thật khi sinh worklist |
| Chỉnh regex cho khớp số | Bước 7 cấm minh thị — điều tra thay vì chỉnh |
| Luật mới mâu thuẫn `pages/cockpit.md` (locked) | Luật viết sao cho greeting cockpit vẫn hợp lệ |
