import { useId } from 'react';

/**
 * Shared date+time control for design3 admin (Odoo datetime-field lite).
 * Native `type="datetime-local"` with Odoo density tokens — no picker library.
 */
export interface DateTimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Hide the visible label (still sets aria-label). */
  isLabelHidden?: boolean;
  /** Stable id for label association (prefer filter key). Falls back to useId(). */
  id?: string;
  /** Disable the control. */
  disabled?: boolean;
  /** Compact width for filter rows (default true for filter use). */
  size?: 'sm' | 'md';
  className?: string;
}

export function DateTimeField({
  label,
  value,
  onChange,
  isLabelHidden = false,
  id,
  disabled,
  size = 'sm',
  className,
}: DateTimeFieldProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  return (
    <label
      className={['console-date-field', size === 'sm' ? 'console-date-field--sm' : '', className]
        .filter(Boolean)
        .join(' ')}
      htmlFor={inputId}
    >
      <span className={isLabelHidden ? 'console-date-field-label console-sr-only' : 'console-date-field-label'}>
        {label}
      </span>
      <input
        id={inputId}
        type="datetime-local"
        className="console-date-field-input"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
