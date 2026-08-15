import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
// Astryx reset flip (plan Phase 3 step 5): admin now renders zero legacy-UI
// components, so its provider + styles are dropped here (the legacy UI-library
// package deps stay in package.json until Phase 5 per rollback policy — only
// the runtime usage is removed). main.tsx is the one whitelisted entry
// allowed to import CSS/reset directly; reset.css is app-scoped and NOT in
// @cmc/ui (red-team F14). Order: reset → tokens → astryx theme (astryx.css +
// theme.css, imported transitively by astryx-theme-cmc.css) → app overrides.
import '@astryxdesign/core/reset.css';
// Inter Variable (self-hosted, no external fetch) — professional typeface that
// replaces the dated Segoe UI default on Windows. Imported before tokens.css so
// --cmc-font-sans ("Inter Variable" first) resolves to a loaded face.
import '@fontsource-variable/inter';
import '@cmc/ui/tokens.css';
import '@cmc/ui/astryx-theme-cmc.css';
// CMC Console design system (admin ERP UI) — import once at app root.
import '@cmc/ui/console.css';
import './app.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc, makeTrpcClient, makeQueryClient } from './lib/trpc.js';
import { SessionProvider } from './lib/session-context.js';
import { AstryxCmcProvider, ToastProvider } from '@cmc/ui';
import { router } from './routes/index.js';
import { ErrorBoundary } from './lib/error-boundary.js';
import { generateErrorCode, reportError } from './lib/error-report.js';

// Client-side error capture — global handlers registered before first render.
// The browser cannot reach GlitchTip/Sentry directly (loopback), so errors are
// reported same-origin to POST /api/track-error (fail-open; reportError never
// throws). console.error stays for local debugging; the error code lets a user
// report and a dev grep the server logs (reqId pivot) for the same event.
window.addEventListener('error', (event) => {
  const message = event.message || 'Uncaught error';
  const code = generateErrorCode();
  reportError({
    code,
    message,
    stack: event.error instanceof Error ? event.error.stack : undefined,
    kind: 'window.onerror',
    extra: { filename: event.filename, lineno: event.lineno, colno: event.colno },
  });
  console.error(`[window.onerror] code=${code}`, event.message, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  const code = generateErrorCode();
  reportError({
    code,
    message,
    stack: reason instanceof Error ? reason.stack : undefined,
    kind: 'unhandledrejection',
    extra: rejectionExtra(reason),
  });
  console.error(`[unhandledrejection] code=${code}`, reason);
});

/** Best-effort JSON-safe rendition of a rejection reason for the report body. */
function rejectionExtra(reason: unknown): Record<string, unknown> | null {
  if (reason === undefined || reason === null || reason instanceof Error) return null;
  try {
    JSON.stringify(reason); // throws on circular/function values
    return { reason };
  } catch {
    return { reason: String(reason) };
  }
}

const queryClient = makeQueryClient();
const trpcClient = makeTrpcClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in document');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AstryxCmcProvider>
            <ToastProvider>
              <SessionProvider>
                <RouterProvider router={router} />
              </SessionProvider>
            </ToastProvider>
          </AstryxCmcProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  </StrictMode>,
);
