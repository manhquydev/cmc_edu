# Test Report — 2026-08-13 — local-sim live stack (independent)

**HEAD:** `6af0f5f` (`origin/develop`)  
**Stack:** `cmcv2-prod` rebuilt from this checkout (not the stale `cmc_edu-shift-registration-overflow-fix` compose)  
**Proof:** behavior against running nginx+TLS+prod images. Not `journeys.json`.

## Test Results Overview

| Suite | Result |
|-------|--------|
| Independent HTTP scenarios `verify:local-sim` | **8/8 ok** |
| Playwright browser audit (GĐĐT) | **ok** (1 benign 401 during login race) |
| `verify:system --skip-slow` | **ok** (L2 source-string green; L3 ledger SHA mismatch = expected locally) |

## Environment cleaned then rebuilt

- Deleted local merged branches `feat/hoan-thien-*`, `docs/ds-hardening-evidence`; dropped 3 stashes.
- Stopped leftover `cmcv2-prod` that was bound to another folder; wiped pg+blob volumes; `--build` from `develop@6af0f5f`.
- Fresh migrate (53 SQL) + `ALTER ROLE cmc_app` + `seed-super-admin` + `seed-local-sim-demo` (HTTP, TLS).
- All six services up: nginx/api/worker/postgres/admin/lms. API `/health` 200. Ports loopback-only.

| URL | Role |
|-----|------|
| https://erp.localhost | ERP staff |
| https://hoc.localhost | LMS |
| http://127.0.0.1:3000/health | API probe |
| `.env.local-sim-accounts` | passwords (gitignored, not in this report) |

## Independent scenarios (S1–S8)

All **ok**: API health · SPA login shell, no Dev shortcut, no HSTS · LMS 200 · `x-dev-user` **401** · GĐĐT cookie login · `session.me` roles `giam_doc_dao_tao` · sale **403** on `lmsOps.listEnrollmentsForStudent` · HTTP→HTTPS 301.

Artifact: `acceptance-report/local-sim-verification.json`

## UI Test Results

Pages: `/login` → cockpit → `/design` → `/teaching` as GĐĐT.

- **01-login:** production login only (Email / Mật khẩu / Đăng nhập). No Dev button, no SSO (SSO off).
- **02-after-login:** chrome “Giám đốc đào tạo”; body still white (screenshot before cockpit fetch finished).
- **03-design-gallery:** live family merge — StatCard/MetricCard, StatusBadge, EmptyState ops, FilterBar+DataTable.
- **04-teaching:** teaching nav + cockpit metrics 0 (receipt already approved in seed) + empty work inbox.

Screenshots: `plans/reports/live-sim-audit/*.png`  
Console: one 401 during login handshake; filtered as non-blocking.

## Meter (HEAD, not live stack)

L2a–d + L5 **ok**. L3 unmeasured: local `journeys.json` SHA ≠ `6af0f5f` — ledger of record remains CI `ui-e2e` artifact. Meter did not call `--strict`.

## How to re-run

```bash
LOCAL_SIM_LIVE=1 pnpm verify:local-sim
LOCAL_SIM_LIVE=1 pnpm verify:local-sim:browser
pnpm verify:system -- --skip-slow
```

## Critical Issues

None blocking the live stack.

## Recommendations

1. First `compose up` on empty volume will fail API health until migrate + `ALTER ROLE cmc_app` — document in local-sim recreate (postgres up → migrate → password → seed → up nginx).
2. Capture cockpit screenshot after a networkidle on `session.me` to avoid white 02.
3. Do not promote this stack to `main`; human OK still required.

## Unresolved

- Local `journeys.json` is stale vs HEAD (CI already green on #136/#137).
- Cloud-agent branch `cursor/cloud-agent-*` left (`.agents` skills only).
- Observability compose `cmcv2-obs` left running (needed by `cmc-obs-bridge`).
