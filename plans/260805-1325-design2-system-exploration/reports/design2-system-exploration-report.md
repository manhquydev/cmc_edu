# Báo cáo Nghiên cứu & Thử nghiệm Hệ thống Thiết kế Mới (/design2)

## 📌 Tổng quan công việc
Theo yêu cầu, đội ngũ đã thực hiện nghiên cứu (**ak-research**), khởi tạo bản thiết kế trực quan (Visual Concepts bằng AI Visual Generation), và xây dựng trang **Design Lab 2 (`/design2`)** mới cho hệ thống dự án CMC EDU v2 (giữ nguyên trang `/design` cũ).

---

## 🎨 1. Kết quả Tạo ảnh Visual Concepts
Đã sử dụng công cụ AI Visual Generation để thử nghiệm 2 bản vẽ thiết kế độ phân giải cao:
1. **`design2-dashboard-mockup.png`**: Bản vẽ giao diện ERP Dashboard thế hệ mới (Neo-Dark Glass, thẻ KPI bo cong 16px, viền phát sáng ambient glow cyan-blue, floating dock lơ lửng).
2. **`design2-tokens-mockup.png`**: Bộ linh kiện & token thiết kế (Bảng màu HSL, typography Inter, nút bấm pill CTA, chip trạng thái glowing, micro-charts).

Các hình ảnh đã được đóng gói và phục vụ trực tiếp tại thư mục `apps/admin/public/`.

---

## 🚀 2. Điểm mới trên Trang `/design2` (Aetheria Design System)
Trang `/design2` được xây dựng hoàn chỉnh tại `apps/admin/src/pages/design-lab-2.tsx` với 6 phần nội dung chính:

1. **Hero & Chuyển đổi Giao diện Tương tác (Interactive Theme Picker)**:
   - **🌙 Neo-Dark Glass**: Giao diện tối độ sâu cao với hiệu ứng kính mờ `backdrop-filter: blur(20px)`.
   - **☀️ Warm Ivory Light**: Giao diện sáng tông kem sang trọng.
   - **⚡ Cyber Midnight**: Giao diện tương phản neon cao cấp dành cho AI & Analytics.
2. **Nghiên cứu & Định hướng Kiến trúc (`ak-research`)**:
   - Tóm tắt 3 trụ cột: Ambient Glass & Depth Elevation, Spatial Density & Micro-Interactions, Dynamic Floating Action Dock.
3. **Thư viện Visual Concepts (Gen AI Showcase)**:
   - Trưng bày các ảnh thiết kế vừa được generate kèm mô tả chi tiết từng khu vực.
4. **Bảng Token Hệ thống (Design Tokens)**:
   - Quản lý quy chuẩn màu HSL (`--dl2-brand-blue`, `--dl2-emerald`, `--dl2-amber`, `--dl2-ruby`, `--dl2-purple`).
5. **UI Components & Floating Action Dock**:
   - Thẻ chỉ số Metric kèm Trend Sparkline phát sáng.
   - Thanh tác vụ lơ lửng Floating Dock (Tạo mới, Phiếu thu, Lịch dạy, AI Copilot).
   - Data Table hỗ trợ trạng thái phát sáng (Pill status glow).
6. **Bảng So sánh trực quan giữa `/design` và `/design2`**.

---

## 🛠️ 3. Kiểm chứng Kỹ thuật
- **Routing**: Đã đăng ký route `/design2` trong `apps/admin/src/routes/index.tsx`.
- **Navigation**: Thêm nút **Design 2** trên topbar và trong menu ⌘K (Command Palette) ở chế độ DEV.
- **Typecheck**: Lệnh `pnpm --filter @cmc/admin typecheck` chạy thành công **100% không có lỗi**.
