# R4 — Security Review

| Field | Value |
|-------|--------|
| Lane | R4 Security |
| Scope | `origin/develop..HEAD` (`048b65b`, `939b92f`) |
| Focus | Filter → tRPC payloads, list contracts, CSS.escape polyfill, secrets in docs/plans |
| Status | **PASS** |
| Date | 2026-08-06 |
| Mode | Read-only |

## Scope reviewed

**Code (feat UI cook):**
- `packages/ui/src/components/filter-bar.tsx`, `date-field.tsx` (+ tests, exports, `odoo.css`)
- Admin pages: `audit-log.tsx`, `crm/pipeline.tsx`, `hr/kpi.tsx`, `parents/index.tsx`, `engagement/gifts.tsx`
- `apps/admin/test-setup.ts` (CSS.escape / dialog polyfills)

**API contracts (read-only, to judge injection/authz of filter payloads):**
- `apps/api/src/audit/router.ts` — `audit.list`
- `apps/api/src/crm/router.ts` — `crm.opportunityList`
- `apps/api/src/kpi/router.ts` — `kpi.list`
- `apps/api/src/guardian/router.ts` — `guardian.listPendingLinks`
- `apps/api/src/parentAccount/router.ts` — `parentAccount.list`
- `apps/api/src/rewards/gift-router.ts` — `gift.list`

**Docs/plans in this wave:** design-system deltas + `plans/260806-*` reports (secret scan)

**Threat model (lane brief):**
1. Injection via filter strings
2. IDOR / privilege bypass
3. XSS via reflected filters
4. Overly broad audit date queries (DoS)
5. Prototype pollution in filter objects
6. Secrets in docs/plans
7. CSS.escape polyfill leaking to production

---

## Verdict matrix

| Threat | Result | Severity | Notes |
|--------|--------|----------|-------|
| SQL / query injection via filters | **Clear** | — | Prisma structured `where`; no raw SQL; search uses `contains` |
| Privilege bypass / IDOR via filters | **Clear** | — | No new procedures; server `requirePermission` + facility scope unchanged |
| XSS reflected filters | **Clear** | — | React controlled values; no `dangerouslySetInnerHTML` on these paths |
| Audit date / filter DoS | **Residual** | MINOR | Live keystroke queries + unbounded string filters (see F1/F2) |
| Prototype pollution | **Clear** | — | Known static keys; pages re-normalize state |
| Secrets in wave docs/plans | **Clear** | — | No credential material in `260806-*` / design-system deltas |
| CSS.escape in production | **Clear** | — | Vitest `setupFiles` only |

**Lane status: PASS** — no BLOCKER/MAJOR trust-boundary defects introduced by this wave.

---

## Findings

### F1 — Audit filters now fire `audit.list` on every keystroke (no debounce / apply gate)

| | |
|--|--|
| Severity | **MINOR** |
| Status | Open (regression vs prior draft/apply UX) |
| Evidence | `apps/admin/src/pages/admin/audit-log.tsx` — controlled `filters` state is spread into `trpc.audit.list.useQuery` immediately; test renamed to “live via FilterBar” |
| Prior | Draft state + explicit “Lọc” button limited query rate |

**Impact:** Super-admin typing in actor/action/entity triggers one query (findMany + count) per change. Not a cross-tenant attack; still amplifies load on the global `AuditLog` table compared to the previous apply model. Pipeline/parents deliberately debounce search (~300ms); audit does not.

**Fix (recommended, non-blocking):** Debounce text filters 250–400ms (match pipeline), or restore draft/applied for free-text while keeping DateField live.

---

### F2 — `audit.list` free-text filters have no max length (pre-existing API; worsened by F1)

| | |
|--|--|
| Severity | **MINOR** |
| Status | Pre-existing contract; UI makes spam cheaper |
| Evidence | `apps/api/src/audit/router.ts` `listInput`: `actor`/`action`/`entity` = `z.string().min(1).optional()` — no `.max()` |

Contrast: `crm.opportunityList.search` max 100; `parentAccount.list.search` max 254.

**Impact:** Authenticated super_admin can send arbitrarily long equality filters. Prisma still parameterizes (no injection), but payloads and DB compare work grow without bound. F1 multiplies request rate while typing.

**Fix:** Add `.max(N)` (e.g. 128–256) on actor/action/entity; optionally reject inverted/huge date windows if product wants a hard DoS bound (see F3).

---

### F3 — Audit date range unbounded (pre-existing; conversion improved)

| | |
|--|--|
| Severity | **INFO** |
| Status | Pre-existing; this wave improves correctness |
| Evidence | API accepts any ISO `createdFrom`/`createdTo` with no max span; `pageSize` capped at 100. UI now maps `YYYY-MM-DD` → inclusive ICT bounds via `DATE_ONLY` + `+07:00` (`toCreatedFromIso` / `toCreatedToIso`) |

**Impact:** Full-history list still possible (paginated). Count over large ranges can be expensive for super_admin. Not a new hole; date parsing is stricter than the old `new Date(dateText)` free-parse.

**Non-issue for injection:** Invalid dates fail `DATE_ONLY` client-side; server requires `z.string().datetime()`.

---

### F4 — Client-side enum casts without local whitelist (fail closed at Zod)

| | |
|--|--|
| Severity | **NIT** |
| Status | Acceptable |
| Evidence | `kpi.tsx` casts `statusFilter as 'draft' \| ...`; `parents/index.tsx` casts `next.status as FilterStatus` / `EmailFilter` |

**Impact:** Tampered client values produce tRPC Zod `BAD_REQUEST`, not privilege expansion. Server enums: `kpi.list` status, `guardian.listPendingLinks` status, gift `includeInactive` boolean, CRM `lost` enum + client allowlist fallback to `exclude`.

---

### F5 — Prototype pollution via filter objects

| | |
|--|--|
| Severity | **INFO** (not exploitable here) |
| Evidence | `FilterBar.handleChange` only writes `filters[].key` from static `FilterDef[]`. Pages re-materialize known shapes (`EMPTY_FILTERS`, `{ q, lost }`, etc.). No deep merge into shared prototypes. |

**Verdict:** Clear for this wave.

---

### F6 — CSS.escape polyfill production exposure

| | |
|--|--|
| Severity | — |
| Status | **PASS** |
| Evidence | `CSS.escape` assignment only in `apps/admin/test-setup.ts`. Wired solely via `apps/admin/vitest.config.ts` → `setupFiles: ['./test-setup.ts']`. Repo grep: no other `CSS.escape` definitions. Not imported by app runtime entry. |

---

### F7 — Secrets in docs/plans (this wave)

| | |
|--|--|
| Severity | — |
| Status | **PASS** |
| Evidence | Grep over `plans/260806-*` and design-system deltas for credential patterns (`password=`, `api_key`, `Bearer`, `sk_live`, `ghp_`, private keys, known test password literals) → **no matches**. “token” hits are design-system CSS tokens only. |

Note: Older plans outside this wave still discuss env var *names* and historical test passwords; out of scope for this diff.

---

## Per-surface filter → API map

| Page | Client filters | tRPC input | Server validation | Authz / scope |
|------|----------------|------------|-------------------|---------------|
| Audit | actor, action, entity, createdFrom/To (date → ICT ISO) | `audit.list` | strings min1; ISO datetime; pageSize≤100 | `requirePermission('audit','list')`; platform-wide (by design) |
| Pipeline | `q` → `search` (debounced), `lost` enum, URL `stage` allowlisted | `crm.opportunityList` | search max100; lost enum; stage enum | facility via `scoped` + `withFacility` |
| KPI | status select, period YYYY-MM (query gated on regex) | `kpi.list` | period regex; status enum | director/super_admin role gate + branch filter |
| Parents links | status select | `guardian.listPendingLinks` | status enum; pageSize≤100 | facility-scoped permission |
| Parents dir | search debounce, missingEmailOnly | `parentAccount.list` | search max254; boolean | `parentAccount.updateEmail` permission + guardian facility filter |
| Gifts | active select → `includeInactive` bool | `gift.list` | boolean | facility-scoped `gift.list` |

Injection posture: equality / `contains` via Prisma only. No raw string interpolation into SQL.

XSS posture: filter values bound to Astryx `TextInput` / native `type="date"` / `Selector`; table cells render as React text. Error messages via `error?.message` props (text path). This wave does not introduce URL-driven uncontrolled FilterBar on the migrated pages (all pass `value` + `onChange`).

---

## Behavioral checklist

- [x] Concurrency — no shared mutable server state in UI change; optimistic CRM advance unchanged
- [x] Error boundaries — tRPC Zod still rejects bad filter shapes
- [x] API contracts — UI payloads still match existing Zod inputs (date ISO shape improved)
- [x] Backwards compatibility — no API schema change in this wave
- [x] Input validation — server remains authority; client DATE_ONLY / period regex are defense-in-depth
- [x] Auth/authz — no new bypass; page-level `canDo` retained where previously present
- [x] N+1 / query efficiency — F1 live audit queries only notable regression
- [x] Data leaks — no new PII surfaces; filter values not logged in changed code
- [x] Secrets — none in wave artifacts
- [x] CSS.escape — test-only

---

## Positive observations (risk calibration)

1. **ICT date bounds** replace ambiguous `new Date('YYYY-MM-DD')` parsing with explicit `+07:00` day start/end and a strict `DATE_ONLY` gate — reduces weird-date / timezone footguns.
2. **Controlled FilterBar** on all five migrated lists avoids silent URL param reflection into queries for this cook.
3. **Search debounce retained** on pipeline and parents directory.
4. **Server contracts** already use enums, max lengths (except audit free-text), and permission wrappers — UI chrome swap does not weaken them.

---

## Recommended actions (priority)

1. **(MINOR)** Debounce audit free-text filters or restore apply-gate — `audit-log.tsx`.
2. **(MINOR)** Add `.max(...)` on `audit.list` actor/action/entity — `apps/api/src/audit/router.ts` (API hardening; not required to ship UI).
3. **(INFO/optional)** Document or cap max audit date span if super-admin DoS of count queries becomes an ops concern.
4. No ship-blockers from this lane.

---

## Metrics (security-relevant)

| Metric | Result |
|--------|--------|
| New endpoints | 0 |
| Authz regressions found | 0 |
| Injection vectors in filter path | 0 |
| Production polyfill risk | 0 |
| Secrets in wave docs | 0 |
| Open findings | 2 MINOR, 1 INFO, 1 NIT |

---

## Unresolved questions

None blocking. Optional product call: whether audit free-text should stay live-as-you-type (ops convenience) vs apply/debounce (load control).

---

## Status line

```text
Status: DONE
Summary: Security lane PASS — no injection/IDOR/XSS/secrets/production polyfill issues; two MINOR residuals on audit live queries + unbounded free-text filter length.
Concerns/Blockers: none blocking ship
```
