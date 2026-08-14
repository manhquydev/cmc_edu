import { Table, pixel, proportional } from '@astryxdesign/core/Table';
import { Banner } from '@astryxdesign/core/Banner';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { EmptyState, type EmptyStateKind } from './empty-state.js';
import { LineIcon } from './line-icon.js';

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => ReactNode;
  width?: number | string;
  /** Renders the header as a sort button and publishes `aria-sort`. */
  sortable?: boolean;
}

export type SortDirection = 'ascending' | 'descending';

export interface TableSort {
  key: string;
  direction: SortDirection;
}

/** The story behind an empty table. See `EmptyStateKind`. */
export interface TableEmptySpec {
  kind: EmptyStateKind;
  title: string;
  description?: string;
  action?: ReactNode;
}

export type TableDensity = 'compact' | 'default' | 'comfortable';

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  error?: string;
  /**
   * Empty-table copy. A bare string is the legacy form and reads as a
   * first-run absence; pass a `TableEmptySpec` to say which of the three
   * stories this is and what the operator should do next.
   */
  empty?: string | TableEmptySpec;
  onRowClick?: (row: T) => void;
  /**
   * Controlled row selection (ids). When set with `onSelectionChange`,
   * a leading checkbox column is rendered.
   */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Defaults to `row.id` string. */
  getRowId?: (row: T) => string;
  /** Trailing thead gear to show/hide columns. Default on for list chrome. */
  columnConfigurator?: boolean;
  /** Controlled sort state; pair with `onSortChange` and `column.sortable`. */
  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
  /**
   * Row measurement only. Density never changes the type ramp, and it never
   * changes the default: 40px stays the OpenEduCat contract row.
   */
  density?: TableDensity;
}

const SKELETON_ROWS = 5;

const ROW_OPEN_INTERACTIVE =
  'button, a, input, select, textarea, label, [role="button"], [role="checkbox"]';

/** True when the event originated on an interactive descendant, not the wrapper. */
function isInteractiveDescendant(
  target: EventTarget | null,
  currentTarget: EventTarget,
): boolean {
  if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
    return false;
  }
  const hit = target.closest(ROW_OPEN_INTERACTIVE);
  return hit != null && hit !== currentTarget && currentTarget.contains(hit);
}

function isPlainLabel(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

/** Accessible name from rendered cell text, never `String(object)`. */
function rowOpenLabel(content: ReactNode, raw: unknown): string {
  const fromRender = isPlainLabel(content) ? String(content).trim() : '';
  const fromRaw = isPlainLabel(raw) ? String(raw).trim() : '';
  const text = fromRender || fromRaw;
  return text === '' ? 'Mở dòng' : `Mở dòng ${text}`;
}

/**
 * A bare string cannot know which of the three stories applies, so it does not
 * claim one: no `kind` is published and the copy is left exactly as the caller
 * wrote it. Telling the operator why the list is empty requires passing a
 * `TableEmptySpec`, which is the point.
 */
function resolveEmpty(empty: string | TableEmptySpec | undefined): Omit<TableEmptySpec, 'kind'> & {
  kind?: EmptyStateKind;
} {
  if (empty == null) return { title: 'Không có dữ liệu' };
  if (typeof empty === 'string') return { title: empty };
  return empty;
}

/**
 * `aria-sort` belongs on the header cell, but the underlying Table owns the
 * `<th>` and only lets us pass header content. So the button reaches up to its
 * own cell and publishes the state there. A sortable column that is not the
 * active one still says `none`, so a screen reader can tell "sortable, unsorted"
 * from "not sortable".
 */
function SortHeader({
  label,
  active,
  direction,
  onToggle,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const value = active ? direction : 'none';
  useEffect(() => {
    const cell = ref.current?.closest('th');
    if (cell) cell.setAttribute('aria-sort', value);
  }, [value]);
  return (
    <button
      type="button"
      className="console-list-sort"
      ref={ref}
      onClick={onToggle}
      data-sort={value}
    >
      {label}
      <LineIcon name="chevron-down" size={12} strokeWidth={2} aria-hidden />
    </button>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  error,
  empty,
  onRowClick,
  selectedIds,
  onSelectionChange,
  getRowId,
  columnConfigurator = false,
  sort,
  onSortChange,
  density = 'default',
}: DataTableProps<T>) {
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const resolveId =
    getRowId ??
    ((row: T) => (row['id'] as string | undefined) ?? JSON.stringify(row));

  const densityAttr = density === 'default' ? undefined : density;

  if (error) {
    return (
      <div className="console-list" data-density={densityAttr}>
        <Banner status="error" title="Lỗi tải dữ liệu" description={error} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="console-list" data-density={densityAttr}>
        <Stack gap={0.5} paddingBlock={2}>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <Skeleton key={i} height={32} radius={0} />
          ))}
        </Stack>
      </div>
    );
  }

  if (data.length === 0) {
    const spec = resolveEmpty(empty);
    return (
      <div className="console-list" data-density={densityAttr}>
        <EmptyState
          title={spec.title}
          description={spec.description}
          action={spec.action}
          kind={spec.kind}
          density="ops"
        />
      </div>
    );
  }

  const selectionEnabled = selectedIds != null && onSelectionChange != null;
  const selectedSet = new Set(selectedIds ?? []);
  const allIds = data.map((row) => resolveId(row));
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id));
  const someSelected = allIds.some((id) => selectedSet.has(id));

  function toggleOne(id: string, checked: boolean) {
    if (!onSelectionChange || !selectedIds) return;
    if (checked) {
      onSelectionChange(selectedIds.includes(id) ? selectedIds : [...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    }
  }

  function toggleAll(checked: boolean) {
    if (!onSelectionChange) return;
    onSelectionChange(checked ? [...allIds] : []);
  }

  function toggleColumn(key: string) {
    setHiddenKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= columns.length - 1) return prev;
      return [...prev, key];
    });
  }

  const visibleColumns = columns.filter((col) => !hiddenKeys.includes(col.key));
  const displayColumns = visibleColumns.length > 0 ? visibleColumns : columns.slice(0, 1);

  const mappedColumns = [
    ...(selectionEnabled
      ? [
          {
            key: '__select',
            header: (
              <input
                type="checkbox"
                aria-label="Chọn tất cả trên trang"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={(e) => toggleAll(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            ),
            width: pixel(44),
            renderCell: (row: T) => {
              const id = resolveId(row);
              return (
                <input
                  type="checkbox"
                  aria-label="Chọn dòng"
                  checked={selectedSet.has(id)}
                  onChange={(e) => toggleOne(id, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
              );
            },
          },
        ]
      : []),
    ...displayColumns.map((col, colIndex) => ({
      key: col.key,
      header:
        col.sortable && onSortChange ? (
          <SortHeader
            label={col.label}
            active={sort?.key === col.key}
            direction={sort?.key === col.key ? sort.direction : 'ascending'}
            onToggle={() =>
              onSortChange({
                key: col.key,
                direction:
                  sort?.key === col.key && sort.direction === 'ascending'
                    ? 'descending'
                    : 'ascending',
              })
            }
          />
        ) : (
          col.label
        ),
      width: typeof col.width === 'number' ? pixel(col.width) : proportional(1),
      renderCell: (row: T) => {
        const content = col.render ? (
          col.render(row[col.key], row)
        ) : (
          <Text type="body" size="sm">
            {String(row[col.key] ?? '')}
          </Text>
        );
        if (!onRowClick) return content;
        const isKeyboardEntry = colIndex === 0;
        return (
          <div
            {...(isKeyboardEntry
              ? {
                  role: 'button' as const,
                  tabIndex: 0,
                  'aria-label': rowOpenLabel(content, row[col.key]),
                  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    if (isInteractiveDescendant(e.target, e.currentTarget)) return;
                    e.preventDefault();
                    onRowClick(row);
                  },
                }
              : {})}
            onClick={(e) => {
              if (isInteractiveDescendant(e.target, e.currentTarget)) return;
              onRowClick(row);
            }}
            style={{ cursor: 'pointer' }}
          >
            {content}
          </div>
        );
      },
    })),
    ...(columnConfigurator
      ? [
          {
            key: '__cols',
            header: (
              <button
                type="button"
                className="console-list-config"
                aria-label="Cột hiển thị"
                aria-expanded={configOpen}
                title="Cột hiển thị"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfigOpen((open) => !open);
                }}
              >
                <LineIcon name="layers" size={14} strokeWidth={2} />
              </button>
            ),
            width: pixel(40),
            renderCell: () => null,
          },
        ]
      : []),
  ];

  return (
    <div className="console-list" data-density={densityAttr}>
      {columnConfigurator && configOpen ? (
        <div className="console-list-config-menu" role="group" aria-label="Chọn cột">
          {columns.map((col) => (
            <label key={col.key}>
              <input
                type="checkbox"
                checked={!hiddenKeys.includes(col.key)}
                onChange={() => toggleColumn(col.key)}
              />{' '}
              {col.label}
            </label>
          ))}
        </div>
      ) : null}
      <Table<T>
        data={data}
        idKey={(row) => resolveId(row)}
        density="compact"
        dividers="rows"
        isStriped={false}
        hasHover
        columns={mappedColumns}
      />
    </div>
  );
}
