# Phase spec — đóng P0 authority-split (doc)

**Parent:** `plans/reports/audit-260813-0052-ds-l3-drift.md`  
**Scope:** docs + 2 comment + `llms.txt` + 1 grep-check CI. Không đổi hành vi UI.  
**Vì sao:** 1 người + AI; agent tương lai đọc index/TL12/kit để biết ngôn ngữ UI. Doc sai = ship `AppFrame`/`ck-*`.

## 0. TL12 — sửa tại chỗ, không chỉ đóng dấu

Banner `:8–13` đã stamped nhưng agent đọc §1/§4.5. Stamp-only để sót AppFrame / `.premium-` / `--sh-*`.  
**Quyết định:** giữ TL12 SoT cho **LMS + `--cmc-*`**; **viết lại** chrome + class-prefix trong body. Đổi “Odoo backend UI language” → **CMC Console**.

## 1. File + thay thế (làm đúng các dòng này)

### `docs/README.md`
- `:15` `TL02 → TL06 → TL12 (design) → TL18`  
  → `TL02 → TL06 → [design-system-console.md](./design-system-console.md) (admin) + TL12 (LMS/tokens) → TL18`
- `:41` `TL12 — Design system & đặc tả UI`  
  → `TL12 — LMS + shared --cmc-* (admin chrome: design-system-console.md)`

### `docs/12-design-system-ui.md`
- `:8–9` “Odoo backend UI language” → “CMC Console (`docs/design-system-console.md`)”
- `:23–30` xóa `app shell (AppFrame + SideNav)` và `(--sh-*`, `--tpl-*` CSS classes)`. Thay 1 câu: Admin shell = `.o_web_client` + `ConsoleNavbar`; LMS = `lms-*` trong `app.css`; **cấm** emit `ck-*`/`tpl-*`/`sh-*`/`premium-`.
- `:76–80` xóa “blur-nav sticky” / “radius pill (12px)” như chrome admin (giữ light-only, `#0071E3`, `LineIcon`).
- `:87` `.premium-` → `.console-*` (admin). LMS không dùng prefix đó.
- `:95–101` **xóa cả khối App frame.** Thay: `apps/admin/src/shell/shell.tsx` = `.o_web_client` + `ConsoleNavbar` + `main.console-main`. Astryx `SideNav` trong `primitives.ts` là one-door re-export, **không** phải admin chrome.
- `:111–116` ghi “historical 2026-07”; không còn adoption SoT.

### `design-system/cmc-edu/STRUCTURE.md`
- `:3` bỏ `` `.ck-*` `` → `` `.console-*` (admin) / `lms-*` (LMS) ``
- `:18` xóa utilities `.ck-surface*`
- `:70` `AppFrame, SideNav` → `ConsoleNavbar` + trỏ console.md

### `design-system/cmc-edu/PAGE-FRAMES.md`
- `:13–16` diagram: `ConsoleNavbar` + `main.console-main` + `.console-wrap` (không AppFrame/`tpl-wrap`)
- `:25–27` Shell = `ConsoleNavbar` / `.console-*`; atoms = `.console-*` (không `.sh-*`/`.ck-*`)
- `:68` `.tpl-wrap--ops` → `.console-wrap--ops`
- `:155` AppFrame → ConsoleNavbar

### `design-system/cmc-edu/MASTER.md`
- `:146` layout = `ConsoleNavbar` + `ListPage`/`DetailPage`/`FormPage`
- `:152–153` xóa `.sh-cta--*` khỏi missing-primitives
- `:164–168` tree → `.o_web_client` / `ConsoleNavbar` (46px) / `main.console-main`

### `docs/design-system-console.md` — hết im lặng
Thêm 2 hàng Implementation + Verification:
1. **Astryx one-door** `packages/ui/src/primitives.ts` (Text/Button/… + **SideNav re-export `:35–41`**). Không phải shell. Cấm SideNav cho chrome mới.
2. **CI drift gates (đã chạy):** `pnpm check:ui-ratchet` = `scripts/ui-ratchet.mjs`; `pnpm check:ui-frames` = `scripts/check-ui-frames.mjs --strict`. Wire: `.github/workflows/ci.yml:112–119`. Ghi rõ FilterBar **đếm**, không lock rename. Holdout FilterBar: leaderboard, refund, **class-placement**.

## 2. Comment chết

| Loc | Làm | Lý do |
|-----|-----|-------|
| `packages/ui/src/index.ts:166–169` | **Sửa** → “Nav types + `activeModuleId` cho ConsoleNavbar. Không AppFrame/`.sh-*`.” | Comment nói dối; export bên dưới không phải shell |
| `packages/ui/src/console.css:1394` | **Sửa** xóa “Remaining `sh-*` owned by SideNav/AppFrame” | Selector `.sh-*` = 0 |
| `packages/ui/src/primitives.ts:35–41` | **Giữ** | One-door Astryx; 0 consumer admin/LMS; xóa = đổi public contract. Document ở console.md |
| `packages/ui/llms.txt:79` | **Sửa** `premium.css` → `console.css` (admin); LMS = `app.css` | Follow file này = import file đã xóa |
| `console-navbar.tsx:8` | **Giữ** | Negative example, đúng |

## 3. Kiểm chứng — chưa có test docs → thêm grep-check CI

Không có test nào assert “tài liệu không trỏ sai”. Mắt không đủ (solo/AI).

**Thêm** `scripts/check-doc-authority.mjs` + `package.json` `check:doc-authority`. Gắn `typecheck-and-test` ngay sau ratchet (`ci.yml` sau dòng 119).

Allowlist cứng. Exit 1 nếu còn hit:

| Path | Cấm (live instruction) |
|------|------------------------|
| `docs/README.md` | frontend path thiếu `design-system-console` |
| `docs/12-design-system-ui.md` | `AppFrame`, `.premium-`, `--sh-*` |
| `design-system/cmc-edu/{STRUCTURE,PAGE-FRAMES,MASTER}.md` | `AppFrame`, `.ck-surface`, `.sh-*`, `tpl-wrap` |
| `packages/ui/llms.txt` | `premium.css` |
| `packages/ui/src/index.ts` | comment `.sh-*` |

Không quét `plans/` hay changelog. In file:line. Test node nhỏ: inject 1 chuỗi cấm vào fixture → fail; HEAD sạch → pass.

**Done khi:** script xanh; `rg -n 'AppFrame|\.ck-surface|\.sh-\*|tpl-wrap|\.premium-|premium\.css' ` trên allowlist = 0. Spot mắt: TL12 vẫn SoT LMS; `primitives.ts` vẫn export SideNav.

Ngoài scope: `VIEW-GRAMMAR.md:22`, `STYLING-BRIDGE.md` (cùng pattern, phase sau).
