---
phase: 4
title: "Astryx theme bridge"
status: authorized
priority: P1
effort: "4-8h (phụ thuộc kết quả spike)"
dependencies: [2]
---

# Phase 4: Chốt ngôn ngữ radius (trước gọi nhầm là "Astryx theme bridge")

## ⛔ TIỀN ĐỀ CŨ CỦA PHASE NÀY ĐÃ BỊ BÁC BỎ

Bản đầu viết: *"Astryx render radius/type không đi qua token CMC, tạo thang thứ ba"* và gọi đây là "đòn bẩy cao nhất toàn plan". **Sai hoàn toàn.** Red-team kiểm chứng trên source:

- `@astryxdesign/core/dist/astryx.css` phát ra `border-radius: var(--radius-element)` và `font-size: var(--text-heading-3-size)` — **luôn dùng biến**, chỉ 4 rule font-size literal trong cả file.
- `astryx-theme-cmc.css:47-51` **đã map** `--radius-element → var(--cmc-radius-control)`.
- `tokens.css:3` ghi rõ chủ đích: *"Soft ops ERP: warm canvas, **nested radius 12/16/20**"*. ⇒ 12px/16px **là `--cmc-radius-control` / `--cmc-radius-card`**, token đã khai báo, **không phải "Astryx default"**.
- `15px` do **CMC tự đặt**: `console.css:435` `--font-size-lg: 15px`, bind tại `:445` vào `--text-heading-3-size`.
- `console/console-tokens.test.ts:34` là test **đang xanh**, mục đích duy nhất là khẳng định việc theme này tồn tại.

**Rủi ro Stylex specificity: không tồn tại.** Astryx đọc từ biến CSS — đường A hiển nhiên.

## Vấn đề THẬT còn lại

Không phải lỗi kỹ thuật, mà là **hai ngôn ngữ radius cùng hợp lệ, chưa ai chốt cái nào là chuẩn trong admin**:

| Thang | Giá trị | Nguồn | Dùng ở |
|---|---|---|---|
| Soft-ops / premium | 12 / 16 / 20px | `tokens.css:44-47,79-81` | control, card, dialog (qua Astryx) |
| Odoo console | 3 / 4 / 6px | `console.css:46-48` | bề mặt list, chrome |

Tổ hợp `[4, 12, 16]` trên hầu hết trang = **cả hai thang đang chạy đúng như khai báo**. Chỉ **7/33 trang** thật sự vượt ngưỡng ≤4, và thủ phạm là:
- `--radius-inner: 10px` **hardcode** trong bridge (`astryx-theme-cmc.css:49`) — số ma, không phải token
- cùng tồn tại `999px` (console.css ×29) và `9999px` (`tokens.css:81`) — cùng kết quả hiển thị
- trộn `3px / 3.5px / 4px` (3.5px là shorthand của FullCalendar)

⚠️ **Tiêu chí "≤4 radius mỗi trang" là bất khả thi về số học** khi cả hai thang còn sống — 3 giá trị mỗi thang + pill đã là 7.

## Operator decision (approved 2026-08-09)

- Astryx primitive giữ soft-ops `12/16/20`.
- Console list/table chrome giữ Odoo `3/4/6`.
- Hai họ là luật vùng có chủ đích; không đổi pixel chỉ để ép số radius toàn trang.
- Acceptance đo theo component family và kiểm tra mọi giá trị đều đi qua token của đúng họ.

## Requirements

- Functional: primitive Astryx render radius/type qua token soft-ops; console chrome qua token Odoo; không còn magic radius trong bridge.
- Non-functional: không fork Astryx, không patch `node_modules`, không đổi API component.

## Architecture — SPIKE ĐÃ GIẢI QUYẾT BẰNG ĐỌC (2026-08-09 22:15)

Đọc `packages/ui/src/astryx-theme-cmc.css` (122 dòng) + `apps/admin/src/main.tsx`:

**Kết luận: ĐƯỜNG A khả thi — Astryx đọc radius từ CSS custom property, không phải literal Stylex.** Không cần override wrapper, không cần đụng specificity.

**Nhưng chẩn đoán "Astryx chưa được theme" chỉ ĐÚNG MỘT NỬA:**

| Biến Astryx | Bridge gán | Giá trị thật | Nhận định |
|---|---|---|---|
| `--radius-element` | `var(--cmc-radius-control)` | 12px | **Đã theme** — map có chủ đích sang thang premium |
| `--radius-container` | `var(--cmc-radius-md)` | 16px | **Đã theme** |
| `--radius-page` | `var(--cmc-radius-lg)` | 20px | **Đã theme** |
| `--radius-inner` | `10px` **hardcode** | 10px | 🔴 **Lỗi thật** — không phải token, là số ma |
| font-size / type | **không map dòng nào** | — | 🔴 **Thật sự chưa theme** → `15px` của Astryx |

Thứ tự import (`main.tsx:16-19`): `tokens.css` → `astryx-theme-cmc.css` → `console.css`. `console.css` nạp sau ⇒ override được nếu cần.

## ⚠️ PHASE NÀY CHỨA MỘT QUYẾT ĐỊNH SẢN PHẨM, KHÔNG PHẢI LỖI KỸ THUẬT

Radius 12/16/20px **không phải Astryx rò rỉ** — là bridge **cố ý** map sang thang premium `--cmc-radius-*`, trong khi `console.css` dùng thang Odoo `--console-radius-*` (3/4/6px). Hai thang cùng tồn tại **có chủ đích** ("Console doc supersedes TL12 for admin only"), chưa bao giờ được xem lại.

⇒ **Câu hỏi thật cần operator quyết:** trong admin chrome kiểu Odoo, primitive Astryx (button/input/selector/dialog) nên dùng thang nào?

- **Lựa chọn 1 — về thang console (3/4/6px):** giao diện nhất quán kiểu Odoo thật; nút/ô nhập vuông vức hơn hẳn hiện tại. **Đổi diện mạo rõ rệt** trên mọi màn hình.
- **Lựa chọn 2 — giữ premium (12/16/20px):** giữ diện mạo hiện tại; chấp nhận 2 thang, nhưng **phát biểu thành luật vùng** ("chrome Odoo = console radius; control + surface nổi = cmc radius") và tuân thủ nhất quán thay vì trôi.
- **Lựa chọn 3 — thang trung gian:** thoả hiệp, tốn công nhất, không khuyến nghị.

Operator đã chọn **Lựa chọn 2 — giữ premium và phát biểu luật vùng**. Không cần mô phỏng ba lựa chọn lại.

**Phần KHÔNG cần quyết, làm được ngay:** `--radius-inner: 10px` hardcode → token; bridge type/font-size (đang trống hoàn toàn) → thang CMC; thống nhất `999px`/`9999px`.

## Related Code Files

- Modify: `packages/ui/src/astryx-theme-cmc.css` (đường A)
- Modify: `packages/ui/src/console.css` (đường B — khối override wrapper, đặt cuối file, có comment giải thích tại sao)
- Read-only: `apps/admin/src/main.tsx` (thứ tự import CSS), `packages/ui/src/primitives.ts`

## Implementation Steps

**4a — không cần quyết định, làm trước (PR riêng):**
1. `--radius-inner: 10px` → token thật (chọn theo thang đã chốt ở bước 4b, hoặc `--cmc-radius-xs` nếu giữ premium).
2. Bridge **type/font-size** — hiện trống hoàn toàn: map `--font-size-*` của Astryx sang thang CMC để `15px` biến mất.
3. Thống nhất pill `999px`/`9999px` về một giá trị.
4. Đo lại 33 route bằng script; ảnh trước/sau ≥5 trang (finance, crm, teaching, admin, hr).

**4b — quyết định đã có (PR riêng):**
5. Giữ mapping soft-ops hiện hữu trong `astryx-theme-cmc.css`.
6. **Viết luật vùng thành văn bản** vào `design-system/cmc-edu/STYLING-BRIDGE.md` để lần sau không trôi tiếp.
8. Đo lại + ảnh trước/sau.

## Success Criteria

- [x] `--radius-inner` không còn số ma. **Sửa lại sau đối sánh với phiên khác** (2026-08-10): thay vì thêm token mới `--cmc-radius-inner: 8px` (tự bịa, không có căn cứ thiết kế), bỏ hẳn dòng override — CSS custom property cascade theo từng thuộc tính, bỏ override rơi về default gốc của Astryx (4px, `astryx.css:60`) mà không cần token thay thế. Cách phiên kia làm, port lại.
- [x] Bridge có map type (12 biến `--font-size-*` pin về thang CMC thật); `15px` do Astryx sở hữu → **0 lần** trên 13 route đo trực tiếp (kể cả sau khi mở rộng ra 8 route nữa).
- [x] ~~Chỉ còn một giá trị pill~~ — **RÚT LẠI**: `999px`/`9999px` là nợ bảo trì (0 thay đổi pixel), chuyển sang Phase 6, không phải tiêu chí Phase 4.
- [x] Quyết định thang radius được ghi thành văn bản — `design-system/cmc-edu/STYLING-BRIDGE.md` section "Radius zone rule", luật vùng phát biểu trong bảng 2 dòng + lý do không hợp nhất.
- [x] Mỗi component family chỉ dùng radius thuộc thang đã chốt — xác nhận qua sweep: `[4,12,16]` = đúng cả hai thang cùng chạy, không phải lỗi.
- [x] Không sửa file trong package bên thứ ba; không đổi API component — chỉ sửa `tokens.css`/`astryx-theme-cmc.css`/doc.
- [ ] CI `typecheck-and-test` + `ui-e2e` — chưa chạy CI thật (chỉ verify local); worktree chưa push.

## Risk Assessment

- **4b đổi diện mạo toàn hệ** nếu chọn thang console — mọi nút/ô nhập vuông hơn. Mitigation: ảnh mô phỏng **trước** khi code; PR tách riêng 4a/4b để revert độc lập.
- **Blast radius toàn hệ, không có visual regression test.** Mitigation: script đo 33 route + ảnh 5 trang mỗi PR.
- **Quyết định 4b bị treo** → chặn Phase 5. Mitigation: 4a không phụ thuộc 4b, làm trước; nếu 4b treo quá lâu, mặc định **Lựa chọn 2** (giữ premium + phát biểu luật vùng) vì nó không đổi diện mạo.
- ~~Stylex thắng specificity~~ — **đã loại trừ**: bridge chứng minh Astryx đọc radius từ biến CSS.
- Rollback: revert 1 commit; không có thay đổi schema/API.
