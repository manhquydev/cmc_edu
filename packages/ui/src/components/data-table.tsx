import { Table, pixel, proportional } from '@astryxdesign/core/Table';
import { Banner } from '@astryxdesign/core/Banner';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { KeyboardEvent, ReactNode } from 'react';
import { EmptyState } from './empty-state.js';

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => ReactNode;
  width?: number | string;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  error?: string;
  empty?: string;
  onRowClick?: (row: T) => void;
  /**
   * Controlled row selection (ids). When set with `onSelectionChange`,
   * a leading checkbox column is rendered.
   */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Defaults to `row.id` string. */
  getRowId?: (row: T) => string;
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

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  error,
  empty = 'Không có dữ liệu',
  onRowClick,
  selectedIds,
  onSelectionChange,
  getRowId,
}: DataTableProps<T>) {
  const resolveId =
    getRowId ??
    ((row: T) => (row['id'] as string | undefined) ?? JSON.stringify(row));

  if (error) {
    return (
      <div className="console-list">
        <Banner status="error" title="Lỗi tải dữ liệu" description={error} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="console-list">
        <Stack gap={0.5} paddingBlock={2}>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <Skeleton key={i} height={32} radius={0} />
          ))}
        </Stack>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="console-list">
        <EmptyState title={empty} />
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
    ...columns.map((col, colIndex) => ({
      key: col.key,
      header: col.label,
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
        // One keyboard entry per row (first non-checkbox cell). Other cells
        // stay mouse-only so we do not multiply tab stops.
        const isKeyboardEntry = colIndex === 0;
        // Row open must not steal clicks/keys from buttons/inputs in the cell
        // (e.g. aftersale "Tiếp nhận", KPI "Xác nhận", parents "Duyệt").
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
  ];

  return (
    <div className="console-list">
      <Table<T>
        data={data}
        idKey={(row) => resolveId(row)}
        density="compact"
        dividers="rows"
        isStriped
        hasHover={!!onRowClick}
        columns={mappedColumns}
      />
    </div>
  );
}
