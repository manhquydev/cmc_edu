# CMC EDU v2

A **facility-scoped ERP/LMS platform** for educational centers. Monorepo-based, TypeScript+React+tRPC. P1–P4 workflows are built, and 27 of 38 business flows are proven end-to-end by real browser journey tests (measured 2026-07-26, commit `22bbead`). **Not certified production-ready:** those journeys prove a flow *runs*, not that its business arithmetic is right; 7 flows have no UI path yet; and real-human UAT (M0) has not been run. Current status: `pnpm acceptance:report`.

**Current Status:** P1 (enrollment pipeline) ✓ · P2–P4 (classes, HR, payroll, rewards) built & tested · Astryx UI migration complete · Super-admin (facility mgmt, network CRUD, audit log) shipped · In active development.

**Last Update:** 2026-07-17 (super-admin completion — see `docs/project-changelog.md` for the dated entry)

> Test/router/table counts below verified 2026-07-17; these numbers move fast in active development — treat `docs/codebase-summary.md` and `docs/system-architecture.md` as the live source if this file lags.

---

## What Is CMC EDU v2

An educational management platform (Vietnamese k–12 centers) that integrates:

- **CRM & enrollment** — lead pipeline, opportunity tracking, payment receipts, parent/student provisioning
- **Class operations** — attendance, exercise/submission grading, session evidence, session lifecycle
- **HR & payroll** — staff shifts, daily punch tracking, KPI auto-scoring, monthly salary computation
- **Student rewards** — star redemption, gift catalog, parent meetings, entry testing
- **Multi-role access** — 9 staff roles + 2 LMS-only roles (parent/student), facility-scoped isolation

## Monorepo Structure

```
D:\project\vip\CMC
├── apps/
│   ├── admin/       # Vite+React ERP SPA (100% Astryx, incl. super-admin)
│   ├── lms/         # Vite+React LMS SPA (parent/student, mobile-first)
│   ├── api/         # tRPC backend (Node.js + Prisma + Postgres, 38 routers)
│   └── e2e/         # Playwright browser + API tests
├── packages/
│   ├── auth/        # RBAC registry (9 staff + 2 LMS roles)
│   ├── db/          # Prisma schema, migrations (50 models), seed
│   ├── domain-finance/   # Receipt, refund, facility-scoped logic
│   ├── domain-identity/  # Phone normalization
│   ├── ui/          # Design system: Astryx primitives + premium composites
│   ├── llm/         # LLM-assisted grading (assessment draft comments)
│   ├── mcp-server/  # MCP server layer (not yet active)
│   ├── storage/     # File upload/download (S3 abstraction)
│   └── (others)
├── docs/            # Design corpus (TL00–TL31), frozen & authoritative
├── plans/           # Session reports (audits, remediation, reviews)
└── scripts/         # CLI, deployment, CI utilities
```

## Stack

- **Monorepo:** pnpm + Turbo
- **Language:** TypeScript (ESM)
- **API:** tRPC 11 (procedure-based, not REST)
- **Database:** Postgres + Prisma ORM with row-level security (RLS, 37 tables) + append-only ledgers (RefundRecord, AuditLog)
- **Frontend:** Vite + React — apps/admin (ERP) + apps/lms (LMS)
- **UI Design:** Astryx (@astryxdesign/core@0.1.4) + premium design layer (@cmc/ui)
- **Auth:** Registry-driven RBAC (centralized in @cmc/auth), facility scope via RLS
- **Testing:** Vitest (API: 104 files/988 tests · admin: 39 files/396 tests — đo trên CI 2026-07-26, commit `22bbead`) + Playwright (e2e: 39 spec files, gồm 27 journey UI; project `ui-chromium` 34 spec xanh trên CI)

## Getting Started

### Install & Develop

```bash
cp .env.example .env             # PowerShell: Copy-Item .env.example .env
corepack enable
pnpm install --frozen-lockfile   # reproducible workspace install
pnpm typecheck                   # TypeScript check
pnpm dev                         # start dev servers (admin, lms, api)
pnpm test                        # run all tests (except e2e)
pnpm build                       # build all packages
pnpm lint                        # lint apps/admin + apps/lms
pnpm acceptance:report           # regenerable acceptance ledger (HTML; gitignored)
```

Harness agent workflow on a fresh clone:

```bash
./scripts/bootstrap-harness.sh
# PowerShell: .\scripts\bootstrap-harness.ps1
```

Bootstrap downloads the release pinned by `scripts/harness-cli-release-tag`,
verifies its SHA-256 checksum, and initializes the instance-local `harness.db`.
Harness policy, schemas, stories, plans, and project rules are version-controlled;
the CLI binary and operational database remain machine-local. GitNexus is also a
local cache: run `npx gitnexus analyze` after cloning instead of committing
`.gitnexus/`.

Throwaway DB for UI e2e / evidence capture (spins its OWN dedicated Postgres
container, never the local-sim `cmc_prod` stack):

```bash
SYNTH_SEED_ALLOW=1 scripts/synthetic-seed-env.sh [--fresh]   # print APP_DATABASE_URL/DATABASE_URL to export
```

### Platform Notes (Windows vs Linux)

The repo builds identically on both, but the local Postgres plumbing differs.

| Topic | Windows (Docker Desktop) | Linux / Ubuntu |
|---|---|---|
| Docker CLI | Works in **Git Bash**, not WSL2 Ubuntu (only the `docker-desktop` distro has the socket) | Native, no workaround |
| Reaching the compose Postgres | It has **no host port mapping** by design. Needs a throwaway socat sidecar:<br>`docker run --rm -d --name pgfwd --network <net> -p 15432:15432 alpine/socat tcp-listen:15432,fork,reuseaddr tcp-connect:postgres:5432` | Same sidecar works, or add a port mapping in your local compose override |
| Sidecar lifetime | Does **not** survive a Docker/host restart — symptom is commands hanging for minutes then "Can't reach database server". Fix: `docker start <name>` (don't recreate) | Same |

`.env`, `.env.prod` and every `.env*` are gitignored — a fresh clone has **no
secrets**. Copy `.env.example` and fill in your own values; `pnpm
verify:portability` checks that every runtime env key is documented there.

### Gotchas That Cost Real Time

- **e2e UI must run alone.** `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test` without
  `--project=ui-chromium` runs the `api` and `ui-chromium` projects against the
  same database; the API specs create receipts and the UI specs then fail an
  "empty list" assertion. That is a **false red**, not a product bug. Correct:
  `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`.
- **Tests read `src`, the running server reads `dist`.** `apps/api/vitest.config.ts`
  aliases workspace packages to their TypeScript source, but runtime resolution
  uses each package's compiled `dist` via its `exports` map, and `dist/` is
  gitignored. After changing `packages/auth` (or any workspace package), run
  `pnpm --filter @cmc/auth build` before probing a live dev server — otherwise
  unit tests go green while the API still serves the old behavior.
- **Never point tests at the pilot database.** `assertNotProdDatabase` refuses
  `cmc_prod`, but it currently guards only `APP_DATABASE_URL`; the privileged
  teardown connection reads `DATABASE_URL` directly. Set both explicitly.

### Database Setup (Local Development)

```bash
# Postgres must be running (Docker or native)
pnpm --filter @cmc/db exec prisma migrate dev   # run pending migrations
pnpm --filter @cmc/db exec prisma db seed       # seed test data
```

### Run Tests

```bash
pnpm --filter @cmc/api exec vitest run          # all API tests
pnpm --filter @cmc/api exec vitest run --coverage  # with coverage
pnpm --filter @cmc/e2e exec playwright test    # e2e browser tests
```

## Architecture

For the complete, authoritative system architecture, see **`docs/system-architecture.md`** — it describes:
- All 27 tRPC routers and their procedures
- P1–P4 workflow implementations with test coverage
- RLS & append-only ledger security model
- Astryx UI migration phases (1–4 complete, phase 5 pending)
- Known issues, deferrals, and debt

**Quick reference:**
- **Procedures:** All authenticated, facility-scoped, RLS-enforced
- **Data Model:** 13 core + 4 support tables, 5 migrations (P1 + remediation waves)
- **Audit & Ledger:** Append-only RefundRecord & AuditLog (UPDATE/DELETE blocked at DB layer)

## Documentation Index

All product design and implementation notes live in `docs/` (Vietnamese, with English implementation details):

- **`docs/README.md`** (TL00–TL31) — Main index of all frozen design docs
- **`docs/system-architecture.md`** — As-built architecture (authoritative, updated 2026-07-11)
- **`docs/codebase-summary.md`** — Current implementation status and test coverage
- **`docs/project-roadmap.md`** — Phases 5+, next steps
- **`docs/project-changelog.md`** — Dated entry log (2026-07-05 onwards)
- **`docs/07-glossary-san-pham.md`** (TL07) — CMC product glossary (ubiquitous language)
- **`docs/decisions/`** — 14 architecture decision records (ADR-0001, 0038–0043, etc.)
- **`docs/stories/`** — 10 user story packets (backlog items, workflow specs)

**Note on Harness:** This project also includes the repository-harness meta-tooling layer (for agent workflow coordination). See `docs/HARNESS.md` for that model; it is separate from the product itself.

## Key Decisions & Constraints

See `docs/decisions/` for full ADRs. Highlights:

- **Facility isolation (ADR-A):** All data scoped by `facilityId` via RLS
- **Receipt-driven provisioning (ADR-A, TL16):** Enrollment only becomes `active` after receipt approval
- **Second-eye threshold (ADR-B):** Receipts ≥20M VND require director approval
- **Daily punch pairing (ADR-0043):** Staff in/out times paired per calendar day, offsite requires reason + manual approval
- **Salary tier model (ADR-0044):** Base salary + KPI bonus − penalties, tier-based per staff
- **5 core roles (ADR-D):** v2 focuses on `giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `sale`, `giao_vien`, `super_admin`; others deferred

## Development Workflow

1. **Feature intake** — `docs/FEATURE_INTAKE.md` classifies work (tiny/normal/high-risk)
2. **Design docs** — Update frozen corpus in `docs/TLxx-*.md` before implementation
3. **Story packet** — `docs/stories/US-*-*.md` describes acceptance criteria, test expectations
4. **Implementation** — Code changes with RBAC/RLS verification
5. **Test coverage** — Unit (Vitest, ≥90% statements) + e2e (Playwright)
6. **Validation** — Merged only when all tests pass + docs updated

## Support & Contact

For questions about:
- **Product design:** See `docs/` (frozen design corpus) or ask in code comments
- **Architecture:** `docs/system-architecture.md` or `docs/codebase-summary.md`
- **Harness workflow:** `docs/HARNESS.md`
- **Decisions:** `docs/decisions/ADR-*`

**Repository:** CMC EDU v2 @ `D:\project\vip\CMC` (private)
**Team:** Active development by Nguyễn Mạnh Quý
**Last sync:** 2026-07-17
