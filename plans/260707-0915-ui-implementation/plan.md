---
title: "CMC EDU — Xây dựng UI (ERP admin + LMS)"
description: "Dựng UI thật trên 27 tRPC router: shell ERP + @cmc/ui + 30 route theo TL6, LMS mobile, đồng bộ backend deltas."
status: completed with residual EmptyStates (flipped 2026-07-12 — remaining 6 open items are dev-env/YAGNI/human-verify, no code work)
priority: P1
effort: ~30-40 ngày (9 phase — phase-01 tách 01a/01b sau red-team)
branch: main
tags: [ui, frontend, erp, lms, trpc, mantine, design-system]
blockedBy: [] # UNBLOCKED 2026-07-10: astryx-ui-migration DONE (PR #28 merged main, cả 6 AC đạt). UI work còn lại của plan này build TRÊN ASTRYX (@cmc/ui single-door barrel), KHÔNG build thêm trên Mantine — mọi màn import từ @cmc/ui, tuân ESLint no-restricted-imports
created: 2026-07-07
completed: 2026-07-12
residual: "3 EmptyState màn (họp PH / after-sale / hoàn tiền) rolled into 260711-1752-hr-kpi-shift-attendance-remediation phase-05. 4 checkboxes 'test suite BLOCKED PG' + 'phase-04 tablet verify' là dev-env / human-manual, không phải code gap."
---

# CMC EDU — Kế hoạch xây dựng UI

Backend đã xong (27 router, 48 model, CI xanh). `apps/admin` là shell rỗng (4 file, không tRPC, không page); `packages/ui` chỉ có token CSS, 0 component; Mantine chưa cài; LMS chưa có. Kế hoạch này dựng UI thật: mọi dữ liệu mẫu trong wireframe thay bằng tRPC data + ngữ nghĩa domain thật. Wireframe (`CMC EDU Prototype.dc.html`) chỉ tham khảo layout/style/tương tác — KHÔNG tái dùng markup, KHÔNG tái dùng mã giả (HS-0182 / SO00183 chỉ là style, không phải schema).

## Nguyên tắc ràng buộc
- **Routing** theo `docs/06`: path-based `/{area}/{resource}/{id}/{tab}`, view-state ở query param, tab = sub-route, mã nghiệp vụ trong URL khi có.
- **Design system** theo `docs/12`: 10 component `@cmc/ui`, mỗi component đủ 8 trạng thái; semantics màu (brand=tương tác, green=thành công, amber=chờ, red=lỗi thật, grey=nháp).
- **Bất biến backend**: RLS `withFacility`, `can()` registry, zod, timestamptz/ICT, AI draft-only + che PII + consent ảnh trẻ.
- **Protocol thực thi** (theo master-execution-roadmap): branch `feat/<phase>`/phase, harness intake+story, build qua fullstack-developer, review gate theo rủi ro (adversarial cho màn tiền/dữ-liệu-trẻ, reviewer 1 vòng còn lại), cổng xanh typecheck/test/build, PR merge, changelog.

## Phase table

| Phase | Nội dung | Review gate | Phụ thuộc | Trạng thái | File |
|---|---|---|---|---|---|
| 01a | Backend deltas (non-auth): mã SO00183 + ReceiptDto.canApprove + expose ngưỡng + session.me + teacher-annotation writer | reviewer + spot adversarial | — | done (unit tests pass; integration tests BLOCKED: DB stopped) | [phase-01a](phase-01a-nonauth-backend-deltas.md) |
| 01b | Auth 2 tầng LMS: parent email-OTP + student password + **tách danh tính parent/student (LmsSubject.kind)** + reset + forced-change + rate-limit | adversarial (auth+trẻ) | — | done (8 unit tests pass; integration tests BLOCKED: needs DB; email-OTP BLOCKED-ON-COMMS) | [phase-01b](phase-01b-lms-auth-two-tier.md) |
| 02 | Nền UI: Mantine v7 + theme, tRPC/RQ client, route tree per-module + nav registry, `@cmc/ui` 10 component, ERP shell, login, template List + Record Detail | reviewer 1 vòng | 01a | done (typecheck pass; real finance list tRPC fetch working) | [phase-02](phase-02-ui-foundation.md) |
| 03 | Màn Kinh doanh: phiếu thu create(email PH)→approve+ResultPanel, canApprove gate, over-threshold role-elevation, CRM kanban | adversarial (tiền) | 01a, 02 | done (typecheck pass; canApprove gate + over-threshold from session.me verified) | [phase-03](phase-03-sales-screens.md) |
| 04 | Màn Giảng dạy: Lịch dạy 3 view, Điểm danh tablet, Chấm bài+PDF (teacher-annotation), Cockpit | adversarial (dữ-liệu-trẻ) | 01a, 02 | done (typecheck pass; GET PDF + student.getManyByIds + /cockpit route fixed post-phase) | [phase-04](phase-04-teaching-screens.md) |
| 05 | Màn Điều hành/HR: Chấm công IP, Đăng ký ca, Doanh thu, Đối soát HOTL, Lương/KPI | reviewer 1 vòng | 02 | done (typecheck pass; penalties as separate deduction row per QĐ0025) | [phase-05](phase-05-ops-hr-screens.md) |
| 06 | Phủ route generic + Quản trị (~18 route trên template List/Detail) + backfill email PH | reviewer 1 vòng | 02 | done (updateEmail UI gap fixed 2026-07-07; parentAccount.updateEmail modal added to parents page) | [phase-06](phase-06-generic-admin-coverage.md) |
| 07 | App LMS mới (`apps/lms`): parent email-OTP, student phone/pw + kind gate, view parent+student, PDF annotate, sao, quà | adversarial (dữ-liệu-trẻ) | 01b, 02 | done (typecheck pass; H1/H2/M1/M4 code-review fixes applied; DevHeaderWriter env-gated) | [phase-07](phase-07-lms-app.md) |
| 08 | Đồng bộ docs/harness (QĐ0033/WF-P1-07 đảo) + e2e UI (test-seam OTP) + changelog | reviewer 1 vòng | 03-07 | done (9 docs updated; 4 e2e spec files; test-seam OTP gated non-prod; changelog per phase) | [phase-08](phase-08-docs-e2e-sync.md) |

## Sắp thứ tự
(01a, 01b song song) → 02 (chặn bởi 01a) → (03, 04, 05, 06 song song theo route-config per-module + nav registry khai báo trước ở 02) · 07 sau 01b+02 · 08 cuối.
Phase 02 là cổng chặn mọi màn ERP. 01a chặn 02/03/04 (session.me, canApprove, teacher-annotation). 01b chặn 07 (auth 2 tầng).

## Design-language foundation (reconcile 2026-07-10)

**Phụ thuộc mới:** nền design-language premium đã promote vào `@cmc/ui` bởi plan
[`260710-1730-premium-design-language-buildout`](../260710-1730-premium-design-language-buildout/plan.md)
(Phase 1-4 DONE, branch `feat/premium-design-language`). Mọi UI của plan này build/re-work TRÊN nền đó,
KHÔNG tự chế lại style.

**Trạng thái screens (verify 2026-07-10, resolve open Q3):** 8 phase đánh `done` — các màn là **trang
thật đã dựng** (tRPC-backed, dùng atom `@cmc/ui`: DataTable/PageHeader/StatusBadge/FilterBar/MasterDetail),
KHÔNG phải placeholder (chỉ `pages/coming-soon.tsx` là placeholder; ComingSoon thấy khi tour là do
routing/permission-gate ở vài path, không phải trang chưa dựng — cần verify wiring nav riêng). Vì là màn
thật (phẳng, pre-premium) → **reconciliation = một đợt MIGRATION design-language follow-up** (thật, ~30 màn):
đổi markup bespoke sang template/composite premium đã promote.

**Cách áp nền premium cho các màn (phase 03-07):**
- List → `ListPage`; Detail → `DetailPage`; Form/create → `FormPage` (P4). Metric/dashboard → `MetricCard`/
  `Panel`/`TaskRow`/`FunnelBar` (P2). Khung app → `AppFrame`/`SideNav` (P3, admin đã có sẵn).
- Các màn đã tự động thừa hưởng **AppFrame + warm canvas + Inter + line icons** qua shell; phần còn lại là
  swap thân trang sang template (đã làm mẫu: `finance/receipt-list` → ListPage, `receipt-detail` → DetailPage).
- **Non-negotiable:** light mode, monochrome line icon (no emoji/màu), restraint + whitespace + surface
  contrast, near-black numerals, 1 accent — tuân bất biến đã LOCK (xem brainstorm report + memory
  `cmc-premium-design-language`).

**LMS (resolve open Q2):** dùng CHUNG base tokens/icons/composites `@cmc/ui`; **KHÔNG** dùng `AppFrame`
desktop của admin. Khung mobile LMS = **biến thể warm riêng**, dựng ở phase-07 của plan này (follow-up).

**Ước lượng migration:** chưa chốt (đợt follow-up sau khi user duyệt) — không mở rộng scope plan này ngầm;
các phase 03-07 giữ `done` cho phần chức năng, thêm một đợt "design-language pass" riêng khi ưu tiên.

## Validation Summary
Validated 2026-07-07 (red-team 16 findings + plan-validate, 8 câu hỏi qua 2 vòng — tất cả có evidence code). Toàn bộ finding đã áp vào plan.

**Confirmed Decisions:**
1. **Mã SO** = `SO00183` (prefix SO, KHÔNG gạch, pad-5, tăng dần; giữ PT- cũ). Một nguồn, không mâu thuẫn pad-6. (M1)
2. **Auth PH = 2 TẦNG VỚI EMAIL** — đảo ngược có chủ đích docs QĐ0033/WF-P1-07 (phone-OTP): Parent = email+OTP-qua-email; Student = SĐT PH + password (default `Cmc2026@`). Email delivery **BLOCKED-ON-COMMS** (transport stub) → chỉ verify dev/e2e tới khi có creds Brevo/Graph. (C1, C2)
3. **Tách danh tính trẻ** (C5, Critical): `passwordHash` đặt trên **StudentAccount** (KHÔNG ParentAccount) + thêm `LmsSubject.kind:'parent'|'student'` — cả hai bắt buộc trong 01b. Đảo quyết định vòng trước (reuse ParentAccount.passwordHash). Lý do: student session mượn danh tính parent = defect authz trẻ (setPhotoConsent/sibling access) NGAY LẬP TỨC.
4. **Student login security** (C4, không defer): buộc đổi mật khẩu lần đầu + sau staff reset + cooldown/lockout mirror OTP + audit.
5. **Over-threshold = role-elevation 1 người** (H1, KHÔNG phải 2 chữ ký/co-approval): GĐĐT/super_admin duyệt một mình phiếu >20tr; UI ẩn nút cho role thường; ngưỡng expose qua session.me.
6. **Teacher-annotation writer** (C3): thêm ở 01a — `saveDraft` là student-only, GV cần writer riêng.
7. **ReceiptDto.canApprove** (H2), **ResultPanel nguồn = receipt approve.provisioning** (H3), **session.me = client-mirror dưới dev-header** (M5).
8. **AI nhận xét** = MVP xem+sửa+confirm (phase-06); **Ghi danh** = chỉ ERP staff.

**Action Items (đã áp):** phase-01 tách 01a/01b · C1-C5/H1-H3 áp vào 01a/01b/03/04 · M1 (SO pad-5 một chỗ, xoá câu-hỏi-mở) · M2 (route per-module + nav registry ở 02) · M3 (test-seam OTP e2e ở 08) · M4 (create-from-opp.test.ts vào files sửa) · M5 (framing session.me) · L1 (path apps/e2e/) · L2 (saveDraft) · L3 (note pad tràn không bug).
