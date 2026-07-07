import { useState } from 'react';
import { Badge, Button, Group, Modal, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { DataTable, PageHeader } from '@cmc/ui';
import type { TableColumn } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';

interface GiftRow {
  id: string;
  name: string;
  starsRequired: number;
  stock: number;
  isActive: boolean;
  [key: string]: unknown;
}

const COLUMNS: TableColumn<GiftRow>[] = [
  { key: 'name', label: 'Tên phần thưởng' },
  {
    key: 'starsRequired',
    label: 'Sao cần',
    width: 110,
    render: (v) => (
      <Text fz="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
        ⭐ {String(v)}
      </Text>
    ),
  },
  {
    key: 'stock',
    label: 'Tồn kho',
    width: 130,
    render: (v) => (
      <Text fz="sm">{Number(v) === -1 ? 'Không giới hạn' : String(v)}</Text>
    ),
  },
  {
    key: 'isActive',
    label: 'Kích hoạt',
    width: 110,
    render: (v) => (
      <Badge color={Boolean(v) ? 'green' : 'gray'} variant="light">
        {Boolean(v) ? 'Hoạt động' : 'Ẩn'}
      </Badge>
    ),
  },
];

interface GiftFormState {
  name: string;
  starsRequired: number | string;
  stock: number | string;
}

const EMPTY_FORM: GiftFormState = { name: '', starsRequired: 1, stock: -1 };

export default function GiftsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<GiftFormState>(EMPTY_FORM);

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.gift.list.useQuery({ includeInactive: true });

  const upsertMut = trpc.gift.upsert.useMutation({
    onSuccess: () => {
      setModalOpen(false);
      setForm(EMPTY_FORM);
      void utils.gift.list.invalidate();
    },
  });

  function handleCreate() {
    upsertMut.mutate({
      name: form.name.trim(),
      starsRequired: Number(form.starsRequired),
      stock: Number(form.stock),
      isActive: true,
    });
  }

  const isFormValid =
    form.name.trim().length > 0 && Number(form.starsRequired) >= 1;

  return (
    <>
      <PageHeader
        title="Phần thưởng"
        subtitle="Quản lý danh mục phần thưởng đổi sao"
        breadcrumbs={[
          { label: 'Quản trị' },
          { label: 'Engagement' },
          { label: 'Phần thưởng' },
        ]}
        actions={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            Thêm phần thưởng
          </Button>
        }
      />

      <DataTable<GiftRow>
        columns={COLUMNS}
        data={(data as GiftRow[] | undefined) ?? []}
        loading={isLoading}
        error={error?.message}
        empty="Chưa có phần thưởng nào"
      />

      <Modal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setForm(EMPTY_FORM); }}
        title="Thêm phần thưởng"
        size="sm"
        radius="xs"
        centered
        closeOnClickOutside={!upsertMut.isPending}
      >
        <Stack gap="sm">
          <TextInput
            label="Tên phần thưởng"
            placeholder="VD: Bút bi, Sách tô màu…"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))}
            required
          />
          <NumberInput
            label="Số sao cần"
            min={1}
            value={form.starsRequired}
            onChange={(v) => setForm((f) => ({ ...f, starsRequired: v }))}
            required
          />
          <NumberInput
            label="Tồn kho (-1 = không giới hạn)"
            min={-1}
            value={form.stock}
            onChange={(v) => setForm((f) => ({ ...f, stock: v }))}
          />
          {upsertMut.error && (
            <Text fz="sm" c="red">
              {upsertMut.error.message}
            </Text>
          )}
          <Group justify="flex-end" mt="xs" gap="xs">
            <Button
              variant="default"
              radius="xs"
              onClick={() => { setModalOpen(false); setForm(EMPTY_FORM); }}
              disabled={upsertMut.isPending}
            >
              Hủy
            </Button>
            <Button
              radius="xs"
              onClick={handleCreate}
              loading={upsertMut.isPending}
              disabled={!isFormValid}
            >
              Tạo
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
