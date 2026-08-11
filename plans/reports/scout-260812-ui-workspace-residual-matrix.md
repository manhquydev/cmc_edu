# Scout — UI workspace residual matrix (UI complete + workspace lean)

**Date:** 2026-08-12
**Scout:** `scout-pi` (read-only)
**Branch tip verified:** `2947d6a` (`feat/lms-foundation-unit-range-spike`, PR #110) — CI required checks green
**Authority (locked):** `docs/ux-resource-centric-structure.md` · `docs/design-system-console.md` · `plans/reports/brainstorm-advise-260812-herdr-ui-workspace-coord.md`
**Method:** filesystem + `rg`/`git` evidence (prefer working tree over GitNexus index — index can lag, see coord §dead-dialog).

> **Live-tree note:** two cook commits landed **while this scout was running** (parallel herdr workers):
> `4267eb5 docs(workspace): lean agent entry + live authority index` (ui-lean) and
> `2947d6a fix(admin): map shifts WS_CSS teal to CMC brand tokens` (ui-console slice A).
> Every claim below was re-verified against the current working tree/HEAD after they landed.

---

## 1) Dual-HITL inventory — every admin list that still mutates status

Rule (LOCKED): list = index; form owns lifecycle. Mutations found via
`trpc.<router>.(approve|reject|confirm|accept|resolve|close|advance|finalize|reopen|deliver|bulkApprove|publish).useMutation` sweep + per-file reads.

| # | Surface | File | List mutates status? | Verdict |
|---|---------|------|----------------------|---------|
| 1 | aftersale case | `apps/admin/src/pages/crm/aftersale.tsx` | **No** — list only opens compose (`CreateAfterSaleCaseDialog`, import :19, render :213); lifecycle on form | **DONE** demote |
| 2 | KPI board | `apps/admin/src/pages/hr/kpi.tsx` | **bulk period only** — `kpi.bulkApprove` (:109–114), gate `canDo('kpi','bulkApprove')` (:178), period settle ConfirmDialog (:217–223); row HITL absent | **KEEP** bulk period (owner lock) |
| 3 | shift registration | `apps/admin/src/pages/attendance/shifts.tsx` | **No Duyệt/Từ chối** — ApproveTab row = `Mở phiếu` → `links.shiftRegistration(row.id)` (:1019); subtitle states “mở form để duyệt/từ chối (không duyệt trên list)” (:1096). Minor: MyRegistrationsTab self-`Hủy` on submitted/approved rows (:932–933) | **OK** index; micro: self-cancel stays on list |
| 4 | parents link-request | `apps/admin/src/pages/parents/index.tsx` | **Yes** — `guardian.approveLink`/`rejectLink` on rows (:159–168), row Duyệt/Từ chối buttons (:199–208), confirm dialogs (:274–329) | **KEEP** (owner lock — do not demote) |
| 5 | check-in `manualPunch` inbox | `apps/admin/src/pages/attendance/check-in-out.tsx` | **Yes — row + dialog on list.** `manualPunch.approve/reject` (:389–400); ApproveTicketsTab row `Duyệt`/`Từ chối` (:433–437); detailTicket Dialog with `Duyệt` (:547–562) / reject-reason Dialog (:569–595); tab gated `canDo('manualPunch','approve')` (:784–785). **No UUID form route** (`/hr/checkin` only, `apps/admin/src/routes/hr.routes.tsx:38`) | **DEMOTE candidate (GAP #1)** |
| 6 | engagement rewards | `apps/admin/src/pages/engagement/rewards.tsx` | **Yes** — `rewards.approve/deliver/reject` (:76–78); row `Duyệt`/`Giao quà`/`Từ chối` (:120–127). Route `engagement/rewards` only — no `/:uuid` form (`apps/admin/src/routes/admin.routes.tsx:146`); backend has `list` but **no `get` by id** (`apps/api/src/rewards/reward-router.ts:261–284`) | **DEMOTE candidate (GAP #2)** — needs API `get` first |
| 7 | exercises (teaching, LMS-flavored) | `apps/admin/src/pages/teaching/exercises.tsx` | **Yes** — `exercise.publish/close` (:114–121); row `Công bố`/`Đóng` (:201–218). Route `teaching/exercises` only, no detail form (`apps/admin/src/routes/teaching.routes.tsx:78`) | **DEMOTE candidate (GAP #3 — “others”)** |

**Form-owned (correct per authority — for contrast):** `class-detail.tsx` (`classSession.cancel/confirm`), `kpi-detail.tsx` (`kpi.confirm`), `payroll.tsx` (`payslip.finalize/reopen`, :125/:131 — detail), `shifts-detail.tsx` (`shift.approve/reject/cancel`), `aftersale-detail.tsx` (`afterSale advance/close` :73, resolve dialog :288), teaching FormPages (`assessment.confirm`, `sessionEvidence.publish`).

**Not HITL (confirm-on-action only, fine):** `bulk-import.tsx:147`, `class-placement.tsx:360/386`, `network-ip.tsx:684/732` — confirm dialogs for create/settings, not row workflow mutations.

---

## 2) Dead code — `resolve-after-sale-case-dialog` + demote leftovers

**Verdict: `resolve-after-sale-case-dialog` is NOT dead — it is form-owned (KEEP).**

- Only import: `apps/admin/src/pages/crm/aftersale-detail.tsx:25` `import { ResolveAfterSaleCaseDialog } ...`; rendered :288 `<ResolveAfterSaleCaseDialog caseId={resolveOpen ? caseId : null} …>`. This is the form's “Giải quyết” action — deleting breaks the UUID form.
- Zero imports from the list: `aftersale.tsx` imports only `CreateAfterSaleCaseDialog` (:19, :213). `rg -rn "resolve-after-sale|ResolveAfterSaleCaseDialog"` across `apps/admin/src` + `apps/e2e` matches only `aftersale-detail.tsx` + the dialog file itself (verified :25/:288; e2e journey `aftersale-case-lifecycle.journey.ui.spec.ts` resolves via the form flow :75–78).
- Coord matrix's `DEAD?` row → resolved: **form-owned, keep** (matches ui-console cook `cook-260812-ui-console-dead-dialog-teal.md`).

**Demote leftovers / stale comments (small cleanup, no dead code found):**

- `apps/admin/src/pages/crm/resolve-after-sale-case-dialog.tsx:3–5` — doc comment still says *“Shared ‘Giải quyết’ dialog for the **after-sale case list**”* — stale (list no longer resolves).
- `apps/admin/src/pages/crm/use-after-sale-actions.ts:6–9` — comment *“used by the after-sale case list (aftersale.tsx) and its dialogs”* — stale; list only uses `createMutation`, form uses `advance/resolve/close`.
- No unreferenced demote artifacts found (no orphan imports, no orphan dialog files; `use-after-sale-actions.ts` still consumed by the form :73).

---

## 3) Console grammar gaps — form pages vs reference receipt-detail / kpi-detail

Reference grammar (EntityHeader + HighlightStrip + WorkflowStatusbar):
`receipt-detail.tsx:559/618/660` · `kpi-detail.tsx:196/238/261` · also full on `class-detail`, `aftersale-detail`, `opportunity-detail`, `shifts-detail` (:293/:344/:367), `student-detail`.

| Form page | EH | HS | WS | Gap / note |
|-----------|----|----|----|------------|
| `hr/payroll.tsx` (payslip detail, :474–530) | 0 | 0 | 0 | **GAP** — has real workflow (`draft→finalized`, finalize/reopen :125–131, :200/:210) but PageHeader-only chrome |
| `hr/my-hr.tsx` (self KPI/payslip, DetailPage :307) | 0 | 0 | 0 | **GAP (low)** — self-service view; status via StatusBadge :138/:234; no workflow actions |
| `teaching/report-cards.tsx` (FormPage :162) | 0 | 0 | 0 | **GAP** — `assessment.confirm` workflow “Xác nhận & Phát hành” :123; PageHeader-only |
| `teaching/session-assessment.tsx` (FormPage :139) | 0 | 0 | 0 | **GAP (low)** — per-row confirm :275, “Xác nhận tất cả” :150 |
| `teaching/session-evidence.tsx` (FormPage :203) | 0 | 0 | 0 | **GAP (low)** — publish action; PageHeader-only |
| `finance/receipt-create.tsx` (FormPage :233) | 0 | 0 | 0 | **WS N/A** (compose, no status yet) — EH/HS optional |
| `attendance/check-in-out.tsx` (FormPage `header={null}` :704) | 0 | 0 | 0 | **N/A-as-form** — dialog-as-form for punch ticket; disappears if GAP #1 form-depth lands |
| `admin/shift-config.tsx` / `admin/network-ip.tsx` (SettingsShell DetailPage :300/:326) | 0 | 0 | 0 | Exempt — settings screens, not document forms |
| `teaching/session-detail.tsx` | 2 | 2 | 0 | Partial — no approval workflow (status via StatusBadge :341/:365); acceptable, note only |
| `parents/parent-detail.tsx` | 2 | 2 | 0 | Partial — active-flag only (:161/:201), no workflow; acceptable, note only |

**Ranked for form-depth parity:** (1) `payroll.tsx` — real workflow, director-facing; (2) `report-cards.tsx` — publish workflow; (3) others low/exempt. All are **additive grammar**, no HITL move — safe, testable via component tests.

---

## 4) TEKY teal / raw style residual vs CMC tokens

**TEKY teal `#00a09d`/`#017e84`: GONE from working tree** (landed `2947d6a`, re-verified — `rg` returns 0 hits tree-wide).

- `apps/admin/src/pages/attendance/shifts.tsx:44–45` — now `--ws-teal: var(--cmc-brand)` / `--ws-teal-dark: var(--cmc-brand-hover)`; comment :39 “accent via CMC Console tokens (no free TEKY teal)”. Source-lock test: `apps/admin/src/pages/attendance/shifts-ws-css-tokens.test.ts`.
- Reference tokens: `packages/ui/src/tokens.css:11` `--cmc-brand: #0071e3`.

**Residual raw neutrals (micro token-hygiene, not brand violation):**

- `shifts.tsx` WS_CSS still carries ~15 raw grays (`#dee2e6` :46 ≈ `--console-gray-300`, `#6c757d` :47 ≈ `--console-gray-600`, `#f8f9fa` :49 ≈ `--console-gray-100`, plus `#495057/#e9ecef/#868e96/#adb5bd/#343a40/#212529/#ced4da/#f1f3f5` in the sheet :75–175). ui-console cook intentionally left these as “local sheet neutrals”.
- `teaching/attendance.tsx:54` and `teaching/panels/attendance-panel.tsx:32` — `UNMARKED_CONFIG` raw grays `#868e96/#f1f3f5`.
- `apps/admin/src/pages/login.css:23` — `--cmb-brand: #4f7dfb` **overrides** the CMC brand token inside `.login-page`. Documented exception in-file (:1–9: pre-auth dark front door, purpose-built controls) — flag, don't touch without product sign-off.

**Compliant for reference:** `shifts-detail.tsx` MATRIX_CSS uses token-first vars with fallbacks (`var(--console-border, #dee2e6)` :113–116).

---

## 5) Workspace agent surface — plans/ count, LOCKED vs noise, lean index

**Size:** `plans/` = 16M · **86** dated plan dirs (`plans/26*/`) · 320 reports in `plans/reports/` (34 brainstorm, 20 research, 12 cook, 10 code-reviewer, 8 test, 8 brainstorm-advise, 7 xia-compare, 7 impl, …) · templates(4) · journals(3) · jules(2) — **938 tracked files** total. `docs/` = 1.5M · 149 tracked files.

**LOCKED / live authority (agents should read; everything else is history):**

| Doc | Status |
|-----|--------|
| `docs/ux-resource-centric-structure.md` | **LOCKED** 2026-08-11 — resource-centric UX, anti-bloat |
| `docs/design-system-console.md` | Shipped authority for admin chrome/tokens (no free teal) |
| `docs/06-kien-truc-url-routing.md` | URL grammar (TL06) |
| `docs/system-architecture.md` | As-built |
| `docs/WORKSPACE-LEAN.md` | **New (4267eb5)** — agent entry: where to work, no invent Duyệt apps, CI gates |
| `plans/reports/INDEX-live-260812.md` | **New (4267eb5)** — live pointer: authority links + PR #110 + residual matrix pointer |

**Archive noise (keep — do NOT mass-delete):** 86 dated `plans/26*/` dirs, ~318 older reports, TL00–TL31 frozen corpus, `docs/contracts|stories|journals|decisions`. Root noise: `harness.db*` (ignored), `design-runtime-login.png` (ignored), `codeql-agent-results/` (ignored), `acceptance-report/` (ignored), `presentation-deck/` (ignored), `release-manifest.json` (**tracked**).

**Lean index — status: ALREADY DELIVERED by ui-lean slice** (no new write needed from scout):
`docs/WORKSPACE-LEAN.md` + `plans/reports/INDEX-live-260812.md` + `docs/README.md` pointers + `AGENTS.md` bullet (commits `4267eb5`). Remaining (small, docs-only):
1. Refresh `INDEX-live-260812.md` — flip the `resolve-after-sale-case-dialog` row from `DEAD?` to **form-owned keep** (this matrix as source) and link this report.
2. Publish a **read-only retire-list proposal** (candidates: `docs/12-design-system-ui.md` superseded for admin by `design-system-console.md`; TL-era pre-UAT plans) — propose, never delete.
3. Root-noise: keep `.gitignore`d items out of git status; leave `release-manifest.json` tracked (used by CI/release).

---

## 6) Ranked next 3 cook slices (small · TDD · non-overlapping ownership)

| # | Worker | Slice | Scope (files) | Why this rank | TDD surface |
|---|--------|-------|---------------|---------------|-------------|
| S1 | `ui-console` | **check-in `manualPunch` form-depth** — closes the last true HR dual-HITL inbox (GAP #1) | `apps/api/src/checkin/router.ts` (+ small `manualPunch.get` query), `apps/admin/src/routes/hr.routes.tsx` (`/hr/checkin/:ticketId`, static-before-dynamic), `apps/admin/src/pages/attendance/check-in-out.tsx` (ApproveTicketsTab row buttons :433–437 → `Mở phiếu` navigate; move Duyệt/Từ chối into detail form), new `check-in-ticket-detail.tsx` | Highest residual value (only remaining row-Duyệt inbox in HR); ticket data already in `list` (`apps/api/src/checkin/router.ts:573/:588` include appUser); ADR 0043 removed `create` so no compose ambiguity | API `manualPunch.get` test + existing `check-in-out.test.tsx` (inbox tab tests :264–279) + new form component test |
| S2 | `ui-console` | **rewards demote** — row actions → navigate to new UUID detail (GAP #2) | `apps/api/src/rewards/reward-router.ts` (+ `rewards.get` by id), `apps/admin/src/routes/admin.routes.tsx` (+ `engagement/rewards/:rewardId`), `apps/admin/src/pages/engagement/rewards.tsx` (row buttons :120–127 → navigate), new `rewards-detail.tsx` | Flagged GAP #2 in coord; backend has no `get` yet so API add is the real work — keep slice small (get = one `findUnique` + permission) or fall back to explicit KEEP-document | `rewards.get` API test + rewrite `rewards.test.tsx` row-action tests (:118–150) to navigation assertions |
| S3 | `ui-lean` | **workspace index refresh + retire proposal** (docs-only) | `plans/reports/INDEX-live-260812.md` (link this matrix, resolve DEAD?, add GAP #3 exercises row), `docs/WORKSPACE-LEAN.md` (optional retire-list pointer), new `plans/reports/proposal-260812-docs-retire-list.md` (read-only, no delete) | Zero product-code risk; makes agent surface match current truth after this scout | Docs review only (no unit tests); cross-check links resolve |

**Non-overlap:** S1 touches `checkin/`+`check-in-out.tsx`; S2 touches `rewards/`; S3 touches `docs`+`plans/reports` — disjoint. **Kept out (non-goals):** parents link-request demote (owner lock), KPI bulk removal, TEKY kanban clone, any merge.

---

## Status

**DONE_WITH_CONCERNS**

- **Done:** full residual matrix with file:line evidence; dead-dialog verdict resolved (form-owned, keep); teal residual confirmed gone (HEAD `2947d6a`); workspace lean index already landed (HEAD `4267eb5`) with only refresh/retire-list left; 3 ranked TDD slices with disjoint ownership.
- **Concerns (by design / honest):**
  1. Working tree moved mid-scout (two parallel cook commits landed) — all claims re-verified at HEAD `2947d6a`, but the coord report and INDEX were written against `8a19673`.
  2. Residual dual-HITL remains on 3 surfaces (check-in punch, rewards, exercises publish/close) — check-in + rewards are S1/S2; exercises logged as GAP #3, not yet scheduled.
  3. `login.css:23` still shadows the CMC brand token (`#4f7dfb`) — documented in-file exception; needs product sign-off before touching.
  4. WS_CSS raw gray neutrals (~15 hexes) remain — micro token-hygiene, deprioritized below HITL work.

Report: `plans/reports/scout-260812-ui-workspace-residual-matrix.md`
