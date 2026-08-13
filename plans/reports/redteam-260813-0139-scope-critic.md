# Red team — Scope & Complexity Critic / Contract Verifier

Plan: `plans/260813-0120-design-system-hardening/` · Verified against `develop@69ab8fc`
(`/home/manhquy/.herdr/worktrees/cmc_edu/audit-design-system-impeccable/`). All line refs below were
re-read at that commit.

**Verdict up front:** ~1.5 days of this 6–11 day plan is defensible. Phase 01 reverses a deliberate
product decision on agent-manufactured authority. Phase 03 nhịp 2 silently rewrites a tRPC output
contract to solve a problem the existing pager already solves. Phases 02 and 05 spend a day building
two more bespoke CI scripts into a repo that already has an orphaned one nobody wired up.

---

## Finding 1: Phase 03 nhịp 2 rewrites a tRPC output contract as a "Sửa kèm", and contradicts its own nhịp 1 — CRITICAL

**Evidence:**
- `apps/api/src/crm/router.ts:483-490` — `stageCounts` is an explicitly commented invariant:
  `// Funnel counts are facility-wide and ALWAYS exclude lost (F7) ... independent of the current
  page's stage/search/lost filters.` The `groupBy` deliberately uses `{ AND: [{ facilityId },
  NOT_LOST_WHERE] }`, **not** the `where` built at `:471`.
- Locked by test: `apps/api/src/crm/list.test.ts:129-146` asserts facility-wide, lost-excluded counts.
- Consumed as the funnel source: `apps/admin/src/pages/crm/pipeline.tsx:481-488` (`FunnelBar value={stageCounts[...]}`).
- `phase-03-crm-kanban-truth.md:47-49` orders the reversal: *"stageCounts hiện cố ý bỏ qua search …
  count phải đếm theo cùng `where` với items"* — filed under the heading **"Sửa kèm"**.
- Same file, `:32` (nhịp 1 table): *"`pipeline.tsx:481-488` funnel — **Giữ nguyên** tổng — đây là con
  số để ra quyết định"*.

**Why it breaks:** nhịp 1 freezes the funnel; nhịp 2 changes the only field the funnel reads. Both are
in the same phase, so the phase cannot be completed as written. Worse, this is an undeclared change to
the output shape semantics of a public tRPC procedure (`crm.opportunityList`) — the plan never labels
it a contract change, never lists other consumers, and buries it as a drive-by under a UI phase. The
phase-level "Nghiệm thu" checklist has no item covering it. Contract Verifier: **this is the one
undeclared public-contract change in the plan.**

**Suggested fix:** Drop it. If search-scoped counts are actually wanted, that is a separate API phase
with its own authority, its own field (`filteredStageCounts`), and its own decision about what the
funnel displays — not a bullet under "Sửa kèm".

---

## Finding 2: Phase 01 is not naming hygiene — it reverses a deliberate typography decision on agent-written authority — CRITICAL

**Evidence:**
- The thing being deleted is documented intent, not accident: `packages/ui/src/console.css:372`
  `/* Odoo dense steps: base 14 / sm 13 / xs 12 */`, and `:368-370` explains why both families are
  declared.
- Three test files exist solely to lock that behavior in:
  `packages/ui/src/console/console-tokens.test.ts:33-41`,
  `packages/ui/src/console/console-astryx-remap.test.ts:48-66` (jsdom computed-style assertions on
  `--text-body-weight`, `--text-body-leading`, `--color-text-primary`),
  `packages/ui/src/astryx-theme-cmc.test.ts:16-24`.
- Authority cited by `plan.md:4` is `plans/reports/decisions-owner-260813-0120-design-system.md`.
  That file, `:5`, says: **"Người quyết: agent thay mặt chủ dự án"** — and `:20-30` records that the
  same agent reversed its own position twice on this exact question within one session
  (*"Hai chỗ lập trường ban đầu của tôi SAI"*).
- `phase-01-token-isolation.md:19-21` admits: pixels change, `ui-e2e` cannot catch it, mitigation is
  "soi mắt đúng 3 màn".

**Why it breaks:** `AGENTS.md` requires repository authority for a new externally observable policy and
says to stop before edits when materially different choices remain open. An agent-authored decision doc
citing itself is not that. This ships a whole-admin typography change (100+ raw `h1`–`h6` per
`console.css:433`) with no VRT, a self-declared blind gate, and a 3-screen eyeball as the only proof —
in exchange for a lint-grade property ("one owner per variable name") that has not caused a single
reported defect.

**Second, undisclosed blast radius:** the plan's warning (`:19-21`) mentions only `--font-size-lg`
15→16 and `--font-size-2xl` 18→24. But its own delete list (`:36-37`) removes `console.css:387-426`,
which includes **26 `--text-*-weight` and `--text-*-leading` declarations** (`:405-426`) that
`astryx-theme-cmc.css` does **not** re-declare (verified: that file declares 32 names, none of them
`--text-*`). Those fall back to whatever `@astryxdesign/theme-neutral@0.2.0` ships — a value nobody in
the plan has read. `node_modules/@astryxdesign` is not even installed in the audit worktree.

**Suggested fix:** Cut phase 01. Keep only the cross-file test (`phase-01:44-52` items 2 and 3) as a
**reporting** check on today's state, or as a gate that fails on *new* collisions with the current 17
grandfathered — same ratchet pattern `scripts/ui-ratchet.mjs` already uses. That kills the "agent adds
an 18th collision" risk at zero pixel risk, in ~2 hours instead of a day. Phase 02 loses its stated
dependency and can proceed independently.

---

## Finding 3: Phase 03 nhịp 2 (1.5–2.5d) solves a problem that already ships — HIGH

**Evidence:**
- `phase-03-crm-kanban-truth.md:20` justifies nhịp 2: *"Dừng ở nhịp 1 = để sale quyết trên con số họ
  không mở được"*; `:57` acceptance: *"Sale mở được mọi thẻ trong một giai đoạn (pager per cột)"*.
- `apps/admin/src/pages/crm/pipeline.tsx:537-559` — the pager (`Trang trước` / `Trang sau` +
  `Trang {page}/{totalPages} — {total} cơ hội`) is rendered under `{ready && …}` with **no
  `view === 'table'` guard**. It is on screen in kanban view. Sale can already reach every card.
- `pipeline.tsx:249-253` + `:289` — `?stage=` URL param already narrows the server query to one stage,
  server-side, today.
- Cost admitted by the plan itself, `phase-03:66`: *"Cache/optimistic của `handleAdvance` (`:297-318`)
  lệch giữa 5 query key; payload gấp 5; `ui-e2e` dễ flaky nếu chạm journey CRM"*.

**Why it breaks:** the phase sells an ergonomics upgrade as a correctness fix. The reachability problem
it claims to solve does not exist; only the *convenience* of per-column paging does. In exchange it
takes 5× the network payload, five query keys for the optimistic `handleAdvance` cache to stay
consistent across, a self-predicted `ui-e2e` flake risk, and the contract change in Finding 1 — for a
board an internal sales team uses.

**Suggested fix:** Ship nhịp 1 only (0.5–1d — the genuine defect: `pipeline.tsx:504-508` renders
`stageCounts` above `stageItems`, producing "Đã kiểm tra 8" over "Chưa có"). Delete nhịp 2 from the
plan. Revisit only if a sale actually reports the global pager is unusable.

---

## Finding 4: Two new bespoke checkers, while the repo already has an orphaned one — HIGH

**Evidence:**
- `package.json:15-16` registers `check:ui-a11y-roles` and `test:ui-a11y-roles`.
  `scripts/check-ui-a11y-roles.mjs` is 124 lines with a 47-line test.
- `grep -n "ui-a11y-roles" .github/workflows/*.yml` → **zero hits**. It is wired into no workflow.
  `.github/workflows/ci.yml:108-119` runs only `check:ui-frames` and `check:ui-ratchet`.
- `phase-05-doc-authority.md:36-45` proposes `scripts/check-doc-authority.mjs`: a hardcoded allowlist of
  `{path → forbidden literal substrings}`, exit 1, print `file:line`, plus its own node test.
- `scripts/check-ui-a11y-roles.mjs:24-45` is the *exact inverse* harness already written and tested:
  `CHECKS = [{ id, file, requires: [literal substrings] }]`, *"literal, not regex"*, exit 1, JSON mode.
- `phase-02-phantom-token-guard.md:29-36` proposes `scripts/check-css-vars.mjs` to parse `var()` out of
  `style={{}}` in TSX. `scripts/ui-ratchet.mjs:14-27` already walks `style={{` blocks by brace depth
  respecting string literals, and already detects `var(` at `:195`.

**Why it breaks:** the repo's own history is the counter-evidence. It already built one grep-gate
(`check-ui-a11y-roles`), gave it a package script and a test, and then never wired it to CI — so it has
been silently dead. This plan's answer is two more files with the same lifecycle. Neither phase 02 nor
phase 05 mentions any existing script's internals, and neither argues why extension is worse than a new
file. That is the AI-generated-code signature: a fresh helper beside an existing one that already does
the parsing.

**Suggested fix:**
- Phase 05: add a `forbids: []` array to `scripts/check-ui-a11y-roles.mjs`'s `CHECKS` entries
  (~15 lines), extend `check-ui-a11y-roles.test.mjs`, and **wire the resulting script into
  `ci.yml` alongside the other two**. One PR fixes the doc drift *and* resurrects a dead gate.
- Phase 02: extend `scripts/ui-ratchet.mjs`'s existing walker with a consumed-var pass, or drop the
  script entirely (see Finding 5).

---

## Finding 5: Phase 02's stated problem is false for 2 of its 3 tokens — and its own gate would not flag them — HIGH

**Evidence:**
- `phase-02-phantom-token-guard.md:23`: *"Biến ma render ra rỗng — màu biến mất, viền biến mất, im lặng."*
- `apps/admin/src/pages/attendance/shifts-detail.tsx:113` —
  `border:1px solid var(--console-border, #dee2e6);`
- `shifts-detail.tsx:114` — `background:var(--console-bg-subtle, #f1f3f5);`
- `shifts-detail.tsx:116` — same two, both with fallbacks.
  Every one of the 4 uses has a literal fallback. Nothing disappears; they render `#dee2e6` / `#f1f3f5`.
- `phase-02:33` — the proposed gate: *"Fail nếu `consumed \ declared ≠ ∅`, **trừ** biến có fallback
  `var(--x, y)` (được phép…)"*. The new script would exempt exactly the two tokens the phase opens with.
- Only genuine defect: `apps/admin/src/pages/crm/report.tsx:136` — `color: 'var(--cmc-text-supporting)'`,
  no fallback, and `--cmc-text-supporting` is declared nowhere (`tokens.css:17-20` has `--cmc-text`,
  `--cmc-text-2`, `--cmc-text-muted`, `--cmc-text-faint`).

**Why it breaks:** half a day, a new script, a new test, and a CI step are budgeted against a defect
inventory of **one CSS property on one page** — a supporting-text colour that falls back to inherited
colour. The phase's urgency language ("đang chạy production", "đã nằm trong dist") is doing work the
evidence does not support, and the phase contradicts itself between `:23` and `:33`.

**Suggested fix:** Change `report.tsx:136` to `var(--cmc-text-muted)` — one line, ~5 minutes, no
dependency on phase 01. If the gate is still wanted afterwards, fold it into `ui-ratchet.mjs` per
Finding 4 rather than opening phase 02 as a phase.

---

## Finding 6: Phase 03 mutates an exported UI type for a one-page need, and misses the second consumer — MEDIUM

**Evidence:**
- `packages/ui/src/console/console-kanban.tsx:18-23` — `export interface KanbanColumnProps { title:
  ReactNode; count?: number; … }`. Re-exported publicly at `packages/ui/src/index.ts:176-181`.
- `phase-03:33`: *"`console-kanban.tsx:20-29,35` — `count` nhận `ReactNode`, hoặc thêm prop `visible?`.
  Hiện chỉ nhận số trần"* — the plan cannot decide which, and defers the choice to execution time.
- `console-kanban.tsx:28` — `const displayCount = count ?? childArray.filter(Boolean).length;` The
  `number` type is load-bearing for that numeric fallback path.
- Second consumer the plan never mentions: `apps/admin/src/pages/teaching/schedule.tsx:241` —
  `<KanbanColumn key={col.key} title={col.label} count={items.length}>`. `grep -rn "schedule"` across
  all seven plan files → **zero hits**.
- **`title` is already `ReactNode`** (`console-kanban.tsx:19`). The CRM header can render `1/5` through
  the prop that already accepts it, with no package change at all.

**Why it breaks:** a shared primitive in `packages/ui` gets its exported type widened to fix display
copy on one admin page, without the plan having enumerated its consumers or noticing that the existing
API already covers the case. Widening `count` to `ReactNode` also silently breaks the numeric-fallback
contract at `:28` for the other consumer.

**Suggested fix:** Touch no file under `packages/ui`. Render the visible/total badge from
`pipeline.tsx` through the existing `title: ReactNode`. If a distinct pill is required later, that is a
separate, consumer-audited primitive change.

---

## Finding 7: The plan's own "every phase needs an automated gate" rule is skipped for the only phase that is purely drift prevention — MEDIUM

**Evidence:**
- `plan.md:19-20`: *"CI là đội review. Không phase nào được 'xong' mà không có cổng tự động chứng minh
  nó không tái phát."*
- `phase-06-lms-primitives.md:11-13` states the entire rationale is drift prevention: *"77 `style={{}}`
  đang là khuôn mẫu để trang LMS tiếp theo copy."*
- `phase-06:56` acceptance: *"`apps/lms` còn `<15` inline style"* — a manual count. No gate proposed.
- `scripts/ui-ratchet.mjs:50` — `const pagesRoot = path.join(root, 'apps/admin/src/pages');`
- `scripts/check-ui-frames.mjs:13` — identical hardcoded path.
- `grep -l "apps/lms" scripts/*.mjs` → **no script covers `apps/lms`**.
- Verified count today: `grep -ro "style={{" apps/lms/src --include=*.tsx | wc -l` → **77** (plan's
  number is accurate).

**Why it breaks:** the plan builds two brand-new CI scripts for phase 02 (1 real defect) and phase 05
(documentation prose), then spends 1–3 days manually removing 62 inline styles from LMS with nothing
stopping the 63rd from returning next week. Backwards priority. It also means phase 06's own success
criterion cannot be verified in CI, which by `plan.md:19-20` means phase 06 can never be "done".

**Suggested fix:** If phase 06 runs at all, the first commit is one line —
`scripts/ui-ratchet.mjs:50` becomes a list including `apps/lms/src` — with `--write-baseline` capturing
77 and the ratchet doing the rest incrementally, for free, over time. That is the entire drift-prevention
value of phase 06 at ~1 hour instead of 1–3 days. Keep only lô 0 (`apps/lms/index.html:6`
`user-scalable=no` removal — a real, independent, 1-line accessibility fix).

---

## Finding 8: Phase 04 would remove the only working keyboard path to CRM cards, and buries its one high-value item last — MEDIUM

**Evidence:**
- `phase-04-a11y-keyboard.md:15-16` claims: *"Tương tác lồng nhau — `pipeline.tsx:137-238` bọc
  `role="button"` quanh thẻ… Screen reader đọc thành button-trong-button"*, and `:23` instructs
  *"Bỏ wrapper `role="button"`"*.
- `apps/admin/src/pages/crm/pipeline.tsx:137-145` — that wrapper already has `tabIndex={0}` **and** an
  `onKeyDown` with a deliberate, commented guard:
  `// Only when the card shell itself is focused — descendant buttons … must not bubble Enter/Space
  into navigate.` then `if (e.target !== e.currentTarget) return;`
  CRM cards are keyboard-openable today.
- `KanbanCard`'s own `onClick` path (`console-kanban.tsx:44-70`) is the plan's proposed replacement; the
  phase does not verify it provides equivalent focus/keyboard behaviour before ripping the wrapper out.
- The genuinely broken item is item 4 of 4: `packages/ui/src/components/data-table.tsx:146-161` wraps
  every cell in a bare `<div onClick={…} style={{cursor:'pointer'}}>` — no `tabIndex`, no `onKeyDown`,
  no role. That is one shared component covering all four pages the phase lists at `:17-18`.

**Why it breaks:** items 1–3 (focus rings on 6 selectors, navbar Arrow/Home/End menu semantics, un-nesting
the CRM card) are 1–2 days of ARIA work on an internal mouse-driven ERP — and item 2 actively risks
regressing working keyboard access on the strength of an incorrect problem statement. The phase's own
risk note (`:44-46`) concedes `ui-e2e` selectors may drift from the row restructuring.

**Suggested fix:** Cut to item 4 only. Fix `data-table.tsx:146-161` once (`tabIndex={0}` +
`onKeyDown` Enter/Space + `role="button"` on the wrapper, same `closest()` guard already there), add the
RTL test at `phase-04:38`, ship in ~1 hour. Defer items 1–3 until someone actually navigates by keyboard
or a compliance requirement lands — `phase-04:7-8` already concedes that trigger has not occurred.

---

## What I would actually run

| Keep | Cost | Why |
|---|---|---|
| Phase 03 nhịp 1 only | 0.5–1d | Real, business-visible: sale reads a count contradicted by the cards below it (`pipeline.tsx:504-508`). Use existing `title: ReactNode`; touch no package. |
| `data-table.tsx:146-161` keyboard fix | ~1h | One shared component, four pages, no ARIA archaeology. |
| `report.tsx:136` → `var(--cmc-text-muted)` | ~5m | The only genuinely undeclared token. |
| `apps/lms/index.html:6` drop `user-scalable=no` | ~5m | Independent, real, zero risk. |
| `packages/ui/llms.txt:79` `premium.css` → `console.css` | ~5m | File does not exist; actively misdirects agents. `packages/ui/src/` has only `tokens.css`, `astryx-theme-cmc.css`, `console.css`. |
| `docs/README.md:15` split frontend path | ~10m | The one line in phase 05 that changes agent behaviour. |
| Add `apps/lms/src` to `ui-ratchet.mjs:50` + baseline | ~1h | Buys phase 06's entire stated value permanently. |
| Wire `check:ui-a11y-roles` into `ci.yml` | ~10m | An existing tested gate is dead; fixing that beats writing two more. |

**~1.5 days replaces 6–11.** Cut entirely: phase 01, phase 02's script, phase 03 nhịp 2, phase 04 items
1–3, phase 05's script, phase 06 lô 1–4.

---

## Unresolved questions

1. `decisions-owner-260813-0120-design-system.md:5` names an agent as decision-maker for a
   pixel-changing typography reversal. Does the human owner endorse `--font-size-lg` 15→16px and
   `--font-size-2xl` 18→24px across the admin app? Phase 01 must not proceed without a human answer.
2. Has anyone read `@astryxdesign/theme-neutral@0.2.0`'s `--text-*-weight` / `--text-*-leading` values?
   `node_modules/@astryxdesign` is absent from the audit worktree, so phase 01's fallback target is
   unverified for 26 of the declarations it deletes.
3. Is `check:ui-a11y-roles` unwired deliberately or by omission? The answer determines whether new
   grep-gates are a pattern the operator maintains or a pattern that keeps dying.
4. `.github/workflows/ci.yml:133-135` sets `continue-on-error: true` on the in-CI `e2e` job. The plan
   treats `ui-e2e` as a blocking required check throughout (`plan.md:23`). Which workflow is the
   required one — `ui-e2e.yml`, or this non-blocking job?
