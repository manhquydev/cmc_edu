# Independent test review — form-depth + Console densify

**Branch:** `feat/lms-foundation-unit-range-spike`  
**Date:** 2026-08-11  
**Scope:** unit/integration tests for resource-centric form-depth + Console densify  
**Mode:** read-only review + run tests (no production edits)

## Verdict: **PASS_WITH_CONCERNS**

Green on representative densify unit suite. Strongest locks: shifts (list index-only + e2e form/`/go` HITL), receipt refund/cancel form-depth, packages/links catalog, API `.get` ACL. Weakest: aftersale form has **no** unit file; KPI/parent/shift **form** mutation wiring shallow; dual-path list HITL still green while form path under-proved.

---

## 1. Key test files locking this wave

### apps/admin (form-depth / densify UI)

| File | Role |
|------|------|
| `apps/admin/src/pages/attendance/shifts.test.tsx` | Compose matrix + list/inbox index-only (no list Duyệt/Từ chối) |
| `apps/admin/src/pages/attendance/shifts-detail.test.tsx` | Form chrome + director Duyệt/Từ chối presence |
| `apps/admin/src/pages/attendance/check-in-out.test.tsx` | Punch card + "Hàng chờ phiếu" rename + geo/offsite |
| `apps/admin/src/pages/hr/kpi.test.tsx` | List confirm/override/bulkApprove gates |
| `apps/admin/src/pages/hr/kpi-detail.test.tsx` | Form statusbar + Xác nhận button presence |
| `apps/admin/src/pages/finance/receipt-detail.test.tsx` | Approve + refund ledger + cancel form depth |
| `apps/admin/src/pages/finance/refund.test.tsx` | Refund index → `Mở phiếu` → `/finance/:id` |
| `apps/admin/src/pages/parents/parent-detail.test.tsx` | Parent form chrome (shallow) |
| `apps/admin/src/pages/students/student-detail.test.tsx` | Query vs location.state + Console chrome |
| `apps/admin/src/pages/classes/class-detail.test.tsx` | Class form chrome + session ops (pre-existing depth) |
| `apps/admin/src/pages/classes/index.test.tsx` | Create class densify (no UUID paste) |
| `apps/admin/src/pages/teaching/session-detail.test.tsx` | Session sheet + Copy link |
| `apps/admin/src/pages/crm/aftersale.test.tsx` | **List** lifecycle only (advance/resolve/close) |
| `apps/admin/src/shell/nav-registry.test.ts` | Nav labels (KPI, shifts, check-in) |
| `apps/admin/src/shell/breadcrumb-routes.test.ts` | Resource URL crumbs |

**Missing admin unit file:** `aftersale-detail.tsx` (291 LOC) — **no** `aftersale-detail.test.tsx`.

### apps/api (resource GET for form cold-start)

| File | Role |
|------|------|
| `apps/api/src/shift/get.test.ts` | Owner / track / peer / facility ACL |
| `apps/api/src/kpi/get.test.ts` | Owner / manager / track / peer ACL |
| `apps/api/src/parentAccount/get.test.ts` | Children + facility + perm |
| `apps/api/src/finance/receipt-get.test.ts` | Refund ledger + viewerCanRefund/Cancel |
| `apps/api/src/after-sale/after-sale.test.ts` | Lifecycle + `get` + manage perm |

### packages/links + UI shell

| File | Role |
|------|------|
| `packages/links/src/index.test.ts` | Entity paths, `/go` resolve, UUID reject, workspace builders |
| `packages/ui/src/components/page-header.test.tsx` | SPA crumb links |

### apps/e2e (journey helpers / dual-path)

| File | Role |
|------|------|
| `apps/e2e/tests/journeys/shift-register-approve-reject.journey.ui.spec.ts` | **Gold:** `/hr/shifts/new` → form UUID → reject form → `/go/shiftRegistration` approve → cancel form |
| `apps/e2e/tests/journeys/kpi-submit-confirm-bulk-approve.journey.ui.spec.ts` | Nav rename only; **still list-row Xác nhận** |
| `apps/e2e/tests/journeys/checkin-offsite-approval.journey.ui.spec.ts` | Tab label "Hàng chờ phiếu" |
| `apps/e2e/tests/deeplink-go.ui.spec.ts` | `/go` only for **opportunity** (not new entities) |
| `apps/e2e/tests/journeys/aftersale-case-lifecycle.journey.ui.spec.ts` | **List-row** Tiếp nhận (not form) |

---

## 2. Surface-by-surface: locked / gaps / false-green risk

### Shifts (best in wave)

- **Locked:** matrix submit payload; SINGLE day replace; success/error banners; inbox **index-only** (no list Duyệt/Từ chối); `Mở phiếu`; API `shift.get` ACL; e2e cold form + `/go` approve + form cancel + mobile overflow.
- **Gaps:** unit form tests only assert **button presence**, not approve/reject/cancel mutate + confirm dialog wiring on detail.
- **False green:** low for list/e2e; medium if detail handlers break but buttons still render.

### KPI

- **Locked:** list confirm/override/bulkApprove confirm-gating + perms; detail chrome + statusbar + Xác nhận visible; API `kpi.get` track ACL.
- **Gaps:** list still dual-path HITL (`Xác nhận` on row + form); unit has **no** "Mở phiếu"/row-open navigate assert; detail does **not** fire confirm/override mutate; e2e never opens `/hr/kpi/:id` or `/go/kpiScore`.
- **False green:** high for form path — list e2e green while form-only regressions invisible.

### Check-in

- **Locked:** punch geo/offsite/resubmit; inbox tab rename + scope; punch CTA card grammar.
- **Gaps:** not a UUID form entity (workspace) — fine; densify is chrome/copy.
- **False green:** low.

### Aftersale (highest gap)

- **Locked:** list create/advance/resolve/close (unit + API lifecycle); API `get`.
- **Gaps:** **no** `aftersale-detail.test.tsx`; list still full HITL dual-path; e2e list-only; no `/go/afterSaleCase` e2e.
- **False green:** **high** — list tests keep green if form page blank/broken; intentional dual-path may mask "form is HITL surface" product goal.

### Parents

- **Locked:** form renders phone/email/children + sheet labels; API get ACL.
- **Gaps:** no unit for `updateEmail` / `setActive` confirm+mutate on form; parents list densify (`Mở phiếu`) not asserted in changed tests.
- **False green:** medium — chrome-only unit.

### Student / class / session

- **Locked:** student query-vs-stale-state + densify chrome; class create densify + detail ops (assign/cancel/makeup); session Copy link + sheet.
- **Gaps:** densify mostly chrome asserts (not new business rules).
- **False green:** low for student not-found; low-medium for pure chrome.

### Receipt refund / cancel

- **Locked (strong):** refund form enable/amount/confirm; hide when no perm; cancel reason + void:false; statusbar cancelled step; refund index → navigate form; API viewerCan* + ledger.
- **Gaps:** no full e2e refund/cancel journey in this wave; refund error banner path thinner than approve.
- **False green:** low unit; e2e still smoke elsewhere.

### packages/links

- **Locked:** all new entities + goPath/resolveGo + UUID/proto rejection + shift/kpi workspace paths.
- **Gaps:** links unit ≠ admin route registration; `/go` e2e not expanded to shift/kpi/aftersale/parent/session (shift covered in journey only).
- **False green:** medium if route table drifts from links builders. Note: vitest ran **src + dist** (30 tests = 15×2) — drift possible if dist stale.

### E2E helpers

- **Locked:** shift journey rewritten for form-depth + dual `/go`.
- **Gaps:** KPI/aftersale/parents/receipt not moved to form/`/go` HITL; deeplink-go matrix incomplete for new LinkEntity keys.
- **False green:** dual-path — list HITL e2e green ≠ form HITL works.

---

## 3. Test run results (this review)

```
Diff-aware mode: densify/form-depth representative suite (not full monorepo)

pnpm --filter @cmc/admin exec vitest run
  shifts, shifts-detail, check-in-out, kpi, kpi-detail,
  receipt-detail, refund, parent-detail, student-detail,
  class-detail, classes/index, session-detail, aftersale (list),
  breadcrumb-routes, nav-registry

  Test Files  15 passed (15)
  Tests       150 passed (150)
  Duration    ~7.0s

pnpm --filter @cmc/links exec vitest run
  Tests  30 passed (30)  # 15 unique × src+dist

pnpm --filter @cmc/ui exec vitest run page-header.test.tsx
  Tests  3 passed (3)
```

**Not run here:** full API integration (needs DB), Playwright e2e, full admin suite.

Noise only: jsdom canvas/scrollTo; classes `act(...)` warnings — non-blocking.

---

## 4. Ordered next test investments

1. **P0 — `aftersale-detail.test.tsx`:** render from `afterSale.get`; statusbar; advance/resolve/close mutate+gating; CopyLink; empty/error. Mirror shifts-detail + receipt-detail depth.
2. **P0 — form mutation wiring unit (shifts-detail, kpi-detail, parent-detail):** click → confirm → mutate payload (not presence-only).
3. **P1 — dual-path policy tests:** either (a) shifts-style index-only assert on aftersale/kpi list, or (b) explicit dual-path contract tests for both list + form HITL so neither can rot silently.
4. **P1 — e2e form/`/go` for KPI + aftersale:** one confirm via `/go/kpiScore/:id`; one advance/resolve via `/crm/aftersale/:id` (list path optional secondary).
5. **P1 — expand `deeplink-go.ui.spec.ts`** matrix: shiftRegistration (already in journey), kpiScore, afterSaleCase, parentAccount, classSession — cold-nav + bad UUID.
6. **P2 — list navigate locks:** kpi/parents/aftersale unit assert `Mở phiếu` / row-click → `links.*` path (refund already does).
7. **P2 — receipt refund/cancel e2e smoke** on form (approve journey exists; refund/cancel form depth unit-only today).
8. **P3 — links package:** single source run (src **or** dist) to avoid double-count / stale dist false confidence.

---

## 5. Summary metrics

| Layer | Result |
|-------|--------|
| Admin densify unit (representative) | **150/150 pass** |
| links + page-header | **33/33 pass** (links double-run) |
| API densify GET (not re-executed) | Present + substantial on branch |
| Form-depth e2e coverage | **Shifts strong**; KPI/aftersale/parents/receipt form **weak** |
| Critical unmapped prod | `aftersale-detail.tsx` |

**Verdict:** **PASS_WITH_CONCERNS**

---

## Unresolved questions

1. Is aftersale **intentional dual-path** (list HITL + form) long-term, or should list become index-only like shifts?
2. Same for KPI list-row Xác nhận vs form-only confirm?
3. Should `/go` e2e cover every `LinkEntity` before merge, or journey-by-journey?
