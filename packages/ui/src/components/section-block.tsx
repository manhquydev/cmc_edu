import type { ReactNode } from 'react';

/**
 * Form / detail section — title + optional description + body.
 * Groups fields without inventing a third card chrome on FormPage.
 * Requires @cmc/ui/premium.css (.ck-sec*).
 */
export interface SectionBlockProps {
  title: string;
  description?: string;
  /** Right-side control (edit link, badge). */
  action?: ReactNode;
  children: ReactNode;
  /** Raised card shell (default true). Flat = bare stack for nested use. */
  raised?: boolean;
}

export function SectionBlock({
  title,
  description,
  action,
  children,
  raised = true,
}: SectionBlockProps) {
  return (
    <section className={raised ? 'ck-sec ck-sec--raised' : 'ck-sec'}>
      <header className="ck-sec-head">
        <div className="ck-sec-titles">
          <h3 className="ck-sec-title">{title}</h3>
          {description ? <p className="ck-sec-desc">{description}</p> : null}
        </div>
        {action != null ? <div className="ck-sec-action">{action}</div> : null}
      </header>
      <div className="ck-sec-body">{children}</div>
    </section>
  );
}
