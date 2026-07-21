# Brainstorm Report — Rà soát hoàn thiện dự án, ERP 5 role, harness/docs

**Date:** 2026-07-09 23:33 · **Mode:** assessment · **PO:** manhquy
**Status:** Concluded — không mở scope mới; 2 drift docs sửa ngay (user chốt)

## 1. Câu hỏi đặt ra
(a) Dự án hoàn thiện tới đâu theo module/chức năng — đạt THẬT là đạt gì; (b) ERP nội bộ theo 5 role
thực (sale, GV, GĐĐT, GĐKD, IT); (c) rà harness memory + docs; (d) tái khẳng định định hướng
role-thực-tế, chống phình role sách giáo khoa.

## 2. Trạng thái hoàn thiện (verify bằng code/test chạy thật)

| Pha (TL31) | Status | Bằng chứng |
|---|---|---|
| P0 Nền | ✅ | RLS force + boot-check · registry `can()` · SSO Entra (302 smoke) · OTP · outbox · backup R2 **drill PASS** |
| P1 Định danh & Ghi danh | ✅ | e2e `enrollment.spec` + `finance-approval.spec` xanh Mode-B; SoD cổng tiền GĐKD |
| P2 Vận hành lớp | ✅ | e2e attendance/grading/exercise xanh; AI draft→GV chốt |
| P3 HR/Ca/Lương | ✅ | check-in IP, manual punch, ca, payroll, KPI — registry+router+UI đủ |
| P4 Quà/Họp PH/After-sale | 🟡 ~80% | module API+UI+quyền đủ; nợ M2: audit họp PH đầy-cuối + test P4 (TL25 ô Test) |
| P5 AI Agent | 🟡 crawl | recon flag + AI draft có; chưa: MCP server, eval TL29§5, HOTL data thật |

Milestone: **M0 ~90%** — còn duy nhất phần người thật (UAT 5 kịch bản + email live + ký GO/NO-GO).
Gates máy verify được đã tick: G1 (e2e 2/2 Mode-B), G5, G6, G8, G9, G10. M1–M4 chưa bắt đầu (đúng just-in-time).

## 3. ERP theo 5 role thực (TL14 + registry, TL25 28/28 luồng không mồ côi)
- **sale** (37 quyền): CRM O1→O5 · phiếu nháp · enrollment · afterSale/meeting/testAppointment · rewards · punch/shift/KPI submit
- **giao_vien** (39): điểm danh · chấm+sao · AI nhận xét chốt · evidence · guardian approve · shift/KPI
- **GĐĐT** (104): lớp+lịch · exercise · mắt-thứ-hai tiền · payslip · KPI approve · miền đào tạo
- **GĐKD** (103): cổng tiền · refund · manualPunch/KPI approve · payslip · gift · gánh cskh/hr cũ
- **super_admin/IT** (20+bypass): facility · phân quyền (chỉ 5 role gán được) · seed HO `<super-admin-email>`

## 4. Định hướng role — tái khẳng định
Enforce bằng code (không chỉ văn bản): 4 role gác = 0 quyền + zod reject + UI lọc + invariant test
(commit `57ee539`). Bật lại = người thật đảm nhiệm + ACTIVE_ROLES + quyền + UI + ADR mới.
Đã khoá vào harness memory: `cmc-role-reality-principle` — mọi phiên sau tự challenge đề xuất thêm role.
⚠️ Watch: UAT checklist có note "ctv_mkt business decision pending trước GO (~12/07)" — chỉ bật nếu
có CTV thật; không bật "để sẵn".

## 5. Harness/memory/docs — kết quả rà
- Memory: +2 entry (`cmc-role-reality-principle`, `cmc-localsim-ops-quirks`); 3 entry cũ còn đúng.
- Drift phát hiện: (1) **TL17 stale** theo TL14 (chưa cập nhật 5-role); (2) **changelog 2026-07-09
  ghi sai tool mã hoá backup** ("age CLI" — thực tế `openssl aes-256-cbc`, nguy hiểm khi DR làm theo).
- Quyết định user: sửa cả 2 ngay trong phiên.

## 6. Còn chưa build (thứ tự roadmap, không mở scope)
1. M0 đóng: UAT người thật + GO (việc của PO)
2. M1: VPS thật + TLS/DNS + pilot ≥2 tuần (cần PO cấp VPS)
3. M2: P4 completion · 4. M3: AI crawl→walk · 5. M4: multi-facility
6. Nợ nhỏ: enum dormant cleanup (sau M1) · escrow passphrase + Azure MFA (PO)

## Unresolved questions
- ctv_mkt: có CTV marketing thật cần quyền riêng không? (quyết trước GO ~12/07)
- Lịch + nhân sự UAT người thật; VPS thật cho M1.
