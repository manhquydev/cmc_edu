# Full-Feature Code Review — ERP URL Addressing Deeplinks

**Date:** 2026-08-04  
**Branch:** `feat/erp-url-addressing-deeplinks`  
**Base:** `origin/develop`  
**Commits (5):**

| SHA | Summary |
|-----|---------|
| `d3ffbb1` | Phase 1 — returnTo through staff login |
| `6a1c830` | Phase 2a — PermissionGate + student cold-nav |
| `8d9a84b` | Phase 2b — `@cmc/links`, `/go`, Copy link |
| `b274b9a` | Phase 3 — attendance URL state |
| `96039a0` | Phase 4 — grading/payroll/evidence, Referrer-Policy, docs |

**Score: 7.5 / 10**  
**Recommendation: Approve with fixes**

---

## 1. Scope

| Item | Detail |
|------|--------|
| Files | 51 changed (+2311 / −115) |
| Surface | `apps/admin` (auth, routes, 4 detail pages, 4 workspaces), `packages/links`, `apps/e2e`, `infra/nginx`, `docs/system-architecture.md`, plan artifacts |
| API / auth package | **No changes** under `apps/api` or `packages/auth` |
| Focus | Full feature (Phases 1–4) production-readiness |
| Scout findings | Warm-path student not-found masked by `location.state`; cold-nav e2e only 2/4 entities; FORBIDDEN page branch untested client shape; workspace `sessionId` alone hydrates roster without class selector label |

### Local evidence re-run

| Suite | Result |
|-------|--------|
| `@cmc/links` unit | 26 pass (src+dist double-collect — see Low) |
| `safe-return-to` + `login` unit | 16 pass |
| payroll / attendance / grading / session-evidence unit | 55 pass |

CI `typecheck-and-test` + `ui-e2e` not re-executed in this review session.

---

## 2. Overall Assessment

The feature is architecturally coherent and security-aware:

- Single open-redirect policy (`safeReturnTo` / `shouldCaptureReturnTo`) used by RequireAuth, login, change-password, and `/go`.
- Canonical entity→URL contract in `@cmc/links` mirrors `@cmc/domain-time` package shape.
- `/go` rejects prototype keys (`Object.hasOwn`) and non-UUID ids before redirect.
- PermissionGate module/action pairs match API `requirePermission` (verified against routers + `packages/auth` registry).
- Workspace URL state uses `readUuidParam` so garbage ids never reach tRPC inputs.
- Business mutation payloads (attendance.markAll, submission.grade, payslip assemble/finalize) unchanged; unit suites still lock them.
- Follow-up for server-side `mustChangePassword` correctly tracked as GitHub **#58** (OPEN); documented as non-goal.

Gaps that keep this from a clean approve: incomplete student not-found when list `location.state` is present; plan-level e2e cold-nav for receipt/class deferred without updating top-level success criteria; missing unit tests for `CopyLinkButton` / `GoResolverPage`; no e2e for grading hydrate (unit only).

---

## 3. Critical Issues

**None.**

No open-redirect bypass remaining in current `safeReturnTo` (control-char + conditional decode fixes from Phase 1 review are present and unit-tested). No API/schema break. No trust-boundary hole introduced that bypasses server RBAC (PermissionGate is UI chrome; API still enforces).

---

## 4. High Priority

### H1 — Student not-found EmptyState can be masked by `location.state`

**Where:** `apps/admin/src/pages/students/student-detail.tsx` (merge of `getQ.data` vs `stateStudent`)

**Problem:** After the query settles successfully with `null` (deleted / other facility), code still prefers list seed:

```ts
const student =
  getQ.data != null
    ? map(getQ.data)
    : stateStudent?.id === id
      ? stateStudent   // ← wins when get returned null
      : undefined;
```

`notFound` requires `student == null`, so warm navigation from the list never shows “Không tìm thấy học viên” if the row was in `location.state`.

**Impact:** Stale name/lifecycle UI; user may attempt lifecycle mutation on a missing student. Cold-nav e2e (no state) still passes — gap is warm path + not-found AC.

**Fix:** Once `getQ` is settled (`isSuccess` or `isError`), treat query as sole source; use `location.state` only while loading:

```ts
const student =
  getQ.isLoading || getQ.isFetching
    ? (getQ.data != null
        ? map(getQ.data)
        : stateStudent?.id === id
          ? stateStudent
          : undefined)
    : getQ.data != null
      ? map(getQ.data)
      : undefined;
```

Add unit/e2e: list-state present + `student.get` → null ⇒ EmptyState.

---

### H2 — Plan success criterion “cold-nav both 4 entities” only half-covered in e2e

**Where:** Success criteria in `plan.md` vs `deeplink-go.ui.spec.ts` / `deeplink-detail-gates.ui.spec.ts`

**Evidence:**

| Entity | Cold-nav e2e |
|--------|----------------|
| opportunity | MET (`deeplink-go.ui.spec.ts`) |
| student | MET (`deeplink-detail-gates.ui.spec.ts`) |
| receipt | **Missing** |
| classBatch | **Missing** |

Phase 2b file notes “receipt/class cold-nav deferred to full CI (same builders)” but top-level plan checklist still claims 4-entity cold-nav. Builders + PermissionGate exist; runtime cold-nav for receipt/class is **plausible but unproven** (class detail already fetched by id; receipt detail already fetched by id — lower risk than student was).

**Fix (pick one before merge or document explicitly):**

1. Add two short e2e gotos (seed receipt + classBatch → assert code/name), or  
2. Amend plan success criteria to “2 proven + 2 deferred” with rationale (builders identical; pages already id-fetch).

---

### H3 — Opportunity page-level FORBIDDEN branch likely dead / untested on client shape

**Where:** `opportunity-detail.tsx` reads `(error.data as { code?: unknown })?.code === 'FORBIDDEN'`

**Evidence:**

- Route is wrapped in `PermissionGate module="crm" action="opportunityList"` — role without permission never mounts the page (e2e 403 asserts gate copy, not this branch).
- Server `createCaller` errors expose top-level `code: 'FORBIDDEN'`; admin client path is only this one cast — **no unit test** asserts `error.data.code` for opportunityGet.
- If client shape is `error.shape.data.code` or missing `data`, users who somehow pass the gate but get server FORBIDDEN still see the raw Banner (pre-gate behavior for that edge).

**Impact:** Not a security hole (API still denies). Defense-in-depth UI may not fire. Gate path is what product AC requires — **MET via PermissionGate**.

**Fix:** Prefer reading the same error helper used elsewhere in admin if one exists; add a component test with mocked `useQuery` error `{ data: { code: 'FORBIDDEN' } }`. Optional: drop page branch if gate is considered sufficient (YAGNI).

---

## 5. Medium Priority

### M1 — Missing unit tests for `CopyLinkButton` and `GoResolverPage`

Phase 2 listed `+ test` for both. Only package-level `resolveGo` / e2e `/go` cover behavior. Clipboard fallback (`execCommand`) and `safeReturnTo` second sink on Navigate are untested in isolation.

### M2 — Grading / payroll deep-link have no e2e (unit only)

Phase 4 step 5 asked e2e for grading + session-evidence; only `workspace-deeplink.ui.spec.ts` (session-evidence) shipped. Grading + payroll hydrate are unit-tested (good for param filtering / stale userId). Acceptable under “e2e/unit” wording but weaker for flaky selector / real pickList timing.

### M3 — Attendance / session-evidence: `sessionId` without valid `classBatchId`

`attendance.listBySession` enables on `sessionId` alone. Class/session selectors may show truncated UUID labels when options list is empty. Shareable happy path always sets both (builder + picker). Document or clear orphan `sessionId` when class missing.

### M4 — Detail path params not UUID-filtered at page boundary

Workspaces use `readUuidParam`. Detail routes accept any `:id` string; `student.get` uses `z.string().uuid()` → BAD_REQUEST → notFound EmptyState. `/go` blocks non-UUID before redirect. Direct `/admin/students/not-a-uuid` still fires a failing request. Optional: `UUID_RE` gate on detail pages for consistency with docs (“ids must be UUIDs”).

### M5 — Stale payroll `?userId=` remains in URL while UI shows list

Intentional “treat as unset” for display (no undefined breadcrumb — tested). URL still carries dead id until user selects someone. Low product risk; optional `replace` cleanup when pickList resolves without match.

### M6 — Docs claim vs nginx-only Referrer-Policy

`docs/system-architecture.md` correctly says serving layer nginx. Pure Vite `:4173` e2e/dev will **not** send the header. Fine for prod; call out in deploy checklist that Vite preview is not the threat model.

### M7 — Remaining hardcode navigates outside the enumerated 7

Still present (by design, not in Phase 2 list):

- `session-detail.tsx` → `/admin/classes/${…}`
- `cockpit.tsx` → `/finance/${id}`
- `reconciliation.tsx` href `/finance/…`

Not blockers; optional follow-up to route all entity links through `@cmc/links`.

---

## 6. Low Priority / Nits

| # | Note |
|---|------|
| L1 | `@cmc/links` vitest collects **both** `src/` and `dist/` tests (26 = 13×2). Prefer excluding `dist` in vitest config to avoid stale-dist false confidence. |
| L2 | `CopyLinkButton` silent failure when both clipboard paths fail (no toast). |
| L3 | Login unit default success still asserts navigate to `/` (index → cockpit only in full router e2e). |
| L4 | Phase plan checkboxes in `plan.md` still unchecked despite phase files marked completed. |
| L5 | `go-resolver` comment “Shell chrome flash” accepted — fine. |
| L6 | `class.read` vs `class.create`: **not a bug**. Gate uses `class.read` matching `classBatch.get`; `class.create` is correctly narrower (GĐĐT). |

---

## 7. What Is Solid (keep)

1. **`safeReturnTo` policy surface** — single module; open-redirect suite includes `//evil`, schemes, `/\`, javascript:, control chars, double-decode fidelity (`100%25off`), excluded auth chrome.
2. **RequireAuth capture** — `shouldCaptureReturnTo`; no nested returnTo on `/login` / `/change-password`.
3. **mustChangePassword carry** — login → change-password with encoded dest; e2e + unit; #58 filed for server enforcement.
4. **`@cmc/links`** — pure TS, `Object.hasOwn`, UUID boundary, workspace builders, tests green; package shape matches domain-time.
5. **`/go` module route** — `go.routes.tsx` respects “index only assembles”; placed before `*`; second sink through `safeReturnTo`.
6. **PermissionGate on 4 detail routes** — actions match API:
   - `crm.opportunityList` ↔ `opportunityGet`
   - `finance.receiptGet` ↔ `receiptGet`
   - `student.lookup` ↔ `student.get`
   - `class.read` ↔ `classBatch.get`
7. **Student cold-nav** — `student.get` + e2e name assertion (no `ID: uuid` placeholder).
8. **7 call-sites** replaced with builders; 3 false-positive `/finance/new` paths untouched.
9. **Workspace URL state** — attendance / grading / payroll / session-evidence; garbage UUID filtered; payroll loading chrome + stale userId tests.
10. **Referrer-Policy** on prod nginx + both local-sim server blocks.
11. **Docs** URL addressing section matches code (builders, returnTo, garbage params, #58, `/go` audit note).
12. **E2e seed infrastructure** — `seedStaffWithPassword` / mustChangePassword via real create + rotate; admin `baseURL` 4173 on all new specs.
13. **HARD business-logic isolation** — no API contract churn; mutation payload tests still green.

---

## 8. Acceptance Criteria Matrix

| # | Criterion (from `plan.md`) | Status | Evidence |
|---|----------------------------|--------|----------|
| 1 | E2e logout → opportunity URL → form login → exact destination | **MET** | `deeplink-return-to.ui.spec.ts` |
| 2 | E2e `returnTo=//evil.com` → cockpit | **MET** | same spec; positive URL assert |
| 3 | E2e mustChangePassword carries returnTo | **MET** | same spec + `seedStaffMustChangePassword` |
| 4 | E2e `/go/opportunity/:uuid` logout→login; unknown/non-UUID → EmptyState | **MET** | `deeplink-go.ui.spec.ts` |
| 5 | E2e cold-nav **all 4** entities | **PARTIAL** | opportunity + student only; receipt/class deferred in phase notes |
| 6 | E2e 403 “Không có quyền truy cập” | **MET** (opportunity) | `deeplink-detail-gates.ui.spec.ts`; other 3 routes gated in code, not e2e |
| 7 | E2e attendance hydrate; session-assessment roster journey green | **PARTIAL** | attendance deeplink e2e present; journey suite **not re-run here** |
| 8 | Unit safeReturnTo ≥8 cases; resolveGo prototype + non-UUID | **MET** | 10 safe-return-to tests; links resolveGo suite |
| 9 | 4 entity + ≥4 workspace addressable; 7 call-sites use builders | **MET** | links + pages + call-site diff |
| 10 | Referrer-Policy same-origin both nginx configs | **MET** | `nginx.conf` + `nginx.local-sim.conf` (2 servers) |
| 11 | `docs/system-architecture.md` URL addressing matches code | **MET** | section present; claims verified |
| 12 | GitHub issue mustChangePassword server enforcement | **MET** | [#58](https://github.com/manhquydev/cmc_edu/issues/58) OPEN |
| 13 | CI `typecheck-and-test` + `ui-e2e` green | **NOT VERIFIED** in this session | phase notes leave unchecked |

---

## 9. Security Checklist (explicit)

| Threat | Verdict | Notes |
|--------|---------|-------|
| Open redirect via returnTo | **Mitigated** | path shape, control/ws, origin check, excluded paths |
| Double-decode corruption | **Mitigated** | decode only when not already `/…` |
| `/go` prototype pollution | **Mitigated** | `Object.hasOwn(links, entity)` |
| `/go` path traversal / static sibling (`refund`) | **Mitigated** | UUID_RE |
| UUID garbage into tRPC (workspaces) | **Mitigated** | `readUuidParam` |
| Payroll userId in Referer | **Mitigated in prod** | nginx `Referrer-Policy: same-origin` |
| mustChangePassword bypass | **Known pre-existing** | client hint; #58; non-goal |
| RBAC on shared links | **Mitigated (UI)** | PermissionGate; API still authoritative |
| Class gate create vs read | **Correct** | `class.read` matches get |

---

## 10. HARD-GATE-NO-SIDE-EFFECTS

**CLEAR**

| Check | Result |
|-------|--------|
| `apps/api` / schema / migrations | No files changed |
| `packages/auth` permission registry | Unchanged |
| Attendance markAll payload | Unit still asserts explicit toggles only |
| Grading grade mutate | Unit still asserts score payload |
| Payslip assemble/finalize/reopen | Unit suite 23 tests pass |
| CRM/finance business transitions | Error UI only on opportunity; no flow change |
| Enumerated 7 navigations | Path builders only; student keeps `{ state: { student } }` |

No evidence of accidental business-rule rewrites.

---

## 11. Pattern Compliance

| Pattern | Followed? |
|---------|-----------|
| PermissionGate (existing admin/finance screens) | Yes |
| Module `*.routes.tsx` + index assemble only | Yes (`go.routes.tsx`) |
| `useSearchParams` like schedule/payroll period | Yes |
| `@cmc/domain-time` package exports (dev/dist) | Yes for `@cmc/links` |
| Copy fallback for non-secure context | Yes (execCommand) |
| E2e admin origin 4173 (not LMS 4174) | Yes on all new specs |

---

## 12. Recommended Actions (priority order)

1. **Fix H1** student not-found vs `location.state` (small, correctness of Phase 2a AC).
2. **Close H2** — either add receipt/class cold-nav e2e or explicitly amend plan AC before merge messaging.
3. Land PR only after **CI** `typecheck-and-test` + `ui-e2e` green (criterion 13).
4. Optional: M1 component tests; M2 grading e2e if CI budget allows; L1 vitest ignore `dist`.
5. Do **not** block on #58 (server mustChangePassword) — already non-goal.

---

## 13. Explicit Recommendation

### **Approve with fixes**

Ship is justified once **H1** is fixed and **H2** is either tested or consciously re-scoped in the plan/PR description. Security-sensitive surfaces (returnTo, resolveGo, UUID boundaries, PermissionGate alignment, Referrer-Policy) are in good shape. No critical blockers; no business-logic side effects detected.

---

## 14. Metrics (approximate)

| Metric | Value |
|--------|-------|
| Type coverage | N/A (project does not publish %); admin + links typecheck expected via CI |
| New unit tests | safe-return-to (10), links (13 unique), login returnTo cases, workspace hydrate cases |
| New e2e specs | 5 files (return-to, detail-gates, go, attendance, workspace) |
| Linting | Not run in this session |
| Review score | **7.5 / 10** |

---

## 15. Unresolved Questions

1. Will CI `ui-e2e` full grid (including `session-assessment-roster.journey.ui.spec.ts`) stay green after attendance URL refactor? Local unit green; full e2e not run here.
2. Product intent for orphan `?sessionId=` without `classBatchId` — keep roster-only hydrate or require both?
3. Confirm whether Vite/static hosting outside nginx ever serves admin with payroll links (Referrer-Policy gap).
