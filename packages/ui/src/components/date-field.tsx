import { useId } from 'react';

/**
 * Shared date control for design3 admin (Odoo date-field lite).
 * Native `type="date"` with Odoo density tokens — no calendar library.
 */
export interface DateFieldProps {
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

export function DateField({
  label,
  value,
  onChange,
  isLabelHidden = false,
  id,
  disabled,
  size = 'sm',
  className,
}: DateFieldProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  return (
    <label
      className={['o-date-field', size === 'sm' ? 'o-date-field--sm' : '', className]
        .filter(Boolean)
        .join(' ')}
      htmlFor={inputId}
    >
      <span className={isLabelHidden ? 'o-date-field-label o-sr-only' : 'o-date-field-label'}>
        {label}
      </span>
      <input
        id={inputId}
        type="date"
        className="o-date-field-input"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
