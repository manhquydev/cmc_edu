# Browser verify — design restructure live (2026-08-15)

**Stack:** local-sim `https://erp.localhost`, admin image rebuilt from `develop@fc1f76d` (#142–#145).  
**Method:** Playwright + `ignoreHTTPSErrors` (Cursor browser MCP blocked on self-signed TLS). Screenshots: `/tmp/cmc-ui-verify/`.

## Matrix vs design goals

| Surface | Expectation (design bridge) | Live result | Verdict |
|---------|----------------------------|-------------|---------|
| Chrome brand | Purple `#71639e` | Navbar `rgb(113, 99, 158)` | **PASS** |
| Finance sort | Sortable headers | ~3 sort controls | **PASS** |
| Finance bulk honesty | No “Chọn tất cả N khớp” without IDs | `dishonestWiden=false` | **PASS** |
| Finance draft → brand | Purple waiting badge | DB: **0 draft / 7 approved** — brand not observable | **PARTIAL** (code shipped; seed/data gap) |
| Draft filter empty | `filtered` when status filter excludes all | `data-empty-kind=filtered` | **PASS** |
| Receipt detail | StatusBadge | `Đã duyệt` success | **PASS** |
| CRM table stages | O3/O4 brand, O5 success | `Đã kiểm tra` brand; `Đã ghi danh` success | **PASS** |
| CRM table sort | Giai đoạn + Việc tiếp | Both `console-list-sort` present | **PASS** |
| Aftersale empty | first-run | `data-empty-kind=first-run` | **PASS** |
| Courses CategoryChip | UCREA chip | `console-category-chip--a` | **PASS** |
| Classes empty (#145) | first-run if empty; search→neutral | 1 class exists → no first-run; search `ZZZ` → neutral string, **no** `filtered` | **PASS** |
| Students honesty | no fake kinds | filtered=0 firstRun=0 | **PASS** |
| Parents | recipe not landed | `data-empty-kind=0` | **GAP** |
| Mobile 390 | usable | screenshot `10-mobile-classes.png` | **PASS** |

## Gaps still visible (design restructure)

1. **Wave 4B** (button states / tabs indicator) — not in production look yet.  
2. **Wave 8 fan-out** — Parents (and payroll / exercises / shifts) still bare empty.  
3. **Demo evidence** — no draft receipt in prod-sim DB → waiting brand not eye-visible on finance list.  
4. **Wave 5 saved views / Wave 6 archetype spacing / Wave 9 shell** — still out / unauthorized.  
5. MCP `@Browser` cannot open self-signed HTTPS (use Playwright for local-sim).

## Recommended next scope (aligned to design goal)

**Primary:** continue Wave 8 — **Parents ListPage empty recipe** (same BRIDGE checklist as Classes), one PR.  
**Parallel housekeeping:** re-run idempotent seed (or ensure draft fixture) so finance brand waiting is visible on prod-sim.  
**Hold:** Wave 4B until after one more list fan-out *or* if owner wants shared atoms next (CSS-only).  
**No-go:** shell Wave 9, kanban redesign, mass fan-out.
