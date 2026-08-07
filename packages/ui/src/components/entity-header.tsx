import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LineIcon } from './line-icon.js';

/**
 * Detail-page entity chrome — identity + status + primary actions.
 * Complements PageHeader when you need avatar/initials + meta chips.
 * Requires @cmc/ui/console.css (.console-eh*).
 */
export interface EntityHeaderProps {
  title: string;
  subtitle?: string;
  /** One or two letter mark when no avatar. */
  initials?: string;
  /** Status badge / chips slot. */
  badges?: ReactNode;
  /** Primary/secondary actions. */
  actions?: ReactNode;
  /** Optional back link. */
  backHref?: string;
  backLabel?: string;
  meta?: ReactNode;
}

export function EntityHeader({
  title,
  subtitle,
  initials,
  badges,
  actions,
  backHref,
  backLabel = 'Quay lại',
  meta,
}: EntityHeaderProps) {
  const mark = initials ?? title.trim().slice(0, 1).toUpperCase();
  return (
    <header className="console-eh">
      {backHref ? (
        <Link to={backHref} className="console-eh-back">
          <LineIcon name="chevron" size={14} />
          {backLabel}
        </Link>
      ) : null}
      <div className="console-eh-main">
        <div className="console-eh-avatar" aria-hidden>
          {mark}
        </div>
        <div className="console-eh-id">
          <div className="console-eh-title-row">
            <h1 className="console-eh-title">{title}</h1>
            {badges ? <div className="console-eh-badges">{badges}</div> : null}
          </div>
          {subtitle ? <p className="console-eh-sub">{subtitle}</p> : null}
          {meta ? <div className="console-eh-meta">{meta}</div> : null}
        </div>
        {actions ? <div className="console-eh-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
