---
phase: 5
title: "Off-scale value sweep"
status: pending
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

## 🔴 TIỀN ĐỀ THIẾU — phải làm bước 0 trước mọi việc khác

**Thang type "11/12/13/14/16/18/24/32" KHÔNG tồn tại dưới dạng token trong repo.**
`packages/ui/src/tokens.css` chỉ khai báo **đúng 2** token font-size:
`--cmc-font-size-data: 13px` (dòng 55) và `--cmc-font-size-column: 11px` (dòng 56).

Dãy 8 số kia là **vai trò typography** mô tả trong tài liệu (label 11 · meta 12 · body 14 ·
title 16 · h3 18 · page 24 · metric 32), **không phải CSS custom property** — nên:

- Cụm từ "lệch thang" hiện **không có chuẩn để đối chiếu**.
- Tiêu chí "0 cỡ chữ lệch thang" **chưa kiểm chứng được bằng công cụ**, chỉ bằng dãy số hardcode trong script.
- **Phase 6b (stylelint allow-list) không thể viết** cho tới khi thang này thành token thật.

**Bước 0 (chặn toàn bộ phase):** khai báo thang type chuẩn thành token trong `tokens.css`,
lấy căn cứ từ Odoo source (`$o-root-font-size`, `$o-label-font-size-factor: 0.8` và các hệ số
dẫn xuất) + vai trò đã có trong TL12. Đây là quyết định thiết kế; theo Execution authority đã
được operator duyệt trước khi enforcement dùng thang này — thực thi theo đúng nội dung đó,
không tự tạo thang khác.

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

## Mục tiêu cụ thể (đo được trên 33 route, số đã hiệu chỉnh)

| Giá trị | Số lần render | Chủ sở hữu | Hướng xử |
|---|---|---|---|
| `12.5px` | 20 | `console-page-indicator` + ListPagination | Áp phép thử Odoo |
| `13.5px` | 8 | `console-callout-title`, `console-settings-nav-label` | Áp phép thử Odoo |
| `24.5px` | 1 | rải rác | Áp phép thử Odoo |
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

- [ ] Thang type đã thành token thật trong `tokens.css` trước khi bắt đầu bước 1.
- [ ] Trên **cả 33 route**: 0 cỡ chữ ngoài thang đã token hoá (trừ ngoại lệ đã ghi lý do bằng văn bản, vd `fc-toolbar-title` của FullCalendar).
- [ ] Mỗi giá trị được **giữ nguyên** phải có comment nêu rõ căn cứ Odoo (file:line trong odoo-src) hoặc căn cứ hệ số suy ra.
- [ ] Mỗi PR có ảnh trước/sau.
- [ ] CI `typecheck-and-test` + `ui-e2e` xanh mỗi PR.

## Risk Assessment

- **Không có visual regression testing** ⇒ verify thủ công. Mitigation: PR theo họ component + script đo + ảnh trước/sau.
- **`console.css` style mọi màn hình** ⇒ blast radius toàn hệ mỗi PR. Mitigation: PR nhỏ, revert được từng họ.
- **Snap sai làm vỡ tái hiện Odoo** — nếu giá trị thật ra trung thành (qua hệ số) mà ta snap nhầm vì chỉ grep literal. Mitigation: phép thử Odoo phải tính cả hệ số, không chỉ literal; ghi căn cứ vào comment.
- Rollback: từng PR revert độc lập.
