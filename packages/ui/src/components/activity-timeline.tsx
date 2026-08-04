import type { ReactNode } from 'react';
import { toneColor, type Tone } from './tone.js';

export interface ActivityItem {
  id: string;
  title: string;
  meta?: string;
  /** ISO or human time string. */
  time?: string;
  tone?: Tone;
  /** Optional trailing node (badge, link). */
  trailing?: ReactNode;
}

/**
 * Vertical activity / audit trail — CRM aftersale, receipt history.
 * Primer-ish density with CMC warm hairlines.
 * Requires @cmc/ui/premium.css (.ck-tl*).
 */
export interface ActivityTimelineProps {
  items: ActivityItem[];
  empty?: ReactNode;
}

export function ActivityTimeline({ items, empty }: ActivityTimelineProps) {
  if (items.length === 0) {
    return empty ? <div className="ck-tl-empty">{empty}</div> : null;
  }
  return (
    <ol className="ck-tl">
      {items.map((item, i) => (
        <li key={item.id} className="ck-tl-item">
          <span
            className="ck-tl-rail"
            aria-hidden
          >
            <span
              className="ck-tl-dot"
              style={{ background: toneColor(item.tone ?? 'brand') }}
            />
            {i < items.length - 1 ? <span className="ck-tl-line" /> : null}
          </span>
          <div className="ck-tl-body">
            <div className="ck-tl-head">
              <span className="ck-tl-title">{item.title}</span>
              {item.time ? <time className="ck-tl-time">{item.time}</time> : null}
            </div>
            {item.meta ? <div className="ck-tl-meta">{item.meta}</div> : null}
            {item.trailing ? <div className="ck-tl-trailing">{item.trailing}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
