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
 * Requires @cmc/ui/console.css (.console-tl*).
 */
export interface ActivityTimelineProps {
  items: ActivityItem[];
  empty?: ReactNode;
}

export function ActivityTimeline({ items, empty }: ActivityTimelineProps) {
  if (items.length === 0) {
    return empty ? <div className="console-tl-empty">{empty}</div> : null;
  }
  return (
    <ol className="console-tl">
      {items.map((item, i) => (
        <li key={item.id} className="console-tl-item">
          <span
            className="console-tl-rail"
            aria-hidden
          >
            <span
              className="console-tl-dot"
              style={{ background: toneColor(item.tone ?? 'brand') }}
            />
            {i < items.length - 1 ? <span className="console-tl-line" /> : null}
          </span>
          <div className="console-tl-body">
            <div className="console-tl-head">
              <span className="console-tl-title">{item.title}</span>
              {item.time ? <time className="console-tl-time">{item.time}</time> : null}
            </div>
            {item.meta ? <div className="console-tl-meta">{item.meta}</div> : null}
            {item.trailing ? <div className="console-tl-trailing">{item.trailing}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
