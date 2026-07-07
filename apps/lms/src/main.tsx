import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@cmc/ui/tokens.css';
import './app.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc, makeTrpcClient, makeQueryClient } from './lib/trpc.js';
import { LmsSessionProvider } from './lib/session-context.js';
import { cmcTheme } from '@cmc/ui';
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
        <MantineProvider theme={cmcTheme}>
          <LmsSessionProvider>
            <RouterProvider router={router} />
          </LmsSessionProvider>
        </MantineProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
