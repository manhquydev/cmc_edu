import type { ReactNode } from 'react';

/**
 * Form / detail section — title + optional description + body.
 * Groups fields without inventing a third card chrome on FormPage.
 * Requires @cmc/ui/console.css (.console-sec*).
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
    <section className={raised ? 'console-sec console-sec--raised' : 'console-sec'}>
      <header className="console-sec-head">
        <div className="console-sec-titles">
          <h3 className="console-sec-title">{title}</h3>
          {description ? <p className="console-sec-desc">{description}</p> : null}
        </div>
        {action != null ? <div className="console-sec-action">{action}</div> : null}
      </header>
      <div className="console-sec-body">{children}</div>
    </section>
  );
}
