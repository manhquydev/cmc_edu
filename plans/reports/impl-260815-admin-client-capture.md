# Implementation Report — Admin client-side error capture (impl-260815-admin-client-capture)

**Date:** 2026-08-15 · **Branch:** feat/back-before-design · **Scope:** apps/admin/src only (per task constraints; no apps/api, apps/lms, docker, .env, secrets touched; no rebuild/deploy).

## Outcome

The CMC EDU Admin app now captures client-side errors (window.onerror, unhandledrejection, React render/lifecycle errors) and reports them same-origin to the API's `POST /api/track-error` endpoint, which forwards them into the server capture pipeline keyed by reqId (the browser cannot reach GlitchTip/Sentry directly — loopback). Capture is fail-open: reporting never throws and never disturbs the app.

## Files created / changed (all under apps/admin/src/)

| File | Change |
|------|--------|
| `apps/admin/src/lib/error-report.ts` | **New.** `generateErrorCode()` (10-char `[A-Z0-9]` via deterministic short hash of `crypto.randomUUID`: two seeded FNV-1a 32-bit hashes → 64-bit value → base-36, 10 chars; time+random fallback for non-secure contexts), `reportError(input)` (fire-and-forget same-origin `fetch` POST to `/api/track-error` with body `{ code, message, stack, url, userAgent, route, kind, extra }`; never throws; failures catch-and-log), flood control (module-level counters: max 1 report per 2 s, max 10 per page load), `ErrorKind` = `'window.onerror' | 'unhandledrejection' | 'react-boundary'`. |
| `apps/admin/src/lib/error-boundary.tsx` | **New.** Class `ErrorBoundary` (`getDerivedStateFromError` generates the code at render phase so the fallback never flashes without one; `componentDidCatch` reports kind `'react-boundary'` with `extra.componentStack`, keeps `console.error` with the code). Fallback: minimal card (warm surface-raised, border-subtle, radius-card, shadow-md tokens) with title "Đã có sự cố", the 10-char code (danger color, tabular-nums), and an Astryx `Button` (variant primary, from `@cmc/ui`) reload action. `data-astryx-theme="neutral"` on the root keeps Astryx theming working above the providers. No stack shown to the user, per design. |
| `apps/admin/src/main.tsx` | **Edited.** Wrapped the whole tree (StrictMode → ErrorBoundary → trpc.Provider → QueryClientProvider → AstryxCmcProvider → ToastProvider → SessionProvider → RouterProvider) with the root `ErrorBoundary`; registered `window 'error'` (kind `'window.onerror'`, extra: filename/lineno/colno) and `'unhandledrejection'` (kind `'unhandledrejection'`, extra: JSON-safe reason) handlers before first render — each generates a code, calls `reportError`, and keeps `console.error` with the code for local debugging. Added local `rejectionExtra()` helper for JSON-safe reason serialization. |
| `apps/admin/src/app.css` | **Edited.** Appended `.error-boundary-fallback*` block — app-local, consumes `@cmc/ui` tokens only (no new design system). |

## Wiring summary

- **Entry:** `main.tsx` registers both global handlers before `createRoot().render()` so even early errors are captured; the boundary wraps the provider tree so render/lifecycle errors of any provider or page are caught.
- **Flow:** error → `generateErrorCode()` (10-char code) → `reportError()` (deduped, fire-and-forget) → `POST /api/track-error` (same-origin; cookies sent by default — no credentials option needed) → API logs via pino + captures via Sentry with the request reqId; response `{ ok: true, code }`.
- **UX:** React-tree crashes show the persistent fallback with the code + reload (toast layer lives below the boundary and is transient — auto-dismiss 7 s — so it is not used for the code; `useToast` exists in `@cmc/ui` and remains untouched for its existing call sites). Window-level errors are reported + console-logged only (no intrusive overlay) — matches the "toast/overlay nhỏ" design intent for the boundary path.
- **No behavior change:** routes, tRPC client, business logic untouched; `lib/trpc.ts` unchanged.

## Verification

- `pnpm --filter @cmc/admin typecheck` → **exit 0** (tsc -p tsconfig.json --noEmit, no errors).
- `pnpm --filter @cmc/admin build` → **exit 0** (tsc --noEmit && vite build; 585 modules, built in ~570 ms).
- ESLint (one-door rule, changed files): **0 errors** (`main.tsx` ignored by design per eslint.config.js).
- Runtime sanity (Node type-stripping import of `error-report.ts`): 200/200 codes are 10-char `[A-Z0-9]`, all unique; `reportError` caught a forced fetch failure and logged it (fail-open confirmed) without throwing.

## Concerns

1. **API route was being written in parallel** — `apps/api/src/lib/track-error-route.ts` (+ test) and the LMS-side capture (`apps/lms/src/lib/error-report.ts`, `error-boundary.tsx`, `main.tsx`) appeared in the working tree during this task (not created by me). The API contract matches my client body exactly (path, fields, fail-open, 200 `{ ok: true, code }`). Coordination: confirm both sides land together (client 404s harmlessly until the route mounts).
2. **Dev-mode proxy gap:** `apps/admin/vite.config.ts` proxies only `/trpc`, `/upload`, `/auth`, `/health` — not `/api`. In local dev the report hits the Vite dev server and 404s (silently logged). Production nginx routes `/api` (the API route file references infra/nginx/api-locations.conf rate-limit zones), so prod is fine. Adding `/api` to the dev proxy is outside the `apps/admin/src/` scope — flagged for the API-side/deploy owner. Not a blocker for this client-side task.
3. **Flood control is client-only** (1 per 2 s, 10 per page load) — the API additionally relies on nginx rate limiting for abuse; no session auth on the endpoint by design (window handlers can fire outside sessions). Acceptable per design contract.
4. **Non-Error throws:** boundary/global handlers defensively stringify non-Error values (`String(reason)`); stack is only attached for real `Error` instances. 

Status: DONE
Summary: Admin now captures window.onerror / unhandledrejection / React render errors, generates a 10-char [A-Z0-9] correlation code per event, and reports them fire-and-forget to same-origin POST /api/track-error with a persistent boundary fallback (code + reload) — typecheck and build both pass.
Concerns/Blockers: The API route + LMS capture are being implemented in parallel (already in the working tree) and match this client contract; dev-mode Vite proxy does not yet forward /api (prod nginx does) — flag to the API/deploy owner.
