# Red-team: Scope & Complexity Critic / Contract Verifier

**Plan:** `plans/260806-1045-odoo-grammar-gap-cook/`  
**Mode:** Hostile YAGNI — cut gold plating / over-scope (ignore default code-quality nits)  
**Verified:** 2026-08-06 against repo via grep/read (not plan prose alone)  
**Verdict:** **CUT before cook** — Phase 1 must not serialize grammar work; Phase 6 + Phase 5 e2e are gold plate relative to synthesis.

---

## Scope

| Item | Value |
|------|--------|
| Files reviewed | `plan.md`, `phase-01`…`phase-06` |
| Authority cross-check | `xia-compare-synthesis-260806-odoo-layout.md`, `odoo.css`, shell/navbar, audit runner, stacking unit |
| Focus | P0 deploy blocking cook, phase-1 deps, docs phase, e2e ambition |
| Finding count | **8** |

---

## Findings

### F1 — P0 [BLOCK COOK SERIALIZATION] Phase 1 is ops evidence, not cookable grammar

**Claim in plan:** Phase 1 is first cook phase; success needs live `menuCoveredCount=0` or a blocker artifact; plan-level acceptance still wants the audit when deploy exists.

**Evidence:**
- Synthesis ranks P0 as **ops**, not code: `plans/reports/xia-compare-synthesis-260806-odoo-layout.md:29` (`Live re-audit … Effort cue: ops`).
- Phase 1 admits fix already landed; work is proof-only: `phase-01-p0-stacking-reaudit.md:14-15`, `:32-34`.
- Stacking CSS already present: `packages/ui/src/odoo.css:97-103` (`z-index: 1000`).
- Unit contract already exists: `packages/ui/src/odoo/odoo-shell-stacking.test.ts:21-28`.
- Plan acceptance still couples cook done-ness to deploy: `plan.md:63`.

**Cut:** Demote Phase 1 out of cook critical path — sibling checklist / post-deploy note. Do **not** start `/ck:cook` waiting on staging image rebuild. Unit green + existing audit residue in `outputs/design3-frontend-audit/` is enough interim.

---

### F2 — P0 [UNNECESSARY DEP] Phase 2 `dependencies: [1]` invents a gate

**Claim in plan:** Brand phase waits on Phase 1.

**Evidence:**
- `phase-02-brand-module-name.md:7` → `dependencies: [1]`.
- Brand override is a one-line shell prop, orthogonal to z-index: `apps/admin/src/shell/shell.tsx:134` (`brand="CMC EDU"`).
- Navbar already implements active-module default: `packages/ui/src/odoo/odoo-navbar.tsx:40`.
- Phases 3–5 correctly have `dependencies: []` — proves brand→stacking edge is inconsistent.

**Cut:** Set Phase 2 `dependencies: []`. Brand cook must not wait on deploy audit.

---

### F3 — P0 [PLAN CONTRACT] `blockedBy: dissection` is a fake serial lock

**Claim in plan:** Cook blocked by `260806-odoo-ui-component-dissection` while also asserting “already refreshed”.

**Evidence:**
- `plan.md:8`, `:28` (`blockedBy` + “already refreshed”).
- Dissection plan still `status: active` and still lists live re-audit as open work: `plans/260806-odoo-ui-component-dissection/plan.md:9`, `:125`.
- Synthesis next command was **brand + statusbar + kanban**, not “finish dissection then cook”: `xia-compare-synthesis-260806-odoo-layout.md:41-44`.

**Cut:** Clear `blockedBy` (or mark soft `relatedTo`). Do not treat an open ops checkbox in the process plan as a cook mutex.

---

### F4 — P1 [YAGNI / STALE THREAT] Phase 4 “double gutter” mostly already mitigated — full phase is overbuilt

**Claim in plan:** Fix potential 16px double gutter (gap + card margin) + responsive width as a half–1 day phase.

**Evidence:**
- Col body intentionally replaces margin with gap: `packages/ui/src/odoo.css:497-510` (comment + `margin-bottom: 0` on cards in body).
- Base `.o-kanban-card` still has `margin-bottom: var(--odoo-kanban-gutter)` at `:536-539` — only bites **outside** the override selectors; in-board path is already zeroed.
- Xia itself called double-gutter a **question for DevTools**, not a proven bug: `plans/reports/xia-compare-260806-odoo-kanban.md:250-254`, `:441`.
- Synthesis effort cue: “small” / “if real”: `xia-compare-synthesis-260806-odoo-layout.md:32-33`.

**Cut:** Replace Phase 4 with a **15-min verify** gate (DevTools on CRM board). If spacing OK → only optional `@media` width token; do not budget 0.5–1d / full phase machinery.

---

### F5 — P1 [E2E AMBITION] Phase 5 gold-plates QA beyond “optional ops pad + sticky proof”

**Claim in plan:** Ship ops td padding **and** Playwright/audit scroll sticky **and** modal paint-order proof; skip+issue allowed as success.

**Evidence:**
- Synthesis: sticky e2e + **optional** ops padding as one P2 line: `xia-compare-synthesis-260806-odoo-layout.md:34`.
- Sticky thead **already shipped** (`position: sticky; z-index: 1`): `packages/ui/src/odoo.css:423-426`.
- Cell padding tokens already Odoo-dense: `packages/ui/src/odoo.css:60-61`, `:441-442`. Ops wrap densifies chrome padding, not cells: `:1515`.
- Phase success hard-requires sticky artifact **or** skip: `phase-05-list-ops-pad-sticky-e2e.md:31-38`.
- Open question still unresolved (which harness?): `plan.md:80`.
- Audit runner already walks shell coverage; sticky thead/modal probe is **new product** in the runner (`apps/e2e/design3-frontend-audit.mjs:339`, `:453`) — extending it is a feature, not a grammar CSS cook.

**Cut:** Split or shrink:
1. Optional CSS: `.o-wrap--ops .o-list-table td|th` padding only if product still wants tighter than tokens — else **drop**.
2. Sticky/modal e2e → **deferred QA ticket**, not cook exit. Skip+issue success criterion is hollow theater — remove it or make the phase docs-only skip.

---

### F6 — P1 [DOCS PHASE] Phase 6 is process bureaucracy bolted onto cook

**Claim in plan:** After 2–5, sync evergreen map + dissection report + dissection plan acceptance + cook delta (+ optional `docs/design-system-odoo.md`).

**Evidence:**
- `phase-06-docs-matrix-sync.md:7` waits on `[2, 3, 4, 5]`; `:14` “No product UI”.
- Touches four authority surfaces: `:23-27`.
- Map already knows brand decided/not coded and form sheet SHIPPED: `design-system/cmc-edu/ODOO-COMPONENT-MAP.md:123`.
- Plan-level acceptance re-requires evergreen sync: `plan.md:64`.

**Cut:** Collapse to **one** `reports/cook-delta.md` written in the cook PR. Touch `ODOO-COMPONENT-MAP.md` only for rows actually changed (brand/statusbar). Do **not** edit dissection backlog mid-flight as a sixth cook phase — that belongs to the dissection plan’s own hygiene.

---

### F7 — P1 [SCOPE EXPLOSION] Six phases vs synthesis “cook single P1 slice”

**Claim in plan:** Serial phases 1–6 through cook→test→review.

**Evidence:**
- Synthesis ranked backlog; next command named **three** code items (brand, statusbar sticky, kanban): `xia-compare-synthesis-260806-odoo-layout.md:41-44`, `:46`.
- Plan inflated to **ops audit + 3–4 CSS/UI + sticky e2e + multi-doc sync**: `plan.md:35-40`.
- Locked non-goals already carve OWL/CP/scroll-owner (`plan.md:19`, `:48-50`) — good — then Phase 1/5/6 re-import ops/QA/docs surface area.

**Cut:** Normalize cook phases to **2 (brand), 3 (statusbar sticky), 4′ (kanban verify/responsive only if fail)**. Park 1 / 5-e2e / 6 outside cook serial path.

---

### F8 — P2 [CONTRACT AMBIGUITY] Open questions fight “locked” brand decision

**Claim in plan:** Brand decision locked to active module label; still asks source-of-truth and leaves sticky e2e harness open.

**Evidence:**
- Locked: `plan.md:49` (Brand = active module label).
- Still open: `plan.md:78-80` (NAV_MODULES vs i18n; which e2e).
- Implementation path in Phase 2 already specifies remove override: `phase-02-brand-module-name.md:23`, `:27`.

**Cut before cook:** Close Q1 (“use `activeApp.label` / drop `brand=`”) and Q3 (“no new Playwright this sprint; unit + manual smoke only”). Unresolved harness choice is how Phase 5 bloat survives validate.

---

## Recommended normalize (planner)

| Keep in cook | Demote / cut |
|--------------|--------------|
| Phase 2 brand (no dep on 1) | Phase 1 → post-deploy ops checklist |
| Phase 3 statusbar sticky md+ | Phase 5 modal/scroll e2e → follow-up ticket |
| Phase 4 → verify-first; CSS only if 16px or missing 90vw confirmed | Phase 6 → cook-delta + surgical map row updates only |
| Clear `blockedBy` dissection | Plan acceptance audit line → optional ops, not cook gate |

---

## Metrics (plan hygiene, not code)

| Check | Result |
|-------|--------|
| Plan claims grep-verified | Yes (paths/selectors exist) |
| P0 items that are real cook code | **0** (audit/ops only) |
| Phases with false serial deps | Phase 2→1; Phase 6→2..5 |
| Synthesis “optional” turned mandatory | Ops pad + sticky e2e (Phase 5) |
| Docs-only cook phase | Phase 6 |

---

## Unresolved (for planner, not cook)

1. Is any staging admin image available **this sprint**? If no → F1/F2 mandatory.
2. Product: ops cell pad below existing `--odoo-list-cell-padding-*` — yes/no? Default **no** until measured.

---

**DONE — 8 findings**
