# Component cohesion + soft inputs audit

**Date:** 2026-08-02  
**Focus:** từng thành phần, tính đồng nhất khi ghép, ô nhập mềm (không bo vuông cứng)

---

## 1. Root cause: inputs “cứng cáp”

| Layer | Before | Why hard |
|-------|--------|----------|
| Astryx Field wrapper | white fill + `--color-border-emphasized` #d4d4d4 | Cool gray box |
| Hover | `inset 0 0 0 2px` gray ring | “pressed metal” / spreadsheet |
| Radius | 4px then 8px | Still reads rectangular on tall fields |
| StyleX | uses CSS vars (`--radius-element`, border colors) | Overridable — we do |

## 2. Per-component evaluation

| Component | Role | Soft rule | Cohesion |
|-----------|------|-----------|----------|
| **TextInput / TextArea / NumberInput / Selector** | Control shell | radius **12**, bg **sunken**, warm border, soft focus halo | Shared Field wrapper |
| **Button** | Control | same `--radius-element` 12 (pill only for shell CTA) | Matches fields |
| **MetricCard / Panel / WorkInbox** | Raised content | radius **16**, white + hairline + shadow-sm | Outer family |
| **PageHeader** | Raised chrome | soft card 16 | Aligns list pages with cards |
| **ShortcutChip** | Quick nav | **pill** | Distinct affordance OK |
| **TaskRow** | List line | hairline dividers, sunken hover | Inside Panel |
| **StageFunnel / FunnelBar** | Pipeline | pill tracks | Soft already |
| **DataTable** | Ops density | tighter cells | Intentionally denser |
| **Toast / Dialog** | Float | md–lg radius + shadow | Highest elevation |
| **SideNav item** | Chrome | control radius 12 | Matches control family |
| **StatusBadge** | Semantic | Astryx badge | Color only, no layout clash |

## 3. Nested harmony (connection rule)

```text
control 12px  ≤  card 16px  ≤  page/dialog 20px
sunken field  →  raised card  →  floating modal
warm hairline borders everywhere (no cool #d4d4d4)
```

When composed (header + form + panel + task rows) they should feel **one product**, not mixed toolkits.

## 4. Changes applied

1. `--cmc-radius-xs` / `--cmc-radius-control` = **12px**  
2. Astryx `--radius-element` → control; borders → warm CMC tokens  
3. Soft field CSS via `:has(> input|textarea)`: sunken bg, no hard inset hover, brand focus halo  
4. Nav item radius → `var(--cmc-radius-control)`  
5. Design Lab section **Đồng nhất** + live composed sample  

## 5. Residual risks

| Risk | Mitigation |
|------|------------|
| `:has()` may soft-style unexpected wrappers | Direct-child only; exclude checkbox/radio/file |
| `button { border-radius }` vs pill CTA | Shell `.sh-cta` keeps `border-radius: pill` higher specificity |
| Table still denser | Intentional ops; don't round every cell |
