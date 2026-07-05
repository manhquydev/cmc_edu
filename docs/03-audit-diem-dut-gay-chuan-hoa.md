# Tài liệu 3 — Báo cáo Audit hệ thống & Điểm đứt gãy (chuẩn hoá theo khung ngành)

> Phương pháp: áp lăng kính **tech-debt** (Code/Architecture/Test/Dependency/Doc/Infra) và
> **testing pyramid**, đối chiếu với các chuẩn ngành: **Segregation of Duties (SoD) + compensating
> controls**, **Transactional Outbox / Idempotent consumer**, kỷ luật **ADR**.
> Nguồn nội bộ: `DEBT.md`, `docs/decisions/*`, code trong `apps/*`, `packages/*`.
> Chấm ưu tiên: `Priority = (Impact + Risk) × (6 − Effort)` (điểm cao = làm trước).

---

## 1. Điểm mạnh cần ghi nhận (để không "sửa nhầm" cái đang đúng)

Dự án trưởng thành hơn mức thường thấy. Trước khi nói điểm yếu, ghi nhận cái đúng:

- **Sổ nợ kỹ thuật minh bạch** (`DEBT.md`) — mỗi gate-skip ghi rõ phơi nhiễm + hạn trả. Đây là
  thực hành xuất sắc, hiếm gặp.
- **Kỷ luật quyết định** — 37 decision doc + `DECISION_INDEX` trỏ file↔luật. Đây gần đúng chuẩn
  **ADR** (Architecture Decision Records).
- **Outbox cho email đã có** (`email-outbox.ts`) — đúng chuẩn **Transactional Outbox**: ghi sự
  kiện vào bảng trong cùng transaction rồi relay, đảm bảo gửi ít nhất một lần, tránh mất dữ liệu do bài toán "dual-write".
- **Hoàn tiền atomic** — `SELECT ... FOR UPDATE` + cap tổng (QĐ 0028) là cách xử race đúng bài.
- **RLS theo facility** trên nghiệp vụ; audit người duyệt.

---

## 2. Điểm đứt gãy — phân loại, chấm điểm, đối chiếu chuẩn

### G. QUẢN TRỊ — Đội-nhiều-mũ + tự-duyệt thiếu "compensating control"  · **P=24**
`Impact 2 · Risk 4 · Effort 2`

Thực tế một người giữ cả `finance.receiptCreate` lẫn `finance.receiptApprove` (sale kiêm thu).
Theo chuẩn SoD, ba–bốn chức năng phải tách: **uỷ quyền (authorization) · ghi sổ (recording) ·
giữ tài sản (custody) · đối soát (reconciliation)**; nguyên tắc cốt lõi là người phê duyệt giao dịch phải tách khỏi người ghi/đối soát, và không được giữ quỹ.

Đây **không phải lỗi phải chặn** ở quy mô hiện tại — mà là **rủi ro cần bù bằng compensating
control**. Chuẩn cho tổ chức nhỏ: khi không thể tách, chủ doanh nghiệp/lãnh đạo tài chính phải chủ động review các hoạt động trọng yếu như một lớp giám sát bù, kèm ngưỡng phê duyệt (giao dịch trên hạn mức phải người cấp cao ký), nhật ký duyệt ghi ai-duyệt-ai-thực-thi, và đối soát ngân hàng định kỳ; ngoài ra kiểm tra đột xuất định kỳ (surprise audit) do người ngoài bộ phận ghi sổ thực hiện.

**Khắc phục (không viết lại nghiệp vụ):**
1. Bật nhãn audit nổi bật khi "tạo & tự duyệt" (backend đã ghi audit — chỉ cần phơi ra báo cáo).
2. Thêm **ngưỡng tiền**: phiếu > X triệu bắt buộc người thứ hai duyệt (dùng lại `receiptApprove`).
3. **Báo cáo đối soát tháng** cho giám đốc: liệt kê phiếu "tạo & tự duyệt" để review độc lập.
4. Lập **ma trận SoD** (bảng vai trò × chức năng) làm chuẩn khi mở rộng nhân sự — xem §3.

### C. CODE — Cổng quyền hardcode role-array phía client (authz drift)  · **P=28**
`Impact 3 · Risk 4 · Effort 2`

Grep tìm thấy mảng role literal dùng **làm cổng quyền** ở client, không qua `can()`:
`opportunity-detail.tsx:232` (`['giao_vien','giam_doc_dao_tao']`), `checkin-panel.tsx:51,54`,
`attendance-roster.tsx:21` (`MANAGER_ROLES`). Đây đúng anti-pattern mà chính UX audit của dự án
đã bắt ở `payroll-panel.tsx` (mảng `['hr','ke_toan']` lỗi thời khi giám đốc được cấp
`payroll.roster`). Rủi ro: registry đổi quyền → UI **trôi lệch âm thầm**, hiện/ẩn sai nút.

**Khắc phục:** sweep toàn bộ, thay literal bằng cùng `can(roles, module, action)` mà nav dùng;
thêm lint rule cấm role-string literal trong `apps/*/src/**` (trừ test).

### I. HẠ TẦNG — Backup chỉ nằm trên đĩa VPS + blob store không backup  · **P=32 (×2)**
`Impact 3 · Risk 5 · Effort 2`

Hai khoản nợ nghiêm trọng nhất trong `DEBT.md`: (a) `scripts/backup-db.sh` ghi backup **cùng
VPS** — mất đĩa = mất cả data sống lẫn mọi bản backup; (b) PDF bài tập + ảnh check-in ở
`.data/*` **local-disk, không backup** — mất host = mất toàn bộ worksheet + bằng chứng điểm danh.
Đây là **single point of failure** hạ tầng, phải xử trước go-live.

**Khắc phục:** cron rsync/S3 off-box sau mỗi backup; chuyển blob sang MinIO/S3 (đã có driver).

### A. KIẾN TRÚC — Transaction tiền "gánh" quá nhiều (provisioning inline)  · **P=21**
`Impact 3 · Risk 4 · Effort 3`

`receipt.approve` bó *đăng tiền + auto-O5 + tạo ParentAccount/StudentAccount + kích email* trong
một transaction. QĐ 0033 đã thừa nhận: hai con đầu của SĐT-mới duyệt đồng thời → `unique_violation`
trên `parent_account.phone` **abort cả transaction tiền**. Đã có hướng xử (`SAVEPOINT`/`ON CONFLICT
DO NOTHING` + refetch) — cần **xác nhận đã implement**.

Theo chuẩn, phần money-critical nên **atomic & tối thiểu**; các side-effect (email, và nên cả một
phần provisioning) tách ra **idempotent + outbox/relay**, vì outbox chỉ đảm bảo "at-least-once", nên consumer bắt buộc idempotent — xử lý an toàn khi nhận trùng. Email đã đúng (outbox); provisioning thì đang inline → là điểm giòn.

**Khắc phục:** giữ đăng tiền + auto-O5 trong tx; đẩy provisioning tài khoản qua bước idempotent
(khoá theo `phone`, `find-or-create` an toàn trùng) để lỗi provisioning không rollback tiền.

### T. KIỂM THỬ — E2E gãy + đáy pyramid mỏng  · **P=18 (×2)**
`Impact 3 · Risk 3 · Effort 3`

`DEBT.md` ghi rõ: (a) `apps/e2e` vướng ranh giới **ESM/CJS** → 2 spec (duyệt ca thủ công,
drill-down báo cáo tháng) *viết đúng nhưng không chạy được*; (b) **SSO E2E không phủ được**
(không mock IdP) — gap chấp nhận; (c) **e2e chỉ chạy post-deploy trên `main`**, không per-PR;
(d) **unit coverage mỏng**, dựa nhiều vào integration. Theo testing pyramid, đáy (unit, nhanh,
cô lập lỗi) đang thiếu → khó truy lỗi về một hàm.

**Khắc phục:** ưu tiên gỡ ESM/CJS (cần module resolver riêng cho Playwright, không chỉ cờ
`type:module`); bổ sung unit cho hàm thuần `domain-*` (KPI, lương, phạt) — chính các hàm tiền.

### S. BẢO MẬT — PII lưu plaintext + RLS định danh mở rộng  · **P=12**
`Impact 2 · Risk 4 · Effort 4`

CCCD/số tài khoản lưu **plaintext**, chỉ mask khi đọc (QĐ 0026 hoãn mã hoá cột). Bảng
`parent_account`/`student_account` đã **mở RLS cho mọi staff đọc** (accepted, `facility-model`).
Chấp nhận được giai đoạn này nhưng phải trả trước "production rebuild thật".

**Khắc phục:** mã hoá cột cho CCCD/bank khi lên production; ghi audit giá trị (hiện chỉ ghi tên field).

### D. TÀI LIỆU — Trùng số hiệu + ADR "Proposed" bị dựa vào  · **P=10**
`Impact 1 · Risk 1 · Effort 1`

`0032` bị dùng cho **hai** decision khác nhau (index tự cảnh báo). ADR `0015` (M365 Graph
provisioning) vẫn **Proposed** nhưng onboarding đang dựa một phần. Nợ nhỏ, dễ trả.

### F. TỰ ĐỘNG HOÁ — "nặng đuôi nhẹ đầu": thiếu đầu phễu  · **P=15**
`Impact 3 · Risk 2 · Effort 3`

Tự động hoá mạnh **sau** cổng tiền (auto-O5, provisioning, email) nhưng **đầu phễu thủ công**:
web-lead inbox và Callio sync đều **chưa build** (`DEBT.md`). Lead từ web/ads chưa có hàng đợi
duyệt trước khi vào pipeline → sale nhập tay, đứt mạch "chạm đầu tiên → cơ hội".

**Khắc phục:** web-lead inbox tối thiểu (form public → hàng đợi operator duyệt → tạo opp) khép
vòng tự động hoá đầu-đến-cuối.

---

## 3. Chuẩn hoá tài liệu dự án theo khung ngành

| Hiện có trong repo | Khung chuẩn nên gắn nhãn | Việc cần thêm |
|---|---|---|
| `docs/decisions/*` + INDEX | **ADR** (Nygard/MADR) | Sửa trùng `0032`; mỗi doc có Status/Context/Decision/Consequences (đa số đã có) |
| Phân quyền role×action | **Ma trận SoD** | Lập bảng vai trò × {authorize, record, custody, reconcile}, đánh dấu ô xung đột + control bù |
| ADR 0001 kiến trúc | **C4 model** (Context→Container→Component) | Vẽ 1 sơ đồ Container (admin/lms/api/db/graph/brevo) làm mặt tiền kiến trúc |
| Integration tests RLS/flow | **Testing pyramid** | Bồi đáy unit cho hàm tiền; đặt mục tiêu coverage cho `domain-*` |
| `email-outbox.ts` | **Transactional Outbox** | Áp cùng nguyên tắc idempotent cho provisioning (§2.A) |
| `DEBT.md` | **Risk register / debt ledger** | Gắn cột Impact/Risk/Effort để ưu tiên định lượng (đã đề xuất §2) |

---

## 4. Bảng ưu tiên tổng hợp

| Ưu tiên | Hạng mục | Nhóm | P |
|---|---|---|---|
| 1 | Backup off-box (DB) + blob store có backup | Infra | 32 |
| 2 | Sweep bỏ role-array hardcode phía client | Code | 28 |
| 3 | Compensating controls cho SoD (ngưỡng duyệt + review tháng) | Governance | 24 |
| 4 | Tách provisioning khỏi transaction tiền (idempotent) | Architecture | 21 |
| 5 | Gỡ E2E ESM/CJS + bồi đáy unit | Test | 18 |
| 6 | Web-lead inbox (khép đầu phễu) | Automation | 15 |
| 7 | Mã hoá cột PII (CCCD/bank) | Security | 12 |
| 8 | Sửa trùng số hiệu `0032`; chốt ADR 0015 | Doc | 10 |

---

## 5. Lộ trình khắc phục (làm song song với feature)

- **Đợt 1 — Chống mất mát & trôi quyền (P≥28):** backup off-box + blob backup; sweep role-array.
  Đây là hai thứ có thể gây thiệt hại không hồi phục / lỗ hổng phân quyền âm thầm.
- **Đợt 2 — Quản trị & toàn vẹn tiền (P 21–24):** dựng compensating controls SoD; tách provisioning
  khỏi tx tiền theo chuẩn idempotent.
- **Đợt 3 — Chất lượng & khép phễu (P 15–18):** gỡ E2E, bồi unit hàm tiền; web-lead inbox.
- **Đợt 4 — Bảo mật & dọn tài liệu (P ≤12):** mã hoá PII; sửa số hiệu, chốt ADR 0015; vẽ C4 + ma trận SoD.

> Tham chiếu chéo: bất biến & checklist backend ở `01-thiet-ke-he-thong-va-ra-soat-backend.md`;
> thiết kế lại UX ở `02-thiet-ke-lai-giao-dien-ux.md`; luồng vai trò ở TL17 (`17-lien-ket-vai-tro-va-luong.md`).
