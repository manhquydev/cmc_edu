import { HStack } from '@astryxdesign/core/Stack';
import { Selector } from '@astryxdesign/core/Selector';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useSearchParams } from 'react-router-dom';

export interface FilterDef {
  key: string;
  label: string;
  type: 'text' | 'select';
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

  // Derive current values: external overrides URL, URL is the fallback.
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
    <HStack
      gap={1}
      paddingInline={3}
      paddingBlock={2}
      wrap="wrap"
      style={{ background: 'var(--cmc-surface-2)', borderBottom: '1px solid var(--cmc-border)' }}
    >
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
    </HStack>
  );
}
