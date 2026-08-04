import { Link } from 'react-router-dom';
import { LineIcon } from './line-icon.js';
import { toneColor, type Tone } from './tone.js';

// A single task/queue row (promoted from the cockpit pilot). `tone` colours ONLY
// the leading dot; title + meta stay default ink (locked principle). Requires
// @cmc/ui/premium.css (.ck-row* classes). Rows self-separate via the
// `.ck-row + .ck-row` hairline, so render siblings directly.
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
    <Link to={href} className="ck-row" title={`${title} — ${meta}`}>
      <span className="ck-dot" style={{ background: toneColor(tone) }} />
      <span className="ck-row-main">
        <span className="ck-row-title">{title}</span>
        <span className="ck-row-meta">{meta}</span>
      </span>
      {tag ? <span className="ck-row-tag">{tag}</span> : null}
      <span className="ck-chev"><LineIcon name="chevron" size={16} /></span>
    </Link>
  );
}
