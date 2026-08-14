# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Staff of Vietnamese K–12 education centers, working in the `apps/admin` ERP
console on office desktops at 1440px and wider (confirmed 2026-08-14). Five
roles carry the cockpit surface:

| Role key | Vietnamese label | Job on arrival |
|---|---|---|
| `super_admin` | Super admin | Runs the network: facilities, users, audit log. Bypasses every gate, including money gates. |
| `giam_doc_kinh_doanh` | Giám đốc kinh doanh | Approves receipts, owns refunds, owns the CRM pipeline and revenue outcome. |
| `giam_doc_dao_tao` | Giám đốc đào tạo | Second-eyes receipt approval, grants LMS unit ranges, owns teaching quality and classes. |
| `sale` | Sale | Moves opportunities O1→O5, drafts receipts. Cannot approve receipts and cannot read the receipt list (separation of duties). |
| `giao_vien` | Giáo viên | Takes attendance, grades submissions, logs session evidence, punches shift time. |

`apps/lms` serves parents and students (mobile-first) and is a separate surface,
not in this cockpit scope.

## Product Purpose

CMC EDU v2 is a facility-scoped ERP + LMS for education centers. It joins
enrollment (CRM lead → opportunity → receipt → enrolled student), class
operations (attendance, grading, session evidence), HR and payroll (shifts,
punches, KPI scoring, monthly salary), and student rewards into one system where
every record is isolated per facility.

Success on the cockpit surface: a staff member who opens the console knows,
within seconds, what is waiting for *them* and can start the first item without
navigating a menu.

## Positioning

Facility-scoped isolation enforced in the database (Postgres row-level security
across 37 tables) combined with a registry-driven RBAC that encodes real
Vietnamese center separation of duties: the person who drafts a receipt is
structurally barred from approving or even listing receipts, and amounts above a
configurable threshold (`approvalSecondEyeThreshold`, default 20,000,000 đ)
require a second director. Money movements and audits are append-only ledgers
(`RefundRecord`, `AuditLog`), not editable rows.

## Operating Context

- Console shell: `ConsoleNavbar` (46px) → control panel (~58px) → workspace.
- Cockpit route `/cockpit` is the landing surface after login; staff authenticate
  with email/password (Entra SSO and Microsoft Graph are switched off because the
  M365 tenant permissions were lost — see `docs/system-architecture.md`).
- Enrollment pipeline stages: `O1_LEAD` (Tiếp cận), `O2_CONTACTED` (Đã liên hệ),
  `O3_TEST_SCHEDULED` (Đặt lịch KT), `O4_TESTED` (Đã kiểm tra), `O5_ENROLLED`
  (Đã ghi danh).
- Receipt lifecycle: draft → approved, with the second-eyes threshold gate.
- Follow-up reminders classify as late / today / future (`classifyDueLevel`).
- Vietnamese UI throughout; role names are rendered through `formatRole` /
  `formatRoles`, never as raw role keys.
- Numbers are Vietnamese-formatted (`toLocaleString('vi-VN')`, đ suffix); names
  carry full diacritics, so any typeface must cover Vietnamese.

## Capabilities and Constraints

- Monorepo: pnpm + Turbo, TypeScript ESM. Frontend Vite + React; API tRPC 11 +
  Prisma + Postgres; admin UI built on Astryx primitives plus `@cmc/ui`
  composites styled by CSS custom properties in `packages/ui/src/console.css`.
- Admin pages must use one of four page archetypes (`DashboardPage`, `ListPage`,
  `DetailPage`, `FormPage`); a production page may not invent full-page layout.
  A standalone design sample outside `apps/admin` is exempt.
- No second component library may be installed (no shadcn, no Tailwind) in the
  product apps.
- Data shown per role is bounded by RBAC: `sale` has no receipt list at all, so a
  sale cockpit cannot show receipt counts; `giao_vien` has no CRM read.
- Acceptance status is measured, not asserted: `pnpm acceptance:report`. As of
  2026-07-26 (`0b933bf`) 31 of 38 flows are proven by browser journey tests,
  which is the ceiling of that method; the remaining 7 have no UI path. Journeys
  prove a flow runs, not that its arithmetic is right, and human UAT has not run,
  so the product is not to be described as production-ready.
- Undecided: whether the cockpit visual approach explored in this sample becomes
  the production direction.

## Brand Commitments

- Name: CMC EDU v2.
- Admin console currently clones OpenEduCat 18 / Odoo Community chrome inside
  `.o_web_client`: brand purple `#71639e`, 4px radius, 40px list rows, Inter for
  Vietnamese diacritics. `design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md`
  remains authority for **production** list, form, and statusbar fidelity until
  a later bridge wave lands tokens from the lab into `@cmc/ui`.
- LMS and `tokens.css` keep Apple blue `#0071E3`; that blue must not appear on
  admin buttons, links, focus rings, or tabs.
- **Design-lab direction (confirmed 2026-08-14):** Lab first · Full gallery ·
  Hybrid. The Linear + Stripe canon world proven in
  `design-lab/cockpit-roles/` (approved composition `.impeccable/mocks/comp-c.webp`)
  is the intended visual SoT for new design-system work under `design-lab/`.
  Production apps are not migrated until the gallery and `DESIGN.md` are
  complete and a bridge wave is explicitly authorized.

## Evidence on Hand

- Working implementation: `apps/admin/src/pages/cockpit.tsx` (role queues,
  metrics, pipeline funnel, schedule panel).
- Design corpus: `design-system/cmc-edu/` (MASTER, PAGE-FRAMES, VIEW-GRAMMAR,
  CONSOLE-COMPONENT-MAP, A11Y-BASELINE, OpenEduCat contract) and `docs/`
  (TL00–TL31, `system-architecture.md`, `codebase-summary.md`).
- Reference screenshots: `/home/manhquy/Downloads/openeducat-ui-pack` (Odoo 18 +
  OpenEduCat 18 PNG pack).
- No real customer names, testimonials, benchmarks, pricing, or production
  metrics exist for design use. Any student, parent, staff, receipt code, class
  code, or amount shown in a sample is authored demonstration data and must be
  labeled as such.

## Product Principles

1. The cockpit answers "what is waiting for me", not "how is the business
   doing"; a metric that cannot be acted on does not earn a place.
2. Permission shapes content. Each role sees only what its RBAC allows, so five
   cockpits differ in substance, not in decoration.
3. Money and audit surfaces state their gate plainly: draft versus approved,
   below versus above the second-eyes threshold, who may act.
4. Vietnamese is the product language, including role labels, number formats, and
   diacritic-safe type.
5. Measured evidence beats documentation. Where a status is claimed, the command
   that produces it is named.

## Accessibility & Inclusion

`design-system/cmc-edu/A11Y-BASELINE.md` is the single source of truth and is
explicitly "partial forever" until a human keyboard pass is logged. Established
requirements: keyboard-operable operator paths (login, list filter and pager,
bulk selection, detail breadcrumbs, command palette, toasts), labeled landmarks
on filters and pagination, focus ring 2px `--console-brand-purple` offset 1px,
and honoring `prefers-reduced-motion`. No WCAG certification is claimed.
