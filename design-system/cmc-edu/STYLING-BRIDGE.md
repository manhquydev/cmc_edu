# Styling bridge: `ak-ui-styling` → CMC `@cmc/ui`

Skill **ak-ui-styling** assumes shadcn + Tailwind. CMC EDU is **Astryx + CSS tokens**. This file is the adapter so agents apply styling *patterns* without forking the stack.

---

## Decision

| Option | Verdict |
|--------|---------|
| Install shadcn + Tailwind beside Astryx | **Reject** — two design systems, one-door lint, duplicate Dialog/Button |
| Map shadcn patterns to `@cmc/ui` | **Accept** |
| Steal only missing primitives (Toast) into `@cmc/ui` | **Accept** |

---

## Token ↔ Tailwind mental model

| Tailwind-ish | CMC CSS |
|--------------|---------|
| `bg-background` | `var(--cmc-canvas)` |
| `bg-card` | `var(--cmc-surface-raised)` |
| `text-foreground` | `var(--cmc-text)` |
| `text-muted-foreground` | `var(--cmc-text-muted)` |
| `bg-primary` / `text-primary-foreground` | `var(--cmc-brand)` / `#fff` |
| `border` | `var(--cmc-border)` / `var(--cmc-border-subtle)` |
| `rounded-md` | `var(--cmc-radius-md)` (16px — was documented as 12px here; corrected 2026-08-10, matches `tokens.css:79`) |
| `rounded-full` | `var(--cmc-radius-pill)` |
| `p-6` | `--cmc-pad-card` / space-4 |
| `gap-4` | `--cmc-space-3` (16) |
| `shadow-sm` | `--cmc-shadow-sm` (hover/float only) |
| `transition` | `--cmc-transition` (140ms) |
| `min-h-11` touch | `44px` (attendance TOUCH_MIN_HEIGHT) |

---

## Radius zone rule (operator decision, 2026-08-09)

Admin runs **two deliberate radius scales**, not a bug:

| Zone | Scale | Source | Applies to |
|---|---|---|---|
| Odoo console chrome | `--console-radius(-sm/-lg)` 3 / 4 / 6px | `console.css:46-48` | list/table surfaces, chevron statusbar, kanban — anything under `.o_web_client .console-*` that's a direct Odoo-source recreation |
| Soft-ops / premium | `--cmc-radius-inner/control/card/dialog` 8 / 12 / 16 / 20px | `tokens.css:44-47,79-81` | Astryx primitives (Button/TextInput/Selector/Dialog) and premium composites (MetricCard/Panel/PageHeader) |

**Why not unify:** the two zones serve different intents — console chrome is a
source-grounded Odoo recreation (verified against `primary_variables.scss` in
the pinned Odoo source: `$o-border-radius: 4px / -sm: 3px / -lg: 6px` — 3/4/6
is the *faithful* value, not an approximation) where matching Odoo's own
visual language is the point; soft-ops composites are CMC's own premium
layer with no Odoo equivalent to match. Forcing one scale onto the other
would either make Odoo chrome deviate from its own source of truth, or make
every button/input/dialog needlessly boxy.

**What "not a bug" does NOT license:** a `10px` (or any value outside both
tables above) appearing anywhere is real drift, not a third zone — e.g. the
Astryx bridge's `--radius-inner` was hardcoded to `10px` with no token behind
it until 2026-08-10 (fixed: `--cmc-radius-inner: 8px`, continuing the
existing 4px-step nested-harmony progression down from `control`).

**Acceptance for future changes:** measure radius **per component family**,
not as a raw count of distinct radii on a page — a page legitimately showing
both zones (e.g. a console list row next to a premium dialog) is correct,
not a defect. A defect is a value that belongs to *neither* table.

---

## Button hierarchy (styling skill variants)

Use Astryx `Button` from `@cmc/ui` (one-door). Do **not** invent CSS modifier
classes for button chrome. Admin tokens live in `packages/ui/src/console.css`
under `.o_web_client` — authority: `docs/design-system-console.md`. Interactive
accent remains `--cmc-brand` / `#0071E3`.

| shadcn | CMC implementation target |
|--------|---------------------------|
| `default` | Astryx `Button variant="primary"` |
| `secondary` | `Button variant="secondary"` (outline/soft) |
| `ghost` | `Button variant="ghost"` for Đăng xuất / minor systray |
| `destructive` | `ConfirmDialog` (default confirm is destructive) or `Button variant="destructive"` |
| `outline` | `Button variant="secondary"` |
| `link` | Text + `--cmc-brand` + chevron (TaskRow / MetricCard ctx) |

Press/active feedback is owned by Astryx Button and console tokens. Do not add
retired shell CTA modifiers.

---

## Feedback components

### Toast (build like shadcn useToast)

**API sketch**

```tsx
// packages/ui — ToastProvider at app root
toast.success('Đã lưu điểm danh');
toast.error('Không duyệt được phiếu', { action: { label: 'Thử lại', onClick } });
// aria-live="polite", role="status", auto-dismiss 4000ms success / 7000ms error
// position: bottom-right desktop; bottom-center narrow
// z-index: above topbar
```

Styles: surface-raised, shadow-md, radius-md, left accent bar success/danger, 13–14px Inter.

### Banner (exists)

Inline persistent error/success near form — keep for page-level; toast for global commit.

### EmptyState (exists)

```tsx
<EmptyState
  title="Không có bài chờ chấm"
  description="Khi học sinh nộp bài, danh sách sẽ hiện tại đây."
  icon={<LineIcon name="edit" size={22} />}
  action={<Button label="Xem lịch dạy" variant="secondary" onClick={...} />}
/>
```

Cockpit currently uses raw `.ck-empty` — migrate to EmptyState + action for consistency.

### ConfirmDialog (exists)

Align copy with AlertDialog skill patterns; prefer `intent` over color string when refactoring.

---

## Form patterns (styling skill)

| Pattern | CMC |
|---------|-----|
| Label + control + message | Astryx Field; never placeholder-only |
| Required | “Bắt buộc” VN — not `Required` EN |
| Submit | `isLoading` + disable double submit |
| Validation | blur / server Banner; focus first error |
| Password | `PasswordInput` |

---

## Responsive (styling skill mobile-first)

| Breakpoint | ERP admin behavior |
|------------|-------------------|
| &lt;768 | ConsoleNavbar sections overflow-x; stack cockpit; avoid page-level horizontal scroll |
| 768–1039 | Single column body |
| ≥1040 | Cockpit 1.4fr / 1fr |
| LMS | Keep mobile frame separate (YAGNI) |

---

## z-index scale (design3 admin / console.css — authoritative)

| Layer | z | Selector cue |
|-------|--:|--------------|
| List thead / light sticky | 1–5 | `.o-list-table thead`, control-bar, statusbar |
| Page chrome (under shell) | auto/static | `.o_web_client .o-page-header` |
| App switcher (in navbar) | 10 | `.o-app-switcher-menu` |
| Navbar shell | **1000** | `.o-navbar` |
| Toast viewport | **1100** | `.console-toast-viewport` (Odoo notif ≈1055) |
| Dialog band (docs) | **1150** | `dialog.ck-dialog` — ConfirmDialog also uses native **top layer** via `showModal()` (above all fixed z) |
| Command palette | **1200** | `.ck-cmd` |
| ConfirmDialog top layer | browser | above toast/cmd while open |

Stale proposal (topbar 20 … toast 60) retired — do not use for admin design3.

---

## DX conventions

1. Import UI only from `@cmc/ui` (one-door).  
2. New composite → `packages/ui` + console.css class (admin), not page-local mega CSS.  
3. Screenshots before/after for shell/topbar/button hierarchy.  
4. E2E: confirm dialogs + toast role when added.  
5. When skill docs say “add shadcn X”, open this bridge first.

---

## Related

- `MASTER.md` — global rules  
- `pages/*.md` — page overrides  
- `plans/260802-research-ui-ux-product-eval/reports/ui-ux-pro-max-interaction-upgrade.md`  
