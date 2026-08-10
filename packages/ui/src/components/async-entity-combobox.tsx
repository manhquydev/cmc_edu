import { useEffect, useMemo, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Selector, type SelectorStatus } from '@astryxdesign/core/Selector';
import { Stack } from '@astryxdesign/core/Stack';
import { TextInput } from '@astryxdesign/core/TextInput';

export interface AsyncEntityOption {
  value: string;
  label: string;
}

export interface UseAsyncEntityOptionsResult {
  options: AsyncEntityOption[];
  isLoading: boolean;
  /** Fetch-error message, if any — rendered as a warning Banner above the
   * picker. Compared against an independently-built version of this same
   * component (parallel worktree) that put this in the component instead of
   * leaving every caller to duplicate a local Banner — 2 of this component's
   * 5 original callers (classes/index.tsx, receipt-create.tsx) did exactly
   * that before this was ported in. */
  error?: string;
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
  /** Forwarded to the inner Selector — shown as a tooltip when isDisabled. */
  disabledMessage?: string;
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
  disabledMessage,
}: AsyncEntityComboboxProps) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { options: fetchedOptions, isLoading, error } = useOptions(debouncedSearch);

  const options = useMemo(() => {
    if (!value || fetchedOptions.some((o) => o.value === value)) return fetchedOptions;
    return [{ value, label: pinnedLabel(value) }, ...fetchedOptions];
  }, [fetchedOptions, value, pinnedLabel]);

  return (
    <Stack gap={1}>
      {error ? (
        <Banner status="warning" title={`Không tải được ${label.toLowerCase()}`} description={error} />
      ) : null}
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
        placeholder={placeholder ?? 'Chọn...'}
        options={options}
        value={value}
        onChange={onChange}
        hasClear
        size={size}
        isRequired={isRequired}
        isLoading={isLoading}
        isDisabled={isDisabled}
        disabledMessage={disabledMessage}
        status={status}
      />
    </Stack>
  );
}
