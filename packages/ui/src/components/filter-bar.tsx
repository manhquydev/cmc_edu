import { Selector } from '@astryxdesign/core/Selector';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DateField } from './date-field.js';
import { LineIcon } from './line-icon.js';

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

function optionLabel(filter: FilterDef, val: string): string {
  return filter.options?.find((o) => o.value === val)?.label ?? val;
}

function renderExtraField(
  f: FilterDef,
  val: string,
  onChange: (key: string, next: string) => void,
) {
  const wrapClass =
    f.type === 'text' ? 'console-filter-field console-filter-field--text' : 'console-filter-field';
  if (f.type === 'select') {
    const allowClear = f.hasClear !== false;
    const opts = f.options ?? [];
    if (allowClear) {
      return (
        <div key={f.key} className={wrapClass}>
          <Selector
            size="sm"
            label={f.label}
            placeholder={f.placeholder ?? 'Tất cả'}
            options={opts}
            value={val || null}
            onChange={(v: string | null) => onChange(f.key, v ?? '')}
            hasClear
          />
        </div>
      );
    }
    const nonNullValue = val || opts[0]?.value || '';
    return (
      <div key={f.key} className={wrapClass}>
        <Selector
          size="sm"
          label={f.label}
          placeholder={f.placeholder ?? 'Tất cả'}
          options={opts}
          value={nonNullValue}
          onChange={(v: string) => onChange(f.key, v)}
        />
      </div>
    );
  }
  if (f.type === 'date') {
    return (
      <div key={f.key} className={wrapClass}>
        <DateField
          id={`console-filter-${f.key}`}
          label={f.label}
          value={val}
          onChange={(v) => onChange(f.key, v)}
          size="sm"
        />
      </div>
    );
  }
  return (
    <div key={f.key} className={wrapClass}>
      <input
        className="console-search-input"
        aria-label={f.label}
        placeholder={f.placeholder ?? f.label}
        value={val}
        onChange={(e) => onChange(f.key, e.target.value)}
      />
    </div>
  );
}

/**
 * Odoo-style search chrome: magnifier + text + gray facet chips + Filters caret.
 * Props still mirror URL / controlled `value`+`onChange` (G1 deep-link).
 */
export function FilterBar({ filters, value: externalValue, onChange: externalOnChange }: FilterBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const textFilters = filters.filter((f) => f.type === 'text');
  const searchFilter = textFilters[0];
  const extraText = textFilters.slice(1);
  const nonText = filters.filter((f) => f.type !== 'text');
  const pinnedFilters = [...extraText, ...nonText.filter((f) => f.hasClear === false)];
  const menuFilters = nonText.filter((f) => f.hasClear !== false);
  const facets = menuFilters.filter((f) => Boolean(currentValues[f.key]));

  return (
    <div className="console-filter-bar" role="search" aria-label="Bộ lọc">
      <div className="console-search-box">
        <span className="console-search-icon" aria-hidden>
          <LineIcon name="search" size={14} strokeWidth={2} />
        </span>
        {searchFilter ? (
          <input
            className="console-search-input"
            aria-label={searchFilter.label}
            placeholder={searchFilter.placeholder ?? 'Search...'}
            value={currentValues[searchFilter.key] ?? ''}
            onChange={(e) => handleChange(searchFilter.key, e.target.value)}
          />
        ) : (
          <span className="console-search-input" aria-hidden />
        )}
        {pinnedFilters.map((f) =>
          renderExtraField(f, currentValues[f.key] ?? '', handleChange),
        )}
        {facets.map((f) => {
          const val = currentValues[f.key] ?? '';
          const shown = f.type === 'select' ? optionLabel(f, val) : val;
          return (
            <span key={f.key} className="console-search-facet">
              <span>
                {f.label}: {shown}
              </span>
              <button
                type="button"
                className="console-search-facet-clear"
                aria-label={`Xóa ${f.label}`}
                onClick={() => handleChange(f.key, '')}
              >
                ×
              </button>
            </span>
          );
        })}
        {menuFilters.length > 0 ? (
          <button
            type="button"
            className="console-search-caret"
            aria-label="Bộ lọc nâng cao"
            aria-expanded={menuOpen}
            title="Filters"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <LineIcon name="chevron-down" size={14} strokeWidth={2} />
          </button>
        ) : null}
      </div>
      {menuOpen && menuFilters.length > 0 ? (
        <div className="console-search-menu">
          {menuFilters.map((f) => renderExtraField(f, currentValues[f.key] ?? '', handleChange))}
        </div>
      ) : null}
    </div>
  );
}
