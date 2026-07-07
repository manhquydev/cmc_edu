import { Alert, Box, Skeleton, Table, Text } from '@mantine/core';
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
    return (
      <Box p="md">
        <Alert color="red" title="Lỗi tải dữ liệu">
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table highlightOnHover={!!onRowClick} fz="sm">
        <Table.Thead>
          <Table.Tr>
            {columns.map((col) => (
              <Table.Th
                key={col.key}
                style={{
                  width: col.width,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--cmc-text-muted)',
                  background: 'var(--cmc-surface-2)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <Table.Tr key={`skel-${i}`}>
                  {columns.map((col) => (
                    <Table.Td key={col.key}>
                      <Skeleton height={14} radius="xs" />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
            : data.length === 0
              ? (
                <Table.Tr>
                  <Table.Td colSpan={columns.length}>
                    <EmptyState title={empty} />
                  </Table.Td>
                </Table.Tr>
              )
              : data.map((row, i) => (
                  <Table.Tr
                    key={(row['id'] as string | undefined) ?? i}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    style={onRowClick ? { cursor: 'pointer' } : undefined}
                  >
                    {columns.map((col) => (
                      <Table.Td key={col.key}>
                        {col.render ? (
                          col.render(row[col.key], row)
                        ) : (
                          <Text fz="sm">{String(row[col.key] ?? '')}</Text>
                        )}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
