# Research: AI-Agent-Readable Design System Sources (2024–2026)

**Date:** 2026-08-02  
**Scope:** design systems / UI docs useful for coding agents (markdown, `llms.txt`, MCP, skills — not marketing sites)  
**CMC constraints:** dense ops ERP · warm canvas · one blue `#0071E3` · Inter · React + CSS tokens · **no second Tailwind stack**  
**Stack under review:** `@cmc/ui` + Astryx (`tokens.css`, `premium.css`, TL12)  
**Search budget:** 5 batches (URL probe + GitHub + live `llms.txt` fetches + Linear/Radix extract + survey findings)  

---

## Executive Summary

By mid-2026, agent-legible design systems are mainstream: **14/20** surveyed OSS systems ship `llms.txt`, **17/20** ship official MCP, **17/20** ship agent skills (Kaelig Deloumeau-Prigent, *State of AI in Design Systems*, data 2026-07-26/28). `llms.txt` alone does **not** separate leaders — **tool-gating + closed token lists** beat “never invent components” prose.

For CMC EDU (solo + AI-generated code, locked brand, no Tailwind dual-stack):

1. **Consume** Atlassian + Carbon + Ant Design as **pattern/token authority** via their `llms*.txt` slices — not as component libraries to install.  
2. **Steal agent-doc patterns** from shadcn (index + skills + MCP + registry schema) and Mantine (per-page `/llms/*.md` + `llms-full.txt`) for CMC’s own agent surface.  
3. **Do not adopt** daisyUI / Aceternity / HeroUI as runtime deps — they pull Tailwind or marketing motion that fights dense ERP + locked CSS tokens.  
4. **Ship CMC agent affordances next:** `packages/ui/llms.txt` (or `/design` twin), closed token table with “do not invent px”, page-pattern inventory, component states matrix — match TL12 already written.

**Ranked top picks for CMC agents (use order):**  
**#1 Atlassian ADS tokens/MCP** → **#2 Carbon patterns + data table** → **#3 Ant Design enterprise specs** → **#4 State-of-AI survey (meta)** → **#5 shadcn agent packaging** → **#6 Mantine markdown corpus** → **#7 Linear redesign principles** → **#8 Radix Themes token model**.

---

## Research Methodology

| Item | Detail |
|------|--------|
| Sources | 12+ live docs (fetched 2026-08-02); Kaelig survey (July 2026); CMC TL12 + prior design-lab reports |
| Date range | Spec `llmstxt.org` 2024-09 → DS AI affordances peak 2026; Linear redesign 2024-03 |
| Search / probe terms | `llms.txt` design system; agent skills MCP; Polaris/Carbon/Atlassian tokens; Linear redesign; Refactoring UI density |
| Credibility ranking | Official DS `llms.txt` + token tables > field survey with source_url > maintainer redesign posts > marketing component catalogs |
| Not covered | Figma-only libraries; paid Refactoring UI book page-by-page; live Polaris JS SPA content (HTML shell only); Spectrum SPA (requires JS) |

---

## 1. Top sources for agents (ranked for CMC)

Each entry: **URL · agent extract · credibility · CMC fit · risk**.

### 1. [State of AI in Design Systems — July 2026](https://state-of-ai-in-design-systems.netlify.app/llms.txt) — **meta map (read first)**

| | |
|--|--|
| **What** | Field survey: 20 OSS DS × 6 platforms; 179 affordances; 157 coercion techniques; MD/JSON twins + MCP |
| **Agent extract** | Who ships MCP / `llms.txt` / skills; which techniques reduce hallucination (tool-gating > prohibitions); retrieval contract + file sizes |
| **Credibility** | High — every claim has `source_url`; CC BY 4.0; snapshot 2026-07-26/28 |
| **CMC fit** | Blueprint for how CMC should publish agent docs; notes **Astryx is ai-native** (same family as CMC base) |
| **Risk** | Snapshot goes stale; do not cite absence without re-fetch |
| **Adoption risk** | None (read-only meta). Author is independent; repo young but methodology solid |

**Key stats (from survey):** 14/20 have `llms.txt`; 17/20 MCP; 17/20 skills; few measure evals (7/20).

---

### 2. [Atlassian Design System — `llms.txt`](https://atlassian.design/llms.txt) + [tokens](https://atlassian.design/llms-tokens.txt)

| | |
|--|--|
| **What** | Enterprise DS: tokens, primitives, components, a11y, styling standard, **public MCP** |
| **Agent extract** | **Role-based tokens** (`color.text`, `elevation.surface`, spacing, radius); closed token list with “**You must ONLY use tokens listed… do not make up values**”; Box/Stack/Inline primitives; elevation pairing; ESLint enforcement model; MCP `https://mcp.atlassian.com/v1/ads/public/mcp` |
| **Credibility** | Official Atlassian product DS — production-proven at Jira/Confluence scale |
| **CMC fit** | **Best model for token architecture + agent coercion.** Maps 1:1 to closing CMC magic px / status soft chips |
| **Risk** | Atlaskit React packages ≠ CMC stack; extract **ideas**, not components |
| **Trade-off** | Full ADS token graph is large; CMC should copy *roles + closed list pattern*, not full parity |

---

### 3. [IBM Carbon — `llms.txt`](https://carbondesignsystem.com/llms.txt)

| | |
|--|--|
| **What** | Enterprise product DS: foundations, **Data Table**, UI Shell, patterns (filtering, empty, forms, status) |
| **Agent extract** | Spacing/type/color foundations; **Data Table + Toolbar + Overflow** inventory; patterns: filtering, empty states, loading, status indicators, dialogs; layer model (themes White/G10…) |
| **Credibility** | Official IBM OSS; long production history |
| **CMC fit** | **ERP admin archetype** — dense tables, shell, status language. Aligns with CMC ListPage + FilterBar + DataTable |
| **Risk** | Carbon visual language (IBM Plex, sharp grid) ≠ warm Apple-minimal CMC; steal patterns not chrome |
| **Trade-off** | Heavy React package if installed; use as **spec reference only** |

---

### 4. [Ant Design — `llms.txt`](https://ant.design/llms.txt) + [spec MD](https://ant.design/docs/spec/introduce.md)

| | |
|--|--|
| **What** | Enterprise backend design language + React library; DESIGN.md / llms-full / semantic docs |
| **Agent extract** | Design values (Natural, Certain, Meaningful, Growing); **alignment** (form colon, number right-align tabular); **contrast** (primary vs neutral decisions; don’t lead irreversible choices with color); dense admin density norms |
| **Credibility** | Official Ant Group; dominant enterprise admin UI in Asia — high relevance to VI education ops |
| **CMC fit** | Form density, table number alignment, prudent decision neutrality (approve money) — maps TL2 ResultPanel / ConfirmDialog |
| **Risk** | Installing antd next to Astryx = dual DS disaster; principles only |
| **Trade-off** | Spec pages excellent; component API pulls different interaction model |

---

### 5. [shadcn/ui — `llms.txt`](https://ui.shadcn.com/llms.txt)

| | |
|--|--|
| **What** | Copy-paste component registry; CLI; theming; **Skills**; **MCP**; registry JSON schemas |
| **Agent extract** | Full component inventory (form, layout, overlay, data-table, empty, skeleton); theming via CSS variables; monorepo notes; **agent packaging pattern** (skills + MCP + registry-item schema) |
| **Credibility** | De-facto agent default for greenfield React; high community velocity 2024–26 |
| **CMC fit** | **Do not install Tailwind/shadcn into CMC.** Extract: (a) component checklist completeness, (b) how to publish agent skills for `@cmc/ui`, (c) empty/skeleton/state matrix |
| **Risk** | Agents default to shadcn when docs are nearby → **stack bleed**. Gate with CMC AGENTS.md “no Tailwind second stack” |
| **Adoption risk** | High if treated as dependency; low if treated as inventory template |

---

### 6. [Mantine — `llms.txt`](https://mantine.dev/llms.txt) + [`llms-full.txt`](https://mantine.dev/llms-full.txt)

| | |
|--|--|
| **What** | React component library with **per-page markdown** under `/llms/*.md` + FAQ corpus |
| **Agent extract** | AppShell; form hooks; DataList; EmptyState; Table; style API / CSS variables; dense component API docs agents can fetch one file at a time |
| **Credibility** | Mature OSS; explicit LLM documentation guide |
| **CMC fit** | Best **doc architecture** reference: index → slice → full. AppShell/Form patterns useful conceptually |
| **Risk** | Mantine CSS-in-JS/theme object ≠ CMC plain CSS tokens |
| **Trade-off** | Huge full corpus (context budget); prefer targeted `/llms/core-*.md` |

---

### 7. [llmstxt.org](https://llmstxt.org/) — format authority

| | |
|--|--|
| **What** | Spec (Jeremy Howard, 2024-09): `/llms.txt` structure; optional `.md` twins of HTML pages |
| **Agent extract** | Required H1; blockquote summary; H2 sections of links; `## Optional`; `.md` page twins |
| **Credibility** | Canonical format definition |
| **CMC fit** | How to author `packages/ui` or `docs/` agent index without inventing format |
| **Risk** | Format ≠ content quality |

---

### 8. [Linear redesign series](https://linear.app/now/how-we-redesigned-the-linear-ui) (2024)

| | |
|--|--|
| **What** | Product redesign narrative: chrome, density, hierarchy (not a public token dump) |
| **Agent extract** | Reduce chrome noise; **inverted-L app chrome**; denser nav; redesign = evolution not atomic rewrite; visual alignment of sidebar/tabs/headers/panels |
| **Credibility** | Primary source from Linear founders; widely cited for modern ops UI |
| **CMC fit** | AppFrame/SideNav polish; soft-ops density; avoid “landing page” sparsity |
| **Risk** | Dark consumer SaaS aesthetic ≠ warm light ERP; principles of chrome/hierarchy only |
| **Note** | No `llms.txt` — principles via article, not machine index |

---

### 9. [Radix Themes — theme overview](https://www.radix-ui.com/themes/docs/theme/overview)

| | |
|--|--|
| **What** | Theme primitive: accent/gray/radius/scaling/panel + **variants** (classic/solid/soft) for hierarchy |
| **Agent extract** | Closed theme knobs; soft vs solid hierarchy; token surfaces for custom components |
| **Credibility** | Official Radix (WorkOS); primitives underpin many systems |
| **CMC fit** | Maps to CMC brand soft surfaces (`brand-muted`) + solid CTA; variant discipline for buttons/badges |
| **Risk** | Installing Radix Themes CSS next to Astryx may conflict; conceptual only unless already in tree |

---

### 10. [daisyUI `llms.txt`](https://daisyui.com/llms.txt) — **anti-pattern for CMC runtime**

| | |
|--|--|
| **What** | Tailwind component classes; skill forces itself on all HTML/JSX generation |
| **Agent extract** | Semantic color names; component class inventory — **and** aggressive agent skill coercion |
| **Credibility** | Real product; strong agent packaging |
| **CMC fit** | **Negative example:** skill with `alwaysApply: true` + Tailwind 4 requirement = wrong stack for CMC |
| **Risk** | High if agent loads skill — will fight CSS tokens |

---

### 11. [Chakra UI `llms.txt`](https://www.chakra-ui.com/llms.txt) / [HeroUI `llms.txt`](https://www.heroui.com/llms.txt)

| | |
|--|--|
| **What** | Accessible React systems with full LLM doc sets |
| **Agent extract** | Theming, component APIs, a11y patterns |
| **CMC fit** | Secondary reference for a11y + form patterns; do not dual-stack |
| **Risk** | Medium — agents love them; keep out of install path |

---

### 12. [Aceternity UI `llms.txt`](https://ui.aceternity.com/llms.txt)

| | |
|--|--|
| **What** | Marketing motion components; AI catalog JSON API |
| **Agent extract** | How *not* to build ERP (hero parallax, 3D marquee) |
| **CMC fit** | **Reject for admin.** Useful only as “marketing vs ops” contrast |
| **Risk** | Agents paste flashy motion into dashboards → noise |

---

### Honorable (no solid `llms.txt` or SPA-only)

| Source | URL | Agent value |
|--------|-----|-------------|
| Shopify Polaris | https://polaris.shopify.com/ | Merchant-admin density; monochrome + purposeful color (prior CMC research). SPA — hard for agents without MD twin |
| Adobe Spectrum | https://spectrum.adobe.com/ | Token theory classic; SPA requires JS — poor agent fetch |
| Primer (GitHub) | https://primer.style/ | Dense product UI; survey marks MCP/skills, limited `llms.txt` |
| Refactoring UI | https://www.refactoringui.com/ | Principles (hierarchy, spacing, color restraint) — book/marketing; no free token dump |
| Astryx (CMC base) | survey record ai-native | Prefer **in-repo** tokens + docs over re-importing |

---

## 2. Trade-off matrix (how agents should use sources)

| Source | Agent readability | ERP density fit | Stack conflict with CMC | Maintenance / abandon risk | **CMC rank** |
|--------|-------------------|-----------------|-------------------------|----------------------------|--------------|
| Atlassian ADS | ★★★★★ (`llms-tokens` closed list + MCP) | ★★★★★ | Low if ideas-only | Low | **1** |
| Carbon | ★★★★★ patterns+table | ★★★★★ | Low if ideas-only | Low | **2** |
| Ant Design specs | ★★★★ MD specs | ★★★★★ | High if install | Low | **3** |
| State-of-AI survey | ★★★★★ | n/a (meta) | None | Snapshot | **4** |
| shadcn packaging | ★★★★★ | ★★★ (consumer-leaning) | **Critical if install** | Low | **5** (docs only) |
| Mantine MD corpus | ★★★★★ | ★★★★ | High if install | Low | **6** |
| Linear articles | ★★ (HTML essay) | ★★★★ soft-ops | None | n/a | **7** |
| Radix Themes | ★★★ | ★★★ | Medium | Low | **8** |
| daisyUI skill | ★★★★★ | ★★ | **Critical** | Low | **Avoid runtime** |
| Aceternity | ★★★★ | ★ (marketing) | High Tailwind | Medium | **Avoid admin** |

---

## 3. Transferable design principles → CMC EDU admin

Locked product facts (TL12 / tokens): **light only · `#0071E3` · warm canvas · Inter · monochrome outline icons · React + CSS tokens · no Tailwind dual stack**.

| # | Principle | Source basis | CMC rule (concrete) |
|---|-----------|--------------|---------------------|
| 1 | **Closed token set; agents must not invent px** | Atlassian `llms-tokens.txt` coercion | Document full `--cmc-*` list in agent doc; ban half-pixels (12.5, 13.5) and off-grid 26 |
| 2 | **Role tokens > raw hex** | ADS, Spectrum theory, Carbon | Use `text / surface / border / brand / status-soft` roles; never hardcode `#0071E3` in components |
| 3 | **One interactive accent** | Polaris purpose-color; TL12 | Only brand blue for interactive/current; status colors for state only |
| 4 | **Soft status chips, not solid alarm fills** | Prior CMC token research + ADS subtle backgrounds | StatusBadge = soft bg + ink; filled red only for true danger |
| 5 | **Elevation by role** | Atlassian elevation; Linear chrome quiet | Default card = border, no shadow; raised only for movable/overlay |
| 6 | **Soft-ops density** | Carbon tables; Ant admin; Linear denser chrome | Row height / pad compact; metrics secondary to work lists; not Notion marketing whitespace |
| 7 | **Warm neutral family only** | CMC cohesion research + Carbon layering | Kill cool Apple grays on warm canvas (`surface-2`, faint text) |
| 8 | **Radius nested harmony** | Radix radius scale; M3/cohesion | control ≤ card ≤ dialog (12 / 16 / 20 locked) |
| 9 | **Type roles, not continuous sizes** | ADS typography tokens; Ant hierarchy | 5–6 roles: metric, page, panel, body, meta, label |
| 10 | **Number alignment** | Ant Design alignment | Tabular nums; right-align money/counts in tables |
| 11 | **Neutral critical decisions** | Ant contrast (accept/reject) | Money approve/reject: equal visual weight until confirmed; ResultPanel after |
| 12 | **States are part of the component** | shadcn empty/skeleton; Carbon loading patterns; TL12 §4 | Every composite: default · hover · focus · disabled · loading · empty · error |
| 13 | **Chrome serves content** | Linear inverted-L | AppFrame sticky blur + SideNav; reduce competing borders/shadows in chrome |
| 14 | **Agent tool-gating > prose bans** | State-of-AI survey | Prefer lint/token list/MCP over “please don’t invent components” |
| 15 | **Inter + Vietnamese UX copy** | TL12 §8 | Buttons = user verbs (“Ghi danh”); no system jargon on primary UI |

### What agents should extract from each category

| Category | Extract |
|----------|---------|
| **Tokens** | color roles, space scale (4/8 base), type roles, radius, elevation, motion durations, focus ring |
| **Patterns** | List / Detail / Form page; filter→URL; master-detail; empty; confirm destructive; result of automation |
| **Components** | API surface + required states + a11y (keyboard, focus, contrast) — not foreign class names |
| **Agent packaging** | `llms.txt` index, slice files, closed token table, skills, optional MCP later |

---

## 4. Component inventory checklist (admin ERP DS)

Aligned with TL12 + Carbon/shadcn/Ant inventories. **Must-have** for complete ops admin; **nice-to-have** later.

### Must-have (ship / keep complete)

| Area | Components / patterns | Required states |
|------|----------------------|-----------------|
| **Shell** | AppFrame, SideNav, Topbar/breadcrumb, PageHeader | active module, collapse, sticky, focus |
| **Page templates** | ListPage, DetailPage, FormPage | loading, empty, error |
| **Data** | DataTable, pagination, column header sort, row select, sticky header | loading skeleton, empty, error, selected |
| **Filter** | FilterBar, search, chips, date range | URL-synced filters |
| **Forms** | TextField, Textarea, Select/Combobox, Checkbox, Radio, Switch, Number, Date | error, disabled, readonly |
| **Feedback** | StatusBadge (soft), Alert/banner, Toast, Spinner, Skeleton, Inline error | semantic map §TL12 |
| **Overlay** | ConfirmDialog, Modal, Drawer/Sheet, Popover, Tooltip | focus trap, esc, a11y |
| **Actions** | Button (primary/secondary/danger/ghost), IconButton, Link-as-button, Menu | loading, disabled |
| **Display** | Panel/Card, MetricCard, EmptyState, ResultPanel, Tabs, Breadcrumb | — |
| **Nav** | Tabs (route-backed), Breadcrumb, Command/palette (optional but high ops value) | active tab = route |
| **Icons** | LineIcon monochrome outline set | `data-icon` |
| **A11y baseline** | Focus ring brand, 4.5:1 text, ≥44px touch on tablet flows | — |

### Nice-to-have (phase later)

| Area | Notes |
|------|-------|
| Tree view / org hierarchy | After core tables stable |
| Advanced DataGrid (virtualized, column pin) | When row counts force it |
| Charts pack beyond FunnelBar | Prefer one chart lib + token colors |
| Timeline / activity feed | Audit & student history |
| File uploader | Receipts, documents |
| Rich text editor | Curriculum content only |
| Kanban / board | CRM pipeline visual (if product asks) |
| Dark mode | **Out of scope** — locked light |
| Marketing motion / hero | **Never for admin** |
| Second icon filled style | Avoid — monochrome outline locked |

### Completeness gate (agent-facing)

A component is “done” only if docs state:

1. Purpose + when **not** to use  
2. Props / slots  
3. Token dependencies (no raw hex)  
4. All required states  
5. a11y notes  
6. Example in List/Detail/Form context  

---

## 5. Anti-patterns from outdated / failed ERP UIs

| Anti-pattern | Why it fails | CMC counter-rule |
|--------------|--------------|------------------|
| **Rainbow status walls** | Every row a saturated chip → alarm fatigue | Soft chips; solid only for danger/success extremes |
| **Blue for everything** | Links, headers, badges, charts all brand → no hierarchy | Brand = interactive only |
| **3D buttons / heavy drop shadows** | 2000s ERP chrome | Flat + hairline border; whisper shadow |
| **Gray-on-gray low contrast** | WCAG fail; ops errors | Token contrast; brand-ink on brand-muted |
| **Modal hell** | Nested dialogs for every edit | Prefer route forms + drawer; modal for confirm only |
| **Hidden filters / mystery meat** | State not in URL | FilterBar → query string (TL6) |
| **Empty tables with no CTA** | Dead ends | EmptyState + primary action |
| **Silent automation** | “Saved” with no consequence list | ResultPanel (“đã ghi danh + tạo TK + email”) |
| **Emoji / multicolor icons in shell** | Visual noise, unprofessional | LineIcon monochrome only |
| **Consumer sparsity** (huge metrics, 48px gaps) | Looks like SaaS landing, slow ops scan | Soft-ops density |
| **Cool gray toolkit on warm paper** | “two products stitched” | One warm neutral family |
| **Invented spacing per screen** | Agents invent 7/11/13/22/26 | Closed space scale |
| **Dual design systems** (antd + shadcn + custom) | Drift, a11y gaps, bundle bloat | **One** `@cmc/ui` token surface |
| **Primary red “current stage”** | Semantics lie | Current = brand blue |
| **Equal weight Accept/Reject on money** | Leading decisions with color | Neutral until confirm (Ant contrast) |
| **Dark mode half-implemented** | Broken tokens | Light-only locked |
| **Decorative gradients / glass everywhere** | Distracts from data | Restraint; blur only sticky nav if any |

---

## 6. Architectural fit for CMC

| Constraint | Implication |
|------------|-------------|
| Solo + AI-generated code | Agent docs + closed tokens = review system; CI already non-bypassable |
| Astryx + `@cmc/ui` already | Do not re-platform to shadcn/Carbon React |
| Premium layer + Design Lab `/design` | Living inventory exists — promote agreed levers to tokens, then document for agents |
| Education ERP (staff dense, tablet grading) | Carbon/Ant density > Linear marketing > Aceternity |
| Vietnamese product language | Content guidelines in agent doc (verbs, no eng jargon) |

### Recommended CMC agent surface (YAGNI order)

1. **`packages/ui/llms.txt`** — index: principles, token link, component list, page patterns, anti-patterns  
2. **`tokens.md` closed table** — “only these CSS vars; do not invent px” (Atlassian pattern)  
3. **Page patterns MD** — List / Detail / Form / Confirm+Result (TL12 §5)  
4. **Optional later:** MCP over Storybook or design-lab; agent skill in `.claude/skills` that *only* loads CMC tokens  

**Do not:** add daisyUI skill, install Tailwind for “agent convenience”, or mirror full Ant/Carbon component APIs.

---

## 7. Ranked recommendations for CMC

| Rank | Action | Why |
|------|--------|-----|
| **1** | Treat **Atlassian token coercion + Carbon patterns + Ant specs** as reading list for visual sprint D | Best ERP signal; zero stack risk if ideas-only |
| **2** | Publish **CMC `llms.txt` + closed token list** for agents (mirror llmstxt.org + ADS style) | Survey: tool-gating > prose; solo AI workflow needs this |
| **3** | Complete **must-have component states** (empty/skeleton/error) before new composites | shadcn/Carbon inventory gap common failure mode |
| **4** | Keep **soft-ops** path from prior cohesion research (12/16/20, warm, soft badges) | Industry consensus 2024–26; matches TL12 |
| **5** | Use **shadcn only as checklist + packaging inspiration** | Never second Tailwind stack |
| **6** | Ignore Aceternity-style motion for admin | Density + calm > delight |
| **7** | Optional: study Astryx’s own ai-native affordances (same family) | Stay on-stack |

---

## 8. Resources (quick links)

### Official / high-signal
- https://state-of-ai-in-design-systems.netlify.app/llms.txt  
- https://atlassian.design/llms.txt · https://atlassian.design/llms-tokens.txt  
- https://carbondesignsystem.com/llms.txt  
- https://ant.design/llms.txt · https://ant.design/docs/spec/alignment.md  
- https://ui.shadcn.com/llms.txt  
- https://mantine.dev/llms.txt · https://mantine.dev/llms-full.txt  
- https://llmstxt.org/  
- https://linear.app/now/how-we-redesigned-the-linear-ui  
- https://www.radix-ui.com/themes/docs/theme/overview  

### CMC internal authority
- `docs/12-design-system-ui.md`  
- `packages/ui` tokens / premium CSS  
- Prior reports in this plan: `research-token-architecture-visual-rhythm.md`, `research-erp-admin-design-cohesion-2026.md`  

---

## Limitations

- Max 5 search batches; Polaris/Spectrum content partially blocked (SPA / noai meta) — used prior CMC research + survey table for those.  
- Did not audit every CMC component implementation vs must-have matrix (see sibling `audit-design-system-completeness.md` if present).  
- Did not run live MCP clients against Atlassian/shadcn servers.  
- Refactoring UI paid content not scraped; principles inferred from public positioning + industry consensus.  
- Survey is July 2026 snapshot — re-fetch before claiming a system “lacks” an affordance.

## Unresolved questions

1. Should CMC agent docs live under `packages/ui/llms.txt`, `docs/design/llms.txt`, or Design Lab route `.md` twin?  
2. Is an MCP server worth solo-ops cost, or is closed token MD + AGENTS.md enough for 2026?  
3. Promote soft StatusBadge + space scale **before** or **with** agent doc publish?

---

## Status

**DONE**

**Top recommendations for CMC (ranked):**  
1) Consume Atlassian tokens + Carbon patterns + Ant enterprise specs as authority.  
2) Ship CMC agent-readable `llms.txt` + closed token table (tool-gating).  
3) Finish must-have ERP component states; stay soft-ops dense; never add Tailwind/daisyUI/Aceternity to admin.
