import { Link } from 'react-router-dom';
import { LineIcon } from './line-icon.js';
import { toneColor, type Tone } from './tone.js';

// A single task/queue row (promoted from the cockpit pilot). `tone` colours ONLY
// the leading dot; title + meta stay default ink (locked principle). Requires
// @cmc/ui/console.css (.console-row* classes). Rows self-separate via the
// `.console-row + .console-row` hairline, so render siblings directly.
export interface TaskRowProps {
  title: string;
  meta: string;
  href: string;
  tone: Tone;
  /** Optional pill tag (e.g. "vượt ngưỡng", "O4"). */
  tag?: string;
}

export function TaskRow({ title, meta, href, tone, tag }: TaskRowProps) {
  return (
    <Link to={href} className="console-row" title={`${title} — ${meta}`}>
      <span className="console-dot" style={{ background: toneColor(tone) }} />
      <span className="console-row-main">
        <span className="console-row-title">{title}</span>
        <span className="console-row-meta">{meta}</span>
      </span>
      {tag ? <span className="console-row-tag">{tag}</span> : null}
      <span className="console-chev"><LineIcon name="chevron" size={16} /></span>
    </Link>
  );
}
