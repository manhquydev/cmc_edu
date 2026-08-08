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
    <div className="console-set-row">
      <div className="console-set-copy">
        <div className="console-set-label">{label}</div>
        {description ? <div className="console-set-desc">{description}</div> : null}
      </div>
      <div className="console-set-control">{control}</div>
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
 * Requires @cmc/ui/console.css (.console-set*).
 */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="console-set">
      <header className="console-set-head">
        <h3 className="console-set-title">{title}</h3>
        {description ? <p className="console-set-lead">{description}</p> : null}
      </header>
      <div className="console-set-body">{children}</div>
    </section>
  );
}
