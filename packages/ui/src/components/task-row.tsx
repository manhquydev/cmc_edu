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
}

export function TaskRow({ title, meta, href, tone }: TaskRowProps) {
  return (
    <Link to={href} className="ck-row">
      <span className="ck-dot" style={{ background: toneColor(tone) }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="ck-row-title" style={{ display: 'block' }}>{title}</span>
        <span className="ck-row-meta" style={{ display: 'block' }}>{meta}</span>
      </span>
      <span className="ck-chev"><LineIcon name="chevron" size={16} /></span>
    </Link>
  );
}
