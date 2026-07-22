import type { ReactNode } from 'react';
import { EmptyState, LineIcon, PageHeader } from '@cmc/ui';
import { useSession } from './session-context.js';

// Screens reachable by typing a URL need their own check: hiding a menu entry
// is not access control, and several admin screens have no menu entry at all.
// The API still refuses the call either way — this decides whether the user
// sees a plain "no access" page or a broken shell whose queries all 403.
//
// The same block was hand-copied across a growing number of screens; this is
// that block, once.

interface PermissionGateProps {
  module: string;
  action: string;
  /** Shown in the header and breadcrumb so a blocked page still says where it is. */
  title: string;
  breadcrumbs?: { label: string }[];
  /** Names the permission in the message, so the reason is diagnosable without
   *  reading the registry. */
  requirementLabel: string;
  children: ReactNode;
}

export function PermissionGate({
  module,
  action,
  title,
  breadcrumbs,
  requirementLabel,
  children,
}: PermissionGateProps) {
  const { canDo } = useSession();

  if (!canDo(module, action)) {
    return (
      <>
        <PageHeader title={title} breadcrumbs={breadcrumbs} />
        <EmptyState
          title="Không có quyền truy cập"
          description={`Trang này yêu cầu quyền ${requirementLabel}.`}
          icon={<LineIcon name="shield" size={28} />}
        />
      </>
    );
  }

  return <>{children}</>;
}
