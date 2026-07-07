// lms-session.tsx — spec-required session interface.
//
// Provides LmsSessionContext, useLmsSession, parseLmsToken.
// useLmsSession delegates to useSession (session-context.tsx) so both hook
// names read from the same LmsSessionProvider already mounted in main.tsx.
// LmsSessionContext is exported to satisfy the acceptance criteria; the live
// context tree uses the one created inside session-context.tsx.

import { createContext, useContext } from 'react';
import { useSession } from './session-context.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LmsSession {
  parentAccountId: string;
  kind: 'parent' | 'student';
  studentId?: string;
}

interface LmsSessionCtxSpec {
  session: LmsSession | null;
  /** Store a base64url session token and update context. */
  setToken: (token: string) => void;
  clearSession: () => void;
  isParent: boolean;
  isStudent: boolean;
}

// ---------------------------------------------------------------------------
// parseLmsToken
// ---------------------------------------------------------------------------

/**
 * Decodes a base64url-encoded session token into an LmsSession.
 * Uses browser atob() — no Node Buffer dependency.
 */
export function parseLmsToken(token: string): LmsSession | null {
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as unknown;
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    const parentAccountId = p['parentAccountId'];
    const kind = p['kind'];
    const studentId = p['studentId'];
    if (typeof parentAccountId !== 'string' || !parentAccountId) return null;
    if (kind !== 'parent' && kind !== 'student') return null;
    return {
      parentAccountId,
      kind,
      studentId: typeof studentId === 'string' ? studentId : undefined,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Context (exported for spec compliance; runtime value comes from useSession)
// ---------------------------------------------------------------------------

export const LmsSessionContext = createContext<LmsSessionCtxSpec>({
  session: null,
  setToken: () => {},
  clearSession: () => {},
  isParent: false,
  isStudent: false,
});

// ---------------------------------------------------------------------------
// useLmsSession
// ---------------------------------------------------------------------------

/**
 * Returns the LMS session in the spec-required shape.
 * Delegates to useSession so it works within the LmsSessionProvider already
 * mounted in main.tsx — no separate provider needed.
 */
export function useLmsSession(): LmsSessionCtxSpec {
  const { session: stored, setSession, logout } = useSession();

  const session: LmsSession | null = stored
    ? {
        parentAccountId: stored.parentAccountId,
        kind: stored.kind,
        studentId: stored.studentId,
      }
    : null;

  function setToken(token: string): void {
    const parsed = parseLmsToken(token);
    if (!parsed) return;
    setSession({
      kind: parsed.kind,
      parentAccountId: parsed.parentAccountId,
      studentId: parsed.studentId,
      sessionToken: token,
    });
  }

  return {
    session,
    setToken,
    clearSession: logout,
    isParent: stored?.kind === 'parent',
    isStudent: stored?.kind === 'student',
  };
}

// LmsSessionContext is read by useLmsSession consumers that opt in to the
// stand-alone context tree (not used by the main app which uses useSession).
export function useLmsSessionContext(): LmsSessionCtxSpec {
  return useContext(LmsSessionContext);
}
