// LMS session context — reads/writes localStorage, exposes kind discriminator.
//
// kind:'parent'  → parent session; studentId is undefined in header.
// kind:'student' → student session; studentId is required in header.
//
// The context does NOT call session.me (ERP-only); all identity info comes
// from the login response stored in localStorage.

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getStoredSession,
  storeSession,
  clearSession as clearStore,
  type StoredLmsSession,
} from './trpc.js';

interface LmsSessionCtx {
  session: StoredLmsSession | null;
  /** Call after a successful login to write the session to localStorage + state. */
  setSession: (session: StoredLmsSession) => void;
  /** Clears localStorage + state; redirect to /login handled by caller. */
  logout: () => void;
}

const LmsSessionContext = createContext<LmsSessionCtx>({
  session: null,
  setSession: () => {},
  logout: () => {},
});

export function LmsSessionProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage so page refresh preserves the session.
  const [session, setSessionState] = useState<StoredLmsSession | null>(getStoredSession);

  function setSession(s: StoredLmsSession): void {
    storeSession(s);
    setSessionState(s);
  }

  function logout(): void {
    clearStore();
    setSessionState(null);
  }

  return (
    <LmsSessionContext.Provider value={{ session, setSession, logout }}>
      {children}
    </LmsSessionContext.Provider>
  );
}

export function useSession(): LmsSessionCtx {
  return useContext(LmsSessionContext);
}
