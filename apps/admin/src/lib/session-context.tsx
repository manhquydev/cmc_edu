import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { trpc } from './trpc.js';
import { can } from '@cmc/auth';
import type { Role } from '@cmc/auth';

export interface SessionMe {
  userId: string;
  roles: readonly Role[];
  facilityId: string;
  config: { approvalSecondEyeThreshold: number };
  mustChangePassword: boolean;
}

interface SessionCtx {
  me: SessionMe | null;
  isLoading: boolean;
  /** Client-side RBAC mirror. Server gate remains authoritative for security. */
  canDo: (module: string, action: string) => boolean;
}

const SessionContext = createContext<SessionCtx>({
  me: null,
  isLoading: true,
  canDo: () => false,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = trpc.session.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,
  });

  function canDo(module: string, action: string): boolean {
    if (!me) return false;
    return can({ userId: me.userId, roles: me.roles as Role[] }, module, action);
  }

  return (
    <SessionContext.Provider value={{ me: me ?? null, isLoading, canDo }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionCtx {
  return useContext(SessionContext);
}
