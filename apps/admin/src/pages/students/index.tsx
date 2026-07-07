import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Group, Text } from '@mantine/core';
import { TextInput } from '@mantine/core';
import { DataTable, PageHeader, StatusBadge } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

interface StudentRow {
  id: string;
  fullName: string;
  lifecycle: string;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<StudentRow>[] = [
  { key: 'fullName', label: 'Họ tên' },
  {
    key: 'lifecycle',
    label: 'Trạng thái',
    width: 140,
    render: (v) => <StatusBadge status={String(v)} />,
  },
];

export default function StudentListPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  // Detect phone (starts with digit) vs name search.
  const lookupInput = /^\d/.test(submitted)
    ? { phone: submitted }
    : { name: submitted };

  const { data, isLoading, error } = trpc.student.lookup.useQuery(lookupInput, {
    enabled: submitted.length >= 2,
  });

  function handleSearch() {
    const q = query.trim();
    if (q.length >= 2) setSubmitted(q);
  }

  return (
    <>
      <PageHeader
        title="Học viên"
        subtitle="Tra cứu học viên theo tên hoặc SĐT phụ huynh (tối đa 20 kết quả)"
        breadcrumbs={[{ label: 'Quản trị' }, { label: 'Học viên' }]}
      />
      <Group p="md" gap="sm">
        <TextInput
          placeholder="Nhập tên hoặc SĐT phụ huynh…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1, maxWidth: 400 }}
          size="sm"
        />
        <Button size="sm" onClick={handleSearch} disabled={query.trim().length < 2}>
          Tìm kiếm
        </Button>
      </Group>
      {submitted.length < 2 ? (
        <Group p="md">
          <Text fz="sm" c="dimmed">
            Nhập ít nhất 2 ký tự để tìm kiếm.
          </Text>
        </Group>
      ) : (
        <DataTable<StudentRow>
          columns={COLUMNS}
          data={(data as StudentRow[] | undefined) ?? []}
          loading={isLoading}
          error={error?.message}
          empty="Không tìm thấy học viên"
          onRowClick={(row) =>
            void navigate(`/admin/students/${row.id}`, { state: { student: row } })
          }
        />
      )}
    </>
  );
}
