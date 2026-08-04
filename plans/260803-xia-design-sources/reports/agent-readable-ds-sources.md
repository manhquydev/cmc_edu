# Agent-readable design system sources (2025–2026)

**Scope:** complements local extracts in `/home/manhquy/Downloads/design` (GitHub/Primer, Shopify/Polaris, Airbnb, Cal.com) for **education ERP admin** (dense tables, forms, filters, status, shell nav) — not consumer marketplace.

**Method:** live endpoint probes (2026-08-03). Max 3 web-style fetches; credibility weighted to official maintainer surfaces.

**Local gap:** `github.com-DESIGN.md` + `shopify.com-DESIGN.md` cover **tokens/visual language**. They lack **enterprise patterns** (data table, filtering, empty/status, form density, UI shell). Airbnb/Cal.com = consumer — deprioritize for admin ERP.

---

## Ranked sources (use in this order)

| Rank | Source | Agent surface | ERP-admin fit | Adoption risk |
|------|--------|---------------|---------------|---------------|
| **1** | **Carbon** (IBM) | Real `/llms.txt` index | Best: product DS for dense ops UIs | Low — mature open source |
| **2** | **Ant Design** | `/llms.txt` + `design.md` + for-agents + MCP/CLI | Explicit enterprise backend | Low — huge community; major-version churn |
| **3** | **Atlassian Design** | `/llms.txt` + split dumps + ADS MCP | Work-mgmt density, a11y, tokens | Med — package lock-in if code-adopted |
| **4** | **Primer** (GitHub) | **No** native `llms.txt` (404); HTML product docs + primitives CSS | Density/info UI; pair with local GitHub extract | Low for patterns; med if adopting Primer React |
| **5** | **shadcn/ui** | `/llms.txt` + MCP + Skills | Impl vehicle (AI-ready), not design authority | Low if already Tailwind/Radix |
| **6** | **Polaris** (Shopify) | **No** `llms.txt`; site `noai` robots | Merchant **admin** patterns only | High for agents — crawl blocked; use local extract |

---

## Six sources — URL + what to extract

### 1. Carbon Design System — primary ERP pattern index
- **URL:** https://carbondesignsystem.com/llms.txt  
- **Credibility:** Official IBM product DS; live markdown index (verified 200).  
- **Extract for edu ERP admin:**
  - **Components:** Data Table, Form, UI Shell, Side Panel, Pagination, Multiselect, Notification, Tag, Progress Indicator, Tree View  
  - **Patterns:** Filtering, Forms, Empty states, Status indicators, Dialogs, Loading, Common actions  
  - **Foundations:** Spacing, 2x Grid, Themes, Typography (density)  
  - **Data viz:** chart types + status color palettes (enrollment, attendance KPIs)  
- **Trade-off:** Visual language is IBM (not CMC brand). Steal **interaction patterns**, not Carbon chrome.  
- **Complements local:** fills pattern gap left by GitHub/Shopify token extracts.

### 2. Ant Design — agent tooling + enterprise admin language
- **URLs:**
  - https://ant.design/llms.txt  
  - https://ant.design/design.md (machine DESIGN.md)  
  - https://ant.design/docs/react/for-agents.md  
  - Specs: `/docs/spec/data-list.md`, `data-entry.md`, `data-display.md`, `detail-page.md`, `navigation.md`, `feedback.md`, `layout.md`  
- **Credibility:** Official Ant Group enterprise UI; strongest **agent** surface among surveyed DS (CLI offline metadata, MCP, Skill).  
- **Extract:**
  - Admin archetypes: list → filter → detail; form density; table scroll/ghost patterns  
  - Token/theme model in `design.md` for agent-generated admin screens  
  - Copywriting + feedback research specs (status/empty/exception)  
- **Trade-off:** Default look is “Chinese admin SaaS.” Use as **IA/component grammar**, restyle to CMC tokens.  
- **Adoption risk:** v5→v6 API churn; prefer docs/CLI over memorized APIs.

### 3. Atlassian Design System — tokens, density, MCP
- **URLs:**
  - https://atlassian.design/llms.txt  
  - Relative dumps: `llms-tokens.txt`, `llms-primitives.txt`, `llms-components.txt`, `llms-a11y.txt`, `llms-styling.txt`  
- **Credibility:** Official ADS; real markdown + published **ADS MCP**.  
- **Extract:**
  - Token taxonomy (bg/text/border/elevation) for admin themes  
  - Data display: Table, Tree, Flag/Toast, Modal/Drawer  
  - A11y WCAG 2.1 AA patterns for staff tools  
- **Trade-off:** Best as **reference + a11y**, not full Atlaskit dependency in monorepo.  
- **Fit:** Issue/workflow UIs map well to enrollment cases, leave requests, grading queues.

### 4. Primer (GitHub) — dense product UI (no llms.txt yet)
- **URLs:**
  - Product docs (HTML): https://primer.style/product/components/data-table  
  - Tables pattern: https://primer.style/product/ui-patterns/tables  
  - Tokens CSS (machine): https://cdn.jsdelivr.net/npm/@primer/primitives/dist/css/functional/themes/light.css  
  - Local: `/home/manhquy/Downloads/design/github.com-DESIGN.md` + `design-tokens-GitHub.json`  
- **Credibility:** Official GitHub DS; **agent gap** — `/llms.txt` 404; `llms-full.txt` returns app shell HTML, not markdown.  
- **Extract:**
  - Information density: labels/counters/state badges, compact rows  
  - Semantic status colors (open/merged/closed → draft/active/archived enrollment)  
  - Data table + blankslate patterns  
- **Trade-off:** Scrape/HTML cost for agents; prefer local DESIGN.md + primitives CSS over live site.  
- **Do not** expect Primer to lead agent workflows until true `llms.txt` ships.

### 5. shadcn/ui — AI-ready component distribution (implementation)
- **URLs:**
  - https://ui.shadcn.com/llms.txt  
  - MCP: https://ui.shadcn.com/docs/mcp  
  - Skills: https://ui.shadcn.com/docs/skills  
  - Priority components: Sidebar, Data Table, Field, Sheet, Command, Empty, Badge  
- **Credibility:** Official shadcn docs; explicit “AI-Ready” + MCP (verified).  
- **Extract:**
  - Component inventory + install paths for admin shell  
  - Form/Field patterns; table sorting/filter pagination recipes  
  - Theming CSS variables (map CMC tokens → shadcn theme)  
- **Trade-off:** Not a design system authority — **code ownership model**. Use after Carbon/Ant pattern decisions.  
- **Fit:** High if CMC stack already Tailwind/Radix; else skip.

### 6. Polaris (Shopify) — admin patterns, weak agent surface
- **URLs:**
  - Site (human): https://polaris.shopify.com/components (meta `noai, noimageai`)  
  - Local: `/home/manhquy/Downloads/design/shopify.com-DESIGN.md` + `design-tokens-Shopify.json`  
  - Note: Polaris React README marks older package deprecated; web-components path on shopify.dev  
- **Credibility:** Official merchant-admin DS; **deliberately anti-scrape for AI**.  
- **Extract (from local only unless policy allows):**
  - Resource list / index page structure  
  - Page + card density for settings/admin  
  - Action hierarchy (primary/secondary in admin toolbars)  
- **Trade-off:** Best admin metaphor among consumer brands, worst agent readability. **Do not** depend on live Polaris for agent context windows.  
- **Complements local:** visual tokens already extracted; do not re-scrape.

---

## Format standard (supporting, not a DS)

| Resource | URL | Use |
|----------|-----|-----|
| llms.txt proposal | https://llmstxt.org/index.md | How to publish CMC’s own agent-readable design corpus |
| Site index | https://llmstxt.org/llms.txt | Spec + tooling links |

**Recommendation:** after pattern extraction, publish `docs/.../llms.txt` (or design package root) pointing at CMC DESIGN.md + token JSON + admin pattern MD — same shape as Carbon/Ant.

---

## Trade-off matrix (ERP admin)

| Dimension | Carbon | Ant | Atlassian | Primer | shadcn | Polaris |
|-----------|--------|-----|-----------|--------|--------|---------|
| Agent readability | ★★★★★ | ★★★★★ | ★★★★☆ | ★★☆☆☆ | ★★★★★ | ★☆☆☆☆ |
| Dense admin patterns | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★☆☆ | ★★★★☆ |
| Complements local DESIGN.md | High | High | Med | Direct (GitHub) | Impl only | Direct (Shopify) |
| Brand lock-in if adopted as code | Med | Med | High | Med | Low (copy-in) | High |
| Education/public-sector tone | Neutral-corporate | SaaS-admin | Work tools | Devtools | Neutral | Commerce |

---

## Concrete recommendation

1. **Pattern authority:** Carbon `llms.txt` → deep-link Filtering, Data Table, Forms, Status, UI Shell.  
2. **Agent workflow + admin grammar:** Ant `for-agents` + `design.md` + data-list/entry specs (do not adopt Ant look wholesale).  
3. **Tokens/a11y secondary:** Atlassian token + a11y dumps; or stay on local GitHub tokens.  
4. **Visual density:** keep local Primer/GitHub DESIGN.md; optional `@primer/primitives` CSS for semantic color names.  
5. **Polaris:** local Shopify extract only; ignore live site for agents (`noai`).  
6. **Implement:** map decided patterns onto existing CMC stack; if Tailwind/Radix → shadcn MCP; else stay in current component library.  
7. **Own surface:** write CMC `llms.txt` + admin pattern MD so agents stop mixing marketplace Airbnb cues into staff ERP.

**Deprioritize:** Airbnb/Cal.com local extracts for admin ERP chrome (booking/consumer).

---

## Limitations

- No full content dump of Carbon/Ant deep pages (index-level only).  
- Primer/Polaris lack true agent markdown — quality of “extract” depends on local DESIGN.md freshness.  
- Did not validate fit against CMC’s actual component library or Tailwind version.  
- Did not audit GOV.UK DS (strong public-sector a11y; no `llms.txt` found) — consider later if compliance copy needed.  
- Endpoint status may change; re-probe before automation.

---

## Unresolved

- Does CMC UI already use shadcn/Radix/Tailwind or a custom system? (decides source #5 weight)  
- Is brand target closer to GitHub density or Ant enterprise chrome?  
- Permission to vendor any Atlassian/Carbon code vs patterns-only?

---

**Status:** DONE  
**Summary:** Six ranked agent-readable DS sources; Carbon + Ant lead for education ERP admin patterns; Primer/Polaris rely on local DESIGN.md (Polaris live site blocks AI). Report path above.
