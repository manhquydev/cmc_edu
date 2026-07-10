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
// Premium composite styles — shared design-language base (LMS warm variant is
// a later phase; the base composites/tokens are shared now).
import '@cmc/ui/premium.css';
import './app.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc, makeTrpcClient, makeQueryClient } from './lib/trpc.js';
import { LmsSessionProvider } from './lib/session-context.js';
import { AstryxCmcProvider } from '@cmc/ui';
import { router } from './routes/index.js';

const queryClient = makeQueryClient();
const trpcClient = makeTrpcClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in document');
}

createRoot(rootElement).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AstryxCmcProvider>
          <LmsSessionProvider>
            <RouterProvider router={router} />
          </LmsSessionProvider>
        </AstryxCmcProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
