# Brainstorm — Rà soát scope vai trò thực tế (4 active + IT) vs code, hướng đi hoàn thiện

- Date: 2026-07-08 22:32 (ICT)
- Mode: markdown only (no --html/--wiki)
- Participants: PO (user) × brainstormer
- Status: **Chốt Nấc 2** (chặn gán role + làm sạch registry về 5 role thật) + giữ nguyên URL `/hr/*`
- Cập nhật 22:40: PO nâng từ A (chỉ chặn gán) lên Nấc 2 sau khi làm rõ triết lý "hệ thống sát
  bối cảnh thực tế" — 2 giám đốc đảm nhiệm toàn bộ việc của các role gác; ERP = 4 role + IT,
  LMS = PH + HS; không mô tả quyền cho vai trò không tồn tại.

## 1. Problem statement

PO lo dự án lệch scope: thực tế chỉ có 5 vai trò (sale, giáo viên, GĐKD, GĐĐT, IT/super_admin)
nhưng hệ thống có vẻ build đủ 9 role (thêm ctv_mkt, hr, ke_toan, cskh). Cần: (a) xác minh docs đã
mô tả scope thực tế chưa, (b) đánh giá mức lệch của code, (c) chốt hướng hoàn thiện tới go-live.

## 2. Findings (facts — đã verify trên repo)

1. **Docs ĐÃ chốt đúng scope PO muốn**: ADR-D (`docs/16-brief-quyet-dinh-thiet-ke-adr.md` §ADR-D)
   = ERP phục vụ 4 role active + IT; 5 role deferred giữ trong enum/registry, KHÔNG build quyền/UI
   riêng. `docs/14-danh-muc-vai-tro-phan-quyen.md` là SSOT, đánh dấu Active/Deferred từng role.
   Roadmap (`docs/project-roadmap.md` §3) khoá bất biến "can() registry 9-role (ADR-D)".
2. **Code phần lớn tuân thủ**: nav admin ẩn module hr cho mọi role active (test
   `apps/admin/src/shell/nav-registry.test.ts:34`); drift-test enum↔registry tồn tại.
3. **3 điểm lệch nhẹ**:
   - `apps/admin/src/pages/admin/users.tsx:8` — modal Phân quyền cho gán cả 9 role. Kết hợp
     registry dormant (`packages/auth/src/index.ts:50` — ke_toan có `finance.receiptApprove`)
     → gán nhầm ke_toan = có quyền duyệt tiền. **Rủi ro thật, nhỏ nhưng đáng đóng trước UAT.**
   - URL `/hr/*` + `pages/hr/` mount payroll/KPI/shifts/checkin — tính năng thực chất của
     giám đốc + chấm công nhân viên (đúng scope active); chỉ tên gây hiểu nhầm. Cosmetic.
   - Registry giữ deferred roles trong permission lists — đúng chủ đích ADR-D (bật lại không đổi
     mô hình), không phải drift.
4. **Tình trạng dự án**: M0 go-live sprint (`plans/260707-2308-golive-sprint-land-sso-env-uat`)
   — Phase 1 SSO ✅ (PR #24), Phase 3 flow-audit ✅ (0 CRITICAL/3 HIGH), Phase 2 env-prod ⏳,
   Phase 4 UAT ⏳. Sau M0: M1 pilot+VPS thật → M2 P4-completion → M3 AI agent → M4 multi-facility.

## 3. Approaches evaluated

| Option | Nội dung | Verdict |
|---|---|---|
| Nấc 1 — Chỉ chặn gán | UI + API reject role gác; registry/enum giữ 9 | Bị loại — registry vẫn mô tả quyền dormant cho vai trò không tồn tại (ke_toan có quyền duyệt tiền) |
| **Nấc 2 — Chặn gán + sạch registry** | Nấc 1 + xóa 5 role gác khỏi mọi mảng quyền `@cmc/auth` | ✅ **CHỌN** — hệ thống sống (quyền+UI+gán) = đúng 5 role thật; enum DB giữ giá trị trơ vô hại |
| Nấc 3 — Xóa tận gốc enum DB | Enum type mới + rewrite cột | ❌ Loại — migration rủi ro trước UAT/go-live, hành vi không khác Nấc 2 |
| B — Không sửa | Docs đúng, rủi ro chỉ khi IT gán nhầm | Bị loại — UAT/audit sẽ hỏi lại, để lỗ dormant |
| Đổi URL /hr → /ops | Cosmetic rename | Bị loại (PO chốt giữ nguyên) — churn trước go-live không đáng |

## 4. Final solution (đã duyệt — Nấc 2)

1. `packages/auth`: thu registry về **đúng 5 role thật** — xóa `ke_toan`/`cskh`/`ctv_mkt`/`hr`
   khỏi mọi mảng permission; export `ASSIGNABLE_ROLES` (5 active) làm SSOT cho UI+API.
2. `apps/api/src/user/router.ts` (`user.updateRoles`): reject role ∉ ASSIGNABLE_ROLES
   (business rule, áp dụng cả super_admin).
3. `apps/admin/src/pages/admin/users.tsx`: ROLE_OPTIONS chỉ 5 role active (bỏ hẳn 4 role gác
   khỏi UI — không hiển thị vai trò không tồn tại).
4. Enum DB `Role` giữ nguyên 9 giá trị (giá trị trơ, không migration) — ghi rõ trong ADR.
5. Tests: API reject ke_toan; UI options; **cập nhật drift-test** theo mô hình mới (enum ⊇
   registry roles thay vì bằng nhau); rà test nào đang dùng role gác làm fixture.
6. Docs: **amendment ADR-D** trong TL16 (từ "giữ quyền trong registry" → "registry chỉ 5 role
   thật; enum giữ giá trị trơ; bật lại role = thêm quyền + UI mới, có ADR"); TL14 cập nhật danh
   sách + ma trận; `docs/project-changelog.md`.

**Acceptance**: registry `@cmc/auth` không còn tham chiếu role gác; gán role gác bị chặn UI+API;
5 role active hoạt động y nguyên (không đổi hành vi cho ai); typecheck/test/build xanh.
**Out of scope**: xóa giá trị enum DB, đổi URL /hr, mọi hạng mục M0 khác.

## 5. Risks & considerations

- Guard áp cả super_admin — ghi rõ trong code comment để tránh "fix" nhầm thành bypass.
- Xóa role gác khỏi registry chạm nhiều mảng quyền → bắt buộc TDD/khoá hành vi 5 role active
  trước khi sửa (matrix TL14 §5 làm baseline).
- `checkIn.punch`/`manualPunch.create` đang liệt kê cả 9 role — thu về 5, không đổi hành vi thực.
- Verify không user nào đang mang role gác trước khi land (thực tế: chưa ai).
- Nếu tương lai cần role mới: thêm quyền + UI + ADR mới — enum đã có sẵn giá trị.

## 6. Hướng đi tổng thể tới vận hành (đã xác nhận với roadmap)

Việc làm sạch role (Nấc 2) là task chèn **trước Phase 4 UAT** của M0 (~1 ngày kèm test). Trục chính không đổi:
M0 Phase 2 (env cmcv2-prod) → mini-task role → Phase 4 (UAT + biên bản GO) → M1 (pilot 2 tuần
+ VPS thật + restore drill R2) → M2 (đóng P4: lịch test, after-sale case, họp PH) → M3 (AI agent
HOTL) → M4 (multi-facility). Phụ thuộc ngoài repo còn mở: VPS thật (M1), danh sách cơ sở (M4).

## 7. Next steps

- [ ] `/ck:plan` cho mini-task role-assignment guard (input: report này)
- [ ] Tiếp tục M0 Phase 2 env-prod theo plan hiện hành

## Unresolved questions

- Không còn — PO đã chốt A + giữ URL /hr.
