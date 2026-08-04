# Xia Compare + Port Recs: Shopify · GitHub · Cal.com · Airbnb → CMC EDU Soft-Ops ERP

**Mode:** `--compare` + `--port` recommendations only (adapt, do not transplant)  
**Date:** 2026-08-03  
**Target stack:** Astryx + `@cmc/ui` · CSS tokens · **no** shadcn/Tailwind second system  
**Product:** Facility-scoped education ERP admin (ops density) + LMS (out of primary scope)

---

## CMC locks (non-negotiable)

| Lock | Value | Source of truth |
|------|-------|-----------------|
| Brand / interactive | `#0071E3` only | `tokens.css` `--cmc-brand` |
| Typeface | Inter (Variable) | `--cmc-font-sans` |
| Canvas | warm paper `#f5f3ee` | `--cmc-canvas` |
| Radius ladder | control **12** / card **16** / dialog **20** | nested harmony |
| Component stack | Astryx primitives + `@cmc/ui` composites | `MASTER.md`, `astryx-theme-cmc.css` |
| Second CSS stack | **Forbidden** (no shadcn / Tailwind DS) | `design-system/cmc-edu/MASTER.md` |
| Density | soft-ops (friendly radius + dense tables) | not consumer-sparse |
| Color roles | one interactive blue; status = badge/dot only | TL12 §3 |
| Theme | light only | intentional |

Any port that fights these locks is **Skip**. Patterns that survive must map onto `var(--cmc-*)` + existing composites.

---

## 1. Source manifest

| # | Source | Local path | Kind | Captured | Hash (md5 12) | Credibility | Fit to ERP admin |
|---|--------|------------|------|----------|---------------|-------------|------------------|
| 1 | **Shopify Polaris-inspired** | `/home/manhquy/Downloads/design/shopify.com-DESIGN.md` + `design-tokens-Shopify.json` | Marketing/admin hybrid extract (not live Polaris package) | 2026-07-30 | `755ce49eefdb` / `9ae91914cbc7` | Medium-high as *pattern* doc; not official Polaris source | **Best overall** — merchant admin = closest cousin to soft ops ERP |
| 2 | **GitHub Primer-inspired** | `github.com-DESIGN.md` + `design-tokens-GitHub.json` | Dev-tool dense UI extract | 2026-07-30 | `a5f2eea273d3` / `8c1eab91be77` | Medium-high for density + status semantics | **Strong for density / status**; weak for warmth |
| 3 | **Cal.com** | `cal.com-DESIGN.md` + `design-tokens-Cal.com.json` | Scheduling product DS | 2026-07-30 | `cc98ec6efbe1` / `3dd4c909c3c3` | Medium — small SaaS; Inter-native | **Partial** — forms/calendar only |
| 4 | **Airbnb DLS-inspired** | `airbnb.com-DESIGN.md` + `design-tokens-Airbnb.json` | Consumer marketplace / marketing | 2026-07-30 | `048e25c034f6` / `f807ec0380c7` | Medium for trust UI; **low** for ERP | **Weak** — photography-first sparsity fights ops |

**Local target map (CMC):**

| Surface | Path |
|---------|------|
| Tokens | `packages/ui/src/tokens.css` |
| Theme bridge | `packages/ui/src/astryx-theme-cmc.css` |
| Composites CSS | `packages/ui/src/premium.css` |
| Public API | `packages/ui/src/index.ts` |
| Design authority | `design-system/cmc-edu/MASTER.md`, `PAGE-FRAMES.md` |
| Spec | `docs/12-design-system-ui.md` |
| Living lab | `apps/admin/src/pages/design-lab.tsx` |
| Prior research | `plans/260802-design-lab-visual-system/reports/*` |

**Note on source quality:** These DESIGN.md files are *inspired extracts* (static tokens + component notes), not the full Polaris/Primer/DLS codebases. Treat as visual/pattern references. Prefer official docs when implementing (Polaris color roles, Primer status, etc.) — already cross-checked in `research-erp-admin-design-cohesion-2026.md`.

### Source anatomy (compressed)

| Layer | Shopify | GitHub | Cal.com | Airbnb | CMC today |
|-------|---------|--------|---------|--------|-----------|
| Primary accent | Forest green `#008060` (+ blue links) | Blue links `#0969DA` + green success | Near-black + **orange** CTA | Coral + **orange** CTA + teal | **One blue** `#0071E3` |
| Canvas | Cool gray `#F6F6F7` | Cool subtle `#F6F8FA` | White / gray-50 | Pure white | Warm `#f5f3ee` |
| Body type | 14px compact | 14px dense | 16px (marketing-ish) | 16px consumer | 14 body / 13 data |
| Radius | 4 control / 8 card | **3** / 6 / 8 sharp | 4 / 8 / 12 | 8 / 12 / pill 32 | **12 / 16 / 20** soft |
| Elevation | Flat + hairline card | Resting 1px shadow | Soft sm–lg | Search/book float heavy | Whisper warm shadows by role |
| Shell | Dark 240px side + 56 top | Tab-heavy repo chrome | Minimal product chrome | Sticky marketing nav 80px | `AppFrame` + blur top + `SideNav` |
| Density | Merchant data-dense | Dev ultra-dense | Booking sparse-mid | Discovery sparse | Soft-ops dense |

---

## 2. Decision matrix

**Legend:** **Port** = adopt pattern almost as-is into CMC tokens/composites · **Adapt** = keep intent, rewrite to locks · **Skip** = reject for this product.

| # | Decision area | Source way | CMC way | Rec | Why |
|---|---------------|------------|---------|-----|-----|
| 1 | **Primary brand / CTA color** | Shopify green · Cal orange · Airbnb coral/orange · GH green-for-success | One interactive blue `#0071E3` | **Skip** transplant | Dual-accent systems break TL12 semantics + lock |
| 2 | **Success color = brand** | Shopify success = brand green | Success `#2e7d32` ≠ brand | **Skip** (Shopify merge) | Brand must stay interactive-only; status separate |
| 3 | **Link blue vs action green** | Shopify: green CTA, blue links | Blue = both link + primary CTA | **Adapt** | Keep one blue; differentiate by **weight/fill** (`.sh-cta` vs text link), not hue split |
| 4 | **Canvas temperature** | Cool gray (Shopify/GH) or pure white (Airbnb) | Warm paper `#f5f3ee` | **Skip** cool/white transplant | Warm family already locked; rewarming cool leftovers already done |
| 5 | **Radius default** | GH 3px · Shopify 4/8 · Cal 8/12 · Airbnb 8/12 | Soft 12/16/20 | **Skip** sharp defaults | Soft ops identity; do not regress to Primer 3px |
| 6 | **Typography family** | ShopifySans / Mona / Cereal / Inter | Inter locked | **Port** Cal's Inter scale *roles* only | Family locked; scale roles usable |
| 7 | **Body size** | 14 (Shopify/GH) vs 16 (Cal/Airbnb) | 14 body / 13 data | **Port** Shopify/GH 14px ops body | Matches density; reject Cal/Airbnb 16 default for admin tables |
| 8 | **Type hierarchy (H1–caption)** | All four publish role tables | Roles exist (`--cmc-fs-*`) | **Adapt** | Align weights/letter-spacing; no display-40 marketing titles in admin |
| 9 | **Spacing base** | 4/8 grids | space 1–4 = 4/8/16/24 | **Port** Shopify 8px ops rhythm | Already aligned; extend only if FilterBar needs 12 internal |
| 10 | **Whitespace philosophy** | Shopify: functional · Airbnb: photography breath | Soft-ops dense | **Port** Shopify · **Skip** Airbnb | ERP lists die under 48–64px section gaps |
| 11 | **Elevation system** | Role ladders (all four) | xs sticky · sm raised · md float · lg modal | **Adapt** Shopify/GH resting quiet | Prefer flat+border default for table chrome; raised only for movable/emphasis (Atlassian-aligned prior research) |
| 12 | **Card chrome** | Shopify white + subdued border 8px | Raised white + hairline + whisper | **Adapt** | Keep soft radius; optional **flat list chrome** variant for density |
| 13 | **Form: labels above fields** | Shopify do | Astryx Field + sunken soft controls | **Port** | Label-above already product language; enforce in FormPage recipes |
| 14 | **Focus ring** | Brand-tinted (Shopify green ring) | Soft brand halo `--cmc-focus-halo` | **Adapt** | Keep blue halo; never green/orange rings |
| 15 | **Nav: dark sidebar** | Shopify `#1A1A1A` 240px | Light warm SideNav | **Skip** dark chrome | Fights warm paper + light-only lock; high contrast cost |
| 16 | **Nav: sticky marketing bar** | Airbnb 80px photo-nav | Blur topbar soft ops | **Skip** height/sparsity | Keep compact topbar; blur already superior |
| 17 | **Status: icon + color** | GH Primer rule | StatusBadge + soft pairs | **Port** | Never color-alone (TL12 / a11y) |
| 18 | **Extra status hue (done/purple)** | GH `#8250DF` merged | success/warn/danger/info/neutral | **Adapt** | Map "merged/done" → success or neutral badge; no 5th brand purple unless product needs workflow stage |
| 19 | **Active tab accent coral** | GH tab `#FD8C73` | Brand blue indicator | **Skip** | One interactive blue |
| 20 | **Destructive red scope** | All: red = error/destructive only | `--cmc-danger` same rule | **Port** | Already policy; keep CRM stage off red |
| 21 | **Data tables no outer border** | Shopify row separators only | `.ck-table-shell` card shell | **Adapt** | Outer shell OK for soft ops; **inside** table = hairline rows, no double frame |
| 22 | **Touch 44×44** | Shopify/Airbnb | Mobile media in astryx-theme | **Port** | Keep; critical for teacher tablet attendance |
| 23 | **Duration / filter pills** | Cal radius-sm pills | `--cmc-radius-pill` / soft chips | **Adapt** | Pill for filters/shortcut chips; control 12 for form controls |
| 24 | **Calendar / availability** | Cal grid + orange slots | No shared calendar composite | **Adapt** later | Build teaching schedule with brand-muted slots — not orange |
| 25 | **Photography-first cards** | Airbnb image-led | Metric/Panel text-led | **Skip** | No product photography surface in admin ERP |
| 26 | **Price emphasis weight 600** | Airbnb | Metric near-black 600 tabular | **Adapt** | Apply to **money columns** / MetricCard only |
| 27 | **Trust signals (avatar host)** | Airbnb host photo | Topbar text badge | **Adapt** light | Optional staff avatar chip later — not product core |
| 28 | **Component library discipline** | Shopify: don't fork Polaris | Don't fork Astryx; extend `@cmc/ui` | **Port** principle | One-door; composites props-only |
| 29 | **Nav depth ≤2** | Shopify don't | SideNav modules + entries | **Port** | Already tree-shallow; keep |
| 30 | **Stack / CSS framework** | Various (Polaris/Primer/Tailwind-ish) | Astryx + CSS vars | **Skip** any second stack | Hard lock |
| 31 | **Max content width 1200** | Shopify | Fluid main in AppFrame | **Adapt** | Optional max-width on form/settings pages only; lists stay full fluid |
| 32 | **Gradient primary button** | Airbnb coral gradient | Flat brand fill | **Skip** | Restraint lock; no decorative gradients |

### Challenge gate (≥5)

| # | Challenge | Source answer | Local answer | Risk if wrong |
|---|-----------|---------------|--------------|---------------|
| 1 | Need full second DS? | Sources are complete product systems | CMC already coherent soft-ops | High rework + dual stack |
| 2 | Green dual-accent (Shopify)? | Green action + blue info | One blue only | Semantic confusion (success vs CTA) |
| 3 | Sharp radius (GitHub)? | Dev-tool density cue | Soft 12+ is brand | Identity regression; "thô spreadsheet" return |
| 4 | Orange CTA (Cal/Airbnb)? | Warm booking conversion | Brand blue CTA | Breaks lock + marketing feel |
| 5 | Consumer whitespace (Airbnb)? | Photo breath | Ops tables | Unusable finance/CRM density |
| 6 | Dark sidebar (Shopify)? | Merchant brand weight | Warm light shell | Canvas temperature split |
| 7 | 16px body (Cal/Airbnb)? | Consumer readability | 14/13 data | Table overflow, fewer rows |

**Risk score:** 0 critical if we **Adapt/Skip** as above · **Low** for token/CSS micro-ports · **Medium** only if someone transplants color/radius.

---

## 3. Top 8 portable patterns (ranked)

Rank = value for CMC education ERP × low conflict with locks × implementability on Astryx/`@cmc/ui`.

### #1 — Shopify: monochrome base + color-as-meaning (Adapt → Port rules)

**Source:** Polaris color discipline — near-monochrome admin; green/blue only for meaning.  
**CMC fit:** Excellent (already direction).  
**Proposal:** Document + enforce composition rules (no new hex):

```css
/* packages/ui/src/tokens.css — already present; add comment contract */
/* Color meaning contract (Shopify-adapted):
   - Interactive/CTA/link/focus → --cmc-brand only
   - Success/warn/danger → status tokens only (never recolor metrics)
   - Surfaces → warm neutrals only (no cool Apple leftover) */
```

```css
/* premium.css — metric rest stays near-black */
.ck-mc-value { color: var(--cmc-text); } /* never var(--cmc-success) for "up" */
.ck-mc-delta[data-tone="positive"] { color: var(--cmc-success-ink); font-size: var(--cmc-fs-meta); }
```

**Component:** Design Lab anti-pattern card: "rainbow KPI".  
**Adoption risk:** Low. Maturity: industry standard (Polaris/Carbon).

### #2 — GitHub: status = color + icon + text (Port)

**Source:** Primer "don't use color alone".  
**CMC fit:** High — `StatusBadge` + soft pairs exist.  
**Proposal:**

```tsx
// StatusBadge contract (already soft pairs) — enforce icon slot default for danger/success
// packages/ui: StatusBadge always pairs tone with LineIcon when tone !== 'neutral'
```

```css
/* soft badge utilities — ensure min contrast on warm canvas */
.ck-badge-success { background: var(--cmc-success-soft); color: var(--cmc-success-ink); }
.ck-badge-danger  { background: var(--cmc-danger-soft);  color: var(--cmc-danger-ink); }
/* never solid red fill for CRM "current stage" — brand-muted only */
.ck-badge-here    { background: var(--cmc-brand-muted); color: var(--cmc-brand-ink); }
```

**Adoption risk:** Low. Closes a11y + TL12 CRM stage bug class.

### #3 — Shopify: functional density + 14px ops body (Port)

**Source:** "Whitespace is functional, not decorative"; 14px body.  
**CMC fit:** High — already 14/13; protect against consumer drift.  
**Proposal:** freeze density tokens (reject Airbnb 48/64 section):

```css
/* LOCK soft-ops density — do not raise without product decision */
--cmc-pad-card: 24px;
--cmc-pad-card-x: 20px;
--cmc-gap-cluster: 16px;
--cmc-gap-section: 24px; /* not 32–48 */
--cmc-fs-body: 14px;
--cmc-font-size-data: 13px;
--cmc-fs-metric: 32px; /* ops, not hero 40 */
```

**ListPage:** keep `density="ops"` as default for finance/CRM/HR lists.  
**Adoption risk:** Low. Prevents regression only.

### #4 — Shopify: quiet resting elevation + role ladder (Adapt)

**Source:** Flat page + hairline cards; shadow for overlay/modal.  
**CMC fit:** Medium-high — CMC whisper shadows slightly busier than Polaris.  
**Proposal:** composition rule, not radius change:

```css
/* Table / master list chrome: flat family (Shopify-adapted) */
.ck-table-shell {
  background: var(--cmc-surface-raised);
  border: 1px solid var(--cmc-border-subtle);
  border-radius: var(--cmc-radius-card);
  box-shadow: none; /* was shadow-sm — reduce equal-float noise */
}
/* Raised emphasis only: MetricCard, FocusCard, floating Panel */
.ck-mc, .ck-focus { box-shadow: var(--cmc-shadow-sm); }
/* Rows: never elevate */
.ck-row:hover { background: var(--cmc-surface-sunken); box-shadow: none; }
```

**Adoption risk:** Low visual churn. Aligns prior Atlassian research.

### #5 — Shopify/GitHub: label-above forms + one-column happy path (Port)

**Source:** Shopify form simplicity; Cal "minimize required fields".  
**CMC fit:** High — FormPage + soft sunken inputs.  
**Proposal:** recipe only (no new primitive):

```text
FormPage recipe:
  - labels above (Astryx Field)
  - single column max 560–640px for create/edit
  - progressive disclosure: advanced in SectionBlock collapsed
  - sticky actions bar (exists)
  - ResultPanel after automation (exists)
```

Optional token:

```css
--cmc-form-max: 40rem; /* ~640px — Shopify-ish readable form column */
.tpl-form-body { max-width: var(--cmc-form-max); }
```

**Adoption risk:** Low.

### #6 — GitHub: dense metadata rows without hiding ops facts (Adapt)

**Source:** Don't hide SHA/timestamps; condensed meta rows.  
**CMC fit:** High for audit/finance/CRM.  
**Proposal:** extend TaskRow / EntityHeader meta pattern:

```css
.ck-meta-row {
  display: flex; flex-wrap: wrap; gap: 8px 16px;
  font-size: var(--cmc-fs-meta);
  color: var(--cmc-text-muted);
  font-variant-numeric: tabular-nums;
}
.ck-meta-row strong { color: var(--cmc-text-2); font-weight: 500; }
```

**Component:** ensure `EntityHeader` + `KeyValueList` (already in package) used on DetailPage for code/id/createdAt — not buried.  
**Adoption risk:** Low; mostly adoption, not invention.

### #7 — Cal.com: short critical path + pill selectors (Adapt, de-orange)

**Source:** Duration pills; short booking form; clear primary action.  
**CMC fit:** Medium — enrollment / test appointment / leave flows.  
**Proposal:**

```css
/* Soft ops pill choice — brand, not Cal orange */
.ck-choice-pill {
  border-radius: var(--cmc-radius-pill);
  border: 1px solid var(--cmc-border);
  background: var(--cmc-surface-sunken);
  padding: 6px 12px;
  font-size: var(--cmc-fs-meta);
  color: var(--cmc-text-2);
  transition: var(--cmc-transition);
}
.ck-choice-pill[data-selected="true"],
.ck-choice-pill[aria-pressed="true"] {
  background: var(--cmc-brand-muted);
  border-color: color-mix(in srgb, var(--cmc-brand) 35%, var(--cmc-border));
  color: var(--cmc-brand-ink);
  font-weight: 600;
}
```

**Component:** optional `ChoicePills` DUMB composite later; or CSS + Astryx Button ghost group.  
**Adoption risk:** Low if CSS-only first.

### #8 — Airbnb (thin): trust / money emphasis only (Adapt heavily)

**Source:** Price weight 600; host trust visible; sticky commit CTA on mobile.  
**CMC fit:** Narrow — tuition amounts, receipt approve, parent LMS trust.  
**Proposal (admin finance only):**

```css
.ck-money {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--cmc-text);
  letter-spacing: -0.01em;
}
.ck-money-suffix {
  font-weight: 400;
  color: var(--cmc-text-muted);
  font-size: var(--cmc-fs-meta);
} /* e.g. "đ" / "/tháng" — not Airbnb /night marketing */
```

Mobile sticky approve bar (tablet teacher / sale on phone):

```css
@media (max-width: 768px) {
  .sh-sticky-commit {
    position: sticky; bottom: 0;
    padding: 12px 16px;
    background: color-mix(in srgb, var(--cmc-surface-raised) 88%, transparent);
    backdrop-filter: var(--cmc-blur-nav);
    border-top: 1px solid var(--cmc-border-subtle);
    box-shadow: var(--cmc-shadow-md);
  }
}
```

**Skip** listing-card image layout, pill search 32px radius as default control, dual coral/orange.

---

## Trade-off matrix (sources as wholes)

| Option | Ops density | Soft brand fit | Stack cost | Maintenance | Rank for CMC |
|--------|-------------|----------------|------------|-------------|--------------|
| **A. Pattern harvest (this report)** | High | High | Low (CSS + recipes) | Low | **1 — do** |
| B. Transplant Shopify green dual-accent | High | Low (green brand) | Medium | Medium semantic debt | 4 Reject |
| C. Transplant GitHub sharp Primer look | Very high | Low (cold/sharp) | Medium reverse soft pass | Medium | 3 Reject default radius |
| D. Transplant Cal orange Inter SaaS | Medium | Low (orange CTA) | Low-medium | Low but brand break | 5 Reject CTA |
| E. Transplant Airbnb consumer DLS | Low | Low (sparse/photo) | High wrong components | High | 6 Reject |
| F. Ignore sources; invent | TBD | TBD | High | High solo risk | 2 only if A fails |

**Architectural fit of A:** maps 1:1 to `tokens.css` / `premium.css` / existing composites (`ListPagination`, `BulkActionBar`, `SettingsSection`, `ProgressSteps`, `EntityHeader`, `KeyValueList` already shipped post-audit). No new framework.

**Adoption risk:** Low. Sources are static extracts (2026-07-30); not versioned packages — no upstream break risk. Community size N/A (pattern theft, not dependency).

---

## 4. Completeness gap list (full ERP admin DS)

Status vs current `@cmc/ui` (2026-08-03 index + components). Prior audit (2026-08-02) partially closed by new composites — noted.

| Gap | Status now | Priority | Best source cue | Port stance |
|-----|------------|----------|-----------------|-------------|
| Token language (brand, warm, radius, elev) | **exists** | P0 | Shopify monochrome + CMC locks | Maintain |
| Astryx one-door primitives | **exists** | P0 | Shopify "don't fork Polaris" | Maintain |
| Shell AppFrame + SideNav | **exists** | P0 | Shopify shell structure (not dark) | Adapt layout only |
| Page frames List/Detail/Form/Dashboard | **exists** | P0 | Shopify page density | Maintain |
| ListPagination | **exists** (post-audit) | P0 | Shopify index tables | Wire into all large lists |
| BulkActionBar | **exists** | P0 | ERP bulk approve | Wire DataTable selection |
| SettingsSection / KeyValueList / SectionBlock | **exists** | P1 | Shopify settings sections | Adopt on config pages |
| ProgressSteps | **exists** | P1 | Cal short multi-step | Use on enrollment wizards |
| EntityHeader | **exists** | P1 | GH metadata density | Detail pages |
| FilterBar date / date-range / multi | **partial/missing types** | **P0** | Shopify filter patterns | **Adapt extend** FilterDef |
| DataTable sort UI / sticky cols | **partial** | P1 | GH dense tables | Extend, don't restyle sharp |
| Choice pills (duration/type) | **missing composite** | P2 | Cal pills | CSS #7 above |
| Auth page frame | **missing shared** | P1 | Cal short form | `AuthPage` recipe |
| Attendance touch grid composite | **partial (docs only)** | P1 | Touch 44px (Shopify/Airbnb) | Extract composite |
| Schedule / week strip | **missing** | P2 | Cal calendar | Brand-muted slots |
| File upload / dropzone | **missing** | P2 | — | Build when teaching evidence needs |
| Popover / dropdown menu | **missing** | P2 | GH action menus | Astryx first if exists; else light composite |
| Tooltip | **missing** | P3 | GH | Optional |
| Avatar / user chip | **missing** | P3 | Airbnb trust thin | Optional topbar |
| Charts beyond InsightMetric | **partial** | P2 | — | App-local OK |
| Design Lab full catalog | **partial** | P1 | Shopify living docs | Shell + frames live + ConfirmDialog real |
| Doc drift (TL12 radius 4px vs tokens 12) | **stale docs** | P1 | — | Fix evergreen docs, not code |
| Dark mode | **out of scope** | P3 | GH dark | Skip |
| Second stack shadcn | **forbidden** | — | — | Skip forever |

### ERP admin "full DS" checklist (must-have remaining)

1. **FilterBar** `date` | `date-range` | `multi`  
2. **DataTable** selection ↔ **BulkActionBar** end-to-end recipe + Design Lab demo  
3. **ListPagination** on all finance/CRM/user lists  
4. **SettingsSection** adoption on shift/IP/salary/facility config  
5. **Design Lab:** real shell, ConfirmDialog, live Detail/Form, Astryx primitive strip  
6. **AttendanceTouchGrid** extract (≥44px cells, brand selected, sunken rest)  
7. **ChoicePills** or documented Button-group pattern for duration/type  
8. Doc sync: TL12 / MASTER metric size / Toast status — kill stale "4px CTA" / "TO BUILD"

---

## 5. Anti-patterns to reject

| Anti-pattern | Source | Why fatal for CMC | Correct CMC move |
|--------------|--------|-------------------|------------------|
| **Marketing sparsity** (48–64px section gaps, photo-first cards, 16px body everywhere) | **Airbnb** | Kills ops density; fewer rows; unreadable finance | Keep `--cmc-gap-section: 24px`, 14/13 type, text-led cards |
| **Green dual-accent** (brand green CTA + blue links; success = brand) | **Shopify** | Two interactive hues; success conflated with CTA; breaks `#0071E3` lock | One blue; green = success badge only |
| **Sharp 3px radius as default** | **GitHub** | Undoes soft-ops identity; reads "dev tool / spreadsheet" | Keep 12/16/20; sharp only if ever needed for dense *badges inside* tables (optional 8px chip — still not 3px default) |
| **Orange CTA** (`#FF7A45` / `#FC642D`) | **Cal** / **Airbnb** | Marketing conversion color; not education ERP brand | Primary = `--cmc-brand`; never orange accent token |
| Dark `#1A1A1A` sidebar | Shopify | Splits warm canvas family; light-only product | Light `SideNav` |
| Gradient primary buttons | Airbnb | Violates restraint / no decorative gradients | Flat brand fill |
| Coral for both brand and "special badge" | Airbnb Superhost | Confuses brand with status | Status soft pairs only |
| Active tab non-brand coral (`#FD8C73`) | GitHub | Second interactive color | Brand blue tab indicator |
| Success color on metric numerals | common misread of Shopify green | Rainbow dashboards | Near-black metrics + small delta badge |
| Pill **32px** search as default control radius | Airbnb | Breaks nested harmony (control should be 12) | Pill only for chips/CTA shell; inputs 12 |
| Custom font (Cereal / Mona / ShopifySans) | all | Inter locked; extra font cost | Inter only |
| Building parallel components that duplicate Astryx | Shopify "don't" inverted | Dual button/input languages | Extend theme bridge + composites |

---

## Ranked recommendation (concrete)

| Rank | Action | Effort | Impact |
|------|--------|--------|--------|
| **1** | **Adopt pattern harvest A** — monochrome meaning, quiet table elevation, density freeze, status+icon | S | High cohesion |
| **2** | **Close P0 product gaps** — FilterBar dates, table bulk+pagination recipes in real pages | M | High ops value |
| **3** | **Design Lab completeness** — shell, real dialogs, frames live (so ports are visible) | M | Maintainability |
| **4** | **Cal-adapted ChoicePills CSS** for appointment/enrollment | S | Local flows |
| **5** | **Airbnb-thin money + sticky commit** for finance tablet | S | Trust/money clarity |
| **6** | Any color/radius transplant from sources | — | **Do not** |

**Do not** open implementation plan to "become Polaris/Primer." CMC soft-ops is already the right genre; sources only **sharpen rules** and **fill gaps**.

---

## Dependency matrix (pattern → local)

| Source pattern | Local equivalent | Status |
|----------------|------------------|--------|
| Polaris tokens | `tokens.css` | EXISTS |
| Polaris Button/Field | Astryx Button/TextInput + soft theme | EXISTS |
| Polaris IndexTable | `DataTable` + `.ck-table-shell` | EXISTS (extend sort/bulk) |
| Polaris Filters | `FilterBar` | PARTIAL (add date/multi) |
| Primer status labels | `StatusBadge` + soft badges | EXISTS |
| Primer dense meta | `EntityHeader` / `KeyValueList` / TaskRow meta | EXISTS |
| Cal booking form | `FormPage` + ResultPanel | EXISTS |
| Cal duration pills | — | NEW (CSS or small composite) |
| Cal calendar | — | NEW later (teaching) |
| Airbnb listing card | — | SKIP |
| Airbnb Book CTA orange | `.sh-cta` brand | EXISTS (keep blue) |
| Shell sidebar+top | `AppFrame` + `SideNav` | EXISTS |

---

## Limitations (what this research did not cover)

1. **Not live site audits** — static DESIGN.md + token JSON only; real Polaris/Primer may differ in 2026 production.  
2. **No component code port** — compare mode; no implementation.  
3. **LMS mobile parent UX** — Airbnb trust patterns may matter more there; out of admin primary scope.  
4. **Motion / illustration / empty-state illustration systems** — not in sources deeply.  
5. **i18n Vietnamese microcopy patterns** — product language is local (TL2); sources are EN marketing.  
6. **Official Polaris/Primer package APIs** — intentionally not adopted as dependencies.  
7. **Quantitative contrast audit** of soft badges on `#f5f3ee` — trust existing tokens; re-check if soft pairs change.

---

## Unresolved questions

1. Should table shells go **fully flat** (shadow none) or keep `shadow-xs` for separation from warm canvas? (Recommend flat + hairline; validate in Design Lab.)  
2. Is a fifth semantic "done/purple" needed for multi-stage academic workflows, or do stage funnels + brand-here badge suffice?  
3. FilterBar date control: native `<input type="date">` soft-styled vs lightweight calendar popover — product preference for tablet teachers?  
4. AttendanceTouchGrid extraction priority vs FilterBar dates — which unblocks more live UAT flows first?

---

## Handoff

- **Compare report:** this file  
- **Mode:** no implementation plan required for pure compare; if implementing ranked #1–5, open plan under `plans/<timestamp>-soft-ops-pattern-harvest/` and cook  
- **Risk score:** Low (adapt-only)

```text
Status: DONE
Summary: Compared Shopify/GitHub/Cal/Airbnb design extracts to CMC soft-ops locks; ranked 8 portable patterns (monochrome meaning, status+icon, density freeze, quiet elevation, forms, dense meta, de-orange pills, thin money/sticky); rejected Airbnb sparsity, Shopify green dual-accent, GitHub 3px radius, Cal/Airbnb orange CTA.
Concerns/Blockers: none — sources are static extracts, not live DS packages.
```
