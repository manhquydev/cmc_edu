# Modern calendar UI pass (anti-classical)

**Date:** 2026-08-03  
**Goal:** Lịch giáo dục trông SaaS 2024–26, không “ô lịch Excel / ERP 2015”.

## Research signals

| Source | Takeaway for CMC |
|--------|------------------|
| Notion calendar | Soft hierarchy, subtle color labels, multi-view same data |
| Linear / modern SaaS | Quiet chrome, soft elevation, pill chips, no heavy borders |
| Eleken calendar UX | Visual hierarchy > more features; scannable time + status |
| Google Calendar | Clear “today”; avoid for dense left-rail everything |
| Cal.com | Clean forms; we skip orange dual-brand |

## Reject (classical)

- Hard 1px grid prison (7 equal cells with full borders)
- Thick left-border status stripes only
- Flat gray month cards with Badge stuck in corner
- Em dash “—” empty cells
- Heavy StatusBadge solid in every compact cell

## Ship (modern)

1. **Floating day columns** — gap 8px, radius 16, soft shadow  
2. **Today** — gradient wash + filled day number + “Hôm nay” pill  
3. **Session tiles** — soft wash fills, micro rail, status chip+dot, live pulse  
4. **CTA pill** — full soft button, solid brand on hover  
5. **Empty day** — dashed “Trống” pocket  
6. **Legend** — pill chips, not raw colored squares  
7. **Week toolbar** — title strip (blur)

## Files

- `session-card.tsx`, `week-schedule.tsx`, `premium.css` schedule block  
- Design Lab `#schedule`, production `/teaching/schedule?view=week`
