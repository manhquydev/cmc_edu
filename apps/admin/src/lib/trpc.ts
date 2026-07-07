import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { QueryClient } from '@tanstack/react-query';
import type { AppRouter } from '@cmc/api';

export const trpc = createTRPCReact<AppRouter>();

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1 },
    },
  });
}

const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

/** Reads dev-user impersonation JSON from localStorage (dev only). */
export function getDevUserHeader(): string | null {
  try {
    return localStorage.getItem('cmc_dev_user');
  } catch {
    return null;
  }
}

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        // credentials: 'include' required for cookie-based SSO (Entra, P0-debt).
        // tRPC v11 passes credentials through the fetch wrapper.
        fetch(url, options) {
          return fetch(url, { ...options, credentials: 'include' });
        },
        headers() {
          if (import.meta.env.PROD) return {};
          const devUser = getDevUserHeader();
          return devUser ? { 'x-dev-user': devUser } : {};
        },
      }),
    ],
  });
}
