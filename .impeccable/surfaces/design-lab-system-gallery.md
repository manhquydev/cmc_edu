# Surface: design-lab/system gallery

**Choice locked:** 1C Lab first · Full gallery · Hybrid · multipage  
**World:** Ruled Ledger (Linear + Stripe craft bar, purple `#71639e`)  
**Approved composition:** `.impeccable/mocks/comp-c.webp` (`approved: true`)  
**Depth decisions (2026-08-14):** three-layer tokens · density default 40px · multipage modules

## Purpose

Living visual spec for the Hybrid path: lab owns look; later waves port tokens/API into `@cmc/ui`. No production edits until bridge is authorized.

## Entry

- Foundations: `design-lab/system/index.html`
- Patterns: `design-lab/system/patterns.html`
- Modules: `design-lab/system/modules/{crm,finance,teaching,students,hr,engagement,audit,print}.html`
- Serve: `python3 -m http.server 8766 --directory design-lab` → http://127.0.0.1:8766/system/
- Role cockpits: http://127.0.0.1:8766/cockpit-roles/
- Bridge map: `design-lab/system/BRIDGE.md`
- Research: `plans/reports/research-260814-design-system-depth.md`
- System record: root `DESIGN.md` + `.impeccable/design.json`

## Sections shipped

**Foundations:** three-layer tokens · color · type · density · space/shape · seven states · a11y  
**Patterns:** list (saved views, URL state, bulk bar) · master–detail · dashboard · detail · form · approval gate · toast/palette  
**Modules:** CRM · Finance · Teaching · Students · HR · Engagement · Audit · Print

## Proof

`.impeccable/screenshots/system-v2/` (1440×900 + mobile 390×844 Chrome via Playwright)
