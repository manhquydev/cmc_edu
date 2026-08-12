# GAP-5 — Docs drift audit (makeup / curriculum / gap-aware unit)

**Mode:** `/ak:docs` audit — **read-only**, no doc edits, no code edits, no commit  
**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Date:** 2026-08-12  
**Scope scanned:** `docs/` (incl. `docs/decisions/`), `AGENTS.md`, `CLAUDE.md`, `README.md`  
**Out of scope for path list:** `plans/` (not requested) — referenced only as external truth when code comments point there  

---

## Ground truth (code as of audit)

| Change | As-built evidence |
|--------|-------------------|
| **(1) Gỡ buổi bù** | Migration `packages/db/prisma/migrations/20260812120000_curriculum_level_text_drop_session_makeup/migration.sql` drops `isMakeup`, `makeupForSessionId`. `ClassSession` model no longer has those columns. `rg addMakeup\|isMakeup\|makeupForSessionId` in `apps/api/src` → **0**. `open-tier.ts` L11–12: *“Makeup Tier B is intentionally removed”*. `session-done-sweep.ts`: cancel + restamp, **does not create makeup**. |
| **(2) Khung 96 unit + level String** | `CurriculumUnit.level String` (schema L785–786); comment SoT CSV → **96 units**. Import: `packages/db/prisma/import-curriculum-units.mjs` + `scripts/ensure-curriculum-units.ts` + seed calls import. Counts: UCREA 36 + Bright I.G 18 + Black Hole 42. Bright I.G holes: **40,44,48,52,56**. |
| **(3) Tiến trình gap-aware** | `packages/domain-lms/src/unit-progression.ts`: `programAxis`, `axis[anchorIdx + floor(k/4)]` — **không** `anchorOrder + floor(k/4)`. `package-grant.ts` walks axis for N real units. `stamp-sessions.ts` / `grant-units.ts` load axis from DB orders. |

**Note:** `docs/class-unit-spec.md` is **referenced by code** (`unit-progression.ts` L1, cancel/router comments) but **file does not exist under `docs/`** → agents following the pointer get a dead link; formula lives only in code.

---

## Priority legend

| Pri | Meaning |
|-----|---------|
| **P0** | Evergreen product/ADR/rule still describes removed or wrong behavior; high risk of wrong build or wrong ops |
| **P1** | Workflow / acceptance / architecture summary still teaches stale contract |
| **P2** | Secondary indexes, capability maps, partial omissions after the three changes |
| **P3** | Historical journals/changelogs (true as past snapshot) — low urgency unless treated as current SoT |

---

## P0 — High misdirection risk

### D1. ADR 0038 still defines live Tier B + `isMakeup` (and Status banner re-asserts Tier A/B)

| | |
|--|--|
| **File** | `docs/decisions/0038-exercise-open-by-teaching-progress.md` |
| **Lines** | Title L1 (“Tier A/B”); Status banner **L9–12** (“Tier A/B below remains the **default**”); Context L20–21 (buổi bù); Decision **L26–30** Tier B + `isMakeup`; Consequences **L35–36** depends on `isMakeup` |
| **Doc says** | Tier B: makeup session with present/late opens unit for that student only; system depends on `isMakeup`; default open path is Tier A/B. |
| **Truth** | Tier B removed. Open path = Tier A only (ended non-cancelled session teaching unit) + kill-switch / delivery / optional entitlement gate. No `isMakeup` column. |
| **Why severe** | ADR is canonical decision record; banner dated 2026-08-12 **actively wrong** after makeup removal. |

### D2. TL22 mirror of ADR 0038 (same Tier B contract)

| | |
|--|--|
| **File** | `docs/22-adr-rule-chi-code-0038-0041.md` |
| **Lines** | **L26–31** Tier B + `isMakeup` + keep Tier A/B semantics; **L172–174** sweep auto-creates buổi bù on schedule tail |
| **Doc says** | Tier B makeup open; session-done sweep creates makeup sessions at end of recurring slot. |
| **Truth** | No Tier B; sweep cancels 0-present and restamps — no makeup create. |

### D3. TL19 §4 business rules — Tier B as current law

| | |
|--|--|
| **File** | `docs/19-quy-tac-nghiep-vu-chi-tiet.md` |
| **Lines** | **L93–105** (esp. L101–105): Tier B `isMakeup`, fairness for buổi bù |
| **Doc says** | Homework open rules include makeup-only open for attending student. |
| **Truth** | Only Tier A remains in `open-tier.ts`. |

### D4. TL20 session-done + auto makeup + `addMakeup` + schema columns

| | |
|--|--|
| **File** | `docs/20-quy-tac-nghiep-vu-van-hanh.md` |
| **Lines** | **L158–165** auto-cancel + **tự tạo buổi bù**; references manual `addMakeup`; `ClassSession.makeupForSessionId`; roomConflict → manual makeup scheduling |
| **Doc says** | Ops rule: system auto-schedules makeup after 0-present cancel; columns and `addMakeup` path exist. |
| **Truth** | Makeup API/columns gone; sweep does **not** create makeup; roomConflict flag on removed path. |

### D5. Data model V11 still adds makeup column as v2 change

| | |
|--|--|
| **File** | `docs/10-data-model-v2.md` |
| **Lines** | **L91** V11: `… + makeupForSessionId (buổi bù trỏ về buổi gốc)` |
| **Doc says** | Current data model includes makeup FK on ClassSession. |
| **Truth** | Column dropped 2026-08-12 migration; model has no makeup fields. |

### D6. Docs index ADR table still sells Tier B

| | |
|--|--|
| **File** | `docs/README.md` |
| **Lines** | **L94** ADR **0038**: “Tier A cả lớp / **Tier B buổi bù riêng HS**” |
| **Doc says** | One-line SoT for 0038 includes Tier B. |
| **Truth** | Tier B dead. |

### D7. ADR 0046 — contiguous axis + “CSV import later” (blocks gap-aware + real catalog mental model)

| | |
|--|--|
| **File** | `docs/decisions/0046-order-global-stability.md` |
| **Lines** | **L18** “Spike/test seed: assign **contiguous** orderGlobals per program (1..N)”; **L22** “Product **CSV import (later)** must assert stability or remap”; L22 “backfills … by **level**/monthIndex order” (implies comparable numeric level ranking) |
| **Doc says** | Production still in spike-contiguous world; CSV is future; level used as ordered rank. |
| **Truth** | CSV import is **now** SoT (96 units, gaps on Bright I.G). Progression/grant are **gap-aware on real axis**. `level` is **String** framework code (`U2`,`J`,…), not integer rank. Contiguous 1..N is test harness convenience only. |
| **Why severe** | Directly contradicts change (2)+(3); steers implementers to invent missing orderGlobals and ignore holes. |

### D8. Missing evergreen formula for gap-aware progression (silence = wrong default)

| | |
|--|--|
| **File** | **Absent:** `docs/class-unit-spec.md` (linked from domain code). No replacement in `docs/system-architecture.md` / `docs/codebase-summary.md` / ADR 0045 describing `programAxis` math. |
| **Lines** | N/A (gap) |
| **Doc says** | (nothing current) — older mental model if any agent recalls integer add still wins. |
| **Truth** | Code: `deriveSessionUnits(anchor, programAxis, sessions)` → `axis[anchorIdx + floor(k/4)]`; grant: N-th **real** unit on axis, skip holes. |
| **Why severe** | After change (3), lack of authoritative doc is itself drift: readers fall back to integer arithmetic or stale plans. |

---

## P1 — Workflow / acceptance / architecture still teach stale contract

### D9. WF-P2-01 / 02 / 03 (TL26) — makeup + Tier B throughout

| | |
|--|--|
| **File** | `docs/26-workflow-spec-p2.md` |
| **Lines** | **L36–37** Buổi bù (`isMakeup`) + Tier B; **L66** Buổi bù → Tier B; **L87–88** diagram Tier A/B; **L92–95** happy path OR Tier B; **L103** acceptance “buổi bù mở riêng HS” |
| **Doc says** | Create class / attendance / open-exercise workflows still include makeup sessions and Tier B. |
| **Truth** | No makeup sessions; open-tier is Tier A only. |

### D10. TL25 traceability — auto makeup flow still mapped

| | |
|--|--|
| **File** | `docs/25-ma-tran-truy-vet-p1.md` |
| **Lines** | **L48** P3-11: “Tự huỷ buổi 0 điểm danh **+ xếp buổi bù nối đuôi**”; **L72** “ADR 0038 (mở bài tập **Tier A/B**)” |
| **Doc says** | P3-11 product behavior includes auto makeup; ADR 0038 coverage requires Tier B. |
| **Truth** | Sweep: cancel only (no makeup). Tests assert no makeup. Open-tier tests no longer require Tier B. |

### D11. TL29 test plan requires Tier B / buổi bù cases

| | |
|--|--|
| **File** | `docs/29-test-plan.md` |
| **Lines** | **L22** coverage “đủ **Tier A/B**”; **L46** exercise-open: “**buổi bù mở riêng HS**” |
| **Doc says** | Required invariant tests for makeup open. |
| **Truth** | Those cases are obsolete; implementing them would reintroduce dead product surface. |

### D12. TL31 P2 acceptance still requires Tier B

| | |
|--|--|
| **File** | `docs/31-phased-build-plan.md` |
| **Lines** | **L45** “unit mở chỉ sau buổi (ICT)**+Tier B**” |
| **Doc says** | Phase acceptance includes Tier B. |
| **Truth** | Tier B removed. |

### D13. `codebase-summary` session-done still tail-appends makeup

| | |
|--|--|
| **File** | `docs/codebase-summary.md` |
| **Lines** | **L341–342** (section 16b): “auto-cancels … and **tail-appends a makeup session** … (room conflict skips…)” |
| **Doc says** | As-built architecture summary still implements auto makeup. |
| **Truth** | Opposite of `session-done-sweep.ts` comments and behavior. |
| **Note** | This file is often treated as “current implementation status” → high agent trust. |

### D14. TL19 §1 curriculum structure wrong for Bright I.G + silent on 96/CSV/level type

| | |
|--|--|
| **File** | `docs/19-quy-tac-nghiep-vu-chi-tiet.md` |
| **Lines** | **L13–14** “UCREA = 3 cấp × 12 tháng; Bright I.G. = **6 cấp × 4 tháng**”; L15–16 CurriculumUnit without `level` type / `orderGlobal` / CSV SoT |
| **Doc says** | Bright = 6×4 (=24) unit-shaped structure; seed framework vaguely. |
| **Truth** | Bright I.G = **6 levels × 3 units = 18** (codes J,C,Q,T,U,W). Full catalog **96** units from CSV. `level` is **string code**, not month-rank integer. |
| **Related** | UCREA 3×12 (=36) still matches; Black Hole “theo charter” underspecified vs 42 units B/G/P/R. |

### D15. TL10 seed note outdated name / no 96-unit CSV

| | |
|--|--|
| **File** | `docs/10-data-model-v2.md` |
| **Lines** | **L115** “Seed: curriculum UCREA/Bright I.G. theo **`seed-curriculum`** đã có.” |
| **Doc says** | Seed path is legacy `seed-curriculum`. |
| **Truth** | SoT: `packages/db/prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv` via `import-curriculum-units.mjs` / `ensure-curriculum-units.ts` / `seed.mjs` import. Full three programs, 96 units. |

### D16. No as-built section for `lmsOps` / domain-lms gap-aware axis in architecture summaries

| | |
|--|--|
| **Files** | `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/11-api-contract.md` |
| **Lines** | **No** hits for `lmsOps`, `EnrollmentUnitRange`, `domain-lms`, gap-aware formula (search 2026-08-12). `system-architecture.md` only mentions “open-tier” generically (e.g. L83). |
| **Doc says** | (omission) Architecture does not describe dual-gate unit entitlement or axis-based stamping. |
| **Truth** | Major LMS foundation surface lives in `apps/api/src/lms-ops/*` + `@cmc/domain-lms` after Aug 2026 work. |
| **Why P1** | After changes (2)+(3), silence leaves agents on pre-foundation model. |

---

## P2 — Secondary / partial / capability-map drift

### D17. Capability / automation docs still list “buổi bù” as feature

| File | Lines | Doc says | Truth |
|------|-------|----------|-------|
| `docs/04-van-hanh-tu-dong-va-ai-agent.md` | **L47**, **L118** | Auto: “sinh buổi học, **buổi bù**…” | No auto makeup |
| `docs/05-capability-baseline-parity-map.md` | **L33** | `schedule` = “Lịch dạy, buổi học, **buổi bù**, …” | Makeup path removed |

### D18. ADR 0038 Status banner half-updated (flags OK, Tier A/B wrong)

| | |
|--|--|
| **File** | `docs/decisions/0038-…` L9–15; also `docs/decisions/0045-…` L14–15 (homework dual-gate deferred) |
| **Doc says** | Kill-switch + `LMS_ENTITLEMENT_GATE` accurately mentioned; still frames **Tier A/B** as default open path. |
| **Truth** | Flags match code; **Tier B** part of banner is false. Partial sync worse than no sync (looks “fresh”). |

### D19. ADR 0045 product axis correct at high level, no gap-aware math

| | |
|--|--|
| **File** | `docs/decisions/0045-course-unit-entitlement-and-dual-gates.md` |
| **Lines** | **L23** program → orderGlobal axis (OK direction); no mention of holes / `programAxis` / non-integer step |
| **Doc says** | Ordered units by orderGlobal — readable as continuous sequence. |
| **Truth** | Axis is ordered **set** with intentional gaps; stamp/grant must skip missing labels. Not false, but incomplete after change (3). |

### D20. TL19/TL00 seed wording “seed-curriculum”

| File | Lines | Issue |
|------|-------|--------|
| `docs/19-…` | **L176** | “seed-curriculum” |
| `docs/00-ke-hoach-tai-lieu-va-lo-trinh.md` | **L78** | “migrations + seed-curriculum” |
| | | Prefer CSV import / ensure script names so agents find real files. |

### D21. `docs/07-glossary-san-pham.md` CurriculumUnit underspecified

| | |
|--|--|
| **Lines** | **L23** global unit, no RLS |
| **Gap** | No `orderGlobal`, no `level` string codes, no 96-unit CSV, no note on gaps. |

### D22. README / AGENTS / CLAUDE on the three themes

| File | Verdict |
|------|---------|
| **README.md** | **Mostly OK** for (2): L96–102 document `ensure-curriculum-units.ts` + full prisma seed for global catalog. **Does not** claim makeup/Tier B. Does **not** document gap-aware progression (silence only). |
| **AGENTS.md** / **CLAUDE.md** | **No stale claims** on makeup / Tier B / level Int / integer unit math. GitNexus boilerplate only. No duty to document product — **no P0 drift** in agent root files for these three changes. |

---

## P3 — Historical snapshots (true when written; dangerous if read as current)

Treat as **archive**, not evergreen — but listed because agents often search journals first.

| File | Lines (approx) | Stale content if taken as current |
|------|----------------|-------------------------------------|
| `docs/journals/260712-hr-remediation-plan-shipped.md` | L14, L17 | `makeupForSessionId`; auto-cancel + tail-append makeup |
| `docs/project-changelog.md` | L243, L336 | “auto-cancel+makeup”; “Tier B time-gate”; “slot/makeup-date validation” |
| `docs/project-changelog-history.md` | L108 | “confirm/cancel/**makeup**” UI controls |
| `docs/journals/260802-day-one-authoring-ui-gaps.md` | L14, L26, L32 | CurriculumUnit empty local-sim (partially fixed later by ensure script — still useful history) |

---

## Matrix: theme × severity

| Theme | P0–P1 files (must fix first) | Nature of drift |
|-------|------------------------------|-----------------|
| **(1) Makeup still “alive”** | ADR 0038, TL22, TL19§4, TL20§, TL10 V11, docs/README ADR table, TL26, TL25 P3-11, TL29, TL31, codebase-summary 16b, TL04/05 | Feature + schema + sweep + open-tier all still documented |
| **(1b) Tier B ADR 0038** | Same set (nested with makeup) | Decision + workflows + tests still require Tier B |
| **(2) level as number / sample curriculum** | ADR 0046 L18–22; TL19 L13–14; TL10 L115; missing String/CSV/96 in glossary & architecture | Contiguous spike + “CSV later” + wrong Bright structure; no level:String SoT in docs |
| **(3) Integer add progression** | Missing class-unit-spec; ADR 0046 contiguous; silence in system-architecture/codebase-summary; no programAxis in ADRs | Docs never state gap-aware formula; ADR encourages continuous labels |

**No explicit prose found** in scanned evergreen docs of the exact formula `order = anchorOrder + floor(k/4)` — that formula lived in code/spec-port. Drift is: **(a)** missing updated formula, **(b)** ADR 0046 contiguous seed, **(c)** agents may re-derive integer math from range labels alone.

**No explicit “level: Int” sentence** in most markdown — type lived in Prisma migration history. Drift is: **docs never updated to String codes**, and “cấp × tháng” / level-ordered backfill imply numeric ranks.

---

## Recommended doc fix order (for a later edit session — **not done here**)

1. **Supersede ADR 0038** (or Status: Superseded for Tier B) + patch TL22/TL19/docs README one-liner.  
2. **Rewrite TL20 + codebase-summary 16b + TL25 P3-11** to cancel-only restamp.  
3. **TL10 V11** note columns dropped; add V-next for level String + CSV 96.  
4. **ADR 0046** Status sync: CSV live, gaps intentional, contiguous only for tests; level is string.  
5. **Add or restore** `docs/class-unit-spec.md` (or section under system-architecture) with **gap-aware** stamp/grant contracts pointing at `@cmc/domain-lms`.  
6. **TL26 / TL29 / TL31** strip Tier B acceptance.  
7. Journals/changelog: leave as history or add “superseded 2026-08-12” one-liners only if process requires.

---

## Scope compliance

| Check | Result |
|-------|--------|
| Only read docs/code | Yes |
| No doc/code edits | Yes |
| No commit | Yes |
| Report path | `/tmp/claude-1000/-home-manhquy-Downloads-cmc-edu/ec961fba-67c4-4c2e-ae66-363e7ad65808/scratchpad/GAP-5-docs-drift.md` |

---

Status: DONE
