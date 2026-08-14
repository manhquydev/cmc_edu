# Shape brief — CMC EDU design system (lab)

**Confirmed 2026-08-14:** Lab first (1C) · Full gallery · Hybrid bridge.

## Job and audience
Staff ERP operators (5 roles) need one visual grammar so every daily surface — cockpit, list, detail, form — feels like the same product, with content reshaped by RBAC rather than restyled per page.

## Outcome and proof
- A browser-openable `design-lab` gallery that shows tokens + atoms + molecules + four page archetypes in the Linear/Stripe canon world already approved for cockpit (comp-c).
- Role cohesion: switching role changes queues/columns/CTAs, not chrome.
- Hybrid: gallery is the living spec; `packages/ui` receives tokens/API in later waves — **no production edits in this wave**.

## Selected direction
- Visual authority: cockpit sample `design-lab/cockpit-roles/` + approved `.impeccable/mocks/comp-c.webp`.
- Craft bar: Linear + Stripe Dashboard.
- Purple `#71639e` primary; near-white ground; hairline borders; 40px tabular rows; Inter; ruled metrics (not hero-metric cards); trapezoid funnel.
- OpenEduCat contract stays frozen for production list/form/statusbar until a later bridge wave; lab does not claim to replace it yet.

## Scope and boundaries
**In:** `DESIGN.md` · `design-lab/system/` full gallery · bridge map doc (lab → `@cmc/ui`).
**Out:** edits to `apps/admin`, `packages/ui` runtime, OpenEduCat CSS, LMS.
**Anti-goals:** second component library install; shadcn/Tailwind; purple-on-white marketing look; inventing business claims.

## States and ranges
Empty, loading skeleton, hover/focus, disabled, badge tones (danger/warning/success/info/brand/neutral), selected row, bulk selection, toast success/error.

## Interaction and layout
Shared left shell (240px) · utility chips · underline tabs · archetype bodies. Primary action always named and purple-filled. Queue/table rows activatable.

## Constraints and open decisions
- Stack: static HTML/CSS/JS in design-lab (same as cockpit sample).
- Vietnamese copy + synthetic data labeled.
- Open: when wave-1 tokens land in `@cmc/ui`; whether production shell stays top-nav or adopts sidebar.
