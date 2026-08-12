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

> **Status 2026-08-12 — bảng 5 nhóm bên dưới = LỊCH SỬ (superseded as IA source of truth).**
> Principles still hold: **≤7 top-level groups**, function-named (not role-named), **filter by
> permission/`can()`**. Live admin IA:
> - `apps/admin/src/shell/nav-registry.ts` (as-built section tree: e.g. Tổng quan, Giảng dạy, Lớp & HS,
>   Tài chính & Điều hành, Gắn kết, Nhân sự, Quản trị)
> - Resource-centric grammar (no “Duyệt *” products): [`docs/ux-resource-centric-structure.md`](./ux-resource-centric-structure.md)
> Do **not** treat the frozen 5-row table as the nav map for new screens.

**Context.** Các tài liệu chia nhóm menu lệch nhau (6 vs 9). Cần một IA chuẩn duy nhất.

**Research.** Tối đa **~7 mục cấp một** (7 là "ngưỡng ép buộc" hữu ích, mỗi mục phải xứng đáng có
mặt). Tổ chức theo **chức năng/quy trình thực tế** (dễ đoán, lặp lại được), rồi **lọc hiển thị theo
vai trò** — hệ thích ứng theo người đăng nhập (giám đốc thấy màn khác nhân viên). **Không đặt tên
nhóm theo vai trò**, đặt theo *chức năng*.

**Decision — 5 nhóm chức năng (historical snapshot; superseded for live nav — see Status banner):**

| Nhóm (chức năng) | Nội dung | Vai trò thấy |
|---|---|---|
| **Giảng dạy** | Lịch dạy · điểm danh · chấm bài · nhận xét · học bạ | giao_vien, GĐĐT |
| **Lớp & Học sinh** | Lớp · khóa · học sinh · phụ huynh | GĐĐT, (sale xem hạn chế) |
| **Kinh doanh** | CRM · chăm sóc KH · phiếu thu (nháp) | sale, GĐKD |
| **Tài chính & Điều hành** | Duyệt phiếu · doanh thu · đối soát · lương & chấm công | GĐKD, GĐĐT (theo miền) |
| **Quản trị** | Cơ sở · người dùng · cấu hình | super_admin |

- Mỗi vai trò có **trang đích (persona landing)** riêng; nav lọc bằng cùng `can()` (không hardcode).
- ~~TL02/TL05/TL06 trỏ về bảng này (nguồn IA duy nhất)~~ → live: **nav-registry** + resource-centric doc.

**Consequences.** Nguyên tắc ≤7 nhóm + filter role vẫn đúng; cây menu thực tế đã mở rộng/gộp theo
resource-centric Console (HR, Engagement, CRM gộp Tài chính, …).

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

## ADR-E — LMS gap closure 260710-0005: mật khẩu HS parent-mediated + OTP payload plaintext ngắn hạn

**Context.** Scout 260709-2350 phát hiện `requestOtpEmail` không gửi email thật (không transport nào
được gọi) — PH không thể đăng nhập LMS ở production. Song song, UI `change-password.tsx` (HS) ghi
"P0-debt" ngụ ý self-service đổi mật khẩu HS sẽ được bổ sung sau — chưa từng có quyết định chính thức.

### (a) Mật khẩu học sinh do phụ huynh quản lý — quyết định chính thức, không phải nợ kỹ thuật

**Decision.** HS là trẻ nhỏ; PH quản lý mật khẩu HS qua `lmsAuth.resetChildPassword` (đã có, đã test
— `lms-auth/router.ts`). Không build self-service đổi mật khẩu tự thân cho HS. Nhãn "P0-debt" trong
`student/change-password.tsx` bị gỡ — đây không phải nợ chờ trả, mà là thiết kế phù hợp đối tượng
người dùng (trẻ em không tự quản lý được credential dài hạn một cách an toàn).

**Consequences.** `change-password.tsx` giữ nguyên hành vi (đổi mật khẩu lần đầu khi
`mustChangePassword`), chỉ sửa comment/text UI — không đổi API/behavior.

### (b) OTP delivery qua EmailOutbox với payload plaintext ngắn hạn

**Context.** `LoginOtp` chỉ lưu `codeHash` (đúng thiết kế — không đảo ngược được); email gửi PH phải
chứa code thật → chỉ có thể mang qua `EmailOutbox.payload` tại thời điểm request (không có nơi nào
khác giữ plaintext).

**Decision.** `requestOtpEmail` (chỉ khi ParentAccount tồn tại — gate-send, không phải gate-response)
enqueue 1 dòng `EmailOutbox` với `payload: {kind:'otp', code, ttlMinutes}`. Trade-off plaintext ngắn
hạn được chấp nhận có kiểm soát (user chốt, validation log 2026-07-10 #2), bù bằng:
- **Scrub** payload ngay khi row đạt trạng thái terminal `sent` (gửi thành công) HOẶC `dead` (hết
  retry) — worker cập nhật `payload: {kind:'otp', scrubbed:true}` cùng statement với đổi status.
- **Sweep theo tuổi**: mọi row `kind='otp'` cũ hơn TTL đăng nhập (5 phút) bị scrub bất kể status —
  chặn trường hợp row kẹt ở `pending`/`sending`/`failed` giữ code vượt quá thời điểm code còn dùng
  được để đăng nhập. Sweep chạy SAU vòng drain trong cùng chu kỳ worker (không phải trước) — nếu chạy
  trước, một row "failed nhưng chưa hết TTL" bị scrub rồi mới gửi sẽ khiến `renderOutboxEmail` rơi vào
  nhánh fallback rỗng, lãng phí 1 lượt gửi Brevo thật mà PH nhận được email không nội dung.
- Row `failed` (còn lượt retry, CHƯA hết TTL) CỐ Ý giữ code để lần retry kế tiếp còn gửi được — không
  scrub non-terminal.
- Lớp phòng-thủ khác đã có sẵn: TTL 5 phút, single-use (atomic claim), cooldown 30s/email, gate-send
  theo ParentAccount tồn tại (không gửi cho email lạ dù response vẫn `{ok:true}` — no-leak), global cap
  `kind='otp'`/giờ fail-closed (chống email-bomb/Brevo-quota-drain — red-team C2), không log OTP/PII ở
  transport.
- `EmailOutbox` không có RLS/không `facilityId` (bảng hệ thống dùng chung) — ghi rõ đây là bảng DUY
  NHẤT trong hệ thống có thể chứa secret ngắn hạn (OTP code) ở dạng plaintext; nếu lọt vào backup, code
  đã hết hạn đăng nhập từ lâu (TTL 5 phút ≪ chu kỳ backup).

**Acceptance ngữ nghĩa (chốt tránh hiểu lầm).** "Không tồn đọng" nghĩa là: không còn plaintext SAU KHI
gửi xong HOẶC sau TTL — không phải zero-giây từ lúc tạo row.

**Refs.** `plans/260710-0005-lms-gap-closure-otp-parent-visibility/plan.md` (Red Team Review C1/C2/M1,
Validation Log #2) · `apps/api/src/worker/relay-email-outbox.ts` (`sweepStaleOtpPayloads`).

---

## Đồng bộ cần làm sau khi chốt (housekeeping)

1. ✅ **TL14** — đánh dấu 5 vai trò active + 4 deferred + IT; xoá mục "quan_ly/head_teacher là role"
   (chốt: không thêm). **DONE 2026-07-09** — ADR-D amendment merged.
2. **TL07** — định nghĩa lại `reserved` (ADR-A); ghi `active ⇔ có Receipt approved`.
3. **TL02/05/06** — thay bằng IA 5 nhóm (ADR-C); sửa `O4_ENROLLED` → `O5_ENROLLED`.
4. **TL10/11** — enrollment: `reserved`→`active` lái bởi Receipt (bỏ `pending_payment` như enum mới).
5. **"Liên kết vai trò"** — viết lại theo mô hình 4 vai trò + provisioning tự động.
6. Đánh số lại toàn bộ `TL00–TL16` cho nhất quán.

> Liên kết: TL14 (vai trò) · TL15 (audit/open questions) · TL07/10/11 (đồng bộ) · TL04/13 (agent bù SoD).
