> **SUPERSEDED 2026-08-13 sau red-team 4 lens.** Không thi hành file này nguyên trạng.
> Phán quyết: `plans/reports/redteam-adjudication-260813-0139-design-system.md`.
> Phần còn hiệu lực đã chuyển sang `phase-A-precedence-pin.md` / `phase-B-docs-and-gates.md`.

# Phase 04 — A11y P0: bàn phím và focus

**Trạng thái:** chưa bắt đầu · **Công:** 1–2 ngày · **Branch:** `fix/console-a11y-keyboard` từ `develop`
**Bằng chứng:** `plans/reports/audit-260813-0052-ds-l2-components.md` (P0-2)

> **Cảnh báo về thứ tự.** Phase này đứng sau 03 vì lý do nghiệp vụ, không phải vì nó nhẹ hơn.
> Nếu có nhân sự phụ thuộc bàn phím, hoặc có ràng buộc tuân thủ tiếp cận, **đảo lên trước 03**.

## Vấn đề

Vi phạm WCAG 2.1.1 (Keyboard), 2.4.7 (Focus Visible), 4.1.2 (Name, Role, Value):

1. **Không `:focus-visible`** trên primitive Console — `console.css:111-205` (navbar), `:330-365,449-456` (kanban)
2. **Tương tác lồng nhau** — `pipeline.tsx:137-238` bọc `role="button"` quanh thẻ vốn đã chứa button.
   Screen reader đọc thành button-trong-button.
3. **Mở dòng chỉ bằng chuột** — `onRowClick` không có đường bàn phím tương đương:
   `receipt-list.tsx:227`, `classes/index.tsx:449`, `users.tsx:351`, `students/index.tsx:133`

## Việc

### 1. Focus ring cho primitive Console

Thêm `:focus-visible { outline: 2px solid <token>; outline-offset: 2px }` cho:
`.console-app-switcher-toggle`, `.console-menu-item`, `.console-app-switcher-tile`, `.console-systray-badge`,
`button.console-kanban-card`, `.console-view-switcher button`.

Màu outline lấy từ token đã có (đừng đẻ token mới — luật phase 01). Kiểm tương phản outline ≥ 3:1 với nền.

### 2. Gỡ tương tác lồng ở pipeline

Bỏ wrapper `role="button"` (`pipeline.tsx:137-238`). Hai lựa chọn, chọn một:
- dùng `KanbanCard onClick` sẵn có, hoặc
- card tĩnh + vùng tiêu đề là link; các action giữ `<Button>` **ngoài** vùng hit mở thẻ

### 3. Navbar menu theo chuẩn

`aria-haspopup="menu"`; khi mở focus vào item đầu; hỗ trợ Arrow/Home/End; Tab hoặc cycle trong menu hoặc
đóng menu; `aria-current="true"` trên tile đang active.

### 4. Mở dòng bằng bàn phím

Hàng `tabIndex={0}` + Enter/Space gọi `onRowClick`, **hoặc** luôn hiện một cột "Mở" là link thật.
Lựa chọn thứ hai đơn giản hơn và không cần quản lý roving tabindex — ưu tiên nó nếu layout cho phép.
Việc này chạm DataTable dùng chung, nên làm ở component chứ đừng vá từng trang.

## Nghiệm thu

- [ ] Đi hết một luồng bằng **chỉ bàn phím**: đăng nhập → danh sách phiếu thu → mở một phiếu → quay lại
- [ ] Mọi primitive liệt kê ở (1) hiện focus ring rõ khi Tab tới
- [ ] Không còn phần tử tương tác lồng trong thẻ CRM
- [ ] Test RTL: `fireEvent.keyDown(row, {key:'Enter'})` gọi `onRowClick`
- [ ] `typecheck-and-test` + `ui-e2e` xanh

## Rủi ro

Thêm `tabIndex` trên hàng bảng làm số điểm dừng Tab tăng mạnh ở bảng dài — nếu thấy khó chịu khi thử tay,
chuyển sang phương án cột "Mở". `ui-e2e` hiện dựa vào `getByRole`/text nên đổi cấu trúc hàng có thể làm
selector lệch; chạy đủ journey admin trước khi merge.