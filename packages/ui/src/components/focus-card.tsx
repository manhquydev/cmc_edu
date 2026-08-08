import { Link } from 'react-router-dom';
import { LineIcon } from './line-icon.js';
import { toneColor, type Tone } from './tone.js';

/**
 * Next-best-action surface — one primary focus, not a generic metric tile.
 * Soft left accent + kicker + CTA row. Requires @cmc/ui/console.css (.console-fc*).
 */
export interface FocusCardProps {
  /** Uppercase quiet kicker e.g. "Việc ưu tiên" */
  kicker: string;
  title: string;
  description?: string;
  href: string;
  cta: string;
  meta?: string;
  tone?: Tone;
}

export function FocusCard({
  kicker,
  title,
  description,
  href,
  cta,
  meta,
  tone = 'brand',
}: FocusCardProps) {
  return (
    <Link
      to={href}
      className="console-fc"
      style={{ ['--console-fc-accent' as string]: toneColor(tone) }}
    >
      <div className="console-fc-body">
        <span className="console-fc-kicker">{kicker}</span>
        <span className="console-fc-title">{title}</span>
        {description ? <span className="console-fc-desc">{description}</span> : null}
        {meta ? <span className="console-fc-meta">{meta}</span> : null}
      </div>
      <span className="console-fc-cta">
        {cta}
        <LineIcon name="chevron" size={15} />
      </span>
    </Link>
  );
}
