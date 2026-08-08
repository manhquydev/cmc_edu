import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LineIcon, type IconName } from './line-icon.js';

/** Compact nav chip for dashboard shortcut strips — same look every role. */
export interface ShortcutChipProps {
  label: string;
  href: string;
  icon?: IconName;
  /** Optional trailing badge (count). */
  badge?: ReactNode;
}

export function ShortcutChip({ label, href, icon, badge }: ShortcutChipProps) {
  return (
    <Link to={href} className="console-dash-chip">
      {icon ? (
        <span className="console-dash-chip-icon">
          <LineIcon name={icon} size={16} />
        </span>
      ) : null}
      <span className="console-dash-chip-label">{label}</span>
      {badge != null && badge !== '' ? <span className="console-dash-chip-badge">{badge}</span> : null}
    </Link>
  );
}
