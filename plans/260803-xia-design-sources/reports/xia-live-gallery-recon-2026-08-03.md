# Xia live gallery recon — design systems → Design Lab

**Date:** 2026-08-03  
**Mode:** ak-xia recon + port (patterns only)  
**Surfaces:** `/design` → `#xia` (XiaSourcesExplorer) · `#styles` (StyleExplorer + new themes)

## Sources verified

| Rank | Source | Agent surface | ERP fit | Live theme id |
|------|--------|---------------|---------|---------------|
| 1 | IBM Carbon | `carbondesignsystem.com/llms.txt` | high | `carbon` |
| 2 | Ant Design | `ant.design/design.md` + llms.txt | high | `ant` |
| 3 | Atlassian ADS | `atlassian.design/llms.txt` + MCP | high | `slate-enterprise` |
| 4 | GitHub Primer | local DESIGN.md (no llms.txt) | medium | `primer` |
| 5 | Shopify Polaris | local DESIGN.md | high | `polaris` |
| 6 | Cal.com | local DESIGN.md | medium | `cal-clean` |
| 7 | Airbnb DLS | local DESIGN.md | low | `airbnb` |
| 8 | shadcn/ui | llms.txt + MCP | medium (impl only) | — (no theme) |

## Challenge decisions (keep)

| Decision | Recommendation |
|----------|----------------|
| Brand | Keep CMC `#0071E3` — do not adopt IBM/Ant/Shopify/Airbnb brand seeds as product identity |
| Stack | Keep Astryx + `@cmc/ui` — no Carbon React / antd / Atlaskit / shadcn install |
| Patterns | Port table/filter/shell/empty/status grammar into existing frames |
| Lab | Scoped CSS themes only — production tokens untouched until user votes a direction |

## Extract highlights

- **Carbon:** Data Table, Filtering, UI Shell, Side Panel, Empty/Status patterns  
- **Ant design.md:** layout `#F5F5F5`, primary `#1677FF`, control 32px, radius 6/8, one primary CTA  
- **ADS:** token taxonomy + a11y + workflow density  
- **Local xia pack:** Polaris callout/settings; Primer meta density; Cal booking clarity; Airbnb avatar trust  

## Files delivered

- `apps/admin/src/pages/design-lab-xia.tsx` + `.css`  
- Themes `carbon` · `ant` · `airbnb` in `design-lab-styles.*`  
- Design Lab sections wired at `#xia` and `#styles`

## Next (only after user pick)

1. User marks preferred style id in lab (localStorage).  
2. Pilot map tokens → `packages/ui/src/tokens.css` on 1 cockpit + 1 list.  
3. Do not full-app retheme without pilot acceptance.
