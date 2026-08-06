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
| `rounded-md` | `var(--cmc-radius-md)` (12px) |
| `rounded-full` | `var(--cmc-radius-pill)` |
| `p-6` | `--cmc-pad-card` / space-4 |
| `gap-4` | `--cmc-space-3` (16) |
| `shadow-sm` | `--cmc-shadow-sm` (hover/float only) |
| `transition` | `--cmc-transition` (140ms) |
| `min-h-11` touch | `44px` (attendance TOUCH_MIN_HEIGHT) |

---

## Button hierarchy (styling skill variants)

| shadcn | CMC implementation target |
|--------|---------------------------|
| `default` | Astryx `Button variant="primary"` · `.sh-cta` |
| `secondary` | `variant="secondary"` · **add** `.sh-cta--secondary` (outline/soft) |
| `ghost` | **add** `.sh-cta--ghost` for Đăng xuất / minor topbar |
| `destructive` | ConfirmDialog destructive · Button danger where Astryx allows |
| `outline` | secondary + border |
| `link` | Text + brand color + chevron (TaskRow / MetricCard ctx) |

### Shell CSS snippet (to implement)

```css
/* premium.css — proposed */
.sh-cta--secondary {
  background: transparent;
  color: var(--cmc-text-2);
  border: 1px solid var(--cmc-border);
}
.sh-cta--secondary:hover { background: var(--cmc-surface-sunken); }
.sh-cta--ghost {
  background: transparent;
  color: var(--cmc-text-muted);
  border: none;
}
.sh-cta--ghost:hover { background: var(--cmc-surface-sunken); color: var(--cmc-text); }
.sh-cta:active, .sh-cta--secondary:active, .sh-cta--ghost:active {
  transform: scale(0.98);
}
.sh-item:active { background: var(--cmc-surface-sunken); }
.ck-mc:active { box-shadow: none; background: var(--cmc-surface-sunken); }
```

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
| &lt;768 | SideNav collapse (if not yet: accept horizontal scroll avoidance); stack cockpit |
| 768–1039 | Single column body |
| ≥1040 | Cockpit 1.4fr / 1fr |
| LMS | Keep mobile frame separate (YAGNI) |

---

## z-index scale (design3 admin / odoo.css — authoritative)

| Layer | z | Selector cue |
|-------|--:|--------------|
| List thead / light sticky | 1–5 | `.o-list-table thead`, control-bar, statusbar |
| Page chrome (under shell) | auto/static | `.o_web_client .o-page-header` |
| App switcher (in navbar) | 10 | `.o-app-switcher-menu` |
| Navbar shell | **1000** | `.o-navbar` |
| Toast viewport | **1100** | `.ck-toast-viewport` (Odoo notif ≈1055) |
| Dialog band (docs) | **1150** | `dialog.ck-dialog` — ConfirmDialog also uses native **top layer** via `showModal()` (above all fixed z) |
| Command palette | **1200** | `.ck-cmd` |
| ConfirmDialog top layer | browser | above toast/cmd while open |

Stale proposal (topbar 20 … toast 60) retired — do not use for admin design3.

---

## DX conventions

1. Import UI only from `@cmc/ui` (one-door).  
2. New composite → `packages/ui` + premium.css class, not page-local mega CSS.  
3. Screenshots before/after for shell/topbar/button hierarchy.  
4. E2E: confirm dialogs + toast role when added.  
5. When skill docs say “add shadcn X”, open this bridge first.

---

## Related

- `MASTER.md` — global rules  
- `pages/*.md` — page overrides  
- `plans/260802-research-ui-ux-product-eval/reports/ui-ux-pro-max-interaction-upgrade.md`  
