# Impl Report: LMS Client-Side Error Capture

**Date:** 260815 | **Branch:** feat/back-before-design | **Scope:** apps/lms/src only

## Files created
- `apps/lms/src/lib/error-report.ts` — client capture core:
  - `generateErrorCode()`: 10-char `[A-Z0-9]` correlation code via FNV-1a short hash of `crypto.randomUUID()` (timestamp+random fallback for non-secure contexts); one hash pass per output position so all 10 chars derive from the full UUID.
  - `reportError(opts: { code, message, stack?, url?, kind, extra? })`: fire-and-forget same-origin `fetch POST /api/track-error` with `keepalive: true`; body matches plan P2-A contract (`code, message, stack, url, route, userAgent, kind, extra` — route/userAgent derived from `window.location` / `navigator`); **never throws** (wrapped in try/catch + fetch guard + swallowed rejection); dedupe 1 per 2s, max 10 per page load.
- `apps/lms/src/lib/error-boundary.tsx` — `ErrorBoundary` class component (kind `react-boundary`), reports via `reportError` with componentStack in extra; minimal inline fallback card (tokens + @cmc/ui Button/Heading/Stack/Text, `data-astryx-theme="neutral"` wrapper so theme overrides apply outside the provider) showing "Đã có sự cố — Mã lỗi: XXXXXXXXXX" + reload button; stack never shown to the user (design P2-B).

## Files changed
- `apps/lms/src/main.tsx` — wiring:
  1. Imports `ErrorBoundary`, `generateErrorCode`, `reportError`.
  2. `window` `error` listener → `reportError` kind `window.onerror` (+ filename/line/col extra), `console.error` kept with code prefix.
  3. `window` `unhandledrejection` listener → kind `unhandledrejection`; non-Error reasons stringified into extra.
  4. Render tree wrapped in `<ErrorBoundary>` (outermost, inside StrictMode, around all providers + router).
  5. Handlers installed before `createRoot` so early runtime errors are captured; no business logic or routes touched.

## Wiring summary
- Capture paths covered: React render/lifecycle crash → ErrorBoundary; uncaught JS exception → `window.onerror`; unhandled promise rejection → `unhandledrejection`. All funnel into `reportError()` → `POST /api/track-error` (same-origin, no credentials header needed — session cookie rides along).
- User-facing UX: fallback overlay with error code + reload button (boundary); code printed to console for global handlers (design P2-B: hiển thị trong ErrorBoundary + trên console.error). No toast mounted (LMS has no toast infra; @cmc/ui ToastProvider styles live in console.css which LMS does not import) — minimal inline overlay chosen per task guidance.
- No changes to apps/api, apps/admin, docker, .env, secrets, vite.config.ts, routes, or business logic.

## Typecheck / build / lint result
- `pnpm --filter @cmc/lms typecheck` (repo root): **exit 0** — clean.
- `pnpm --filter @cmc/lms build` (tsc --noEmit && vite build): **exit 0** — built in 453ms, 480 modules, dist/ is gitignored.
- `pnpm exec eslint --no-warn-ignored --max-warnings=0` on the 3 changed files: **exit 0** (one-door @cmc/ui import rule satisfied; no `@astryxdesign` direct imports).
- Dev server NOT started; no redeploy (per constraints).

## Concerns
1. **API endpoint not yet present**: `POST /api/track-error` does not exist in apps/api yet (delivered in parallel per plan P2-A). Until it lands, reports fail silently — by design (fire-and-forget, fail-open). No code change needed here.
2. **Dev-mode proxy gap**: `apps/lms/vite.config.ts` proxies /trpc, /upload, /auth, /health but NOT /api, so in dev the report hits the Vite server and fails (swallowed). Production nginx routes /api to the API server. vite.config.ts is outside the allowed edit surface (apps/lms/src) and was left untouched intentionally; flagging so the API/ops job can add `/api` to the proxy if dev-side verification is desired.
3. **Correlation codes are short hashes**: 10-char [A-Z0-9] ≈ 36^10 space for correlation/tracability — collisions possible in theory, acceptable for the lookup use case (not auth/security).
4. **Dedupe drops reports silently** after 1/2s and 10/page-load (intentional rate control for crash loops; first error always sent).
5. **No toast for global handlers**: window.onerror/unhandledrejection surface only via console.error + report; design allows "toast/overlay nhỏ" but a toast infra would require wiring @cmc/ui ToastProvider + console.css — out of scope of "minimal" instruction.

Status: DONE
Summary: Client-side error capture added to LMS — error-report.ts (generateErrorCode + deduped fire-and-forget reportError to POST /api/track-error) and error-boundary.tsx (fallback with code + reload) created; main.tsx wraps the tree in ErrorBoundary and installs window.onerror/unhandledrejection handlers; typecheck, build, and eslint all pass (exit 0) with no changes outside apps/lms/src.
Concerns/Blockers: /api/track-error endpoint is pending the parallel API/admin job (reports fail silently until then); dev proxy does not forward /api (vite.config.ts out of allowed edit scope).
