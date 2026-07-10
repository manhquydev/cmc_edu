import { Table, pixel, proportional } from '@astryxdesign/core/Table';
import { Banner } from '@astryxdesign/core/Banner';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';
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
}

const SKELETON_ROWS = 5;

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  error,
  empty = 'Không có dữ liệu',
  onRowClick,
}: DataTableProps<T>) {
  if (error) {
    return <Banner status="error" title="Lỗi tải dữ liệu" description={error} />;
  }

  if (loading) {
    return (
      <Stack gap={0.5} paddingBlock={2}>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <Skeleton key={i} height={32} radius={0} />
        ))}
      </Stack>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={empty} />;
  }

  return (
    <Table<T>
      data={data}
      idKey={(row) => (row['id'] as string | undefined) ?? JSON.stringify(row)}
      density="compact"
      dividers="rows"
      hasHover={!!onRowClick}
      columns={columns.map((col) => ({
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
          // Table has no row-level onClick (checked the installed package's
          // .d.ts, not just prose docs) — every cell's rendered content is
          // wrapped so clicking anywhere in a cell triggers navigation,
          // matching the prior row-click UX used by 8 call sites across the app.
          if (!onRowClick) return content;
          return (
            <div onClick={() => onRowClick(row)} style={{ cursor: 'pointer' }}>
              {content}
            </div>
          );
        },
      }))}
    />
  );
}
