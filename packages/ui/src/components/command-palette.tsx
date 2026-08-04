import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface CommandItem {
  id: string;
  label: string;
  /** Optional group heading (e.g. "Tài chính"). */
  group?: string;
  keywords?: string;
  href?: string;
  onSelect?: () => void;
  icon?: ReactNode;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  /** Called when user picks an item with href — parent typically navigate(href). */
  onNavigate?: (href: string) => void;
  placeholder?: string;
  title?: string;
}

/**
 * ⌘K / Ctrl+K command palette for nav jump.
 * Parent owns open state + items (permission-filtered).
 * Requires @cmc/ui/premium.css (.ck-cmd*).
 */
export function CommandPalette({
  open,
  onOpenChange,
  items,
  onNavigate,
  placeholder = 'Tìm màn hình, thao tác…',
  title = 'Điều hướng nhanh',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = `${item.label} ${item.group ?? ''} ${item.keywords ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[active];
        if (item) runItem(item);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, onOpenChange]);

  function runItem(item: CommandItem) {
    onOpenChange(false);
    if (item.onSelect) item.onSelect();
    else if (item.href && onNavigate) onNavigate(item.href);
  }

  if (!open) return null;

  // Group for display
  const groups: { name: string; items: { item: CommandItem; index: number }[] }[] = [];
  filtered.forEach((item, index) => {
    const name = item.group ?? 'Khác';
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, items: [] };
      groups.push(g);
    }
    g.items.push({ item, index });
  });

  return (
    <div className="ck-cmd" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="ck-cmd-backdrop"
        aria-label="Đóng"
        onClick={() => onOpenChange(false)}
      />
      <div className="ck-cmd-panel">
        <div className="ck-cmd-head">
          <input
            ref={inputRef}
            className="ck-cmd-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="ck-cmd-kbd">esc</kbd>
        </div>
        <div className="ck-cmd-list" role="listbox">
          {filtered.length === 0 ? (
            <div className="ck-cmd-empty">Không có kết quả</div>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="ck-cmd-group">
                <div className="ck-cmd-group-label">{g.name}</div>
                {g.items.map(({ item, index }) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className={
                      index === active ? 'ck-cmd-item is-active' : 'ck-cmd-item'
                    }
                    onMouseEnter={() => setActive(index)}
                    onClick={() => runItem(item)}
                  >
                    {item.icon ? <span className="ck-cmd-item-icon">{item.icon}</span> : null}
                    <span className="ck-cmd-item-label">{item.label}</span>
                    {item.group ? (
                      <span className="ck-cmd-item-meta">{item.group}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <div className="ck-cmd-foot">
          <span>
            <kbd className="ck-cmd-kbd">↑↓</kbd> di chuyển
          </span>
          <span>
            <kbd className="ck-cmd-kbd">↵</kbd> mở
          </span>
          <span>
            <kbd className="ck-cmd-kbd">esc</kbd> đóng
          </span>
        </div>
      </div>
    </div>
  );
}

/** Hook: open palette on ⌘K / Ctrl+K (ignores inputs). */
export function useCommandPaletteHotkey(onOpen: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'k') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        // Still allow ⌘K from inputs — common UX for command palette
      }
      e.preventDefault();
      onOpen();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen, enabled]);
}
