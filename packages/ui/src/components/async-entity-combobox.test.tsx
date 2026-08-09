import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { AsyncEntityCombobox } from './async-entity-combobox.js';

function makeUseOptions(all: { value: string; label: string }[]) {
  return vi.fn((search: string) => {
    const q = search.trim().toLowerCase();
    const options = q ? all.filter((o) => o.label.toLowerCase().includes(q)) : all;
    return { options, isLoading: false };
  });
}

describe('AsyncEntityCombobox', () => {
  it('calls useOptions with the debounced search text, not on every keystroke', () => {
    vi.useFakeTimers();
    try {
      const useOptions = makeUseOptions([{ value: '1', label: 'Lớp A' }]);
      render(
        <AsyncEntityCombobox
          label="Lớp"
          value={null}
          onChange={() => {}}
          useOptions={useOptions}
          pinnedLabel={(v) => `Đã chọn (${v})`}
        />,
      );
      useOptions.mockClear();
      const search = screen.getByLabelText('Lớp — tìm kiếm');
      act(() => {
        fireEvent.change(search, { target: { value: 'l' } });
        fireEvent.change(search, { target: { value: 'lo' } });
        fireEvent.change(search, { target: { value: 'lop' } });
      });
      // useOptions is a hook — React calls it every render regardless, so
      // the debounce contract isn't "called once" but "never called with an
      // intermediate keystroke value, only the settled one."
      expect(useOptions).not.toHaveBeenCalledWith('lop');
      expect(useOptions).not.toHaveBeenCalledWith('l');
      expect(useOptions).not.toHaveBeenCalledWith('lo');
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(useOptions).toHaveBeenCalledWith('lop');
      expect(useOptions).not.toHaveBeenCalledWith('l');
      expect(useOptions).not.toHaveBeenCalledWith('lo');
    } finally {
      vi.useRealTimers();
    }
  });

  it('pins the selected value into options even when the search result set excludes it', () => {
    // Simulates record #101: a value selected earlier that the current
    // (search-scoped) result page no longer contains — this is the exact
    // shape of the bug this component exists to fix.
    const useOptions = vi.fn(() => ({
      options: [{ value: 'other', label: 'Lớp khác' }],
      isLoading: false,
    }));
    render(
      <AsyncEntityCombobox
        label="Lớp"
        value="record-101"
        onChange={() => {}}
        useOptions={useOptions}
        pinnedLabel={(v) => `Lớp đã chọn (${v})`}
      />,
    );
    // Astryx's Selector renders the selected label in more than one internal
    // node (trigger display + overlay) — assert presence, not singularity.
    expect(screen.getAllByText('Lớp đã chọn (record-101)').length).toBeGreaterThan(0);
  });

  it('does not duplicate the pinned value once the search result set includes it', () => {
    const useOptions = vi.fn(() => ({
      options: [{ value: 'record-101', label: 'Lớp thật' }],
      isLoading: false,
    }));
    render(
      <AsyncEntityCombobox
        label="Lớp"
        value="record-101"
        onChange={() => {}}
        useOptions={useOptions}
        pinnedLabel={(v) => `Lớp đã chọn (${v})`}
      />,
    );
    expect(screen.queryByText('Lớp đã chọn (record-101)')).not.toBeInTheDocument();
    expect(screen.getAllByText('Lớp thật').length).toBeGreaterThan(0);
  });

  it('forwards the picked value to onChange', () => {
    const onChange = vi.fn();
    const useOptions = vi.fn(() => ({
      options: [{ value: 'abc', label: 'Lớp ABC' }],
      isLoading: false,
    }));
    render(
      <AsyncEntityCombobox
        label="Lớp"
        value={null}
        onChange={onChange}
        useOptions={useOptions}
        pinnedLabel={(v) => v}
      />,
    );
    fireEvent.click(screen.getByLabelText('Lớp'));
    fireEvent.click(screen.getByText('Lớp ABC'));
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('forwards status (e.g. a validation error) to the inner Selector', () => {
    const useOptions = vi.fn(() => ({ options: [], isLoading: false }));
    render(
      <AsyncEntityCombobox
        label="Khoá học"
        value={null}
        onChange={() => {}}
        useOptions={useOptions}
        pinnedLabel={(v) => v}
        status={{ type: 'error', message: 'Vui lòng chọn khoá học' }}
      />,
    );
    expect(screen.getByText('Vui lòng chọn khoá học')).toBeInTheDocument();
  });
});
