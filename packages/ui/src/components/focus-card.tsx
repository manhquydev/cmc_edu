import { Link } from 'react-router-dom';
import { LineIcon } from './line-icon.js';
import { toneColor, type Tone } from './tone.js';

/**
 * Next-best-action surface — one primary focus, not a generic metric tile.
 * Soft left accent + kicker + CTA row. Requires @cmc/ui/premium.css (.ck-fc*).
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
      className="ck-fc"
      style={{ ['--ck-fc-accent' as string]: toneColor(tone) }}
    >
      <div className="ck-fc-body">
        <span className="ck-fc-kicker">{kicker}</span>
        <span className="ck-fc-title">{title}</span>
        {description ? <span className="ck-fc-desc">{description}</span> : null}
        {meta ? <span className="ck-fc-meta">{meta}</span> : null}
      </div>
      <span className="ck-fc-cta">
        {cta}
        <LineIcon name="chevron" size={15} />
      </span>
    </Link>
  );
}
