# US-UI-03 App shell — nav + RBAC gating + login

## Status

done

## Lane

high-risk

## Product Contract

`apps/admin` dark sidebar with 5 modules (~30 routes), a role switcher (5 roles:
`ke_toan`, `truong_phong`, `giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `super_admin`),
and an ERP/LMS toggle link. Login screen wires to `x-dev-user` header (dev auth only —
no production credential form). Route-level RBAC guard via `canAccess(role, module)`
redirects to `/unauthorized` on mismatch.

## Relevant Product Docs

- `docs/11-api-contract.md`
- `docs/18-tech-stack-va-chuan-ky-thuat.md`
- `docs/19-security-va-privacy.md`

## Risk Flags

- Auth (`x-dev-user` header must only be accepted in development mode)
- Authorization (RBAC guard covers all 30 routes)
- Cross-platform (sidebar collapses on tablet breakpoint)

## Acceptance Criteria

- All ~30 routes render without crash for an authorized role.
- Unauthorized route → redirect to `/unauthorized` (no 404, no blank page).
- `x-dev-user` header sets session; stripped in production build.
- Role switcher changes active role without page reload.
- ERP/LMS toggle navigates to `apps/lms` URL.

## Design Notes

- Commands: n/a.
- Queries: n/a (dev auth header, no DB call on login).
- API: `auth.devSession` publicProcedure (dev-only, stripped in prod).
- Tables: n/a.
- Domain rules: `canAccess(role, module)` lookup table — 5 roles × 5 modules.
- UI surfaces: `apps/admin/src/shell/` (Sidebar, RoleSwitcher, AuthGuard, LoginPage).

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-UI-03 --unit 0 --integration 1 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | n/a. |
| Integration | Build passes; typecheck clean; all routes importable. |
| E2E | n/a (UI-driven specs deferred to Playwright browser project). |
| Platform | `pnpm build` green for `apps/admin`. |
| Release | `pnpm typecheck` workspace-wide passes. |

## Harness Delta

No harness rule changes. Dev-auth header guard is a build-time conditional.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
