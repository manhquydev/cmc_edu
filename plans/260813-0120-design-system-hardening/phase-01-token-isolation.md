> **SUPERSEDED 2026-08-13 sau red-team 4 lens.** Không thi hành file này nguyên trạng.
> Phán quyết: `plans/reports/redteam-adjudication-260813-0139-design-system.md`.
> Phần còn hiệu lực đã chuyển sang `phase-A-precedence-pin.md` / `phase-B-docs-and-gates.md`.

# Phase 01 — Tách tên token, dựng cổng cross-file

**Trạng thái:** superseded — không thi hành; thay bằng phase A · **Công:** 0.5–1 ngày · **Branch:** `fix/token-name-isolation` từ `develop`
**Bằng chứng đầy đủ:** `plans/reports/brainstorm-260813-0120-q1-token-owner.md`,
`plans/reports/audit-260813-0052-ds-l1-foundations.md` (P0-2)

## Mục tiêu

Một chủ sở hữu cho mỗi tên biến. Sau phase này, việc một file CSS khai lại tên biến của file khác sẽ **làm đỏ CI**.

Chủ sở hữu đã chốt:
- `:root` `--cmc-*` → `tokens.css`
- API Astryx (`--font-size-*`, `--color-text-*`, `--font-family-*`, `--text-*`, `--radius-*`) → `astryx-theme-cmc.css`, kể cả trong shell
- `.o_web_client` chỉ được khai `--console-*`

## Cảnh báo trước khi làm

Phase này **có đổi pixel**. Xóa 17 tên trùng thì Astryx và `h1–small` inherit ngược lên `:root` CMC:
`--font-size-lg` 15→16px, `--font-size-2xl` 18→24px. `ui-e2e` không bắt được. Đây là thay đổi có chủ đích,
đổi lấy một thang chữ duy nhất — không phải hồi quy.

## File sửa

**Xóa khỏi `packages/ui/src/console.css`** (khối `:371-431`) — 17 tên trùng với `astryx-theme-cmc.css`:

| Nhóm | Tên | console.css |
|---|---|---|
| Type scale | `--font-size-{4xs,3xs,2xs,xs,sm,base,lg,xl,2xl,3xl,4xl,5xl}` | `:373-384` |
| Font family | `--font-family-{body,heading}` | `:402-403` |
| Text color | `--color-text-{primary,secondary,disabled}` | `:428-430` |

**Xóa cùng PR** — khối `--text-*` `console.css:387-426` (`--text-heading-*`, `--text-body-*`, `--text-large-*`,
`--text-label-*`, `--text-code-*`, `--text-supporting-*`, `--text-display-*`). Khối này **không** nằm trong
giao 3 file nhưng vẫn đè API Astryx qua theme-neutral import — bỏ sót là test xanh mà bug còn nguyên.

**Sửa** `console.css:434-441` — `h1`–`small` đổi sang `var(--font-size-*)` inherit hoặc `--cmc-fs-*`,
không bind vào thang Odoo nữa.

**Không đụng:** `--console-*`, `--cmc-*` (chỉ consume), `--radius-*` (chỉ ở astryx), `color-scheme: light`.

## Test mới — `packages/ui/src/token-name-isolation.test.ts`

Parse **cả 3 file trong cùng một test**. Đây là điểm khác biệt với mọi test CSS hiện có.

1. Trích **declaration** bằng regex `/(--[a-z0-9-]+)\s*:/` trên dòng không phải comment.
   **Cấm** `includes('--font-size-lg')` — dính comment `astryx-theme-cmc.css:63-69`.
2. `decl(tokens) ∩ decl(astryx) === ∅` và `decl(tokens) ∩ decl(console) === ∅` (baseline, hiện đã đúng)
3. **Gate chính:** `decl(astryx) ∩ decl(console) === ∅`. Thông báo fail phải in đúng tên còn sót.
4. **Allowlist:** `decl(console) ⊆ {--console-*} ∪ {--console-sc-*}` — chặn `--text-*`/`--color-text-*` sống sót.
5. Nếu `node_modules/@astryxdesign/theme-neutral/theme.css` tồn tại: `decl(console) ∩ decl(astryxUpstream) === ∅`.

## Test phải đảo

`console-tokens.test.ts:34-41` và `console-astryx-remap.test.ts` hiện **đòi** collision tồn tại — chúng sẽ
đỏ, và đỏ là đúng. Viết lại: trên fixture `.o_web_client` nằm trong `[data-astryx-theme=neutral]`,
`--font-size-lg` phải bằng giá trị `:root` CMC (16px / `var(--cmc-fs-title)`), không còn 15px.

Cũng sửa `astryx-theme-cmc.test.ts:16-24` — hiện assert một bảo đảm bất khả thi ("bất kể console.css");
đổi thành require `var(--cmc-fs-*)`.

## Thứ tự thực hiện

1. Viết test (3)(4) và test đảo (6) → **đỏ trước**
2. Xóa 17 tên + khối `--text-*`
3. Sửa `h1`–`small`
4. Chạy `pnpm --filter @cmc/ui test` → xanh
5. PR nhỏ, một mục đích

## Nghiệm thu

- [ ] Test cross-file xanh, và **đã chứng minh nó đỏ được** trước khi xóa
- [ ] `pnpm typecheck` + test `@cmc/ui` xanh
- [ ] `typecheck-and-test` + `ui-e2e` xanh trên PR
- [ ] Soi mắt **đúng 3 màn**: một list, một detail, một dashboard — kiểm h1 và Astryx Button

## Rủi ro / rollback

| Vỡ | Dấu hiệu |
|---|---|
| Quên xóa `--text-*` | Test allowlist (4) đỏ |
| Quên đảo remap test | Test `@cmc/ui` đỏ ngay |
| h1 nhảy 18→24px | Tiêu đề list "to hơn navbar" khi soi mắt |
| Chữ Astryx trong form/dialog lớn hơn hàng list | So form với list cùng màn |
| Agent sau set lại `--font-size-lg` trên `.o_web_client` | Test (3) đỏ trên PR đó |

Rollback: revert một PR. Không có migration, không có state.