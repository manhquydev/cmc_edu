import { Link } from 'react-router-dom';
import { LineIcon } from './line-icon.js';

/**
 * Class / session tile with progressive field hierarchy.
 *
 * Density rules (education ops — research + progressive disclosure):
 * | Field      | Role                         | Compact (week)     | Default (month/list) |
 * |------------|------------------------------|--------------------|----------------------|
 * | timeLabel  | When                         | P0 short / hide    | P0 show, ellipsis ok |
 * | title      | What (class code)            | P0 always          | P0 always            |
 * | status     | Action urgency               | P0 chip            | P0 chip              |
 * | subtitle   | Program / course name        | P1 one foot line   | P1 dedicated line    |
 * | meta       | Room · teacher               | P2 foot or skip    | P2 dedicated line    |
 * | actionLabel| Primary CTA                  | P0 if href         | P0 if href           |
 *
 * Fixed slot geometry keeps cards aligned when text lengths differ.
 * Full strings always on `title` HTML attrs for hover / a11y.
 * Requires @cmc/ui/console.css (.console-sc*).
 */
export type SessionStatus =
  | 'planned'
  | 'active'
  | 'live'
  | 'done'
  | 'cancelled'
  | 'attention';

export interface SessionCardProps {
  /** P0 — class code / session name (always visible, single-line ellipsis). */
  title: string;
  /** P1 — program name (default: own line; compact: foot priority below). */
  subtitle?: string;
  /**
   * P0 when clock time ("08:00–09:30"); for long date ranges prefer omit on compact
   * and pass full range via `detail` for hover only.
   */
  timeLabel?: string;
  /** P2 — room · teacher (default line; compact may demote). */
  meta?: string;
  /**
   * Full secondary detail for tooltip only (e.g. long date range + teacher id).
   * Not rendered as body text — progressive disclosure.
   */
  detail?: string;
  status?: SessionStatus;
  href?: string;
  actionLabel?: string;
  density?: 'default' | 'compact';
  /**
   * Compact foot priority when both subtitle + meta exist.
   * - `actionable` (default): prefer meta (room/teacher) — ops need location
   * - `identity`: prefer subtitle (program)
   * - `both`: join with · (may ellipsis heavily)
   */
  footPriority?: 'actionable' | 'identity' | 'both';
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  planned: 'Sắp mở',
  active: 'Trong kỳ',
  live: 'Đang học',
  done: 'Xong',
  cancelled: 'Huỷ',
  attention: 'Chưa ĐD',
};

/** Compact foot line from hierarchy rules. */
export function resolveSessionFoot(
  subtitle: string | undefined,
  meta: string | undefined,
  density: 'default' | 'compact',
  footPriority: 'actionable' | 'identity' | 'both',
): { line1: string; line2: string; tooltip: string } {
  const sub = subtitle?.trim() ?? '';
  const m = meta?.trim() ?? '';
  const tooltip = [sub, m].filter(Boolean).join(' · ');

  if (density === 'default') {
    return { line1: sub || '\u00a0', line2: m || '\u00a0', tooltip };
  }

  // compact: single foot line
  if (footPriority === 'both' && sub && m) {
    return { line1: `${sub} · ${m}`, line2: '', tooltip };
  }
  if (footPriority === 'identity') {
    return { line1: sub || m || '\u00a0', line2: '', tooltip };
  }
  // actionable: room/teacher first, else program
  return { line1: m || sub || '\u00a0', line2: '', tooltip };
}

export function SessionCard({
  title,
  subtitle,
  timeLabel,
  meta,
  detail,
  status = 'active',
  href,
  actionLabel,
  density = 'default',
  footPriority = 'actionable',
}: SessionCardProps) {
  const cls = [
    'console-sc',
    `console-sc--${status}`,
    density === 'compact' ? 'is-compact' : 'is-default',
    href ? 'is-link' : '',
    !actionLabel ? 'no-cta' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const foot = resolveSessionFoot(subtitle, meta, density, footPriority);
  const hoverDetail = [detail, foot.tooltip].filter(Boolean).join(' · ') || undefined;

  const body = (
    <>
      {/* P0 time + status — never multi-line */}
      <div className="console-sc-top">
        <span className="console-sc-time" title={timeLabel || undefined}>
          {timeLabel ?? '\u00a0'}
        </span>
        <span className="console-sc-chip" title={STATUS_LABEL[status]}>
          <span className="console-sc-dot" aria-hidden />
          <span className="console-sc-chip-label">{STATUS_LABEL[status]}</span>
        </span>
      </div>

      {/* P0 identity */}
      <div className="console-sc-title" title={title}>
        {title}
      </div>

      {/* P1 / P2 secondary — default has 2 fixed lines; compact 1 */}
      <div className="console-sc-secondary" title={hoverDetail}>
        <div className="console-sc-line console-sc-line--p1">{foot.line1}</div>
        {density === 'default' ? (
          <div className="console-sc-line console-sc-line--p2">{foot.line2}</div>
        ) : null}
      </div>

      {/* CTA or equal spacer */}
      <div className="console-sc-cta-slot">
        {href && actionLabel ? (
          <span className="console-sc-cta">
            <span className="console-sc-cta-label">{actionLabel}</span>
            <LineIcon name="chevron" size={12} />
          </span>
        ) : (
          <span className="console-sc-cta-spacer" aria-hidden />
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link to={href} className={cls} title={hoverDetail ? `${title} — ${hoverDetail}` : title}>
        {body}
      </Link>
    );
  }
  return (
    <div className={cls} title={hoverDetail ? `${title} — ${hoverDetail}` : title}>
      {body}
    </div>
  );
}
