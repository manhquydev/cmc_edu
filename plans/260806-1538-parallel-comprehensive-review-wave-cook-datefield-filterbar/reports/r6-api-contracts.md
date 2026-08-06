# R6 — tRPC / query contracts

**Lane:** API contracts (filter payloads, pagination, timezone)  
**Scope commits:** `048b65b`, `939b92f` (`origin/develop..HEAD`)  
**Status:** **PASS** (no BLOCKER; one MAJOR pre-existing truncation on parents link queue)  
**Reviewed:** 2026-08-06  

## Method

For each migrated admin page, traced controlled `FilterBar` → `useQuery` input object against the Zod input schema and handler in `apps/api/src`. Checked:

1. Field names + types match router input  
2. Optional empty strings are omitted (not sent as `""`)  
3. Page resets when filters narrow/widen the set  
4. Audit date range uses inclusive ICT day bounds → ISO-8601 with offset  
5. No silent inverted / wrong filter semantics  

Sources:  
- Pages: `apps/admin/src/pages/crm/pipeline.tsx`, `hr/kpi.tsx`, `admin/audit-log.tsx`, `engagement/gifts.tsx`, `parents/index.tsx`  
- Routers: `apps/api/src/crm/router.ts`, `kpi/router.ts`, `audit/router.ts`, `rewards/gift-router.ts`, `parentAccount/router.ts`, `guardian/router.ts`  
- Contract tests: `audit-log.test.tsx` (ICT bounds), `pipeline.test.tsx` (default / search omit), `parents/index.test.tsx` (`missingEmailOnly`)

---

## Contract matrix

| Surface | Client payload | Server schema | Empty optional | Page reset | Result |
|--------|----------------|---------------|----------------|------------|--------|
| `crm.opportunityList` | `{ search?, stage?, lost, page, pageSize }` | `search? min1 max100`, `stage?`, `lost` enum default `exclude`, `page`/`pageSize` | search omitted when `debouncedSearch` empty; spaces trimmed | `useEffect` → `page=1` on search/lost/stage | **OK** |
| `kpi.list` | `{ period, status? }` | `period` `YYYY-MM`, `status` enum optional | status omitted when cleared (`''` → `undefined`); period never empty (fallback ICT month) | n/a (no pagination) | **OK** |
| `audit.list` | `{ actor?, action?, entity?, createdFrom?, createdTo?, page, pageSize }` | strings `min(1)` optional; dates `z.string().datetime()`; page defaults | empty filters omitted; invalid/partial dates omitted | `setPage(1)` in `onChange` (sync batch) | **OK** |
| `gift.list` | `{ includeInactive: boolean }` | `includeInactive` bool default `false` | always explicit bool | client page reset on filter | **OK** (UI default ≠ API default, but always explicit) |
| `parentAccount.list` | `{ search?, missingEmailOnly, page, pageSize }` | `search? trim min1 max254`, `missingEmailOnly?`, page | search omitted when empty after trim | `useEffect` → `page=1` | **OK** |
| `guardian.listPendingLinks` | `{ status, page: 1, pageSize: 50 }` | `status` enum default `pending`, page, pageSize max 100 | status always enum member | always page 1 (no multi-page UI) | **MAJOR** truncation if `total > 50` |

---

## Per-surface findings

### 1. `crm.opportunityList` — pipeline

**Client** (`pipeline.tsx`):

```ts
const listInput = {
  ...(debouncedSearch ? { search: debouncedSearch } : {}),
  ...(stageFilter ? { stage: stageFilter } : {}),
  lost: lostFilter, // 'exclude' | 'include' | 'only'
  page,
  pageSize: 20,
};
```

**Server** (`crm/router.ts` `opportunityListInput`): matches. `lost` default server-side is also `exclude`; client always sends it.

| Check | Evidence |
|-------|----------|
| Types | `lost` enum values identical; `search` string; `page`/`pageSize` positive ints |
| Empty search | Only spread when truthy after `.trim()` + 300ms debounce — no `search: ""` (would fail `min(1)`) |
| Page reset | `useEffect` deps `[debouncedSearch, lostFilter, stageFilter]` → `setPage(1)` |
| Wrong filter | Select clear → `lost: next.lost \|\| 'exclude'`; invalid lost coerced to `exclude` |

**MINOR — transient stale page query.** Page reset is in `useEffect`, so one render can query `{ …new filters, page: old }` before page snaps to 1. Brief empty/wrong page flash + extra request. Prefer audit-style: `setPage(1)` inside filter `onChange` (and debounce-complete path).

**NIT — search length.** Server `max(100)`; client does not cap. >100 chars → Zod error in UI, not silent wrong results.

---

### 2. `kpi.list` — Duyệt KPI

**Client** (`kpi.tsx`):

```ts
trpc.kpi.list.useQuery(
  {
    period,
    ...(statusFilter ? { status: statusFilter as 'draft' | 'submitted' | 'confirmed' | 'approved' } : {}),
  },
  { enabled: isPeriodValid }, // /^\d{4}-\d{2}$/
);
```

**Server** (`kpi/router.ts` `listInput`): `period` regex `YYYY-MM`, optional status enum — match.

| Check | Evidence |
|-------|----------|
| Types | period string + optional status enum |
| Empty / partial period | Query disabled until valid; cleared period reverts to `defaultPeriodICT()` (Asia/Ho_Chi_Minh `en-CA` month) |
| Empty status | `status: next.status ?? ''` → `statusFilter = status \|\| undefined` → key omitted → all statuses |
| Defaults | UI defaults `status: 'submitted'` (inbox); API has no status default — intentional product default, not a silent API mismatch |

**MINOR — stale rows while period is mid-edit.** When `enabled: false`, React Query keeps previous successful data, so table can still show the last valid period while the field shows an incomplete value (e.g. `2026-0`). API is not called with a bad period; display can lie briefly. Mitigate with `placeholderData: undefined` / clear rows when `!isPeriodValid`.

**NIT — month validity.** Pattern allows `2026-13`; server same. Empty result set, not wrong filter logic.

---

### 3. `audit.list` — Nhật ký hệ thống

**Client** (`audit-log.tsx`):

```ts
// Inclusive ICT day → ISO
toCreatedFromIso: `${date}T00:00:00+07:00` → toISOString()
toCreatedToIso:   `${date}T23:59:59.999+07:00` → toISOString()
// Only spread when conversion succeeds
```

**Server** (`audit/router.ts`): `createdFrom`/`createdTo` as `z.string().datetime()`, applied as `gte` / `lte` on `createdAt`. Exact match on `actor` / `action` / `entity`.

| Check | Evidence |
|-------|----------|
| Types | ISO strings from `Date#toISOString()` satisfy Zod datetime |
| Empty optionals | `filters.actor ?` etc.; empty date → `undefined` → key omitted (avoids `min(1)` / datetime fail) |
| ICT bounds | Locked by `audit-log.test.tsx`: `2026-08-06` → from `2026-08-05T17:00:00.000Z`, to `2026-08-06T16:59:59.999Z` |
| Page reset | Synchronous `setPage(1)` with filter state update (React 18 batch) — best of the migrated pages |
| DateField | Native `type="date"` → `YYYY-MM-DD` or `""` only — aligns with `DATE_ONLY` guard |

**MINOR — no inverted-range guard.** `createdFrom > createdTo` yields empty list, not an error. Acceptable; optional client banner.

**MINOR — no trim on actor/action/entity.** Leading/trailing spaces are sent and exact-matched; CRM/parent search trim. Recommend `.trim()` before truthy check.

**NIT — double conversion.** `toCreatedFromIso` / `toCreatedToIso` each evaluated twice in the query object; pure, no contract risk.

---

### 4. `gift.list` — Phần thưởng

**Client** (`gifts.tsx`):

```ts
const includeInactive = filterValues.active !== 'active';
trpc.gift.list.useQuery({ includeInactive });
// default filterValues.active = 'all' → includeInactive true
```

**Server** (`gift-router.ts`): `includeInactive: z.boolean().default(false)`; when true, drops `isActive: true` constraint.

| Check | Evidence |
|-------|----------|
| Types | boolean always sent |
| Empty select | `next.active \|\| 'all'` → include inactive |
| Semantics | `active` → active-only; `all` → include inactive — **not inverted** |
| Pagination | API returns full facility list; client slices `pageSize=20`; page reset on filter change |

**NIT — default divergence.** UI default shows inactive (`includeInactive: true`); API default is active-only. Safe because client always sends the flag. Document for future callers.

**NIT — no “inactive only”.** Product choice, not a contract bug.

---

### 5. `parentAccount.list` / `guardian.listPendingLinks` — Phụ huynh

#### `parentAccount.list` (tab “Tất cả phụ huynh”)

```ts
{
  ...(debouncedSearch ? { search: debouncedSearch } : {}),
  missingEmailOnly: emailFilter === 'missing', // default true
  page,
  pageSize: 20,
}
```

**Server** (`parentAccount/router.ts`): matches. `missingEmailOnly` truthy → `email: null`; `search` optional min 1 after server trim.

| Check | Evidence |
|-------|----------|
| Types | bool + optional search + page |
| Empty search | omitted after trim/debounce |
| Page reset | `useEffect` on `[debouncedSearch, emailFilter]` |
| Permission | Page only mounts tab when `canDo('parentAccount','updateEmail')` — same gate as procedure |

**MINOR — same transient stale-page query as pipeline** (effect-based page reset).

#### `guardian.listPendingLinks` (tab “Yêu cầu liên kết”)

```ts
trpc.guardian.listPendingLinks.useQuery({
  status: filterStatus, // 'pending' | 'approved' | 'rejected', default pending
  page: 1,
  pageSize: 50,
});
```

**Server** (`guardian/router.ts`): status enum + page + pageSize max 100 — types OK; empty status not an issue (always enum).

### MAJOR — silent truncation when `total > 50`

- Client hardcodes `page: 1`, `pageSize: 50` and never wires `ListPagination` / page controls.  
- UI still prints `{data.total} yêu cầu`, so staff can see e.g. “73 yêu cầu” but only 50 rows.  
- Server correctly returns `total` and supports pagination; client under-uses the contract.  
- Pre-existing relative to FilterBar migration, but in-scope for this page’s query contract and “no silent wrong filters / incomplete lists”.  

**Fix:** either paginate with server `page`/`pageSize` (prefer, mirror audit/parent directory), or set `pageSize` to max(100) and surface a hard cap warning when `total > pageSize`.

---

## Cross-cutting

| Topic | Verdict |
|-------|---------|
| Empty string → Zod `min(1)` | Mitigated on all surfaces that have optional strings (omit-if-empty / trim) except audit whitespace (MINOR) |
| Controlled FilterBar | All five pages use `value` + `onChange` (no URL param dual-source races on these lists) |
| ICT / timezone | Only audit uses day-range ISO; KPI period uses ICT calendar month for default — consistent with backend period semantics |
| Type assertions | KPI `status as enum` is UI-constrained; invalid would 400 from Zod, not silent filter |

---

## Severity summary

| ID | Severity | Surface | Issue |
|----|----------|---------|-------|
| R6-01 | **MAJOR** | `guardian.listPendingLinks` | Fixed `page:1` / `pageSize:50` with no pagination; `total` can exceed visible rows → silent incomplete queue |
| R6-02 | MINOR | `crm.opportunityList`, `parentAccount.list` | Page reset via `useEffect` → one intermediate request with new filters + old page |
| R6-03 | MINOR | `kpi.list` | While period invalid mid-typing, previous period rows can remain visible (`enabled: false` keeps cache) |
| R6-04 | MINOR | `audit.list` | No trim on actor/action/entity; inverted date range returns empty without guidance |
| R6-05 | NIT | `gift.list` | UI default `includeInactive: true` vs API default `false` (explicit client payload OK) |
| R6-06 | NIT | `crm.opportunityList` | No client max length for `search` (server max 100) |

No BLOCKERs: no inverted booleans, no empty-string Zod landmines on happy paths, audit ICT ISO bounds verified by unit test, CRM/KPI/gift/parentAccount payloads type-align with routers.

---

## Recommended actions (priority)

1. **R6-01 (MAJOR):** Add server-driven pagination to link-request tab (or raise pageSize to 100 + overflow warning). Do not trust a hard page-1 slice when `total` is shown.  
2. **R6-02:** Reset `page` in the same event handler / debounce completion as filter updates (pattern already used by `audit-log.tsx` / `gifts.tsx`).  
3. **R6-03:** When `!isPeriodValid`, do not render prior `data` (empty table or “nhập kỳ YYYY-MM”).  
4. **R6-04:** `.trim()` audit text filters before omit/send; optional `createdFrom <= createdTo` check.  

---

## Lane status

```text
Status: DONE_WITH_CONCERNS
Summary: Filter → tRPC payloads for CRM/KPI/audit/gift/parentAccount match router Zod contracts; empty optionals omitted; audit ICT ISO bounds correct. One MAJOR: guardian.listPendingLinks hard-caps at 50 without pagination while advertising total.
Concerns: R6-01 silent truncation on parents link queue; minor page-reset race on pipeline/parents.
```
