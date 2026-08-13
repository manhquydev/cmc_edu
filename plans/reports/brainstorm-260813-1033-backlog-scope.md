# Brainstorm — phạm vi việc treo sau design-system hardening

**Ngày:** 2026-08-13 10:33 · **develop:** `be2a8f5` (đủ 5 PR #124/125/127/128/129)
**Nguồn:** `review-indep-260813-0918-adjudication.md` (F3/F4) + BA Q4 (a11y)

## Trạng thái môi trường: SẠCH
Worktree chỉ còn repo chính. Không branch/worktree/workspace tồn dư của phiên. Việc code đã ship xong.

## Ba mục treo — brainstorm contract từng cái

### F3 — Pin màu + `--text-*` role trong precedence test
- **Outcome:** `console-precedence.test.ts` bắt được drift màu (`--color-text-*`) và role chữ (`--text-*`
  size/weight) phía console, không chỉ font-size.
- **Bằng chứng lỗ:** reviewer đột biến chỉ fallback hex `#212529→#ff00ff` → test XANH GIẢ; đảo winner
  `var(--cmc-text, var(--console-gray-900))` → xanh. Assertion là pin-CHUỖI không pin-GIÁ-TRỊ.
- **Constraints:** chỉ chạm test (+ helper); không đổi CSS; jsdom không resolve `var()` nên phải resolve thủ
  công 1-hop hoặc assert giá trị specified sau khi map.
- **Non-goals:** đổi giá trị token; VRT.
- **Acceptance:** đột biến fallback-hex → ĐỎ; đảo winner CMC-first → ĐỎ; đổi `--text-heading-3-weight` →
  ĐỎ; bản sạch xanh.
- **Rủi ro:** gần 0 (test-only). **Giá trị:** cao — đóng đúng lỗ "green-test-bug-remains" mà cả workstream
  tồn tại để giết; reviewer độc lập đã tái hiện. → **LÀM NGAY, rõ ràng.**

### F4 — Ratchet regex nhận thêm dạng inline-style
- **Outcome:** `ui-ratchet.mjs` bắt `style = {{`, `background` (không chỉ `backgroundColor`), object spread,
  template literal.
- **Constraints:** script-only; nếu regex chặt hơn lộ vi phạm CŨ đang lọt → **re-baseline** (grandfather),
  KHÔNG sửa hết inline-style (đúng triết lý ratchet).
- **Non-goals:** dọn inline-style hiện có.
- **Acceptance:** chèn `style = {{padding:99}}` / `background:'#f00'` mới → ĐỎ; develop hiện tại vẫn xanh sau
  re-baseline.
- **Rủi ro:** thấp (script), nhưng cần xử lý re-baseline. **Giá trị:** THẤP — code AI qua prettier chuẩn hoá
  `style={{`, nên `style = {{` hiếm; chỉ `background` là gap thật. → cân nhắc, không cấp thiết.

### A11y — DataTable mở dòng bằng bàn phím
- **Outcome:** bốn trang list (receipt/classes/users/students) mở dòng được bằng bàn phím; primitive Console
  có `:focus-visible`.
- **Cách (BA Q4 đã chốt):** cột "Mở" là link thật trong `data-table.tsx:146-161`, KHÔNG roving-tabindex
  (tránh ~140 tab-stop).
- **Constraints:** đụng DataTable dùng chung + selector e2e (`getByRole`/text) → phải chạy đủ journey admin.
- **Non-goals:** đổi layout; nested-interactive kanban (đã có đường bàn phím, red-team cảnh báo đừng xóa).
- **Acceptance:** đi hết một luồng bằng chỉ bàn phím (login→list→mở dòng→back); RTL Enter→onRowClick;
  `ui-e2e` xanh.
- **Rủi ro:** TRUNG BÌNH (shared component + e2e). **Giá trị:** trung bình, **khẩn cấp thấp** (ERP nội bộ
  dùng chuột, chưa có nhân sự phụ thuộc bàn phím — BA Q4). → cần go rõ vì risk, không auto-fire.

## Quyết định điều phối
- **F3 → dispatch grok NGAY** (rõ, cao giá trị, zero-risk).
- **F4 → gộp vào lane F3** phần cheap (`background` + chuẩn hoá regex) nếu không lộ re-baseline lớn; nếu lộ
  → tách, báo cáo, không ép.
- **A11y → chờ owner go** (risk trung bình + khẩn cấp thấp). Nếu go, một lane grok riêng + chạy journey admin.

## Câu treo cho owner
1. A11y DataTable: làm ngay lượt này hay để backlog? (khẩn cấp thấp, risk trung bình).
2. Có nhân sự phụ thuộc bàn phím / ràng buộc tuân thủ tiếp cận không? Nếu có → A11y lên ưu tiên cao.
