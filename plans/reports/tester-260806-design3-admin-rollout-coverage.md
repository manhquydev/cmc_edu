# Tester Report — Design3 Admin Rollout Coverage

Date: 2026-08-06  
Branch: `feat/ui-copy-standard`  
Range: `ba4f782..5b515c6` (BASE parent `754df470`)  
Plan: `plans/260805-1920-design3-admin-rollout/`  
Mode: coverage analysis + executable unit/static gates only (no full ui-e2e)

---

## Executive summary

| Layer | Result | Notes |
|-------|--------|-------|
| Static gates (AppFrame/SideNav, design-lab gone, CSS imports) | **PASS** | Proven by filesystem + grep |
| `check-ui-frames` (+ `--strict` + self-tests) | **PASS** | FilterBar 7, bulk 8, dualTitle 0 |
| `@cmc/ui` vitest (full package) | **113/113 PASS** | Includes 4 new odoo suites |
| `apps/admin` vitest (full package) | **545/545 PASS** | Shell + CRM/finance/teaching design3 cases |
| ui-e2e / journey regression vs main | **NOT RUN** | Preview `:4173` and API not up locally |
| `pnpm acceptance:report` post-rollout | **NOT RUN** | Phase 1 baseline is unchecked flow-id list only |

**Overall design3 behavioral-risk coverage score: ~62/100**

- Unit/static contracts for shell + odoo layer + template class renames: **strong (~85)**
- Cross-route nav permission + 30 menuNav journeys + acceptance parity: **unproven (0 runtime)**
- Float-layer toast/cmd fix exists in CSS but **no regression test**

Plan status says phases 1–6 completed at unit level; **ui-e2e merge gate still open** (explicit in plan.md Phase 2/3/4 notes).

---

## 1. Unit / component test inventory (design3)

### 1.1 NEW — `packages/ui/src/odoo/*`

| File | Tests (count) | What it proves |
|------|---------------|----------------|
| `odoo-navbar.test.tsx` | 6 | Brand + switcher toggle; `isChildVisible` gates section menu; empty section when all gated; switcher navigate; (full suite green) |
| `odoo-kanban.test.tsx` | 4 | Board/column/card markup; `--odoo-kanban-card-color`; onClick; default count from children |
| `odoo-tokens.test.ts` | 6 | No `:root`; tokens under `.o_web_client`; `.o-*` not `.odoo-lab-`; LGPL + Odoo commit pin; font-size + text-* remaps; raw h1/p/small rules |
| `odoo-astryx-remap.test.ts` | 4 | **Computed-style** proof of dense 14/13/12; text-* bindings; raw tags; Badge/Button/DataTable stand-ins |

**Coverage quality:** High for extract layer (tokens, navbar permission, kanban primitives, Astryx density).  
**Gaps:** No visual snapshot; no test that toast/cmd rules are unscoped after Phase 6 mirror fix (`29bc469`).

### 1.2 MODIFIED — shared templates / archetypes (`packages/ui`)

Class-marker renames only (behavior assertions largely unchanged):

| File | Change |
|------|--------|
| `control-bar.test.tsx` | `.tpl-control-bar*` → `.o-control-bar*` |
| `list-page.test.tsx` | `.tpl-wrap--ops` / control-bar class |
| `detail-page.test.tsx` | odoo class markers |
| `form-page.test.tsx` | odoo class markers |
| `page-header.test.tsx` | odoo class markers |
| `metric-card.test.tsx` | `.o-mc-*` |
| `dashboard-page.test.tsx` | class markers |
| `entity-header.test.tsx` | class markers |

**Coverage quality:** Partial — proves emit of new class names, not that odoo.css paints them or that premium consumers outside `.o_web_client` still work (except toast/cmd manually unscoped).

### 1.3 NEW/MODIFIED — `apps/admin` shell + modules

| File | Status | Design3-relevant assertions |
|------|--------|------------------------------|
| `shell/shell.test.tsx` | **NEW** (6) | `.o_web_client` + OdooNavbar; me=null empty apps; gated section child hidden; **change-password chrome suppress** (no switcher/⌘K/RoleSwitcher); **no `.sh-root/.sh-nav/.sh-sb`**; CommandPalette items permission-filtered |
| `shell/role-switcher.test.tsx` | **NEW** (2) | Renders in DEV; source-gate `import.meta.env.PROD → null` |
| `pages/crm/pipeline.test.tsx` | **MOD** | Kanban col titles/counts via `.o-kanban-*`; **list↔kanban switcher** (default board, table view, deep-link `?view=table`, advance after switch back) |
| `pages/finance/receipt-detail.test.tsx` | **MOD** | Cancelled receipt marks **Đã hủy** as current WorkflowStatusbar step; draft not current; live approved step |
| `pages/teaching/schedule.test.tsx` | **MOD** | Kanban 4 cols + counts; **no `.ck-kanban`** |
| `pages/teaching/schedule-fc-events.test.ts` | **MOD** | Minor (calendar class / ck-fc notes) |

**Not design3-specific but still green in full admin suite:** CRM aftersale/post-sale, finance list/create, teaching attendance/grading, nav-registry, etc. (regression net, not new design3 proofs).

### 1.4 Run evidence (this session)

```text
packages/ui:  Test Files 37 passed · Tests 113 passed · ~7.9s
apps/admin:   Test Files 55 passed · Tests 545 passed · ~23.5s
```

Note: vitest filter args still ran full package suites (filter pattern not narrowed); results remain valid green.

---

## 2. E2E inventory (admin shell / menu / CRM / journeys)

### 2.1 Direct design3 shell coupling (changed in range)

| File | Change | Risk |
|------|--------|------|
| `apps/e2e/tests/admin-shell.ui.spec.ts` | Rewritten: brand `CMC EDU`, role badge, app-switcher → Tổng quan; finance via switcher → empty receipts | **Primary chrome pin** |
| `apps/e2e/src/journey/menu-nav.ts` | Full rewrite: switcher + section menu; `assertEntryAbsent` settles on switcher + optional section buttons | **Blast radius ~30 journeys** |
| `crm-receipt.journey.ui.spec.ts` | `.sh-content` → `main.o-main`; **smoke list↔kanban** switcher | CRM pilot |
| `checkin-punch`, `checkin-offsite-approval` | `.sh-main` → `main.o-main` | Content scoping |
| `grading-submission`, `lms-grade-parent-view`, `lms-stars-redeem-cycle` | `.sh-main` → `main.o-main` | Content vs nav name clash |
| `shift-register-approve-reject` | `.sh-main` → `main.o-main` | HR journey |

### 2.2 Consumers of `menuNav` (must pass for shell swap)

31 files import/use menu-nav (journeys + helpers), including:

aftersale, audit-log, checkin-*, crm-*, enrollment, entrance-test, exercise-publish, facility-admin, finance-receipt, gift-config-nav (**assertEntryAbsent canary**), grading, kpi-*, lms-*, network-ip, parent-meeting, payroll-*, receipt-approve-negation, recon, rewards, session-*, shift-*, user-admin-roles, provision-student-via-receipt.

### 2.3 Static e2e hygiene

- Zero remaining `sh-main` / `sh-content` / `sh-nav` / `sh-root` in `apps/e2e` (grep clean).
- `assertEntryAbsent` canary still used: `gift-config-nav.journey.ui.spec.ts`.

### 2.4 Runtime e2e status

| Check | Status |
|-------|--------|
| Local preview `http://localhost:4173` | **down** (HTTP 000) |
| Local API | **down** |
| CMC e2e stack containers | **not present** (other docker projects only) |
| This session ui-e2e | **NOT RUN** — blocker is missing stack, not test authoring |

Plan already flags: Phase 2/3/4 **ui-e2e merge gate open**.

---

## 3. Success criteria → evidence matrix

| # | Requirement | Evidence | Status |
|---|-------------|----------|--------|
| SC1 | Odoo shell on all post-login routes (incl. change-password chrome-suppressed; excl. login) | Unit: `shell.test.tsx` (chrome + suppress). Static: shell uses `OdooNavbar` + `.o_web_client`. **No per-route e2e matrix** | **partial** |
| SC2 | No AppFrame/SideNav in admin shell / admin-wide | `grep AppFrame\|SideNav apps/admin/src` = 0; shell test asserts no `.sh-root/.sh-nav/.sh-sb` | **proven** (static + unit) |
| SC3 | design-lab deleted; odoo layer is source of truth; `/design3` gone | No `apps/admin/src/pages/design-lab*`; no design routes in shell/routes; `packages/ui/src/odoo.css` + odoo components | **proven** |
| SC4 | premium.css removed from admin; kept on LMS | `apps/admin/src/main.tsx` imports `@cmc/ui/odoo.css` only; `apps/lms/src/main.tsx` still `premium.css`; export still in `@cmc/ui` package.json | **proven** |
| SC5 | Toast / command palette float layers styled after premium retirement | CSS: `.ck-toast*` and `.ck-cmd*` **unscoped** in `odoo.css` (commit `29bc469`). Unit: toast test only checks aria-live, **not** fixed positioning / unscoped rule presence | **partial** |
| SC6 | FilterBar / frames counts for `check-ui-frames` | Live: FilterBar **7** (≥5), ListPagination **11** (≥8), bulk **8** (≥5), dualTitle **0**. `--strict` exit 0. Self-tests 3/3 | **proven** (static gate) |
| SC7 | No journey regression vs main | menu-nav + 7 binders updated; **zero runtime proof this session**; CI ui-e2e required | **unproven** |
| SC8 | `acceptance:report` baseline held | Phase 1 artifact lists 38 flow ids all unchecked; no post-Phase-6 report | **unproven** |
| SC9 | Docs TL12 supersede + design-system-odoo rolled out | `docs/design-system-odoo.md` banner rolled-out; TL12 has supersede banner. **`docs/system-architecture.md` still AppShell/SideNav-era** (no design3 shell section). candidate doc still present | **partial** |

### Extra plan gates (CI / red-team)

| Gate | Evidence | Status |
|------|----------|--------|
| FilterBar name kept (not renamed away) | Source still includes `FilterBar`; count 7 | **proven** |
| Permission gate on navbar children | `odoo-navbar` + `shell` unit tests | **proven** (unit) |
| `assertEntryAbsent` not ghost-pass under switcher | Helper rewritten with settle on Tổng quan + open menu | **partial** (code review quality; needs e2e canary run) |
| RoleSwitcher PROD null | Source-level test | **proven** (unit/source) |
| Astryx density remap | computed-style suite | **proven** (unit) |

---

## 4. Commands run this session

```bash
# Static / frames
node scripts/check-ui-frames.mjs              # exit 0
node scripts/check-ui-frames.mjs --strict     # exit 0
node --test scripts/check-ui-frames.test.mjs  # 3/3 pass

# Unit
cd packages/ui && pnpm test                   # 113/113
cd apps/admin && pnpm test                    # 545/545

# Not run
# ui-e2e (stack down)
# pnpm acceptance:report (no CI artifacts / stack)
```

### `check-ui-frames` snapshot (2026-08-06)

| Metric | Value | Plan threshold |
|--------|-------|----------------|
| ListPage | 23 | — |
| DetailPage | 10 | — |
| FormPage | 7 | — |
| FilterBar | **7** | ≥5 (report; not strict) |
| ListPagination | **11** | ≥8 (report) |
| BulkActionBar lists | **8** | ≥5 **strict** |
| dualTitleReview | **0** | 0 **strict** |
| WorkflowStatusbar | 2 | full-tier pages |
| SettingsShell | 3 | — |

---

## 5. Gaps ranked by severity

### Critical (merge blockers for design3 behavioral risk)

1. **ui-e2e not executed on this branch**  
   - 30+ menuNav journeys + admin-shell + 7 main.o-main binders unproven at runtime.  
   - Highest regression class: switcher navigation, section menu labels, permission absent canary, content vs chrome name collisions.

2. **`acceptance:report` not re-proven vs Phase 1 flow-id baseline**  
   - Baseline file is a checklist of 38 IDs, none checked; plan SC requires end-of-rollout parity.

### High

3. **No automated regression for toast/cmd float-layer unscope**  
   - Phase 6 review found Critical (viewport sibling of `.o_web_client`). Fix landed in CSS only.  
   - Suggested unit: assert `odoo.css` contains unscoped `.ck-toast-viewport{` / `.ck-cmd{` (string gate) or mount ToastProvider outside `.o_web_client` and match stylesheet rule.  
   - Visual/e2e: fire toast after action, assert visible fixed toast (optional).

4. **“All post-login routes use Odoo shell” only unit-sampled**  
   - Shell wrapper is global for authenticated tree → architecture implies full coverage, but change-password suppress + login exclusion are the only special cases unit-tested. No e2e for change-password chrome-off.

### Medium

5. **FilterBar / ListPagination depth not in `--strict`**  
   - Could drop below plan thresholds without failing CI (only bulk + dual-title strict). Design3 kept FilterBar names so count stable *today*, but not enforced.

6. **Docs architecture lag**  
   - `system-architecture.md` still documents AppShell/SideNav migration narrative; design3 shell not reflected → operator confusion, not runtime fail.

7. **Mirror strategy residual risk**  
   - Most premium classes still scoped `.o_web_client .ck-*`. Any future portal outside shell reopens toast-class bug. No inventory test for “float layers must be unscoped”.

### Low

8. Template tests only assert class renames, not CSS application.  
9. `docs/design-system-odoo-candidate.md` still present; `odoo.css` header still says import after premium.  
10. Teaching schedule tests emit act() warnings (noise, not fail).

---

## 6. Coverage score breakdown (design3 behavioral risk)

| Risk bucket | Weight | Covered? | Score contrib |
|-------------|--------|----------|---------------|
| Odoo layer extract correctness | 15 | Yes (unit) | 14 |
| Shell chrome + permission | 15 | Unit yes / e2e no | 9 |
| Template reskin class contract | 10 | Yes (unit markers) | 8 |
| CRM pilot list↔kanban | 10 | Unit yes + e2e smoke written / not run | 7 |
| Module sweeps (finance/teaching/…) | 10 | Partial unit | 6 |
| premium retirement + LMS isolation | 10 | Static proven | 9 |
| Float layers after retirement | 10 | Fix yes / test no | 5 |
| Journey / menuNav non-regression | 15 | Code adapted / **runtime 0** | 2 |
| acceptance:report parity | 5 | Baseline only | 1 |
| **Total** | **100** | | **~61–63** |

Interpretation: **safe to trust unit contracts; not safe to claim rollout “green” until ui-e2e + acceptance pass on CI.**

---

## 7. Recommended minimal commands before merge

### Local (fast, always)

```bash
pnpm check:ui-frames          # --strict
pnpm test:ui-frames
pnpm --filter @cmc/ui test
pnpm --filter @cmc/admin test
# optional narrow if filter works in env:
# pnpm --filter @cmc/ui exec vitest run src/odoo
# pnpm --filter @cmc/admin exec vitest run src/shell src/pages/crm/pipeline.test.tsx
```

### Local static design3 gates (one-liner)

```bash
# expect empty
grep -RInE 'AppFrame|SideNav' apps/admin/src || true
test ! -e apps/admin/src/pages/design-lab.tsx
grep -n "premium.css" apps/admin/src/main.tsx   # should be comment only
grep -n "odoo.css" apps/admin/src/main.tsx
grep -n "premium.css" apps/lms/src/main.tsx     # must import
```

### Required before merge (CI / full stack)

```bash
# required checks on main
# 1) typecheck-and-test  (includes unit + check-ui-frames)
# 2) ui-e2e              (journeys + admin-shell)

# after ui-e2e artifact available:
pnpm acceptance:report
# compare flow-ids to plans/260805-1920-design3-admin-rollout/reports/baseline-acceptance-flows-phase1.md
```

### Minimal e2e subset if full suite too long (still needs stack)

Priority order:

1. `apps/e2e/tests/admin-shell.ui.spec.ts`
2. `apps/e2e/tests/journeys/gift-config-nav.journey.ui.spec.ts` (assertEntryAbsent canary)
3. `apps/e2e/tests/journeys/crm-receipt.journey.ui.spec.ts` (menuNav + list↔kanban + main.o-main)
4. One HR binder: `checkin-punch.journey.ui.spec.ts`
5. One teaching binder: `grading-submission.journey.ui.spec.ts`

Then full ui-e2e before merge.

### Suggested missing tests (do not implement here — backlog)

| Test | Why |
|------|-----|
| `odoo-tokens` or dedicated: unscoped `.ck-toast` / `.ck-cmd` present in odoo.css | Prevent re-scoping regression |
| e2e change-password: no app-switcher | Decision 10b |
| Optional: elevate FilterBar≥5 + ListPagination≥8 into `--strict` | Plan margin was 1; now 7 but report-only |

---

## 8. Diff-aware test map (for this range)

```text
Diff-aware mode: analyzed ~100 changed files (754df470..5b515c6)
  Changed (tests): 26 test/spec files (+4 odoo unit suites, +2 shell tests, e2e shell/menu/journeys)
  Mapped:
    packages/ui odoo + template tests     (Strategy A co-located)
    apps/admin shell + pipeline/receipt/schedule (Strategy A)
    apps/e2e admin-shell + menu-nav + 7 journeys (Strategy C import/DOM contract)
  Unmapped (no dedicated new tests):
    many Phase 5 page sweeps (classes/enrollment/students detail, etc.) — rely on existing page tests + template inheritance
    float-layer CSS fix 29bc469 — [!] no tests
    docs-only / design-lab deletions — static proof only
Ran: unit full ui+admin + check-ui-frames (not subset e2e)
```

---

## 9. Unresolved questions

1. Has CI already run ui-e2e green on any PR containing `5b515c6`? (not verified this session)  
2. Should FilterBar/ListPagination thresholds move into `--strict` now that design-lab is out of corpus?  
3. Is `docs/system-architecture.md` update still required before calling Phase 6 docs-complete, or deferred?  
4. Will acceptance:report use latest CI artifact path only, or is a local stack required?

---

## 10. Bottom line

| Claim | Verdict |
|-------|---------|
| Design3 unit extract + shell swap + template class contract | **Well tested & green** |
| Admin premium retirement + LMS isolation | **Statically proven** |
| Float toast/cmd fix | **Code fixed, test gap** |
| Journey non-regression + acceptance parity | **UNPROVEN — do not merge on unit alone** |

Status plan alignment: plan “Completed (unit); ui-e2e merge gate open” is **accurate**. Tester score ~62/100 overall behavioral risk until CI e2e + acceptance close.
