import type { ReactNode } from 'react';

export interface SettingsRowProps {
  label: string;
  description?: string;
  /** Right control: switch, selector, button. */
  control: ReactNode;
}

/** Single settings row — label stack + control. */
export function SettingsRow({ label, description, control }: SettingsRowProps) {
  return (
    <div className="ck-set-row">
      <div className="ck-set-copy">
        <div className="ck-set-label">{label}</div>
        {description ? <div className="ck-set-desc">{description}</div> : null}
      </div>
      <div className="ck-set-control">{control}</div>
    </div>
  );
}

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Settings / admin preference block (Polaris-style settings layout).
 * Requires @cmc/ui/premium.css (.ck-set*).
 */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="ck-set">
      <header className="ck-set-head">
        <h3 className="ck-set-title">{title}</h3>
        {description ? <p className="ck-set-lead">{description}</p> : null}
      </header>
      <div className="ck-set-body">{children}</div>
    </section>
  );
}
