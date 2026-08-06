# Xia compare — Odoo float layers vs CMC toast / cmd / dialog

**Date:** 2026-08-06  
**Mode:** `--compare --auto`  
**Pin:** `/home/manhquy/Downloads/odoo-src` @ `7de220c9`  
**Allowlist:** `core/dialog/**`, `core/notifications/**`, `core/commands/**`, `core/dropdown/**` (+ overlay/z tokens as evidence)  
**Local:** `odoo.css` `.ck-toast*`, `.ck-cmd*`; `odoo-float-layer.test.ts`; `odoo-shell-stacking.test.ts`  
**Do not port:** OWL overlay service, Bootstrap modal JS, purple interactive accent.

---

## 1. Odoo stacking (effective)

Bootstrap band (evidence):

| Token | z |
|-------|--:|
| dropdown | 1000 |
| modal backdrop | 1050 |
| modal / notification / overlay item | **1055** |
| popover / tooltip | 1070+ |

Notifications: `$o-notification-zindex: 1055`. Dialog + command palette share overlay ≈1055. Navbar has no competing high z in `navbar.scss` (CMC already sets navbar **1000** for app-switcher).

---

## 2. CMC map (as-built)

| Layer | z | Notes |
|-------|--:|-------|
| statusbar / control-bar | 4–5 | under menus |
| toast viewport | **60** | **below navbar 1000** |
| navbar | 1000 | app-switcher context |
| command palette | **1200** | above shell |
| ConfirmDialog (Astryx) | ? | not contracted in odoo.css |

`STYLING-BRIDGE.md` old 0–60 scale is **stale** vs live odoo.css.

---

## 3. Challenges (--auto resolved)

| # | Challenge | Resolution |
|---|-----------|------------|
| 1 | Raise toast to 1055 exactly? | **No** — use CMC documented band; keep cmd above toast |
| 2 | Port Bootstrap modal stack? | **No** — contract Astryx dialog + CSS vars only |
| 3 | Toast above navbar? | **Yes** — Odoo notifications sit in float band above chrome |
| 4 | Cmd above toast? | **Yes** — palette is intentional modal-like |
| 5 | Purple on floats? | **Keep `--cmc-brand*`** for toast info / cmd active |

Target order (documented):

```text
page chrome (1–10) < navbar (1000) < toast (~1100) < dialog (~1150) < command palette (1200)
```

---

## 4. Cookable gaps (≤3)

| Pri | Gap | Effort |
|-----|-----|--------|
| **P1** | Raise `.ck-toast-viewport` above navbar; lock with float-layer / stacking test | ~30–60m |
| **P1** | Document stacking table in ODOO-COMPONENT-MAP / STYLING-BRIDGE; assert cmd > toast > navbar | same PR |
| P2 | ConfirmDialog / Astryx modal z authority in odoo.css (if portal creates stacking bugs) | when reproduced |

---

## 5. Verdict

**P1 cook:** toast z-band. Highest professionalism leverage for float grammar; Settings has no blocking P1.

**Cook command (auto follow):** implement toast ≥1100 and `< .ck-cmd` (1200), extend `odoo-float-layer.test.ts`.
