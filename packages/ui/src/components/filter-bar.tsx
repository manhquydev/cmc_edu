import { Selector } from '@astryxdesign/core/Selector';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useSearchParams } from 'react-router-dom';
import { DateField } from './date-field.js';

export interface FilterDef {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date';
  options?: { value: string; label: string }[];
  placeholder?: string;
  /**
   * Select only. When false, hides the clear (×) control so empty cannot
   * fight a page default domain (e.g. pipeline lost=`exclude`). Default true —
   * empty + placeholder means “all” per G1 Search playbook.
   */
  hasClear?: boolean;
}

export interface FilterBarProps {
  filters: FilterDef[];
  /** External override value — when omitted, FilterBar reads/writes URL query params. */
  value?: Record<string, string>;
  onChange?: (next: Record<string, string>) => void;
}

/**
 * Controlled filter row that mirrors its state to/from URL query parameters.
 * When `value` and `onChange` are provided they take precedence (fully controlled).
 * When omitted the component reads initial values from `useSearchParams` and
 * writes changes back to the URL — making the page deep-linkable by default.
 */
export function FilterBar({ filters, value: externalValue, onChange: externalOnChange }: FilterBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentValues: Record<string, string> = externalValue
    ? externalValue
    : Object.fromEntries(filters.map((f) => [f.key, searchParams.get(f.key) ?? '']));

  function handleChange(key: string, val: string) {
    const next = { ...currentValues, [key]: val };
    if (externalOnChange) {
      externalOnChange(next);
    } else {
      const params = new URLSearchParams(searchParams);
      if (val) {
        params.set(key, val);
      } else {
        params.delete(key);
      }
      setSearchParams(params, { replace: true });
    }
  }

  return (
    <div className="o-filter-bar" role="search" aria-label="Bộ lọc">
      {filters.map((f) => {
        const val = currentValues[f.key] ?? '';
        if (f.type === 'select') {
          const allowClear = f.hasClear !== false;
          const opts = f.options ?? [];
          // Astryx: nullable value requires hasClear:true. Default-domain
          // selects (hasClear:false) keep a non-null selected option.
          if (allowClear) {
            return (
              <div key={f.key} style={{ width: 160 }}>
                <Selector
                  size="sm"
                  label={f.label}
                  placeholder={f.placeholder ?? 'Tất cả'}
                  options={opts}
                  value={val || null}
                  onChange={(v: string | null) => handleChange(f.key, v ?? '')}
                  hasClear
                />
              </div>
            );
          }
          const nonNullValue = val || opts[0]?.value || '';
          return (
            <div key={f.key} style={{ width: 160 }}>
              <Selector
                size="sm"
                label={f.label}
                placeholder={f.placeholder ?? 'Tất cả'}
                options={opts}
                value={nonNullValue}
                onChange={(v: string) => handleChange(f.key, v)}
              />
            </div>
          );
        }
        if (f.type === 'date') {
          return (
            <div key={f.key} style={{ width: 160 }}>
              <DateField
                id={`o-filter-${f.key}`}
                label={f.label}
                value={val}
                onChange={(v) => handleChange(f.key, v)}
                size="sm"
              />
            </div>
          );
        }
        return (
          <div key={f.key} style={{ width: 180 }}>
            <TextInput
              size="sm"
              label={f.label}
              placeholder={f.placeholder ?? f.label}
              value={val}
              onChange={(v) => handleChange(f.key, v)}
            />
          </div>
        );
      })}
    </div>
  );
}
