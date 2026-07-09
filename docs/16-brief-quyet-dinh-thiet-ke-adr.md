# Tài liệu 16 — Brief Quyết định Thiết kế (ADR) — chốt 3 open question + phạm vi vai trò

> Ghi lại các quyết định đã chốt với bạn, có research hậu thuẫn và tinh chỉnh cho thiết kế tốt nhất.
> Đây là nguồn để đồng bộ TL02/05/06/07/10/14. Mỗi mục là một ADR (Context → Decision → Consequences).

---

## ADR-A — Trạng thái ghi danh & tách thanh toán

**Context.** Cần thể hiện hai giai đoạn: HS *giữ chỗ nhưng chưa đóng phí* vs *đã đóng phí, đang học*
(mới được điểm danh/đánh giá). Enum hiện có: `active, completed, reserved, transferred, withdrawn`.

**Research.** Hai điểm đáng lưu ý:
- Trong SIS giáo dục, **"reserved" có nghĩa chuẩn riêng** = ghế giữ cho một *nhóm HS cụ thể*
  (freshman, ngành…), không phải "đã ghi danh chưa trả tiền". Tái dùng dễ gây hiểu nhầm.
- Thông lệ SIS **tách thanh toán khỏi trạng thái ghi danh**: bỏ vào giỏ ≠ ghi danh; và học phí
  đến hạn *sau*, không chặn ghi danh — payment là một tuyến riêng (Student Financials/bursary).

**Decision (tinh chỉnh so với "tái dùng reserved" đơn thuần).**
- Giữ enum **không đổi** (dùng lại `reserved`) — đúng ý "giảm tải, ít migration" của bạn. Nhưng
  **định nghĩa lại rõ trong glossary cho ngữ cảnh CMC** (CMC không có khái niệm "ghế giữ theo nhóm"
  nên va chạm nghĩa chỉ là lý thuyết):
  - `reserved` = **giữ chỗ, chưa kích hoạt bằng phí**.
  - `active` = **đã có phiếu thu duyệt → đang học** (được điểm danh/đánh giá).
- **Cơ chế:** trạng thái này **được lái bởi Receipt**, không sửa tay: `enrollment.enroll` tạo bản
  ghi `reserved`; khi `receiptApprove` → chuyển `active`. Tức là "active ⇔ có Receipt approved" —
  vừa có trạng thái rõ để hiển thị, vừa đúng bằng nguồn tiền (không lệch).

**Consequences.**
- Migration nhẹ: enrollment cũ → `active` (backfill, không phá điểm danh đang chạy).
- Điểm danh/đánh giá **gate trên `active`** — ghi danh chưa đóng phí không lọt vào lớp tính điểm.
- Glossary (TL07) phải nêu rõ nghĩa `reserved` này để tránh nhầm.

---

## ADR-B — Cổng tiền do Giám đốc Kinh doanh (chưa có kế toán)

**Context.** Tạm gác vai trò `ke_toan`; vẫn cần người duyệt phiếu thu (cổng tiền).

**Research (SoD).** Nguyên tắc phân tách nhiệm vụ: **người duyệt phải khác người tạo**. Ở đây thoả:
*sale tạo phiếu nháp → GĐKD duyệt*. Rủi ro còn lại: GĐKD **là sếp của sale**, có thể chịu áp lực
duyệt để đạt doanh số (xung đột lợi ích). Khi không tách được hết, dùng **compensating control**:
ngưỡng phê duyệt, review độc lập, giám sát bất thường, audit.

**Decision.**
- **GĐKD là người duyệt phiếu** (cổng tiền). Người tạo (sale) ≠ người duyệt → SoD cơ bản đạt.
- **Compensating controls bắt buộc kèm:**
  1. **Reconciliation agent (HOTL)** gắn cờ phiếu bất thường → review độc lập (TL4/TL13).
  2. **Audit** mọi lượt duyệt (ai/khi/bao nhiêu).
  3. **Ngưỡng tiền:** phiếu vượt ngưỡng X cần **mắt thứ hai độc lập** — chọn **GĐĐT** (không dính
     chỉ tiêu doanh số) hoặc super_admin.
- **Lối thoát tương lai:** khi tuyển `ke_toan` thật → chuyển quyền duyệt sang kế toán, GĐKD lùi về
  duyệt ngoại lệ. (Chỉ là bật lại role có sẵn trong registry — không viết lại.)

**Consequences.** Kiểm soát tài chính chấp nhận được ở quy mô hiện tại; đường nâng cấp rõ ràng.

---

## ADR-C — IA điều hướng: 5 nhóm chức năng, lọc theo vai trò

**Context.** Các tài liệu chia nhóm menu lệch nhau (6 vs 9). Cần một IA chuẩn duy nhất.

**Research.** Tối đa **~7 mục cấp một** (7 là "ngưỡng ép buộc" hữu ích, mỗi mục phải xứng đáng có
mặt). Tổ chức theo **chức năng/quy trình thực tế** (dễ đoán, lặp lại được), rồi **lọc hiển thị theo
vai trò** — hệ thích ứng theo người đăng nhập (giám đốc thấy màn khác nhân viên). **Không đặt tên
nhóm theo vai trò**, đặt theo *chức năng*.

**Decision — 5 nhóm chức năng (đặt tên theo việc, hiển thị lọc theo role):**

| Nhóm (chức năng) | Nội dung | Vai trò thấy |
|---|---|---|
| **Giảng dạy** | Lịch dạy · điểm danh · chấm bài · nhận xét · học bạ | giao_vien, GĐĐT |
| **Lớp & Học sinh** | Lớp · khóa · học sinh · phụ huynh | GĐĐT, (sale xem hạn chế) |
| **Kinh doanh** | CRM · chăm sóc KH · phiếu thu (nháp) | sale, GĐKD |
| **Tài chính & Điều hành** | Duyệt phiếu · doanh thu · đối soát · lương & chấm công | GĐKD, GĐĐT (theo miền) |
| **Quản trị** | Cơ sở · người dùng · cấu hình | super_admin |

- Mỗi vai trò có **trang đích (persona landing)** riêng; nav lọc bằng cùng `can()` (không hardcode).
- TL02/TL05/TL06 **trỏ về bảng này** (nguồn IA duy nhất) — hết lệch.

**Consequences.** Điều hướng dễ đoán, ≤7 nhóm, khớp mô hình 4 vai trò.

---

## ADR-D — Phạm vi vai trò v2 (giảm tải)

**Context.** Muốn giảm rắc rối, trao quyền đúng các vai trò đang thực sự vận hành.

**Decision.**
- **ERP** phục vụ **4 vai trò + IT:** `giam_doc_kinh_doanh` (quản lý `sale`), `giam_doc_dao_tao`
  (quản lý `giao_vien`), `sale`, `giao_vien`, + `super_admin` (IT cấu hình).
- **LMS** phục vụ **phụ huynh + học sinh**.
- **Tạm gác** `cskh`, `ctv_mkt`, `ke_toan`, `hr`: **giữ trong registry** (enum không xoá) nhưng
  **không build quyền/UI riêng** lúc này. Khi cần chỉ việc bật quyền + màn, không đổi mô hình.
- **Cấu trúc quản lý = `managerId`:** sale.managerId → GĐKD; giao_vien.managerId → GĐĐT. (Không thêm
  role `quan_ly`/`head_teacher` — giữ 9 role enum; xem TL14 §4, nay chốt: **không thêm**.)

**Consequences.**
- TL14 (danh mục vai trò) cập nhật: đánh dấu 4 vai trò *active* + IT; 5 vai trò *deferred*.
- Cổng tiền → GĐKD (ADR-B) là hệ quả trực tiếp của việc gác `ke_toan`.
- Việc tạo lớp/xếp lịch gán vào quyền `class.create`/`schedule.generate` cho GĐĐT (không cần role mới).

### ADR-D amendment (2026-07-08) — Siết scope: registry/UI/gán chỉ 5 role thật

**Context.** PO chốt: hệ thống thực tế chỉ 5 vai trò vận hành (GĐKD, GĐĐT, sale,
giao_vien, super_admin). 2 giám đốc đã đảm nhiệm toàn bộ công việc của role gác
(ke_toan, cskh, ctv_mkt, hr). Registry vẫn ghi quyền cho role gác → rủi ro gán nhầm
= có quyền duyệt tiền.

**Decision.**
- `ACTIVE_ROLES` (5) export từ `@cmc/auth`; `ROLES` (9) giữ nguyên (drift-test enum↔TS).
- `PERMISSIONS` typed `ActiveRole[]` — typecheck chặn tái nhập role gác.
- `user.updateRoles` zod reject role ∉ ACTIVE_ROLES (BAD_REQUEST). Seed script bypass by design.
- UI Phân quyền chỉ hiện 5 role; user mang role gác vẫn Save được (drop chủ động).
- Guard last-super-admin: không cho gỡ super_admin cuối cùng (FORBIDDEN).
- Enum DB giữ 9 giá trị trơ (tránh migration Postgres `ALTER TYPE DROP VALUE`).
- Bật lại role = thêm vào `ACTIVE_ROLES` + quyền + UI + ADR mới.

**Refs.** `plans/reports/brainstorm-260708-2232-role-scope-alignment-adr-d-report.md`

---

## Đồng bộ cần làm sau khi chốt (housekeeping)

1. **TL14** — đánh dấu 4 vai trò active + IT, 5 deferred; xoá mục "quan_ly/head_teacher là role"
   (chốt: không thêm).
2. **TL07** — định nghĩa lại `reserved` (ADR-A); ghi `active ⇔ có Receipt approved`.
3. **TL02/05/06** — thay bằng IA 5 nhóm (ADR-C); sửa `O4_ENROLLED` → `O5_ENROLLED`.
4. **TL10/11** — enrollment: `reserved`→`active` lái bởi Receipt (bỏ `pending_payment` như enum mới).
5. **"Liên kết vai trò"** — viết lại theo mô hình 4 vai trò + provisioning tự động.
6. Đánh số lại toàn bộ `TL00–TL16` cho nhất quán.

> Liên kết: TL14 (vai trò) · TL15 (audit/open questions) · TL07/10/11 (đồng bộ) · TL04/13 (agent bù SoD).
