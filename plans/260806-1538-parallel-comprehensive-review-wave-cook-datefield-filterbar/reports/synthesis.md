# Synthesis — Parallel comprehensive review (8 agents)

**Date:** 2026-08-06  
**Scope:** `origin/develop..HEAD`  
- `048b65b` docs(design): Odoo Search OS / form fields / grammar audit  
- `939b92f` feat(ui): DateField + FilterBar migrations  

**Plan:** `plans/260806-1538-parallel-comprehensive-review-wave-cook-datefield-filterbar/`  
**Orchestration:** `ak plan create` + 8 parallel agents (7× code-reviewer + 1× tester)

---

## Lane scoreboard

| Lane | Focus | Verdict | BLOCKER | MAJOR |
|------|--------|---------|--------:|------:|
| **R1** | UI package DateField/FilterBar | **FAIL** | 0 | 3 |
| **R2** | Admin page migrations | **FAIL** | 0 | 4 |
| **R3** | Tests + harness | **FAIL** | 0 | 4 |
| **R4** | Security | **PASS** | 0 | 0 |
| **R5** | A11y / UX grammar | **FAIL** | 0 | 5 |
| **R6** | tRPC / API contracts | **PASS*** | 0 | 1† |
| **R7** | Docs accuracy | **FAIL** | 0 | 4 |
| **R8** | Live vitest | **PASS** | — | — |

\* API payloads match routers.  
† Pre-existing parents queue `pageSize: 50` truncation (not introduced by cook, but still MAJOR product risk).

**Live tests (R8):** **81/81 green** (ui 11 + admin 70) under correct package configs.

---

## Cross-lane merged findings (deduped)

### Ship-blocking quality bar

No **security BLOCKER**, no test red.  
Multiple **MAJOR** product/UX/docs issues — recommend **fix-forward before push**, or push with explicit debt tickets.

### P0 — Fix before merge/push (recommended)

| ID | Sev | Finding | Lanes | Suggested fix |
|----|-----|---------|-------|---------------|
| **P0-1** | MAJOR | **Gifts:** filter change resets page but **not** `selectedIds` → bulk bar can target hidden rows | R2 | `setSelectedIds([])` when filter changes |
| **P0-2** | MAJOR | **Audit:** live FilterBar on exact-match free-text **no debounce** → API spam + empty mid-type | R2, R4, R5 | Debounce text fields ~300ms *or* restore Apply for free-text |
| **P0-3** | MAJOR | **Docs stale** after cook: FilterBar still **7/23**, G2 date **MISSING**, pipeline “non-FilterBar” | R7 | Patch evergreen map + snapshot notes on audit/playbook/synthesis |
| **P0-4** | MAJOR | **DateField** default `id` from label → collision risk; FilterBar should pass `id={f.key}` | R1 | `useId()` or `id={key}` from FilterBar |

### P1 — Strong follow-ups (same PR or next)

| ID | Sev | Finding | Lanes |
|----|-----|---------|-------|
| **P1-1** | MAJOR | **Parents** FilterBar still **inside tabs**, not `ListPage.filters` (VIEW-GRAMMAR / G1) | R2, R5 |
| **P1-2** | MAJOR | **Gifts** “Tất cả” option + Selector clear duplicates (playbook anti-pattern) | R2, R5 |
| **P1-3** | MAJOR | **Test gaps:** gifts/parents/kpi filter paths; FilterBar URL mode untested | R3 |
| **P1-4** | MAJOR | Pipeline select clear → snaps to `exclude` (not “all”); search lost icon/`hasClear` | R5 |
| **P1-5** | MAJOR | Audit date range no from≤to validation | R5, R6 |
| **P1-6** | MAJOR† | `guardian.listPendingLinks` hardcodes pageSize 50, shows total | R6 |

### P2 — Nits / residual

- FilterBar dual-mode (value without onChange) footgun (pre-existing) — R1  
- DateField focus token `--cmc-accent` fallback — R1  
- CSS.escape polyfill incomplete but test-only — R3, R4  
- Intermediate query page flicker on filter+page reset — R6  

### What is solid

| Area | Evidence |
|------|----------|
| Security | R4 PASS — Prisma where, no XSS/IDOR/secrets |
| Unit + page tests green | R8 81/81 |
| Audit ICT day bounds | R3/R6 + audit-log.test |
| Pipeline/KPI FilterBar in ControlBar | R2 PASS those pages |
| DateField export + FilterBar type=date | R1 directionally OK |
| SearchChrome still parked | R7 |

---

## Ship recommendation

```text
RECOMMENDATION: CONDITIONAL SHIP
  - Security: clear
  - Automated tests: green
  - Product/UX/docs: several MAJOR debt items

Option A (preferred): fix P0-1..P0-4 in a small follow-up commit, then push.
Option B: push now with tracked debt (P0/P1 list) if release pressure wins.
Option C: do not push until P0 + parents G1 placement (P1-1) if strict grammar bar.
```

**Controller call:** Prefer **Option A** — gifts selection + audit debounce + docs refresh + DateField id are small, high-signal fixes.

### Post-review follow-up (2026-08-06)

**P0 fixed and committed.** Open debt tracked in [debt-list.md](./debt-list.md) (D1–D13). Push with remaining P1/P2 debt accepted as backlog.

---

## Agent IDs (resume)

| Lane | subagent_id |
|------|-------------|
| R1 | 019fd639-bc21-75e3-a91c-e41715e9a000 |
| R2 | 019fd639-bc21-75e3-a91c-e42b872c9149 |
| R3 | 019fd639-bc21-75e3-a91c-e43c6a422a1a |
| R4 | 019fd639-bc21-75e3-a91c-e443818cdd6b |
| R5 | 019fd639-bc21-75e3-a91c-e4501dd6cce8 |
| R6 | 019fd639-bc21-75e3-a91c-e46300a55423 |
| R7 | 019fd639-bc21-75e3-a91c-e47650464456 |
| R8 | 019fd639-bc22-7512-9fbd-074de131f45d |

---

## Report index

| File |
|------|
| [r1-ui-package.md](./r1-ui-package.md) |
| [r2-admin-pages.md](./r2-admin-pages.md) |
| [r3-tests-harness.md](./r3-tests-harness.md) |
| [r4-security.md](./r4-security.md) |
| [r5-a11y-ux.md](./r5-a11y-ux.md) |
| [r6-api-contracts.md](./r6-api-contracts.md) |
| [r7-docs-accuracy.md](./r7-docs-accuracy.md) |
| [r8-live-tests.md](./r8-live-tests.md) |
| [synthesis.md](./synthesis.md) (this file) |

```text
Status: DONE
Summary: 8-lane parallel review complete; tests+security pass; conditional ship with P0 gifts selection, audit debounce, docs refresh, DateField id.
```
