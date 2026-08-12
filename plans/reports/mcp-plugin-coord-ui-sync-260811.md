# Điều phối MCP · plugin · skill (wave UI sync)

**Ngày:** 2026-08-11  
**Mục đích:** ghi lại tool nào dùng việc gì — áp dụng mọi turn tiếp theo  

## Bảng tool → việc

| Việc | MCP / plugin / skill | Ghi chú |
|------|----------------------|---------|
| PR status, check runs | **GitHub** `pull_request_read` | PR #110 open · `mergeable_state: unstable` · CI fail (typecheck/ui-e2e/e2e) · security ok |
| Blast radius trước sửa form | **GitNexus** `detect_changes` / `impact` / `context` | So `origin/develop`: ~74 files, risk **critical** (nhiều process UI admin) — **chủ yếu presentation**; API get/list flags đã chạm |
| Tìm flow list/form | **GitNexus** `query` | Gợi ý `ListPage` (`packages/ui`) + `kpi.tsx` / shifts tests — đúng queue list density |
| Deep link / path | `@cmc/links` + grep routes | Không invent URL ngoài catalog |
| UI density Operate | **impeccable** mode **Operate** · polish/layout | Admin ERP = task completion; token Console authority |
| Unit proof | vitest `@cmc/admin` | Log scratch khi trong goal |
| Code review domain | ak `code-reviewer` / note review-advise | Cấm đổi permission/mutation khi densify |
| Brainstorm/advise | ak brainstorm pattern + reports | Always write durable notes in `plans/reports/` |
| Browser visual | Playwright MCP (khi cần UAT) | Sau list density; không bắt buộc form unit |
| Docs lib | context7 (khi API UI lib đổi) | Chỉ khi upgrade dependency |

## PR #110 (GitHub MCP — snapshot)

| Field | Value |
|-------|--------|
| URL | https://github.com/manhquydev/cmc_edu/pull/110 |
| State | **open** · base `develop` |
| Head trên remote | `cc0ed9d` (KPI densify) |
| Local ahead | **+3** commits (parent/session · student/class · catalog) **chưa push** |
| Checks | security **success** · typecheck/ui-e2e/e2e **failure** · auto-merge skipped |
| Owner policy | **Để sau** — không babysit ship trong wave densify |

## GitNexus advise (sau densify)

- Changed symbols: CheckInOutPage, ClassDetailContent, StudentDetailPage, ReceiptDetailPage, SessionDetailPage, KpiPage, AfterSalePage, routers get/list, links — khớp form-depth wave.  
- Affected processes: punch, class tabs, receipt copy/link, student link — **UI process**, không payroll calc.  
- Risk “critical” = **số process chạm**, không = regression domain đã chứng minh bằng unit tests.  
- Next list density: start from `ListPage` + consumer pages (shifts list, kpi board, aftersale list, parents list).

## Impeccable (Operate) — quy tắc wave list

1. Mode **Operate** (admin task UI).  
2. Authority visual = Console tokens (`docs/design-system-console.md`), not TEKY teal.  
3. Commands: **layout/polish** on list pages; **distill** dual HITL if any reappears.  
4. Do not open new-work redesign of shell.

## Agentkit pattern (không fleet 24/7)

```
main (advise) 
  → cook densify (1 file ownership)
  → vitest proof
  → GitNexus detect_changes / review-advise note
  → (optional) GitHub check PR when owner ships
```

## Next action when work resumes

1. Optional: push local +3 to update PR #110 head (owner).  
2. List density: `ListPage` + FilterBar on priority lists — impeccable layout.  
3. If CI fix requested: GitHub check_runs → fix failures only (not densify).  
