# E2E Playwright MCP — local-sim report

**Date:** 2026-08-02  
**Target:** production-like local-sim (`cmcv2-prod` + `infra/compose.local-sim.yml`)  
**Tool:** Playwright MCP (`browser_run_code_unsafe` + `ignoreHTTPSErrors` for self-signed TLS)  
**Not used:** `pnpm --filter @cmc/e2e test` (that suite needs throwaway synth DB + PLAYWRIGHT_UI, not this stack)

## Verdict

| # | Journey | Result | Evidence |
|---|---------|--------|----------|
| 1 | Sale login → cockpit | **PASS** | `/cockpit`, role `sale`, pipeline O5=1 |
| 2 | Sale CRM pipeline | **PASS** | `/crm` — *Chị Hoa (PH bé Minh Anh)* in **Đã ghi danh · 1** |
| 3 | Student LMS login | **PASS** | `/student/change-password` gate (default `Cmc2026@`) |
| 4 | GĐĐT login → finance | **PASS** | Receipt **SO00001** · Nguyễn Minh Anh · **25.000.000 đ** · **Đã duyệt** |
| 5 | Super admin login | **PASS** | `/cockpit`, role `super_admin`, menu **Quản trị** |
| 6 | Giáo viên login | **PASS** | `/cockpit`, class `CMCDEVEL-UCREA-2026-001` **Đang dạy** |

**Overall: 6/6 critical UI journeys PASS** against live local-sim.

## Screenshots

Directory: `plans/260802-1425-local-sim-experience-setup/e2e-screenshots/`

| File | Scene |
|------|--------|
| `01-erp-login.png` | Staff login form |
| `02-erp-login-filled.png` | Sale credentials filled |
| `03-erp-after-login.png` | Sale cockpit |
| `04-erp-crm.png` | CRM pipeline with enrolled opportunity |
| `05-lms-login.png` | LMS login |
| `06-lms-login-filled.png` | Student phone/password filled |
| `07-lms-after-login.png` | Forced change-password screen |
| `08-gddt-cockpit.png` | GĐĐT cockpit |
| `09-gddt-finance.png` | Phiếu thu list with SO00001 |
| `10-gddt-classes.png` | (nav stayed on finance — link miss) |
| `11-admin-cockpit.png` | Super admin cockpit |
| `12-admin-users.png` | (nav stayed on cockpit — link miss) |
| `13-gv-cockpit.png` | Teacher cockpit + class schedule |

## Notes / gaps

1. **Self-signed TLS:** MCP default context rejects cert; e2e used `browser.newContext({ ignoreHTTPSErrors: true })`.
2. **Student path product design:** after default-password login, UI requires **parent-mediated** password reset (not self-service). Gate works as designed.
3. **Nav link fragility:** some deep links by role name missed (admin users, class list from GĐĐT) — login + primary role surfaces still verified.
4. **Repo Playwright suite** (`apps/e2e`) is a separate harness (synthetic DB). Re-run that with:
   ```bash
   SYNTH_SEED_ALLOW=1 scripts/synthetic-seed-env.sh
   # then PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium
   ```
   only when you want CI-parity journey tests, not local-sim product demo.

## Reproduce (MCP-equivalent script idea)

```js
// ignoreHTTPSErrors context → erp.localhost login → crm → hoc.localhost student login
```

Screenshots already on disk under `e2e-screenshots/`.
