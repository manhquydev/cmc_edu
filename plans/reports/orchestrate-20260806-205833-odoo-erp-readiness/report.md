# Orchestrate Report — Odoo professional components ERP readiness

| Field | Value |
|-------|--------|
| **Run id** | `orchestrate-20260806-205833-odoo-erp-readiness` |
| **Spec** | `plans/reports/orchestrate-20260806-205833-odoo-erp-readiness/jobs.yaml` |
| **Intent** | Điều tra tình trạng xây dựng thành phần chuyên nghiệp theo design Odoo để **chuẩn bị rà soát** áp dụng triển khai toàn ERP admin |
| **Effect** | R0 observe only (read-only) |
| **Runtime** | internal (Grok explore ×4 + code-reviewer arbiter); `ak kit` empty — no headless kit skills |
| **Jobs** | 5/5 success |
| **Arbiter** | **pass** for START review · **not** pass for merge-ready |
| **Arbiter independence** | same-family disclosed |

---

## Outcome (đọc nhanh)

| Câu hỏi | Trả lời |
|---------|---------|
| Có thể **bắt đầu rà soát** design Odoo chuyên nghiệp toàn `apps/admin`? | **CÓ** |
| Có thể claim **merge-ready / production Odoo parity**? | **KHÔNG** |
| Shell design3 đã ship (unit/static)? | **CÓ** — OdooNavbar + `.o_web_client` + `odoo.css` |
| Search OS đầy đủ như Odoo? | **KHÔNG** — FilterBar lite ~52% lists; facets/GroupBy/Favorites parked |
| LMS có chuyển Odoo? | **KHÔNG** (by design — giữ premium) |

### Số liệu khóa (khóa tại kickoff review)

| Metric | Value |
|--------|------:|
| Routed pages on central frames | **40/44 (90.9%)** |
| All page TSX framed | **40/55 (72.7%)** |
| List + FilterBar | **12/23 (~52%)** |
| Inventory (directional) | ~28 SHIPPED · 24 PARTIAL · 9 MISSING · 8 SKIP |
| Odoo pin | `7de220c` @ 19.0 (`plans/260806-odoo-ui-component-dissection/ODOO_PIN.txt`) |
| Design3 plan status | `validation` |

---

## Job results

### Stage 1 — parallel scouts (concurrency 4)

| Job | Agent | Status | Summary |
|-----|-------|--------|---------|
| `job-component-inventory` | explore | success | Matrix shell/CP/Search/Form/Kanban/fields; residual Search OS + ck-mirror |
| `job-admin-adoption` | explore | success | Module adoption map; LMS boundary confirmed |
| `job-validation-gates` | explore | success | Unit proven; ui-e2e + acceptance + visual smoke OPEN |
| `job-gap-backlog` | explore | success | P0–P2 backlog + review sequence |

Subagent ids:

- inventory: `019fd75f-cc4d-7222-9b30-da9a393401ea`
- adoption: `019fd75f-cc4e-7d60-81d0-73d49c4fe8f3`
- gates: `019fd75f-cc4e-7d60-81d0-73efde356703`
- backlog: `019fd75f-cc4e-7d60-81d0-73f12a01c067`
- arbiter: `019fd762-ef90-7403-85bc-7fbe39cba506`

### Stage 2 — arbiter

**Verdict: pass** — ready to START admin-only professional Odoo component review.

Conditions:

1. Scope = `apps/admin` + `@cmc/ui` Odoo layer; LMS out of scope  
2. Review = inventory/depth/hygiene — not merge certificate  
3. Lock baseline metrics above  
4. Pre-log known debt (Parents FilterBar D1, dual CSS, validation open, pin doc stale)  
5. Sequence: shell → lists (finance/CRM first) → detail/form → kanban/calendar → exemptions → optional parity  
6. Parallel (does not block start): green `ui-e2e` + `acceptance:report` re-measure + human smoke  

---

## Safe claims vs overclaims

### Safe SHIPPED (baseline review)

- Admin shell Odoo language (navbar, app-switcher, systray, chrome-suppress change-password)
- Page frames List/Detail/Form/Dashboard/SettingsShell as default routed grammar (~91%)
- KanbanBoard, WorkflowStatusbar (pilots), ControlBar/DataTable, DateField (date)
- Float ladder unit-proven (navbar 1000 → toast 1100 → dialog 1150 → cmd 1200)
- Deviations locked: CMC blue interactive, Inter, no OWL

### OPEN / PARTIAL (score as depth, not shell failure)

- Search OS (no SearchChrome/facets/GroupBy/Favorites)
- FilterBar coverage + slot hygiene (Parents D1)
- CP densify / Odoo L-C-R band geometry
- G2 fields: datetime, monetary, boolean, async m2o, x2many, binary
- Dual `ck-*` mirror residual
- Merge gates: full ui-e2e, acceptance 38-flow re-measure, human visual smoke

### Do not claim

- “Odoo professional UI complete” / “production-ready Odoo ERP”
- “design3 CI-proven on design3 branch”
- Main historical **31/38** as post-design3 proof
- “Search system shipped” because FilterBar exists
- Frame **~45/55** (double-count)

---

## Backlog for review kickoff

### P0 (pre-log / discipline)

1. One-pager baseline metrics + non-goals  
2. Cite pin `7de220c` (not stale evergreen `5568f6e`)  
3. Seed D1 Parents FilterBar slot + filter semantics D2–D4  
4. Split scorecards: (a) design grammar (b) CI/merge  

### P1 (during review / small hygiene)

1. Execute module sequence finance → CRM → students/classes → teaching → admin → HR → engagement → parents  
2. Hard-fail: FilterBar outside ControlBar (except documented exemptions)  
3. Detail tier honesty (EntityHeader/Statusbar only when tier requires)  
4. Human smoke: toast, ⌘K, CRM list/kanban, cancelled receipt, teaching calendar  

### P2 (optional after themes stabilize)

- Raise FilterBar where API supports  
- G2 field slices by multi-page demand  
- SearchChrome only if re-open trigger  
- Optional `ck→o` rename  

### Explicit non-goals (do not FAIL)

OWL, DomainSelector, pivot indent, Odoo calendar grid-shell, LMS Odoo chrome, SearchPanel unless needed, dialogs/panels as frames, empty FilterBar on unfilterable lists.

---

## Recommended review checklist (one page)

```text
[ ] Authority: ODOO-COMPONENT-MAP + VIEW-GRAMMAR + design-system-odoo non-goals
[ ] Shell: navbar, brand=module, stacking, float layers
[ ] Each routed page: correct frame OR listed exemption
[ ] Each ListPage: filters only in ControlBar slot
[ ] FilterBar: 0–2 fields; clear/default honest
[ ] No page-local DomainSelector / mega SearchChrome
[ ] Detail tier: EntityHeader/Statusbar only when required
[ ] Dual sheet on Detail/Form
[ ] Kanban/calendar: CMC recipes, not OWL ports
[ ] Dialogs/panels: no double-shell
[ ] Field gaps = OPTIONAL log, not FAIL
[ ] CI claims only after ui-e2e + acceptance:report on HEAD
```

---

## Validation gates (merge track — parallel)

| Gate | Status |
|------|--------|
| Unit/static odoo layer + shell | PROVEN |
| `pnpm check:ui-frames` / typecheck-and-test | CI-wired |
| Full `ui-e2e` on design3 branch | **OPEN** |
| `pnpm acceptance:report` vs 38-flow baseline | **OPEN** |
| Human visual smoke | **OPEN** |
| `ck-*` → `o-*` rename | optional |

Commands of record:

```bash
pnpm typecheck && pnpm test
pnpm check:ui-frames
# after stack: PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium
pnpm acceptance:report
pnpm business:verify --strict
```

---

## Authority paths

| Layer | Path |
|-------|------|
| Evergreen design | `docs/design-system-odoo.md` |
| Component map | `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` |
| Design3 rollout | `plans/260805-1920-design3-admin-rollout/` |
| Dissection process | `plans/260806-odoo-ui-component-dissection/` |
| G1/G2 audit | `plans/260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit/` |
| Code | `packages/ui/src/odoo*`, `packages/ui/src/components/*`, `apps/admin/src/shell/shell.tsx` |

---

## Checks run by coordinator

- Live runtime probe → `runtimes.json` (internal preferred; ak kits empty; claude/codex present but unused for R0)  
- 4× explore R0 parallel  
- 1× code-reviewer C3 arbiter  
- No product writes, no commits, no worktrees needed  

## Unresolved

1. Exact 28/24/9/8 inventory not re-derived row-by-row in arbiter (directional from scout A)  
2. Evergreen pin citation may lag `ODOO_PIN.txt`  
3. No CI green artifact for design3 branch captured in this run  
4. Same-family arbiter — escalate merge-blocking decisions to human or other model family  

---

**Orchestrate Result**
- Spec: `plans/reports/orchestrate-20260806-205833-odoo-erp-readiness/jobs.yaml`
- Report: `plans/reports/orchestrate-20260806-205833-odoo-erp-readiness/report.md`
- Jobs: 5 success / 0 failed / 0 blocked
- Arbiter: **pass** (START review) with concerns on merge claims
- Checks: read-only scout + reconcile; no e2e executed this run
