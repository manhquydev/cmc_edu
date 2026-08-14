# Test Report — 2026-08-14 08:36 — URL structure (toàn dự án)

**Câu hỏi:** URL đã thiết kế thế nào, và đã áp dụng hết dự án chưa?
**Trả lời:** Có **một công thức as-built** (list + `:uuid` / workspace query / `/go`). Router, `@cmc/links`, nav, và `flow-manifest` **khớp nhau** (75 route · 0 finding). Literal giấy `/finance/receipts` đã bị HITL API + showcase dùng — **đã sửa** trong lượt này. TL06 không phải target.

Authority: router + `@cmc/links` + `nav-registry` + `flow-manifest`. TL06 = giấy tư vấn.

## Test Results Overview

| Suite | Tests | Pass | Fail | Evidence |
|---|---|---|---|---|
| `pnpm check:url-structure` | 1 gate | 1 | 0 | 75 routes, 93 catalog, findings=[] |
| `pnpm test:url-structure` | 1 | 1 | 0 | CLI HEAD green |
| `check-url-structure.test.ts` (vitest) | 10 | 10 | 0 | fixture + live HEAD + dangling-manifest |
| `pnpm check:url-literals` | 1 gate | 1 | 0 | 306 files (kèm live-sim), failCount=0 |
| `pnpm test:url-literals` | 2 | 2 | 0 | fixture stale + HEAD |
| `@cmc/links` `index.test.ts` | 16 | 16 | 0 | builders + `/go` |
| `nav-route-resolution.test.ts` | 41 | 41 | 0 | nav ⊆ router |
| **Tổng** | **72** | **72** | **0** | Playwright e2e **không** chạy |

**Duration:** ~8s (gates + unit). Không đo coverage % — đây là closed-world contract, không phải line-coverage.

## Coverage Metrics

| Surface | Quét? | Threshold | Status |
|---|---|---|---|
| Admin + LMS router | có | mọi route ∈ catalog | PASS |
| `@cmc/links` + workspace builders | có | mọi builder ∈ router | PASS |
| `nav-registry` | có | mọi nav ∈ router | PASS |
| `flow-manifest` `uiRoutes` | có (mới) | mọi uiRoute ∈ router | PASS |
| Quoted literals admin/lms/api/e2e/links/manifest | có (mới) | 0 paper/stale | PASS (sau fix) |
| Playwright journey deeplink | có sẵn, **chưa chạy** | — | SKIP |
| Cờ HITL cũ trong DB | không | — | residual |

## Công thức đã thiết kế (as-built, khóa 2026-08-11)

```
LIST       /{area}/{resource}     hoặc area index khi resource = area
NEW        /{area}/{resource}/new
FORM       /{area}/{resource}/:uuid
HITL /go   /go/{entity}/:uuid  → resolveGo → links.{entity}(id)
WORKSPACE  /{area}/{resource}?key=uuid
```

Ba cách mount (chấp nhận, không phải drift):

| Family | Ý nghĩa | Ví dụ as-built |
|---|---|---|
| `form-depth` (13) | list + form UUID | `/hr/shifts` · `/new` · `/:registrationId` |
| `index-resource` (5) | area **là** list | `/finance` · `/finance/new` · `/finance/:id` ; `/crm` (list) + `/crm/opportunities/:id` (form) |
| `admin-module` (17) | academic/loyalty dưới `/admin` | `/admin/students/:id`, `/admin/classes/:id`, `/admin/engagement/rewards/:rewardId` |
| `workspace` (15) | địa chỉ bằng query | `/teaching/attendance?sessionId=`, `/hr/payroll?userId=&period=` |
| `shell` (7) | login / cockpit / ComingSoon | `/login`, `/cockpit`, `/hr`, `/admin` |
| `lms` (13) | `hoc.*` | `/parent/…`, `/student/…` — **không** `/child/:id/…` |
| `paper-only` (23) | TL06, chưa có màn | contacts, curriculum, certificates, `/hr/staff`, `/search`… |

Redirect compat duy nhất: `/classes` → `/admin/classes`. Bare `/students` là ComingSoon, **không** phải list học sinh.

## Áp dụng toàn dự án — map giấy → code

| Vùng | Giấy (TL06) | As-built (đang chạy) | Áp dụng? |
|---|---|---|---|
| Học sinh | `/students`, `/students/:id` | `/admin/students`, `/admin/students/:id` | Có — **không** migrate ngược |
| Lớp | `/classes` | `/admin/classes` (+ redirect `/classes`) | Có |
| Khóa | `/courses` | `/admin/courses` | Có (chưa có `/:id`) |
| PH | `/parents` | `/admin/parents`, `/:parentId` | Có |
| Phiếu thu | `/finance/receipts`, `/:id` | `/finance`, `/finance/:id` | Có (HITL API vừa sửa) |
| Hoàn tiền | `/finance/refunds` | `/finance/refund` (ghi trên form phiếu) | Có |
| CRM list | `/crm/opportunities` | `/crm` | Có |
| CRM form | `/crm/opportunities/:id` | cùng path | Có |
| Doanh thu / đối soát | `/finance/revenue-report`, `/reconciliation` | `/ops/revenue`, `/ops/recon` | Có |
| Chấm công | `/attendance/check-in-out` | `/hr/checkin` | Có |
| Ca | `/attendance/shifts` (cấm) | `/hr/shifts` + `/new` + `/:id` | Có |
| Báo cáo học | `/teaching/report-cards` | `/admin/report-cards` | Có |
| Gắn kết | `/engagement/rewards` | `/admin/engagement/rewards` | Có |
| LMS con | `/child/:id/…` | `/parent/homework/:studentId`, `/parent/report-card/:studentId` | Có |
| `/go` | — | 12 entity builders | Có |

`@cmc/links` (HITL):

| Entity | Path |
|---|---|
| `opportunity` | `/crm/opportunities/${id}` |
| `receipt` | `/finance/${id}` |
| `student` | `/admin/students/${id}` |
| `classBatch` | `/admin/classes/${id}` |
| `shiftRegistration` | `/hr/shifts/${id}` |
| `kpiScore` | `/hr/kpi/${id}` |
| `afterSaleCase` | `/crm/aftersale/${id}` |
| `parentAccount` | `/admin/parents/${id}` |
| `classSession` | `/teaching/sessions/${id}` |
| `manualPunchTicket` | `/hr/checkin/${id}` |
| `reward` | `/admin/engagement/rewards/${id}` |
| `exercise` | `/teaching/exercises/${id}` |

## Hệ thống test vừa dựng (song song 4 mặt)

1. **Catalog đóng** `scripts/url-structure-contract.ts` — thêm màn = thêm row `asBuilt` + `family`.
2. **Gate cấu trúc** `pnpm check:url-structure` — router / links / nav / **manifest** phải khớp. Paper ≠ as-built **không** fail.
3. **Gate literal** `pnpm check:url-literals` — cấm quote `/finance/receipts`, `/attendance/shifts`, `/child/`, bare `/students`, … trên admin, LMS, API, e2e, links, manifest.
4. **CI** `typecheck-and-test` step `URL structure contract` + `verify:system` L2e/L2f.

## Failed Tests

Không có test đỏ sau fix.

### Phát hiện trước khi sửa (scanner bắt)

| File | Literal giấy | As-built |
|---|---|---|
| `apps/api/src/worker/reconcile-finance-flags.ts` (4) | `/finance/receipts/${id}` | `/finance/${id}` |
| `apps/api/src/worker/reconcile-orphaned-receipts.ts` (2) | cùng | cùng |
| `apps/api/src/finance/router.ts` `receiptCancel` | cùng | cùng |
| `apps/admin/src/pages/design-showcase.tsx` | `href="/finance/receipts"` | `/finance` |

HITL inbox click cờ mới sẽ mở form phiếu. **Cờ đã ghi DB trước fix vẫn giữ URL giấy** (ComingSoon / 404).

## Build Status

- Gates URL: PASS
- `pnpm test` turbo full: **không** chạy lượt này
- Playwright: **không** chạy (chậm; deeplink specs đã có sẵn)

## Critical Issues

1. **Cờ ReconciliationFlag cũ** — `deepLink` `/finance/receipts/…` trong DB không tự rewrite. Ảnh hưởng HITL lịch sử, không ảnh hưởng flag mới.
2. **Tab học sinh** dùng `useState` — F5 mất tab (không nằm trong URL). Session dùng `?tab=`.

## Recommendations

1. **High** — backfill `ReconciliationFlag.deepLink` `/finance/receipts/` → `/finance/` nếu inbox lịch sử còn dùng.
2. **Medium** — API nên import `@cmc/links` (`links.receipt`) thay vì string, để một chỗ sửa.
3. **Low** — không migrate `/admin/students` → `/students` khi chưa khóa product.
4. **Low** — chạy e2e deeplink (`deeplink-go`, `deeplink-detail-gates`, `workspace-deeplink`) trên CI đã có; không cần thêm browser suite cho gate này.
5. **Low** — cockpit/recon/schedule còn hardcode path đúng (`/finance/${id}`) thay vì `links.*` — không 404; siết khi đụng file.
6. **Low** — chưa có unit test `go-resolver`; `/go` đang sống ở e2e `deeplink-go`. `@cmc/links` vitest đang đếm đôi `dist/`.

## Unresolved Questions

- Có lock migrate academic ra khỏi `/admin` không? Gate **cố ý không** ép.
- Có backfill HITL deepLink không?

Xem thêm: `plans/reports/url-structure-audit-260813.md`.
