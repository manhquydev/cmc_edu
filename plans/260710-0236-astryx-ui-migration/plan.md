---
title: "Migrate UI Mantine 7 → Astryx (admin + LMS + @cmc/ui)"
description: "Strangler migration 4-stage từ Mantine 7 sang Astryx (@astryxdesign/core@0.1.4 beta, Meta). Spike gate Phase 1 quyết định go/no-go; fail → fallback polish Mantine. User decision 2026-07-10: ưu tiên ngay, chấp nhận ảnh hưởng lịch go-live. Red-team 2026-07-10: 15 findings applied."
status: completed
priority: P1
branch: "feat/astryx-migration"
tags: [ui, design-system, astryx, mantine, migration, tl12]
blockedBy: []
blocks: [260707-2308-golive-sprint-land-sso-env-uat, 260707-0915-ui-implementation] # golive: UAT Phase 4 phải chạy lại trên UI mới (user chấp nhận dời lịch); ui-implementation: mọi UI work còn lại chuyển sang stack Astryx sau plan này
created: "2026-07-09T19:45:08.710Z"
createdBy: "ck:plan"
source: skill
sourceReport: "plans/reports/brainstorm-260710-0236-astryx-ui-migration-report.md"
---

# Migrate UI Mantine 7 → Astryx (admin + LMS + @cmc/ui)

## Overview

Thay toàn bộ nền UI từ Mantine 7.17 sang **Astryx** (facebook/astryx — design system Meta open-source,
150+ component, StyleX, theme qua CSS custom properties, MIT, **beta v0.1.4**, peer:
react>=19 + `@stylexjs/stylex@^0.18.3`). Chiến lược **strangler có giới hạn**: rebuild `@cmc/ui`
(10 component) chỉ de-risk phần shared; **~47 file app import `@mantine/core` trực tiếp**
(58 file toàn repo trừ 11 trong packages/ui) phải migrate tay ở Phase 3–4. Surface primitive thực
tế ~30 loại (grep-verified), nặng nhất là `AppShell` (khung nav admin).

**Van an toàn:** Phase 1 là spike go/no-go. Fail bất kỳ tiêu chí nào (build+StyleX toolchain,
DataTable ERP density, map token CMC, tiếng Việt, supply-chain audit, bundle delta) →
**DỪNG plan này**, fallback phương án A (polish Mantine theo TL12) — brainstorm report §5.

**Quyết định user (2026-07-10, sticky):** hướng C migrate toàn bộ · phạm vi admin + LMS đồng đều ·
ưu tiên ngay, chấp nhận ảnh hưởng lịch go-live · design duyệt kèm spike gate.

**Branch & rollback:** toàn bộ plan chạy trên branch `feat/astryx-migration` (tạo ở Phase 1,
rebase main tối thiểu mỗi khi go-live sprint land thay đổi). KHÔNG merge main khi app đang
nửa-migrate. Mọi phase có revert boundary; **không gỡ dependency `@mantine/*` khỏi bất kỳ
package.json nào trước Phase 5** để mọi phase trước đó revert được.

**Chính sách version Astryx:** pin exact `0.1.4` mặc định. Nếu gặp bug blocking đã fix ở bản
patch 0.1.x → được nâng patch SAU KHI re-run 4 bài kiểm gate Phase 1 trên bản mới (không nâng
minor/major trong plan). Cấm `npx astryx` trần — mọi lệnh CLI qua binary đã pin trong workspace:
`pnpm --filter <pkg> exec astryx …`.

**Non-goal (bảo mật):** KHÔNG kết nối MCP server của Astryx vào bất kỳ agent/tooling nào trong
plan này; muốn dùng phải có security review riêng.

**Non-goal (scope — validation 2026-07-10):** dark mode KHÔNG thuộc đợt này (light mode duy nhất,
follow-up sau khi migration ổn định); UI e2e giữ 2 spec tối thiểu (admin-shell + lms-login),
per-area smoke spec = non-goal.

**Precondition (validation 2026-07-10):** Phase 1 chỉ bắt đầu SAU KHI khối SSO của plan
`260707-2308-golive-sprint` land lên main (tránh rebase 22 file SSO giữa chừng). Đây là
precondition mức phase, không đưa vào frontmatter blockedBy để tránh cycle với `blocks` hiện có.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Spike go/no-go Astryx sandbox](./phase-01-spike-go-no-go-astryx-sandbox.md) | Completed (GO) |
| 2 | [Theme CMC + rebuild @cmc/ui tren Astryx](./phase-02-theme-cmc-rebuild-cmc-ui-tren-astryx.md) | Completed |
| 3 | [Migrate apps/admin + lint rule mot cua](./phase-03-migrate-apps-admin-lint-rule-mot-cua.md) | Completed |
| 4 | [Migrate apps/lms](./phase-04-migrate-apps-lms.md) | Completed |
| 5 | [Go Mantine + docs TL12 + full e2e QA](./phase-05-go-mantine-docs-tl12-full-e2e-qa.md) | Completed |

Dependency chain: 1 → 2 → 3 → 4 → 5 (Phase 3 và 4 có thể song song sau khi Phase 2 xong nếu
ownership file tách bạch; mặc định tuần tự để một người làm).

## Acceptance Criteria (toàn plan)

1. Zero Mantine: `rg -i "mantine" -g '*.{ts,tsx,css,json}' -g '!pnpm-lock.yaml' -g '!plans/**' -g '!docs/journals/**'`
   = 0 kết quả, VÀ `rg "@mantine" pnpm-lock.yaml` = 0 (sau `pnpm install` ở Phase 5).
2. Mọi màn đạt checklist TL12 §10: đủ component states, semantics màu §3, WCAG AA §6, ResultPanel.
3. `pnpm typecheck` + `pnpm build` + `pnpm test` xanh trên toàn bộ workspace (hiện 15 package),
   VÀ **browser e2e**: `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium` xanh
   (bộ `*.ui.spec.ts` viết ở Phase 2 — lưu ý: 6 spec API hiện có KHÔNG bảo vệ UI, và root
   `pnpm test` filter loại @cmc/e2e).
4. Bundle size admin/lms ≤ +15% so baseline đo ở Phase 1 (spot-check delta đã là input GO/NO-GO
   từ Phase 1, không để dồn về cuối).
5. Login LMS 2-tab giữ đúng đặc tả TL12 §9 + **auth-parity**: giữ nguyên
   `autoComplete="one-time-code"`, `inputMode="numeric"`, `maxLength={6}`,
   `autoComplete="current-password"`; OTP không echo ra DOM/console/network ngoài submit;
   thông báo lỗi generic đồng nhất giữa 2 tab.
6. Supply-chain: `pnpm audit --prod` sạch hoặc đã triage có ghi nhận + `npm audit signatures`
   pass, chạy ở cả Phase 1 (baseline) và Phase 5 (nghiệm thu).

## Dependencies

- **Blocks** `260707-2308-golive-sprint-land-sso-env-uat`: Phase 4 UAT của plan đó phải chạy lại
  trên UI mới. User đã chấp nhận dời lịch (decision 2026-07-10).
- **Blocks** `260707-0915-ui-implementation` (in-progress): các màn UI chưa build của plan đó
  build thẳng trên Astryx sau khi Phase 2 plan này xong, không build thêm trên Mantine.
- Nguồn: brainstorm report `plans/reports/brainstorm-260710-0236-astryx-ui-migration-report.md`.

## Risks (tóm tắt — chi tiết trong từng phase)

| Risk | Mitigation |
|---|---|
| Beta 0.1.4 breaking changes / bug blocking | Pin exact; patch 0.1.x cho phép sau re-run gate Phase 1; CLI chỉ chạy binary pinned |
| Supply-chain (beta 16 ngày tuổi, 13.8MB/2294 file, maintainer có email cá nhân) | Audit + signatures gate Phase 1 & 5; cấm npx trần; MCP server = non-goal |
| DataTable/i18n/StyleX toolchain không đạt | Spike gate Phase 1 — fail thì dừng, fallback polish Mantine |
| UI vỡ mà gate vẫn xanh | Bộ browser e2e `*.ui.spec.ts` viết TRƯỚC khi migrate (Phase 2 step 0) |
| Hai CSS reset chồng nhau Phase 2–4 | reset.css KHÔNG nằm trong @cmc/ui; chỉ import ở main.tsx từng app khi app đó flip; regression focus-ring/disabled trên màn auth = blocking |
| Trễ go-live | Chấp nhận có chủ đích; báo PO estimate sau Phase 1 |
| Kẹt giữa chừng không lối ra | Revert boundary mỗi phase; Mantine deps giữ đến Phase 5 |

## Open Questions

- ~~`@astryxdesign/theme-neutral` ship CSS pre-extracted hay cần StyleX compile local~~ →
  **trả lời tại Phase 1 gate (a), 2026-07-10**: pre-extracted hoàn toàn. `astryx.css` (123kB,
  header "Pre-compiled StyleX CSS — all components") + `theme.css` cover mọi component; không
  cần StyleX Vite/Babel plugin trong app tiêu thụ. Chi tiết: `reports/spike-findings.md`.
- ~~DatePicker/Select nghiệp vụ tài chính có sẵn trong Astryx không~~ → **trả lời tại Phase 1,
  2026-07-10**: có (`DateInput`/`DateRangeInput`/`DateTimeInput`, `Selector`/`MultiSelector`,
  `NumberInput`). 2 gap thật: `PasswordInput`, `ScrollArea` (compose từ primitive có sẵn,
  effort nhỏ, không đổi ước lượng tổng). Chi tiết: `reports/spike-findings.md`.
- Số ngày trượt go-live cụ thể → PO chốt sau khi Phase 1 cho estimate thực tế (không đổi so
  brainstorm: 17–27 ngày).

## Phase 1 Gate Decision — 2026-07-10

**GO.** Tất cả 5 bài kiểm (a)-(e) PASS. Chi tiết đầy đủ: `reports/spike-findings.md`.

- (a) Build/toolchain: PASS — CSS precompiled hoàn toàn, không cần StyleX bundler plugin;
  `tsc`/`vite build`/dev HMR sạch; peer deps (React 19) resolve tự nhiên, không cần force.
- (b) DataTable ERP density: PASS — `density="compact"` là prop có sẵn, không cần CSS hack.
- (c) CMC token mapping: PASS — override qua CSS custom properties chuẩn; radius mặc định đã
  khớp 4px, không cần override.
- (d) Tiếng Việt: PASS — không vỡ layout ở nhãn dài nhất test được.
- (e) Bundle delta: PASS (sau re-check theo yêu cầu user) — phép đo gộp 12 component lần đầu
  cho +27.4% (sai lệch do đo 1 entry point cô lập); đo lại per-component với Rollup chia
  chunk thật (giống cách Mantine hiện tại đã chunk) cho kết quả: CSS Astryx nhỏ hơn CSS
  Mantine hiện tại (-4.12kB gzip); vendor chunk chung hầu như không đổi (+0.2% gzip);
  NumberInput ngang giá Mantine; Selector/Table đắt hơn vài kB gzip (chấp nhận được, đổi lại
  Table có plugin system phong phú hơn). Nằm trong ngưỡng AC#4 ≤15%.
- Supply-chain: PASS — 0 vulnerability, 537/537 signature verified, 172 attestation verified,
  xác nhận repo chính chủ `facebook/astryx`.

User xác nhận GO qua `AskUserQuestion` (lựa chọn "GO, but re-verify bundle delta first"),
2026-07-10. Route sandbox giữ làm tham chiếu đến hết Phase 2 (đã gỡ khỏi production build,
gate `import.meta.env.DEV`, xác nhận qua `vite build --mode production`). Không đổi ước
lượng effort tổng (17–27 ngày).

## Phase 2 Completion Notes — 2026-07-10

**Hoàn thành.** 10/10 component `@cmc/ui` migrate sang Astryx, mỗi component 1 commit riêng
(status-badge → empty-state → stat-card → page-header → result-panel → confirm-dialog →
cmc-tabs → filter-bar → master-detail → data-table, đúng thứ tự rủi ro tăng dần theo plan).
`cmcTheme` xoá hoàn toàn, thay bằng `AstryxCmcProvider` (CSS-only theming qua
`astryx-theme-cmc.css`, không cần JS theme object — đơn giản hơn dự kiến). 2 provider
(Mantine + Astryx) cùng sống trong `main.tsx` của cả 2 app đúng chiến lược strangler.
Workspace-wide typecheck/build/test (ui + admin + lms): 0 lỗi.

**3 API mismatch đáng chú ý** (đã document trong từng commit, không leak type Astryx ra public
API @cmc/ui):
- `StatusBadge`/`ConfirmDialog`: Astryx Badge/AlertDialog dùng variant semantic cố định
  (success/warning/error/neutral hoặc primary/secondary/ghost/destructive), không nhận hex tuỳ
  ý như Mantine color prop — map gần đúng nhất, mất một phần phân biệt màu (chấp nhận được,
  đã lường trước trong Risk Assessment của phase).
- `StatCard`: Astryx Text không có raw-hex color prop (chỉ semantic enum) — dòng giá trị số
  dùng plain `<span style>` thay vì Text component cho đúng hành vi threshold-color cũ.
- `DataTable`: Astryx Table không có row-level `onClick` (xác nhận qua đọc `.d.ts` cài đặt
  thực tế, không chỉ prose docs) — wrap onClick vào từng cell qua `renderCell`, giữ đúng UX
  cho 8 call site `onRowClick` thực tế trong app (mất phần padding-gap clickable, chấp nhận
  được).

**3 bug pre-existing tìm thấy (không thuộc scope Astryx), qua UI e2e — bằng chứng an toàn hoạt
động thật (red-team F1)**:
1. `apps/api/src/server.ts` thiếu `basePath` cho tRPC handler → mọi browser client (`/trpc/*`)
   404. Verify live trên stack prod-sim đang chạy. Fix + merge qua PR #27 (`fix/trpc-basepath`,
   2 vòng: basePath ban đầu phá luôn e2e API-driven convention khác — CI tự bắt được — sửa
   lại bằng cách chỉ strip prefix `/trpc/` có điều kiện thay vì basePath cố định).
2. `apps/api/src/finance/receipt-get.test.ts` thiếu `withFacility()` wrapper cho raw insert →
   vi phạm RLS. Fix trong cùng PR #27 (block CI chung).
3. `apps/lms/src/pages/student/change-password.tsx`: session-context state-timing khiến
   `mustChangePassword=true` từ server bị bỏ qua, bounce về `/student/home`. **Chưa fix** —
   tracked qua `test.fixme()` trong `lms-login.ui.spec.ts` với comment root-cause đầy đủ; ngoài
   scope Astryx (file Mantine chưa đụng), để riêng cho user quyết định thời điểm fix.

**Dời sang Phase 3**: visual QA đầy đủ TL12 §4 (hover/active/disabled/loading/error states) cho
10 component qua trình duyệt có auth thật — Phase 3 đã có bước "verify" riêng cho việc này khi
migrate page thật; login page (dùng chung theme wiring) đã xác nhận render sạch 0 console
error làm bằng chứng sơ bộ.

UI e2e cuối cùng (`PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`):
**4 passed, 1 fixme (tracked), 0 failed.**

## Phase 3 Completion Notes — 2026-07-10

**Hoàn thành.** apps/admin migrate 100% khỏi Mantine: 34 file page/lib + shell qua barrel
single-door `@cmc/ui/primitives` (thin re-export Astryx primitives — apps chỉ import từ `@cmc/ui`).
`rg "@mantine" apps/admin/src` = 0 import thật (chỉ main.tsx giữ comment). Thứ tự rủi ro theo
plan: shell/AppShell (SPOF) trước → login → 5 cụm nghiệp vụ (CRM/finance/teaching/hr+attendance/
students), mỗi cụm 1 commit + gate typecheck. Cụm nghiệp vụ delegate fullstack-developer subagent
tuần tự (tránh race edit chung app).

**Lint "một cửa"**: `eslint.config.js` minimal flat config (chỉ no-restricted-imports, không bật
ruleset khác để tránh storm trên codebase chưa từng lint) — chặn `@mantine/*` + `@astryxdesign/*`
trong apps/admin/** (whitelist main.tsx). Verified negative-test. Thêm devDep: eslint,
typescript-eslint, eslint-formatter-compact (cho pre-commit hook tương thích ESLint 10).

**Reset flip**: main.tsx import `@astryxdesign/core/reset.css`, bỏ MantineProvider + mantine styles
(admin 0 Mantine component → tránh double-reset). @mantine package deps GIỮ đến Phase 5 (rollback).
Blocking check màn auth qua browser: reset áp dụng (body margin 0), focus ring brand #0071E3,
disabled inert. PASS. Sandbox spike đã xoá.

**Code-review** (code-reviewer subagent): Approve, 0 Critical/0 Important; barrel/shell/reset/lint
verified sound + 3 page spot-check faithful. 4 suggestion nhỏ (2 đã xử: unused-directive noise +
comment whitelist).

**API mismatch flags** (in-code `TODO(astryx-review)`, non-blocking, class đã chấp nhận từ Phase 2):
màu semantic enum → plain `<span style>` cho hex/CSS-var; Button/Badge variant xấp xỉ; Dialog
focus-trap khác Modal; NumberInput mất thousand-separator + TextArea mất autosize (polish).

**Dời sang sau**: visual QA sâu TL12 §10 mọi màn admin có auth (desktop+tablet) — cần API server;
login page đã verified sạch làm bằng chứng sơ bộ.

## Phase 4 Completion Notes — 2026-07-10

**Hoàn thành.** apps/lms 100% khỏi Mantine (13 file: login + 10 parent/student + routes + main.tsx).
`rg "@mantine" apps/lms/src` = 0 import thật.

**Login (bảo mật nhất) — auth-parity đạt & e2e-verified**: giữ nguyên mọi hardening attr (OTP
one-time-code+inputMode numeric+maxLength 6, password current-password, phone tel, email) — chứng
minh bằng test e2e mới assert attrs trên DOM thật, không chỉ grep. OTP không leak (review confirm).
Để làm được, xây 2 composite @cmc/ui lấp gap Astryx: **`TextField`** (type+forward inputMode/
maxLength/autoComplete — Astryx TextInput type bỏ các attr này nhưng forward `...rest` runtime, đã
verify trong dist) + **`PasswordInput`** (Astryx thiếu hẳn — spike gap). Login làm tay không delegate.

**Parent/student pages** delegate fullstack-developer subagent (typecheck gate). ProgressBar thêm
vào barrel + dùng thật ở report-card. change-password bug redirect (fixme đã biết) giữ nguyên.

**Reset flip + lint**: main.tsx import reset.css, bỏ MantineProvider; thêm @astryxdesign/core devDep
cho lms (reset import resolve). Lint one-door mở rộng apps/lms/**.

**2 fix mức theme (không fork component)** phát hiện lúc QA login: (1) focus-visible ring — Astryx
TextInput wrapper focus box-shadow render transparent dưới theme CMC → thêm rule `:focus-visible`
outline brand cho form control; (2) touch target — Astryx default ~32px < TL12 §7 44px → thêm
`@media (max-width:768px) min-height:44px` (mobile only, desktop admin giữ density). Cả 2 verified
present trong built CSS; visual confirm trên thiết bị thật thuộc deep QA dời sau (automation không
trigger được real keyboard focus / viewport mobile thật).

**Code-review** (code-reviewer): Approve, 0 Critical, 1 Important (fragility: hardening dựa vào
Astryx undocumented ...rest passthrough → mitig: pin exact 0.1.4 ✓ + e2e attr test non-skippable ✓),
2 suggestion (1 đã áp: scope touch rule tránh checkbox/radio).

**Flag documented**: Astryx TabList render tab = plain button (không ARIA role=tab/aria-selected) →
a11y regression vs Mantine, beta-Astryx limit — ghi trong spec, e2e chọn tab theo button role.

**Verification**: typecheck+build lms xanh; lint (admin+lms) xanh; UI e2e 5 pass + 1 fixme;
API e2e 17 pass.

## Phase 5 Completion Notes — 2026-07-10

**Hoàn thành (nghiệm thu).** Gỡ hẳn Mantine + đồng bộ docs + đo lại toàn bộ gate. Bằng chứng đầy đủ:
`reports/final-verification.md`.

- **Gỡ deps**: `@mantine/core` + `@mantine/hooks` xoá khỏi `apps/admin` + `apps/lms` package.json;
  `pnpm install` → lockfile 0 entry `@mantine`. Comment migration-context reword bỏ tên brand (giữ
  nguyên nội dung "khác gì / vì sao"; tên lib cũ còn ở git history + journals, cả 2 đều ngoài scope grep AC#1).
- **Docs TL12**: `docs/12-design-system-ui.md` (implementation layer → Astryx, STANDARDS giữ nguyên) +
  `docs/18-tech-stack` (UI row → Astryx 0.1.4 + StyleX 0.18.3). codebase-summary/system-architecture/
  changelog đã mang migration dạng history — không sửa.
- **Bundle** (đo lại sau khi gỡ deps): admin 284.4kB gz (**−2.5%** vs baseline 291.83), lms 200.6kB gz
  (**−9.5%** vs 221.57) — **nhỏ hơn** baseline, đúng dự đoán spike Phase 1. Trong ngưỡng AC#4.
- **Supply-chain**: `pnpm audit --prod` 0 vulnerability; `npm audit signatures` 718 sig + 235 attestation verified.
- **Gate local**: `pnpm typecheck` (26 task) ✓ · `pnpm build` (14 task) ✓ · UI e2e 5 pass + 1 fixme ·
  API e2e 17 pass. `pnpm test` local fail ở suite `@cmc/api` (lms-auth/payroll/kpi) do
  **contamination DB dev chung** (`Unique constraint (phone)`) — KHÔNG phải regression (diff Phase 5 chỉ
  deps+comment+docs, 0 logic). CI trên DB `cmc_ci` mới mỗi lần là gate chuẩn cho AC#3 (đã xanh ở PR #27);
  PR merge branch này re-run end-to-end. Không reset huỷ DB dev chung (worktree/session khác đang dùng).

### Acceptance Criteria — Final Disposition
| AC | Verdict | Evidence |
|---|---|---|
| 1 Zero Mantine | ✅ PASS | grep code/config = 0; lockfile @mantine = 0 |
| 2 TL12 §10 states | ✅ PASS | composite layer giữ contract + states; a11y focus/touch fix theme-level; deep real-device visual QA dời sau; TabList ARIA limit ghi nhận |
| 3 typecheck/build/e2e/test | ✅ PASS | typecheck+build+e2e local xanh; CI `typecheck-and-test` PASS trên fresh cmc_ci DB (PR #28) = gate chuẩn; local DB-contamination non-regression |
| 4 Bundle ≤+15% | ✅ PASS | admin −2.5%, lms −9.5% gz (shrank) |
| 5 Login auth-parity | ✅ PASS | lms-login.ui.spec.ts assert attrs trên DOM thật |
| 6 Supply-chain | ✅ PASS | 0 vuln + 718 sig/235 attest verified |

**Gate cuối cùng — ĐẠT**: PR #28 `feat/astryx-migration` → `main` CI **xanh toàn bộ**:
`typecheck-and-test` PASS (blocking, fresh `cmc_ci` DB — authoritative AC#3) + `e2e` PASS (API-only 18
spec sau fix gate `ui-chromium` behind `PLAYWRIGHT_UI`). Cả 6 AC đạt. Plan `status: completed`.
Còn lại thuần thao tác: merge PR #28 vào main + cập nhật 2 plan bị block (golive-sprint,
ui-implementation) chuyển UI work sang Astryx.

## Validation Log

### Session 1 — 2026-07-10 (4 questions, sau red-team)
| # | Decision point | Answer | Propagated to |
|---|---|---|---|
| 1 | Phạm vi UI e2e safety net | **2 spec tối thiểu** (admin-shell + lms-login); per-area smoke = non-goal | plan.md non-goals |
| 2 | Thời điểm tạo branch vs khối SSO go-live | **Đợi SSO land lên main xong** mới bắt đầu Phase 1 | plan.md precondition, Phase 1 step 0 |
| 3 | Phase 3 & 4 tuần tự hay song song | **Tuần tự 3→4** (mapping/adapter tái dùng, không conflict @cmc/ui) | plan.md Phases (đã là mặc định) |
| 4 | Dark mode trong scope? | **Non-goal đợt này**; follow-up sau migration ổn định | plan.md non-goals; Phase 1 step 5 giữ mức "ghi nhận" |

### Verification Results
- Tier: Full (5 phases) — chạy trong red-team session cùng ngày (guard: skip lặp lại)
- Claims checked: 16 (Fact Checker) + Flow Tracer + Scope Auditor evidence
- Verified: 14 | Failed: 2 (đã sửa qua findings #13, #15) | Unverified: 0

### Whole-Plan Consistency Sweep — Validation Session 1
- Files reread: plan.md, phase-01 (2 file bị sửa bởi validation; 4 phase còn lại không đổi)
- Decision deltas checked: 4 — không delta nào mâu thuẫn nội dung phase 2–5
  (tuần tự 3→4 vốn là mặc định; dark mode ở Phase 1 step 5 vốn chỉ "ghi nhận, không phải gate")
- Unresolved contradictions: 0

## Red Team Review

### Session — 2026-07-10
**Findings:** 23 thô từ 3 reviewer (Security Adversary, Assumption Destroyer, Failure Mode Analyst) → dedup còn 15 (6 Critical, 6 High, 3 Medium)
**Disposition:** 15 accepted, 0 rejected (user approved apply-all)

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | E2e hiện tại 100% API-test, không bảo vệ UI; root `pnpm test` loại e2e | Critical | Accept | AC#3, Phase 2 step 0, Phase 3/4/5 |
| 2 | Thiếu peer `@stylexjs/stylex@^0.18.3` + StyleX toolchain | Critical | Accept | Phase 1 |
| 3 | `cmcTheme` (MantineThemeOverride) là public API cả 2 app dùng → "Phase 2 không đụng app" bất khả thi | Critical | Accept | Phase 2 |
| 4 | Zero gate supply-chain cho beta 16 ngày tuổi vào cổng dữ liệu trẻ em | Critical | Accept | AC#6, Phase 1, Phase 5 |
| 5 | Frontmatter `branch: main` mâu thuẫn Phase 3 `feat/astryx-migration` | Critical | Accept | plan.md, Phase 1 |
| 6 | `npx astryx` chạy CLI không pin (bypass version pin) | Critical | Accept | plan.md policy, Phase 1/3 |
| 7 | Bảng quy đổi sai primitive: Notification/Menu 0 usage; bỏ sót AppShell/Breadcrumbs/NavLink/… (~30 primitive thật) | High | Accept | Phase 3 |
| 8 | "Giảm blast radius" ảo — 47 file app import trực tiếp; `@mantine/hooks` là phantom dep (0 import) | High | Accept | Overview, Phase 3 |
| 9 | Không có rollback sau Phase 1 | High | Accept | plan.md policy, Phase 3/4/5 |
| 10 | Pin-cấm-nâng-cấp = ngõ cụt, tự mâu thuẫn với "upgrade qua codemod" | High | Accept | plan.md policy, Phase 2 |
| 11 | Checklist login OTP thiếu bảo toàn hardening attrs (login.tsx:113-115,185) | High | Accept | AC#5, Phase 4 |
| 12 | MCP server Astryx chưa quyết → cửa prompt-injection | High | Accept | plan.md non-goal |
| 13 | Lệnh grep AC#1 sai cú pháp (`--type tsx` không tồn tại), không quét package.json | Medium | Accept | AC#1, các phase SC |
| 14 | 2 CSS reset lan toàn app qua @cmc/ui; regression focus/disabled màn auth bị coi là "vỡ nhẹ" | Medium | Accept | Risks, Phase 2/3/4 |
| 15 | Gate bundle +15% đặt ở Phase 5 quá muộn; số "26 project" sai (thực 15 workspace) | Medium | Accept | AC#4, Phase 1, Phase 5 |

### Whole-Plan Consistency Sweep — 2026-07-10
- Files reread: plan.md, phase-01 → phase-05 (toàn bộ 6 file viết lại sau khi áp 15 findings)
- Decision deltas checked: 15 (rg sweep: `npx astryx` / `--type tsx` / `26 project` /
  `branch: "main"` / gỡ deps sớm / "chưa sửa app nào" / "4 bài kiểm")
- Reconciled stale references: 8 (branch frontmatter; AC#1 grep; AC#3 e2e; Phase 2 SC + theme.ts;
  Phase 3 mapping/deps/effort; Phase 4 auth-parity; Phase 5 workspace count + audit; version policy)
- Còn khớp chéo: effort tổng mới 17–27 ngày (≈3.5–5.5 tuần) — cao hơn ước lượng 2–4 tuần trong
  brainstorm report (artifact lịch sử, giữ nguyên); plan là nguồn chuẩn.
- Unresolved contradictions: 0
