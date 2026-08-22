import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { links, UUID_RE, type LinkEntity } from '@cmc/links';

export interface RecordLinkProps {
  entity: LinkEntity;
  id?: string | null;
  children?: ReactNode;
  label?: ReactNode;
  /** UX-only: hide the href when the viewer would hit a dead 403. Not an authz boundary. */
  canView?: boolean;
}

/**
 * Presentational hop to a first-class record. Renders a react-router Link
 * via `links[entity](id)` when `id` is a UUID and `canView !== false`;
 * otherwise the label stays plain text. Not an authorization boundary.
 */
export function RecordLink({ entity, id, children, label, canView }: RecordLinkProps) {
  const text = children ?? label ?? null;
  const href =
    typeof id === 'string' && UUID_RE.test(id) && canView !== false
      ? links[entity](id)
      : null;
  if (href == null) return <>{text}</>;
  return <Link to={href}>{text}</Link>;
}
