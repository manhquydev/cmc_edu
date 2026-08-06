# Xia compare — Odoo Settings vs CMC SettingsShell

**Date:** 2026-08-06  
**Mode:** `--compare --auto`  
**Pin:** `/home/manhquy/Downloads/odoo-src` @ `7de220c9` (`19.0`)  
**Allowlist:** `addons/web/static/src/webclient/settings_form_view/**`  
**Local:** `packages/ui` SettingsShell + `odoo.css` `.o-settings-*`; admin: shift-config, network-ip, salary-tiers  
**Handoff:** `plans/reports/handoff-20260806-1148-odoo-design3-session.md`  
**Do not port:** OWL settings compiler, searchable_setting RPC, Bootstrap.

---

## 1. Source manifest

| | |
|--|--|
| Tree | `webclient/settings_form_view/` (+ `settings/`, mobile scss) |
| Layout SCSS | `settings_form_view.scss`, `settings_form_view_mobile.scss` |
| CMC | `settings-shell.tsx`, `settings-section.tsx`, `.o-settings-shell` |

---

## 2. Wireframe (Odoo)

```text
[ CP: search ...... | Save Discard ]
+--------+----------------------------------+
| tabs   | settings pane (overflow:auto)    |
| rail   | optional search header           |
| 40px   | h2 band sections                 |
| inset* | max-width containers + boxes     |
+--------+----------------------------------+
 <md: horizontal scrolling tabs on top
```

Sticky: tab **column wrapper** (`position-sticky top-0`), not section titles.

---

## 3. Dependency matrix

| Concern | Odoo | CMC | Status |
|---------|------|-----|--------|
| Left rail + main | `.settings_tab` + `.settings` | SettingsShell rail + main | EXISTS |
| Active accent | inset 2px left | brand-muted fill | PARTIAL (ok SPA) |
| Sticky rail | sticky tab column + dual scroll | sticky card rail `top:8px` page scroll | PARTIAL |
| Mobile tabs | horizontal scroll `<md` | 1-col stack `@860px` | MISSING |
| Section `h2` band | gray title bar | SettingsSection / ck-set cards | PARTIAL |
| Settings search CP | `o_cp_searchview` | — | SKIP (OWL/search model) |
| Content max-width | lg | unconstrained | small |

---

## 4. Challenges (--auto resolved)

| # | Challenge | Resolution |
|---|-----------|------------|
| 1 | Port full dual-overflow settings view? | **No** — keep SPA page scroll + SettingsShell |
| 2 | Port search highlight / searchable_setting? | **Skip** — OWL + search model |
| 3 | Match mobile horizontal tabs? | **Optional P2** — only if UX complaints on admin settings pages |
| 4 | Force inset accent vs brand-muted active? | **Keep CMC brand** fill |
| 5 | Cook settings before float z-stack? | **Float first** — wrong toast z hurts all surfaces |

---

## 5. Cookable gaps (≤3)

| Pri | Gap | Effort | Notes |
|-----|-----|--------|-------|
| P2 | Mobile horizontal settings tabs | ~0.5–1d | Only if product wants Odoo density on phone |
| P2 | Section band + max-width density (SettingsSection → odoo band) | ~0.5d | Avoid ck-set card chrome race |
| P3 | Inner dual-pane scroll | arch | Defer; conflicts with shell scroll-owner choice |

**Skip:** settings search CP, OWL compiler, purple mobile underline (`$o-brand-primary`) → use `--cmc-brand` if ever built.

---

## 6. Verdict

SettingsShell is **good enough for design3**. No P0/P1 cook from this surface. Prefer float stacking cook next; revisit settings mobile only on demand.

**Next:** `xia-compare-260806-odoo-float-layers.md` then plan toast z-band.
