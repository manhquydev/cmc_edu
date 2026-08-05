# Brainstorm Contract — Design3 (Odoo UI) Rollout toàn Admin ERP

Date: 2026-08-05 · Branch: feat/ui-copy-standard · Status: ACCEPTED (user confirmed 4 decisions)

## Outcome

Toàn bộ `apps/admin` (ERP nội bộ) dùng một design system duy nhất: design3 (Odoo
backend UI language) — shell, tokens, và view patterns — thay thế premium layer
Apple-minimal hiện tại trong phạm vi admin. LMS giữ ngôn ngữ hiện có, chỉ dùng
chung tokens nền.

## Decisions (user-confirmed, không tự đảo)

1. **Phạm vi:** Chỉ `apps/admin`. TL12 (`docs/12-design-system-ui.md`) được
   supersede **cho phạm vi admin**; LMS (student/parent) không đổi ngôn ngữ.
2. **Shell:** Thay hẳn AppFrame + SideNav bằng Odoo shell (navbar 46px purple +
   app-switcher). Không dual-chrome. `nav-registry.ts` map sang app-switcher.
3. **Pilot:** CRM migrate nội dung trang đầu tiên (dùng đủ list + kanban +
   statusbar).
4. **Nhịp:** Mỗi module 1 PR, ui-e2e xanh mới sang module kế. Không big-bang.

Giữ nguyên các deviation đã khóa của design3: accent xanh `#0071E3`, Inter,
light-only (per candidate doc).

## Constraints

- CI gates non-bypassable: `typecheck-and-test` + `ui-e2e` (40/40) required trên
  `main`; mọi bước đi qua branch + PR.
- Solo operator; mỗi PR phải bisect được.
- E2E dùng role/text selectors (560 chỗ, 0 testid); điều hướng qua helper tập
  trung `apps/e2e/src/journey/menu-nav.ts` + 5 journeys chạm side-nav trực tiếp
  (checkin-punch, grading-submission, gift-config-nav, checkin-offsite-approval,
  payroll-roster). PR thay shell PHẢI sửa các file này cùng lúc.
- CSS design3 hiện page-scoped (`.odoo-lab-*` trong
  `apps/admin/src/pages/design-lab-3.css`) — phải extract thành lớp trong
  `@cmc/ui` trước khi phủ; giữ LGPL-3 attribution header.
- Token set additive với tokens hiện có (đã verify trong candidate doc) — LMS
  không bị ảnh hưởng khi lớp odoo scope đúng.

## Non-goals

- LMS re-skin (ngoài tokens nền dùng chung).
- Responsive behaviors chưa build của Odoo (pivot indent, calendar grid-shell,
  dropdown↔bottom-sheet) — chỉ build khi một surface thật cần.
- Dark mode, backend/API changes, đổi nghiệp vụ hay routing semantics (TL6).

## Acceptance criteria

1. Mọi route admin (trừ trang login nếu plan quyết giữ) render Odoo shell +
   tokens; không trang admin nào còn import premium layer/AppFrame/SideNav.
2. Component design3 sống trong `@cmc/ui` (lớp odoo), không còn page-scoped
   CSS lab làm nguồn chuẩn; các trang design-lab-* được dọn hoặc trỏ về lớp mới.
3. `ui-e2e` 40/40 xanh sau mỗi PR module; `typecheck-and-test` xanh.
4. Docs: TL12 cập nhật trạng thái supersede-for-admin; candidate doc nâng thành
   chuẩn hiện hành; `docs/system-architecture.md` cập nhật nếu shell đổi.
5. `pnpm acceptance:report` không tụt so với baseline trước rollout.

## Chosen approach (option 2 of 3 — foundation-first, per-module)

Phase 0: chốt docs (supersede TL12 phạm vi admin, promote candidate doc).
Phase 1: extract tokens + components từ design-lab-3 vào `@cmc/ui` lớp odoo
(tokens, navbar/app-switcher, control panel, dense list, kanban, statusbar).
Phase 2: thay shell toàn admin (1 PR, kèm sửa menu-nav helper + 5 journeys).
Phase 3: pilot CRM (1 PR).
Phase 4+: từng module còn lại (finance, hr, teaching, students, enrollment,
attendance, classes, courses, engagement, parents, admin) mỗi module 1 PR.
Phase cuối: gỡ premium layer khỏi admin, dọn design-lab pages, docs final.

Rejected: big-bang (vỡ e2e hàng loạt, không bisect được); strangler vô thời hạn
(trái yêu cầu "phủ đồng bộ", rủi ro hai hệ song song kéo dài).

## Evidence base

- `docs/design-system-odoo-candidate.md` (readiness assessment, cost 9–16 tuần)
- `plans/260805-1421-design-lab-3-odoo-ui-recreation/plan.md` (decision log)
- `plans/reports/fidelity-audit-260805-1544-design3-vs-real-odoo.md`
- 4 research reports `*-260805-160*` (tokens, layout/IA, visual language, wireframes)
- Scout session này: 64 tsx pages admin (~50 thật), 16 LMS, e2e selector survey.

## Unresolved (để plan quyết, không chặn)

- Trang login admin có nhận Odoo shell/tokens hay giữ nguyên.
- Thứ tự chính xác các module sau CRM (đề xuất: theo mức dùng list/kanban).
- Số phận 14 file design-lab-* cũ (xóa hẳn hay giữ design-lab-3 làm showcase).

## Handoff

Next: `/ak:plan` tạo plan `plans/<ts>-design3-admin-rollout/` từ contract này.
