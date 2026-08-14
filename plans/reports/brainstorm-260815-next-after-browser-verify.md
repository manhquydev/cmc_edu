# Brainstorm — NEXT after design-bridge live verify (2026-08-15)

**Mode:** Operate (admin ERP) · `ak:brainstorm`  
**Inputs:** Live verify `plans/reports/verify-browser-260815-design-bridge-live.md` (`develop@fc1f76d`, #142–#145); `design-lab/system/BRIDGE.md` § ListPage recipe; Classes plan `plans/260814-2346-classes-listpage-empty-recipe-after-144/`; prior scout `brainstorm-260814-scout-next-ui-after-144.md`  
**Index authority:** Program enum unchanged (`apps/api/src/class/program.ts`). Empty grammar authority = BRIDGE checklist (prefer under-claim).

---

## 0. Locked evidence (do not re-litigate)

| Surface | Live verdict |
|---------|--------------|
| Brand purple chrome `#71639e` | PASS |
| CRM stages O3/O4 brand, O5 success + table sort | PASS |
| Courses `CategoryChip` (UCREA) | PASS |
| Classes empty (#145): search → neutral string, no fake `filtered` | PASS |
| Aftersale first-run | PASS |
| Finance sort + no dishonest widen | PASS |
| Finance draft → brand badge | **PARTIAL** — code shipped; DB **0 draft / 7 approved** |
| Parents (and payroll / exercises / shifts) | **GAP** — bare string empty, no `data-empty-kind` |

**Verify recommended next (starting point, challenged below):** (1) Parents ListPage empty recipe Wave 8 one PR; (2) re-seed idempotent draft receipt; (3) hold Wave 4B / other lists; no-go shell/kanban/mass fan-out.

---

## 1. Contract (accepted for this wave)

| Field | Content |
|-------|---------|
| **Outcome** | Staff on prod-sim see **honest empty grammar** on `/admin/parents` (both tabs that render DataTable empties), matching BRIDGE under-claim rules — not a Classes clone. Parallel: at least **one draft receipt** visible in finance list so waiting `StatusBadge` tone `brand` is eye-provable (seed already written; environment must carry it). Wave 8 continues **one module / PR**; no shared-atom or shell work. |
| **Constraints** | Solo + required CI (`typecheck-and-test`, `ui-e2e`); one product concern per PR; OPENEDUCAT visual contract; **no invented empty kinds**; **no invent create CTA** if product has no parent-create path; button labels must not substring-collide Playwright journeys; seed changes stay idempotent (`scripts/seed-local-sim-demo.ts`); Pattern reference files: Classes `apps/admin/src/pages/classes/index.tsx` + `index.test.tsx` for *structure*, Students `apps/admin/src/pages/students/index.tsx` for *under-claim honesty*. |
| **Non-goals** | Wave 4B (button states / tabs indicator); Wave 5 saved views; Wave 6 archetype spacing; Wave 9 shell / cockpits; CRM kanban redesign / DnD; mass fan-out of payroll / exercises / shifts / users in the same PR; finance API select-all-matching IDs; inventing `parent.create` UI; flipping global `STATUS_SOFT['draft']`; attendance matrix / gradebook. |
| **Acceptance (observable)** | (1) Unit tests on `apps/admin/src/pages/parents/index.test.tsx`: for each empty path touched, assert either intentional `data-empty-kind` **or** explicit absence (Students-style honesty) — never accidental. (2) Live or Playwright-on-local-sim: Parents empty DOM matches the chosen recipe; screenshots under `/tmp/cmc-ui-verify/` or equivalent. (3) After seed: `finance.receiptList` with `status=draft` returns ≥1 row named `[SEED] Phiếu nháp chờ duyệt` (or existing draft from script); screenshot finance list shows purple waiting badge. (4) CI green on the Parents PR; seed re-run is ops evidence, not a required CI gate unless seed script itself changes. |

---

## 2. Assumption challenge (must drive recipe shape)

### Challenge A — “Same BRIDGE checklist as Classes”

**Classes** (`apps/admin/src/pages/classes/index.tsx` ~242–252): no filter + `total===0` → `first-run` + CTA **“Thêm lớp học đầu tiên”** that opens a real create dialog.

**Parents** (`apps/admin/src/pages/parents/index.tsx`):

| Tab | Empty today | Default “filter” | Product create? |
|-----|-------------|------------------|-----------------|
| Yêu cầu liên kết | `empty="Không có yêu cầu nào"` (~255) | `status=pending` (`hasClear: false`) | No — queue of guardian self-service requests |
| Tất cả phụ huynh | bare strings for missing vs all (~423–426) | `email=missing` default | No — accounts come from `finance.receiptApprove` / provisioning |

Copying Classes `first-run` + invent CTA **would be a semantic lie**. Correct Wave 8 move is **Students-shaped honesty** (see #144 students recipe: no fake kinds), with optional `filtered` **only** if a proven unfiltered/baseline total exists in the same render path.

### Challenge B — “GAP includes payroll/exercises/shifts ⇒ bundle them”

Verify correctly lists them as still bare. Bundling = mass fan-out, already **NO-GO** in BRIDGE Wave 8 (“one module per PR”) and prior scout. Naming them in Outcome invites scope creep; they stay **backlog pointers only**.

### Challenge C — “Draft brand needs a code fix”

Verify: PARTIAL because **DB had 0 draft**. Seed path already exists:

```228:301:scripts/seed-local-sim-demo.ts
  // ── Stable draft fixture for the finance approval queue ──────────────────
  const draftStudentName = '[SEED] Phiếu nháp chờ duyệt';
  // ... idempotent find-or-create, left unapproved
```

Default GO for brand proof = **re-run seed** (`LOCAL_SIM_SEED_ALLOW=1 tsx scripts/seed-local-sim-demo.ts`), not a new finance UI PR. Only touch seed code if re-run fails idempotency or draft is auto-approved by another step.

---

## 3. Option comparison (≤3)

### A — Parents empty honesty (Wave 8, one PR) — **recommended primary**

**Scope:** `apps/admin/src/pages/parents/index.tsx` (+ `index.test.tsx`). Adopt BRIDGE empty rules **under-claim first**:

- Link-requests tab: keep / refine **neutral string** when `status` filter is on and there is no unfiltered total; do **not** claim `first-run` or `done` without evidence. Optional later: second query for baseline → `filtered` + clear — **out of this PR** unless already cheap.
- All-parents tab: `email=missing` or `q` active → never invent `filtered` without baseline; `email=all` + empty `q` + `total===0` → still prefer bare string or a non-CTA empty title (no “Tạo phụ huynh”).
- Page clamp if pagination can go stale (mirror Classes if `page`/`total` already present).
- No sort / no bulk widen (page has neither dishonest widen today).

| Dimension | Score |
|-----------|-------|
| Complexity | Low (~0.5–1d) |
| Cost (solo) | One focused PR |
| Latency to value | Closes the only list GAP called primary in verify |
| Maintainability | High — recipe reuse, no new atoms |
| Risk | Medium if someone forces Classes `first-run`+CTA; Low if Students honesty |

**Pros:** Continues proven Wave 8 cadence (#145 Classes → Parents); closes visible bare-empty on a staff-facing dual-tab page.  
**Cons:** Less “pretty” than first-run marketing empty; stakeholders may want `data-empty-kind` everywhere — resist.  
**Second-order:** Correct Parents recipe becomes the template for **queue / provisioned-entity** lists (payroll drafts, shift queues) so future fan-outs don’t copy Classes create-CTA by mistake.

### B — Seed-only housekeeping (draft brand proof) — **recommended parallel, not instead**

**Scope:** Ops re-run of `scripts/seed-local-sim-demo.ts`; only edit script if find-or-create fails or another step approves the seed draft. Re-verify finance list brand badge.

| Dimension | Score |
|-----------|-------|
| Complexity | Very low (ops) / low if script bug |
| Cost | Minutes–hours |
| Latency | Immediate demo/audit credibility |
| Maintainability | N/A if no code |
| Risk | Low; seed flags already gated |

**Pros:** Closes PARTIAL without a product PR; validates #144 brand call sites.  
**Cons:** Does not advance Wave 8 module coverage.  
**Second-order:** If seed is skipped forever, every future audit re-opens “brand never visible” false defect.

### C — Wave 4B shared atoms **or** multi-list fan-out — **hold / no-go this wave**

| Variant | Why not now |
|---------|-------------|
| **4B** button states + tabs indicator | Shared CSS/token work; no new empty honesty; verify explicitly held |
| **Mass fan-out** payroll + exercises + shifts | Multi-concern; high empty-kind lie risk; BRIDGE forbids batch Wave 8 |

| Dimension | Score |
|-----------|-------|
| Complexity | Medium–high |
| Cost | 1–3d+ |
| Latency | Visible polish / breadth |
| Maintainability | 4B good long-term; fan-out poor if rushed |
| Risk | High for fan-out; medium for 4B (a11y name / journey breakage) |

**Pros:** 4B pays off all pages; fan-out looks like progress.  
**Cons:** Diverts from verify’s primary GAP; fan-out violates one-PR rule.  
**Second-order:** 4B before another list recipe means fewer module proofs; mass fan-out encodes wrong empty kinds across queues.

---

## 4. Recommendation — smallest GO

**GO = A + B′ (parallel), HOLD C.**

1. **Primary delivery PR:** Parents empty honesty (Option A) — Wave 8 successor to Classes `#145` / plan `260814-2346`.  
2. **Parallel ops (B′):** Re-seed local-sim so draft receipt brand is visible; open a tiny seed PR **only if** idempotent path is broken.  
3. **HOLD:** Wave 4B, payroll/exercises/shifts recipes, finance matching-IDs API.  
4. **NO-GO:** Shell Wave 9, kanban redesign, mass ListPage fan-out.

**Why smallest that still meets contract:** Outcome needs one more **honest** list module + demo evidence for brand. A is the only product PR required; B′ is ops. C increases complexity without closing the named Parents GAP.

**Do not choose A alone** if owner needs brand screenshot for demos this week — then B′ is mandatory ops.  
**Do not choose B alone** if Wave 8 cadence must continue — seed does not move module grammar.

### Suggested PR-sized phases (for `/ak:plan`)

| Phase | Work | Evidence |
|-------|------|----------|
| **P1** | Parents empty recipe (honesty-first) in `apps/admin/src/pages/parents/index.tsx` + tests | Unit: requests empty; all-parents missing-email empty; search/q empty — kinds only when evidenced; no create CTA invent |
| **P2** | Housekeeping: re-run seed; optional INDEX / BRIDGE one-liner “Parents next after Classes” | Live: draft count ≥1; screenshot brand badge; note in verify follow-up |
| **P3** | (out of contract) Wave 4B **or** next single list (e.g. payroll) — new brainstorm |

### Concrete file anchors

| Path | Role |
|------|------|
| `apps/admin/src/pages/parents/index.tsx` | Dual-tab empties ~255, ~423–426; ListPage shell ~524 |
| `apps/admin/src/pages/parents/index.test.tsx` | Extend empty-recipe cases (today email/modal focused) |
| `apps/admin/src/pages/classes/index.tsx` + `index.test.tsx` | Structural reference — **not** semantic clone |
| `apps/admin/src/pages/students/index.tsx` | Under-claim empty reference |
| `packages/ui/src/components/empty-state.tsx` | `data-empty-kind` contract (consume only) |
| `design-lab/system/BRIDGE.md` § ListPage adoption recipe | Authority checklist |
| `scripts/seed-local-sim-demo.ts` ~228–301 | Idempotent draft fixture |
| `plans/reports/verify-browser-260815-design-bridge-live.md` | Evidence lock |

---

## 5. Risks

1. **Classes-clone CTA lie** — inventing “Tạo phụ huynh” / `first-run` on a provisioned queue → mitigation: Students honesty default; red-team empty kinds before cook.  
2. **Dual-tab filter defaults look like “no filters”** — `pending` / `missing` are domain defaults with `hasClear: false` → treat as **filters on** for empty kind purposes.  
3. **Seed drift** — someone approves `[SEED] Phiếu nháp chờ duyệt` → mitigation: seed find-or-create by studentName; re-run before demos.  
4. **ui-e2e name collision** — new empty CTA labels → mitigation: no new primary CTA unless product-real; prefer copy-only empty.

---

## 6. Decision log

| Decision | Status |
|----------|--------|
| Next product PR = Parents empty honesty (Wave 8), not Classes clone | **Recommended GO** |
| Parallel = re-seed draft receipt for brand eye-proof | **Recommended GO (ops)** |
| HOLD Wave 4B + other bare lists | **Recommended** |
| NO-GO shell / kanban / mass fan-out | **Recommended** |
| Owner override needed? | Only if owner wants 4B before Parents, or insists on `first-run`+create for parents despite no create path |

---

## 7. Next step

Owner accept A+B′ (or override) → `/ak:plan` with this report as context (Parents honesty PR + optional seed fix phase).  
**Do not implement in brainstorm.**
