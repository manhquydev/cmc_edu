# Validation — URL, deep-link and browser-history contracts

**Date:** 2026-08-17  
**Scope:** plan plus current Admin route/link/navigation source and tests  
**Product/plan edits:** none  
**Classification:** `VERIFIED/current precedent` · `NEW CONTRACT` · `FAILED/UNVERIFIED`

## Executive verdict

The accepted red-team direction is mostly propagated and internally coherent. The route grammar,
history mode, malformed-ID guard and `/go` rules all have usable current precedents. Three items
remain insufficiently closed for an implementation-ready plan:

1. there is no explicit compatibility matrix describing query/state preservation for every redirect;
2. Staff `page` parsing/normalization is unspecified;
3. the ParentMeeting soft-warning success branch is not explicitly included in modal
   create-success → detail navigation.

There is also no ready-made typed record-return helper or tab-history test helper; those are valid
new contracts, but Phase 3 should own their implementation/tests explicitly rather than implying
they already exist.

## Contract validation matrix

| Contract | Classification | Validation |
|---|---|---|
| Exact base detail redirects with `replace` | **NEW CONTRACT, supported by precedent** | D1 fixes Staff base → profile and D7 fixes base redirects to `replace` (`decisions.md:7-10,88-92`). Phase 5 repeats exact-base-only behavior (`phase-05-existing-detail-url-and-cross-link-normalization.md:22,27-28,56,70`). Existing root, `/classes`, `/hr`, login and `/go` redirects already use `<Navigate replace>` (`apps/admin/src/routes/index.tsx:36-40,56,85-88`; `apps/admin/src/routes/hr.routes.tsx:31-36`; `apps/admin/src/pages/go-resolver.tsx:27-29`). |
| Legacy redirects with `replace` | **NEW CONTRACT; matrix incomplete** | Staff and ParentMeeting legacy paths are locked (`decisions.md:10,96-98`) and D7 requires replace (`decisions.md:86,88`). Existing replace precedent is real, but the plan does not enumerate preservation/drop behavior for search, hash and router state per legacy route. See Failure 1. |
| User tab changes push history | **NEW CONTRACT** | D7 and Phase 5 explicitly require push plus Back/Forward (`decisions.md:87-92`; `phase-05-existing-detail-url-and-cross-link-normalization.md:27,73`). Current `CmcTabs` only invokes a callback and has no router semantics (`packages/ui/src/components/cmc-tabs.tsx:5-27`). Current durable sections are local state (`apps/admin/src/pages/classes/class-detail.tsx:431-440,500-508,598`; `apps/admin/src/pages/students/student-detail.tsx:101-104,134-267,388`; `apps/admin/src/pages/finance/receipt-detail.tsx:660-669`). The existing session query-tab contract uses `replace`, not push (`apps/admin/src/pages/teaching/session-detail.tsx:112-116`), and is explicitly exempted from this migration (`phase-05-existing-detail-url-and-cross-link-normalization.md:25`). No contradiction. |
| Staff `q/page` hydration | **NEW CONTRACT; page normalization unverified** | Phase 3 requires deterministic `?q=&page=` hydrate/write (`phase-03-staff-routes-forms-and-navigation.md:22-23,70-71`). Current Staff uses local `searchInput` and `page` only (`apps/admin/src/pages/admin/users.tsx:125-152`). Receipt proves query hydration/resync for `q/status`, but keeps page local (`apps/admin/src/pages/finance/receipt-list.tsx:88-115,123-155`). Payroll proves validated query hydration with `readUuidParam` (`apps/admin/src/pages/hr/payroll.tsx:419-426,446-464`). No shared positive-integer page parser exists. See Failure 2. |
| Validated `{ pathname, search }` return context | **NEW CONTRACT, primitives available** | D7 and Phase 3 require same-origin validation, exact `pathname + search`, and canonical-list fallback (`decisions.md:89-90`; `phase-03-staff-routes-forms-and-navigation.md:26-27,70-71`). `safeReturnTo` already rejects scheme/host/control-character injection and returns normalized pathname+search (`apps/admin/src/lib/safe-return-to.ts:37-49,51-92`), with tests for nested query and open redirects (`apps/admin/src/lib/safe-return-to.test.ts:18-44`). Existing list/detail flows carry typed local router state and derive a safe domain fallback (`apps/admin/src/pages/attendance/shifts.tsx:923-951`; `apps/admin/src/pages/attendance/shifts-detail.tsx:98-108`). However, no generic typed `{pathname, search}` helper exists; `safeReturnTo` accepts one string and falls back to `/`, not a caller-supplied canonical list. Phase 3 is therefore the correct ownership point for a small wrapper/type plus tests. |
| Dedicated `/new` create-success replaces compose | **VERIFIED/current precedent and NEW rollout contract** | D7 and Phases 3/6 lock replace (`decisions.md:87`; `phase-03-staff-routes-forms-and-navigation.md:28,67,85-86`; `phase-06-remaining-first-class-record-rollout.md:40-43`). `/hr/shifts/new` already navigates to the created detail with `{replace:true}` (`apps/admin/src/pages/attendance/shifts-new.tsx:20-23`). `/finance/new` currently pushes (`apps/admin/src/pages/finance/receipt-create.tsx:140-151`), while the inventory records the required replacement (`reports/source-current-resource-depth-inventory.md:30-32`) and Phase 6's Receipt wave generically owns create-navigation repair (`phase-06-remaining-first-class-record-rollout.md:27-32,41,67-75`). No cross-phase contradiction, but the receipt test currently proves destination only, not history mode (`apps/admin/src/pages/finance/receipt-create.test.tsx:243-257`). |
| Modal create-success pushes detail | **VERIFIED/current precedent and NEW rollout contract** | D7 and Phase 6 require push (`decisions.md:87`; `phase-06-remaining-first-class-record-rollout.md:41`). Class modal success opens detail with default `navigate`, therefore push (`apps/admin/src/pages/classes/index.tsx:470-487`). AfterSale currently closes only (`apps/admin/src/pages/crm/create-after-sale-case-dialog.tsx:31-36`), and Phase 5 explicitly changes it to the created case (`phase-05-existing-detail-url-and-cross-link-normalization.md:24,47,58,71`). ParentMeeting has an unresolved successful-warning branch; see Failure 3. |
| Malformed UUID does not call API | **VERIFIED/current precedent and NEW targeted contract** | `UUID_RE` and `readUuidParam` reject malformed identifiers (`packages/links/src/index.ts:6-14`) and their tests pass (`packages/links/src/index.test.ts:50-59,127-131`). Existing AfterSale, shift, punch-ticket, exercise, parent and reward details gate queries with `enabled: idOk`; e.g. AfterSale (`apps/admin/src/pages/crm/aftersale-detail.tsx:61-70,75-89`) and shift (`apps/admin/src/pages/attendance/shifts-detail.tsx:119-129,176-190`). Current Class and Student do not: they enable on mere presence (`apps/admin/src/pages/classes/class-detail.tsx:431-441`; `apps/admin/src/pages/students/student-detail.tsx:73-87`). Phase 3 and Phase 5 correctly make this required (`phase-03-staff-routes-forms-and-navigation.md:93`; `phase-05-existing-detail-url-and-cross-link-normalization.md:56,70`). |
| Unknown section is route-level not-found | **NEW CONTRACT; no current helper** | D7 and Phase 5 are consistent: only exact base redirects; unknown sections are not-found (`decisions.md:91-92`; `phase-05-existing-detail-url-and-cross-link-normalization.md:28,56,70`). Current global wildcard renders `ComingSoon`, not a not-found result (`apps/admin/src/routes/index.tsx:85-88`), and no reusable route-level NotFound component was found. A domain-local nested wildcard/EmptyState is therefore required. This is not contradicted by current source, but it must not fall through to the global ComingSoon route. |
| Static `/new` before parameter route | **VERIFIED/current precedent** | D7 and Phases 3/6 require it (`decisions.md:83`; `phase-03-staff-routes-forms-and-navigation.md:50,64,108`; `phase-06-remaining-first-class-record-rollout.md:40,85`). Finance declares `new` before `:id` (`apps/admin/src/routes/finance.routes.tsx:26-33,68-84`); HR declares `shifts/new` before `shifts/:registrationId` (`apps/admin/src/routes/hr.routes.tsx:65-80`). |
| `/go` allowlist, malformed fallback and replace | **VERIFIED/current precedent; Staff/Meeting are NEW registrations** | `resolveGo` accepts only own registered keys and UUIDs (`packages/links/src/index.ts:39-53`) and tests prototype keys/non-UUIDs (`packages/links/src/index.test.ts:62-93`). The resolver renders a truthful invalid-link EmptyState when resolution fails and safely replace-redirects valid links (`apps/admin/src/pages/go-resolver.tsx:10-29`). D7 matches this (`decisions.md:84-85,89-90`). Phase 3 explicitly adds Staff registration (`phase-03-staff-routes-forms-and-navigation.md:18,53,64`); ParentMeeting is added in Phase 6 (`phase-06-remaining-first-class-record-rollout.md:31,39`). A `/go` cold entry has no return state, so canonical-list fallback on the destination detail is consistent. |
| Compatibility route consumers migrate to canonical emitters | **NEW CONTRACT, inventory precedent verified** | Phase 3 names the known Staff browser/live/mobile/acceptance consumers and requires a whole-repo grep (`phase-03-staff-routes-forms-and-navigation.md:54-60,72-76,110-111`). Current source confirms emitters in the journey, live helper, mobile audit and manifest (`apps/e2e/src/journey/create-staff-via-admin-ui.ts:107-132`; `apps/e2e/src/live/live-ui.ts:36-50`; `apps/e2e/src/erp-mobile-route-audit.test.ts:28`; `scripts/acceptance-report/flow-manifest.ts:962-983`). ParentMeeting current nav still emits `/crm/post-sale-meeting` (`apps/admin/src/shell/nav-registry.ts:81`); Phase 6 does not list nav/manifest consumers explicitly. This belongs in the missing compatibility matrix. |

## Failures / unresolved validation items

### Failure 1 — No explicit compatibility matrix after the accepted red-team finding

**Classification:** `FAILED`

The plan declares compatibility routes in D1/D8 and a generic replace rule in D7
(`decisions.md:7-10,81-92,94-98`), but never records a row-by-row matrix covering:

- `/admin/users` → `/hr/staff`;
- `/admin/users/:staffId` → `/hr/staff/:staffId/profile`;
- `/crm/post-sale-meeting` → `/crm/parent-meetings`;
- exact base detail → default section for Staff/Class/Student/Receipt;
- query preservation, hash dropping, router-state preservation and canonical fallback per row.

This matters because current query/state behavior differs by surface. `safeReturnTo` preserves
search and drops hash (`apps/admin/src/lib/safe-return-to.ts:91-92`), while simple `<Navigate
to="/...">` redirects shown in the current route tree do not explicitly forward the incoming search
or state (`apps/admin/src/routes/index.tsx:56,87`; `apps/admin/src/routes/hr.routes.tsx:35`).

**Required plan clarification:** add one compatibility matrix to D7 or the Phase 1 frozen inventory
and require route tests for every row. The matrix should be the authority used by Phase 3, Phase 5
and Phase 6.

### Failure 2 — `page` parse/normalization behavior is not frozen

**Classification:** `UNVERIFIED`

Phase 3 states `?q=&page=` and “deterministically” hydrate/write
(`phase-03-staff-routes-forms-and-navigation.md:22-23`) but does not define:

- omitted/empty/zero/negative/non-integer/oversized page behavior;
- whether canonical URL drops `page=1`;
- whether changing `q` replaces history and resets page to 1;
- whether invalid/out-of-range page is clamped, normalized via replace, or shown empty.

The current Staff list resets local page when debounced search changes
(`apps/admin/src/pages/admin/users.tsx:140-148`), but no source helper validates a page query.

**Required plan clarification:** freeze a positive-integer parser, default `1`, query-change reset,
and canonical serialization rule. Add focused tests for invalid page and Back/Forward hydration.

### Failure 3 — ParentMeeting warning is a successful create but modal-push behavior is unstated

**Classification:** `UNVERIFIED`

Phase 6 requires ParentMeeting schedule → detail and globally says modal create-success pushes
(`phase-06-remaining-first-class-record-rollout.md:31,41`). The API always creates the meeting and
may attach a soft double-booking warning (`apps/api/src/meeting/router.ts:88-109`). The current dialog
keeps the warning inside the modal instead of closing/navigating (`apps/admin/src/pages/crm/schedule-parent-meeting-dialog.tsx:29-42,60-89`).

**Required plan clarification:** both normal success and warning success must push the created
meeting detail. The warning must remain visible on the destination (for example safe route state or
server-derived detail copy), without keeping a second post-create work surface in the modal.

## Existing helper and test availability

| Need | Available now | Gap |
|---|---|---|
| Same-origin path+search validation | `safeReturnTo` (`apps/admin/src/lib/safe-return-to.ts:51-92`) | Needs a typed record-return wrapper with caller-supplied canonical fallback. |
| UUID validation | `UUID_RE`, `readUuidParam` (`packages/links/src/index.ts:6-14`) | Targeted existing details must adopt it before query enablement. |
| `/go` resolution | `resolveGo` + resolver (`packages/links/src/index.ts:44-53`; `apps/admin/src/pages/go-resolver.tsx:10-29`) | Register only approved new entities and test default-section redirect chain. |
| Query hydration | Receipt and Payroll (`apps/admin/src/pages/finance/receipt-list.tsx:88-115`; `apps/admin/src/pages/hr/payroll.tsx:419-464`) | No shared page parser/canonicalizer. |
| Domain return state | Shift/check-in typed `listScope` (`apps/admin/src/pages/attendance/shifts.tsx:923-951`; `apps/admin/src/pages/attendance/shifts-detail.tsx:98-108`) | No generic pathname+search type/validator. |
| Unsaved navigation blocker | `useUnsavedBlocker` blocks router navigation and beforeunload (`apps/admin/src/lib/use-unsaved-blocker.tsx:13-65`) | No focused blocker test exists; routed tab links must pass through the data router. |
| Memory-router tests | `renderWithProviders` uses `createMemoryRouter` (`apps/admin/src/test/render-with-providers.tsx:8-24`) | It does not expose the router, so direct Back/Forward assertions need a local harness or browser E2E. |
| Real browser Staff proof | Phase 3 names the existing journey and exact required flow (`phase-03-staff-routes-forms-and-navigation.md:54-58,72-76`) | New navigation contract must update old modal selectors and assert history, not only destination. |

## Cross-phase consistency

### Consistent

- Activity remains absent in Phase 3 and is added only with the functional timeline in Phase 4
  (`phase-03-staff-routes-forms-and-navigation.md:33-34`;
  `phase-04-operational-timeline-and-compliance-audit-separation.md:26-28,55-56`).
- Session `?tab=` remains an explicit exception while Class/Student/Receipt move to path sections
  (`phase-05-existing-detail-url-and-cross-link-normalization.md:17-28`).
- Dedicated `/new` replace and modal-create push are stated identically in D7 and Phase 6
  (`decisions.md:87`; `phase-06-remaining-first-class-record-rollout.md:41`).
- Phase 3 owns the first Staff browser proof; Phase 7 verifies rather than postpones it
  (`phase-03-staff-routes-forms-and-navigation.md:72-76,101-103`;
  `phase-07-coverage-gates-e2e-and-documentation.md:49-53`).

### Contradictions / gaps

1. `plan.md` reports zero unresolved contradictions after red-team
   (`plan.md:104-109`), but the accepted compatibility-matrix finding was only propagated as generic
   prose, not a complete matrix.
2. The inventory describes `/finance/new` create-success replace as the required state
   (`reports/source-current-resource-depth-inventory.md:31`), while current code still pushes
   (`apps/admin/src/pages/finance/receipt-create.tsx:146-148`). Phase 6 can repair it, but its
   Receipt row names timeline only (`phase-06-remaining-first-class-record-rollout.md:30`); the
   generic implementation step must be made explicit in the Receipt delta to prevent omission.
3. ParentMeeting's soft-warning create result is not reconciled with modal-success push, as detailed
   in Failure 3.

## Executed evidence

- `pnpm --filter @cmc/links test -- src/index.test.ts` — passed; 2 files, 32 tests.
- `pnpm --filter @cmc/admin test -- ...` — passed; package runner executed 68 files, 668 tests.
  jsdom emitted expected unimplemented Canvas/scroll warnings; exit code was 0.
- `git diff --check` over the plan/report scope before and after this report — passed.

## Recommendation

**Revise before implementation.** Close the three failures above, then rerun the URL/history
consistency sweep. No product code should start until the compatibility matrix and page/warning
semantics are frozen.

Status: DONE_WITH_CONCERNS  
Summary: URL/history architecture is sound and well supported by current primitives, but three
execution-level contracts remain incomplete.  
Concerns/Blockers: compatibility matrix, Staff page normalization, ParentMeeting warning-success
navigation.
