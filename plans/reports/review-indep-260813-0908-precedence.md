WEAK

HEAD `bc986bd` (develop, gồm #124 `c6062ad`). Soi code + tự đột biến. Không đọc `plans/reports/` hay `plans/260813-*`. Khung `/ak-engineer:ak-code-review` (reviewer namespaced song song; mọi claim dưới đây là thí nghiệm của lane này).

Nghiệm thu: `pnpm --filter @cmc/ui test` → **42 files / 153 tests passed** (vitest 4.1.10, ~7.6s, exit 0). Cây CSS sạch sau đột biến.

---

## (1) `console-precedence.test.ts` chốt gì thật?

Baseline: `pnpm --filter @cmc/ui exec vitest run src/console/console-precedence.test.ts` → `Tests  5 passed (5)`.

Đột biến **từng khai báo** trên khối remap `.o_web_client` trong `packages/ui/src/console.css`, chạy lại đúng lệnh trên, rồi restore.

| Bậc | Đột biến | Kết quả |
|---|---|---|
| `--font-size-{4xs,3xs,2xs,xs,sm,base,lg,xl,2xl,3xl,4xl,5xl}` (12/12) | `Npx` → `99px` | **RED** — 1 failed / 4 passed |
| `--color-text-{primary,secondary,disabled}` | cả `var(...)` → `#ff00ff` | **RED** |
| `--color-text-{primary,secondary,disabled}` | **chỉ fallback hex** `#212529`/`#6c757d` → `#ff00ff` | **GREEN** |
| `--font-family-{body,heading}` | `'Inter', …` → `'Comic Sans MS', cursive` | **RED** |

Bằng chứng đỏ (một bậc, đủ mẫu): `--font-size-4xs: 10px` → `99px`

```
AssertionError: --font-size-4xs specified as "99px" → "99px"; expected "10px"; other surface is "11px"
Expected: "10px"
Received: "99px"
Tests  1 failed | 4 passed (5)
```

Bằng chứng xanh giả — fallback-only (cả 3 bậc màu). Tái hiện:

```bash
# trong packages/ui/src/console.css
# --color-text-primary: var(--console-gray-900, #212529);
# → var(--console-gray-900, #ff00ff);  (tương tự secondary/disabled)
pnpm --filter @cmc/ui exec vitest run \
  src/console/console-precedence.test.ts \
  src/astryx-theme-cmc.test.ts \
  src/console/console-astryx-remap.test.ts \
  src/console/console-tokens.test.ts
```

Output: `Test Files  4 passed (4)` / `Tests  18 passed (18)`.

Nguyên nhân (code, không suy): suite chỉ `.toMatch(/--console-gray-900/)` trên **chuỗi specified**, rồi `expectHexColor` trên `--console-gray-900` — **không** resolve `--color-text-*`. `console-astryx-remap.test.ts:66` còn yếu hơn: `trim().length > 0`.

---

## (2) `skipIf` cổng upstream — có tắt im trên CI không?

`existsSync(resolve(cwd, 'node_modules/@astryxdesign/theme-neutral/dist/theme.css'))`.

Thí nghiệm path:

```
pnpm --filter @cmc/ui exec node  → cwd=packages/ui  existsSync=true
node từ repo root               → cwd=repo         existsSync=false
```

File **không** ở root `node_modules/`; nằm `packages/ui/node_modules/@astryxdesign/theme-neutral/dist/theme.css`. Turbo/`pnpm --filter` chạy vitest với cwd package → path đúng.

`skipIf` + `if (process.env.CI)` — tự ẩn/hiện file, chạy `-t upstream`:

| | file có | file mất |
|---|---|---|
| `CI` unset | 2 passed / 3 skipped (3 test precedence bị `-t` bỏ) | **1 passed / 4 skipped** — mapping **skip im** |
| `CI=true` | 2 passed | **FAIL** `expected false to be true` tại L248 |

Output C (mất file, không CI): `Tests  1 passed | 4 skipped (5)` — file test vẫn PASS.
Output D (mất file, `CI=true`): `keeps the upstream theme file present when CI is set` đỏ.

CI thật (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile` (không `--prod`, không `NODE_ENV=production`), rồi `pnpm test` → turbo `vitest run` trong `@cmc/ui`. `@astryxdesign/theme-neutral@0.2.0` là **devDependency + peer** của `@cmc/ui`. GHA set `CI=true`.

**Kết luận Q2:** trên job `typecheck-and-test` hiện tại, `skipIf` **không** tắt im — file có mặt sau full install; nếu mất, test hiện diện `CI` đỏ. `skipIf` **có** tắt im khi `CI` không set (máy dev / job lạ). Mapping suite đọc **vendor** `theme.css` (`--text-label-size: var(--font-size-base)`), **không** đọc remap của `console.css` (`--text-label-size: var(--font-size-sm)`). Đó là chốt vendor, không phải chốt precedence admin.

---

## (3) Đổi precedence mà mọi test CSS liên quan vẫn xanh?

Có. Ba đường đã chạy 4 suite (precedence + astryx-theme-cmc + remap + tokens) = **18/18 green**:

**A. Đảo winner màu, giữ substring token**

```css
--color-text-primary: var(--cmc-text, var(--console-gray-900));
```

`Tests  18 passed (18)`. Shell ưu tiên `--cmc-text`; regex vẫn thấy `--console-gray-900`.

**B. Đổi `--text-*` không nằm checklist**

- `--text-heading-1-size: var(--font-size-2xl)` → `var(--font-size-5xl)` → 18/18
- `--text-heading-3-weight: 600` → `400` → 18/18

Remap chỉ pin body / heading-5/6 / label / supporting + 2 weight. Upstream pin vendor, không pin console.

**C. Fallback hex** — xem (1). 18/18.

Đường **không** lọt (đối chứng):

- Xóa `--font-size-xs/sm/base` (3 bậc **trùng px** CMC 12/13/14): **precedence 5/5 xanh** (không phân biệt inherit vs specified), nhưng remap + tokens đỏ (`expected '' to be '14px'`; `includes('--font-size-base: 14px')`).
- Comment-out 3 bậc, giữ substring: tokens xanh, **precedence 5/5 xanh**, remap đỏ.
- Đổi selector khối remap `.o_web_client` → `.console-main`: precedence đỏ (`--font-size-4xs` shell `11px` expected `10px`; `--font-size-4xl` shell=outside=`32px`).

`astryx-theme-cmc.test.ts` chỉ `toMatch(/--font-size-X\s*:/)` — không pin giá trị. Không cứu được (3)A–C vì cũng không bắt chúng.

---

## Vững

- 12 bậc `--font-size-*` trên shell: bảng `SHELL_FONT_SIZE` hard-pin px; đột biến giá trị → đỏ.
- `--font-family-body/heading`: so khớp chuỗi jsdom; đổi family → đỏ.
- Đổi **cả** `var()` của `--color-text-*` sang hex trần → đỏ.
- Kéo cả khối remap khỏi `.o_web_client` → đỏ (precedence + remap).
- Bề mặt outside: `OUTSIDE_FONT_SIZE` + hex `--cmc-text*` + `var(--cmc-*)` — không bị đột biến `console.css` làm xanh nhầm.
- Trên CI hiện tại, vendor file được cài và cổng `CI` không no-op.

---

## Verdict

Không SOLID: màu và `--text-*` role không chốt winner. Không BROKEN: type scale + family + selector `.o_web_client` là pin thật, đã chứng minh đỏ/xanh.

Lỗ phải vá nếu muốn pin precedence: resolve `--color-text-*` (hex/rgb sau 1 hop), cấm CMC-first khi vẫn chứa substring console, pin đủ `--text-*-size/weight` trên shell, và đừng `skipIf` im khi không có `CI`.

LANE DONE precedence
