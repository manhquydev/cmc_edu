# Phase D — A11y: mở dòng DataTable bằng bàn phím (XONG)

**Trạng thái:** XONG 2026-08-13 — #134 (DataTable keyboard) + #135 (focus-visible) merged, parallel grok · **Branch:** `fix/datatable-keyboard-open` + `fix/console-focus-visible`
**Thay cho:** phase 04 cũ (superseded) · **Căn cứ:** BA Q4, `review-indep-260813-0918-adjudication.md`

## Vì sao backlog, không phải bỏ
Lỗi tiếp cận THẬT (WCAG 2.1.1 Keyboard) nhưng khẩn cấp thấp: ERP nội bộ vận hành bằng chuột, chưa có nhân sự
phụ thuộc bàn phím. **Đảo lên ưu tiên cao NGAY nếu** có nhân sự phụ thuộc bàn phím hoặc ràng buộc tuân thủ.

## Vấn đề (đã xác minh)
`onRowClick` mở dòng **chỉ bằng chuột** ở `receipt-list.tsx:227`, `classes/index.tsx:449`, `users.tsx:351`,
`students/index.tsx:133`. Primitive Console thiếu `:focus-visible`. Red-team đã bác cách `tabIndex` trên hàng
(tạo ~140 tab-stop) và cách `KanbanCard onClick` (tạo button-trong-button, HTML không hợp lệ).

## Cách đã chốt (owner 2026-08-13, SỬA cách cũ)
Cách cũ "cột Mở là link thật" **bị bác** sau scout: `onRowClick` có hai loại consumer — điều hướng URL
(classes/pipeline/aftersale/check-in) **và mở modal** (users `openRolesModal`, rewards `openReward`,
facilities `openEditModal`) — link vô nghĩa cho loại modal.

**Chốt (A) row-level keyboard.** File thật: `packages/ui/src/components/data-table.tsx:143-159` (bọc nội dung
mỗi cell trong `<div onClick cursor:pointer>` khi có `onRowClick`, có guard bỏ qua click lên
button/a/input/[role]). **Ràng buộc:** `Table` là vendored `@astryxdesign/core/Table` — DataTable **không**
kiểm soát `<tr>`, chỉ kiểm soát nội dung cell. Nên "row-level" phải hiện thực bằng **một điểm-vào-bàn-phím
mỗi hàng** (vd cell đầu non-checkbox thành `role="button" tabIndex={0}` + `onKeyDown` Enter/Space →
`onRowClick`, `aria-label` mô tả hàng), **KHÔNG** đặt tabIndex mọi cell (= cột×hàng tab-stop). Nếu Astryx
Table có prop row-level (onRowClick/rowProps) trong worktree đã cài → ưu tiên dùng nó.

Lane phụ độc lập: `:focus-visible` cho primitive Console (`console.css` navbar/kanban/view-switcher).

## Constraints
- Đụng DataTable **dùng chung** → mọi trang list ăn theo; phải chạy đủ journey admin.
- `ui-e2e` dựa `getByRole`/text → đổi cấu trúc hàng có thể lệch selector; verify trước merge.
- **Không** đụng kanban nested-interactive (`pipeline.tsx:137-145` đã có đường bàn phím — red-team cấm xóa).

## Non-goals
Roving-tabindex; đổi layout; đổi copy/route; a11y ngoài "mở dòng + focus ring".

## Acceptance
- [ ] Đi hết một luồng bằng **chỉ bàn phím**: login → danh sách phiếu thu → mở một phiếu → back
- [ ] Cột "Mở" là `<a href>`/link thật, Enter mở dòng; RTL `fireEvent` xác nhận
- [ ] Primitive Console liệt kê có `:focus-visible` (outline ≥3:1)
- [ ] `typecheck-and-test` + `ui-e2e` xanh; chạy đủ journey admin (không chỉ smoke)

## Rủi ro
Trung bình — shared component + e2e selector. Nếu cột "Mở" làm bảng dài thêm cột gây chật, cân nhắc icon-link
gọn. Rollback = revert một PR (DataTable là render-only, không state/migration).
