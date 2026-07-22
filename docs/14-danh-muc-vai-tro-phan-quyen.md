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
| `ke_toan` | Kế toán | *(dormant — enum trơ)* | 0 | 🟡 Deferred |
| `cskh` | CSKH | *(dormant — enum trơ)* | 0 | 🟡 Deferred |
| `ctv_mkt` | CTV Marketing | *(dormant — enum trơ)* | 0 | 🟡 Deferred |
| `hr` | Nhân sự | *(dormant — enum trơ)* | 0 | 🟡 Deferred |

**Mô hình vận hành v2 (ADR-D + amendment 2026-07-08):** ERP = **GĐKD · GĐĐT · sale ·
giáo viên · IT**. LMS = **phụ huynh + học sinh**. 4 role deferred giữ trong DB enum (không
migration) nhưng **0 quyền trong registry, không gán được** (`ACTIVE_ROLES` + `updateRoles`
zod reject + invariant test enforce). Bật lại = thêm `ACTIVE_ROLES` + quyền + UI + ADR mới.
Hệ quả: vì gác `ke_toan`, **cổng tiền do GĐKD** (sale tạo ≠ GĐKD duyệt → SoD; ADR-B).

## 2. "Quản lý" là THUỘC TÍNH, không phải vai trò

`managerId` (trường trên hồ sơ nhân sự) mã hoá quan hệ cấp trên–cấp dưới, dùng cho **`kpi.confirm`**
(direct manager xác nhận phiếu KPI, chống tự-xác-nhận — docs/20 §4). **Duyệt CA** (`shift.approve`/
`shift.reject`) là ngoại lệ đã sửa ở HR remediation: gate theo **ROLE khớp `ShiftGroup.type`**
(`GIAO_VIEN`→`giam_doc_dao_tao`, `KINH_DOANH`→`giam_doc_kinh_doanh`, `super_admin` bypass cả hai) +
chống tự-duyệt — **không còn** dựa vào chuỗi `managerId` (docs/17 §4, docs/20 §2). **Duyệt phiếu chấm
công** (`manualPunch.approve`/`reject`) cũng đổi sang gate ROLE-theo-track y hệt shift (ADR 0043, docs/20
§1) — không còn dựa vào `managerId`. → Khi nói "trưởng nhóm duyệt ca/duyệt chấm công", đó là *role*,
không phải *quan hệ managerId* — chỉ `kpi.confirm` mới dùng `managerId`.

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

| Module.action | super | GĐKD | GĐĐT | sale | giao_vien |
|---|:-:|:-:|:-:|:-:|:-:|
| `crm.opportunityList` | ✓ | ✓ | | ✓ | |
| `crm.opportunityLookup` | ✓ | ✓ | | ✓ | |
| `crm.opportunityAssign` ¹ | ✓ | ✓ | | ✓ | |
| `finance.receiptCreate` | ✓ | ✓ | | ✓(nháp) | |
| `finance.receiptApprove` (cổng tiền) | ✓ | ✓ | ✓ | | |
| `finance.refundCreate` | ✓ | ✓ | | | |
| `finance.receiptList` / `receiptGet` (hàng đợi duyệt) | ✓ | ✓ | ✓ | | |
| `guardian.listPendingLinks` (hàng đợi duyệt link) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `student.lookup` (staff-only) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `facility.create` / `facility.list` | ✓ | | | | |
| `audit.list` (xem AuditLog) | ✓ | | | | |
| `enrollment.enroll` | ✓ | ✓ | ✓ | ✓ | |
| `class.create` / `schedule.generate` | ✓ | | ✓ | | |
| `class.read` (xem danh sách/chi tiết lớp + buổi học) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `classRoster.read` (xem danh sách học sinh của lớp — có họ tên trẻ) | ✓ | | ✓ | | ✓ |
| `attendance.mark` | ✓ | | ✓ | | ✓ |
| `assessment.*` | ✓ | | ✓ | | ✓ |
| `checkIn.punch` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `manualPunch.approve` (ADR 0043, GĐ-track — `manualPunch.create` đã bỏ) | ✓ | ✓ | ✓ | | |
| `shift.submit` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `shift.approve` / `shift.manage` | ✓ | ✓ | ✓ | | |
| `kpi.refresh` / `kpi.submitSlip` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `kpi.confirm` / `kpi.bulkApprove` / `kpi.approve` (override) | ✓ | ✓ | ✓ | | |
| `salaryTier.manage` | ✓ | ✓ | ✓ | | |
| `compensationPolicy.manage` | ✓ | | | | |
| `payslip.assemble` / `finalize` / `reopen` | ✓ | ✓ | ✓ | | |
| `gift.list` / `rewards.manage` | ✓ | ✓ | ✓ | ✓ | |

> Bảng là *đại diện* (5 active roles, ADR-D amendment); nguồn đầy đủ = registry `@cmc/auth`.

> ¹ `crm.opportunityAssign` — cổng theo role chỉ *mở cửa*; luật cấp-dòng nằm trong thủ tục (`crm/router.ts`): `sale` chỉ được **nhận cơ hội cho chính mình** khi cơ hội chưa có chủ hoặc đã là của mình (không được gỡ giao/giao cho người khác); `giam_doc_kinh_doanh` giao/gỡ cho bất kỳ ai.
> Role gác (ke_toan/cskh/ctv_mkt/hr) có 0 quyền — không hiển thị.
> **`audit.list` = super_admin-only, chủ ý** (registry `packages/auth/src/index.ts:77` dùng
> empty-role-array `[]` — cùng pattern `facility.create`/`facility.list`/`facility.manage`,
> chỉ bypass `super_admin` trong `can()` mới qua được). Nguồn quyết định: journal
> `docs/journals/260716-super-admin-completion-audit-middleware.md` + PO xác nhận 2026-07-19
> (brainstorm Hướng A+) — ghi ở đây để phiên sau không "sửa nhầm" mở quyền đọc AuditLog cho
> vai trò khác.
> UI/route/agent gate phải gọi `can(roles, module, action)` — không hardcode.
> **LMS surface** (`submission.listForChild`, `attendance.listForChild`, `assessment.listForChild`,
> `sessionEvidence.listForChild`…) KHÔNG nằm trong bảng này — đó là gate `requireLmsParent`/
> `requireLmsStudent` (PH/HS), tách biệt hoàn toàn khỏi `can()` staff registry. Xem docs/17 §6.

## 6. Agent là vai trò hạng nhất

AI agent = role `ai_agent_*` với quyền cấp **hẹp** (chỉ tool cần), chịu cùng gate/RLS/audit. Ví dụ
Reconciliation agent chỉ có quyền *đọc* finance + *đọc* audit; không có `receiptApprove` (TL4/TL13).

## 7. Quy tắc duy trì

Thêm/đổi role hoặc quyền → sửa **enum Role + registry + tài liệu này** cùng lúc, kèm ADR nếu đổi
mô hình. Đây là nguồn duy nhất; các tài liệu khác (TL1/TL05/TL07) trỏ về đây, không định nghĩa lại.

> Liên kết: TL1 (bất biến & SoD) · TL3 (nợ role-array) · TL13 (agent principal) · TL17
> (luồng — đã viết lại theo mô hình v2, nhất quán với tài liệu này; xác nhận 2026-07-09).
