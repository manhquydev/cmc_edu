---
title: "local-sim experience setup"
description: "Verify production-like local-sim stack and document role-based experiential tour"
status: completed
priority: P1
effort: S
tags: [ops, local-sim, onboarding]
created: 2026-08-02
---

# local-sim experience setup

## Overview

Bring (or verify) the CMC EDU v2 **local-sim** stack so a human can experience
the product close to production: nginx + TLS, production SPA bundles, email/
password staff auth (no `x-dev-user`), same-origin `/trpc`, seeded multi-role
demo data.

## Brainstorm contract

| Field | Value |
|-------|--------|
| **Outcome** | Stack healthy; role accounts work; clear tour of ERP + LMS |
| **Constraints** | Reuse `docker-compose.prod.yml` + `infra/compose.local-sim.yml`; SSO off; local self-signed TLS; credentials only in gitignored files |
| **Non-goals** | Real VPS deploy, Entra SSO, human UAT certification, product feature work |
| **Acceptance** | All cmcv2-prod services up; staff login HTTP 200; student LMS login with default password path; URLs + account matrix documented |

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Confirm local-sim stack health (api/worker/postgres/nginx/admin/lms) | P1 |
| 2 | Confirm staff + student credentials usable | P1 |
| 3 | Document product map + experiential tour by role | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Verify stack + restore LMS demo password](./phase-01-start.md) | Done |
| 2 | [Document experiential tour](./phase-02-experience-tour.md) | Done |

## Success Criteria

- [x] `cmcv2-prod-*` containers healthy/running
- [x] `https://erp.localhost` + `https://hoc.localhost` return 200
- [x] Staff login (`sale@`, `admin@`) returns `ok:true`
- [x] Student login phone `0912345678` / `Cmc2026@` works (mustChangePassword gate)
- [x] Credentials file `.env.local-sim-accounts` present
- [x] Tour guide in plan phase-02

## Environment snapshot (2026-08-02)

| Surface | URL |
|---------|-----|
| ERP staff | https://erp.localhost |
| LMS parent/student | https://hoc.localhost |
| API health (loopback) | http://127.0.0.1:3000/health |
| Accounts | `.env.local-sim-accounts` (gitignored) |

## Recreate from scratch (if needed)

```bash
# 1) TLS cert (once)
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout infra/nginx/certs/privkey.pem \
  -out infra/nginx/certs/fullchain.pem \
  -subj "/CN=localhost/O=CMC EDU local-sim" \
  -addext "subjectAltName=DNS:localhost,DNS:erp.localhost,DNS:hoc.localhost,IP:127.0.0.1"

# 2) Env
cp .env.prod.example .env.prod   # fill secrets, SUPER_ADMIN_*, SESSION secrets

# 3) Stack
docker compose -p cmcv2-prod --env-file .env.prod \
  -f docker-compose.prod.yml -f infra/compose.local-sim.yml up -d --build

# 4) Migrate + super_admin (host must reach postgres via published 127.0.0.1:5432)
# Adjust DATABASE_URL host to localhost when running from host shell
pnpm --filter @cmc/db exec prisma migrate deploy
npx tsx scripts/seed-super-admin.ts

# 5) Demo seed (staff roles + full enrollment)
LOCAL_SIM_SEED_ALLOW=1 npx tsx scripts/seed-local-sim-demo.ts
# writes .env.local-sim-accounts
```

<!-- slug: local-sim-experience-setup -->
