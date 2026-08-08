# CMC EDU design system (agent kit)

Produced by **`ak-ui-ux-pro-max`** + **`ak-ui-styling`**, adapted to the real stack.

| File | Purpose |
|------|---------|
| [MASTER.md](./MASTER.md) | Global SoT — tokens, density, interaction, anti-patterns |
| [PAGE-FRAMES.md](./PAGE-FRAMES.md) | **Khung trang chung** — Dashboard/List/Detail/Form + cockpit theo role |
| [VIEW-GRAMMAR.md](./VIEW-GRAMMAR.md) | **Ngữ pháp tương tác** — Odoo→CMC map, ControlBar, exemptions |
| [CONSOLE-COMPONENT-MAP.md](./CONSOLE-COMPONENT-MAP.md) | **Odoo 19 → CMC design3** — shell/CP/list/form/kanban map + stacking |
| [STYLING-BRIDGE.md](./STYLING-BRIDGE.md) | shadcn/Tailwind skill → `@cmc/ui` / Astryx map |
| [pages/cockpit.md](./pages/cockpit.md) | Dashboard / Tổng quan per role |
| [pages/list-ops.md](./pages/list-ops.md) | List & ops tables |
| [pages/attendance.md](./pages/attendance.md) | Điểm danh touch reference |

**When building a page:** read `pages/<name>.md` if present, else MASTER. Never invent a second component library.

**Admin design3:** shell is ConsoleNavbar (not SideNav). Authority: `docs/design-system-console.md` + [CONSOLE-COMPONENT-MAP.md](./CONSOLE-COMPONENT-MAP.md). Re-dissect Odoo via `plans/260806-odoo-ui-component-dissection/`.

**Code authority:** `packages/ui/src/console.css` (admin), `apps/lms/src/app.css` (LMS `lms-*`), `tokens.css`, `index.ts`.
