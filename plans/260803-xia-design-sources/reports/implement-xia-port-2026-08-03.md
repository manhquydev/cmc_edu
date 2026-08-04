# Xia port implement — Shopify · GitHub · Cal · Airbnb → CMC

**Date:** 2026-08-03  
**Source:** `/home/manhquy/Downloads/design` + parallel research agents  
**Surface:** `/design`

## Decision (challenge)

| Source pattern | Port? | CMC delivery |
|----------------|-------|--------------|
| Polaris settings + highlight | Yes | SettingsSection (exists) + **Callout** |
| Primer dense meta + counters | Yes | **MetaRow**, **CountBadge** |
| Primer/Cal status clarity | Yes | **StatusBadge soft default** |
| Airbnb/Cal identity | Yes | **Avatar** (+ EntityHeader) |
| CRM audit trail | Yes | **ActivityTimeline** |
| Brand greens/oranges/coral | No | Keep `#0071E3` |
| Sharp 3–6px radius | No | Keep 12/16/20 |
| Marketing sparsity | No | Ops density |

## Shipped

- `Callout`, `Avatar`, `MetaRow`/`MetaItem`, `CountBadge`, `ActivityTimeline`
- `StatusBadge` `appearance="soft"` default
- Design Lab: **Xia sources**, **Identity**, **Timeline**, inventory updates
- `packages/ui/llms.txt` xia rules
- Reports under `plans/260803-xia-design-sources/reports/`

## Validation

- Browser `/design`: xia, avatar×3, callout×3, timeline, meta, soft badges
- Unit tests + `@cmc/ui` build green
