# Weekly Architecture Review

## Architecture Summary

The inferred architecture of CMC EDU v2 follows a monolithic backend monorepo with strict module boundaries.
* The API layer uses tRPC with a heavily procedure-based approach (rather than REST), organized by domain.
* The API acts as the integration point between the UI and the domain packages (like `@cmc/domain-finance`).
* Data persistence is managed via Prisma, structured with facility isolation via row-level security (RLS).
* Core business constraints are encoded in reusable cross-domain packages (`packages/domain-*`) which are expected to be pure and unaware of Prisma or UI.
* Shared procedures enforce authorization uniformly through `@cmc/auth` registry.

## Recent Structural Changes

* Significant improvements made in UI to consolidate the Astryx design migration and console abstractions.
* Various domains in the API (like CRM, Finance, LMS Operations, KPI) experienced refactorings but generally respected the existing tRPC `protectedProcedure` or `lmsProcedure` abstractions.
* New capabilities and test tools added like `check-ui-frames.mjs`, `verify-system.mjs` to enforce UI consistency, which shows investment in structural integrity.

## Architecture Findings

### [DESIGN CONCERN] Database specific code within test files of the API layer

Location: `apps/api/src/test/db.ts` and many associated tests (e.g., `user/app-user.test.ts`)

Expected architecture: Test helpers interact with repositories or abstract contexts to setup state, ideally decoupled from Prisma client specifics.

Observed architecture: The `test/db.ts` heavily imports Prisma and passes around `PrismaClient` instances directly to bypass application context rules.

Dependency path: Test -> `createPrivilegedPrismaClient` (Prisma) -> Database

Why this matters: While common in integration tests, doing this extensively inside the API domain boundaries without abstraction ties the test suite directly to the ORM implementation and can cause large test refactoring if database boundaries change.

Long-term consequence: Over-coupling between the test suites and Prisma specifics can hinder future migrations or cause test fragility if the data model significantly changes.

Recommended direction: Establish test factories that operate via application interfaces instead of raw database context manipulation where possible.

### [DESIGN CONCERN] Direct imports of `@cmc/db` inside domain boundaries

Location: `apps/api/src/router.ts`, `apps/api/src/trpc.ts`, and domain routers (e.g., `crm/router.ts`).

Expected architecture: The API `router` layer handles presentation and delegates business logic to separate service/domain layers.

Observed architecture: Routers directly import and utilize `@cmc/db` (Prisma), often containing complex transaction blocks or direct ORM interactions within the procedure definition.

Dependency path: Router -> Prisma -> Database

Why this matters: This pattern forces the router to handle both transport-level concerns (tRPC context, validation) and data persistence logic, leading to "fat controllers" and violating the single responsibility principle.

Long-term consequence: Business logic becomes tightly coupled with the tRPC framework and the ORM, making it difficult to extract, test in isolation, or reuse across different entry points (like background workers or different API protocols).

Recommended direction: Gradually abstract database interactions behind repository or service interfaces, keeping the tRPC procedures focused on input validation, authorization, and delegating to the business layer.

## Healthy Architectural Patterns Observed

* **Strong Authorization Integration:** The use of `withFacility` and strict role checks (`requirePermission`, `requireValidFacility`, `requireLmsStudent`) in `apps/api/src/trpc.ts` consistently enforces multi-tenancy and security boundaries across all endpoints.
* **Separation of Domain Packages:** Extracting logic like `@cmc/domain-identity` and `@cmc/domain-time` showcases excellent decoupling of pure business logic from the HTTP/tRPC presentation layer and data access tier.
* **Rigorous System Verification:** The presence of `scripts/verify-system.mjs` and UI lint rules actively prevents UI architectural drift automatically, establishing a strong defense against regressions.

## Architecture Drift Trend

Stable

The core design patterns documented in `AGENTS.md` and `system-architecture.md` are being actively maintained and enforced. Recent changes adhere to the established conventions for routers, RLS, and component organization. The identified concerns are primarily long-term design reflections rather than acute drift.

## Highest Priority Architecture Concern

The heavy coupling of business logic and Prisma interactions directly within the tRPC router definitions (e.g., in `crm/router.ts` or `finance/router.ts`). While functional, it risks creating maintenance bottlenecks as these modules grow in complexity.

## Final Assessment

PASS
