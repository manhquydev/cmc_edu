import type { ReactNode } from 'react';
import { LineIcon, type IconName } from './line-icon.js';

// Flat elevated panel (promoted from the cockpit pilot). White surface, hairline
// header with an optional monochrome icon, children below. Requires
// @cmc/ui/console.css (.console-pnl* classes).
export interface PanelProps {
  title: string;
  icon?: IconName;
  /** Right-side header control (link / badge). Replaces default icon when set. */
  action?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, icon, action, children }: PanelProps) {
  return (
    <div className="console-pnl">
      <div className="console-pnl-head">
        <span className="console-pnl-title">{title}</span>
        {action != null ? (
          <span className="console-pnl-action-slot">{action}</span>
        ) : (
          icon && (
            <span className="console-pnl-icon">
              <LineIcon name={icon} size={17} />
            </span>
          )
        )}
      </div>
      {children}
    </div>
  );
}
