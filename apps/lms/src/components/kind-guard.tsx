// kind-guard.tsx — route-level kind discriminator guards (C5).
//
// ParentOnly: parent/family sessions; family + mustChangePassword → rotate page.
// StudentOnly: kind:'student' only. Both read useSession (flag lives there).
//
// Both components are intentionally thin — no Suspense, no Loader — because
// they wrap layout-level <Outlet /> elements that already carry Suspense.

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isParentDoorKind } from '../lib/lms-kind.js';
import { useSession } from '../lib/session-context.js';

export function ParentOnly({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (!session || !isParentDoorKind(session.kind)) return <Navigate to="/login" replace />;
  if (session.kind === 'family' && session.mustChangePassword === true) {
    return <Navigate to="/doi-mat-khau-gia-dinh" replace />;
  }
  return <>{children}</>;
}

export function StudentOnly({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (!session || session.kind !== 'student') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
