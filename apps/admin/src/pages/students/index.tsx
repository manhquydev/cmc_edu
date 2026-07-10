import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DataTable, HStack, PageHeader, StatusBadge, Text, TextInput } from '@cmc/ui';
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
      <HStack padding={4} gap={2}>
        <div style={{ flex: 1, maxWidth: 400 }}>
          <TextInput
            label="Tìm kiếm học viên"
            isLabelHidden
            placeholder="Nhập tên hoặc SĐT phụ huynh…"
            value={query}
            onChange={(v) => setQuery(v)}
            onEnter={handleSearch}
            size="sm"
          />
        </div>
        <Button
          label="Tìm kiếm"
          size="sm"
          variant="primary"
          onClick={handleSearch}
          isDisabled={query.trim().length < 2}
        />
      </HStack>
      {submitted.length < 2 ? (
        <HStack padding={4}>
          <Text type="supporting" size="sm">
            Nhập ít nhất 2 ký tự để tìm kiếm.
          </Text>
        </HStack>
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
