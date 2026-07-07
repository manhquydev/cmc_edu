// kind-guard.tsx — route-level kind discriminator guards (C5).
//
// ParentOnly: renders children only for kind:'parent' sessions;
//             redirects students and unauthenticated visitors to /login.
// StudentOnly: renders children only for kind:'student' sessions;
//              redirects parents and unauthenticated visitors to /login.
//
// Both components are intentionally thin — no Suspense, no Loader — because
// they wrap layout-level <Outlet /> elements that already carry Suspense.

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useLmsSession } from '../lib/lms-session.js';

export function ParentOnly({ children }: { children: ReactNode }) {
  const { session } = useLmsSession();
  if (!session || session.kind !== 'parent') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function StudentOnly({ children }: { children: ReactNode }) {
  const { session } = useLmsSession();
  if (!session || session.kind !== 'student') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
