// LMS tRPC client — sends the HMAC-signed session token (RT-1 / PD-1) as a
// standard Authorization: Bearer header. The token is stored in localStorage
// after a successful lmsAuth.verifyOtp / verifyOtpEmail / loginStudent call
// and is read on every request so post-login navigation picks up the active
// session automatically.

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { QueryClient } from '@tanstack/react-query';
import type { AppRouter } from '@cmc/api';
import type { LmsSessionKind } from './lms-kind.js';

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
export const ACTIVE_STUDENT_KEY = 'cmc_lms_activeStudentId';

export interface StoredLmsSession {
  kind: LmsSessionKind;
  parentAccountId: string;
  /** Set for student sessions. Undefined for parent sessions (no profile selected yet). */
  studentId?: string;
  /** Returned by verifyOtp / verifyOtpEmail — stored so parent/home can list children. */
  children?: Array<{ studentId: string; fullName: string }>;
  sessionToken: string;
  /** Student default password, or family insert-default hash, must rotate. */
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
  localStorage.removeItem(ACTIVE_STUDENT_KEY);
}

export function getActiveStudentId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_STUDENT_KEY);
  } catch {
    return null;
  }
}

export function setActiveStudentId(studentId: string): void {
  localStorage.setItem(ACTIVE_STUDENT_KEY, studentId);
}

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        headers() {
          const session = getStoredSession();
          if (!session?.sessionToken) return {};
          // RT-1 / PD-1: send HMAC-signed bearer token instead of the
          // unsigned x-dev-lms-user JSON header. The token already encodes
          // parentAccountId, studentId, and kind — the server decodes it via
          // verifyLmsToken in context.ts.
          return { authorization: `Bearer ${session.sessionToken}` };
        },
      }),
    ],
  });
}
