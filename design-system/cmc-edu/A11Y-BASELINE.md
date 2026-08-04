# CMC EDU — A11y baseline (lite)

> **Status: partial forever** until a human keyboard pass is logged for each
> operator path below. This file is a **baseline checklist + role inventory**,
> **not** WCAG certification, not an axe CI gate, and not a compliance claim.
>
> **SoT:** this file only. `MASTER.md` and `packages/ui/llms.txt` link here —
> do not duplicate the inventory elsewhere.

**Gate type:** report / smoke only. `scripts/check-ui-a11y-roles.mjs` asserts
composites keep expected role/aria substrings. It does **not** prove keyboard
operability, focus order, or screen-reader output.

---

## Operator keyboard paths (≥5)

Manual re-check: keyboard only (Tab / Shift+Tab / Enter / Space / Escape /
Arrow keys where noted). Log date + who + pass|fail in a plan report when
claiming anything beyond **partial**.

| # | Path | Expected keyboard behavior | Primary surfaces |
|---|------|----------------------------|------------------|
| 1 | **Login focus** | Tab reaches Email → Password → show/hide → Đăng nhập. Labels associated. Enter submits when enabled. | `apps/admin/src/pages/login.tsx` · `TextField` / `PasswordInput` |
| 2 | **List filter + pager** | FilterBar is a search landmark; each filter control labeled. ListPagination is a navigation landmark; prev/next + page-size reachable; current page announced via `aria-current`. | `FilterBar` · `ListPagination` · product `ListPage`s |
| 3 | **Bulk selection** | DataTable header “select all” + row checkboxes labeled. When selection > 0, BulkActionBar toolbar appears; actions focusable. Escape/clear selection via product control if present. | `DataTable` · `BulkActionBar` |
| 4 | **Detail breadcrumbs** | PageHeader breadcrumbs live in a labeled nav; parent crumbs with `href` are links (SPA). Detail identity uses single heading ownership (EntityHeader / PageHeader dual-title rule). | `PageHeader` · `DetailPage` · `EntityHeader` |
| 5 | **⌘K command palette** | Open via product shortcut; dialog is modal (`role="dialog"` + `aria-modal`); Escape closes; listbox options arrow-navigable; active option `aria-selected`. | `CommandPalette` · shell |
| 6 | **Toast live** | Success/info toasts in polite live region; error tone uses `role="alert"`. Dismiss control labeled. | `Toast` / `ToastProvider` |

---

## Composite role inventory (from real code)

| Composite | Expected role / aria | File path | Notes |
|-----------|----------------------|-----------|-------|
| FilterBar | `role="search"` · `aria-label="Bộ lọc"` · per-field `aria-label` | `packages/ui/src/components/filter-bar.tsx` | List filter landmark |
| ListPagination | `role="navigation"` · `aria-label="Phân trang"` · prev/next labels · `aria-current="page"` | `packages/ui/src/components/list-pagination.tsx` | Pager landmark |
| BulkActionBar | `role="toolbar"` · `aria-label="Thao tác hàng loạt"` | `packages/ui/src/components/bulk-action-bar.tsx` | Appears when selection active |
| DataTable selection | header `aria-label="Chọn tất cả trên trang"` · row `aria-label="Chọn dòng"` | `packages/ui/src/components/data-table.tsx` | Only when selection enabled |
| PageHeader breadcrumbs | `<nav aria-label="Đường dẫn">` | `packages/ui/src/components/page-header.tsx` | Breadcrumb trail |
| SettingsShell rail | `<aside aria-label={title}>` · `aria-current="page"` on active | `packages/ui/src/components/settings-shell.tsx` | Settings tier |
| CommandPalette | `role="dialog"` · `aria-modal="true"` · listbox / option / `aria-selected` | `packages/ui/src/components/command-palette.tsx` | ⌘K overlay |
| Toast | container `aria-live="polite"` · item `role="status"` or `role="alert"` | `packages/ui/src/components/toast.tsx` | Live region feedback |
| SideNav | semantic `<nav className="sh-nav">` | `packages/ui/src/components/side-nav.tsx` | **Gap:** no `aria-label` / `aria-current` on items — see Gaps |
| EntityHeader | decorative avatar `aria-hidden` | `packages/ui/src/components/entity-header.tsx` | Identity chrome; not a landmark |
| PasswordInput | show/hide `IconButton` has `label` | `packages/ui/src/components/auth-inputs.tsx` | Login path |

---

## Gaps (honest — not automated)

What this baseline **does not** claim or automate:

| Gap | Detail |
|-----|--------|
| **No WCAG certification** | No AA/AAA claim. No full audit against WCAG 2.x success criteria. |
| **No axe / pa11y CI** | Explicit non-goal of Soft Ops cycle 4. Role smoke ≠ accessibility tree validation. |
| **No human keyboard pass log** | Paths above are checklists only until a maintainer logs a pass. Status stays **partial**. |
| **SideNav incomplete** | Has `<nav>` but no `aria-label` on the landmark; module/child buttons lack `aria-current` for the active route. Keyboard works (native buttons) but SR orientation is weaker than SettingsShell. |
| **Login auto-focus** | Email field is not auto-focused on mount; first Tab may need to enter the card. |
| **Focus trap coverage** | CommandPalette / ConfirmDialog traps depend on Astryx Dialog behavior — not re-asserted by the role smoke script. |
| **Table action cells** | Row action buttons vary by product page; no global “actions column” a11y contract beyond DataTable selection checkboxes. |
| **Contrast / reduced-motion** | Tokens aim for readable contrast and `prefers-reduced-motion` in MASTER; not measured by this smoke. |
| **LMS surface** | This baseline targets admin Soft Ops composites. LMS mobile paths are out of scope here. |
| **Depth gates ≠ a11y** | `check-ui-frames --strict` gates dual-title + bulk adoption only — not roles. |

---

## How to re-check

### 1. Role smoke (automated, no axe)

```bash
node scripts/check-ui-a11y-roles.mjs
node scripts/check-ui-a11y-roles.mjs --json   # machine-readable
node --test scripts/check-ui-a11y-roles.test.mjs
# optional package scripts when present:
pnpm check:ui-a11y-roles
pnpm test:ui-a11y-roles
```

Exit **0** = required substrings still present in composite sources.  
Exit **1** = a composite lost an expected role/aria marker — fix the component, not the checklist.

### 2. Manual keyboard pass (required before status can leave partial)

1. Walk paths 1–6 above with keyboard only on a local admin build.  
2. Record: date, browser, path id, pass|fail, notes.  
3. Attach log under a plan report (e.g. `plans/.../reports/a11y-keyboard-pass-YYYY-MM-DD.md`).  
4. Only then may red-team MS-3 / a11y finding move past **partial** — never mark **fixed** on docs alone.

### 3. Regression with frames

```bash
pnpm check:ui-frames   # still dual-title + bulk; independent of a11y smoke
```

---

## Status language (for agents & lab)

| Phrase | Allowed? |
|--------|----------|
| “A11y baseline **partial** (doc + role smoke)” | Yes |
| “Role substrings present in `@cmc/ui` composites” | Yes |
| “WCAG AA compliant / certified” | **No** |
| “A11y fixed” without keyboard pass log | **No** |
| “A11y fixed-lite” greenwash | **No** |

Red-team finding **MS-3** / a11y dim must stay **partial** until a human keyboard pass is logged.
