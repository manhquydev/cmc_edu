import { Selector } from '@astryxdesign/core/Selector';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useSearchParams } from 'react-router-dom';

export interface FilterDef {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date';
  options?: { value: string; label: string }[];
  placeholder?: string;
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
    <div className="ck-filter-bar" role="search" aria-label="Bộ lọc">
      {filters.map((f) => {
        const val = currentValues[f.key] ?? '';
        if (f.type === 'select') {
          return (
            <div key={f.key} style={{ width: 160 }}>
              <Selector
                size="sm"
                label={f.label}
                placeholder={f.placeholder ?? 'Tất cả'}
                options={f.options ?? []}
                value={val || null}
                onChange={(v) => handleChange(f.key, v ?? '')}
                hasClear
              />
            </div>
          );
        }
        if (f.type === 'date') {
          return (
            <div key={f.key} style={{ width: 160 }}>
              <label className="ck-filter-date">
                <span className="ck-label-upper" style={{ display: 'block', marginBottom: 4 }}>
                  {f.label}
                </span>
                <input
                  type="date"
                  className="ck-filter-date-input"
                  aria-label={f.label}
                  value={val}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 'var(--cmc-radius-control)',
                    border: '1px solid var(--cmc-border)',
                    background: 'var(--cmc-surface-sunken)',
                    color: 'var(--cmc-text)',
                    fontSize: 13,
                    fontFamily: 'var(--cmc-font-sans)',
                  }}
                />
              </label>
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
