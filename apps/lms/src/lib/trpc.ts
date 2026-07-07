// LMS tRPC client — uses x-dev-lms-user header (JSON) from localStorage.
// The header shape { parentAccountId, studentId?, kind } is read on every
// request so post-login navigation picks up the new session automatically.
//
// IMPORTANT: This is a dev-header stub. In production, a real session
// (JWT/cookie) must replace it before launch.

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

export const LMS_SESSION_KEY = 'cmc_lms_session';

/** Stored in localStorage after a successful login. */
export interface StoredLmsSession {
  kind: 'parent' | 'student';
  parentAccountId: string;
  /** Set for student sessions. Undefined for parent sessions (no profile selected yet). */
  studentId?: string;
  /** Returned by verifyOtp / verifyOtpEmail — stored so parent/home can list children. */
  children?: Array<{ studentId: string; fullName: string }>;
  sessionToken: string;
  /** Student must change default password before proceeding. */
  mustChangePassword?: boolean;
}

export function getStoredSession(): StoredLmsSession | null {
  try {
    const raw = localStorage.getItem(LMS_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredLmsSession;
  } catch {
    return null;
  }
}

export function storeSession(session: StoredLmsSession): void {
  localStorage.setItem(LMS_SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(LMS_SESSION_KEY);
}

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        headers() {
          const session = getStoredSession();
          if (!session) return {};
          // Build the x-dev-lms-user header; only include studentId when present.
          const lmsUser: Record<string, string> = {
            parentAccountId: session.parentAccountId,
            kind: session.kind,
          };
          if (session.studentId) {
            lmsUser['studentId'] = session.studentId;
          }
          return { 'x-dev-lms-user': JSON.stringify(lmsUser) };
        },
      }),
    ],
  });
}
