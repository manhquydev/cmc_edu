import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
// Astryx reset flip (plan Phase 4 step 4): lms now renders zero legacy-UI
// components, so its provider + styles are dropped here (the legacy UI-library
// package deps stay in package.json until Phase 5 per rollback policy — only
// the runtime usage is removed, avoiding a double-reset). main.tsx is the one
// whitelisted entry allowed to import CSS/reset directly; reset.css is
// app-scoped and NOT in @cmc/ui (red-team F14). Order: reset → tokens →
// astryx theme (astryx.css + theme.css via astryx-theme-cmc.css) → app.
import '@astryxdesign/core/reset.css';
// Inter Variable (self-hosted, no external fetch) — shared design-language font,
// mirrors apps/admin ordering (after reset, before tokens) so --cmc-font-sans
// resolves to a loaded face.
import '@fontsource-variable/inter';
import '@cmc/ui/tokens.css';
import '@cmc/ui/astryx-theme-cmc.css';
import './app.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc, makeTrpcClient, makeQueryClient } from './lib/trpc.js';
import { LmsSessionProvider } from './lib/session-context.js';
import { AstryxCmcProvider } from '@cmc/ui';
import { ErrorBoundary } from './lib/error-boundary.js';
import { generateErrorCode, reportError } from './lib/error-report.js';
import { router } from './routes/index.js';

const queryClient = makeQueryClient();
const trpcClient = makeTrpcClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in document');
}

// --- client-side error capture (same-origin report to /api/track-error) ---
// Installed before render so early runtime errors are captured too. Every
// handler reports through reportError() (deduped, fire-and-forget) and keeps
// console.error for local debugging. React render crashes are caught by the
// <ErrorBoundary> below; event-handler and async errors land here.

window.addEventListener('error', (event) => {
  const code = generateErrorCode();
  const message = event.message || 'Unknown script error';
  console.error(
    '[window.onerror]',
    code,
    message,
    event.error ?? '',
    event.filename,
    'line ' + event.lineno + ':' + event.colno,
  );
  reportError({
    code,
    message,
    stack: event.error instanceof Error ? event.error.stack ?? null : null,
    kind: 'window.onerror',
    extra: {
      filename: event.filename || null,
      line: event.lineno ?? null,
      col: event.colno ?? null,
    },
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const code = generateErrorCode();
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error('[unhandledrejection]', code, reason);
  reportError({
    code,
    message,
    stack: reason instanceof Error ? reason.stack ?? null : null,
    kind: 'unhandledrejection',
    extra: reason instanceof Error ? null : { reason: String(reason) },
  });
});

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AstryxCmcProvider>
            <LmsSessionProvider>
              <RouterProvider router={router} />
            </LmsSessionProvider>
          </AstryxCmcProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  </StrictMode>,
);
