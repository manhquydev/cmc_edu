---
title: "Design3 Admin Rollout"
description: "Phủ design system design3 (Odoo backend UI language) toàn apps/admin: extract vào @cmc/ui + restyle component sẵn có, thay shell, re-skin template trung tâm, migrate từng module. LMS giữ nguyên."
status: completed
priority: P1
effort: "11-16w"
tags: [design-system, odoo, admin, ui]
created: 2026-08-05
note: "completed 2026-08-07 — PR #75 merged + Phase 4 visual smoke (8P/2W/0F residuals: empty CRM detail + cancelled receipt fixtures); rebrand plan 260807-1453"
blockedBy: [260807-1453-cmc-console-design-system-rebrand-hardening]
---

## Closure (CMC Console rebrand — 2026-08-07)

**Status → `completed`.** Both line-9 blockers closed:

1. **PR merge:** GitHub PR #75 (`develop` → `main`) **MERGED** 2026-08-07
   (merge commit on main used as rebrand base).
2. **Human visual smoke:** agent-driven Phase 4 report  
   `plans/260807-1453-cmc-console-design-system-rebrand-hardening/reports/visual-smoke-2026-08-07.md`  
   (real staff-login, synth DB, admin preview) — **8 PASS / 2 WARN / 0 FAIL**.

**Residuals (not blockers for this plan's smoke gate, but not full product UAT):**
- Opportunity detail statusbar not opened (empty detail path on seed)
- Cancelled receipt statusbar not rendered (no finance rows on seed)

Further rebrand/hardening lived in plan
`plans/260807-1453-cmc-console-design-system-rebrand-hardening/` (CMC Console naming).


# Design3 Admin Rollout

## Overview

Thực thi contract [brainstorm-260805-1906-design3-rollout-contract.md](../reports/brainstorm-260805-1906-design3-rollout-contract.md):
toàn bộ `apps/admin` chuyển sang design3 (ngôn ngữ Odoo backend UI đã verify tại
`/design3`), supersede TL12 premium layer trong phạm vi admin. LMS chỉ dùng chung
tokens nền, không đổi ngôn ngữ.

**Đòn bẩy kiến trúc (số đã red-team verify):** LMS chỉ import primitives
(`Button/Badge/Heading/Stack…`), KHÔNG dùng template premium nào. Đo theo
render-site thật: `<ListPage` 23 file, `<DataTable` 22, `<PageHeader` 40,
`<DetailPage` 10, `<FormPage` 6 — hợp lại **~40/55 trang admin thật** thừa hưởng
re-skin template trung tâm (Phase 3). Archetype bổ sung (render-site thật —
round 2 sửa lần đo sai thứ hai): `SettingsShell` 3 trang, `DashboardPage` 2
trang (cockpit + revenue-report), `EntityHeader` 4 trang (đều đã là DetailPage
— restyle cần nhưng KHÔNG cộng coverage), `ControlBar` 0 render-site trực tiếp
(là ruột ListPage — restyle tại chỗ, không tính đòn bẩy). ⇒ Phase 3 phủ thật
**~45/55 trang**; bespoke còn lại theo phase chủ quản: 7 CRM dialogs → Phase 4,
3 teaching panels → sweep teaching, login/coming-soon → giữ nguyên.

**Component Odoo-analogue ĐÃ TỒN TẠI (không xây trùng):** plan
`260803-2043-odoo-ux-grammar-full-adoption` (completed) đã ship `ControlBar`
("Odoo ControlPanel analogue", `ListPage` compose sẵn bên trong) và
`WorkflowStatusbar`/`ProgressSteps` ("Odoo statusbar analogue", đang chạy tại
`crm/opportunity-detail.tsx:358`, `finance/receipt-detail.tsx:478`). Plan này
**restyle tại chỗ** các component đó sang hình thái Odoo thật (chevron
clip-path, dense control panel) — chỉ tạo mới cái chưa có: `OdooNavbar`
(app-switcher) và `KanbanBoard`.

## User-confirmed decisions (không tự đảo)

Từ contract (2026-08-05): (1) chỉ `apps/admin`, TL12 supersede-for-admin, LMS
giữ nguyên; (2) thay hẳn shell bằng Odoo navbar + app-switcher; (3) pilot CRM;
(4) mỗi module 1 PR. Deviations khóa: accent `#0071E3`, Inter, light-only.

Từ phiên red-team round 1 (2026-08-05):
5. **Pilot CRM xây đủ list↔kanban switcher** — gồm list view DataTable MỚI cho
   opportunities (feature work có chủ đích, đảo non-goal "no KanbanBoard" của
   plan 260803-2043 với phê duyệt của user).
6. **1 module = 1 PR đúng nghĩa** — Phase 5 tách ~12 PR, không gộp.
7. **premium.css: port đủ rồi mới gỡ** — giữ Goal 4; Phase 6 làm census từng
   class `ck-/tpl-/sh-`, port hết sang `odoo.css` rồi mới bỏ import (2-3w).
8. **`/design3` DEV-only gate** ngay đầu Phase 1 + ràng buộc fixture-data-only.

Từ phiên validate session 1 (2026-08-05):
9. **`/design3` XOÁ HẲN ở Phase 6** — điều kiện: `docs/design-system-odoo.md`
   phải lưu đủ thiết kế để tái triển khai (tokens, spec component, patterns);
   route chỉ sống DEV-only làm parity harness từ Phase 1 tới Phase 6.
10. **`change-password` ĐƯA VÀO Odoo shell** (khác login — login vẫn ngoài).
    **10b (round 2, 2026-08-05):** vào shell ở **chế độ ẩn chrome** — khi
    `me.mustChangePassword` true, shell render KHÔNG navbar/app-switcher/⌘K
    (forced rotation không có lối né; enforcement server cho staff hiện không
    tồn tại — `assertPasswordNotExpired` student-only, 0 caller staff).
11. **Timeline 11-16 tuần: chấp nhận.**
12. **Checkpoint sau Phase 3: đi tiếp tự động** — là bước duyệt trong dòng
    chảy (duyệt mắt + hiệu chỉnh scope), không dừng chờ phê duyệt lại.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Lớp odoo trong `@cmc/ui`: tokens + OdooNavbar + KanbanBoard mới, ControlBar/Statusbar restyle tại chỗ, có test | P1 |
| 2 | Toàn bộ route admin (sau login) render Odoo shell; shell cũ gỡ khỏi `apps/admin/src/shell` | P1 |
| 3 | Mọi trang admin dùng ngôn ngữ Odoo (template + archetype + pattern module) | P1 |
| 4 | premium.css port đủ → gỡ import khỏi admin; docs cập nhật (TL12 supersede-for-admin) | P2 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Odoo UI Layer in @cmc/ui](./phase-01-odoo-ui-layer.md) | Completed |
| 2 | [Phase 2: Admin Shell Swap](./phase-02-admin-shell-swap.md) | Unit complete; **ui-e2e green** on develop PR #75 (`fdc2c93`, 2026-08-07) |
| 3 | [Phase 3: Central View Template Reskin](./phase-03-central-view-template-reskin.md) | Unit complete; **ui-e2e green** (same); visual smoke still open |
| 4 | [Phase 4: Pilot CRM Migration](./phase-04-pilot-crm-migration.md) | Unit complete; **ui-e2e green** (same) |
| 5 | [Phase 5: Module Sweeps](./phase-05-module-sweeps.md) | Unit complete + FilterBar/search wave (2026-08-07); see reports/phase-05-module-sweep-status.md + `plans/reports/ship-20260807-filterbar-search.md` |
| 6 | [Phase 6: Cleanup, Premium Retirement, Docs](./phase-06-cleanup-premium-retirement-docs.md) | Unit complete; docs updated; **ui-e2e green**; **acceptance re-measure done** 2026-08-07 (`eaa223a` CI artifact); human visual smoke still open |

Dependencies: tuyến tính 1→2→3→4→5→6. Mỗi phase ≥1 PR riêng, CI
(`typecheck-and-test` + `ui-e2e`) xanh là gate chuyển phase. Sau Phase 3 có
**checkpoint hiệu chỉnh trong dòng chảy** (decision 12): duyệt mắt toàn bộ,
chốt lại thứ tự/scope Phase 4-6 theo thực tế, rồi đi tiếp — không dừng chờ
phê duyệt.

## Cross-plan coordination

- **Geofence: điều kiện ĐÃ THOẢ** (round-2 verified): merged vào `main`
  2026-08-05 tại `f7bf662` (PR #64); spec `checkin-geofence.journey.ui.spec.ts`
  từng dự kiến đã bị chủ đích bỏ (`83b59b0` — flaky, giữ unit-tested gate);
  `admin/network-ip.tsx` đã mang code geofence. Phần dở của geofence plan chỉ
  là CI-proof (plan doc ghi Phase 4 "Partial" = chưa chứng minh ui-e2e, KHÔNG
  phải code chưa xong — doc đó stale). Phase 2 chỉ cần verify lại bằng
  `git log main --grep=geofence` lúc cook, không chờ gì thêm.
- `plans/260804-0039-business-logic-verification-process/`: process-level,
  không đụng file UI — không phụ thuộc.

## CI gates phải xử lý chủ động (không được để bể rồi mới biết)

- `scripts/check-ui-frames.mjs` + `check-ui-frames.test.mjs` chạy BLOCKING trong
  `typecheck-and-test` (`.github/workflows/ci.yml:110-111`). **Cơ chế thật
  (round-2 corrected): text-match TÊN COMPONENT trong source trang**
  (`src.includes('FilterBar')`…), không phải class/marker. Asserts:
  `opportunity-detail`/`receipt-detail` full-tier (chứa `WorkflowStatusbar`),
  `shift-config` settings-tier, `filterBarCount>=5` (hiện 6 — margin đúng 1!),
  `listPaginationCount>=8`, `bulkCount>=5`, `dualTitleReview==0`.
  **Quyết định chốt trước (tránh đỏ giữa Phase 5): `FilterBar` GIỮ LẠI làm
  implementation của search/filter trong control panel Odoo (restyle, không
  thay tên)** — identifier sống trong source ⇒ counts không tụt. Nếu phase nào
  buộc đổi tên component được gate assert → cập nhật gate TRONG CÙNG PR
  (không retire, không nới ngưỡng).
- `apps/e2e/screen-role-matrix.json` sinh bởi `apps/e2e/src/scan-nav-entries.ts`
  (ts-morph parse `nav-registry.ts`): Phase 2 đổi nav-registry thì regenerate +
  commit matrix trong cùng PR.

## Success Criteria

- [x] Mọi route sau login (gồm `change-password` — decision 10; trừ `/login`)
      render Odoo shell. Gate: no production `AppFrame`/`SideNav` in
      `apps/admin/src/shell` (only test negative asserts); design-lab pages
      deleted; authority `docs/design-system-odoo.md`.
- [x] Lớp odoo trong `packages/ui/src/odoo*`; lab routes deleted; docs hold
      re-implementation authority (decision 9).
- [x] E2E: required checks green on develop PR #75 (`eaa223a`, 2026-08-07) —
      `typecheck-and-test` + full `ui-e2e` (FilterBar journeys ADM-04 / P1-06
      fixed). Re-check after any main merge if main diverges.
- [x] `pnpm acceptance:report` re-measure @ `eaa223a` with CI
      `acceptance-journeys-*` artifact (`gitDirty:false`): **31/38 proven**,
      7 `no-ui-path` (method ceiling), baseline 38 flow ids unchanged. Report:
      `plans/reports/cook-260807-0902-design3-validation-acceptance.md`.
      Tool exit 1 from **pre-existing** 6 untriaged orphans (not FilterBar
      regression) — triage separate.
- [x] Docs: TL12 supersede-for-admin + `docs/design-system-odoo.md` authority;
      system-architecture + codebase-summary + changelog banners updated
      2026-08-07 (FilterBar/search + CI + acceptance re-measure).
- [ ] Human visual smoke after premium drop (toast, ⌘K, CRM list/kanban,
      teaching calendar) — manual only.

## Evidence & References

- Contract: [brainstorm-260805-1906-design3-rollout-contract.md](../reports/brainstorm-260805-1906-design3-rollout-contract.md)
- Design authority (post-promote): [docs/design-system-odoo.md](../../docs/design-system-odoo.md)
- Implementation source: `packages/ui/src/odoo.css`, `packages/ui/src/odoo/*`, `apps/admin/src/shell/shell.tsx`
  (lab `/design3` + `design-system-odoo-candidate.md` deleted after promote — git history only)
- Component restyled at place: `packages/ui/src/components/control-bar.tsx`, `workflow-statusbar.tsx`, `progress-steps.tsx` (plan 260803-2043)
- E2E coupling (post shell swap): 30 specs import `menuNav` (app-switcher rewrite);
  binders retarget `main.o-main`; `admin-shell.ui.spec.ts` pins Odoo chrome;
  helper: `apps/e2e/src/journey/menu-nav.ts`. **Runtime green on CI:** PR #75
  `fdc2c93` (2026-08-07) — ship `plans/reports/ship-20260807-filterbar-search.md`.

## Red Team Review

### Session — 2026-08-05 (round 1)
**Findings:** 36 thô → 15 nhóm sau dedupe (15 accepted — 4 trong đó cần & đã có
quyết định user, 0 rejected; mọi finding đều có bằng chứng file:line)
**Severity:** 6 Critical, 6 High, 3 Medium

| # | Finding (nhóm) | Severity | Disposition | Applied To |
|---|---------------|----------|-------------|-----------|
| 1 | E2E blast radius sai (30 menuNav + 7 direct binders + admin-shell spec; navigate-vs-expand; cockpit không children) | Critical | Accept | Phase 2, plan.md |
| 2 | `assertEntryAbsent` thành test ma dưới app-switcher | Critical | Accept | Phase 2 |
| 3 | Gate `check-ui-frames` blocking chưa được plan biết tới | Critical | Accept | plan.md, Phase 3/4/5 |
| 4 | Xây trùng ControlBar/WorkflowStatusbar đã có | Critical | Accept | Phase 1/3/4 |
| 5 | Audit premium.css grep sai; 2.274 dòng nuôi ~34 component | Critical | Accept (user: port-then-remove) | Phase 3/6 |
| 6 | Đòn bẩy 58 trang thực đo ~40/55; thiếu archetype EntityHeader/SettingsShell/ControlBar/DashboardPage | Critical | Accept | plan.md, Phase 3 |
| 7 | OdooNavbar thiếu gate permission per-child (SideNav fail-open) | High | Accept | Phase 1/2 |
| 8 | Phase 2 inventory sai (RequireAuth ở routes/index.tsx; CommandPalette; me?-guard) | High | Accept | Phase 2 |
| 9 | `/design3` public không auth trong prod build | High | Accept (user: DEV-gate) | Phase 1 |
| 10 | Geofence va ở Phase 2 + admin sweep, không phải 5g | High | Accept | plan.md, Phase 5 |
| 11 | Rollback claims giả (odoo.css dùng chung nhiều phase) | High | Accept (forward-fix) | Phase 3-6 |
| 12 | Astryx StyleX: DataTable không có class hook; primitives không thừa hưởng cascade | High | Accept | Phase 1/3 |
| 13 | Phase 4 tả sai CRM (board+statusbar đã có; list view chưa có) | High* | Accept (user: xây đủ switcher) | Phase 4 |
| 14 | Phase 5 gộp PR trái quyết định user | High* | Accept (user: 1 module 1 PR) | Phase 5 |
| 15 | Nhóm nhỏ: RoleSwitcher PROD guard; LMS gate; inventory design-lab 18 file/3 route; 40/40 literal; matrix regen; import order odoo.css; keep-green test list ngược; docs dời về Phase 1 | Medium | Accept | Phase 1/2/3/5/6 |

(*severity gốc Critical ở một reviewer, hạ High sau khi user chốt hướng.)

### Whole-Plan Consistency Sweep (round 1)
- Files reread: plan.md, phase-01…phase-06 (sau khi rewrite toàn bộ)
- Decision deltas checked: 8 (4 quyết định user mới + 4 sửa sự thật lớn)
- Reconciled stale references: leverage numbers, e2e inventory, component list,
  gate grep scope, effort (9-14w → 11-16w), geofence ordering, docs timing
- Unresolved contradictions: 0

### Session — 2026-08-05 (round 2, 1 reviewer fact-check các claim mới)
**Findings:** 8 (8 accepted — 1 cần & đã có quyết định user bổ sung 10b)
**Severity:** 2 Critical, 3 High, 3 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|-----------|
| R2-1 | Số archetype lại đo any-mention (thật: SettingsShell 3, DashboardPage 2, EntityHeader 4-không-cộng-coverage, ControlBar 0) | Critical | Accept | plan.md, Phase 3 |
| R2-2 | change-password: lý do thật ngoài Shell = forced rotation, server không enforce staff | Critical | Accept (user: chrome-suppressed mode, 10b) | plan.md, Phase 2 |
| R2-3 | Geofence ĐÃ merge (`f7bf662`); spec checkin-geofence đã bị bỏ (`83b59b0`); plan doc geofence stale | High | Accept | plan.md, Phase 2/5 |
| R2-4 | Astryx remap phải phủ cả `--font-size-*` lẫn `--text-*-*` + thẻ raw + ruột component; proof = computed-style | High | Accept | Phase 1 |
| R2-5 | check-ui-frames là text-match TÊN component (không phải class); filterBarCount margin=1 → chốt GIỮ FilterBar | High | Accept | plan.md, Phase 3/5 |
| R2-6 | premium.css có rule cross-component + 13 khối @media → census (a/b/c), kéo MetricCard vào Phase 3 | Medium | Accept | Phase 3 |
| R2-7 | "Shared hook" mâu thuẫn sort/page độc lập; onSettled invalidate đã hội tụ → v1 share listInput nguyên trạng | Medium | Accept | Phase 4 |
| R2-8 | PR B xoá 18 file đổi corpus check-ui-frames (design-lab-2/3 đang trong corpus; EXEMPT stale) | Medium | Accept | Phase 6 |

### Whole-Plan Consistency Sweep (round 2)
- Files reread: plan.md + 6 phase files sau khi áp 8 findings + decision 10b
- Decision deltas checked: 9 (8 findings + 10b)
- Reconciled: archetype numbers, geofence ordering block, FilterBar fate,
  Astryx remap spec, cache framing Phase 4, EXEMPT/corpus Phase 6
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-08-05 (4 câu hỏi)
| # | Câu hỏi | Quyết định |
|---|---------|-----------|
| 1 | `/design3` sau rollout | XOÁ ở Phase 6; docs phải lưu đủ thiết kế để tái triển khai (decision 9) |
| 2 | `change-password` | Đưa VÀO Odoo shell (decision 10) — Phase 2 kèm bước verify route này là authenticated flow; nếu hoá ra pre-auth thì báo lại trước khi ép |
| 3 | Timeline 11-16w | Chấp nhận (decision 11) |
| 4 | Checkpoint Phase 3 | Đi tiếp tự động, không dừng chờ duyệt (decision 12) |

### Whole-Plan Consistency Sweep (validate session 1)
- Files reread: plan.md + 6 phase files (grep thuật ngữ cũ sau propagation)
- Decision deltas checked: 4 — propagated vào plan.md, phase-02, phase-06
- Unresolved contradictions: 0

## Open questions

1. CRM list view mới (feature work): cần cột nào? (mặc định: mirror data đang
   hiển thị trên card của pipeline board; chốt khi cook Phase 4)

<!-- slug: design3-admin-rollout -->
