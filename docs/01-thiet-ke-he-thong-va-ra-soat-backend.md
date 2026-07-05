# Tài liệu 1 — Thiết kế hệ thống & Đề cương rà soát Backend (CMC EDU ERP)

> Mục đích: làm chuẩn tham chiếu để **yêu cầu rà soát backend**. Tài liệu này liệt kê
> những gì backend PHẢI bảo toàn (bất biến), những gì đã biết là chấp nhận được (không
> "sửa nhầm"), và một checklist cụ thể để reviewer chạy qua.
> Nguồn: `docs/decisions/*`, `docs/adr/*`, `docs/DECISION_INDEX.md` của repo `manhquydev/CMCnew`.

---

## 1. Cách dùng tài liệu

Reviewer đọc theo thứ tự: (2) hiểu kiến trúc → (3) hiểu vai trò thực tế → (4) nắm bất
biến bắt buộc → (5) nắm các cửa sổ race đã chấp nhận → (6) chạy checklist. Mỗi khẳng
định đều trích **số hiệu quyết định (QĐ)** để mở đúng decision doc gốc trước khi động vào
code (theo `DECISION_INDEX.md`).

---

## 2. Kiến trúc & stack (ADR 0001)

Hệ thống là **monorepo** nhiều app: `apps/admin` (ERP nhân viên), `apps/lms` (cổng phụ
huynh/học sinh), `apps/api` (tRPC), `packages/*` (auth, ui, domain-academic…). Dữ liệu
Postgres + Prisma. Phân quyền = **role key + RLS theo `facilityId`**. Đăng nhập nhân sự
qua Microsoft SSO (QĐ 0031 giữ song song mật khẩu); học sinh/PH đăng nhập LMS bằng SĐT
(QĐ 0033). Email ra ngoài qua Microsoft Graph, tách người nhận ngoài sang Brevo (QĐ 0013,
0030).

---

## 3. Mô hình vai trò: THỰC TẾ vs REGISTRY

**Quan trọng cho reviewer:** registry RBAC định nghĩa ~10 role key, nhưng **thực tế chỉ có
5 vai trò người thật** và một người thường **đội nhiều mũ**. Backend phải đúng ở cả hai
mức: registry vẫn đầy đủ, nhưng hành vi thực tế phải chịu được cảnh gán nhiều quyền cho
một người.

| Vai trò thực tế | Role key hiện dùng | Ghi chú thực tế |
|---|---|---|
| Sale | `sale` | Tạo phiếu **nháp** (không tự duyệt) |
| Giáo viên | `giao_vien` | — |
| Giám đốc Kinh doanh | `giam_doc_kinh_doanh` | **Duyệt cổng tiền** (sale tạo ≠ GĐKD duyệt → SoD đạt; ADR-B) |
| Giám đốc Đào tạo | `giam_doc_dao_tao` | Miền đào tạo; mắt-thứ-hai duyệt tiền vượt ngưỡng |
| IT | `super_admin` | Cấu hình hệ thống |
| *(tạm gác — ADR-D)* | `ke_toan`, `cskh`, `ctv_mkt`, `hr` | Giữ trong registry, chưa build quyền/UI. Khi có `ke_toan` → chuyển cổng tiền sang kế toán |

**Hệ quả kiểm thử:** SoD cơ bản đạt (người tạo ≠ người duyệt). Vẫn có rủi ro *đội-nhiều-mũ* nếu một
người giữ cả `receiptCreate` lẫn `receiptApprove` — reviewer xác nhận: khi cùng `userId` tạo & duyệt,
audit vẫn ghi đủ "ai tạo / ai duyệt" (kể cả trùng người). Compensating control: Reconciliation agent
(HOTL) + ngưỡng tiền cần GĐĐT (ADR-B).

---

## 4. Bất biến bắt buộc — backend PHẢI bảo toàn

Đây là danh sách "đừng phá". Mọi thay đổi backend phải giữ nguyên các bất biến này:

| # | Bất biến | QĐ | Vì sao |
|---|---|---|---|
| I1 | **Cổng tiền tách khỏi tạo phiếu**: `receiptApprove` chỉ `ke_toan`/giám đốc; `sale` chỉ tạo nháp | 0024 | Kiểm soát tài chính |
| I2 | **Duyệt phiếu = auto-advance opp → O5_ENROLLED + stamp `closedAt`** trong CÙNG transaction | 0024 | "Won" metrics trung thực |
| I3 | **Huỷ phiếu = revert opp về O4 + clear `closedAt`** nếu đó là phiếu duy nhất đã auto-advance | 0024 | Cho phép sửa lại thủ công |
| I4 | **`receipt.netAmount` đóng băng sau duyệt** — không bao giờ mutate | 0028 | Feed hoa hồng + audit |
| I5 | **Hoàn tiền append-only**, cap `SUM(refund) ≤ netAmount`, khoá `FOR UPDATE` (atomic) | 0028 | Không âm quỹ, không double-refund |
| I6 | **Provisioning trong transaction duyệt**: ParentAccount find-or-create theo phone `84xxx`, StudentAccount + Guardian link | 0033 | Một credential/SĐT, dùng chung các con |
| I7 | **Phạt chấm công là khoản trừ SAU thuế**, field override độc lập với `variablePay` | 0025 | Không méo thuế; không bị ghi đè bởi override hoa hồng |
| I8 | **Payslip self-healing**: gộp phạt từ punch LIVE mỗi lần `assembleSlipData`; finalize khoá, reopen tính lại | 0025 | Không mất punch duyệt-muộn |
| I9 | **Duyệt ca chống tự-duyệt**: `assertAssignedApprover`; managerId ≠ self; chặn cặp A↔B | 0027 | Chống thông đồng/vòng lặp |
| I10 | **RLS theo `facilityId`** trên mọi query nghiệp vụ (receipt, opp, refund…) | 0028, 0037 | Cô lập dữ liệu cơ sở |
| I11 | **`crm.opportunityLookup` tách khỏi `crm.opportunityList`** — tra cứu không mở nav CRM | 0037 | Kế toán chỉ "check tồn tại", không thấy cả pipeline |

---

## 5. Cửa sổ race & giới hạn ĐÃ chấp nhận (đừng "sửa nhầm")

Những chỗ dưới đây **cố ý để vậy** — reviewer không nên coi là bug rồi vá làm hỏng thiết kế:

- **Race sinh ParentAccount lần đầu (QĐ 0033):** hai con đầu tiên của một SĐT-mới duyệt
  đồng thời → `unique_violation` trên `ParentAccount.phone`. Xử lý đã định: `SAVEPOINT` +
  bắt `P2002` refetch, hoặc `INSERT ... ON CONFLICT (phone) DO NOTHING` + refetch. Đây là
  cách giữ transaction tiền sống. Reviewer cần **xác nhận cách này đã được implement**, không
  phải thay bằng lock toàn cục.
- **Cảnh báo trùng SĐT là "soft", không hard-block (QĐ 0037):** hai con chung SĐT phụ
  huynh là hợp lệ. `receiptCreate` trả *discriminated union* `{status:'success'|'warning'}`;
  FE phải narrow `status==='success'` trước khi đọc `.receipt`. Có cửa sổ race duplicate
  chấp nhận được (không unique constraint trên `Receipt.parentPhone`).
- **Hoàn tiền không có đường update/delete (QĐ 0028):** sửa sai = thêm dòng mới trong cap.
  Over-refund fat-finger xử lý bằng SQL ops thủ công — *không* thêm dòng âm.

---

## 6. Checklist rà soát Backend

Reviewer chạy qua từng mục; mỗi mục là một câu hỏi có/không + bằng chứng.

### 6.1. Phân quyền & parity
- [ ] `permission-parity.test.ts` xanh; snapshot phản ánh đúng role set thực tế (kể cả
  `crm.opportunityLookup` mới — QĐ 0037).
- [ ] **Không còn role array hardcode** trong panel (anti-pattern đã bắt trong UX audit
  #7: `payroll-panel.tsx` từng hardcode `['hr','ke_toan']`). Mọi guard UI phải gọi cùng
  `can()` mà nav dùng — grep tìm mảng role literal trong `apps/admin/src/**`.
- [ ] `nav-consistency.test.ts` khẳng định `NAV_GATES ↔ PERMISSIONS` khớp.
- [ ] Với người đội-nhiều-mũ (sale+ke_toan): xác nhận không có guard nào ngầm giả định
  người tạo ≠ người duyệt (mục 3).

### 6.2. Toàn vẹn tiền
- [ ] I1–I5 có test tích hợp: draft→approve auto-O5; cancel revert-O5; refund cap
  `FOR UPDATE` (test 2 call đồng thời, đúng 1 thành công — QĐ 0028).
- [ ] `netAmount` bất biến sau approve (I4) — có test khẳng định không mutate.
- [ ] `kind` (new/renewal) tính TRƯỚC khi update stage để win-back tag đúng (QĐ 0024).

### 6.3. Provisioning & định danh LMS
- [ ] I6 có test: sinh 2 con của SĐT-mới đồng thời không làm abort transaction tiền
  (SAVEPOINT/ON CONFLICT — QĐ 0033).
- [ ] Login LMS = phone chuẩn hoá `84xxx` (dùng `normalizeLoginPhone`), KHÔNG nhầm với
  `normalizeContactPhone` (`+84`) dùng cho CRM matching (QĐ 0037 §3).
- [ ] Profile picker: 1 con auto-vào, ≥2 con hiện picker; phiên per-child chuẩn (QĐ 0033).

### 6.4. Chấm công & lương
- [ ] I7–I8: phạt post-tax, không âm net; override là field riêng; reopen re-derive từ
  punch live; bucket ICT (+7) đúng biên tháng (QĐ 0025).
- [ ] `checkInOut.monthlyReport` dùng aggregate server-side, không đi qua guard per-user
  (vốn FORBIDDEN với giám đốc — QĐ 0025 §6).

### 6.5. Duyệt ca
- [ ] I9: managerId duyệt được cấp dưới, không tự duyệt; 2 giám đốc bypass; validate
  managerId ở `profileUpsert` (không self-ref, cùng facility active, chặn A↔B — QĐ 0027).
- [ ] 1 phiếu Nháp/Chờ duyệt tại 1 thời điểm; `fromDate` tương lai theo Asia/Saigon
  (QĐ 0035).

### 6.6. Cô lập dữ liệu
- [ ] I10: mọi query nghiệp vụ có RLS `facilityId`; không rò dữ liệu chéo cơ sở.
- [ ] "Open opportunity" dùng đúng predicate chung `{stage != O5, lostReason: null}` — hai
  filter độc lập từng phân kỳ (QĐ 0037 §4).

---

## 7. Phụ lục — Bản đồ QĐ theo luồng

| Luồng | Quyết định nguồn |
|---|---|
| Tuyển sinh → sinh tài khoản | 0024, 0037, 0033 |
| Chấm công → lương | 0034, 0025, 0011 |
| Đăng ký/duyệt ca | 0035, 0020, 0027 |
| Huỷ phiếu/hoàn tiền | 0028, 0024 |
| Định danh & đăng nhập | 0031 (staff SSO+pw), 0033 (LMS phone) |
| Email | 0013, 0030 |

> Chi tiết luồng liên-vai-trò: xem TL17 (`17-lien-ket-vai-tro-va-luong.md`).
> Chi tiết thiết kế lại giao diện: xem `02-thiet-ke-lai-giao-dien-ux.md`.
