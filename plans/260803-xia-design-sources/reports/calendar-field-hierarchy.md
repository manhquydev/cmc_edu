# Calendar field hierarchy — education ERP (CMC)

**Date:** 2026-08-03  
**Sources:** progressive disclosure (NN/g), Cal.com clarity, Polaris density, local DESIGN.md corpus, prior edu calendar research.

## Task of the screen

Teacher / đào tạo: **biết buổi nào → lớp nào → có cần điểm danh không → bấm một phát**.

## Field tiers

| Tier | Field | Show full? | Truncate? | Hide → |
|------|--------|------------|-----------|--------|
| **P0** | `title` (mã lớp) | Prefer full | ellipsis only if overflow | never hide |
| **P0** | `timeLabel` (giờ hoặc kỳ ngắn) | Prefer full short form | ellipsis OK if long | compact: short `MM/YY–MM/YY` |
| **P0** | `status` chip | short labels | chip max-width ellipsis | never hide |
| **P0** | `actionLabel` CTA | short verb | ellipsis | spacer if none |
| **P1** | `subtitle` (CTĐT) | default own line | ellipsis | compact: 1 foot line |
| **P2** | `meta` (phòng · GV) | default own line | ellipsis | compact: demote or win via `footPriority` |
| **P3** | `detail` (kỳ đầy đủ, id, notes) | no | — | **tooltip only** |

## Density

| View | Density | Secondary lines |
|------|---------|-----------------|
| Week columns | `compact` | 1 line (`footPriority`: identity for batches) |
| Month / kanban / list cards | `default` | 2 lines: program + meta |

## Anti-patterns rejected

- Dumping full ISO date range into compact week cells (P0 time becomes unreadable)
- Teacher UUID as primary text
- Multi-line wrap that breaks equal card height
- Hiding CTA on live sessions

## Xia / design sources (adapt, not transplant)

- **Cal.com:** time-first clarity, short forms  
- **Shopify Polaris:** resource list density, labels above noise  
- **GitHub Primer:** dense meta as secondary  
- Skip Airbnb marketing sparsity / dual brand accents  

## Implementation

- `SessionCard` + `resolveSessionFoot`  
- `schedule.tsx` maps batch → short period on week, full range on month  
- Design Lab field matrix table  
