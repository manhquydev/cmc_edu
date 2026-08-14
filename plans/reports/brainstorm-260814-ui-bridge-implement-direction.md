# Brainstorm — hướng implement UI bridge sau D0–D5

**Date:** 2026-08-14  
**Mode:** Operate (admin ERP) · impeccable shape + ak:brainstorm + kongming `--advice`  
**Đầu vào:** `design-lab/system/BRIDGE.md`, `impl-260814-d0-d5-design-path.md`, scout post-D0–D5  
**Counsel:** kongming — hướng 2 (một module E2E) + Wave 4 atoms mỏng trước

## Contract (đề xuất — chờ xác nhận)

| Field | Nội dung |
|-------|----------|
| **Outcome** | Staff admin dùng **cùng grammar** (empty×3, sort/`aria-sort`, bulk scope trung thực, 6 tone + category, gate SoD nói rõ lý do) trên ít nhất **một module end-to-end (CRM)** và có **recipe tái áp** cho module sau — không đổi shell OpenEduCat, không repaint gallery radii. |
| **Constraints** | Production chrome = `OPENEDUCAT-VISUAL-CONTRACT`; production values thắng palette/radius; Wave 9 / Q-shell **không** mở; một module một PR; PR #142 CI xanh trước khi chồng Finance SoD thêm; solo + AI ⇒ gate CI là review. |
| **Non-goals** | Shell 240px rail; repaint 6/8px gallery; port statusbar/funnel geometry; lab DnD/attendance-cycle demos; mega-plan Wave 4→8 trong một cook; Tailwind/shadcn. |
| **Acceptance** | (1) Wave 4 atoms API trong `@cmc/ui` + test khóa tone/`data-category`. (2) CRM list + kanban (hoặc pipeline) adopt empty×3 + sort nơi có nghĩa + badge vocab. (3) `ADOPT.md` / recipe trong BRIDGE: checklist 10–15 bước cho ListPage. (4) `pnpm typecheck` + UI tests xanh; không đụng shell topology. |

## Ba hướng so sánh

| # | Hướng | Go/No-go | Vì sao |
|---|--------|----------|--------|
| **1** | Grammar-first: sweep ~30 ListPage empty/sort/bulk | **Go sau** | Cần recipe đã chứng minh trên 1 module; mass-apply sớm → lỗi ngữ nghĩa im lặng (empty kind / bulk scope) mà CI khó bắt. |
| **2** | Một module E2E (CRM) rồi fan-out | **Go (khuyến nghị)** | Chứng minh grammar + module pattern trên bề mặt traffic cao; tạo template; Wave 4 atoms là pre-PR mỏng. |
| **3** | Mega-plan Wave 4→8 một phát | **No-go** | Repo đã có plan UI chồng chéo chưa đóng; một plan khổng lồ = rot + khó rollback. |

## Lộ trình 2 tuần (solo+AI) nếu chọn #2

1. **Ngày 0:** PR #142 merge; park/supersede plan stale (OpenEduCat clone, Odoo dissection blue, list-density nếu chồng).  
2. **PR A — Wave 4 atoms:** `StatusBadge` + `brand` tone + `data-category` (và tabs/button state tokens nếu rẻ); production pixels; không shell.  
3. **PR B — CRM E2E grammar:** list + pipeline/kanban adopt recipe; không port lab DnD.  
4. **PR C — recipe + 1–2 ListPage “copy theo recipe”** (Students hoặc Teaching list) để chứng fan-out rẻ.  
5. **Sau đó:** Wave 5 saved views / Wave 6 spacing / Teaching attendance — plan riêng, không nhét vào cook này.

## Rủi ro lớn nhất

AI áp empty×3 / bulk “chọn tất cả khớp lọc” **sai ngữ nghĩa** trên ~30 trang — UI trông đúng, nghiệp vụ sai. Mitigation: recipe + review từng PR module; không parallel Wave 8.

## Impeccable (Operate)

- Authority: OpenEduCat chrome + lab **grammar** (không pixel gallery).  
- Brand trong chi tiết chính xác (tone, empty copy, SoD), không redesign shell.  
- Forbidden: card-heavy metrics, tone status cho taxonomy, ẩn nút SoD không lý do.
