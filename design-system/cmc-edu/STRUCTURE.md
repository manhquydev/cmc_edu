# CMC EDU — Unified component structure

> **Authority:** `packages/ui/src/tokens.css` structural tokens + `console.css` (admin `.console-*`) / `apps/lms/src/app.css` (`lms-*`).  
> **Goal:** One system for the whole admin app — no “mixed toolkit” look.

---

## 1. Surface families

| Family | Recipe | Use |
|--------|--------|-----|
| **Canvas** | `--cmc-canvas` | Page background |
| **Raised** | `--cmc-raised-*` (bg + hairline + shadow-sm + radius-md) | Metric, Panel, Table shell, Week, Settings, Insight, Focus |
| **Quiet raised** | raised + `shadow-xs` | PageHeader sticky |
| **Sunken** | `--cmc-surface-sunken` / surface-2 | Fields, filter chrome, weekend cols |
| **Float** | raised + radius-lg + shadow-md/lg | Toast, dialog, sticky form actions |

---

## 2. Shared anatomy (every composite)

```text
┌─ keyline-x ──────────────────────────────────┐
│  HEAD  (min --cmc-head-h)  title · action    │
├──────────────────────────────────────────────┤
│  BODY  rows / slots / fields                 │
│    · title 1-line  (--cmc-line-title)        │
│    · meta 1-line   (--cmc-line-meta)         │
├──────────────────────────────────────────────┤
│  FOOT  optional CTA / pagination             │
└──────────────────────────────────────────────┘
```

- **Keyline:** always `--cmc-keyline-x` (not random 12/14/16).
- **Truncate:** long text → ellipsis + `title` tooltip; never uneven multi-line siblings of same role.
- **Equal siblings:** same component class = same min-height / slot geometry.

Do not introduce a parallel surface-utility family — raised surfaces use `--cmc-raised-*`.

---

## 3. Density tiers

| Tier | Tokens | Where |
|------|--------|--------|
| **Default** | `--cmc-row-h` 48, pad-card 24 | Dashboard, detail, month cards |
| **Compact** | `--cmc-row-h-compact` 40, chip-sm | Week cells, ops tables, filter strip |
| **Touch** | min 44×44 | Attendance punch (separate) |

---

## 4. Type roles (do not invent sizes)

| Role | Token | Weight |
|------|-------|--------|
| Label upper | `--cmc-fs-label` | 600 |
| Meta | `--cmc-fs-meta` | 500 |
| Body / row title | `--cmc-fs-body` | 500–600 |
| Card title | `--cmc-fs-title` | 600 |
| Metric | `--cmc-fs-metric` | 600 tabular |

---

## 5. Component family map

| Zone | Components |
|------|------------|
| Chrome | ConsoleNavbar, PageHeader — see [docs/design-system-console.md](../../docs/design-system-console.md) |
| Control | TextInput, Button, FilterBar, chips |
| Raised content | MetricCard, Panel, WorkInbox, Table shell, WeekSchedule |
| List atom | TaskRow, SessionCard, FunnelBar row |
| Float feedback | Toast, ConfirmDialog, Callout |
| Structure | SectionBlock, SettingsSection, EntityHeader |
| **Detail frame** | **DetailPage** + EntityHeader + KeyValueList + CmcTabs + SectionBlock |

### Detail page recipe (system-wide)

```text
DetailPage
  header:   PageHeader (breadcrumbs with href on parents)
  entity:   EntityHeader (identity + badges + primary actions)
  summary?: KeyValueList / Callout / metric strip
  tabs?:    CmcTabs (profile · roster · history · …)
  children?: .tpl-detail-stack | .tpl-detail-split of SectionBlocks
```

Do **not** invent a new full-page layout per entity (class vs student vs receipt).
Only swap data and which tabs/sections appear.

Full Odoo→CMC grammar (list ControlBar, exemptions, anti-patterns): **[VIEW-GRAMMAR.md](./VIEW-GRAMMAR.md)**.

---

## 6. Nested radius (locked)

`control 12 ≤ card 16 ≤ dialog 20` — never mix 4px inputs with 16px cards.

---

## 7. Anti-patterns (lệch lạc)

- Per-page `border-radius` / `padding` magic numbers  
- Cool gray `#f5f5f7` / `#d4d4d4` on warm canvas  
- Recoloring metric numbers with status  
- Different elevation recipes for “similar” cards  
- Multi-line wrap in list rows without fixed slots  

---

## 8. Living inventory

Admin route `/design` — section **System** + Inventory.  
Agent brief: `packages/ui/llms.txt`.
