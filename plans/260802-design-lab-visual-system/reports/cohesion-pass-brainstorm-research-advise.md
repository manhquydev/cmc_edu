# Cohesion pass — Brainstorm · Research · Advise · Implement

**Date:** 2026-08-02  
**Skills:** ak-brainstorm · ak-research (×3 agents) · advise synthesis  
**Surface:** http://localhost:5173/design  

---

## 1. Brainstorm contract

| Field | Value |
|-------|--------|
| **Outcome** | Hệ thống UI admin **đồng bộ / gắn kết / chuyên nghiệp** — components cùng một họ (radius, hairline, elevation, hover). Design Lab phản ánh đúng production tokens. |
| **Constraints** | Không shadcn/Tailwind thứ hai; brand `#0071E3` + Inter; ops density; map Astryx + `@cmc/ui`. |
| **Non-goals** | Storybook; dark mode; LMS frame; redesign business logic; glassmorphism; multi-accent. |
| **Acceptance** | Token warm + elevation roles; FilterBar/table shell; Design Lab demos đúng số; composites feel one family; ui package tests green. |

---

## 2. Research synthesis (3 agents)

| Agent | Report | Key finding |
|-------|--------|-------------|
| ERP admin DS | `research-erp-admin-design-cohesion-2026.md` | Soft 12/16/20 đã đúng hướng; gap = cool gray leftovers + elevation homogène |
| Token rhythm | `research-token-architecture-visual-rhythm.md` | pad-card off-grid, type orphans, status solid loud, cool outliers |
| Composite screens | `research-composite-screen-cohesion.md` | One raised family; FilterBar chrome leak; missing table shell; lab stale numbers |

**Industry consensus (Atlassian / Polaris / Carbon-adjacent):**  
one action blue · neutrals layer zones · elevation by role · nested radius · monochrome admin + status = meaning only.

**Chosen approach:** Option A — promote token/premium deltas (not parallel “softer” theme, not full redesign).

---

## 3. Advise → what we promoted

### tokens.css
- Warm: `surface-2 #f0ede7`, `text-faint #a39e96`, `border #e0ddd5`
- Radius aliases: `card` / `dialog`
- Elevation: `shadow-xs` + refined warm sm/md/lg
- Density: `pad-card 24`, `pad-card-x 20`, `gap-section 24`, `fs-metric 32`, `lh-body 1.55`
- Type roles: meta / title / page
- Focus: `--cmc-focus-halo`
- Status soft pairs for dense badges

### premium.css
- Raised family shared padding keylines
- PageHeader `shadow-xs`; toast `radius-lg` + `shadow-lg`
- `.ck-table-shell`, `.ck-filter-bar`, `.ck-badge-soft*`
- Dashboard chips whisper elevation
- Kill cool `#c7c7cc` chevron → text-faint

### components
- `FilterBar` → `.ck-filter-bar` (warm, no cool full-bleed bar)

### Design Lab
- Fix stale radius/space/hex/copy (was teaching 4/8/12)
- `.dl-card` = raised family
- Sections: hover language, list ops composite, soft badges, anti-patterns

---

## 4. Do not reverse

- Brand blue, Inter, light-only, ops density
- Nested 12 ≤ 16 ≤ 20
- One primary CTA; status not recolor metrics

---

## 5. Validation

- `pnpm --filter @cmc/ui test` (tokens + composites)
- Visual: `/design` sections Cohesion → List ops → Live

**Unresolved:** promote soft StatusBadge as default vs Astryx filled (optional A/B).
