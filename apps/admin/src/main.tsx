import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@cmc/ui/tokens.css';
// Astryx CSS + theme scope live alongside Mantine's through Phase 2-4 (both
// providers deliberately coexist — see plan.md); no reset.css here (that's
// app-scoped, added only once this app fully flips to Astryx in Phase 3).
import '@cmc/ui/astryx-theme-cmc.css';
import './app.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc, makeTrpcClient, makeQueryClient } from './lib/trpc.js';
import { SessionProvider } from './lib/session-context.js';
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
          <MantineProvider>
            <SessionProvider>
              <RouterProvider router={router} />
            </SessionProvider>
          </MantineProvider>
        </AstryxCmcProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
