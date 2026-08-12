# Brainstorm + Advise — tự đánh giá & quyết định điều phối

**Date:** 2026-08-11 · **Mode:** --advise --auto --tdd  

## Tình trạng thật (evidence)

| Hạng mục | Bằng chứng | Đánh giá |
|----------|------------|----------|
| Form-depth ca · KPI · aftersale · parents · hoàn · huỷ | Local commits `41210d0`…`d393f21` | **Đã nấu xong** trên branch |
| Remote branch | `ahead 6` so với `origin/feat/...` | **Chưa push** 6 commit form-depth |
| PR #109 | `state: MERGED`, base `develop` | Form-depth **mới không nằm trong PR đã merge** |
| CI lần merge #109 | typecheck-and-test / ui-e2e / e2e **FAILURE** | Gộp cũ **không** chứng minh xanh |
| BA Odoo sync | `ba-status-and-ui-odoo-sync-scope-260811.md` | Ship truth + polish Console; cấm kanban TEKY product |
| Chấm công UI | `check-in-out.tsx` — nút lg nhưng chưa “thẻ chấm” | B1 polish trong phạm vi |

## Contract

| Field | Content |
|-------|---------|
| **Outcome** | (1) Quyết định điều phối ghi sổ; (2) B1 chấm công: CTA rõ + tab không mang tên product “Duyệt…”; (3) form-depth sẵn ship qua PR mới |
| **Constraints** | TDD; không domain rewrite; không kanban ticket product; Console tokens; ADR 0043 |
| **Non-goals** | Chatter KPI; bảng công tháng; gifts; LMS spine; e2e hoàn/huỷ wave này |
| **Acceptance** | check-in-out tests green; label tab resource-centric; primary punch hierarchy rõ; report decision |

## DECISION (auto — không chờ owner)

| # | Quyết định |
|---|------------|
| D1 | **Không** nấu module form-depth mới wave này |
| D2 | **Ship path:** sau B1 → push branch → **PR mới → develop** (vì #109 đã MERGED) |
| D3 | **This session implement:** **B1 only** — polish `/hr/checkin` Console CTA + rename inbox tab |
| D4 | **Defer B3 KPI density**, e2e P1-08, bảng công tháng |
| D5 | **Cấm** TEKY kanban attendance product |

## Work order

1. B1 TDD check-in (now)  
2. Commit + BA/coordination report  
3. Push + open PR (ship gate — after green local tests)  

## Advise summary

Form-depth là **inventory local chưa land**. Ưu tiên **đóng gói ship** + **một polish chấm công** để UI bắt đầu bám ảnh 1 mà không phá luật. Không parallel LMS.

## Execution log (auto)

| Bước | Kết quả |
|------|---------|
| B1 TDD check-in punch card + tab "Hàng chờ phiếu" | **Done** — `check-in-out` 20 tests green |
| Domain / API | Không đổi |
| Ship push + PR mới | **Next** (PR #109 đã MERGED; local ahead 6+1) |
