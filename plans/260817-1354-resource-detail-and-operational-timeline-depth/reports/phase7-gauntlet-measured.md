# Phase 7 gauntlet — measured

Measured locally on 2026-08-20 from repo root. No source edits. No commit.
Local HEAD at `acceptance:report` time: `42d05c7`.

## Commands

| # | Command | Exit | Key numbers |
|---|---------|------|-------------|
| 1 | `pnpm typecheck` | **0** | turbo: 34 successful / 34 total; 25 cached; 32.742s |
| 2 | `pnpm resource-depth:audit` | **0** | unknown routes **0**; duplicate canonical paths **0**; unclassified details **0**; exceptions **13** |
| 3 | `pnpm lint` | **0** | `eslint apps/admin apps/lms scripts` |
| 4 | `pnpm test` | **1** | turbo: 29 successful / 30 total; failed `@cmc/api#test`; 1m12.102s |
| 5 | `pnpm acceptance:report` | **0** | proven **0/43**; journey specs 37/43; 42 built / 1 partial / 0 missing; 9 documented orphans |
| — | `gh run list --branch main --limit 8` | **0** | see CI below |

## resource-depth:audit

- Unknown routes: **0**
- Duplicate canonical paths: **0**
- Exception count: **13**

Exception paths (registry, not failures):

- `/go/:entity/:id` — resolver
- `/teaching/sessions/:sessionId` — workspace-detail
- `/teaching/classes/:classBatchId/exercise-sequence` — subresource-workspace
- `/hr/staff/:staffId` — compatibility
- `/admin/students/:id` — compatibility
- `/admin/classes/:id` — compatibility
- `/crm/aftersale/:caseId` — timeline-gap
- `/teaching/exercises/:exerciseId` — timeline-gap
- `/hr/checkin/:ticketId` — timeline-gap
- `/hr/shifts/:registrationId` — timeline-gap
- `/hr/kpi/:scoreId` — timeline-gap
- `/admin/engagement/rewards/:rewardId` — timeline-gap
- `/admin/users/:staffId` — compatibility

## `pnpm test` failure (verbatim tail)

```
@cmc/api:test: TypeError: Cannot read properties of undefined (reading 'id')
@cmc/api:test:  ❯ src/enrollment/reserved-active.test.ts:64:36
@cmc/api:test:      62|
@cmc/api:test:      63|   afterEach(async () => {
@cmc/api:test:      64|     await cleanupFacility(facility.id);
@cmc/api:test:        |                                    ^
@cmc/api:test:      65|   });
@cmc/api:test:      66|
@cmc/api:test:
@cmc/api:test:
@cmc/api:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[277/2008]⎯
@cmc/api:test:
@cmc/api:test:  Test Files  112 failed | 24 passed (136)
@cmc/api:test:       Tests  1038 failed | 256 passed (1294)
@cmc/api:test:    Start at  10:28:03
@cmc/api:test:    Duration  70.85s (transform 5.11s, setup 0ms, import 39.57s, tests 3.48s, environment 18ms)
@cmc/api:test:
@cmc/api:test:  ELIFECYCLE  Test failed. See above for more details.
@cmc/api#test:  ERROR  command (/home/manhquy/Downloads/cmc_edu/apps/api) /home/manhquy/.nvm/versions/node/v24.18.0/bin/pnpm run test exited (1)

 Tasks:    29 successful, 30 total
Cached:    24 cached, 30 total
  Time:    1m12.102s
Failed:    @cmc/api#test

 ERROR  run failed: command  exited (1)
 ELIFECYCLE  Test failed. See above for more details.
EXIT:1
```

Immediate cause in the same log: `createPrismaClient: neither APP_DATABASE_URL nor DATABASE_URL is set.`

Other local packages that completed: `@cmc/admin` 75 files / 713 tests passed; `@cmc/ui` 48 / 187; `@cmc/auth` 2 / 1132; remaining domain/scripts/links/storage packages passed.

## `pnpm acceptance:report`

Proven flows: **0/43**.

Printer output:

```
acceptance:report — 43 luồng (42 built, 1 partial, 0 missing), 9 orphan (9 documented gap, 0 chưa phân loại), 0 unresolved namespaces.
journey coverage — 37/43 luồng có journey spec.
bằng chứng chạy — 0/43 luồng đã chứng minh chạy (results @ c0d81da7e9f2e82c5b7be792a28330d7d08d61b1-dirty, HEAD 42d05c7, project —)
  KẾT QUẢ CŨ: results chạy ở commit khác HEAD — toàn bộ luồng hạ về "chưa chứng minh".
  WORKTREE BẨN: lần chạy diễn ra khi cây làm việc có thay đổi chưa commit — kết quả CHỈ THAM KHẢO, không phải sổ chính danh (sổ chính danh chỉ nhận artifact CI).
  LẦN CHẠY CÓ LỖI MỨC RUN: 1 lỗi (vd. globalSetup chết) — kết quả không đầy đủ.
  CHẠY THIẾU (partial run): 37 spec đã khai nhưng không có trong kết quả — không dùng lần chạy này làm sổ chính danh.
```

HTML: `acceptance-report/index.html`

## Latest CI on `main`

`gh run list --branch main --limit 8` (newest first):

| Status | Title | Workflow | Run | When |
|--------|-------|----------|-----|------|
| success | npm_and_yarn `@fullcalendar/core` | Dependabot Updates | 32268844457 | 2026-08-19T15:14:21Z |
| success | npm_and_yarn `@testing-library/jest-dom` | Dependabot Updates | 32268843456 | 2026-08-19T15:14:21Z |
| success | npm_and_yarn `@types/node` | Dependabot Updates | 32268841218 | 2026-08-19T15:14:20Z |
| failure | npm_and_yarn `deepmerge-ts` | Dependabot Updates | 32268727983 | 2026-08-19T15:13:13Z |
| success | Push on main | CodeQL | 32268705348 | 2026-08-19T15:13:00Z |
| cancelled | Merge PR #166 | **ui-e2e** | 32268703941 | 2026-08-19T15:12:59Z |
| success | Merge PR #166 | **CI** | 32268703865 | 2026-08-19T15:12:59Z |
| success | Push on main | CodeQL | 32265501703 | 2026-08-19T14:41:17Z |

Required checks:

| Check | Latest on `main` | Conclusion | SHA | Run |
|-------|------------------|------------|-----|-----|
| `typecheck-and-test` | CI after merge PR #166 | **success** | `42d05c77e063355359b21ea2325814d9e3361904` | [32268703865](https://github.com/manhquydev/cmc_edu/actions/runs/32268703865) |
| `ui-e2e` | same merge PR #166 | **cancelled** (job `ui-e2e` cancelled after ~6h) | `42d05c77e063355359b21ea2325814d9e3361904` | [32268703941](https://github.com/manhquydev/cmc_edu/actions/runs/32268703941) |
| `ui-e2e` last success | merge PR #165 | **success** | `590fc27736fa77b1fe401ebf9f45de545757a704` | [32265502036](https://github.com/manhquydev/cmc_edu/actions/runs/32265502036) |
