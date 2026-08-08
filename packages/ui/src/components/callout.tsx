import type { ReactNode } from 'react';
import { LineIcon, type IconName } from './line-icon.js';

/**
 * Soft inline callout — Shopify Highlight / Primer Callout style.
 * Lighter than Banner; for page-level tips, not form field errors.
 * Requires @cmc/ui/console.css (.console-callout*).
 */
export type CalloutTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface CalloutProps {
  title?: string;
  children: ReactNode;
  tone?: CalloutTone;
  icon?: IconName;
  /** Optional trailing action. */
  action?: ReactNode;
}

const TONE_ICON: Record<CalloutTone, IconName> = {
  info: 'alert',
  success: 'check-circle',
  warning: 'alert',
  danger: 'alert',
  neutral: 'layers',
};

export function Callout({
  title,
  children,
  tone = 'info',
  icon,
  action,
}: CalloutProps) {
  const iconName = icon ?? TONE_ICON[tone];
  return (
    <aside className={`console-callout console-callout--${tone}`} role="note">
      <span className="console-callout-icon" aria-hidden>
        <LineIcon name={iconName} size={18} />
      </span>
      <div className="console-callout-body">
        {title ? <div className="console-callout-title">{title}</div> : null}
        <div className="console-callout-text">{children}</div>
      </div>
      {action != null ? <div className="console-callout-action">{action}</div> : null}
    </aside>
  );
}
