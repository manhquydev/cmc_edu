import { useEffect, useMemo, useState } from 'react';
import { Selector, Stack, TextInput } from '../primitives.js';
import type { SelectorStatus } from '@astryxdesign/core/Selector';

export interface AsyncEntityOption {
  value: string;
  label: string;
}

export interface UseAsyncEntityOptionsResult {
  options: AsyncEntityOption[];
  isLoading: boolean;
}

export interface AsyncEntityComboboxProps {
  label: string;
  /** Selected entity id, or `null` when nothing is picked. */
  value: string | null;
  onChange: (value: string | null) => void;
  /**
   * Caller-supplied hook returning the current page of options for a given
   * (debounced) search string. Called on every render with the settled
   * search text — memoize the underlying query inside your own hook
   * (e.g. a tRPC `useQuery`), don't debounce again in there.
   */
  useOptions: (search: string) => UseAsyncEntityOptionsResult;
  /**
   * Label to show for `value` when the current options page doesn't include
   * it (e.g. it was picked before the user typed a search that excludes it,
   * or — the bug this component exists to fix — it's past the page's
   * pageSize cutoff). Receives the raw id.
   */
  pinnedLabel: (value: string) => string;
  placeholder?: string;
  searchPlaceholder?: string;
  size?: 'sm' | 'md';
  isRequired?: boolean;
  isLabelHidden?: boolean;
  isDisabled?: boolean;
  /** Forwarded to the inner Selector — validation error/warning display. */
  status?: SelectorStatus;
}

/**
 * Server-searched entity picker. `Selector`'s own `hasSearch` only filters
 * the already-fetched `options` array client-side — it has no hook to drive
 * a server query, so a picker whose full list exceeds one page (the S6 bug:
 * a hardcoded `pageSize: 100` silently drops record #101+) can't be fixed by
 * turning that flag on. This component owns its own debounced search input
 * instead, feeding it into the caller's `useOptions` hook, and pins the
 * current `value` into the option list if the current search-scoped page
 * doesn't contain it — so search narrowing can never make the active
 * selection disappear out from under the user.
 */
export function AsyncEntityCombobox({
  label,
  value,
  onChange,
  useOptions,
  pinnedLabel,
  placeholder,
  searchPlaceholder,
  size = 'sm',
  isRequired,
  isLabelHidden,
  isDisabled,
  status,
}: AsyncEntityComboboxProps) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { options: fetchedOptions, isLoading } = useOptions(debouncedSearch);

  const options = useMemo(() => {
    if (!value || fetchedOptions.some((o) => o.value === value)) return fetchedOptions;
    return [{ value, label: pinnedLabel(value) }, ...fetchedOptions];
  }, [fetchedOptions, value, pinnedLabel]);

  return (
    <Stack gap={1}>
      <TextInput
        label={`${label} — tìm kiếm`}
        isLabelHidden
        placeholder={searchPlaceholder ?? 'Tìm kiếm...'}
        value={searchInput}
        onChange={setSearchInput}
        size={size}
        isDisabled={isDisabled}
      />
      <Selector
        label={label}
        isLabelHidden={isLabelHidden}
        placeholder={isLoading ? 'Đang tải…' : placeholder ?? 'Chọn...'}
        options={options}
        value={value}
        onChange={onChange}
        hasClear
        size={size}
        isRequired={isRequired}
        isDisabled={isDisabled}
        status={status}
      />
    </Stack>
  );
}
