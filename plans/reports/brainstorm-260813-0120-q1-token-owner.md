# Q1 — Ai sở hữu token trong `.o_web_client`?

**Mode:** brainstorm → advise (read-only). Interview collapsed — chủ đã khóa outcome/A/B/lập trường.

## Contract

- **Outcome:** một chủ sở hữu tên biến rõ trong `.o_web_client`; CI chứng minh không còn đè tên.
- **Constraints:** 1 người + AI; review = CI (`typecheck-and-test`, `ui-e2e`); **không** visual regression; branch + PR.
- **Non-goals:** A hội tụ màu/radius/canvas; dark mode; `data-theme=cmc-soft|console-odoo`; đụng LMS.
- **Acceptance:** giao tên *khai báo* giữa 3 file CSS = ∅; remap test không còn *đòi* collision; `@cmc/ui` test xanh.

## Verdict (advise)

Lập trường **đúng hướng, sai 3 chỗ**. B-namespace trước là bước đúng cho solo+CI. Đừng xây “hai theme có tên”.

1. **Sai: B visually inert.** Xóa/đổi 17 tên Astryx trên `.o_web_client` thì Astryx + `h1–small` (`console.css:434-441`) inherit `:root` CMC: `--font-size-lg` 15→16, `--font-size-2xl` 18→24. `ui-e2e` không bắt. B *thu nhỏ* A, không tránh pixel.
2. **Sai: giao 3 file rỗng = đủ.** `tokens ∩ console` *đã* ∅. Collision thật = `astryx-theme-cmc.css ∩ console.css` (17 tên). `--text-*` (`console.css:387-426`) **không** nằm trong giao 3 file nhưng vẫn đè API Astryx (theme-neutral import). Test 3 file sẽ xanh trong khi `--text-body-size` vẫn cướp primitive.
3. **Sai: A = rewrite 2498 dòng.** A chỉ cần đổi canvas/border/text shell + bỏ flatten `#fff`. Vẫn cấm không VRT. B không phải 2498 dòng — ~70 LOC + 2 test.

**B visually inert không tồn tại:** giữ `--font-size-lg` trên `.o_web_client` thì giao ≠ ∅. Alias `--console-*` rồi *vẫn set* `--font-size-*` là B giả.

**Chủ sở hữu (B-narrow):** `:root --cmc-*` = `tokens.css`. API Astryx (`--font-size-*`, `--color-text-*`, `--font-family-*`, `--text-*`, `--radius-*`) = `astryx-theme-cmc.css` **kể cả trong shell**. `.o_web_client` chỉ được *khai báo* `--console-*`. `--cmc-*` inherit, không khai báo lại.

## 17 tên trùng — xóa phía `console.css` (đừng invent `--console-font-size-lg` trừ khi heading còn cần Odoo)

| Tên | astryx-theme-cmc.css | console.css |
|---|---:|---:|
| `--font-size-4xs` | 70 | 373 |
| `--font-size-3xs` | 71 | 374 |
| `--font-size-2xs` | 72 | 375 |
| `--font-size-xs` | 73 | 376 |
| `--font-size-sm` | 74 | 377 |
| `--font-size-base` | 75 | 378 |
| `--font-size-lg` | 76 | 379 |
| `--font-size-xl` | 77 | 380 |
| `--font-size-2xl` | 78 | 381 |
| `--font-size-3xl` | 79 | 382 |
| `--font-size-4xl` | 80 | 383 |
| `--font-size-5xl` | 81 | 384 |
| `--font-family-body` | 60 | 402 |
| `--font-family-heading` | 61 | 403 |
| `--color-text-primary` | 27 | 428 |
| `--color-text-secondary` | 28 | 429 |
| `--color-text-disabled` | 29 | 430 |

**Cùng PR phải gỡ** (không có trong giao 3 file): `--text-heading-*-size/weight/leading`, `--text-body-*`, `--text-large-*`, `--text-label-*`, `--text-code-*`, `--text-supporting-*`, `--text-display-*-size` — `console.css:387-426`. `h1–small` `:434-441` đổi sang `var(--font-size-*)` *inherit* (CMC) hoặc `--cmc-fs-*`.

**Không đụng:** `--console-*`, `--cmc-*` (chỉ consume), `--radius-*` (chỉ ở astryx).

## Test cross-file (tránh bẫy `readFileSync` 1 file)

File mới, vd. `packages/ui/src/token-name-isolation.test.ts`. **Parse 3 file trong cùng 1 test.**

1. Extract *declarations* thôi: regex `/(--[a-z0-9-]+)\s*:/` trên dòng không phải comment. **Cấm** `includes('--font-size-lg')` (dính comment `:63-69`).
2. `decl(tokens) ∩ decl(astryx) === ∅` và `decl(tokens) ∩ decl(console) === ∅` (baseline).
3. **Gate:** `decl(astryx) ∩ decl(console) === ∅`. Fail in ra đúng 17 tên nếu còn.
4. `decl(console)` ⊆ `{--console-*} ∪ {--console-sc-*}` — chặn `--text-*` / `--color-text-*` sống sót.
5. (Nên) parse `node_modules/@astryxdesign/theme-neutral/theme.css` nếu có: `decl(console) ∩ decl(astryxUpstream) === ∅`.
6. **Đảo** `console-tokens.test.ts:34-41` và `console-astryx-remap.test.ts` — chúng *đòi* collision. Thay: trên fixture `.o_web_client` *trong* `[data-astryx-theme=neutral]`, `--font-size-lg` === giá trị `:root` CMC (`16px` / `var(--cmc-fs-title)`), không còn `15px`.

`typecheck-and-test` bắt tên. `ui-e2e` không bắt 15→16.

## Thứ tự an toàn

1. Viết test (3)(4)(6) **đỏ**.  
2. Xóa 17 + block `--text-*` + `color-scheme` giữ `light`.  
3. Sửa `h1–small` → inherit Astryx/CMC.  
4. Xanh test mới; xóa/viết lại remap tests.  
5. PR nhỏ; nhìn 3 màn: list + detail + dashboard (h1/Astryx Button).  
6. A sau, PR riêng, khi có mắt người hoặc VRT.

## Vỡ gì / dấu hiệu

| Vỡ | Dấu hiệu không cần VRT |
|---|---|
| Quên xóa `--text-*` | test (4) đỏ |
| Quên đảo remap test | `@cmc/ui` test đỏ ngay |
| h1 nhảy 18→24 | list title “to hơn navbar”; e2e hiếm fail |
| Astryx Button/Text CMC | form/dialog chữ lớn hơn hàng list `--console-font-size-*` |
| AI set lại `--font-size-lg` trên `.o_web_client` | test (3) đỏ trên PR |

## Công + checklist

~0.5–1 ngày / 1 PR / ~70 LOC + 1 test file + sửa 2 test — không phải 2498 dòng. A = PR sau.

- [ ] Test giao `astryx ∩ console === ∅` + allowlist `--console-*`
- [ ] Xóa 17 tên + `--text-*` khỏi `console.css:371-431`
- [ ] `h1–small` không bind thang Odoo
- [ ] Đảo remap/tokens tests
- [ ] `pnpm` test `@cmc/ui` + PR; không merge `main` local
