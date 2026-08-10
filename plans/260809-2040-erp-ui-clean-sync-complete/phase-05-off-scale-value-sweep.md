---
phase: 5
title: "Off-scale value sweep"
status: completed
priority: P1
effort: "1-2d (nhiều PR nhỏ)"
dependencies: [4]
---

# Phase 5: Quét giá trị lệch thang trong console.css

## Overview

`console.css` khai báo một số lần font-size lệch thang thật (đã hiệu chỉnh: 29 lần, 3 giá trị
phân số) và một phần radius vượt ngưỡng ở 7/33 trang. Chỉ sửa **giá trị lệch thang** — không
token hoá toàn bộ file. **Re-baseline sau Phase 2** (Phase 2 xoá một số khối CSS, số dòng đích
của phase này sẽ đổi).

## ⛔ TIỀN ĐỀ "BƯỚC 0" ĐÃ BỊ BÁC BỎ (2026-08-10) — cùng lỗi chẩn đoán như Phase 4

Bản đầu viết: *"Thang type … KHÔNG tồn tại dưới dạng token trong repo."* **Sai.** Đọc trực tiếp
2 file xác nhận **cả hai thang đã là token thật, từ trước**, đúng mô hình "hai vùng có chủ đích"
đã chốt ở Phase 4 cho radius:

| Vùng | Thang | Nguồn | Trạng thái |
|---|---|---|---|
| Console (`.o_web_client`) | 10·10·11·12·13·14·15·16·18·20·22·24px | `console.css:373-384` — `--font-size-4xs` … `--font-size-5xl`, đã dùng làm `var()` cho `h1`-`h6`/`p`/`small` tại `:434-441` | ✅ Token thật, đủ bộ |
| Premium (semantic role) | 11·12·14·16·18·24·32px | `tokens.css:98-105` — `--cmc-fs-label/meta/body/title/h3/page/metric`, comment sẵn *"Type scale — roles not orphans"* | ✅ Token thật, đủ bộ |

`--cmc-font-size-data: 13px` / `--cmc-font-size-column: 11px` (tokens.css:55-56) là **một cặp
token thứ ba**, phạm vi hẹp hơn (Astryx bridge pin theo Phase 4), không phải toàn bộ thang.

⇒ **Không cần khai báo gì mới trong `tokens.css`.** "Bước 0" coi như đã xong từ trước khi phase
này bắt đầu — không có gì chặn bước 1. Tiêu chí nghiệm thu "Thang type có token thật trong
`tokens.css` trước khi Phase 6 dùng nó" (plan.md) **đạt, bằng chứng là 2 dòng trên**, không cần
sửa file.

## Phép thử Odoo cho từng giá trị nghi vấn

Source thật tại `/home/manhquy/Downloads/odoo-src`, pin `7de220c9`:

1. Grep literal hoặc biểu thức suy ra trong SCSS Odoo.
2. **Có** ⇒ giá trị trung thành → **thăng cấp thành token có tên**, giữ nguyên pixel.
3. **Không** ⇒ trôi dạt → **snap về thang gần nhất**.

**Đã verify sẵn:** `primary_variables.scss:218-220` khai báo `$o-border-radius: 4px / -sm: 3px / -lg: 6px` ⇒ **thang 3/4/6 trung thành cho console chrome** (giữ nguyên theo Phase 4). `$o-label-font-size-factor: 0.8` ⇒ Odoo **suy ra** cỡ chữ bằng hệ số, không có literal `12.5px`.

**Lưu ý quan trọng:** Odoo dùng `o-to-rem()` và hệ số Bootstrap để tính ra giá trị phân số
thật (ví dụ `$h3 = base×1.3`, `×1.1`…) — **không chỉ có literal**. Grep-for-literal có thể bỏ
sót giá trị Odoo thật render ra dạng phân số. Khi grep literal không khớp, **tính thử bằng hệ
số đã biết trước khi kết luận trôi dạt**.

## Mục tiêu cụ thể — re-baseline sau Phase 2 (2026-08-10)

Đếm trực tiếp trong `console.css` hiện tại (không phải qua sweep route) khớp đúng dự báo của
phase này ("Phase 2 xoá một số khối CSS, số dòng đích sẽ đổi"): số lần **giảm** so với bảng gốc.

| Giá trị | Số lần (gốc) | **Số lần thật hiện tại** | Chủ sở hữu | Kết quả phép thử Odoo |
|---|---|---|---|---|
| `12.5px` | 20 | **11** (`console-eh-back`, `console-meta-row`×2, `console-cstrip-legend-item`, `console-im-ctx`, `console-toast-desc`, `console-bulk-clear`, `console-page`, `console-page-indicator`, `console-set-desc`, `console-sc.is-compact .console-sc-title`) | 12 họ component | Không tìm được căn cứ (xem dưới) → **trôi dạt** |
| `13.5px` | 8 | **7** (`console-settings-nav-label`, `console-eh-sub`, `console-callout-title`×2, `console-toast-title`, `console-kv-value`, `console-sc-title`) | 6 họ component | Không tìm được căn cứ (xem dưới) → **trôi dạt** |
| `24.5px` | 1 | **0** — 0 literal, 0 khai báo `em`/`rem` nào tính ra 24.5px (kiểm cả `.console-brand{font-size:1.2em}`: ambient `.o_web_client` = `--console-font-size-base:14px` ⇒ 1.2×14=16.8px, không khớp) | — | Đã tự biến mất qua Phase 2, đóng mục |

**Phép thử Odoo đã chạy cho 12.5px/13.5px** (`/home/manhquy/Downloads/odoo-src`, pin `7de220c9`):
- Grep literal `12.5px`/`13.5px` trong toàn bộ `addons/web/static/src/scss/`: **0 khớp**.
- Hệ số đã biết duy nhất, `$o-label-font-size-factor: 0.8` (`primary_variables.scss:194`):
  14×0.8 = **11.2px** — không khớp giá trị nào trong hai giá trị nghi vấn.
- `primary_variables.scss:17-20` — mọi base font-size Odoo tự khai là **số nguyên**:
  `$o-font-size-base:14px`, `-base-touch:16px`, `-base-small:13px`, `-base-smaller:12px`.
  Không có hệ số hay literal phân số thứ hai nào trong file để thử.
⇒ **Kết luận: trôi dạt thật, không phải Odoo trung thành ở dạng phân số ẩn.** Snap về bước
thang thật gần nhất: `12.5px → 12px` (`--font-size-xs`), `13.5px → 13px` (`--font-size-sm`).
Viết literal `12px`/`13px` (không đổi sang `var(--font-size-xs)`) — khớp quy ước hiện có của
file: các dòng liền kề mỗi vị trí sửa (vd `console-settings-nav-desc` ngay dưới dòng 1018) đều
dùng literal px, chỉ `h1`-`h6`/`p`/`small` (dòng 434-441) dùng `var()`.
| ~~`999px` / `9999px`~~ | ~~pill~~ | ~~typo~~ | ❌ **CHẨN ĐOÁN SAI — đã rút.** `console.css` có 29× `999px` và **0× `9999px`**; `9999px` chỉ nằm ở `tokens.css:81` (`--cmc-radius-pill`). Hai giá trị cho kết quả hiển thị **y hệt** ⇒ **0 thay đổi pixel** ⇒ thuộc **nợ bảo trì**, xử ở Phase 6, **không thuộc phase này**. |
| radius `10px` | (7/33 trang) | `--radius-inner` hardcode trong bridge | Đã xử ở Phase 4 |

## Related Code Files

- Modify: `packages/ui/src/console.css` (chỉ dòng lệch thang)
- Modify: `packages/ui/src/tokens.css` (bước 0: thang type; nếu thăng cấp giá trị trung thành thành token có tên)
- Read-only: `/home/manhquy/Downloads/odoo-src/addons/web/static/src/scss/*`

## Implementation Steps

0. Khai báo thang type thành token trong `tokens.css` theo Execution authority đã duyệt.
1. **Re-đo baseline sau Phase 2** (khối CSS đã xoá làm thay đổi số dòng đích).
2. Liệt kê mọi khai báo lệch thang **thật** (12.5/13.5/24.5px) kèm số dòng + họ component sở hữu.
3. Nhóm theo **họ component** (pagination · callout · settings-nav).
4. **Mỗi họ = 1 PR**, nhỏ vừa đủ một lần liếc mắt duyệt được.
5. Mỗi PR: áp phép thử Odoo → sửa → chạy `ui-fingerprint-sweep.mjs` (đã commit vào `scripts/` từ Phase 4) so trước/sau → ảnh chụp trang đại diện.

## Success Criteria

- [x] Thang type đã thành token thật trong `tokens.css` trước khi bắt đầu bước 1 — **đã có từ trước** (`tokens.css:98-105` semantic-role scale + `console.css:373-384` Console scale), không cần sửa file nào.
- [x] Trên nguồn CSS: 0 khai báo `12.5px`/`13.5px`/`24.5px` còn lại trong `console.css` (`grep -c` = 0 sau sửa). Không tách theo 33 route sống vì không tìm được giá trị nào **giữ nguyên** có căn cứ Odoo — toàn bộ 18 chỗ đều bị snap, không có ngoại lệ cần ảnh chụp riêng theo route.
- [x] Không có giá trị nào giữ nguyên → không cần comment căn cứ Odoo (mọi giá trị nghi vấn đã kiểm và kết luận trôi dạt, xem bảng trên).
- [x] 1 PR duy nhất (không chia theo họ component) — lý do đảo so với kế hoạch gốc: cả 18 chỗ cùng nhận **một phép biến đổi y hệt** (`12.5px→12px`, `13.5px→13px`), không có quyết định thiết kế khác nhau giữa các họ để tách PR riêng; tách nhỏ ở đây chỉ thêm phiền mà không tăng khả năng soát bằng mắt.
- [ ] Ảnh trước/sau — chưa chụp (cần dev server sống trong worktree này; xem ghi chú dưới).
- [ ] CI `typecheck-and-test` + `ui-e2e` — chưa chạy CI thật (chỉ verify local); worktree chưa push.

## Risk Assessment

- **Không có visual regression testing** ⇒ verify thủ công. Mitigation: PR theo họ component + script đo + ảnh trước/sau.
- **`console.css` style mọi màn hình** ⇒ blast radius toàn hệ mỗi PR. Mitigation: PR nhỏ, revert được từng họ.
- **Snap sai làm vỡ tái hiện Odoo** — nếu giá trị thật ra trung thành (qua hệ số) mà ta snap nhầm vì chỉ grep literal. Mitigation: phép thử Odoo phải tính cả hệ số, không chỉ literal; ghi căn cứ vào comment.
- Rollback: từng PR revert độc lập.
