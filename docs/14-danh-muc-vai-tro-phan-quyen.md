# Tài liệu 14 — Danh mục Vai trò & Phân quyền (RBAC Catalog)

> Nguồn sự thật DUY NHẤT về vai trò. Trước đây thông tin vai trò nằm rải ở TL1/TL05/TL07/"liên kết
> vai trò" (mồ côi — được nhắc khắp nơi, không định nghĩa một chỗ). Tài liệu này gom lại, bám thẳng
> `enum Role` trong `packages/db/prisma/schema.prisma` và permission registry `@cmc/auth`.
>
> **[2026-07-07 S1]** `enum Role` đã vào schema (migration `20260707200000`); `AppUser.roles Role[]`
> thêm vào; drift-assertion test `apps/api/src/user/role-drift.test.ts` khoá 2 nguồn không lệch.

---

## 1. Danh sách vai trò CHÍNH THỨC (đúng 9 — theo enum Role)

> ⚠️ Chỉ có **9 role** trong enum. `quan_ly`, `truong_phong`, `head_teacher` **KHÔNG** nằm trong
> enum — "quản lý" là thuộc tính `managerId`, không phải role (§2). Phạm vi v2 chốt ở **ADR-D (TL16)**:
> ERP phục vụ **4 vai trò active + IT**; 5 role còn lại **giữ trong registry nhưng tạm gác**.

| Role key | Tên | Mô tả | # quyền | Phạm vi v2 |
|---|---|---|---|---|
| `giam_doc_kinh_doanh` | Giám đốc Kinh doanh | Quản lý `sale`; duyệt cổng tiền (ADR-B); miền KD–tài chính | **103** | 🟢 **Active** |
| `giam_doc_dao_tao` | Giám đốc Đào tạo | Quản lý `giao_vien`; miền đào tạo; mắt-thứ-hai duyệt tiền | **104** | 🟢 **Active** |
| `sale` | Sale / Tư vấn tuyển sinh | CRM, tạo phiếu **nháp**, afterSale | 37 | 🟢 **Active** |
| `giao_vien` | Giáo viên | Dạy, điểm danh, chấm bài, nhận xét | 39 | 🟢 **Active** |
| `super_admin` | Quản trị hệ thống (IT) | Bypass, cấu hình hệ thống | 20 (+bypass) | 🟢 **Active (IT)** |
| `ke_toan` | Kế toán | Tạo & duyệt phiếu, hoàn tiền, chốt lương | 20 | 🟡 Deferred |
| `cskh` | CSKH | Chăm sóc sau bán | 32 | 🟡 Deferred |
| `ctv_mkt` | CTV Marketing | CRM tối thiểu (lead O1) | 6 | 🟡 Deferred |
| `hr` | Nhân sự | Onboarding, duyệt ca thay quản lý | 8 | 🟡 Deferred |

**Mô hình vận hành v2 (ADR-D):** ERP = **GĐKD (quản lý sale) · GĐĐT (quản lý giáo viên) · sale ·
giáo viên · IT**. LMS = **phụ huynh + học sinh**. 5 role deferred giữ trong enum/registry, **không
build quyền/UI riêng** lúc này — khi cần chỉ bật quyền + màn, không đổi mô hình. Hệ quả: vì gác
`ke_toan`, **cổng tiền do GĐKD** (sale tạo ≠ GĐKD duyệt → SoD đạt; xem ADR-B).

## 2. "Quản lý" là THUỘC TÍNH, không phải vai trò

Duyệt ca không dựa vào một role "quản lý" — mà dựa vào **`managerId`** (trường trên hồ sơ nhân sự):
người có `managerId` trỏ tới ai thì người đó là cấp trên duyệt ca. `assertAssignedApprover` chặn
tự-duyệt; validate managerId cùng facility, chống cặp A↔B (QĐ 0027). → Khi nói "trưởng nhóm duyệt
ca", đó là *quan hệ managerId*, không phải role. (Đây là điểm mình viết sai ở TL1/TL07 — xem audit TL15.)

## 3. Mô hình uỷ quyền (delegation) & phạm vi

- **Hai giám đốc là gốc quyền theo miền:** GĐKD uỷ quyền/duyệt miền kinh doanh–tài chính; GĐĐT
  miền đào tạo–giáo viên. Cả hai có quyền rộng nhất (103–104 gate).
- **Đọc rộng, ghi hẹp cho giám đốc:** payroll/list surfaces mở toàn cơ sở cho 2 giám đốc (executive
  visibility), nhưng *ghi* (approve/confirm) domain-scoped (QĐ payroll director scoping, DEBT ACCEPTED).
- **super_admin bypass** toàn bộ; không kế thừa giữa role khác (explicit per-role).

## 4. ✅ Đã chốt (ADR-D, TL16): KHÔNG thêm role `quan_ly`/`head_teacher`

Plan `erp-rebuild-f0-f4` từng nhắc `quan_ly` + `head_teacher`, nhưng enum Role không có. **Quyết
định v2:** giữ **9 role**, KHÔNG thêm role mới. Việc tạo lớp/xếp lịch gán vào **quyền
`class.create`/`schedule.generate` cho GĐĐT**; quan hệ cấp trên–cấp dưới dùng **`managerId`** (§2).

## 5. Ma trận quyền tóm tắt (module × role — gate đại diện)

| Module.action | super | GĐKD | GĐĐT | sale | ke_toan | giao_vien | cskh | ctv_mkt | hr |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `crm.opportunityList` | ✓ | ✓ | | ✓ | | | ✓ | ✓ | |
| `crm.opportunityLookup` | ✓ | ✓ | | ✓ | ✓ | | | | |
| `finance.receiptCreate` | ✓ | ✓ | | ✓(nháp) | ✓ | | | | |
| `finance.receiptApprove` (cổng tiền) | ✓ | ✓ | ✓ | | ✓ | | | | |
| `finance.refundCreate` | ✓ | ✓ | | | ✓ | | | | |
| `finance.receiptList` / `receiptGet` (K3, hàng đợi duyệt) | ✓ | ✓ | ✓ | | ✓ | | | | |
| `guardian.listPendingLinks` (K3, hàng đợi duyệt link) | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | | |
| `student.lookup` (K4, staff-only) | ✓ | ✓ | ✓ | ✓ | ✓ | | | | |
| `facility.create` / `facility.list` (K7) | ✓ | | | | | | | | |
| `enrollment.enroll` | ✓ | ✓ | ✓ | ✓ | | | | | |
| `class.create` / `schedule.generate` | ✓ | | ✓ | | | | | | |
| `attendance.mark` | ✓ | | ✓ | | | ✓ | | | |
| `assessment.*` | ✓ | | ✓ | | | ✓ | | | |
| `shiftRegistration.approve` | ✓ | ✓ | ✓ | | | | | | ✓ + managerId |
| `payroll.approve` | ✓ | ✓(KD) | ✓(ĐT) | | ✓ | | | | |
| `checkInOut.monthlyReport` | ✓ | ✓ | ✓ | | | | | | |

> Bảng là *đại diện* để đối chiếu; nguồn đầy đủ là registry `@cmc/auth`. Mọi UI/route/agent gate
> phải gọi cùng `can(roles, module, action)` — không hardcode (nợ TL3).

## 6. Agent là vai trò hạng nhất

AI agent = role `ai_agent_*` với quyền cấp **hẹp** (chỉ tool cần), chịu cùng gate/RLS/audit. Ví dụ
Reconciliation agent chỉ có quyền *đọc* finance + *đọc* audit; không có `receiptApprove` (TL4/TL13).

## 7. Quy tắc duy trì

Thêm/đổi role hoặc quyền → sửa **enum Role + registry + tài liệu này** cùng lúc, kèm ADR nếu đổi
mô hình. Đây là nguồn duy nhất; các tài liệu khác (TL1/TL05/TL07) trỏ về đây, không định nghĩa lại.

> Liên kết: TL1 (bất biến & SoD) · TL3 (nợ role-array) · TL13 (agent principal) · TL17
> (luồng — **cần cập nhật theo tài liệu này**, xem TL15).
